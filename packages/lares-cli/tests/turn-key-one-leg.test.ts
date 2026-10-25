/**
 * THE TURN KEY HAS ONE READER PER LEG, AND THE DOCSTRING NAMES IT.
 *
 * `turnKeyOf` drives the BEARING/rewind leg through `readTurns`. The capture leg rides Python:
 * `lares sense capture` hands source identity to the daemon and `capture_sources.py` reads the
 * transcript, its `_turn_key` self-describing as a "turnKeyOf port". The two formulas agree on the
 * native uuid and part on the fallback path, and the docstring names that divergence so the next
 * reader measures it instead of assuming lockstep.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@lararium/mesh/node";

const HARVEST = join(repoRoot, "packages", "lares-cli", "src", "commands", "capture", "harvest.ts");
const PY_CAPTURE = join(repoRoot, "packages", "lararium-sensorium", "scripts", "capture_sources.py");

const harvestSrc = () => readFileSync(HARVEST, "utf8");
const pySrc = () => readFileSync(PY_CAPTURE, "utf8");

describe("★ the bearing leg drives its own reader ★", () => {
  test("the two readers the file drives stand", () => {
    const src = harvestSrc();
    expect(src, "the bearing/rewind leg's reader").toMatch(/function readTurns\b/);
    expect(src, "the key itself").toMatch(/export function turnKeyOf\b/);
  });
});

describe("★ the docstring points at the capture leg's reader, and NAMES the divergence ★", () => {
  /** The doc comment immediately above `turnKeyOf`. */
  function turnKeyDoc(): string {
    const src = harvestSrc();
    const at = src.indexOf("export function turnKeyOf");
    expect(at, "turnKeyOf not found").toBeGreaterThan(-1);
    const open = src.lastIndexOf("/**", at);
    return src.slice(open, at);
  }

  test("it names capture_sources.py's `_turn_key` as the capture leg's driver", () => {
    const doc = turnKeyDoc();
    expect(doc).toContain("capture_sources.py");
    expect(doc).toContain("_turn_key");
  });

  test("★ it names the FALLBACK divergence rather than papering over it ★", () => {
    const doc = turnKeyDoc();
    expect(doc, "the field the Python preimage folds in and this one does not").toContain("chunk_index");
    expect(doc, "and the path on which the two legs part").toMatch(/fallback/i);
  });
});

describe("★ the divergence the docstring reports is REAL, measured on both sides ★", () => {
  test("the uuid path reads identically on both legs", () => {
    expect(harvestSrc(), "TS: the native uuid short-circuits").toMatch(/return turn\.uuid \|\|/);
    expect(pySrc(), "py: the native uuid short-circuits").toMatch(/return turn\.get\("uuid"\) or/);
  });

  test("★ the FALLBACK preimages differ — Python folds `chunk_index`, TypeScript does not ★", () => {
    const ts = /return turn\.uuid \|\| sha\(([^)]*)\)/.exec(harvestSrc())?.[1] ?? "";
    const py = /return turn\.get\("uuid"\) or _sha16\((.*)\)\n/.exec(pySrc())?.[1] ?? "";
    expect(ts, "the TS fallback preimage").not.toBe("");
    expect(py, "the py fallback preimage").not.toBe("");
    expect(ts, "TypeScript folds no ordinal").not.toContain("chunk_index");
    expect(py, "Python folds the ordinal, deliberately").toContain("chunk_index");
  });

  test("CONTROL — the two preimages agree on the fields they DO share", () => {
    const ts = /return turn\.uuid \|\| sha\(([^)]*)\)/.exec(harvestSrc())?.[1] ?? "";
    const py = /return turn\.get\("uuid"\) or _sha16\((.*)\)\n/.exec(pySrc())?.[1] ?? "";
    for (const field of ["ts", "64"]) {
      expect(ts, `TS preimage carries ${field}`).toContain(field);
      expect(py, `py preimage carries ${field}`).toContain(field);
    }
  });
});
