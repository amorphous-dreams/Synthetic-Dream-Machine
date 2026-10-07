/**
 * ONE FRAME READER AT TWO DEPTHS — the shape, and the digest over the shape.
 *
 * `frameShape(text)` reads the frame the way the span reader divides it — bare, torn (its faults
 * named), absent (no text frame), or framed (with the checked span) — and computes no digest.
 * `verdictOf(text, shape)` adds the one thing only a digest answers: does the check standing after ETX
 * cover the span? `verdict` IS their composition, so a reader that needs only the shape (a deserializer
 * that restamps only where a fence lands) reads the same frame, never a second one.
 */
import { describe, test, expect } from "vitest";
import { frameCarrier, frameShape, stampCarrier, verdict, verdictOf, META_OPEN_CANON } from "../src/index.js";

const URI = "lar:///t/depths";
const carrier = frameCarrier({ head: { uri: URI }, body: `${META_OPEN_CANON}\ntitle = "${URI}"\n\`\`\`\n\nProse.` });
const CHECK = /ni:\/\/\/sha-256;[A-Za-z0-9_-]+/;
const FIVE: Record<string, string> = {
  match:  carrier,
  stale:  carrier.replace(CHECK, "ni:///sha-256;0000000000000000000000000000000000000000000"),
  absent: carrier.replace(CHECK, ""),
  torn:   carrier.replace('<<^ code="&#x0003;">>', ""),
  bare:   "plain prose with no frame at all\n",
};

describe("★ frameShape · verdictOf — one reader, two depths ★", () => {
  for (const [kind, text] of Object.entries(FIVE)) {
    test(`${kind}: verdict IS verdictOf over frameShape`, () => {
      expect(verdict(text).kind).toBe(kind);
      expect(verdictOf(text, frameShape(text))).toEqual(verdict(text));
    });
  }

  test("the shape names the checked span the digest reads — STX sigil through ETX sigil", () => {
    const shape = frameShape(carrier);
    expect(shape.kind).toBe("framed");
    if (shape.kind !== "framed") return;
    expect(carrier.slice(shape.span.start, shape.span.start + 3)).toBe("<<^");
    expect(carrier.slice(0, shape.span.end).endsWith('<<^ code="&#x0003;">>')).toBe(true);
  });

  test("the shape never reads the check: a match and a stale share one shape", () => {
    expect(frameShape(FIVE["stale"]!)).toEqual(frameShape(stampCarrier(FIVE["stale"]!)));
  });
});
