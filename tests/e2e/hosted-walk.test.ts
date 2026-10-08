/**
 * e2e/hosted-walk — the hosted walk end to end, on real vessels: a hearth hosts while its daemon stands, a node
 * walks in on its invite, the walker's wallet fills and hands an invite on, a third vessel redeems that, a
 * browser-shaped walker carries and fetches its own document, a roll reaches every walker with no restart, and a
 * stranger meets silence.
 *
 * THE VECTOR this suite exists for: `lares host roll` beside a STANDING hearth. The hearth's process holds the
 * replica its walkers sync; a roll written through a second Repo sat on disk while the replica — and every
 * walker reading it — never saw the act, so a walker's next dial could not fill its wallet at the new epoch.
 * The roll now runs inside the standing vessel (`host-roll` over the local socket).
 *
 *   A   the hearth — a charter seated by its own quorum, PRIVATE; its daemon stands throughout.
 *   B   a node that walks in on A's invite (`persona wear 0` · `walk take` · stand).
 *   C   a node that walks in on the invite B hands out of its wallet (`walk invite`).
 *   W   a browser-shaped walker in this process: a real Keyhive identity, the platform-blind walk client over a
 *       real `LarWSClientAdapter`, its own per-Nexus leaf — the shape a browser leaf runs.
 *
 * Proven, in order:
 *   ① A's roll and invite run INSIDE A's standing vessel (`via: daemon`);
 *   ② B takes the invite as its worn face and, once it stands, redeems it at A's gate: A counts one redemption,
 *     and B's wallet fills from the act on A's hosting doc;
 *   ③ B hands an invite out of its wallet; C takes it and redeems it: A counts two;
 *   ④ W redeems a host invite, carries a document, and fetches it back opened under its own receipt;
 *   ⑤ RED: A rolls AGAIN while W's hosting doc already sits in A's replica; W re-dials on its previous-epoch
 *     grant, is renewed, and fills its wallet at the NEW epoch — the act reached it with no hearth restart;
 *   ⑥ a stranger (a real key, presenting nothing) meets silence at A's PRIVATE gate.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { Repo, type PeerId } from "@automerge/automerge-repo";
import { openStaged, freePort, stageDir, awaitRendezvous, type LarInstance } from "../harness/instance.js";
import { KeyhiveProvider } from "../../packages/lararium-keyhive/src/keyhive-provider.js";
import { InMemoryEventStore } from "../../packages/lararium-keyhive/src/event-store.js";
import {
  LarWSClientAdapter, DAEMON_BAG_ID, ed25519SignerFromSeed, takeInvite, walkIdentity, walkOver, hostingDocUrl,
  hostingActOn, materializeSharedLarDoc, carryDocument, fetchDocument, deriveNexusScopedKey, hexToBytes, utf8Bytes, hex,
  PERSONA_GLAMOUR_CONTEXT, decodeInvite, isHostingGrant,
  type LeafIdentity, type WalkRecord, type WalkStore, type HostingAct,
} from "../../packages/lararium-mesh/src/index.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");
const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const dataOf = (r: { json: Record<string, unknown> | null }): Record<string, unknown> => (r.json?.["data"] ?? {}) as Record<string, unknown>;

function missing(): string[] {
  const out: string[] = [];
  if (!existsSync(CLI_BIN))   out.push(`built CLI at ${CLI_BIN}`);
  if (!existsSync(NODE_MAIN)) out.push(`built node vessel at ${NODE_MAIN}`);
  if (process.env["LAR_TARGET"] === "live") out.push("a STAGED target — this witness founds three vessels");
  return out;
}
const gaps = missing();
if (gaps.length > 0) console.error(`hosted-walk: SKIPPED — missing ${gaps.join("; ")}`);

let A: LarInstance | null = null;
let B: LarInstance | null = null;
let C: LarInstance | null = null;
let relayA = "";
let gateA = "";
let nexusA = "";
/** The host invite ① minted, which B walks in on. */
let inviteB = "";
const adapters: LarWSClientAdapter[] = [];
const repos: Repo[] = [];

