/**
 * oracle-loop — the cast as an OODA-HA meme whose slots read from canon: the rows of api/pono/oracle-loop#/loop name each
 * slot, its order, its writer, its fill and its owed ask; the ask's pointers and uncertainty fill the first slots; the throw
 * and every reading (each distinct text quoted once, every source's credit beneath it) fill #/decide; the seat's slots stay
 * owed. No slot name lives in the module: these tests read the canon file itself.
 */
import { readFileSync } from "node:fs";
import { describe, test, expect } from "vitest";
import { castFromCoins, ORACLE_THROW_STANDS } from "../src/oracle-cast.js";
import {
  CAST_MEME_TAGS, ORACLE_AFFORDANCE, castMemeBody, castMeta, fillLoop, kaheaTarget, loopSlots, parseHasRows, quotedReadings, readingsText,
  type LoopReading,
} from "../src/oracle-loop.js";

const canon = (rel: string): string => readFileSync(new URL(`../../../bags/lares/ha.ka.ba/lares/${rel}`, import.meta.url), "utf8");
const LOOP_LAW = canon("api/pono/oracle-loop.mem");
const CARRIER = canon("afford/oracle.cast.throws.mem");

/** The text of one ahu slot of a canon file, up to its own closer. */
function slotOf(text: string, slot: string): string {
  const open = text.indexOf(`<<~ ahu slot=\`${slot}\`>>`);
  expect(open).toBeGreaterThanOrEqual(0);
  return text.slice(open, text.indexOf("<<~/ahu>>", open));
}

const AT = "2026-11-26T10:00:00.000Z";
const CAST = castFromCoins([8, 8, 9, 6, 8, 8], { caster: "lares-alpha#00003", at: AT });
const PROSE = "First paragraph of the reading.\n\nSecond paragraph, longer.";
const READINGS: LoopReading[] = [
  { title: "lar:///ha.ka.ba/lares/library/oracles/doa/hexagram-15", caption: "15. Turn Me On", text: `! ䷎ 15\n\n${PROSE}`, attribution: "DOA", license: "Kopyleft" },
  { title: "lar:///ha.ka.ba/lares/library/oracles/e-jing/hexagram-15", caption: "15. Turn Me On", text: `! ䷎ 15\n\n${PROSE}`, attribution: "e-jing", license: "(K)opyLeft" },
  { title: "lar:///ha.ka.ba/lares/library/oracles/doa/hexagram-16", absent: true },
];
const SLOTS = loopSlots(parseHasRows(slotOf(LOOP_LAW, "#/loop")));

