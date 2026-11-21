/**
 * oracle-cast — the three-coin cast's own laws: the coins draw through the entropy door alone, an operator's typed
 * throw stands as its own source, the King Wen numbers read true against the house's imported readings, and the core
 * reads no clock (the caller names the time).
 */
import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAST_METHOD, OPERATOR_COINS, ORACLE_WIDENS, castFields, castFromCoins, castReadingTitles, castText, castThreeCoins,
  castTitle, figureOf, hexagramOf, parseCoins, readingTitle, throwLine, type LineValue,
} from "../src/oracle-cast.js";
import { PLATFORM_ENTROPY, type EntropyDoor } from "../src/entropy-door.js";

/** A door that hands back the bytes it was given, in order, and names itself as a replay. */
function scripted(bytes: readonly number[]): EntropyDoor {
  let at = 0;
  return {
    source: "test:scripted",
    fill: (view) => {
      for (let i = 0; i < view.length; i += 1) { view[i] = bytes[at % bytes.length] ?? 0; at += 1; }
      return view;
    },
  };
}
/** A seeded door: a fixed xorshift walk, named as a replay. */
function seeded(seed: number): EntropyDoor {
  let s = seed >>> 0 || 1;
  return {
    source: `test:seeded(${seed})`,
    fill: (bytes) => {
      for (let i = 0; i < bytes.length; i += 1) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; bytes[i] = s & 0xff; }
      return bytes;
    },
  };
}
/** One coin as four door bytes: an even 32-bit draw reads tails (2), an odd one heads (3). */
const TAILS = [0, 0, 0, 0];
const HEADS = [0, 0, 0, 1];
const ASK = { caster: "operator", at: "2026-11-20T23:15:02.123Z" };

describe("oracle-cast — three coins a line, drawn through the entropy door", () => {
  test("a line sums three coins, heads three and tails two: 6 old yin, 7 young yang, 8 young yin, 9 old yang", () => {
    expect(throwLine(scripted([...TAILS, ...TAILS, ...TAILS]))).toBe(6);
    expect(throwLine(scripted([...HEADS, ...TAILS, ...TAILS]))).toBe(7);
    expect(throwLine(scripted([...HEADS, ...HEADS, ...TAILS]))).toBe(8);
    expect(throwLine(scripted([...HEADS, ...HEADS, ...HEADS]))).toBe(9);
  });

  test("a cast throws six lines, bottom line first, and names the door it drew from", () => {
    const cast = castThreeCoins(seeded(5), ASK);
    expect(cast.method).toBe(CAST_METHOD);
    expect(cast.entropy).toBe("test:seeded(5)");
    expect(cast.lines).toHaveLength(6);
    for (const line of cast.lines) expect([6, 7, 8, 9]).toContain(line);
    expect(cast.caster).toBe("operator");
    expect(cast.at).toBe(ASK.at);
  });

  test("the same seed casts the same figure; the platform door names crypto.getRandomValues", () => {
    expect(castThreeCoins(seeded(42), ASK)).toEqual(castThreeCoins(seeded(42), ASK));
    expect(castThreeCoins(PLATFORM_ENTROPY, ASK).entropy).toBe("platform:crypto.getRandomValues");
  });

  test("six old yang lines cast hexagram 1 changing whole into hexagram 2", () => {
    const allHeads = scripted(HEADS);
    const cast = castThreeCoins(allHeads, ASK);
    expect(cast.lines).toEqual([9, 9, 9, 9, 9, 9]);
    expect(cast.changing).toEqual([1, 2, 3, 4, 5, 6]);
    expect(cast.primary.number).toBe(1);
    expect(cast.relating?.number).toBe(2);
  });

  test("a cast with no changing line names no relating hexagram", () => {
    const cast = castFromCoins([7, 8, 7, 8, 7, 8], ASK);
    expect(cast.changing).toEqual([]);
    expect(cast.relating).toBeNull();
    // 7 8 7 8 7 8 bottom first: yang yin yang | yin yang yin, Li below Kan above, hexagram 63 (After Completion).
    expect(cast.primary.number).toBe(63);
  });

  test("the cast draws ONLY through the door: a door that refuses to fill casts nothing", () => {
    const broken: EntropyDoor = { source: "test:broken", fill: () => { throw new Error("no entropy"); } };
    expect(() => castThreeCoins(broken, ASK)).toThrow("no entropy");
  });
});

