/**
 * Emit tldraw-ready shape + binding records from a LarTLSnapshot + LarTLLayout.
 *
 * Key design: arrows use TLArrowBinding records (fromId = arrowId, toId = frameId)
 * so dragging a meme frame automatically moves all connected pranala arrows —
 * Kinopio-style live-connected graph behaviour via tldraw's native binding system.
 *
 * Records feed TLSocketRoom via the bootSnapshot seed path in serve.ts.
 */

import type {
  TLArrowShape,
  TLFrameShape,
  TLNoteShape,
  TLPage,
} from "tldraw";
import { getIndexAbove, getIndicesAbove, type IndexKey } from "@tldraw/utils";
import { type LarTLSnapshot, type LarTLPage, type LarProjectionId } from "./records.js";
import { type LarTLLayout, type FrameGeometry } from "./layout.js";

// ---------------------------------------------------------------------------
// Re-export convenience types
// ---------------------------------------------------------------------------

export type TLFrameRecord  = TLFrameShape;
export type TLArrowRecord  = TLArrowShape;
export type TLNoteRecord   = TLNoteShape;
export type TLPageRecord   = TLPage;
export type TLRecord = TLPageRecord | TLFrameRecord | TLArrowRecord | TLNoteRecord;

/** Minimal binding record shape — matches tldraw's TLArrowBinding at runtime. */
export interface TLArrowBindingRecord {
  readonly typeName: "binding";
  readonly type:     "arrow";
  readonly id:       string;
  readonly fromId:   string;   // arrow shape id
  readonly toId:     string;   // bound frame shape id
  readonly meta:     Record<string, unknown>;
  readonly props: {
    readonly terminal:          "start" | "end";
    readonly normalizedAnchor:  { x: number; y: number };
    readonly isExact:           boolean;
    readonly isPrecise:         boolean;
  };
}

// ---------------------------------------------------------------------------
// Index key helpers
// ---------------------------------------------------------------------------

const nextIndexForParent = new Map<string, IndexKey>();

function pageIndexKey(n: number): IndexKey {
  return getIndicesAbove(null, n)[n - 1]!;
}

function shapeIndex(parentId: string): IndexKey {
  const previous = nextIndexForParent.get(parentId) ?? ("a0" as IndexKey);
  const next = getIndexAbove(previous);
  nextIndexForParent.set(parentId, next);
  return next;
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

type TLColor =
  | "black" | "grey" | "light-violet" | "violet" | "blue" | "light-blue"
  | "yellow" | "orange" | "green" | "light-green" | "light-red" | "red" | "white";

const FAMILY_COLORS: Record<string, TLColor> = {
  control:  "blue",
  relation: "grey",
  observe:  "green",
  dataflow: "orange",
};

function familyColor(family: string): TLColor {
  return FAMILY_COLORS[family] ?? "grey";
}

function frameRatingColor(rating: string): TLColor {
  if (rating.includes("typed")) return "blue";
  if (rating === "meme")        return "violet";
  if (rating === "data")        return "grey";
  return "black";
}

// ---------------------------------------------------------------------------
// Rich text helper
// ---------------------------------------------------------------------------

function richText(text: string): TLArrowShape["props"]["richText"] {
  return {
    type: "doc" as const,
    content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text }] }],
  };
}

// ---------------------------------------------------------------------------
// Binding ID counter
// ---------------------------------------------------------------------------

let _bindingSeq = 0;
function nextBindingId(): string {
  return `binding:lararium-${++_bindingSeq}`;
}

// ---------------------------------------------------------------------------
// emitTldrawRecords
// ---------------------------------------------------------------------------

export interface TldrawEmission {
  readonly pages:    readonly TLPageRecord[];
  readonly shapes:   readonly TLRecord[];
  readonly bindings: readonly TLArrowBindingRecord[];
}

export interface EmitOptions {
  /**
   * Override the page ID for all emitted shapes' parentId.
   * Used by multi-view rendering to place shapes on a specific page.
   */
  pageOverride?: string;
}

