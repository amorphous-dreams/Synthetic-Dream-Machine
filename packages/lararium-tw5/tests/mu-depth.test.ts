/**
 * MU — the depth of every call (lar:///ha.ka.ba/kahua/memory/course/comms-ux-enacts landing 6): a glyph or its word reads to a
 * carry, the axis read decides complementary or conflict, and the cell lookup runs against the rows a carrier tables. Pure; the
 * call's own suite (`tiddler-verbs.test.ts`, "mu sets the depth") drives the same rows through a booted engine.
 */
import { describe, test, expect } from "vitest";
import { parseHasRows } from "../src/affordance-rows.js";
import { canonicalCarry, filterDepthArgs, isMuFault, lookupMu, muCellsOf, muWordsOf, readDepthArgs, readMu, type MuCarry } from "../src/modules/mu.js";

const carry = (raw: string): MuCarry => {
  const read = readMu(raw);
  if (isMuFault(read)) throw new Error(`${raw}: ${read.message}`);
  return read;
};
const cells = (text: string) => muCellsOf(parseHasRows(text));
const READS = cells("<<has entity=`cell` name=`?` params=`mu/relate ~ the card`>>\n<<has entity=`cell` name=`!` params=`mu/assert ~ the whole`>>");
const PAGES = cells("<<has entity=`cell` name=`*` params=`mu/many implied/true ~ titles`>>\n<<has entity=`cell` name=`*?` params=`mu/many-relate ~ has lines`>>\n<<has entity=`cell` name=`*!` params=`mu/many-assert ~ lines`>>");
const PUTS = cells("<<has entity=`cell` name=`_?` params=`mu/dry-relate owed/[[landing 7]] ~ summary`>>");

describe("mu reads glyphs and words, and sets read depth", () => {
  test("glyphs, words and both mixed read one carry; the word rides wherever the glyph does", () => {
    for (const raw of ["*?", "many-relate", "many relate", "many,relate", "many+relate", "*-relate", "?*"]) {
      expect(canonicalCarry(carry(raw).tools), raw).toBe("*?");
      expect(carry(raw).axis, raw).toBe("complementary");
    }
    expect(carry("relate")).toEqual({ tools: ["?"], axis: "single" });
    expect(carry("unask")).toEqual({ tools: ["0"], axis: "rest" });
    expect(carry("*0"), "0 beside a tool reads as the empty hand").toEqual({ tools: ["*"], axis: "single" });
    expect(carry("??"), "a tool written twice reads once").toEqual({ tools: ["?"], axis: "single" });
    expect(muWordsOf("_!")).toBe("dry-assert");
  });

  test("two tools on one axis read as a conflict, in the order written", () => {
    expect(carry("?!")).toEqual({ tools: ["?", "!"], axis: "conflict" });
    expect(carry("dry-many")).toEqual({ tools: ["_", "*"], axis: "conflict" });
  });

  test("a value naming no tool, or three tools, answers mu-malformed", () => {
    for (const raw of ["deep", "", "*?!", "x?"]) expect(isMuFault(readMu(raw)), raw).toBe(true);
    expect(readMu("*?!")).toMatchObject({ reason: "mu-malformed", cure: "many-relate" });
  });

  test("the lookup: a cell answers; a conflict answers its first tool and names the second; an implied tool joins a lone one", () => {
    expect(lookupMu("relate", carry("relate"), READS)).toMatchObject({ carry: "?", then: null });
    expect(lookupMu("?!", carry("?!"), READS)).toMatchObject({ carry: "?", axis: "conflict", then: "!" });
    expect(lookupMu("?", carry("?"), PAGES)).toMatchObject({ carry: "*?" });
    expect(lookupMu("*", carry("*"), PAGES)).toMatchObject({ carry: "*" });
    expect(lookupMu("?!", carry("?!"), PAGES)).toMatchObject({ carry: "*?", then: "*!" });
  });

  test("a carry outside the table refuses mu-cell-empty: the nearest cell sharing a tool, else the plain call; an owed cell refuses", () => {
    expect(lookupMu("dry", carry("dry"), READS)).toMatchObject({ reason: "mu-cell-empty", cure: null });
    expect(lookupMu("*!", carry("*!"), READS)).toMatchObject({ reason: "mu-cell-empty", cure: "assert" });
    expect(lookupMu("dry-relate", carry("dry-relate"), PUTS)).toMatchObject({ reason: "mu-cell-empty", cure: null, message: expect.stringContaining("landing 7") });
    expect(lookupMu("many", carry("many"), [])).toMatchObject({ reason: "mu-cell-empty" });
  });

  test("the seats' depth args: relate the card, assert the whole, a slot narrowing each; a filter's two depths", () => {
    expect(readDepthArgs("?", false)).toEqual({ meme: true, grain: "skinny" });
    expect(readDepthArgs("?", true)).toEqual({ grain: "skinny" });
    expect(readDepthArgs("!", false)).toEqual({ meme: true, grain: "whole" });
    expect(readDepthArgs("!", true)).toEqual({ meme: true });
    expect(filterDepthArgs("*?")).toEqual({ depth: "card" });
    expect(filterDepthArgs("*!")).toEqual({ depth: "whole" });
    expect(filterDepthArgs("*")).toEqual({});
  });
});
