/**
 * wiki-switch-remount.test.ts — the operator's remount clears a grain's mount-failure streak.
 *
 * Three failed mounts cap the grain (no clock reopens it). The operator's `wiki-switch` carrying `remount`
 * forgets the streak, so the mount tries afresh. CONTROL: the same verb without `remount` (the dispatcher's
 * automatic mount for a wiki-act) leaves the cap standing.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/vessel-island-pool-core
 */
import { describe, test, expect, afterEach } from "vitest";
import { makeWikiActivationCap, type WikiMountSpec } from "@lararium/mesh";
import { VesselIslandPool } from "../src/vessel-island-pool.js";
import { wikiSwitchVerb } from "../src/wiki-switch-verb.js";

const SILENT_FIXTURE_URL = new URL("./fixtures/silent-island.mjs", import.meta.url);
const WIKI_ID = "lar:///ha.ka.ba/bags/test/wiki";
const NO_OFFERINGS = async () => ({ ok: true as const, pluginCids: [] });
const spec = (): WikiMountSpec => ({ coreHash: null, recipe: { wikiSlug: "test" }, grants: { islandUrl: "automerge:fixture-lararium-url", wikiUrl: null } });

describe("wiki-switch — the operator's remount", () => {
  let pool: VesselIslandPool | null = null;
  afterEach(async () => { await pool?.disposeAll(); pool = null; });

  function stand() {
    pool = new VesselIslandPool({ caps: {}, workerScriptUrl: SILENT_FIXTURE_URL, mountSilenceMs: 150, maxMountFailures: 3, resolvePluginCids: NO_OFFERINGS });
    pool.registerSpec(WIKI_ID, spec());
    const p = pool;
    const activation = makeWikiActivationCap({ touch: async (url) => { await p.ensureWiki(url); }, pin: async () => {}, unpin: () => {} }, p, { activationCap: 4, pinBudget: 2 });
    return { p, activation };
  }

  test("RED: three failures cap the grain; an operator remount re-opens it", async () => {
    const { p, activation } = stand();
    for (let i = 0; i < 3; i++) await expect(wikiSwitchVerb({ slug: WIKI_ID }, { activation, pool: p })).rejects.toThrow(/timeout waiting for ea/);
    await expect(wikiSwitchVerb({ slug: WIKI_ID }, { activation, pool: p })).rejects.toThrow(/mount intensity cap/);
    await expect(wikiSwitchVerb({ slug: WIKI_ID, remount: true }, { activation, pool: p })).rejects.toThrow(/timeout waiting for ea/);
  }, 20_000);

  test("CONTROL: an automatic retry (no remount) does not clear the cap", async () => {
    const { p, activation } = stand();
    for (let i = 0; i < 3; i++) await expect(wikiSwitchVerb({ slug: WIKI_ID }, { activation, pool: p })).rejects.toThrow(/timeout waiting for ea/);
    for (let i = 0; i < 2; i++) await expect(wikiSwitchVerb({ slug: WIKI_ID, remount: false }, { activation, pool: p })).rejects.toThrow(/mount intensity cap/);
  }, 20_000);
});
