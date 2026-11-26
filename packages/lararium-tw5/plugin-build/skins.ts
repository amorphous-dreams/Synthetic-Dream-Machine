/**
 * skins — the two plugin skins the one build packs, and the membership table that routes every module to one of them.
 *
 * THE GRAMMAR (`lares-memetic-wikitext`) holds what every reader of a meme needs: the parser, the wikirules, the deserializer,
 * meme-ast and meme-laws, the grammar cache, the frame and TOML libraries, the addressing filters, the sigil procedures and the
 * cascade templates. Its ratchet turns rarely: a parse change alters every meme's meaning.
 *
 * THE HOUSE (`lares-lararium`) holds what a face-daemon or domain wiki runs: the seven routes, the placement, the face, the
 * backstop and door charm, the root services, the story, the nalu and reaction engines, the in-VM worldline read, wiki-sense,
 * the kahua shadow, the test floor's queue, ddate, the meme fold and the spirit unfold, the widgets and the house config. It requires the grammar; the grammar requires nothing of it, and
 * the build refuses a grammar module whose bundle requires a house title.
 *
 * A module the table does not class refuses the build by name: a new module never drifts into a skin unsorted. Static `.tid`
 * tiddlers class by the island they rest in (`tiddlers/` or `tiddlers-lararium/`). Every module TITLE stays where it stood, so
 * the heleuma anchors that name a module by title never move with the cut.
 *
 * CONTESTED ROWS (the operator's ruling owed) stay in the grammar for now: `modules/meme-project`, `modules/weave` (and their
 * `filters/project`, `filters/meme-pin`), `filters/bag-path` and `modules/import-floor-upgrader`.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/wave/three-skins-two-roads
 */

