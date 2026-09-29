/**
 * PRAGMA `!` — graceful read, canonical write (lar:///sigil.grammar.lane loop 2, item 3).
 *
 * `memetic-wikitext.mem`'s prefix table (~148, ~658) and a worked example (~617) illustrate
 * `<<~!` as the "pragma (definition)" register, with `wehe`/`helu` shown under it — but the
 * scanner only ever bound `!` for `waiho`/`const`/`widget`.
 *
 * ── SCOPED DOWN, AND WHY ─────────────────────────────────────────────────────────────────────────
 * `waiho`/`const` carry a genuinely DIFFERENT posture under `!` (api/pono/waiho.mem #/law:
 * carrier-scoped, hoisted, NO closer) that was already scanner.ts's own hand-written behavior
 * pre-cutover — this loop moves it onto the tiddler as a new `lar-pragma-pattern` field
 * (`eventType: "pragma"`), additive beside their unchanged block open/close, so it touches nothing
 * the LIVE-WIKI render dispatch (`src/wikirules/lar-sigil.ts`, a file outside this loop's lane)
 * reads for the open/close shape it already renders.
 *
 * `wehe`/`kumu`/`helu`/`widget` do NOT get the same treatment this loop, despite canon's worked
 * example — MEASURED: widening their `lar-open-pattern` to `<<~!?\s*NAME` pairs correctly at the
 * meme-ast scan+build layer (RED→GREEN below, `hasErrorNode` false for `<<~! wehe …>>…<<~/wehe>>`),
 * but the SAME edit makes `src/wikirules/lar-sigil.ts`'s live-wiki dispatcher stop recognizing even
 * the BARE `<<~ wehe …>>` form — `block-closers.test.ts`'s "its body is captured" vectors went to
 * WATER for wehe/kumu/widget. That file is a sibling's lane (not reassigned this loop), and shipping
 * scan-layer-only `!` tolerance would make node-side parsing accept a form the live wiki cannot
 * render — a worse split than today's "neither accepts it." Reverted; reported for the parent to
 * route to whoever owns `lar-sigil.ts` next.
 */
import { describe, test, expect } from "vitest";
import { collectEvents, buildMemeAst } from "../src/meme-ast/index.js";
import { GENERATED_SIGILS, GENERATED_FAMILIES } from "../src/meme-ast/grammar-table.generated.js";
import type { GrammarRules } from "../src/meme-ast/types.js";

const GRAMMAR: GrammarRules = { sigils: GENERATED_SIGILS, families: GENERATED_FAMILIES };
const URI = "lar:///test.pragma.bang";

function hasErrorNode(src: string): boolean {
  const events = collectEvents(src, GRAMMAR);
  const nodes = buildMemeAst(events, URI, GRAMMAR, src);
  return nodes.some((n) => n.kind === "Error");
}

describe("waiho/const's carrier-scoped `!` form — a standalone pragma event, no closer expected", () => {
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

describe("CONTROL — wehe/kumu/helu/widget stay bare-only this loop (reverted, see file header)", () => {
  test.each(["wehe", "kumu", "helu", "widget"])("%s's open pattern refuses a `!` prefix", (name) => {
    const rule = GENERATED_SIGILS.find((s) => s.name === name);
    expect(rule?.openPattern?.startsWith("<<~\\s*"), `${name}'s openPattern: ${rule?.openPattern}`).toBe(true);
  });
});
