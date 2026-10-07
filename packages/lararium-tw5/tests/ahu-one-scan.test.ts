// vm-grammar-boundary: exempt — its subject IS the machine ahu scanner (ahu-scan.ts), the one stack the split and
// the quoteblock floor read; no grammar surface is driven.
/**
 * ONE AHU SCAN — the split's blocks and the floor's faults are two readings of one stack.
 *
 * `scanAhu(text)` pairs openers and closers once, under the fence mask: the top-level blocks the family
 * split cuts, and the balance faults the quoteblock floor fences on. `findTopLevelAhuBlocks` and
 * `findAhuBalanceFaults` are its two views, so the split and the floor can never disagree on what counts
 * as balanced. The corpus walk holds the views to the scan over every carrier body; the fixtures pin the
 * grammar each reading answers.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { scanAhu, findTopLevelAhuBlocks, findAhuBalanceFaults } from "../src/meme-ast/ahu-scan.js";
import { carrierTexts, divideCarrier } from "../src/deserializer.js";
import { carrierFiles } from "../src/carrier-files.js";
import { REPO } from "./test-wiki.js";

const FIXTURES: Record<string, string> = {
  sound:        "<<~ ahu #/a>>\n\n! a\n\n<<~/ahu>>\n\n<<~ ahu #/b>>\nb\n<<~/ahu>>",
  nested:       "<<~ ahu #/a>>\n<<~ ahu #/a/b>>\ninner\n<<~/ahu>>\nouter\n<<~/ahu>>",
  orphanClose:  "<<~ ahu #/a>>\n\n! a\n\n<<~/ahu>>\n\nstray prose\n\n<<~/ahu>>",
  unbalanced:   "<<~ ahu #/a>>\n<<~ ahu #/a/b>>\ninner\n<<~/ahu>>\nno closer for a",
  fenced:       "```\n<<~ ahu #/q>>\n```\n<<~ ahu #/a>>\na\n<<~/ahu>>\n`<<~/ahu>>`",
  fragment:     "<<fragment #/f>>\nf\n<</fragment>>",
};

describe("★ scanAhu — one stack, two readings ★", () => {
  test("the grammar each reading answers", () => {
    expect(scanAhu(FIXTURES["sound"]!).blocks.map((b) => b.slot)).toEqual(["#/a", "#/b"]);
    expect(scanAhu(FIXTURES["sound"]!).faults).toEqual([]);
    expect(scanAhu(FIXTURES["nested"]!).blocks.map((b) => b.slot)).toEqual(["#/a"]);
    expect(scanAhu(FIXTURES["orphanClose"]!).faults.map((f) => f.code)).toEqual(["ahu-orphan-close"]);
    expect(scanAhu(FIXTURES["unbalanced"]!).faults.map((f) => `${f.code} ${f.slot}`)).toEqual(["ahu-unbalanced-open #/a"]);
    expect(scanAhu(FIXTURES["fenced"]!).blocks.map((b) => b.slot)).toEqual(["#/a"]);
    expect(scanAhu(FIXTURES["fenced"]!).faults).toEqual([]);
    expect(scanAhu(FIXTURES["fragment"]!).blocks.map((b) => b.slot)).toEqual(["#/f"]);
  });

  test("the split's blocks and the floor's faults are the scan's two views, over every carrier body", { timeout: 60_000 }, () => {
    const bodies = Object.values(FIXTURES);
    for (const f of carrierFiles(REPO)) {
      const text = readFileSync(path.join(REPO, f), "utf8");
      for (const c of carrierTexts(text, f)) bodies.push(divideCarrier(c.text).body);
    }
    expect(bodies.length).toBeGreaterThan(500);
    for (const body of bodies) {
      const scan = scanAhu(body);
      expect(findTopLevelAhuBlocks(body)).toEqual(scan.blocks);
      expect(findAhuBalanceFaults(body)).toEqual(scan.faults);
    }
  });
});
