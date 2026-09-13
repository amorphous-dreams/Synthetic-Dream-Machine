#!/usr/bin/env node
/**
 * call-reach — a call the corpus writes, rendered, and asked whether it ARRIVED.
 *
 * ── EMIT ON THE PATH, NOT THE OUTCOME ───────────────────────────────────────────────────────────
 * This grammar fails gracefully by design: a sigil reaching no definition renders the reader's own
 * text rather than an error, so a stranger can still read the page. That forgiveness is the whole
 * reason a carrier survives being read by someone who knows none of this.
 *
 * It also makes a broken call and a working one INDISTINGUISHABLE from the outside. Measured in a
 * booted wiki, these four cases:
 *
 *     unrecognized form           a diagnostic, and a marked span
 *     well-formed, no definition  NOTHING — renders its own text
 *     literal by intent           NOTHING — renders its own text
 *     defined, renders            NOTHING — renders the definition
 *
 * Rows two and three agree in every observable the house can read. One names a defect and the other
 * names the design, and until now nothing anywhere could tell them apart.
 *
 * ── WHAT MAKES THE ANSWER AVAILABLE ─────────────────────────────────────────────────────────────
 * Two facts, both of them recent. `grammarHeads` says which heads the grammar DECLARES, read off the
 * patterns a call must match rather than off tiddler filenames. `lar-render` says, for a head the
 * grammar declares and does not define, WHY it renders nothing — `literal` by intent, `mark` for a
 * control mark, `declares` for a form whose firing defines, `compile` for one with no render output.
 *
 * With those two, a rendered call classifies without a human reading it:
 *
 *   ARRIVED    the render differs from the call's own text — a definition ran
 *   INTENDED   renders its own text, and the head declares why (`literal` and its siblings)
 *   SLACK      renders its own text, and the grammar declares no head at all — the gradient's floor,
 *              which prose and records rely on, owed to nobody
 *   ✗ SILENT   renders its own text while the grammar DECLARES the head and names no reason —
 *              a call that looks live on the page and reaches nothing
 *
 * The last class is the one that hid every defect of the 2026-09-08 grammar session: a sigil defined
 * under a retired spelling, a shelf entry whose calls all wore the tight form, thirty-one closers
 * built and never reached. Each read green through every byte-level gate the house owns.
 *
 * ── EVERY DISTINCT CALL, NEVER A SAMPLE PER HEAD ────────────────────────────────────────────────
 * A first cut rendered ONE call per head and read green while a dead call stood in the corpus: the
 * head had healthy siblings, the sample landed on one of them, and the aggregate reported for all.
 * A witness that samples answers about the sample. So every distinct call TEXT renders — 7,199 live
 * calls carry 3,450 distinct ones — and a single dead call among healthy siblings has nowhere to hide.
 *
 * A FENCED call teaches and fires nothing, and is passed over.
 *
 * Usage: node tools/call-reach.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { readCarrier, vanishedNote } from "./corpus-read.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const TW5  = join(REPO, "packages/lararium-tw5");
const DIST = join(TW5, "dist");
for (const need of ["carrier-files.js", "grammar-heads.js", "tw5-vm.js", "generated-tw5-version.js"]) {
  if (!existsSync(join(DIST, need))) {
    console.error(`[call-reach] no built shore at ${join(DIST, need)}\n  cure: pnpm --filter @lararium/tw5 build`);
    process.exit(2);
  }
}
const { currentCarrierFiles } = await import(join(DIST, "carrier-files.js"));
const { grammarHeads }        = await import(join(DIST, "grammar-heads.js"));
const { fencedSpans, inMask } = await import(join(DIST, "meme-ast/fence-mask.js"));
// THE PARSER'S OWN WALK. A regex ending on the first `>>` stops INSIDE a value carrying a nested
// call — `"… Use the <<~ sigil>>."` — and hands back a truncated call that echoes because it is
// malformed. This witness extracts a call exactly as the rule does, or it measures its own cut.
const { sigilOpenEnd } = await import(join(DIST, "wikirules/lar-sigil-shared.js"));
const { TW5Engine }           = await import(join(DIST, "tw5-vm.js"));
const { TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME } = await import(join(DIST, "generated-tw5-version.js"));

const CORE   = join(TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME);
const PLUGIN = join(TW5, "plugins/lares-memetic-wikitext.json");
if (!existsSync(CORE)) {
  console.error(`[call-reach] no TW5 core blob at ${CORE}\n  cure: pnpm --filter @lararium/tw5 build:tw5-vendor`);
  process.exit(2);
}
const engine = new TW5Engine();
await engine.boot(new Uint8Array(readFileSync(CORE)), [JSON.parse(readFileSync(PLUGIN, "utf8"))]);
const wiki = engine.wiki ?? engine._tw?.wiki;

// THE ONE DOOR. A wiki holding the grammar answers which heads it declares; nothing here re-derives it.
const DECLARED = grammarHeads(wiki);

/** Why a declared head renders nothing, read off the tiddler that declares it. */
const REASON = new Map();
{
  const tiddlers = JSON.parse(JSON.parse(readFileSync(PLUGIN, "utf8")).text).tiddlers;
  for (const [title, t] of Object.entries(tiddlers)) {
    const r = String(t["lar-render"] ?? "");
    if (!r) continue;
    const m = /\/sigil-([\w-]+)$/.exec(title);
    if (m) REASON.set(m[1].toLowerCase(), r);
  }
}

