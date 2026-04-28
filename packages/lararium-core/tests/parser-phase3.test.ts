/**
 * Phase 3 parser tests — parseMemeCarrier() and edgesFromAst()
 *
 * Tests:
 *  1. parseMemeCarrier → MemeAstNode[] structural correctness
 *  2. edgesFromAst → PranaEdge[] parity with parsePranalaEdges (regression)
 *  3. Inline alias erasure — \if / \for / \const produce canonical SigilNode
 *  4. DynamicNode for grammar-meme-registered unknown sigils
 *  5. kau pragma vs block scope
 *  6. SigilNode attrs bag (wai filter, huli binding)
 */

import { describe, test, expect } from "@jest/globals";
import { parseMemeCarrier, collectEvents, edgesFromAst } from "../src/parser.js";
import { parsePranalaEdges } from "../src/pranala-parser.js";
import type { SigilNode, WorksiteNode, EdgeSugarNode, DynamicNode } from "../src/ast.js";

const BASE = "lar:///test/carrier";

// ---------------------------------------------------------------------------
// 1. Basic tree structure
// ---------------------------------------------------------------------------

describe("parseMemeCarrier — tree structure", () => {
  test("empty text returns empty array", () => {
    expect(parseMemeCarrier(BASE, "")).toEqual([]);
  });

  test("single ahu → WorksiteNode with uri", () => {
    const ast = parseMemeCarrier(BASE, `<<~ ahu #section >>\n<<~/ahu >>`);
    const ws = ast.find((n) => n.kind === "Worksite") as WorksiteNode | undefined;
    expect(ws?.uri).toBe(`${BASE}#section`);
    expect(ws?.slot).toBe("#section");
  });

  test("pranala inline → EdgeNode", () => {
    const ast = parseMemeCarrier(BASE, `<<~ pranala ? -> lar:///other family:control role:owns >>`);
    const e = ast.find((n) => n.kind === "Edge");
    expect(e).toBeDefined();
    expect((e as {family: string}).family).toBe("control");
    expect((e as {role: string}).role).toBe("owns");
  });

  test("loulou → EdgeSugarNode sigil=loulou family=relation", () => {
    const ast = parseMemeCarrier(BASE, `<<~ loulou lar:///other >>`);
    const s = ast.find((n) => n.kind === "EdgeSugar") as EdgeSugarNode | undefined;
    expect(s?.sigil).toBe("loulou");
    expect(s?.family).toBe("relation");
  });

  test("papalohe → EdgeSugarNode with trigger and fn", () => {
    const ast = parseMemeCarrier(BASE, `<<~ papalohe lar:///a -> lar:///b trigger:OnBegin fn:ShowScore >>`);
    const s = ast.find((n) => n.kind === "EdgeSugar") as EdgeSugarNode | undefined;
    expect(s?.sigil).toBe("papalohe");
    expect(s?.trigger).toBe("OnBegin");
    expect(s?.fn).toBe("ShowScore");
  });

  test("nested ahu — inner ahu is in outer body", () => {
    const ast = parseMemeCarrier(BASE, `
<<~ ahu #outer >>
  <<~ ahu #inner >>
  <<~/ahu >>
<<~/ahu >>`);
    const outer = ast.find((n) => n.kind === "Worksite") as WorksiteNode | undefined;
    expect(outer?.slot).toBe("#outer");
    const inner = outer?.body.find((n) => n.kind === "Worksite") as WorksiteNode | undefined;
    expect(inner?.slot).toBe("#inner");
  });

  test("wai → SigilNode with filter attr", () => {
    const ast = parseMemeCarrier(BASE, `<<~ wai [tag[x]] >>\n<<~/wai >>`);
    const s = ast.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(s?.sigilName).toBe("wai");
    expect(s?.attrs["filter"]).toBe("[tag[x]]");
  });

  test("huli → SigilNode with filter and binding attrs", () => {
    const ast = parseMemeCarrier(BASE, `<<~ huli [all[memes]] as item >>\n<<~/huli >>`);
    const s = ast.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(s?.sigilName).toBe("huli");
    expect(s?.attrs["filter"]).toBe("[all[memes]]");
    expect(s?.attrs["binding"]).toBe("item");
  });
});

// ---------------------------------------------------------------------------
// 2. edgesFromAst parity with parsePranalaEdges
// ---------------------------------------------------------------------------

