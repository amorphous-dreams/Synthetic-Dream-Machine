/**
 * sibling-persona-read — a lit sibling proves from its own rest (`proveSiblingFromRest`): its plane reads from this vessel's
 * own store, only while that face stands open, and the same opening must still stand when the proof is accepted. Every case
 * proves through the real fold (`proveFaceFromLog`) over a signed founding log.
 *
 *   SP1  an open face's resting signed plane proves
 *   SP2  CUSTODY: a shut face reads no plane: the store goes unasked, and with nothing carried the proof refuses
 *   SP3  SIGNED CARRIED-ONLY: with no plane at rest, the signed admit acts carried in the secret home prove alone
 *   SP4  CUSTODY: a resting plane whose founding another key signed reads, and the fold refuses it
 *   SP5  CUSTODY: the face locks WHILE the read is pending: the plane drops, and the proof refuses
 *   SP6  CUSTODY: the face locks after the read and before acceptance: the proof that leaned on the plane reads null
 *   SP7  CUSTODY: lock and re-light mid-read (one custody id, two openings): the old caller refuses, the new one reads its own
 *   SP9  two proofs of one opening at once share its read and both prove
 *   SP10 RED restart: a restarted holder's opening carries the same count under a new boot, and a read begun before it refuses
 *   SP11 THE NAMED WINDOW: a read accepted before an unheard lock proves exactly what a read before the lock proves
 *   SP8  an over-cap plane names itself (`over-cap`) and refuses, never reading as nothing at rest
 *   SP12 RED: a torn plane beside a valid carried founding refuses; carried acts never stand in for a known-incomplete history
 *   SP13 THE TABLE: every plane reading proves or refuses with a valid carried founding beside it, as `SIBLING_PLANE_USE` names
 *        (only `nothing-rests` lets the carried acts answer alone)
 *   SP14 RED lock race: a lock, or a lock and re-open, that discards a decoded plane refuses; the carried founding never proves
 *   SP15 RED empty-read lock race: the same during an empty read refuses `lock-mid-read`; the carried founding never proves
 *   SP16 a carried-only proof whose opening closes before acceptance reads null
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { describe, expect, test } from "vitest";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { signFoundingLog, writePersonaAct, RESTING_DOC_MAX_BYTES } from "@lararium/mesh/persona-act-board";
import { mintFaceAnchor, faceRootCommitment } from "@lararium/mesh/face-anchor";
import { didFromVerifyingKey } from "@lararium/mesh/lar-did";
import { ed25519VerifyingKeyFromSeed, ed25519SignerFromSeed } from "@lararium/mesh/ed25519-door";
import { provisionThresholdRecoveryAtFounding } from "@lararium/mesh/recovery-keel-core";
import { recoveryContactRegistrationCard } from "@lararium/mesh/recovery-registration";
import { writePersonaKelEvent, personaKelChainForPrefix } from "@lararium/mesh/persona-kel-board";
import { proveFaceFromLog } from "@lararium/mesh/face-boot-proof";
import { type SignedAct } from "@lararium/mesh/signed-act";
import { proveSiblingFromRest, SIBLING_PLANE_USE, type SiblingFaceGate, type SiblingPlaneReading } from "../src/persona-act-store.js";
import { testVesselTag } from "../../lararium-mesh/tests/vessel-tag-fixture.js";

const group = "cd".repeat(16);

function memoryAdapter(): StorageAdapterInterface & { asked: number } {
  const bytes = new Map<string, Uint8Array>();
  const name = (key: StorageKey): string => key.join("\u0000");
  const starts = (key: string, prefix: StorageKey): boolean => key.split("\u0000").slice(0, prefix.length).join("\u0000") === name(prefix);
  const adapter = {
    asked: 0,
    async load(key: StorageKey) { const got = bytes.get(name(key)); return got ? Uint8Array.from(got) : undefined; },
    async save(key: StorageKey, data: Uint8Array) { bytes.set(name(key), Uint8Array.from(data)); },
    async remove(key: StorageKey) { bytes.delete(name(key)); },
    async loadRange(prefix: StorageKey): Promise<Chunk[]> { adapter.asked++; return [...bytes].filter(([k]) => starts(k, prefix)).map(([k, data]) => ({ key: k.split("\u0000"), data: Uint8Array.from(data) })); },
    async removeRange(prefix: StorageKey) { for (const k of [...bytes.keys()]) if (starts(k, prefix)) bytes.delete(k); },
  };
  return adapter;
}

/** One sibling face: its KEL, its anchor, and a signed founding log naming its persona plane. */
async function sibling(rootSeed = 21, signerSeed = rootSeed) {
  const rootKey = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(rootSeed));
  const did = didFromVerifyingKey(rootKey);
  const signer = { key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(signerSeed)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(signerSeed)) };
  const recoveryContacts = await Promise.all([1, 2, 3].map(async (n, i) =>
    recoveryContactRegistrationCard((["mine", "contact-a", "contact-b"] as const)[i]!, await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), null)));
  const inception = provisionThresholdRecoveryAtFounding({ foundingOpKeyDid: did, recoveryContacts, recoveryThreshold: 2 }).inception;
  const board = emptyLarDoc();
  writePersonaKelEvent(board, inception);
  const chain = personaKelChainForPrefix(board, inception.prefix)!;
  const anchor = mintFaceAnchor({ personaGroup: group, personaKelPrefix: inception.prefix, personaRootDid: did, edge: {}, leaseEpoch: 0 });
  // The plane rests in a store as a founding leaves it: written by a Repo that then shuts.
  const storage = memoryAdapter();
  const founding = new Repo({ storage, network: [], sharePolicy: async () => false });
  const handle = founding.create<LarDoc>(emptyLarDoc());
  const planes = { persona: handle.url as string, intents: "automerge:t" };
  const log = await signFoundingLog({ group, personaKelPrefix: inception.prefix, rootCommitment: faceRootCommitment(did), epoch: 0,
    planes, deviceKey: rootKey, edgeDigest: "edge", vesselTag: await testVesselTag(1, group, rootKey) }, signer);
  handle.change((d) => { for (const act of log) writePersonaAct(d, act); });
  await founding.flush();
  await founding.shutdown();
  storage.asked = 0;
  const prove = (records: unknown[]) => { const p = proveFaceFromLog({ records, chain, group, anchor, planes }); return p.ok ? p : null; };
  return { storage, planes, log, prove };
}
const carriedOf = (log: readonly SignedAct[]): LarDoc => { const doc = emptyLarDoc(); for (const act of log) writePersonaAct(doc, act); return doc; };
/** A face's custody as the gate reads it: `opening` names the opening that stands (null: shut); each re-light takes a new one. */
type Custody = { opening: string | number | null };
const gate = (custody: Custody): SiblingFaceGate => {
  let read: string | number | null = null;
  return {
    open: async () => { read = custody.opening; return read === null ? null : `fcid#${read}`; },
    stillOpen: () => read !== null && custody.opening === read,
  };
};
const lock = (c: Custody) => { c.opening = null; };
const relight = (c: Custody, n: number) => { c.opening = n; };

