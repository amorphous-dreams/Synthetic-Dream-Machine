/**
 * holder-seal-walks-once — THE FIRST SEAL AFTER A READING WALKS THE MANIFEST SHELF ONCE, NEVER ONCE PER MANIFEST.
 *
 * The first seal of a fresh reading counts the heads it cites from rest (`#cited`). It read the shelf once, then asked
 * the store for each manifest again by its id, and each such ask lists the shelf under a prefix: a walk quadratic in
 * the manifests at rest. Over a live vessel's 8,797 manifests the walk ran for minutes inside the daemon island, and
 * every seal and gate ask behind it went unanswered. The cure verifies each manifest from the copies the one pass
 * already carries, and a reload whose founding neither moved nor gained a manifest keeps the heads it counted.
 *
 * Each vector counts the rest's own calls, so none reads a clock.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { describe, expect, it } from "vitest";
import { utf8Bytes } from "../src/crypto.js";
import { recordIdOf, type RecordId, type SealedRecord } from "../src/sealed-records.js";
import { said, vessel, world, type Vessel } from "./content-key-fixture.js";

const BAG = "lar:///ha.ka.ba/@test/bags/garden-notes";
const OTHER = "lar:///ha.ka.ba/@test/bags/kitchen-notes";

async function seal(v: Vessel, plaintext: string, bagId = BAG): Promise<void> {
  const r = await v.holder.sealBlob({ bagId, plaintext: utf8Bytes(plaintext), signer: v.signer });
  if ("refusal" in r) throw new Error(`setup: seal refused ${said(r)}`);
}
/** The calls one act makes on the rest. */
async function callsOf(v: Vessel, act: () => Promise<unknown>): Promise<string[]> {
  const from = v.rest.calls.length;
  await act();
  return v.rest.calls.slice(from);
}
const count = (calls: readonly string[], call: string): number => calls.filter((one) => one === call).length;

describe("the first seal of a reading walks the manifest shelf once", () => {
  it("RED: a restarted holder's first seal lists the manifest shelf once, however many manifests rest", async () => {
    for (const many of [4, 16]) {
      const a = await vessel(world(), "a");
      for (let i = 0; i < many; i++) await seal(a, `note ${i}`);
      a.restart();
      const calls = await callsOf(a, () => seal(a, "the first seal after the restart"));
      // One pass over the shelf: never one more list per manifest the shelf holds.
      expect(count(calls, "list manifest")).toBe(1);
    }
  });

  it("CONTROL: the second seal of the same reading lists no manifest at all (the heads stand counted)", async () => {
    const a = await vessel(world(), "a");
    for (let i = 0; i < 6; i++) await seal(a, `note ${i}`);
    a.restart();
    await seal(a, "the first seal after the restart");
    const calls = await callsOf(a, () => seal(a, "the second seal"));
    expect(count(calls, "list manifest")).toBe(0);
  });

  it("the walk still cites every head: a restarted holder's seal names the one head the earlier seals left", async () => {
    const a = await vessel(world(), "a");
    for (let i = 0; i < 5; i++) await seal(a, `note ${i}`);
    const before = [...a.rest.values.keys()].filter((k) => k.startsWith("manifest/")).length;
    a.restart();
    await seal(a, "after the restart");
    // Each seal rests one manifest that cites the one head before it: the chain stays one line, so no fork shows.
    const manifests = [...a.rest.values.keys()].filter((k) => k.startsWith("manifest/"));
    expect(manifests.length).toBe(before + 1);
    const reading = await a.holder.reading(BAG);
    if ("refusal" in reading) throw new Error(said(reading));
    expect(reading.foundings.length).toBe(1);
  });
});

