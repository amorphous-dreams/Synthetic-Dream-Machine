/**
 * spirit-witness.test.ts — the residue witness's pure core: a hand-back read for the filing line, the aim and yield with their
 * needed keys, the oracle's cross-check, the Personas ahead of their spans and the `->↺` marks against the closing tally; each
 * dropped part reads as a named tell carrying the seed slot that re-stands it. Transcripts parse into one hand-back per agent.
 * Every fixture stands synthetic, in the shape a real hand-back and a real subagent transcript take.
 * Plan: lar:///ha.ka.ba/kahua/memory/plan/the-house-summons (H4)
 */
import { describe, expect, test } from "vitest";
import * as W from "../src/spirit-witness.js";

const AIM = "<<~ set lares=`aim` from=`lar://op:operator@house/operator.asks.a-read` to=`lar://arm:agent@house/arm.reads.the-tree` aperture=`8/beat` ooda-ha=`5/declare-glyphs` drift-ward=`everything I hold rides the brief`>>";
const ORACLE = "<<~ oracle throw=`↯9 ✲ ⚂(3) ⁂:🜄⛰️〰️`>>";
const YIELD = "<<~ set lares=`yield` drift-ward=`the parser never met a live stream · ↻ L-Prime` aperture=`8/beat -> 9/measure` ooda-ha=`closed 1↺` from=`lar://arm:agent@house/read.lands.whole` to=`?`>>";
const body = (over: Partial<Record<"filing" | "aim" | "content" | "oracle" | "yield", string>> = {}): string => [
  over.filing ?? "cold-reader#2: (Lares Spirit)",
  over.aim ?? AIM,
  over.content ?? "Ink-Clerk (Lorekeeper): ->✶ the tree holds three readers.\n\nLares (Council): ->↺ the third one carries the seam.",
  over.oracle ?? ORACLE,
  over.yield ?? YIELD,
].join("\n\n");
const codes = (text: string): string[] => W.frameWitness(text).tells.map((t) => t.code);
const tellOf = (text: string, code: string) => W.frameWitness(text).tells.find((t) => t.code === code);

describe("a hand-back that stands the frame reads clean", () => {
  test("filing line, aim, Personas, oracle and yield read with no tell", () => {
    const r = W.frameWitness(body());
    expect(r.tells).toEqual([]);
    expect(r.filing).toEqual({ pet: "cold-reader", instance: "2" });
    expect(r.personas).toEqual(["Ink-Clerk (Lorekeeper)", "Lares (Council)"]);
    expect(r.roles).toEqual(["Lorekeeper", "Council"]);
    expect(r.oracle).toEqual({ spend: 9, face: 3, count: 3, tail: 3 });
    expect([r.marks, r.tally]).toEqual([1, 1]);
  });
  test("the filing line reads without its colon, and a steer on the same heading reads clean", () => {
    const steer = "<<~ set lares=`steer` mode=`hold` drift-ward=`the read narrows`>>";
    const r = W.frameWitness(body({ filing: "cold-reader (Lares Spirit)", content: `Ink-Clerk (Lorekeeper): one.\n\n${steer}\n\nLares (Council): ->↺ two.` }));
    expect(r.tells).toEqual([]);
    expect(r.filing).toEqual({ pet: "cold-reader", instance: null });
    expect(r.steers).toBe(1);
  });
  test("a sigil broken across lines and a triple-backtick value holding a backtick read whole", () => {
    const aim = "<<~ set lares=`aim`\n  from=`lar://op:operator@house/a.b.c`\n  to=`lar://arm:agent@house/d.e.f`\n  ooda-ha=`3/declare-aftermath`\n  drift-ward=```the brief quotes `x` once```>>";
    const r = W.frameWitness(body({ aim }));
    expect(r.aim?.["drift-ward"]).toBe("the brief quotes `x` once");
    expect(r.tells).toEqual([]);
  });
});

