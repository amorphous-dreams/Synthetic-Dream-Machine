/**
 * canvas-projection.ts — CRDT-to-canvas projection layer.
 *
 * Architecture:
 *   LarPeer (CRDT stream)
 *     └─ peer.addProjection(canvasProjection)
 *          └─ MemeCanvasProjection.onUriChanged()
 *               └─ derives CanvasRecord[], emits CanvasPatch
 *                    └─ CanvasView.applyPatch()
 *                         └─ TldrawCanvasBinding (browser)
 *                              └─ editor.createShapes() / editor.updateShapes()
 *
 * This module is isomorphic — it has no tldraw runtime dependency.
 * TldrawCanvasBinding (in canvas-view.ts) is the browser-side adapter.
 *
 * Usage:
 *   const proj = new MemeCanvasProjection();
 *   peer.addProjection(proj);              // wire CRDT change stream
 *   proj.bindView(new TldrawCanvasBinding(editor));  // attach on editor mount
 *   // On editor unmount:
 *   proj.unbindView();
 */

import type { LarTiddlerChange } from "@lararium/core";
import type { MemeProjection }   from "@lararium/core";
import type { CanvasPatch }      from "./canvas-record.js";
import type { CanvasRecord }     from "./canvas-record.js";

/**
 * CanvasView — implemented by platform-specific view adapters.
 *
 * The browser implementation (TldrawCanvasBinding) translates CanvasRecord
 * diffs into tldraw editor calls using typed APIs — no store.put() hacks.
 *
 * Law: views are pull-only.  The tiddler store pushes CanvasPatch; the view
 * NEVER writes back to the CRDT store.  Write-back uses separate channels
 * tagged with ChangeOrigin "canvas-draft".
 */
export interface CanvasView {
  applyPatch(patch: CanvasPatch): void;
  dispose(): void;
}

/**
 * MemeCanvasProjection — MemeProjection that drives a CanvasView.
 *
 * Stub: Sprint 7 will implement full meme→frame, pranala→arrow derivation.
 * For now the projection accumulates known records and re-emits on change
 * so the view binding can be exercised end-to-end.
 */
export class MemeCanvasProjection implements MemeProjection {
  private _view: CanvasView | null = null;
  private readonly _known = new Map<string, CanvasRecord>();

  /**
   * Bind a view adapter.  Call on editor mount.
   * Replaces any previously bound view (calls dispose() on the old one first).
   */
  bindView(view: CanvasView): void {
    this._view?.dispose();
    this._view = view;
    // Push the full current state to the newly-bound view.
    if (this._known.size > 0) {
      this._view.applyPatch({
        added:   [...this._known.values()],
        updated: [],
        removed: [],
      });
    }
  }

  /**
   * Unbind the current view adapter.  Call on editor unmount.
   */
  unbindView(): void {
    this._view?.dispose();
    this._view = null;
  }

  // MemeProjection implementation -------------------------------------------

  onUriChanged(change: LarTiddlerChange): void {
    if (!change.title.startsWith("lar:")) return;
    // TODO Sprint 7: derive CanvasRecord from change.record and emit CanvasPatch.
    // For now: no-op. The stub allows the projection bus to be wired without
    // blocking on the full render algorithm.
    void change; // suppress unused-var lint
  }
}
