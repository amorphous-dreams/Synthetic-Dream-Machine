#!/usr/bin/env node
/**
 * quote-named-params — wrap a named parameter's value in quotes, where the parser says it is safe.
 *
 * ── WHY THE PARSER DECIDES, NEVER A PATTERN ─────────────────────────────────────────────────────
 * A quoted value and a bare one read alike only where TiddlyWiki assigns the same TYPE to both.
 * Five shapes do not: `p=<<m>>` carries type macro and `p="<<m>>"` carries type string, and the
 * macro stops being called. The same for a transclusion, a filter, a substitution, and a bracketed
 * title whose brackets survive into the value. Measured across this tree, 29 live parameters wear
 * one of those shapes.
 *
 * A regex can spot a leading `<<` or `{{`. It cannot spot the shape nobody enumerated, which is
 * the one that breaks. So every candidate goes through the parser, and the type it assigns decides.
 *
 * ── AND EVERY FILE VERIFIES BEFORE IT IS WRITTEN ────────────────────────────────────────────────
 * After the edits, the carrier re-parses and every attribute's (macro, name, type, value) must
 * come back identical. A file whose reading moved is reported and left exactly as it stands.
 *
 * ── AND A SECOND PASS, FOR THE TEXT NO PARSER READS ────────────────────────────────────────────
 * A control sigil standing inside a fence or a tick span shows a reader the form the corpus uses,
 * so it migrates with the rest. TiddlyWiki parses nothing there, which cuts both ways: no type
 * exists to classify by, and no meaning exists to break. The verifier still answers — quoting
 * inside a fence must leave the parsed reading COMPLETELY unchanged, and a reading that moves says
 * the fence was never a fence.
 *
 * ⚠ ONE ZONE STAYS SHUT. A ```toml meta block is a different language whose quoting rules are its
 * own. Measured, no control sigil stands in one.
 *
 * ⚠ AND THE PARSER OUTRANKS THE FENCE WALKER. Where the parser placed an attribute, the line is not
 * fenced whatever a line walker believes, and the typed pass takes it.
 *
 * Usage:  node tools/quote-named-params.mjs [--host ^] [--write] <path.mem | dir> ...
 *         Dry run by default: it writes nothing and reports what it would do.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { resolveTiddlyWiki, boot, flatten } =
  require("./VSCode-TW5-Syntax/tools/tw5-oracle.js".replace("./", process.cwd() + "/"));

const argv = process.argv.slice(2);
const write = argv.includes("--write");
const hostIndex = argv.indexOf("--host");
const host = hostIndex >= 0 ? argv[hostIndex + 1] : "^";
const paths = argv.filter((a, i) => !a.startsWith("--") && !(hostIndex >= 0 && i === hostIndex + 1));

if (paths.length === 0) {
  console.error("quote-named-params: name the carriers or a directory holding them.");
  console.error("  usage: node tools/quote-named-params.mjs [--host ^] [--write] <path.mem | dir> ...");
  process.exit(2);
}

const carriers = [];
const gather = (p) => {
  if (statSync(p).isDirectory()) {
    for (const e of readdirSync(p)) gather(join(p, e));
  } else if (p.endsWith(".mem")) carriers.push(p);
};
paths.forEach(gather);

const oracle = boot(resolveTiddlyWiki(), {});

/** Lines inside a fenced block, which a sweep never enters. */
function fenced(lines) {
  const skip = new Array(lines.length).fill(false);
  let open = null;
  lines.forEach((l, i) => {
    const m = /^\s*(`{3,})/.exec(l);
    if (m) {
      if (open === null) { open = m[1]; skip[i] = true; return; }
      if (l.trim().startsWith(open)) { open = null; skip[i] = true; return; }
    }
    if (open !== null) skip[i] = true;
  });
  return skip;
}

/** Every attribute the parser placed, with the macro that holds it. */
function placed(text) {
  const out = [];
  const walk = (nodes) => {
    for (const n of nodes ?? []) {
      if (!n || typeof n !== "object") continue;
      const macro = n.attributes?.$variable?.value;
      for (const [name, a] of Object.entries(n.attributes ?? {})) {
        if (!a || typeof a.start !== "number") continue;
        out.push({ macro, name, type: a.type, value: a.value, textReference: a.textReference, filter: a.filter, rawValue: a.rawValue, start: a.start, end: a.end });
      }
      walk(n.children);
    }
  };
  walk(oracle.parse(text).tree);
  return out;
}

/**
 * The reading, as a shape two texts can be compared by.
 *
 * A macro-typed attribute carries its value as a parse-tree NODE holding absolute offsets, and
 * every offset past an inserted quote moves. Comparing the node compares arithmetic — measured, it
 * refused five carriers whose reading never changed. So a value that carries no primitive answers
 * by its own SOURCE TEXT instead, which moves only where an edit actually lands.
 */
const reading = (text) => placed(text)
  .map((a) => {
    const primitive = a.value ?? a.textReference ?? a.filter ?? a.rawValue;
    const shape = typeof primitive === "string" ? JSON.stringify(primitive) : text.slice(a.start, a.end).trim();
    return `${a.macro ?? ""}|${a.name}|${a.type}|${shape}`;
  }).sort().join("\n");

let files = 0; let quoted = 0; let skippedType = 0; let skippedZone = 0;
let skippedQuote = 0; let already = 0; let refused = 0; const moved = [];

for (const file of carriers) {
  const before = readFileSync(file, "utf8");
  const lines = before.split("\n");
  const skip = fenced(lines);
  const starts = [0];
  for (let i = 0; i < before.length; i += 1) if (before[i] === "\n") starts.push(i + 1);
  const lineOf = (off) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= off) lo = m; else hi = m - 1; } return lo; };

  const edits = [];
  const typed = new Set();
  // Every span the parser placed ANYWHERE, so the second pass never edits text the first one read.
  // A line can carry a live sigil and a ticked one at once, and a line-grained check cannot tell
  // them apart — measured, it moved the reading in six carriers.
  const read = placed(before).map((a) => [a.start, a.end]);
  for (const a of placed(before)) {
    if (a.macro !== host) continue;
    if (/^\d+$/.test(a.name)) continue;                          // positional, out of scope
    typed.add(lineOf(a.start));
    const span = before.slice(a.start, a.end);
    const eq = span.indexOf("=");
    if (eq < 0) continue;
    const raw = span.slice(eq + 1);
    if (/^["']/.test(raw)) { already += 1; continue; }
    if (a.type !== "string") { skippedType += 1; continue; }
    if (/^\[\[/.test(raw)) { skippedType += 1; continue; }        // the brackets survive into the value
    if (raw.includes('"')) { skippedQuote += 1; continue; }       // a quote inside wants a hand
    edits.push({ at: a.start + eq + 1, len: raw.length, raw });
  }
  // ── the second pass: a control sigil the parser never read ────────────────────────────────
  // A fenced or ticked sigil carries no attribute for the oracle to type, so the text answers.
  // The toml block stays shut, and a line the parser DID read already went through the typed pass.
  let open = null;
  let toml = false;
  lines.forEach((l, i) => {
    const fence = /^\s*(`{3,})(.*)$/.exec(l);
    if (fence) {
      if (open === null) { open = fence[1]; toml = /\btoml\b/.test(fence[2]); return; }
      if (l.trim().startsWith(open)) { open = null; toml = false; return; }
    }
    if (toml) return;
    const ticked = /`[^`]*<<\^[^`]*`/.test(l);
    if (open === null && !ticked) return;
    if (typed.has(i)) return;
    if (!l.includes(`<<${host}`)) return;
    for (const m of l.matchAll(/\b([a-zA-Z][\w-]*)=(?!["'])([^\s>]+)/g)) {
      if (/^(<<|\{\{|`|\[\[)/.test(m[2])) { skippedType += 1; continue; }
      const at = starts[i] + m.index + m[1].length + 1;
      if (read.some(([from, to]) => at >= from && at < to)) continue;   // the parser read it
      edits.push({ at, len: m[2].length, raw: m[2] });
      skippedZone += 1;                                            // counted as the fenced pass
    }
  });

  if (!edits.length) continue;
  files += 1;

  let after = before;
  for (const e of edits.sort((x, y) => y.at - x.at)) {
    after = after.slice(0, e.at) + '"' + e.raw + '"' + after.slice(e.at + e.len);
  }
  if (reading(after) !== reading(before)) { refused += 1; moved.push(file); continue; }
  quoted += edits.length;
  if (write) writeFileSync(file, after);
}

console.log(`quote-named-params  host <<${host} …>>  ${carriers.length} carrier(s) read, ${files} would change`);
console.log(`  ${quoted} value(s) ${write ? "quoted" : "TO QUOTE"}`);
console.log(`  ${already} already quoted · ${skippedType} skipped by TYPE · ${skippedZone} inside a fence or tick · ${skippedQuote} carrying a quote`);
if (refused) {
  console.error(`  ${refused} carrier(s) REFUSED — the reading moved, and nothing was written to them:`);
  for (const f of moved.slice(0, 10)) console.error(`     ${f}`);
}
process.exit(refused === 0 ? 0 : 1);
