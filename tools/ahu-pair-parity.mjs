// ahu-pair-parity — the ahu pairs `scanAhu` reads against the pairs the carrier grammar parses.
//
// Two readers of one structure stand in two languages: `scanAhu` (`@lararium/tw5` meme-ast), the one
// ahu reader every split and floor consults, and the tree-sitter carrier grammar (C scanner +
// `grammar.js`), which the editor and the fold hosts read. Neither can see the other. A pair one of
// them cuts and the other misses is a meme that decomposes one way and highlights, folds and indexes
// another — a bug in the SEAM, which no single-reader test can name.
//
// THE READING RUNS ONE WAY ON PURPOSE. scanAhu owns the decomposition, so every pair it cuts, at every
// depth, must stand in the grammar's tree as an `ahu_block` with the same opener and the same closer.
// A pair missing, or the opener paired to another closer, reads RED with file:offset evidence. So does
// any carrier the grammar parses with an ERROR or MISSING node: a tree that failed to parse proves
// nothing about its pairs.
//
// The grammar pairs FORM, not vocabulary: every sigil whose own `<<~/name>>` follows stands as an
// `ahu_block`, so `hoike`, `kue`, `moolelo` and the rest pair there and never in scanAhu. Those
// grammar-only pairs are REPORTED, by name, and never refused — the asymmetry stays visible.
//
// scanAhu's balance faults (an orphan closer, an opener left standing) are reported too: they cut no
// pair, so parity cannot read them, and a count beside the verdict keeps them from going quiet.
//
// Exit 0 = every scanAhu pair the grammar reproduces, no carrier parsed in error. 1 = red. 2 = refused
// (a missing or stale shore, or a sweep that found nothing to compare).
//
// `REPO` names the corpus tree (default: this checkout); the shores — tw5's dist and the grammar wasm —
// always load from this checkout, so a planted scratch corpus reads through the same instruments.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { readCarrier, vanishedNote, distCarrierFiles, distModule, assertWasmFresh } from "./corpus-read.mjs";

const TOOL = "ahu-pair-parity";
const SHORE = resolve(import.meta.dirname, "..");
const REPO = resolve(process.env["REPO"] ?? SHORE);
const GRAMMAR_DIR = "tree-sitter-memetic-wikitext";
const GRAMMAR_PKG = join(SHORE, "packages", GRAMMAR_DIR);

const { carrierFiles } = await distCarrierFiles(SHORE, TOOL);
const { scanAhu } = await distModule(join(SHORE, "packages/lararium-tw5/dist"), "meme-ast/ahu-scan.js", TOOL);

const wasmAt = assertWasmFresh(SHORE, GRAMMAR_DIR, "tree-sitter-memetic_wikitext.wasm", TOOL);
const { Parser, Language } = createRequire(join(GRAMMAR_PKG, "package.json"))("web-tree-sitter");
await Parser.init({ wasmBinary: readFileSync(join(GRAMMAR_PKG, "node_modules/web-tree-sitter/web-tree-sitter.wasm")) });
const parser = new Parser();
parser.setLanguage(await Language.load(readFileSync(wasmAt)));

/** Every pair scanAhu cuts, at every depth: its top-level blocks, then each block's body read again. */
function scanPairs(text, base = 0, out = []) {
  for (const b of scanAhu(text).blocks) {
    out.push([base + b.openStart, base + b.bodyEnd]);
    scanPairs(text.slice(b.bodyStart, b.bodyEnd), base + b.bodyStart, out);
  }
  return out;
}

/** The scan's balance faults over the whole text — top level only, where scanAhu reports them. */
const faultsOf = (text) => scanAhu(text).faults;

/** Every `ahu_block` the grammar parses, as [open, close, name], and the offsets of ERROR/MISSING nodes. */
function grammarRead(tree, text) {
  const pairs = [];
  const errors = [];
  const walk = (n) => {
    if (n.type === "ERROR" || n.isMissing) errors.push(n.startIndex);
    if (n.type === "ahu_block") {
      const o = n.childForFieldName("open");
      const c = n.childForFieldName("close");
      if (o && c) {
        const name = /^<<~\s*\/?([^\s>]*)/.exec(text.slice(o.startIndex, o.startIndex + 80))?.[1] ?? "?";
        pairs.push([o.startIndex, c.startIndex, name]);
      }
    }
    for (const ch of n.children) walk(ch);
  };
  walk(tree.rootNode);
  return { pairs, errors };
}

