/**
 * K15 step 2c, the ordering law of a face's grant: the grant record rests at one title per (group, joinee), and a
 * FRESH issue supersedes the standing grant while a REPLAY of an older issue never rolls a later one back.
 *
 * The record signs a `serial`: one more than the serial of the grant standing at its title when the issue was made.
 * Publishing writes when the title is empty or holds an older serial; the same serial with the same bytes stands as
 * published; the same serial under other bytes refuses; a newer serial standing leaves the older issue unwritten and
 * the operation answers its own outcome.
 */
import { describe, expect, test } from "vitest";
import { buildDeviceDelegation, faceAtomKeyFromSeed, type LarTiddlerRecord, type LarTiddlerStore } from "@lararium/mesh";
import { InMemoryEventStore, KeyhiveProvider, runFaceJoinOperation, verifyFaceGrantRecord } from "../src/index.js";
import type { FaceJoinContext } from "../src/index.js";

const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const ROOT = seedOf(200);
const HEARTH = "bafkreift7cvcpxxqusdb4lkxsxnt3mzv5uip6tpytinrh7ibgrvu7ceqwa";

async function provider(fill: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: seedOf(fill), eventStore: new InMemoryEventStore() });
  return p;
}

function memoryStore() {
  const records = new Map<string, LarTiddlerRecord>();
  const state = { puts: 0, failOn: new Set<number>() };
  const store = {
    get: async (title: string) => records.get(title) ?? null,
    put: async (record: LarTiddlerRecord) => {
      state.puts += 1;
      if (state.failOn.has(state.puts)) throw new Error(`cut at put ${state.puts}`);
      records.set(record.tiddler.title, record);
    },
  } as unknown as LarTiddlerStore;
  return { store, records, state };
}

async function stand() {
  const founder = await provider(7);
  const joinee = await provider(106);
  const group = await founder.createGroup();
  const founderEdge = await buildDeviceDelegation({ personaRootSeed: ROOT, atomSeed: seedOf(7), hearthTrueName: HEARTH, boundEpoch: 0 });
  const joineeEdge = await buildDeviceDelegation({ personaRootSeed: ROOT, atomSeed: seedOf(106), hearthTrueName: HEARTH, boundEpoch: 0 });
  const card = new TextDecoder().decode(await joinee.contactCard());
  const summons = (force: boolean) => ({ kind: "face-join/v1" as const, contactCard: card, deviceEdge: joineeEdge, ...(force ? { force: true } : {}) });
  const ctx: FaceJoinContext = { personaRootDid: founderEdge.personaRootDid, hearthTrueName: HEARTH, personaGroupId: group.groupId, dyad: () => "clear", leaseEpoch: 0 };
  const operations = memoryStore();
  const plane = memoryStore();
  const input = (s: ReturnType<typeof summons>) => ({
    provider: founder, summons: s, ctx, founderEdge,
    fence: { intentId: JSON.stringify(s), pinnedAtom: founderEdge.deviceVerifyingKey, ownAtom: founderEdge.deviceVerifyingKey },
    signGrant: (bytes: Uint8Array) => faceAtomKeyFromSeed(seedOf(7), group.groupId).sign(bytes),
    atomSeed: seedOf(7),
    operationStore: operations.store,
    grantPlane: { store: plane.store, heads: () => [String(plane.records.size)] },
  });
  return { summons, input, operations, plane, ctxRoot: ctx.personaRootDid };
}

const standingGrant = (records: Map<string, LarTiddlerRecord>): { serial: number; text: string } => {
  const title = [...records.keys()].find((t) => t.startsWith("$:/lares/face-grant/"))!;
  const text = records.get(title)!.tiddler.text as string;
  return { serial: (JSON.parse(text) as { serial: number }).serial, text };
};

