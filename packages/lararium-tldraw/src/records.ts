/**
 * Lararium → tldraw projection record types.
 *
 * Design rationale (from tldraw submodule study):
 *
 * tldraw's data model:
 *   TLPage         → document container (scope: "document")
 *   TLFrameShape   → named container with position/size (parentId = page or another frame)
 *   TLArrowShape   → directed edge between two shapes (start/end bindings)
 *   TLNoteShape    → sticky note with rich text
 *   TLTextShape    → plain text label
 *
 * Lararium projection mapping:
 *   BootArtifact    → TLPage (one page = one boot view / story river)
 *   ClosureEntry    → TLFrameShape (one frame per meme, positioned by topo depth)
 *   ahu socket      → TLFrameShape nested inside its meme frame (parentId = meme frame)
 *   PranaEdge       → TLArrowShape from fromSocket-frame to toUri-frame
 *   CarrierMetadata → TLNoteShape inside meme frame (IAM block summary)
 *
 * Scopes follow tldraw's documented model:
 *   document  — pages, frames, arrows (persist across sessions, shared in collab)
 *   session   — current focus meme, camera position, HUD overlay state
 *   presence  — future: cursors, observer indicators (deferred)
 *
 * TiddlyWiki analogy (joshu's directive):
 *   Page render template  → the TLPage + story-river layout algorithm
 *   Tiddler template      → the meme TLFrameShape with nested metadata note
 *   Story river           → the topo-sorted closure rendered as a column of frames
 *   Transclusion          → a pranala owns-edge rendered as an arrow into a child frame
 *   UI picker             → tldraw toolbar panels (future: tool bindings for ahu/pranala ops)
 *
 * These types are the pure internal projection model. They do NOT depend on tldraw at
 * runtime — tldraw is an optional peer dependency. The lararium-web and lararium-node
 * packages can consume these records and pass them to tldraw's store separately.
 */

// ---------------------------------------------------------------------------
// Internal projection record IDs
// ---------------------------------------------------------------------------

/** Stable deterministic ID for a projected record: "type:larHash" */
export type LarProjectionId = `${string}:${string}`;

