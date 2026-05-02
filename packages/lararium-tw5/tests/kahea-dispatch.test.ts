/**
 * sigil dispatch tests — kahea / kau / waiho
 *
 * Four-way split:
 *   aka     — shadow/observe (read-only mirror, source-canonical)
 *   kahea   — dataflow URI form only: <<~ kahea lar:///uri >> → graph edge
 *   kau     — invocation/placement (disambiguation by #fragment):
 *               <<~ kau name >>              render-only invocation, no UUID, no edge
 *               <<~ kau name(k:v) >>         invocation with args
 *               <<~ kau #frag Name props >>  device placement with persistent identity
 *   waiho   — ephemeral binding: <<~ waiho name = val >> → SigilNode, no edge
 *
 * kahea no longer has a name-invocation form (kahea-call removed).
 * kau does NOT do variable binding — that role belongs to waiho.
 * kau does NOT produce graph edges — that role belongs to kahea/papalohe/pranala.
 * The #fragment presence is the placement indicator: without it, kau is render-only.
 */

import { describe, test, expect } from "@jest/globals";
import { parseMemeCarrier } from "../src/parser.js";
import { parsePranalaEdges } from "../src/pranala-parser.js";
import type { PranalaSugarNode, SigilNode } from "../src/ast.js";

const BASE = "lar:///test/carrier";

function ast(body: string) { return parseMemeCarrier(BASE, body); }
function edges(body: string) { return parsePranalaEdges(BASE, body); }

// ---------------------------------------------------------------------------
// kahea — URI form only → PranalaSugarNode + dataflow edge
// ---------------------------------------------------------------------------