describe("a face's grant orders by its serial", () => {
  test("S1 — a fresh issue supersedes the standing grant", { timeout: 120_000 }, async () => {
    const t = await stand();
    const first = await runFaceJoinOperation(t.input(t.summons(false)));
    expect(first["admitted"]).toBe(true);
    const one = standingGrant(t.plane.records);
    const second = await runFaceJoinOperation(t.input(t.summons(true)));
    expect(second["admitted"]).toBe(true);
    const two = standingGrant(t.plane.records);
    expect(two.text, "the second issue's bytes stand at the title").not.toBe(one.text);
    expect(two.serial).toBe(one.serial + 1);
    expect(second["recordCid"]).not.toBe(first["recordCid"]);
  });

  test("S2 — an issued-and-unpublished older op replays beside a newer grant: the newer stands and the replay writes nothing", { timeout: 120_000 }, async () => {
    const t = await stand();
    t.plane.state.failOn.add(1);                                              // the first op issues, then its publication is cut
    await expect(runFaceJoinOperation(t.input(t.summons(false)))).rejects.toThrow(/cut at put 1/);
    await runFaceJoinOperation(t.input(t.summons(true)));                     // a later issue publishes (serial 1: nothing stood)
    await runFaceJoinOperation(t.input({ ...t.summons(true), nonce: "third" } as never));  // a third issue supersedes it (serial 2)
    const standing = standingGrant(t.plane.records);
    expect(standing.serial).toBe(2);
    const puts = t.plane.state.puts;
    const replay = await runFaceJoinOperation(t.input(t.summons(false)));     // the cut op re-enters
    expect(replay["admitted"]).toBe(true);
    expect(t.plane.state.puts, "a replay of an older issue writes no grant").toBe(puts);
    const standingCid = (await runFaceJoinOperation(t.input({ ...t.summons(true), nonce: "third" } as never)))["recordCid"];
    expect(replay["recordCid"], "the replay answers its OWN issue, not the grant that stands").not.toBe(standingCid);
    expect(standingGrant(t.plane.records).text).toBe(standing.text);
  });

  test("S3 — the same serial under other bytes refuses", { timeout: 120_000 }, async () => {
    const t = await stand();
    t.plane.state.failOn.add(1);
    await expect(runFaceJoinOperation(t.input(t.summons(false)))).rejects.toThrow(/cut at put 1/);
    await runFaceJoinOperation(t.input(t.summons(true)));                     // serial 1 stands
    await expect(runFaceJoinOperation(t.input(t.summons(false)))).rejects.toThrow(/holds different issued bytes/);
  });

  test("S4 — two joins at once for one joinee take two serials and the later one stands", { timeout: 120_000 }, async () => {
    const t = await stand();
    // A plane store whose first reads linger, so two unguarded issues read the same standing grant before either writes.
    let reads = 0;
    const slow = {
      get: async (title: string) => { reads += 1; if (reads <= 3) await new Promise((r) => setTimeout(r, 150)); return t.plane.store.get(title); },
      put: (r: LarTiddlerRecord, o: unknown) => (t.plane.store.put as (r: LarTiddlerRecord, o: unknown) => Promise<void>)(r, o),
    } as unknown as LarTiddlerStore;
    const run = (s: ReturnType<typeof t.summons>) => runFaceJoinOperation({ ...t.input(s), grantPlane: { store: slow, heads: () => ["x"] } });
    const [a, b] = await Promise.all([run(t.summons(false)), run({ ...t.summons(true), nonce: "second" } as never)]);
    expect(a["admitted"] && b["admitted"]).toBe(true);
    const serials = [...t.plane.records.values()].filter((r) => r.tiddler.title.startsWith("$:/lares/face-grant/")).map((r) => (JSON.parse(r.tiddler.text as string) as { serial: number }).serial);
    expect(serials, "one grant stands at the title").toHaveLength(1);
    expect(serials[0], "the later of two serialised issues carries serial 2").toBe(2);
  });

  test("S5 — a forged record at the title with a high serial never blocks a real issue, and the joinee's verify takes the real one", { timeout: 120_000 }, async () => {
    const t = await stand();
    // A real first grant, then a member's forgery of it: serial 999, the signature no longer covering the bytes.
    await runFaceJoinOperation(t.input(t.summons(false)));
    const title = [...t.plane.records.keys()].find((k) => k.startsWith("$:/lares/face-grant/"))!;
    const real = JSON.parse(t.plane.records.get(title)!.tiddler.text as string) as Record<string, unknown>;
    t.plane.records.set(title, { ...t.plane.records.get(title)!, tiddler: { ...t.plane.records.get(title)!.tiddler, text: JSON.stringify({ ...real, serial: 999 }) } } as LarTiddlerRecord);
    const fresh = await runFaceJoinOperation(t.input(t.summons(true)));
    expect(fresh["admitted"]).toBe(true);
    const standing = JSON.parse(t.plane.records.get(title)!.tiddler.text as string) as { serial: number } & Record<string, unknown>;
    expect(standing.serial, "the fresh issue stands over the forgery").toBeLessThan(999);
    // The joinee's kit reads the record with the same law: the standing record verifies for the joinee.
    const joineeKey = String(fresh["joineeAgentIdHex"]).replace(/^0x/i, "").slice(-64);
    const verdict = await verifyFaceGrantRecord(standing, { personaRootDid: t.ctxRoot, selfVerifyingKey: joineeKey, groupId: String(standing["groupId"]) });
    expect(verdict).toEqual({ ok: true });
    expect(await verifyFaceGrantRecord({ ...real, serial: 999 }, { personaRootDid: t.ctxRoot, selfVerifyingKey: joineeKey, groupId: String(standing["groupId"]) }), "CONTROL: the forgery does not verify").toMatchObject({ ok: false });
  });
});
