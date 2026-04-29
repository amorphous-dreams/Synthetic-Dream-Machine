/**
 * Render target boundary contract — the authoritative interface between the widget tree
 * and any downstream renderer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TW5 golden principle: everything IS a tiddler; the type selects the render pipeline.
 * Lararium equivalent: everything IS a meme; the render target selects the adapter.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Pipeline (render-target agnostic):
 *
 *   carrier text (meme)
 *     ↓ parseMemeCarrier()                    @lararium/core
 *   MemeAstNode[]                             parse tree — agnostic
 *     ↓ resolveWidgetTree(ast, registry)      @lararium/core
 *   WidgetNode[]                              widget tree — agnostic
 *     ↓                  ↓                   adapter boundary ← this file owns
 *   TldrawAdapter        ReactAdapter
 *   (project.ts)         (kumu-react-render.tsx)
 *     ↓                  ↓
 *   LarTLBodyNode[]      React.ReactNode
 *     ↓ emitTldrawRecords()                   → tldraw store
 *                        ↓ renderCarrier()    → MemeDetailPanel DOM
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Adapter registry
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Each adapter declares: id, target platform, input contract, output type, refresh model.
 *
 *   id          human key — also used as meta.adapterTarget in emitted shapes
 *   platform    runtime environment the adapter produces output for
 *   input       what the adapter consumes (always WidgetNode[] as the shared boundary)
 *   output      what the adapter produces
 *   refresh     how the adapter responds to CRDT delta events (TW5 selective refresh model)
 *
 * Both current adapters treat WidgetNode[] as authoritative and never re-parse carrier text.
 * Future adapters (ActivityPub, Obsidian canvas, PDF, CLI) follow the same contract.
 */

import type { MemeAstNode, WidgetNode, KumuResult } from "@lararium/core";

// ---------------------------------------------------------------------------
// Adapter descriptor — machine-readable contract for each render target
// ---------------------------------------------------------------------------

export type RenderTargetRefresh =
  | "boot-snapshot"   // renders once at boot; reseed required to reflect carrier changes
  | "crdt-live"       // re-renders on every CRDT delta that touches the meme's carrierText
  | "on-demand";      // renders when the user navigates to the meme (detail panel pattern)

export interface RenderTargetAdapter {
  readonly id:       string;
  readonly platform: string;
  readonly input:    "widget-tree";      // always WidgetNode[] — enforced by this type
  readonly output:   string;
  readonly refresh:  RenderTargetRefresh;
  readonly notes?:   string;
}

/**
 * Canonical registry of all render target adapters.
 * Add a new entry here when wiring a new adapter — this is the single source of truth.
 */
export const RENDER_TARGET_ADAPTERS = {
  tldraw: {
    id:       "tldraw",
    platform: "tldraw canvas store",
    input:    "widget-tree",
    output:   "LarTLBodyNode[] → TLGeoShape[] via emitTldrawRecords()",
    refresh:  "boot-snapshot",
    notes:    "Structural skeleton only — kumu bodies NOT executed. " +
              "Body nodes visible at action zoom (showCarrier=true in templateProps). " +
              "Phase 4 target: live CRDT delta → shape update without reseed.",
  },
  react: {
    id:       "react",
    platform: "React DOM (MemeDetailPanel story river)",
    input:    "widget-tree",
    output:   "React.ReactNode via renderCarrier(ast, widgetMap)",
    refresh:  "on-demand",
    notes:    "Full kumu execution via executeBatch(). " +
              "Suspended kukali instances surface as ⏿ placeholders. " +
              "Re-executes on carrierText CRDT delta (TW5 selective refresh).",
  },
} as const satisfies Record<string, RenderTargetAdapter>;

export type RenderTargetId = keyof typeof RENDER_TARGET_ADAPTERS;

// ---------------------------------------------------------------------------
// Shared widget slot — the unit both adapters index from
// ---------------------------------------------------------------------------

/** One widget slot: the resolved WidgetNode and its async execution result (null = pending). */
export interface WidgetSlot {
  readonly widget: WidgetNode;
  readonly result: KumuResult | null;
}

/**
 * Build a pos→WidgetSlot index for O(1) lookup during the AST render walk.
 * Keyed on node.pos (byte offset) — unique within a single parse, stable across re-renders.
 * Both adapters use this index; the tldraw adapter builds it at projection time (sync),
 * the React adapter builds it after async kumu execution completes.
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

// ---------------------------------------------------------------------------
// Shared parse helper — carrier text → (ast, widgetTree) in one call.
// Use this instead of calling parseMemeCarrier + resolveWidgetTree separately
// to guarantee the AST passes through both adapters without re-parsing.
// ---------------------------------------------------------------------------

import { parseMemeCarrier, resolveWidgetTree } from "@lararium/core";
import type { KumuRegistry } from "@lararium/core";

export interface CarrierProjection {
  readonly ast:        readonly MemeAstNode[];
  readonly widgetTree: readonly WidgetNode[];
}

/**
 * Parse a carrier once and resolve its widget tree.
 * Callers that need both the AST (for the React adapter's renderCarrier) and
 * the widget tree (for both adapters) call this instead of parsing twice.
 */
export function projectCarrier(
  uri: string,
  carrierText: string,
  registry: KumuRegistry,
): CarrierProjection {
  const ast        = parseMemeCarrier(uri, carrierText);
  const widgetTree = resolveWidgetTree(ast, registry);
  return { ast, widgetTree };
}
