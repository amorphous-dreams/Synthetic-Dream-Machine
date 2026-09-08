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

  /**
   * ⚠ "NOT EMPTY" PROVES NOTHING NOW. The gradient renders an unknown sigil AS ITS OWN TEXT, so every
   * sigil renders something. A vector that only refused "" would pass on the fallback it was written
   * to catch. `rendered()` asks the question that still separates them: did the DEFINITION run, or did
   * the sigil merely echo itself?
   */
  const rendered = (src: string): boolean => {
    const html = r(src);
    return html !== "" && !html.includes("&lt;&lt;~") && !html.includes("<<~");
  };

  test("★ `link` renders its DEFINITION — an English mirror is a PURE NAME ★", () => {
    // RULED: an English mirror of a sigil name reasons as a Name. No slash. `link` mirrors `loulou`.
    expect(rendered('<<~ link "lar:///ha.ka.ba/lares/api/pono/meme">>'),
      "`link` echoed itself instead of rendering — the mirror still wants a slash").toBe(true);
  });

  test("★ AN ENGLISH MIRROR BEHAVES AS ITS ORIGINAL — that is what mirroring means ★", () => {
    // The mirror does not owe a rendering; it owes the SAME ANSWER its original gives. Where the
    // original carries a runtime the mirror renders; where the original waits on one — `lele` holds
    // Verse concurrency semantics pending — the mirror echoes, and the gradient is working.
    const PAIRS: Array<[string, string]> = [
      ["link", "loulou"], ["branch", "lele"], ["shadow", "aka"], ["transclude", "kahea"],
    ];
    const arg = '"lar:///ha.ka.ba/lares/api/pono/meme"';
    const split = PAIRS.filter(([m, o]) => rendered(`<<~ ${m} ${arg}>>`) !== rendered(`<<~ ${o} ${arg}>>`));
    expect(split.map(([m, o]) => `${m}≠${o}`), "a mirror parted company with its original").toEqual([]);
  });

  test("★ …and a mirror answers to its BARE name, never a slash ★", () => {
    // RULED: an English mirror reasons as a pure Name. The slashed spelling names nothing.
    expect(rendered('<<~ link "lar:///ha.ka.ba/lares/api/pono/meme">>')).toBe(true);
    expect(rendered('<<~ \\link "lar:///ha.ka.ba/lares/api/pono/meme">>'),
      "the slashed spelling still resolved — the retired form is still wired").toBe(false);
  });

  test("CONTROL — the Hawaiian original renders its definition", () => {
    expect(rendered('<<~ loulou "lar:///ha.ka.ba/lares/api/pono/meme">>')).toBe(true);
  });

  test("CONTROL — and a truly unknown sigil ECHOES, which is the gradient working", () => {
    expect(rendered("<<~ nosuchsigil arg>>")).toBe(false);
    expect(r("<<~ nosuchsigil arg>>")).toContain("nosuchsigil");
  });

  test("an unknown sigil keeps its ARGUMENTS on the page, not just its name", () => {
    expect(r("<<~ nosuchsigil keepthisword>>")).toContain("keepthisword");
  });
});
