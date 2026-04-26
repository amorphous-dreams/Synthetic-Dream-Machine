/**
 * Layout strategies for Lararium → tldraw projection.
 *
 * Separation of concerns (TiddlyWiki cascade analogy):
 *
 *   LarTLSnapshot   = the data (projection): what nodes and edges exist
 *   LarTLLayout     = the placement: where each node sits on the canvas
 *   LayoutStrategy  = a conditional template (predicate + apply)
 *   applyLayout()   = merge projection + layout into tldraw-ready shape records
 *
 * TiddlyWiki cascade pattern:
 *   strategies.find(s => s.predicate(snapshot))?.apply(snapshot) ?? storyRiver(snapshot)
 *
 * Current strategies (in priority order):
 *   1. storyRiverLayout  — default: topo-sorted columns by depth, meme frames as cards
 *
 * Future strategies (add to LAYOUT_CASCADE):
 *   - radialLayout      — entry point at center, edges as radii
 *   - tableLayout       — flat list view, one row per meme
 *   - transclusionLayout — zoomed view of a single meme with its ahu socket sub-frames
 */

import { type LarTLSnapshot, type LarTLFrame, type LarTLArrow } from "./records.js";

// ---------------------------------------------------------------------------
// Layout geometry types
// ---------------------------------------------------------------------------

export interface FrameGeometry {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface ArrowGeometry {
  /** Canvas-space start point */
  readonly startX: number;
  readonly startY: number;
  /** Canvas-space end point */
  readonly endX: number;
  readonly endY: number;
}

export interface LarTLLayout {
  readonly strategy: string;
  readonly frames: ReadonlyMap<string, FrameGeometry>;
  readonly arrows: ReadonlyMap<string, ArrowGeometry>;
}

// ---------------------------------------------------------------------------
// Layout strategy interface (TW cascade slot)
// ---------------------------------------------------------------------------

export interface LayoutStrategy {
  readonly name: string;
  predicate(snapshot: LarTLSnapshot): boolean;
  apply(snapshot: LarTLSnapshot): LarTLLayout;
}

// ---------------------------------------------------------------------------
// Story river layout — default strategy
//
// Visual model:
//   - x axis: topo depth (depth 0 = entry point, left edge)
//   - y axis: position within depth band (top-to-bottom)
//   - Meme frames: FRAME_W × FRAME_H, separated by FRAME_GAP_*
//   - Ahu socket sub-frames: stacked inside meme frame, left-padded
//   - Arrows: center-of-source-frame → center-of-target-frame (tldraw computes curve)
// ---------------------------------------------------------------------------

const FRAME_W     = 220;
const FRAME_H     = 100;
const AHU_W       = 180;
const AHU_H       = 36;
const AHU_PAD_X   = 20;
const AHU_PAD_Y   = 8;
const AHU_GAP     = 6;
const GAP_X       = 80;
const GAP_Y       = 24;
const CANVAS_OX   = 100; // origin offset
const CANVAS_OY   = 100;

export function storyRiverLayout(snapshot: LarTLSnapshot): LarTLLayout {
  const frameGeo = new Map<string, FrameGeometry>();
  const arrowGeo = new Map<string, ArrowGeometry>();

  // Group meme frames by depth
  const memeFrames = snapshot.frames.filter((f) => f.frameKind === "meme");
  const ahuFrames  = snapshot.frames.filter((f) => f.frameKind === "ahu");

  const byDepth = new Map<number, LarTLFrame[]>();
  for (const f of memeFrames) {
    const band = byDepth.get(f.depth) ?? [];
    band.push(f);
    byDepth.set(f.depth, band);
  }

  // Lay out meme frames column by column
  const depthX = new Map<number, number>(); // depth → canvas x
  let curX = CANVAS_OX;

  for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
    depthX.set(depth, curX);
    const band = byDepth.get(depth)!;
    let curY = CANVAS_OY;

    for (const frame of band) {
      // Count ahu children to size the meme frame vertically
      const children = ahuFrames.filter((a) => a.parentId === frame.id);
      const ahuBlock = children.length > 0
        ? AHU_PAD_Y + children.length * (AHU_H + AHU_GAP) + AHU_PAD_Y
        : 0;
      const h = Math.max(FRAME_H, FRAME_H + ahuBlock);

      frameGeo.set(frame.id, { x: curX, y: curY, w: FRAME_W, h });

      // Place ahu sub-frames inside the meme frame (local coords relative to parent)
      children.forEach((ahu, idx) => {
        frameGeo.set(ahu.id, {
          x: AHU_PAD_X,
          y: FRAME_H + AHU_PAD_Y + idx * (AHU_H + AHU_GAP),
          w: AHU_W,
          h: AHU_H,
        });
      });

      curY += h + GAP_Y;
    }

    curX += FRAME_W + GAP_X;
  }

