import { describe, test, expect } from "@jest/globals";
import { renderAllViews } from "../src/multi-view.js";
import { memeDetailLayout, graphLayout } from "../src/layout.js";
import type { LarTLSnapshot } from "../src/records.js";
import { memeFrameId, pageId } from "../src/records.js";

// Minimal synthetic boot artifact for testing
function makeArtifact() {
  return {
    artifact: "boot" as const,
    entry: "lar:///AGENTS",
    compiledAt: "2026-01-01T00:00:00.000Z",
    memeCount: 3,
    edgeCount: 1,
    pranalaEdges: [],
    interfaceIndex: {},
    invariantIndex: {},
    closure: [
      { uri: "lar:///AGENTS",           depth: 0, kind: "meme", exists: true, implements: [], file: "lares/AGENTS.md" },
      { uri: "lar:///ha.ka.ba/api/v0.1/mu", depth: 1, kind: "meme", exists: true, implements: [], file: "lares/ha-ka-ba/api/v0.1/mu.md" },
      { uri: "lar:///LARES",            depth: 1, kind: "data", exists: true, implements: [], file: "lares/LARES.md" },
    ],
  };
}

function makeSnapshot(includeAhu = false): LarTLSnapshot {
  const frames = [
    { type: "frame" as const, id: memeFrameId("lar:///AGENTS"), scope: "document" as const, pageId: pageId("boot"), parentId: null, uri: "lar:///AGENTS", name: "AGENTS", depth: 0, frameKind: "meme" as const, rating: "meme", implements: [] },
    { type: "frame" as const, id: memeFrameId("lar:///ha.ka.ba/api/v0.1/mu"), scope: "document" as const, pageId: pageId("boot"), parentId: null, uri: "lar:///ha.ka.ba/api/v0.1/mu", name: "mu", depth: 1, frameKind: "meme" as const, rating: "meme", implements: [] },
    { type: "frame" as const, id: memeFrameId("lar:///LARES"), scope: "document" as const, pageId: pageId("boot"), parentId: null, uri: "lar:///LARES", name: "LARES", depth: 1, frameKind: "data" as const, rating: "data", implements: [] },
  ];
  return {
    version: 1,
    projectedAt: "2026-01-01T00:00:00.000Z",
    pages: [{ type: "page", id: pageId("boot"), scope: "document", name: "Boot", compiledAt: "2026-01-01T00:00:00.000Z", memeCount: 3 }],
    frames,
    arrows: [],
    notes: [],
  };
}

describe("memeDetailLayout", () => {
  test("uses larger frames than story-river (DETAIL_FRAME_W=320 > FRAME_W=220)", () => {
    const snap = makeSnapshot();
    const layout = memeDetailLayout(snap);
    const agentsGeo = layout.frames.get(memeFrameId("lar:///AGENTS"));
    expect(agentsGeo).toBeDefined();
    expect(agentsGeo!.w).toBeGreaterThan(220);
  });

  test("all meme frames get geometry", () => {
    const snap = makeSnapshot();
    const layout = memeDetailLayout(snap);
    for (const f of snap.frames) {
      if (f.frameKind === "meme") {
        expect(layout.frames.has(f.id)).toBe(true);
      }
    }
  });

  test("strategy name is meme-detail", () => {
    const snap = makeSnapshot();
    const layout = memeDetailLayout(snap);
    expect(layout.strategy).toBe("meme-detail");
  });
});

describe("graphLayout", () => {
  test("uses smaller frames than story-river (GRAPH_FRAME_W=160 < FRAME_W=220)", () => {
    const snap = makeSnapshot();
    const layout = graphLayout(snap);
    const agentsGeo = layout.frames.get(memeFrameId("lar:///AGENTS"));
    expect(agentsGeo).toBeDefined();
    expect(agentsGeo!.w).toBeLessThan(220);
  });

  test("strategy name is graph", () => {
    const snap = makeSnapshot();
    const layout = graphLayout(snap);
    expect(layout.strategy).toBe("graph");
  });
});

describe("renderAllViews", () => {
  test("produces 1 page (single-page zoom-gated model)", () => {
    const artifact = makeArtifact();
    const emission = renderAllViews(artifact);
    expect(emission.pages).toHaveLength(1);
    expect(emission.pages[0]!.id).toBe(pageId("boot"));
  });

  test("single page has all meme frames", () => {
    const artifact = makeArtifact();
    const emission = renderAllViews(artifact);
    const bootPageShapes = emission.shapes.filter(
      (s) => "parentId" in s && (s as { parentId: string }).parentId === pageId("boot"),
    );
    expect(bootPageShapes.length).toBeGreaterThanOrEqual(3);
  });

  test("emitted shape IDs are unique", () => {
    const artifact = makeArtifact();
    const emission = renderAllViews(artifact);
    const ids = emission.shapes.map((shape) => shape.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test("focusUri option is ignored (deprecated) — single page emitted regardless", () => {
    const artifact = makeArtifact();
    const emission = renderAllViews(artifact, { focusUri: "lar:///AGENTS" });
    expect(emission.pages).toHaveLength(1);
    expect(emission.pages[0]!.id).toBe(pageId("boot"));
  });

  test("meme frame shapes have URI-stable IDs matching memeFrameId", () => {
    const artifact = makeArtifact();
    const emission = renderAllViews(artifact);
    const frameIds = new Set(emission.shapes.filter((s) => (s as { type: string }).type === "frame").map((s) => s.id));
    expect(frameIds.has(memeFrameId("lar:///AGENTS"))).toBe(true);
    expect(frameIds.has(memeFrameId("lar:///LARES"))).toBe(true);
  });
});
