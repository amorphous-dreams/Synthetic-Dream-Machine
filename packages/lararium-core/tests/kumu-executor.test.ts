/**
 * Kumu executor tests — Verse-aligned typed failure model.
 *
 * Tests cover:
 *   - Typed hole: def === null → unresolved-hole failure
 *   - Recursion guard: depth ≥ 8 → recursion-limit failure
 *   - Prop substitution: kahea name-form → TextNode with prop value
 *   - Prop shadow: prop name shadows kumu name inside body
 *   - Suspension detection: kukali node → suspended failure with trigger detail
 *   - Nested kumu: causal island fanout via Promise.all
 *   - executeBatch: concurrent hui semantics
 *   - Missing prop: bare kahea name not in props passes through unchanged
 */

import { describe, test, expect } from "@jest/globals";
import type { MemeAstNode, KumuDef, WidgetNode, SigilNode, TextNode } from "../src/ast.js";
import { buildKumuRegistry } from "../src/widget-tree.js";
import {
  executeKumu,
  executeBatch,
  substituteProps,
  detectSuspension,
  MAX_KUMU_DEPTH,
  type KumuContext,
} from "../src/kumu-executor.js";

const BASE = "lar:///test/carrier";

function makeRegistry(defs: KumuDef[] = []) {
  return buildKumuRegistry(defs);
}

function makeCtx(
  props: Record<string, string> = {},
  depth = 0,
  defs: KumuDef[] = [],
): KumuContext {
  return { props, depth, registry: makeRegistry(defs) };
}

function sigilNode(sigilName: string, attrs: Record<string, string>, body: MemeAstNode[] = []): SigilNode {
  return { kind: "Sigil", sigilName, attrs, body, pos: 0, raw: "" };
}

function textNode(content: string): TextNode {
  return { kind: "Text", content, pos: 0, raw: content };
}

function kaheaNameNode(name: string, args = ""): SigilNode {
  return sigilNode("kahea", args ? { name, args } : { name, args: "" });
}

function kumuDef(name: string, params: string[], body: MemeAstNode[] = []): KumuDef {
  return { name, params, carrierUri: BASE, body };
}

function widgetNode(
  kumuName: string,
  def: KumuDef | null,
  resolvedProps: Record<string, string> = {},
  body: WidgetNode[] = [],
): WidgetNode {
  return { kind: "Widget", kumuName, def, resolvedProps, body, pos: 0, raw: "" };
}

// ---------------------------------------------------------------------------
// Typed hole
// ---------------------------------------------------------------------------

describe("executeKumu — typed hole", () => {
  test("def === null → unresolved-hole", async () => {
    const node = widgetNode("ghost", null);
    const result = await executeKumu(node, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("unresolved-hole");
      expect(result.detail).toBe("ghost");
    }
  });
});

// ---------------------------------------------------------------------------
// Recursion guard
// ---------------------------------------------------------------------------

