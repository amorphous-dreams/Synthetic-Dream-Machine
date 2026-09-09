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
   * NOT OURS — RULED: TiddlyWiki OWNS the bare `<<…>>` form.
   *
   * A plain `<<name>>` carries no sharktooth, so no Lararium rule claims it and TiddlyWiki answers an
   * undefined call with the empty string. The gradient this house keeps — an unrecognised call
   * rendering as the text an author wrote — holds INSIDE the sharktooth namespace, by this grammar's
   * own rule, and belongs UPSTREAM for the bare form.
   *
   * A rule reaching past `<<~` would take every core macro with it and owe TiddlyWiki's parameter
   * parsing exactly, or silently change how a core macro reads its arguments. So the vector below
   * asserts the BOUNDARY rather than the behaviour: our rule leaves the bare form alone.
   *
   * The gradient for it rides the TiddlyWiki5 submodule's own working branch (`dev/sdm-integration`,
   * where `feature/parser-diagnostics` already carries gradient-failure intent).
   */
  test("★ the bare form belongs to TiddlyWiki — our rule leaves it alone ★", () => {
    // TiddlyWiki's own answer, unchanged by us: an undefined call renders as nothing.
    expect(r("<<undefinedthing>>")).toBe("");
    // …and a DEFINED core macro still renders, so nothing here has taken the bare form hostage.
    expect(r("<<now YYYY>>")).not.toBe("");
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
    // The mirror does not owe a rendering of its own; it owes the SAME ANSWER its original gives.
    // A mirror that delegates to its head cannot part company with it; a mirror carrying no
    // definition while its head carries one splits the pair, and this vector reads the split.
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
