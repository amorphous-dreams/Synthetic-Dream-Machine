/**
 * build-plugin-tiddler.ts — single TW5 plugin build pipeline:
 *
 *   1. Vite compiles plugin-owned TS sources → tiddlers/src/*.js
 *      (native TW5 header comments embedded). This step alone never patches the
 *      bags/lararium/tw5 anchor memes — `scripts/sync-heleuma.ts` (the package's
 *      own `build` script chains it after this file) reads those generated JS
 *      tiddlers and re-stamps the anchors' `source-sha256`, without duplicating
 *      JS bodies into bags/.
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

import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI, sha256HexSync } from "@lararium/mesh";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, cpSync, copyFileSync } from "fs";
import { spawnSync } from "child_process";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { MODULE_MANIFEST, SOURCE_MANIFEST, TIDDLERS_DIR } from "../vite.plugin.config.js";
import { readModuleManifest, type ModuleManifest } from "../plugin-build/module-manifest.js";
import {
  buildPluginSourceManifest,
  readPluginSourceManifest,
  writePluginSourceManifest,
  type PluginSourceManifest,
} from "../plugin-build/source-manifest.js";
import {
  verifyPackedStaticTiddlers,
  verifyPluginInfoTitle,
} from "../plugin-build/verify-packed-plugin.js";
import {
  computeInputRootSha256,
  PACK_TRANSCRIPT_FORMAT,
  resolveTw5Version,
  writePackTranscript,
} from "../plugin-build/pack-transcript.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, "..");
const REPO_ROOT  = path.resolve(ROOT, "../..");
const OUT_DIR    = path.join(ROOT, "dist-plugin");
const PLUGIN_DIR = path.join(ROOT, "plugins");
// The `$:/` drag-and-drop variant is a first-class distribution (operator ruling,
// 2026-10-04): the stock-TW5 copy a plain TiddlyWiki drops the plugin into, so it
// stays tracked here rather than inside the gitignored dist-plugin/ intermediates dir.
const STANDALONE_DIR = path.join(PLUGIN_DIR, "standalone");

const PLUGIN_TITLE_LAR = LARES_MEMETIC_WIKITEXT_PLUGIN_URI;
const PLUGIN_TITLE_TW5 = "$:/plugins/lares/memetic-wikitext";

// The TW5 CLI from the SUBMODULE (workspace-linked `tiddlywiki`), resolved via the package — robust
// to the workspace link, no .pnpm path guessing. tiddlywiki.js carries a `#!/usr/bin/env node` shebang.
const TW5_BIN = createRequire(import.meta.url).resolve("tiddlywiki/tiddlywiki.js");

/** sha256 — local alias to sha256HexSync from @lararium/mesh (build-time only). */
const sha256 = sha256HexSync;

function parsePackedTiddlers(pluginTiddler: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const innerParsed = JSON.parse(pluginTiddler["text"] as string) as {
    tiddlers?: Record<string, Record<string, unknown>>;
  };
  return innerParsed.tiddlers ?? {};
}

function verifyPackedPluginAgainstSourceManifest(
  pluginTiddler: Record<string, unknown>,
  sourceManifest: PluginSourceManifest,
): void {
  verifyPluginInfoTitle(sourceManifest, PLUGIN_TITLE_LAR);
  verifyPackedStaticTiddlers(sourceManifest, parsePackedTiddlers(pluginTiddler));
  console.log(`[plugin-build] verified ${sourceManifest.staticTiddlers.length} packed static tiddlers (title + fields + body) against source manifest`);
}

