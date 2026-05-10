/**
 * build-plugin-tiddler.ts — wrap Vite's per-module CJS bundles into a
 * single `$:/plugins/lares/memetic-wikitext` plugin tiddler artifact.
 *
 * Output: `dist-plugin/lares-memetic-wikitext.tid` (drag-and-drop into
 * any TW5 5.4+ wiki).
 *
 * **Plugin tiddler shape (per TW5 5.4 plugin spec):**
 *
 *   title:        $:/plugins/lares/memetic-wikitext
 *   plugin-type:  plugin
 *   author:       lares
 *   name:         memetic-wikitext
 *   description:  ...
 *   version:      <semver>
 *   core-version: ">=5.4.0"
 *   list:         readme
 *   type:         application/json
 *   text:         {"tiddlers": {<title>: {<fields>}, ...}}
 *
 * **What gets bundled into `tiddlers`:**
 *   - Compiled module tiddlers (JS) with `module-type` fields. TW5's
 *     boot loader registers them via `$tw.modules.define(title, type,
 *     source)`.
 *   - Cascade configs ($:/config/Lar/AhuTemplate/...) that select the
 *     active markdown-meme template at render time.
 *   - Template tiddlers (lar:///ha.ka.ba/@lararium/templates/...) that
 *     emit the canonical disk form for ahu slots.
 *   - The `<$lar-meme-split>` global mount.
 *   - A README tiddler for the TW5 control panel.
 *
 * Run:
 *   pnpm --filter @lararium/tw5 build:plugin
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const OUT_DIR   = path.join(ROOT, "dist-plugin");
const PLUGIN_TITLE = "$:/plugins/lares/memetic-wikitext";
const PLUGIN_VERSION = "0.1.0";

// Match `vite.plugin.config.ts::PLUGIN_ENTRIES` — keep in sync.
const MODULE_ENTRIES: Array<{
  bundleFile: string;
  tiddlerTitle: string;
  moduleType:   string;
}> = [
  {
    bundleFile:   "memetic-wikitext-sigil.cjs.js",
    tiddlerTitle: `${PLUGIN_TITLE}/wikirules/memetic-wikitext-sigil.js`,
    moduleType:   "wikirule",
  },
  {
    bundleFile:   "ahu.cjs.js",
    tiddlerTitle: `${PLUGIN_TITLE}/widgets/ahu.js`,
    moduleType:   "widget",
  },
  {
    bundleFile:   "lar-meme-split.cjs.js",
    tiddlerTitle: `${PLUGIN_TITLE}/widgets/lar-meme-split.js`,
    moduleType:   "widget",
  },
  {
    bundleFile:   "memetic-parser.cjs.js",
    tiddlerTitle: `${PLUGIN_TITLE}/parsers/memetic-parser.js`,
    moduleType:   "parser",
  },
  {
    bundleFile:   "memetic-wikitext-deserializer.cjs.js",
    tiddlerTitle: `${PLUGIN_TITLE}/deserializers/memetic-wikitext.js`,
    moduleType:   "tiddlerdeserializer",
  },
];

interface TiddlerFields {
  readonly title: string;
  readonly text:  string;
  readonly type?: string;
  readonly tags?: string;
  readonly [field: string]: unknown;
}

function moduleTiddler(bundlePath: string, title: string, moduleType: string): TiddlerFields {
  const source = readFileSync(bundlePath, "utf8");
  return {
    title,
    text:          source,
    type:          "application/javascript",
    "module-type": moduleType,
  };
}

/**
 * Wikitext tiddlers shipped alongside the JS modules: cascades, templates,
 * the global mount, the readme. These come from `tw5-widgets.ts` exports
 * to keep the plugin payload aligned with the in-process boot path.
 */