describe("a dropped frame reads as a named tell with the slot that re-stands it", () => {
  test("no filing line names #/spirit-swarm", () => {
    expect(tellOf(body({ filing: "Here is what I found." }), "no-filing-line")?.slot).toBe("#/spirit-swarm");
  });
  test("no aim names #/exchange-protocol, and no aim key tell fires beside it", () => {
    const c = codes(body({ aim: "" }));
    expect(c).toContain("no-aim");
    expect(c.filter((x) => x.startsWith("aim-"))).toEqual([]);
    expect(tellOf(body({ aim: "" }), "no-aim")?.slot).toBe("#/exchange-protocol");
  });
  test("an aim missing from, to or the ward names #/set-and-setting; a zero band names #/ooda-ha", () => {
    const thin = "<<~ set lares=`aim` ooda-ha=`0/none`>>";
    expect(codes(body({ aim: thin }))).toEqual(expect.arrayContaining(["aim-no-from", "aim-no-to", "aim-no-drift-ward", "aim-band-zero"]));
    expect(tellOf(body({ aim: thin }), "aim-no-from")?.slot).toBe("#/set-and-setting");
    expect(tellOf(body({ aim: thin }), "aim-band-zero")?.slot).toBe("#/ooda-ha");
  });
  test("prose ahead of the aim reads aim-late", () => {
    expect(codes(body({ filing: "cold-reader#2: (Lares Spirit)\n\nA word before the frame." }))).toContain("aim-late");
  });
  test("no yield names #/exchange-protocol; a yield missing its keys names each", () => {
    expect(tellOf(body({ yield: "" }), "no-yield")?.slot).toBe("#/exchange-protocol");
    const thin = "<<~ set lares=`yield` to=`lar://arm:agent@house/x.y.z`>>";
    expect(codes(body({ yield: thin }))).toEqual(expect.arrayContaining(["yield-no-drift-ward", "yield-no-from", "yield-to-not-open", "yield-no-ooda-ha"]));
  });
  test("a ward that never re-arms names #/l-prime", () => {
    const y = YIELD.replace(" · ↻ L-Prime", "");
    expect(tellOf(body({ yield: y }), "yield-ward-unarmed")?.slot).toBe("#/l-prime");
  });
  test("a steer carrying from reads as a tell", () => {
    const steer = "<<~ set lares=`steer` from=`lar://a:b@c/d.e.f` to=`lar://a:b@c/g.h.i`>>";
    expect(codes(body({ content: `Lares (Council): ->↺ one.\n\n${steer}` }))).toContain("steer-carries-from");
  });
});

describe("the oracle's cross-check", () => {
  test("die face, (N) and tail length in graphemes agree; a glyph with its variation selector counts once", () => {
    expect(W.oracleOf("↯12 ✲ ⚁(2) ⁂:⛰️☕")).toEqual({ spend: 12, face: 2, count: 2, tail: 2 });
    expect(W.graphemeCount("🦅〰️⟁☕🌀◈")).toBe(6);
  });
  test("a face, count or tail that disagree reads oracle-cross-check", () => {
    expect(codes(body({ oracle: "<<~ oracle throw=`↯9 ✲ ⚂(3) ⁂:🜄⛰️`>>" }))).toContain("oracle-cross-check");
    expect(codes(body({ oracle: "<<~ oracle throw=`↯9 ✲ ⚃(3) ⁂:🜄⛰️〰️`>>" }))).toContain("oracle-cross-check");
  });
  test("↯0 flags; a misshapen throw reads oracle-unread; no oracle reads no-oracle; an oracle after the yield reads as a tell", () => {
    expect(codes(body({ oracle: "<<~ oracle throw=`↯0 ✲ ⚀(1) ⁂:🗡️`>>" }))).toContain("oracle-spend-zero");
    expect(codes(body({ oracle: "<<~ oracle throw=`a roll of six`>>" }))).toContain("oracle-unread");
    expect(codes(body({ oracle: "" }))).toContain("no-oracle");
    const late = [body({ oracle: "" }), ORACLE].join("\n\n");
    expect(codes(late)).toContain("oracle-after-yield");
  });
});

describe("the Personas speak ahead of their spans", () => {
  test("no Persona tag names #/personas", () => {
    expect(tellOf(body({ content: "The tree holds three readers. ->↺" }), "no-persona")?.slot).toBe("#/personas");
  });
  test("a first span opening on no tag names #/working-agreement", () => {
    expect(tellOf(body({ content: "The tree holds three readers.\n\nLares (Council): ->↺ the seam." }), "span-unnamed")?.slot).toBe("#/working-agreement");
  });
  test("a role outside the thirteen opens no span; masks and named Personas with a known role do", () => {
    expect(W.frameWitness(body({ content: "Lares (Wizard): ->↺ one." })).personas).toEqual([]);
    expect(W.frameWitness(body({ content: "Kilo (Scryer): ->↺ one." })).personas).toEqual(["Kilo (Scryer)"]);
  });
});

