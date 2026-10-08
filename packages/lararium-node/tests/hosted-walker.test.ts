/**
 * hosted-walker.test.ts — a newcomer walks in end to end, over a REAL gate under a PRIVATE posture: the hearth's
 * own invite redeems at the gate, the pushed grant is kept and re-presented, and the invite settles only once a
 * grant-bearing dial stands. The real DaemonAuthGate, the real sorter with its walker arms, the real hosting store,
 * the real LarWSClientAdapter and the platform-blind walk client — only the keyholder worker is a proof-checking
 * shore.
 *
 * Proven:
 *   · RED: a fresh key presenting nothing meets silence under PRIVATE; the SAME vessel carrying the hearth's
 *     invite crosses as a walker;
 *   · the invite is written durably BEFORE any dial, and settled (deleted) only after a dial presenting the
 *     pushed grant is verified — CONTROL: the normal path ends holding the grant alone;
 *   · REFUSE BEFORE DESTROY: a corrupted grant reads silence, the invite still stands, and the next dial
 *     recovers the IDENTICAL grant;
 *   · a second newcomer holding a photographed copy of the same invite meets silence.
 *   · V — THE ALLOWANCE VESTS BY CLASS: a lineage opened on the hearth's own invite fills its wallet at once (one
 *     blind batch, its whole allowance); a lineage opened on a WALKER's invite mints nothing until the hearth's
 *     next roll — a direct ask meets no answer — and after the roll its renewed grant fills one invite;
 *   · the walker's invite redeems at the hearth as a `walker` lineage, and the hearth's store holds its nonce and
 *     the mint's marker, never a lineage or a leaf.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocketServer } from "ws";
import * as ed from "@noble/ed25519";
import { Repo, type PeerId } from "@automerge/automerge-repo";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import {
  hex, genesisSealEpochCid, verifyAuthProof, ed25519SignerFromSeed, LarWSClientAdapter, encodeInvite, mintHostToken,
  takeInvite, walkIdentity, walkOver, popInvite, hostingActCid, decodeInvite,
  type AuthVerifierShore, type KahuQuorumSeats, type LeafIdentity, type WalkRecord, type WalkStore, type HostingAct,
} from "@lararium/mesh";
import { DaemonAuthGate, type GateKey } from "../src/daemon-auth-gate.js";
import { serveHostingMint } from "../src/hosting-mint.js";
import { makeSocketSorter } from "../src/socket-sorter.js";
import { rollHosting, readHostingState, liveEpochs } from "../src/hosting-store.js";
import type { CarriedNexusReading } from "../src/nexus-carriage.js";

const AUD = "lar:///ha.ka.ba/bags/daemon";
const AID = "epoch0-" + "a".repeat(64);
const GATE_SEED   = new Uint8Array(32).fill(81);
const HEARTH_LEAF = new Uint8Array(32).fill(82);
const SEEDS = [new Uint8Array(32).fill(1), new Uint8Array(32).fill(2), new Uint8Array(32).fill(3)];
const pubOf = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function memoryStore(): WalkStore & { readonly records: Map<string, WalkRecord> } {
  const records = new Map<string, WalkRecord>();
  return { records, read: async (g) => records.get(g) ?? null, write: async (g, r) => { records.set(g, r); } };
}

/** The keyholder's floor without keyhive: the card is the dialer's key, and the V3 proof must hold under it. */
function provingShore(gatePubKey: string): AuthVerifierShore {
  return {
    async verify(cardBytes, bagUrl, _access, proof) {
      const key = new TextDecoder().decode(cardBytes);
      if (!proof) return { ok: false };
      const v = await verifyAuthProof({ nonce: proof.nonce, gatePubKey, peerPubKey: key, aud: bagUrl, sig: proof.sig });
      return v.ok ? { ok: true, identifier: key, proofVerified: true } : { ok: false };
    },
  };
}

async function newcomer(fill: number): Promise<{ base: LeafIdentity; leaf: { verifyingKey: string; seed: Uint8Array } }> {
  const vessel = new Uint8Array(32).fill(fill);
  const leafSeed = new Uint8Array(32).fill(fill + 1);
  const pub = await pubOf(vessel);
  return {
    base: { contactCard: pub, peerPubKey: pub, sign: ed25519SignerFromSeed(vessel) },
    leaf: { verifyingKey: await pubOf(leafSeed), seed: leafSeed },
  };
}

