/**
 * ── AND A CLOSER IS NOT A CALL ──────────────────────────────────────────────────────────────────
 * Every example here rides the LEAF form, because only three closers reach a body capture today —
 * `ahu`, `pranala`, `kahea` — while the corpus writes some twenty kinds. `waiho`, `heihei`, `huli`,
 * `hana` and the declaration forms each carry a taught closer that renders as WATER. That debt is
 * measured and OWED; this census does not hide it behind a leaf-form vector, it names it here.
 */

/**
 * The shelf renders itself — every definition ships one worked call, and this runs it.
 *
 * ── THE RATIO THAT HID EVERY DEFECT ─────────────────────────────────────────────────────────────
 * Four defects landed in one session that a grep could never see: slots that never filled, a
 * dispatch name that resolved to the dispatcher itself, seven definitions answering to a spelling
 * the corpus had left behind, and `\end` written where it closed nothing. Each survived because the
 * grammar FAILS GRACEFULLY — an unreached definition renders the reader's own text, which is exactly
 * what an unknown sigil owes them, so a broken sigil and a working one read alike on the page.
 *
 * A definition is only as true as the call that drives it. So each carries `lar-example`: ONE call,
 * beside the definition it exercises, moving whenever the definition moves.
 *
 * ── AND THE GRADIENT ITSELF BECOMES TESTABLE ────────────────────────────────────────────────────
 * Some sigils on this shelf carry a PATTERN and no definition on purpose — the panel, the wards, the
 * frame marks. The tree recognises them and the page shows them verbatim, which IS their contract.
 * So the census reads the two halves as opposite laws over the same vector:
 *
 *     a DEFINED sigil's example must NOT echo    — the definition ran
 *     a PATTERN-ONLY sigil's example MUST echo   — the gradient held
 *
 * Neither law can pass by the harness rendering nothing, because the other one would fail.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";

const DIR = new URL("../tiddlers/", import.meta.url).pathname;

interface Shelf { file: string; name: string; example: string | null; defined: boolean }

/**
 * Read the shelf as it stands. A tiddler's own sigil name comes from its FILENAME, so a definition
 * named for a different sigil (`~kahea~kau` living in `sigil-kau`) counts as a helper rather than as
 * the entry this census drives.
 */
function readShelf(): Shelf[] {
  const out: Shelf[] = [];
  for (const file of readdirSync(DIR).filter((n) => /^sigil-.*\.tid$/.test(n))) {
    const name = file.slice("sigil-".length, -".tid".length);
    const text = readFileSync(DIR + file, "utf8");
    const ex = /^lar-example:\s*(.*)$/m.exec(text);
    const defined = new RegExp(`\\\\(?:procedure|widget) ~${name.replace(/[-]/g, "\\-")}\\(`).test(text);
    out.push({ file, name, example: ex ? ex[1]!.replace(/\\n/g, "\n") : null, defined });
  }
  return out;
}

/** Declared, never inferred: entries this census does not drive, each with the reason it stands out. */
const EXEMPT = new Set([
  "dispatcher",            // the floor itself — every other example drives it
  "pranala-header",        // a pranala cascade's header template — it answers inside the block and
                           // never as a standalone call; `<<~ ? -> uri>>` opens no head at all
  "family-constraint", "family-control", "family-dataflow", "family-frame", "family-message",
  "family-observe", "family-reaction", "family-relation", "family-spatial",  // family index tiddlers, no call
  "define", "procedure", "function", "widget", "kumu", "wehe",  // declaration forms — they DEFINE, and a
                                                                // census call would leave a definition behind
  "frame-eot", "frame-eot2", "frame-etb", "frame-etx", "frame-soh", "frame-soh2", "frame-stx",
  "toml",                  // control marks and the meta fence — `frame-parity` reads these
  "helu", "holo", "hui", "hoolele", "kukali", "lele", "puka", "race", "rush", "sync", "tick",
                           // no definition and no vector yet — OWED, and named here rather than skipped
]);

const shelf = readShelf().filter((s) => !EXEMPT.has(s.name));

describe("the shelf, as source", () => {
  test("★ every definition ships one worked call ★", () => {
    const bare = shelf.filter((s) => s.defined && !s.example).map((s) => s.file);
    expect(bare, "a definition with no `lar-example` runs under no vector").toEqual([]);
  });

  test("CONTROL — the census actually found a shelf to read", () => {
    expect(shelf.filter((s) => s.example).length).toBeGreaterThan(30);
    expect(shelf.filter((s) => s.defined).length).toBeGreaterThan(20);
  });
});

describe.skipIf(wikiSkip)(`the shelf, as render${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki(); }, 60_000);

  const withExample = shelf.filter((s): s is Shelf & { example: string } => s.example !== null);
  const defined = withExample.filter((s) => s.defined);
  const gradient = withExample.filter((s) => !s.defined);

  test("CONTROL — the harness stands", () => {
    expect(renderWikitext(e, "plain prose")).toContain("plain prose");
  });

  test.each(defined.map((s) => [s.name, s.example] as const))(
    "★ `%s` — its own example reaches its definition ★", (name, example) => {
      let html = "";
      expect(() => { html = renderWikitext(e, example); }, `${name} threw on its own example`).not.toThrow();
      expect(html, `${name} echoes — the definition was never reached`).not.toMatch(/&lt;&lt;~|<<~/);
      expect(html, `${name} put a pragma on the page`).not.toContain("\\end");
    });

  test.each(gradient.map((s) => [s.name, s.example] as const))(
    "★ `%s` — pattern only, and the gradient hands the reader their own text ★", (name, example) => {
      let html = "";
      expect(() => { html = renderWikitext(e, example); }, `${name} threw`).not.toThrow();
      expect(html, `${name} carries no definition, so its own text owes the page`).toMatch(/&lt;&lt;~|<<~/);
    });
});
