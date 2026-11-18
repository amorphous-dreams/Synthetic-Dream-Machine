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
import { floorMountBlobRows, signFloorOffering } from "../src/floor-offering.js";

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
  const provenance = { source: "https://example.test", commit: "0".repeat(40), path: "p.json", licence: "MIT" };
  const offerOf = (rows: ReadonlyArray<{ id: string; version: string; sha256: string }>) =>
    signFloorOffering({ seed: new Uint8Array(32).fill(8), blobs: rows.map((b) => ({ id: b.id, version: b.version, sha256: b.sha256, provenance })) });

  it("a pin whose offering carries the founding record's boot set reads same; one whose parser bytes moved reads grammar moved, plugins moved and floor moved", async () => {
    const seed = shipped();
    const record = foundingRecordDigests(seed);
    const rows = floorMountBlobRows(Object.values(seed.blobs) as Array<{ id: string; version: string; sha256: string; mimeType: string }>);
    const whole = await offerOf(rows);
    const genesisFloor = { engine: record.engine!, plugins: whole.cid };
    const same = compareSeedToFoundingRecord({ record: seed, floorPin: { manifestCid: record.floor!, manifest: genesisFloor, offering: whole.offering } });
    expect(ratchetWords(same.floorPin!)).toBe("engine same · grammar same · plugins same · floor same");
    expect(same.seed).toBeNull();

    const parserMoved = await offerOf(rows.map((r) => (r.id === LARES_MEMETIC_WIKITEXT_PLUGIN_URI ? { ...r, sha256: "f".repeat(64) } : r)));
    const moved = compareSeedToFoundingRecord({ record: seed, floorPin: { manifestCid: "a".repeat(64), manifest: { ...genesisFloor, plugins: parserMoved.cid }, offering: parserMoved.offering } });
    expect(ratchetWords(moved.floorPin!)).toBe("engine same · grammar moved · plugins moved · floor moved");
  });

  it("a pin whose offering did not read names grammar and plugins absent, never same", () => {
    const seed = shipped();
    const record = foundingRecordDigests(seed);
    const read = compareSeedToFoundingRecord({ record: seed, floorPin: { manifestCid: record.floor!, manifest: { engine: record.engine!, plugins: "b".repeat(64) }, offering: null } });
    expect(ratchetWords(read.floorPin!)).toBe("engine same · grammar absent · plugins absent · floor same");
    expect(ratchetWords(compareGenesisDigests(record, floorPinDigests("a".repeat(64), { engine: record.engine!, plugins: "b".repeat(64) }))))
      .toBe("engine same · grammar absent · plugins absent · floor moved");
  });
});
