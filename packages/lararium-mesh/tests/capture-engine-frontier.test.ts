/**
 * capture-engine frontier-thread — the live-path proof that the turn-DAG fork-frontier rides
 * enqueue → annotate's `branch` arg, so a same-session FORK derives DISTINCT handles end-to-end
 * through the capture cell. The annotate here stamps the handle the branch-frontier derivations
 * read (deriveBranchFrontier + deriveHandle).
 */
import { describe, test, expect } from "vitest";
import {
  makeCaptureEngine,
  deriveBranchFrontier,
  deriveHandle,
  mkTelemetryPlaceVerb,
  mkStructurepalaceKapae,
  isVesselToIslandMsg,
} from "../src/index.js";
import type { CaptureRecord, CaptureReserve, FlushGate, BranchContext } from "../src/index.js";

const GATE: FlushGate = { depth: 1, maxWaitMs: 2000, maxDepth: 16, maxRetries: 5, backoffBaseMs: 100, backoffMaxMs: 5000 };

function stubReserve(): CaptureReserve {
  const wal: CaptureRecord[] = [];
  return {
    async append(r) { wal.push(r); },
    onOverflow() {},
    refill() { return []; },
    onDeadLetter() {},
    async replay() { return [...wal]; },
    async compact() { wal.length = 0; },
  };
}

const SPIRIT = "Mapper__agent-abc123__run-sessXYZ.jsonl";

/** A branch-aware annotate: the worldline handle, keyed by the fork frontier the engine threads. */
const handleAnnotate = (_turn: string, src: string, branch?: BranchContext): Record<string, string> => {
  const handle = deriveHandle(src, deriveBranchFrontier(branch));
  return handle ? { lar_agent_handle: handle } : {};
};

describe("frontier threads enqueue → annotate (the live cell)", () => {
  test("two same-session forks flush DISTINCT lar_agent_handle through the engine", async () => {
    const flushed: CaptureRecord[] = [];
    const engine = makeCaptureEngine({
      reserve: stubReserve(),
      flush: async (batch) => { flushed.push(...batch); return batch.length; },
      annotate: handleAnnotate,
      gate: GATE,
    });

    await engine.enqueue("Lares (Mapper): the verb leads", SPIRIT, { frontier: "turnA" });
    await engine.tick(50);
    await engine.enqueue("Lares (Mapper): the verb leads", SPIRIT, { frontier: "turnB" });
    await engine.tick(100);

    expect(flushed).toHaveLength(2);
    const hA = flushed[0]!.metadata!["lar_agent_handle"];
    const hB = flushed[1]!.metadata!["lar_agent_handle"];
    expect(hA).not.toBe(hB);
    expect(String(hA)).toMatch(/^sessXYZ~[0-9a-f]{8}\.abc123$/);
  });

  test("no frontier ⇒ the handle stays exactly the unforked run.agentId", async () => {
    const flushed: CaptureRecord[] = [];
    const engine = makeCaptureEngine({
      reserve: stubReserve(),
      flush: async (batch) => { flushed.push(...batch); return batch.length; },
      annotate: handleAnnotate,
      gate: GATE,
    });
    await engine.enqueue("Lares (Mapper): the verb leads", SPIRIT);
    await engine.tick(50);
    expect(flushed[0]!.metadata!["lar_agent_handle"]).toBe("sessXYZ.abc123");
  });
});

describe("mkTelemetryPlaceVerb carries the frontier (the transport leg)", () => {
  test("a frontier rides the signal; absent ⇒ no frontier field", () => {
    const withF = mkTelemetryPlaceVerb({ turnText: "t", sourceFile: "s", frontier: ["turnA"] });
    expect(withF.frontier).toEqual(["turnA"]);
    const noF = mkTelemetryPlaceVerb({ turnText: "t", sourceFile: "s" });
    expect(noF.frontier).toBeUndefined();
    const emptyF = mkTelemetryPlaceVerb({ turnText: "t", sourceFile: "s", frontier: [] });
    expect(emptyF.frontier).toBeUndefined();
  });
});

describe("strand-B: the turn_key + the structurepalace-kapae signal (the transport legs)", () => {
  test("enqueue threads turnKey → metadata.lar_turn_key (the .structurepalace provenance key)", async () => {
    const flushed: CaptureRecord[] = [];
    const engine = makeCaptureEngine({
      reserve: stubReserve(),
      flush: async (batch) => { flushed.push(...batch); return batch.length; },
      annotate: handleAnnotate,
      gate: GATE,
    });
    await engine.enqueue("Lares (Mapper): the verb leads", SPIRIT, undefined, "turn-uuid-1");
    await engine.tick(50);
    expect(flushed[0]!.metadata!["lar_turn_key"]).toBe("turn-uuid-1");
  });

  test("no turnKey ⇒ lar_turn_key absent (byte-identical to before)", async () => {
    const flushed: CaptureRecord[] = [];
    const engine = makeCaptureEngine({
      reserve: stubReserve(),
      flush: async (batch) => { flushed.push(...batch); return batch.length; },
      annotate: handleAnnotate,
      gate: GATE,
    });
    await engine.enqueue("Lares (Mapper): the verb leads", SPIRIT);
    await engine.tick(50);
    expect(flushed[0]!.metadata!["lar_turn_key"]).toBeUndefined();
  });

  test("mkStructurepalaceKapae carries the turnKey + optional ended, and is a valid vessel→island msg", () => {
    const m = mkStructurepalaceKapae({ turnKey: "turn-X" });
    expect(m.type).toBe("structurepalace:kapae");
    expect(m.turnKey).toBe("turn-X");
    expect(m.ended).toBeUndefined();
    expect(isVesselToIslandMsg(m)).toBe(true);
    const withEnded = mkStructurepalaceKapae({ turnKey: "turn-Y", ended: "2026-06-30" });
    expect(withEnded.ended).toBe("2026-06-30");
  });
});
