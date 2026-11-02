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
import { memeticIngestOps } from "../src/ingest-gate.js";
import { verdict, frameCarrier } from "@lararium/memetic-frame";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

// Every reader rides its PUBLIC surface: the decomposer through the meme-ast library module the booted
// VM loads (the door the deserializer takes), the vocabulary through the live sigil tiddlers, the
// render through the wiki's own parse. Never the compile layer's source.
type AhuScan = (text: string) => { blocks: readonly unknown[] };
let engine: TW5Engine;
let scanAhu: AhuScan;
beforeAll(async () => {
  if (wikiSkip) return;
  engine = await bootTestWiki();
  ({ scanAhu } = engine.$tw.modules.execute("lar:///ha.ka.ba/lararium/tw5/modules/meme-ast") as { scanAhu: AhuScan });
}, 60_000);

const PROBES = {
  closerTail: "root\n\n<<~ ahu slot=`#/a`>>\nCHILD\n<<~/ahu>> tail\n\nafter\n",
  openerLead: "root\n\n<<~ ahu slot=`#/a`>> lead\nCHILD\n<<~/ahu>>\n\nafter\n",
  clean:      "root\n\n<<~ ahu slot=`#/a`>>\nCHILD\n<<~/ahu>>\n\nafter\n",
  oneLine:    "root\n\n<<~ ahu slot=`#/a`>>CHILD<<~/ahu>>\n\nafter\n",
};

describe.skipIf(wikiSkip)(`★ scanAhu cuts a child only from a pair that stands under the line law ★${skipNote}`, () => {
  test("RED: a closer with a tail and an opener with a lead cut no child", () => {
    expect(scanAhu(PROBES.closerTail).blocks).toEqual([]);
    expect(scanAhu(PROBES.openerLead).blocks).toEqual([]);
  });

  test("CONTROL: a clean pair and a one-line pair each cut one child", () => {
    expect(scanAhu(PROBES.clean).blocks).toHaveLength(1);
    expect(scanAhu(PROBES.oneLine).blocks).toHaveLength(1);
  });

  test("WELD: the heads scanAhu decomposes (ahu, fragment) are exactly the child-slot heads carrying `lar-flow: block`", () => {
    const welded = engine.wiki.filterTiddlers("[all[shadows+tiddlers]tag[lar:///ha.ka.ba/tags/SharktoothSigil]field:lar-kind[child-slot]field:lar-flow[block]]")
      .map((t) => t.replace(/^.*\/sigil-/, "")).sort();
    expect(welded).toEqual(["ahu", "fragment"]);
  });
});

describe("★ ingest reads the same: no child cut, one warning naming the fault ★", () => {
  const ingest = (body: string) => {
    const t = frameCarrier({ head: { uri: "lar:///t.t.t/x" }, body: "```toml meta\nuri-path = \"t.t.t/x\"\n```\n\n" + body });
    const r = memeticIngestOps.deserialize("lar:///t.t.t/x", t, verdict(t));
    return { titles: r.records.map((x) => String(x.title)), diags: r.diagnostics.map((d) => `${d.severity}:${d.code}`) };
  };

  test("a closer with a tail and an opener with a lead: the root alone, held whole by the quoteblock floor at warning grade", () => {
    for (const p of [PROBES.closerTail, PROBES.openerLead]) {
      const r = ingest(p);
      expect(r.titles).toEqual(["lar:///t.t.t/x"]);
      expect(r.diags).toEqual(["warning:quoteblocked"]);
    }
  });

  test("CONTROL: a clean pair cuts its child and raises nothing", () => {
    expect(ingest(PROBES.clean)).toEqual({ titles: ["lar:///t.t.t/x", "lar:///t.t.t/x#/a"], diags: [] });
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
