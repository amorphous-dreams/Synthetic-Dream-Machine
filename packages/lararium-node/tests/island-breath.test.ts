/**
 * island-breath — each island's own thread writes its boot breath beside the vessel, and every reader judges it by one rule.
 *
 * Measured (2026-11-28): a face daemon island spent 83 s on the control document's slot while the vessel's main thread held,
 * every door read silent, and the kūkulu rite ended over a vessel that only worked. The tap writes the breath an island posts
 * (state, phase, progress, the process's CPU work) to `<run>/breath/<key>.json` from the island's own thread; `breathMoved`
 * judges two reads (a moved island, a new island, or a quarter second of CPU work moves it; a fault names itself), and the
 * healthcheck (`breath-health`) reads healthy where `/api/health` answers or the breath moved since its last check.
 */
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { BREATH_WORK_USEC, breathDirFromEnv, breathMoved, islandBreathTap, readIslandBreath, type IslandBreathRecord } from "../src/island-breath.js";
import { breathHealth } from "../src/breath-health.js";

const dirs: string[] = [];
const scratch = (): string => { const d = mkdtempSync(join(tmpdir(), "island-breath-")); dirs.push(d); return join(d, "run", "breath"); };
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

const FACE = "lar:///ha.ka.ba/daemon/h0", WIKI = "lar:///ha.ka.ba/wiki/lares";

describe("islandBreathTap", () => {
  test("RED: a breath, then an ea, write one record per wiki, the latest alone, carrying the process's CPU work", () => {
    const dir = scratch();
    let cpu = 100;
    const tap = islandBreathTap(dir, () => cpu);
    tap({ type: "breath", wikiUri: FACE, phase: "manifest", progress: 0 });
    cpu = 900;
    tap({ type: "breath", wikiUri: FACE, phase: "slot bags/control", progress: 4 });
    tap({ type: "breath", wikiUri: WIKI, phase: "manifest", progress: 1 });
    expect(readIslandBreath(dir)).toEqual([
      { wikiUri: FACE, state: "mounting", phase: "slot bags/control", progress: 4, cpuUsec: 900 },
      { wikiUri: WIKI, state: "mounting", phase: "manifest", progress: 1, cpuUsec: 900 },
    ]);
    tap({ type: "ea", wikiUri: WIKI });
    expect(readIslandBreath(dir)?.find((r) => r.wikiUri === WIKI)?.state).toBe("ready");
    expect(readdirSync(dir).filter((n) => n.endsWith(".next"))).toEqual([]);
  });

  test("RED: a fault marks the record with the fault's words; other messages write nothing", () => {
    const dir = scratch();
    const tap = islandBreathTap(dir, () => 1);
    tap({ type: "event", wikiUri: FACE });
    expect(readIslandBreath(dir)).toBeNull();
    tap({ type: "breath", wikiUri: FACE, phase: "slot bags/control", progress: 2 });
    tap({ type: "fault", wikiUri: FACE, error: "manifest handler threw: boom" });
    expect(readIslandBreath(dir)).toEqual([{ wikiUri: FACE, state: "fault", phase: "slot bags/control", progress: 2, cpuUsec: 1, fault: "manifest handler threw: boom" }]);
  });

  test("CONTROL: no dir handed writes nothing and throws nothing; a dir under a file stops the tap quietly", () => {
    expect(() => islandBreathTap(null)({ type: "breath", wikiUri: FACE, phase: "p", progress: 0 })).not.toThrow();
    expect(() => islandBreathTap("/dev/null/breath")({ type: "breath", wikiUri: FACE, phase: "p", progress: 0 })).not.toThrow();
  });

  test("the breath dir follows LAR_ROOT, and none stands without one", () => {
    expect(breathDirFromEnv({ LAR_ROOT: "/lar" })).toBe("/lar/run/breath");
    expect(breathDirFromEnv({})).toBeNull();
  });
});

describe("breathMoved", () => {
  const rec = (over: Partial<IslandBreathRecord> = {}): IslandBreathRecord => ({ wikiUri: FACE, state: "mounting", phase: "slot bags/control", progress: 3, cpuUsec: 1_000_000, ...over });
  test("a first read moves; a progress, a phase, a state or a new island moves; CPU work past the bound moves; else it stands still", () => {
    expect(breathMoved(null, [rec()]).verdict).toBe("moves");
    expect(breathMoved([rec()], [rec({ progress: 4 })]).verdict).toBe("moves");
    expect(breathMoved([rec()], [rec({ phase: "ea" })]).verdict).toBe("moves");
    expect(breathMoved([rec()], [rec({ state: "ready" })]).verdict).toBe("moves");
    expect(breathMoved([rec()], [rec(), rec({ wikiUri: WIKI })]).verdict).toBe("moves");
    expect(breathMoved([rec()], [rec({ cpuUsec: 1_000_000 + BREATH_WORK_USEC })]).verdict).toBe("moves");
    expect(breathMoved([rec()], [rec({ cpuUsec: 1_000_000 + BREATH_WORK_USEC - 1 })]).verdict).toBe("still");
  });
  test("a fault names itself, whatever moved", () => {
    expect(breathMoved([rec()], [rec({ state: "fault", fault: "boom" })])).toEqual({ verdict: "fault", fault: "boom", wikiUri: FACE });
  });
});

describe("breathHealth", () => {
  test("RED: a vessel not ready whose breath moves since the last check reads healthy; a still breath reads unhealthy", async () => {
    const dir = scratch();
    let cpu = 1_000_000, progress = 0;
    const tap = () => islandBreathTap(dir, () => cpu)({ type: "breath", wikiUri: FACE, phase: "slot bags/control", progress });
    const check = () => breathHealth({ ready: async () => false, dir, say: () => {} });
    tap();
    expect(await check()).toBe(0);
    progress = 1; tap();
    expect(await check()).toBe(0);
    cpu += 5_000_000; tap();
    expect(await check()).toBe(0);
    expect(await check()).toBe(1);
  });

  test("ready answers healthy at once; a fault or no breath reads unhealthy", async () => {
    const dir = scratch();
    expect(await breathHealth({ ready: async () => true, dir, say: () => {} })).toBe(0);
    expect(await breathHealth({ ready: async () => false, dir, say: () => {} })).toBe(1);
    islandBreathTap(dir, () => 1)({ type: "fault", wikiUri: FACE, error: "boom" });
    const said: string[] = [];
    expect(await breathHealth({ ready: async () => false, dir, say: (l) => said.push(l) })).toBe(1);
    expect(said.join("\n")).toMatch(/boom/);
  });
});
