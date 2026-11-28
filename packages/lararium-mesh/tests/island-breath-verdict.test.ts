/**
 * island-breath-verdict — one rule judges two reads of the islands' boot breath: movement by the islands' own evidence or the
 * process's CPU work, a fault by name, and never a clock.
 */
import { describe, expect, test } from "vitest";
import { BREATH_WORK_USEC, breathFault, breathMoved, type IslandBreathRecord } from "../src/island-breath-verdict.js";

const rec = (over: Partial<IslandBreathRecord> = {}): IslandBreathRecord => ({ wikiUri: "lar:///ha.ka.ba/daemon/h0", state: "mounting", phase: "slot bags/control", progress: 3, cpuUsec: 1_000_000, ...over });

describe("breathMoved", () => {
  test("RED: frozen evidence and CPU work under a quarter second stand still; at the bound they move", () => {
    expect(breathMoved([rec()], [rec({ cpuUsec: 1_000_000 + BREATH_WORK_USEC - 1 })])).toEqual({ verdict: "still" });
    expect(breathMoved([rec()], [rec({ cpuUsec: 1_000_000 + BREATH_WORK_USEC })])).toEqual({ verdict: "moves" });
  });
  test("an island that vanished from the read moves nothing by itself; one that faulted names its fault", () => {
    expect(breathMoved([rec(), rec({ wikiUri: "w" })], [rec()])).toEqual({ verdict: "still" });
    expect(breathFault([rec(), rec({ wikiUri: "w", state: "fault" })])).toEqual({ fault: "the island faulted", wikiUri: "w" });
  });
});