describe("edgesFromAst — parity with parsePranalaEdges", () => {
  const carriers = [
    `<<~ ahu #a >>\n<<~ pranala ? -> lar:///b family:control role:owns >>\n<<~/ahu >>`,
    `<<~ ahu #x >>\n<<~ loulou lar:///y >>\n<<~/ahu >>`,
    `<<~ aka lar:///shadow >>`,
    `<<~ ahu #c >>\n<<~ pono ? -> lar:///d role:invariant >>\n<<~/ahu >>`,
    `<<~ papalohe lar:///src -> lar:///tgt trigger:OnEnd >>`,
    `<<~ ahu #root >>\n<<~ ahu #child >>\n<<~ loulou lar:///z >>\n<<~/ahu >>\n<<~/ahu >>`,
  ];

  for (const [i, text] of carriers.entries()) {
    test(`carrier ${i + 1}: fromUri / toUri / family match`, () => {
      const ast = parseMemeCarrier(BASE, text);
      const fromAst = edgesFromAst(ast, BASE).map((e) => ({ fromUri: e.fromUri, toUri: e.toUri, family: e.family }));
      const direct  = parsePranalaEdges(BASE, text).map((e) => ({ fromUri: e.fromUri, toUri: e.toUri, family: e.family }));
      expect(fromAst).toEqual(direct);
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Inline alias erasure
// ---------------------------------------------------------------------------

describe("inline alias erasure — aliases become canonical SigilNode", () => {
  test("\\if produces SigilNode sigilName=wai", () => {
    const ast = parseMemeCarrier(BASE, `<<~ \\if [tag[x]] >>\n<<~ \\if >>`);
    // collectEvents should emit "wai" directly
    const events = collectEvents(`<<~ \\if [tag[x]] >>`);
    expect(events.some((e) => e.sigilName === "wai")).toBe(true);
    expect(events.every((e) => e.sigilName !== "\\if")).toBe(true);
  });

  test("\\const produces SigilNode sigilName=kau scope=carrier", () => {
    const events = collectEvents(`<<~! \\const myVar = hello >>`);
    expect(events.some((e) => e.sigilName === "kau" && e.eventType === "pragma")).toBe(true);
  });

  test("\\task open/close produces SigilNode sigilName=hana", () => {
    const ast = parseMemeCarrier(BASE, `<<~ \\task my-grammar >>\n<<~/\\task >>`);
    const s = ast.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(s?.sigilName).toBe("hana");
    expect(s?.attrs["grammarKey"]).toBe("my-grammar");
  });
});

// ---------------------------------------------------------------------------
// 4. DynamicNode escape hatch
// ---------------------------------------------------------------------------

describe("DynamicNode", () => {
  test("grammar-registered unknown sigil → DynamicNode", () => {
    const fakeGrammar = {
      sigils: [{
        name: "wao",
        kind: "worksite" as const,
        openPattern:  String.raw`<<~\s*wao\s*>>`,
        closePattern: String.raw`<<~\/wao\s*>>`,
      }],
      families: [],
    };
    const ast = parseMemeCarrier(BASE, `<<~ wao >>\n<<~/wao >>`, fakeGrammar);
    const dyn = ast.find((n) => n.kind === "Dynamic") as DynamicNode | undefined;
    expect(dyn?.sigilName).toBe("wao");
    expect(dyn?.eventType).toBe("open-close");
  });
});

// ---------------------------------------------------------------------------
// 5. kau scope
// ---------------------------------------------------------------------------

describe("kau — pragma vs block scope", () => {
  test("block kau → SigilNode scope=block", () => {
    const ast = parseMemeCarrier(BASE, `<<~ kau name = hello >>\ncontent\n<<~/kau >>`);
    const s = ast.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(s?.sigilName).toBe("kau");
    expect(s?.attrs["scope"]).toBe("block");
    expect(s?.attrs["name"]).toBe("name");
    expect(s?.attrs["value"]).toBe("hello");
  });

  test("pragma kau → SigilNode scope=carrier", () => {
    const events = collectEvents(`<<~! kau myVar = world >>`);
    const e = events.find((ev) => ev.sigilName === "kau");
    expect(e?.eventType).toBe("pragma");
    // scope is set in makeLeaf via eventType === "pragma"
    const ast = parseMemeCarrier(BASE, `<<~! kau myVar = world >>`);
    const s = ast.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(s?.attrs["scope"]).toBe("carrier");
  });
});
