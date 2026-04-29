/**
 * write-module-meme.ts — postbuild: splice IIFE bundle into the tw5-modules meme.
 *
 * Reads dist-bundle/lararium-tw5-modules.iife.js, finds the STX/ETX block
 * in lares/.../modules/tw5-modules.md, and replaces the body between them.
 *
 * Run via: tsx scripts/write-module-meme.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, "../../..");

const bundlePath = resolve(__dirname, "../dist-bundle/lararium-tw5-modules.iife.js");
const memePath   = resolve(root, "lares/ha-ka-ba/api/v0.1/lararium/modules/tw5-modules.md");

const bundle = readFileSync(bundlePath, "utf8").trimEnd();
const meme   = readFileSync(memePath,   "utf8");

// Match between <<~&#x0002;>> and <<~&#x0003;>> (STX/ETX), replacing the body.
const STX = /<<~[^>]*&#x0002;[^>]*>>/;
const ETX = /<<~[^>]*&#x0003;[^>]*>>/;

const stxMatch = STX.exec(meme);
const etxMatch = ETX.exec(meme);

if (!stxMatch || !etxMatch) {
  console.error("write-module-meme: STX/ETX markers not found in", memePath);
  process.exit(1);
}

const stxEnd  = stxMatch.index + stxMatch[0].length;
const etxStart = etxMatch.index;

if (etxStart <= stxEnd) {
  console.error("write-module-meme: ETX appears before STX");
  process.exit(1);
}

const updated = meme.slice(0, stxEnd) + "\n\n" + bundle + "\n\n" + meme.slice(etxStart);
writeFileSync(memePath, updated, "utf8");

console.log("write-module-meme: wrote", bundle.length, "bytes into", memePath);
