/**
 * turn-parity — the harvester's reading of a TURN, measured against the wiki's own.
 *
 * ── THE INVARIANT THIS HOLDS ─────────────────────────────────────────────────────────────────────
 * Two readers now read one turn, and they answer DIFFERENT QUESTIONS. Neither replaces the other.
 *
 *   the harvester (`harvestTurnGradient`, @lararium/mesh) answers WHAT THE AUTHOR REACHED FOR — every
 *     `<<~ …>>` the source carries, the Voices surfacing in prose, the phase glyphs riding the prose,
 *     the water it could not classify, and a standing on the gradient. It reads text a wiki never
 *     stored, written under whatever frame stood that week.
 *   the wiki (`TW5Engine` + `wiki.parseText`, @lararium/tw5) answers WHAT THE HOUSE WILL DO — which
 *     of those spans become a node, which node resolves to a definition, and which render verbatim.
 *
 * THE ONE PLACE THEY MUST AGREE, and the one this witness fails on: a sigil the SHELF registers,
 * standing in open prose, quoted, outside a block body. There the harvester's classification and the
 * parser's node must name the same head at the same offset, and a `set` panel's named keys must read
 * the same on both sides. Every other difference belongs to a NAMED CLASS below, counted as measured
 * debt, never as a red — a standing failure shrinks a check to nothing.
 *
 * ── THE CLASSES, MEASURED ────────────────────────────────────────────────────────────────────────
 *   shelf-blind        the shelf registers the head; the harvester's KNOWN_KINDS does not, so the
 *                      harvester counts WATER where a real sigil fired. THE HARVESTER IS WRONG here,
 *                      and its cure reads: derive the head set from the shelf, never by hand.
 *   invented-head      the parser builds a node for ANY head, defined or not — `<<~ wibblefish a b>>`
 *                      yields `$variable: "~wibblefish"` and RENDERS VERBATIM. A node proves a shape,
 *                      never a call. The harvester's water is the honest reading; a witness that took
 *                      the parse tree alone as the roster would swear a nonsense verb into the grammar.
 *   unquoted-positional  `<<~loulou lar:///a.b.c>>` builds NO node and renders escaped, because TW5
 *                      reads `lar:` as a named parameter and the call never happens. THE PARSER IS
 *                      RIGHT; the harvester reports a firing the house never performed. See
 *                      lar:///ha.ka.ba/lares/docs/tw5-calls-colon-caveat.
 *   block-interior     a block sigil (`<<~ ahu #x>> … <<~/ahu>>`) consumes its body: the parse tree
 *                      holds ONE `~ahu` node whose only child reads its own source, and the render
 *                      emits an EMPTY `lar-ahu-body`. Sigils written inside reach neither tree nor
 *                      page. THE PARSER IS RIGHT about the render; the harvester is right that the
 *                      source carries them, which is why the salvage tier reads the harvester.
 *   degraded-head      `<<~ward!>>` builds no node and renders verbatim; the harvester's leading-word
 *                      reader strips the mark and invents a head the grammar refuses. THE PARSER IS
 *                      RIGHT — a mark on the head is a mark on the call.
 *   masked             a fence or a tick span swallows the sigil; the parser yields no node. THE
 *                      PARSER IS RIGHT — masking is a grammar fact no pattern carries.
 *   closer             `<<~/ahu>>` classifies for neither reader and belongs to neither census.
 *   bare frame         `<<~ lares aim>>` speaks no address: the harvester reads no bearing, the parser
 *                      stands a node, and BOTH say the same thing about the same span.
 *
 * ── WHAT ONLY ONE READER HAS, AND WHY THE PAIR STAYS ─────────────────────────────────────────────
 * The harvester alone carries Voices, phase glyphs, water counts, drift flags and the 0..20 standing;
 * `parseText` has no notion of any of them, and prose is where they live. The wiki alone carries
 * masking, block consumption, definition resolution and typed attribute values; no pattern reaches
 * them. Collapsing either reader into the other would delete a question, not a duplication.
 *
 * ── WHAT THE PUBLISHED SURFACE DOES NOT REACH ────────────────────────────────────────────────────
 * `@lararium/tw5` exports no door to the LOADED grammar — `getGrammar()` / `GRAMMAR_TAG` stay inside
 * `grammar-cache.ts`. So the registered-head set here reads the shelf tiddlers off the packed plugin,
 * the same re-derivation `sigil-parity.mjs` performs with `ls sigil-*.tid`. Two witnesses now derive
 * a fact the package holds; that is a reported finding, not a cure applied here.
 *
 * Reader B reflects WHATEVER BUILD STANDS in `packages/lararium-tw5/plugins/` and `dist/`. A stale
 * pack reports the gap between two builds as readers disagreeing.
 *
 * ── THE RULING THIS WITNESS HOLDS ────────────────────────────────────────────────────────────────
 * MEASURED, on 87 turns drawn from 44 carriers: 304 panel keys read IDENTICALLY on both sides, zero
 * drift, and the two readers name the same head at the same offset on 77 turns whole. Where they part,
 * every difference falls in a class above, and each class has a side that decides.
 *
 * KEEP BOTH. The pair costs one thing only — the harvester's KNOWN_KINDS enumerates by hand what the
 * shelf declares, and a hand-written enumeration cannot notice what it missed: `kau`, `pranala`,
 * `lele`, `let`, `link`, `meme` and `mukuwai` gained shelf entries, render as real calls, and read as
 * WATER to the harvester. That is the only measured cost of the pair, and it is a drift in ONE
 * direction with a named cure: derive the head set from the shelf, never by hand.
 *
 * DO NOT COLLAPSE EITHER INTO THE OTHER. The parse tree cannot tell a call from a shape — the parser
 * hands back `$variable: "~wibblefish"` for a verb nobody defined, and a harvester rebuilt on it would
 * swear invented heads into the grammar. The pattern cannot tell a span from a render — a sigil inside
 * a fence, a tick span, or a block body reaches no page, and a harvester that counted them reports
 * firings the house never performed. Voices, phase glyphs, water and the 0..20 standing exist only on
 * the harvester's side; masking, block consumption, definition resolution and typed values exist only
 * on the wiki's. Each reader answers a question the other cannot form.
 *
 * THE DIVISION OF LABOUR THAT READS HONESTLY: the harvester reads what a turn REACHED FOR, off text no
 * wiki ever held; the wiki reads what a turn PERFORMS. This witness holds them to one another exactly
 * where both claims apply — a registered head, quoted, in open prose, outside a block.
 *
 * Exit 0 = every divergence falls in a named class. Exit 1 = a divergence nobody has named.
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = process.env["REPO"] ?? join(HERE, "..");
const TW5 = join(REPO, "packages/lararium-tw5");
const MESH_DIST = join(REPO, "packages/lararium-mesh/dist/index.js");
const PLUGIN = join(TW5, "plugins/lares-memetic-wikitext.json");

for (const [need, cure] of [
  [MESH_DIST, "pnpm --filter @lararium/mesh build"],
  [join(TW5, "dist/tw5-vm.js"), "pnpm --filter @lararium/tw5 build"],
  [join(TW5, "dist/sigil-attrs.js"), "pnpm --filter @lararium/tw5 build"],
  [PLUGIN, "pnpm --filter @lararium/tw5 build:plugin"],
]) {
  if (!existsSync(need)) {
    console.error(`[turn-parity] absent: ${need}\n  cure: ${cure}`);
    process.exit(2);
  }
}

const { harvestTurnGradient } = await import(MESH_DIST);
const { schemeShapedPositionals } = await import(join(TW5, "dist/sigil-attrs.js"));
const { TW5Engine } = await import(join(TW5, "dist/tw5-vm.js"));
const { TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME } = await import(join(TW5, "dist/generated-tw5-version.js"));

const CORE = join(TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME);
if (!existsSync(CORE)) {
  console.error(`[turn-parity] no TW5 core blob at ${CORE}\n  cure: pnpm --filter @lararium/tw5 build:tw5-vendor`);
  process.exit(2);
}

const pluginJson = JSON.parse(readFileSync(PLUGIN, "utf8"));
const engine = new TW5Engine();
await engine.boot(new Uint8Array(readFileSync(CORE)), [pluginJson]);
const wiki = engine.wiki ?? engine._tw?.wiki;

// ── THE SHELF ───────────────────────────────────────────────────────────────────────────────────
// A head the grammar registers, read off the packed plugin's SharktoothSigil tiddlers. The head is
// the tiddler's own name, so a sigil added by tagging a tiddler enters this set with no code change.
const GRAMMAR_TAG = "lar:///ha.ka.ba/tags/SharktoothSigil";
const SHELF = new Set();
{
  const tiddlers = JSON.parse(pluginJson.text).tiddlers;
  for (const [title, t] of Object.entries(tiddlers)) {
    if (!String(t.tags ?? "").includes(GRAMMAR_TAG)) continue;
    const m = /\/sigil-([\w-]+)$/.exec(title);
    if (m) SHELF.add(m[1].toLowerCase());
  }
}

// ── THE CORPUS ──────────────────────────────────────────────────────────────────────────────────
// A TURN anchors at `<<~ lares aim` and runs to its `lares yield` close, or to the next aim. The span
// is CLAMPED to its fence: an aim written inside a worked example must not carry the example's closing
// fence into the reading, or the parser sees a fence OPEN where the author wrote one shut — measured,
// and it manufactured 14 divergences that belonged to the extractor, not to either reader.
const AIM = /<<~[ \t]*lares[ \t]+aim\b/g;
const YIELD = /<<~[ \t]*lares[ \t]+yield\b[^>]*>>/g;
const FENCE = /^[ \t]*```[^\n]*\n/gm;
const TURN_CAP = 8000;

/** Interior spans of every fenced block, in reading order. */
function fenceInteriors(text) {
  const out = [];
  let open = null;
  for (const m of text.matchAll(FENCE)) {
    if (open === null) open = m.index + m[0].length;
    else { out.push([open, m.index]); open = null; }
  }
  return out;
}

