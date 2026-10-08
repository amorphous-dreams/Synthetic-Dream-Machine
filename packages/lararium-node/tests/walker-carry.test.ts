/**
 * walker-carry.test.ts — the walker's carriage end to end over the session verbs: the walker seals, the hearth
 * carries, the walker's own receipt opens, and the walker's PROVEN LEAF reaches its carriage again from a fresh
 * lineage — no key is ever handed out.
 *
 * Proven, the walk client (mesh) against the hearth's carriage service (node) over an in-memory session:
 *   · a carried document comes back and opens under the walker's receipt; the bytes the hearth served are not it,
 *     and no answer names the record;
 *   · RED: after the grant lapsed past two rolls and the walker walked back in on a fresh lineage under the SAME
 *     leaf, its carriage answers by proof; CONTROL: another leaf's grant, holding the receipt, reaches nothing
 *     (silence);
 *   · walking back in on a new invite keeps the receipts;
 *   · a hearth's notice marks the record at risk.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  carryDocument, fetchDocument, watchCarryNotice, takeInvite, issueGrant, encodeInvite, mintHostToken, utf8Bytes, hex,
  HOSTING_NOTICE_SESSION_KIND, type HostingGrant, type LarSessionMsg, type WalkRecord, type WalkStore,
} from "@lararium/mesh";
import { serveHostingCarry } from "../src/hosting-carry.js";
import { rollHosting, readHostingState, liveEpochs } from "../src/hosting-store.js";

const AID = "epoch0-" + "a".repeat(64);
const HEARTH = new Uint8Array(32).fill(71);
const GATE = "ee".repeat(32);
const LEAF = { verifyingKey: "c".repeat(64), seed: new Uint8Array(32).fill(72) };
const OTHER_LEAF = { verifyingKey: "b".repeat(64), seed: new Uint8Array(32).fill(73) };
let storageDir = "";
beforeEach(() => { storageDir = mkdtempSync(join(tmpdir(), "walker-carry-")); });
afterEach(() => { rmSync(storageDir, { recursive: true, force: true }); });

function memoryStore(): WalkStore & { map: Map<string, WalkRecord> } {
  const map = new Map<string, WalkRecord>();
  return { map, async read(g) { return map.get(g) ?? null; }, async write(g, r) { map.set(g, structuredClone(r)); } };
}

/** One walker socket at the hearth's carriage service, standing on `grant()`. */
function wire(grant: () => HostingGrant) {
  const socket = {} as never;
  const gateListeners: Array<(s: never, m: LarSessionMsg) => void> = [];
  const walkerListeners: Array<(m: LarSessionMsg) => void> = [];
  const served: LarSessionMsg[] = [];
  serveHostingCarry({
    onSession: (l) => { gateListeners.push(l as never); return () => {}; },
    sendSession: (_s, kind, body) => { const m = { type: "lar:session" as const, kind, body }; served.push(m); for (const l of walkerListeners) l(m); return true; },
    getClassForSocket: () => "walker",
    getGrantForSocket: () => grant(),
  }, { storageDir, leafSeedFor: async () => HEARTH });
  const transport = {
    onSession: (l: (m: LarSessionMsg) => void) => { walkerListeners.push(l); return () => { walkerListeners.splice(walkerListeners.indexOf(l), 1); }; },
    sendSession: (kind: string, body: unknown) => { for (const l of gateListeners) l(socket, { type: "lar:session", kind, body }); return true; },
  };
  return { transport, served, push: (m: LarSessionMsg) => { for (const l of walkerListeners) l(m); } };
}

async function grantAtCurrent(lineage: string, leaf: string = LEAF.verifyingKey): Promise<HostingGrant> {
  const live = liveEpochs(readHostingState(storageDir, AID)!, HEARTH)!;
  return issueGrant(live.current, { leaf, lineage, survived: 0, from: "host" });
}

