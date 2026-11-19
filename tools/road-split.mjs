// road-split — the founding road gathers its ranks and rulings from one carrier each, and this reads that the gather holds.
//
// THE ROAD SPLITS INTO TIDDLERS (operator, 2026-11-18: "that roadmap needs to get split up as separate tiddlers and a list
// widget to collect/project them into a flat file"). Each rank of `#/the-order` and each ruling of `#/rulings` stands as its
// own meme carrier under `docs/road/` (`road/rank-<rank>.mem`, `road/ruling-<group>-<slug>.mem`), tagged `road/rank` or
// `road/ruling` with a four-digit `order`; a ruling also names its `group`, the gather that seats it under its heading. The
// road keeps its frame, every slot (so each `stable-founding-road#/…` anchor still resolves) and the connective prose, and
// gathers each section by filter. A prefix holds no authority (lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout, the one
// family law): the children stand as their own memes and the road's filters gather them, so a PR that touches one rank edits
// one small file.
//
// TWO READINGS, two cadences:
//   structure — the live tree: the road holds no inline rank row or ruling bullet, every gather names children, every child
//               carries one tag, a unique order and the address its path names, and every ruling's group has a gather.
//               The self-test runs it on every push.
//   move      — the split itself: every rank and ruling the road held at a base revision stands byte for byte in exactly
//               one child, in the road's order. It runs once per split (`--base <rev>`), since a standing byte pin would
//               put every rank edit back through one shared file, the collision the split cures.
//
// Usage: node tools/road-split.mjs [--base <git rev>]
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROAD = "bags/lares/ha.ka.ba/lares/docs/stable-founding-road.mem";
export const ROAD_DIR = "bags/lares/ha.ka.ba/lares/docs/road";
/** The road's ashes: every child tagged `road/ashes`, gathered beside the road's finished prose. */
export const ROAD_ASHES = "bags/lares/ha.ka.ba/lares/docs/road-ashes.mem";
export const ROAD_URI_BASE = "lar:///ha.ka.ba/lares/docs/road/";
export const RANK_TAG = "road/rank";
export const RULING_TAG = "road/ruling";
/** The ashes mark (operator, 2026-11-19: "querying the Roadmap will only show pending work"): a road child whose work stands
 *  fully built, burned or superseded takes it, and the road's gather leaves it out. A ruling stays law and never takes it. */
export const ASHES_TAG = "road/ashes";
/** The table head the rank gather renders under. */
export const RANK_HEAD = "|! Rank |! Band |! Items |! Reason |";
// A GATHER STANDS IN BLOCK MODE: its opening tag and its body each sit between blank lines, so the transcluded table or
// list renders as a block and never inside a paragraph (an inline widget wraps a table or a list in `<p>`).
/** The one rank gather: the rows join under the head and render as ONE table (a list widget would cut one table per row). */
export const RANK_GATHER = ['<$let nl={{{ [charcode[10]] }}} rows={{{ [tag[road/rank]!tag[road/ashes]sort[order]get[text]join<nl>] }}} table={{{ [[' + RANK_HEAD + ']] [<rows>] +[join<nl>] }}}>', "", '<$transclude $variable="table" $mode="block"/>', "", "</$let>"].join("\n");
/** The ashes' rank gather: the same table, holding only the ranks in the ashes. */
export const ASHES_RANK_GATHER = RANK_GATHER.replace("[tag[road/rank]!tag[road/ashes]", "[tag[road/ashes]tag[road/rank]");
/** The ashes' gather for every other child that takes the tag. */
export const ASHES_OTHER_GATHER = ['<$list filter="[tag[road/ashes]!tag[road/rank]sort[order]]">', "", '<$transclude mode="block"/>', "", "</$list>"].join("\n");
const RULING_GATHER_BODY = ["", '<$transclude mode="block"/>', "", "</$list>"];
/** A ruling gather for one group: each ruling renders as its own block, in order. */
export const rulingGather = (group) => [`<$list filter="[tag[road/ruling]field:group[${group}]sort[order]]">`, ...RULING_GATHER_BODY].join("\n");
const RULING_GATHER_RE = /^<\$list filter="\[tag\[road\/ruling\]field:group\[([a-z0-9-]+)\]sort\[order\]\]">$/;

