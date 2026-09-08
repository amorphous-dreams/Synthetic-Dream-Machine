/**
 * A closer closes — every block sigil the shelf declares one for.
 *
 * ── THE SAME SHAPE AS THE SLOTS ─────────────────────────────────────────────────────────────────
 * The dispatcher declared `p1 … p5` and the rule filled only `p1`. The shelf declares
 * `lar-close-pattern` on thirty-one sigils and the rule attempted a body capture on THREE — `ahu`,
 * `pranala`, `kahea`. A promise the shelf makes and the rule does not keep, twice over.
 *
 * `buildClosers` already merges every declared closer into the map. The gap sits one step earlier:
 * `matchCompoundSigilAt` reports a `closeKey` only for a CHILD SLOT or a COMPOUND head, so a plain
 * block sigil arrived with `closeKey: null` and the capture was never attempted — while the map that
 * knew its tag sat one line away, already built.
 *
 * ── AND A DERIVATION THAT FAILS MUST SAY SO ─────────────────────────────────────────────────────
 * `closePatternToTag` reduces a regex to the literal `indexOf` tag the capture scans for. Given a
 * pattern carrying anything it cannot reduce, it returned that residue AS THE TAG — a string starting
 * `<<~/`, so its own guard passed, and an `indexOf` for it never matched anything a reader could
 * write. A tag that cannot match must arrive as null, where the caller can see it.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";
import { closePatternToTag } from "../src/wikirules/lar-sigil-shared.js";

const DIR = new URL("../tiddlers/", import.meta.url).pathname;

interface Block { name: string; open: string; close: string }

/** Every sigil the shelf declares a closer for, with the call its own example writes. */
function readBlocks(): Block[] {
  const out: Block[] = [];
  for (const file of readdirSync(DIR).filter((n) => /^sigil-.*\.tid$/.test(n))) {
    const text = readFileSync(DIR + file, "utf8");
    if (!/^lar-close-pattern:/m.test(text)) continue;
    const name = file.slice("sigil-".length, -".tid".length);
    const ex = /^lar-example:\s*(.*)$/m.exec(text);
    const open = ex ? ex[1]!.replace(/\\n/g, "\n").split("\n")[0]! : `<<~ ${name} x>>`;
    out.push({ name, open, close: `<<~/${name}>>` });
  }
  return out;
}

/** Declared, never inferred — heads whose OPEN form this vector cannot write. */
const EXEMPT = new Set([
  "pranala",   // arrow syntax with typed ends; `pranala-block` vectors cover it
]);

const blocks = readBlocks().filter((b) => !EXEMPT.has(b.name));

describe("closePatternToTag — a tag, or nothing", () => {
  test("CONTROL — it reduces the shapes the shelf actually writes", () => {
    expect(closePatternToTag("<<~\\/ahu\\s*>>")).toBe("<<~/ahu");
    expect(closePatternToTag("<<~\\/waiho\\s*>>")).toBe("<<~/waiho");
  });

  test("★ a pattern it cannot reduce yields null, never a tag carrying its own regex ★", () => {
    // Each of these once reduced to a "tag" that starts `<<~/` and matches nothing a reader writes.
    for (const p of ["<<~\\/\\\\?let\\s*>>", "<<~\\/(?:let|var)\\s*>>", "<<~\\/[a-z]+\\s*>>"]) {
      expect(closePatternToTag(p), `${p} reduced to a tag that can never match`).toBeNull();
    }
  });

  test("★ every closer the shelf declares reduces to a real tag ★", () => {
    const unreduced: string[] = [];
    for (const file of readdirSync(DIR).filter((n) => /^sigil-.*\.tid$/.test(n))) {
      const m = /^lar-close-pattern:\s*(.*)$/m.exec(readFileSync(DIR + file, "utf8"));
      if (m && closePatternToTag(m[1]!) === null) unreduced.push(`${file}: ${m[1]}`);
    }
    expect(unreduced, "a declared closer that reduces to nothing captures no body").toEqual([]);
  });
});

describe.skipIf(wikiSkip)(`a closer closes${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki(); }, 60_000);

  test("CONTROL — the harness stands", () => {
    expect(renderWikitext(e, "plain prose")).toContain("plain prose");
  });

  test("CONTROL — a closer for a head the shelf declares none for reads as water", () => {
    expect(renderWikitext(e, "<<~ vorpal-snicker x>>\nbody\n<<~/vorpal-snicker>>"))
      .toMatch(/lar-sigil-water/);
  });

  test.each(blocks.map((b) => [b.name, b.open, b.close] as const))(
    "★ `%s` — its body is captured and its closer never reaches the page ★", (name, open, close) => {
      const html = renderWikitext(e, `${open}\nbody\n${close}`);
      expect(html, `<<~/${name}>> rendered as WATER — the capture was never attempted`)
        .not.toMatch(/lar-sigil-water/);
      expect(html, `<<~/${name}>> went to the page verbatim`).not.toContain(`/${name}&gt;&gt;`);
    });
});
