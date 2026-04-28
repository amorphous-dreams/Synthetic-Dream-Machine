/**
 * kahea dispatch tests — URI form vs name (definition invocation) form.
 *
 * URI form:  <<~ kahea lar:///uri >>  → EdgeSugarNode (compile + render, dataflow edge)
 * Name form: <<~ kahea name >>        → SigilNode { sigilName:"kahea", attrs:{name,args} } (render-only)
 * Call form: <<~ kahea name(k:v) >>   → SigilNode with attrs.args populated
 *
 * The distinction is at parse time — the compile layer never sees a dataflow
 * edge for name-form kahea. No garbage URI produced for plain identifier targets.
 */

import { describe, test, expect } from "@jest/globals";
import { parseMemeCarrier } from "../src/parser.js";
import { parsePranalaEdges } from "../src/pranala-parser.js";
import type { EdgeSugarNode, SigilNode } from "../src/ast.js";

const BASE = "lar:///test/carrier";

function ast(body: string) {
  return parseMemeCarrier(BASE, body);
}

function edges(body: string) {
  return parsePranalaEdges(BASE, body);
}

// ---------------------------------------------------------------------------
// URI form → EdgeSugarNode + dataflow edge
// ---------------------------------------------------------------------------

describe("kahea URI form — EdgeSugarNode", () => {
  test("lar:/// absolute URI", () => {
    const nodes = ast("<<~ kahea lar:///ha.ka.ba/api/v0.1/mu >>");
    const n = nodes.find((n) => n.kind === "EdgeSugar") as EdgeSugarNode | undefined;
    expect(n).toBeDefined();
    expect(n!.sigil).toBe("kahea");
    expect(n!.toRaw).toBe("lar:///ha.ka.ba/api/v0.1/mu");
    expect(n!.family).toBe("dataflow");
  });

  test("URI form produces a dataflow edge", () => {
    const es = edges("<<~ kahea lar:///ha.ka.ba/api/v0.1/mu >>");
    expect(es).toHaveLength(1);
    expect(es[0]!.family).toBe("dataflow");
    expect(es[0]!.toUri).toBe("lar:///ha.ka.ba/api/v0.1/mu");
  });

  test("URI with fragment", () => {
    const nodes = ast("<<~ kahea lar:///some/carrier#section >>");
    const n = nodes.find((n) => n.kind === "EdgeSugar") as EdgeSugarNode | undefined;
    expect(n).toBeDefined();
    expect(n!.toRaw).toBe("lar:///some/carrier#section");
  });

  test("relative path with slash", () => {
    const nodes = ast("<<~ kahea some/relative/path >>");
    const n = nodes.find((n) => n.kind === "EdgeSugar") as EdgeSugarNode | undefined;
    expect(n).toBeDefined();
    expect(n!.family).toBe("dataflow");
  });
});

// ---------------------------------------------------------------------------
// Name form → SigilNode (render-only, no graph edge)
// ---------------------------------------------------------------------------

describe("kahea name form — SigilNode, render-only", () => {
  test("bare name → SigilNode", () => {
    const nodes = ast("<<~ kahea greeting >>");
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n).toBeDefined();
    expect(n!.sigilName).toBe("kahea");
    expect(n!.attrs["name"]).toBe("greeting");
    expect(n!.attrs["args"]).toBe("");
  });

  test("name with args → SigilNode with attrs.args", () => {
    const nodes = ast('<<~ kahea greeting(name:"Operator") >>');
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n).toBeDefined();
    expect(n!.sigilName).toBe("kahea");
    expect(n!.attrs["name"]).toBe("greeting");
    expect(n!.attrs["args"]).toBe('name:"Operator"');
  });

  test("dotted name → SigilNode", () => {
    const nodes = ast("<<~ kahea some.template >>");
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n).toBeDefined();
    expect(n!.attrs["name"]).toBe("some.template");
  });

  test("multi-arg call → SigilNode", () => {
    const nodes = ast("<<~ kahea card(title:Welcome body:Hello) >>");
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n).toBeDefined();
    expect(n!.attrs["name"]).toBe("card");
    expect(n!.attrs["args"]).toBe("title:Welcome body:Hello");
  });

  test("name form produces NO graph edge", () => {
    const es = edges("<<~ kahea greeting >>");
    expect(es.filter((e) => e.family === "dataflow")).toHaveLength(0);
  });

  test("name form with args produces NO graph edge", () => {
    const es = edges('<<~ kahea greeting(name:"Operator") >>');
    expect(es.filter((e) => e.family === "dataflow")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Both forms in the same carrier
// ---------------------------------------------------------------------------

describe("kahea mixed — URI edge + name invocation in same carrier", () => {
  test("one edge, one SigilNode", () => {
    const body = `
<<~ kahea lar:///some/meme >>
<<~ kahea greeting(name:"World") >>`;

    const nodes = ast(body);
    const edgeSugar = nodes.filter((n) => n.kind === "EdgeSugar") as EdgeSugarNode[];
    const sigils    = nodes.filter((n) => n.kind === "Sigil")     as SigilNode[];

    expect(edgeSugar.filter((n) => n.sigil === "kahea")).toHaveLength(1);
    expect(sigils.filter((n) => n.sigilName === "kahea")).toHaveLength(1);

    const es = edges(body);
    expect(es.filter((e) => e.family === "dataflow")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Parameter interpolation inside wehe body
// ---------------------------------------------------------------------------

describe("kahea as parameter interpolation inside wehe body", () => {
  test("<<~ kahea paramName >> inside body → SigilNode (render-only)", () => {
    // Inside a wehe body, `<<~ kahea name >>` interpolates a bound parameter.
    // The parameter IS a locally-scoped definition — same mechanism, narrower scope.
    const body = `Hello, <<~ kahea name >>!`;
    const nodes = ast(body);
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n).toBeDefined();
    expect(n!.attrs["name"]).toBe("name");
    expect(edges(body)).toHaveLength(0);
  });
});
