/**
 * THE TWO DIALS — mu the lens, aperture the range (lar:///ha.ka.ba/kahua/memory/course/comms-ux-enacts landing 6, re-cut by the
 * keypad head to the boot seed's own values: lar:///ha.ka.ba/lares/api/noosphere-boot #/mu-five-tools and #/aperture). A
 * `lares` call and a `set` firing share one param set, so every carry and every rank reads here character for character as the
 * seed writes it. Pure; the call's own suite (`tiddler-verbs.test.ts`) drives the same rows through a booted engine.
 */
import { describe, test, expect } from "vitest";
import { parseHasRows } from "../src/affordance-rows.js";
import { MU_CARRIES, MU_CARRY_ORDER, canonicalCarry, dryDepthOf, isDryCarry, isMuFault, lookupMu, muCellsOf, muWordsOf, readMu, type MuCarry } from "../src/modules/mu.js";
import { APERTURE_BANDS, APERTURE_RANKS, apertureWords, filterRangeArgs, isApertureFault, rankOf, reachesWhole, readAperture, readRangeArgs, type Aperture } from "../src/modules/aperture.js";

const carry = (raw: string): MuCarry => {
  const read = readMu(raw);
  if (isMuFault(read)) throw new Error(`${raw}: ${read.message}`);
  return read;
};
const range = (raw: string): Aperture => {
  const read = readAperture(raw);
  if (isApertureFault(read)) throw new Error(`${raw}: ${read.message}`);
  return read;
};
const cells = (text: string) => muCellsOf(parseHasRows(text));
const READS = cells("<<has entity=`cell` name=`?0` params=`mu/cup ~ relations`>>\n<<has entity=`cell` name=`!0` params=`mu/sword ~ asserted`>>");
const PAGES = cells("<<has entity=`cell` name=`*0` params=`mu/wand implied/true ~ titles`>>\n<<has entity=`cell` name=`*?` params=`mu/relation ~ has lines`>>\n<<has entity=`cell` name=`*!` params=`mu/detail ~ lines`>>");
const PUTS = cells("<<has entity=`cell` name=`?0` params=`mu/cup ~ receipt`>>\n<<has entity=`cell` name=`_0` params=`mu/pentacle ~ dry`>>\n<<has entity=`cell` name=`_?` params=`mu/overview owed/[[a later landing]] ~ summary`>>\n<<has entity=`cell` name=`_!` params=`mu/precision ~ diff`>>");

/** The seed's eleven carries: glyphs, the seed's word, how the hands sit. */
const SEED: ReadonlyArray<readonly [string, string, MuCarry["axis"]]> = [
  ["*0", "wand", "single"], ["?0", "cup", "single"], ["!0", "sword", "single"], ["_0", "pentacle", "single"], ["00", "rest", "rest"],
  ["*!", "detail", "complementary"], ["*?", "relation", "complementary"], ["_!", "precision", "complementary"], ["_?", "overview", "complementary"],
  ["*_", "signal-jam", "conflict"], ["?!", "dubious-move", "conflict"],
];