describe("kahea — URI/dataflow form", () => {
  test("lar:/// absolute URI → PranalaSugarNode sigil=kahea family=dataflow", () => {
    const nodes = ast("<<~ kahea lar:///ha.ka.ba/@lares/api/v0.1/mu >>");
    const n = nodes.find((n) => n.kind === "PranalaSugar") as PranalaSugarNode | undefined;
    expect(n).toBeDefined();
    expect(n!.sigil).toBe("kahea");
    expect(n!.toRaw).toBe("lar:///ha.ka.ba/@lares/api/v0.1/mu");
    expect(n!.family).toBe("dataflow");
  });

  test("relative path with slash matches URI form", () => {
    const nodes = ast("<<~ kahea some/relative/path >>");
    const n = nodes.find((n) => n.kind === "PranalaSugar") as PranalaSugarNode | undefined;
    expect(n).toBeDefined();
    expect(n!.family).toBe("dataflow");
  });

  test("URI with fragment", () => {
    const nodes = ast("<<~ kahea lar:///some/carrier#section >>");
    const n = nodes.find((n) => n.kind === "PranalaSugar") as PranalaSugarNode | undefined;
    expect(n).toBeDefined();
    expect(n!.toRaw).toBe("lar:///some/carrier#section");
  });

  test("URI form → dataflow edge in graph", () => {
    const es = edges("<<~ kahea lar:///ha.ka.ba/@lares/api/v0.1/mu >>");
    expect(es).toHaveLength(1);
    expect(es[0]!.family).toBe("dataflow");
    expect(es[0]!.toUri).toBe("lar:///ha.ka.ba/@lares/api/v0.1/mu");
  });

  test("bare identifier does NOT match kahea (no graph edge, no PranalaSugar)", () => {
    // kahea-call (name form) was removed; bare names are not valid kahea targets
    const nodes = ast("<<~ kahea greeting >>");
    const sugar = nodes.find((n) => n.kind === "PranalaSugar") as PranalaSugarNode | undefined;
    expect(sugar).toBeUndefined();
    expect(edges("<<~ kahea greeting >>")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// kau — device placement → SigilNode, no edge
// ---------------------------------------------------------------------------

describe("kau — invocation (no #fragment) → render-only, attrs.name + attrs.args", () => {
  test("bare name → SigilNode attrs.name, attrs.args empty", () => {
    const nodes = ast("<<~ kau MyDevice >>");
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n).toBeDefined();
    expect(n!.sigilName).toBe("kau");
    expect(n!.attrs["name"]).toBe("MyDevice");
    expect(n!.attrs["args"]).toBe("");
  });

  test("name with args → attrs.args populated", () => {
    const nodes = ast('<<~ kau greeting(name:"Operator") >>');
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n).toBeDefined();
    expect(n!.attrs["name"]).toBe("greeting");
    expect(n!.attrs["args"]).toBe('name:"Operator"');
  });

  test("multi-arg call → attrs.args", () => {
    const nodes = ast("<<~ kau card(title:Welcome body:Hello) >>");
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n).toBeDefined();
    expect(n!.attrs["name"]).toBe("card");
    expect(n!.attrs["args"]).toBe("title:Welcome body:Hello");
  });

  test("dotted name → attrs.name", () => {
    const nodes = ast("<<~ kau some.Template >>");
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n).toBeDefined();
    expect(n!.attrs["name"]).toBe("some.Template");
  });

  test("invocation produces NO graph edge", () => {
    expect(edges("<<~ kau greeting >>")).toHaveLength(0);
    expect(edges('<<~ kau greeting(name:"Operator") >>')).toHaveLength(0);
  });
});

describe("kau — placement (#fragment present) → persistent identity, attrs.fragment + attrs.name + attrs.propsRaw", () => {
  test("explicit #fragment → attrs.fragment without leading #", () => {
    const nodes = ast("<<~ kau #sensor-1 GuardDevice >>");
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n).toBeDefined();
    expect(n!.sigilName).toBe("kau");
    expect(n!.attrs["fragment"]).toBe("sensor-1");
    expect(n!.attrs["name"]).toBe("GuardDevice");
  });

  test("placement with props → attrs.propsRaw", () => {
    const nodes = ast("<<~ kau #guard-1 GuardDevice mode:patrol zone:north >>");
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n).toBeDefined();
    expect(n!.attrs["propsRaw"]).toContain("mode:patrol");
    expect(n!.attrs["propsRaw"]).toContain("zone:north");
  });

  test("placement produces NO graph edge", () => {
    expect(edges("<<~ kau #inst-1 MyDevice >>")).toHaveLength(0);
    expect(edges("<<~ kau #inst-1 MyDevice prop:val >>")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// waiho — ephemeral variable binding → SigilNode, no edge
// ---------------------------------------------------------------------------

describe("waiho — variable binding", () => {
  test("block waiho → SigilNode sigilName=waiho scope=block", () => {
    const nodes = ast("<<~ waiho greeting = Hello >>\ncontent\n<<~/waiho >>");
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n).toBeDefined();
    expect(n!.sigilName).toBe("waiho");
    expect(n!.attrs["name"]).toBe("greeting");
    expect(n!.attrs["value"]).toBe("Hello");
    expect(n!.attrs["scope"]).toBe("block");
  });

  test("pragma waiho → SigilNode scope=carrier", () => {
    const nodes = ast("<<~! waiho myVar = world >>");
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n).toBeDefined();
    expect(n!.sigilName).toBe("waiho");
    expect(n!.attrs["scope"]).toBe("carrier");
    expect(n!.attrs["name"]).toBe("myVar");
    expect(n!.attrs["value"]).toBe("world");
  });

  test("waiho produces NO graph edge", () => {
    expect(edges("<<~ waiho x = 1 >>\n<<~/waiho >>")).toHaveLength(0);
    expect(edges("<<~! waiho x = 1 >>")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Mixed: all four dispatch forms in the same carrier
// ---------------------------------------------------------------------------

describe("mixed dispatch — all forms in one carrier", () => {
  test("kahea edge + kau placement + waiho binding — each lands in its own bucket", () => {
    const body = `
<<~ kahea lar:///some/meme >>
<<~ kau #guard-1 GuardDevice mode:patrol >>
<<~! waiho score = 0 >>`;

    const nodes = ast(body);
    const es = edges(body);

    const sugarNodes  = nodes.filter((n) => n.kind === "PranalaSugar") as PranalaSugarNode[];
    const sigilNodes  = nodes.filter((n) => n.kind === "Sigil") as SigilNode[];

    // kahea → one dataflow edge, one PranalaSugar
    expect(sugarNodes.filter((n) => n.sigil === "kahea")).toHaveLength(1);
    expect(es.filter((e) => e.family === "dataflow")).toHaveLength(1);

    // kau → one SigilNode, no edge
    expect(sigilNodes.filter((n) => n.sigilName === "kau")).toHaveLength(1);

    // waiho → one SigilNode, no edge
    expect(sigilNodes.filter((n) => n.sigilName === "waiho")).toHaveLength(1);

    // total edges = 1 (only the kahea dataflow edge)
    expect(es).toHaveLength(1);
  });
});
