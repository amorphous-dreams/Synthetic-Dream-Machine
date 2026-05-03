/**
 * storyRiverLayout — causal island canvas layout strategy tests.
 *
 * Layout receives a LarTLSnapshot (projection of the causal closure) and
 * produces per-frame geometry: x/y/w/h for meme frames, socket cluster/spread
 * positions, and initial arrow geometry.
 *
 * Cascade analogy: LAYOUT_CASCADE.find(s => s.predicate(snap))?.apply(snap)
 *
 * Meme: lar:///ha.ka.ba/@lares/api/v0.1/lararium/tldraw/layout
 */

import { describe, test, expect } from "@jest/globals";
import {
  storyRiverLayout,
  selectLayout,
  LAYOUT_CASCADE,
} from "../src/layout.js";
import { memeFrameId, ahuFrameId, pageId } from "../src/records.js";
import type { LarTLSnapshot, LarTLFrame, LarTLSocket } from "../src/records.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PAGE_ID = pageId("document");

function makeFrame(opts: {
  uri: string;
  depth: number;
  parentId?: string;
  frameKind?: "meme" | "ahu";
}): LarTLFrame {
  const id = opts.frameKind === "ahu"
    ? ahuFrameId(opts.uri, "socket")
    : memeFrameId(opts.uri);
  return {
    type:      "frame",
    id,
    scope:     "document",
    pageId:    PAGE_ID,
    parentId:  opts.parentId ?? null,
    uri:       opts.uri,
    name:      opts.uri.split("/").at(-1) ?? opts.uri,
    depth:     opts.depth,
    frameKind: opts.frameKind ?? "meme",
    rating:    "meme",
    confidence: 0.8,
    register:  "CS",
    manaoio:   0.75,
    stage:     "CS",
    implements: [],
  };
}

function emptySnapshot(frames: LarTLFrame[], sockets: LarTLSocket[] = []): LarTLSnapshot {
  return {
    version:      1,
    projectedAt:  new Date().toISOString(),
    pages:        [],
    frames,
    sockets,
    arrows:       [],
    notes:        [],
    bodyNodes:    [],
  };
}

// ---------------------------------------------------------------------------
// storyRiverLayout — geometry
// ---------------------------------------------------------------------------

describe("storyRiverLayout — frame geometry", () => {
  test("single meme frame gets non-negative x/y coordinates", () => {
    const frame    = makeFrame({ uri: "lar:///ha.ka.ba/@lares/api/v0.1/mu", depth: 0 });
    const snapshot = emptySnapshot([frame]);
    const layout   = storyRiverLayout(snapshot);

    const geo = layout.frames.get(frame.id);
    expect(geo).toBeDefined();
    expect(geo!.x).toBeGreaterThanOrEqual(0);
    expect(geo!.y).toBeGreaterThanOrEqual(0);
    expect(geo!.w).toBeGreaterThan(0);
    expect(geo!.h).toBeGreaterThan(0);
  });

  test("depth-0 frame sits left of depth-1 frame (story river left→right)", () => {
    const f0 = makeFrame({ uri: "lar:///A", depth: 0 });
    const f1 = makeFrame({ uri: "lar:///B", depth: 1 });
    const layout = storyRiverLayout(emptySnapshot([f0, f1]));

    const g0 = layout.frames.get(f0.id)!;
    const g1 = layout.frames.get(f1.id)!;
    expect(g0.x).toBeLessThan(g1.x);
  });

  test("two frames at same depth stack vertically", () => {
    const f0 = makeFrame({ uri: "lar:///A", depth: 0 });
    const f1 = makeFrame({ uri: "lar:///B", depth: 0 });
    const layout = storyRiverLayout(emptySnapshot([f0, f1]));

    const g0 = layout.frames.get(f0.id)!;
    const g1 = layout.frames.get(f1.id)!;
    expect(g0.x).toBe(g1.x);
    expect(g0.y).not.toBe(g1.y);
  });

  test("ahu sub-frame gets geometry inside its parent meme frame", () => {
    const meme = makeFrame({ uri: "lar:///mu", depth: 0 });
    const ahu  = makeFrame({
      uri:      "lar:///mu#spine",
      depth:    0,
      parentId: meme.id,
      frameKind: "ahu",
    });
    const layout = storyRiverLayout(emptySnapshot([meme, ahu]));

    const ahuGeo = layout.frames.get(ahu.id);
    expect(ahuGeo).toBeDefined();
    // Local coords: ahu sits below the header zone
    expect(ahuGeo!.y).toBeGreaterThan(0);
  });

  test("meme with ahu children gets taller than meme without", () => {
    const memeAlone = makeFrame({ uri: "lar:///alone", depth: 0 });
    const memeParent = makeFrame({ uri: "lar:///parent", depth: 1 });
    const ahu = makeFrame({
      uri:       "lar:///parent#spine",
      depth:     1,
      parentId:  memeParent.id,
      frameKind: "ahu",
    });

    const layoutAlone  = storyRiverLayout(emptySnapshot([memeAlone]));
    const layoutParent = storyRiverLayout(emptySnapshot([memeParent, ahu]));

    const alone  = layoutAlone.frames.get(memeAlone.id)!;
    const parent = layoutParent.frames.get(memeParent.id)!;
    expect(parent.h).toBeGreaterThan(alone.h);
  });

  test("returns 'story-river' as strategy name", () => {
    const layout = storyRiverLayout(emptySnapshot([]));
    expect(layout.strategy).toBe("story-river");
  });
});

// ---------------------------------------------------------------------------
// selectLayout — cascade selector
// ---------------------------------------------------------------------------

describe("selectLayout — LAYOUT_CASCADE", () => {
  test("LAYOUT_CASCADE contains at least one strategy", () => {
    expect(LAYOUT_CASCADE.length).toBeGreaterThan(0);
  });

  test("selectLayout returns a layout (no crash on empty snapshot)", () => {
    const layout = selectLayout(emptySnapshot([]));
    expect(layout).toBeDefined();
    expect(layout.strategy).toBeTruthy();
  });

  test("selectLayout returns story-river for a basic meme snapshot", () => {
    const frame  = makeFrame({ uri: "lar:///mu", depth: 0 });
    const layout = selectLayout(emptySnapshot([frame]));
    expect(layout.strategy).toBe("story-river");
  });
});
