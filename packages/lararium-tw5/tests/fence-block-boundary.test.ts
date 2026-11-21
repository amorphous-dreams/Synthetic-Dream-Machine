/**
 * A FENCE OPENS ON A BLOCK BOUNDARY, across the bags.
 *
 * TiddlyWiki opens a code block only where the opener follows a blank line, so a fence written straight
 * under a paragraph line ("Regex (canonical):" then ```) renders as prose. The boot seed holds the same law
 * (seed-kupono-cut `fenceOpeners`); this reads it over every carrier the shore finds in the bags. An opener
 * may also open its slot body (the line under an ahu opener) or the root meta (the line under STX), and a
 * fence shown inside a longer fence stays held text.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { carrierFiles } from "../src/carrier-files.js";
import { REPO } from "./test-wiki.js";

export function fencesUnderParagraphs(text: string): number[] {
  const found: number[] = [];
  const lines = text.split("\n");
  let open: { ch: string; len: number } | null = null;
  lines.forEach((l, i) => {
    const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(l);
    if (!m) return;
    const run = m[1]!;
    if (open) {
      if (run[0] === open.ch && run.length >= open.len && /^\s*$/.test(m[2]!)) open = null;
      return;
    }
    open = { ch: run[0]!, len: run.length };
    const prev = i > 0 ? lines[i - 1]! : "";
    if (i === 0 || /^\s*$/.test(prev) || /^<<~ ahu slot=`[^`]*`>>$/.test(prev) || /^<<\^ code=`&#x0002;`>>$/.test(prev)) return;
    found.push(i + 1);
  });
  return found;
}

describe("a fence opens on a block boundary", () => {
  test("CONTROL: a fence under a paragraph line reads red, and a loulou line counts as a paragraph", () => {
    expect(fencesUnderParagraphs("Regex (canonical):\n```\nx\n```\n")).toEqual([2]);
    expect(fencesUnderParagraphs("<<~ loulou uri=`lar:///a`>>\n```\nx\n```\n")).toEqual([2]);
  });

  test("CONTROL: blank-line, slot-body, root-meta and nested fences read clean", () => {
    const clean = "<<^ code=`&#x0002;`>>\n```toml meta\nk = 1\n```\n\nRegex:\n\n```\nx\n```\n<<~ ahu slot=`#/a`>>\n```toml meta\n```\n\n````text\nprose\n```toml meta\n```\n````\n";
    expect(fencesUnderParagraphs(clean)).toEqual([]);
  });

  test("★ no carrier in the bags opens a fence under a paragraph line ★", () => {
    const files = carrierFiles(REPO).filter((f) => f.startsWith("bags/"));
    expect(files.length).toBeGreaterThan(500);
    const found = files.flatMap((f) => fencesUnderParagraphs(readFileSync(join(REPO, f), "utf8")).map((n) => `${f}:${n}`));
    expect(found).toEqual([]);
  });
});
