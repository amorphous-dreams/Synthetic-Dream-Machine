/**
 * face-intent-join-live — a joinee's request rides the face's intents plane to the pinned hearth, whose door runs the REAL
 * face-join operation over real Keyhive providers: one seat, one grant record on the persona plane, one outcome on the
 * intents plane, and the joinee decrypts what the hearth sealed after the add. Reds: a second hearth over the same plane
 * seats nobody and appends nothing. Control: the pinned hearth seats. Positive: a replay re-keys nothing.
 */
import { describe, expect, test } from "vitest";
import {
  actCid, buildDeviceDelegation, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, faceIntentVerbs, intentEntryRecordsOfGroup,
  mintPersonaInception, signPersonaAct, type DocHandle, type LarDoc, type LarTiddlerRecord, type LarTiddlerStore,
} from "@lararium/mesh";
import { InMemoryEventStore, KeyhiveProvider, runFaceJoinOperation, type FaceJoinContext } from "../src/index.js";
import { makeFaceIntentDoor, requestFaceJoin } from "../src/face-intent-door.js";

const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const ROOT = seedOf(200);
const HEARTH = "bafkreift7cvcpxxqusdb4lkxsxnt3mzv5uip6tpytinrh7ibgrvu7ceqwa";
const provider = async (n: number) => { const p = new KeyhiveProvider(); await p.init({ seed: seedOf(n), eventStore: new InMemoryEventStore() }); return p; };
const signerOf = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(seedOf(n)), sign: ed25519SignerFromSeed(seedOf(n)) });
const memoryStore = () => {
  const records = new Map<string, LarTiddlerRecord>();
  const store = { get: async (t: string) => records.get(t) ?? null, put: async (r: LarTiddlerRecord) => { records.set(r.tiddler.title, r); } } as unknown as LarTiddlerStore;
  return { store, records };
};
const plane = () => {
  const doc = { tiddlers: {} } as LarDoc, listeners = new Set<() => void>();
  return { doc, handle: { doc: () => doc, change: (edit: (d: LarDoc) => void) => { edit(doc); for (const f of listeners) f(); },
    on: (_e: string, l: () => void) => { listeners.add(l); }, off: (_e: string, l: () => void) => { listeners.delete(l); } } as unknown as DocHandle<LarDoc> };
};

describe("a face-join request rides the intents plane to the pinned hearth", () => {
  test("RED: another hearth seats nobody; CONTROL: the pinned hearth seats once and the joinee reads; POSITIVE: a replay re-keys nothing", { timeout: 120_000 }, async () => {
    const hearth = await provider(7), joinee = await provider(106), group = await hearth.createGroup();
    const h1 = await signerOf(7), h2 = await signerOf(8), j = await signerOf(106), root = await signerOf(200);
    const founderEdge = await buildDeviceDelegation({ personaRootSeed: ROOT, atomSeed: seedOf(7), hearthTrueName: HEARTH, boundEpoch: 0 });
    const joineeEdge = await buildDeviceDelegation({ personaRootSeed: ROOT, atomSeed: seedOf(106), hearthTrueName: HEARTH, boundEpoch: 0 });
    expect(founderEdge.deviceVerifyingKey).toBe(h1.key);
    const inception = mintPersonaInception(`0x${root.key}`, "recovery");
    const log = [] as Awaited<ReturnType<typeof signPersonaAct>>[];
    for (const [act, fields] of [["founding", { personaKelPrefix: inception.prefix, rootCommitment: "root" }],
      ["admission", { deviceKey: h1.key }], ["admission", { deviceKey: h2.key }], ["admission", { deviceKey: j.key }]] as const) {
      const head = log.at(-1);
      log.push(await signPersonaAct(head ? { seq: head.body.seq, cid: actCid(head.body) } : null, { group: group.groupId, act, epoch: 0, fields }, root));
    }
    const shared = plane(), verbs = faceIntentVerbs(), grants = memoryStore();
    const ctx: FaceJoinContext = { personaRootDid: founderEdge.personaRootDid, hearthTrueName: HEARTH, personaGroupId: group.groupId, dyad: () => "clear", leaseEpoch: 0 };
    const effectFor = (own: string, ops: ReturnType<typeof memoryStore>) => async (args: unknown, at: { intentId: string; pinnedAtom: string }) =>
      runFaceJoinOperation({ provider: hearth, summons: (args as { summons: never }).summons, ctx, founderEdge, fence: { intentId: at.intentId, pinnedAtom: at.pinnedAtom, ownAtom: own },
        signGrant: async (bytes) => h1.sign(bytes), atomSeed: seedOf(7), operationStore: ops.store, grantPlane: { store: grants.store, heads: () => [String(grants.records.size)] } });
    const base = { group: group.groupId, plane: shared.handle, personaRecords: () => log, kelChain: () => [inception], standing: () => "stands" as const, verbs, log: () => {} };
    const ops1 = memoryStore(), ops2 = memoryStore();
    const door1 = makeFaceIntentDoor({ ...base, atom: h1, effects: new Map([["face-join", effectFor(h1.key, ops1)]]) });
    const door2 = makeFaceIntentDoor({ ...base, atom: h2, effects: new Map([["face-join", effectFor(h2.key, ops2)]]) });
    const summons = { kind: "face-join/v1" as const, contactCard: new TextDecoder().decode(await joinee.contactCard()), deviceEdge: joineeEdge };
    const id = await requestFaceJoin({ group: group.groupId, plane: shared.handle, atom: j, projection: { admissions: [{ deviceKey: h1.key }] }, summons, verbs });

    await door2.heed();
    expect(grants.records.size).toBe(0);
    expect(intentEntryRecordsOfGroup(shared.doc, group.groupId)).toHaveLength(1);

    await door1.heed();
    expect(grants.records.size).toBe(1);
    const entries = intentEntryRecordsOfGroup(shared.doc, group.groupId) as Array<{ body: { entry: string; cause?: string } }>;
    expect(entries.filter((e) => e.body.entry === "outcome" && e.body.cause === id)).toHaveLength(1);
    const grant = JSON.parse([...grants.records.values()][0]!.tiddler.text as string) as { capEvents: string[]; founderCard: string };
    await joinee.receiveContactCard(new TextEncoder().encode(grant.founderCard));
    await joinee.ingestPeerEvents(grant.capEvents.map((b) => new Uint8Array(Buffer.from(b, "base64"))));
    expect(await joinee.knowsAgent(group.groupId)).toBe(true);

    const events = (await hearth.eventsForPeer(joineeEdge.deviceDid)).length;
    await door1.heed(); await door2.heed();
    expect(grants.records.size).toBe(1);
    expect((await hearth.eventsForPeer(joineeEdge.deviceDid)).length).toBe(events);
    expect((intentEntryRecordsOfGroup(shared.doc, group.groupId) as Array<{ body: { entry: string } }>).filter((e) => e.body.entry === "outcome")).toHaveLength(1);
  });
});
