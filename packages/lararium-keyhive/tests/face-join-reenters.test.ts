/**
 * K15 step 2c, the fourth idempotence law on the face-join and its grant publication: a crash after the issue and
 * before the publish (or after the publish and before the completion record) re-enters to one seat, one seal and one
 * grant record on the face's own plane.
 */
import { describe, expect, test } from "vitest";
import { buildDeviceDelegation, type LarTiddlerRecord, type LarTiddlerStore } from "@lararium/mesh";
import { InMemoryEventStore, KeyhiveProvider, faceOperationTitle, readFaceOperation, runFaceJoin, runFaceJoinOperation } from "../src/index.js";
import type { FaceJoinContext } from "../src/index.js";

const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const ROOT = seedOf(200);
const HEARTH = "bafkreift7cvcpxxqusdb4lkxsxnt3mzv5uip6tpytinrh7ibgrvu7ceqwa";

async function provider(fill: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: seedOf(fill), eventStore: new InMemoryEventStore() });
  return p;
}

/** A tiddler store that can be told to fail its next put after the Nth call. */
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

/** The founder's anchor-pinned persona lineage: an inception under ROOT's op-key (1-of-1 self-recovery). */
async function founderLineage() {
  const { ed25519VerifyingKeyFromSeed, deriveSelfRecoveryKey, mintPersonaInception, sealKeySetHash } = await import("@lararium/mesh");
  const selfRecovery = await deriveSelfRecoveryKey(ROOT);
  const inception = mintPersonaInception(`0x${await ed25519VerifyingKeyFromSeed(ROOT)}`, sealKeySetHash([selfRecovery.verifyingKey], 1));
  return { prefix: inception.prefix, chain: [inception] };
}

async function stand() {
  const founder = await provider(7);
  const joinee = await provider(106);
  const group = await founder.createGroup();
  const founderEdge = await buildDeviceDelegation({ personaRootSeed: ROOT, atomSeed: seedOf(7), hearthTrueName: HEARTH, boundEpoch: 0 });
  const joineeEdge = await buildDeviceDelegation({ personaRootSeed: ROOT, atomSeed: seedOf(106), hearthTrueName: HEARTH, boundEpoch: 0 });
  const summons = { kind: "face-join/v1" as const, contactCard: new TextDecoder().decode(await joinee.contactCard()), deviceEdge: joineeEdge };
  const ctx: FaceJoinContext = { personaRootDid: founderEdge.personaRootDid, hearthTrueName: HEARTH, personaGroupId: group.groupId, dyad: () => "clear", leaseEpoch: 0 };
  const founderProof = { personaKel: await founderLineage(), dyad: (_key: string) => "clear" as const };
  const operations = memoryStore();
  const plane = memoryStore();
  const input = {
    provider: founder, summons, ctx, founderEdge, founderProof,
    fence: { intentId: "join-106", pinnedAtom: founderEdge.deviceVerifyingKey, ownAtom: founderEdge.deviceVerifyingKey },
    signGrant: async (bytes: Uint8Array) => (await import("@lararium/mesh")).faceAtomKeyFromSeed(seedOf(7), group.groupId).sign(bytes),
    atomSeed: seedOf(7),
    operationStore: operations.store,
    grantPlane: { store: plane.store, heads: () => [String(plane.records.size)] },
  };
  return { founder, joinee, group, summons, ctx, operations, plane, input, founderProof };
}

const grantTitles = (records: Map<string, LarTiddlerRecord>): string[] => [...records.keys()].filter((t) => t.startsWith("$:/lares/face-grant/"));

