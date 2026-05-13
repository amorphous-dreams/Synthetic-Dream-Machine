/**
 * write-tiddler-memes.ts — build native TW5 CJS tiddlers from TS sources.
 *
 * Each emitted `dist-tiddlers/{name}.js` file carries a TW5 comment-block
 * header (`title`, `type`, `module-type`) and can be loaded by TW5 directly.
 * This replaces the old anti-pattern of keeping both raw `.tw5.js` files and
 * separate memetic wrapper files for the same executable body.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { createHash } from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { TIDDLER_BUILD_ENTRIES, buildAll } from "../vite.tiddlers.config.js";
import type { TiddlerBuildEntry } from "../vite.tiddlers.config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = resolve(__dirname, "../../..");
const tw5Memes  = resolve(repoRoot, "bags", "@lararium", "tw5");
const distDir   = resolve(__dirname, "../dist-tiddlers");

const SHA_FIELD_RE  = /^body-sha256\s*=\s*"[^"]*"/m;
const TOML_BLOCK_RE = /(```toml[\s\S]*?```)/;

function patchSha256(meme: string, sha256: string): string {
  const tomlM = TOML_BLOCK_RE.exec(meme);
  if (!tomlM) throw new Error("root toml iam block not found");
  const tomlOrig = tomlM[1]!;
  const patched  = SHA_FIELD_RE.test(tomlOrig)
    ? tomlOrig.replace(SHA_FIELD_RE, `body-sha256 = "${sha256}"`)
    : tomlOrig.replace(/(\n```)$/, `\nbody-sha256 = "${sha256}"$1`);
  return meme.replace(tomlOrig, patched);
}

function subdirFor(entry: TiddlerBuildEntry): string {
  if (entry.kind === "widget") return "widgets";
  if (entry.kind === "filter") return "filters";
  return "modules";
}

function processEntry(entry: TiddlerBuildEntry): void {
  const builtPath = resolve(distDir, `${entry.name}.js`);
  if (!existsSync(builtPath)) {
    console.warn(`[write-tiddler-memes] MISSING dist: ${entry.name}.js`);
    return;
  }

  const cjs    = readFileSync(builtPath, "utf8").trimEnd();
  const sha256 = createHash("sha256").update(cjs, "utf8").digest("hex");
  const subdir = subdirFor(entry);

  const modulePath = resolve(tw5Memes, `${subdir}/${entry.name}-tw5.js`);
  mkdirSync(dirname(modulePath), { recursive: true });
  writeFileSync(modulePath, cjs + "\n", "utf8");
  console.log(`[write-tiddler-memes] ${subdir}/${entry.name}-tw5.js  sha256=${sha256.slice(0, 16)}…`);

  const anchorPath = resolve(tw5Memes, `${subdir}/${entry.name}.md`);
  if (existsSync(anchorPath)) {
    const anchorMeme = patchSha256(readFileSync(anchorPath, "utf8"), sha256);
    writeFileSync(anchorPath, anchorMeme, "utf8");
    console.log(`[write-tiddler-memes] ${subdir}/${entry.name}.md  body-sha256 updated`);
  }
}

console.log("[write-tiddler-memes] building headered CJS tiddlers via vite…\n");
await buildAll(distDir);
console.log("\n[write-tiddler-memes] writing native TW5 tiddlers…\n");

for (const entry of TIDDLER_BUILD_ENTRIES) processEntry(entry);

console.log("\n[write-tiddler-memes] done.");
