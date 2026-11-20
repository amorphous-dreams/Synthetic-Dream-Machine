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
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { describe, expect, test } from "vitest";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import {
  emptyLarDoc, signFoundingLog, mintFaceAnchor, faceRootCommitment, didFromVerifyingKey, ed25519VerifyingKeyFromSeed,
  ed25519SignerFromSeed, provisionThresholdRecoveryAtFounding, recoveryContactRegistrationCard, writePersonaKelEvent,
  personaKelChainForPrefix, proveFaceFromLog, writePersonaAct, type LarDoc, type SignedAct,
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
const gate = (state: { open: boolean }): SiblingFaceGate => ({ open: async () => state.open, stillOpen: () => state.open });

describe("proveSiblingFromRest: a lit sibling proves from its own rest while its face stands open", () => {
  test("SP1: an open face's resting signed plane proves", async () => {
    const s = await sibling();
    expect(await proveSiblingFromRest({ storage: s.storage, personaUrl: s.planes.persona, group, face: gate({ open: true }), prove: s.prove })).not.toBeNull();
  });

  test("SP2 CUSTODY: a shut face reads no plane; its store goes unasked and, with nothing carried, the proof refuses", async () => {
    const s = await sibling();
    expect(await proveSiblingFromRest({ storage: s.storage, personaUrl: s.planes.persona, group, face: gate({ open: false }), prove: s.prove })).toBeNull();
    expect(s.storage.asked).toBe(0);
  });

  test("SP3 SIGNED CARRIED-ONLY: with no plane at rest, the signed admit acts carried in the secret home prove alone", async () => {
    const s = await sibling();
    const empty = memoryAdapter();
    expect(await proveSiblingFromRest({ storage: empty, personaUrl: s.planes.persona, group, face: gate({ open: true }), prove: s.prove })).toBeNull();
    expect(await proveSiblingFromRest({ storage: empty, personaUrl: s.planes.persona, group, face: gate({ open: true }), carried: [carriedOf(s.log)], prove: s.prove })).not.toBeNull();
    expect(empty.asked).toBe(2);
  });

  test("SP4 CUSTODY: a resting plane whose founding another key signed reads, and the fold refuses it", async () => {
    const s = await sibling(21, 99);
    let read = 0;
    expect(await proveSiblingFromRest({ storage: s.storage, personaUrl: s.planes.persona, group, face: gate({ open: true }), prove: (r) => { read = r.length; return s.prove(r); } })).toBeNull();
    expect(read).toBeGreaterThan(0);
  });

  test("SP5 CUSTODY: the face locks while the read is pending: the plane drops and the proof refuses", async () => {
    const s = await sibling();
    const state = { open: true };
    let release!: () => void;
    const pending = new Promise<void>((done) => { release = done; });
    const slow = { loadRange: async (prefix: StorageKey) => { await pending; return s.storage.loadRange(prefix); } };
    let seen = -1;
    const proving = proveSiblingFromRest({ storage: slow, personaUrl: s.planes.persona, group, face: gate(state), prove: (r) => { seen = r.length; return s.prove(r); } });
    await Promise.resolve();
    state.open = false;   // the lock lands mid-read
    release();
    expect(await proving).toBeNull();
    expect(seen).toBe(0);
  });

  test("SP6 CUSTODY: the face locks after the read and before acceptance: the proof that leaned on the plane reads null", async () => {
    const s = await sibling();
    const state = { open: true };
    const proved = await proveSiblingFromRest({ storage: s.storage, personaUrl: s.planes.persona, group, face: gate(state),
      prove: (r) => { const p = s.prove(r); state.open = false; return p; } });
    expect(proved).toBeNull();
  });
});
