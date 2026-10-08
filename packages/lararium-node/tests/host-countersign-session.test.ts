/**
 * host-countersign-session.test.ts — a user's invite, countersigned over the live session: a real
 * DaemonAuthGate behind a real WebSocketServer, a real LarWSClientAdapter, real Ed25519.
 *
 * Proven:
 *   · a walker on a live, verified socket asks on `host-countersign/ask`; the hearth's `serveHostCountersign`
 *     answers on the same socket; the walker's leaf mints a `hosted` invite that ADMITS at the newcomer's gate,
 *   · CONTROL — a closed socket carries no session: nothing is sent and the ask reads `no-live-session`,
 *   · a request proven over a PREVIOUS socket's session is refused `bad-session-proof` over the wire: the
 *     hearth reads the session from its own gate, never from the walker,
 *   · a hearth with no admit in the asked Nexus lends nothing (`hearth-not-admitted`).
 */
import { describe, test, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { WebSocketServer } from "ws";
import * as ed from "@noble/ed25519";
import type { PeerId } from "@automerge/automerge-repo";
import {
  LarWSClientAdapter, verifyAuthProof, ed25519SignerFromSeed, signCarriageQuorum, signCarriageContract,
  askHearthOverSession, mintHostedInvite, decideBootInvite, bootInviteId, makeMultiSigQuorumVerifier, hex,
  type AuthVerifierShore, type InviteStandingContext, type HostSession,
} from "@lararium/mesh";
import { DaemonAuthGate } from "../src/daemon-auth-gate.js";
import { serveHostCountersign, type HearthStandingSource } from "../src/host-countersign.js";

const AUD   = "lar:///ha.ka.ba/bags/daemon";
const AID   = "nexus-aid-genesis-0a1b2c";
const EPOCH = "epoch-cid-genesis";
const KAHU  = [new Uint8Array(32).fill(1), new Uint8Array(32).fill(2), new Uint8Array(32).fill(3)];
const GATE  = new Uint8Array(32).fill(21);
const HEARTH_LEAF = new Uint8Array(32).fill(5);
const WALKER_VESSEL = new Uint8Array(32).fill(31);
const WALKER_LEAF   = new Uint8Array(32).fill(6);
const pub = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const signer = (s: Uint8Array) => async (b: Uint8Array) => hex(await ed.signAsync(b, s));

/** The gate's shore: the real V3 proof, then the capability — the walker's vessel key is hosted here. */
function shoreFor(gatePubKey: string, admitted: string): AuthVerifierShore {
  return {
    async verify(cardBytes, bagUrl, _access, proof) {
      if (!proof) return { ok: false, reason: "V3 proof required" };
      const { peerPubKey } = JSON.parse(new TextDecoder().decode(cardBytes)) as { peerPubKey: string };
      const v = await verifyAuthProof({ nonce: proof.nonce, gatePubKey, peerPubKey, aud: bagUrl, ts: proof.ts, sig: proof.sig });
      if (!v.ok) return { ok: false, reason: v.reason ?? "proof failed" };
      return peerPubKey === admitted ? { ok: true, identifier: peerPubKey } : { ok: false, reason: "not hosted" };
    },
  };
}

async function hearthAdmit() {
  const nym = await pub(HEARTH_LEAF);
  return signCarriageQuorum(
    { nym, action: "admit", parents: [], sealEpochCid: EPOCH },
    await Promise.all(KAHU.slice(0, 2).map(async (s) => ({ signer: await pub(s), sign: signer(s) }))),
    await signCarriageContract(nym, EPOCH, signer(HEARTH_LEAF)),
  );
}

async function newcomerCtx(): Promise<InviteStandingContext> {
  return {
    roster:          { keys: await Promise.all(KAHU.map(pub)), threshold: 2, sealEpochCid: EPOCH },
    denyBoard:       [],
    antigen:         [],
    antigenRoster:   { keys: [await pub(new Uint8Array(32).fill(11))], threshold: 1, sealEpochCid: EPOCH },
    antigenVerifier: makeMultiSigQuorumVerifier(),
  };
}

let http: Server | null = null;
let wss: WebSocketServer | null = null;
let adapter: LarWSClientAdapter | null = null;

afterEach(async () => {
  try { adapter?.disconnect(); } catch { /* never connected */ }
  adapter = null;
  if (wss) await new Promise<void>((res) => wss!.close(() => res()));
  if (http) await new Promise<void>((res) => http!.close(() => res()));
  wss = null; http = null;
});

/** Stand the hearth: a gate serving countersigns from `standing`, listening on a free port. */
async function standHearth(standing: HearthStandingSource): Promise<{ gate: DaemonAuthGate; port: number; gatePub: string }> {
  http = createServer();
  wss = new WebSocketServer({ server: http });
  const gate = new DaemonAuthGate(wss);
  const gatePub = await pub(GATE);
  gate.arm(shoreFor(gatePub, await pub(WALKER_VESSEL)), AUD, { pubKey: gatePub, sign: ed25519SignerFromSeed(GATE) });
  serveHostCountersign(gate, standing);
  const port = await new Promise<number>((resolve) => http!.listen(0, "127.0.0.1", () => {
    const a = http!.address(); resolve(typeof a === "object" && a ? a.port : 0);
  }));
  return { gate, port, gatePub };
}

/** Dial the hearth as the walker's vessel and wait for the gate's signed verdict — the session. */
async function dial(port: number, gatePub: string): Promise<HostSession> {
  const vesselPub = await pub(WALKER_VESSEL);
  adapter = new LarWSClientAdapter({
    url: `ws://127.0.0.1:${port}`, aud: AUD, gatePubKey: gatePub,
    identity: { contactCard: JSON.stringify({ peerPubKey: vesselPub }), peerPubKey: vesselPub, sign: ed25519SignerFromSeed(WALKER_VESSEL) },
  });
  adapter.connect("walker" as PeerId);
  for (let i = 0; i < 500 && adapter.session === null; i++) await new Promise((r) => setTimeout(r, 10));
  if (!adapter.session) throw new Error("the walker never verified the hearth's gate");
  return adapter.session;
}

const hosting: HearthStandingSource = async (aid) => aid === AID
  ? { leaf: { handleIndex: 0, verifyingKey: await pub(HEARTH_LEAF), seed: HEARTH_LEAF }, admit: await hearthAdmit(), lineage: [] }
  : null;

const mint = async (session: HostSession, ask: Parameters<typeof mintHostedInvite>[0]["askHearth"]) =>
  mintHostedInvite({
    nexusAid: AID, nonce: "a1b2c3d4e5f60718", walkerKey: await pub(WALKER_LEAF), session,
    sign: signer(WALKER_LEAF), askHearth: ask,
  });

describe("the countersign rides the live session", () => {
  test("a walker on a live socket gets a countersign, and its hosted invite ADMITS", async () => {
    const { port, gatePub } = await standHearth(hosting);
    const session = await dial(port, gatePub);
    const minted = await mint(session, (req) => askHearthOverSession(adapter!, req));
    if (!minted.ok) throw new Error(`refused: ${minted.refusal}`);
    expect(minted.invite.standing).toMatchObject({ kind: "hosted", hearthKey: await pub(HEARTH_LEAF) });
    const verdict = await decideBootInvite({
      policy: { kind: "invite-only" }, nexusAid: AID, invite: minted.invite, standing: await newcomerCtx(), isSpent: () => false,
    });
    expect(verdict).toEqual({ admitted: true, burnId: bootInviteId(minted.invite) });
  }, 15_000);

  test("CONTROL: a closed socket carries no session — nothing is sent, nothing mints", async () => {
    const { port, gatePub } = await standHearth(hosting);
    const session = await dial(port, gatePub);
    adapter!.disconnect();
    expect(await mint(session, (req) => askHearthOverSession(adapter!, req))).toEqual({ ok: false, refusal: "no-live-session" });
  }, 15_000);

  test("a request proven over a PREVIOUS socket's session is refused `bad-session-proof`", async () => {
    const { port, gatePub } = await standHearth(hosting);
    const stale = await dial(port, gatePub);
    adapter!.disconnect();
    await dial(port, gatePub);                       // a fresh socket: a fresh nonce from the hearth's own gate
    expect(adapter!.session!.nonce).not.toBe(stale.nonce);
    expect(await mint(stale, (req) => askHearthOverSession(adapter!, req))).toEqual({ ok: false, refusal: "bad-session-proof" });
  }, 15_000);

  test("a hearth with no admit in the asked Nexus lends nothing (`hearth-not-admitted`)", async () => {
    const { port, gatePub } = await standHearth(async () => null);
    const session = await dial(port, gatePub);
    expect(await mint(session, (req) => askHearthOverSession(adapter!, req))).toEqual({ ok: false, refusal: "hearth-not-admitted" });
  }, 15_000);
});