// THE GLOBAL IMPORT PRAGMA. A raw render applies NO globals — the core carries them through
// `$:/core/config/GlobalImportFilter`, which the ViewTemplate applies. A probe that skips it reads a
// live grammar as inert, and this house has met that lie three times.
const GI = "\\import [all[shadows+tiddlers]tag[$:/tags/Global]]\n";
const render = (src) => {
  wiki.addTiddler({ title: "lar:///call-reach/probe", type: "text/vnd.tiddlywiki", text: GI + src });
  return wiki.renderTiddler("text/html", "lar:///call-reach/probe").replace(/\s+/g, " ").trim();
};
/**
 * The call went to the page AS ITS OWN TEXT — the whole call, escaped, verbatim.
 *
 * SCANNING FOR `&lt;&lt;~` ANYWHERE READS THE PAYLOAD. A call whose VALUE carries sigil-looking
 * text — `"… not a <<~>>"`, `"writes/`<<~holds x>>`"` — renders that text escaped INSIDE the span the
 * definition built, and a reader looking for the escape sequence calls a working call dead. Eleven
 * read that way before this compared against the echo it would actually produce.
 */
const escaped = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const echoed = (html, src) => html.includes(escaped(src));

// ── one live sample per head, taken from the corpus ─────────────────────────────────────────────
const HEAD = /<<~[ \t]*([A-Za-z][\w-]*)/g;
/** Every distinct call the corpus writes, with where it first stands and how often it repeats. */
const calls = new Map();
let live = 0, fenced = 0;
const heads = new Set();
for (const rel of currentCarrierFiles(REPO)) {
  const text = readCarrier(REPO, rel);
  // The enumeration read it; a parallel commit may have removed it since. Counted, never silent.
  if (text === null) continue;
  const spans = fencedSpans(text);
  HEAD.lastIndex = 0;
  let m;
  while ((m = HEAD.exec(text)) !== null) {
    if (inMask(spans, m.index)) { fenced++; continue; }
    const end = sigilOpenEnd(text, m.index);
    if (end <= m.index) continue;             // no close on this line — the rule claims nothing
    const src = text.slice(m.index, end);
    live++;
    const head = m[1].toLowerCase();
    heads.add(head);
    if (!calls.has(src)) calls.set(src, { head, rel, n: 0 });
    calls.get(src).n++;
    HEAD.lastIndex = end;                     // never re-enter a call's own value
  }
}

const classed = { arrived: [], intended: [], slack: [], silent: [] };
for (const [src, c] of calls) {
  const html = render(src);
  const row = { src, ...c };
  if (!echoed(html, src)) classed.arrived.push(row);
  else if (REASON.has(c.head)) { row.why = REASON.get(c.head); classed.intended.push(row); }
  else if (!DECLARED.has(c.head)) classed.slack.push(row);
  else classed.silent.push(row);
}

const n = (a) => a.reduce((t, r) => t + r.n, 0);
console.log(`[call-reach] ${live} live call(s) · ${fenced} fenced · ${calls.size} distinct · ${heads.size} head(s) · grammar declares ${DECLARED.size}${vanishedNote()}`);
console.log(`  ARRIVED  ${String(classed.arrived.length).padStart(3)} distinct / ${n(classed.arrived)} call(s) — a definition ran`);
console.log(`  INTENDED ${String(classed.intended.length).padStart(3)} distinct / ${n(classed.intended)} call(s) — renders its own text, and says why`);
for (const r of classed.intended) console.log(`      ${r.head} (${r.why}) ×${r.n}`);
console.log(`  SLACK    ${String(classed.slack.length).padStart(3)} distinct / ${n(classed.slack)} call(s) — the grammar declares no head; the gradient's floor, owed to nobody`);
if (classed.slack.length) {
  const byHead = new Map();
  for (const r of classed.slack) byHead.set(r.head, (byHead.get(r.head) ?? 0) + r.n);
  console.log(`      ${[...byHead].map(([h, k]) => `${h}×${k}`).join(" ")}`);
}

if (classed.silent.length === 0) {
  console.log(`  every call that looks live on the page reaches a definition, or says why it does not`);
  process.exit(0);
}
console.log(`\n  ✗ SILENT ${classed.silent.length} distinct / ${n(classed.silent)} call(s) — the grammar DECLARES the head, names no reason, and the call reaches nothing:`);
for (const r of classed.silent) console.log(`      ${r.head} ×${r.n}  ${r.rel}\n        ${r.src.slice(0, 100)}`);
process.exit(1);
