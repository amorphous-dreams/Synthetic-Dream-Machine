/**
 * A NAMED PARAMETER CARRIES AN EQUALS SIGN.
 *
 * ── THE STANDARD ─────────────────────────────────────────────────────────────────────────────────────────
 * TiddlyWiki accepts two separators in a macro parameter (`parseMacroParameterAsAttribute`): `=` and `:`.
 * Only `=` admits a filtered, indirect or macro value, so the memetic standard writes `key=value` and the
 * colon spelling stays legal beside it. A stock TiddlyWiki reads either, which keeps the superset law intact
 * whichever one a carrier holds.
 *
 * ── WHAT MUST NOT MOVE ───────────────────────────────────────────────────────────────────────────────────
 * A DEFINITION still requires the colon. `\procedure greet(name:"world")` spells TiddlyWiki's own parameter
 * list, which refuses `=`, so rewriting a definition breaks the carrier it meant to canonicalize. The
 * definition registers cover the TW5 pragmas and their sigil spellings — wehe, kumu, helu.
 *
 * A SCHEME COLON separates no parameter either. `lar:`, `ni:`, `https:` all pass the strict-identifier test that
 * guards TiddlyWiki's colon, so a rewrite keyed on the identifier alone would eat every address in the graph.
 * The colon separates a parameter only where a QUOTED value follows it — the one shape this moves.
 *
 * ── GRAMMAR AUTHORITY, NOT FRAME ─────────────────────────────────────────────────────────────────────────
 * This clause rewrites AUTHORED bytes — a hand's spelling choice, not the house's envelope — so it applies
 * only with `{ grammar: true }` (the split doctrine: `lares-cli/src/commands/meme.ts` — `--grammar`).
 * These tests drive the clause directly, so they opt in explicitly; a caller who does NOT opt in gets the
 * PROPOSAL alone (`grammarNotes`), covered by `packages/lares-cli/tests/normalize-restamps.test.ts`.
 */

import { describe, test, expect } from "vitest";
import { normalizeMemeSource } from "../src/meme-normalize.js";
import { GENERATED_ALIAS_MAP } from "../src/meme-ast/grammar-table.generated.js";

const norm = (s: string) => normalizeMemeSource(s, { grammar: true }).text;

describe("a named parameter is written key=value", () => {
  test("a call's colon parameter takes the equals sign", () => {
    expect(norm('<<~ kau greet(name:"world")>>')).toBe('<<~ kau greet(name="world")>>');
  });

  test("an invoke's parameter moves too", () => {
    expect(norm('<<~ kahea greeting(name:"Operator")>>')).toBe('<<~ kahea greeting(name="Operator")>>');
  });

  test("a plain macro call moves", () => {
    expect(norm('<<greet name:"world">>')).toBe('<<greet name="world">>');
  });

  test("every quoting form moves", () => {
    expect(norm(`<<~ kau t(a:"x" b:'y' c:[[z]])>>`)).toBe(`<<~ kau t(a="x" b='y' c=[[z]])>>`);
  });

  test("a value carrying its own colon survives intact", () => {
    expect(norm('<<~ kau t(confidence:"P:14")>>')).toBe('<<~ kau t(confidence="P:14")>>');
  });

  test("★ a procedure DEFINITION keeps its colon — equals is not valid there ★", () => {
    for (const src of [
      '<<~ \\procedure greet(name:"world")>>',
      '<<~ \\function myFilter(param:"")>>',
      '<<~ \\widget ~mysigil(uri:"" p1:"")>>',
      '<<~ wehe name(param1:"default" param2:"")>>',
      '<<~ helu functionName(param:"default")>>',
      '<<~ kumu thing(param:"default")>>',
    ]) {
      expect(norm(src)).toBe(src);
    }
  });

  test("★ a scheme colon is never a separator ★", () => {
    for (const src of [
      '<<~ loulou lar:///ha.ka.ba/lares/api/pono/meme>>',
      '<<~ aka lar:///ha.ka.ba/turn?confidence=P:14#/normative-language>>',
      '<<~ kau t(u:"ni:///sha-256;abc")>>'.replace('u:', 'u='),
      'A line naming ni:///sha-256;abc and https://example.com in prose.',
    ]) {
      expect(norm(src)).toBe(src);
    }
  });

  test("★ a colon with no quoted value after it stays put ★", () => {
    // `$:/core` and a bare `key:value` both fail the quoted-value test, and TiddlyWiki reads neither as a
    // parameter the memetic standard owns. Moving them would rewrite content, not spelling.
    expect(norm('<<~ kau t(f:[tag[Done]])>>')).toBe('<<~ kau t(f:[tag[Done]])>>');
    expect(norm('<<~ kau t($:/core)>>')).toBe('<<~ kau t($:/core)>>');
  });

  test("★ a sigil never reaches across a line, so prose between two sigils is not a parameter list ★", () => {
    // MEASURED on the graph: a pattern that let `<<` … `>>` span lines matched from one sigil to a later
    // one and rewrote everything between. `''Status:''` spells BOLD WIKITEXT — the colon reads as punctuation
    // and the quotes as emphasis markers — and eight files on this graph moved that way.
    const src = [
      'A line mentioning << in prose.',
      "",
      "''Status:'' design sharpened, blocked on the graph.",
      "",
      '<<~ kapu qualifier=public>>',
    ].join("\n");
    expect(norm(src)).toBe(src);
  });

  test("two sigils on one line each keep their own bounds", () => {
    expect(norm('<<~ kau a(x:"1")>> and <<~ kau b(y:"2")>>'))
      .toBe('<<~ kau a(x="1")>> and <<~ kau b(y="2")>>');
  });

  test("the transform reports itself and runs once", () => {
    const r = normalizeMemeSource('<<~ kau greet(name:"world")>>', { grammar: true });
    expect(r.changed).toBe(true);
    // GRAMMAR-authority notes land in `grammarNotes`, not `notes` — the split the house rules on:
    // `notes` names what the envelope fixed unasked; `grammarNotes` names an authored spelling moved
    // only because `--grammar`/`{ grammar: true }` asked for it.
    expect(r.grammarNotes.join(" ")).toMatch(/param|separator|equals/i);
    expect(normalizeMemeSource(r.text, { grammar: true }).text).toBe(r.text);
  });
});