  // Arrow geometry: center-to-center
  for (const arrow of snapshot.arrows) {
    const fromGeo = frameGeo.get(arrow.fromFrameId);
    const toGeo   = frameGeo.get(arrow.toFrameId);
    if (!fromGeo || !toGeo) continue;

    arrowGeo.set(arrow.id, {
      startX: fromGeo.x + fromGeo.w / 2,
      startY: fromGeo.y + fromGeo.h / 2,
      endX:   toGeo.x + toGeo.w / 2,
      endY:   toGeo.y + toGeo.h / 2,
    });
  }

  return {
    strategy: "story-river",
    frames: frameGeo,
    arrows: arrowGeo,
  };
}

// ---------------------------------------------------------------------------
// Meme detail layout — zoomed-in view of one meme and its direct neighbours
//
// Same column-by-depth algorithm as story river, but with larger frames and
// more spacing to make the focused meme comfortable at screen scale.
// The tldraw camera is expected to zoom to the focal frame after loading.
// ---------------------------------------------------------------------------

const DETAIL_FRAME_W = 320;
const DETAIL_FRAME_H = 160;
const DETAIL_GAP_X   = 120;
const DETAIL_GAP_Y   = 40;

export function memeDetailLayout(snapshot: LarTLSnapshot): LarTLLayout {
  const frameGeo = new Map<string, FrameGeometry>();
  const arrowGeo = new Map<string, ArrowGeometry>();

  const memeFrames = snapshot.frames.filter((f) => f.frameKind === "meme");
  const ahuFrames  = snapshot.frames.filter((f) => f.frameKind === "ahu");

  const byDepth = new Map<number, LarTLFrame[]>();
  for (const f of memeFrames) {
    const d = Math.round(f.depth); // depths are normalized by focusSnapshot
    const band = byDepth.get(d) ?? [];
    band.push(f);
    byDepth.set(d, band);
  }

  const depthX = new Map<number, number>();
  let curX = CANVAS_OX;
  for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
    depthX.set(depth, curX);
    const band = byDepth.get(depth)!;
    let curY = CANVAS_OY;
    for (const frame of band) {
      const children = ahuFrames.filter((a) => a.parentId === frame.id);
      const ahuBlock = children.length > 0
        ? AHU_PAD_Y + children.length * (AHU_H + AHU_GAP) + AHU_PAD_Y
        : 0;
      const h = Math.max(DETAIL_FRAME_H, DETAIL_FRAME_H + ahuBlock);
      frameGeo.set(frame.id, { x: curX, y: curY, w: DETAIL_FRAME_W, h });
      children.forEach((ahu, idx) => {
        frameGeo.set(ahu.id, {
          x: AHU_PAD_X,
          y: DETAIL_FRAME_H + AHU_PAD_Y + idx * (AHU_H + AHU_GAP),
          w: DETAIL_FRAME_W - AHU_PAD_X * 2,
          h: AHU_H,
        });
      });
      curY += h + DETAIL_GAP_Y;
    }
    curX += DETAIL_FRAME_W + DETAIL_GAP_X;
  }

  for (const arrow of snapshot.arrows) {
    const fromGeo = frameGeo.get(arrow.fromFrameId);
    const toGeo   = frameGeo.get(arrow.toFrameId);
    if (!fromGeo || !toGeo) continue;
    arrowGeo.set(arrow.id, {
      startX: fromGeo.x + fromGeo.w / 2,
      startY: fromGeo.y + fromGeo.h / 2,
      endX:   toGeo.x + toGeo.w / 2,
      endY:   toGeo.y + toGeo.h / 2,
    });
  }

  return { strategy: "meme-detail", frames: frameGeo, arrows: arrowGeo };
}

