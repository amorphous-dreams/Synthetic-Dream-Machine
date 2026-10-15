/**
 * closer-belongs-to-opener — A BODY CAPTURE ENDS AT ITS OWN CLOSER.
 *
 * ── WHAT A SCAN TO THE END OF THE DOCUMENT COSTS ─────────────────────────────────────────────────
 * `findCloseEnd` answers one question — where does THIS opener's body end? A plain `indexOf` for the
 * closer tag answers a different one: where does the first closer of that name stand anywhere later
 * in the carrier. The two agree only while a name opens at most once per carrier.
 *
 * The shelf declares `lar-close-pattern` on thirty-one sigils and `buildClosers` merges every one of
 * them, so thirty-one names now reach a body capture. A LEAF call — `<<~ meme "lar:///x">>`, no
 * closer of its own — standing before an unrelated `<<~ meme …>>…<<~/meme>>` further down took that
 * block's closer and swallowed every byte between them into one body. The corpus does not write that
 * shape today; chat turns, ingested documents and operator drafts reach the same rule.
 *
 * ── THE LAW ─────────────────────────────────────────────────────────────────────────────────────
 * The closer that closes an opener stands at DEPTH ZERO: each further opener of the same name claims
 * the next closer first, so a nearer opener always wins its closer and an opener whose closer another
 * opener claimed closes nothing. A sigil the operator merely QUOTES opens and closes nothing —
 * measured over 700 carriers, teaching docs write openers inside fences, and reading those as
 * structure carried 19 captures past their own section into the next one.
 *
 * These vectors call the helper as the pure function it is — no wiki boot, so a red here names the
 * scan and nothing else.
 */
import { describe, test, expect } from "vitest";
import { BLOCK_CLOSERS, findCloseEnd } from "../src/wikirules/lar-sigil-shared.js";

/** The shelf's own shape: a block sigil beyond the three boot-critical names. */
const CLOSERS = { ...BLOCK_CLOSERS, meme: "<<~/meme", waiho: "<<~/waiho" };

/** Where the opener's `>>` ends, so a vector states its scan start the way the rule does. */
function afterOpen(source: string, opener: string): number {
  const i = source.indexOf(opener);
  expect(i, `vector does not carry ${opener}`).toBeGreaterThanOrEqual(0);
  return i + opener.length;
}

/** The body a capture would take, spelled the way `lar-sigil` spells it. */
function bodyOf(source: string, sigil: string, from: number, closers = CLOSERS): string | null {
  const end = findCloseEnd(source, sigil, from, closers);
  if (end === null) return null;
  const tagStart = source.lastIndexOf(`<<~/${sigil}`, end);
  return source.slice(from, tagStart);
}

