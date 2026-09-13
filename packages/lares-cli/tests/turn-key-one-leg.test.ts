/**
 * THE TURN KEY HAS ONE READER, AND THE DOCSTRING NAMES IT.
 *
 * `turnKeyOf`'s docstring asserted a LIVE lockstep invariant between two legs: the CAPTURE leg driven by
 * a TypeScript `readExchanges`, and the BEARING/rewind leg driven by `readTurns`. The capture leg MOVED —
 * `lares sense capture` hands source identity to the daemon and Python's `capture_sources.py` reads the
 * transcript, its `_turn_key` self-describing as a "turnKeyOf port". The file contradicted itself 620
 * lines apart: `cmdCapture`'s own docstring already says "the TypeScript layer neither reads exchanges for
 * capture nor holds a capture WAL", while `readExchanges` stood exported with ZERO callers.
 *
 * A docstring naming a dead driver is worse than none: it tells the next reader the lockstep holds by
 * construction, so nobody measures it. It does NOT hold on the fallback path — see the divergence the
 * docstring now carries, and the two formulas asserted below.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@lararium/mesh/node";

const HARVEST = join(repoRoot, "packages", "lares-cli", "src", "commands", "harvest.ts");
const PY_CAPTURE = join(repoRoot, "packages", "lararium-sensorium", "scripts", "capture_sources.py");

const harvestSrc = () => readFileSync(HARVEST, "utf8");
const pySrc = () => readFileSync(PY_CAPTURE, "utf8");

describe("★ the retired capture reader leaves no stub behind ★", () => {
  test("harvest.ts exports no `readExchanges` — the capture leg rides Python", () => {
    expect(harvestSrc()).not.toMatch(/export function readExchanges\b/);
  });

  test("CONTROL — the two readers the file DOES drive still stand", () => {
    // A grep that matched nothing would pass the assertion above for the wrong reason.
    const src = harvestSrc();
    expect(src, "the bearing/rewind leg's reader").toMatch(/function readTurns\b/);
    expect(src, "the key itself").toMatch(/export function turnKeyOf\b/);
  });

  test("nothing in the CLI source reaches for the retired name", () => {
    expect(harvestSrc()).not.toContain("readExchanges");
  });
});

describe("★ the docstring points at the surviving reader, and NAMES the divergence ★", () => {
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

  test("CONTROL — the docstring no longer claims the retired TypeScript driver", () => {
    expect(turnKeyDoc()).not.toContain("readExchanges");
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
