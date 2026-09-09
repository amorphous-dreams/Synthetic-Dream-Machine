/**
 * A sigil answers to its own pattern — the tight call reaches its definition.
 *
 * ── THE TWO HALVES DISAGREED ────────────────────────────────────────────────────────────────────
 * Every sigil tiddler declares its opener as `<<~\s*NAME` — ZERO OR MORE whitespace, so a call
 * written tight stands legal by the shelf's own word. Seventy-seven patterns say so and not one says
 * otherwise. The wikirule matched `<<~\s+`, ONE OR MORE, and handed every tight call to the generic
 * fallback, which grades it degraded and renders the reader's own text.
 *
 * So a definition stood, its pattern admitted the call, and the call reached nothing — while the page
 * showed the caller exactly what they typed. Measured across the corpus: six `loops` rows and three
 * hundred and sixty-five `has` rows read that way, each one looking live.
 *
 * ── AND A DIRECT CALL IS THE PLAIN CASE ─────────────────────────────────────────────────────────
 * RULED: every sigil the shelf registers answers when called directly. The space is a courtesy to a
 * reader's eye, never a condition of arrival — and a grammar whose two halves disagree about what a
 * call LOOKS LIKE cannot tell an author which half to believe.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";

/** Each pair: the spaced call, and the same call written tight. */
const PAIRS: ReadonlyArray<readonly [string, string, string]> = [
  ["has",   '<<~ has Verb run "args/x">>',           '<<~has Verb run "args/x">>'],
  ["scale", '<<~ scale organ "a ~ one -> b ~ two">>', '<<~scale organ "a ~ one -> b ~ two">>'],
  ["stage", '<<~ stage "20" "Mischief-Muse">>',       '<<~stage "20" "Mischief-Muse">>'],
  ["loops", '<<~ loops "✶ observe -> ↺ aftermath">>', '<<~loops "✶ observe -> ↺ aftermath">>'],
];

describe.skipIf(wikiSkip)(`a tight call reaches its definition${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki(); }, 60_000);
  const r = (t: string) => renderWikitext(e, t);

  test("CONTROL — the harness stands", () => {
    expect(r("plain prose")).toContain("plain prose");
  });

  test("CONTROL — a head no definition answers to still echoes, tight or spaced", () => {
    expect(r("<<~ vorpal-snicker x>>")).toContain("vorpal-snicker");
    expect(r("<<~vorpal-snicker x>>")).toContain("vorpal-snicker");
  });

  /**
   * THE HOST BLOCK-WRAPS ITS OWN MACROCALL. A tight call arrives through TiddlyWiki's parser and may
   * land inside a `<p>`; the spaced one arrives through this rule and does not. The wrapping belongs
   * to whichever parser read the call, so the pair compares what the DEFINITION produced.
   */
  const inner = (html: string) => html.replace(/^<p>|<\/p>$/g, "").trim();

  test.each(PAIRS)("★ `%s` — tight and spaced reach the SAME definition ★", (_name, spaced, tight) => {
    const a = inner(r(spaced));
    const b = inner(r(tight));
    expect(a, "the spaced call reaches nothing — the pair proves nothing").not.toMatch(/&lt;&lt;~/);
    expect(b, "the tight call reaches nothing while TiddlyWiki reads it natively").not.toMatch(/&lt;&lt;~/);
    expect(b).toBe(a);
  });

  test("★ and the floor still catches what the host would swallow ★", () => {
    // Measured in a BARE wiki: a tight call to an undefined macro renders NOTHING — text and all,
    // gone. This rule steps aside only where the shelf registers the head, so an unregistered tight
    // call still reaches the gradient rather than the void.
    expect(r('<<~vorpal-snicker A B "c">>')).toMatch(/lar-sigil-degraded/);
    expect(r('<<~vorpal-snicker A B "c">>')).toContain("vorpal-snicker");
  });
});
