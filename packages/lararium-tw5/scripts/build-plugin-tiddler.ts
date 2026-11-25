/**
 * build-plugin-tiddler.ts — single TW5 plugin build pipeline, packing TWO SKINS from one tree:
 *
 *   · the GRAMMAR (`lares-memetic-wikitext`, source island `tiddlers/`): parser, wikirules, deserializer, sigils, templates;
 *   · the HOUSE (`lares-lararium`, source island `tiddlers-lararium/`): routes, face, engines, widgets, house config. It
 *     depends on the grammar (plugin.info `dependents`) and the grammar never requires it.
 *
 * `plugin-build/skins.ts` holds the membership table that routes every module to one skin; an unclassed module, or a grammar
 * module requiring a house one, refuses the build.
 *
 *   1. Vite compiles plugin-owned TS sources → each skin's `<island>/src/*.js`
 *      (native TW5 header comments embedded), one module manifest per skin. This step alone never patches the
 *      bags/lararium/tw5 anchor memes — `scripts/sync-heleuma.ts` (the package's
 *      own `build` script chains it after this file) reads those generated JS
 *      tiddlers and re-stamps the anchors' `source-sha256`, without duplicating
 *      JS bodies into bags/. Module titles stay as they stood, so no anchor moves with the cut.
 *   2. TW5 CLI packs each source island into a complete plugin tiddler JSON:
 *        tiddlywiki ++<island> \
 *          --render "$:/core/templates/exporters/JsonFile" \
 *          "plugin.json" "text/plain" "" \
 *          "exportFilter" "[[<plugin-title>]]"
 *      Output: JSON array [{all fields including plugin.info metadata + packed text}]
 *   3. Emit dist-plugin/ artifacts per skin + plugin-tiddler.generated.ts (one export per skin).
 *
 * Each source island holds:
 *   - plugin.info   — plugin envelope metadata (committed)
 *   - *.tid         — hand-authored tiddlers (committed)
 *   - src/*.js      — generated CJS module tiddlers (built by Vite)
 */

import { sha256HexSync, PROJECTION_FILTER, PROJECTION_FILTER_TEXT, projectionFilterTitle, type ProjectionClass } from "@lararium/mesh";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, cpSync, copyFileSync } from "fs";
import { spawnSync } from "child_process";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
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
import { resolveTw5BinLogicalPath, tw5BinMismatch } from "../plugin-build/tw5-bin-path.js";
import { LARARIUM_SKIN, PLUGIN_SKINS, type PluginSkin } from "../plugin-build/skins.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, "..");
const REPO_ROOT  = path.resolve(ROOT, "../..");
const OUT_DIR    = path.join(ROOT, "dist-plugin");
const PLUGIN_DIR = path.join(ROOT, "plugins");
// The `$:/` drag-and-drop variant is a first-class distribution (operator ruling,
// 2026-10-04): the stock-TW5 copy a plain TiddlyWiki drops the plugin into, so it
// stays tracked here rather than inside the gitignored dist-plugin/ intermediates dir.
const STANDALONE_DIR = path.join(PLUGIN_DIR, "standalone");

// The TW5 CLI from the SUBMODULE (workspace-linked `tiddlywiki`), resolved via the package — robust
// to the workspace link, no .pnpm path guessing. tiddlywiki.js carries a `#!/usr/bin/env node` shebang.
const TW5_BIN = createRequire(import.meta.url).resolve("tiddlywiki/tiddlywiki.js");

// THE ATTESTED PATH IS THE LOGICAL PATH OF THE BINARY THE BUILD READ (L6, G15). Node's module resolution follows
// symlinks, so `TW5_BIN` names wherever the `TiddlyWiki5` submodule's real bytes sit on THIS disk; recording it
// raw would re-bake a different `packTranscriptSha256`/`actorSeed` for two checkouts of one commit. Recording a
// constant would attest the submodule even when the build read another binary. `resolveTw5BinLogicalPath`
// expresses the REAL file the build ran under the repo (the submodule's own logical location when it sits in the
// submodule's tree), so checkouts reading one binary agree and a build that read a different one records it.
const TW5_BIN_LOGICAL = resolveTw5BinLogicalPath({ resolvedBin: TW5_BIN, repoRoot: REPO_ROOT });
const TW5_BIN_MISMATCH = tw5BinMismatch(TW5_BIN_LOGICAL);
if (TW5_BIN_MISMATCH) console.warn(`[plugin-build] WARNING: ${TW5_BIN_MISMATCH}`);

