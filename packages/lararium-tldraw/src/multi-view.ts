/**
 * Single-page rendering — one tldraw page per room, zoom-gated template switching.
 *
 * All meme entities live on one page with URI-stable shape IDs (no page-prefix scoping).
 * Shape meta carries templateProps for all 5 zoom levels; the zoom listener in
 * LarariumCanvas calls applyZoomTemplate() to batch-update shape props on threshold
 * crossings — no page switching required.
 *
 * The three-page "views in a trenchcoat" model is retired. Views are zoom levels:
 *   strategic   < 0.15   — dot-only galaxy
 *   operational 0.15–0.35 — compact labels, edge colors readable
 *   tactical    0.35–0.80 — story river (default)
 *   combat      0.80–1.50 — ahu sub-frames materialise around focused meme
 *   action      ≥ 1.50    — carrier text inline
 */

import { type BootArtifact } from "@lararium/core";
import { projectToTldraw, type ProjectOptions } from "./project.js";
import { storyRiverLayout } from "./layout.js";
import { emitTldrawRecords, type TldrawEmission } from "./tldraw-shapes.js";
import { pageId } from "./records.js";
import { DEFAULT_PORTALS } from "./room.js";
import { getIndicesAbove, type IndexKey } from "@tldraw/utils";
// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MultiViewOptions extends ProjectOptions {
  /** @deprecated — single-page model has no per-view focus. Ignored. */
  focusUri?: string;
}

// ---------------------------------------------------------------------------
// renderAllViews — single-page emission
// ---------------------------------------------------------------------------

export async function renderAllViews(artifact: BootArtifact, opts: MultiViewOptions = {}): Promise<TldrawEmission> {
  const { focusUri: _ignored, ...projOpts } = opts;

  const snapshot = projectToTldraw(artifact, projOpts);
  const layout = storyRiverLayout(snapshot);

  // Single page, no pageOverride — shape IDs are URI-stable by construction.
  const emission = emitTldrawRecords(snapshot, layout);

  // Portal shapes on the single page
  const portalShapes = emitPortalShapes(emission.pages[0]?.id ?? pageId("boot"));

  return {
    pages:    emission.pages,
    shapes:   [...emission.shapes, ...portalShapes] as TldrawEmission["shapes"],
    bindings: emission.bindings,
  };
}

// ---------------------------------------------------------------------------
// emitPortalShapes — lar-portal shapes on the single boot page
// ---------------------------------------------------------------------------

function emitPortalShapes(tlPageId: string): unknown[] {
  const shapes: unknown[] = [];
  // Only emit portals that originate from the boot room
  const bootPortals = DEFAULT_PORTALS.filter((p) => p.fromRoomId === "boot" || p.fromRoomId === "the-altar-fire");
  if (bootPortals.length === 0) return shapes;

  const indices = getIndicesAbove("a0" as IndexKey, bootPortals.length);
  bootPortals.forEach((portal, i) => {
    shapes.push({
      id:       `shape:portal_${portal.id.replace(/[^a-zA-Z0-9]/g, "_")}`,
      typeName: "shape",
      type:     "geo",
      parentId: tlPageId,
      index:    indices[i]!,
      x:        20 + i * 140,
      y:        -80,
      rotation: 0,
      isLocked: false,
      opacity:  1,
      meta:     { larPortal: true, targetRoomId: portal.toRoomId, label: portal.label },
      props: {
        geo:          "hexagon",
        w:            120,
        h:            36,
        color:        "blue",
        fill:         "semi",
        dash:         "draw",
        size:         "s",
        font:         "draw",
        richText:     {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: portal.label }] }],
        },
        align:         "middle",
        verticalAlign: "middle",
        growY:         0,
        url:           "",
        scale:         1,
        labelColor:    "black",
      },
    });
  });

  return shapes;
}

