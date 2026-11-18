import { describe, expect, test } from "vitest";
import { CompositeStore, KAHUA_BAG, ORACLE_BAG, daemonFaceCanonBag, expandRecipe, kahuaRecipe, recipeLayerIndex, wikiBagUri, wikiSlotUri, type LarTiddlerStore, type SlotUri, type WikiRecipe } from "../src/index.js";

const F = "0b1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8";
const recipe: WikiRecipe = kahuaRecipe({ wikiSlug: "daemon", canonBag: daemonFaceCanonBag(F) });
/** A layer that holds nothing: the index reads the cascade's order alone. */
const empty = (): LarTiddlerStore => ({ subscribe: () => () => undefined, listVisible: async () => [] }) as unknown as LarTiddlerStore;
const mount = (composite: CompositeStore, slot: SlotUri, at?: number): void =>
  composite.addLayer({ bagId: slot, store: empty(), writable: true, defaultWritable: false }, at);

describe("recipeLayerIndex — a slot mounted late seats where the recipe orders it", () => {
  test("the working layer, attached before the face canon mounts, still stands above the kahua stage", () => {
    // The boot lays what it holds bottom-up: the floor, the daemon document, the kahua stage, the temp slot. The face canon is
    // not there yet (it mounts after ea), so an index read off the canon alone would seat working at the floor's foot.
    const composite = new CompositeStore();
    for (const slot of [ORACLE_BAG, wikiBagUri("daemon"), KAHUA_BAG, wikiSlotUri("daemon", "temp")] as SlotUri[]) mount(composite, slot);
    const working = wikiSlotUri("daemon", "working");
    mount(composite, working, recipeLayerIndex(composite, recipe, working));
    expect(composite.layerIndexOf(working)).toBeGreaterThan(composite.layerIndexOf(KAHUA_BAG));
    expect(composite.layerIndexOf(working)).toBeLessThan(composite.layerIndexOf(wikiSlotUri("daemon", "temp")));
    // The canon mounting later seats between working and the kahua stage; the edit slots seat above working.
    for (const slot of [daemonFaceCanonBag(F), wikiSlotUri("daemon", "personal"), wikiSlotUri("daemon", "draft")] as SlotUri[]) mount(composite, slot, recipeLayerIndex(composite, recipe, slot));
    const want = expandRecipe(recipe).filter((slot) => composite.hasBag(slot)).reverse();
    expect(composite.layerIds).toEqual(want);
  });

  test("a slot with nothing of its recipe beneath it seats at the foot", () => {
    const composite = new CompositeStore();
    mount(composite, wikiSlotUri("daemon", "temp"));
    expect(recipeLayerIndex(composite, recipe, wikiSlotUri("daemon", "working"))).toBe(0);
  });
});
