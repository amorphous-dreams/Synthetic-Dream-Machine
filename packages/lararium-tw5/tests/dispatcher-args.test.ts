/**
 * `args` — the whole argument run, for the definitions that parse it themselves.
 *
 * ── A SLOT AND A RUN ANSWER DIFFERENT QUESTIONS ─────────────────────────────────────────────────
 * `p1 … p5` hold POSITIONAL SLOTS: one value each, delimiters stripped, `name=value` pairs stepped
 * over. Most definitions want exactly that.
 *
 * Three do not. `pono` and `papalohe` annotate an EDGE — the from, the arrow and the to make one
 * assertion, and splitting them into slots hands each definition the job of putting them back. `kau`
 * runs its own parse over `#fragment name props`, which predates the slot interface and reads
 * its shape rather than its arity.
 *
 * So the dispatcher carries BOTH: the slots for the definitions that compose from them, and `args` —
 * the run exactly as written — for the definitions that read it whole. Neither derives from the
 * other at the definition, so neither can be got subtly wrong there.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";

describe.skipIf(wikiSkip)(`the whole argument run${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki(); }, 60_000);
  const r = (t: string) => renderWikitext(e, t);

  test("CONTROL — the harness stands", () => {
    expect(r("plain prose")).toContain("plain prose");
  });

  test("★ an edge annotation carries BOTH its ends ★", () => {
    const html = r('<<~ pono "lar:///a.b.c/x" -> "lar:///a.b.c/y">>');
    expect(html, "the FROM end was dropped").toContain("lar:///a.b.c/x");
    expect(html, "the TO end was dropped — the edge points nowhere").toContain("lar:///a.b.c/y");
  });

  test("★ a reaction edge carries its whole wire ★", () => {
    const html = r('<<~ papalohe "lar:///a.b.c/x" -> "lar:///a.b.c/y">>');
    expect(html).toContain("lar:///a.b.c/x");
    expect(html).toContain("lar:///a.b.c/y");
  });

  test("★ and the slots still bind separately for the definitions that compose from them ★", () => {
    expect(r('<<~ stage "20" "Mischief-Muse">>')).toContain("Mischief-Muse @20");
  });
});
