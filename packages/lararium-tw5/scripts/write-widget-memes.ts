/**
 * write-widget-memes.ts — postbuild: splice per-widget IIFEs into lares/ module tiddlers.
 *
 * For each widget/filter IIFE in dist-widgets/:
 *   1. Read dist-widgets/{name}.iife.js
 *   2. Compute SHA-256
 *   3. Splice into lares/.../widgets/{name}-tw5.md (or filters/) between STX/ETX
 *   4. Patch body-sha256 in the anchor meme lares/.../widgets/{name}.md
 *
 * Run via: tsx scripts/write-widget-memes.ts
 * Run after: vite.widgets.config.ts buildAll()
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { WIDGET_ENTRIES, FILTER_ENTRIES, buildAll } from "../vite.widgets.config.js";
import { laresRoot } from "@lararium/lares";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = dirname(laresRoot);
const distDir   = resolve(__dirname, "../dist-widgets");

const STX_RE = /<<~[^>]*&#x0002;[^>]*>>/;
const ETX_RE = /<<~[^>]*&#x0003;[^>]*>>/;
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

function processEntry(name: string, kind: "widget" | "filter"): void {
  const iifeFile = resolve(distDir, `${name}.iife.js`);
  if (!existsSync(iifeFile)) {
    console.warn(`[write-widget-memes] MISSING dist: ${name}.iife.js`);
    return;
  }

  const iife   = readFileSync(iifeFile, "utf8").trimEnd();
  const sha256 = createHash("sha256").update(iife, "utf8").digest("hex");

  const subdir     = kind === "widget" ? "widgets" : "filters";
  const modulePath = resolve(root, `lares/ha-ka-ba/api/v0.1/lararium/${subdir}/${name}-tw5.md`);
  const anchorPath = resolve(root, `lares/ha-ka-ba/api/v0.1/lararium/${subdir}/${name}.md`);

  if (!existsSync(modulePath)) {
    console.warn(`[write-widget-memes] MISSING module tiddler: ${modulePath}`);
    return;
  }

  // Splice IIFE into module tiddler body
  let moduleMeme = readFileSync(modulePath, "utf8");
  moduleMeme = spliceBody(moduleMeme, iife);
  writeFileSync(modulePath, moduleMeme, "utf8");
  console.log(`[write-widget-memes] ${subdir}/${name}-tw5.md  sha256=${sha256.slice(0, 16)}…`);

  // Patch body-sha256 in anchor meme
  if (existsSync(anchorPath)) {
    let anchorMeme = readFileSync(anchorPath, "utf8");
    anchorMeme = patchSha256(anchorMeme, sha256);
    writeFileSync(anchorPath, anchorMeme, "utf8");
    console.log(`[write-widget-memes] ${subdir}/${name}.md  body-sha256 updated`);
  }
}

// Build first, then inject
console.log("[write-widget-memes] building per-widget IIFEs via vite…\n");
await buildAll();
console.log("\n[write-widget-memes] injecting into lares/ module tiddlers…\n");

for (const { name } of WIDGET_ENTRIES) {
  processEntry(name, "widget");
}
for (const { name } of FILTER_ENTRIES) {
  processEntry(name, "filter");
}

console.log("\n[write-widget-memes] done.");