/** sha256 — local alias to sha256HexSync from @lararium/mesh (build-time only). */
const sha256 = sha256HexSync;

function parsePackedTiddlers(pluginTiddler: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const innerParsed = JSON.parse(pluginTiddler["text"] as string) as {
    tiddlers?: Record<string, Record<string, unknown>>;
  };
  return innerParsed.tiddlers ?? {};
}

function verifyPackedPluginAgainstSourceManifest(
  skin: PluginSkin,
  pluginTiddler: Record<string, unknown>,
  sourceManifest: PluginSourceManifest,
): void {
  verifyPluginInfoTitle(sourceManifest, skin.title);
  verifyPackedStaticTiddlers(sourceManifest, parsePackedTiddlers(pluginTiddler));
  console.log(`[plugin-build] ${skin.name}: verified ${sourceManifest.staticTiddlers.length} packed static tiddlers (title + fields + body) against source manifest`);
}

function verifyPackedPluginAgainstManifest(
  skin: PluginSkin,
  pluginTiddler: Record<string, unknown>,
  manifest: ModuleManifest,
): void {
  if (pluginTiddler["title"] !== skin.title) {
    throw new Error(
      `[plugin-build] packed plugin title mismatch: expected ${skin.title}, got ${String(pluginTiddler["title"])}`,
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
    throw new Error(`[plugin-build] ${skin.name}: packed plugin failed module-manifest verification:\n  ${failures.join("\n  ")}`);
  }
  console.log(`[plugin-build] ${skin.name}: verified ${manifest.modules.length} packed module tiddlers against manifest`);
}

/**
 * Write each projection filter's `.tid` into the house island from `PROJECTION_FILTER_TEXT`; a byte-identical file stays as it
 * stands. The projection filters configure the house's mirror, so they ride the house skin.
 */
function writeProjectionFilterTiddlers(): void {
  const entries: Array<[string, string, string]> = [["config-projection-filter.tid", PROJECTION_FILTER, PROJECTION_FILTER_TEXT.base]];
  for (const cls of Object.keys(PROJECTION_FILTER_TEXT).filter((k) => k !== "base") as ProjectionClass[]) {
    entries.push([`config-projection-filter-${cls}.tid`, projectionFilterTitle(cls), PROJECTION_FILTER_TEXT[cls]]);
  }
  for (const [file, title, text] of entries) {
    const body = text.length > 0
      ? `title: ${title}\ntype: text/vnd.tiddlywiki\n\n${text}\n`
      : `title: ${title}\ntype: text/vnd.tiddlywiki\n`;
    const at = path.join(ROOT, LARARIUM_SKIN.tiddlersDir, file);
    let held = "";
    try { held = readFileSync(at, "utf8"); } catch { /* first write */ }
    if (held !== body) writeFileSync(at, body, "utf8");
  }
}

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

/** Pack, verify, attest and emit one skin; returns the canonical packed tiddler for `plugin-tiddler.generated.ts`. */
function packSkin(skin: PluginSkin): Record<string, unknown> {
  const moduleManifest = readModuleManifest(path.join(ROOT, skin.moduleManifest));
  const sourceManifestPath = path.join(ROOT, skin.sourceManifest);
  writePluginSourceManifest(
    sourceManifestPath,
    buildPluginSourceManifest(moduleManifest.manifest, moduleManifest.sha256, skin),
  );
  const sourceManifest = readPluginSourceManifest(sourceManifestPath);

  // 2. Pack via TW5 CLI.
  //    Run TW5 from a temp dir so any side-effect writes go there, not into our
  //    source tree. ++ with an absolute path loads the island as a plugin folder.
  console.log(`[plugin-build] packing the ${skin.name} skin via TW5 CLI…`);
  const tw5Tmp = mkdtempSync(path.join(tmpdir(), "tw5-pack-"));
  const tw5PluginCopy = path.join(tw5Tmp, "plugin");
  // A skin that loads over another boots it beside itself in the pack (its startups require the grammar's libraries), and the
  // export filter still names this skin's title alone.
  const dependencyCopies = skin.dependsOn.map((dep) => [dep, path.join(tw5Tmp, `dependency-${dep.name}`)] as const);
  const packArgs = [
    ...dependencyCopies.map(([, at]) => `++${at}`),
    `++${tw5PluginCopy}`,
    "--render",
    "$:/core/templates/exporters/JsonFile",
    "plugin.json",
    "text/plain",
    "",
    "exportFilter",
    `[[${skin.title}]]`,
  ];
  let outputJson: string;
  let inputRootSha256: string;
  let exportedPluginSha256: string;
  try {
    for (const [dep, at] of dependencyCopies) cpSync(path.join(ROOT, dep.tiddlersDir), at, { recursive: true });
    cpSync(path.join(ROOT, skin.tiddlersDir), tw5PluginCopy, { recursive: true });
    // Capture input tree digest before TW5 transforms anything.
    inputRootSha256 = computeInputRootSha256(tw5PluginCopy);
    const renderResult = spawnSync(TW5_BIN, packArgs, { cwd: tw5Tmp, stdio: "inherit" });
    if (renderResult.status !== 0) {
      console.error(`[plugin-build] TW5 render failed for the ${skin.name} skin`);
      process.exit(renderResult.status ?? 1);
    }
    outputJson = readFileSync(path.join(tw5Tmp, "output", "plugin.json"), "utf8");
    // Capture exported JSON digest before field augmentation — proves TW5 output.
    exportedPluginSha256 = sha256(outputJson);
  } finally {
    rmSync(tw5Tmp, { recursive: true, force: true });
  }

  // 3a. Write pack transcript before verification so failures are still auditable.
  const transcriptAbsPath = path.join(ROOT, skin.packTranscript);
  mkdirSync(path.dirname(transcriptAbsPath), { recursive: true });
  const tw5Version = resolveTw5Version(ROOT);
  writePackTranscript(transcriptAbsPath, {
    format: PACK_TRANSCRIPT_FORMAT,
    generatedBy: "packages/lararium-tw5/scripts/build-plugin-tiddler.ts",
    tw5BinPath: TW5_BIN_LOGICAL,
    tw5PackageVersion: tw5Version,
    // Replace ephemeral temp path with stable placeholder — content proved by inputRootSha256.
    // A dependency's copy names its skin (its bytes ride that skin's own transcript).
    packArgs: packArgs.map((a) => {
      if (!a.startsWith("++")) return a;
      const dep = dependencyCopies.find(([, at]) => a === `++${at}`);
      return dep ? `++{dependency:${dep[0].stem}}` : "++{tmpInput}";
    }),
    inputRootSha256,
    exportedPluginSha256,
  });
  const transcriptText = readFileSync(transcriptAbsPath, "utf8");
  const transcriptSha256 = sha256(transcriptText);
  console.log(`[plugin-build] ${skin.name}: pack transcript: ${skin.packTranscript} (sha256=${transcriptSha256.slice(0, 16)}…)`);

  const tiddlerArray = JSON.parse(outputJson) as Record<string, unknown>[];
  if (!tiddlerArray.length) {
    console.error(`[plugin-build] TW5 exported 0 tiddlers for the ${skin.name} skin — check the plugin title in ${skin.tiddlersDir}/plugin.info`);
    process.exit(1);
  }
  const pluginTiddlerLar = tiddlerArray[0]!;
  verifyPackedPluginAgainstSourceManifest(skin, pluginTiddlerLar, sourceManifest.manifest);
  verifyPackedPluginAgainstManifest(skin, pluginTiddlerLar, moduleManifest.manifest);
  Object.assign(pluginTiddlerLar, {
    "lares-canonical-title":          skin.title,
    "lares-module-count":             String(moduleManifest.manifest.modules.length),
    "lares-module-manifest-sha256":   moduleManifest.sha256,
    "lares-source-manifest-sha256":   sourceManifest.sha256,
    "lares-build-attestation-format": "lararium-tw5-plugin-build",
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
    title: skin.tw5Title,
    "lares-projection-of": skin.title,
  };
  delete pluginTiddlerTw5["lares-canonical-title"];

  const tidLar = emitTid(pluginTiddlerLar, `${skin.stem}.lar.tid`);
  const tidTw5 = emitTid(pluginTiddlerTw5, `${skin.stem}.tid`);

  const pluginLarJson = JSON.stringify(pluginTiddlerLar, null, 2);
  const pluginTw5Json = JSON.stringify(pluginTiddlerTw5, null, 2);
  writeFileSync(path.join(OUT_DIR, `${skin.stem}.lar.json`), pluginLarJson, "utf8");
  writeFileSync(path.join(OUT_DIR, `${skin.stem}.json`),     pluginTw5Json, "utf8");
  const pluginJsonSha = sha256(pluginLarJson);
  const pluginTw5Sha  = sha256(pluginTw5Json);
  const attestation = {
    format: "lararium-tw5-plugin-build",
    canonicalTitle: skin.title,
    compatibilityTitle: skin.tw5Title,
    moduleManifestPath: skin.moduleManifest,
    moduleManifestSha256: moduleManifest.sha256,
    sourceManifestPath: skin.sourceManifest,
    sourceManifestSha256: sourceManifest.sha256,
    packTranscriptPath: skin.packTranscript,
    packTranscriptSha256: transcriptSha256,
    moduleCount: moduleManifest.manifest.modules.length,
    packedTiddlerCount: tiddlerCount,
    pluginJsonSha256: pluginJsonSha,
    // The standalone ($:/) distribution's own digest — same inner tiddlers, title +
    // `lares-canonical-title`/`lares-projection-of` swapped. Lets a verifier check the committed
    // plugins/standalone/ artifact without re-deriving the lar:// one first.
    pluginTw5Sha256: pluginTw5Sha,
  };
  const attestationPath = path.join(OUT_DIR, `${skin.stem}.attestation.json`);
  writeFileSync(attestationPath, JSON.stringify(attestation, null, 2) + "\n", "utf8");

  // Copy canonical JSON to plugins/ so automerge-docs picks it up alongside
  // lararium-boot-shadows (the fixed boot set; optional plugins live as signed
  // offerings under offerings/, never in this directory).
  const pluginJsonDest = path.join(PLUGIN_DIR, `${skin.stem}.json`);
  copyFileSync(path.join(OUT_DIR, `${skin.stem}.lar.json`), pluginJsonDest);

  // Track the `$:/` standalone distribution alongside the lar:// canonical copy — it is
  // the stock-TW5 artifact a plain TiddlyWiki drag-and-drops, not an intermediate, so it
  // lives outside the gitignored dist-plugin/. CI's currency gate rebuilds and diffs this.
  mkdirSync(STANDALONE_DIR, { recursive: true });
  const standaloneTidDest = path.join(STANDALONE_DIR, `${skin.stem}.tid`);
  const standaloneAttestationDest = path.join(STANDALONE_DIR, `${skin.stem}.attestation.json`);
  copyFileSync(tidTw5.path, standaloneTidDest);
  copyFileSync(attestationPath, standaloneAttestationDest);

  console.log(`✓ wrote ${tidLar.path} (${(tidLar.bytes / 1024).toFixed(1)} KiB) — lararium VM canonical`);
  console.log(`✓ wrote ${tidTw5.path} (${(tidTw5.bytes / 1024).toFixed(1)} KiB) — vanilla TW5 drag-and-drop`);
  console.log(`✓ wrote ${pluginJsonDest} — automerge-docs pickup`);
  console.log(`✓ wrote ${standaloneTidDest} + ${standaloneAttestationDest} — tracked standalone distribution`);
  console.log(`✓ ${skin.name}: attested modules=${moduleManifest.manifest.modules.length} module-manifest=${moduleManifest.sha256.slice(0, 16)}… source-manifest=${sourceManifest.sha256.slice(0, 16)}… plugin=${pluginJsonSha.slice(0, 16)}… tw5-plugin=${pluginTw5Sha.slice(0, 16)}…`);
  console.log(`  ${tiddlerCount} inner tiddlers packed`);
  return pluginTiddlerLar;
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  // 1. Compile TS sources → each skin's island src/*.js (with embedded TW5 header comments).
  console.log("[plugin-build] running Vite build…");
  const viteResult = spawnSync("npx", ["tsx", "vite.plugin.config.ts"], {
    cwd: ROOT, stdio: "inherit",
  });
  if (viteResult.status !== 0) {
    console.error("[plugin-build] Vite build failed");
    process.exit(viteResult.status ?? 1);
  }
  // 1b. THE PROJECTION FILTERS ship as the house's `$:/config/` shadows, written from the one source the house's evaluator
  //     reads (`@lararium/mesh` PROJECTION_FILTER_TEXT), so the shadow and the default never stand as two lists.
  writeProjectionFilterTiddlers();

  const packed = PLUGIN_SKINS.map((skin) => [skin, packSkin(skin)] as const);

  const tsHeader  = `/* eslint-disable */\n// AUTO-GENERATED by scripts/build-plugin-tiddler.ts — do not edit.\n// Regenerate via: pnpm --filter @lararium/tw5 build:plugin\n\n`;
  const tsBody    = packed.map(([skin, tiddler]) => `export const ${skin.exportName} = ${JSON.stringify(tiddler, null, 2)} as const;\n`).join("\n");
  const tsSrcPath = path.join(ROOT, "src", "plugin-tiddler.generated.ts");
  writeFileSync(tsSrcPath, tsHeader + tsBody, "utf8");
  console.log(`✓ wrote ${tsSrcPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
