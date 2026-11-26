/**
 * clear-recipe.test.ts — the clear wiki never saves: its memory top alone takes a write, and every write below it, every
 * promotion, mirror and receipt ask answers the herm's own refusal with its cure.
 * (The recipe's shape rides derive-wiki-recipe.test.ts; the floor pick rides waking-floor.test.ts.)
 * Plan: lar:///ha.ka.ba/kahua/memory/plan/herm-rungs#S3
 */
import { describe, expect, test } from "vitest";
import { CLEAR_FLOOR_STAMP, clearAskRefusal, clearFloorPick, clearLayerFlags, clearRecipeOf, clearTopSlot, isClearRecipe } from "../src/clear-recipe.js";
import { HERM_REFUSAL } from "../src/herm-stack.js";
import { LARARIUM_BAG, ORACLE_BAG, expandRecipe, slotLayerFlags, wikiSlotUri, type WikiRecipe } from "../src/wiki-recipe.js";

const PUBLIC_LIB = "lar:///ha.ka.ba/bags/sdm";
const source: WikiRecipe = { wikiSlug: "lares", libraryBags: [LARARIUM_BAG, PUBLIC_LIB] };
const clear = clearRecipeOf(source, (bag) => (bag === PUBLIC_LIB ? "public" : null));

describe("the clear recipe carries its mark", () => {
  test("a clear recipe reads clear; the recipe it came from stays as it stood", () => {
    expect(isClearRecipe(clear)).toBe(true);
    expect(isClearRecipe(source)).toBe(false);
    expect(expandRecipe(source)).toContain(wikiSlotUri("lares", "working"));
  });
});

describe("the memory top alone takes a write", () => {
  test("only the temp top registers writable, and it takes the default-writable office", () => {
    const slots = expandRecipe(clear);
    expect(slots[0]).toBe(clearTopSlot(clear));
    expect(slots.filter((s) => clearLayerFlags(clear, s).writable)).toEqual([wikiSlotUri("lares", "temp")]);
    expect(slots.filter((s) => clearLayerFlags(clear, s).defaultWritable)).toEqual([wikiSlotUri("lares", "temp")]);
    // The recipe it came from lays the kept library writable; seen clear, that same bag takes no write.
    expect(slotLayerFlags(PUBLIC_LIB, "lares").writable).toBe(true);
    expect(clearLayerFlags(clear, PUBLIC_LIB).writable).toBe(false);
  });

  test("a put and a tombstone land at the top", () => {
    expect(clearAskRefusal(clear, { kind: "put", slot: clearTopSlot(clear) })).toBeNull();
    expect(clearAskRefusal(clear, { kind: "tombstone", slot: clearTopSlot(clear) })).toBeNull();
  });
});

describe("the clear wiki never saves", () => {
  const CODE = HERM_REFUSAL.wikiNeverSaves.code;

  test("a put or a tombstone at every slot below the top refuses by the herm's own name", () => {
    const below = [...expandRecipe(clear).slice(1), wikiSlotUri("lares", "working"), wikiSlotUri("lares", "draft"), wikiSlotUri("other", "temp")];
    expect(below).toContain(ORACLE_BAG);
    for (const slot of below) {
      for (const kind of ["put", "tombstone"] as const) {
        const refusal = clearAskRefusal(clear, { kind, slot });
        expect(refusal).toMatchObject({ code: CODE, root: HERM_REFUSAL.wikiNeverSaves.root });
        expect(refusal!.why).toContain(slot);
      }
    }
  });

  test("a promotion, a mirror and a receipt ask each refuse by the same name, and each line names its ask and the cure", () => {
    for (const kind of ["promote", "mirror", "receipt"] as const) {
      const refusal = clearAskRefusal(clear, { kind });
      expect(refusal).toMatchObject({ code: CODE });
      expect(refusal!.why).toContain(`no ${kind}`);
      expect(refusal!.why).toContain(HERM_REFUSAL.wikiNeverSaves.cure);
      expect(refusal!.why).not.toMatch(/\b(is|are|was|were|be|been|being|am)\b/i);
    }
  });

  test("the code follows the table: it reads herm-wiki-never-saves as the table stands", () => {
    expect(CODE).toBe("herm-wiki-never-saves");
  });
});

describe("the floor stamps", () => {
  test("a pick speaks one of the two stamps the ruling names", () => {
    expect(Object.values(CLEAR_FLOOR_STAMP).sort()).toEqual(["carried-unaccepted", "genesis"]);
    expect(clearFloorPick({ genesis: null, carriedHead: null }).stamp).toBe(CLEAR_FLOOR_STAMP.genesis);
  });
});
