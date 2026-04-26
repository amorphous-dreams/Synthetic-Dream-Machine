/**
 * Emit tldraw-ready shape records by merging a LarTLSnapshot with a LarTLLayout.
 *
 * Output shape records match tldraw's store format:
 *   { id, typeName: 'shape', type, x, y, rotation, index, parentId, props, meta }
 *
 * These records can be fed directly to tldraw's store.put() or loadSnapshot().
 * No tldraw runtime import — types are structural duplicates from tlschema study.
 *
 * Caller decides whether to use editor.createShapes() (live session) or
 * loadSnapshot({ document: { shapes, pages } }) (cold load).
 */

import { type LarTLSnapshot, type LarTLPage, type LarProjectionId } from "./records.js";
import { type LarTLLayout, type FrameGeometry } from "./layout.js";

// ---------------------------------------------------------------------------
// Minimal structural tldraw types (no runtime import required)
// ---------------------------------------------------------------------------

export interface TLShapeBase {
  readonly id: string;
  readonly typeName: "shape";
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly index: string;
  readonly parentId: string;
  readonly isLocked: boolean;
  readonly opacity: number;
  readonly meta: Record<string, unknown>;
}

export interface TLFrameRecord extends TLShapeBase {
  readonly type: "frame";
  readonly props: {
    readonly w: number;
    readonly h: number;
    readonly name: string;
    readonly color: string;
  };
}

export interface TLArrowRecord extends TLShapeBase {
  readonly type: "arrow";
  readonly props: {
    readonly start: { x: number; y: number };
    readonly end: { x: number; y: number };
    readonly bend: number;
    readonly color: string;
    readonly size: string;
    readonly dash: string;
    readonly arrowheadStart: string;
    readonly arrowheadEnd: string;
    readonly richText: { type: "doc"; content: Array<{ type: "paragraph"; content?: Array<{ type: "text"; text: string }> }> };
    readonly labelPosition: number;
    readonly scale: number;
  };
}

export interface TLNoteRecord extends TLShapeBase {
  readonly type: "note";
  readonly props: {
    readonly color: string;
    readonly size: string;
    readonly richText: { type: "doc"; content: Array<{ type: "paragraph"; content?: Array<{ type: "text"; text: string }> }> };
    readonly align: string;
    readonly verticalAlign: string;
    readonly growY: number;
    readonly url: string;
    readonly scale: number;
  };
}

export interface TLPageRecord {
  readonly id: string;
  readonly typeName: "page";
  readonly name: string;
  readonly index: string;
  readonly meta: Record<string, unknown>;
}

export type TLRecord = TLPageRecord | TLFrameRecord | TLArrowRecord | TLNoteRecord;

// ---------------------------------------------------------------------------
// Index key helpers (tldraw uses fractional indexing 'a1', 'a2', ...)
// ---------------------------------------------------------------------------

function indexKey(n: number): string {
  // Minimal fractional index: a1, a2, ... a9, aA, ... sufficient for our counts
  return `a${n.toString(36)}`;
}

// ---------------------------------------------------------------------------
// Color mapping: family → tldraw color name
// ---------------------------------------------------------------------------

const FAMILY_COLORS: Record<string, string> = {
  control: "blue",
  relation: "grey",
  observe: "green",
  dataflow: "orange",
};

function familyColor(family: string): string {
  return FAMILY_COLORS[family] ?? "grey";
}

// ---------------------------------------------------------------------------
// Rich text helper (tldraw's richText format)
// ---------------------------------------------------------------------------

function richText(text: string) {
  return {
    type: "doc" as const,
    content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text }] }],
  };
}

// ---------------------------------------------------------------------------
// emitTldrawRecords — merge snapshot + layout → store-ready records
// ---------------------------------------------------------------------------

export interface TldrawEmission {
  readonly pages: readonly TLPageRecord[];
  readonly shapes: readonly TLRecord[];
}

export function emitTldrawRecords(
  snapshot: LarTLSnapshot,
  layout: LarTLLayout,
): TldrawEmission {
  const pages: TLPageRecord[] = [];
  const shapes: TLRecord[]    = [];

  // Pages
  snapshot.pages.forEach((page: LarTLPage, idx: number) => {
    pages.push({
      id: page.id,
      typeName: "page",
      name: page.name,
      index: indexKey(idx + 1),
      meta: { compiledAt: page.compiledAt, memeCount: page.memeCount },
    });
  });

  const defaultPageId = snapshot.pages[0]?.id ?? "page:default";

  // Frame shapes (meme + ahu)
  snapshot.frames.forEach((frame, idx) => {
    const geo = layout.frames.get(frame.id);
    if (!geo) return; // no layout position — skip

    const parentId = frame.parentId ?? defaultPageId;
    const color = frame.frameKind === "ahu" ? "grey" : frameRatingColor(frame.rating);

    shapes.push({
      id: frame.id,
      typeName: "shape",
      type: "frame",
      x: geo.x,
      y: geo.y,
      rotation: 0,
      index: indexKey(idx + 1),
      parentId,
      isLocked: false,
      opacity: 1,
      meta: { uri: frame.uri, frameKind: frame.frameKind, implements: frame.implements },
      props: { w: geo.w, h: geo.h, name: frame.name, color },
    } satisfies TLFrameRecord);
  });

  // Arrow shapes
  snapshot.arrows.forEach((arrow, idx) => {
    const geo = layout.arrows.get(arrow.id);
    if (!geo) return;

    const label = [arrow.role, arrow.family].filter(Boolean).join(" · ");
    shapes.push({
      id: arrow.id,
      typeName: "shape",
      type: "arrow",
      x: geo.startX,
      y: geo.startY,
      rotation: 0,
      index: indexKey(10000 + idx),
      parentId: defaultPageId,
      isLocked: false,
      opacity: 1,
      meta: { family: arrow.family, role: arrow.role },
      props: {
        start: { x: 0, y: 0 },
        end: { x: geo.endX - geo.startX, y: geo.endY - geo.startY },
        bend: 0,
        color: familyColor(arrow.family),
        size: "s",
        dash: "draw",
        arrowheadStart: "none",
        arrowheadEnd: "arrow",
        richText: richText(label),
        labelPosition: 0.5,
        scale: 1,
      },
    } satisfies TLArrowRecord);
  });

  // Note shapes (metadata)
  snapshot.notes.forEach((note, idx) => {
    const parentGeo: FrameGeometry | undefined = layout.frames.get(note.parentFrameId as LarProjectionId);
    if (!parentGeo) return;

    shapes.push({
      id: note.id,
      typeName: "shape",
      type: "note",
      x: 8,
      y: 8,
      rotation: 0,
      index: indexKey(20000 + idx),
      parentId: note.parentFrameId,
      isLocked: false,
      opacity: 1,
      meta: {},
      props: {
        color: "yellow",
        size: "s",
        richText: richText(note.text),
        align: "start",
        verticalAlign: "start",
        growY: 0,
        url: "",
        scale: 0.8,
      },
    } satisfies TLNoteRecord);
  });

  return { pages, shapes };
}

function frameRatingColor(rating: string): string {
  if (rating.includes("typed")) return "blue";
  if (rating === "meme") return "violet";
  if (rating === "data") return "grey";
  return "black";
}
