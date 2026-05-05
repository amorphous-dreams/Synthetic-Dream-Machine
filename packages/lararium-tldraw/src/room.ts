/**
 * room.ts — Static room registry for the Lararium canvas.
 *
 * A "room" names a tldraw page with a canonical TW filter expression.
 * This file defines the data model and built-in room constants.
 * All tldraw-runtime projection code was removed in the M27 rewrite.
 *
 * Navigation helpers (goToRoom, switchToPage) live in nav.ts.
 * Room page IDs follow the convention "page:{roomId}".
 */

/** A named canvas region backed by a TW filter expression. */
export interface LarRoom {
  readonly id:      string;
  /** Human-readable label shown in the room header and side-panel nav. */
  readonly name:    string;
  /**
   * TW Filter expression that selects memes visible in this room.
   * e.g. "[all[memes]sort[depth]]" for the system view.
   */
  readonly filter:  string;
  /** Tldraw page ID for this room (canonical: "page:{id}"). */
  readonly tlPageId: string;
  readonly layout:  "story-river" | "graph" | "meme-detail";
}

// ---------------------------------------------------------------------------
// Built-in rooms
// ---------------------------------------------------------------------------

/** System view: all memes in topo order — the default story river. */
export const ROOM_SYSTEM: LarRoom = {
  id:       "system",
  name:     "System View",
  filter:   "[all[memes]sort[depth]]",
  tlPageId: "page:boot",
  layout:   "story-river",
};

/** Invariants room: memes that implement the invariant interface. */
export const ROOM_INVARIANTS: LarRoom = {
  id:       "invariants",
  name:     "Invariants",
  filter:   "[all[memes]tag[lar:///ha.ka.ba/api/v0.1/pono/invariant]]",
  tlPageId: "page:invariants",
  layout:   "story-river",
};

/** Entry point room: just the AGENTS meme (depth 0). */
export const ROOM_ENTRY: LarRoom = {
  id:       "entry",
  name:     "Entry Point",
  filter:   "[entry[]]",
  tlPageId: "page:entry",
  layout:   "meme-detail",
};

/** Graph overview: all memes, compact layout. */
export const ROOM_GRAPH: LarRoom = {
  id:       "graph",
  name:     "Graph Overview",
  filter:   "[all[memes]sort[depth]]",
  tlPageId: "page:graph",
  layout:   "graph",
};

/** Default room registry — ordered list for side-panel nav. */
export const DEFAULT_ROOMS: LarRoom[] = [
  ROOM_SYSTEM,
  ROOM_INVARIANTS,
  ROOM_GRAPH,
  ROOM_ENTRY,
];
