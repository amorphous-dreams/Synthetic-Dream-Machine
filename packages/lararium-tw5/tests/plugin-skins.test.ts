/**
 * plugin-skins — the grammar and the house ride two plugins, and the cut runs one way.
 *
 * The packed grammar (`plugins/lares-memetic-wikitext.json`) holds no house module and no grammar module of it requires one;
 * the packed house (`plugins/lares-lararium.json`) holds every house module and names the grammar as the plugin it depends on;
 * every packed module rides a skin the membership table classes (`plugin-build/skins.ts`), so a new module never drifts in
 * unsorted. A wiki booted with both skins resolves a route and the oracle widget; a wiki booted with the grammar alone still
 * parses a meme and holds no route.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/wave/three-skins-two-roads
 */

import { describe, test, expect, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LARES_LARARIUM_PLUGIN_URI, LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "@lararium/mesh";
import { GRAMMAR_MODULES, LARARIUM_MODULES, grammarRequiresHouse } from "../plugin-build/skins.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

type Packed = Record<string, Record<string, string>>;
const pluginAt = (stem: string): string => fileURLToPath(new URL(`../plugins/${stem}.json`, import.meta.url));
const envelopeOf = (stem: string): Record<string, string> => JSON.parse(readFileSync(pluginAt(stem), "utf8")) as Record<string, string>;
const packedOf = (stem: string): Packed => (JSON.parse(envelopeOf(stem)["text"]!) as { tiddlers: Packed }).tiddlers;
const modulesOf = (packed: Packed): string[] => Object.keys(packed).filter((t) => packed[t]!["type"] === "application/javascript" && !t.startsWith("$:/core/"));

const ROUTE = "lar:///ha.ka.ba/lararium/tw5/routes/get-meme";
const ORACLE_WIDGET = "lar:///ha.ka.ba/lararium/tw5/widgets/action-oracle-cast";

describe("two skins: the grammar and the house", () => {
  test("S1: the packed grammar holds no house module, and none of its modules requires one", () => {
    const packed = packedOf("lares-memetic-wikitext");
    const house = modulesOf(packed).filter((t) => LARARIUM_MODULES.includes(t));
    expect(house, "house modules still riding the grammar plugin").toEqual([]);
    const bundles = modulesOf(packed).map((title) => ({ title, text: packed[title]!["text"] ?? "" }));
    expect(grammarRequiresHouse(bundles), "a grammar module requires a house module").toEqual([]);
  });

  test("S2: the packed house holds every house module and depends on the grammar", () => {
    expect(existsSync(pluginAt("lares-lararium")), "plugins/lares-lararium.json stands — run: pnpm --filter @lararium/tw5 build:plugin").toBe(true);
    const envelope = envelopeOf("lares-lararium");
    expect(envelope["title"]).toBe(LARES_LARARIUM_PLUGIN_URI);
    expect(String(envelope["dependents"] ?? "").split(/\s+/), "the house names the grammar it depends on").toContain(LARES_MEMETIC_WIKITEXT_PLUGIN_URI);
    expect(Number(envelope["plugin-priority"]), "the house shadows load over the grammar's").toBeGreaterThan(Number(envelopeOf("lares-memetic-wikitext")["plugin-priority"]));
    const held = modulesOf(packedOf("lares-lararium")).sort();
    expect(held).toEqual([...LARARIUM_MODULES].sort());
    expect(envelope["lares-module-count"]).toBe(String(LARARIUM_MODULES.length));
  });

  test("S3: every packed module rides one classed skin", () => {
    const grammar = modulesOf(packedOf("lares-memetic-wikitext"));
    const house = existsSync(pluginAt("lares-lararium")) ? modulesOf(packedOf("lares-lararium")) : [];
    const unclassed = [...grammar, ...house].filter((t) => !GRAMMAR_MODULES.includes(t) && !LARARIUM_MODULES.includes(t));
    expect(unclassed, "modules no skin classes (plugin-build/skins.ts)").toEqual([]);
    expect(grammar.filter((t) => !GRAMMAR_MODULES.includes(t)), "grammar plugin holds a module classed elsewhere").toEqual([]);
    expect(house.filter((t) => !LARARIUM_MODULES.includes(t)), "house plugin holds a module classed elsewhere").toEqual([]);
  });
});

describe.skipIf(wikiSkip)(`a wiki boots with the skins it loads${skipNote}`, () => {
  let engine: TW5Engine | undefined;
  afterEach(() => { engine?.dispose(); engine = undefined; });
  const modules = (e: TW5Engine) => (e.$tw as unknown as { modules: { titles: Record<string, unknown>; types: Record<string, Record<string, unknown>> } }).modules;

  test("S4: grammar and house booted together resolve a route and the oracle widget", async () => {
    engine = await bootTestWiki();
    const mods = modules(engine);
    expect(mods.titles[ROUTE], "the get-meme route module loads").toBeDefined();
    expect(Object.keys(mods.types["route"] ?? {}), "the route registers").toContain(ROUTE);
    expect(mods.titles[ORACLE_WIDGET], "the oracle widget module loads").toBeDefined();
    expect(Object.keys(mods.types["widget"] ?? {}).some((t) => t === ORACLE_WIDGET), "the oracle widget registers").toBe(true);
    expect(engine.wiki.isShadowTiddler(LARES_LARARIUM_PLUGIN_URI) || Boolean(engine.wiki.getTiddler(LARES_LARARIUM_PLUGIN_URI))).toBe(true);
  }, 120_000);

  test("S5: the grammar alone parses a meme and holds no route", async () => {
    engine = await bootTestWiki({ skins: "grammar" });
    const mods = modules(engine);
    expect(mods.titles["lar:///ha.ka.ba/lararium/tw5/parsers/memetic-parser"], "the parser loads").toBeDefined();
    expect(mods.titles[ROUTE], "no route loads without the house").toBeUndefined();
    expect(mods.titles[ORACLE_WIDGET], "no oracle widget loads without the house").toBeUndefined();
  }, 120_000);
});
