/**
 * test-quine — genesis boot smoke.
 *
 * Proves: the genesis artifact contains a bootable TW5 core + compiled plugin,
 * and the compiled plugin carries the grammar meme as a shadow tiddler.
 *
 * Steps:
 *   1. Load genesis/island.bin
 *   2. Verify genesis-cid self-ref tiddler
 *   3. Extract TW5 core blob + compiled plugin blob from the artifact
 *   4. Boot TW5Engine with compiled plugin preloaded
 *   5. Assert grammar shadow tiddler is accessible via $tw.wiki.getTiddlerText
 *   6. Assert grammarRulesFromText() produces valid rules from the shadow tiddler
 *
 * Run via:  tsx scripts/test-quine.ts
 * Or via:   pnpm --filter @lararium/node test:quine
 */

import * as Automerge      from "@automerge/automerge";
import { createHash }      from "crypto";
import { readFileSync, existsSync } from "fs";
import { join, dirname }   from "path";
import { fileURLToPath }   from "url";

import { TW5Engine }       from "@lararium/tw5";
import type { LarariumDoc } from "@lararium/core";
import { ENGINE_CORE_ID, GRAMMAR_MEME_URI, grammarRulesFromText } from "@lararium/core";

const LARES_TW5_PLUGIN_TITLE = "lar:///plugins/lares/memetic-wikitext";

const __dir       = dirname(fileURLToPath(import.meta.url));
const GENESIS_BIN = join(__dir, "../genesis/island.bin");
const GENESIS_PRE = join(__dir, "../genesis/island.sha256-pre");

function sha256hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

async function main(): Promise<void> {
  console.log("[quine] genesis boot smoke");

  // ------------------------------------------------------------------
  // 1. Load the genesis artifact
  // ------------------------------------------------------------------
  if (!existsSync(GENESIS_BIN)) {
    throw new Error(
      `[quine] genesis/island.bin not found.\n  → run: pnpm --filter @lararium/node build:genesis`,
    );
  }
  const genesisBytes = new Uint8Array(readFileSync(GENESIS_BIN));
  const doc          = Automerge.load<LarariumDoc>(genesisBytes);

  const blobCount    = Object.keys(doc.blobs ?? {}).length;
  const tiddlerCount = Object.keys(doc.tiddlers ?? {}).length;
  console.log(`[quine] artifact loaded  blobs=${blobCount}  tiddlers=${tiddlerCount}`);

  // ------------------------------------------------------------------
  // 2. Verify the genesis-cid self-ref tiddler (two-pass build check)
  // ------------------------------------------------------------------
  const GENESIS_CID_TIDDLER = "lar:///ha.ka.ba/@lararium/genesis-cid";
  const cidTiddler = doc.tiddlers?.[GENESIS_CID_TIDDLER] as
    { fields?: { sha256?: string } } | undefined;

  if (!cidTiddler?.fields?.sha256) {
    throw new Error("[quine] genesis-cid tiddler missing — re-run build:genesis.");
  }
  const storedPreSha = cidTiddler.fields.sha256;
  console.log(`[quine] stored sha256-pre = ${storedPreSha.slice(0, 16)}…`);

  if (existsSync(GENESIS_PRE)) {
    const diskPreSha = readFileSync(GENESIS_PRE, "utf8").trim();
    if (diskPreSha !== storedPreSha) {
      console.warn(`[quine] ⚠ sha256-pre mismatch: disk=${diskPreSha.slice(0, 16)}… stored=${storedPreSha.slice(0, 16)}…`);
    } else {
      console.log("[quine] ✓ sha256-pre matches disk record");
    }
  }

  // ------------------------------------------------------------------
  // 3. Extract TW5 core blob + compiled plugin blob
  // ------------------------------------------------------------------
  const coreEntry = doc.blobs?.[ENGINE_CORE_ID];
  if (!coreEntry?.blob) {
    throw new Error(`[quine] TW5 core blob (${ENGINE_CORE_ID}) missing from artifact`);
  }
  const coreBlob = {
    bytes:  new Uint8Array(coreEntry.blob as unknown as ArrayBuffer),
    sha256: coreEntry.sha256,
    source: coreEntry.source ?? ENGINE_CORE_ID,
  };
  console.log(`[quine] TW5 core blob  ${(coreBlob.bytes.byteLength / 1024).toFixed(0)} KB`);

  const pluginEntry = doc.blobs?.[LARES_TW5_PLUGIN_TITLE];
  if (!pluginEntry?.blob) {
    throw new Error(
      `[quine] compiled plugin blob (${LARES_TW5_PLUGIN_TITLE}) missing from artifact\n` +
      `  → run: pnpm --filter @lararium/tw5 build:plugin && pnpm --filter @lararium/node build:genesis`,
    );
  }
  const pluginJson = new TextDecoder().decode(new Uint8Array(pluginEntry.blob as unknown as ArrayBuffer));
  const pluginTiddler = JSON.parse(pluginJson) as Record<string, unknown>;
  console.log(`[quine] compiled plugin  sha=${pluginEntry.sha256.slice(0, 12)}…`);

  // ------------------------------------------------------------------
  // 4. Boot TW5Engine with compiled plugin preloaded
  // ------------------------------------------------------------------
  console.log("[quine] booting TW5Engine…");
  const vm = new TW5Engine();
  await vm.boot(coreBlob, [pluginTiddler]);
  console.log("[quine] TW5Engine ready");

  // ------------------------------------------------------------------
  // 5. Assert grammar shadow tiddler accessible
  // ------------------------------------------------------------------
  const grammarText = vm.$tw.wiki.getTiddlerText(GRAMMAR_MEME_URI) ?? "";
  if (!grammarText) {
    throw new Error(
      `[quine] FAIL — grammar shadow tiddler not found: ${GRAMMAR_MEME_URI}\n` +
      `  The grammar meme was not packed into the compiled plugin.\n` +
      `  → run: pnpm --filter @lararium/tw5 build:plugin`,
    );
  }
  console.log(`[quine] ✓ grammar shadow tiddler present  ${grammarText.length} chars`);

  // ------------------------------------------------------------------
  // 6. Assert grammarRulesFromText produces valid rules
  // ------------------------------------------------------------------
  const rules = grammarRulesFromText(GRAMMAR_MEME_URI, grammarText);
  if (!rules || rules.sigils.length === 0) {
    throw new Error("[quine] FAIL — grammarRulesFromText returned no sigils from shadow tiddler");
  }
  const sigilNames = rules.sigils.map(s => s.name);
  for (const required of ["ahu", "pranala", "aka", "loulou"]) {
    if (!sigilNames.includes(required)) {
      throw new Error(`[quine] FAIL — grammar missing expected sigil: "${required}"`);
    }
  }
  const sha = sha256hex(grammarText);
  console.log(`[quine] ✓ grammar rules valid  sigils=${rules.sigils.length}  families=${rules.families.length}  sha=${sha.slice(0, 16)}…`);

  vm.dispose?.();

  console.log("");
  console.log("=== Genesis Boot Smoke: PASS ===");
  console.log(`  blobs in artifact   : ${blobCount}`);
  console.log(`  tiddlers in artifact: ${tiddlerCount}`);
  console.log(`  grammar sigils      : ${rules.sigils.length}`);
  console.log(`  grammar families    : ${rules.families.length}`);
  console.log("");
  console.log("[quine] ✓ genesis carries bootable engine + compiled plugin + grammar shadow tiddler");
}

main().catch(err => {
  console.error("[quine] FATAL:", err);
  process.exit(1);
});
