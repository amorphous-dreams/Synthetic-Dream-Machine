/**
 * scale — an ORDERED SCALE, and the ranks it carries.
 *
 * ── THE ONTOLOGY ────────────────────────────────────────────────────────────────────────────────
 * A SCALE is the thing; RANKS are what it carries. The boot seed said so before this sigil existed:
 *
 *     \procedure scale(name ranks) <<name>> <<ranks>>
 *     <<scale levels "rank-1@0..4 -> rank-2@5..8 -> rank-3@9..12 -> rank-4@13..16 -> rank-5@17..20">>
 *
 * So the sigil takes the SCALE'S name and its ranked chain — a NAME and a QUOTED body, exactly the
 * call the boot already writes 18 times.
 *
 * ── WHY THE CHAIN RIDES QUOTED ──────────────────────────────────────────────────────────────────
 * The chain carries `->`, `~`, backticks, colons and prose. Unquoted, every arrow reads as structure
 * and every `word:` binds a parameter nobody named. One pair of quotes makes the whole chain ONE
 * value, and the ranks read within it — which is what the boot's own call form has always done.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";

const CALL = '<<~ scale organ "mempalace ~ FIRST — the worldline-KG lives inside it -> structurepalace ~ structure plane">>';

describe.skipIf(wikiSkip)(`scale — a registered sigil${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki(); }, 60_000);
  const r = (t: string) => renderWikitext(e, t);
  /** Did the DEFINITION run, or did the sigil echo itself? The gradient makes "not empty" useless. */
  const rendered = (src: string) => { const h = r(src); return h !== "" && !h.includes("&lt;&lt;~") && !h.includes("<<~"); };

  test("CONTROL — the harness stands", () => {
    expect(r("plain prose")).toContain("plain prose");
  });

  test("★ scale renders its DEFINITION, not its own text ★", () => {
    expect(rendered(CALL), "scale still echoes — the grammar registers no call for it").toBe(true);
  });

  test("★ the scale's NAME reaches the page ★", () => {
    expect(r(CALL)).toContain("organ");
  });

  test("★ and every rank in the chain does too — the body rides WHOLE ★", () => {
    const html = r(CALL);
    for (const rank of ["mempalace", "structurepalace"]) expect(html, `rank ${rank} was dropped`).toContain(rank);
    expect(html, "a gloss was dropped").toContain("worldline-KG");
  });

  test("★ a gloss carrying a colon survives — it is prose, not a parameter ★", () => {
    const html = r('<<~ scale rhyme "physics ~ Lightcone: each worldline carries its own proper time">>');
    expect(html).toContain("Lightcone");
    expect(html).toContain("proper time");
  });

  /**
   * The bootstrap scanner carries a `scale` entry too, and no vector here drives it: the grammar
   * boundary forbids a test reaching past a blessed surface into meme-ast, and the RENDER above
   * already proves the sigil is registered and live. `frame-parity` reads the scanner independently.
   */
  test("★ a scale carrying no chain still renders, and loses nothing ★", () => {
    expect(rendered("<<~ scale levels>>")).toBe(true);
  });
});
