/**
 * write-tiddler-memes.ts — postbuild: splice compiled IIFEs into lares/ module tiddlers.
 *
 * For each widget/filter/deserializer IIFE in dist-widgets/:
 *   1. Read dist-widgets/{name}.iife.js
 *   2. Compute SHA-256
 *   3. Splice into lares/.../{subdir}/{name}-tw5.md between STX/ETX
 *   4. Patch body-sha256 in the anchor meme lares/.../{subdir}/{name}.md
 *
 * Run via: tsx scripts/write-tiddler-memes.ts
 * Run after: vite.widgets.config.ts buildAll()
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { WIDGET_ENTRIES, FILTER_ENTRIES, DESERIALIZER_ENTRIES, buildAll } from "../vite.tiddlers.config.js";
import { laresRoot } from "@lares/lares";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = dirname(laresRoot);
const distDir   = resolve(__dirname, "../dist-widgets");

const STX_RE       = /<<~[^>]*&#x0002;[^>]*>>/;
const ETX_RE       = /<<~[^>]*&#x0003;[^>]*>>/;
const SHA_FIELD_RE = /^body-sha256\s*=\s*"[^"]*"/m;
const TOML_BLOCK_RE = /(```toml[\s\S]*?```)/;

function spliceBody(meme: string, newBody: string): string {
  const stxM = STX_RE.exec(meme);
  const etxM = ETX_RE.exec(meme);
  if (!stxM || !etxM) throw new Error("STX/ETX markers not found");
  const stxEnd   = stxM.index + stxM[0].length;
  const etxStart = etxM.index;
  if (etxStart <= stxEnd) throw new Error("ETX appears before STX");
  return meme.slice(0, stxEnd) + "\n\n" + newBody + "\n\n" + meme.slice(etxStart);
}

function patchSha256(meme: string, sha256: string): string {
  const tomlM = TOML_BLOCK_RE.exec(meme);
  if (!tomlM) throw new Error("root toml iam block not found");
  const tomlOrig = tomlM[1]!;
  const patched  = SHA_FIELD_RE.test(tomlOrig)
    ? tomlOrig.replace(SHA_FIELD_RE, `body-sha256 = "${sha256}"`)
    : tomlOrig.replace(/(\n```)$/, `\nbody-sha256 = "${sha256}"$1`);
  return meme.replace(tomlOrig, patched);
}

function processEntry(name: string, kind: "widget" | "filter" | "module"): void {
  const iifeFile = resolve(distDir, `${name}.iife.js`);
  if (!existsSync(iifeFile)) {
    console.warn(`[write-tiddler-memes] MISSING dist: ${name}.iife.js`);
    return;
  }

  const iife   = readFileSync(iifeFile, "utf8").trimEnd();
  const sha256 = createHash("sha256").update(iife, "utf8").digest("hex");

  const subdir     = kind === "widget" ? "widgets" : kind === "filter" ? "filters" : "modules";
  const modulePath = resolve(laresRoot, `api/v0.1/lararium/${subdir}/${name}-tw5.md`);
  const anchorPath = resolve(laresRoot, `api/v0.1/lararium/${subdir}/${name}.md`);

  if (!existsSync(modulePath)) {
    console.warn(`[write-tiddler-memes] MISSING module tiddler: ${modulePath}`);
    return;
  }

  let moduleMeme = readFileSync(modulePath, "utf8");
  moduleMeme = spliceBody(moduleMeme, iife);
  writeFileSync(modulePath, moduleMeme, "utf8");
  console.log(`[write-tiddler-memes] ${subdir}/${name}-tw5.md  sha256=${sha256.slice(0, 16)}…`);

  if (existsSync(anchorPath)) {
    let anchorMeme = readFileSync(anchorPath, "utf8");
    anchorMeme = patchSha256(anchorMeme, sha256);
    writeFileSync(anchorPath, anchorMeme, "utf8");
    console.log(`[write-tiddler-memes] ${subdir}/${name}.md  body-sha256 updated`);
  }
}

console.log("[write-tiddler-memes] building IIFEs via vite…\n");
await buildAll();
console.log("\n[write-tiddler-memes] injecting into lares/ module tiddlers…\n");

for (const { name } of WIDGET_ENTRIES)       processEntry(name, "widget");
for (const { name } of FILTER_ENTRIES)       processEntry(name, "filter");
for (const { name } of DESERIALIZER_ENTRIES) processEntry(name, "module");

console.log("\n[write-tiddler-memes] done.");