import { LARES_LARARIUM_PLUGIN_URI, LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "@lararium/mesh/lar-uris";

export type SkinName = "grammar" | "lararium";

export interface PluginSkin {
  readonly name: SkinName;
  /** The canonical `lar:` title the VM loads. */
  readonly title: string;
  /** The `$:/` drag-and-drop title stock TiddlyWiki loads. */
  readonly tw5Title: string;
  /** The file stem every artifact of this skin carries (`plugins/<stem>.json`, `standalone/<stem>.tid`, …). */
  readonly stem: string;
  /** The skin's source island (plugin.info + hand-authored `.tid`), relative to the package root. */
  readonly tiddlersDir: string;
  /** Where Vite writes this skin's CJS module tiddlers. */
  readonly tiddlerSrcDir: string;
  readonly moduleManifest: string;
  readonly sourceManifest: string;
  readonly packTranscript: string;
  /** The export name `plugin-tiddler.generated.ts` binds the packed tiddler to. */
  readonly exportName: string;
  /** The skins this one loads over: the pack boots them beside it (its startups require them) and exports this one alone. */
  readonly dependsOn: readonly PluginSkin[];
}

const TW5 = "lar:///ha.ka.ba/lararium/tw5/";

export const GRAMMAR_SKIN: PluginSkin = Object.freeze({
  name: "grammar",
  title: LARES_MEMETIC_WIKITEXT_PLUGIN_URI,
  tw5Title: "$:/plugins/lares/memetic-wikitext",
  stem: "lares-memetic-wikitext",
  tiddlersDir: "tiddlers",
  tiddlerSrcDir: "tiddlers/src",
  moduleManifest: "dist-plugin/module-manifest.json",
  sourceManifest: "dist-plugin/plugin-source-manifest.json",
  packTranscript: "dist-plugin/pack-transcript.json",
  exportName: "LARES_MEMETIC_WIKITEXT_PLUGIN",
  dependsOn: [],
});

export const LARARIUM_SKIN: PluginSkin = Object.freeze({
  name: "lararium",
  title: LARES_LARARIUM_PLUGIN_URI,
  tw5Title: "$:/plugins/lares/lararium",
  stem: "lares-lararium",
  tiddlersDir: "tiddlers-lararium",
  tiddlerSrcDir: "tiddlers-lararium/src",
  moduleManifest: "dist-plugin/lararium/module-manifest.json",
  sourceManifest: "dist-plugin/lararium/plugin-source-manifest.json",
  packTranscript: "dist-plugin/lararium/pack-transcript.json",
  exportName: "LARES_LARARIUM_PLUGIN",
  dependsOn: [GRAMMAR_SKIN],
});

/** The skins in pack order: the grammar first, since the house depends on it. */
export const PLUGIN_SKINS: readonly PluginSkin[] = Object.freeze([GRAMMAR_SKIN, LARARIUM_SKIN]);

/** The grammar's modules: what every meme reader needs. */
export const GRAMMAR_MODULES: readonly string[] = Object.freeze([
  "parsers/memetic-parser",
  "wikirules/lar-declaration", "wikirules/lar-sigil", "wikirules/lar-sigil-pragma",
  "modules/deserializer", "modules/meme-ast", "modules/meme-laws", "modules/grammar-cache", "modules/carrier-filetype",
  "lib/memetic-frame", "lib/smol-toml",
  "filters/toml-field", "filters/lar-uri", "filters/lar-path", "filters/lar-kind", "filters/lar-refs", "filters/stack", "filters/all-memes",
  // contested (operator ruling owed): render pair, residency addressing, floor import
  "modules/meme-project", "modules/weave", "filters/project", "filters/meme-pin", "filters/bag-path", "modules/import-floor-upgrader",
].map((rest) => `${TW5}${rest}`));

/** The house's modules: what a face-daemon or domain wiki runs. */
export const LARARIUM_MODULES: readonly string[] = Object.freeze([
  "routes/get-meme", "routes/put-meme", "routes/delete-meme", "routes/list-memes",
  "routes/native-door", "routes/native-skinny-door", "routes/native-delete-door",
  "modules/place-meme", "modules/meme-face", "modules/meme-backstop", "modules/meme-door-charm", "modules/lar-root-services",
  "modules/host-globals", "modules/lar-story", "modules/lararium-writable", "modules/draft-compare",
  "modules/nalu-engine", "modules/reaction-router", "modules/worldline-read-vm",
  "modules/wiki-sense-indexer", "lib/wiki-sense-fold", "filters/wikisense", "filters/kahua-shadow", "filters/meme-fold", "filters/floor-queue", "filters/security-class",
  "filters/afford", "modules/afford-face",
  "macros/ddate", "macros/spirit-unfold",
  "widgets/action-oracle-cast", "widgets/action-meme-place",
].map((rest) => `${TW5}${rest}`));

const GRAMMAR_SET = new Set(GRAMMAR_MODULES);
const LARARIUM_SET = new Set(LARARIUM_MODULES);

/** The skin a module title rides; refuses a title the table does not class, or classes twice. */
export function skinOfModule(title: string, sourcePath = title): PluginSkin {
  const g = GRAMMAR_SET.has(title), l = LARARIUM_SET.has(title);
  if (g && l) throw new Error(`[plugin-build] ${title} (${sourcePath}) stands in both skins' membership tables; class it once in plugin-build/skins.ts`);
  if (g) return GRAMMAR_SKIN;
  if (l) return LARARIUM_SKIN;
  throw new Error(
    `[plugin-build] module ${title} (${sourcePath}) rides no skin: class it in plugin-build/skins.ts ` +
    `(GRAMMAR_MODULES for what every meme reader needs, LARARIUM_MODULES for what a house runs), then rerun: pnpm --filter @lararium/tw5 build:plugin`,
  );
}

/** The `lar:` titles a module bundle requires (`require("lar:///…")`). */
export function requiredTitlesOf(bundle: string): string[] {
  return [...new Set([...bundle.matchAll(/require\(\s*["'](lar:\/\/\/[^"']+)["']\s*\)/g)].map((m) => m[1]!))].sort();
}

/**
 * THE ONE-WAY CUT: a grammar module requires no house module. Returns one line per breach (empty when the cut holds); the build
 * throws on any, and the skins suite reads the packed grammar the same way.
 */
export function grammarRequiresHouse(bundles: ReadonlyArray<{ readonly title: string; readonly text: string }>): string[] {
  const breaches: string[] = [];
  for (const { title, text } of bundles) {
    if (!GRAMMAR_SET.has(title)) continue;
    for (const req of requiredTitlesOf(text)) {
      if (LARARIUM_SET.has(req)) breaches.push(`${title} requires the house module ${req}`);
    }
  }
  return breaches;
}