describe("a face-join re-enters to one seat, one seal and one grant", () => {
  test("RED: another hearth refuses before force and provider calls; CONTROL: pinned hearth seats; POSITIVE: replay returns its grant", { timeout: 90_000 }, async () => {
    const t = await stand();
    const other = { ...t.input, summons: { ...t.summons, force: true }, fence: { ...t.input.fence, ownAtom: t.summons.deviceEdge.deviceVerifyingKey } };
    await expect(runFaceJoinOperation(other)).rejects.toThrow("face-join-fence: not-the-pinned-hearth");
    expect(t.operations.state.puts).toBe(0);
    expect(t.plane.state.puts).toBe(0);
    const first = await runFaceJoinOperation(t.input);
    expect(first["admitted"]).toBe(true);
    const writes = t.operations.state.puts + t.plane.state.puts;
    expect(await runFaceJoinOperation(t.input)).toEqual(first);
    expect(t.operations.state.puts + t.plane.state.puts).toBe(writes);
  });
  test("RED: a founder whose own standing this hearth cannot prove, or reads set aside, seats nobody and writes nothing; CONTROL: a standing founder seats", { timeout: 90_000 }, async () => {
    const t = await stand();
    // Every provider call counts: a refusal must land before the seat, the re-seal and the card all.
    let providerCalls = 0;
    const counted = new Proxy(t.founder, { get: (target, key, receiver) => {
      const v = Reflect.get(target, key, receiver) as unknown;
      return typeof v === "function" ? (...args: unknown[]) => { providerCalls += 1; return (v as (...a: unknown[]) => unknown).apply(target, args); } : v;
    } });
    const otherRoot = await (async () => {
      const { ed25519VerifyingKeyFromSeed, deriveSelfRecoveryKey, mintPersonaInception, sealKeySetHash } = await import("@lararium/mesh");
      const r = await deriveSelfRecoveryKey(seedOf(201));
      const inception = mintPersonaInception(`0x${await ed25519VerifyingKeyFromSeed(seedOf(201))}`, sealKeySetHash([r.verifyingKey], 1));
      return { prefix: inception.prefix, chain: [inception] };
    })();
    const refusals: Array<[string, Record<string, unknown>, RegExp]> = [
      ["aside", { founderProof: { ...t.founderProof, dyad: () => "aside" } }, /founder authority refused: founder device set aside/],
      ["unknown", { founderProof: { ...t.founderProof, dyad: () => "unknown" } }, /founder authority refused: founder dyad standing unknown/],
      ["absent", { founderProof: undefined }, /founder authority refused: founder persona-KEL proof unavailable/],
      ["another root", { founderProof: { ...t.founderProof, personaKel: otherRoot } }, /founder authority refused: the persona-KEL incepts under a root other than the pinned one/],
    ];
    for (const [what, patch, reason] of refusals) {
      await expect(runFaceJoinOperation({ ...t.input, provider: counted, ...patch } as never), what).rejects.toThrow(reason);
    }
    expect(providerCalls, "no provider call under an unproven founder").toBe(0);
    expect(t.operations.state.puts + t.plane.state.puts, "no custody write under an unproven founder").toBe(0);
    const seated = await runFaceJoinOperation({ ...t.input, provider: counted });
    expect(seated["admitted"]).toBe(true);
    expect(providerCalls).toBeGreaterThan(0);
  });
  test("a crash after the issue and before the publish re-enters to the grant it issued", { timeout: 90_000 }, async () => {
    const t = await stand();
    // put 1 is the issued record (lands); put 2 is the grant publication (cut).
    t.plane.state.failOn.add(1);
    t.operations.state.failOn.clear();
    // The plane store holds the grant; the operation store holds the record. Cut the grant publication once.
    await expect(runFaceJoinOperation(t.input)).rejects.toThrow(/cut at put 1/);
    expect(grantTitles(t.plane.records)).toEqual([]);
    const issued = await readFaceOperation<{ state: string; grantRecord: unknown }>(t.operations.store, seedOf(7), new TextEncoder().encode(t.input.fence.intentId));
    expect(issued?.state).toBe("issued");
    const eventsAtCrash = (await t.founder.eventsForPeer(t.summons.deviceEdge.deviceDid)).length;

    const output = await runFaceJoinOperation(t.input);
    expect(output["admitted"]).toBe(true);
    expect(grantTitles(t.plane.records)).toHaveLength(1);
    expect(t.plane.records.get(grantTitles(t.plane.records)[0]!)!.tiddler.text).toBe(JSON.stringify(issued!.grantRecord));
    // Re-entry seated nobody a second time and re-sealed nothing.
    expect((await t.founder.eventsForPeer(t.summons.deviceEdge.deviceDid)).length).toBe(eventsAtCrash);
  });

  test("a crash after the publish and before the completion record returns the published outcome", { timeout: 90_000 }, async () => {
    const t = await stand();
    t.operations.state.failOn.add(2);                                  // the completion record is the second operation write
    await expect(runFaceJoinOperation(t.input)).rejects.toThrow(/cut at put 2/);
    expect(grantTitles(t.plane.records)).toHaveLength(1);
    const first = grantTitles(t.plane.records)[0]!;
    const text = t.plane.records.get(first)!.tiddler.text;
    const output = await runFaceJoinOperation(t.input);
    expect(output["admitted"]).toBe(true);
    expect(grantTitles(t.plane.records)).toEqual([first]);
    expect(t.plane.records.get(first)!.tiddler.text).toBe(text);
  });

  test("a finished join answers the same outcome again and writes nothing", { timeout: 90_000 }, async () => {
    const t = await stand();
    const one = await runFaceJoinOperation(t.input);
    const writes = t.operations.state.puts + t.plane.state.puts;
    const two = await runFaceJoinOperation(t.input);
    expect(two).toEqual(one);
    expect(t.operations.state.puts + t.plane.state.puts).toBe(writes);
    expect(grantTitles(t.plane.records)).toHaveLength(1);
    expect([...t.operations.records.keys()]).toEqual([await faceOperationTitle(new TextEncoder().encode(t.input.fence.intentId))]);
  });

  test("CONTROL: without the operation record a second join issues a different grant", { timeout: 90_000 }, async () => {
    const t = await stand();
    const first = await runFaceJoin(t.founder, t.summons, t.ctx);
    const second = await runFaceJoin(t.founder, t.summons, t.ctx);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) expect(JSON.stringify(second.grant)).not.toBe(JSON.stringify(first.grant));
  });
});