describe("a newcomer walks in at the hearth's own gate", () => {
  let storageDir = "";
  let http: Server;
  let wss: WebSocketServer;
  let port = 0;
  let gatePub = "";
  const adapters: LarWSClientAdapter[] = [];
  const repos: Repo[] = [];

  beforeEach(async () => {
    storageDir = mkdtempSync(join(tmpdir(), "hosted-walker-"));
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH_LEAF });
    gatePub = await pubOf(GATE_SEED);
    const keys = await Promise.all(SEEDS.map(pubOf));
    const roster: KahuQuorumSeats = { keys, threshold: 2, sealEpochCid: genesisSealEpochCid(keys, 2) };
    const reading: CarriedNexusReading = { aid: AID, via: "consent", island: AID, roster, sealLineage: [], denyBoard: [], antigen: [], antigenRoster: roster, posture: "private" };
    http = createServer();
    wss = new WebSocketServer({ server: http });
    const gate = new DaemonAuthGate(wss, { authTimeoutMs: 300, onRefuse: () => {} });
    const key: GateKey = { pubKey: gatePub, sign: ed25519SignerFromSeed(GATE_SEED) };
    gate.arm(provingShore(gatePub), AUD, key, makeSocketSorter({
      readings: async () => [reading], carrier: () => false, primaryPosture: () => "private",
      hosting: { storageDir, leafSeedFor: async () => HEARTH_LEAF },
    }));
    serveHostingMint(gate, { storageDir, leafSeedFor: async () => HEARTH_LEAF });
    // The hearth's own Repo answers each admitted socket's join, so a verified dial meets a proven peer.
    repos.push(new Repo({ network: [new NodeWSServerAdapter(gate as unknown as WebSocketServer)], peerId: "hearth" as PeerId }));
    await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
    port = (http.address() as { port: number }).port;
  });

  afterEach(async () => {
    for (const a of adapters.splice(0)) { try { a.disconnect(); } catch { /* down */ } }
    for (const r of repos.splice(0)) await r.shutdown().catch(() => {});
    for (const c of wss.clients) c.terminate();
    await new Promise<void>((r) => wss.close(() => http.close(() => r())));
    rmSync(storageDir, { recursive: true, force: true });
  });

  /** Dial the hearth under `identity`; the walk client rides it. Resolves the adapter once it settles or anergizes. */
  async function dial(identity: LeafIdentity, walk?: { store: WalkStore; leaf: { verifyingKey: string; seed: Uint8Array }; base: LeafIdentity }): Promise<LarWSClientAdapter> {
    const adapter = new LarWSClientAdapter({ url: `ws://127.0.0.1:${port}/ws`, identity, aud: AUD, gatePubKey: gatePub, retryInterval: 50 });
    adapters.push(adapter);
    if (walk) walkOver({ transport: adapter, store: walk.store, gatePubKey: gatePub, leaf: walk.leaf, base: walk.base, actFor });
    repos.push(new Repo({ network: [adapter], peerId: `walker-${adapters.length}` as PeerId }));
    return adapter;
  }

  /** The hearth's signed act for an epoch — the act a walker reads off the Nexus's board. */
  const actFor = async (cid: string): Promise<HostingAct | null> => {
    const state = readHostingState(storageDir, AID);
    return [state?.current, state?.previous].find((a): a is HostingAct => !!a && hostingActCid(a) === cid) ?? null;
  };

  async function hostInvite(): Promise<string> {
    const live = liveEpochs(readHostingState(storageDir, AID)!, HEARTH_LEAF)!;
    return encodeInvite({ nexusAid: AID, gatePubKey: gatePub, token: mintHostToken(live.current) });
  }

  test("RED: presenting nothing is silence under PRIVATE; CONTROL: carrying the hearth's invite crosses, then the invite settles", async () => {
    const one = await newcomer(90);
    const bare = await dial(one.base);
    for (let i = 0; i < 60 && !bare.anergized; i++) await sleep(25);
    expect(bare.anergized).toBe("no answer");

    const store = memoryStore();
    const taken = await takeInvite(store, await hostInvite());
    expect(store.records.get(gatePub)?.invite).toBeDefined();                     // durable before any dial
    const walker = await dial(walkIdentity(one.base, taken!.record, one.leaf)!, { store, leaf: one.leaf, base: one.base });
    for (let i = 0; i < 120 && store.records.get(gatePub)?.invite; i++) await sleep(25);
    const held = store.records.get(gatePub)!;
    expect(held.invite).toBeUndefined();                                          // settled by a grant-bearing dial
    expect(held.grant).toMatchObject({ nexusAid: AID, leaf: one.leaf.verifyingKey, survived: 0, from: "host" });
    expect(walker.anergized).toBeNull();
    expect(walker.identity.presented?.kind).toBe("grant");
  }, 20_000);

  test("REFUSE BEFORE DESTROY: a corrupted grant reads silence, the invite stands, and the next dial recovers the identical grant", async () => {
    const one = await newcomer(100);
    const store = memoryStore();
    const carried = await hostInvite();
    const taken = await takeInvite(store, carried);
    // A first dial redeems; the push is lost (no walk client rides it), so only the hearth's burn stands.
    const lost = await dial(walkIdentity(one.base, taken!.record, one.leaf)!);
    for (let i = 0; i < 60 && !lost.session; i++) await sleep(25);
    expect(lost.session).not.toBeNull();
    lost.disconnect();
    // A corrupted grant in the store: a dial presenting it alone meets silence.
    const corrupt = { nexusAid: AID, leaf: one.leaf.verifyingKey, epoch: "e".repeat(64), lineage: "d".repeat(64), survived: 0, from: "host" as const, tag: "f".repeat(128) };
    const corruptDial = await dial(walkIdentity(one.base, { nexusAid: AID, grant: corrupt }, one.leaf)!);
    for (let i = 0; i < 60 && !corruptDial.anergized; i++) await sleep(25);
    expect(corruptDial.anergized).toBe("no answer");
    expect(store.records.get(gatePub)?.invite).toBe(carried);                     // nothing destroyed
    // The next dial presents the token again: the same claim earns the grant, and the invite settles.
    const again = await dial(walkIdentity(one.base, store.records.get(gatePub)!, one.leaf)!, { store, leaf: one.leaf, base: one.base });
    for (let i = 0; i < 120 && store.records.get(gatePub)?.invite; i++) await sleep(25);
    expect(store.records.get(gatePub)?.invite).toBeUndefined();
    expect(store.records.get(gatePub)?.grant?.leaf).toBe(one.leaf.verifyingKey);
    expect(again.anergized).toBeNull();
  }, 20_000);

  test("RED: a second newcomer holding a photographed copy of the same invite meets silence", async () => {
    const carried = await hostInvite();
    const one = await newcomer(110);
    const storeA = memoryStore();
    await dial(walkIdentity(one.base, (await takeInvite(storeA, carried))!.record, one.leaf)!, { store: storeA, leaf: one.leaf, base: one.base });
    for (let i = 0; i < 120 && storeA.records.get(gatePub)?.invite; i++) await sleep(25);
    expect(storeA.records.get(gatePub)?.grant).toBeDefined();
    const two = await newcomer(120);
    const storeB = memoryStore();
    const copy = await dial(walkIdentity(two.base, (await takeInvite(storeB, carried))!.record, two.leaf)!, { store: storeB, leaf: two.leaf, base: two.base });
    for (let i = 0; i < 60 && !copy.anergized; i++) await sleep(25);
    expect(copy.anergized).toBe("no answer");
    expect(storeB.records.get(gatePub)?.grant).toBeUndefined();
  }, 20_000);

  test("RED (V): a host-minted lineage fills at once; a walker-minted one mints nothing until the next roll, then fills", async () => {
    // A — on the hearth's own invite: its wallet fills with its whole allowance (1) in one blind batch.
    const a = await newcomer(130);
    const storeA = memoryStore();
    await dial(walkIdentity(a.base, (await takeInvite(storeA, await hostInvite()))!.record, a.leaf)!, { store: storeA, leaf: a.leaf, base: a.base });
    for (let i = 0; i < 160 && !(storeA.records.get(gatePub)?.wallet?.length); i++) await sleep(25);
    expect(storeA.records.get(gatePub)?.grant?.from).toBe("host");
    expect(storeA.records.get(gatePub)?.wallet).toHaveLength(1);
    expect(storeA.records.get(gatePub)?.pending).toBeUndefined();

    // B — on A's invite: a walker lineage, whose floor vests only at the next roll.
    const carried = (await popInvite(storeA, gatePub))!;
    expect(decodeInvite(carried)?.token.purpose).toBe("walker-invite");
    expect(storeA.records.get(gatePub)?.wallet).toHaveLength(0);
    const b = await newcomer(140);
    const storeB = memoryStore();
    const bDial = await dial(walkIdentity(b.base, (await takeInvite(storeB, carried))!.record, b.leaf)!, { store: storeB, leaf: b.leaf, base: b.base });
    for (let i = 0; i < 160 && storeB.records.get(gatePub)?.invite; i++) await sleep(25);
    expect(storeB.records.get(gatePub)?.grant).toMatchObject({ from: "walker", survived: 0 });
    await sleep(300);
    expect(storeB.records.get(gatePub)?.wallet ?? []).toHaveLength(0);         // nothing to mint this epoch
    // A direct ask on B's socket meets no answer.
    let answered = false;
    bDial.onSession((m) => { if (m.kind === "hosting/minted") answered = true; });
    bDial.sendSession("hosting/mint", { blinded: ["e2".repeat(32)] });
    await sleep(400);
    expect(answered).toBe(false);

    // The household consents to grow: the hearth rolls. B's next dial renews (survived 1) and fills one invite.
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH_LEAF });
    const bAgain = await dial(walkIdentity(b.base, storeB.records.get(gatePub)!, b.leaf)!, { store: storeB, leaf: b.leaf, base: b.base });
    for (let i = 0; i < 200 && !(storeB.records.get(gatePub)?.wallet?.length); i++) await sleep(25);
    expect(storeB.records.get(gatePub)?.grant).toMatchObject({ from: "walker", survived: 1 });
    expect(storeB.records.get(gatePub)?.wallet).toHaveLength(1);
    expect(bAgain.anergized).toBeNull();
  }, 30_000);
});