describe("the walker's carriage over the session verbs", () => {
  test("a carried document comes back under the walker's receipt; the hearth served only ciphertext and named no record", async () => {
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH });
    const grant = await grantAtCurrent("1".repeat(64));
    const store = memoryStore();
    await store.write(GATE, { nexusAid: AID, grant });
    const { transport, served } = wire(() => grant);
    const plaintext = utf8Bytes("field notes the hearth carries and cannot read");
    const carried = await carryDocument({ transport, store, gatePubKey: GATE, leaf: LEAF, plaintext, withinMs: 2_000 });
    expect(carried).toMatchObject({ held: true });
    const back = await fetchDocument({ transport, store, gatePubKey: GATE, cid: carried!.cid, withinMs: 2_000 });
    expect(back && hex(back)).toBe(hex(plaintext));
    expect(JSON.stringify(served)).not.toContain("field notes");
    // No answer hands out a record key: the carried answer names the document and its outcome alone.
    const answer = served.find((m) => m.kind === "hosting/carried")!;
    expect(Object.keys(answer.body as object).sort()).toEqual(["cid", "held"]);
  });

  test("RED: the same leaf on a fresh lineage reaches its carriage by proof; CONTROL: another leaf holding the receipt reaches nothing", async () => {
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH });
    let grant = await grantAtCurrent("1".repeat(64));
    const store = memoryStore();
    await store.write(GATE, { nexusAid: AID, grant });
    const { transport } = wire(() => grant);
    const plaintext = utf8Bytes("kept across a lapse");
    const carried = await carryDocument({ transport, store, gatePubKey: GATE, leaf: LEAF, plaintext, withinMs: 2_000 });
    // The grant lapses past two rolls; the walker walks back in on a fresh invite — a new lineage, the same leaf.
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH });
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH });
    const invite = encodeInvite({ nexusAid: AID, gatePubKey: GATE, token: mintHostToken(liveEpochs(readHostingState(storageDir, AID)!, HEARTH)!.current) });
    await takeInvite(store, invite);
    grant = await grantAtCurrent("2".repeat(64));
    await store.write(GATE, { ...(await store.read(GATE))!, grant });
    const back = await fetchDocument({ transport, store, gatePubKey: GATE, cid: carried!.cid, withinMs: 2_000 });
    expect(back && hex(back)).toBe(hex(plaintext));
    // CONTROL (the stolen-key probe): another leaf's grant, holding the victim's receipt, asks for the same
    // document — silence.
    const thiefStore = memoryStore();
    grant = await grantAtCurrent("3".repeat(64), OTHER_LEAF.verifyingKey);
    await thiefStore.write(GATE, { nexusAid: AID, grant, carried: (await store.read(GATE))!.carried! });
    expect(await fetchDocument({ transport, store: thiefStore, gatePubKey: GATE, cid: carried!.cid, withinMs: 300 })).toBeNull();
  });

  test("walking back in keeps the receipts", async () => {
    const store = memoryStore();
    await store.write(GATE, { nexusAid: AID, carried: [{ cid: "blake3:" + "d".repeat(64), readCap: "e".repeat(64) }] });
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH });
    await takeInvite(store, encodeInvite({ nexusAid: AID, gatePubKey: GATE, token: mintHostToken(liveEpochs(readHostingState(storageDir, AID)!, HEARTH)!.current) }));
    expect(await store.read(GATE)).toMatchObject({ carried: [{ readCap: "e".repeat(64) }] });
  });

  test("a hearth's notice marks the record at risk", async () => {
    const store = memoryStore();
    await store.write(GATE, { nexusAid: AID });
    const listeners: Array<(m: LarSessionMsg) => void> = [];
    watchCarryNotice({ onSession: (l) => { listeners.push(l); return () => {}; } }, store, GATE);
    for (const l of listeners) l({ type: "lar:session", kind: HOSTING_NOTICE_SESSION_KIND, body: { pending: true } });
    await new Promise((r) => setTimeout(r, 10));
    expect((await store.read(GATE))?.atRisk).toBe(true);
  });
});
