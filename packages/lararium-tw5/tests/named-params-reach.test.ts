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
  text:
    '\\procedure ~probe(alpha:"" beta:"" p1:"")\nA=<<alpha>> B=<<beta>> P=<<p1>>\n\\end\n' +
    // the ORACLE's own call, same signature under a name TiddlyWiki dispatches natively
    '\\procedure nprobe(alpha:"")\nN=<<alpha>>\n\\end\n' +
    // a macro to pass BY CALL rather than by its text
    "\\procedure greeting()\nAloha\n\\end\n",
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

/**
 * ── A MACRO VALUE ARRIVES AS A CALL ─────────────────────────────────────────────────────────────
 * TiddlyWiki types five value kinds on a named parameter, and `macro` — `name=<<something>>` — is the
 * one a sigil could not carry. The limit read as a flattening; MEASURED, it costs more than that.
 * Against the vendored core, `<<nprobe alpha=<<greeting>> >>` renders `N=Aloha`, while the sigil form
 * rendered `A=&lt;&lt;greeting` and spilled the leftover `>>` into the page as an empty blockquote:
 * the opener scan stopped at the INNER call's `>>`, so the value flattened AND the sigil truncated.
 *
 * The corpus writes zero macro-valued parameters (`sigil-parity`: 14,690 sigils, 2 typed values, and
 * a scan for `=<<` finds none), so this closes an interface rather than repairing a live carrier.
 * The parse tree stays the ORACLE — the node comes from core's own
 * `parseMacroInvocationAsTransclusion`, never from a shape spelled here.
 */
describe.skipIf(wikiSkip)(`a macro value reaches its parameter as a call${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki({ tiddlers: [PROBE] }); }, 60_000);
  const r = (t: string) => renderWikitext(e, t);

  test("ORACLE — TiddlyWiki's own call runs the macro and binds its result", () => {
    expect(r("<<nprobe alpha=<<greeting>> >>")).toContain("N=Aloha");
    expect(r("<<nprobe alpha=<<greeting>>>>")).toContain("N=Aloha");
  });

  test("★ the sigil binds the macro's RESULT, not its source text ★", () => {
    const html = r("<<~ probe alpha=<<greeting>> >>");
    expect(html).toContain("A=Aloha");
    expect(html).not.toContain("greeting");
  });

  test("★ the sigil ends at its OWN closer, so nothing spills past it ★", () => {
    const html = r("<<~ probe alpha=<<greeting>>>>");
    expect(html).toContain("A=Aloha");
    expect(html).not.toContain("blockquote");
  });

  test("★ a macro value rides beside a string one, and a positional still lands ★", () => {
    const html = r('<<~ probe one alpha=<<greeting>> beta="plain">>');
    expect(html).toContain("A=Aloha");
    expect(html).toContain("B=plain");
    expect(html).toContain("P=one");
  });

  test("★ a quoted value carrying `>>` reaches the parameter whole ★", () => {
    // Five LIVE `<<~ has …>>` sigils write `>>` inside a quoted value. The call ends at its own
    // closer, so the value arrives entire rather than cut at the first `>>` it contains.
    expect(r('<<~ has Hold Graph "writes/`<<~holds x>>` binds/x">>'))
      .toContain("writes/`&lt;&lt;~holds x&gt;&gt;` binds/x");
  });

  test("CONTROL — a string value reads exactly as the ORACLE reads it", () => {
    // Bound whole, then rendered: core drops an unresolved inner call on the way to the page, and
    // the sigil form must land in the same place rather than a kinder one.
    const oracle = r('<<nprobe alpha="literal <<not-a-call>>">>');
    expect(oracle).toContain("N=literal");
    expect(r('<<~ probe alpha="literal <<not-a-call>>">>')).toContain("A=literal");
  });
});
