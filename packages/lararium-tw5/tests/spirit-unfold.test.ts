/**
 * spirit-unfold — `<<spirit-unfold pet aperture>>` unfolds a tasked spirit through the wiki's own engine: the card's fields at
 * pulse, the card through its template at beat, the shrine's slots at measure, the whole shrine carrier at theme.
 *
 * The macro rides the lares-lararium skin, so a wiki that loads the house renders the unfold from its own plugin; the suite
 * boots that wiki and reads the render `lares wiki render --form text` gives.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, GLOBAL_IMPORT, wikiSkip, skipNote } from "./test-wiki.js";
import { UNFOLD_LAYER, UNFOLD_RANKS, spiritCardOf, unfoldCall, unfoldRank } from "@lararium/mesh/spirit-unfold";

const MEM = "lar:///ha.ka.ba/kahua/memory/";
const TEMPLATE = `${MEM}template/tasked-spirit`;
const SHRINE = `${MEM}spirit/verb-wright`;
const CARRIER = "text/memetic-wikitext+tiddlywiki";

const slot = (name: string, text: string) => ({ title: `${SHRINE}${name}`, type: CARRIER, "$fragment-parent": SHRINE, "$slot": name, text });

describe.skipIf(wikiSkip)(`<<spirit-unfold>> renders a spirit by aperture${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => {
    e = await bootTestWiki({ tiddlers: [
      { title: TEMPLATE, text: "!! <$text text={{!!pet}}/> ~ a tasked spirit\n\n''Lane:'' {{!!lane}}\n\n''Bodies:'' <$list filter=\"[enlist{!!bodies}]\" variable=\"b\"><<b>> · </$list>" },
      { title: spiritCardOf("verb-wright"), pet: "verb-wright", lane: "the verbs render //in the engine//", model: "opus", bodies: "[[b1 sonnet]] [[b2 opus]]", tags: "stage/spirit-card", text: `{{||${TEMPLATE}}}` },
      { title: SHRINE, type: CARRIER, role: "a tasked spirit", text: "<<~ kahea ahu slot=`#/open`>>\n\n<<~ kahea ahu slot=`#/bodies`>>" },
      slot("#/open", "!! Open loops\n\n* waits on the skin"),
      slot("#/bodies", "!! Bodies\n\n* b1"),
      { title: spiritCardOf("card-only"), pet: "card-only", lane: "a lane with no shrine", text: `{{||${TEMPLATE}}}` },
    ] });
  }, 60_000);
  /** The render `wiki-render` gives a span: the global import, then the span, as plain text. */
  const r = (span: string): string => e.wiki.renderText("text/plain", "text/vnd.tiddlywiki", GLOBAL_IMPORT + span);
  const unfold = (pet: string, aperture: string): string => r(unfoldCall(pet, aperture)!);

  test("CONTROL — the house skin stands and the card renders through its template", () => {
    expect(r(`<$tiddler tiddler="${spiritCardOf("verb-wright")}"><$transclude $tiddler="${spiritCardOf("verb-wright")}" $mode="block"/></$tiddler>`)).toContain("verb-wright ~ a tasked spirit");
  });

  test("pulse reads the card's fields, one per line, as text and never wikified", () => {
    const text = unfold("verb-wright", "pulse");
    expect(text.split("\n")[0]).toBe(`verb-wright ~ fields at pulse · ${spiritCardOf("verb-wright")}`);
    expect(text).toContain("lane: the verbs render //in the engine//\n");
    expect(text).toContain("model: opus\n");
    expect(text).toContain("pet: verb-wright\n");
    expect(text).not.toMatch(/^(title|text|tags): /m);
    expect(text).not.toContain("a tasked spirit");
  });

  test("beat renders the card through its template", () => {
    const text = unfold("verb-wright", "beat");
    expect(text).toContain("verb-wright ~ a tasked spirit");
    expect(text).toContain("Lane: the verbs render in the engine");
    expect(text).toContain("b1 sonnet · b2 opus");
    expect(text).not.toContain("#/open");
  });

  test("measure adds the shrine's slots in carrier order, each with its size and heading", () => {
    const text = unfold("verb-wright", "measure");
    expect(text).toContain("verb-wright ~ a tasked spirit");
    const lines = text.split("\n");
    const at = lines.indexOf(SHRINE);
    expect(at).toBeGreaterThan(0);
    expect(lines.slice(at + 1, at + 3)).toEqual([
      `#/open · ${"!! Open loops\n\n* waits on the skin".length} chars · Open loops`,
      `#/bodies · ${"!! Bodies\n\n* b1".length} chars · Bodies`,
    ]);
    expect(text).not.toContain("waits on the skin");
    expect(unfold("verb-wright", "arc").replace("at arc", "at measure")).toBe(text);
  });

  test("theme reads the whole shrine carrier beneath the card", () => {
    const text = unfold("verb-wright", "theme");
    expect(text).toContain("verb-wright ~ a tasked spirit");
    expect(text).toContain("<<~ ahu slot=`#/open`>>");
    expect(text).toContain("* waits on the skin");
    expect(text).toContain("* b1");
  });

  test("a card with no shrine names the shrine it lacks at measure and theme", () => {
    for (const rank of ["measure", "theme"]) {
      const text = unfold("card-only", rank);
      expect(text).toContain("card-only ~ a tasked spirit");
      expect(text).toContain(`no slot shrine stands at ${MEM}spirit/card-only`);
    }
  });

  test("a pet no card answers renders nothing", () => {
    expect(unfold("nobody", "beat")).toBe("");
  });

  test("the bare macro reads beat, and a malformed aperture or pet names the shape it reads", () => {
    expect(r('<<spirit-unfold pet:"verb-wright">>')).toBe(unfold("verb-wright", "beat"));
    expect(r('<<spirit-unfold pet:"verb-wright" aperture:"wide">>')).toContain("the aperture names one of pulse · beat · measure · arc · theme");
    expect(r('<<spirit-unfold pet:"Bad Name">>')).toContain("the pet name reads malformed");
  });
});

describe("the unfold's pure core", () => {
  test("an aperture names its rank by word, by level, or by the gauge's pair", () => {
    expect(UNFOLD_RANKS.map((rank) => unfoldRank(rank))).toEqual([...UNFOLD_RANKS]);
    expect([0, 4, 5, 8, 9, 12, 13, 16, 17, 20].map((n) => unfoldRank(String(n)))).toEqual(["pulse", "pulse", "beat", "beat", "measure", "measure", "arc", "arc", "theme", "theme"]);
    expect(unfoldRank("10/measure")).toBe("measure");
    expect(unfoldRank(" Theme ")).toBe("theme");
    expect(["", "21", "3/theme", "wide", "10/", "-1", null, undefined].map((a) => unfoldRank(a))).toEqual(Array(8).fill(null));
  });

  test("each rank names one layer, and the call a door sends names the rank", () => {
    expect(UNFOLD_LAYER).toEqual({ pulse: "fields", beat: "card", measure: "slots", arc: "slots", theme: "whole" });
    expect(unfoldCall("verb-wright", "10/measure")).toBe('<<spirit-unfold pet:"verb-wright" aperture:"measure">>');
    expect(unfoldCall("Bad Name", "beat")).toBeNull();
    expect(unfoldCall("verb-wright", "wide")).toBeNull();
  });
});