export function emitTldrawRecords(
  snapshot: LarTLSnapshot,
  layout:   LarTLLayout,
  emitOpts: EmitOptions = {},
): TldrawEmission {
  nextIndexForParent.clear();
  _bindingSeq = 0;

  const pages:    TLPageRecord[]          = [];
  const shapes:   TLRecord[]              = [];
  const bindings: TLArrowBindingRecord[]  = [];

  // Shape ID scoping — keep "shape:" prefix, add per-page slug for uniqueness
  const pageSlug = emitOpts.pageOverride
    ? emitOpts.pageOverride.replace(/^page:/, "").replace(/[^a-zA-Z0-9]/g, "_")
    : null;

  function scopeId(id: string): string {
    if (!pageSlug) return id;
    return id.replace(/^shape:/, `shape:${pageSlug}__`);
  }

  // -- Pages ------------------------------------------------------------------
  snapshot.pages.forEach((page: LarTLPage, idx: number) => {
    const id = (emitOpts.pageOverride ?? page.id) as TLPage["id"];
    pages.push({
      id,
      typeName: "page",
      name:     page.name,
      index:    pageIndexKey(idx + 1),
      meta:     { compiledAt: page.compiledAt, memeCount: page.memeCount },
    });
  });

  const defaultPageId = (emitOpts.pageOverride ?? snapshot.pages[0]?.id ?? "page:default") as TLPage["id"];

  // -- Frame shapes (meme + ahu) ----------------------------------------------
  // Build a map from snapshot frame id → scoped shape id for binding lookup
  const frameIdToScopedId = new Map<string, string>();

  snapshot.frames.forEach((frame) => {
    const geo = layout.frames.get(frame.id);
    if (!geo) return;

    const scopedId = scopeId(frame.id);
    frameIdToScopedId.set(frame.id, scopedId);

    const parentId = (frame.parentId ? scopeId(frame.parentId) : defaultPageId) as TLFrameShape["parentId"];
    const color    = frame.frameKind === "ahu" ? "grey" : frameRatingColor(frame.rating);

    shapes.push({
      id:       scopedId as TLFrameShape["id"],
      typeName: "shape",
      type:     "frame",
      x:        geo.x,
      y:        geo.y,
      rotation: 0,
      index:    shapeIndex(parentId),
      parentId,
      isLocked: false,
      opacity:  1,
      meta:     { uri: frame.uri, frameKind: frame.frameKind, implements: [...frame.implements] },
      props: {
        w:     geo.w,
        h:     geo.h,
        name:  frame.name,
        color,
      },
    } satisfies TLFrameShape);
  });

  // -- Arrow shapes + bindings -----------------------------------------------
  // Each pranala arrow gets:
  //   - An arrow shape with start/end at {0,0} — tldraw ignores these when bindings exist
  //   - Two TLArrowBinding records (one for "start", one for "end") linking to source/target frames
  //   - This makes dragging any frame pull its connected arrows along automatically

  snapshot.arrows.forEach((arrow) => {
    const geo = layout.arrows.get(arrow.id);
    if (!geo) return;

    const arrowId    = scopeId(arrow.id) as TLArrowShape["id"];
    const label      = [arrow.role, arrow.family].filter(Boolean).join(" · ");
    const sourceId   = frameIdToScopedId.get(arrow.fromFrameId);
    const targetId   = frameIdToScopedId.get(arrow.toFrameId);

    shapes.push({
      id:       arrowId,
      typeName: "shape",
      type:     "arrow",
      // Position arrow at source frame centroid; tldraw recomputes via bindings
      x:        geo.startX,
      y:        geo.startY,
      rotation: 0,
      index:    shapeIndex(defaultPageId),
      parentId: defaultPageId,
      isLocked: false,
      opacity:  1,
      meta:     { family: arrow.family, role: arrow.role },
      props: {
        kind:           "arc",
        // start/end vectors are placeholders — overridden by bindings at render time
        start:          { x: 0, y: 0 },
        end:            { x: geo.endX - geo.startX, y: geo.endY - geo.startY },
        bend:           0,
        elbowMidPoint:  0.5,
        color:          familyColor(arrow.family),
        labelColor:     "black",
        fill:           "none",
        dash:           "draw",
        size:           "s",
        font:           "draw",
        arrowheadStart: "none",
        arrowheadEnd:   "arrow",
        richText:       richText(label),
        labelPosition:  0.5,
        scale:          1,
      },
    } satisfies TLArrowShape);

    // Bind start → source frame (center anchor)
    if (sourceId) {
      bindings.push({
        typeName: "binding",
        type:     "arrow",
        id:       nextBindingId(),
        fromId:   arrowId,
        toId:     sourceId,
        meta:     {},
        props: {
          terminal:         "start",
          normalizedAnchor: { x: 0.5, y: 0.5 },
          isExact:          false,
          isPrecise:        false,
        },
      });
    }

    // Bind end → target frame (center anchor)
    if (targetId) {
      bindings.push({
        typeName: "binding",
        type:     "arrow",
        id:       nextBindingId(),
        fromId:   arrowId,
        toId:     targetId,
        meta:     {},
        props: {
          terminal:         "end",
          normalizedAnchor: { x: 0.5, y: 0.5 },
          isExact:          false,
          isPrecise:        false,
        },
      });
    }
  });

  // -- Note shapes ------------------------------------------------------------
  snapshot.notes.forEach((note) => {
    const parentGeo: FrameGeometry | undefined = layout.frames.get(note.parentFrameId as LarProjectionId);
    if (!parentGeo) return;

    const scopedParentId = scopeId(note.parentFrameId) as TLNoteShape["parentId"];
    shapes.push({
      id:       scopeId(note.id) as TLNoteShape["id"],
      typeName: "shape",
      type:     "note",
      x:        8,
      y:        8,
      rotation: 0,
      index:    shapeIndex(scopedParentId),
      parentId: scopedParentId,
      isLocked: false,
      opacity:  1,
      meta:     {},
      props: {
        color:              "yellow",
        labelColor:         "black",
        size:               "s",
        font:               "draw",
        fontSizeAdjustment: 0,
        align:              "start",
        verticalAlign:      "start",
        growY:              0,
        url:                "",
        richText:           richText(note.text),
        scale:              1,
      },
    } satisfies TLNoteShape);
  });

  return { pages, shapes, bindings };
}