// tldraw requires all shape record IDs to start with "shape:" regardless of shape type.
// The shape type (frame/arrow/note) is carried in the `type` field, not the ID prefix.
export function memeFrameId(uri: string): LarProjectionId {
  return `shape:frame_${uri.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

export function ahuFrameId(uri: string, socket: string): LarProjectionId {
  const socketSuffix = socket.includes("#") ? socket.split("#")[1]! : "root";
  return `shape:ahu_${uri.replace(/[^a-zA-Z0-9]/g, "_")}_${socketSuffix}`;
}

/** Stable ID for a socket port shape — arrow binding target, child of meme frame. */
export function socketShapeId(memeUri: string, slotId: string): LarProjectionId {
  const slotSuffix = slotId.includes("#") ? slotId.split("#")[1]! : slotId.replace(/[^a-zA-Z0-9]/g, "_");
  return `shape:sock_${memeUri.replace(/[^a-zA-Z0-9]/g, "_")}_${slotSuffix}`;
}

export function edgeArrowId(fromSocket: string, toUri: string): LarProjectionId {
  const from = fromSocket.replace(/[^a-zA-Z0-9]/g, "_");
  const to = toUri.replace(/[^a-zA-Z0-9]/g, "_");
  return `shape:arrow_${from}__${to}`;
}

/** Stable ID for a control:owns arrow from a meme/ahu frame to a child frame or socket. */
export function ownsArrowId(fromId: string, toId: string): LarProjectionId {
  const from = fromId.replace(/^shape:/, "").replace(/[^a-zA-Z0-9]/g, "_");
  const to   = toId.replace(/^shape:/, "").replace(/[^a-zA-Z0-9]/g, "_");
  return `shape:owns_${from}__${to}`;
}

export function pageId(artifactType: string): LarProjectionId {
  return `page:${artifactType}`;
}

// ---------------------------------------------------------------------------
// Template prop extraction — parse a kumu def body TOML into MemeTemplateProps
// ---------------------------------------------------------------------------

import type { KumuDef } from "@lararium/core";

/**
 * Extract MemeTemplateProps from a kumu definition whose body contains a TOML block.
 * Falls back to the provided default when the TOML is absent or unparseable.
 */
export function templatePropsFromKumuDef(
  def: KumuDef,
  fallback: MemeTemplateProps,
): MemeTemplateProps {
  for (const node of def.body) {
    if (node.kind === "Sigil" && (node.sigilName === "toml" || node.sigilName === "iam")) {
      const content = node.attrs["content"] ?? "";
      return parseTemplateTOML(content, fallback);
    }
  }
  return fallback;
}

function parseTemplateTOML(toml: string, fallback: MemeTemplateProps): MemeTemplateProps {
  const get = (key: string): string | undefined => {
    const m = new RegExp(`^${key}\\s*=\\s*(.+)$`, "m").exec(toml);
    if (!m) return undefined;
    return m[1]!.trim().replace(/^["']|["']$/g, "");
  };
  const num = (key: string, def: number): number => {
    const v = get(key); return v ? (parseFloat(v) || def) : def;
  };
  const bool = (key: string, def: boolean): boolean => {
    const v = get(key); return v !== undefined ? v === "true" : def;
  };
  return {
    w:           num("w",             fallback.w),
    h:           num("h",             fallback.h),
    color:       get("color")      ?? fallback.color,
    label:       get("label")      ?? fallback.label,
    includeAhu:  bool("include-ahu",  fallback.includeAhu),
    showNotes:   bool("show-notes",   fallback.showNotes),
    showCarrier: bool("show-carrier", fallback.showCarrier),
    opacity:     num("opacity",       fallback.opacity),
    zoomLevel:   get("zoom-level") ?? fallback.zoomLevel,
    cascade:     get("cascade")    ?? fallback.cascade,
  };
}

/**
 * Build a TemplatePropsByLevel from a KumuRegistry.
 * Falls back to DEFAULT_TEMPLATE_PROPS for any missing template.
 */
export function buildTemplatePropsByLevel(
  registry: { get(name: string): KumuDef | undefined },
): TemplatePropsByLevel {
  const d = DEFAULT_TEMPLATE_PROPS;
  return {
    strategic:   registry.get("meme-strategic")   ? templatePropsFromKumuDef(registry.get("meme-strategic")!,   d.strategic)   : d.strategic,
    operational: registry.get("meme-operational") ? templatePropsFromKumuDef(registry.get("meme-operational")!, d.operational) : d.operational,
    tactical:    registry.get("meme-tactical")    ? templatePropsFromKumuDef(registry.get("meme-tactical")!,    d.tactical)    : d.tactical,
    combat:      registry.get("meme-combat")      ? templatePropsFromKumuDef(registry.get("meme-combat")!,      d.combat)      : d.combat,
    action:      registry.get("meme-action")      ? templatePropsFromKumuDef(registry.get("meme-action")!,      d.action)      : d.action,
  };
}

// ---------------------------------------------------------------------------
// Projection record types (tldraw-shaped, no tldraw import)
// ---------------------------------------------------------------------------

export type LarProjectionScope = "document" | "session" | "presence";

/** A projected tldraw page — one per boot artifact view. */
export interface LarTLPage {
  readonly type: "page";
  readonly id: LarProjectionId;
  readonly scope: "document";
  readonly name: string;
  /** ISO timestamp from BootArtifact.compiledAt */
  readonly compiledAt: string;
  readonly memeCount: number;
}

/** A projected frame shape — one per meme carrier (or one per ahu socket). */
export interface LarTLFrame {
  readonly type: "frame";
  readonly id: LarProjectionId;
  readonly scope: "document";
  readonly pageId: LarProjectionId;
  /** null for top-level meme frames; parent meme frame ID for ahu socket frames */
  readonly parentId: LarProjectionId | null;
  readonly uri: string;
  /** Display name: last segment of URI or ahu socket name */
  readonly name: string;
  /** Topo sort position (column for story river layout) */
  readonly depth: number;
  /** "meme" for carrier frames, "ahu" for socket frames */
  readonly frameKind: "meme" | "ahu";
  /** carrier rating: kapu | ano | meme | data | noise */
  readonly rating: string;
  /** UX stage band derived from carrier confidence scalar — GR | OS | US | CS | DS (rendering annotation only, not a gate condition) */
  readonly stage: string;
  /** implements list from carrier */
  readonly implements: readonly string[];
  /** Full carrier text — stored in tldraw meta so the CRDT carries it natively. */
  readonly carrierText?: string;
  /** Template props for all 5 zoom levels — seeded from lares/templates/ kumu defs. */
  readonly templateProps?: TemplatePropsByLevel;
}

/**
 * Canvas rendering props for one zoom-level template.
 * Seeded into shape.meta.templateProps at projection time.
 * Zoom listener applies the right set on threshold crossings.
 *
 * cascade: the filter predicate string from the carrier TOML (e.g. "zoom < 0.15").
 *   Stored in meta for the future filter-expression path; current switching uses classifyZoom().
 * zoomLevel: self-declared level name from the carrier (e.g. "strategic").
 */
export interface MemeTemplateProps {
  w:             number;
  h:             number;
  /** "rating" = use meme's own rating color; otherwise a tldraw color name. */
  color:         string;
  /** "slug" | "full" | "none" */
  label:         string;
  includeAhu:    boolean;
  showNotes:     boolean;
  showCarrier:   boolean;
  opacity:       number;
  /** Zoom level this template governs — from carrier TOML zoom-level field. */
  zoomLevel:     string;
  /** Filter predicate from carrier TOML cascade field (future: wikitext-filter expression). */
  cascade:       string;
}

export type TemplatePropsByLevel = {
  strategic:   MemeTemplateProps;
  operational: MemeTemplateProps;
  tactical:    MemeTemplateProps;
  combat:      MemeTemplateProps;
  action:      MemeTemplateProps;
};

/** Fallback props used when a template carrier is missing from the registry. */
export const DEFAULT_TEMPLATE_PROPS: TemplatePropsByLevel = {
  strategic:   { w: 60,  h: 28,  color: "grey",   label: "none", includeAhu: false, showNotes: false, showCarrier: false, opacity: 0.7, zoomLevel: "strategic",   cascade: "zoom < 0.15" },
  operational: { w: 120, h: 52,  color: "rating", label: "slug", includeAhu: false, showNotes: false, showCarrier: false, opacity: 1.0, zoomLevel: "operational", cascade: "zoom < 0.35" },
  tactical:    { w: 220, h: 100, color: "rating", label: "slug", includeAhu: false, showNotes: true,  showCarrier: false, opacity: 1.0, zoomLevel: "tactical",    cascade: "zoom < 0.80" },
  combat:      { w: 320, h: 160, color: "rating", label: "full", includeAhu: true,  showNotes: true,  showCarrier: false, opacity: 1.0, zoomLevel: "combat",      cascade: "zoom < 1.50" },
  action:      { w: 400, h: 220, color: "rating", label: "full", includeAhu: true,  showNotes: true,  showCarrier: true,  opacity: 1.0, zoomLevel: "action",      cascade: "true"        },
};

/**
 * A socket port shape — stable arrow binding target, child of meme frame.
 *
 * Arrows bind to sockets permanently. `applyZoomTemplate` repositions sockets:
 *   - low zoom (includeAhu:false): cluster to meme center (centerX, centerY)
 *   - high zoom (includeAhu:true): spread to ahu frame position (spreadX, spreadY)
 *
 * Coordinates are local to the parent meme frame.
 */
export interface LarTLSocket {
  readonly type: "socket";
  readonly id: LarProjectionId;
  readonly scope: "document";
  readonly pageId: LarProjectionId;
  /** Parent meme frame id. */
  readonly parentId: LarProjectionId;
  readonly memeUri: string;
  /** The slot this socket represents — e.g. "lar:///AGENTS#implements-meme". */
  readonly slotId: string;
  /** Index within this meme's slot list — used by layout to compute spread position. */
  readonly ahuIdx: number;
}

/** A projected arrow shape — one per PranaEdge. */
export interface LarTLArrow {
  readonly type: "arrow";
  readonly id: LarProjectionId;
  readonly scope: "document";
  readonly pageId: LarProjectionId;
  readonly fromFrameId: LarProjectionId;
  readonly toFrameId: LarProjectionId;
  readonly family: string;
  readonly role: string | null;
  readonly label: string;
  /** True for structural control:owns skeleton arrows; false/absent for pranala semantic arrows. */
  readonly isOwnership?: boolean;
}

/** A projected note shape — IAM block metadata summary inside a meme frame. */
export interface LarTLNote {
  readonly type: "note";
  readonly id: LarProjectionId;
  readonly scope: "document";
  readonly pageId: LarProjectionId;
  readonly parentFrameId: LarProjectionId;
  readonly text: string;
}

/** Union of all lararium projection record types. */
export type LarProjectionRecord = LarTLPage | LarTLFrame | LarTLSocket | LarTLArrow | LarTLNote;

// ---------------------------------------------------------------------------
// Projection snapshot — the full output of projectToTldraw()
// ---------------------------------------------------------------------------

export interface LarTLSnapshot {
  readonly version: 1;
  readonly projectedAt: string;
  readonly pages:   readonly LarTLPage[];
  readonly frames:  readonly LarTLFrame[];
  readonly sockets: readonly LarTLSocket[];
  readonly arrows:  readonly LarTLArrow[];
  readonly notes:   readonly LarTLNote[];
}
