/**
 * boot-invite-burn.test.ts — the node-side invite: minted by the inviter's per-Nexus face, spent once on the
 * newcomer's island, remembered by no one.
 *
 * Proven, over two scratch LAR_ROOTs (the inviter's and the newcomer's):
 *   · the invite is signed by the persona's per-Nexus LEAF — never the vessel key, never the persona root,
 *   · mint → spend ADMITS once and burns the id LOCALLY; a SECOND spend refuses `already-spent`,
 *   · a null invite → `no-invite`, a foreign-Nexus invite → `wrong-nexus`; each burns nothing,
 *   · the MINT writes nothing at the inviter,
 *   · NO WHO-INVITED-WHOM DATUM PERSISTS: after the spend, no file under either root carries the inviter's
 *     leaf key, its admit, its contract seal, or the invite's signature; the burn ledger holds one opaque id,
 *   · A USER INVITES THROUGH ITS HOST: the walker's leaf asks its hearth over a live gate session, the hearth's
 *     leaf countersigns, and the invite ADMITS once; a closed socket draws `no-live-session` and mints nothing;
 *     after the spend no file under the hearth's, the walker's or the newcomer's root names walker, hearth,
 *     countersign, session or guest.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  signCarriageQuorum, signCarriageContract, carriageEntryActCid, makeMultiSigQuorumVerifier, hex,
  type CarriageEntry, type InviteStandingContext,
} from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { nexusLeafFor } from "../src/nexus-leaf.js";
import {
  runBootInviteMint, runHostedInviteMint, runBootInviteSpend, bootInviteBurnPath, isBurned, bootInviteId,
} from "../src/boot-invite-burn.js";
import { runHostCountersign, hostSessionOf } from "../src/host-countersign.js";
import type { HostSession, HostCountersignRequest } from "@lararium/mesh";

const AID   = "nexus-aid-genesis-0a1b2c";
const EPOCH = "epoch-cid-genesis";
const KAHU  = [new Uint8Array(32).fill(1), new Uint8Array(32).fill(2), new Uint8Array(32).fill(3)];
const WARDENS = [new Uint8Array(32).fill(11), new Uint8Array(32).fill(12)];
const pub = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);

let inviterRoot: string;
let newcomerRoot: string;
let walkerRoot: string;
let priorLarRoot: string | undefined;
const asRoot = (root: string) => { process.env["LAR_ROOT"] = root; };

beforeEach(() => {
  inviterRoot  = mkdtempSync(join(tmpdir(), "lares-invite-inviter-"));
  newcomerRoot = mkdtempSync(join(tmpdir(), "lares-invite-newcomer-"));
  walkerRoot   = mkdtempSync(join(tmpdir(), "lares-invite-walker-"));
  priorLarRoot = process.env["LAR_ROOT"];
});
afterEach(() => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorLarRoot;
  rmSync(inviterRoot, { recursive: true, force: true });
  rmSync(newcomerRoot, { recursive: true, force: true });
  rmSync(walkerRoot, { recursive: true, force: true });
});

async function standingCtx(): Promise<InviteStandingContext> {
  return {
    roster:          { keys: await Promise.all(KAHU.map(pub)), threshold: 2, sealEpochCid: EPOCH },
    denyBoard:       [],
    antigen:         [],
    antigenRoster:   { keys: await Promise.all(WARDENS.map(pub)), threshold: 2, sealEpochCid: EPOCH },
    antigenVerifier: makeMultiSigQuorumVerifier(),
  };
}

/** Stand a persona at the inviter's root and have the kahu quorum admit its per-Nexus leaf. */
async function standInviter(): Promise<{ leafKey: string; admit: CarriageEntry; rootKey: string; vesselKey: string }> {
  asRoot(inviterRoot);
  await generateOrLoadVesselIdentity();
  const root = await generateOrLoadPersonaGroupRoot(0);
  const leaf = await nexusLeafFor(0, AID);
  const contract = await signCarriageContract(leaf.verifyingKey, EPOCH,
    async (bytes) => hex(await ed.signAsync(bytes, leaf.seed)));
  const admit = await signCarriageQuorum(
    { nym: leaf.verifyingKey, action: "admit", parents: [], sealEpochCid: EPOCH },
    await Promise.all(KAHU.slice(0, 2).map(async (s) => ({ signer: await pub(s), sign: async (b: Uint8Array) => hex(await ed.signAsync(b, s)) }))),
    contract,
  );
  return { leafKey: leaf.verifyingKey, admit, rootKey: root.verifyingKey.toLowerCase(), vesselKey: (await loadVesselVerifyingKey()).toLowerCase() };
}

