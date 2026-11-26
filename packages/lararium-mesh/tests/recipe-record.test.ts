/**
 * THE RECIPE RECORD AND THE MOUNT STRUCT CONVERGE. A recipe record (`bag-stack` + `writable-bag`)
 * drives `tiddler put --recipe`, recipe-watch's library membership and the residency pins; the
 * `WikiRecipe` struct drives the mount. One name, one shape: the record a minter writes and the
 * layers `expandRecipe` lays name the SAME bags in the SAME order, and `writable-bag` names the
 * working slot the mount makes the default writable.
 */
import { describe, test, expect } from "vitest";
import {
  expandRecipe, recipeFromRecord, recipeRecordFields, wikiBagUri, wikiSlotUri,
  ORACLE_BAG, LARARIUM_BAG, LARES_BAG, bagUri, designatedBagOf, bagStackFromRec,
  parsePluginOfferings,
} from "../src/index.js";
import { buildGenesisSeed } from "../src/genesis-doc.js";
import { houseCanonBagsSeated } from "../src/kahu-canon-reach.js";
import { kahuaRecipe, foreignDocsOf, recipeFloorStack, CROSSROADS_BAG } from "../src/wiki-recipe.js";
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
    // THE CANON FLOOR BY PLACE: neither quine wiki names the other as a library (`lararium` stacks in the herm/hearth wiki alone).
    for (const [slug, libs] of [["lares", []], ["lararium", []]] as const) {
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

/**
 * ★ THE LARES WIKI MOUNTS ITS OWN LIVE CANON; THE DAEMON WIKI MOUNTS THE FLOOR (operator rulings 2026-11-23 and
 * 2026-11-26-canon-floor-by-place) ★
 *
 * The 2026-11-23 ruling keeps the daemon off every live house canon document: it reads `lares` and `lararium` through the floor's
 * CID-pinned snapshots alone. THE CANON FLOOR BY PLACE ("I want `lares` in all wikis, `lararium+lares` in the herm/hearth wiki")
 * places the canon each wiki stacks: the `lares` system recipe the genesis carries lays its own canon live above the oracle floor
 * and stacks no `lararium` (neither live nor through its floor), and the herm/hearth (daemon) wiki's floor lays both snapshots,
 * TiddlyWiki5's native docs beneath. Which vessel holds the live documents rides the cabal's admission (register-bags.test).
 */
describe("★ the lares wiki mounts its own live canon above the floor; the daemon wiki mounts the floor alone ★", () => {
  const genesisLares = () => {
    const seed = buildGenesisSeed({ actorSeed: "00".repeat(32), coreBlob: new Uint8Array([1, 2, 3]), coreVersion: "0.0.0-test", plugins: [] });
    const rec = seed.tiddlers[recipeUri("oracle", "lares")] as LarTiddlerRecord | undefined;
    expect(rec, "genesis carries no lares recipe").toBeDefined();
    return recipeFromRecord(rec!, "lares");
  };

  test("the lares wiki lays its own canon live above the oracle floor, its working slot writable on top, and stacks no lararium", () => {
    const slots = expandRecipe(genesisLares());
    const floorAt = slots.indexOf(ORACLE_BAG);
    expect(floorAt, "the lares wiki lost its floor").toBe(slots.length - 1);
    expect(houseCanonBagsSeated()).toContain(LARES_BAG);
    expect(slots, "the lares wiki lays no live lares canon").toContain(LARES_BAG);
    expect(slots.indexOf(LARES_BAG)).toBeLessThan(floorAt);
    expect(slots.indexOf(LARES_BAG)).toBeGreaterThan(slots.indexOf(wikiSlotUri("lares", "working")));
    expect(slots).not.toContain(LARARIUM_BAG);
    expect(recipeFloorStack(genesisLares())).not.toContain(LARARIUM_BAG);
  });

  test("the daemon wiki, as the daemon VM composes it, lays no house canon bag: it reads lares and lararium through the floor", () => {
    const slots = expandRecipe(kahuaRecipe({ wikiSlug: "daemon", libraryBags: [CROSSROADS_BAG] }));
    // The floor, then TiddlyWiki5's native docs beneath every house layer (the herm/hearth wiki alone stacks them).
    expect(slots.slice(slots.indexOf(ORACLE_BAG))).toEqual([ORACLE_BAG, ...foreignDocsOf("daemon")]);
    expect(foreignDocsOf("daemon").length).toBeGreaterThan(0);
    for (const bag of houseCanonBagsSeated()) expect(slots, `the daemon wiki mounts live ${bag}`).not.toContain(bag);
  });
});
