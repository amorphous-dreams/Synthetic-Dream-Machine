/**
 * build-plugin-tiddler.ts — single TW5 plugin build pipeline:
 *
 *   1. Vite compiles plugin-owned TS sources → tiddlers/src/*.js
 *      (native TW5 header comments embedded)
 *      Anchor memes in bags/@lararium/tw5 get body-sha256 patched from those
 *      generated JS tiddlers, without duplicating JS bodies into bags/.
 *   2. TW5 CLI packs src/tiddlers/ into a complete plugin tiddler JSON:
 *        tiddlywiki ++./src/tiddlers \
 *          --render "$:/core/templates/exporters/JsonFile" \
 *          "plugin.json" "text/plain" "" \
 *          "exportFilter" "[[<plugin-title>]]"
 *      Output: JSON array [{all fields including plugin.info metadata + packed text}]
 *   3. Emit dist-plugin/ artifacts + plugin-tiddler.generated.ts.
 *
 * tiddlers/ is the plugin source island:
 *   - plugin.info   — plugin envelope metadata (committed)
 *   - *.tid         — hand-authored tiddlers (committed)
 *   - src/*.js      — generated CJS module tiddlers (built by Vite)
 */

import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, cpSync, copyFileSync, existsSync } from "fs";
import { spawnSync } from "child_process";
import { createHash } from "crypto";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { PLUGIN_ENTRIES, TIDDLERS_DIR, TIDDLER_SRC_DIR } from "../vite.plugin.config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, "..");
const REPO_ROOT  = path.resolve(ROOT, "../..");
const OUT_DIR    = path.join(ROOT, "dist-plugin");
const PLUGIN_DIR = path.join(ROOT, "plugins");
const BAG_ROOT   = path.join(REPO_ROOT, "bags", "@lararium", "tw5");

const PLUGIN_TITLE_LAR = "lar:///plugins/lares/memetic-wikitext";
const PLUGIN_TITLE_TW5 = "$:/plugins/lares/memetic-wikitext";

const TW5_BIN = path.join(ROOT, "../../node_modules/.pnpm/node_modules/.bin/tiddlywiki");

const SHA_FIELD_RE  = /^body-sha256\s*=\s*"[^"]*"/m;
const TOML_BLOCK_RE = /(```toml[\s\S]*?```)/;

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function patchSha256(meme: string, digest: string): string {
  const tomlM = TOML_BLOCK_RE.exec(meme);
  if (!tomlM) throw new Error("root toml iam block not found");
  const tomlOrig = tomlM[1]!;
  const patched  = SHA_FIELD_RE.test(tomlOrig)
    ? tomlOrig.replace(SHA_FIELD_RE, `body-sha256 = "${digest}"`)
    : tomlOrig.replace(/(\n```)$/, `\nbody-sha256 = "${digest}"$1`);
  return meme.replace(tomlOrig, patched);
}

function patchAnchorHashes(): void {
  console.log("[plugin-build] patching anchor body-sha256 fields…");
  let patched = 0;
  for (const entry of PLUGIN_ENTRIES) {
    if (!entry.anchor) continue;
    const jsPath = path.join(ROOT, TIDDLER_SRC_DIR, `${entry.name}.js`);
    const anchorPath = path.join(BAG_ROOT, entry.anchor);
    if (!existsSync(jsPath) || !existsSync(anchorPath)) continue;
    const cjs = readFileSync(jsPath, "utf8").trimEnd();
    const digest = sha256(cjs);
    const next = patchSha256(readFileSync(anchorPath, "utf8"), digest);
    writeFileSync(anchorPath, next, "utf8");
    patched++;
    console.log(`  ${entry.anchor}  body-sha256=${digest.slice(0, 16)}…`);
  }
  console.log(`[plugin-build] patched ${patched} anchor hashes`);
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  // 1. Compile TS sources → tiddlers/src/*.js (with embedded TW5 header comments).
  console.log("[plugin-build] running Vite build…");
  const viteResult = spawnSync("npx", ["tsx", "vite.plugin.config.ts"], {
    cwd: ROOT, stdio: "inherit",
  });
  if (viteResult.status !== 0) {
    console.error("[plugin-build] Vite build failed");
    process.exit(viteResult.status ?? 1);
  }

  // 2. Patch anchor hashes from generated JS bodies.
  patchAnchorHashes();

  // 3. Pack via TW5 CLI.
  //    Run TW5 from a temp dir so any side-effect writes go there, not into our
  //    source tree. ++ with an absolute path loads tiddlers/ as a plugin folder.
  console.log("[plugin-build] packing plugin via TW5 CLI…");
  const tw5Tmp = mkdtempSync(path.join(tmpdir(), "tw5-pack-"));
  const tw5PluginCopy = path.join(tw5Tmp, "plugin");
  let outputJson: string;
  try {
    cpSync(path.join(ROOT, TIDDLERS_DIR), tw5PluginCopy, { recursive: true });
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

  // 4. Emit two title variants (lar:// canonical + $:// drag-and-drop).
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

  // Copy canonical JSON to plugins/ so automerge-docs picks it up alongside
  // sq-streams and lararium-boot-shadows.
  const pluginJsonDest = path.join(PLUGIN_DIR, "lares-memetic-wikitext.json");
  copyFileSync(path.join(OUT_DIR, "lares-memetic-wikitext.lar.json"), pluginJsonDest);

  console.log(`✓ wrote ${tidLar.path} (${(tidLar.bytes / 1024).toFixed(1)} KiB) — lararium VM canonical`);
  console.log(`✓ wrote ${tidTw5.path} (${(tidTw5.bytes / 1024).toFixed(1)} KiB) — vanilla TW5 drag-and-drop`);
  console.log(`✓ wrote ${tsSrcPath}`);
  console.log(`✓ wrote ${pluginJsonDest} — automerge-docs pickup`);
  console.log(`  ${tiddlerCount} inner tiddlers packed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
