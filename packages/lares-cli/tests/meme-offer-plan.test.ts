/**
 * meme-offer-plan.test — `lares meme offer` routes each act to its declared daemon verb (offering#/the-canon-offer):
 * an offer to `offer-make` (its bag and titles riding along), `list` to `offer-list`, `show` to `offer-show`, `promote` to
 * `offer-promote` (the explicit `--over-fresher` choice riding only when named). A malformed act refuses before any socket.
 */
import { describe, expect, test } from "vitest";
import { offerPlan, promoteThenRetire } from "../src/commands/meme.js";
import { parseArgs } from "../src/parse-args.js";

const plan = (...argv: string[]) => offerPlan(parseArgs(["meme", "offer", ...argv]));
const CID = "a".repeat(64);

describe("lares meme offer", () => {
  test("each act names its daemon verb", () => {
    expect(plan("lar:///ha.ka.ba/x", "lar:///ha.ka.ba/y", "bag=lares")).toEqual({ verb: "offer-make", args: { bag: "lares", titles: ["lar:///ha.ka.ba/x", "lar:///ha.ka.ba/y"] } });
    expect(plan("show", "bag=lares", "all=true")).toEqual({ verb: "offer-list", args: { bag: "lares", all: true } });
    expect(plan("show")).toEqual({ verb: "offer-list", args: {} });
    expect(plan("show", CID)).toEqual({ verb: "offer-show", args: { cid: CID } });
    expect(plan("promote", CID)).toEqual({ verb: "offer-promote", args: { cid: CID } });
    expect(plan("promote", CID, "over-fresher=true")).toEqual({ verb: "offer-promote", args: { cid: CID, overFresher: true } });
  });

  test("offer show folds list and item while item refuses list filters", () => {
    expect(plan("show")).toEqual({ verb: "offer-list", args: {} });
    expect(plan("show", CID)).toEqual({ verb: "offer-show", args: { cid: CID } });
    expect(() => plan("show", CID, "all=true")).toThrow(/all=true/);
    expect(() => plan("show", CID, "bag=lares")).toThrow(/bag=/);
  });

  test("a malformed act refuses by name before any socket", () => {
    expect(() => plan("lar:///ha.ka.ba/x")).toThrow(/bag=<slug>/);
    expect(() => plan("promote", "nope")).toThrow(/64 hex/);
    expect(() => plan("not-a-uri", "bag=lares")).toThrow(/lar: uris/);
  });
});

describe("lares meme offer promote", () => {
  const HEADS = ["c".repeat(64)];
  const doors = (over: Partial<Parameters<typeof promoteThenRetire>[0]> = {}) => {
    const calls: unknown[] = [];
    return { calls, doors: {
      promote: async () => { calls.push("promote"); return { moved: true, over: [] as unknown[], canonHeads: HEADS }; },
      retire:  async (o: unknown, after: unknown) => { calls.push(["retire", o, after]); return { retired: true, retire: "b".repeat(64) }; },
      ...over,
    } };
  };

  test("the promotion walks two doors and no third: the canon write, then the retire, which rides the heads the write answered", async () => {
    const d = doors();
    expect(await promoteThenRetire(d.doors)).toMatchObject({ ok: true, retire: { retired: true } });
    expect(d.calls).toEqual(["promote", ["retire", [], HEADS]]);
    // CONTROL: a promotion that held (the offer already retired) asks no retire.
    const held = doors({ promote: async () => ({ moved: false }) });
    expect(await promoteThenRetire(held.doors)).toMatchObject({ ok: true, retire: null });
    expect(held.calls).toEqual([]);
  });

  test("a retire whose replica of canon still trails reads as pending, never as a refusal: the canon write stands and the re-run is named", async () => {
    const d = doors({ retire: async () => ({ retired: false, why: "canon-trails", pending: "the canon write stands; the retire still pends: run `lares meme offer promote` again" }) });
    const out = await promoteThenRetire(d.doors);
    expect(out).toMatchObject({ ok: false, wrote: true, pending: true });
    expect((out as { message: string }).message).toMatch(/the canon write stands; the retire still pends/);
    expect((out as { message: string }).message).not.toMatch(/did not|refus/);
  });

  test("a retire that refuses after the canon write names both halves and the act that completes it", async () => {
    const d = doors({ retire: async () => { throw new Error("offer-not-landed: canon does not yet carry x"); } });
    const out = await promoteThenRetire(d.doors);
    expect(out).toMatchObject({ ok: false, wrote: true, pending: false });
    expect((out as { message: string }).message).toMatch(/the canon write landed; the retire did not: offer-not-landed.*run the promote again/);
  });
});
