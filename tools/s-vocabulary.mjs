#!/usr/bin/env node
/**
 * s-vocabulary — no name, comment or string in tracked code spells the retired omnibus key.
 *
 * The omnibus vessel key retired: the node (S) tree seals the gate root and the place archive, each face seals under its own
 * key (FCK), and the serving tree wraps SK. A word that still spells that key's old abbreviation reads as the thing that retired.
 * The check scans code, comments and strings alike, with named line exceptions, itself included: it names the
 * abbreviation only through character classes. The floor vessel key (`.vessel-key.json`, the place signing seed) is a different
 * thing; its names do not contain the abbreviation.
 *
 * Live canon is scanned too: every carrier the one finder (`carrierFiles()`, the built shore) declares, except `docs/history/` (the canon-history class owns that directory).
 * Third-party scouts (`*-scout.mem`) read line by line; named citations consume only their own lines. A
 * content-address run (`ni:///sha-256;...`) is not prose and is skipped.
 *
 * Usage: node tools/s-vocabulary.mjs   (exit 1 and the hits on stdout when a word spells it)
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { distCarrierFiles } from "./corpus-read.mjs";
import { classify } from "./evergreen-boundary.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LETTERS = "[Vv][Kk]";
const DOCS = "bags/lares/ha.ka.ba/lares/docs/pono/";
export const EXCEPTIONS = [
  { rule: "s-vocabulary", file: DOCS + "canvas-field-scout.mem", match: "Visual Knowledge Builder (" + "V" + "KB)", reason: "The cited research system carries its own acronym." },
  { rule: "s-vocabulary", file: DOCS + "crdt-ecosystem-scout.mem", match: "32-byte Ed25519 issuer " + "V" + "K", reason: "The cited certificate codec names its issuer key." },
  { rule: "s-vocabulary", file: DOCS + "subduction-onomancy-scout.mem", match: "`signer` (32B " + "v" + "k)", reason: "The cited certificate wire order names its signer key." },
  { rule: "s-vocabulary", file: DOCS + "subduction-onomancy-scout.mem", match: "32-byte ed25519 " + "v" + "k, bs58check", reason: "The cited URL description names its document key." },
  { rule: "s-vocabulary", file: DOCS + "subduction-onomancy-scout.mem", match: "`" + "Issuer" + "V" + "K` — the author's raw Ed25519 verifying key", reason: "The cited commit field names the author key." },
  { rule: "s-vocabulary", file: DOCS + "subduction-onomancy-scout.mem", match: "schema ‖ " + "Issuer" + "V" + "K ‖ fields", reason: "The cited codec names its signed field order." },
  { rule: "s-vocabulary", file: DOCS + "subduction-onomancy-scout.mem", match: "cleartext `" + "Issuer" + "V" + "K`", reason: "The cited relay description names the visible author key." },
];

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

/** A canon carrier's words: its prose with the content-address runs removed. */
export function memWords(text) {
  return retiredWords(text.replace(/ni:\/\/\/sha-256;[A-Za-z0-9_-]+/g, "ni:///sha-256;"));
}

/** Live canon: every declared carrier outside `docs/history/`, including the scouts, read through the one finder. */
export async function trackedCanon() {
  const { carrierFiles } = await distCarrierFiles(ROOT, "s-vocabulary");
  return carrierFiles(ROOT).filter((f) => !f.includes("/docs/history/"));
}

export function trackedCode() {
  return execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n")
    .filter((f) => /\.(ts|tsx|mjs|js|sh)$/.test(f) && /^(packages\/[^/]+\/(src|tests|scripts)\/|tests\/|tools\/)/.test(f) && !/node_modules|\/dist\//.test(f));
}

export function findingsFor(file, text, scan = retiredWords) {
  const lines = text.split("\n");
  return [...new Set(scan(text).map(h => h.line))].map(line => ({ rule: "s-vocabulary", file, line, text: lines[line - 1].trim() }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const findings = [];
  for (const f of trackedCode()) findings.push(...findingsFor(f, readFileSync(join(ROOT, f), "utf8")));
  for (const f of await trackedCanon()) findings.push(...findingsFor(f, readFileSync(join(ROOT, f), "utf8"), memWords));
  const { open, stale } = classify(findings, EXCEPTIONS);
  for (const h of open) console.log(`${h.file}:${h.line}  ${h.text}`);
  for (const e of stale) console.log(`stale exception: ${e.file}  ${e.match}`);
  console.log(`s-vocabulary: ${open.length} open line(s), ${stale.length} stale exception(s)`);
  process.exit(open.length || stale.length ? 1 : 0);
}
