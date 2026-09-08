/**
 * THE CONTROL HEAD QUOTES ITS VALUES — ONE SPELLING, NOT A JUDGEMENT PER VALUE.
 *
 * ── WHAT TIDDLYWIKI REQUIRES ─────────────────────────────────────────────────────────────────────────────
 * Nothing, for a one-word value. `reUnquotedAttribute` admits `[^\s>"']`, so `code=&#x0001;` and
 * `code="&#x0001;"` reach `parseMacroInvocationAsTransclusion` as the same attribute with the same value.
 * Measured both ways.
 *
 * ── WHY THE QUOTES STAND ANYWAY ──────────────────────────────────────────────────────────────────────────
 * The other head parameter cannot go without them. 66 carriers declare `namespace="ॐ ँ"` — two glyphs and
 * a space. Unquoted, TiddlyWiki reads `namespace="ॐ"` and hands the second glyph back as a positional:
 * the namespace silently loses half of itself, and the SOH the renderer derives from it stops matching
 * what the meta declares.
 *
 * So a head that dropped quotes would carry them on one parameter and not the other, and a writer would
 * decide per value which case it faces. One spelling costs two characters and no judgement.
 *
 * ── AND THE LAW REACHES THE BEARING ENDS ─────────────────────────────────────────────────────────────────
 * `from=` and `to=` take the same spelling as `code=` and `namespace=`. The ARROW between them stays an
 * unnamed positional — that is what carries the relation — so quoting reaches only the two values it
 * stands between and a bearing never demotes to a field.
 *
 * The cost of learning this: 2131 values took quotes in one pass, TiddlyWiki re-parsed every carrier
 * identically, and EIGHT hand-rolled readers that never meet the parser stopped matching at once — the
 * tw5 suite fell to 10 failures and one witness reported 1395 torn frames. The tests below are the guard:
 * both spellings must reach the same reading, and the canonical emit must be the quoted one.
 */

import { describe, test, expect } from "vitest";
import { readCarrierShape } from "../src/carrier-shape.js";

const carrier = (head: string) =>
  `<<!DOCTYPE memetic-wikitext+tiddlywiki lar:///g>>\n\n${head}\n` +
  "```toml meta\ncacheable = true\n```\n\n" +
  `<<^ code="&#x0002;">>\n\nbody\n\n<<^ code="&#x0003;">>\n`;

describe("the control head quotes its values", () => {
  test("a quoted code reads", () => {
    expect(readCarrierShape(carrier('<<^ code="&#x0001;" from=? -> to=lar:///x>>')).marks.head).toBe(true);
  });

  test("★ a namespace carrying a space needs its quotes — the value is two glyphs ★", () => {
    // The whole reason the head keeps one spelling. This value stands in 66 carriers.
    const shape = readCarrierShape(carrier('<<^ code="&#x0001;" namespace="ॐ ँ" from=? -> to=lar:///x>>'));
    expect(shape.marks.head).toBe(true);
  });

  test("★ both spellings of the bearing reach ONE reading ★", () => {
    const bare   = readCarrierShape(carrier('<<^ code="&#x0001;" from=? -> to=lar:///x>>'));
    const quoted = readCarrierShape(carrier('<<^ code="&#x0001;" from="?" -> to="lar:///x">>'));
    expect(quoted.marks.headUri).toBe("lar:///x");
    expect(quoted.marks.headUri).toBe(bare.marks.headUri);
    expect(quoted.marks.head).toBe(bare.marks.head);
  });

  test("★ the canonical emit quotes both ends ★", async () => {
    const { memeticWikitextDeserializer, expandMemeRefs } = await import("../src/deserializer.js");
    const URI = "lar:///ha.ka.ba/lares/test/quoting";
    const records = memeticWikitextDeserializer("Body.\n", { title: URI });
    const map = new Map(records.map((r) => [String(r.title), r] as const));
    const out = expandMemeRefs((t) => map.get(t), URI)!;
    expect(out).toContain(`from="?" -> to="${URI}"`);
    expect(out).toMatch(/-> to="\?">>/);
  });
});
