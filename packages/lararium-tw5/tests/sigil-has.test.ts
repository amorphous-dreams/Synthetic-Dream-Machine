/**
 * `has` — an entity, a name, and what it holds.
 *
 * ── ONE SHAPE, WRITTEN OUT EIGHTY-FOUR TIMES ────────────────────────────────────────────────────
 * Thirty-five carriers each declared their own local shorthand for the same relation:
 *
 *     \procedure ~Cap(Type:"" Params:"")  ~Cap <<Type>> holds [{{{ [<Params>] }}}]
 *     \procedure ~Verb(Type:"" Params:"") ~Verb <<Type>> holds [{{{ [<Params>] }}}]
 *     …seventy more, byte-identical but for the name
 *
 * The boot seed already carries the relation those eighty-four were spelling — an ENTITY, a NAME,
 * and what it HOLDS — and writes it as one procedure taking the entity as a parameter:
 *
 *     <<has rank pulse "levels/0-4 reads/a-mark-a-morpheme-a-word">>
 *
 * The head that each photocopy hard-coded rides as the FIRST POSITIONAL here. Seventy-two names
 * become seventy-two values, and one definition answers for all of them.
 *
 * ── THE THIRD SLOT RIDES QUOTED ─────────────────────────────────────────────────────────────────
 * What an entity holds carries slashes, colons, arrows and prose. Unquoted, every `word:` binds a
 * parameter nobody named and the slot receives nothing — the same hazard the scheme-shaped
 * positionals carry, and the same cure.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";

const CALL = '<<~ has rank pulse "levels/0-4 reads/a-mark-a-morpheme-a-word">>';

describe.skipIf(wikiSkip)(`has — a registered sigil${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki(); }, 60_000);
  const r = (t: string) => renderWikitext(e, t);
  const rendered = (src: string) => { const h = r(src); return h !== "" && !h.includes("&lt;&lt;~") && !h.includes("<<~"); };

  test("CONTROL — the harness stands", () => {
    expect(r("plain prose")).toContain("plain prose");
  });

  test("CONTROL — a head no definition answers to still echoes", () => {
    expect(rendered('<<~ vorpal-snicker a b "c">>')).toBe(false);
  });

  test("★ has renders its DEFINITION, not its own text ★", () => {
    expect(rendered(CALL), "has still echoes — the grammar registers no call for it").toBe(true);
  });

  test("★ the entity, the name and what it holds each reach the page, in that order ★", () => {
    expect(r(CALL)).toContain("rank pulse holds [levels/0-4 reads/a-mark-a-morpheme-a-word]");
  });

  test("★ the head each photocopy hard-coded rides as a VALUE ★", () => {
    expect(r('<<~ has Cap content "stock/the nomic embedder over verbatim words">>'))
      .toContain("Cap content holds [stock/the nomic embedder over verbatim words]");
  });

  test("★ a quoted third slot keeps its colons, arrows and slashes as prose ★", () => {
    const html = r('<<~ has Stage Mandate "carries/scope + TTL; lapses on parent-dissolution -> handback RATIFIES">>');
    expect(html).toContain("carries/scope + TTL; lapses on parent-dissolution -&gt; handback RATIFIES");
  });

  test("★ an entity holding nothing still names itself ★", () => {
    expect(rendered("<<~ has Stage Two>>")).toBe(true);
    expect(r("<<~ has Stage Two>>")).toContain("Stage Two holds");
  });
});
