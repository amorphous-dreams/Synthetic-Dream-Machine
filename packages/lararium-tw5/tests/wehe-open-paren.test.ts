// vm-grammar-boundary: exempt — the missing RED control for lar:///sigil.wehe.pairs
// (10d14e51a): whether the tiddler-derived scanner PAIRS open/close on the corpus's own
// `name(params)` invocation form. The grammar-table snapshot (--check / plugin-artifact-parity)
// asserts the TABLE's shape; only a scan+build-layer test can catch an orphan-close the render
// path would only ever report as "different HTML," never as which closer went unmatched. It
// drives grammar-table.generated.ts — itself derived from the tiddlers, never a hand-typed
// fixture — so it blesses no grammar as canonical; it holds the derived scan+build layer to the
// corpus.
/**
 * WEHE/HELU/PROCEDURE/DEFINE — the `name(params)` open-pattern pairs (lar:///sigil.wehe.pairs).
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────────────────────────
 * `sigil-wehe.tid` (and `sigil-helu.tid`, and wehe's own mirrors `sigil-procedure.tid` /
 * `sigil-define.tid`) declared an open-pattern that required WHITESPACE before any tail
 * (`\s+([^>]*?)`), so a canon invocation shaped as `<<~ wehe greet(name:"world")>>` — the parenthesis
 * riding directly against the name, exactly as api/pono/wehe.mem:69 and api/pono/helu.mem:51 write it
 * — never matched. The open regex fell through, the generic catch-all graded the opener a `missing`
 * leaf instead, and the block's OWN `<<~/wehe>>` closer then landed with no frame to close: an
 * `orphan-close` Error node, on a form the corpus authors as canonical.
 *
 * `packages/lararium-tw5/src/meme-ast/grammar-table.generated.ts` is DERIVED from the tiddlers
 * (`tsx scripts/build-grammar-table.ts`), so this test drives the real tiddler-authored grammar — not
 * a hand-typed fixture that could quietly re-diverge from `sigil-wehe.tid` the way the table itself
 * would catch (`--check`) but a scanner-BEHAVIOR test would not.
 *
 * ── THE EXEMPTION ────────────────────────────────────────────────────────────────────────────────
 * This is the missing RED control for lar:///sigil.wehe.pairs (10d14e51a): the grammar-table snapshot
 * (plugin-artifact-parity / build-grammar-table --check) asserts the TABLE's shape, never that the
 * SCANNER actually pairs open/close on the corpus's own invocation form. That question lives at the
 * scan+build layer alone — the render path could only tell you the final HTML differed, never that a
 * specific closer orphaned — so, like `hana-body-opacity.test.ts` just above it in
 * vm-grammar-boundary.test.ts's exemption list, this test has no other surface. It blesses no grammar
 * as canonical; it holds the derived-from-tiddlers scan+build layer to the corpus's own attested call
 * shape.
 */
import { describe, test, expect } from "vitest";
import { collectEvents, buildMemeAst } from "../src/meme-ast/index.js";
import { GENERATED_SIGILS, GENERATED_FAMILIES } from "../src/meme-ast/grammar-table.generated.js";
import type { GrammarRules } from "../src/meme-ast/types.js";

const GRAMMAR: GrammarRules = { sigils: GENERATED_SIGILS, families: GENERATED_FAMILIES };
const URI = "lar:///test.wehe.pairs";

function hasErrorNode(src: string): boolean {
  const events = collectEvents(src, GRAMMAR);
  const nodes = buildMemeAst(events, URI, GRAMMAR, src);
  return nodes.some((n) => n.kind === "Error");
}

function pairs(sigilName: string, src: string): { opens: number; closes: number } {
  const events = collectEvents(src, GRAMMAR);
  return {
    opens: events.filter((e) => e.sigilName === sigilName && e.eventType === "open").length,
    closes: events.filter((e) => e.sigilName === sigilName && e.eventType === "close").length,
  };
}

describe("wehe/helu/procedure/define — name(params) pairs open/close, no orphan-close", () => {
  test("wehe — the corpus's own form (api/pono/wehe.mem:69)", () => {
    const src = '<<~ wehe greet(name:"world")>>Hello <<name>>!<<~/wehe>>';
    expect(pairs("wehe", src)).toEqual({ opens: 1, closes: 1 });
    expect(hasErrorNode(src), "an orphan-close Error node stood where wehe should have paired").toBe(false);
  });

  test("helu — the corpus's own form (api/pono/helu.mem:51)", () => {
    const src = '<<~ helu functionName(param:"default")>>\n  [filter-expression-using-param]\n<<~/helu>>';
    expect(pairs("helu", src)).toEqual({ opens: 1, closes: 1 });
    expect(hasErrorNode(src)).toBe(false);
  });

  test("procedure — wehe's English mirror, same paren shape (alias-erased to `wehe`)", () => {
    // canonicalName erasure (scanner.ts collectEvents): an alias sigil's events emit its CANONICAL
    // name, never its own — so a paired procedure/define reads as a paired "wehe" event, not
    // "procedure"/"define".
    const src = '<<~ procedure greet(name:"world")>>Hello<<~/procedure>>';
    expect(pairs("wehe", src)).toEqual({ opens: 1, closes: 1 });
    expect(hasErrorNode(src)).toBe(false);
  });

  test("define — wehe's other English mirror, same paren shape (alias-erased to `wehe`)", () => {
    const src = '<<~ define greet(name:"world")>>Hello<<~/define>>';
    expect(pairs("wehe", src)).toEqual({ opens: 1, closes: 1 });
    expect(hasErrorNode(src)).toBe(false);
  });

  test("CONTROL — the space-tail form (no parens) still pairs, unbroken by the fix", () => {
    const src = '<<~ wehe greet name:"world">>Hello<<~/wehe>>';
    expect(pairs("wehe", src)).toEqual({ opens: 1, closes: 1 });
    expect(hasErrorNode(src)).toBe(false);
  });
});
