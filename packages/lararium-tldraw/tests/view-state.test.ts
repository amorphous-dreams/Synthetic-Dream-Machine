import { describe, test, expect } from "@jest/globals";
import {
  INITIAL_VIEW_STATE,
  viewStateReducer,
  type LarViewState,
} from "../src/view-state.js";

describe("LarViewState reducer", () => {
  test("initial state is story-river with empty history", () => {
    expect(INITIAL_VIEW_STATE.activeView).toBe("story-river");
    expect(INITIAL_VIEW_STATE.focusUri).toBeNull();
    expect(INITIAL_VIEW_STATE.history).toHaveLength(0);
  });

  test("ZOOM_IN transitions to meme-detail and pushes history", () => {
    const s = viewStateReducer(INITIAL_VIEW_STATE, {
      type: "ZOOM_IN",
      uri: "lar:///ha.ka.ba/api/v0.1/mu",
    });
    expect(s.activeView).toBe("meme-detail");
    expect(s.focusUri).toBe("lar:///ha.ka.ba/api/v0.1/mu");
    expect(s.history).toHaveLength(1);
    expect(s.history[0]!.view).toBe("story-river");
  });

  test("ZOOM_OUT from meme-detail returns to story-river", () => {
    let s: LarViewState = INITIAL_VIEW_STATE;
    s = viewStateReducer(s, { type: "ZOOM_IN", uri: "lar:///AGENTS" });
    s = viewStateReducer(s, { type: "ZOOM_OUT" });
    expect(s.activeView).toBe("story-river");
    expect(s.focusUri).toBeNull();
    expect(s.history).toHaveLength(0);
  });

  test("ZOOM_OUT with empty history returns to story-river safely", () => {
    const s = viewStateReducer(INITIAL_VIEW_STATE, { type: "ZOOM_OUT" });
    expect(s.activeView).toBe("story-river");
  });

  test("OPEN_GRAPH transitions to graph view and pushes history", () => {
    const s = viewStateReducer(INITIAL_VIEW_STATE, { type: "OPEN_GRAPH" });
    expect(s.activeView).toBe("graph");
    expect(s.history).toHaveLength(1);
    expect(s.history[0]!.view).toBe("story-river");
  });

  test("CLOSE_GRAPH returns to previous view", () => {
    let s: LarViewState = INITIAL_VIEW_STATE;
    s = viewStateReducer(s, { type: "OPEN_GRAPH" });
    s = viewStateReducer(s, { type: "CLOSE_GRAPH" });
    expect(s.activeView).toBe("story-river");
  });

  test("nested zoom: story-river → meme-detail → graph → back → back", () => {
    let s: LarViewState = INITIAL_VIEW_STATE;
    s = viewStateReducer(s, { type: "ZOOM_IN", uri: "lar:///AGENTS" });
    s = viewStateReducer(s, { type: "OPEN_GRAPH" });
    expect(s.activeView).toBe("graph");
    expect(s.history).toHaveLength(2);
    s = viewStateReducer(s, { type: "NAVIGATE_BACK" });
    expect(s.activeView).toBe("meme-detail");
    s = viewStateReducer(s, { type: "NAVIGATE_BACK" });
    expect(s.activeView).toBe("story-river");
    expect(s.history).toHaveLength(0);
  });

  test("fromRect is preserved in history", () => {
    const rect = { x: 10, y: 20, w: 300, h: 200 };
    const s = viewStateReducer(INITIAL_VIEW_STATE, {
      type: "ZOOM_IN",
      uri: "lar:///AGENTS",
      fromRect: rect,
    });
    expect(s.history[0]!.fromRect).toEqual(rect);
  });
});