describe("mu takes the seed's tool-carries, always two hands", () => {
  test("RED: every carry the seed names reads by its glyphs and by its word, and echoes the full carry", () => {
    expect(MU_CARRY_ORDER).toEqual(SEED.map(([g]) => g));
    for (const [glyphs, word, axis] of SEED) {
      expect(carry(glyphs), glyphs).toMatchObject({ carry: glyphs, axis });
      expect(carry(word), word).toMatchObject({ carry: glyphs, axis });
      expect(carry(word.toUpperCase()), `${word} in capitals`).toMatchObject({ carry: glyphs });
      expect(muWordsOf(glyphs), glyphs).toBe(word);
      expect(MU_CARRIES[glyphs]?.name).toBe(word);
    }
  });

  test("RED: a lone glyph reads pono, the empty hand second (? reads ?0, 0 reads 00); arcana reads Rest", () => {
    expect(carry("?").carry).toBe("?0");
    expect(carry("!").carry).toBe("!0");
    expect(carry("*").carry).toBe("*0");
    expect(carry("_").carry).toBe("_0");
    expect(carry("0")).toEqual({ carry: "00", tools: [], axis: "rest" });
    expect(carry("arcana").carry).toBe("00");
  });

  test("RED: two glyphs read their canonical carry in either order; the written order rides for a conflict", () => {
    expect(carry("!*").carry).toBe("*!");
    expect(carry("?*").carry).toBe("*?");
    expect(carry("!_").carry).toBe("_!");
    expect(carry("?_").carry).toBe("_?");
    expect(carry("_*")).toEqual({ carry: "*_", tools: ["_", "*"], axis: "conflict" });
    expect(carry("!?")).toEqual({ carry: "?!", tools: ["!", "?"], axis: "conflict" });
    expect(canonicalCarry(["!", "*"])).toBe("*!");
    expect(canonicalCarry([])).toBe("00");
  });

  test("RED: the active hand leads: an empty hand written first (0*, 0?, 0!, 0_) refuses mu-malformed naming the seed carry", () => {
    for (const [raw, cure] of [["0*", "wand"], ["0?", "cup"], ["0!", "sword"], ["0_", "pentacle"]] as const) {
      expect(readMu(raw), raw).toMatchObject({ reason: "mu-malformed", cure, message: expect.stringContaining("active tool first") });
    }
    // CONTROL: the seed's own spellings stand.
    expect(carry("*0").carry).toBe("*0");
    expect(carry("00").carry).toBe("00");
  });

  test("RED: landing 6's words burned: each refuses mu-malformed and names the seed carry standing for it", () => {
    for (const [word, cure] of [["relate", "cup"], ["assert", "sword"], ["many", "wand"], ["dry", "pentacle"], ["unask", "rest"], ["many-relate", "relation"], ["dry-assert", "precision"]] as const) {
      expect(readMu(word), word).toMatchObject({ reason: "mu-malformed", cure });
    }
  });

  test("a value naming no carry, three tools, or one tool twice answers mu-malformed", () => {
    for (const raw of ["deep", "", "*?!", "x?", "??", "many relate"]) expect(isMuFault(readMu(raw)), raw).toBe(true);
    expect(readMu("*?!")).toMatchObject({ reason: "mu-malformed", cure: "relation" });
    expect(readMu("??")).toMatchObject({ reason: "mu-malformed", cure: "cup" });
  });

  test("the lookup: a cell answers; Rest needs no cell; a conflict answers its first tool and names the second; an implied tool joins a single one", () => {
    expect(lookupMu("cup", carry("cup"), READS)).toMatchObject({ carry: "?0", then: null });
    expect(lookupMu("00", carry("00"), READS)).toMatchObject({ carry: "00", axis: "rest" });
    expect(lookupMu("0", carry("0"), [])).toMatchObject({ carry: "00", axis: "rest" });
    expect(lookupMu("?!", carry("?!"), READS)).toMatchObject({ carry: "?0", axis: "conflict", then: "!0" });
    expect(lookupMu("!?", carry("!?"), READS)).toMatchObject({ carry: "!0", axis: "conflict", then: "?0" });
    expect(lookupMu("?", carry("?"), PAGES)).toMatchObject({ carry: "*?" });
    expect(lookupMu("*0", carry("*0"), PAGES)).toMatchObject({ carry: "*0" });
    expect(lookupMu("?!", carry("?!"), PAGES)).toMatchObject({ carry: "*?", then: "*!" });
    expect(lookupMu("_*", carry("_*"), PUTS)).toMatchObject({ carry: "_0", then: "*0" });
  });

  test("RED: every carry meets a carrier: the tabled cells answer, the rest refuse mu-cell-empty naming the nearest cell or the plain call", () => {
    const answered = SEED.filter(([g]) => !isMuFault(lookupMu(g, carry(g), PUTS))).map(([g]) => g);
    expect(answered, "a conflict answers its first tool: ?! the cup, *_ the wand this carrier tables none of").toEqual(["?0", "_0", "00", "_!", "?!"]);
    expect(lookupMu("_?", carry("_?"), PUTS)).toMatchObject({ reason: "mu-cell-empty", cure: "cup", message: expect.stringContaining("a later landing") });
    expect(lookupMu("*!", carry("*!"), READS)).toMatchObject({ reason: "mu-cell-empty", cure: "sword" });
    expect(lookupMu("_0", carry("_0"), READS)).toMatchObject({ reason: "mu-cell-empty", cure: null });
    expect(lookupMu("*0", carry("*0"), [])).toMatchObject({ reason: "mu-cell-empty" });
  });

  test("RED: the dry band rides the Pentacle: _0 and _? the summary, _! the diff; no other carry names a dry depth", () => {
    expect(dryDepthOf("_0")).toBe("summary");
    expect(dryDepthOf("_?")).toBe("summary");
    expect(dryDepthOf("_!")).toBe("diff");
    for (const [g] of SEED.filter(([g]) => !g.startsWith("_"))) expect(dryDepthOf(g), g).toBeNull();
    expect(isDryCarry(carry("?_").carry), "a carry holding _ reads dry in any order").toBe(true);
    expect(isDryCarry("*?")).toBe(false);
  });
});

