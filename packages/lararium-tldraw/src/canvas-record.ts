/**
 * canvas-record.ts — isomorphic, local-first canvas data model.
 *
 * Wiki-first law: tiddlers ARE the source of truth.  Canvas is a projection.
 *
 * CanvasRecord is the platform-agnostic intermediate form:
 *   MutableLarRecord  →  CanvasRecord[]   (pure function, no tldraw runtime)
 *   CanvasRecord      →  tldraw shapes    (TldrawCanvasBinding, browser-only)
 *
 * No tldraw IDs, no tldraw runtime types. All IDs are lar: URI strings so
 * they are safe to persist, diff, and serialize without a tldraw runtime.
 */

/** Shape kinds that the Lararium canvas understands. */
export type CanvasShapeKind =
  | "meme-frame"    // top-level meme card (maps to tldraw frame)
  | "ahu-frame"     // sub-frame inside a meme (ahu / agency-hold-unit)
  | "edge-arrow"    // directed edge between memes (maps to tldraw arrow)
  | "page-node";    // room or graph page node (maps to tldraw geo)

/**
 * CanvasRecord — one spatial element derived from a lar: tiddler.
 *
 * Positions (x, y, w, h) are in canvas coordinates.  The projection layer
 * reads them from tiddler fields (e.g. `canvas-x`, `canvas-y`) or computes
 * them from layout algorithms.  They are NOT stored in tldraw's own store.
 */
export interface CanvasRecord {
  /** Stable key — the lar: URI of the source tiddler.  Drives shape ID in tldraw. */
  readonly id:       string;
  readonly kind:     CanvasShapeKind;
  /** Source lar: URI (same as id for most kinds; explicit field for clarity). */
  readonly uri:      string;
  /** Enclosing meme URI for ahu-frames; null for top-level shapes. */
  readonly parentId: string | null;
  readonly label:    string;
  /** Tiddler rating field — drives color in the view layer. */
  readonly rating:   string;
  readonly x:        number;
  readonly y:        number;
  readonly w:        number;
  readonly h:        number;
  /** edge-arrow: source lar: URI. */
  readonly fromId?:  string;
  /** edge-arrow: target lar: URI. */
  readonly toId?:    string;
  /** Forwarded verbatim to shape.meta for click-handlers and zoom-template logic. */
  readonly meta:     Record<string, unknown>;
}

/**
 * CanvasPatch — incremental diff emitted by MemeCanvasProjection.
 *
 * Views implement applyPatch() to translate the diff into platform-specific
 * draw calls (e.g. editor.createShapes(), editor.updateShapes()).
 */
export interface CanvasPatch {
  readonly added:   readonly CanvasRecord[];
  readonly updated: readonly CanvasRecord[];
  /** IDs (lar: URIs) of records that were removed from the projection. */
  readonly removed: readonly string[];
}
