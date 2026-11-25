/**
 * holder-heads-rest — THE HEADS REST IN AN OWN NOTE, SO A FRESH READING NEVER READS THE WHOLE MANIFEST SHELF.
 *
 * The first seal of a reading counted its heads from one pass over every manifest at rest: each copy read, parsed,
 * id-hashed and verified, ~14 s over a live 102 MB shelf, and every reload that moved the standing or saw an arrival
 * bought the walk again. The holder now rests the heads it counted in an own note per founding and key version, and a
 * fresh reading reads that note, verifies each id it names, and cites them. The note caches; it authorizes nothing:
 * a note whose tag fails under the version's content key (any byte a hand without the key moved), that names an absent,
 * unverified or out-of-date head, that names no head and no refusal over rows that rest, or whose row digest names
 * another row set than the one at rest, falls back to the one-pass walk, which writes the note afresh.
 *
 * Each vector counts the rest's own calls, so none reads a clock.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { utf8Bytes } from "../src/crypto.js";
import { recordIdOf, type RecordId, type SealedRecord } from "../src/sealed-records.js";
import { said, vessel, world, type Vessel } from "./content-key-fixture.js";

const BAG = "lar:///ha.ka.ba/@test/bags/garden-notes";
const OTHER = "lar:///ha.ka.ba/@test/bags/kitchen-notes";

async function seal(v: Vessel, plaintext: string, bagId = BAG): Promise<RecordId> {
  const r = await v.holder.sealBlob({ bagId, plaintext: utf8Bytes(plaintext), signer: v.signer });
  if ("refusal" in r) throw new Error(`setup: seal refused ${said(r)}`);
  return r.manifest;
}
async function callsOf(v: Vessel, act: () => Promise<unknown>): Promise<string[]> {
  const from = v.rest.calls.length;
  await act();
  return v.rest.calls.slice(from);
}
const count = (calls: readonly string[], call: string): number => calls.filter((one) => one === call).length;
/** How many times an act lists the WHOLE manifest shelf (no prefix): the walk's one listing. A list under one id's
 *  prefix reads that id's copies alone and counts here as nothing. */
async function shelfListsOf(v: Vessel, act: () => Promise<unknown>): Promise<number> {
  const list = v.rest.list.bind(v.rest);
  let whole = 0;
  v.rest.list = async (kind, prefix) => { if (kind === "manifest" && prefix === undefined) whole++; return list(kind, prefix); };
  try { await act(); } finally { v.rest.list = list; }
  return whole;
}
/** The parents the manifest a seal rested cites. */
async function parentsOf(v: Vessel, id: RecordId): Promise<readonly RecordId[]> {
  const [copy] = await v.store.record("manifest", id);
  return copy!.body.parents;
}
/** The heads notes the holder rested, by rest name (each names a digest of its founding and key version). */
const notes = (v: Vessel): string[] => [...v.rest.values.keys()].filter((k) => k.startsWith("own/heads.")).map((k) => k.slice("own/".length));
async function noteOf(v: Vessel): Promise<{ name: string; bytes: Uint8Array }> {
  const names = notes(v);
  expect(names).toHaveLength(1);
  const bytes = await v.rest.get("own", names[0]!);
  return { name: names[0]!, bytes: bytes! };
}