/** The ruling gathers of a `#/rulings` body, in order: each with its group, the heading it sits under, and whether its body stands whole. */
function rulingGathers(lines) {
  const out = [];
  let heading = null;
  lines.forEach((line, i) => {
    if (line.startsWith("!!! ")) heading = line.slice(4);
    const m = RULING_GATHER_RE.exec(line);
    if (m) out.push({ group: m[1], heading, whole: RULING_GATHER_BODY.every((l, k) => lines[i + 1 + k] === l) });
  });
  return out;
}

/** One ahu slot's body lines, by its name, from a carrier's text; null where the slot stands absent. */
export function slotLines(text, slot) {
  const lines = text.split("\n");
  const open = lines.indexOf(`<<~ ahu slot=\`${slot}\`>>`);
  if (open < 0) return null;
  const close = lines.indexOf("<<~/ahu>>", open);
  return lines.slice(open + 1, close < 0 ? lines.length : close);
}

const isRankRow = (line) => line.startsWith("| ");
const rankId = (line) => line.split("|")[1].trim();
const isRulingHead = (line) => line.startsWith("* ");
const isRulingTail = (line) => /^\*[*#]/.test(line);

/**
 * The ranks and rulings a road holds INLINE: each rank row of `#/the-order` and each ruling of `#/rulings` (a `* ` line with
 * the `**` and `*#` lines under it), with the `!!!` heading it sits under. The road at its base revision holds them all; the
 * split road holds none.
 */
export function inlineItems(text) {
  const ranks = (slotLines(text, "#/the-order") ?? []).filter(isRankRow).map((line) => ({ id: rankId(line), text: line }));
  const rulings = [];
  let heading = null, cur = null;
  for (const line of slotLines(text, "#/rulings") ?? []) {
    if (line.startsWith("!!! ")) { heading = line.slice(4); cur = null; continue; }
    if (isRulingHead(line)) { cur = { heading, lines: [line] }; rulings.push(cur); continue; }
    if (isRulingTail(line) && cur) { cur.lines.push(line); continue; }
    cur = null;
  }
  return { ranks, rulings: rulings.map((r) => ({ heading: r.heading, text: r.lines.join("\n") })) };
}

/** A carrier's root meta (flat `key = "value"` and `key = ["a", …]` rows) and its body between the meta fence and ETX. */
export function readCarrier(text) {
  const meta = /```toml meta\n([\s\S]*?)\n```\n/.exec(text);
  const fields = {};
  for (const row of (meta?.[1] ?? "").split("\n")) {
    const m = /^([a-z-]+)\s*=\s*(.+)$/.exec(row);
    if (!m) continue;
    const v = m[2].trim();
    fields[m[1]] = v.startsWith("[") ? [...v.matchAll(/"([^"]*)"/g)].map((x) => x[1]) : v.replace(/^"|"$/g, "");
  }
  const from = meta ? meta.index + meta[0].length : 0;
  const etx = text.indexOf("<<^ code=`&#x0003;`", from);
  return { fields, body: text.slice(from, etx < 0 ? text.length : etx).replace(/^\n+|\n+$/g, "") };
}

/** Every child carrier under the road's folder: its file, fields and body. */
export function readChildren(root) {
  const dir = join(root, ROAD_DIR);
  let names = [];
  try { names = readdirSync(dir).filter((n) => n.endsWith(".mem")).sort(); } catch { return []; }
  return names.map((file) => ({ file, ...readCarrier(readFileSync(join(dir, file), "utf8")) }));
}

const byOrder = (a, b) => (a.fields.order < b.fields.order ? -1 : a.fields.order > b.fields.order ? 1 : 0);
const tagged = (children, tag) => children.filter((c) => (c.fields.tags ?? []).includes(tag)).sort(byOrder);
const burned = (c) => (c.fields.tags ?? []).includes(ASHES_TAG);

/**
 * The ranks and rulings a road yields as its gathers would: the rank gather's rows in order (a rank in the ashes left out), then each ruling gather of
 * `#/rulings` in the road's order, each group's children in order, beside any item still inline. A ruling carries the
 * heading its gather sits under.
 */
export function gatheredItems(text, children) {
  const inline = inlineItems(text);
  const order = (slotLines(text, "#/the-order") ?? []).join("\n");
  const ranks = order.includes(RANK_GATHER)
    ? tagged(children, RANK_TAG).filter((c) => !burned(c)).map((c) => ({ id: rankId(c.body), text: c.body, file: c.file }))
    : [];
  const rulings = [];
  for (const g of rulingGathers(slotLines(text, "#/rulings") ?? []).filter((g) => g.whole)) {
    for (const c of tagged(children, RULING_TAG).filter((c) => c.fields.group === g.group)) rulings.push({ heading: g.heading, text: c.body, file: c.file });
  }
  return { ranks: [...inline.ranks, ...ranks], rulings: [...inline.rulings, ...rulings] };
}

/** The structure faults of a split road and its children, each a sentence; none where the split holds. */
export function structureFaults(text, children) {
  const faults = [];
  const inline = inlineItems(text);
  for (const r of inline.ranks) faults.push(`the road holds rank ${r.id} inline; it stands in road/rank-${r.id}.mem`);
  for (const r of inline.rulings) faults.push(`the road holds a ruling inline under "${r.heading}": ${r.text.slice(0, 60)}…`);
  const order = slotLines(text, "#/the-order") ?? [];
  if (!order.join("\n").includes(RANK_GATHER)) faults.push("#/the-order holds no whole rank gather");
  if (order.includes(RANK_HEAD)) faults.push("#/the-order holds the rank table's head beside the gather, which renders it");
  const gathers = rulingGathers(slotLines(text, "#/rulings") ?? []);
  for (const g of gathers.filter((g) => !g.whole)) faults.push(`the ruling gather for group ${g.group} stands broken: its body leaves the block form`);
  const groups = new Set(gathers.map((g) => g.group));
  if (groups.size === 0) faults.push("#/rulings holds no ruling gather");
  for (const tag of [RANK_TAG, RULING_TAG]) {
    const seen = new Map();
    for (const c of tagged(children, tag)) {
      if (!/^\d{4}$/.test(c.fields.order ?? "")) faults.push(`${c.file} carries order "${c.fields.order}", never four digits`);
      if (seen.has(c.fields.order)) faults.push(`${c.file} and ${seen.get(c.fields.order)} share order ${c.fields.order}`);
      seen.set(c.fields.order, c.file);
    }
  }
  for (const g of groups) if (!tagged(children, RULING_TAG).some((c) => c.fields.group === g)) faults.push(`the ruling gather for group ${g} gathers nothing`);
  for (const c of children) {
    const stem = c.file.replace(/\.mem$/, "");
    const tags = (c.fields.tags ?? []).filter((t) => t === RANK_TAG || t === RULING_TAG);
    if (tags.length !== 1) faults.push(`${c.file} carries ${tags.length} road tags, never one`);
    if (c.fields.title !== ROAD_URI_BASE + stem) faults.push(`${c.file} names title ${c.fields.title}, never ${ROAD_URI_BASE + stem}`);
    if (c.fields["uri-path"] !== (ROAD_URI_BASE + stem).slice("lar:///".length)) faults.push(`${c.file} names uri-path ${c.fields["uri-path"]}`);
    if (tags[0] === RANK_TAG && (!stem.startsWith("rank-") || c.body.split("\n").length !== 1 || !isRankRow(c.body) || `rank-${rankId(c.body)}` !== stem)) faults.push(`${c.file} holds no single row of its own rank`);
    if (tags[0] === RULING_TAG && (!stem.startsWith("ruling-") || !isRulingHead(c.body) || c.body.split("\n").slice(1).some((l) => !isRulingTail(l)))) faults.push(`${c.file} holds no single ruling`);
    if (tags[0] === RULING_TAG && burned(c)) faults.push(`${c.file} carries ${ASHES_TAG}; a ruling stays law and never takes it`);
    if (tags[0] === RULING_TAG && !groups.has(c.fields.group)) faults.push(`${c.file} names group ${c.fields.group}, which no gather in #/rulings seats`);
  }
  return faults;
}

/** The ashes' faults: the carrier holds both whole gathers, and each child in the ashes carries a road tag of its own. */
export function ashesFaults(text, children) {
  if (text === null) return [`the road's ashes stand absent (${ROAD_ASHES})`];
  const faults = [];
  if (!text.includes(ASHES_RANK_GATHER)) faults.push("the ashes hold no whole rank gather");
  if (!text.includes(ASHES_OTHER_GATHER)) faults.push("the ashes hold no whole gather for their other children");
  for (const c of children.filter(burned)) if (!(c.fields.tags ?? []).some((t) => t === RANK_TAG || t === RULING_TAG)) faults.push(`${c.file} carries ${ASHES_TAG} beside no road tag`);
  return faults;
}

/** The ranks the ashes gather, in order. */
export const ashesRanks = (children) => tagged(children, RANK_TAG).filter(burned).map((c) => ({ id: rankId(c.body), text: c.body, file: c.file }));

/** The move faults: each base item stands byte for byte in exactly one gathered place, in the base's order, and nothing more. */
export function moveFaults(base, gathered) {
  const faults = [];
  const key = (kind, r) => (kind === "ruling" ? `${r.heading}\u0000${r.text}` : r.text);
  for (const kind of ["rank", "ruling"]) {
    const was = base[`${kind}s`], now = gathered[`${kind}s`];
    const count = new Map();
    for (const r of now) count.set(key(kind, r), (count.get(key(kind, r)) ?? 0) + 1);
    for (const r of was) {
      const n = count.get(key(kind, r)) ?? 0;
      if (n !== 1) faults.push(`${kind} ${kind === "rank" ? r.id : `"${r.text.slice(0, 60)}…"`} stands ${n} times in the gathered road, never once`);
    }
    if (was.length !== now.length) faults.push(`the base road holds ${was.length} ${kind}s and the gathered road ${now.length}`);
    const at = now.map((r) => key(kind, r));
    for (let i = 0; i < Math.min(was.length, now.length); i++) {
      if (at[i] !== key(kind, was[i])) { faults.push(`the ${kind}s leave the base order at position ${i + 1}`); break; }
    }
  }
  return faults;
}

export function main(argv, root = fileURLToPath(new URL("..", import.meta.url))) {
  const i = argv.indexOf("--base");
  const text = readFileSync(join(root, ROAD), "utf8");
  const children = readChildren(root);
  const faults = structureFaults(text, children);
  let ashes = null;
  try { ashes = readFileSync(join(root, ROAD_ASHES), "utf8"); } catch { /* absent: the fault names it */ }
  faults.push(...ashesFaults(ashes, children));
  if (i >= 0) {
    const baseText = execFileSync("git", ["-C", root, "show", `${argv[i + 1]}:${ROAD}`], { encoding: "utf8", maxBuffer: 1 << 26 });
    faults.push(...moveFaults(inlineItems(baseText), gatheredItems(text, children)));
  }
  const g = gatheredItems(text, children);
  console.log(`[road-split] ${children.length} child carrier(s); the road gathers ${g.ranks.length} rank(s) and ${g.rulings.length} ruling(s); the ashes ${ashesRanks(children).length} rank(s)`);
  for (const f of faults) console.log(`[road-split] FAULT ${f}`);
  return faults.length === 0 ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv.slice(2));
