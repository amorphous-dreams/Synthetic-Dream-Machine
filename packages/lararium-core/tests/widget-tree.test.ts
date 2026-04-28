/**
 * Widget tree — Phase 3 self-hosting pipeline tests.
 *
 * resolveWidgetTree re-types kahea name-form SigilNodes into WidgetNodes.
 * KumuRegistry holds kumu type definitions.
 * Typed hole semantics: unregistered kumu names emit WidgetNode { def: null }.
 * collectKumuDefs extracts KumuDef records from a parsed carrier AST.
 */

import { describe, test, expect } from "@jest/globals";
import { parseMemeCarrier } from "../src/parser.js";
import {
  KumuRegistry,
  buildKumuRegistry,
  resolveWidgetTree,
  collectKumuDefs,
} from "../src/widget-tree.js";
import type { KumuDef, WidgetNode } from "../src/ast.js";

const BASE = "lar:///test/carrier";

function ast(body: string) {
  return parseMemeCarrier(BASE, body);
}

// ---------------------------------------------------------------------------
// KumuRegistry
// ---------------------------------------------------------------------------

describe("KumuRegistry", () => {
  test("register and get", () => {
    const r = new KumuRegistry();
    const def: KumuDef = { name: "card", params: ["title", "body"], carrierUri: BASE, body: [] };
    r.register(def);
    expect(r.get("card")).toBe(def);
    expect(r.has("card")).toBe(true);
    expect(r.size).toBe(1);
  });

  test("missing name → undefined", () => {
    const r = new KumuRegistry();
    expect(r.get("nonexistent")).toBeUndefined();
    expect(r.has("nonexistent")).toBe(false);
  });

  test("buildKumuRegistry populates from array", () => {
    const defs: KumuDef[] = [
      { name: "card", params: [], carrierUri: BASE, body: [] },
      { name: "badge", params: ["label"], carrierUri: BASE, body: [] },
    ];
    const r = buildKumuRegistry(defs);
    expect(r.size).toBe(2);
    expect(r.has("card")).toBe(true);
    expect(r.has("badge")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveWidgetTree — happy path
// ---------------------------------------------------------------------------

describe("resolveWidgetTree — registered kumu", () => {
  test("bare name → WidgetNode with def", () => {
    const registry = buildKumuRegistry([
      { name: "greeting", params: ["name"], carrierUri: BASE, body: [] },
    ]);
    const nodes = ast("<<~ kahea greeting >>");
    const widgets = resolveWidgetTree(nodes, registry);
    expect(widgets).toHaveLength(1);
    const w = widgets[0]! as WidgetNode;
    expect(w.kind).toBe("Widget");
    expect(w.kumuName).toBe("greeting");
    expect(w.def).not.toBeNull();
    expect(w.def!.name).toBe("greeting");
    expect(w.resolvedProps).toEqual({});
  });

  test("name with args → resolvedProps populated", () => {
    const registry = buildKumuRegistry([
      { name: "card", params: ["title", "body"], carrierUri: BASE, body: [] },
    ]);
    const nodes = ast('<<~ kahea card(title:Welcome body:"Hello World") >>');
    const widgets = resolveWidgetTree(nodes, registry);
    expect(widgets).toHaveLength(1);
    const w = widgets[0]! as WidgetNode;
    expect(w.resolvedProps["title"]).toBe("Welcome");
    expect(w.resolvedProps["body"]).toBe("Hello World");
  });

  test("dotted name resolves", () => {
    const registry = buildKumuRegistry([
      { name: "ui.card", params: [], carrierUri: BASE, body: [] },
    ]);
    const nodes = ast("<<~ kahea ui.card >>");
    const widgets = resolveWidgetTree(nodes, registry);
    expect(widgets[0]?.kumuName).toBe("ui.card");
    expect(widgets[0]?.def).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Typed holes — unregistered names stay live
// ---------------------------------------------------------------------------

describe("resolveWidgetTree — typed holes (Hazel semantics)", () => {
  test("unregistered name → WidgetNode { def: null }", () => {
    const registry = new KumuRegistry(); // empty
    const nodes = ast("<<~ kahea mystery >>");
    const widgets = resolveWidgetTree(nodes, registry);
    expect(widgets).toHaveLength(1);
    const w = widgets[0]! as WidgetNode;
    expect(w.kind).toBe("Widget");
    expect(w.kumuName).toBe("mystery");
    expect(w.def).toBeNull();           // typed hole
    expect(w.resolvedProps).toEqual({});
  });

  test("unregistered with args → hole still has resolvedProps", () => {
    const registry = new KumuRegistry();
    const nodes = ast('<<~ kahea future(x:1 y:"two") >>');
    const widgets = resolveWidgetTree(nodes, registry);
    expect(widgets[0]?.def).toBeNull();
    expect(widgets[0]?.resolvedProps["x"]).toBe("1");
    expect(widgets[0]?.resolvedProps["y"]).toBe("two");
  });
});

// ---------------------------------------------------------------------------
// URI-form kahea — not a widget call
// ---------------------------------------------------------------------------

describe("resolveWidgetTree — URI-form kahea is NOT a widget call", () => {
  test("URI form produces no WidgetNode", () => {
    const registry = new KumuRegistry();
    const nodes = ast("<<~ kahea lar:///some/meme >>");
    const widgets = resolveWidgetTree(nodes, registry);
    // URI form → EdgeSugarNode, not SigilNode; resolveWidgetTree ignores it
    expect(widgets).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Multiple widget calls in one carrier
// ---------------------------------------------------------------------------

describe("resolveWidgetTree — multiple calls", () => {
  test("two calls → two WidgetNodes", () => {
    const registry = buildKumuRegistry([
      { name: "header", params: [], carrierUri: BASE, body: [] },
      { name: "footer", params: [], carrierUri: BASE, body: [] },
    ]);
    const nodes = ast("<<~ kahea header >>\nSome text\n<<~ kahea footer >>");
    const widgets = resolveWidgetTree(nodes, registry);
    expect(widgets).toHaveLength(2);
    expect(widgets[0]?.kumuName).toBe("header");
    expect(widgets[1]?.kumuName).toBe("footer");
  });

  test("mixed registered + hole", () => {
    const registry = buildKumuRegistry([
      { name: "known", params: [], carrierUri: BASE, body: [] },
    ]);
    const nodes = ast("<<~ kahea known >>\n<<~ kahea unknown >>");
    const widgets = resolveWidgetTree(nodes, registry);
    expect(widgets[0]?.def).not.toBeNull();
    expect(widgets[1]?.def).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// collectKumuDefs
// ---------------------------------------------------------------------------

describe("collectKumuDefs", () => {
  test("kumu sigil in carrier → KumuDef extracted", () => {
    // parseMemeCarrier emits a SigilNode for kumu (DynamicNode or SigilNode depending on grammar)
    // The grammar registers kumu as an open-close sigil with name+params attrs.
    // For this test we construct the AST manually to avoid grammar dep.
    const mockAst: import("../src/ast.js").MemeAstNode[] = [
      {
        kind: "Sigil",
        sigilName: "kumu",
        attrs: { name: "myWidget", params: "title body" },
        body: [],
        pos: 0,
        raw: "<<~! kumu myWidget(title body) >>",
      },
    ];
    const defs = collectKumuDefs(BASE, mockAst);
    expect(defs).toHaveLength(1);
    expect(defs[0]!.name).toBe("myWidget");
    expect(defs[0]!.params).toEqual(["title", "body"]);
    expect(defs[0]!.carrierUri).toBe(BASE);
  });

  test("no kumu sigils → empty array", () => {
    const nodes = ast("Hello world <<~ kahea greeting >>");
    const defs = collectKumuDefs(BASE, nodes);
    expect(defs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ReactionGraph async — fire() returns Promise
// ---------------------------------------------------------------------------

describe("ReactionGraph async fire()", () => {
  test("fire() returns Promise<void>", async () => {
    const { ReactionGraph } = await import("../src/live-protocol.js");
    const g = new ReactionGraph();
    g.load([{ fromUri: BASE, toUri: "lar:///target", trigger: "OnBegin", fn: null, role: null }]);
    const result = g.fire(BASE, "OnBegin", {});
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBeUndefined();
  });

  test("fire() calls async handler and awaits", async () => {
    const { ReactionGraph } = await import("../src/live-protocol.js");
    const g = new ReactionGraph();
    const log: string[] = [];
    g.subscribe(BASE, "OnBegin", async (_b, _p) => {
      await Promise.resolve();
      log.push("fired");
    });
    await g.fire(BASE, "OnBegin");
    expect(log).toEqual(["fired"]);
  });

  test("load() removes placeholder — no phantom handlers", async () => {
    const { ReactionGraph } = await import("../src/live-protocol.js");
    const g = new ReactionGraph();
    const log: string[] = [];
    g.load([{ fromUri: BASE, toUri: "lar:///t", trigger: "OnX", fn: null, role: null }]);
    g.subscribe(BASE, "OnX", () => { log.push("real"); });
    await g.fire(BASE, "OnX");
    expect(log).toEqual(["real"]); // exactly one call, no phantom no-op
  });

  test("fireRace() returns on first handler", async () => {
    const { ReactionGraph } = await import("../src/live-protocol.js");
    const g = new ReactionGraph();
    const log: string[] = [];
    // fast handler resolves immediately
    g.subscribe(BASE, "OnRace", async () => { log.push("fast"); });
    // slow handler takes longer
    g.subscribe(BASE, "OnRace", async () => {
      await new Promise((r) => setTimeout(r, 50));
      log.push("slow");
    });
    await g.fireRace(BASE, "OnRace");
    expect(log).toContain("fast");
  });

  test("fireRush() resolves on first completion", async () => {
    const { ReactionGraph } = await import("../src/live-protocol.js");
    const g = new ReactionGraph();
    g.subscribe(BASE, "OnRush", async () => { return; });
    await expect(g.fireRush(BASE, "OnRush")).resolves.toBeUndefined();
  });
});
