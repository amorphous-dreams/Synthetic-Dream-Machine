/**
 * Render target boundary contract.
 *
 * TW5 golden principle: everything IS a tiddler; the type selects the render pipeline.
 * Lararium equivalent: everything IS a meme; the render target selects the adapter.
 *
 * Both adapters share the same widget tree as their input boundary:
 *
 *   carrier text (meme)
 *     ↓ parseMemeCarrier()
 *   MemeAstNode[]                  ← parse tree (render-target agnostic)
 *     ↓ resolveWidgetTree(ast, registry)
 *   WidgetNode[]                   ← widget tree (render-target agnostic)
 *     ↓                ↓
 *   TldrawAdapter     ReactAdapter
 *   LarTLSnapshot     React.ReactNode
 *     ↓                ↓
 *   tldraw store      MemeDetailPanel DOM
 *
 * TldrawAdapter: renderToTldraw() — @lararium/tldraw render.ts
 *   Input:  BootArtifact (carries the full meme closure)
 *   Output: TldrawEmission (pages + shapes + bindings for tldraw store)
 *   Note:   Currently projects memes as positioned frames, not rendered wikitext.
 *           Phase 4 target: WidgetNode[] → tldraw shape subtrees (rich meme bodies).
 *
 * ReactAdapter: renderCarrier() — @lararium/app kumu-react-render.tsx
 *   Input:  MemeAstNode[] + Map<pos, WidgetSlot> (widgetMap from resolved+executed tree)
 *   Output: React.ReactNode (the story river / detail panel view)
 *   Note:   Wikitext-driven — kumu execution output feeds the render, not hardcoded layout.
 *
 * Both adapters treat WidgetNode[] as authoritative. Neither re-parses the carrier.
 * Future adapters (ActivityPub, Obsidian canvas, PDF) would follow the same contract.
 */

import type { WidgetNode, KumuResult } from "@lararium/core";

/** One widget slot: the resolved WidgetNode and its async execution result (null = pending). */
export interface WidgetSlot {
  readonly widget: WidgetNode;
  readonly result: KumuResult | null;
}

/**
 * Build a pos→WidgetSlot index for O(1) lookup during the AST render walk.
 * Keyed on node.pos (byte offset) — unique within a single parse, stable across re-renders.
 */
export function buildWidgetMap(
  widgetTree: readonly WidgetNode[],
  results: readonly KumuResult[] | null,
): Map<number, WidgetSlot> {
  const map = new Map<number, WidgetSlot>();
  widgetTree.forEach((widget, i) => {
    map.set(widget.pos, { widget, result: results?.[i] ?? null });
  });
  return map;
}
