/**
 * The dispatcher's floor — an unnamed dispatch resolves to nothing, never to ITSELF.
 *
 * ── THE SECOND RECURSION ────────────────────────────────────────────────────────────────────────
 * The dispatcher already ends one recursion: a sigil's verbatim text rides to the page through
 * `<$text>` rather than as wikitext, so the gradient's floor cannot re-enter the rule that produced
 * it. A SECOND path stood open beside it.
 *
 * Several definitions compose by handing the dispatcher a name they were given — `~if` renders the
 * sigil named by its second slot, `~meme` transcludes into a tiddler and dispatches there. When that
 * slot arrives empty, `[<name>addprefix[~]]` yields the bare `~` — THE DISPATCHER'S OWN NAME — and
 * the widget transcludes itself until the stack ends. It surfaces as a thrown parse, not as a
 * degraded render, so a carrier holding one takes the whole page down with it.
 *
 * ── AN EMPTY NAME NAMES NOTHING, AND THE FLOOR ALREADY KNOWS WHAT TO DO WITH THAT ───────────────
 * A blank name yields a blank variable, a transclude on a blank variable resolves to nothing, and a
 * transclude resolving to nothing renders its children — the verbatim source. The cure REACHES the
 * floor already standing here, rather than stepping past it.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";

/** Every call whose definition re-enters the dispatcher with a slot that arrives empty. */
const RE_ENTRANT = [
  '<<~ if "[[1]match[1]]">>',
  '<<~ meme "lar:///a.b.c/x">>',
  '<<~ for "[tag[x]]">>',
  '<<~ tiddler "lar:///a.b.c/x">>',
  '<<~ let name "value">>',
  '<<~ var name "value">>',
];

describe.skipIf(wikiSkip)(`the dispatcher's floor${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki(); }, 60_000);

  test("CONTROL — the harness stands", () => {
    expect(renderWikitext(e, "plain prose")).toContain("plain prose");
  });

  test.each(RE_ENTRANT)("★ %s renders rather than throwing ★", (src) => {
    expect(() => renderWikitext(e, src),
      "an empty dispatch name resolved to the dispatcher itself").not.toThrow();
  });

  test("★ and a dispatch that resolves to nothing still puts the reader's own text on the page ★", () => {
    expect(renderWikitext(e, '<<~ vorpal-snicker "a">>')).toContain("vorpal-snicker");
  });
});