describe("a fresh reading reads its heads from the note", () => {
  it("RED: a restarted holder's first seal reads the heads alone, however many manifests rest", async () => {
    const read: number[] = [];
    for (const many of [4, 16]) {
      const a = await vessel(world(), "a");
      let head: RecordId | null = null;
      for (let i = 0; i < many; i++) head = await seal(a, `note ${i}`);
      a.restart();
      let id: RecordId | null = null;
      let calls: string[] = [];
      // The shelf never lists: the note names the heads, and only they open.
      expect(await shelfListsOf(a, async () => { calls = await callsOf(a, async () => { id = await seal(a, "the first seal after the restart"); }); })).toBe(0);
      expect(await parentsOf(a, id!)).toEqual([head]);
      read.push(count(calls, "get manifest"));
    }
    // One head, one copy: the note's one id reads, and no other manifest at rest opens.
    expect(read[0]).toBe(read[1]);
    expect(read[1]).toBeLessThanOrEqual(1);
  });

  it("RED: a reload that moves the chain re-counts from the note, never from the shelf", async () => {
    let chain = "chain-one";
    const a = await vessel(world(), "a", { standing: { holdsWrite: () => true, chainOf: () => chain } });
    let head: RecordId | null = null;
    for (let i = 0; i < 12; i++) head = await seal(a, `note ${i}`);
    chain = "chain-two";
    let id: RecordId | null = null;
    let calls: string[] = [];
    expect(await shelfListsOf(a, async () => { calls = await callsOf(a, async () => { id = await seal(a, "after the chain moved"); }); })).toBe(0);
    expect(await parentsOf(a, id!)).toEqual([head]);
    expect(count(calls, "get manifest")).toBeLessThanOrEqual(1);
  });

  it("each seal moves the note: a second restart cites the manifest the first restart's seal rested", async () => {
    const a = await vessel(world(), "a");
    for (let i = 0; i < 5; i++) await seal(a, `note ${i}`);
    a.restart();
    const last = await seal(a, "after the first restart");
    a.restart();
    let id: RecordId | null = null;
    const calls = await callsOf(a, async () => { id = await seal(a, "after the second restart"); });
    expect(await parentsOf(a, id!)).toEqual([last]);
    expect(count(calls, "get manifest")).toBeLessThanOrEqual(1);
  });

  it("a bag's note stands apart: a seal in another bag leaves this bag's note serving", async () => {
    const a = await vessel(world(), "a");
    let head: RecordId | null = null;
    for (let i = 0; i < 6; i++) head = await seal(a, `note ${i}`);
    await seal(a, "the kitchen's note", OTHER);
    a.restart();
    let id: RecordId | null = null;
    const calls = await callsOf(a, async () => { id = await seal(a, "the garden after the restart"); });
    expect(await parentsOf(a, id!)).toEqual([head]);
    expect(count(calls, "get manifest")).toBeLessThanOrEqual(1);
  });
});

describe("no clock decides the note: an attacker who holds the machine sets the clock at will", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("a clock thrown years forward or back between the note and the reading changes nothing the note serves", async () => {
    const served: { lists: number; reads: number }[] = [];
    for (const skew of [0, 50 * 365 * 86_400_000, -50 * 365 * 86_400_000]) {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(Date.UTC(2026, 10, 24)));
      const a = await vessel(world(), "a");
      let head: RecordId | null = null;
      for (let i = 0; i < 6; i++) head = await seal(a, `note ${i}`);
      vi.setSystemTime(new Date(Date.UTC(2026, 10, 24) + skew));
      a.restart();
      let id: RecordId | null = null;
      let calls: string[] = [];
      const lists = await shelfListsOf(a, async () => { calls = await callsOf(a, async () => { id = await seal(a, "after the clock moved"); }); });
      expect(await parentsOf(a, id!), `skew ${skew}`).toEqual([head]);
      served.push({ lists, reads: count(calls, "get manifest") });
      vi.useRealTimers();
    }
    // Every skew reads alike: no listing, the one noted head opens.
    expect(served[1]).toEqual(served[0]);
    expect(served[2]).toEqual(served[0]);
    expect(served[0]!.lists).toBe(0);
  });

  it("a clock skew never revives a stale note: an earlier note restored under a rewound clock still walks", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.UTC(2026, 10, 24)));
    const a = await vessel(world(), "a");
    for (let i = 0; i < 3; i++) await seal(a, `note ${i}`);
    const earlier = await noteOf(a);
    const head = await seal(a, "the head the earlier note never saw");
    vi.setSystemTime(new Date(Date.UTC(2000, 0, 1)));
    await a.rest.put("own", earlier.name, earlier.bytes);
    a.restart();
    const id = await seal(a, "after the rewound clock");
    expect(await parentsOf(a, id)).toEqual([head]);
  });
});

