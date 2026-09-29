/**
 * PRAGMA `!` — graceful read, canonical write.
 *
 * `memetic-wikitext.mem`'s prefix table (~148, ~658) and a worked example (~617) illustrate
 * `<<~!` as the "pragma (definition)" register, with `wehe`/`helu` shown under it. Every
 * pragma-kind sigil (`wehe`/`kumu`/`helu`/`widget`) accepts an OPTIONAL `!` on its OPEN pattern —
 * both spellings pair (scan+build layer) and render identically (live wiki). The CLOSE pattern
 * stays bare (`<<~/wehe>>`, never `<<~!/wehe>>`): no canon example ever bangs a closer, and
 * widening it breaks `closePatternToTag`'s literal-tag reduction for no attested gain. A
 * non-pragma-kind sigil (`huli`) stays scoped out — `!` reaches only what this rule names.
 *
 * `waiho`/`const` carry a genuinely DIFFERENT posture under `!` (api/pono/waiho.mem #/law:
 * carrier-scoped, hoisted, NO closer) — their own `lar-pragma-pattern` field fires a standalone
 * PRAGMA event, additive beside their unchanged block open/close.
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

/**
 * The compound-sigil transclude node (`$variable="~<head>"`) the render rule builds for exactly
 * that head, or undefined. `src`/`__verbatim__` carry the raw matched text — naturally differing by
 * the bang character itself — so callers comparing bare vs. `!` read the FUNCTIONAL attrs alone.
 */
function compoundTransclude(engine: TW5Engine, head: string, wikitext: string): Record<string, unknown> | undefined {
  const title = "lar:///test/pragma-bang-probe";
  engine.setTiddler({ title, type: "text/vnd.tiddlywiki", text: wikitext });
  const tree = engine.wiki.parseTiddler(title)!.tree as unknown as Array<{
    type: string;
    attributes?: Record<string, { value?: string; type?: string }>;
  }>;
  const node = tree.find((n) => n.type === "transclude" && n.attributes?.["$variable"]?.value === `~${head}`);
  if (!node) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node.attributes ?? {})) {
    if (k === "src" || k === "__verbatim__") continue;
    out[k] = v?.value;
  }
  return out;
}

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

  test.each(["wehe", "kumu", "helu", "widget"])(
    "%s — POSITIVE: `!` builds the SAME compound-sigil transclude node the bare form builds", (name) => {
      const src = (bang: string) => `<<~${bang} ${name} x>>\nbody\n<<~/${name}>>`;
      const bareNode = compoundTransclude(e, name, src(""));
      const bangNode = compoundTransclude(e, name, src("!"));
      expect(bareNode, `<<~ ${name} …>> built no compound transclude node at all`).toBeTruthy();
      expect(bangNode, `<<~! ${name} …>> built no compound transclude node — fell to a different dispatch`).toBeTruthy();
      expect(bangNode, `<<~! ${name} …>> captured different attrs (p1, __body__) than the bare form`).toEqual(bareNode);
    });

  test("CONTROL — a NON-pragma-kind sigil refuses `!`: `huli` builds no compound node at all", () => {
    const bareNode = compoundTransclude(e, "huli", '<<~ huli "[tag[x]]" as item>>\nbody\n<<~/huli>>');
    const bangNode = compoundTransclude(e, "huli", '<<~! huli "[tag[x]]" as item>>\nbody\n<<~/huli>>');
    expect(bareNode, "the bare CONTROL itself lost its huli dispatch").toBeTruthy();
    expect(bangNode, "`!` reached a sigil this loop never widened — huli is not pragma-kind").toBeUndefined();
  });
});
