#!/usr/bin/env node
/**
 * s-vocabulary — no name, comment or string in tracked code spells the retired omnibus key.
 *
 * The omnibus vessel key retired: the node (S) tree seals the gate root and the place archive, each face seals under its own
 * key (FCK), and the serving tree wraps SK. A word that still spells that key's old abbreviation reads as the thing that retired.
 * The check scans code, comments and strings alike, with no allow-list and no exempt file, itself included: it names the
 * abbreviation only through character classes. The floor vessel key (`.vessel-key*.json`, the place signing seed) is a different
 * thing; its names do not contain the abbreviation.
 *
 * Usage: node tools/s-vocabulary.mjs   (exit 1 and the hits on stdout when a word spells it)
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LETTERS = "[Vv][Kk]";

/** The words of `text` (identifier-shaped runs, hyphens and dots split them) that spell the retired abbreviation, with line numbers. */
export function retiredWords(text) {
  const hits = [];
  text.split("\n").forEach((line, at) => {
    for (const word of line.match(/[A-Za-z0-9_$]+/g) ?? []) {
      if (/^[A-Za-z0-9]{8,}$/.test(word) && /\d/.test(word) && /[a-z]/.test(word) && /[A-Z]/.test(word)) continue;   // a base64 run, never a name
      if (new RegExp(`^${LETTERS}$|^v[k][A-Z0-9_]|V[k](?![a-z])|V[K]`).test(word)) hits.push({ line: at + 1, word });
    }
  });
  return hits;
}

export function trackedCode() {
  return execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n")
    .filter((f) => /\.(ts|tsx|mjs|js|sh)$/.test(f) && /^(packages\/[^/]+\/(src|tests|scripts)\/|tests\/|tools\/)/.test(f) && !/node_modules|\/dist\//.test(f));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let count = 0;
  for (const f of trackedCode()) {
    for (const h of retiredWords(readFileSync(join(ROOT, f), "utf8"))) { console.log(`${f}:${h.line}  ${h.word}`); count++; }
  }
  console.log(`s-vocabulary: ${count} word(s) spell the retired abbreviation`);
  process.exit(count === 0 ? 0 : 1);
}
