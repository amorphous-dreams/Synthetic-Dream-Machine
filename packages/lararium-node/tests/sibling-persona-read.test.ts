/**
 * sibling-persona-read — a lit sibling's proof reads its plane from this vessel's own store, and only while that face stands
 * open (`readSiblingPersonaRecords`).
 *
 *   SP1  an open face's resting plane answers its records, beside the carried admit acts
 *   SP2  CUSTODY: a face that stands shut at the read reads no plane: the store goes unasked, and only the carried acts answer
 *   SP3  CUSTODY: a plane that rests nowhere answers the carried acts alone, never a peer's copy
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { describe, expect, test } from "vitest";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { personaActEntryKey, storedLarRecord, type LarDoc } from "@lararium/mesh";
import { readSiblingPersonaRecords } from "../src/persona-act-store.js";

const GROUP = "g-sibling";
/** One carried record under the group's act prefix (the proof judges it; this read only carries it). */
const act = (seq: number, cid: string) => { const key = personaActEntryKey(GROUP, seq, cid); return { [key]: storedLarRecord(key, { text: JSON.stringify({ body: { group: GROUP, seq }, sig: "s" }) }, cid) }; };

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

async function restingPlane(): Promise<{ storage: ReturnType<typeof memoryAdapter>; url: string }> {
  const storage = memoryAdapter();
  const founding = new Repo({ storage, network: [], sharePolicy: async () => false });
  const plane = founding.create<LarDoc>({ tiddlers: { ...act(0, "c0") } } as unknown as LarDoc);
  await founding.flush();
  await founding.shutdown();
  storage.asked = 0;
  return { storage, url: plane.url };
}
const carried = { tiddlers: { ...act(1, "c1") } } as unknown as LarDoc;
const seqs = (records: unknown[]): number[] => records.map((r) => (r as { body?: { seq?: number } }).body?.seq ?? -1).sort();

describe("readSiblingPersonaRecords: a lit sibling's plane reads from its own rest while its face stands open", () => {
  test("SP1: an open face's resting plane answers its records beside the carried acts", async () => {
    const { storage, url } = await restingPlane();
    const records = await readSiblingPersonaRecords({ storage, personaUrl: url, group: GROUP, faceOpen: async () => true, carried: [carried] });
    expect(seqs(records)).toEqual([0, 1]);
  });

  test("SP2 CUSTODY: a shut face reads no plane; the store goes unasked and the carried acts alone answer", async () => {
    const { storage, url } = await restingPlane();
    const records = await readSiblingPersonaRecords({ storage, personaUrl: url, group: GROUP, faceOpen: async () => false, carried: [carried] });
    expect(storage.asked).toBe(0);
    expect(seqs(records)).toEqual([1]);
  });

  test("SP3 CUSTODY: a plane that rests nowhere answers the carried acts alone", async () => {
    const { url } = await restingPlane();
    const empty = memoryAdapter();
    const records = await readSiblingPersonaRecords({ storage: empty, personaUrl: url, group: GROUP, faceOpen: async () => true, carried: [carried] });
    expect(empty.asked).toBe(1);
    expect(seqs(records)).toEqual([1]);
  });
});
