/**
 * The unslashed shelf — every English mirror answers to a PURE NAME.
 *
 * ── THE RULING, AND THE HALF THAT DID NOT MOVE ──────────────────────────────────────────────────
 * A mirror of a sigil name reasons as a Name: `link`, never `\link`. The slashed spelling named
 * nothing of its own — it aliased TiddlyWiki's pragma punctuation into a namespace that already had a
 * word for the thing.
 *
 * The CORPUS moved: zero slashed firings stand. The SHELF did not — seven definitions still answered
 * to `~\name`, so seven live calls reached nothing and fell to the gradient, rendering as their own
 * text. Nothing read red, because rendering-as-your-own-text names what an UNKNOWN sigil correctly
 * owes a reader, and a known one wearing the wrong name reads identical to it.
 *
 * ── WHY A CONTROL RIDES HERE ────────────────────────────────────────────────────────────────────
 * These vectors read "did the definition run". Under a gradient that question needs a nonsense head
 * beside it, or a harness that renders nothing at all would report every sigil as defined.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";

/** Each mirror, with a call its own definition can actually compose. */
const MIRRORS: ReadonlyArray<readonly [string, string]> = [
  ["if",      '<<~ if "[<x>match[1]]">>'],
  ["for",     '<<~ for "[tag[x]]">>'],
  ["task",    '<<~ task "write the thing">>'],
  ["tiddler", '<<~ tiddler "lar:///a.b.c/x">>'],
  ["let",     '<<~ let name "value">>'],
  ["var",     '<<~ var name "value">>'],
  ["const",   '<<~ const name "value">>'],
];

describe.skipIf(wikiSkip)(`the unslashed shelf${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki(); }, 60_000);
  const r = (t: string) => renderWikitext(e, t);
  /**
   * Did the DEFINITION run, or did the sigil echo itself?
   *
   * ── AND EMPTY IS A LEGITIMATE RENDER HERE ─────────────────────────────────────────────────────
   * These mirrors are CONTROL forms. `if` on an unmet condition, `let` binding a variable nothing
   * reads — each correctly puts nothing on the page. A helper demanding non-empty output would call
   * that a failure and send a reader to hunt a definition that already stands. What separates a
   * reached definition from an unreached one is the ECHO: an unknown sigil owes the reader its own
   * text, and a known one never writes it. The nonsense-head control below holds that line.
   */
  const notEchoed = (src: string) => { const h = r(src); return !h.includes("&lt;&lt;~") && !h.includes("<<~"); };

  test("CONTROL — the harness stands", () => {
    expect(r("plain prose")).toContain("plain prose");
  });

  test("CONTROL — a head no definition answers to still echoes", () => {
    expect(notEchoed('<<~ vorpal-snicker "a" "b">>')).toBe(false);
  });

  test.each(MIRRORS)("★ `%s` reaches a definition under its pure name ★", (name, call) => {
    expect(notEchoed(call), `<<~ ${name} …>> echoes — the shelf still spells it \\${name}`).toBe(true);
  });

  test("★ no PATTERN on the shelf reads a slashed name either ★", async () => {
    // A definition and the pattern that finds it move together, or the shelf answers to one spelling
    // and looks for another. `closePatternToTag` reduces a close pattern to a literal `indexOf` tag,
    // so a pattern carrying `\\` — or the `\\?` that once tolerated both — reduces to a tag no reader
    // can write, and the block silently loses its closer.
    const { readdirSync, readFileSync } = await import("node:fs");
    const dir = new URL("../tiddlers/", import.meta.url).pathname;
    const offenders: string[] = [];
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".tid"))) {
      for (const line of readFileSync(dir + f, "utf8").split("\n")) {
        if (/^lar-(?:open-|close-)?pattern:|^lar-(?:alias-for|see-also):/.test(line) && /\\\\\??[a-z]/.test(line)) {
          offenders.push(`${f}: ${line.trim()}`);
        }
      }
    }
    expect(offenders, "a pattern still reads the pragma punctuation the names were ruled out of").toEqual([]);
  });

  test("★ and the bootstrap scanner reports pure names too ★", async () => {
    // The scanner names what a decomposed carrier RECORDS. A slashed `sigilName` writes a spelling
    // into every meme-AST event that no call in the corpus wears.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../src/meme-ast/scanner.ts", import.meta.url).pathname, "utf8");
    const offenders = [...src.matchAll(/sigilName: "(\\\\[^"]*)"/g)].map((m) => m[1]!);
    expect(offenders, "a scan reports a name the grammar retired").toEqual([]);
  });

  test("★ and no definition on the shelf answers to a slashed name any more ★", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const dir = new URL("../tiddlers/", import.meta.url).pathname;
    const offenders: string[] = [];
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".tid"))) {
      const text = readFileSync(dir + f, "utf8");
      for (const m of text.matchAll(/\\(?:procedure|widget)\s+~\\([\w-]+)/g)) offenders.push(`${f}: ~\\${m[1]}`);
    }
    expect(offenders, "a mirror still wears the pragma punctuation it was ruled out of").toEqual([]);
  });
});
