/**
 * meme-offer-plan.test — `lares meme offer` routes each act to its declared daemon verb (offering#/the-canon-offer):
 * an offer to `offer-make` (its bag and titles riding along), `list` to `offer-list`, `show` to `offer-show`, `promote` to
 * `offer-promote` (the explicit `--over-fresher` choice riding only when named). A malformed act refuses before any socket.
 */
import { describe, expect, test } from "vitest";
import { offerPlan } from "../src/commands/meme.js";
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
