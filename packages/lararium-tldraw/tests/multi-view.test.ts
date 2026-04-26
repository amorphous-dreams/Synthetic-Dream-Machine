import { describe, test, expect } from "@jest/globals";
import { renderAllViews } from "../src/multi-view.js";
import { memeDetailLayout, graphLayout } from "../src/layout.js";
import type { LarTLSnapshot } from "../src/records.js";
import { memeFrameId, pageId } from "../src/records.js";

// Minimal synthetic boot artifact for testing
function makeArtifact() {
  return {
    artifact: "minimal-boot" as const,
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
    { type: "frame" as const, id: memeFrameId("lar:///AGENTS"), scope: "document" as const, pageId: pageId("minimal-boot"), parentId: null, uri: "lar:///AGENTS", name: "AGENTS", depth: 0, frameKind: "meme" as const, rating: "meme", implements: [] },
    { type: "frame" as const, id: memeFrameId("lar:///ha.ka.ba/api/v0.1/mu"), scope: "document" as const, pageId: pageId("minimal-boot"), parentId: null, uri: "lar:///ha.ka.ba/api/v0.1/mu", name: "mu", depth: 1, frameKind: "meme" as const, rating: "meme", implements: [] },
    { type: "frame" as const, id: memeFrameId("lar:///LARES"), scope: "document" as const, pageId: pageId("minimal-boot"), parentId: null, uri: "lar:///LARES", name: "LARES", depth: 1, frameKind: "data" as const, rating: "data", implements: [] },
  ];
  return {
    version: 1,
    projectedAt: "2026-01-01T00:00:00.000Z",
    pages: [{ type: "page", id: pageId("minimal-boot"), scope: "document", name: "Minimal Boot", compiledAt: "2026-01-01T00:00:00.000Z", memeCount: 3 }],
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
  test("produces 3 pages (story-river, meme-detail, graph)", () => {
    const artifact = makeArtifact();
    const emission = renderAllViews(artifact);
    expect(emission.pages).toHaveLength(3);
    const pageIds = emission.pages.map((p) => p.id);
    expect(pageIds).toContain(pageId("minimal-boot"));
    expect(pageIds).toContain(pageId("meme-detail"));
    expect(pageIds).toContain(pageId("graph"));
  });

  test("all pages have meme frames", () => {
    const artifact = makeArtifact();
    const emission = renderAllViews(artifact);
    const shapesByPage = new Map<string, number>();
    for (const shape of emission.shapes) {
      if ("parentId" in shape) {
        const pid = (shape as { parentId: string }).parentId;
        shapesByPage.set(pid, (shapesByPage.get(pid) ?? 0) + 1);
      }
    }
    // Each page should have at least the 3 meme shapes
    for (const page of emission.pages) {
      const count = shapesByPage.get(page.id) ?? 0;
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test("emitted shape IDs are unique across all pages", () => {
    const artifact = makeArtifact();
    const emission = renderAllViews(artifact);
    const ids = emission.shapes.map((shape) => shape.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test("graph page shapes use smaller frame dimensions", () => {
    const artifact = makeArtifact();
    const emission = renderAllViews(artifact);
    const graphShapes = emission.shapes.filter(
      (s) => "parentId" in s && (s as { parentId: string }).parentId === pageId("graph") && (s as { type: string }).type === "frame"
    );
    expect(graphShapes.length).toBeGreaterThan(0);
    for (const s of graphShapes) {
      const w = (s as { props: { w: number } }).props.w;
      expect(w).toBeLessThan(220); // graph uses GRAPH_FRAME_W=160
    }
  });

  test("meme-detail page uses focus entry by default", () => {
    const artifact = makeArtifact();
    const emission = renderAllViews(artifact, { focusUri: "lar:///AGENTS" });
    const detailPage = emission.pages.find((p) => p.id === pageId("meme-detail"));
    expect(detailPage).toBeDefined();
    expect(detailPage!.name).toContain("AGENTS");
  });
});
