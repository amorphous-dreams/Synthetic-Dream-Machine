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
  /** Operator-set confidence scalar from carrier TOML #iam block. 0 if absent. */
  readonly confidence: number;
  /** Operator-assigned confidence register code (e.g. "CS", "GR", "S"). */
  readonly register: string;
  /** Operator-set observability/interoperability score. 0 if absent. */
  readonly manaoio: number;
  /** UX stage band derived from confidence — GR | OS | US | CS | DS (rendering annotation; not an epistemic gate). */
  readonly stage: string;
  /** implements list from carrier */
  readonly implements: readonly string[];
}

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
  /** papalohe reaction wire: source event name (DeviceA.EventX) */
  readonly trigger?: string | null;
  /** papalohe reaction wire: target function name (DeviceB.FunctionY) */
  readonly fn?: string | null;
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

/**
 * A body node inside a meme frame — the tldraw adapter's structural skeleton of
 * the carrier's widget tree. Three variants follow the TW5 widget model:
 *
 *   text   — a wikitext content block (Worksite/Text nodes collapsed to readable prose)
 *   widget — a resolved kumu instance: type known, props declared, body NOT executed
 *            (UEFN device analogy: device type + editable properties, not runtime state)
 *   hole   — a typed hole: kahea call whose kumuName has no registry match (Hazel semantics)
 *
 * Execution (kumu body output) belongs to the React adapter only.
 * The tldraw adapter shows structure; the React detail panel shows rendered content.
 */
export type LarTLBodyNode =
  | { readonly kind: "text";   readonly uri: string; readonly parentFrameId: LarProjectionId; readonly text: string }
  | { readonly kind: "widget"; readonly uri: string; readonly parentFrameId: LarProjectionId; readonly kumuName: string; readonly props: Record<string, string> }
  | { readonly kind: "hole";   readonly uri: string; readonly parentFrameId: LarProjectionId; readonly kumuName: string };

/** Union of all lararium projection record types. */
export type LarProjectionRecord = LarTLPage | LarTLFrame | LarTLSocket | LarTLArrow | LarTLNote;

// ---------------------------------------------------------------------------
// Projection snapshot — the full output of projectToTldraw()
// ---------------------------------------------------------------------------

export interface LarTLSnapshot {
  readonly version: 1;
  readonly projectedAt: string;
  readonly pages:      readonly LarTLPage[];
  readonly frames:     readonly LarTLFrame[];
  readonly sockets:    readonly LarTLSocket[];
  readonly arrows:     readonly LarTLArrow[];
  readonly notes:      readonly LarTLNote[];
  /** Widget tree body nodes — structural skeleton of each meme's carrier content. */
  readonly bodyNodes:  readonly LarTLBodyNode[];
}
