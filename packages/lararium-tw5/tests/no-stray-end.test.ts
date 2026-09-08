/**
 * `\end` closes a definition; it never reaches a reader.
 *
 * ── A PRAGMA IS RECOGNISED AT THE START OF A LINE ───────────────────────────────────────────────
 * TiddlyWiki closes a multi-line `\widget` or `\procedure` on a line that BEGINS with `\end`. Written
 * at the tail of the last body line it closes nothing and reads as content, so the definition runs to
 * next `\end` and puts a literal `\end` on the page — after the markup, where a hidden annotation or
 * a code block makes it easy to miss.
 *
 * Three definitions carried one. Nothing read red: each still rendered its span, its data attributes
 * and its class, and the four characters trailing them read as part of the source to any eye already
 * looking at wikitext.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";

describe("the shelf, read as source", () => {
  test("★ no definition body carries `\\end` anywhere but the start of a line ★", () => {
    const dir = new URL("../tiddlers/", import.meta.url).pathname;
    const offenders: string[] = [];
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".tid"))) {
      // A COMMENT TEACHES THE FORM AND EMITS NOTHING. A definition's header explains what it expands
      // to, `\end` included; scanning that reports the documentation as the defect.
      const body = readFileSync(dir + f, "utf8").replace(/<!--[\s\S]*?-->/g, "");
      for (const line of body.split("\n")) {
        if (/\\end/.test(line) && !/^\\end\s*$/.test(line)) offenders.push(`${f}: ${line.trim()}`);
      }
    }
    expect(offenders, "`\\end` closes nothing here and goes to the page as text").toEqual([]);
  });
});

describe.skipIf(wikiSkip)(`the shelf, read as render${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki(); }, 60_000);

  test("CONTROL — the harness stands", () => {
    expect(renderWikitext(e, "plain prose")).toContain("plain prose");
  });

  test.each([
    '<<~ pono "lar:///a.b.c/x" -> "lar:///a.b.c/y">>',
    '<<~ papalohe "lar:///a.b.c/x" -> "lar:///a.b.c/y">>',
    '<<~ hana "toml" "a = 1">>',
  ])("★ %s puts no `\\end` on the page ★", (src) => {
    expect(renderWikitext(e, src)).not.toContain("\\end");
  });
});
