/**
 * THE SEED'S FENCES NAME THEIR GRAMMAR, AND EVERY FENCE OUTRUNS ITS TICKS.
 *
 * Operator, 2026-11-01: "code-fenced blocks in the boot seed should get the grammar marked explicitly,
 * so the -Syntax plugin can render them w/ pono colors" — and "any code-fenced region that uses ticks
 * must start/end with more ticks than the max-used-inside".
 *
 * Labels (settled with Lares-Awakens, who maps them in VSCode-TW5-Syntax): `memetic-wikitext` for every
 * wikitext, sigil or procedure specimen; `toml meta` for the root meta; `text` for plain illustration.
 *
 * The tick law reads TiddlyWiki's codeblock: a fence opens on a run of three or more and closes on a
 * line holding only a run at least as long. A fence whose run does not exceed the longest tick run
 * inside it holds a lesson in waiting — the day a ticked value starts a line, the fence closes early.
 *
 * Meme: lar:///ha.ka.ba/lares/api/noosphere-boot
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readCarrierFiles } from "../src/carrier-files.js";
import { REPO } from "./test-wiki.js";

const SEED = "bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem";
const SEED_LABELS = new Set(["memetic-wikitext", "toml meta", "text"]);

interface Fence { readonly line: number; readonly info: string; readonly run: number; readonly inner: number }

/** Every backtick fence of `text`: its opening line, info string, run, and longest inner tick run. */
function fences(text: string): Fence[] {
  const lines = text.split("\n");
  const out: Fence[] = [];
  for (let i = 0; i < lines.length; i++) {
    const o = /^ {0,3}(`{3,})([^`]*)$/.exec(lines[i]!);
    if (!o) continue;
    const run = o[1]!.length;
    let inner = 0, j = i + 1;
    for (; j < lines.length; j++) {
      const c = /^ {0,3}(`+)[ \t]*$/.exec(lines[j]!);
      if (c && c[1]!.length >= run) break;
      for (const r of lines[j]!.matchAll(/`+/g)) inner = Math.max(inner, r[0].length);
    }
    if (j >= lines.length) break;
    out.push({ line: i + 1, info: o[2]!.trim(), run, inner });
    i = j;
  }
  return out;
}

describe("★ the boot seed's fences ★", () => {
  const seed = fences(readFileSync(join(REPO, SEED), "utf8"));

  test("the seed holds fences (no silent zero)", () => {
    expect(seed.length).toBeGreaterThan(20);
  });

  test("every fence names its grammar from the settled labels", () => {
    expect(seed.filter((f) => !SEED_LABELS.has(f.info)).map((f) => `${f.line}: ${JSON.stringify(f.info)}`)).toEqual([]);
  });

  test("every fence outruns the longest tick run inside it", () => {
    expect(seed.filter((f) => f.run <= f.inner).map((f) => `${f.line}: run ${f.run}, inner ${f.inner}`)).toEqual([]);
  });

  test("CONTROL: the reader sees a narrow, unlabeled fence for what it holds", () => {
    expect(fences("```\nx ``` y\n```\n")).toEqual([{ line: 1, info: "", run: 3, inner: 3 }]);
    expect(fences("````memetic-wikitext\nx ``` y\n````\n")).toEqual([{ line: 1, info: "memetic-wikitext", run: 4, inner: 3 }]);
  });
});

describe("★ the corpus's fences outrun their ticks ★", () => {
  test("no carrier holds a fence whose run does not exceed its inner ticks", () => {
    const narrow: string[] = [];
    for (const c of readCarrierFiles(REPO)) {
      for (const f of fences(readFileSync(join(REPO, c.path), "utf8"))) {
        if (f.run <= f.inner) narrow.push(`${c.path}:${f.line}`);
      }
    }
    expect(narrow).toEqual([]);
  }, 60_000);
});
