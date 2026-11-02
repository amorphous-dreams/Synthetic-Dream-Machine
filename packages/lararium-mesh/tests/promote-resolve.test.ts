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
    expect(withHook).toEqual({ ok: true, pluginCids: [...(base as { pluginCids: string[] }).pluginCids, digest] });
  });

  test("RED: a promoted digest whose bytes the store lacks or holds corrupt refuses by name; CONTROL: sound bytes pass", async () => {
    const missing = await resolveRecipePluginCids(recipe("field-notes"), { ...inputs(new Map()), promoted: async () => [digest] });
    expect(missing.ok).toBe(false);
    expect(JSON.stringify(missing)).toContain("promoted");
    const corrupt = await resolveRecipePluginCids(recipe("field-notes"), { ...inputs(new Map([[digest, new TextEncoder().encode("evil")]])), promoted: async () => [digest] });
    expect(corrupt.ok).toBe(false);
    expect((await resolveRecipePluginCids(recipe("field-notes"), { ...inputs(new Map([[digest, bytes]])), promoted: async () => [digest] })).ok).toBe(true);
  });
});
