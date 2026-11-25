/**
 * spirit-shrine.test.ts — the spirit door's pure core answers as the door answered before the lift.
 *
 * THE WELD BEFORE THE MOVE. `fixtures/spirit-shrine-golden.json` holds what lares-cli's `commands/spirit.ts` exports answered on
 * these cases before its pure half moved here (a text past 600 chars rides as its sha256 and length). The core must give the
 * same answers on the same cases; spirit-door.test.ts drives the host loops over it, unchanged.
 *
 * Research: lar:///ha.ka.ba/kahua/memory/research/into-the-vm#/spirit-first
 */
import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as S from "../src/spirit-shrine.js";

const GOLDEN = JSON.parse(readFileSync(new URL("./fixtures/spirit-shrine-golden.json", import.meta.url), "utf8")) as Record<string, unknown>;

const M = S.MEMORY_PREFIX;
const URI = `${M}familiar/lares-alpha`;
const ID = "abcdef012345";
const framed = (slot: string, body: string) => `<<~ ahu slot=\`${slot}\`>>\n\n${body}\n\n<<~/ahu>>\n`;
const slots = [
  { slot: "#/entry", bytes: 900, first: "entry" },
  { slot: "#/open", bytes: 2400, first: "open" },
  { slot: "#/attention", bytes: 300, first: "attention" },
  { slot: "#/bodies", bytes: 4000, first: "bodies" },
];
const round = `${M}${S.COMPACTION_WORD}/lares-alpha-0123456789ab`;
const hand = `${M}spirit/${ID}-handback-ba9876543210`;
const other = `${M}${S.COMPACTION_WORD}/lares-alpha-two-0123456789ab`;
const hex = "ab".repeat(32);
const carry = { title: `${M}${S.COMPACTION_WORD}/${ID}-0123456789ab`, fields: { depth: "5", body: "sess-1", parent: "aaaaaaaaaaaa", "record-base": "sha256:" + "11".repeat(32) }, text: "" };
const err = (e: S.SpiritRefusal | null) => (e === null ? null : { code: e.code, message: e.message, exit: e.exit });
/** A text past 600 chars rides as its sha256 and length, as the golden holds it. */
const squash = (v: unknown): unknown =>
  typeof v === "string" && v.length > 600 ? { sha256: createHash("sha256").update(v, "utf8").digest("hex"), length: v.length }
  : Array.isArray(v) ? v.map(squash)
  : v !== null && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, squash(x)]))
  : v;

