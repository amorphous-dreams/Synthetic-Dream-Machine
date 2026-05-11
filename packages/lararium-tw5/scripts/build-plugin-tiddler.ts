/**
 * build-plugin-tiddler.ts — three-step pipeline:
 *
 *   1. Vite compiles TS plugin sources → src/tiddlers/*.js  (with embedded TW5 header)
 *   2. TW5 CLI packs src/tiddlers/ into a complete plugin tiddler JSON:
 *        tiddlywiki ++./src/tiddlers \
 *          --render "$:/core/templates/exporters/JsonFile" \
 *          "plugin.json" "text/plain" "" \
 *          "exportFilter" "[[<plugin-title>]]"
 *      Output: JSON array [{all fields including plugin.info metadata + packed text}]
 *   3. Emit dist-plugin/ artifacts + plugin-tiddler.generated.ts
 *
 * src/tiddlers/ is the single source of truth:
 *   - plugin.info   — plugin envelope metadata (committed)
 *   - *.tid         — wikitext tiddlers (committed, human-readable)
 *   - *.js          — compiled module tiddlers (gitignored, built by Vite)
 *                     each carries a /*\ ... \*\/ header so TW5 reads
 *                     title + module-type without any .meta sidecar
 *
 * Run:
 *   pnpm --filter @lararium/tw5 build:plugin
 */

import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, cpSync } from "fs";
import { spawnSync } from "child_process";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT    = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "dist-plugin");

const PLUGIN_TITLE_LAR = "lar:///plugins/lares/memetic-wikitext";
const PLUGIN_TITLE_TW5 = "$:/plugins/lares/memetic-wikitext";

const TW5_BIN = path.join(ROOT, "../../node_modules/.pnpm/node_modules/.bin/tiddlywiki");

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  // 1. Compile TS sources → src/tiddlers/*.js (with embedded TW5 header comments).
  console.log("[plugin-build] running Vite build…");
  const viteResult = spawnSync("npx", ["tsx", "vite.plugin.config.ts"], {
    cwd: ROOT, stdio: "inherit",
  });
  if (viteResult.status !== 0) {
    console.error("[plugin-build] Vite build failed");
    process.exit(viteResult.status ?? 1);
  }

  // 2. Pack via TW5 CLI.
  //    Run TW5 from a temp dir so any side-effect writes (tiddlywikicore-*.js etc.)
  //    go there, not into our source tree.
  //    ++ with an absolute path loads src/tiddlers/ as a plugin.
  //    JsonFile exporter + exportFilter variable → complete plugin tiddler JSON.
  console.log("[plugin-build] packing plugin via TW5 CLI…");
  // Copy plugin folder to a temp dir so TW5's side-effect writes
  // (tiddlywikicore-*.js, etc.) never touch the source tree.
  const tw5Tmp = mkdtempSync(path.join(tmpdir(), "tw5-pack-"));
  const tw5PluginCopy = path.join(tw5Tmp, "plugin");
  let outputJson: string;
  try {
    cpSync(path.join(ROOT, "src/tiddlers"), tw5PluginCopy, { recursive: true });
    const renderResult = spawnSync(
      TW5_BIN,
      [
        `++${tw5PluginCopy}`,
        "--render",
        "$:/core/templates/exporters/JsonFile",
        "plugin.json",
        "text/plain",
        "",
        "exportFilter",
        `[[${PLUGIN_TITLE_LAR}]]`,
      ],
      { cwd: tw5Tmp, stdio: "inherit" },
    );
    if (renderResult.status !== 0) {
      console.error("[plugin-build] TW5 render failed");
      process.exit(renderResult.status ?? 1);
    }
    outputJson = readFileSync(path.join(tw5Tmp, "output", "plugin.json"), "utf8");
  } finally {
    rmSync(tw5Tmp, { recursive: true, force: true });
  }
  const tiddlerArray = JSON.parse(outputJson) as Record<string, unknown>[];
  if (!tiddlerArray.length) {
    console.error("[plugin-build] TW5 exported 0 tiddlers — check plugin title in plugin.info");
    process.exit(1);
  }
  const pluginTiddlerLar = tiddlerArray[0]!;
  const innerParsed = JSON.parse(pluginTiddlerLar["text"] as string) as { tiddlers?: Record<string, unknown> };
  const tiddlerCount = Object.keys(innerParsed.tiddlers ?? {}).length;

  // 3. Emit two title variants (lar:// canonical + $:// drag-and-drop).
  const pluginTiddlerTw5 = { ...pluginTiddlerLar, title: PLUGIN_TITLE_TW5 };

  function emitTid(tiddler: Record<string, unknown>, fileName: string): { path: string; bytes: number } {
    const lines: string[] = [];
    for (const [key, val] of Object.entries(tiddler)) {
      if (key === "text") continue;
      if (val === undefined) continue;
      if (typeof val === "string" && val.includes("\n")) continue;
      lines.push(`${key}: ${String(val)}`);
    }
    const content = lines.join("\n") + "\n\n" + ((tiddler["text"] as string | undefined) ?? "");
    const filePath = path.join(OUT_DIR, fileName);
    writeFileSync(filePath, content, "utf8");
    return { path: filePath, bytes: content.length };
  }

  const tidLar = emitTid(pluginTiddlerLar, "lares-memetic-wikitext.lar.tid");
  const tidTw5 = emitTid(pluginTiddlerTw5, "lares-memetic-wikitext.tid");

  writeFileSync(path.join(OUT_DIR, "lares-memetic-wikitext.lar.json"), JSON.stringify(pluginTiddlerLar, null, 2), "utf8");
  writeFileSync(path.join(OUT_DIR, "lares-memetic-wikitext.json"),     JSON.stringify(pluginTiddlerTw5, null, 2), "utf8");

  const tsHeader  = `/* eslint-disable */\n// AUTO-GENERATED by scripts/build-plugin-tiddler.ts — do not edit.\n// Regenerate via: pnpm --filter @lararium/tw5 build:plugin\n\n`;
  const tsBody    = `export const LARES_MEMETIC_WIKITEXT_PLUGIN = ${JSON.stringify(pluginTiddlerLar, null, 2)} as const;\n`;
  const tsSrcPath = path.join(ROOT, "src", "plugin-tiddler.generated.ts");
  writeFileSync(tsSrcPath, tsHeader + tsBody, "utf8");

  console.log(`✓ wrote ${tidLar.path} (${(tidLar.bytes / 1024).toFixed(1)} KiB) — lararium VM canonical`);
  console.log(`✓ wrote ${tidTw5.path} (${(tidTw5.bytes / 1024).toFixed(1)} KiB) — vanilla TW5 drag-and-drop`);
  console.log(`✓ wrote ${tsSrcPath}`);
  console.log(`  ${tiddlerCount} inner tiddlers packed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