describe("findCloseEnd — the closer belongs to the opener", () => {
  test("CONTROL — a well-formed block still captures exactly its body", () => {
    const src = `<<~ meme "lar:///x">>the body<<~/meme>>`;
    const from = afterOpen(src, `<<~ meme "lar:///x">>`);
    expect(findCloseEnd(src, "meme", from, CLOSERS)).toBe(src.length);
    expect(bodyOf(src, "meme", from)).toBe("the body");
  });

  test("CONTROL — the three boot-critical closers still close under the default map", () => {
    const src = `<<~ ahu #slot>>inner<<~/ahu>>`;
    const from = afterOpen(src, "<<~ ahu #slot>>");
    expect(findCloseEnd(src, "ahu", from)).toBe(src.length);
    expect(bodyOf(src, "ahu", from, BLOCK_CLOSERS)).toBe("inner");
  });

  test("★ a leaf call does not take a later block's closer ★", () => {
    const src = [
      `<<~ meme "lar:///leaf">>`,
      `prose that belongs to nobody`,
      `<<~ meme "lar:///block">>the other body<<~/meme>>`,
    ].join("\n");
    const leafFrom  = afterOpen(src, `<<~ meme "lar:///leaf">>`);
    const blockFrom = afterOpen(src, `<<~ meme "lar:///block">>`);
    expect(findCloseEnd(src, "meme", leafFrom, CLOSERS)).toBeNull();
    expect(bodyOf(src, "meme", blockFrom)).toBe("the other body");
  });

  test("★ a QUOTED opener claims no closer ★", () => {
    // MEASURED: teaching carriers show their own forms inside fences. Counting a shown opener as
    // structure gave the closer to the example and carried the real body into the following section.
    const src = [
      `<<~ ahu #/head>>`,
      "```",
      `<<~ ahu #/example>>`,
      "```",
      `the real body`,
      `<<~/ahu>>`,
    ].join("\n");
    const from = afterOpen(src, `<<~ ahu #/head>>`);
    expect(findCloseEnd(src, "ahu", from, CLOSERS)).toBe(src.length);
    expect(bodyOf(src, "ahu", from)).toContain("the real body");
  });

  test("★ a quoted CLOSER inside backticks ends nothing ★", () => {
    const src = "<<~ meme \"a\">>the form spells `<<~/meme>>` tight\n<<~/meme>>";
    const from = afterOpen(src, `<<~ meme "a">>`);
    expect(findCloseEnd(src, "meme", from, CLOSERS)).toBe(src.length);
    expect(bodyOf(src, "meme", from)).toBe("the form spells `<<~/meme>>` tight\n");
  });

  test("an UNPAIRED closer of another name rides in the body as prose", () => {
    // MEASURED: 38 corpus sections carry a stray closer of another name in plain prose. A walk that
    // read one as a barrier dropped bodies that render correctly.
    const src = [`<<~ ahu #/source-shelf>>`, ``, `<<~/pranala>>`, ``, `<<~/ahu>>`].join("\n");
    const from = afterOpen(src, `<<~ ahu #/source-shelf>>`);
    expect(findCloseEnd(src, "ahu", from, CLOSERS)).toBe(src.length);
    expect(bodyOf(src, "ahu", from)).toBe("\n\n<<~/pranala>>\n\n");
  });

  test("a longer name is not this name — `<<~/memex>>` closes no `meme`", () => {
    const src = `<<~ meme "a">>body<<~/memex>>tail`;
    expect(findCloseEnd(src, "meme", afterOpen(src, `<<~ meme "a">>`), CLOSERS)).toBeNull();
  });

  test("★ nested same-name blocks: the inner opener takes the inner closer ★", () => {
    const src = `<<~ meme "a">>outer <<~ meme "b">>inner<<~/meme>> tail<<~/meme>>`;
    const outerFrom = afterOpen(src, `<<~ meme "a">>`);
    const innerFrom = afterOpen(src, `<<~ meme "b">>`);
    expect(bodyOf(src, "meme", innerFrom)).toBe("inner");
    expect(bodyOf(src, "meme", outerFrom)).toBe(`outer <<~ meme "b">>inner<<~/meme>> tail`);
    expect(findCloseEnd(src, "meme", outerFrom, CLOSERS)).toBe(src.length);
  });

  test("a nested block of ANOTHER kind stands inside the body, not against it", () => {
    const src = `<<~ meme "a">>before <<~ waiho #s>>held<<~/waiho>> after<<~/meme>>`;
    const from = afterOpen(src, `<<~ meme "a">>`);
    expect(bodyOf(src, "meme", from)).toBe(`before <<~ waiho #s>>held<<~/waiho>> after`);
  });

  test("an opener whose closer never appears captures nothing", () => {
    const src = `<<~ meme "a">>body with no end at all`;
    expect(findCloseEnd(src, "meme", afterOpen(src, `<<~ meme "a">>`), CLOSERS)).toBeNull();
  });

  test("a closer standing BEFORE the opener is not taken", () => {
    const src = `<<~/meme>>\n<<~ meme "a">>trailing body`;
    expect(findCloseEnd(src, "meme", afterOpen(src, `<<~ meme "a">>`), CLOSERS)).toBeNull();
  });

  test("a sigil the map declares no closer for captures nothing", () => {
    const src = `<<~ helu 1>>body<<~/helu>>`;
    expect(findCloseEnd(src, "helu", afterOpen(src, `<<~ helu 1>>`), CLOSERS)).toBeNull();
  });

  test("a closer naming no block sigil rides inside the body as text", () => {
    const src = `<<~ meme "a">>talk of <<~/nothing>> in prose<<~/meme>>`;
    const from = afterOpen(src, `<<~ meme "a">>`);
    expect(bodyOf(src, "meme", from)).toBe("talk of <<~/nothing>> in prose");
  });
});