describe("oracle-cast — the operator's own three coins", () => {
  test("six typed values cast as the operator's throw, named operator:three-coins", () => {
    const cast = castFromCoins([8, 8, 9, 6, 8, 8], ASK);
    expect(cast.entropy).toBe(OPERATOR_COINS);
    expect(cast.entropy).toBe("operator:three-coins");
    expect(cast.lines).toEqual([8, 8, 9, 6, 8, 8]);
    expect(cast.changing).toEqual([3, 4]);
    // 8 8 9 | 6 8 8 → yin yin yang | yin yin yin: Gen below, Kun above, hexagram 15; the changed lines read yin yin yin | yang yin yin: Kun below, Zhen above, hexagram 16.
    expect(cast.primary.number).toBe(15);
    expect(cast.relating?.number).toBe(16);
  });

  test("parseCoins reads six values written with commas, spaces or nothing between", () => {
    const six: LineValue[] = [7, 8, 9, 6, 7, 7];
    expect(parseCoins("7,8,9,6,7,7")).toEqual(six);
    expect(parseCoins("7 8 9 6 7 7")).toEqual(six);
    expect(parseCoins("789677")).toEqual(six);
  });

  test("anything but six values of 6 to 9 refuses", () => {
    expect(parseCoins("7,8,9,6,7")).toBeNull();
    expect(parseCoins("7,8,9,6,7,5")).toBeNull();
    expect(parseCoins("7,8,9,6,7,7,7")).toBeNull();
    expect(parseCoins("heads")).toBeNull();
    expect(() => castFromCoins([7, 8, 9, 6, 7], ASK)).toThrow(/six/);
    expect(() => castFromCoins([7, 8, 9, 6, 7, 10], ASK)).toThrow(/6, 7, 8 or 9/);
  });

  test("the core reads no clock: a cast without a time, or without a caster, refuses", () => {
    expect(() => castFromCoins([7, 7, 7, 7, 7, 7], { caster: "operator", at: "" })).toThrow(/time/);
    expect(() => castThreeCoins(seeded(1), { caster: "", at: ASK.at })).toThrow(/caster/);
  });
});

describe("oracle-cast — King Wen numbering, 1 to 64", () => {
  test("every number maps to one figure and back", () => {
    const seen = new Set<string>();
    for (let n = 1; n <= 64; n += 1) {
      const figure = figureOf(n);
      expect(figure).toMatch(/^[01]{6}$/);
      seen.add(figure);
      expect(hexagramOf(figure).number).toBe(n);
    }
    expect(seen.size).toBe(64);
    expect(hexagramOf("111111").glyph).toBe("䷀");
    expect(hexagramOf("000000").glyph).toBe("䷁");
    expect(hexagramOf("100010")).toMatchObject({ number: 3, lower: "zhen", upper: "kan" });
  });

  test("the King Wen figures agree with the house's imported readings, and name where a page draws another", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const shelf = join(here, "../../../bags/crossroads/ha.ka.ba/lares/library/oracles");
    let read = 0;
    const slips: string[] = [];
    for (const source of ["doa", "e-jing"]) {
      for (const file of readdirSync(join(shelf, source)).filter((f) => /^hexagram-\d\d\.mem$/.test(f))) {
        const text = readFileSync(join(shelf, source, file), "utf8");
        const n = Number(/^hexagram\s*=\s*"(\d+)"/m.exec(text)?.[1]);
        const lines = /^lines\s*=\s*"([01]{6})"/m.exec(text)?.[1];
        expect(lines, `${source}/${file}`).toBe(figureOf(n));
        const page = /^page-lines\s*=\s*"([01]{6})"/m.exec(text)?.[1];
        if (page !== undefined) slips.push(`${source}:${n}->${hexagramOf(page).number}`);
        read += 1;
      }
    }
    expect(read).toBe(128);
    expect(slips.sort()).toEqual(["doa:23->29", "doa:36->35", "doa:37->36", "e-jing:23->29", "e-jing:36->35", "e-jing:37->36"]);
  });
});

describe("oracle-cast — the result as a tiddler, written once", () => {
  const cast = castFromCoins([8, 8, 9, 6, 8, 8], ASK);

  test("the title sits under a casts/ prefix and carries the caller's time", () => {
    expect(castTitle(cast)).toBe("lar:///ha.ka.ba/lares/oracle/casts/2026-11-20T23-15-02-123Z-15-16");
  });

  test("the fields name method, entropy, lines, both hexagrams, caster and time", () => {
    const fields = castFields(cast);
    expect(fields).toMatchObject({
      title: castTitle(cast),
      type: "text/vnd.tiddlywiki",
      tags: "oracle/cast",
      method: "three-coins",
      entropy: "operator:three-coins",
      lines: "8 8 9 6 8 8",
      changing: "3 4",
      primary: "15",
      "primary-figure": "001000",
      relating: "16",
      "relating-figure": "000100",
      caster: "operator",
      "cast-at": "2026-11-20T23:15:02.123Z",
    });
    expect(fields["readings"]).toBe(castReadingTitles(cast).map((t) => `[[${t}]]`).join(" "));
    expect(fields["text"]).toContain(ORACLE_WIDENS);
    expect(fields["text"]).toContain(`{{${readingTitle("doa", 15)}#/reading}}`);
  });

  test("the readings name both sources for both hexagrams", () => {
    expect(castReadingTitles(cast)).toEqual([
      "lar:///ha.ka.ba/lares/library/oracles/doa/hexagram-15",
      "lar:///ha.ka.ba/lares/library/oracles/e-jing/hexagram-15",
      "lar:///ha.ka.ba/lares/library/oracles/doa/hexagram-16",
      "lar:///ha.ka.ba/lares/library/oracles/e-jing/hexagram-16",
    ]);
  });

  test("the plain reading names the figure, the change and the oracle's limit", () => {
    const text = castText(cast);
    expect(text).toContain("Hexagram 15");
    expect(text).toContain("16");
    expect(text).toContain("operator:three-coins");
    expect(text).toContain(ORACLE_WIDENS);
    expect(ORACLE_WIDENS).toBe("the oracle widens attention and never decides");
  });
});