/** A walker's real Keyhive identity — the card a browser leaf presents at a real gate. */
async function realIdentity(fill: number): Promise<LeafIdentity> {
  const seed = new Uint8Array(32).fill(fill);
  const provider = new KeyhiveProvider();
  await provider.init({ seed, eventStore: new InMemoryEventStore() });
  const key = (await provider.whoami()).replace(/^0x/i, "").toLowerCase();
  return { contactCard: new TextDecoder().decode(await provider.contactCard()), peerPubKey: key, sign: ed25519SignerFromSeed(seed) };
}

function memoryStore(): WalkStore & { readonly records: Map<string, WalkRecord> } {
  const records = new Map<string, WalkRecord>();
  return { records, read: async (g) => records.get(g) ?? null, write: async (g, r) => { records.set(g, structuredClone(r)); } };
}

/** Read a door's answer the way a hand reads it: the count A keeps for its current epoch. */
async function redeemedAtA(): Promise<number> {
  const st = await A!.cli(["host", "--json"]);
  const rows = (dataOf(st)["nexuses"] ?? []) as Array<{ redeemed: number; redeemedPrevious: number }>;
  return rows.reduce((n, r) => n + r.redeemed + r.redeemedPrevious, 0);
}
async function until(cond: () => Promise<boolean>, tries: number, everyMs = 500): Promise<boolean> {
  for (let i = 0; i < tries; i++) { if (await cond()) return true; await sleep(everyMs); }
  return false;
}

/** W's one dial: a fresh Repo and adapter, the walk client riding it, the act read off A's hosting doc. */
function dialW(identity: LeafIdentity, walk: { store: WalkStore; leaf: { verifyingKey: string; seed: Uint8Array }; base: LeafIdentity } | null): { adapter: LarWSClientAdapter; repo: Repo } {
  const adapter = new LarWSClientAdapter({ url: relayA, identity, aud: DAEMON_BAG_ID, gatePubKey: gateA, retryInterval: 200 });
  const repo = new Repo({ network: [adapter], peerId: `w-${adapters.length}` as PeerId });
  adapters.push(adapter); repos.push(repo);
  if (walk) {
    const doc = hostingDocUrl(nexusA, gateA);
    walkOver({
      transport: adapter, store: walk.store, gatePubKey: gateA, leaf: walk.leaf, base: walk.base,
      actFor: async (epochCid): Promise<HostingAct | null> => {
        const handle = await materializeSharedLarDoc(repo, doc, "hosting").catch(() => null);
        return handle ? hostingActOn(handle, epochCid, 15_000) : null;
      },
    });
  }
  return { adapter, repo };
}