describe("the note caches and never authorizes: whatever it gets wrong, the walk answers", () => {
  it("a note naming an id no manifest rests under falls back to the walk and cites the true head", async () => {
    const a = await vessel(world(), "a");
    let head: RecordId | null = null;
    for (let i = 0; i < 4; i++) head = await seal(a, `note ${i}`);
    const { name, bytes } = await noteOf(a);
    const noted = JSON.parse(new TextDecoder().decode(bytes)) as { heads: string[] };
    noted.heads = ["ab".repeat(32)];
    await a.rest.put("own", name, utf8Bytes(JSON.stringify(noted)));
    a.restart();
    let id: RecordId | null = null;
    const calls = await callsOf(a, async () => { id = await seal(a, "after the bad note"); });
    expect(await parentsOf(a, id!)).toEqual([head]);
    // The walk ran: every manifest at rest read once.
    expect(count(calls, "get manifest")).toBeGreaterThanOrEqual(4);
  });

  it("A FORGED NOTE ADMITS NO UNVERIFIED MANIFEST: a note naming a forgery at rest falls back, and the forgery stays uncited", async () => {
    const a = await vessel(world(), "a");
    for (let i = 0; i < 4; i++) await seal(a, `note ${i}`);
    const all = await a.store.records("manifest");
    const cited = new Set(all.flatMap((m) => m.body.parents));
    const head = all.map((m) => recordIdOf("manifest", m.body)).find((id) => !cited.has(id))!;
    const real = all.find((m) => recordIdOf("manifest", m.body) === head)!;
    // A forgery at rest that would supplant the head: it cites the head over a sealed part minted for another id.
    const forged: SealedRecord<"manifest"> = { kind: "manifest", body: { ...real.body, parents: [head] }, sealed: real.sealed };
    const forgedId = await a.store.putRecord(forged);
    const { name, bytes } = await noteOf(a);
    const noted = JSON.parse(new TextDecoder().decode(bytes)) as { heads: string[] };
    noted.heads = [forgedId];
    await a.rest.put("own", name, utf8Bytes(JSON.stringify(noted)));
    a.restart();
    const id = await seal(a, "after the forged note");
    expect(await parentsOf(a, id)).toEqual([head]);
  });

  it("PROBE: a note forged to keep the current row reading and name an older genuine manifest falls back, and no fork persists", async () => {
    const a = await vessel(world(), "a");
    const ids: RecordId[] = [];
    for (let i = 0; i < 4; i++) ids.push(await seal(a, `note ${i}`));
    const { name, bytes } = await noteOf(a);
    const noted = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    // The forger keeps the note's own row reading and names an older manifest that still verifies.
    noted.heads = [ids[1]];
    noted.refused = [];
    await a.rest.put("own", name, utf8Bytes(JSON.stringify(noted)));
    a.restart();
    const first = await seal(a, "after the forged note");
    expect(await parentsOf(a, first)).toEqual([ids[3]]);
    a.restart();
    const second = await seal(a, "after a second restart");
    expect(await parentsOf(a, second)).toEqual([first]);
  });

  it("PROBE: a note forged to name no heads and no refusals over a ledger with rows falls back: no seal mints a parentless manifest", async () => {
    const a = await vessel(world(), "a");
    let head: RecordId | null = null;
    for (let i = 0; i < 3; i++) head = await seal(a, `note ${i}`);
    const { name, bytes } = await noteOf(a);
    const noted = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    noted.heads = [];
    noted.refused = [];
    await a.rest.put("own", name, utf8Bytes(JSON.stringify(noted)));
    a.restart();
    const id = await seal(a, "after the empty note");
    expect(await parentsOf(a, id)).toEqual([head]);
  });

  it("PROBE: a genuine earlier note rolled back over a row set of the same size but other names falls back", async () => {
    const a = await vessel(world(), "a");
    for (let i = 0; i < 3; i++) await seal(a, `note ${i}`);
    const earlier = await noteOf(a);
    const before = new Set(await a.rest.list("index"));
    const head = await seal(a, "the head the earlier note never saw");
    const added = (await a.rest.list("index")).filter((n) => !before.has(n));
    expect(added.length).toBeGreaterThan(0);
    // The machine's holder hides the newer rows, and swaps one row the earlier note saw for a name of its own: the
    // earlier note's count stands again over a row set it never saw.
    const swapped = [...before].sort()[0]!;
    const fake = `${swapped.slice(0, swapped.lastIndexOf(".") + 1)}${"0".repeat(64)}`;
    const hidden = new Set([...added, swapped]);
    const list = a.rest.list.bind(a.rest);
    a.rest.list = async (kind, prefix) => {
      const names = await list(kind, prefix);
      if (kind !== "index") return names;
      const kept = names.filter((n) => !hidden.has(n));
      return [...kept, ...(prefix === undefined || fake.startsWith(prefix) ? [fake] : [])].sort();
    };
    await a.rest.put("own", earlier.name, earlier.bytes);
    a.restart();
    const id = await seal(a, "after the rolled-back note");
    a.rest.list = list;
    expect(await parentsOf(a, id)).toEqual([head]);
  });

  it("a note malformed at rest falls back to the walk", async () => {
    const a = await vessel(world(), "a");
    let head: RecordId | null = null;
    for (let i = 0; i < 3; i++) head = await seal(a, `note ${i}`);
    const { name } = await noteOf(a);
    await a.rest.put("own", name, utf8Bytes("not a note"));
    a.restart();
    const id = await seal(a, "after the malformed note");
    expect(await parentsOf(a, id)).toEqual([head]);
  });

  it("an earlier seal's genuine note restored over the current one falls back once the row set moved past it, and cites the true head", async () => {
    const a = await vessel(world(), "a");
    for (let i = 0; i < 3; i++) await seal(a, `note ${i}`);
    const earlier = await noteOf(a);
    const head = await seal(a, "the head the earlier note never saw");
    // The earlier note names a manifest that still verifies, though a later one now cites it.
    await a.rest.put("own", earlier.name, earlier.bytes);
    a.restart();
    const id = await seal(a, "after the stale note");
    expect(await parentsOf(a, id)).toEqual([head]);
  });

  it("a note that never rested after its manifest (a stop between) falls back: the heads the manifest moved still count", async () => {
    const a = await vessel(world(), "a");
    for (let i = 0; i < 3; i++) await seal(a, `note ${i}`);
    // The rest refuses the note alone: the manifest and its rows rest, the note keeps the heads before them.
    a.rest.failOn = (kind, name) => kind === "own" && name.startsWith("heads.");
    const r = await a.holder.sealBlob({ bagId: BAG, plaintext: utf8Bytes("the note never rests"), signer: a.signer });
    a.rest.failOn = null;
    const rested = "refusal" in r ? null : r.manifest;
    const all = await a.store.records("manifest");
    const cited = new Set(all.flatMap((m) => m.body.parents));
    const heads = all.map((m) => recordIdOf("manifest", m.body)).filter((id) => !cited.has(id));
    expect(heads).toHaveLength(1);
    if (rested !== null) expect(heads).toEqual([rested]);
    a.restart();
    const id = await seal(a, "after the stop");
    expect(await parentsOf(a, id)).toEqual(heads);
  });

  it("a stop between the note and its manifest or its rows sends the next count to the walk, which cites the true heads", async () => {
    for (const where of ["manifest", "index"] as const) {
      const a = await vessel(world(), `a-${where}`);
      for (let i = 0; i < 3; i++) await seal(a, `note ${i}`);
      // The note rests ahead of its manifest; the rest then refuses the manifest, or its rows.
      a.rest.failOn = (kind) => kind === where;
      await a.holder.sealBlob({ bagId: BAG, plaintext: utf8Bytes(`the ${where} never rests`), signer: a.signer }).catch(() => null);
      a.rest.failOn = null;
      const all = await a.store.records("manifest");
      const cited = new Set(all.flatMap((m) => m.body.parents));
      const heads = all.map((m) => recordIdOf("manifest", m.body)).filter((id) => !cited.has(id));
      expect(heads, where).toHaveLength(1);
      a.restart();
      let id: RecordId | null = null;
      const lists = await shelfListsOf(a, async () => { id = await seal(a, "after the stop"); });
      expect(lists, where).toBe(1);
      expect(await parentsOf(a, id!), where).toEqual(heads);
    }
  });

  it("a manifest that arrives clears the note of its founding and version: the next seal walks once and notes afresh", async () => {
    const a = await vessel(world(), "a");
    for (let i = 0; i < 4; i++) await seal(a, `note ${i}`);
    const { name } = await noteOf(a);
    const arriving = (await a.store.records("manifest")).slice(0, 1);
    const r = await a.holder.receive({ parcels: [], records: arriving });
    if ("refusal" in r) throw new Error(said(r));
    expect((await a.rest.get("own", name))?.length ?? 0).toBe(0);
    const calls = await callsOf(a, () => seal(a, "after the arrival"));
    expect(count(calls, "get manifest")).toBeGreaterThanOrEqual(4);
    expect((await a.rest.get("own", name))?.length ?? 0).toBeGreaterThan(0);
  });
});
