/**
 * Kumu executor — Verse-aligned wehe/kumu body evaluation.
 *
 * OODA-HA phases applied:
 *   ✶ Observe  — classify WidgetNode: resolved def vs. typed hole; check depth
 *   ⏿ Orient   — bind resolvedProps to KumuContext; detect kukali suspension points
 *   ◇ Decide   — prop substitution; recursion guard (depth ≤ MAX_KUMU_DEPTH)
 *   ▶ Act      — async body walk; nested kumu calls run as concurrent causal islands
 *   ⤴↺ Aftermath — typed KumuResult propagation; blame traces to source kumuName
 *
 * Verse best practices applied:
 *   - Typed failure: KumuResult union — no exceptions cross island boundaries
 *   - No shared mutable state: KumuContext is immutable; depth increments by value copy
 *   - suspends-compatible: kukali SigilNodes mark async yield points; caller subscribes
 *     to trigger and re-executes when the reaction event fires
 *   - Causal isolation: each executeKumu invocation is independent
 *   - @editable props: resolvedProps IS the Verse @editable parameter surface
 *   - Prop shadow rule: a prop name shadows a kumu name inside the body (scoping law)
 */

import type { MemeAstNode, KumuDef, WidgetNode, TextNode, SigilNode } from "./ast.js";
import { resolveWidgetTree, type KumuRegistry } from "./widget-tree.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Max recursion depth before emitting recursion-limit failure. TW5 precedent: 8. */
export const MAX_KUMU_DEPTH = 8;

export type KumuError =
  | "unresolved-hole"   // kumu name not in registry — Hazel typed hole
  | "recursion-limit"   // depth ≥ MAX_KUMU_DEPTH
  | "suspended"         // kukali yield point hit — caller must subscribe + re-execute
  | "missing-prop";     // declared param has no binding (non-fatal; detail carries name)

export type KumuResult =
  | { readonly ok: true;  readonly nodes: readonly MemeAstNode[] }
  | { readonly ok: false; readonly error: KumuError; readonly detail?: string };

/** Immutable execution context for one kumu island invocation. */
export interface KumuContext {
  /** Resolved parameter bindings — the @editable surface. */
  readonly props:    Readonly<Record<string, string>>;
  /** Recursion depth — incremented by value, never mutated. */
  readonly depth:    number;
  readonly registry: KumuRegistry;
}

// ---------------------------------------------------------------------------
// substituteProps
//
// Walk body, replacing kahea name-form nodes where attrs.name ∈ props with
// a TextNode carrying the prop value. Non-prop kahea calls and all other nodes
// pass through unchanged.
//
// Prop shadow rule: if attrs.name matches a prop binding, it IS a substitution
// regardless of whether a kumu of that name also exists. Props shadow kumu names
// inside the body — same scoping law as Verse @editable parameters.
// ---------------------------------------------------------------------------

export function substituteProps(
  body: readonly MemeAstNode[],
  props: Readonly<Record<string, string>>,
): MemeAstNode[] {
  return body.flatMap((node): MemeAstNode[] => {
    // kahea name-form inside body: prop ref OR nested kumu call
    if (
      node.kind === "Sigil" &&
      node.sigilName === "kahea" &&
      node.attrs["name"] &&
      !node.attrs["args"]  // bare name (no args) = likely prop ref
    ) {
      const name = node.attrs["name"]!;
      if (Object.prototype.hasOwnProperty.call(props, name)) {
        // Prop ref → inline text substitution
        const text: TextNode = {
          kind:    "Text",
          content: props[name]!,
          pos:     node.pos,
          raw:     node.raw,
        };
        return [text];
      }
    }

    // Recurse into block-form nodes
    if ("body" in node && Array.isArray((node as { body?: unknown }).body)) {
      const n = node as SigilNode; // SigilNode | WorksiteNode | EdgeNode — all have body
      const substitutedBody = substituteProps(
        n.body as MemeAstNode[],
        props,
      );
      return [{ ...n, body: substitutedBody }];
    }

    return [node];
  });
}