describe("the lifted core answers as spirit.ts answered", () => {
  const now: Record<string, unknown> = {
    sideOf: S.sideOf("lares-alpha"),
    ashLedgerOf: S.ashLedgerOf(new Date("2026-12-02T00:00:00Z")),
    compactionTitle: S.compactionTitle(ID, "0123456789abcdef".repeat(4)),
    residueTitle: S.residueTitle("om-wright", "fedcba9876543210".repeat(4)),
    shq: S.shq("it's a 'quote'"),
    slotDigest: [S.slotDigest("!! X\n\n* a"), S.slotDigest(""), S.slotDigest("kūlana ʻokina ✶")],
    slotBody: [S.slotBody(framed("#/x", "!! X\n\n* a")), S.slotBody("no frame\n\n"), S.slotBody(framed("#/y", ""))],
    residueOf: [S.residueOf(["lares-alpha", ID], [round, hand, other, URI]), S.residueOf("lares-alpha", [round, round, other])],
    secretCount: [S.secretCount(`a ward ticket ${hex}`), S.secretCount("a clean loop")],
    leaseOf: [S.leaseOf("sess-1 3 2026-11-24T12:00:00Z"), S.leaseOf("bad"), S.leaseOf(undefined)],
    crossingsOf: S.crossingsOf("sess-1 2026-11-24T12:00:00Z\n2026-11-24T11:00:00Z\nsess-2 2026-11-24T11:59:00Z\n"),
    presenceOf: S.presenceOf("lares-alpha#sess-1 2026-11-24T12:00:00Z\njunk\nlares-alpha#sess-2 2026-11-24T11:30:00Z"),
    presenceLine: S.presenceLine("lares-alpha", S.presenceOf("lares-alpha#sess-1aaaaaaaa 2026-11-24T12:00:00Z\nlares-alpha#sess-2bbbbbbbb 2026-11-24T11:30:00Z")),
    testimonyLines: [S.testimonyLines({ base: "sha256:" + "22".repeat(32) }, carry, 2), S.testimonyLines({ base: "x" }, null, 0)],
    omText: [S.omText({ pet: "p", uri: URI, has: "has" }, { open: "x".repeat(20_000) }), S.omText({ pet: "p", uri: URI, has: "has" }, { open: "open", testimony: ["t1", "t2"], attention: "att", lead: "lead" }, 400)],
    wakingCap: [S.wakingCap(undefined, "#/open"), S.wakingCap({ slot: 500, record: 1 }, "#/attention"), S.wakingCap(undefined, "#/bodies")],
    budgetRefusal: [
      err(S.budgetRefusal({ pet: "lares-alpha", uri: URI, slots }, "#/open", "a", "x".repeat(3000))),
      err(S.budgetRefusal({ pet: "lares-alpha", uri: URI, slots }, "#/open", "a", "x".repeat(3000), 2)),
      err(S.budgetRefusal({ pet: "lares-alpha", uri: URI, slots }, "#/bodies", "a", "x".repeat(30000))),
      err(S.budgetRefusal({ pet: "lares-alpha", uri: URI, slots }, "#/open", "x".repeat(3000), "x".repeat(2999))),
    ],
    advisoryLine: [S.advisoryLine({ slots }), S.advisoryLine({ slots: slots.slice(0, 1) }), S.advisoryLine({ slots: slots.slice(0, 1) }, true)],
    measure: S.measure({ slots, budgets: { slot: null, record: 7000 } }),
    stanzaVersions: [S.stanzaVersions("plain"), S.stanzaVersions(S.conflictStanza("#/open", [{ who: "a#1", words: "one" }, { who: "b", words: "two" }]))],
    conflictStanza: S.conflictStanza("#/open", [{ who: "c#3", words: "three" }, { who: "older", words: S.conflictStanza("#/open", [{ who: "a#1", words: "one" }, { who: "b", words: "two" }]) }, { who: "dup", words: "one" }]),
    starterText: S.starterText("om-wright"),
    shrineSlots: S.SHRINE_SLOTS,
    bodiesLine: [S.bodiesLine("2026-11-24", "0123456789abcdef", "lares-alpha", "sess-1aaaaaaaa", round), S.bodiesLine("2026-11-24", "0123456789abcdef", "lares-alpha", "", round)],
    constants: { OM_CAP_CHARS: S.OM_CAP_CHARS, WAKING_SLOT_BUDGETS: S.WAKING_SLOT_BUDGETS, RECORD_BUDGET_BYTES: S.RECORD_BUDGET_BYTES, TRUE_UP_EVERY: S.TRUE_UP_EVERY, RESIDUE_CAP_CHARS: S.RESIDUE_CAP_CHARS, DEEP_CARRY: S.DEEP_CARRY, PRESENCE_CAP: S.PRESENCE_CAP, PRECOMPACT_CARD_CHARS: S.PRECOMPACT_CARD_CHARS, ATTENTION_TITLES: S.ATTENTION_TITLES, MEMORY_PREFIX: S.MEMORY_PREFIX, RECORD_KINDS: S.RECORD_KINDS },
  };
  for (const key of Object.keys(GOLDEN)) {
    test(`${key} answers the golden`, () => {
      expect(squash(JSON.parse(JSON.stringify(now[key])))).toEqual(GOLDEN[key]);
    });
  }
  test("every golden case stands in the run", () => {
    expect(Object.keys(now).sort()).toEqual(Object.keys(GOLDEN).sort());
  });
  test("the slot digest rides the house's sync sha256 and answers as node:crypto did", () => {
    for (const body of ["!! X\n\n* a", "", "kūlana ʻokina ✶", "x".repeat(70_000)]) {
      expect(S.slotDigest(body)).toBe(createHash("sha256").update(body, "utf8").digest("hex").slice(0, 16));
      expect(S.spiritHash(body)).toBe(createHash("sha256").update(body, "utf8").digest("hex"));
      expect(S.bytesOf(body)).toBe(Buffer.byteLength(body, "utf8"));
    }
  });
});

