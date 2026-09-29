/**
 * build-grammar-table.ts — generate src/meme-ast/grammar-table.generated.ts from the
 * SharktoothSigil tiddlers (packages/lararium-tw5/tiddlers/sigil-*.tid).
 *
 * Precedent: scripts/build-plugin-tiddler.ts (tiddlers → TS, never the reverse).
 *
 * `--check` — build the table in memory, compare byte-for-byte against the file on
 * disk, exit 1 and print a diff-shaped report on drift. Same pattern as
 * lararium-sensorium/scripts/gen_cli_verbs.mjs --check and tools/mirror-parity-witness.sh.
 *
 * Reads through the SAME shared converter grammar-cache.ts uses for the live wiki
 * (sigilFromFields / familyFromFields) — see read-sigil-tiddlers.ts. The generated
 * table is what the node-side scanner/builder/normalizer are meant to read instead of
 * the hand-kept lists (SIGIL_SCANS / CANONICAL_SIGILS / DEFINITION_HEAD) — see
 * tools/grammar-table-witness.sh for the drift this closes.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { deriveGrammarFromDisk } from "./read-sigil-tiddlers.js";

const OUT_PATH = join(import.meta.dirname, "../src/meme-ast/grammar-table.generated.ts");

function quote(s: string): string {
  return JSON.stringify(s);
}

function renderSigilRule(name: string, obj: Record<string, unknown>): string {
  const lines: string[] = [`  { name: ${quote(name)}, kind: ${quote(obj.kind as string)}`];
  const keys = [
    "layer", "inlinePattern", "blockPattern", "openPattern", "closePattern",
    "pattern", "pragmaPattern", "aliasFor", "defaultFamily", "defaultPropagation", "recoverAs",
  ];
  for (const k of keys) {
    const v = (obj as Record<string, unknown>)[k];
    if (v !== undefined) lines.push(`, ${k}: ${quote(v as string)}`);
  }
  const weave = obj.weave as { tongue: string } | undefined;
  if (weave) lines.push(`, weave: { tongue: ${quote(weave.tongue)} }`);
  return lines.join("") + " },";
}

export function renderGrammarTable(): string {
  const { sigils, families } = deriveGrammarFromDisk();
  const byName = (a: { name: string }, b: { name: string }) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const sortedSigils = [...sigils].sort(byName);
  const sortedFamilies = [...families].sort(byName);

  const aliasMapEntries = sortedSigils
    .filter((s) => s.aliasFor)
    .map((s) => `  ${quote(s.name)}: ${quote(s.aliasFor!)},`)
    .join("\n");

  const canonicalNames = sortedSigils.filter((s) => !s.aliasFor).map((s) => s.name);

  const lines: string[] = [];
  lines.push("/**");
  lines.push(" * grammar-table.generated.ts — GENERATED. Do not hand-edit.");
  lines.push(" *");
  lines.push(" * Source of record: packages/lararium-tw5/tiddlers/sigil-*.tid (tag SharktoothSigil).");
  lines.push(" * Regenerate: tsx scripts/build-grammar-table.ts");
  lines.push(" * Check for drift: tsx scripts/build-grammar-table.ts --check");
  lines.push(" */");
  lines.push("");
  lines.push('import type { SigilRule, FamilyRule } from "./types.js";');
  lines.push("");
  lines.push("export const GENERATED_SIGILS: SigilRule[] = [");
  for (const s of sortedSigils) lines.push(renderSigilRule(s.name, s as unknown as Record<string, unknown>));
  lines.push("];");
  lines.push("");
  lines.push("export const GENERATED_FAMILIES: FamilyRule[] = [");
  for (const f of sortedFamilies) {
    lines.push(
      `  { name: ${quote(f.name)}, dagRequired: ${f.dagRequired}, roleRecommended: ${f.roleRecommended}, confidenceBounded: ${f.confidenceBounded} },`,
    );
  }
  lines.push("];");
  lines.push("");
  lines.push("/** alias sigil name -> its canonical sigil name (lar-mirror-of). */");
  lines.push("export const GENERATED_ALIAS_MAP: Record<string, string> = {");
  if (aliasMapEntries) lines.push(aliasMapEntries);
  lines.push("};");
  lines.push("");
  lines.push("/** every sigil name that is NOT an alias (canonical sigils only). */");
  lines.push(`export const GENERATED_CANONICAL_NAMES: string[] = ${JSON.stringify(canonicalNames)};`);
  lines.push("");
  return lines.join("\n");
}

function main(): void {
  const check = process.argv.includes("--check");
  const rendered = renderGrammarTable();
  if (check) {
    if (!existsSync(OUT_PATH)) {
      console.error(`grammar-table drift: ${OUT_PATH} does not exist — run: tsx scripts/build-grammar-table.ts`);
      process.exit(1);
    }
    const onDisk = readFileSync(OUT_PATH, "utf-8");
    if (onDisk !== rendered) {
      console.error("grammar-table drift: generated table does not match src/meme-ast/grammar-table.generated.ts");
      console.error("Run: tsx scripts/build-grammar-table.ts");
      process.exit(1);
    }
    console.log("grammar-table: OK, no drift");
    return;
  }
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, rendered, "utf-8");
  console.log(`wrote ${OUT_PATH}`);
}

main();
