/**
 * stage — a MASK and the theatrical depth it stands at.
 *
 * ── THE ONTOLOGY ────────────────────────────────────────────────────────────────────────────────
 * A mask carries a `stage` depth on the 0–20 scale, and the boot seed already declares its ranks
 * through the `scale` sigil:
 *
 *     <<scale stage "green-room@1..4 -> offstage@5..8 -> upstage@9..12 -> center-stage@13..16
 *                    -> downstage@17..20">>
 *
 * `stage` SUMMONS a mask to a depth on that scale. The masks canon has written the
 * summon since before a definition stood for it — `lar:///ha.ka.ba/lares/api/masks/roaming/sea-glass`
 * fires Sea-Glass downstage, and the operator fires Mischief-Muse the same way.
 *
 * ── THE DEPTH FIRST, THE MASK SECOND ────────────────────────────────────────────────────────────
 * A summon answers "how near" before "who" — the depth names what moves, the mask names whose depth
 * moves. The depth rides quoted or bare; the mask name rides quoted whenever it carries a
 * space, which an earned name usually does not and a chorus usually does.
 *
 * ── AND A CARRIER'S OWN `~Stage` STANDS UNTOUCHED ───────────────────────────────────────────────
 * Several carriers declare a LOCAL `\procedure ~Stage(Type Params)` for a lifecycle phase — a wholly
 * different sense, one capital apart, owned by the carrier that declares it. A global `~stage` must
 * not reach into that scope, and the last test here holds that line.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";

/** The operator's own firing, verbatim. */
const CALL = '<<~ stage "20" "Mischief-Muse">>';

describe.skipIf(wikiSkip)(`stage — a registered sigil${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki(); }, 60_000);
  const r = (t: string) => renderWikitext(e, t);
  /** Did the DEFINITION run, or did the sigil echo itself? The gradient makes "not empty" useless. */
  const rendered = (src: string) => { const h = r(src); return h !== "" && !h.includes("&lt;&lt;~") && !h.includes("<<~"); };

  test("CONTROL — the harness stands", () => {
    expect(r("plain prose")).toContain("plain prose");
  });

  test("CONTROL — a head the grammar registers nothing for still echoes", () => {
    expect(rendered('<<~ vorpal-snicker "20" "Nobody">>')).toBe(false);
  });

  test("★ stage renders its DEFINITION, not its own text ★", () => {
    expect(rendered(CALL), "stage still echoes — the grammar registers no call for it").toBe(true);
  });

  test("★ the mask reaches the page ★", () => {
    expect(r(CALL)).toContain("Mischief-Muse");
  });

  test("★ and so does the depth — a summon that loses its band summons nowhere ★", () => {
    expect(r(CALL)).toContain("20");
  });

  test("★ the depth rides bare too — the masks canon wrote it that way first ★", () => {
    const html = r("<<~ stage 12 Sea-Glass>>");
    expect(html).toContain("Sea-Glass");
    expect(html).toContain("12");
  });

  test("★ a mask name carrying a space survives, quoted ★", () => {
    expect(r('<<~ stage "16" "Ghost of Mark Twain">>')).toContain("Ghost of Mark Twain");
  });

  test("★ a summon with no mask still renders, and loses no depth ★", () => {
    expect(rendered('<<~ stage "20">>')).toBe(true);
    expect(r('<<~ stage "20">>')).toContain("20");
  });

  /**
   * ── THE SLOTS MUST BIND SEPARATELY, AND `toContain` CANNOT SEE THAT ─────────────────────────────
   * A sigil that echoes itself contains every word of its own call, so a containment read passes on a
   * summon that bound nothing. These name the SHAPE the definition composes — depth in one slot, mask
   * in the other — which only a real binding can produce.
   */
  test("★ the depth and the mask land in DIFFERENT slots ★", () => {
    expect(r(CALL)).toContain("Mischief-Muse @20");
  });

  test("★ and the delimiters do not reach the page — a quote binds a value, it is not one ★", () => {
    const html = r(CALL);
    expect(html, "the quote pair rendered as content").not.toContain("&quot;");
    expect(html).not.toContain('"20"');
  });

  test("★ a carrier's own `~Stage` keeps its own sense — one capital apart, and never reached ★", () => {
    const local = [
      '\\procedure ~Stage(Type:"" Params:"") ~Stage <<Type>> holds [<<Params>>]',
      '',
      '<<~Stage Birth "verb/nexus-seal-seat">>',
    ].join("\n");
    const html = r(local);
    expect(html, "the carrier's local lifecycle sense was lost").toContain("Birth");
    expect(html).toContain("nexus-seal-seat");
    expect(html, "the global summon reached into a carrier's own scope").not.toContain("lar-stage");
  });
});
