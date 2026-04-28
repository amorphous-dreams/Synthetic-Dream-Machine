/**
 * Layout strategy tests.
 *
 * Tests the cascade pattern (strategy selection) and story-river placement.
 * Verifies pixel positions, parent-child containment, and arrow geometry.
 */

import { describe, test, expect } from "@jest/globals";
import {
  storyRiverLayout,
  selectLayout,
  LAYOUT_CASCADE,
} from "../src/layout.js";
import { emitTldrawRecords } from "../src/tldraw-shapes.js";
import {
  type LarTLSnapshot,
  memeFrameId,
  ahuFrameId,
  edgeArrowId,
  pageId,
} from "../src/records.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSnapshot(overrides: Partial<LarTLSnapshot> = {}): LarTLSnapshot {
  const pid = pageId("boot");
  const agentsId = memeFrameId("lar:///AGENTS");
  const muId     = memeFrameId("lar:///ha.ka.ba/api/v0.1/mu");
  const laresId  = memeFrameId("lar:///LARES");
  const edgesAhuId = ahuFrameId("lar:///AGENTS", "lar:///AGENTS#edges");
  const arrowId  = edgeArrowId("lar:///AGENTS#edges", "lar:///ha.ka.ba/api/v0.1/mu");

  return {
    version: 1,
    projectedAt: "2026-04-25T00:00:00.000Z",
    pages: [{ type: "page", id: pid, scope: "document", name: "Boot", compiledAt: "2026-04-25T00:00:00.000Z", memeCount: 3 }],
    frames: [
      { type: "frame", id: agentsId, scope: "document", pageId: pid, parentId: null, uri: "lar:///AGENTS", name: "AGENTS", depth: 0, frameKind: "meme", rating: "ano", implements: [] },
      { type: "frame", id: muId,     scope: "document", pageId: pid, parentId: null, uri: "lar:///ha.ka.ba/api/v0.1/mu", name: "mu", depth: 1, frameKind: "meme", rating: "ano", implements: [] },
      { type: "frame", id: laresId,  scope: "document", pageId: pid, parentId: null, uri: "lar:///LARES", name: "LARES", depth: 1, frameKind: "meme", rating: "ano", implements: [] },
      { type: "frame", id: edgesAhuId, scope: "document", pageId: pid, parentId: agentsId, uri: "lar:///AGENTS#edges", name: "#edges", depth: 0.5, frameKind: "ahu", rating: "socket", implements: [] },
    ],
    arrows: [
      { type: "arrow", id: arrowId, scope: "document", pageId: pid, fromFrameId: edgesAhuId, toFrameId: muId, family: "control", role: "owns", label: "" },
    ],
    notes: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Layout cascade — strategy selection
// ---------------------------------------------------------------------------

describe("layout cascade", () => {
  test("selectLayout returns story-river for any snapshot (default catch-all)", () => {
    const snap = makeSnapshot();
    const layout = selectLayout(snap);
    expect(layout.strategy).toBe("story-river");
  });

  test("LAYOUT_CASCADE has at least one catch-all strategy", () => {
    expect(LAYOUT_CASCADE.length).toBeGreaterThan(0);
    const last = LAYOUT_CASCADE[LAYOUT_CASCADE.length - 1]!;
    expect(last.predicate(makeSnapshot())).toBe(true);
  });

  test("custom cascade overrides default", () => {
    const radial: typeof LAYOUT_CASCADE[0] = {
      name: "radial-test",
      predicate: () => true,
      apply: (snap) => ({ strategy: "radial-test", frames: new Map(), arrows: new Map() }),
    };
    const layout = selectLayout(makeSnapshot(), [radial]);
    expect(layout.strategy).toBe("radial-test");
  });

  test("cascade falls through to next when predicate returns false", () => {
    const never = {
      name: "never",
      predicate: () => false,
      apply: () => { throw new Error("should not be called"); },
    };
    const layout = selectLayout(makeSnapshot(), [never, ...LAYOUT_CASCADE]);
    expect(layout.strategy).toBe("story-river");
  });
});

// ---------------------------------------------------------------------------
// Story river layout — geometry invariants
// ---------------------------------------------------------------------------

describe("storyRiverLayout geometry", () => {
  test("depth-0 meme frame starts at canvas origin offset", () => {
    const layout = storyRiverLayout(makeSnapshot());
    const agentsId = memeFrameId("lar:///AGENTS");
    const geo = layout.frames.get(agentsId)!;
    expect(geo).toBeDefined();
    expect(geo.x).toBe(100); // CANVAS_OX
    expect(geo.y).toBe(100); // CANVAS_OY
  });

  test("depth-1 frames are shifted right by FRAME_W + GAP_X", () => {
    const layout = storyRiverLayout(makeSnapshot());
    const muId = memeFrameId("lar:///ha.ka.ba/api/v0.1/mu");
    const geo = layout.frames.get(muId)!;
    expect(geo.x).toBe(100 + 220 + 80); // CANVAS_OX + FRAME_W + GAP_X
  });

  test("two frames at same depth are stacked vertically", () => {
    const layout = storyRiverLayout(makeSnapshot());
    const muId    = memeFrameId("lar:///ha.ka.ba/api/v0.1/mu");
    const laresId = memeFrameId("lar:///LARES");
    const muGeo    = layout.frames.get(muId)!;
    const laresGeo = layout.frames.get(laresId)!;
    expect(muGeo.x).toBe(laresGeo.x);
    expect(laresGeo.y).toBeGreaterThan(muGeo.y);
  });

  test("ahu sub-frame has local coordinates (relative to parent frame)", () => {
    const layout = storyRiverLayout(makeSnapshot());
    const edgesAhuId = ahuFrameId("lar:///AGENTS", "lar:///AGENTS#edges");
    const geo = layout.frames.get(edgesAhuId)!;
    expect(geo).toBeDefined();
    // Local coords inside parent — x should be AHU_PAD_X (20), not absolute
    expect(geo.x).toBe(20); // AHU_PAD_X
    expect(geo.x).toBeLessThan(100); // definitely local, not canvas-absolute
  });

  test("all meme frames have defined geometry", () => {
    const snap = makeSnapshot();
    const layout = storyRiverLayout(snap);
    const memeFrames = snap.frames.filter((f) => f.frameKind === "meme");
    for (const frame of memeFrames) {
      expect(layout.frames.get(frame.id)).toBeDefined();
    }
  });

  test("arrow geometry connects source to target", () => {
    const layout = storyRiverLayout(makeSnapshot());
    const arrowId = edgeArrowId("lar:///AGENTS#edges", "lar:///ha.ka.ba/api/v0.1/mu");
    const arrow = layout.arrows.get(arrowId)!;
    expect(arrow).toBeDefined();
    // Arrow starts somewhere to the left of where it ends (control flow: depth 0 → depth 1)
    expect(arrow.startX).toBeLessThan(arrow.endX);
  });

  test("arrows without both frames in layout are omitted", () => {
    const snap = makeSnapshot({
      arrows: [{
        type: "arrow",
        id: edgeArrowId("lar:///MISSING", "lar:///ALSO_MISSING"),
        scope: "document",
        pageId: pageId("boot"),
        fromFrameId: memeFrameId("lar:///MISSING"),
        toFrameId:   memeFrameId("lar:///ALSO_MISSING"),
        family: "control", role: null, label: "",
      }],
    });
    const layout = storyRiverLayout(snap);
    expect(layout.arrows.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// emitTldrawRecords — store-ready output
// ---------------------------------------------------------------------------

describe("emitTldrawRecords", () => {
  test("emits a page record for each snapshot page", () => {
    const snap = makeSnapshot();
    const layout = storyRiverLayout(snap);
    const { pages } = emitTldrawRecords(snap, layout);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.typeName).toBe("page");
    expect(pages[0]!.name).toBe("Boot");
  });

  test("emits frame shapes for frames with layout geometry", () => {
    const snap = makeSnapshot();
    const layout = storyRiverLayout(snap);
    const { shapes } = emitTldrawRecords(snap, layout);
    const frames = shapes.filter((s) => s.type === "frame");
    expect(frames.length).toBeGreaterThan(0);
    // Every frame has x, y, rotation
    for (const f of frames) {
      expect(typeof f.x).toBe("number");
      expect(typeof f.y).toBe("number");
      expect(f.rotation).toBe(0);
    }
  });

  test("emits arrow shapes with relative start/end vectors", () => {
    const snap = makeSnapshot();
    const layout = storyRiverLayout(snap);
    const { shapes } = emitTldrawRecords(snap, layout);
    const arrows = shapes.filter((s) => s.type === "arrow");
    expect(arrows.length).toBeGreaterThan(0);
    // Arrow start is {x:0, y:0} (origin), end is relative vector
    const arrow = arrows[0] as { props: { start: { x: number; y: number }; end: { x: number; y: number } } };
    expect(arrow.props.start).toEqual({ x: 0, y: 0 });
    expect(typeof arrow.props.end.x).toBe("number");
  });

  test("all shape records have required tldraw fields", () => {
    const snap = makeSnapshot();
    const layout = storyRiverLayout(snap);
    const { shapes } = emitTldrawRecords(snap, layout);
    for (const shape of shapes) {
      expect(shape.typeName).toBe("shape");
      expect(typeof shape.id).toBe("string");
      expect(typeof shape.type).toBe("string");
      expect(typeof shape.parentId).toBe("string");
      expect(typeof shape.index).toBe("string");
      expect(shape.isLocked).toBe(false);
    }
  });

  test("control-family arrows use blue color", () => {
    const snap = makeSnapshot();
    const layout = storyRiverLayout(snap);
    const { shapes } = emitTldrawRecords(snap, layout);
    const arrow = shapes.find((s) => s.type === "arrow") as { props: { color: string } } | undefined;
    expect(arrow?.props.color).toBe("blue");
  });
});
