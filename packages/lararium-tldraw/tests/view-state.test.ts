/**
 * tldraw — view state navigation model tests.
 *
 * Three views (single-page zoom-gated model, no page switching):
 *   "story-river"  — topo-sorted closure as column of meme cards (default)
 *   "meme-detail"  — focused on one meme; ahu socket sub-frames materialise
 *   "graph"        — full DAG; all arrows visible
 *   "room"         — situated room content surface
 *
 * Navigation parallels TW5 $:/StoryList + $:/HistoryList.
 * History enables back-navigation across causal island visits.
 *
 * Meme: lar:///ha.ka.ba/@lares/api/v0.1/lararium/tldraw/view-state
 */

import { describe, test, expect } from "@jest/globals";
import {
  viewStateReducer,
  INITIAL_VIEW_STATE,
} from "../src/view-state.js";
import type { LarViewState, LarViewAction } from "../src/view-state.js";

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("INITIAL_VIEW_STATE", () => {
  test("starts in story-river view", () => {
    expect(INITIAL_VIEW_STATE.activeView).toBe("story-river");
  });

  test("starts with no focused URI", () => {
    expect(INITIAL_VIEW_STATE.focusUri).toBeNull();
  });

  test("starts with empty history", () => {
    expect(INITIAL_VIEW_STATE.history).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ZOOM_IN — story-river → meme-detail
// ---------------------------------------------------------------------------

describe("viewStateReducer — ZOOM_IN", () => {
  const action: LarViewAction = {
    type: "ZOOM_IN",
    uri: "lar:///ha.ka.ba/@lares/api/v0.1/mu",
  };

  test("transitions to meme-detail", () => {
    const next = viewStateReducer(INITIAL_VIEW_STATE, action);
    expect(next.activeView).toBe("meme-detail");
  });

  test("sets focusUri to the zoomed meme", () => {
    const next = viewStateReducer(INITIAL_VIEW_STATE, action);
    expect(next.focusUri).toBe("lar:///ha.ka.ba/@lares/api/v0.1/mu");
  });

  test("pushes previous state to history", () => {
    const next = viewStateReducer(INITIAL_VIEW_STATE, action);
    expect(next.history).toHaveLength(1);
    expect(next.history[0]?.view).toBe("story-river");
  });

  test("carries fromRect when provided", () => {
    const rect   = { x: 100, y: 200, w: 300, h: 100 };
    const next   = viewStateReducer(INITIAL_VIEW_STATE, { type: "ZOOM_IN", uri: "lar:///X", fromRect: rect });
    expect(next.history[0]?.fromRect).toEqual(rect);
  });
});

// ---------------------------------------------------------------------------
// OPEN_GRAPH — any → graph
// ---------------------------------------------------------------------------

describe("viewStateReducer — OPEN_GRAPH", () => {
  test("transitions to graph view", () => {
    const next = viewStateReducer(INITIAL_VIEW_STATE, { type: "OPEN_GRAPH" });
    expect(next.activeView).toBe("graph");
  });

  test("pushes current view to history", () => {
    const next = viewStateReducer(INITIAL_VIEW_STATE, { type: "OPEN_GRAPH" });
    expect(next.history).toHaveLength(1);
    expect(next.history[0]?.view).toBe("story-river");
  });
});

// ---------------------------------------------------------------------------
// GO_TO_ROOM — transition into room surface
// ---------------------------------------------------------------------------

describe("viewStateReducer — GO_TO_ROOM", () => {
  test("transitions to room view", () => {
    const next = viewStateReducer(INITIAL_VIEW_STATE, { type: "GO_TO_ROOM", roomId: "altar-fire" });
    expect(next.activeView).toBe("room");
  });

  test("sets focusUri to the roomId", () => {
    const next = viewStateReducer(INITIAL_VIEW_STATE, { type: "GO_TO_ROOM", roomId: "altar-fire" });
    expect(next.focusUri).toBe("altar-fire");
  });
});

// ---------------------------------------------------------------------------
// NAVIGATE_BACK — pop history
// ---------------------------------------------------------------------------

describe("viewStateReducer — NAVIGATE_BACK", () => {
  test("with no history, returns to story-river with null focusUri", () => {
    const next = viewStateReducer(INITIAL_VIEW_STATE, { type: "NAVIGATE_BACK" });
    expect(next.activeView).toBe("story-river");
    expect(next.focusUri).toBeNull();
  });

  test("pops one frame from history", () => {
    // Build up a two-step history: story-river → meme-detail → graph
    const s1 = viewStateReducer(INITIAL_VIEW_STATE, { type: "ZOOM_IN", uri: "lar:///mu" });
    const s2 = viewStateReducer(s1, { type: "OPEN_GRAPH" });
    expect(s2.history).toHaveLength(2);

    const s3 = viewStateReducer(s2, { type: "NAVIGATE_BACK" });
    // Should return to meme-detail
    expect(s3.activeView).toBe("meme-detail");
    expect(s3.history).toHaveLength(1);
  });

  test("pops all the way back to initial story-river", () => {
    const s1 = viewStateReducer(INITIAL_VIEW_STATE, { type: "ZOOM_IN", uri: "lar:///mu" });
    const s2 = viewStateReducer(s1, { type: "NAVIGATE_BACK" });
    const s3 = viewStateReducer(s2, { type: "NAVIGATE_BACK" });
    expect(s3.activeView).toBe("story-river");
    expect(s3.history).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// CLOSE_GRAPH — alias for NAVIGATE_BACK
// ---------------------------------------------------------------------------

describe("viewStateReducer — CLOSE_GRAPH", () => {
  test("pops history like NAVIGATE_BACK", () => {
    const s1 = viewStateReducer(INITIAL_VIEW_STATE, { type: "OPEN_GRAPH" });
    const s2 = viewStateReducer(s1, { type: "CLOSE_GRAPH" });
    expect(s2.activeView).toBe("story-river");
  });
});

// ---------------------------------------------------------------------------
// Immutability — reducer must not mutate input
// ---------------------------------------------------------------------------

describe("viewStateReducer — immutability", () => {
  test("does not mutate the input state object", () => {
    const frozen = Object.freeze({ ...INITIAL_VIEW_STATE, history: Object.freeze([]) as LarViewState["history"] });
    expect(() => viewStateReducer(frozen, { type: "OPEN_GRAPH" })).not.toThrow();
    expect(frozen.activeView).toBe("story-river"); // unchanged
  });
});