/** `file:offset (line L)` — the evidence a red names. */
function where(file, text, at) {
  return `${file}:${at} (line ${text.slice(0, at).split("\n").length})`;
}
const glimpse = (text, at) => JSON.stringify(text.slice(at, at + 48).split("\n")[0]);

const EXCLUDED = /(^|\/)(scratch|tmp)(\/|$)/;
const files = carrierFiles(REPO).filter((f) => f.startsWith("bags/") && f.endsWith(".mem") && !EXCLUDED.test(f));

let total = 0;
let reproduced = 0;
let faults = 0;
let swept = 0;
const reds = [];
const grammarOnly = new Map();

for (const f of files) {
  const text = readCarrier(REPO, f);
  if (text === null) continue;
  swept++;
  const tree = parser.parse(text);
  const { pairs, errors } = grammarRead(tree, text);
  tree.delete();

  for (const at of errors) reds.push(`ERROR    ${where(f, text, at)} the grammar failed to parse ${glimpse(text, at)}`);

  const byOpen = new Map(pairs.map(([o, c]) => [o, c]));
  const byClose = new Map(pairs.map(([o, c]) => [c, o]));
  const want = scanPairs(text);
  const wanted = new Set(want.map(([o, c]) => `${o}:${c}`));
  for (const [o, c] of want) {
    total++;
    const got = byOpen.get(o);
    if (got === c) { reproduced++; continue; }
    if (got !== undefined) {
      reds.push(`MISPLACED ${where(f, text, o)} scanAhu closes at ${c}, the grammar at ${got} ${glimpse(text, o)}`);
    } else if (byClose.has(c)) {
      reds.push(`MISPLACED ${where(f, text, o)} scanAhu's closer at ${c} closes the grammar's opener at ${byClose.get(c)} ${glimpse(text, o)}`);
    } else {
      reds.push(`MISSING  ${where(f, text, o)} scanAhu pairs it with ${c}; the grammar pairs neither ${glimpse(text, o)}`);
    }
  }
  for (const [o, c, name] of pairs) {
    if (wanted.has(`${o}:${c}`)) continue;
    grammarOnly.set(name, (grammarOnly.get(name) ?? 0) + 1);
  }
  faults += faultsOf(text).length;
}

// A SWEEP THAT FOUND NOTHING PROVES NOTHING. Zero carriers or zero pairs means the finder, the filter or
// the reader moved — a green over an empty set would be the silent zero this witness exists to refuse.
if (swept === 0 || total === 0) {
  console.error(`[${TOOL}] swept ${swept} carriers holding ${total} scanAhu pairs — nothing to compare; the corpus walk or the reader moved`);
  process.exit(2);
}

const onlyLine = [...grammarOnly.entries()].sort((a, b) => b[1] - a[1]).map(([n, k]) => `${n} ${k}`).join(" · ");
const onlyTotal = [...grammarOnly.values()].reduce((a, b) => a + b, 0);
console.log(`[${TOOL}] ${swept} carriers · scanAhu pairs ${total} · the grammar reproduces ${reproduced} of ${total}${vanishedNote()}`);
console.log(`  grammar-only pairs (form-true, not ahu to scanAhu — reported, never refused): ${onlyTotal}${onlyTotal ? ` — ${onlyLine}` : ""}`);
console.log(`  scanAhu balance faults (cut no pair — reported): ${faults}`);
if (reds.length > 0) {
  for (const r of reds) console.log(`  ✗ ${r}`);
  console.log(`[${TOOL}] RED — ${reds.length} disagreement(s) between scanAhu and the carrier grammar`);
  process.exit(1);
}
console.log(`[${TOOL}] every scanAhu pair stands in the grammar's tree; no carrier parsed in error`);
