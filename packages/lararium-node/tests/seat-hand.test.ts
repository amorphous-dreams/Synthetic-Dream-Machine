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
 *   SH7 — A LIT FACE RECEIVES VISITS (operator ruling 2026-11-20): a read naming another LIT face as its `target` (by ordinal or
 *         pet name) passes the door with that face resolved to its ordinal, and the call keeps the worn face; acting AS another
 *         face (`face`, `handleIndex`, a session's ref) still refuses as SH1 rules
 *   SH8 — the door's order: a private bag refuses `cross-face-private` first; a write naming another face refuses
 *         `cross-face-write-refused`; a shut target refuses `face-not-open`; an unknown or doubled pet name refuses by name; a
 *         target naming the worn face reads as none; a verb that reads `target` otherwise passes untouched
 *   SH10 — (Sol M3) a private bag refuses before any name resolves; a pet name spelled as an ordinal (`h1`, `1`) that a face
 *         holds refuses `target-ambiguous`; pet names match case folded, and two faces whose names fold alike refuse
 *   SH9 — both doors resolve the target (the one-shot line against the mount, a session against the face it wears), and main
 *         hands the door the faces' pet names
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { crossFaceTargetAtDoor, faceRefOrdinal, namedFaceOf, seatFaceRefusal, seatKindOf, seatRefusalClass } from "../src/seat-hand.js";

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

describe("a lit face receives visits: the door resolves a read's target", () => {
  const petnames = async (): Promise<ReadonlyArray<readonly [number, string]>> => [[0, "worn-face"], [1, "sibling-face"], [2, "shut-face"], [3, "twin"], [4, "twin"]];
  const door = (verb: string, args: Record<string, unknown>, worn: number | null = 0) =>
    crossFaceTargetAtDoor({ verb, args, worn, lit: [0, 1], petnames });

  test("SH7 — a read naming a lit face by ordinal or pet name passes, resolved; acting as another face still refuses", async () => {
    for (const target of [1, "1", "h1", "sibling-face"]) {
      expect(await door("tiddler-get", { recipe: "default", title: "T", target }), String(target)).toEqual({ ok: true, args: { recipe: "default", title: "T", target: 1 } });
    }
    for (const verb of ["wiki-filter", "wiki-render", "wiki-status", "meme-get", "meme-list"]) expect((await door(verb, { recipe: "default", target: 1 })).ok, verb).toBe(true);
    // A sibling's own session visits the mount the same way.
    expect(await door("tiddler-get", { recipe: "default", title: "T", target: "worn-face" }, 1)).toEqual({ ok: true, args: { recipe: "default", title: "T", target: 0 } });
    // Acting AS another face rides `face` and stays refused where custody names no set.
    expect(seatFaceRefusal({ seat: "ai", named: namedFaceOf({ face: 1, title: "T" }), worn: 0, lent: null })).toMatch(/^face-hand-refused:/);
    expect(namedFaceOf({ target: 1 }), "a target names no face to act as").toBeNull();
  });

  test("SH8 — private first, then the write wall, then the lit set; pet names refuse by name; the worn face reads as none", async () => {
    const refusal = async (verb: string, args: Record<string, unknown>) => { const r = await door(verb, args); return r.ok ? null : r.refusal; };
    expect(await refusal("meme-get", { bag: "lar:///ha.ka.ba/wikis/daemon/personal", target: 1 })).toBe("cross-face-private");
    expect(await refusal("meme-put", { bag: "lar:///ha.ka.ba/wikis/garden/personal", target: 7 })).toBe("cross-face-private");
    for (const verb of ["tiddler-put", "tiddler-delete", "meme-put", "meme-delete", "meme-patch", "meme-project"]) expect(await refusal(verb, { recipe: "default", target: 1 }), verb).toBe("cross-face-write-refused");
    expect(await refusal("tiddler-get", { recipe: "default", target: 2 })).toBe("face-not-open");
    expect(await refusal("tiddler-get", { recipe: "default", target: "shut-face" })).toBe("face-not-open");
    expect(await refusal("tiddler-get", { recipe: "default", target: "nobody" })).toBe("target-unknown");
    expect(await refusal("tiddler-get", { recipe: "default", target: "twin" })).toBe("target-ambiguous");
    expect(await door("tiddler-put", { recipe: "default", title: "T", target: 0 }), "the worn face as target reads as none").toEqual({ ok: true, args: { recipe: "default", title: "T" } });
    // A verb that reads `target` as something other than a face passes untouched.
    expect(await door("intent-propose", { target: "lar:///x" })).toEqual({ ok: true, args: { target: "lar:///x" } });
    expect(await door("tiddler-get", { recipe: "default", title: "T" })).toEqual({ ok: true, args: { recipe: "default", title: "T" } });
  });

  test("SH9 — both doors resolve the target, and main hands the door the faces' pet names", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "src", "uds-channel.ts"), "utf8");
    // The line's pass reads the face worn as the session's own on a session, the mount on a one-shot (Sol H1).
    expect(src).toMatch(/crossFaceTargetAtDoor\(\{ verb: inv\.verb, args: inv\.args, worn: sessionRequestId === undefined \? mount : inv\.ordinal \?\? mount, lit: litFaces\(\), petnames \}\)/);
    expect(src).toMatch(/crossFaceTargetAtDoor\(\{ verb: frame\["verb"\], args: frame\["args"\] as Record<string, unknown>, worn: state\.supply\.ordinal, lit: litFaces\(\), petnames \}\)/);
    expect(readFileSync(join(import.meta.dirname, "..", "src", "main.ts"), "utf8")).toMatch(/petnames:\s+async \(\) => \(await makeNodePersonaPetnameStore\(\)\)\.entries\(\)/);
  });
});

describe("a lit face receives visits: privacy before names, and names that cannot pose as ordinals (Sol M3)", () => {
  const door = (args: Record<string, unknown>, names: ReadonlyArray<readonly [number, string]>) =>
    crossFaceTargetAtDoor({ verb: "meme-get", args, worn: 0, lit: [0, 1, 2], petnames: async () => names });
  const refusal = async (args: Record<string, unknown>, names: ReadonlyArray<readonly [number, string]> = [[1, "sibling-face"]]) => { const r = await door(args, names); return r.ok ? null : r.refusal; };

  test("SH10 — private first, ordinal-looking pet names refuse, names fold case", async () => {
    expect(await refusal({ bag: "lar:///ha.ka.ba/wikis/daemon/personal", target: "nobody" })).toBe("cross-face-private");
    expect(await refusal({ bag: "LAR:///ha.ka.ba/wikis/daemon/draft/", target: "1" })).toBe("cross-face-private");
    expect(await refusal({ recipe: "default", target: "h1" }, [[2, "h1"]])).toBe("target-ambiguous");
    expect(await refusal({ recipe: "default", target: "1" }, [[2, "1"]])).toBe("target-ambiguous");
    expect(await door({ recipe: "default", target: "SIBLING-FACE" }, [[1, "sibling-face"]])).toEqual({ ok: true, args: { recipe: "default", target: 1 } });
    expect(await refusal({ recipe: "default", target: "twin" }, [[1, "Twin"], [2, "twin"]])).toBe("target-ambiguous");
  });
});
