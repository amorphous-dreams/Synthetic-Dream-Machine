/**
 * THE RECIPE RECORD AND THE MOUNT STRUCT CONVERGE. A recipe record (`bag-stack` + `writable-bag`)
 * drives `meme put --recipe`, recipe-watch's library membership and the residency pins; the
 * `WikiRecipe` struct drives the mount. One name, one shape: the record a minter writes and the
 * layers `expandRecipe` lays name the SAME bags in the SAME order, and `writable-bag` names the
 * working slot the mount makes the default writable.
 */
import { describe, test, expect } from "vitest";
import {
  expandRecipe, recipeFromRecord, recipeRecordFields, wikiBagUri, wikiSlotUri,
  ORACLE_BAG, LARARIUM_BAG, LARES_BAG, bagUri, designatedBagOf, bagStackFromRec,
} from "../src/index.js";
import { buildGenesisSeed } from "../src/genesis-doc.js";
import { recipeUri } from "../src/lar-uris.js";
import type { LarTiddlerRecord } from "../src/tiddler-store.js";

const INSTANCE = (slug: string) => new Set(["temp", "draft", "personal", "working"].map((k) => wikiSlotUri(slug, k as never)));

/** The record a minter writes for `recipe`, as a LarTiddlerRecord. */
const minted = (slug: string, libraryBags: readonly string[]): LarTiddlerRecord => ({
  tiddler: { title: recipeUri("catalog", slug), ...recipeRecordFields({ wikiSlug: slug, libraryBags }) },
});

describe("★ the recipe record ↔ the mount struct ★", () => {
  test("the record's bag-stack IS the expanded cascade, bottom-up, minus the instance slots the grants mint", () => {
    for (const [slug, libs] of [["sdm", [LARES_BAG, LARARIUM_BAG, bagUri("ftls")]], ["lares", [LARARIUM_BAG]], ["solo", []]] as const) {
      const rec = minted(slug, libs);
      const laid = expandRecipe({ wikiSlug: slug, libraryBags: libs }).filter((s) => !INSTANCE(slug).has(s));
      expect([...bagStackFromRec(rec)].reverse(), `${slug}: the record and the mount disagree`).toEqual(laid);
    }
  });

  test("a record round-trips through recipeFromRecord: the same libraries in the same order", () => {
    const libs = [LARES_BAG, LARARIUM_BAG, bagUri("ftls")];
    const rec = minted("sdm", libs);
    expect(recipeFromRecord(rec, "sdm").libraryBags).toEqual(libs);
    expect(expandRecipe(recipeFromRecord(rec, "sdm"))).toEqual(expandRecipe({ wikiSlug: "sdm", libraryBags: libs }));
  });

  test("writable-bag names the working slot — the mount's default writable — and is the designated bag", () => {
    const rec = minted("sdm", [LARES_BAG]);
    expect(rec.tiddler["writable-bag"]).toBe(wikiSlotUri("sdm", "working"));
    expect(designatedBagOf(rec)).toBe(wikiSlotUri("sdm", "working"));
    expect(expandRecipe({ wikiSlug: "sdm" })).toContain(designatedBagOf(rec));
  });

  test("the catalog registry never rides a bag-stack (access ≠ load)", () => {
    expect(bagStackFromRec(minted("sdm", [LARES_BAG]))).not.toContain(bagUri("catalog"));
  });

  test("the genesis system recipes obey the same law", () => {
    const seed = buildGenesisSeed({
      actorSeed: "00".repeat(32), coreBlob: new Uint8Array([1, 2, 3]), coreVersion: "0.0.0-test",
      plugins: [],
    });
    for (const [slug, libs] of [["lares", [LARARIUM_BAG]], ["lararium", []]] as const) {
      const rec = seed.tiddlers[recipeUri("oracle", slug)] as LarTiddlerRecord | undefined;
      expect(rec, `genesis carries no recipe for ${slug}`).toBeDefined();
      const laid = expandRecipe({ wikiSlug: slug, libraryBags: libs }).filter((s) => !INSTANCE(slug).has(s));
      expect([...bagStackFromRec(rec!)].reverse()).toEqual(laid);
      expect(rec!.tiddler["writable-bag"]).toBe(wikiSlotUri(slug, "working"));
      expect(recipeFromRecord(rec!, slug).libraryBags ?? []).toEqual(libs);
    }
    expect(expandRecipe({ wikiSlug: "lares", libraryBags: [LARARIUM_BAG] })).toEqual(
      [wikiSlotUri("lares", "temp"), wikiSlotUri("lares", "draft"), wikiSlotUri("lares", "personal"), wikiSlotUri("lares", "working"), wikiBagUri("lares"), LARARIUM_BAG, ORACLE_BAG],
    );
  });
});