/** Every file under `dir`, read whole. */
function allFiles(dir: string): Array<{ path: string; body: string }> {
  const out: Array<{ path: string; body: string }> = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...allFiles(p));
    else out.push({ path: p, body: readFileSync(p).toString("latin1") });
  }
  return out;
}

describe("the node invite — signed by the inviter's face, burned once, remembered by no one", () => {
  it("the invite is signed by the per-Nexus LEAF — not the vessel key, not the persona root", async () => {
    const who = await standInviter();
    const inv = await runBootInviteMint({ handleIndex: 0, nexusAid: AID, standing: { kind: "admit", admit: who.admit, lineage: [] } });
    expect(inv.inviterKey).toBe(who.leafKey);
    expect(inv.inviterKey).not.toBe(who.vesselKey);
    expect(inv.inviterKey).not.toBe(who.rootKey);
  });

  it("mint → spend ADMITS once and burns the id; a SECOND spend refuses already-spent", async () => {
    const who = await standInviter();
    const inv = await runBootInviteMint({ handleIndex: 0, nexusAid: AID, standing: { kind: "admit", admit: who.admit, lineage: [] } });

    asRoot(newcomerRoot);
    const first = await runBootInviteSpend({ invite: inv, nexusAid: AID, standing: await standingCtx() });
    expect(first).toEqual({ admitted: true, burnId: bootInviteId(inv) });
    expect(isBurned(larDataDir(), bootInviteId(inv))).toBe(true);

    const second = await runBootInviteSpend({ invite: inv, nexusAid: AID, standing: await standingCtx() });
    expect(second).toEqual({ admitted: false, refusal: "already-spent" });
  });

  it("a null invite → no-invite and a foreign-Nexus invite → wrong-nexus; each burns nothing", async () => {
    const who = await standInviter();
    const foreign = await runBootInviteMint({ handleIndex: 0, nexusAid: "nexus-aid-elsewhere", standing: { kind: "admit", admit: who.admit, lineage: [] } });

    asRoot(newcomerRoot);
    expect(await runBootInviteSpend({ invite: null, nexusAid: AID, standing: await standingCtx() }))
      .toEqual({ admitted: false, refusal: "no-invite" });
    expect(await runBootInviteSpend({ invite: foreign, nexusAid: AID, standing: await standingCtx() }))
      .toEqual({ admitted: false, refusal: "wrong-nexus" });
    expect(existsSync(bootInviteBurnPath(larDataDir()))).toBe(false);
  });

  it("NO WHO-INVITED-WHOM DATUM PERSISTS — not at the inviter, not at the newcomer", async () => {
    const who = await standInviter();
    const before = allFiles(inviterRoot).map((f) => `${f.path}\n${f.body}`).sort();
    const inv = await runBootInviteMint({ handleIndex: 0, nexusAid: AID, standing: { kind: "admit", admit: who.admit, lineage: [] } });
    expect(allFiles(inviterRoot).map((f) => `${f.path}\n${f.body}`).sort()).toEqual(before);   // the mint writes nothing

    asRoot(newcomerRoot);
    expect((await runBootInviteSpend({ invite: inv, nexusAid: AID, standing: await standingCtx() })).admitted).toBe(true);

    const traces = [who.leafKey, carriageEntryActCid(who.admit), who.admit.contractSig!.sig, inv.sig, inv.nonce];
    const files = [...allFiles(newcomerRoot), ...allFiles(inviterRoot)];
    // CONTROL: the scan reads the newcomer's root — it finds the burn ledger it must find.
    expect(files.some((f) => f.path === bootInviteBurnPath(larDataDir()) && f.body.includes(bootInviteId(inv)))).toBe(true);
    for (const f of files) {
      for (const t of traces) expect(f.body.toLowerCase().includes(t.toLowerCase()), `${f.path} carries ${t}`).toBe(false);
    }
    expect(readFileSync(bootInviteBurnPath(larDataDir()), "utf8")).toBe(`${bootInviteId(inv)}\n`);
  });
});

/** A hearth's gate as `hostSessionOf` reads it: the live clients and the challenge issued on each socket. */
function fakeGate(gatePubKey: string) {
  const challenges = new WeakMap<object, { nonce: string; gatePubKey?: string }>();
  const clients = new Set<object>();
  return {
    clients,
    getChallengeForSocket: (s: object) => challenges.get(s),
    open(nonce: string): object { const s = {}; challenges.set(s, { nonce, gatePubKey }); clients.add(s); return s; },
    close(s: object): void { clients.delete(s); },
  };
}

