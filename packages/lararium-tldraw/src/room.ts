/**
 * LarRoom — infinite canvas room model with portal navigation.
 *
 * Architecture (TW + spatial canvas synthesis):
 *
 *   Room       = a named, bounded region of the infinite canvas — one tldraw page.
 *                Its content is determined by a TW filter expression evaluated against
 *                the boot artifact. "System view", "Invariants", "This Sprint" are rooms.
 *
 *   Portal     = a directed edge shape (TLArrow subtype) that connects two rooms.
 *                Clicking a portal navigates to the target room.
 *                Portals live at the room boundary as special frame shapes.
 *
 *   Side panel = a virtual room overlaid on the current canvas via CSS transform.
 *                Slides in from left (story river) or right (control panel).
 *                Not a separate tldraw page — it is a CSS overlay driven by LarViewState.
 *
 * TiddlyWiki analogy:
 *   Room       ↔  $:/tags/ViewTemplate (a named render template)
 *   Portal     ↔  [[LinkText|TargetTiddler]] — navigates between "stories"
 *   Side panel ↔  $:/core/ui/SideBar — slides in alongside the story river
 *   Filter     ↔  TW Filter Notation (guest grammar in lararium-core/filter.ts)
 *
 * Navigation model:
 *   LarViewState tracks the active room via activeView + focusUri.
 *   goToRoom(editor, room) is a thin wrapper over switchToPage() + zoomToFit().
 *   The navigation stack lets "back" work across arbitrary room hops.
 */

import { type ClosureEntry, filterMemesTW } from "@lararium/core";
import { pageId, type LarProjectionId } from "./records.js";

// ---------------------------------------------------------------------------
// Room definition
// ---------------------------------------------------------------------------

/** A named canvas region backed by a TW filter expression. */
export interface LarRoom {
  readonly id: string;
  /** Human-readable label shown in the room header and side-panel nav */
  readonly name: string;
  /**
   * TW Filter expression string that selects the memes visible in this room.
   * e.g. "[all[memes]sort[depth]]" for the system view,
   *      "[all[memes]tag[lar:///ha.ka.ba/api/v0.1/pono/invariant]]" for invariants.
   */
  readonly filter: string;
  /**
   * The tldraw page ID this room maps to.
   * Defaults to pageId(id) if omitted.
   */
  readonly tlPageId?: string;
  /** Layout hint for rendering this room's content. Default: "story-river". */
  readonly layout?: "story-river" | "meme-detail" | "graph";
}

/** A portal connecting two rooms — rendered as a navigation-enabled shape. */
export interface LarPortal {
  readonly id: string;
  readonly fromRoomId: string;
  readonly toRoomId: string;
  readonly label: string;
}

// ---------------------------------------------------------------------------
// Built-in room presets
// ---------------------------------------------------------------------------

/** System view: all memes in topo order — the default story river. */
export const ROOM_SYSTEM: LarRoom = {
  id: "system",
  name: "System View",
  filter: "[all[memes]sort[depth]]",
  tlPageId: pageId("minimal-boot"),
  layout: "story-river",
};

/** Invariants room: memes that implement the invariant interface. */
export const ROOM_INVARIANTS: LarRoom = {
  id: "invariants",
  name: "Invariants",
  filter: "[all[memes]tag[lar:///ha.ka.ba/api/v0.1/pono/invariant]]",
  tlPageId: pageId("invariants"),
  layout: "story-river",
};

/** Entry point room: just the AGENTS meme (depth 0). */
export const ROOM_ENTRY: LarRoom = {
  id: "entry",
  name: "Entry Point",
  filter: "[entry[]]",
  tlPageId: pageId("entry"),
  layout: "meme-detail",
};

/** Graph overview: all memes, compact overview layout. */
export const ROOM_GRAPH: LarRoom = {
  id: "graph",
  name: "Graph Overview",
  filter: "[all[memes]sort[depth]]",
  tlPageId: pageId("graph"),
  layout: "graph",
};

/** Default room registry — ordered list for side-panel nav. */
export const DEFAULT_ROOMS: LarRoom[] = [
  ROOM_SYSTEM,
  ROOM_INVARIANTS,
  ROOM_GRAPH,
  ROOM_ENTRY,
];

/** Built-in portals connecting the default rooms. */
export const DEFAULT_PORTALS: LarPortal[] = [
  { id: "portal:system→graph",      fromRoomId: "system",      toRoomId: "graph",      label: "Graph →" },
  { id: "portal:graph→system",      fromRoomId: "graph",       toRoomId: "system",     label: "← System" },
  { id: "portal:system→invariants", fromRoomId: "system",      toRoomId: "invariants", label: "Invariants →" },
  { id: "portal:invariants→system", fromRoomId: "invariants",  toRoomId: "system",     label: "← System" },
];

// ---------------------------------------------------------------------------
// Room helpers
// ---------------------------------------------------------------------------

/** Resolve a room's tldraw page ID. */
export function roomPageId(room: LarRoom): LarProjectionId {
  return (room.tlPageId ?? pageId(room.id)) as LarProjectionId;
}

/**
 * Evaluate a room's TW5 filter against a closure to get its visible meme set.
 * Async: TW5 engine boots once on first call (Node-only; browser uses snapshot).
 */
export async function roomEntries(room: LarRoom, allEntries: readonly ClosureEntry[]): Promise<ClosureEntry[]> {
  return filterMemesTW(allEntries, room.filter);
}

// ---------------------------------------------------------------------------
// Portal shape ID helpers
// ---------------------------------------------------------------------------

export function portalShapeId(portal: LarPortal): string {
  return `frame:portal_${portal.id.replace(/[^a-zA-Z0-9]/g, "_")}`;
}