// ---------------------------------------------------------------------------
// Graph layout — full DAG, tighter horizontal spacing for overview
//
// Same depth-column algorithm but wider canvas. All arrows are always visible.
// Designed to be loaded into the "graph" tldraw page and zoomed to fit.
// ---------------------------------------------------------------------------

const GRAPH_FRAME_W  = 160;
const GRAPH_FRAME_H  = 80;
const GRAPH_GAP_X    = 60;
const GRAPH_GAP_Y    = 16;

export function graphLayout(snapshot: LarTLSnapshot): LarTLLayout {
  const frameGeo = new Map<string, FrameGeometry>();
  const arrowGeo = new Map<string, ArrowGeometry>();

  const memeFrames = snapshot.frames.filter((f) => f.frameKind === "meme");

  const byDepth = new Map<number, LarTLFrame[]>();
  for (const f of memeFrames) {
    const band = byDepth.get(f.depth) ?? [];
    band.push(f);
    byDepth.set(f.depth, band);
  }

  let curX = CANVAS_OX;
  for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
    const band = byDepth.get(depth)!;
    let curY = CANVAS_OY;
    for (const frame of band) {
      frameGeo.set(frame.id, { x: curX, y: curY, w: GRAPH_FRAME_W, h: GRAPH_FRAME_H });
      curY += GRAPH_FRAME_H + GRAPH_GAP_Y;
    }
    curX += GRAPH_FRAME_W + GRAPH_GAP_X;
  }

  for (const arrow of snapshot.arrows) {
    const fromGeo = frameGeo.get(arrow.fromFrameId);
    const toGeo   = frameGeo.get(arrow.toFrameId);
    if (!fromGeo || !toGeo) continue;
    arrowGeo.set(arrow.id, {
      startX: fromGeo.x + fromGeo.w / 2,
      startY: fromGeo.y + fromGeo.h / 2,
      endX:   toGeo.x + toGeo.w / 2,
      endY:   toGeo.y + toGeo.h / 2,
    });
  }

  return { strategy: "graph", frames: frameGeo, arrows: arrowGeo };
}

// ---------------------------------------------------------------------------
// Radial layout stub — Milestone 4
// ---------------------------------------------------------------------------

export function radialLayout(_snapshot: LarTLSnapshot): LarTLLayout {
  // TODO(M4): place entry point at center, edges as radii by family
  throw new Error("radialLayout not yet implemented");
}

// ---------------------------------------------------------------------------
// Layout cascade — TiddlyWiki-style ordered strategy selector
// ---------------------------------------------------------------------------

export const LAYOUT_CASCADE: LayoutStrategy[] = [
  {
    name: "story-river",
    predicate: () => true, // always matches — default
    apply: storyRiverLayout,
  },
];

/**
 * Select and apply the first matching layout strategy.
 * Mirrors TiddlyWiki's cascade: ordered predicate list, first match wins.
 */
export function selectLayout(
  snapshot: LarTLSnapshot,
  cascade: LayoutStrategy[] = LAYOUT_CASCADE,
): LarTLLayout {
  for (const strategy of cascade) {
    if (strategy.predicate(snapshot)) return strategy.apply(snapshot);
  }
  // Unreachable if cascade has a catch-all, but safe fallback
  return storyRiverLayout(snapshot);
}