describe("proveSiblingFromRest: a lit sibling proves from its own rest while the opening it read under stands", () => {
  test("SP1: an open face's resting signed plane proves", async () => {
    const s = await sibling();
    const r = await proveSiblingFromRest({ storage: s.storage, personaUrl: s.planes.persona, group, face: gate({ opening: 1 }), prove: s.prove });
    expect(r.proved).not.toBeNull();
    expect(r.plane).toBe("read");
  });

  test("SP2 CUSTODY: a shut face reads no plane; its store goes unasked and, with nothing carried, the proof refuses", async () => {
    const s = await sibling();
    const r = await proveSiblingFromRest({ storage: s.storage, personaUrl: s.planes.persona, group, face: gate({ opening: null }), prove: s.prove });
    expect(r).toEqual({ proved: null, plane: "face-shut" });
    expect(s.storage.asked).toBe(0);
  });

  test("SP3 SIGNED CARRIED-ONLY: with no plane at rest, the signed admit acts carried in the secret home prove alone", async () => {
    const s = await sibling();
    const empty = memoryAdapter();
    expect(await proveSiblingFromRest({ storage: empty, personaUrl: s.planes.persona, group, face: gate({ opening: 1 }), prove: s.prove })).toEqual({ proved: null, plane: "nothing-rests" });
    const carried = await proveSiblingFromRest({ storage: empty, personaUrl: s.planes.persona, group, face: gate({ opening: 1 }), carried: [carriedOf(s.log)], prove: s.prove });
    expect(carried.proved).not.toBeNull();
    expect(carried.plane).toBe("nothing-rests");
  });

  test("SP4 CUSTODY: a resting plane whose founding another key signed reads, and the fold refuses it", async () => {
    const s = await sibling(21, 99);
    let read = 0;
    const r = await proveSiblingFromRest({ storage: s.storage, personaUrl: s.planes.persona, group, face: gate({ opening: 1 }), prove: (records) => { read = records.length; return s.prove(records); } });
    expect(r).toEqual({ proved: null, plane: "read" });
    expect(read).toBeGreaterThan(0);
  });

  test("SP5 CUSTODY: the face locks while the read is pending: the plane drops and the proof refuses before it runs", async () => {
    const s = await sibling();
    const custody: Custody = { opening: 1 };
    let release!: () => void;
    const pending = new Promise<void>((done) => { release = done; });
    const slow = { loadRange: async (prefix: StorageKey) => { await pending; return s.storage.loadRange(prefix); } };
    let seen = -1;
    const proving = proveSiblingFromRest({ storage: slow, personaUrl: s.planes.persona, group, face: gate(custody), prove: (records) => { seen = records.length; return s.prove(records); } });
    await Promise.resolve();
    lock(custody);
    release();
    expect(await proving).toEqual({ proved: null, plane: "lock-mid-read" });
    expect(seen).toBe(-1);   // the proof never runs: a lock mid-read refuses outright
  });

  test("SP6 CUSTODY: the face locks after the read and before acceptance: the proof that leaned on the plane reads null", async () => {
    const s = await sibling();
    const custody: Custody = { opening: 1 };
    const r = await proveSiblingFromRest({ storage: s.storage, personaUrl: s.planes.persona, group, face: gate(custody),
      prove: (records) => { const p = s.prove(records); lock(custody); return p; } });
    expect(r).toEqual({ proved: null, plane: "lock-mid-read" });
  });

  test("SP7 CUSTODY: lock and re-light mid-read: the caller of the old opening never accepts its bytes, the caller of the new opening reads its own", async () => {
    const s = await sibling();
    const custody: Custody = { opening: 1 };
    const releases: Array<() => void> = [];
    let asked = 0;
    const slow = { loadRange: async (prefix: StorageKey) => { asked++; await new Promise<void>((done) => { releases.push(done); }); return s.storage.loadRange(prefix); } };
    const before = proveSiblingFromRest({ storage: slow, personaUrl: s.planes.persona, group, face: gate(custody), prove: s.prove });
    await Promise.resolve(); await Promise.resolve();
    lock(custody);
    relight(custody, 2);   // the same face opens again: a new opening, the same custody id
    const after = proveSiblingFromRest({ storage: slow, personaUrl: s.planes.persona, group, face: gate(custody), prove: s.prove });
    await Promise.resolve(); await Promise.resolve();
    expect(asked).toBe(2);   // the new opening never joined the old opening's read
    for (const release of releases) release();
    expect(await before).toEqual({ proved: null, plane: "lock-mid-read" });
    const fresh = await after;
    expect(fresh.proved).not.toBeNull();
    expect(fresh.plane).toBe("read");
  });

  test("SP9: two proofs of one opening at once share its read and both prove: contention never downgrades a proof to the carried acts", async () => {
    const s = await sibling();
    const custody: Custody = { opening: 1 };
    let release!: () => void;
    const pending = new Promise<void>((done) => { release = done; });
    let asked = 0;
    const slow = { loadRange: async (prefix: StorageKey) => { asked++; await pending; return s.storage.loadRange(prefix); } };
    const one = proveSiblingFromRest({ storage: slow, personaUrl: s.planes.persona, group, face: gate(custody), prove: s.prove });
    const two = proveSiblingFromRest({ storage: slow, personaUrl: s.planes.persona, group, face: gate(custody), prove: s.prove });
    await Promise.resolve(); await Promise.resolve();
    release();
    const [a, b] = await Promise.all([one, two]);
    expect(asked).toBe(1);
    expect(a.plane).toBe("read"); expect(a.proved).not.toBeNull();
    expect(b.plane).toBe("read"); expect(b.proved).not.toBeNull();
  });

  test("SP10 RED restart: the holder restarts mid-read and its count lands on the same number under a new boot: the old read refuses", async () => {
    const s = await sibling();
    const custody: Custody = { opening: "boot-a:1" };
    let release!: () => void;
    const pending = new Promise<void>((done) => { release = done; });
    const slow = { loadRange: async (prefix: StorageKey) => { await pending; return s.storage.loadRange(prefix); } };
    const proving = proveSiblingFromRest({ storage: slow, personaUrl: s.planes.persona, group, face: gate(custody), prove: s.prove });
    await Promise.resolve();
    custody.opening = "boot-b:1";   // a restarted holder reopens the face: the same count, another boot
    release();
    expect(await proving).toEqual({ proved: null, plane: "lock-mid-read" });
  });

  test("SP11 THE NAMED WINDOW: a read accepted before an unheard lock proves exactly what a read finished before the lock proves; once the lock lands, the read refuses", async () => {
    const s = await sibling();
    const before = await proveSiblingFromRest({ storage: s.storage, personaUrl: s.planes.persona, group, face: gate({ opening: "boot:1" }), prove: s.prove });
    // The source has locked, and its standing has not landed: the vessel's view still holds the old opening.
    const unheard = await proveSiblingFromRest({ storage: s.storage, personaUrl: s.planes.persona, group, face: gate({ opening: "boot:1" }), prove: s.prove });
    expect(unheard.proved).not.toBeNull();
    expect((unheard.proved as { projection: unknown }).projection).toEqual((before.proved as { projection: unknown }).projection);
    // The standing lands: the opening reads shut, and the same bytes prove nothing.
    expect(await proveSiblingFromRest({ storage: s.storage, personaUrl: s.planes.persona, group, face: gate({ opening: null }), prove: s.prove })).toEqual({ proved: null, plane: "face-shut" });
  });

  test("SP14 RED lock race: a lock that discards a decoded plane refuses, though the carried founding alone would prove; a lock and re-open does too", async () => {
    const s = await sibling();
    const carried = [carriedOf(s.log)];
    // The carried founding proves alone where the read found nothing at rest: the regression's control.
    expect((await proveSiblingFromRest({ storage: memoryAdapter(), personaUrl: s.planes.persona, group, face: gate({ opening: "boot:1" }), carried, prove: s.prove })).proved).not.toBeNull();
    for (const after of [null, "boot:2"] as const) {
      const custody: Custody = { opening: "boot:1" };
      let release!: () => void;
      const pending = new Promise<void>((done) => { release = done; });
      const slow = { loadRange: async (prefix: StorageKey) => { await pending; return s.storage.loadRange(prefix); } };
      let proveRan = false;
      const proving = proveSiblingFromRest({ storage: slow, personaUrl: s.planes.persona, group, face: gate(custody), carried, prove: (r) => { proveRan = true; return s.prove(r); } });
      await Promise.resolve();
      custody.opening = after;   // a lock, or a lock and re-open, while the read waits
      release();
      expect(await proving).toEqual({ proved: null, plane: "lock-mid-read" });
      expect(proveRan).toBe(false);
    }
  });

  test("SP15 RED empty-read lock race: a lock, or a lock and re-open, while an empty read waits refuses; the carried founding never proves under the expired opening", async () => {
    const s = await sibling();
    const carried = [carriedOf(s.log)];
    const empty = memoryAdapter();
    // The control: the carried founding proves alone where the read found nothing at rest and the opening held.
    expect((await proveSiblingFromRest({ storage: empty, personaUrl: s.planes.persona, group, face: gate({ opening: "boot:1" }), carried, prove: s.prove })).proved).not.toBeNull();
    for (const after of [null, "boot:2"] as const) {
      const custody: Custody = { opening: "boot:1" };
      let release!: () => void;
      const pending = new Promise<void>((done) => { release = done; });
      const slow = { loadRange: async (prefix: StorageKey) => { await pending; return empty.loadRange(prefix); } };
      let proveRan = false;
      const proving = proveSiblingFromRest({ storage: slow, personaUrl: s.planes.persona, group, face: gate(custody), carried, prove: (r) => { proveRan = true; return s.prove(r); } });
      await Promise.resolve();
      custody.opening = after;   // a lock, or a lock and re-open, while the empty read waits
      release();
      expect(await proving).toEqual({ proved: null, plane: "lock-mid-read" });
      expect(proveRan).toBe(false);
    }
  });

  test("SP16: a carried-only proof whose opening closes before acceptance reads null", async () => {
    const s = await sibling();
    const custody: Custody = { opening: "boot:1" };
    const r = await proveSiblingFromRest({ storage: memoryAdapter(), personaUrl: s.planes.persona, group, face: gate(custody), carried: [carriedOf(s.log)],
      prove: (records) => { const p = s.prove(records); custody.opening = null; return p; } });
    expect(r).toEqual({ proved: null, plane: "lock-mid-read" });
  });

  test("SP8: an over-cap plane names itself and refuses: never read as nothing at rest, and the carried acts never stand in", async () => {
    const s = await sibling();
    const id = s.planes.persona.replace(/^automerge:/, "");
    const heavy = { loadRange: async () => [{ key: [id, "snapshot", "big"], data: new Uint8Array(RESTING_DOC_MAX_BYTES + 1) }] };
    expect(await proveSiblingFromRest({ storage: heavy, personaUrl: s.planes.persona, group, face: gate({ opening: 1 }), prove: s.prove })).toEqual({ proved: null, plane: "over-cap" });
    expect(await proveSiblingFromRest({ storage: heavy, personaUrl: s.planes.persona, group, face: gate({ opening: 1 }), carried: [carriedOf(s.log)], prove: s.prove })).toEqual({ proved: null, plane: "over-cap" });
  });

  test("SP12 RED: a torn plane beside an otherwise valid carried founding refuses; the carried acts never stand in for a history known to be incomplete", async () => {
    const s = await sibling();
    const id = s.planes.persona.replace(/^automerge:/, "");
    const rested = await s.storage.loadRange([id]);
    const torn = { loadRange: async () => [...rested, { key: [id, "incremental", "torn"], data: new Uint8Array([0x85, 0x6f, 0x4a, 0x83, 1, 2, 3]) }] };
    const carried = carriedOf(s.log);
    expect((await proveSiblingFromRest({ storage: memoryAdapter(), personaUrl: s.planes.persona, group, face: gate({ opening: 1 }), carried: [carried], prove: s.prove })).proved).not.toBeNull();
    expect(await proveSiblingFromRest({ storage: torn, personaUrl: s.planes.persona, group, face: gate({ opening: 1 }), carried: [carried], prove: s.prove })).toEqual({ proved: null, plane: "torn" });
  });

  test("SP13 THE TABLE: each plane reading with a valid carried founding beside it proves or refuses as SIBLING_PLANE_USE names it", async () => {
    const s = await sibling();
    const id = s.planes.persona.replace(/^automerge:/, "");
    const rested = await s.storage.loadRange([id]);
    const carried = [carriedOf(s.log)];
    const cases: Array<{ reading: SiblingPlaneReading; storage: Pick<StorageAdapterInterface, "loadRange">; url?: string; face?: SiblingFaceGate; boundMs?: number }> = [
      { reading: "read", storage: s.storage },
      { reading: "nothing-rests", storage: memoryAdapter() },
      { reading: "face-shut", storage: s.storage, face: gate({ opening: null }) },
      { reading: "bound-spent", storage: { loadRange: () => new Promise<Chunk[]>(() => {}) }, boundMs: 20 },
      { reading: "refused", storage: { loadRange: () => { throw new Error("store fault"); } } },
      { reading: "torn", storage: { loadRange: async () => [{ key: [id, "snapshot", "x"], data: new Uint8Array([1, 2, 3, 4]) }] } },
      { reading: "chunk-unread", storage: { loadRange: async () => [...rested, { key: [id, "incremental", "u"], data: undefined }] } },
      { reading: "chunk-empty", storage: { loadRange: async () => [...rested, { key: [id, "incremental", "e"], data: new Uint8Array(0) }] } },
      { reading: "over-cap", storage: { loadRange: async () => [{ key: [id, "snapshot", "big"], data: new Uint8Array(RESTING_DOC_MAX_BYTES + 1) }] } },
      { reading: "url-malformed", storage: s.storage, url: "not-a-url" },
    ];
    // A lock that lands while the read waits: the decoded plane is discarded (`lock-mid-read`).
    {
      const custody: Custody = { opening: "boot:1" };
      let release!: () => void;
      const pending = new Promise<void>((done) => { release = done; });
      const slow = { loadRange: async (prefix: StorageKey) => { await pending; return s.storage.loadRange(prefix); } };
      const proving = proveSiblingFromRest({ storage: slow, personaUrl: s.planes.persona, group, face: gate(custody), carried, prove: s.prove });
      await Promise.resolve();
      custody.opening = null;
      release();
      const r = await proving;
      expect(r.plane).toBe("lock-mid-read");
      expect(r.proved === null).toBe(SIBLING_PLANE_USE["lock-mid-read"] === "refuse");
    }
    for (const c of cases) {
      const r = await proveSiblingFromRest({ storage: c.storage, personaUrl: c.url ?? s.planes.persona, group, face: c.face ?? gate({ opening: 1 }), carried, prove: s.prove, ...(c.boundMs ? { boundMs: c.boundMs } : {}) });
      expect(r.plane, c.reading).toBe(c.reading);
      expect(r.proved === null, c.reading).toBe(SIBLING_PLANE_USE[c.reading] === "refuse");
    }
  });
});
