/**
 * A PRANALA'S FAMILY AND ROLE READ IN EVERY SPELLING THE GRAPH WRITES.
 *
 * ── MEASURED ─────────────────────────────────────────────────────────────────────────────────────────────
 * Across the lares bags the attribute appears as `family=reference` (121), `family:reference` (34) and
 * `family="reference"` (4). A reader keyed on the quoted form alone recovers the fourth case and silently
 * hands back the default for the rest — an edge that declares its family reads as `relation`, and nothing
 * says so.
 *
 * TiddlyWiki accepts all three: `parseMacroParameterAsAttribute` takes `=` or `:` as the separator, then a
 * string literal or `reUnquotedAttribute`. The reader here answers to the same range.
 *
 * ── AND THE BEARING ENDS TAKE THE SAME LAW ───────────────────────────────────────────────────────
 * The corpus writes `from="?" -> to="lar:///d"`, because an unquoted `lar:///x` standing positionally
 * binds a phantom parameter and the slot stays empty (tw5-calls-colon-caveat). The RENDER-path rule
 * kept its own spelling of that capture and handed back `"\"lar:///d\""` — quote marks rendered into
 * the address a reader clicks. Both spellings must reach one value on every path.
 */

import { describe, test, expect } from "vitest";
import { buildMemeAst, collectEvents, edgesFromMemeAst } from "../src/meme-ast/index.js";

const URI = "lar:///a.b.c/doc";

function pranalaOf(sigil: string) {
  const src = sigil + "\n";
  return buildMemeAst(collectEvents(src), src, URI)[0] as any;
}

import { matchPranalaOpenAt } from "../src/wikirules/lar-sigil-shared.js";

describe("★ the RENDER path reads both spellings of the bearing ★", () => {
  const bare   = '<<~ pranala #x from=? -> to=lar:///d family=code role=has>>';
  const quoted = '<<~ pranala #x from="?" -> to="lar:///d" family="code" role="has">>';

  test("a quoted bearing hands back its interior, never the pair", () => {
    const m = matchPranalaOpenAt(quoted, 0)!;
    expect(m.from).toBe("?");
    expect(m.to).toBe("lar:///d");
  });

  test("and the bare spelling reaches the same value", () => {
    const m = matchPranalaOpenAt(bare, 0)!;
    expect(m.from).toBe("?");
    expect(m.to).toBe("lar:///d");
  });

  test("★ the trailing parameters follow the same law ★", () => {
    expect(matchPranalaOpenAt(quoted, 0)!.attrs).toEqual({ family: "code", role: "has" });
    expect(matchPranalaOpenAt(bare, 0)!.attrs).toEqual({ family: "code", role: "has" });
  });
});

describe("a pranala reads its family in every spelling", () => {
  test("quoted with an equals sign", () => {
    expect(pranalaOf('<<~ pranala #x from=? -> to=lar:///d family="reference">>').family).toBe("reference");
  });

  test("★ unquoted with an equals sign — the graph's commonest form ★", () => {
    expect(pranalaOf('<<~ pranala #x from=? -> to=lar:///d family=reference>>').family).toBe("reference");
  });

  test("the colon spelling still reads", () => {
    expect(pranalaOf('<<~ pranala #x from=? -> to=lar:///d family:reference>>').family).toBe("reference");
  });

  test("role reads the same way", () => {
    expect(pranalaOf('<<~ pranala #x from=? -> to=lar:///d family=relation role=precedes>>').role).toBe("precedes");
  });

  test("an absent family falls back to relation", () => {
    expect(pranalaOf('<<~ pranala #x from=? -> to=lar:///d>>').family).toBe("relation");
  });

  test("★ a scan that fails grades the sigil `missing` and loses its target — none of these may ★", () => {
    for (const src of [
      '<<~ pranala #x from=? -> to=lar:///d family=reference>>',
      '<<~ pranala #x from=? -> to=lar:///d family="reference" role="source">>',
      '<<~ pranala #x from=? -> to=lar:///d family:reference>>',
    ]) {
      const p = pranalaOf(src);
      expect(p.recoveredAs ?? null).toBe(null);
      expect(p.toRaw).not.toBe("");
    }
  });

  test("★ a named end resolves to the address, not to the parameter that carried it ★", () => {
    // `tok` recognizes a target by its `lar:///` prefix. A `to=` in front of it reaches neither branch,
    // so the edge points at a token no bag answers for.
    const src = '<<~ pranala #x from=? -> to=lar:///d.e.f/target family=reference>>\n';
    const ast = buildMemeAst(collectEvents(src), src, URI);
    const edges = edgesFromMemeAst(ast, URI);
    expect(edges.length).toBeGreaterThan(0);
    expect(edges.some((e: any) => String(e.to ?? e.toUri) === "lar:///d.e.f/target")).toBe(true);
  });
});
