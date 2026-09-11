import { describe, test, expect } from "vitest";
import { recipeHostFacets, expandRecipe, wikiSlotUri, wikiBagUri, wikiUri, didFromVerifyingKey } from "@lararium/mesh";

// The vessel DID carries one spelling — "0x" + the bare verifying-key hex — on every host.
const DID = didFromVerifyingKey("ab".repeat(32));

// The isomorphic core: one recipe/slug, one set of slot minters, projected two
// ways — recipeHostFacets (VM-free host) and expandRecipe (island cascade) — must
// name identical bags. The bespoke planActiveWikiSlot/ActiveWikiLayerSlot are gone.
describe("wiki host facets ⋈ recipe expansion", () => {
  test("recipeHostFacets splits IDENTITY (wikis/) from CANON (bags/)", () => {
    expect(recipeHostFacets("test-wiki", DID)).toEqual({
      wikiSlug:         "test-wiki",
      wikiKey:          "lar:///ha.ka.ba/wikis/test-wiki",
      wikiBagId:        "lar:///ha.ka.ba/bags/test-wiki",
      draftBagId:       "lar:///ha.ka.ba/wikis/test-wiki/draft",
      draftOracleTitle: `lar:///ha.ka.ba/wikis/test-wiki/drafts/${DID}`,
    });
  });

  test("host facets name the SAME bags the island cascade lays", () => {
    const slug = "test-wiki";
    const facets = recipeHostFacets(slug, DID);
    const slots = expandRecipe({ wikiSlug: slug });
    // The canon the host resolves == the canon slot in the island stack.
    expect(slots).toContain(facets.wikiBagId);
    expect(facets.wikiBagId).toBe(wikiBagUri(slug));
    // The draft layer the host registers == the island's per-wiki draft slot.
    expect(slots).toContain(facets.draftBagId);
    expect(facets.draftBagId).toBe(wikiSlotUri(slug, "draft"));
    // Identity is wikis/, never bags/.
    expect(facets.wikiKey).toBe(wikiUri(slug));
  });

  test("expandRecipe lays the per-wiki live layers above the canon bag", () => {
    const slug = "ember-hall";
    const slots = expandRecipe({ wikiSlug: slug });
    for (const kind of ["temp", "draft", "personal", "working"] as const) {
      expect(slots).toContain(wikiSlotUri(slug, kind));
    }
    // working (live write) sits ABOVE canon (read-only) in the top-wins order.
    expect(slots.indexOf(wikiSlotUri(slug, "working"))).toBeLessThan(slots.indexOf(wikiBagUri(slug)));
  });
});