describe("the user invite — the walker's leaf asks its hearth, over a live session", () => {
  async function standWalker(): Promise<string> {
    asRoot(walkerRoot);
    await generateOrLoadVesselIdentity();
    await generateOrLoadPersonaGroupRoot(0);
    return (await nexusLeafFor(0, AID)).verifyingKey;
  }

  /** The hearth stands (admitted), the walker stands (no admit), and a gate holds a live socket between them. */
  async function stage() {
    const hearth = await standInviter();
    const walkerKey = await standWalker();
    const gate = fakeGate(await pub(new Uint8Array(32).fill(21)));
    const socket = gate.open("5e5510a0000000000000000000000001");
    const askHearth = async (request: HostCountersignRequest) => {
      const back = process.env["LAR_ROOT"]!;
      asRoot(inviterRoot);   // the countersign runs at the hearth, on its own root
      try {
        return await runHostCountersign({
          gate: gate as never, socket: socket as never, request,
          standing: async (aid) => aid === AID ? { leaf: await nexusLeafFor(0, AID), admit: hearth.admit, lineage: [] } : null,
        });
      } finally { asRoot(back); }
    };
    const session = hostSessionOf(gate as never, socket as never) as HostSession;
    return { hearth, walkerKey, gate, socket, askHearth, session };
  }

  it("the hearth's countersign lends standing; the walker's leaf signs; the invite ADMITS once", async () => {
    const { hearth, walkerKey, askHearth, session } = await stage();
    asRoot(walkerRoot);
    const minted = await runHostedInviteMint({ handleIndex: 0, nexusAid: AID, session, askHearth });
    if (!minted.ok) throw new Error(minted.refusal);
    expect(minted.invite.inviterKey).toBe(walkerKey);
    expect(minted.invite.standing).toMatchObject({ kind: "hosted", hearthKey: hearth.leafKey });

    asRoot(newcomerRoot);
    expect(await runBootInviteSpend({ invite: minted.invite, nexusAid: AID, standing: await standingCtx() }))
      .toEqual({ admitted: true, burnId: bootInviteId(minted.invite) });
    expect(await runBootInviteSpend({ invite: minted.invite, nexusAid: AID, standing: await standingCtx() }))
      .toEqual({ admitted: false, refusal: "already-spent" });
  });

  it("a CLOSED socket holds no session: the hearth refuses `no-live-session` and nothing mints", async () => {
    const { gate, socket, askHearth, session } = await stage();
    gate.close(socket);
    expect(hostSessionOf(gate as never, socket as never)).toBeNull();
    asRoot(walkerRoot);
    expect(await runHostedInviteMint({ handleIndex: 0, nexusAid: AID, session, askHearth }))
      .toEqual({ ok: false, refusal: "no-live-session" });
  });

  it("NO WHO-INVITED-WHOM DATUM PERSISTS — not at the hearth, not at the walker, not at the newcomer", async () => {
    const { hearth, walkerKey, askHearth, session } = await stage();
    const snap = (root: string) => allFiles(root).map((f) => `${f.path}\n${f.body}`).sort();
    const hearthBefore = snap(inviterRoot);
    const walkerBefore = snap(walkerRoot);
    asRoot(walkerRoot);
    const minted = await runHostedInviteMint({ handleIndex: 0, nexusAid: AID, session, askHearth });
    if (!minted.ok) throw new Error(minted.refusal);
    expect(snap(inviterRoot)).toEqual(hearthBefore);   // the countersign writes nothing at the hearth
    expect(snap(walkerRoot)).toEqual(walkerBefore);    // the mint writes nothing at the walker

    asRoot(newcomerRoot);
    expect((await runBootInviteSpend({ invite: minted.invite, nexusAid: AID, standing: await standingCtx() })).admitted).toBe(true);

    const lent = minted.invite.standing as { countersig: string };
    const traces = [walkerKey, hearth.leafKey, carriageEntryActCid(hearth.admit), lent.countersig, minted.invite.sig, minted.invite.nonce, session.nonce];
    const files = [...allFiles(newcomerRoot), ...allFiles(inviterRoot), ...allFiles(walkerRoot)];
    // CONTROL: the scan reads the newcomer's root — it finds the burn ledger it must find.
    expect(files.some((f) => f.path === bootInviteBurnPath(larDataDir()) && f.body.includes(bootInviteId(minted.invite)))).toBe(true);
    for (const f of files) {
      for (const t of traces) expect(f.body.toLowerCase().includes(t.toLowerCase()), `${f.path} carries ${t}`).toBe(false);
    }
  });
});
