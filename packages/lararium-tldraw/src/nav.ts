/**
 * nav.ts — Camera transition helpers for three-view Lararium UI.
 *
 * These functions accept the tldraw Editor instance directly (browser runtime).
 * They are separated from the projection layer so @lararium/node and
 * @lararium/core can import projection types without pulling in tldraw.
 *
 * Shape IDs: the canvas binding creates shapes with createShapeId(uri), so
 * the shape ID for a meme is always createShapeId(memeUri).
 *
 * Usage (in a browser component):
 *
 *   import { zoomToMeme, zoomToFitAll, switchToPage } from "@lararium/tldraw";
 *   import { viewStateReducer, INITIAL_VIEW_STATE }   from "@lararium/tldraw";
 *
 *   // Zoom into a meme (story-river → meme-detail)
 *   function onMemeClick(editor: Editor, uri: string) {
 *     viewState = viewStateReducer(viewState, { type: "ZOOM_IN", uri });
 *     zoomToMeme(editor, uri);
 *   }
 *
 *   // Zoom out (meme-detail → story-river)
 *   function onBack(editor: Editor) {
 *     viewState = viewStateReducer(viewState, { type: "ZOOM_OUT" });
 *     zoomToFitAll(editor);
 *   }
 *
 * TiddlyWiki analogy:
 *   zoomToMeme     = "zoom in" on a tiddler from click-origin rect
 *   zoomToFitAll   = "story river" reset — fit all cards in view
 *   switchToPage   = setCurrentPage (instantaneous, camera per page preserved)
 */

import type { Editor, TLPageId } from "tldraw";
import { createShapeId } from "tldraw";

// ---------------------------------------------------------------------------
// Re-exported structural type (backward-compat for importers that used
// TldrawEditorLike as a type annotation).  New code should use Editor directly.
// ---------------------------------------------------------------------------

/** @deprecated Import Editor from "tldraw" directly. */
export type TldrawEditorLike = Editor;

// ---------------------------------------------------------------------------
// Camera transition helpers
// ---------------------------------------------------------------------------

const ZOOM_DURATION_MS = 400;
const ZOOM_INSET_PX    = 72;

/**
 * Animate the tldraw camera to fill the viewport with the given meme frame.
 * The shape ID is derived via createShapeId(uri) — matching TldrawCanvasBinding.
 */
export function zoomToMeme(editor: Editor, uri: string): void {
  const frameId = createShapeId(uri);
  const bounds  = editor.getShapePageBounds(frameId);
  if (!bounds) return;
  editor.zoomToBounds(bounds, {
    inset:     ZOOM_INSET_PX,
    animation: { duration: ZOOM_DURATION_MS },
  });
}

/**
 * Animate the camera to fit all shapes on the current page.
 * Used to return from meme-detail to story-river.
 */
export function zoomToFitAll(editor: Editor): void {
  editor.zoomToFit({ animation: { duration: ZOOM_DURATION_MS } });
}

/**
 * Switch to a different tldraw page (no reload; camera per page preserved).
 * Accepts a full page ID string (e.g. "page:boot") or a bare seed (e.g. "boot").
 */
export function switchToPage(editor: Editor, pageIdOrSeed: string): void {
  const pageId: TLPageId = pageIdOrSeed.startsWith("page:")
    ? (pageIdOrSeed as TLPageId)
    : (`page:${pageIdOrSeed}` as TLPageId);
  if (editor.getCurrentPageId() === pageId) return;
  const exists = editor.getPages().some((p) => p.id === pageId);
  if (!exists) return;
  editor.setCurrentPage(pageId);
}

/**
 * Switch to the story-river page and reset camera to fit all.
 */
export function goToStoryRiver(editor: Editor, pageIdOrSeed = "page:boot"): void {
  switchToPage(editor, pageIdOrSeed);
  // Small delay allows tldraw to settle before zooming.
  setTimeout(() => zoomToFitAll(editor), 50);
}

/**
 * Switch to the graph overview page and fit all.
 */
export function goToGraph(editor: Editor): void {
  switchToPage(editor, "page:graph");
  setTimeout(() => zoomToFitAll(editor), 50);
}

/**
 * Switch to a room page by room ID and fit all shapes.
 * Room pages use IDs of the form "page:{roomId}".
 */
export function goToRoom(editor: Editor, roomId: string): void {
  switchToPage(editor, `page:${roomId}`);
  setTimeout(() => zoomToFitAll(editor), 50);
}
