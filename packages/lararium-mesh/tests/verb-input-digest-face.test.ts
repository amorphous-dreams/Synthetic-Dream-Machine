import { describe, expect, test } from "vitest";
import { verbInputDigest } from "../src/verb-tiddler.js";

describe("verb input digest face", () => {
  test("display names leave the digest, while verified faces enter it", async () => {
    const input = { verb: "load", args: { item: 1 }, face: "proof-a" };
    const first = await verbInputDigest(input);
    const second = await verbInputDigest({ ...input });
    expect(first).toBe(second);
    expect(await verbInputDigest({ ...input, face: "proof-b" })).not.toBe(first);
    expect(await verbInputDigest({ verb: input.verb, args: input.args })).not.toBe(first);
    // @ts-expect-error the old {verb,args,requestedBy} shape no longer belongs to the digest input
    const withDisplay = await verbInputDigest({ verb: "load", args: { item: 1 }, requestedBy: "display-only" });
    expect(withDisplay).toBe(await verbInputDigest({ verb: "load", args: { item: 1 } }));
    expect(await verbInputDigest(input)).toBe(first);
  });
});
