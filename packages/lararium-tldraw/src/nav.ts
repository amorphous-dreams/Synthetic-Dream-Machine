/**
 * nav.ts — Camera transition helpers for three-view Lararium UI.
 *
 * These functions expect a tldraw Editor instance (browser runtime).
 * They are intentionally separated from the pure projection layer so that
 * lararium-node and lararium-core can import projection types without pulling
 * in any tldraw runtime dependency.
 *
 * Usage (in a browser component):
 *
 *   import { zoomToMeme, zoomToFitAll, switchToPage } from "@lararium/tldraw/nav";
 *   import { viewStateReducer, INITIAL_VIEW_STATE } from "@lararium/tldraw/view-state";
 *
 *   let viewState = INITIAL_VIEW_STATE;
 *
 *   // Zoom into a meme (story-river → meme-detail)
 *   function onMemeClick(editor: TldrawEditor, uri: string) {
 *     const frameId = memeFrameId(uri);
 *     const bounds = editor.getShapePageBounds(frameId as ShapeId);
 *     viewState = viewStateReducer(viewState, {
 *       type: "ZOOM_IN",
 *       uri,
 *       fromRect: bounds ? { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h } : null,
 *     });
 *     zoomToMeme(editor, frameId);
 *   }
 *
 *   // Zoom out (meme-detail → story-river)
 *   function onBack(editor: TldrawEditor) {
 *     viewState = viewStateReducer(viewState, { type: "ZOOM_OUT" });
 *     zoomToFitAll(editor);
 *   }
 *
 *   // Switch to graph view
 *   function onOpenGraph(editor: TldrawEditor) {
 *     viewState = viewStateReducer(viewState, { type: "OPEN_GRAPH" });
 *     switchToPage(editor, "page:graph");
 *   }
 *
 * TiddlyWiki analogy:
 *   zoomToMeme     = "zoom in" on a tiddler from click-origin rect ($:/HistoryList fromPageRect)
 *   zoomToFitAll   = "story river" reset — fit all cards in view
 *   switchToPage   = setCurrentPage (instantaneous, camera state per page preserved)
 */

import { type LarProjectionId, memeFrameId } from "./records.js";

// ---------------------------------------------------------------------------
// Structural type for tldraw Editor (subset we actually call)
// Avoids importing @tldraw/tldraw at compile time — works as a duck type.
// ---------------------------------------------------------------------------

export interface TldrawEditorLike {
  zoomToBounds(
    bounds: { x: number; y: number; w: number; h: number },
    opts?: { inset?: number; animation?: { duration?: number } },
  ): void;
  getShapePageBounds(id: string): { x: number; y: number; w: number; h: number } | undefined;
  setCurrentPage(pageId: string): void;
  getCurrentPageId(): string;
  zoomToFit(opts?: { animation?: { duration?: number } }): void;
  getPages(): { id: string }[];
}

// ---------------------------------------------------------------------------
// Camera transition helpers
// ---------------------------------------------------------------------------

const ZOOM_DURATION_MS = 400;
const ZOOM_INSET_PX    = 72;

/**
 * Animate the tldraw camera to fill the viewport with the given meme frame.
 * Equivalent to TW's "zoom in" from click-origin.
 */
export function zoomToMeme(
  editor: TldrawEditorLike,
  frameIdOrUri: string,
): void {
  // Accept either a raw LarProjectionId or a lar:/// URI
  const frameId: LarProjectionId = frameIdOrUri.startsWith("lar:")
    ? memeFrameId(frameIdOrUri)
    : (frameIdOrUri as LarProjectionId);

  const bounds = editor.getShapePageBounds(frameId);
  if (!bounds) return;

  editor.zoomToBounds(bounds, {
    inset: ZOOM_INSET_PX,
    animation: { duration: ZOOM_DURATION_MS },
  });
}

/**
 * Animate the camera to fit all shapes on the current page.
 * Used to return from meme-detail to story-river.
 */
export function zoomToFitAll(editor: TldrawEditorLike): void {
  editor.zoomToFit({ animation: { duration: ZOOM_DURATION_MS } });
}

/**
 * Switch to a different tldraw page (no reload, camera per-page preserved).
 * Equivalent to TW's story-river template switch.
 */
export function switchToPage(editor: TldrawEditorLike, pageId: string): void {
  if (editor.getCurrentPageId() === pageId) return;
  const exists = editor.getPages().some((p) => p.id === pageId);
  if (!exists) return;
  editor.setCurrentPage(pageId);
}

/**
 * Switch to the story-river page and reset camera to fit all.
 */
export function goToStoryRiver(editor: TldrawEditorLike, pageId = "page:boot"): void {
  switchToPage(editor, pageId);
  // Small delay allows tldraw to settle before zooming
  setTimeout(() => zoomToFitAll(editor), 50);
}

/**
 * Switch to the graph overview page and fit all.
 */
export function goToGraph(editor: TldrawEditorLike): void {
  switchToPage(editor, "page:graph");
  setTimeout(() => zoomToFitAll(editor), 50);
}

/**
 * Switch to a room page by room ID and fit all shapes.
 * Rooms are projected to tldraw pages with IDs matching `pageId(room.id)`.
 */
export function goToRoom(editor: TldrawEditorLike, roomId: string): void {
  switchToPage(editor, `page:${roomId}`);
  setTimeout(() => zoomToFitAll(editor), 50);
}
