/**
 * THE AHU LINE LAW — every reader agrees inside the sigil space (security read LOW-1).
 *
 * An ahu pair stands only when its closer's `>>` ends a line and its opener's `>>` ends its own line or
 * shares the line its closer ends (the one-line pair). Text after a closer unpairs it; text after an
 * opener of a multi-line pair unpairs it. The decomposer (`scanAhu`) cuts a child record only from a
 * pair that stands; the plugin's render pairs only the same; tree-sitter's corpus pins the same trees
 * (test/corpus/sigil-space-parity.txt). The block-only heads come from `lar-flow: block` — the plugin
 * reads it from the grammar, and the decomposer, which never reads vocabulary, is WELDED to it below.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/ahu
 */
import { describe, test, expect, beforeAll } from "vitest";
import { scanAhu } from "../src/meme-ast/ahu-scan.js";
import { GENERATED_SIGILS } from "../src/meme-ast/grammar-table.generated.js";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

const PROBES = {
  closerTail: "root\n\n<<~ ahu slot=`#/a`>>\nCHILD\n<<~/ahu>> tail\n\nafter\n",
  openerLead: "root\n\n<<~ ahu slot=`#/a`>> lead\nCHILD\n<<~/ahu>>\n\nafter\n",
  clean:      "root\n\n<<~ ahu slot=`#/a`>>\nCHILD\n<<~/ahu>>\n\nafter\n",
  oneLine:    "root\n\n<<~ ahu slot=`#/a`>>CHILD<<~/ahu>>\n\nafter\n",
};

describe("★ scanAhu cuts a child only from a pair that stands under the line law ★", () => {
  test("RED: a closer with a tail and an opener with a lead cut no child", () => {
    expect(scanAhu(PROBES.closerTail).blocks).toEqual([]);
    expect(scanAhu(PROBES.openerLead).blocks).toEqual([]);
  });

  test("CONTROL: a clean pair and a one-line pair each cut one child", () => {
    expect(scanAhu(PROBES.clean).blocks).toHaveLength(1);
    expect(scanAhu(PROBES.oneLine).blocks).toHaveLength(1);
  });

  test("WELD: the heads scanAhu decomposes (ahu, fragment) are exactly the child-slot heads carrying `lar-flow: block`", () => {
    const welded = GENERATED_SIGILS.filter((s) => s.kind === "child-slot" && s.flow === "block").map((s) => s.name).sort();
    expect(welded).toEqual(["ahu", "fragment"]);
  });
});

/** Does the plugin's parse of `src` pair the ahu, i.e. hold no separate node for its closer? */
const pairs = (engine: TW5Engine, src: string): boolean => {
  const texts: string[] = [];
  const walk = (nodes: any[]) => { for (const n of nodes ?? []) { if (n?.type === "text") texts.push(n.text); walk(n?.children); } };
  walk((engine.wiki as any).parseText("text/vnd.tiddlywiki", src).tree);
  return !texts.some((t) => t.includes("<<~/ahu>>"));
};

describe.skipIf(wikiSkip)(`★ the plugin pairs exactly what scanAhu pairs ★${skipNote}`, () => {
  let engine: TW5Engine;
  beforeAll(async () => { engine = await bootTestWiki(); }, 60_000);

  test("RED: the opener with a lead pairs in no reader (the inline phase takes the line law for block-only heads)", () => {
    expect(pairs(engine, PROBES.openerLead)).toBe(false);
  });

  test("the closer with a tail pairs in no reader", () => {
    expect(pairs(engine, PROBES.closerTail)).toBe(false);
  });

  test("CONTROL: the clean pair and the one-line pair pair in the plugin as in scanAhu", () => {
    expect(pairs(engine, PROBES.clean)).toBe(true);
    expect(pairs(engine, PROBES.oneLine)).toBe(true);
  });
});
