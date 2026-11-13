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
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

const CODE = "sigil-trailing-text";
const MEMETIC = "text/memetic-wikitext+tiddlywiki";

// The floor rides its PUBLIC surface: the memetic parser's own `diagnostics` contract, read off the
// booted wiki's parse (the door core's `[parse-diagnostics[]]` reads), never the compile layer's source.
type Diagnostic = { from: number; to: number; severity: string; code?: string };
let engine: TW5Engine;
beforeAll(async () => { if (!wikiSkip) engine = await bootTestWiki(); }, 60_000);
const diagnose = (text: string): Diagnostic[] =>
  (((engine.wiki as any).parseText(MEMETIC, text).diagnostics ?? []) as Diagnostic[]).filter((d) => d.code === CODE);

describe.skipIf(wikiSkip)(`★ a BLOCK-ONLY head with text after its >> carries one warning ★${skipNote}`, () => {
  // The block-only set comes from the sigil tiddlers (`lar-flow: block`), never a list in the reader:
  // the frame marks (SOH · STX · ETX · EOT) and the child-slot opener and closer (ahu, with its fragment mirror).
  test("★ RED: an ahu opener with prose after its >> warns, keyed to the opener's span ★", () => {
    const text = "<<~ ahu slot=`#/a`>> prose after the opener\nbody\n<<~/ahu>>\n";
    const found = diagnose(text);
    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe("warning");
    expect(text.slice(found[0]!.from, found[0]!.to)).toBe("<<~ ahu slot=`#/a`>>");
  });

  test("★ RED: an ahu closer with prose after its >> warns ★", () => {
    expect(diagnose("<<~ ahu slot=`#/a`>>\nbody\n<<~/ahu>> trailing prose\n")).toHaveLength(1);
  });

  test("★ RED: the old foot — text after the ETX mark — warns ★", () => {
    expect(diagnose("prose\n<<^ code=`&#x0003;`>>ni:///sha-256;abc\n")).toHaveLength(1);
  });

  test("★ RED: text after the STX mark warns, and a trailing space counts, as stock reads `<<m>> ` ★", () => {
    expect(diagnose("<<^ code=`&#x0002;`>>text\n")).toHaveLength(1);
    expect(diagnose("<<^ code=`&#x0003;`>> \n")).toHaveLength(1);
  });
});

describe.skipIf(wikiSkip)(`★ an INLINE head with text after its >> reads inline in its paragraph, and draws no warning ★${skipNote}`, () => {
  test("★ RED: a loulou line with prose reads inline, no warning ★", () => {
    expect(diagnose("<<~ loulou uri=`lar:///ha.ka.ba/lares/api/pono/aka`>> — the frozen inline.\n")).toEqual([]);
  });

  test("★ RED: a saksi citation, a pranala with a tail, and an unknown head draw none ★", () => {
    expect(diagnose("<<~ saksi uri=`lar:///a.b.c`>> witnessed it.\n")).toEqual([]);
    expect(diagnose("<<~ pranala from=`lar:///a.b.c` to=`lar:///d.e.f`>>tail\n")).toEqual([]);
    expect(diagnose("<<~ x a=`ni:///x`>>;abc after the bare ni:.\n")).toEqual([]);
  });
});

describe.skipIf(wikiSkip)(`★ CONTROLS ★${skipNote}`, () => {
  test("a block-only mark alone on its line raises nothing", () => {
    expect(diagnose("<<^ code=`&#x0003;` bcc=`ni:///sha-256;abc`>>\n")).toEqual([]);
    expect(diagnose("<<^ code=`&#x0002;`>>\r\nprose\r\n")).toEqual([]);
    expect(diagnose("<<~ ahu slot=`#/a`>>\nbody\n<<~/ahu>>\n")).toEqual([]);
  });

  test("a sigil that does not OPEN its line raises nothing — it was inline already", () => {
    expect(diagnose("prose <<^ code=`&#x0002;`>> more prose\n")).toEqual([]);
  });

  test("a fenced block-only mark teaches and raises nothing", () => {
    expect(diagnose("````\n<<^ code=`&#x0003;`>>ni:///sha-256;abc\n````\n")).toEqual([]);
  });
});

describe.skipIf(wikiSkip)(`the warning rides the wiki's parse-diagnostics channel${skipNote}`, () => {
  beforeAll(() => {
    engine.setTiddler({ title: "trailing", type: "text/memetic-wikitext+tiddlywiki", text: "<<~ ahu slot=`#/a`>>;abc\nbody\n<<~/ahu>>\n" });
    engine.setTiddler({ title: "lone",     type: "text/memetic-wikitext+tiddlywiki", text: "<<~ loulou uri=`lar:///a.b.c`>> rides inline.\n" });
  });

  test("★ RED: [parse-diagnostics:codes[]] names sigil-trailing-text, and the text still renders inline ★", () => {
    expect(engine.wiki.filterTiddlers("[[trailing]parse-diagnostics:codes[]]")).toContain(CODE);
    // Every byte kept: the slot decomposes into its child, and `;abc` rides there as the body's first line.
    // The carrier itself holds `;abc`, so it stands aside: the bytes must ride in a DERIVED record.
    expect(engine.wiki.filterTiddlers("[all[tiddlers]!title[trailing]search:text:literal[;abc]]").length).toBeGreaterThan(0);
  });

  test("★ RED: an inline head's carrier does not name it ★", () => {
    expect(engine.wiki.filterTiddlers("[[lone]parse-diagnostics:codes[]]")).not.toContain(CODE);
  });
});