function verifyPackedPluginAgainstManifest(
  pluginTiddler: Record<string, unknown>,
  manifest: ModuleManifest,
): void {
  if (pluginTiddler["title"] !== PLUGIN_TITLE_LAR) {
    throw new Error(
      `[plugin-build] packed plugin title mismatch: expected ${PLUGIN_TITLE_LAR}, got ${String(pluginTiddler["title"])}`,
    );
  }
  const tiddlers = parsePackedTiddlers(pluginTiddler);
  const failures: string[] = [];

  for (const mod of manifest.modules) {
    const packed = tiddlers[mod.title];
    if (!packed) {
      failures.push(`missing module tiddler ${mod.title} (${mod.sourcePath})`);
      continue;
    }
    if (packed["type"] !== "application/javascript") {
      failures.push(`${mod.title}: type=${String(packed["type"])} expected application/javascript`);
    }
    if (packed["module-type"] !== mod.moduleType) {
      failures.push(`${mod.title}: module-type=${String(packed["module-type"])} expected ${mod.moduleType}`);
    }
    const packedText = String(packed["text"] ?? "");
    const packedSha = sha256(packedText);
    if (packedSha !== mod.sha256) {
      failures.push(`${mod.title}: sha256=${packedSha} expected ${mod.sha256}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`[plugin-build] packed plugin failed module-manifest verification:\n  ${failures.join("\n  ")}`);
  }
  console.log(`[plugin-build] verified ${manifest.modules.length} packed module tiddlers against manifest`);
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
  const moduleManifest = readModuleManifest(path.join(ROOT, MODULE_MANIFEST));
  const sourceManifestPath = path.join(ROOT, SOURCE_MANIFEST);
  writePluginSourceManifest(
    sourceManifestPath,
    buildPluginSourceManifest(moduleManifest.manifest, moduleManifest.sha256),
  );
  const sourceManifest = readPluginSourceManifest(sourceManifestPath);

  // 2. Pack via TW5 CLI.
  //    Run TW5 from a temp dir so any side-effect writes go there, not into our
  //    source tree. ++ with an absolute path loads tiddlers/ as a plugin folder.
  console.log("[plugin-build] packing plugin via TW5 CLI…");
  const tw5Tmp = mkdtempSync(path.join(tmpdir(), "tw5-pack-"));
  const tw5PluginCopy = path.join(tw5Tmp, "plugin");
  const packArgs = [
    `++${tw5PluginCopy}`,
    "--render",
    "$:/core/templates/exporters/JsonFile",
    "plugin.json",
    "text/plain",
    "",
    "exportFilter",
    `[[${PLUGIN_TITLE_LAR}]]`,
  ];
  let outputJson: string;
  let inputRootSha256: string;
  let exportedPluginSha256: string;
  try {
    cpSync(path.join(ROOT, TIDDLERS_DIR), tw5PluginCopy, { recursive: true });
    // Capture input tree digest before TW5 transforms anything.
    inputRootSha256 = computeInputRootSha256(tw5PluginCopy);
    const renderResult = spawnSync(TW5_BIN, packArgs, { cwd: tw5Tmp, stdio: "inherit" });
    if (renderResult.status !== 0) {
      console.error("[plugin-build] TW5 render failed");
      process.exit(renderResult.status ?? 1);
    }
    outputJson = readFileSync(path.join(tw5Tmp, "output", "plugin.json"), "utf8");
    // Capture exported JSON digest before field augmentation — proves TW5 output.
    exportedPluginSha256 = sha256(outputJson);
  } finally {
    rmSync(tw5Tmp, { recursive: true, force: true });
  }

  // 3a. Write pack transcript before verification so failures are still auditable.
  const TRANSCRIPT_PATH = "dist-plugin/pack-transcript.json";
  const transcriptAbsPath = path.join(ROOT, TRANSCRIPT_PATH);
  const tw5Version = resolveTw5Version(ROOT);
  writePackTranscript(transcriptAbsPath, {
    format: PACK_TRANSCRIPT_FORMAT,
    generatedBy: "packages/lararium-tw5/scripts/build-plugin-tiddler.ts",
    tw5BinPath: path.relative(REPO_ROOT, TW5_BIN),
    tw5PackageVersion: tw5Version,
    // Replace ephemeral temp path with stable placeholder — content proved by inputRootSha256.
    packArgs: packArgs.map((a) => a.startsWith("++") ? "++{tmpInput}" : a),
    inputRootSha256,
    exportedPluginSha256,
  });
  const transcriptText = readFileSync(transcriptAbsPath, "utf8");
  const transcriptSha256 = sha256(transcriptText);
  console.log(`[plugin-build] pack transcript: ${TRANSCRIPT_PATH} (sha256=${transcriptSha256.slice(0, 16)}…)`);

  const tiddlerArray = JSON.parse(outputJson) as Record<string, unknown>[];
  if (!tiddlerArray.length) {
    console.error("[plugin-build] TW5 exported 0 tiddlers — check plugin title in plugin.info");
    process.exit(1);
  }
  const pluginTiddlerLar = tiddlerArray[0]!;
  verifyPackedPluginAgainstSourceManifest(pluginTiddlerLar, sourceManifest.manifest);
  verifyPackedPluginAgainstManifest(pluginTiddlerLar, moduleManifest.manifest);
  Object.assign(pluginTiddlerLar, {
    "lares-canonical-title":          PLUGIN_TITLE_LAR,
    "lares-module-count":             String(moduleManifest.manifest.modules.length),
    "lares-module-manifest-sha256":   moduleManifest.sha256,
    "lares-source-manifest-sha256":   sourceManifest.sha256,
    "lares-build-attestation-format": "lararium-tw5-plugin-build/v1",
  });
  const innerParsed = JSON.parse(pluginTiddlerLar["text"] as string) as { tiddlers?: Record<string, unknown> };
  const tiddlerCount = Object.keys(innerParsed.tiddlers ?? {}).length;

  // 3. Emit two title variants (lar:// canonical + $:// drag-and-drop).
  // The $:/ variant is a PROJECTION of the lar:// canonical artifact: `lares-projection-of`
  // names that canonical title. It would otherwise inherit `lares-canonical-title` from the
  // spread carrying the SAME value — one relation, one name, so that field is dropped here
  // rather than kept alongside its replacement. (The lar:// tiddler itself keeps
  // `lares-canonical-title` as its own self-identification; that is a different relation —
  // naming itself, not projecting from something else.)
  const pluginTiddlerTw5: Record<string, unknown> = {
    ...pluginTiddlerLar,
    title: PLUGIN_TITLE_TW5,
    "lares-projection-of": PLUGIN_TITLE_LAR,
  };
  delete pluginTiddlerTw5["lares-canonical-title"];

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

  const pluginLarJson = JSON.stringify(pluginTiddlerLar, null, 2);
  const pluginTw5Json = JSON.stringify(pluginTiddlerTw5, null, 2);
  writeFileSync(path.join(OUT_DIR, "lares-memetic-wikitext.lar.json"), pluginLarJson, "utf8");
  writeFileSync(path.join(OUT_DIR, "lares-memetic-wikitext.json"),     pluginTw5Json, "utf8");
  const pluginJsonSha = sha256(pluginLarJson);
  const pluginTw5Sha  = sha256(pluginTw5Json);
  const attestation = {
    format: "lararium-tw5-plugin-build/v1",
    canonicalTitle: PLUGIN_TITLE_LAR,
    compatibilityTitle: PLUGIN_TITLE_TW5,
    moduleManifestPath: MODULE_MANIFEST,
    moduleManifestSha256: moduleManifest.sha256,
    sourceManifestPath: SOURCE_MANIFEST,
    sourceManifestSha256: sourceManifest.sha256,
    packTranscriptPath: TRANSCRIPT_PATH,
    packTranscriptSha256: transcriptSha256,
    moduleCount: moduleManifest.manifest.modules.length,
    packedTiddlerCount: tiddlerCount,
    pluginJsonSha256: pluginJsonSha,
    // The standalone ($:/) distribution's own digest — same inner tiddlers, title +
    // `lares-canonical-title`/`lares-projection-of` swapped. Lets a verifier check the committed
    // plugins/standalone/ artifact without re-deriving the lar:// one first.
    pluginTw5Sha256: pluginTw5Sha,
  };
  writeFileSync(
    path.join(OUT_DIR, "lares-memetic-wikitext.attestation.json"),
    JSON.stringify(attestation, null, 2) + "\n",
    "utf8",
  );

  const tsHeader  = `/* eslint-disable */\n// AUTO-GENERATED by scripts/build-plugin-tiddler.ts — do not edit.\n// Regenerate via: pnpm --filter @lararium/tw5 build:plugin\n\n`;
  const tsBody    = `export const LARES_MEMETIC_WIKITEXT_PLUGIN = ${JSON.stringify(pluginTiddlerLar, null, 2)} as const;\n`;
  const tsSrcPath = path.join(ROOT, "src", "plugin-tiddler.generated.ts");
  writeFileSync(tsSrcPath, tsHeader + tsBody, "utf8");

  // Copy canonical JSON to plugins/ so automerge-docs picks it up alongside
  // sq-streams and lararium-boot-shadows.
  const pluginJsonDest = path.join(PLUGIN_DIR, "lares-memetic-wikitext.json");
  copyFileSync(path.join(OUT_DIR, "lares-memetic-wikitext.lar.json"), pluginJsonDest);

  // Track the `$:/` standalone distribution alongside the lar:// canonical copy — it is
  // the stock-TW5 artifact a plain TiddlyWiki drag-and-drops, not an intermediate, so it
  // lives outside the gitignored dist-plugin/. CI's currency gate rebuilds and diffs this.
  mkdirSync(STANDALONE_DIR, { recursive: true });
  const standaloneTidDest = path.join(STANDALONE_DIR, "lares-memetic-wikitext.tid");
  const standaloneAttestationDest = path.join(STANDALONE_DIR, "lares-memetic-wikitext.attestation.json");
  copyFileSync(tidTw5.path, standaloneTidDest);
  copyFileSync(path.join(OUT_DIR, "lares-memetic-wikitext.attestation.json"), standaloneAttestationDest);

  console.log(`✓ wrote ${tidLar.path} (${(tidLar.bytes / 1024).toFixed(1)} KiB) — lararium VM canonical`);
  console.log(`✓ wrote ${tidTw5.path} (${(tidTw5.bytes / 1024).toFixed(1)} KiB) — vanilla TW5 drag-and-drop`);
  console.log(`✓ wrote ${tsSrcPath}`);
  console.log(`✓ wrote ${pluginJsonDest} — automerge-docs pickup`);
  console.log(`✓ wrote ${standaloneTidDest} + ${standaloneAttestationDest} — tracked standalone distribution`);
  console.log(`✓ attested modules=${moduleManifest.manifest.modules.length} module-manifest=${moduleManifest.sha256.slice(0, 16)}… source-manifest=${sourceManifest.sha256.slice(0, 16)}… plugin=${pluginJsonSha.slice(0, 16)}… tw5-plugin=${pluginTw5Sha.slice(0, 16)}…`);
  console.log(`  ${tiddlerCount} inner tiddlers packed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
