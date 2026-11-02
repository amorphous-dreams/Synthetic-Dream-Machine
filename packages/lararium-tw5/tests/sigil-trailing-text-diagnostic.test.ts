/**
 * The graceful floor under the block law: text after a would-be block sigil is RECOVERED, never silent.
 *
 * A line opening on a sigil whose `>>` leaves text behind reads as a paragraph holding the sigil inline
 * (lar-sigil-block-parity.test.ts). The recovery keeps every byte, and says so: one `sigil-trailing-text`
 * warning, keyed to the sigil's span, on the same channel every other recovery rides — the meme-ast
 * failures the ingest gate and `[parse-diagnostics[]]` both read.
 *
 * CONTROLS stand beside the reds: a lone sigil, a sigil mid-line, a fenced sigil and a closer-bearing
 * opener raise nothing, so a diagnostic that fired on every sigil could not pass.
 */
import { describe, expect, test, beforeAll } from "vitest";
import { parseMemeText } from "../src/meme-ast/parse.js";
import { failuresToDiagnostics } from "../src/meme-ast/diagnostics.js";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

const CODE = "sigil-trailing-text";
const URI  = "lar:///t.t.t/sigil-trailing";

const diagnose = (text: string) => {
  const { failures } = parseMemeText(URI, text);
  return failuresToDiagnostics(failures, text.length).filter((d) => d.code === CODE);
};

describe("a line opening on a sigil whose >> leaves text behind carries one warning", () => {
  test("★ RED: `<<~ x …>>;abc` raises sigil-trailing-text, keyed to the sigil's span ★", () => {
    const text = "<<~ x a=`ni:///x`>>;abc after the bare ni:.\n";
    const found = diagnose(text);
    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe("warning");
    expect(text.slice(found[0]!.from, found[0]!.to)).toBe("<<~ x a=`ni:///x`>>");
  });

  test("★ RED: the old foot — text after the ETX control sigil — raises it too ★", () => {
    const text = "prose\n<<^ code=`&#x0003;`>>ni:///sha-256;abc\n";
    expect(diagnose(text)).toHaveLength(1);
  });

  test("★ RED: a pranala with text after its >> raises it ★", () => {
    expect(diagnose("<<~ pranala from=`lar:///a.b.c` to=`lar:///d.e.f`>>tail\n")).toHaveLength(1);
  });

  test("★ RED: a trailing space counts, as stock reads `<<m>> ` ★", () => {
    expect(diagnose("<<~ x a=`b`>> \n")).toHaveLength(1);
  });

  test("★ CONTROL: a sigil alone on its line raises nothing ★", () => {
    expect(diagnose("<<~ x a=`b`>>\n")).toEqual([]);
    expect(diagnose("<<~ x a=`b`>>")).toEqual([]);
    expect(diagnose("<<~ x a=`b`>>\r\nprose\r\n")).toEqual([]);
  });

  test("★ CONTROL: the reshaped foot alone on its line raises nothing ★", () => {
    expect(diagnose("<<^ code=`&#x0003;` bcc=`ni:///sha-256;abc`>>\n")).toEqual([]);
  });

  test("★ CONTROL: a sigil that does not OPEN its line raises nothing — it was inline already ★", () => {
    expect(diagnose("prose <<~ x a=`b`>> more prose\n")).toEqual([]);
  });

  test("★ CONTROL: a fenced sigil teaches and raises nothing ★", () => {
    expect(diagnose("```\n<<~ x a=`b`>>;abc\n```\n")).toEqual([]);
  });

  test("★ CONTROL: a closer-bearing opener raises nothing — its body begins at that >> ★", () => {
    expect(diagnose("<<~ ahu slot=`#/a`>>body\n<<~/ahu>>\n")).toEqual([]);
  });
});

describe.skipIf(wikiSkip)(`the warning rides the wiki's parse-diagnostics channel${skipNote}`, () => {
  let engine: TW5Engine;
  beforeAll(async () => {
    engine = await bootTestWiki();
    engine.setTiddler({ title: "trailing", type: "text/memetic-wikitext+tiddlywiki", text: "<<~ x a=`b`>>;abc\n" });
    engine.setTiddler({ title: "lone",     type: "text/memetic-wikitext+tiddlywiki", text: "<<~ x a=`b`>>\n" });
  }, 60_000);

  test("★ RED: [parse-diagnostics:codes[]] names sigil-trailing-text, and the text still renders inline ★", () => {
    expect(engine.wiki.filterTiddlers("[[trailing]parse-diagnostics:codes[]]")).toContain(CODE);
    const html = engine.wiki.renderTiddler("text/html", "trailing");
    expect(html).toContain(";abc");
    expect(html).not.toContain("<dl");
  });

  test("★ CONTROL: a lone sigil's carrier does not name it ★", () => {
    expect(engine.wiki.filterTiddlers("[[lone]parse-diagnostics:codes[]]")).not.toContain(CODE);
  });
});
