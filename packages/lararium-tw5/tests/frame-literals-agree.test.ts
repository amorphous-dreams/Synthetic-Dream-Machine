/**
 * THE TWO KEPT LITERAL COPIES OF THE FRAME CODES AGREE WITH THE DECLARATION.
 *
 * Two places spell the frame codes as literals ON PURPOSE, and both are exempt from the parity walk:
 *
 *   · `grammar-table.generated.ts` — a build product, generated from the `sigil-frame-*` tiddlers;
 *   · `meme-ast/scanner.ts` BOOTSTRAP_SCANS — the deliberately independent recogniser `frame-parity`
 *     measures the spec against. Sourcing it from the package would make that comparison tautological.
 *
 * Kept copies drift silently unless something reads them against the one declaration. This does: the
 * set of codes each copy writes is exactly the set `@lararium/memetic-frame` declares (ETB aside in the
 * scanner, which reads every mark a cold parse must find).
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */
import { describe, test, expect } from "vitest";
import { FRAME_MARKS } from "@lararium/memetic-frame";
import { GENERATED_SIGILS } from "../src/meme-ast/grammar-table.generated.js";
import { BOOTSTRAP_SCANS } from "../src/meme-ast/scanner.js";

const declared = new Set(FRAME_MARKS.map((m) => m.code));
const codesIn = (src: string): string[] => [...src.matchAll(/&#x[0-9A-Fa-f]{4};/g)].map((m) => m[0]);

describe("the kept literal copies of the frame codes", () => {
  test("★ the generated grammar table's frame entries name exactly the declared marks ★", () => {
    // `frame` is also the KIND of turn-frame sigils (`lares`, `loops`, …); the control marks are the
    // `frame-*` entries, which carry a code.
    const frame = GENERATED_SIGILS.filter((s) => s.kind === "frame" && s.name.startsWith("frame-"));
    const byName = new Map(frame.map((s) => [s.name, codesIn(s.pattern ?? "")]));
    for (const m of FRAME_MARKS) {
      expect(byName.get(`frame-${m.name.toLowerCase()}`), `sigil-frame-${m.name.toLowerCase()} writes ${m.code}`).toEqual([m.code]);
    }
    expect(frame.length).toBe(FRAME_MARKS.length);
  });

  test("★ the bootstrap scanner reads every declared mark, and no other ★", () => {
    const scanned = new Set(BOOTSTRAP_SCANS.filter((s) => s.sigilName.startsWith("control-")).flatMap((s) => codesIn(s.regex.source)));
    expect([...scanned].sort()).toEqual([...declared].sort());
  });

  test("CONTROL — a code the declaration stands nowhere reads as disagreement", () => {
    expect(declared.has("&#x0099;")).toBe(false);
    expect(codesIn('<<\\^[^>\\n]*&#x0099;')).toEqual(["&#x0099;"]);
  });
});