describe("the merges the host loops ran inline", () => {
  const NOW = new Date("2026-11-24T12:00:00Z");
  test("a waking body joins the presence first, drops none by age, and orders the rest by seq (ties keep their order)", () => {
    const fields = { "bodies-awake": "p#old 2026-11-24T10:00:00Z\np#sib 2026-11-24T11:50:00Z\np#me 2026-11-24T11:00:00Z" };
    const { awake, write } = S.presenceJoin(fields, "p", "me", NOW);
    expect(awake.map((a) => a.body)).toEqual(["me", "old", "sib"]);
    expect(write).toEqual({ patch: { "bodies-awake": "p#me 2026-11-24T12:00:00.000Z 1\np#old 2026-11-24T10:00:00Z 0\np#sib 2026-11-24T11:50:00Z 0" } });
  });
  test("presence caps by count, and a clock skewed 50 years either way changes nothing", () => {
    const many = Array.from({ length: S.PRESENCE_CAP + 4 }, (_, i) => `p#b${String(i).padStart(2, "0")} 2026-11-24T11:${String(i).padStart(2, "0")}:00Z`).join("\n");
    const base = S.presenceJoin({ "bodies-awake": many }, "p", "me", NOW);
    expect(base.awake).toHaveLength(S.PRESENCE_CAP);
    for (const years of [-50, 50]) {
      const skewed = new Date(Date.UTC(2026 + years, 10, 24, 12));
      const got = S.presenceJoin({ "bodies-awake": many }, "p", "me", skewed);
      expect(got.awake.map((a) => a.body)).toEqual(base.awake.map((a) => a.body));
      expect(got.awake.slice(1).map((a) => a.body)).toEqual(base.awake.slice(1).map((a) => a.body));
    }
  });
  test("the wake epoch: the holder keeps it and writes nothing; another body raises it", () => {
    expect(S.leaseClaim({ lease: "me 3 2026-11-24T11:00:00Z" }, "me", NOW)).toEqual({ epoch: 3, write: null });
    expect(S.leaseClaim({ lease: "sib 3 2026-11-24T11:00:00Z" }, "me", NOW)).toEqual({ epoch: 4, write: { patch: { lease: "me 4 2026-11-24T12:00:00.000Z" } } });
    expect(S.leaseClaim({}, "me", NOW).epoch).toBe(1);
  });
  test("the crossing marks one body, keeps a sibling's mark, and clears to an unset", () => {
    const fields = { crossing: "sib 2026-11-24T11:55:00Z\nold 2026-11-24T11:00:00Z" };
    expect(S.crossingWrite(fields, "me", NOW, true)).toEqual({ patch: { crossing: "sib 2026-11-24T11:55:00Z 0\nold 2026-11-24T11:00:00Z 0\nme 2026-11-24T12:00:00.000Z 1" } });
    expect(S.crossingWrite({ crossing: "me 2026-11-24T11:59:00Z" }, "me", NOW, false)).toEqual({ unset: ["crossing"] });
    expect(S.crossingWrite({}, "me", NOW, false)).toBeNull();
    const rec = { crossing: "me 2026-11-24T11:59:00Z", uri: URI, pet: "lares-alpha" };
    expect(S.crossingRefusal(rec, "me")?.code).toBe("spirit-crossing");
    expect(S.crossingRefusal(rec, "sib")).toBeNull();
    expect(S.crossingRefusal(rec, null)).toBeNull();
  });
  test("the cap orders by the minted seq: a +50y or -50y stamp on a sibling never reorders it, and a live body never drops for a skewed one", () => {
    const lines = (stamps: string[]) => stamps.map((at, i) => `p#b${String(i).padStart(2, "0")} ${at} ${i + 1}`).join("\n");
    const n = S.PRESENCE_CAP;
    const plain = Array.from({ length: n }, () => "2026-11-24T11:00:00Z");
    const skewed = plain.map((_, i) => (i === 0 ? "1976-11-24T11:00:00Z" : i === 1 ? "2076-11-24T11:00:00Z" : "2026-11-24T11:00:00Z"));
    const a = S.presenceJoin({ "bodies-awake": lines(plain) }, "p", "me", NOW).awake.map((x) => x.body);
    const b = S.presenceJoin({ "bodies-awake": lines(skewed) }, "p", "me", NOW).awake.map((x) => x.body);
    expect(b).toEqual(a);
    expect(b[0]).toBe("me");
    expect(b).not.toContain("b00");
    expect(b).toContain("b01");
    // the minted seq rises by one past the highest seen, whatever the stamp says
    expect(S.presenceJoin({ "bodies-awake": "p#x 2076-11-24T11:00:00Z 7" }, "p", "me", NOW).awake[0]!.seq).toBe(8);
  });
  test("a crossing mark drops only past CROSSING_CAP later marks, oldest seq first, never by stamp", () => {
    const marks = Array.from({ length: S.CROSSING_CAP }, (_, i) => `b${i} ${i === 0 ? "2076-11-24T11:00:00Z" : "1976-11-24T11:00:00Z"} ${i + 1}`).join("\n");
    const next = S.crossingsOf((S.crossingWrite({ crossing: marks }, "me", NOW, true) as { patch: { crossing: string } }).patch.crossing);
    expect(next).toHaveLength(S.CROSSING_CAP);
    expect(next.map((c) => c.who)).not.toContain("b0");
    expect(next.map((c) => c.who)).toContain("b1");
    expect(next.at(-1)).toMatchObject({ who: "me", seq: S.CROSSING_CAP + 1 });
  });
  test("the refusal names the hand cure with the body id filled in", () => {
    const e = S.crossingRefusal({ crossing: "me 2026-11-24T11:59:00Z 1", uri: URI, pet: "lares-alpha" }, "me");
    expect(e?.message).toContain("lares spirit om lares-alpha --body me");
    expect(e?.message).toContain("crashed");
  });
  test("a crossing lifts only on the body's own wake: a mark stamped 50 years either way still holds, and no clock clears it", () => {
    for (const at of ["1976-11-24T12:00:00Z", "2076-11-24T12:00:00Z"]) {
      const rec = { crossing: `me ${at}`, uri: URI, pet: "lares-alpha" };
      expect(S.crossingRefusal(rec, "me")?.code).toBe("spirit-crossing");
      expect(S.crossingWrite({ crossing: `me ${at}\nsib ${at}` }, "me", NOW, false)).toEqual({ patch: { crossing: `sib ${at} 0` } });
      expect(S.crossingWrite({ crossing: `me ${at}` }, "me", NOW, false)).toEqual({ unset: ["crossing"] });
    }
    const skewed = new Date(Date.UTC(2076, 10, 24, 12));
    expect(S.crossingWrite({ crossing: "sib 2026-11-24T11:55:00Z" }, "me", skewed, true)).toEqual({ patch: { crossing: "sib 2026-11-24T11:55:00Z 0\nme 2076-11-24T12:00:00.000Z 1" } });
  });
  test("a slot write appends, replaces, or lands both versions in one stanza", () => {
    expect(S.slotWriteBody("#/open", "!! Open\n\n* a", { add: "* b" }, false, "x")).toBe("!! Open\n\n* a\n* b");
    expect(S.slotWriteBody("#/open", "old", { words: "new\n\n", base: null, who: "p#me" }, false, "x")).toBe("new");
    const clash = S.slotWriteBody("#/open", "theirs", { words: "mine", base: "0".repeat(16), who: "p#me" }, true, "p#sib");
    expect(S.stanzaVersions(clash)).toEqual([{ who: "p#me", words: "mine" }, { who: "p#sib", words: "theirs" }]);
  });
  test("a fold finds its line by content, and the listed line by its digest", () => {
    expect(S.foldOut("a\nb\nc", "b")).toBe("a\nc");
    expect(S.foldOut("a\nc", "b")).toBeNull();
    const lines = ["a", "b", "c"];
    expect(S.pickLine(lines, "2", S.slotDigest("b"))).toBe(1);
    expect(S.pickLine(lines, "1", S.slotDigest("c"))).toBe(2);
    expect(S.pickLine(lines, "1", S.slotDigest("z"))).toBe(-1);
  });
  test("a carry lands with its lineage; a handback's hash keys on its salt", () => {
    const parent = { title: `${M}${S.COMPACTION_WORD}/${ID}-0123456789ab`, fields: { depth: "2", body: "me" } };
    expect(S.carryParent([{ title: "t-other", fields: { body: "sib" } }, parent], "me")).toBe(parent);
    expect(S.carryParent([], "")).toBeNull();
    expect(S.carryFields({ pet: "p", key: ID, body: "me", base: "partial:#/x:sha256-" + "ab".repeat(32), parent, now: NOW })).toEqual({
      description: `a ${S.COMPACTION_DISPLAY} of p, 2026-11-24: the summary one body's context turned on`,
      landed: "2026-11-24T12:00:00.000Z", "spirit-id": ID, pet: "p", parent: "0123456789ab", "record-base": "sha256:" + "ab".repeat(32), depth: "3", body: "me",
    });
    expect(S.residueHash("t", null)).toBe(S.spiritHash("t"));
    expect(S.residueHash("t", "s:a")).toBe(S.spiritHash("s:a\nt"));
    expect(S.residueCut("x".repeat(S.RESIDUE_CAP_CHARS + 1))).toEqual({ text: "x".repeat(S.RESIDUE_CAP_CHARS), cut: true });
  });
  test("the burn holds what the distill mark leaves uncovered and tallies what stands", () => {
    expect(S.distillHold(null, "2026-11-01")).toBe("no distill mark stands yet");
    expect(S.distillHold("2026-11-10", "2026-11-20")).toBe("landed after the last distill mark");
    expect(S.distillHold("2026-11-10", "2026-11-01")).toBeNull();
    expect(S.burnTally("2026-11-24", "p", ["a"], ["a", "b"])).toBe("* 2026-11-24 · otakiage p burned 1 of 2; still standing: b");
    expect(S.carryParents([{ title: "a", fields: { parent: "x" } }, { title: "b", fields: {} }], ["a", "b"])).toEqual(new Set(["x"]));
  });
  test("the record shapes from the doors' answers, and the spirit-id mints from address and base", () => {
    const rec = S.spiritRecordOf(
      { pet: "lares-alpha", kind: "familiar", uri: URI, out: { has: "h", meme: { canonicalHash: "sha256:" + "aa".repeat(32), bytes: 10, slots } } },
      { "spirit-id": ID, "slot-budget": "500" }, { lease: "me 2 2026-11-24T11:00:00Z", distilled: "2026-11-01" },
    );
    expect(rec).toMatchObject({ id: ID, budgets: { slot: 500, record: S.RECORD_BUDGET_BYTES }, every: S.TRUE_UP_EVERY, lease: { body: "me", epoch: 2 }, distilled: "2026-11-01", crossing: null, side: S.sideOf("lares-alpha") });
    expect(S.spiritIdOf(URI, "skinny:sha256-" + "aa".repeat(32))).toBe(createHash("sha256").update(`${URI}\nsha256:${"aa".repeat(32)}`).digest("hex").slice(0, 12));
  });
});
