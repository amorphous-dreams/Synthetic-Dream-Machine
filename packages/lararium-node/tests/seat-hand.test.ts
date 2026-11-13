/**
 * seat-hand — THE AI SEAT ACTS AS THE WORN FACE ALONE, read off the seat kind its request line carries (never off the absence
 * of a session). A designation, not a proof (F7: authority by designation on one machine, for the dogfood).
 *
 *   SH1 — a seat-kind request naming another face refuses `face-hand-refused`; naming the worn face or none passes
 *   SH2 — no seat kind (the CLI's seed, import, share and vault doors) may name any open face
 *   SH3 — a `seat` session opening another face's ref refuses; the worn face's opens; a non-ordinal ref names none
 *   SH4 — the channel wires the rule into both doors: the one-shot verb line and the session opening
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { faceRefOrdinal, namedFaceOf, seatFaceRefusal, seatKindOf } from "../src/seat-hand.js";

describe("the AI seat acts as the worn face alone", () => {
  test("SH1 — a seat-kind request naming another face refuses; the worn face or none passes", () => {
    const seat = seatKindOf({ verb: "INGEST", seat: "ai" });
    expect(seat).toBe("ai");
    expect(seatFaceRefusal({ seat, named: namedFaceOf({ face: 1 }), worn: 0 })).toMatch(/^face-hand-refused:/);
    expect(seatFaceRefusal({ seat, named: namedFaceOf({ handleIndex: "h2" }), worn: 0 })).toMatch(/^face-hand-refused:/);
    expect(seatFaceRefusal({ seat, named: namedFaceOf({ face: 0 }), worn: 0 })).toBeNull();
    expect(seatFaceRefusal({ seat, named: namedFaceOf({ query: "x" }), worn: 0 })).toBeNull();
    // With no worn face, a seat names none.
    expect(seatFaceRefusal({ seat, named: 0, worn: null })).toMatch(/^face-hand-refused:/);
  });

  test("SH2 — no seat kind: the operator's hand names any open face", () => {
    expect(seatKindOf({ verb: "INGEST" })).toBeNull();
    expect(seatKindOf({ verb: "INGEST", seat: "operator" })).toBeNull();
    expect(seatFaceRefusal({ seat: seatKindOf({ verb: "INGEST", args: { face: 2 } }), named: 2, worn: 0 })).toBeNull();
  });

  test("SH3 — a seat session opens the worn face's ref alone", () => {
    expect(faceRefOrdinal("h1")).toBe(1);
    expect(faceRefOrdinal("proof-a")).toBeNull();
    expect(seatFaceRefusal({ seat: "ai", named: faceRefOrdinal("h1"), worn: 0 })).toMatch(/^face-hand-refused:/);
    expect(seatFaceRefusal({ seat: "ai", named: faceRefOrdinal("h0"), worn: 0 })).toBeNull();
  });

  test("SH4 — the channel reads the mark at both doors, and main hands it the worn face", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "src", "uds-channel.ts"), "utf8");
    expect(src).toMatch(/seatFaceRefusal\(\{ seat: seatKindOf\(parsed\), named: namedFaceOf\(inv\.args\), worn: opts\.wornOrdinal\?\.\(\) \?\? null \}\)/);
    expect(src).toMatch(/seatFaceRefusal\(\{ seat: frame\["hand"\] === "seat" \? "ai" : seatKindOf\(frame\), named: faceRefOrdinal\(frame\["faceRef"\]\)/);
    expect(readFileSync(join(import.meta.dirname, "..", "src", "main.ts"), "utf8")).toMatch(/wornOrdinal:\s+\(\) => result\.wornOrdinal\(\)/);
  });
});