/**
 * THE DEFINITION REGISTERS ARE THE SHELF'S, NOT A HAND LIST. Every sigil the shelf kinds `pragma` or
 * `pragma-alias` opens a DEFINITION — `<<~ procedure greet(name:"world")>>` spells TiddlyWiki's own
 * parameter list — and the separator law reads the shelf's set, so an unslashed mirror (`procedure`,
 * `function`, `widget`, `define`, `typos`, `type`) keeps its colon exactly as `\procedure` does.
 * MEASURED on six carriers before this witness: `meme normalize` rewrote `<<~ function myFilter(param:"")>>`
 * to `param=""`, and the sweep held them at HEAD.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SHELF = fileURLToPath(new URL("../tiddlers/", import.meta.url));

/** The head word of every declaring sigil the shelf holds, read from its own open pattern. */
function shelfDefinitionHeads(): string[] {
  return readdirSync(SHELF)
    .filter((f) => f.startsWith("sigil-") && f.endsWith(".tid"))
    .map((f) => readFileSync(SHELF + f, "utf8"))
    .filter((t) => /^lar-kind: pragma(-alias)?$/m.test(t))
    // The engine reads both spellings of the pattern field (`grammar-heads`), so the witness does too.
    // `!?` optional-pragma prefix (lar:///sigil.grammar.lane) rides ahead of `\s*`
    // on some heads now (`<<~!?\s*wehe`) — tolerated here the same way the engine's own reader does.
    .map((t) => /^lar-(?:open-)?pattern: <<~(?:!\?)?\\s\*([A-Za-z_-]+)/m.exec(t)?.[1] ?? "")
    .filter(Boolean)
    .sort();
}

describe("★ a DEFINITION under any shelf spelling keeps its colon ★", () => {
  test("the shelf declares its definition heads (the set this witness reads is non-empty and holds the mirrors)", () => {
    const heads = shelfDefinitionHeads();
    expect(heads).toEqual(expect.arrayContaining(["procedure", "function", "widget", "define", "wehe", "helu", "kumu"]));
  });

  test("★ every shelf definition head keeps `param:\"default\"` byte-identical ★", () => {
    // Every READ-ONLY mirror among the definition heads (`define`/`procedure`→wehe,
    // `let`/`var`/`const`→waiho) is a RULED FRAME-authority fold: unconditional, so its OWN
    // colon-preservation check compares against the folded
    // spelling, never its own head word. `GENERATED_ALIAS_MAP` names the fold target; every
    // non-mirror head (function/widget/type/typos and the canonicals themselves) still holds
    // fully byte-identical.
    for (const head of shelfDefinitionHeads()) {
      const src = `<<~ ${head} thing(param:"default" other:"")>>body<<~/${head}>>`;
      const canonical = GENERATED_ALIAS_MAP[head];
      const expected = canonical
        ? `<<~ ${canonical} thing(param:"default" other:"")>>body<<~/${canonical}>>`
        : src;
      expect(norm(src), head).toBe(expected);
    }
  });

  test("CONTROL: a call-side `param:value` still takes the equals sign; a call-side positional still quotes", () => {
    expect(norm('<<~ kahea greeting(name:"Operator")>>')).toBe('<<~ kahea greeting(name="Operator")>>');
    expect(norm('<<~ procedure-call x(a:"1")>>')).toBe('<<~ procedure-call x(a="1")>>');
    const positional = normalizeMemeSource('<<~ loulou lar:///ha.ka.ba/x>>', { grammar: true }).text;
    expect(positional).toMatch(/<<~ loulou "lar:\/\/\/ha\.ka\.ba\/x">>|<<~ loulou lar:\/\/\/ha\.ka\.ba\/x>>/);
  });

  test("★ a call SHOWN inside a code span or a fence declares nothing and never moves ★", () => {
    const table = '|`say-hi(name)` |`<<say-hi name:"Bugs" address:"Rabbit Hole Hill">>` |`Hi Bugs.` |';
    expect(norm(table)).toBe(table);
    const fence = '```\n<<greet name:"world">>\n```\n';
    expect(norm(fence)).toBe(fence);
    // CONTROL: the same call outside the span moves.
    expect(norm('<<say-hi name:"Bugs">>')).toBe('<<say-hi name="Bugs">>');
  });
});
