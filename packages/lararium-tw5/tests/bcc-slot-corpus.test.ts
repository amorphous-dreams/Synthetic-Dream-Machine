/**
 * THE SEAL CENSUS, WHOLE TREE — every carrier frame the repo tracks, read under the slot law, each fault
 * NAMED, never skipped.
 *
 * The block check rides the ETX mark's `bcc` slot and the digest reads the span with that one run
 * deleted, so a value minted in the trailer form verifies unchanged once it rides the slot (Train R,
 * zero churn). This census reads EVERY tracked file holding a live text frame (bags/, fixtures, docs,
 * a `.md` that frames itself), not just the ones whose foot already reads canonical, and sorts each:
 *
 *   · match     — the stated check verifies.
 *   · unsealed  — a frame with no check (legal: the check stays optional; counted, never failed).
 *   · stale     — a lawful slot whose value no longer computes: a body rewritten without a re-stamp.
 *   · torn      — the frame divides only by choosing (a retired trailer, an ETX outside the grammar …).
 *
 * Stale and torn fail BY NAME, save the declared rows below (each with its reason and owner). A planted
 * mismatch reads 1, so a census reading 0 stale stands on a known positive, never a silent zero.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */
import { describe, test, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { frameMarks, verdict, type FrameVerdict } from "@lararium/memetic-frame";
import { declaresCarrier, inSubmodule, inFrozenSpecimen } from "../src/carrier-files.js";
import { REPO } from "./test-wiki.js";

/**
 * Frames left outside this train ON PURPOSE, each with its owner. A row here names one path; a row
 * whose file reads clean fails too (a stale declaration), so the list only ever shrinks.
 */
const DECLARED: Readonly<Record<string, string>> = {
  "packages/lararium-tw5/tests/fixtures/doa-index.committed.body": "its seal covers the form its test reads (one-column-law fills the {CARRIER_TYPE} placeholder first), so the on-disk placeholder reads stale by construction; a re-stamp of the disk bytes breaks projector === normalize",
};

type Reading = { path: string; v: FrameVerdict };

/** Code and data a test or tool holds marks INSIDE as strings — never a carrier frame itself. */
const CODE = /\.(ts|tsx|js|mjs|cjs|py|sh|json|jsonl|c|h|rs|go|png|jpe?g|gif|webp|wasm|so|ico|woff2?|ttf|pdf|zip|gz)$/i;

/**
 * Every tracked carrier-shaped file outside the submodules: a `.mem` or `.tid`, a file that declares a
 * carrier, a fixture body, or any text whose first non-blank line opens a frame (a `.md` that frames
 * itself) — each holding a live STX or ETX through the fence mask.
 */
function framedFiles(): Reading[] {
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean);
  const out: Reading[] = [];
  for (const rel of tracked) {
    if (inSubmodule(rel) || CODE.test(rel)) continue;
    let text: string;
    try { text = readFileSync(join(REPO, rel), "utf8"); } catch { continue; }
    if (!text.includes("&#x0002;") && !text.includes("&#x0003;")) continue;
    const opensFrame = /^\s*<<(?:!DOCTYPE|\^)/.test(text);
    if (!(/\.(mem|tid|body)$/.test(rel) || opensFrame || declaresCarrier(text))) continue;
    const m = frameMarks(text);
    if (m.stx.length === 0 && m.etx.length === 0) continue;
    out.push({ path: rel, v: verdict(text) });
  }
  return out;
}

/** The census: each reading sorted, stale and torn named with their evidence. */
function census(readings: readonly Reading[]) {
  const c = { match: 0, unsealed: 0, frozen: [] as string[], stale: [] as string[], torn: [] as string[] };
  for (const { path, v } of readings) {
    if (inFrozenSpecimen(path)) { c.frozen.push(path); continue; }
    if (v.kind === "match") c.match++;
    else if (v.kind === "absent" || v.kind === "bare") c.unsealed++;
    else if (v.kind === "stale") c.stale.push(`${path}: stored ${v.stored} ≠ computed ${v.computed}`);
    else c.torn.push(`${path}: ${v.faults.map((f) => f.kind).join(", ")}`);
  }
  return c;
}

describe("★ the seal census reads every framed file in the tree, and names each fault ★", () => {
  const readings = framedFiles();
  const c = census(readings);
  const undeclared = (rows: string[]) => rows.filter((r) => !(r.split(":")[0]! in DECLARED));

  test("the census reaches bags/ and beyond it (no silent zero)", () => {
    expect(c.match).toBeGreaterThan(780);
    expect(readings.some((r) => !r.path.startsWith("bags/"))).toBe(true);
  });

  test("★ no stale seal stands anywhere — a body rewritten without a re-stamp reads here BY NAME ★", () => {
    expect(undeclared(c.stale)).toEqual([]);
  });

  test("★ no torn frame stands outside the declared rows ★", () => {
    expect(undeclared(c.torn)).toEqual([]);
  });

  test("every declared row still names a fault (a declaration outliving its cause fails)", () => {
    const faulted = new Set([...c.stale, ...c.torn].map((r) => r.split(":")[0]!));
    expect(Object.keys(DECLARED).filter((p) => !faulted.has(p))).toEqual([]);
  });

  test("CONTROL (known positive): one planted mismatch reads exactly 1 stale, named", () => {
    const sealed = readings.find((r) => r.v.kind === "match" && r.path.startsWith("bags/"))!;
    const text = readFileSync(join(REPO, sealed.path), "utf8");
    const at = text.indexOf("<<^ code=`&#x0002;`>>") + "<<^ code=`&#x0002;`>>".length;
    const planted = text.slice(0, at) + "\nplanted line\n" + text.slice(at);
    const p = census([{ path: sealed.path, v: verdict(planted) }]);
    expect(p.stale).toHaveLength(1);
    expect(p.stale[0]).toContain(sealed.path);
  });
});
