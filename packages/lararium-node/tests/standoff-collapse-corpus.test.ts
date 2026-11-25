/**
 * THE LINE RULE'S CORPUS PROOF: before any person enables `line-three-way`, it walks every tracked `.mem` carrier.
 *
 * For each carrier, one slot takes two-sided edits the way a stand-off meets them: the records' side inserts a line near
 * the slot's head and re-seals (the render always seals), and the file's side inserts a line near the slot's tail and
 * leaves the seal as the hand left it. The rule must either refuse, or answer a merge that DROPS NO LINE: every line
 * either side added stands in it, and every line of the base both sides kept stands in it (the seal line aside, which the
 * merge re-stamps). A second pass edits the SAME line on both sides, which no line merge may settle: there the rule must
 * refuse, or keep both sides' words.
 *
 * The corpus reads from git (`git ls-files '*.mem'`), so a carrier added tomorrow joins the proof by being tracked.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { splitSlots } from "@lararium/mesh/meme-merge";
import { decideCollapse, memeSealer } from "../src/standoff-collapse.js";

const REPO = new URL("../../..", import.meta.url).pathname;
const SEAL = /^<<\^ code=`&#x0003;`( bcc=`[^`]*`)?>>$/;
const LINE_RULE = new Set(["line-three-way"] as const);

const corpus = execFileSync("git", ["ls-files", "*.mem"], { cwd: REPO, encoding: "utf8" }).split("\n").filter(Boolean);

/** The body lines of the carrier's longest top-level slot (opener and closer excluded), as line indexes into the text. */
function slotBody(text: string): { readonly first: number; readonly last: number } | null {
  const pieces = splitSlots(text);
  if (pieces === null) return null;
  let at = 0;
  let best: { first: number; last: number } | null = null;
  for (const p of pieces) {
    const lines = p.text.split("\n").length - 1;
    if (p.key.startsWith("slot:") && lines >= 6) {
      const span = { first: at + 1, last: at + lines - 2 };
      if (best === null || span.last - span.first > best.last - best.first) best = span;
    }
    at += lines;
  }
  return best !== null && best.last - best.first >= 3 ? best : null;
}

const insertAt = (text: string, index: number, line: string): string => {
  const lines = text.split("\n");
  lines.splice(index, 0, line);
  return lines.join("\n");
};

const unsealed = (text: string): string[] => text.split("\n").filter((l) => !SEAL.test(l));

describe("line-three-way over the whole tracked corpus", () => {
  test("a merge never drops a line", () => {
    let walked = 0, merged = 0, refused = 0, overlapRefused = 0;
    const drops: string[] = [];
    for (const rel of corpus) {
      const base = readFileSync(`${REPO}${rel}`, "utf8");
      const body = slotBody(base);
      if (body === null) continue;
      walked++;
      const recordsLine = `records-edit ${walked}: the seat's line`;
      const diskLine = `disk-edit ${walked}: the hand's line`;
      const sealedRecords = memeSealer(insertAt(base, body.first + 1, recordsLine));
      const records = sealedRecords.ok ? sealedRecords.text : insertAt(base, body.first + 1, recordsLine);
      const disk = insertAt(base, body.last, diskLine);
      const v = decideCollapse({ base, records, disk, ext: ".mem", path: rel, rules: LINE_RULE });
      if (!v.collapsed) { refused++; continue; }
      merged++;
      const out = new Set(unsealed(v.text));
      const lost = [recordsLine, diskLine].filter((l) => !out.has(l));
      // Every base line both sides kept: the base's own lines, since each side only inserted.
      const baseLost = unsealed(base).filter((l) => l.trim() !== "" && !out.has(l));
      if (lost.length > 0 || baseLost.length > 0) drops.push(`${rel}: lost ${[...lost, ...baseLost.slice(0, 3)].join(" | ")}`);

      // THE SAME LINE MOVED ON BOTH SIDES: no line merge settles it without both words standing.
      const lines = base.split("\n");
      const target = lines[body.first + 1]!;
      const both = (who: string): string => { const l = [...lines]; l[body.first + 1] = `${target} (${who} ${walked})`; return l.join("\n"); };
      const o = decideCollapse({ base, records: both("records"), disk: both("disk"), ext: ".mem", path: rel, rules: LINE_RULE });
      if (!o.collapsed) overlapRefused++;
      else if (!(o.text.includes(`(records ${walked})`) && o.text.includes(`(disk ${walked})`))) drops.push(`${rel}: an overlapping edit collapsed onto one side`);
    }
    console.log(`[line-three-way corpus] ${corpus.length} tracked carriers, ${walked} with a slot of four body lines: ${merged} merged, ${refused} refused; overlap refused ${overlapRefused}/${walked}`);
    expect(walked).toBeGreaterThan(500);
    expect(drops).toEqual([]);
  }, 600_000);
});
