/**
 * A sigil is a BLOCK only when its `>>` ends the line — TiddlyWiki's own split, kept whole.
 *
 * Stock TW5 reads `<<m>>` as `macrocallblock` only when the call stands alone on its line
 * (`>>` then `\r?\n` or the end of source). Anything after the `>>` makes the line a paragraph holding
 * `macrocallinline` and then text. The `lar-sigil` rule once claimed a sigil in the BLOCK phase wherever
 * it opened, so `<<~ x a=`ni:///x`>>;abc` rendered the sigil as a block and then read `;abc` as a
 * definition list; the foot ``<<^ code=`&#x0003;`>>ni:///…`` split mid-line into a `<span>` and a
 * paragraph whose `//` turned to italics. The rule now asks the same question the core asks.
 *
 * Each trailing-text probe is a RED against the old rule; each lone-sigil probe is the CONTROL that
 * keeps block claims alive, so a cure that declined everything cannot pass.
 */
import { describe, expect, test, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

const MEMETIC = "text/memetic-wikitext+tiddlywiki";
const STOCK   = "text/vnd.tiddlywiki";

interface Node { type: string; tag?: string; rule?: string; text?: string; children?: Node[] }

const BCC = "ni:///sha-256;7uFf47o8VMhpXmwKCHt2Ev8Kyin9lwMX-N3DlYeX73k";
const FOOT = `<<^ code=\`&#x0003;\` bcc=\`${BCC}\`>>`;

describe.skipIf(wikiSkip)(`a sigil is a block only when its >> ends the line${skipNote}`, () => {
  let engine: TW5Engine;
  beforeAll(async () => { engine = await bootTestWiki(); }, 60_000);

  const tree = (type: string, src: string): Node[] =>
    (engine.wiki.parseText(type, src, {}) as { tree: Node[] }).tree;
  const textOf = (nodes: Node[] = []): string =>
    nodes.map((n) => (n.type === "text" ? n.text ?? "" : textOf(n.children))).join("");

  /** One paragraph whose first child is the inline sigil node, its trailing text after. */
  function expectInlineParagraph(type: string, src: string, sigilRule: string | undefined, rest: string): void {
    const t = tree(type, src);
    expect(t.map((n) => `${n.type}${n.tag ? "<" + n.tag + ">" : ""}`)).toEqual(["element<p>"]);
    const kids = t[0]!.children!;
    expect(kids[0]!.type).toBe("transclude");
    if (sigilRule) expect(kids[0]!.rule).toBe(sigilRule);
    expect(textOf(kids.slice(1))).toBe(rest);
  }

  test("★ RED: `<<~ x …>>;abc` reads as a paragraph holding the sigil inline, then `;abc` — no definition list ★", () => {
    const src = "<<~ x a=`ni:///x`>>;abc after the bare ni:.";
    const t = tree(MEMETIC, src);
    expect(JSON.stringify(t)).not.toContain('"tag":"dl"');
    expectInlineParagraph(MEMETIC, src, "lar-sigil", ";abc after the bare ni:.");
  });

  test("★ RED: a sigil with a trailing space is a paragraph, as stock reads `<<m>> ` ★", () => {
    expectInlineParagraph(STOCK, "<<m>> ", undefined, " ");
    expectInlineParagraph(MEMETIC, "<<~ x a=`b`>> ", "lar-sigil", " ");
  });

  test("★ RED: the old foot — text after the ETX sigil — is a paragraph with the sigil inline ★", () => {
    const t = tree(MEMETIC, `<<^ code=\`&#x0003;\`>>${BCC}`);
    expect(t.map((n) => n.tag ?? n.type)).toEqual(["p"]);
    expect(t[0]!.children![0]!.rule).toBe("lar-sigil");
    expect(textOf(t[0]!.children!.slice(1))).toBe(BCC);
  });

  test("★ RED: a sigil leading a list marker or heading marker line stays inline ★", () => {
    expectInlineParagraph(MEMETIC, "<<~ x a=`b`>>* item", "lar-sigil", "* item");
    expectInlineParagraph(MEMETIC, "<<~ x a=`b`>>! head", "lar-sigil", "! head");
  });

  test("★ RED: two sigils on one line are one paragraph of two inline sigils ★", () => {
    const t = tree(MEMETIC, "<<~ a x=`1`>> <<~ b y=`2`>>");
    expect(t.map((n) => n.tag ?? n.type)).toEqual(["p"]);
    expect(t[0]!.children!.filter((n) => n.rule === "lar-sigil")).toHaveLength(2);
  });

  test("★ CONTROL: a sigil alone on its line stays a block claim ★", () => {
    const t = tree(MEMETIC, "<<~ x a=`b`>>");
    expect(t.map((n) => `${n.type}:${n.rule}`)).toEqual(["transclude:lar-sigil"]);
  });

  test("★ CONTROL: a sigil ending its line, with prose on the next, stays a block claim ★", () => {
    const t = tree(MEMETIC, "<<~ x a=`b`>>\nprose after");
    expect(t[0]!.type).toBe("transclude");
    expect(t[0]!.rule).toBe("lar-sigil");
    expect(t[1]!.tag).toBe("p");
  });

  test("★ CONTROL: a CRLF line end counts as a line end ★", () => {
    const t = tree(MEMETIC, "<<~ x a=`b`>>\r\nprose after");
    expect(t[0]!.rule).toBe("lar-sigil");
    expect(t[0]!.type).toBe("transclude");
  });

  test("★ CONTROL: the reshaped foot, alone on its line, stays a block claim (no paragraph around it) ★", () => {
    const t = tree(MEMETIC, FOOT);
    expect(t.map((n) => `${n.tag ?? n.type}:${n.rule}`)).toEqual(["span:lar-sigil"]);
  });

  test("★ CONTROL: a pranala alone on its line stays a block ★", () => {
    const pr = "<<~ pranala from=`lar:///a.b.c` to=`lar:///d.e.f`>>";
    expect(tree(MEMETIC, pr).map((n) => `${n.type}:${n.rule}`)).toEqual(["transclude:lar-sigil"]);
  });

  test("★ RED: a pranala with text after its >> reads inline ★", () => {
    const t = tree(MEMETIC, "<<~ pranala from=`lar:///a.b.c` to=`lar:///d.e.f`>>tail");
    expect(t.map((n) => n.tag ?? n.type)).toEqual(["p"]);
    expect(t[0]!.children![0]!.rule).toBe("lar-sigil");
  });

  test("★ CONTROL: stock macrocalls keep the same split the sigils now follow ★", () => {
    expect(tree(STOCK, "<<m>>").map((n) => n.rule)).toEqual(["macrocallblock"]);
    expect(tree(MEMETIC, "<<m>>").map((n) => n.rule)).toEqual(["macrocallblock"]);
    for (const src of ["<<m>>;abc", "<<m>>* item", "<<m>>! head", "<<a>> <<b>>"]) {
      expect(tree(MEMETIC, src).map((n) => n.tag)).toEqual(["p"]);
      expect(tree(STOCK, src).map((n) => n.tag)).toEqual(["p"]);
    }
  });

  test("a closer-bearing compound whose opener ends its line keeps its block claim", () => {
    const t = tree(MEMETIC, "<<~ ahu slot=`#/a`>>\nbody\n<<~/ahu>>");
    expect(t[0]!.rule).toBe("lar-sigil");
    expect(t[0]!.type).toBe("transclude");
  });
});