describe("oracle-loop", () => {
  test("the carrier's #/loop calls the procedure's own slot by kahea, and the canon rows name five slots in loop order", () => {
    expect(kaheaTarget(slotOf(CARRIER, "#/loop"))).toEqual({ uri: "lar:///ha.ka.ba/lares/api/pono/oracle-loop", slot: "#/loop" });
    expect(SLOTS.map((s) => [s.name, s.phase, s.writer, s.fills])).toEqual([
      ["#/observe", "✶", "seat-at-the-ask", "observe"],
      ["#/orient", "⏿", "seat-at-the-ask", "uncertain"],
      ["#/decide", "◇", "house-then-seat", "throw"],
      ["#/act", "▶", "seat", null],
      ["#/hooko", "↺", "seat", null],
    ]);
    expect(SLOTS.every((s) => s.owes !== "")).toBe(true);
  });

  test("a has row reads its bracketed values whole and its tagline after the tilde", () => {
    const [row] = parseHasRows("<<has entity=`arg` name=`asking` params=`takes/words cure/[[a b c]] ~ the query, named first`>>");
    expect(row).toEqual({ entity: "arg", name: "asking", params: { takes: "words", cure: "a b c" }, tagline: "the query, named first" });
  });

  test("the ask fills observe and orient; the house fills decide and leaves it owed; act and hooko stay owed", () => {
    const filled = fillLoop(SLOTS, { observe: ["lar:///x/y", "spirit/lane"], uncertain: "two leans, neither grounded", asking: "which lane first?", cast: CAST, readings: READINGS });
    expect(filled.map((f) => [f.slot, f.owed])).toEqual([
      ["#/observe", false], ["#/orient", false], ["#/decide", true], ["#/act", true], ["#/hooko", true],
    ]);
    expect(filled[0]!.text).toBe("* lar:///x/y\n* spirit/lane");
    expect(filled[1]!.text).toContain("two leans, neither grounded");
    expect(filled[1]!.text).toContain("which lane first?");
    const decide = filled[2]!.text;
    expect(decide).toContain("changing: 3, 4");
    expect(decide).toContain("operator:three-coins");
    expect(decide).toContain("testimony");
    expect(decide).toContain(`(owed: ${SLOTS[2]!.owes})`);
    expect(filled[3]!.text).toBe(`(owed: ${SLOTS[3]!.owes})`);
  });

  test("a bare ask leaves observe and orient owed, each naming its canon ask", () => {
    const filled = fillLoop(SLOTS, { observe: [], uncertain: "", asking: "", cast: CAST, readings: [] });
    expect(filled[0]).toMatchObject({ owed: true, text: `(owed: ${SLOTS[0]!.owes})` });
    expect(filled[1]).toMatchObject({ owed: true, text: `(owed: ${SLOTS[1]!.owes})` });
    expect(filled[2]!.text).toContain("no reading answered");
  });

  test("a reading two sources carry alike quotes once, with EVERY source's credit, and an absent one stays named", () => {
    const q = quotedReadings(READINGS);
    expect(q).toHaveLength(1);
    expect(q[0]!.credits).toEqual(["DOA · Kopyleft", "e-jing · (K)opyLeft"]);
    const t = readingsText(READINGS);
    expect(t.split("Second paragraph").length - 1).toBe(1);
    expect(t).toContain("DOA · Kopyleft");
    expect(t).toContain("e-jing · (K)opyLeft");
    expect(t).toContain("this wiki holds none of: lar:///ha.ka.ba/lares/library/oracles/doa/hexagram-16");
  });

  test("the meme body carries the cast's facts as meta, tags the address, and opens one slot per canon row", () => {
    const title = "lar:///ha.ka.ba/lares/oracle/casts/asked-0123456789abcdef";
    const meta = castMeta(CAST, { title, intent: "i".repeat(64), asking: "which lane first?", uncertain: "two leans", observe: ["a", "b"] });
    expect(meta).toMatchObject({ lines: "8 8 9 6 8 8", caster: "lares-alpha#00003", "cast-at": AT, uncertain: "two leans", observe: "a b", asking: "which lane first?" });
    expect(meta["text"]).toBeUndefined();
    const body = castMemeBody({ title, meta, cast: CAST, slots: fillLoop(SLOTS, { observe: ["a"], uncertain: "u", asking: "q", cast: CAST, readings: [] }) });
    expect(body.startsWith("```toml meta\n")).toBe(true);
    expect(body).toContain(`uri-path = "ha.ka.ba/lares/oracle/casts/asked-0123456789abcdef"`);
    expect(body).toContain(`tags = [${CAST_MEME_TAGS.map((t) => JSON.stringify(t)).join(", ")}]`);
    expect(CAST_MEME_TAGS).toContain(ORACLE_AFFORDANCE);
    expect(body).toContain(ORACLE_THROW_STANDS);
    expect(SLOTS.map((s) => body.indexOf(`<<~ ahu slot=\`${s.name}\`>>`))).toEqual([...SLOTS.map((s) => body.indexOf(`<<~ ahu slot=\`${s.name}\`>>`))].sort((a, b) => a - b));
    expect(SLOTS.every((s) => body.includes(`<<~ ahu slot=\`${s.name}\`>>`))).toBe(true);
    expect(() => castMemeBody({ title: "casts/x", meta, cast: CAST, slots: [] })).toThrow(/lar:\/\/\//);
  });

  test("no unfold axis survives: the module exports no unfold word, and its slots come from canon rows alone", async () => {
    const mod = await import("../src/oracle-loop.js") as Record<string, unknown>;
    expect(Object.keys(mod).filter((k) => /unfold|ENVELOPE/i.test(k))).toEqual([]);
    const meta = castMeta(CAST, { title: "lar:///ha.ka.ba/lares/oracle/casts/x", intent: "i".repeat(64), asking: "q", observe: [] });
    expect(() => castMemeBody({ title: "casts/x", meta, cast: CAST, slots: [] })).toThrow();
  });
});
