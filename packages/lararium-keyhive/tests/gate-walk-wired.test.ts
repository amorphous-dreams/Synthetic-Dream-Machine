/**
 * THE GATE-WALK IS WIRED, AND THE SOURCE SAYS SO.
 *
 * `verifyEdgeAgainstPersonaKel` is the continuity anchor: it walks a persona-KEL to its CURRENT
 * authoritative op-key and verifies a device-delegation edge against THAT head, so an edge signed by a
 * superseded key rejects. Three doors run it — the boot Binding Gate, the daemon's live admission path,
 * and the face-grant record's verifier.
 *
 * It shipped as a pure core BEFORE those doors called it, and its own doc-comment said so ("NOT yet wired
 * into the live gate"). The wiring landed; the sentence did not move. A reader — human or agent — auditing
 * the admission path would have read that comment and concluded a security check was an unreached stub.
 *
 * A comment cannot be typechecked, so this weld is what keeps it true: the doors must keep calling the
 * walk, and the walk's own documentation must not call itself unwired. The two halves fail together.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const KEYHIVE_SRC = (f: string): string => readFileSync(join(import.meta.dirname, "..", "src", f), "utf8");
const MESH_SRC = (f: string): string =>
  readFileSync(join(import.meta.dirname, "..", "..", "lararium-mesh", "src", f), "utf8");

/** Every door that must present an edge to the KEL head rather than to a frozen root. */
const DOORS = [
  "boot-daemon-keyhive.ts",      // the Binding Gate a vessel passes at boot
  "operator-daemon-behavior.ts", // the live admission path
  "face-grant-record.ts",        // the grant record's own verifier
] as const;

describe("the continuity anchor's wiring", () => {
  test("★ every door that admits on an edge WALKS the KEL to its head ★", () => {
    for (const door of DOORS) {
      const src = KEYHIVE_SRC(door);
      expect(src, `${door} no longer walks the persona-KEL — an edge there verifies against a frozen root`)
        .toContain("verifyEdgeAgainstPersonaKel(");
    }
  });

  test("★ the walk does not describe itself as unwired while three doors call it ★", () => {
    const src = MESH_SRC("persona-kel.ts");
    // The exact phrasing that went stale, and the shapes a re-drift would most likely take.
    expect(src, "persona-kel.ts calls the gate-walk unwired, and it is wired")
      .not.toMatch(/NOT yet wired|not yet wired into the live gate|unwired/i);
  });

  test("CONTROL — the assertions are not vacuous: the symbol and the doors are real", () => {
    expect(MESH_SRC("persona-kel.ts")).toContain("export async function verifyEdgeAgainstPersonaKel");
    expect(DOORS.length).toBe(3);
    // A door that stopped importing it would still "contain" the call in a comment; require the import.
    for (const door of DOORS) {
      expect(KEYHIVE_SRC(door), `${door} names the walk without importing it`).toMatch(/import[\s\S]{0,400}verifyEdgeAgainstPersonaKel/);
    }
  });
});
