/**
 * PRAGMA `!` — graceful read, canonical write (lar:///sigil.grammar.lane loop 2 item 3, loop 3 item 3).
 *
 * `memetic-wikitext.mem`'s prefix table (~148, ~658) and a worked example (~617) illustrate
 * `<<~!` as the "pragma (definition)" register, with `wehe`/`helu` shown under it.
 *
 * ── LOOP 2's FALSE ALARM, MEASURED AGAIN CAREFULLY (loop 3) ─────────────────────────────────────
 * Loop 2 widened `wehe`/`kumu`/`helu`/`widget`'s OPEN pattern to `<<~!?\s*NAME` and reported that
 * the identical edit broke `src/wikirules/lar-sigil.ts`'s live rendering of even the BARE form
 * (`block-closers.test.ts` went to WATER) — and reverted it. Re-measured this loop with a cleanly
 * rebuilt plugin bundle: the OPEN-pattern widening (close pattern stays bare — no canon example ever
 * bangs a closer, and widening it breaks `closePatternToTag`'s literal-tag reduction for no attested
 * gain) renders BOTH spellings correctly for all four. `src/wikirules/lar-sigil.ts`'s
 * `COMPOUND_OPEN_RE` and the closer-lookup machinery (`buildClosers`/`findCloseEnd`/
 * `grammarHeadsOf`) never read a sigil's own `lar-open-pattern` string at all — they dispatch on the
 * MATCHED NAME alone, so widening a tiddler's declared pattern (a scan+build-layer artifact) cannot
 * touch what the render layer recognizes. No `lar-sigil.ts` change was needed; loop 2's finding was
 * a stale-build artifact, not a real conflict.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { collectEvents, buildMemeAst } from "../src/meme-ast/index.js";
import { GENERATED_SIGILS, GENERATED_FAMILIES } from "../src/meme-ast/grammar-table.generated.js";
import type { GrammarRules } from "../src/meme-ast/types.js";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";

const GRAMMAR: GrammarRules = { sigils: GENERATED_SIGILS, families: GENERATED_FAMILIES };
const URI = "lar:///test.pragma.bang";

function hasErrorNode(src: string): boolean {
  const events = collectEvents(src, GRAMMAR);
  const nodes = buildMemeAst(events, URI, GRAMMAR, src);
  return nodes.some((n) => n.kind === "Error");
}

describe("pragma-kind sigils accept an optional `!` — both spellings PAIR (scan+build layer)", () => {
  test.each([
    ["wehe",   '<<~%s wehe greet(name:"world")>>Hello<<~/wehe>>'],
    ["kumu",   '<<~%s kumu TypeName(params)>>body<<~/kumu>>'],
    ["helu",   '<<~%s helu tally(x)>>[<x>count[]]<<~/helu>>'],
    ["widget", '<<~%s widget ~mana(uri:"")>>body<<~/widget>>'],
  ])("%s — bare and `!` both pair, no Error node", (_name, template) => {
    const bare = template.replace("%s", "");
    const bang = template.replace("%s", "!");
    expect(hasErrorNode(bare), `bare: ${bare}`).toBe(false);
    expect(hasErrorNode(bang), `bang: ${bang}`).toBe(false);
  });

  test("canon's own worked example (memetic-wikitext.mem:617) pairs", () => {
    const src = '<<~! wehe greeting(name "World")>>Hello, <<~ kahea name>>!<<~/wehe>>';
    expect(hasErrorNode(src)).toBe(false);
  });

  test("waiho's bare block form still pairs (open/close, unaffected by the pragma-pattern addition)", () => {
    const src = '<<~ waiho name "value">>body<<~/waiho>>';
    expect(hasErrorNode(src)).toBe(false);
  });

  test("waiho's `!` form fires as a standalone PRAGMA event — no closer expected, never an Error", () => {
    const src = '<<~! waiho name = value>>\nrest of carrier\n';
    const events = collectEvents(src, GRAMMAR);
    const pragma = events.find((e) => e.sigilName === "waiho" && e.eventType === "pragma");
    expect(pragma, "the carrier-scoped waiho form never fired as a pragma event").toBeTruthy();
    expect(hasErrorNode(src)).toBe(false);
  });

  test("const's `!` form erases to waiho and fires as a standalone PRAGMA event", () => {
    const src = '<<~! const name = value>>\n';
    const events = collectEvents(src, GRAMMAR);
    const pragma = events.find((e) => e.sigilName === "waiho" && e.eventType === "pragma");
    expect(pragma, "const's carrier-scoped form never fired as a pragma event").toBeTruthy();
  });
});

describe.skipIf(wikiSkip)(`pragma-kind sigils' both spellings RENDER, live${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki(); }, 60_000);

  test.each(["wehe", "kumu", "helu", "widget"])(
    "%s — bare and `!` both dispatch (neither goes to water, neither leaves a literal closer)", (name) => {
      for (const bang of ["", "!"]) {
        const html = renderWikitext(e, `<<~${bang} ${name} x>>\nbody\n<<~/${name}>>`);
        expect(html, `<<~${bang} ${name} …>> rendered as WATER`).not.toMatch(/lar-sigil-water/);
        expect(html, `<<~${bang} ${name} …>> left its closer on the page`).not.toContain(`/${name}&gt;&gt;`);
      }
    });
});
