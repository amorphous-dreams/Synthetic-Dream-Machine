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
/**
 * Plugin titles live in the `lar:` namespace by default — operator
 * customizations sync through MemeSyncAdaptor's lar:-only filter to
 * peers, so promote ceremonies + browser plugin re-packs don't bug
 * out on $:/-namespace tiddlers that the sync rule skips.
 *
 * For the vanilla-TW5 drag-and-drop artifact, the build also emits a
 * `$:/`-prefixed variant (rewriting only the OUTER plugin envelope
 * title; inner JSON tiddler keys stay at lar://-prefixed names since
 * TW5 doesn't enforce prefix conventions on plugin shadows).
 */
const PLUGIN_TITLE_LAR = "lar:///plugins/lares/memetic-wikitext";
const PLUGIN_TITLE_TW5 = "$:/plugins/lares/memetic-wikitext";
const PLUGIN_VERSION = "0.1.0";

// Match `vite.plugin.config.ts::PLUGIN_ENTRIES` — keep in sync.
const MODULE_ENTRIES: Array<{
  bundleFile: string;
  tiddlerTitle: string;
  moduleType:   string;
}> = [
  {
    bundleFile:   "lar-sigil-block.cjs.js",
    tiddlerTitle: `${PLUGIN_TITLE_LAR}/wikirules/lar-sigil-block.js`,
    moduleType:   "wikirule",
  },
  {
    bundleFile:   "lar-sigil-inline.cjs.js",
    tiddlerTitle: `${PLUGIN_TITLE_LAR}/wikirules/lar-sigil-inline.js`,
    moduleType:   "wikirule",
  },
  {
    bundleFile:   "lar-doctype-comment.cjs.js",
    tiddlerTitle: `${PLUGIN_TITLE_LAR}/wikirules/lar-doctype-comment.js`,
    moduleType:   "wikirule",
  },
  {
    bundleFile:   "ahu.cjs.js",
    tiddlerTitle: `${PLUGIN_TITLE_LAR}/widgets/ahu.js`,
    moduleType:   "widget",
  },
  {
    bundleFile:   "aka.cjs.js",
    tiddlerTitle: `${PLUGIN_TITLE_LAR}/widgets/aka.js`,
    moduleType:   "widget",
  },
  {
    bundleFile:   "pranala-header.cjs.js",
    tiddlerTitle: `${PLUGIN_TITLE_LAR}/widgets/pranala-header.js`,
    moduleType:   "widget",
  },
  {
    bundleFile:   "kau.cjs.js",
    tiddlerTitle: `${PLUGIN_TITLE_LAR}/widgets/kau.js`,
    moduleType:   "widget",
  },
  {
    bundleFile:   "lar-meme-split.cjs.js",
    tiddlerTitle: `${PLUGIN_TITLE_LAR}/widgets/lar-meme-split.js`,
    moduleType:   "widget",
  },
  {
    bundleFile:   "memetic-parser.cjs.js",
    tiddlerTitle: `${PLUGIN_TITLE_LAR}/parsers/memetic-parser.js`,
    moduleType:   "parser",
  },
  {
    bundleFile:   "memetic-wikitext-deserializer.cjs.js",
    tiddlerTitle: `${PLUGIN_TITLE_LAR}/deserializers/memetic-wikitext.js`,
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
    "LARARIUM_AKA_CASCADE_HTML",
    "LARARIUM_AKA_CASCADE_MARKDOWN_MEME",
    "LARARIUM_AKA_TEMPLATE_HTML",
    "LARARIUM_AKA_TEMPLATE_MARKDOWN_MEME",
    "LARARIUM_PRANALA_HEADER_CASCADE_HTML",
    "LARARIUM_PRANALA_HEADER_CASCADE_MARKDOWN_MEME",
    "LARARIUM_PRANALA_HEADER_TEMPLATE_HTML",
    "LARARIUM_PRANALA_HEADER_TEMPLATE_MARKDOWN_MEME",
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
    title: `${PLUGIN_TITLE_LAR}/readme`,
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
      "!! Naming convention",
      "",
      "The plugin uses three intentionally distinct prefixes — each carries semantic weight:",
      "",
      "* `lares/` (project surface) — plugin author + plugin name. Matches the `@lares/cli` npm scope, the canonical `@lares` lar-URI bag scope, the human-facing CLI verb. Operator-facing.",
      "* `lararium/` (engine machinery) — render templates + control-surface mounts. Matches `@lararium/core` and `@lararium/tw5` package scope. Infrastructure-facing.",
      "* `Lar/` (URI-scheme abbreviation) — compact prefix for inline TW5 system tags + configs (`$:/tags/Lar/AhuTemplate`, `$:/config/Lar/MemeticRulesExcept`). Operator-extensible.",
      "",
      "From the cosmology: //lares// = household guardian (the project surface); //lararium// = household shrine (the engine machinery). The Lar prefix abbreviates either as the URI scheme demands.",
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

  // Plugin envelope at the lar:// title — canonical for lararium VMs.
  // Operator customizations to plugin-shadow tiddlers (cascade configs,
  // mount, even bundled module overrides) intersect MemeSyncAdaptor's
  // sync filter and propagate to peers via Automerge. promote ceremony
  // works on lar:-namespaced shadow overrides; browser plugin re-packs
  // sync uniformly.
  const pluginTiddlerLar: TiddlerFields = {
    title:          PLUGIN_TITLE_LAR,
    "plugin-type":  "plugin",
    author:         "lares",
    name:           "memetic-wikitext",
    description:    "Memetic-wikitext sigil grammar + cascade-routed render templates for TiddlyWiki5",
    version:        PLUGIN_VERSION,
    "core-version": ">=5.4.0",
    list:           `${PLUGIN_TITLE_LAR}/readme`,
    type:           "application/json",
    text:           pluginText,
  };

  // Plugin envelope at the $:/ title — drag-and-drop artifact for
  // vanilla TW5 wikis. Same JSON payload (inner tiddler titles stay
  // lar:-prefixed; TW5 registers shadows by their JSON key without
  // enforcing prefix conventions). Only the OUTER envelope title
  // changes.
  const pluginTiddlerTw5: TiddlerFields = {
    ...pluginTiddlerLar,
    title: PLUGIN_TITLE_TW5,
  };

  // 5. Emit two `.tid` artifacts. Header lines `key: value`, blank
  // line, then text content (TW5 plain-text tiddler file format).
  function emitTid(tiddler: TiddlerFields, fileName: string): { path: string; bytes: number } {
    const lines: string[] = [];
    for (const [key, val] of Object.entries(tiddler)) {
      if (key === "text") continue;
      if (val === undefined) continue;
      if (typeof val === "string" && val.includes("\n")) continue;
      lines.push(`${key}: ${String(val)}`);
    }
    const content = lines.join("\n") + "\n\n" + (tiddler.text ?? "");
    const filePath = path.join(OUT_DIR, fileName);
    writeFileSync(filePath, content, "utf8");
    return { path: filePath, bytes: content.length };
  }
  const tidLar = emitTid(pluginTiddlerLar, "lares-memetic-wikitext.lar.tid");
  const tidTw5 = emitTid(pluginTiddlerTw5, "lares-memetic-wikitext.tid");

  // 6. JSON envelopes for tooling that expects the canonical shape.
  const jsonLarPath = path.join(OUT_DIR, "lares-memetic-wikitext.lar.json");
  const jsonTw5Path = path.join(OUT_DIR, "lares-memetic-wikitext.json");
  writeFileSync(jsonLarPath, JSON.stringify(pluginTiddlerLar, null, 2), "utf8");
  writeFileSync(jsonTw5Path, JSON.stringify(pluginTiddlerTw5, null, 2), "utf8");

  // 7. Emit TS module under src/ exporting the lar:// form. The
  // lararium daemon's tw5-vm.ts imports this and pushes the plugin
  // tiddler into TW5's `preloadTiddlers` at boot. Single source of
  // truth for the in-process distribution; the lar:// title makes the
  // plugin envelope itself sync-eligible alongside its shadow overrides.
  const tsHeader = `/* eslint-disable */\n// AUTO-GENERATED by scripts/build-plugin-tiddler.ts — do not edit.\n// Source: vite.plugin.config.ts compiles plugin module sources;\n// build-plugin-tiddler.ts wraps them into this artifact.\n//\n// Regenerate via: pnpm --filter @lararium/tw5 build:plugin\n\n`;
  const tsBody = `export const LARES_MEMETIC_WIKITEXT_PLUGIN = ${JSON.stringify(pluginTiddlerLar, null, 2)} as const;\n`;
  const tsSrcPath = path.join(ROOT, "src", "plugin-tiddler.generated.ts");
  writeFileSync(tsSrcPath, tsHeader + tsBody, "utf8");

  console.log(`✓ wrote ${tidLar.path} (${(tidLar.bytes / 1024).toFixed(1)} KiB) — lararium VM canonical`);
  console.log(`✓ wrote ${tidTw5.path} (${(tidTw5.bytes / 1024).toFixed(1)} KiB) — vanilla TW5 drag-and-drop`);
  console.log(`✓ wrote ${tsSrcPath}`);
  console.log(`  ${moduleTiddlers.length} module tiddlers + ${dataTiddlerList.length} data tiddlers`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
