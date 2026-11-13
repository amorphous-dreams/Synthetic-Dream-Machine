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
    expect(plan("lar:///ha.ka.ba/x", "lar:///ha.ka.ba/y", "--bag", "lares")).toEqual({ verb: "offer-make", args: { bag: "lares", titles: ["lar:///ha.ka.ba/x", "lar:///ha.ka.ba/y"] } });
    expect(plan("list", "--bag", "lares", "--all")).toEqual({ verb: "offer-list", args: { bag: "lares", all: true } });
    expect(plan("list")).toEqual({ verb: "offer-list", args: {} });
    expect(plan("show", CID)).toEqual({ verb: "offer-show", args: { cid: CID } });
    expect(plan("promote", CID)).toEqual({ verb: "offer-promote", args: { cid: CID } });
    expect(plan("promote", CID, "--over-fresher")).toEqual({ verb: "offer-promote", args: { cid: CID, overFresher: true } });
  });

  test("a malformed act refuses by name before any socket", () => {
    expect(() => plan("lar:///ha.ka.ba/x")).toThrow(/--bag/);
    expect(() => plan("promote", "nope")).toThrow(/64 hex/);
    expect(() => plan("not-a-uri", "--bag", "lares")).toThrow(/lar: uris/);
  });
});

describe("lares meme offer promote", () => {
  const doors = (over: Partial<Parameters<typeof promoteThenRetire>[0]> = {}) => {
    const calls: string[] = [];
    return { calls, doors: {
      seat:    async () => { calls.push("seat"); return { standing: "open" }; },
      promote: async () => { calls.push("promote"); return { moved: true, over: [] as unknown[] }; },
      retire:  async () => { calls.push("retire"); return { retired: true, retire: "b".repeat(64) }; },
      ...over,
    } };
  };

  test("a vessel that can seal no retire refuses before the canon write: the promote door never opens", async () => {
    const d = doors({ seat: async () => { throw new Error("offer-retire-unseated: this vessel holds no seat of the charter"); } });
    const out = await promoteThenRetire(d.doors);
    expect(out).toMatchObject({ ok: false, wrote: false });
    expect((out as { message: string }).message).toMatch(/nothing was written.*offer-retire-unseated/);
    expect(d.calls).toEqual([]);
    // CONTROL: a seated vessel walks seat check, canon write, retire, in that order, as one outcome.
    const seated = doors();
    expect(await promoteThenRetire(seated.doors)).toMatchObject({ ok: true, retire: { retired: true } });
    expect(seated.calls).toEqual(["seat", "promote", "retire"]);
  });

  test("a retire that refuses after the canon write names both halves and the act that completes it", async () => {
    const d = doors({ retire: async () => { throw new Error("offer-not-landed: canon does not yet carry x"); } });
    const out = await promoteThenRetire(d.doors);
    expect(out).toMatchObject({ ok: false, wrote: true });
    expect((out as { message: string }).message).toMatch(/the canon write landed; the retire did not: offer-not-landed.*run the promote again/);
  });
});
