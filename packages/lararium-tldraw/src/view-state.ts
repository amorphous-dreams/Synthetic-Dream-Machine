/**
 * LarViewState — navigation model for three-view Lararium UI.
 *
 * TiddlyWiki analogy:
 *   $:/StoryList     → navigationStack (ordered list of visited meme URIs)
 *   $:/HistoryList   → history (with fromRect for zoom-origin animation)
 *   active view      → the current tiddler render template tag
 *
 * Three views (transition without page reload):
 *   "story-river"  — default; topo-sorted closure as column of meme cards
 *   "meme-detail"  — focused on one meme; ahu sockets as nested sections;
 *                    owned children transcluded inline; tldraw camera zoomed to frame
 *   "graph"        — full DAG; all arrows visible; camera panned/zoomed to fit all
 *
 * Transitions:
 *   story-river → meme-detail  : push to stack, zoom camera to meme frame
 *   meme-detail → story-river  : pop stack, zoom camera out to fit column
 *   any → graph               : setCurrentPage to graph page (no stack change)
 *   graph → previous           : setCurrentPage back, restore camera
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LarViewKind = "story-river" | "meme-detail" | "graph";

/** Immutable navigation frame (one entry in history) */
export interface LarNavFrame {
  readonly view: LarViewKind;
  /** URI of the focused meme (null in story-river and graph views) */
  readonly focusUri: string | null;
  /** Serialized camera bounds at time of navigation (for back-animation) */
  readonly fromRect: { x: number; y: number; w: number; h: number } | null;
}

/** Full navigation state — the single source of truth for view switching. */
export interface LarViewState {
  readonly activeView: LarViewKind;
  /** URI of the currently focused meme (non-null iff activeView === "meme-detail") */
  readonly focusUri: string | null;
  /** History stack (most recent at end). Enables back navigation. */
  readonly history: readonly LarNavFrame[];
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const INITIAL_VIEW_STATE: LarViewState = {
  activeView: "story-river",
  focusUri: null,
  history: [],
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type LarViewAction =
  | { type: "ZOOM_IN"; uri: string; fromRect?: LarNavFrame["fromRect"] }
  | { type: "ZOOM_OUT" }
  | { type: "OPEN_GRAPH" }
  | { type: "CLOSE_GRAPH" }
  | { type: "NAVIGATE_BACK" };

// ---------------------------------------------------------------------------
// Reducer — pure function, no side effects
// ---------------------------------------------------------------------------

export function viewStateReducer(state: LarViewState, action: LarViewAction): LarViewState {
  switch (action.type) {
    case "ZOOM_IN": {
      const frame: LarNavFrame = {
        view: state.activeView,
        focusUri: state.focusUri,
        fromRect: action.fromRect ?? null,
      };
      return {
        activeView: "meme-detail",
        focusUri: action.uri,
        history: [...state.history, frame],
      };
    }
    case "ZOOM_OUT": {
      const prev = state.history.at(-1);
      if (!prev) return { ...state, activeView: "story-river", focusUri: null };
      return {
        activeView: prev.view,
        focusUri: prev.focusUri,
        history: state.history.slice(0, -1),
      };
    }
    case "OPEN_GRAPH": {
      const frame: LarNavFrame = {
        view: state.activeView,
        focusUri: state.focusUri,
        fromRect: null,
      };
      return {
        activeView: "graph",
        focusUri: state.focusUri,
        history: [...state.history, frame],
      };
    }
    case "CLOSE_GRAPH":
    case "NAVIGATE_BACK": {
      const prev = state.history.at(-1);
      if (!prev) return { ...state, activeView: "story-river", focusUri: null };
      return {
        activeView: prev.view,
        focusUri: prev.focusUri,
        history: state.history.slice(0, -1),
      };
    }
    default:
      return state;
  }
}