describe("executeKumu — recursion guard", () => {
  test("depth ≥ MAX_KUMU_DEPTH → recursion-limit", async () => {
    const def = kumuDef("loop", [], [textNode("body")]);
    const node = widgetNode("loop", def);
    const ctx = makeCtx({}, MAX_KUMU_DEPTH);
    const result = await executeKumu(node, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("recursion-limit");
  });

  test("depth < MAX_KUMU_DEPTH → executes", async () => {
    const def = kumuDef("ok", [], [textNode("hello")]);
    const node = widgetNode("ok", def);
    const ctx = makeCtx({}, MAX_KUMU_DEPTH - 1);
    const result = await executeKumu(node, ctx);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// substituteProps
// ---------------------------------------------------------------------------

describe("substituteProps", () => {
  test("bare kahea name in props → TextNode", () => {
    const body: MemeAstNode[] = [
      textNode("Hello, "),
      kaheaNameNode("name"),
      textNode("!"),
    ];
    const out = substituteProps(body, { name: "World" });
    expect(out).toHaveLength(3);
    expect(out[1]!.kind).toBe("Text");
    expect((out[1] as TextNode).content).toBe("World");
  });

  test("bare kahea name NOT in props → passes through unchanged", () => {
    const body: MemeAstNode[] = [kaheaNameNode("unknown")];
    const out = substituteProps(body, { title: "Hi" });
    expect(out[0]!.kind).toBe("Sigil");
    expect((out[0] as SigilNode).sigilName).toBe("kahea");
  });

  test("kahea with args is NOT substituted (it is a kumu call, not a prop ref)", () => {
    const body: MemeAstNode[] = [kaheaNameNode("name", "x:1")];
    const out = substituteProps(body, { name: "World" });
    // has args → not treated as prop ref → passes through
    expect(out[0]!.kind).toBe("Sigil");
  });

  test("multiple props substituted", () => {
    const body: MemeAstNode[] = [
      kaheaNameNode("first"),
      textNode(" "),
      kaheaNameNode("last"),
    ];
    const out = substituteProps(body, { first: "Ada", last: "Lovelace" });
    expect((out[0] as TextNode).content).toBe("Ada");
    expect((out[2] as TextNode).content).toBe("Lovelace");
  });

  test("prop shadow: prop name takes precedence over kumu name", () => {
    // Even if there is a kumu named "title", a prop named "title" shadows it
    const body: MemeAstNode[] = [kaheaNameNode("title")];
    const out = substituteProps(body, { title: "The Title" });
    expect(out[0]!.kind).toBe("Text");
    expect((out[0] as TextNode).content).toBe("The Title");
  });

  test("recurses into nested body", () => {
    const inner = kaheaNameNode("x");
    const outer = sigilNode("wehe", { name: "wrapper", params: "" }, [inner]);
    const out = substituteProps([outer], { x: "val" });
    expect(out[0]!.kind).toBe("Sigil");
    const body = (out[0] as SigilNode).body;
    expect(body[0]!.kind).toBe("Text");
    expect((body[0] as TextNode).content).toBe("val");
  });
});

// ---------------------------------------------------------------------------
// Suspension detection
// ---------------------------------------------------------------------------

describe("detectSuspension", () => {
  test("no kukali → null", () => {
    const body: MemeAstNode[] = [textNode("hello"), kaheaNameNode("foo")];
    expect(detectSuspension(body)).toBeNull();
  });

  test("inline kukali → returns SigilNode", () => {
    const kukali = sigilNode("kukali", { trigger: "OnBegin" });
    const body: MemeAstNode[] = [textNode("before"), kukali, textNode("after")];
    const found = detectSuspension(body);
    expect(found).not.toBeNull();
    expect(found!.attrs["trigger"]).toBe("OnBegin");
  });

  test("kukali nested in body → found", () => {
    const kukali = sigilNode("kukali", { trigger: "OnActivate" });
    const wrapper = sigilNode("wehe", { name: "w", params: "" }, [kukali]);
    const found = detectSuspension([wrapper]);
    expect(found).not.toBeNull();
    expect(found!.attrs["trigger"]).toBe("OnActivate");
  });
});

// ---------------------------------------------------------------------------
// executeKumu — suspension
// ---------------------------------------------------------------------------

describe("executeKumu — suspended", () => {
  test("kukali in body → suspended failure with trigger detail", async () => {
    const def = kumuDef("waiter", [], [
      textNode("loading..."),
      sigilNode("kukali", { trigger: "OnReady" }),
    ]);
    const node = widgetNode("waiter", def);
    const result = await executeKumu(node, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("suspended");
      expect(result.detail).toBe("OnReady");
    }
  });
});

// ---------------------------------------------------------------------------
// executeKumu — happy path
// ---------------------------------------------------------------------------

describe("executeKumu — ok result", () => {
  test("simple body with no props → nodes pass through", async () => {
    const def = kumuDef("banner", [], [textNode("Welcome!")]);
    const node = widgetNode("banner", def);
    const result = await executeKumu(node, makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nodes).toHaveLength(1);
      expect((result.nodes[0] as TextNode).content).toBe("Welcome!");
    }
  });

  test("body with prop substitution", async () => {
    const def = kumuDef("greeting", ["name"], [
      textNode("Hello, "),
      kaheaNameNode("name"),
      textNode("!"),
    ]);
    const node = widgetNode("greeting", def, { name: "Operator" });
    const result = await executeKumu(node, makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nodes).toHaveLength(3);
      expect((result.nodes[1] as TextNode).content).toBe("Operator");
    }
  });

  test("body with unbound prop → typed hole (unresolved-hole failure)", async () => {
    // substituteProps leaves the kahea node unchanged (prop not in resolvedProps).
    // resolveWidgetTree then treats it as a kumu call; "title" not in registry
    // → WidgetNode { def: null } → executeKumu returns unresolved-hole.
    // This IS correct Verse behavior: an unbound parameter propagates as a typed hole.
    const def = kumuDef("card", ["title"], [kaheaNameNode("title")]);
    const node = widgetNode("card", def, {});
    const result = await executeKumu(node, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("unresolved-hole");
      expect(result.detail).toBe("title");
    }
  });
});

// ---------------------------------------------------------------------------
// executeBatch — hui semantics
// ---------------------------------------------------------------------------

describe("executeBatch", () => {
  test("all succeed → array of ok results", async () => {
    const defA = kumuDef("a", [], [textNode("A")]);
    const defB = kumuDef("b", [], [textNode("B")]);
    const widgets = [
      widgetNode("a", defA),
      widgetNode("b", defB),
    ];
    const results = await executeBatch(widgets, makeCtx());
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  test("one hole → that result is failure, others succeed", async () => {
    const def = kumuDef("real", [], [textNode("real")]);
    const widgets = [
      widgetNode("ghost", null),        // hole
      widgetNode("real", def),
    ];
    const results = await executeBatch(widgets, makeCtx());
    expect(results[0]!.ok).toBe(false);
    expect(results[1]!.ok).toBe(true);
  });

  test("empty batch → empty results", async () => {
    const results = await executeBatch([], makeCtx());
    expect(results).toHaveLength(0);
  });
});
