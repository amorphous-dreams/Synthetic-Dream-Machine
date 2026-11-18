/**
 * seat-hand — THE AI SEAT ACTS INSIDE THE LENT SET (the worn face alone where custody names no set), read off the seat kind its
 * request line carries (never off the absence of a session). A designation, not a proof (F7: authority by designation on one machine, for the dogfood).
 *
 *   SH1 — a seat-kind request naming another face refuses `face-hand-refused`; naming the worn face or none passes
 *   SH2 — no seat kind (the CLI's seed, import, share and vault doors) may name any open face
 *   SH3 — a `seat` session opening another face's ref refuses; the worn face's opens; a non-ordinal ref names none
 *   SH4 — the channel wires the rule into both doors: the one-shot verb line and the session opening
 *   SH5 — inside the lent set a seat names any lent face; outside it refuses `face-not-lent` naming the set; a set that
 *         reads empty or doubled refuses by its own reading; where custody names no set, SH1 rules
 *   SH6 — both doors read the lent set (`lentOrdinals`), and main hands it the faces the holder names open
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { faceRefOrdinal, namedFaceOf, seatFaceRefusal, seatKindOf, seatRefusalClass } from "../src/seat-hand.js";

describe("the AI seat acts inside the lent set", () => {
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
    // The one-shot door reads the seat off the line, books the asker it read off that same seat, then reads the named face.
    expect(src).toMatch(/const seat = seatKindOf\(parsed\) \?\? \(sessionRequestId === undefined \? await peerSeatOf\(sock\) : null\);\n(?:\s*\/\/[^\n]*\n)*\s+if \(sessionRequestId === undefined\) inv\.asker = seat !== null \? "seat" : "cli";\n\s+const named = namedFaceOf\(inv\.args\);/);
    expect(src).toMatch(/seatFaceRefusal\(\{ seat, named, worn: opts\.mountOrdinal\?\.\(\) \?\? null, lent \}\)/);
    expect(src).toMatch(/seatFaceRefusal\(\{ seat: frame\["hand"\] === "seat" \? "ai" : seatKindOf\(frame\), named: faceRefOrdinal\(frame\["faceRef"\]\)/);
    expect(readFileSync(join(import.meta.dirname, "..", "src", "main.ts"), "utf8")).toMatch(/mountOrdinal:\s+\(\) => result\.mountOrdinal\(\)/);
  });

  test("SH5 — inside the lent set a seat names any lent face; outside it refuses face-not-lent naming the set; an empty or doubled set refuses by its reading; no set, the worn face alone", () => {
    expect(seatFaceRefusal({ seat: "ai", named: 1, worn: 0, lent: [0, 1] })).toBeNull();
    expect(seatFaceRefusal({ seat: "ai", named: 0, worn: 0, lent: [0, 1] })).toBeNull();
    const outside = seatFaceRefusal({ seat: "ai", named: 2, worn: 0, lent: [0, 1] });
    expect(outside).toMatch(/^face-not-lent:/);
    expect(outside).toContain("h0, h1");
    expect(seatRefusalClass(outside!)).toBe("face-not-lent");
    // The worn face outside the lent set refuses as well: the set rules where one stands.
    expect(seatFaceRefusal({ seat: "ai", named: 0, worn: 0, lent: [1] })).toMatch(/^face-not-lent:/);
    // A set that reads empty or doubled refuses by the set's own reading, never by the worn rule.
    expect(seatFaceRefusal({ seat: "ai", named: 0, worn: 0, lent: [] })).toMatch(/^lent-faces-empty:/);
    expect(seatFaceRefusal({ seat: "ai", named: 0, worn: 0, lent: [0, 0] })).toMatch(/^lent-faces-duplicate:/);
    // Custody names no set (shut, or a door handed no reader): the worn face alone, SH1.
    expect(seatFaceRefusal({ seat: "ai", named: 1, worn: 0, lent: null })).toMatch(/^face-hand-refused:/);
    expect(seatFaceRefusal({ seat: "ai", named: 0, worn: 0, lent: null })).toBeNull();
    expect(seatRefusalClass(seatFaceRefusal({ seat: "ai", named: 1, worn: 0, lent: null })!)).toBe("face-hand-refused");
    // CONTROL: the operator's hand, and a seat naming no face, pass whatever the set.
    expect(seatFaceRefusal({ seat: null, named: 2, worn: 0, lent: [0, 1] })).toBeNull();
    expect(seatFaceRefusal({ seat: "ai", named: null, worn: 0, lent: [0, 1] })).toBeNull();
  });

  test("SH6 — both doors read the lent set, and main hands it the faces the holder names open", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "src", "uds-channel.ts"), "utf8");
    expect(src).toMatch(/readonly lentOrdinals\?: \(\) => Promise<readonly number\[\]>/);
    // The session door reads the set at the opening; the one-shot reads it once, and its chore check rides the same read.
    expect(src.match(/seatFaceRefusal\(\{[^\n]*lent: await lentOf\(\) \}\)/g)).toHaveLength(1);
    expect(src).toMatch(/const lent = [^\n]*\? await lentOf\(\) : null;/);
    expect(src).toMatch(/choreAtDoor\(\{ verb: inv\.verb, face: named \?\? mount!, mount, lent,/);
    expect(src).toMatch(/sessionRefuse\(sock, seatRefusalClass\(seatRefused\), requestId\)/);
    expect(src).toMatch(/fail\(seatRefused, seatRefusalClass\(seatRefused\)\)/);
    expect(readFileSync(join(import.meta.dirname, "..", "src", "main.ts"), "utf8")).toMatch(/lentOrdinals:\s+\(\) => unlockedFaceOrdinals\(\)/);
  });
});
