/**
 * Multi-view rendering — project all three Lararium views into one TldrawEmission.
 *
 * Produces three tldraw pages in a single emission:
 *   page:story-river   — default; topo-sorted closure as column of meme cards
 *   page:meme-detail   — focused on one meme URI (optionally pre-set)
 *   page:graph         — full DAG with all arrows, fit-to-all camera hint
 *
 * TiddlyWiki analogy:
 *   Each page corresponds to a render template tag ($:/tags/ViewTemplate).
 *   Page switching = setCurrentPage (no reload, no server resync).
 *   Camera per-page = independent viewport state (TW: independent story rivers).
 *
 * Usage:
 *   const emission = renderAllViews(artifact, { readText });
 *   // emission.pages has 3 entries; emit all to tldraw store
 *   // then nav helpers in nav.ts handle camera transitions
 */

import { type BootArtifact } from "@lararium/core";
import { projectToTldraw, type ProjectOptions } from "./project.js";
import { selectLayout, storyRiverLayout, memeDetailLayout, graphLayout, type LayoutStrategy } from "./layout.js";
import { emitTldrawRecords, type TldrawEmission } from "./tldraw-shapes.js";
import { type LarTLSnapshot, type LarTLPage, type LarTLFrame, type LarTLArrow, type LarTLNote, pageId } from "./records.js";
import { DEFAULT_PORTALS, DEFAULT_ROOMS, roomPageId } from "./room.js";
import { getIndicesAbove, type IndexKey } from "@tldraw/utils";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MultiViewOptions extends ProjectOptions {
  /** URI to pre-focus in the meme-detail view. If omitted, uses entry point. */
  focusUri?: string;
}

// ---------------------------------------------------------------------------
// renderAllViews
//
// Returns a merged TldrawEmission with pages for all three views.
// The tldraw store can ingest all pages; setCurrentPage() switches between them.
// ---------------------------------------------------------------------------

export function renderAllViews(artifact: BootArtifact, opts: MultiViewOptions = {}): TldrawEmission {
  const { focusUri, cascade: _unused, ...projOpts } = opts as MultiViewOptions & { cascade?: unknown };

  // Single projection snapshot (data layer, shared across all layouts)
  const snapshot = projectToTldraw(artifact, projOpts);

  // Story-river view (default page)
  const storyLayout = storyRiverLayout(snapshot);
  const storyEmission = emitTldrawRecords(snapshot, storyLayout, { pageOverride: pageId("minimal-boot") });

  // Meme-detail view — focused on focusUri or the entry point
  const detailUri = focusUri ?? artifact.entry;
  const detailSnapshot = focusSnapshot(snapshot, detailUri);
  const detailLayout = selectLayout(detailSnapshot, DETAIL_CASCADE);
  const detailEmission = emitTldrawRecords(detailSnapshot, detailLayout, { pageOverride: pageId("meme-detail") });

  // Graph view — all memes + all arrows, same projection but graph layout
  const graphSnap = snapshot;
  const graphLay = graphLayout(graphSnap);
  const graphEmission = emitTldrawRecords(graphSnap, graphLay, { pageOverride: pageId("graph") });

  // Portal shapes — placed at top of each page (y=-80, above all meme content)
  const portalShapes = emitPortalShapes();

  // Merge all emissions
  return {
    pages:    [...storyEmission.pages,    ...detailEmission.pages,    ...graphEmission.pages],
    shapes:   [...storyEmission.shapes,   ...detailEmission.shapes,   ...graphEmission.shapes, ...portalShapes] as TldrawEmission["shapes"],
    bindings: [...storyEmission.bindings, ...detailEmission.bindings, ...graphEmission.bindings],
  };
}

// ---------------------------------------------------------------------------
// emitPortalShapes — lar-portal custom shapes at the top of each page
// ---------------------------------------------------------------------------
// Derive room→page map from the single source of truth in room.ts
const ROOM_PAGE: Partial<Record<string, string>> = Object.fromEntries(
  DEFAULT_ROOMS.map((r) => [r.id, roomPageId(r)])
);

function emitPortalShapes(): unknown[] {
  const shapes: unknown[] = [];

  // Group portals by fromRoomId so we can stack them horizontally
  const byPage = new Map<string, typeof DEFAULT_PORTALS[number][]>();
  for (const portal of DEFAULT_PORTALS) {
    const tlPage = ROOM_PAGE[portal.fromRoomId];
    if (!tlPage) continue; // skip rooms without a live page
    if (!ROOM_PAGE[portal.toRoomId]) continue; // skip portals to unseeded rooms
    const list = byPage.get(tlPage) ?? [];
    list.push(portal);
    byPage.set(tlPage, list);
  }

  for (const [tlPageId, portals] of byPage) {
    const indices = getIndicesAbove("a0" as IndexKey, portals.length);
    portals.forEach((portal, i) => {
      // Use built-in "geo" shape (hexagon) — custom types are rejected by tldraw's
      // server-side schema validation on sync. Portal identity lives in meta.
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
          align:        "middle",
          verticalAlign: "middle",
          growY:        0,
          url:          "",
          scale:        1,
          labelColor:   "black",
        },
      });
    });
  }

  return shapes;
}

// ---------------------------------------------------------------------------
// focusSnapshot — filter snapshot to a single meme and its direct edges
// ---------------------------------------------------------------------------

function focusSnapshot(snapshot: LarTLSnapshot, focusUri: string): LarTLSnapshot {
  // Keep the focused meme frame + its ahu children + direct arrow neighbours
  const focusedFrames = snapshot.frames.filter(
    (f) => f.uri === focusUri || (f.frameKind === "ahu" && f.parentId !== null && snapshot.frames.find((m) => m.id === f.parentId && m.uri === focusUri))
  );
  const focusedIds = new Set(focusedFrames.map((f) => f.id));

  // Also include direct neighbour meme frames (reachable in one hop)
  const directArrows = snapshot.arrows.filter(
    (a) => focusedIds.has(a.fromFrameId) || focusedIds.has(a.toFrameId)
  );
  const neighbourFrameIds = new Set(directArrows.flatMap((a) => [a.fromFrameId, a.toFrameId]));
  const allFrames = snapshot.frames.filter((f) => focusedIds.has(f.id) || neighbourFrameIds.has(f.id));

  // Remap depth so focused meme is at depth 0
  const focusDepth = snapshot.frames.find((f) => f.uri === focusUri)?.depth ?? 0;
  const remapped: LarTLFrame[] = allFrames.map((f) => ({ ...f, depth: f.depth - focusDepth }));

  const detailPageId = pageId("meme-detail");
  const detailPage: LarTLPage = {
    type: "page",
    id: detailPageId,
    scope: "document",
    name: `Detail: ${focusUri.split("/").at(-1) ?? focusUri}`,
    compiledAt: snapshot.pages[0]?.compiledAt ?? new Date().toISOString(),
    memeCount: remapped.filter((f) => f.frameKind === "meme").length,
  };

  return {
    version: 1 as const,
    projectedAt: snapshot.projectedAt,
    pages: [detailPage],
    frames: remapped as readonly LarTLFrame[],
    arrows: directArrows as readonly LarTLArrow[],
    notes: snapshot.notes.filter((n) => focusedIds.has(n.parentFrameId)) as readonly LarTLNote[],
  };
}

// ---------------------------------------------------------------------------
// Detail cascade — meme-detail view uses story-river layout (zoomed in by camera)
// ---------------------------------------------------------------------------

const DETAIL_CASCADE: LayoutStrategy[] = [
  {
    name: "meme-detail",
    predicate: () => true,
    apply: memeDetailLayout,
  },
];
