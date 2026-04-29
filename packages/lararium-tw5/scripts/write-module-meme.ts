/**
 * write-module-meme.ts — postbuild: splice IIFE bundle + body-sha256 into the tw5-modules meme.
 *
 * 1. Reads dist-bundle/lararium-tw5-modules.iife.js
 * 2. Computes SHA-256 of the bundle text
 * 3. Replaces the body between STX/ETX in tw5-modules.md
 * 4. Patches the body-sha256 field in the #iam TOML block
 *
 * Run via: tsx scripts/write-module-meme.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, "../../..");

const bundlePath = resolve(__dirname, "../dist-bundle/lararium-tw5-modules.iife.js");
const memePath   = resolve(root, "lares/ha-ka-ba/api/v0.1/lararium/modules/tw5-modules.md");

const bundle = readFileSync(bundlePath, "utf8").trimEnd();
const sha256 = createHash("sha256").update(bundle, "utf8").digest("hex");

let meme = readFileSync(memePath, "utf8");

// --- 1. Replace body between STX/ETX -----------------------------------------
const STX = /<<~[^>]*&#x0002;[^>]*>>/;
const ETX = /<<~[^>]*&#x0003;[^>]*>>/;

const stxMatch = STX.exec(meme);
const etxMatch = ETX.exec(meme);

if (!stxMatch || !etxMatch) {
  console.error("write-module-meme: STX/ETX markers not found in", memePath);
  process.exit(1);
}

const stxEnd   = stxMatch.index + stxMatch[0].length;
const etxStart = etxMatch.index;

if (etxStart <= stxEnd) {
  console.error("write-module-meme: ETX appears before STX");
  process.exit(1);
}

meme = meme.slice(0, stxEnd) + "\n\n" + bundle + "\n\n" + meme.slice(etxStart);

// --- 2. Patch body-sha256 in #iam TOML block ---------------------------------
// Match the TOML fenced block inside the #iam ahu slot.
const TOML_BLOCK = /(```toml[\s\S]*?```)/;
const tomlMatch = TOML_BLOCK.exec(meme);

if (!tomlMatch) {
  console.error("write-module-meme: #iam TOML block not found");
  process.exit(1);
}

const tomlOrig = tomlMatch[1];
const SHA_FIELD = /^body-sha256\s*=\s*"[^"]*"/m;

const tomlPatched = SHA_FIELD.test(tomlOrig)
  ? tomlOrig.replace(SHA_FIELD, `body-sha256 = "${sha256}"`)
  : tomlOrig.replace(/(\n```)$/, `\nbody-sha256 = "${sha256}"$1`);

meme = meme.replace(tomlOrig, tomlPatched);

// --- 3. Write ----------------------------------------------------------------
writeFileSync(memePath, meme, "utf8");

console.log(`write-module-meme: wrote ${bundle.length} bytes, sha256=${sha256.slice(0, 16)}… into ${memePath}`);
