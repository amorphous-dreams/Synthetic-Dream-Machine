/**
 * genesis-compare — the seed (offered) beside the founding record and the floor accept, ratchet by ratchet.
 *
 * D1: the shipped seed stands as an OFFER and the stored island as the house's ground (the founding record). One
 * pure helper recomputes the founding record's folded digests from its own blobs (the same fold the mint and
 * the verify read) and names, per ratchet, whether the offered seed or the accepted floor reads the same, moved,
 * or absent. Absent never reads as same.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compareGenesisDigests, compareSeedToFoundingRecord, floorAcceptDigests, foundingRecordDigests, ratchetWords,
  seedRatchetStances, seedStanceWords, SEED_HELD_NEXT, SEED_OFFER_NEXT,
} from "../src/genesis-compare.js";
import { GENESIS_CID_ENGINE_TIDDLER, GENESIS_CID_GRAMMAR_TIDDLER, GENESIS_CID_PLUGINS_TIDDLER, type GenesisSeed } from "../src/genesis-doc.js";
import { GENESIS_FLOOR_TIDDLER } from "../src/floor-manifest.js";
import { LARES_LARARIUM_PLUGIN_URI, LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "../src/lar-uris.js";
import { floorMountBlobRows, signFloorOffering } from "../src/floor-offering.js";

const repoRoot = join(import.meta.dirname, "..", "..", "..");
const shipped = (): GenesisSeed => JSON.parse(readFileSync(join(repoRoot, "genesis", "seed.json"), "utf8")) as GenesisSeed;
const witness = (seed: GenesisSeed, title: string): string => (seed.tiddlers[title] as { tiddler: { cid: string } }).tiddler.cid;

/** The same seed with the house blob's bytes moved (a new house offered, the grammar standing). */
function houseMoved(seed: GenesisSeed): GenesisSeed {
  const blobs = { ...seed.blobs };
  const house = blobs[LARES_LARARIUM_PLUGIN_URI]!;
  blobs[LARES_LARARIUM_PLUGIN_URI] = { ...house, sha256: "e".repeat(64) };
  return { ...seed, blobs };
}

/** The same seed with the grammar blob's bytes moved (a new grammar offered). */
function grammarMoved(seed: GenesisSeed): GenesisSeed {
  const blobs = { ...seed.blobs };
  const grammar = blobs[LARES_MEMETIC_WIKITEXT_PLUGIN_URI]!;
  blobs[LARES_MEMETIC_WIKITEXT_PLUGIN_URI] = { ...grammar, sha256: "f".repeat(64) };
  return { ...seed, blobs };
}

describe("the founding record's digests recompute from its own blobs", () => {
  it("the shipped seed's recomputed folds equal its own witnesses (one fold, mint and mount)", () => {
    const seed = shipped();
    expect(foundingRecordDigests(seed)).toMatchObject({
      engine: witness(seed, GENESIS_CID_ENGINE_TIDDLER),
      grammar: witness(seed, GENESIS_CID_GRAMMAR_TIDDLER),
      plugins: witness(seed, GENESIS_CID_PLUGINS_TIDDLER),
      floor: witness(seed, GENESIS_FLOOR_TIDDLER),
    });
  });

  it("the shipped seed carries the house as its own required blob, and its ratchet folds it apart from grammar and plugins", () => {
    const seed = shipped();
    expect(seed.blobs[LARES_LARARIUM_PLUGIN_URI]?.kind, "the house blob rides genesis, declared").toBe("lararium");
    const digests = foundingRecordDigests(seed);
    expect(digests.lararium).toMatch(/^b/);
    expect(new Set([digests.grammar, digests.lararium, digests.plugins]).size, "three regions, three digests").toBe(3);
  });

  it("a record with no blobs names every folded ratchet absent, never a digest of nothing", () => {
    expect(foundingRecordDigests({ tiddlers: {} })).toEqual({ engine: null, grammar: null, lararium: null, plugins: null, floor: null });
  });
});

describe("seed (offered) beside the founding record", () => {
  it("an island and a seed with equal witnesses read same on every ratchet", () => {
    const seed = shipped();
    const read = compareSeedToFoundingRecord({ record: seed, seed });
    expect(ratchetWords(read.seed!)).toBe("engine same · grammar same · lararium same · plugins same · floor same");
    expect(read.floorAccept).toBeNull();
  });

  it("CONTROL: one moved grammar reads grammar moved, and the other ratchets read same", () => {
    const seed = shipped();
    const read = compareSeedToFoundingRecord({ record: seed, seed: grammarMoved(seed) });
    expect(ratchetWords(read.seed!)).toBe("engine same · grammar moved · lararium same · plugins same · floor same");
  });

  it("a moved house reads lararium moved and leaves the grammar and plugins ratchets standing", () => {
    const seed = shipped();
    const read = compareSeedToFoundingRecord({ record: seed, seed: houseMoved(seed) });
    expect(ratchetWords(read.seed!)).toBe("engine same · grammar same · lararium moved · plugins same · floor same");
  });

  it("a seed with no floor witness names floor absent, never same", () => {
    const seed = shipped();
    const tiddlers = { ...seed.tiddlers }; delete tiddlers[GENESIS_FLOOR_TIDDLER];
    const read = compareSeedToFoundingRecord({ record: seed, seed: { ...seed, tiddlers } });
    expect(ratchetWords(read.seed!)).toBe("engine same · grammar same · lararium same · plugins same · floor absent");
    // Absent on both sides still reads absent.
    expect(ratchetWords(compareGenesisDigests(
      { engine: null, grammar: null, lararium: null, plugins: null, floor: null },
      { engine: null, grammar: null, lararium: null, plugins: null, floor: null },
    ))).toBe("engine absent · grammar absent · lararium absent · plugins absent · floor absent");
  });
});

