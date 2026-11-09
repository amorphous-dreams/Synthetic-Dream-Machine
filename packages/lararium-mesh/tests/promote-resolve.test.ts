/**
 * promote-resolve — the plugin selection every platform runs unions a wiki's own promoted digests after the offering selection, verifies
 * their bytes in the local store, and asks for no other wiki's rows. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { resolveRecipePluginCids } from "../src/surface-recipe.js";

const bytes = new TextEncoder().encode("{\"title\":\"rites/a\",\"text\":\"x\"}");
const digest = createHash("sha256").update(bytes).digest("hex");
const recipe = (wikiSlug: string) => ({ wikiSlug });
const inputs = (store: Map<string, Uint8Array>) => ({ islandBlobs: undefined, lookup: () => undefined, readBytes: async (cid: string) => store.get(cid) ?? null });

describe("promoted digests join a wiki's plugin selection", () => {
  test("RED: the resolver unions the wiki's promoted digests once, asks for that wiki alone, and keeps the rest of the selection; CONTROL: no hook answers the selection unchanged", async () => {
    const asked: string[] = [];
    const store = new Map([[digest, bytes]]);
    const base = await resolveRecipePluginCids(recipe("field-notes"), inputs(store));
    expect(base.ok).toBe(true);
    const withHook = await resolveRecipePluginCids(recipe("field-notes"), { ...inputs(store), promoted: async (slug) => { asked.push(slug); return [digest, digest]; } });
    expect(asked).toEqual(["field-notes"]);
    expect(withHook).toMatchObject({ ok: true, pluginCids: [...(base as { pluginCids: string[] }).pluginCids, digest] });
  });

  test("RED: a promoted digest whose bytes the store lacks or holds corrupt DROPS out of the union and is reported by name, while the rest of the selection still boots; CONTROL: sound bytes pass, and a failing offering selection keeps the whole-recipe refusal", async () => {
    const voided: Array<{ wiki: string; digests: readonly string[] }> = [];
    const onPromotedVoided = (wiki: string, digests: readonly string[]) => { voided.push({ wiki, digests }); };
    const base = (await resolveRecipePluginCids(recipe("field-notes"), inputs(new Map()))) as { ok: true; pluginCids: string[] };
    const missing = await resolveRecipePluginCids(recipe("field-notes"), { ...inputs(new Map()), promoted: async () => [digest], onPromotedVoided });
    expect(missing).toMatchObject({ ok: true, pluginCids: base.pluginCids, proved: { promoted: [] } });
    const corrupt = await resolveRecipePluginCids(recipe("field-notes"), { ...inputs(new Map([[digest, new TextEncoder().encode("evil")]])), promoted: async () => [digest], onPromotedVoided });
    expect(corrupt).toMatchObject({ ok: true, pluginCids: base.pluginCids });
    expect(voided).toEqual([{ wiki: "field-notes", digests: [digest] }, { wiki: "field-notes", digests: [digest] }]);
    const sound = await resolveRecipePluginCids(recipe("field-notes"), { ...inputs(new Map([[digest, bytes]])), promoted: async () => [digest], onPromotedVoided });
    // The proof names only the digest that passed the byte check (P27: the island floor reads it as a reference).
    expect(sound).toMatchObject({ ok: true, pluginCids: [...base.pluginCids, digest], proved: { promoted: [digest] } });
    expect(voided).toHaveLength(2);
    const offered = await resolveRecipePluginCids({ wikiSlug: "field-notes", pluginOfferings: ["f".repeat(64)] }, { ...inputs(new Map([[digest, bytes]])), promoted: async () => [digest], onPromotedVoided });
    expect(offered.ok).toBe(false);
  });
});