describe.skipIf(gaps.length > 0)("★ a hosted walk, end to end, beside a standing hearth ★", () => {
  beforeAll(async () => {
    const portA = await freePort();
    relayA = `ws://127.0.0.1:${portA}/ws`;
    A = await openStaged({ tag: "hostA", port: portA, found: async (cli, root) => {
      const clear = await cli(["vessel", "clear", "--root", root, "--force", "--skip-build"]);
      if (clear.code !== 0) throw new Error(`A: clear failed (${clear.code})\n${clear.stderr.slice(-800)}`);
      const face = await cli(["persona", "new", "0", "--name", "hearth-keeper"]);
      if (face.code !== 0) throw new Error(`A: face failed (${face.code})\n${face.stderr.slice(-800)}`);
      let i = 1;
      for (const handle of ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"]) {
        const k = await cli(["persona", "new", String(i), "--name", `kahu-${i}`, "--handle", handle, "--seat"]);
        if (k.code !== 0) throw new Error(`A: kahu ${i} failed (${k.code})\n${k.stderr.slice(-800)}`);
        i += 1;
      }
      const rite = await cli(["nexus", "rite", "quorum"]);
      if (rite.code !== 0) throw new Error(`A: rite quorum failed (${rite.code})\n${said(rite).slice(-800)}`);
    } });
    if (!(await awaitRendezvous(A))) throw new Error(`A reached live but bound no rendezvous:\n${A.bootLog().slice(-800)}`);
  }, 400_000);

  afterAll(async () => {
    for (const a of adapters.splice(0)) { try { a.disconnect(); } catch { /* down */ } }
    for (const r of repos.splice(0)) await r.shutdown().catch(() => {});
    if (C) await C.stop();
    if (B) await B.stop();
    if (A) await A.stop();
  });

  test("① A's roll and invite run inside A's standing vessel", async () => {
    const roll = await A!.cli(["host", "roll", "--json"]);
    expect(roll.code, said(roll)).toBe(0);
    expect(dataOf(roll)["via"]).toBe("daemon");
    nexusA = String(dataOf(roll)["nexusAid"]);
    const inv = await A!.cli(["host", "invite", "--relay", relayA, "--json"]);
    expect(inv.code, said(inv)).toBe(0);
    expect(dataOf(inv)["via"]).toBe("daemon");
    gateA = decodeInvite(String(dataOf(inv)["invite"]))!.gatePubKey;
    expect(dataOf(roll)["docUrl"]).toBe(hostingDocUrl(nexusA, gateA));
    inviteB = String(dataOf(inv)["invite"]);
  }, 60_000);

  test("② B takes the invite as its worn face, stands, redeems at A's gate, and its wallet fills", async () => {
    const carried = inviteB;
    const rootB = mkdtempSync(join(stageDir(), "lares-staged-walkB-"));
    B = await openStaged({ tag: "walkB", root: rootB, found: async (cli, root) => {
      const clear = await cli(["vessel", "clear", "--root", root, "--force", "--skip-build"]);
      if (clear.code !== 0) throw new Error(`B: clear failed (${clear.code})\n${clear.stderr.slice(-800)}`);
      const face = await cli(["persona", "new", "0", "--name", "wayfarer"]);
      if (face.code !== 0) throw new Error(`B: face failed (${face.code})\n${face.stderr.slice(-800)}`);
      // A walker walks as the face it wears: unworn, the take refuses and writes nothing.
      const unworn = await cli(["walk", "take", carried, "--json"]);
      if (unworn.code === 0) throw new Error(`B: a take with no face worn was kept:\n${said(unworn)}`);
      const wear = await cli(["persona", "wear", "0"]);
      if (wear.code !== 0) throw new Error(`B: wear failed (${wear.code})\n${said(wear).slice(-800)}`);
      const take = await cli(["walk", "take", carried, "--json"]);
      if (take.code !== 0) throw new Error(`B: walk take failed (${take.code})\n${said(take).slice(-800)}`);
    } });
    expect(await until(async () => (await redeemedAtA()) >= 1, 120), `A counted no redemption:\n${B.bootLog().slice(-1500)}`).toBe(true);
    let walks: Array<{ grant: unknown; wallet: number; redeeming: boolean }> = [];
    expect(await until(async () => {
      walks = (dataOf(await B!.cli(["walk", "--json"]))["walks"] ?? []) as typeof walks;
      return walks[0]?.wallet === 1 && !walks[0]!.redeeming;
    }, 120), `B's wallet never filled: ${JSON.stringify(walks)}\n${B.bootLog().slice(-1500)}`).toBe(true);
    expect(walks[0]!.grant).toMatchObject({ from: "host", survived: 0 });
  }, 400_000);

  test("③ B hands an invite out of its wallet; C takes it and redeems: A counts two", async () => {
    const out = await B!.cli(["walk", "invite", "--json"]);
    expect(out.code, said(out)).toBe(0);
    expect(dataOf(out)["via"]).toBe("daemon");
    const handed = String(dataOf(out)["invite"]);
    expect(decodeInvite(handed)).toMatchObject({ gatePubKey: gateA, relay: relayA, token: { purpose: "walker-invite" } });
    const rootC = mkdtempSync(join(stageDir(), "lares-staged-walkC-"));
    C = await openStaged({ tag: "walkC", root: rootC, found: async (cli, root) => {
      const clear = await cli(["vessel", "clear", "--root", root, "--force", "--skip-build"]);
      if (clear.code !== 0) throw new Error(`C: clear failed (${clear.code})\n${clear.stderr.slice(-800)}`);
      for (const step of [["persona", "new", "0", "--name", "second-wayfarer"], ["persona", "wear", "0"], ["walk", "take", handed]]) {
        const r = await cli(step);
        if (r.code !== 0) throw new Error(`C: ${step.join(" ")} failed (${r.code})\n${said(r).slice(-800)}`);
      }
    } });
    expect(await until(async () => (await redeemedAtA()) >= 2, 120), `A counted no second redemption:\n${C.bootLog().slice(-1500)}`).toBe(true);
    // A walker-minted lineage vests only at the hearth's next roll: C's wallet stays empty this epoch.
    const cWalk = (dataOf(await C.cli(["walk", "--json"]))["walks"] ?? []) as Array<{ grant: { from: string } | null; wallet: number }>;
    expect(cWalk[0]?.grant?.from).toBe("walker");
    expect(cWalk[0]?.wallet).toBe(0);
  }, 400_000);

  let wStore: (WalkStore & { readonly records: Map<string, WalkRecord> }) | null = null;
  let wLeaf: { verifyingKey: string; seed: Uint8Array } | null = null;
  let wBase: LeafIdentity | null = null;

  test("④ W, a browser-shaped walker, redeems, carries a document, and fetches it back under its own receipt", async () => {
    const inv = await A!.cli(["host", "invite", "--relay", relayA, "--json"]);
    expect(inv.code, said(inv)).toBe(0);
    wBase = await realIdentity(171);
    const kp = await deriveNexusScopedKey(new Uint8Array(32).fill(172), 0, PERSONA_GLAMOUR_CONTEXT, nexusA);
    wLeaf = { verifyingKey: kp.verifyingKey.toLowerCase(), seed: hexToBytes(kp.signingKey) };
    wStore = memoryStore();
    const taken = await takeInvite(wStore, String(dataOf(inv)["invite"]));
    const { adapter } = dialW(walkIdentity(wBase, taken!.record, wLeaf)!, { store: wStore, leaf: wLeaf, base: wBase });
    expect(await until(async () => {
      const r = wStore!.records.get(gateA);
      return !r?.invite && (r?.wallet?.length ?? 0) === 1;
    }, 120, 250), `W never settled and filled: ${JSON.stringify(wStore.records.get(gateA))}`).toBe(true);
    expect(isHostingGrant(wStore.records.get(gateA)!.grant)).toBe(true);
    const plaintext = utf8Bytes("the walker's own field notes, carried and never read");
    const carried = await carryDocument({ transport: adapter, store: wStore, gatePubKey: gateA, leaf: wLeaf, plaintext, withinMs: 10_000 });
    expect(carried).toMatchObject({ held: true });
    const back = await fetchDocument({ transport: adapter, store: wStore, gatePubKey: gateA, cid: carried!.cid, withinMs: 10_000 });
    expect(back && hex(back)).toBe(hex(plaintext));
  }, 120_000);

  test("⑤ RED: A rolls again while W's hosting doc sits in A's replica; W's next dial fills at the NEW epoch — no hearth restart", async () => {
    const before = wStore!.records.get(gateA)!;
    const roll = await A!.cli(["host", "roll", "--json"]);
    expect(roll.code, said(roll)).toBe(0);
    expect(dataOf(roll)["via"]).toBe("daemon");
    const newEpoch = String(dataOf(roll)["epoch"]);
    expect(newEpoch).not.toBe(before.grant!.epoch);
    for (const a of adapters.splice(0)) { try { a.disconnect(); } catch { /* down */ } }
    // W re-dials on its previous-epoch grant: the hearth renews it, and the wallet fills off the act it reads.
    dialW(walkIdentity(wBase!, before, wLeaf!)!, { store: wStore!, leaf: wLeaf!, base: wBase! });
    expect(await until(async () => (wStore!.records.get(gateA)?.wallet ?? []).some((w) => w.epoch === newEpoch), 120, 250),
      `W's wallet never filled at ${newEpoch.slice(0, 16)}…: ${JSON.stringify(wStore!.records.get(gateA)?.wallet?.map((w) => w.epoch.slice(0, 12)))}`).toBe(true);
    expect(wStore!.records.get(gateA)!.grant).toMatchObject({ epoch: newEpoch, survived: 1 });
  }, 120_000);

  test("⑥ a stranger — a real key presenting nothing — meets silence at A's PRIVATE gate", async () => {
    const stranger = await realIdentity(181);
    const { adapter } = dialW(stranger, null);
    let reason: string | null = null;
    for (let i = 0; i < 150 && !reason; i++) { await sleep(100); reason = adapter.anergized; }
    expect(reason).toBe("no answer");
    expect(adapter.session).toBeNull();
  }, 30_000);
});