describe("the ->↺ marks against the closing tally", () => {
  test("a tally counting other than the marks reads tally-mismatch under #/ooda-ha", () => {
    const t = tellOf(body({ yield: YIELD.replace("closed 1↺", "closed 3↺") }), "tally-mismatch");
    expect(t?.slot).toBe("#/ooda-ha");
    expect(t?.detail).toContain("3");
  });
  test("a mark inside a sigil value counts nothing; a suspended loop with no mark reads clean", () => {
    const aim = AIM.replace("everything I hold rides the brief", "the scale reads ->↺ alone");
    expect(W.frameWitness(body({ aim })).marks).toBe(1);
    const y = YIELD.replace("closed 1↺", "closed 0↺ -> open 1φ◇:awaiting.the-operator");
    expect(codes(body({ content: "Lares (Council): ->◇ the fork holds.", yield: y }))).toEqual([]);
  });
  test("a tally with no closed count reads tally-unread", () => {
    expect(codes(body({ yield: YIELD.replace("closed 1↺", "done") }))).toContain("tally-unread");
  });
});

describe("transcripts parse into one hand-back per agent", () => {
  const line = (o: Record<string, unknown>) => JSON.stringify(o);
  const asst = (agent: string, id: string, content: unknown) => line({ type: "assistant", agentId: agent, isSidechain: true, message: { id, role: "assistant", type: "message", content } });
  test("the last SubagentHandback message reads first; else the last assistant text, one message's lines joined", () => {
    const jsonl = [
      line({ type: "user", agentId: "a1", message: { role: "user", content: "brief" } }),
      asst("a1", "m1", [{ type: "thinking", thinking: "…" }]),
      asst("a1", "m2", [{ type: "text", text: "early words" }]),
      asst("a1", "m3", [{ type: "tool_use", id: "t1", name: "SubagentHandback", input: { message: "the report" } }]),
      asst("a2", "m4", [{ type: "text", text: "first half" }]),
      asst("a2", "m4", [{ type: "text", text: "second half" }]),
      "{ not json",
      line({ type: "attachment", agentId: "a2" }),
    ].join("\n");
    expect(W.transcriptHandbacks(jsonl)).toEqual([{ agent: "a1", text: "the report" }, { agent: "a2", text: "first half\nsecond half" }]);
  });
  test("an agent whose stream ends without text reads null; a file of no JSON reads no agent", () => {
    expect(W.transcriptHandbacks(asst("a3", "m1", [{ type: "tool_use", id: "t", name: "Bash", input: {} }]))).toEqual([{ agent: "a3", text: null }]);
    expect(W.transcriptHandbacks("garbage\n\n")).toEqual([]);
  });
});

describe("receipts: one line per reading, one tally", () => {
  test("a clean reading stands; a dropped frame tells with code → slot; another pet's filing reads elsewhere; an unread names its cure", () => {
    const ws = [
      W.witnessOf("r1", body(), "cold-reader"),
      W.witnessOf("r2", body({ aim: "" }), "cold-reader"),
      W.witnessOf("r3", body({ filing: "other-arm#4: (Lares Spirit)" }), "cold-reader"),
      W.unreadWitness("t.jsonl", "the file reads no JSON event", "ls -l t.jsonl"),
    ];
    expect(ws.map((w) => w.kind)).toEqual(["stands", "tells", "elsewhere", "unread"]);
    expect(W.witnessLine(ws[0]!)).toMatch(/^stands r1 · cold-reader#2 · personas 2 \(Lorekeeper, Council\) · ↺ 1\/1$/);
    expect(W.witnessLine(ws[1]!)).toContain("no-aim → #/exchange-protocol");
    expect(W.witnessLine(ws[2]!)).toContain("lares spirit residue other-arm --witness");
    expect(W.witnessLine(ws[3]!)).toBe("unread t.jsonl · the file reads no JSON event; read it: ls -l t.jsonl");
    const t = W.witnessTally("cold-reader", ws);
    expect(t).toMatchObject({ read: 4, stands: 1, tells: 1, elsewhere: 1, unread: 1, codes: { "no-aim": 1 } });
    expect(t.line).toBe("witness cold-reader: 4 read · 1 stand · 1 tell · 1 elsewhere · 1 unread · tells no-aim×1");
  });
});
