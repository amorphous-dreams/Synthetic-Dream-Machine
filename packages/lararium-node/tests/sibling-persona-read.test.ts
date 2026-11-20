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
 *   SP8  an over-cap plane names itself (`over-cap`), never reading as nothing at rest; the carried acts still answer
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { describe, expect, test } from "vitest";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import {
  emptyLarDoc, signFoundingLog, mintFaceAnchor, faceRootCommitment, didFromVerifyingKey, ed25519VerifyingKeyFromSeed,
  ed25519SignerFromSeed, provisionThresholdRecoveryAtFounding, recoveryContactRegistrationCard, writePersonaKelEvent,
  personaKelChainForPrefix, proveFaceFromLog, writePersonaAct, RESTING_DOC_MAX_BYTES, type LarDoc, type SignedAct,
} from "@lararium/mesh";
import { proveSiblingFromRest, type SiblingFaceGate } from "../src/persona-act-store.js";
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
type Custody = { opening: number | null };
const gate = (custody: Custody): SiblingFaceGate => {
  let read: number | null = null;
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

  test("SP5 CUSTODY: the face locks while the read is pending: the plane drops and the proof refuses", async () => {
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
    expect(seen).toBe(0);
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

  test("SP8: an over-cap plane names itself: alone it loses its proof as over-cap, never as nothing at rest; the carried acts still answer", async () => {
    const s = await sibling();
    const id = s.planes.persona.replace(/^automerge:/, "");
    const heavy = { loadRange: async () => [{ key: [id, "snapshot", "big"], data: new Uint8Array(RESTING_DOC_MAX_BYTES + 1) }] };
    expect(await proveSiblingFromRest({ storage: heavy, personaUrl: s.planes.persona, group, face: gate({ opening: 1 }), prove: s.prove })).toEqual({ proved: null, plane: "over-cap" });
    const carried = await proveSiblingFromRest({ storage: heavy, personaUrl: s.planes.persona, group, face: gate({ opening: 1 }), carried: [carriedOf(s.log)], prove: s.prove });
    expect(carried.proved).not.toBeNull();
    expect(carried.plane).toBe("over-cap");
  });
});