const files = execSync(
  "grep -rl '<<~[ \t]*lares[ \t]*aim' . " +
    "--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=dist-plugin " +
    "--exclude-dir=.worktrees --exclude-dir=tw5-core --exclude-dir=genesis --exclude-dir=__pycache__ " +
    "--exclude-dir=tools 2>/dev/null || true",
  { cwd: REPO, encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean)
  .filter((f) => !/\.(pyc|json)$/.test(f))
  .map((f) => f.replace(/^\.\//, ""));

const turns = [];
for (const rel of files) {
  let text;
  try { text = readFileSync(join(REPO, rel), "utf8"); } catch { continue; }
  const fences = fenceInteriors(text);
  // AN ANCHOR INSIDE A TICK SPAN NAMES NO TURN. `the \`<<~ lares aim … yield …>>\` frame` mentions the
  // shape in prose; reading it as a turn hands the parser an unbalanced backtick that swallows every
  // sigil after it, and the extractor's own artifact reports as three readers disagreeing.
  const ticks = [...text.matchAll(/`[^`\n]+`/g)].map((m) => [m.index, m.index + m[0].length]);
  const aims = [...text.matchAll(AIM)].map((m) => m.index).filter((i) => !ticks.some(([x, y]) => i >= x && i < y));
  for (const start of aims) {
    const fence = fences.find(([a, b]) => start >= a && start < b);
    let hi = fence ? fence[1] : text.length;
    if (!fence) {
      const next = fences.find(([a]) => a > start);
      if (next) hi = Math.min(hi, next[0]);
    }
    const nextAim = aims.find((x) => x > start);
    if (nextAim !== undefined) hi = Math.min(hi, nextAim);
    YIELD.lastIndex = start;
    const y = YIELD.exec(text);
    const end = y && y.index < hi ? y.index + y[0].length : Math.min(hi, start + TURN_CAP);
    turns.push({ rel, offset: start, fenced: Boolean(fence), text: text.slice(start, end) });
  }
}

// ── READER B: the parse the wiki performs ───────────────────────────────────────────────────────
// A sigil node carries its host in `$variable` — `~<head>` for the speaking host once the shelf binds
// the head, a bare `~` when nothing bound it. `args`, `src` and `p1..p5` ride as grammar plumbing and
// name no parameter the author wrote.
const PLUMBING = new Set(["$variable", "args", "src", "p1", "p2", "p3", "p4", "p5"]);

function transcludes(nodes, out = []) {
  for (const n of nodes ?? []) {
    if (n.type === "transclude" && n.attributes) out.push(n);
    transcludes(n.children, out);
  }
  return out;
}

function readerB(text) {
  let tree;
  try { tree = wiki.parseText("text/vnd.tiddlywiki", text, { parseAsInline: false }).tree; }
  catch (err) { return { error: String(err), nodes: [] }; }
  const out = [];
  for (const n of transcludes(tree)) {
    const host = n.attributes.$variable?.value ?? "";
    if (!host.startsWith("~") && host !== "^") continue;
    let head = host === "^" ? "^" : host.slice(1).toLowerCase();
    if (!head) head = String(n.attributes["0"]?.value ?? "").toLowerCase();
    const keys = {};
    for (const [k, a] of Object.entries(n.attributes)) {
      if (PLUMBING.has(k) || /^\d+$/.test(k) || a.isPositional) continue;
      keys[k.toLowerCase()] = a.type === "string" ? a.value : `«${a.type}»`;
    }
    out.push({ head, offset: n.start, keys, src: text.slice(n.start, n.end) });
  }
  return { nodes: out };
}

// ── THE NAMED CLASSES ───────────────────────────────────────────────────────────────────────────
const OPENER = /<<~/g;
const BLOCK_OPEN = /<<~[ \t]*([A-Za-z][\w-]*)\b[^>]*>>/g;
const CLOSER = /<<~[ \t]*\/[A-Za-z]/;
/** A head wearing a mark the parser refuses — `<<~ward!>>` renders verbatim, and no call happens. */
const DEGRADED_HEAD = /^<<~[ \t]*[A-Za-z][\w-]*[^\s\w->]/;

/** Interiors of every block sigil — `<<~ x …>> … <<~/x>>` — whose body the parser consumes. */
function blockInteriors(text) {
  const out = [];
  BLOCK_OPEN.lastIndex = 0;
  for (const m of text.matchAll(BLOCK_OPEN)) {
    const head = m[1].toLowerCase();
    const close = new RegExp(`<<~[ \\t]*/${head}\\b[^>]*>>`, "g");
    close.lastIndex = m.index + m[0].length;
    const c = close.exec(text);
    if (c) out.push([m.index + m[0].length, c.index]);
  }
  return out;
}

/** Spans a fence or a tick run masks, where the parser rightly builds nothing. */
function maskedSpans(text) {
  const out = fenceInteriors(text);
  for (const m of text.matchAll(/`[^`\n]+`/g)) out.push([m.index, m.index + m[0].length]);
  return out;
}

const inAny = (spans, off) => spans.some(([a, b]) => off >= a && off < b);

// ── THE MEASUREMENT ─────────────────────────────────────────────────────────────────────────────
const classes = { "shelf-blind": [], "invented-head": [], "unquoted-positional": [], "block-interior": [], "degraded-head": [], masked: [], closer: [] };
const unclassified = [];
const keyDrift = [];
const bearingDrift = [];
let agreed = 0, aIslands = 0, bNodes = 0, panelsCompared = 0, keysCompared = 0;
let voices = 0, phases = 0, water = 0, bareFrames = 0;

for (const turn of turns) {
  const a = harvestTurnGradient(turn.text);
  const b = readerB(turn.text);
  const blocks = blockInteriors(turn.text);
  const masks = maskedSpans(turn.text);

  // A's classified islands, keyed by offset; panels ride as head `set`.
  const aBy = new Map();
  for (const s of a.sigils) aBy.set(s.offset, { head: s.head, raw: s.raw });
  for (const p of a.panels) aBy.set(p.offset, { head: "set", raw: p.raw, keys: p.keys });
  // The bearing rides its OWN axis: the harvester folds `lares aim` / `lares yield` into one reading
  // and publishes no island offset for either, so a head census that kept them would report the
  // harvester blind to every frame it in fact read.
  const isBearing = (n) => n.head === "lares" && /^<<~[ \t]*lares[ \t]+(aim|yield)\b/.test(n.src);
  const bBy = new Map(b.nodes.filter((n) => !isBearing(n)).map((n) => [n.offset, n]));
  aIslands += aBy.size;
  bNodes += bBy.size;
  voices += a.voices.length;
  phases += a.phases.length;
  water += a.waterCount;

  let clean = !b.error;

  // the BEARING axis — the harvester folds `lares aim`/`lares yield` into one reading; the parser
  // leaves them as `~lares` nodes and never names a bearing.
  const bBearings = b.nodes.filter(isBearing).length;
  // A BARE FRAME SPEAKS NO BEARING. `<<~ lares aim>>` carries no address, so the harvester rightly
  // reads no bearing while the parser rightly stands a `~lares` node — both say the same thing about
  // the same span. Only an ADDRESSED frame the harvester failed to read counts as drift.
  const addressed = b.nodes.filter((n) => isBearing(n) && /lar:\/\//.test(n.src)).length;
  if (a.bearing === null && addressed > 0) {
    bearingDrift.push({ rel: turn.rel, offset: turn.offset, a: false, b: addressed });
    clean = false;
  }
  if (a.bearing !== null && bBearings === 0) {
    bearingDrift.push({ rel: turn.rel, offset: turn.offset, a: true, b: 0 });
    clean = false;
  }
  if (a.bearing === null && bBearings > 0 && addressed === 0) bareFrames += bBearings;

  for (const [off, node] of bBy) {
    if (aBy.has(off)) continue;
    const where = { rel: turn.rel, offset: turn.offset + off, head: node.head, src: node.src.slice(0, 90) };
    if (SHELF.has(node.head)) classes["shelf-blind"].push(where);
    else classes["invented-head"].push(where);
    clean = false;
  }

  for (const [off, island] of aBy) {
    if (bBy.has(off)) continue;
    const where = { rel: turn.rel, offset: turn.offset + off, head: island.head, src: island.raw.slice(0, 90) };
    const body = island.raw.replace(/^<<~?[ \t]*/, "").replace(/>>\s*$/, "");
    if (CLOSER.test(island.raw)) classes.closer.push(where);
    else if (inAny(masks, off)) classes.masked.push(where);
    else if (inAny(blocks, off)) classes["block-interior"].push(where);
    else if (schemeShapedPositionals(body).length > 0) classes["unquoted-positional"].push(where);
    else if (DEGRADED_HEAD.test(island.raw)) classes["degraded-head"].push(where);
    else unclassified.push(where);
    clean = false;
  }

  // ── THE PANEL KEYS — the sharpest parity, since both readers claim to read named parameters ──
  for (const [off, island] of aBy) {
    if (island.head !== "set" || !bBy.has(off)) continue;
    panelsCompared++;
    const theirs = bBy.get(off).keys;
    for (const [k, v] of Object.entries(island.keys ?? {})) {
      keysCompared++;
      if (!(k in theirs)) { keyDrift.push({ rel: turn.rel, offset: turn.offset + off, key: k, a: v, b: "(absent)" }); clean = false; continue; }
      if (theirs[k] !== v) { keyDrift.push({ rel: turn.rel, offset: turn.offset + off, key: k, a: v, b: theirs[k] }); clean = false; }
    }
    for (const k of Object.keys(theirs)) {
      if (!(k in (island.keys ?? {}))) { keyDrift.push({ rel: turn.rel, offset: turn.offset + off, key: k, a: "(absent)", b: theirs[k] }); clean = false; }
    }
  }

  if (clean) agreed++;
}

// ── THE REPORT ──────────────────────────────────────────────────────────────────────────────────
const fenced = turns.filter((t) => t.fenced).length;
console.log(
  `[turn-parity] ${turns.length} turns · ${files.length} carriers (${fenced} written inside a fence) · ` +
    `${aIslands} harvester islands · ${bNodes} parser nodes · ${agreed} turns agree whole`,
);
console.log(`  shelf registers ${SHELF.size} heads · harvester also read ${voices} Voices, ${phases} phase glyphs, ${water} water openers the parser has no notion of`);
console.log(`  bare frames (`+"`<<~ lares aim>>`"+`, no address spoken — both readers agree there is nothing to bear): ${bareFrames}`);
console.log(`  panel keys compared: ${keysCompared} across ${panelsCompared} panels · ${keyDrift.length} DRIFT`);

const NOTE = {
  "shelf-blind": "the shelf registers the head, the harvester's KNOWN_KINDS does not — THE HARVESTER IS WRONG; derive the set from the shelf",
  "invented-head": "the parser builds a node for any head and RENDERS IT VERBATIM — a node proves a shape, never a call; the harvester's water reads honestly",
  "unquoted-positional": "TW5 reads `lar:` as a named parameter, so the call never happens and the span renders escaped — THE PARSER IS RIGHT",
  "block-interior": "a block sigil consumes its body: no node, and the render emits an empty body — THE PARSER IS RIGHT about the page, the harvester about the source",
  masked: "a fence or tick span swallows the sigil — THE PARSER IS RIGHT; masking is a grammar fact no pattern carries",
  "degraded-head": "a head wearing a mark — `<<~ward!>>` — builds no node and RENDERS VERBATIM; the harvester's leading-word reader invents a head the grammar refuses — THE PARSER IS RIGHT",
  closer: "`<<~/x>>` closes a block and classifies for neither reader",
};

for (const [name, hits] of Object.entries(classes)) {
  const carriers = new Set(hits.map((h) => h.rel));
  console.log(`\n  ${name}: ${hits.length} in ${carriers.size} carriers`);
  console.log(`    ${NOTE[name]}`);
  const byHead = new Map();
  for (const h of hits) byHead.set(h.head, (byHead.get(h.head) ?? 0) + 1);
  if (byHead.size) console.log(`    heads: ${[...byHead].sort((x, y) => y[1] - x[1]).map(([h, n]) => `${h}×${n}`).join(" · ")}`);
  for (const h of hits.slice(0, 8)) console.log(`      ${h.rel}@${h.offset}  ${h.head}  ${JSON.stringify(h.src)}`);
  if (hits.length > 8) console.log(`      …and ${hits.length - 8} more`);
}

if (bearingDrift.length) {
  console.log(`\n  bearing axis: ${bearingDrift.length} turns where a bearing reads on one side only`);
  for (const d of bearingDrift.slice(0, 8)) console.log(`      ${d.rel}@${d.offset}  harvester=${d.a}  parser lares-nodes=${d.b}`);
}

if (keyDrift.length) {
  console.log("\n  a panel key reads differently on the two sides — the parser decides:");
  for (const d of keyDrift.slice(0, 20)) {
    console.log(`      ${d.rel}@${d.offset}  ${d.key}=\n        harvester ${JSON.stringify(d.a)}\n        parser    ${JSON.stringify(d.b)}`);
  }
  if (keyDrift.length > 20) console.log(`      …and ${keyDrift.length - 20} more`);
}

if (unclassified.length) {
  console.log(`\n  UNCLASSIFIED — a divergence nobody has named:`);
  for (const h of unclassified.slice(0, 20)) console.log(`      ${h.rel}@${h.offset}  ${h.head}  ${JSON.stringify(h.src)}`);
  if (unclassified.length > 20) console.log(`      …and ${unclassified.length - 20} more`);
} else {
  console.log("\n  every divergence falls in a named class; nothing unaccounted");
}

// ── THE ENUMERATION MUST COVER THE SHELF ─────────────────────────────────────────────────────────
// `shelf-blind` above catches a miss a TURN happened to exercise. That answers a weaker question than
// the one worth asking: FOUR misses surfaced across eighty-seven worked examples, while the sets
// themselves disagreed on sixty-one heads. A corpus of examples cannot report what no example wrote.
//
// So the law reads the two sets directly and compares them, and it fails. A hand-written enumeration
// stands honest only while something proves it complete — the harvester keeps its purity (no I/O in
// the parse path, by its own design) and this witness carries the proof.
const HARVEST_SRC = join(REPO, "packages/lararium-mesh/src/turn-harvest.ts");
const KNOWN_BODY = /const KNOWN_KINDS = new Set\(\[([\s\S]*?)\]\)/.exec(readFileSync(HARVEST_SRC, "utf8"))?.[1] ?? "";
const KNOWN = new Set([...KNOWN_BODY.matchAll(/"([^"]+)"/g)].map((m) => m[1].toLowerCase()));

// A HEAD IS WHAT A CALL WEARS, read off the shelf's own patterns — never off a tiddler's filename.
// `sigil-frame-etx` and `sigil-dispatcher` name tiddlers no `<<~ …>>` call ever spells.
const SHELF_HEADS = new Set();
{
  const tiddlers = JSON.parse(pluginJson.text).tiddlers;
  for (const t of Object.values(tiddlers)) {
    if (!String(t.tags ?? "").includes(GRAMMAR_TAG)) continue;
    for (const fld of ["lar-pattern", "lar-open-pattern"]) {
      const h = /<<~!?\\s\*([A-Za-z][\w-]*)/.exec(String(t[fld] ?? ""));
      if (h) SHELF_HEADS.add(h[1].toLowerCase());
    }
  }
}
const uncovered = [...SHELF_HEADS].filter((h) => !KNOWN.has(h)).sort();
console.log(`\n  KNOWN_KINDS covers ${SHELF_HEADS.size - uncovered.length} of ${SHELF_HEADS.size} shelf heads`);
if (uncovered.length) {
  console.log(`  ${uncovered.length} head(s) the shelf declares and the harvester counts as WATER:`);
  console.log("      " + uncovered.join(" "));
  console.log("  a turn firing any of these reads as a turn that fired nothing");
}

const red = unclassified.length + keyDrift.length + uncovered.length;
process.exit(red ? 1 : 0);
