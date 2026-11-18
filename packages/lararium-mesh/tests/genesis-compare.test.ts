/**
 * genesis-compare — the seed (offered) beside the founding record and the floor pin, ratchet by ratchet.
 *
 * D1: the shipped seed stands as an OFFER and the stored island as the house's ground (the founding record). One
 * pure helper recomputes the founding record's folded digests from its own blobs (the same fold the mint and
 * the verify read) and names, per ratchet, whether the offered seed or the pinned floor reads the same, moved,
 * or absent. Absent never reads as same.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compareGenesisDigests, compareSeedToFoundingRecord, floorPinDigests, foundingRecordDigests, ratchetWords,
} from "../src/genesis-compare.js";
import { GENESIS_CID_ENGINE_TIDDLER, GENESIS_CID_GRAMMAR_TIDDLER, GENESIS_CID_PLUGINS_TIDDLER, type GenesisSeed } from "../src/genesis-doc.js";
import { GENESIS_FLOOR_TIDDLER } from "../src/floor-manifest.js";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "../src/lar-uris.js";

const repoRoot = join(import.meta.dirname, "..", "..", "..");
const shipped = (): GenesisSeed => JSON.parse(readFileSync(join(repoRoot, "genesis", "seed.json"), "utf8")) as GenesisSeed;
const witness = (seed: GenesisSeed, title: string): string => (seed.tiddlers[title] as { tiddler: { cid: string } }).tiddler.cid;

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
    expect(foundingRecordDigests(seed)).toEqual({
      engine: witness(seed, GENESIS_CID_ENGINE_TIDDLER),
      grammar: witness(seed, GENESIS_CID_GRAMMAR_TIDDLER),
      plugins: witness(seed, GENESIS_CID_PLUGINS_TIDDLER),
      floor: witness(seed, GENESIS_FLOOR_TIDDLER),
    });
  });

  it("a record with no blobs names every folded ratchet absent, never a digest of nothing", () => {
    expect(foundingRecordDigests({ tiddlers: {} })).toEqual({ engine: null, grammar: null, plugins: null, floor: null });
  });
});

describe("seed (offered) beside the founding record", () => {
  it("an island and a seed with equal witnesses read same on every ratchet", () => {
    const seed = shipped();
    const read = compareSeedToFoundingRecord({ record: seed, seed });
    expect(ratchetWords(read.seed!)).toBe("engine same · grammar same · plugins same · floor same");
    expect(read.floorPin).toBeNull();
  });

  it("CONTROL: one moved grammar reads grammar moved, and the other ratchets read same", () => {
    const seed = shipped();
    const read = compareSeedToFoundingRecord({ record: seed, seed: grammarMoved(seed) });
    expect(ratchetWords(read.seed!)).toBe("engine same · grammar moved · plugins same · floor same");
  });

  it("a seed with no floor witness names floor absent, never same", () => {
    const seed = shipped();
    const tiddlers = { ...seed.tiddlers }; delete tiddlers[GENESIS_FLOOR_TIDDLER];
    const read = compareSeedToFoundingRecord({ record: seed, seed: { ...seed, tiddlers } });
    expect(ratchetWords(read.seed!)).toBe("engine same · grammar same · plugins same · floor absent");
    // Absent on both sides still reads absent.
    expect(ratchetWords(compareGenesisDigests(
      { engine: null, grammar: null, plugins: null, floor: null },
      { engine: null, grammar: null, plugins: null, floor: null },
    ))).toBe("engine absent · grammar absent · plugins absent · floor absent");
  });
});

describe("the floor pin beside the founding record", () => {
  it("a pin on the genesis floor reads same; a pinned floor whose grammar field moved reads grammar moved and floor moved", () => {
    const seed = shipped();
    const record = foundingRecordDigests(seed);
    const genesisFloor = { engine: record.engine!, grammar: record.grammar!, plugins: record.plugins! };
    const same = compareSeedToFoundingRecord({ record: seed, floorPin: { manifestCid: record.floor!, manifest: genesisFloor } });
    expect(ratchetWords(same.floorPin!)).toBe("engine same · grammar same · plugins same · floor same");
    expect(same.seed).toBeNull();

    const moved = floorPinDigests("a".repeat(64), { ...genesisFloor, grammar: "bafkreigrammarmoved" });
    expect(ratchetWords(compareGenesisDigests(record, moved))).toBe("engine same · grammar moved · plugins same · floor moved");
  });
});
