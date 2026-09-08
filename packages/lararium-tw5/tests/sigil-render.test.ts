/**
 * sigil-render — WHAT A SIGIL PUTS ON THE PAGE.
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────────────────────────
 * One test in this package called `renderTiddler`, and two asserted any sigil's HTML. Every claim
 * about rendering was indirect — which is how a render-path rule kept its own capture through a
 * corpus change, and how three probes in one session read "the grammar is broken" when the grammar
 * had merely never been imported.
 *
 * ── THE LAW ──────────────────────────────────────────────────────────────────────────────────────
 * A sigil renders on a GRADIENT. A definition renders its definition. NO DEFINITION RENDERS THE
 * INPUT TEXT — never nothing. TiddlyWiki's own answer for an undefined call is the empty string, so
 * the gradient is this house's to keep: a reader who meets an unknown sigil must still see what the
 * author wrote.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";

describe.skipIf(wikiSkip)(`a sigil renders on a gradient${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki(); }, 60_000);
  const r = (t: string) => renderWikitext(e, t);

  test("CONTROL — plain wikitext renders, so the harness stands", () => {
    expect(r("just ordinary prose")).toContain("just ordinary prose");
    expect(r("''bold''")).toContain("<strong>bold</strong>");
  });

  test("★ a DEFINED sigil renders its definition ★", () => {
    // `ahu` opens a carrier's child slot; it carries a template and MUST reach the page.
    // A carrier's block BODY rides in child tiddlers — the deserializer splits it before TW5 parses,
    // so a raw wikitext render shows the slot's own frame and not its text. The frame must reach the
    // page: an ahu rendering nothing means the slot vanished.
    const html = r("<<~ ahu #/entry>>\nbody text\n<<~/ahu>>");
    expect(html, "an ahu that renders nothing has lost its slot").not.toBe("");
    expect(html).toContain("lar-ahu");
    expect(html).toContain("#/entry");
  });

  test("★ AN UNDEFINED SIGIL RENDERS ITS INPUT TEXT ★", () => {
    // The gradient's floor. TiddlyWiki answers an undefined call with "" — this house answers with
    // what the author wrote, so nothing a reader typed disappears from the page.
    const src = "<<~ nosuchsigil arg>>";
    const html = r(src);
    expect(html, "an unknown sigil VANISHED from the page").not.toBe("");
    expect(html).toContain("nosuchsigil");
  });

  test("★ …and so does an undefined sigil carrying named parameters ★", () => {
    const html = r('<<~ alsonosuch a="1" b="2">>');
    expect(html).toContain("alsonosuch");
  });

  /**
   * DECLARED RED — meant to be UNSKIPPED, never deleted.
   *
   * A PLAIN `<<name>>` call carries no sharktooth, so `lar-sigil` never claims it and TiddlyWiki's own
   * `macrocallinline` rule takes it. TiddlyWiki answers an undefined call with the empty string, and
   * that answer reaches the page unchanged.
   *
   * THE MECHANISM IS KNOWN AND COSTS A RULING, NOT A FIX. The same transclude fallback that carries the
   * sharktooth gradient would carry this one: claim `<<word …>>`, emit `transclude $variable=word` with
   * the verbatim as its children, and TiddlyWiki renders the macro where it resolves and the text where
   * it does not — no parse-time knowledge of what is defined.
   *
   * What it costs: this rule would then claim EVERY macro call in the wiki, core ones included, and
   * would have to reproduce TiddlyWiki's own parameter parsing faithfully or silently change how a
   * core macro reads its arguments. That is an architectural decision about who owns `<<…>>`.
   */
  test.skip("★ a plain undefined macro call renders its input text too — RULING OWED: claiming <<…>> means owning every macro call ★", () => {
    const html = r("<<undefinedthing>>");
    expect(html, "a bare undefined call VANISHED from the page").not.toBe("");
    expect(html).toContain("undefinedthing");
  });

  test("★ `\\link` renders — the alias reaches loulou ★", () => {
    // The sigil spells with its backslash: `\link` aliases `loulou`.
    const html = r('<<~ \\link "lar:///ha.ka.ba/lares/api/pono/meme">>');
    expect(html).not.toBe("");
    expect(html).toContain("lar:///ha.ka.ba/lares/api/pono/meme");
  });

  test("an unknown sigil keeps its ARGUMENTS on the page, not just its name", () => {
    expect(r("<<~ nosuchsigil keepthisword>>")).toContain("keepthisword");
  });
});