describe("aperture takes the set panel's N/rank", () => {
  test("RED: every rank reads by N/rank, the rank alone and the number alone, each to the same band", () => {
    expect([...APERTURE_RANKS]).toEqual(["pulse", "beat", "measure", "arc", "theme"]);
    for (const rank of APERTURE_RANKS) {
      const band = APERTURE_BANDS[rank];
      expect(range(rank), rank).toMatchObject({ n: band.seat, rank });
      expect(range(`${band.low}/${rank}`), `${band.low}/${rank}`).toMatchObject({ n: band.low, rank });
      expect(range(`${band.high}`), `${band.high}`).toMatchObject({ n: band.high, rank });
      expect(rankOf(band.low)).toBe(rank);
      expect(rankOf(band.high)).toBe(rank);
    }
    expect(range("10/measure")).toEqual({ asked: "10/measure", n: 10, rank: "measure" });
    expect(apertureWords(range("measure"))).toBe("10/measure");
    expect(apertureWords(range("beat"))).toBe("6/beat");
    expect(apertureWords(range("arc"))).toBe("16/arc");
  });

  test("RED: a number and a rank that disagree, a number past 20, or a word no rank names answer aperture-malformed", () => {
    expect(readAperture("3/measure")).toMatchObject({ reason: "aperture-malformed", cure: "3/pulse" });
    expect(readAperture("21")).toMatchObject({ reason: "aperture-malformed" });
    expect(readAperture("wide")).toMatchObject({ reason: "aperture-malformed" });
    expect(readAperture("")).toMatchObject({ reason: "aperture-malformed" });
    expect(readAperture("10/wide")).toMatchObject({ reason: "aperture-malformed" });
  });

  test("RED: the read door's range per rank: pulse, beat and measure the card; arc and theme the whole; a slot narrowing each", () => {
    for (const rank of ["pulse", "beat", "measure"] as const) {
      expect(readRangeArgs(rank, false), rank).toEqual({ meme: true, grain: "skinny" });
      expect(readRangeArgs(rank, true), rank).toEqual({ grain: "skinny" });
      expect(reachesWhole(rank), rank).toBe(false);
    }
    for (const rank of ["arc", "theme"] as const) {
      expect(readRangeArgs(rank, false), rank).toEqual({ meme: true, grain: "whole" });
      expect(readRangeArgs(rank, true), rank).toEqual({ meme: true });
      expect(reachesWhole(rank), rank).toBe(true);
    }
  });

  test("RED: the filter door's range per rank: measure a page of has lines, arc and theme rows whole, pulse and beat the titles", () => {
    expect(filterRangeArgs("pulse")).toEqual({});
    expect(filterRangeArgs("beat")).toEqual({});
    expect(filterRangeArgs("measure")).toEqual({ depth: "card" });
    expect(filterRangeArgs("arc")).toEqual({ depth: "whole" });
    expect(filterRangeArgs("theme")).toEqual({ depth: "whole" });
  });
});

describe("the two dials cross", () => {
  test("RED: the seed's crosses read apart, each dial its own value: pulse·!0, measure·?0, arc·!0, theme·_0", () => {
    const crosses: ReadonlyArray<readonly [string, string, string, string]> = [
      ["pulse", "!0", "2/pulse", "sword"], ["measure", "?0", "10/measure", "cup"], ["arc", "!0", "16/arc", "sword"], ["theme", "_0", "18/theme", "pentacle"],
    ];
    for (const [a, m, words, name] of crosses) {
      expect(apertureWords(range(a)), a).toBe(words);
      expect(muWordsOf(carry(m).carry), m).toBe(name);
    }
    // mu never names a range and aperture never names a lens: each dial refuses the other's values.
    expect(isMuFault(readMu("measure"))).toBe(true);
    expect(isApertureFault(readAperture("?0"))).toBe(true);
  });

  test("RED: every carry crosses every rank: the lens reads its carry whatever the range, the range its band whatever the lens", () => {
    for (const [g] of SEED) {
      for (const rank of APERTURE_RANKS) {
        expect(carry(g).carry, `${g} at ${rank}`).toBe(g);
        expect(range(rank).rank, `${rank} beside ${g}`).toBe(rank);
      }
    }
  });
});