describe("a reload whose founding did not move keeps the heads it counted", () => {
  it("RED: a parcel that lands for another bag leaves this bag's heads standing: its next seal lists no manifest", async () => {
    const w = world();
    const a = await vessel(w, "a");
    for (let i = 0; i < 6; i++) await seal(a, `note ${i}`);
    // A receipt that carries nothing for the garden still reloads the reading.
    const r = await a.holder.receive({ parcels: [] });
    if ("refusal" in r) throw new Error(said(r));
    const calls = await callsOf(a, () => seal(a, "after the receipt"));
    expect(count(calls, "list manifest")).toBe(0);
  });

  it("CONTROL: a receipt that carries a manifest takes the reading afresh, and the next seal counts the heads again", async () => {
    const w = world();
    const a = await vessel(w, "a");
    for (let i = 0; i < 3; i++) await seal(a, `note ${i}`);
    await seal(a, "the kitchen's note", OTHER);
    // A manifest that arrives again, as a peer would carry it: the receipt cannot tell it from a stranger's.
    const arriving = (await a.store.records("manifest")).slice(0, 1);
    const r = await a.holder.receive({ parcels: [], records: arriving });
    if ("refusal" in r) throw new Error(said(r));
    const calls = await callsOf(a, () => seal(a, "after the arrival"));
    expect(count(calls, "list manifest")).toBe(1);
  });

  it("a chain that moves under an unmoved founding re-counts the heads from one pass, and every manifest it verified before stays verified", async () => {
    let chain = "chain-one";
    const a = await vessel(world(), "a", { standing: { holdsWrite: () => true, chainOf: () => chain } });
    for (let i = 0; i < 8; i++) await seal(a, `note ${i}`);
    a.restart();
    await seal(a, "the first seal after the restart");
    chain = "chain-two";
    const calls = await callsOf(a, () => seal(a, "after the chain moved"));
    expect(count(calls, "list manifest")).toBeLessThanOrEqual(1);
  });

  it("a writer the moved chain no longer stands for leaves the heads: the next seal refuses as before", async () => {
    let capable = true;
    let chain = "chain-one";
    const a = await vessel(world(), "a", { standing: { holdsWrite: () => capable, chainOf: () => chain } });
    for (let i = 0; i < 3; i++) await seal(a, `note ${i}`);
    capable = false;
    chain = "chain-two";
    const r = await a.holder.sealBlob({ bagId: BAG, plaintext: utf8Bytes("no standing now"), signer: a.signer });
    expect("refusal" in r).toBe(true);
  });
});

describe("the count verifies from the top down", () => {
  /** The manifests at rest no other manifest at rest cites. */
  const uncited = (all: readonly SealedRecord<"manifest">[]): RecordId[] => {
    const cited = new Set(all.flatMap((m) => m.body.parents));
    return all.map((m) => recordIdOf("manifest", m.body)).filter((id) => !cited.has(id));
  };
  const newest = async (v: Vessel, before: ReadonlySet<string>): Promise<SealedRecord<"manifest">> => {
    const fresh = (await v.store.records("manifest")).filter((m) => !before.has(recordIdOf("manifest", m.body)));
    expect(fresh).toHaveLength(1);
    return fresh[0]!;
  };
  const ids = async (v: Vessel): Promise<Set<string>> => new Set((await v.store.records("manifest")).map((m) => recordIdOf("manifest", m.body)));

  it("a restarted holder cites the one head the ledger holds", async () => {
    const a = await vessel(world(), "a");
    for (let i = 0; i < 5; i++) await seal(a, `note ${i}`);
    const [head] = uncited(await a.store.records("manifest"));
    a.restart();
    const before = await ids(a);
    await seal(a, "after the restart");
    expect((await newest(a, before)).body.parents).toEqual([head]);
  });

  it("A MANIFEST THAT FAILS ITS READING HIDES NO HEAD: a forged citer of the head counts for nothing, and the head stands cited", async () => {
    const a = await vessel(world(), "a");
    for (let i = 0; i < 4; i++) await seal(a, `note ${i}`);
    const all = await a.store.records("manifest");
    const [head] = uncited(all);
    const real = all.find((m) => recordIdOf("manifest", m.body) === head)!;
    // A forgery at rest: a clear part that cites the head, over a sealed part minted for another id. It never opens.
    const forged: SealedRecord<"manifest"> = { kind: "manifest", body: { ...real.body, parents: [head!] }, sealed: real.sealed };
    await a.store.putRecord(forged);
    a.restart();
    const before = await ids(a);
    await seal(a, "after the forgery");
    expect((await newest(a, before)).body.parents).toEqual([head]);
  });
});
