// road-split.test — the founding road gathers each rank and ruling from its own carrier: the live tree's structure, and the
// move witness's reds planted against a small road and its children.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { RANK_GATHER, RANK_HEAD, ROAD, ROAD_URI_BASE, gatheredItems, inlineItems, moveFaults, readCarrier, readChildren, rulingGather, slotLines, structureFaults } from "./road-split.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LIVE = readFileSync(join(ROOT, ROAD), "utf8");

// ── the live road ───────────────────────────────────────────────────────────────────────────────────────────────────────

test("road-split-live: the road holds no inline rank or ruling, and every child stands once, tagged, ordered and addressed", () => {
  const children = readChildren(ROOT);
  assert.deepEqual(structureFaults(LIVE, children), []);
  const g = gatheredItems(LIVE, children);
  assert.ok(g.ranks.length >= 60, `the road gathers ${g.ranks.length} ranks; it holds more`);
  assert.ok(g.rulings.length >= 280, `the road gathers ${g.rulings.length} rulings; it holds more`);
  assert.equal(g.ranks.length + g.rulings.length, children.length, "every child stands in exactly one gather");
});

test("road-split-anchors: every slot a `stable-founding-road#/…` cite names still stands in the road", () => {
  for (const slot of ["#/the-attractor", "#/the-order", "#/milestones", "#/the-leaps", "#/cold-start", "#/rulings", "#/decisions", "#/the-road",
    "#/the-loops", "#/stride-0-hearth", "#/stride-t-recut", "#/stride-1-spine", "#/after-the-seat", "#/the-trains", "#/side-lanes", "#/fresh-start", "#/open"]) {
    assert.ok(slotLines(LIVE, slot), `${slot} stands`);
  }
});

// ── the move witness, planted ───────────────────────────────────────────────────────────────────────────────────────────

const road = (order, rulings) => [
  "<<~ ahu slot=`#/the-order`>>", "", "!! The order", "", ...order, "", "<<~/ahu>>", "",
  "<<~ ahu slot=`#/rulings`>>", "", "!! Rulings", "", ...rulings, "", "<<~/ahu>>", "",
].join("\n");
const carrier = (stem, fields, body) => readCarrier([
  "<<^ code=`&#x0002;`>>", "", "```toml meta",
  ...Object.entries({ ...fields, title: ROAD_URI_BASE + stem, "uri-path": (ROAD_URI_BASE + stem).slice(7) }).map(([k, v]) => `${k} = ${Array.isArray(v) ? `[${v.map((x) => `"${x}"`).join(", ")}]` : `"${v}"`}`),
  "```", "", body, "", "<<^ code=`&#x0003;` bcc=`ni:///sha-256;x`>>",
].join("\n"));
const child = (stem, fields, body) => ({ file: `${stem}.mem`, ...carrier(stem, fields, body) });
const BASE = road([RANK_HEAD, "| 2 | NOW | a | b |", "| 4j | NEXT | c | d |"], ["!!! First", "* ''One'' ruling.", "** its tail", "* ''Two'' ruling.", "", "!!! Second", "A paragraph stays.", "* ''Three'' ruling."]);
const SPLIT = road([RANK_GATHER], ["!!! First", "", rulingGather("first"), "", "!!! Second", "", "A paragraph stays.", "", rulingGather("second")]);
const KIDS = [
  child("rank-2", { order: "0010", tags: ["road/rank"] }, "| 2 | NOW | a | b |"),
  child("rank-4j", { order: "0020", tags: ["road/rank"] }, "| 4j | NEXT | c | d |"),
  child("ruling-first-one", { group: "first", order: "0010", tags: ["road/ruling"] }, "* ''One'' ruling.\n** its tail"),
  child("ruling-first-two", { group: "first", order: "0020", tags: ["road/ruling"] }, "* ''Two'' ruling."),
  child("ruling-second-three", { group: "second", order: "0030", tags: ["road/ruling"] }, "* ''Three'' ruling."),
];