describe("the floor accept beside the founding record", () => {
  const provenance = { source: "https://example.test", commit: "0".repeat(40), path: "p.json", licence: "MIT" };
  const offerOf = (rows: ReadonlyArray<{ id: string; version: string; sha256: string }>) =>
    signFloorOffering({ seed: new Uint8Array(32).fill(8), blobs: rows.map((b) => ({ id: b.id, version: b.version, sha256: b.sha256, provenance })) });

  it("a pin whose offering carries the founding record's boot set reads same; one whose parser bytes moved reads grammar moved, plugins moved and floor moved", async () => {
    const seed = shipped();
    const record = foundingRecordDigests(seed);
    const rows = floorMountBlobRows(Object.values(seed.blobs) as Array<{ id: string; version: string; sha256: string; mimeType: string }>);
    const whole = await offerOf(rows);
    const genesisFloor = { engine: record.engine!, plugins: whole.cid };
    const same = compareSeedToFoundingRecord({ record: seed, floorAccept: { manifestCid: record.floor!, manifest: genesisFloor, offering: whole.offering } });
    expect(ratchetWords(same.floorAccept!)).toBe("engine same · grammar same · lararium same · plugins same · floor same");
    expect(same.seed).toBeNull();

    const parserMoved = await offerOf(rows.map((r) => (r.id === LARES_MEMETIC_WIKITEXT_PLUGIN_URI ? { ...r, sha256: "f".repeat(64) } : r)));
    const moved = compareSeedToFoundingRecord({ record: seed, floorAccept: { manifestCid: "a".repeat(64), manifest: { ...genesisFloor, plugins: parserMoved.cid }, offering: parserMoved.offering } });
    expect(ratchetWords(moved.floorAccept!)).toBe("engine same · grammar moved · lararium same · plugins moved · floor moved");
  });

  it("a pin whose offering did not read names grammar and plugins absent, never same", () => {
    const seed = shipped();
    const record = foundingRecordDigests(seed);
    const read = compareSeedToFoundingRecord({ record: seed, floorAccept: { manifestCid: record.floor!, manifest: { engine: record.engine!, plugins: "b".repeat(64) }, offering: null } });
    expect(ratchetWords(read.floorAccept!)).toBe("engine same · grammar absent · lararium absent · plugins absent · floor same");
    expect(ratchetWords(compareGenesisDigests(record, floorAcceptDigests("a".repeat(64), { engine: record.engine!, plugins: "b".repeat(64) }))))
      .toBe("engine same · grammar absent · lararium absent · plugins absent · floor moved");
  });
});

describe("the seed's stances: each moved ratchet reads offer or held (engine), with one runnable line (follow-lei S0)", () => {
  const record = { engine: "e1", grammar: "g1", lararium: "l1", plugins: "p1", floor: "f1" };

  it("RED: a moved skin reads offer and a moved engine reads held (engine), each with its own runnable line; same ratchets leave the list", () => {
    const moved = compareGenesisDigests(record, { engine: "e2", grammar: "g2", lararium: "l1", plugins: "p1", floor: "f2" });
    const stances = seedRatchetStances(moved);
    expect(stances).toEqual([
      { ratchet: "engine", stance: "held (engine)", next: SEED_HELD_NEXT },
      { ratchet: "grammar", stance: "offer", next: SEED_OFFER_NEXT },
      { ratchet: "floor", stance: "offer", next: SEED_OFFER_NEXT },
    ]);
    const words = seedStanceWords(stances);
    expect(words).toContain("offer: grammar, the seed's floor adopt over a local floor");
    expect(words).toContain(`\`${SEED_OFFER_NEXT}\``);
    expect(words).toContain("held (engine): the engine stays behind its own cadence threshold");
    expect(words).toContain(`\`${SEED_HELD_NEXT}\``);
    expect(words).not.toContain("only a re-found");
  });

  it("CONTROL: a seed the same on every ratchet reads no stance, and an absent ratchet reads as an offer, never same", () => {
    expect(seedRatchetStances(compareGenesisDigests(record, record))).toEqual([]);
    expect(seedStanceWords([])).toBe("");
    const absent = seedRatchetStances(compareGenesisDigests(record, { ...record, plugins: null }));
    expect(absent).toEqual([{ ratchet: "plugins", stance: "offer", next: SEED_OFFER_NEXT }]);
  });
});
