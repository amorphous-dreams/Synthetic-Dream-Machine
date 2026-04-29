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
  TLGeoShape,
  TLNoteShape,
  TLPage,
} from "tldraw";
import { getIndexAbove, getIndicesAbove, type IndexKey } from "@tldraw/utils";
import { RATING_COLOR, type Rating5 } from "@lararium/core";
import { type LarTLSnapshot, type LarTLPage, type LarProjectionId } from "./records.js";
import { type LarTLLayout, type FrameGeometry } from "./layout.js";

// ---------------------------------------------------------------------------
// Re-export convenience types
// ---------------------------------------------------------------------------

export type TLFrameRecord  = TLFrameShape;
export type TLArrowRecord  = TLArrowShape;
export type TLNoteRecord   = TLNoteShape;
export type TLGeoRecord    = TLGeoShape;
export type TLPageRecord   = TLPage;
export type TLRecord = TLPageRecord | TLFrameRecord | TLArrowRecord | TLNoteRecord | TLGeoRecord;

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
    readonly snap:              "center" | "edge-point" | "edge" | "none";
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

// All eight pranala families — matches KNOWN_FAMILIES in pranala-parser.ts.
const FAMILY_COLORS: Record<string, TLColor> = {
  control:    "blue",
  relation:   "grey",
  observe:    "green",
  dataflow:   "orange",
  message:    "yellow",
  constraint: "red",
  reaction:   "light-green",
  spatial:    "light-blue",
};

function familyColor(family: string): TLColor {
  return FAMILY_COLORS[family] ?? "grey";
}

function frameRatingColor(rating: string): TLColor {
  const color = RATING_COLOR[rating as Rating5];
  return (color as TLColor | undefined) ?? "black";
}

// ---------------------------------------------------------------------------
// Rich text helper
// ---------------------------------------------------------------------------

function richText(text: string): TLArrowShape["props"]["richText"] {
  // ProseMirror forbids empty text nodes — use an empty paragraph when text is blank.
  if (!text) {
    return { type: "doc" as const, content: [{ type: "paragraph" as const }] };
  }
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
      isLocked: frame.frameKind === "ahu",
      opacity:  1,
      meta:     { uri: frame.uri, frameKind: frame.frameKind, implements: [...frame.implements], ...(frame.carrierText !== undefined && { carrierText: frame.carrierText }), ...(frame.templateProps !== undefined && { templateProps: JSON.parse(JSON.stringify(frame.templateProps)) }) },
      props: {
        w:     geo.w,
        h:     geo.h,
        name:  frame.name,
        color,
      },
    } satisfies TLFrameShape);
  });

  // -- Socket port shapes ----------------------------------------------------
  // One tiny locked geo dot per ahu slot. Arrows bind to these instead of ahu frames
  // so bindings never change across zoom levels — only socket positions move.

  snapshot.sockets?.forEach((socket) => {
    const geo = layout.sockets.get(socket.id);
    if (!geo) return;

    const scopedId   = scopeId(socket.id);
    const scopedParent = scopeId(socket.parentId) as TLGeoShape["parentId"];

    // Register in binding lookup so arrows can find it
    frameIdToScopedId.set(socket.id, scopedId);

    shapes.push({
      id:       scopedId as TLGeoShape["id"],
      typeName: "shape",
      type:     "geo",
      // Start at center position (strategic zoom default)
      x:        geo.centerX,
      y:        geo.centerY,
      rotation: 0,
      index:    shapeIndex(scopedParent),
      parentId: scopedParent,
      isLocked: false,
      opacity:  0,
      meta: {
        socketKind: "port",
        slotId:     socket.slotId,
        memeUri:    socket.memeUri,
        centerX:    geo.centerX,
        centerY:    geo.centerY,
        spreadX:    geo.spreadX,
        spreadY:    geo.spreadY,
      },
      props: {
        geo:          "ellipse",
        w:            8,
        h:            8,
        color:        "grey",
        labelColor:   "black",
        fill:         "solid",
        dash:         "solid",
        size:         "s",
        font:         "draw",
        richText:     richText(" "),
        align:        "middle",
        verticalAlign: "middle",
        growY:        0,
        url:          "",
        scale:        1,
      },
    } satisfies TLGeoShape);
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
    const isOwn      = arrow.isOwnership === true;
    const label      = isOwn ? "" : [arrow.role, arrow.family].filter(Boolean).join(" · ");
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
      isLocked: isOwn,
      opacity:  isOwn ? 0 : 1,
      meta:     { family: arrow.family, role: arrow.role, isOwnership: isOwn, ...(isOwn && { ownsMemeId: scopeId(arrow.fromFrameId) }), islandLifecycle: "boot-receipt" },
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
          snap:             "center",
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
          snap:             "center",
        },
      });
    }
  });

  // -- Body node shapes (widget tree skeleton) --------------------------------
  // One geo shape per LarTLBodyNode — structural skeleton of the meme's carrier content.
  // Positioned relative to their parent frame, stacked top-to-bottom inside the frame body.
  // Visibility toggled by templateProps.showCarrier at each zoom level.
  //
  // text   → grey rectangle with prose text (wikitext body content)
  // widget → violet rectangle with kumu type + props (UEFN device slot — not executed)
  // hole   → dashed grey rectangle (Hazel typed hole — kahea call with no registry match)
  snapshot.bodyNodes?.forEach((node, idx) => {
    const parentGeo = layout.frames.get(node.parentFrameId as LarProjectionId);
    if (!parentGeo) return;

    const scopedParentId = scopeId(node.parentFrameId) as TLGeoShape["parentId"];
    const yOffset = 28 + idx * 28;  // stack below the frame label, 28px per node

    const label = node.kind === "text"
      ? node.text.slice(0, 120)
      : node.kind === "widget"
        ? `${node.kumuName}(${Object.entries(node.props).map(([k, v]) => `${k}:${v}`).join(" ")})`
        : `? ${node.kumuName}`;

    const color = node.kind === "widget" ? "violet" : "grey";
    const dash  = node.kind === "hole"   ? "dashed" : "solid";

    shapes.push({
      id:       scopeId(`shape:body_${node.parentFrameId.replace(/^shape:/, "")}_${idx}`) as TLGeoShape["id"],
      typeName: "shape",
      type:     "geo",
      x:        4,
      y:        yOffset,
      rotation: 0,
      index:    shapeIndex(scopedParentId),
      parentId: scopedParentId,
      isLocked: true,
      opacity:  0,  // hidden until showCarrier zoom level; applyZoomTemplate controls opacity
      meta:     { bodyNodeKind: node.kind },
      props: {
        geo:          "rectangle",
        w:            parentGeo.w - 8,
        h:            24,
        color,
        labelColor:   "black",
        fill:         "semi",
        dash,
        size:         "s",
        font:         "mono",
        richText:     richText(label),
        align:        "start",
        verticalAlign: "middle",
        growY:        0,
        url:          "",
        scale:        1,
      },
    } satisfies TLGeoShape);
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
