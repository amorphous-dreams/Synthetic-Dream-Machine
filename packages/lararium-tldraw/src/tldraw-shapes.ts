/**
 * Emit tldraw-ready shape records by merging a LarTLSnapshot with a LarTLLayout.
 *
 * Output shape records match tldraw's store format and are typed against the
 * actual @tldraw/tlschema types (re-exported via tldraw) so schema drift is
 * caught at compile time rather than at runtime.
 *
 * Records are fed to TLSocketRoom via the bootSnapshot seed path in serve.ts.
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
// Re-export convenience types callers may need
// ---------------------------------------------------------------------------

export type TLFrameRecord = TLFrameShape;
export type TLArrowRecord = TLArrowShape;
export type TLNoteRecord  = TLNoteShape;
export type TLPageRecord  = TLPage;
export type TLRecord = TLPageRecord | TLFrameRecord | TLArrowRecord | TLNoteRecord;

// ---------------------------------------------------------------------------
// Index key helpers (tldraw fractional indexing)
// ---------------------------------------------------------------------------

const nextIndexForParent = new Map<string, IndexKey>();

function pageIndexKey(n: number): IndexKey {
  const indices = getIndicesAbove(null, n);
  return indices[n - 1]!;
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
// emitTldrawRecords
// ---------------------------------------------------------------------------

export interface TldrawEmission {
  readonly pages:  readonly TLPageRecord[];
  readonly shapes: readonly TLRecord[];
}

export interface EmitOptions {
  /**
   * Override the page ID for all emitted shapes' parentId.
   * Used by multi-view rendering to place shapes on a specific page.
   * Shape IDs are scoped with the page slug to prevent collisions when
   * multiple views are merged into one store.
   */
  pageOverride?: string;
}

export function emitTldrawRecords(
  snapshot: LarTLSnapshot,
  layout:   LarTLLayout,
  emitOpts: EmitOptions = {},
): TldrawEmission {
  nextIndexForParent.clear();

  const pages:  TLPageRecord[] = [];
  const shapes: TLRecord[]     = [];

  // Shape ID scoping: keep shape: prefix valid, add per-page slug for uniqueness.
  // "shape:foo" → "shape:minimal_boot__foo" when pageOverride = "page:minimal-boot"
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
      name: page.name,
      index: pageIndexKey(idx + 1),
      meta: { compiledAt: page.compiledAt, memeCount: page.memeCount },
    });
  });

  const defaultPageId = (emitOpts.pageOverride ?? snapshot.pages[0]?.id ?? "page:default") as TLPage["id"];

  // -- Frame shapes (meme + ahu) ----------------------------------------------
  snapshot.frames.forEach((frame) => {
    const geo = layout.frames.get(frame.id);
    if (!geo) return;

    const parentId = (frame.parentId ? scopeId(frame.parentId) : defaultPageId) as TLFrameShape["parentId"];
    const color    = frame.frameKind === "ahu" ? "grey" : frameRatingColor(frame.rating);

    shapes.push({
      id:       scopeId(frame.id) as TLFrameShape["id"],
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

  // -- Arrow shapes -----------------------------------------------------------
  snapshot.arrows.forEach((arrow) => {
    const geo = layout.arrows.get(arrow.id);
    if (!geo) return;

    const label = [arrow.role, arrow.family].filter(Boolean).join(" · ");
    shapes.push({
      id:       scopeId(arrow.id) as TLArrowShape["id"],
      typeName: "shape",
      type:     "arrow",
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

  return { pages, shapes };
}
