/**
 * grammar-table-witness.ts — derive the sigil table from the tiddlers and diff it
 * against every HAND-KEPT list the node-side path still reads, printing each
 * disagreement grouped by kind: missing sigil, extra sigil, alias pair present on
 * one side only, pattern mismatch.
 *
 * Hand lists read (by source-text extraction, so this witness touches none of them):
 *   - scanner.ts      BOOTSTRAP_SCANS      sigilName / canonicalName pairs + regex source
 *   - builder.ts      CANONICAL_SIGILS     Set<string> literal
 *   - meme-normalize.ts DEFINITION_HEAD    keyword alternation inside the regex literal
 *
 * Derived side: deriveGrammarFromDisk() (tiddlers/sigil-*.tid, tag SharktoothSigil),
 * through the SAME shared converter grammar-cache.ts uses live.
 *
 * Run: tsx scripts/grammar-table-witness.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { deriveGrammarFromDisk } from "./read-sigil-tiddlers.js";

const SRC = join(import.meta.dirname, "../src");
const scannerSrc   = readFileSync(join(SRC, "meme-ast/scanner.ts"), "utf-8");
const builderSrc   = readFileSync(join(SRC, "meme-ast/builder.ts"), "utf-8");
const normalizeSrc = readFileSync(join(SRC, "meme-normalize.ts"), "utf-8");

// ---------------------------------------------------------------------------
// Extract BOOTSTRAP_SCANS entries: { sigilName: "x", canonicalName: "y"?, ... }
// ---------------------------------------------------------------------------

interface ScanEntry { sigilName: string; canonicalName?: string }

function extractBootstrapScans(src: string): ScanEntry[] {
  const bodyMatch = /export const BOOTSTRAP_SCANS: SigilScan\[\] = \[([\s\S]*?)\n\];/.exec(src);
  if (!bodyMatch) throw new Error("BOOTSTRAP_SCANS body not found");
  const body = bodyMatch[1]!;
  const entries: ScanEntry[] = [];
  const entryRe = /\{\s*sigilName:\s*"([^"]+)"(?:,\s*canonicalName:\s*"([^"]+)")?/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(body))) {
    if (m[1] === "(generic)") continue;
    entries.push({ sigilName: m[1]!, canonicalName: m[2] });
  }
  return entries;
}

function extractCanonicalSigils(src: string): Set<string> {
  const m = /const CANONICAL_SIGILS = new Set\(\[([\s\S]*?)\]\);/.exec(src);
  if (!m) throw new Error("CANONICAL_SIGILS not found");
  const names = [...m[1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!);
  return new Set(names);
}

function extractDefinitionHeadKeywords(src: string): Set<string> {
  const m = /const DEFINITION_HEAD =\s*\n\s*\/[^\n]*\(\?:define\|([^)]*)\)/.exec(src);
  if (!m) throw new Error("DEFINITION_HEAD keyword group not found");
  return new Set(["define", ...m[1]!.split("|")]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const derived = deriveGrammarFromDisk();
const derivedNames = new Set(derived.sigils.map((s) => s.name));
const derivedAlias = new Map(derived.sigils.filter((s) => s.aliasFor).map((s) => [s.name, s.aliasFor!]));
const derivedCanonicalNames = new Set(derived.sigils.filter((s) => !s.aliasFor).map((s) => s.name));

const handScans = extractBootstrapScans(scannerSrc);
const handScanNames = new Set(handScans.map((s) => s.sigilName));
const handAlias = new Map(handScans.filter((s) => s.canonicalName).map((s) => [s.sigilName, s.canonicalName!]));

const handCanonical = extractCanonicalSigils(builderSrc);
const handDefHead = extractDefinitionHeadKeywords(normalizeSrc);

let disagreements = 0;
function group(title: string, lines: string[]): void {
  if (lines.length === 0) return;
  console.log(`\n-- ${title} (${lines.length}) --`);
  for (const l of lines) console.log(`  ${l}`);
  disagreements += lines.length;
}

// 1. scanner.ts BOOTSTRAP_SCANS vs derived tiddler sigils
const missingFromScanner: string[] = [];
for (const name of derivedNames) {
  if (!handScanNames.has(name)) missingFromScanner.push(`${name} — tiddler defines it, scanner.ts BOOTSTRAP_SCANS does not`);
}
group("scanner.ts: sigil in tiddlers, missing from BOOTSTRAP_SCANS", missingFromScanner.sort());

const extraInScanner: string[] = [];
const FRAME_HAND_KEPT = new Set(["control-soh", "control-stx", "control-etx", "control-eot", "control-etb"]);
for (const name of handScanNames) {
  if (FRAME_HAND_KEPT.has(name)) continue; // declared hand-kept bootstrap seed (see scanner.ts comment)
  if (!derivedNames.has(name)) extraInScanner.push(`${name} — BOOTSTRAP_SCANS defines it, no tiddler does`);
}
group("scanner.ts: sigil in BOOTSTRAP_SCANS, missing a tiddler", extraInScanner.sort());

// 2. alias pairs: present on one side only, or disagreeing target
const aliasDisagreements: string[] = [];
const allAliasNames = new Set([...derivedAlias.keys(), ...handAlias.keys()]);
for (const name of allAliasNames) {
  const d = derivedAlias.get(name);
  const h = handAlias.get(name);
  if (d && !h) aliasDisagreements.push(`${name} -> ${d} — tiddler lar-mirror-of set, scanner.ts canonicalName absent`);
  else if (h && !d) aliasDisagreements.push(`${name} -> ${h} — scanner.ts canonicalName set, tiddler lar-mirror-of absent (or tiddler missing)`);
  else if (d && h && d !== h) aliasDisagreements.push(`${name}: tiddler says -> ${d}, scanner.ts says -> ${h}`);
}
group("alias pair present on one side only, or disagreeing", aliasDisagreements.sort());

// 3. builder.ts CANONICAL_SIGILS vs derived canonical (non-alias) sigil names
// CANONICAL_SIGILS additionally carries the hand-kept frame names (control-*), which have no tiddler.
const missingFromCanonicalSet: string[] = [];
for (const name of derivedCanonicalNames) {
  if (!handCanonical.has(name)) missingFromCanonicalSet.push(`${name} — canonical tiddler sigil, missing from builder.ts CANONICAL_SIGILS`);
}
group("builder.ts: canonical sigil missing from CANONICAL_SIGILS", missingFromCanonicalSet.sort());

const extraInCanonicalSet: string[] = [];
for (const name of handCanonical) {
  if (FRAME_HAND_KEPT.has(name)) continue;
  if (!derivedCanonicalNames.has(name)) extraInCanonicalSet.push(`${name} — in builder.ts CANONICAL_SIGILS, not a canonical (non-alias) tiddler sigil`);
}
group("builder.ts: CANONICAL_SIGILS entry with no matching canonical tiddler", extraInCanonicalSet.sort());

// 4. meme-normalize.ts DEFINITION_HEAD vs lar-kind pragma/pragma-alias sigils
// (native TW5 keywords define/procedure/function/typos/type carry no tiddler at all — reported separately)
const NATIVE_TW5_KEYWORDS = new Set(["define", "procedure", "function", "typos", "type"]);
const pragmaKindNames = new Set(
  derived.sigils.filter((s) => s.kind === "pragma" || s.kind === "pragma-alias").map((s) => s.name),
);
const missingFromDefHead: string[] = [];
for (const name of pragmaKindNames) {
  if (!handDefHead.has(name)) missingFromDefHead.push(`${name} — lar-kind pragma/pragma-alias, missing from DEFINITION_HEAD`);
}
group("meme-normalize.ts: pragma-kind sigil missing from DEFINITION_HEAD", missingFromDefHead.sort());

const unexplainedInDefHead: string[] = [];
for (const kw of handDefHead) {
  if (NATIVE_TW5_KEYWORDS.has(kw)) continue; // not a sharktooth sigil at all — TW5's own \define family
  if (!pragmaKindNames.has(kw)) unexplainedInDefHead.push(`${kw} — in DEFINITION_HEAD, no tiddler carries lar-kind pragma/pragma-alias for it`);
}
group("meme-normalize.ts: DEFINITION_HEAD keyword with no pragma-kind tiddler", unexplainedInDefHead.sort());

console.log(`\ngrammar-table-witness: ${disagreements} disagreement(s) (${derived.sigils.length} tiddler sigils, ${handScans.length} hand scan entries, ${handCanonical.size} CANONICAL_SIGILS entries, ${handDefHead.size} DEFINITION_HEAD keywords)`);
process.exit(disagreements > 0 ? 1 : 0);