test("road-split-move CONTROL: a true split reads no structure fault and no move fault", () => {
  assert.equal(inlineItems(BASE).ranks.length, 2);
  assert.equal(inlineItems(BASE).rulings.length, 3);
  assert.deepEqual(structureFaults(SPLIT, KIDS), []);
  assert.deepEqual(moveFaults(inlineItems(BASE), gatheredItems(SPLIT, KIDS)), []);
});

test("road-split-move RED: a dropped, reworded, doubled or reordered item reads by name", () => {
  const dropped = KIDS.filter((k) => k.file !== "ruling-first-two.mem");
  assert.match(moveFaults(inlineItems(BASE), gatheredItems(SPLIT, dropped)).join("\n"), /"\* ''Two'' ruling\.…" stands 0 times/);
  const reworded = KIDS.map((k) => (k.file === "rank-4j.mem" ? { ...k, body: "| 4j | NEXT | c | changed |" } : k));
  assert.match(moveFaults(inlineItems(BASE), gatheredItems(SPLIT, reworded)).join("\n"), /rank 4j stands 0 times/);
  const doubled = [...KIDS, child("ruling-second-again", { group: "second", order: "0040", tags: ["road/ruling"] }, "* ''Three'' ruling.")];
  assert.match(moveFaults(inlineItems(BASE), gatheredItems(SPLIT, doubled)).join("\n"), /stands 2 times/);
  const reordered = KIDS.map((k) => (k.file === "rank-2.mem" ? { ...k, fields: { ...k.fields, order: "0030" } } : k));
  assert.match(moveFaults(inlineItems(BASE), gatheredItems(SPLIT, reordered)).join("\n"), /ranks leave the base order at position 1/);
  const moved = KIDS.map((k) => (k.file === "ruling-second-three.mem" ? { ...k, fields: { ...k.fields, group: "first" } } : k));
  assert.match(moveFaults(inlineItems(BASE), gatheredItems(SPLIT, moved)).join("\n"), /stands 0 times/);
});

test("road-split-structure RED: an inline item, an orphaned group, a shared order or a wrong address reads by name", () => {
  assert.match(structureFaults(BASE, []).join("\n"), /the road holds rank 4j inline/);
  assert.match(structureFaults(BASE, []).join("\n"), /the road holds a ruling inline under "First"/);
  const orphan = [...KIDS, child("ruling-third-four", { group: "third", order: "0050", tags: ["road/ruling"] }, "* ''Four''.")];
  assert.match(structureFaults(SPLIT, orphan).join("\n"), /names group third, which no gather in #\/rulings seats/);
  const shared = KIDS.map((k) => (k.file === "rank-4j.mem" ? { ...k, fields: { ...k.fields, order: "0010" } } : k));
  assert.match(structureFaults(SPLIT, shared).join("\n"), /share order 0010/);
  const misnamed = KIDS.map((k) => (k.file === "rank-2.mem" ? { ...k, fields: { ...k.fields, title: "lar:///ha.ka.ba/lares/docs/road/rank-3" } } : k));
  assert.match(structureFaults(SPLIT, misnamed).join("\n"), /rank-2\.mem names title/);
  assert.match(structureFaults(road([RANK_HEAD, RANK_GATHER], [rulingGather("first"), rulingGather("second")]), KIDS).join("\n"), /holds the rank table's head beside the gather/);
  const twoRows = KIDS.map((k) => (k.file === "rank-2.mem" ? { ...k, body: "| 2 | NOW | a | b |\n| 3 | NOW | e | f |" } : k));
  assert.match(structureFaults(SPLIT, twoRows).join("\n"), /rank-2\.mem holds no single row of its own rank/);
  const broken = SPLIT.replace('<$transclude mode="block"/>\n\n</$list>', '<$transclude mode="block"/></$list>');
  assert.match(structureFaults(broken, KIDS).join("\n"), /the ruling gather for group first stands broken/);
  const empty = KIDS.filter((k) => k.fields.group !== "second");
  assert.match(structureFaults(SPLIT, empty).join("\n"), /the ruling gather for group second gathers nothing/);
});
