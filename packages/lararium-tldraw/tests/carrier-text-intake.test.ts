/**
 * Carrier-text intake — projection → shape.meta → store round-trip.
 *
 * Verifies the full path:
 *   readText(uri) → projectToTldraw → LarTLFrame.carrierText
 *   → emitTldrawRecords → shape.meta.carrierText
 *   → projection-cache intake simulation → store.get(uri).text
 *
 * This test closes the P4 arc: proves that carrierText survives
 * the projection pipeline and appears correctly on the emitted shape,
 * ready for LarariumCanvas to seed MemoryTiddlerStore.
 *
 * Does NOT import @lararium/tw5 (avoid cross-package dep in tldraw tests).
 * The store round-trip is verified separately in @lararium/tw5.
 */

import { describe, test, expect } from "@jest/globals";
import { projectToTldraw } from "../src/project.js";
import { emitTldrawRecords } from "../src/tldraw-shapes.js";
import { storyRiverLayout } from "../src/layout.js";
import type { BootArtifact } from "@lararium/core";

// ---------------------------------------------------------------------------
// Minimal fixture
// ---------------------------------------------------------------------------

const CARRIER_TEXT = `<<~ ahu #iam >>
uri-path = "test/meme"
confidence = 0.9
<<~/ahu >>
Body text for the meme carrier.`;

function makeArtifact(): BootArtifact {
  return {
    artifact: "boot" as const,
    entry: "lar:///test/meme",
    compiledAt: "2026-01-01T00:00:00.000Z",
    memeCount: 1,
    locusCount: 0,
    edgeCount: 0,
    interfaceIndex: {},
    invariantIndex: {},
    validation: { allResolved: true, allExist: true, missing: [], dagViolations: [], edgeViolationCount: 0, edgeErrors: 0 },
    closure: [
      {
        uri:            "lar:///test/meme",
        laresRelPath:   "lares/test/meme.md",
        depth:          0,
        kind:           "meme",
        virtual:        false,
        exists:         true,
        role:           "",
        hydrationSocket: "",
        implements:     [],
        contentHash:    "abc123",
        confidence:     0.9,
        register:       "CS",
        manaoio:        0.8,
        mana:           0.9,
        manao:          0.85,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// projectToTldraw — carrierText emission
// ---------------------------------------------------------------------------

describe("projectToTldraw — carrierText on meme frames", () => {
  test("frame carries meta.carrierText when readText returns text", () => {
    const artifact = makeArtifact();
    const snapshot = projectToTldraw(artifact, {
      readText: (uri) => uri === "lar:///test/meme" ? CARRIER_TEXT : null,
      includeAhuFrames: false,
    });

    const memFrame = snapshot.frames.find(
      (f) => f.uri === "lar:///test/meme" && f.frameKind === "meme",
    );
    expect(memFrame).toBeDefined();
    expect(memFrame!.carrierText).toBe(CARRIER_TEXT);
  });

  test("frame has no carrierText when readText returns null", () => {
    const artifact = makeArtifact();
    const snapshot = projectToTldraw(artifact, {
      readText: () => null,
      includeAhuFrames: false,
    });

    const memFrame = snapshot.frames.find((f) => f.uri === "lar:///test/meme");
    expect(memFrame).toBeDefined();
    expect(memFrame!.carrierText).toBeUndefined();
  });

  test("frame has no carrierText when readText is not provided", () => {
    const artifact = makeArtifact();
    const snapshot = projectToTldraw(artifact, { includeAhuFrames: false });
    const memFrame = snapshot.frames.find((f) => f.uri === "lar:///test/meme");
    expect(memFrame?.carrierText).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// emitTldrawRecords — meta.carrierText on tldraw shape
// ---------------------------------------------------------------------------

describe("emitTldrawRecords — shape.meta.carrierText", () => {
  test("emitted meme frame shape carries meta.carrierText", () => {
    const artifact = makeArtifact();
    const snapshot = projectToTldraw(artifact, {
      readText: (uri) => uri === "lar:///test/meme" ? CARRIER_TEXT : null,
      includeAhuFrames: false,
    });
    const layout   = storyRiverLayout(snapshot);
    const { shapes } = emitTldrawRecords(snapshot, layout);

    const memeShape = shapes.find((s) => {
      const meta = s.meta as Record<string, unknown> | undefined;
      return meta?.["frameKind"] === "meme" && meta?.["uri"] === "lar:///test/meme";
    });
    expect(memeShape).toBeDefined();

    const meta = memeShape!.meta as Record<string, unknown>;
    expect(meta["carrierText"]).toBe(CARRIER_TEXT);
  });

  test("shape meta does not carry carrierText when absent from frame", () => {
    const artifact = makeArtifact();
    const snapshot = projectToTldraw(artifact, { includeAhuFrames: false });
    const layout   = storyRiverLayout(snapshot);
    const { shapes } = emitTldrawRecords(snapshot, layout);

    const memeShape = shapes.find((s) => {
      const meta = s.meta as Record<string, unknown> | undefined;
      return meta?.["frameKind"] === "meme";
    });
    expect(memeShape).toBeDefined();
    expect((memeShape!.meta as Record<string, unknown>)["carrierText"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Intake simulation — shape.meta.carrierText → store seed
// ---------------------------------------------------------------------------

describe("intake simulation — carrierText → store record", () => {
  test("intake pipe extracts carrierText and title from shape.meta correctly", () => {
    const artifact = makeArtifact();
    const snapshot = projectToTldraw(artifact, {
      readText: (uri) => uri === "lar:///test/meme" ? CARRIER_TEXT : null,
      includeAhuFrames: false,
    });
    const layout   = storyRiverLayout(snapshot);
    const { shapes } = emitTldrawRecords(snapshot, layout);

    // Simulate the intake pipe from LarariumCanvas.seedAll()
    const intakeResults: { uri: string; text: string }[] = [];
    for (const shape of shapes) {
      const r    = shape as unknown as Record<string, unknown>;
      const meta = r["meta"] as Record<string, unknown> | undefined;
      if (meta?.["frameKind"] !== "meme") continue;
      const text = typeof meta["carrierText"] === "string" ? meta["carrierText"] : undefined;
      const uri  = typeof meta["uri"] === "string"         ? meta["uri"]         : undefined;
      if (!text || !uri || !uri.startsWith("lar:")) continue;
      intakeResults.push({ uri, text });
    }

    expect(intakeResults).toHaveLength(1);
    expect(intakeResults[0]!.uri).toBe("lar:///test/meme");
    expect(intakeResults[0]!.text).toBe(CARRIER_TEXT);
  });

  test("intake pipe skips shapes without carrierText", () => {
    const artifact = makeArtifact();
    const snapshot = projectToTldraw(artifact, { includeAhuFrames: false });
    const layout   = storyRiverLayout(snapshot);
    const { shapes } = emitTldrawRecords(snapshot, layout);

    const intakeResults: { uri: string; text: string }[] = [];
    for (const shape of shapes) {
      const r    = shape as unknown as Record<string, unknown>;
      const meta = r["meta"] as Record<string, unknown> | undefined;
      if (meta?.["frameKind"] !== "meme") continue;
      const text = typeof meta["carrierText"] === "string" ? meta["carrierText"] : undefined;
      const uri  = typeof meta["uri"] === "string"         ? meta["uri"]         : undefined;
      if (!text || !uri || !uri.startsWith("lar:")) continue;
      intakeResults.push({ uri, text });
    }

    expect(intakeResults).toHaveLength(0);
  });
});
