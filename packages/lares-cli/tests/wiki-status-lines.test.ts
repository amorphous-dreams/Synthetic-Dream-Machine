/**
 * `lares wiki status` names a wiki's temp layer as what it holds: an opt-in layer, off until `projection.temp.<slug>` consents
 * to it (road/referee-walk-frictions #10). An unconsented temp layer at rest reads `temp (opt-in, off)` and carries no fault
 * line; a consented one reads `temp (opt-in, on)` beside its reach. Every other layer reads as before.
 */
import { expect, test } from "vitest";
import { wikiStatusLines } from "../src/commands/wiki.js";

const OUT = {
  recipe: "elyncia-referee",
  working: "lar:///ha.ka.ba/wikis/elyncia-referee/working",
  layers: [
    { bag: "lar:///ha.ka.ba/bags/elyncia-referee", mounted: "promotion-only", read: true, write: false },
    { bag: "lar:///ha.ka.ba/wikis/elyncia-referee/working", mounted: "writable", read: true, write: true, working: true },
    { bag: "lar:///ha.ka.ba/wikis/elyncia-referee/temp", mounted: "writable", read: true, write: false, why: "cap-denied: no Keyhive document registered for this bag" },
  ],
};

test("RED an unconsented temp layer reads `temp (opt-in, off)` with no fault line", () => {
  const lines = wikiStatusLines(OUT, []);
  const temp = lines.find((l) => l.includes("/temp"))!;
  expect(temp).toMatch(/^\s+temp \(opt-in, off\)\s+lar:\/\/\/ha\.ka\.ba\/wikis\/elyncia-referee\/temp$/);
  expect(temp).not.toMatch(/cap-denied/);
  expect(lines.find((l) => l.startsWith("  ") && l.includes("/working"))).toMatch(/read \+ write\s+lar:\/\/\/ha\.ka\.ba\/wikis\/elyncia-referee\/working {2}<- a write lands here/);
});

test("RED a consented temp layer reads `temp (opt-in, on)` and keeps its reach and its reason", () => {
  const temp = wikiStatusLines(OUT, ["elyncia-referee"]).find((l) => l.includes("/temp"))!;
  expect(temp).toMatch(/temp \(opt-in, on\) read-only/);
  expect(temp).toMatch(/cap-denied/);
});
