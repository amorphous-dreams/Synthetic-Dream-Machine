/**
 * canvas-view.ts — browser-side canvas view binding.
 *
 * TldrawCanvasBinding translates CanvasPatch into tldraw editor calls using
 * the typed tldraw API — no store.put() hacks, no branded-ID casts.
 *
 * Isomorphism law: this file is the ONLY file in @lararium/tldraw that imports
 * the tldraw runtime.  All upstream code (canvas-record.ts,
 * canvas-projection.ts, nav.ts) uses only types that are safe in Node / tests.
 *
 * Usage:
 *   import type { Editor } from "tldraw";
 *   import { TldrawCanvasBinding } from "@lararium/tldraw";
 *
 *   // In onMount callback:
 *   canvasProjection.bindView(new TldrawCanvasBinding(editor));
 *
 *   // In onUnmount / cleanup:
 *   canvasProjection.unbindView();
 */

import type { Editor } from "tldraw";
import { createShapeId } from "tldraw";
import type { CanvasView }   from "./canvas-projection.js";
import type { CanvasPatch, CanvasRecord } from "./canvas-record.js";

/**
 * TldrawCanvasBinding — CanvasView implemented against the tldraw Editor API.
 *
 * Uses editor.createShapes() / editor.updateShapes() / editor.deleteShapes()
 * with properly typed shape IDs (createShapeId) — never store.put().
 *
 * Stub: Sprint 7 will implement the full CanvasRecord → TLShape translation.
 */
export class TldrawCanvasBinding implements CanvasView {
  constructor(private readonly _editor: Editor) {}

  applyPatch(patch: CanvasPatch): void {
    const { added, updated, removed } = patch;

    if (removed.length > 0) {
      // createShapeId derives the same branded ID used at creation time.
      this._editor.deleteShapes(removed.map((id) => createShapeId(id)));
    }

    if (added.length > 0) {
      // TODO Sprint 7: map CanvasRecord kind → TLShapePartial with correct props.
      // Stub: create geo shapes as placeholders so the wiring is exercised.
      this._editor.createShapes(
        added.map((r) => recordToShapePartial(r)),
      );
    }

    if (updated.length > 0) {
      this._editor.updateShapes(
        updated.map((r) => recordToShapeUpdate(r)),
      );
    }
  }

  dispose(): void {
    // No persistent resources to clean up in the current stub.
  }
}

// ---------------------------------------------------------------------------
// Private helpers — CanvasRecord → tldraw shape descriptors
// ---------------------------------------------------------------------------

/**
 * Convert a CanvasRecord to a createShapes()-compatible partial.
 * Sprint 7: expand this to emit frame / arrow / geo with correct props per kind.
 */
function recordToShapePartial(
  r: CanvasRecord,
): Parameters<Editor["createShapes"]>[0][number] {
  return {
    id:   createShapeId(r.id),
    type: "geo",
    x:    r.x,
    y:    r.y,
    meta: { uri: r.uri, frameKind: r.kind, rating: r.rating, ...r.meta },
    props: { w: r.w, h: r.h, geo: "rectangle" },
  };
}

/**
 * Convert a CanvasRecord to an updateShapes()-compatible partial.
 */
function recordToShapeUpdate(
  r: CanvasRecord,
): Parameters<Editor["updateShapes"]>[0][number] {
  return {
    id:   createShapeId(r.id),
    type: "geo",
    x:    r.x,
    y:    r.y,
    meta: { uri: r.uri, frameKind: r.kind, rating: r.rating, ...r.meta },
    props: { w: r.w, h: r.h },
  };
}