// ---------------------------------------------------------------------------
// detectSuspension
//
// Returns the first kukali SigilNode found in the body, or null.
// A kukali node is a declared suspension point: <<~ kukali trigger:X >>
// The executor cannot proceed past it without first subscribing to trigger X
// and receiving a reaction event. This mirrors Verse `suspends`.
// ---------------------------------------------------------------------------

export function detectSuspension(body: readonly MemeAstNode[]): SigilNode | null {
  for (const node of body) {
    if (node.kind === "Sigil" && node.sigilName === "kukali") return node as SigilNode;
    if ("body" in node && Array.isArray((node as { body?: unknown }).body)) {
      const found = detectSuspension((node as { body: MemeAstNode[] }).body);
      if (found) return found;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// executeKumu
//
// Verse-aligned kumu body evaluation for a single WidgetNode.
//
// Returns KumuResult:
//   ok: true  → nodes is the substituted + recursively resolved body
//   ok: false → error classifies the failure kind; detail names the offending
//               item (kumuName for holes/recursion, triggerName for suspended,
//               paramName for missing-prop)
//
// Concurrent nested islands: any kumu calls remaining after prop substitution
// are resolved concurrently via Promise.all — no ordering assumed across islands.
// ---------------------------------------------------------------------------

export async function executeKumu(
  node: WidgetNode,
  ctx: KumuContext,
): Promise<KumuResult> {
  // ✶ Observe — classify at the door
  if (!node.def) {
    return { ok: false, error: "unresolved-hole", detail: node.kumuName };
  }
  if (ctx.depth >= MAX_KUMU_DEPTH) {
    return { ok: false, error: "recursion-limit", detail: node.kumuName };
  }

  const def: KumuDef = node.def;

  // ⏿ Orient — detect suspension before any work
  const suspensionNode = detectSuspension(def.body);
  if (suspensionNode) {
    const trigger = suspensionNode.attrs["trigger"] ?? null;
    return trigger
      ? { ok: false, error: "suspended", detail: trigger }
      : { ok: false, error: "suspended" };
  }

  // ◇ Decide — prop substitution
  const substituted = substituteProps(def.body, node.resolvedProps);

  // ▶ Act — resolve nested kumu calls concurrently (causal island fanout)
  const childWidgets = resolveWidgetTree(substituted, ctx.registry);
  if (childWidgets.length > 0) {
    const childCtx: KumuContext = {
      props:    {},           // child islands start with empty props (their own resolvedProps apply)
      depth:    ctx.depth + 1,
      registry: ctx.registry,
    };

    const childResults = await Promise.all(
      childWidgets.map((w) => executeKumu(w, childCtx)),
    );

    // ⤴ Aftermath — first failure surfaces; all nodes from successes inline
    const failed = childResults.find((r) => !r.ok);
    if (failed && !failed.ok) return failed;

    // Merge child output back into substituted body positions
    // (simple strategy: append resolved child nodes after the substituted body;
    //  a full positional merge is Phase 3+ render-pass work)
    const childNodes = childResults.flatMap((r) => (r.ok ? [...r.nodes] : []));
    return { ok: true, nodes: [...substituted, ...childNodes] };
  }

  return { ok: true, nodes: substituted };
}

// ---------------------------------------------------------------------------
// executeBatch
//
// Execute a flat list of WidgetNodes as concurrent causal islands.
// Returns all results in order. Uses Promise.all — Verse `hui` semantics.
// For race/rush fanout, callers use ReactionGraph.fireRace / fireRush directly.
// ---------------------------------------------------------------------------

export async function executeBatch(
  widgets: readonly WidgetNode[],
  ctx: KumuContext,
): Promise<KumuResult[]> {
  return Promise.all(widgets.map((w) => executeKumu(w, ctx)));
}
