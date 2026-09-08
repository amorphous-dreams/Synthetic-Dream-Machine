/**
 * A named parameter reaches the definition it names.
 *
 * ── THE LAST UNFILLED HALF OF THE CALL ──────────────────────────────────────────────────────────
 * `p1 … p5` carry the positional slots and `args` the run whole. NAMED parameters reached nothing:
 * the rule emitted `name`, `args`, `src` and the five slots, so a definition declaring `hud`, `mode`
 * or `from` was handed none of them however the call was written.
 *
 * It stayed invisible because the sigils that most need names — the turn frame and the bearing —
 * live in the boot carrier's own scope and render as their own text everywhere else, which is what
 * the gradient owes an unknown sigil. A panel that binds nothing and a panel nothing reads look
 * identical on the page.
 *
 * ── THE DISPATCHER CANNOT FORWARD A NAME IT DOES NOT DECLARE ────────────────────────────────────
 * TiddlyWiki hands a procedure only the parameters it declares, so a GENERIC forwarder cannot pass
 * `hud=` to a callee whose signature it has never seen. The rule already knows the target's name at
 * parse time, so it names the target directly and hands over everything the call carried. The
 * gradient survives untouched: a transclude renders its CHILDREN where the target resolves to
 * nothing, which is the same floor the dispatcher stood on.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";

/** A definition declaring names, standing as a global the way the shelf's own do. */
const PROBE = {
  title: "lar:///test/sigil-probe",
  tags: "$:/tags/Global",
  type: "text/vnd.tiddlywiki",
  text: '\\procedure ~probe(alpha:"" beta:"" p1:"")\nA=<<alpha>> B=<<beta>> P=<<p1>>\n\\end\n',
};

describe.skipIf(wikiSkip)(`a named parameter reaches its definition${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki({ tiddlers: [PROBE] }); }, 60_000);
  const r = (t: string) => renderWikitext(e, t);

  test("CONTROL — the harness stands and the probe is registered", () => {
    expect(r("plain prose")).toContain("plain prose");
    expect(r("<<~ probe one>>"), "the probe definition never loaded").toContain("P=one");
  });

  test("★ a name binds the parameter it names ★", () => {
    expect(r('<<~ probe alpha="first" beta="second">>')).toContain("A=first B=second");
  });

  test("★ names and slots ride together ★", () => {
    const html = r('<<~ probe one alpha="first">>');
    expect(html).toContain("A=first");
    expect(html).toContain("P=one");
  });

  test("★ a quoted name value keeps its spaces and its colons ★", () => {
    expect(r('<<~ probe alpha="closed 1↺ -> open 1φ @◇:reason">>'))
      .toContain("A=closed 1↺ -&gt; open 1φ @◇:reason");
  });

  test("★ and the gradient still holds for a head nothing answers to ★", () => {
    expect(r('<<~ vorpal-snicker alpha="x">>')).toContain("vorpal-snicker");
  });
});