async function dataTiddlers(): Promise<TiddlerFields[]> {
  // Re-import the constants from the source so plugin payload tracks
  // the in-process versions automatically — single source of truth.
  // Using dynamic import + tsx-resolved path keeps the script
  // idiomatic for our pnpm + tsx flow.
  const widgetsSrc = await import(path.resolve(ROOT, "src/tw5-widgets.ts"));
  const tiddlers: TiddlerFields[] = [];

  const constants = [
    "LARARIUM_AHU_CASCADE_HTML",
    "LARARIUM_AHU_CASCADE_MARKDOWN_MEME",
    "LARARIUM_AHU_TEMPLATE_HTML",
    "LARARIUM_AHU_TEMPLATE_MARKDOWN_MEME",
    "LARARIUM_MEME_TEMPLATE_MARKDOWN_MEME",
    "LARARIUM_MEME_SPLIT_MOUNT",
  ];
  for (const name of constants) {
    const value = widgetsSrc[name] as Record<string, unknown> | undefined;
    if (!value || typeof value.title !== "string") {
      console.warn(`[plugin-build] missing or malformed constant ${name} — skipped`);
      continue;
    }
    tiddlers.push(value as unknown as TiddlerFields);
  }

  // README tiddler for the TW5 control panel. Surfaces the plugin's
  // intent to operators dropping it into a vanilla TW5 wiki.
  tiddlers.push({
    title: `${PLUGIN_TITLE}/readme`,
    type:  "text/vnd.tiddlywiki",
    text: [
      "! Memetic-wikitext for TiddlyWiki5",
      "",
      "Drag-and-drop plugin from the [[Lares project|https://github.com/anthropics/lares]] adding the `<<~ ... >>` sigil grammar, ahu-slot child tiddler split, and cascade-routed render templates.",
      "",
      "!! What you get",
      "",
      "* `<<~ ahu #slot >>...<<~/ahu >>` blocks split automatically into child tiddlers on save.",
      "* `text/x-memetic-wikitext` content type with curated rule set (codeblock / dash / commentblock / macrocall stay verbatim).",
      "* Cascade-routed templates for HTML view + markdown-meme disk export.",
      "* `<$lar-meme-split>` global widget keeps the parent ↔ child tiddler graph in sync as you author.",
      "",
      "!! What this plugin does NOT include",
      "",
      "Lararium's CRDT sync, capability layer, peer federation, and disk projector live in a separate package (`@lararium/node`). Drop this plugin into a vanilla wiki for memetic-wikitext authoring + TW5-native export. Install the full Lararium stack for sync + canon promotion ceremonies.",
      "",
      "!! License",
      "",
      "MIT — author memes freely.",
    ].join("\n"),
  });

  return tiddlers;
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  // 1. Compile module sources to bundles via the Vite config.
  console.log("[plugin-build] running Vite library build for plugin modules…");
  const { spawnSync } = await import("child_process");
  const viteResult = spawnSync("npx", ["tsx", "vite.plugin.config.ts"], {
    cwd:   ROOT,
    stdio: "inherit",
  });
  if (viteResult.status !== 0) {
    console.error("[plugin-build] Vite build failed");
    process.exit(viteResult.status ?? 1);
  }

  // 2. Wrap each compiled bundle in a module tiddler envelope.
  const moduleTiddlers = MODULE_ENTRIES.map(({ bundleFile, tiddlerTitle, moduleType }) => {
    const bundlePath = path.join(OUT_DIR, bundleFile);
    return moduleTiddler(bundlePath, tiddlerTitle, moduleType);
  });

  // 3. Pull in template + cascade + mount + readme tiddlers.
  const dataTiddlerList = await dataTiddlers();

  // 4. Compose the plugin envelope.
  const tiddlersDict: Record<string, TiddlerFields> = {};
  for (const t of [...moduleTiddlers, ...dataTiddlerList]) {
    tiddlersDict[t.title] = t;
  }

  const pluginText = JSON.stringify({ tiddlers: tiddlersDict }, null, 0);
  const pluginTiddler: TiddlerFields = {
    title:          PLUGIN_TITLE,
    "plugin-type":  "plugin",
    author:         "lares",
    name:           "memetic-wikitext",
    description:    "Memetic-wikitext sigil grammar + cascade-routed render templates for TiddlyWiki5",
    version:        PLUGIN_VERSION,
    "core-version": ">=5.4.0",
    list:           `${PLUGIN_TITLE}/readme`,
    type:           "application/json",
    text:           pluginText,
  };

  // 5. Emit `.tid` (TW5's standard plain-text tiddler file format).
  // Header lines are `key: value`, blank line, then text content.
  const tidLines: string[] = [];
  for (const [key, val] of Object.entries(pluginTiddler)) {
    if (key === "text") continue;
    if (val === undefined) continue;
    if (typeof val === "string" && val.includes("\n")) continue; // skip multi-line headers (text only)
    tidLines.push(`${key}: ${String(val)}`);
  }
  const tidContent = tidLines.join("\n") + "\n\n" + (pluginTiddler.text ?? "");
  const outPath = path.join(OUT_DIR, "lares-memetic-wikitext.tid");
  writeFileSync(outPath, tidContent, "utf8");

  // 6. Also emit a JSON form for consumers expecting the JSON envelope.
  const jsonPath = path.join(OUT_DIR, "lares-memetic-wikitext.json");
  writeFileSync(jsonPath, JSON.stringify(pluginTiddler, null, 2), "utf8");

  console.log(`✓ wrote ${outPath} (${(tidContent.length / 1024).toFixed(1)} KiB)`);
  console.log(`✓ wrote ${jsonPath}`);
  console.log(`  ${moduleTiddlers.length} module tiddlers + ${dataTiddlerList.length} data tiddlers`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
