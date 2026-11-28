/**
 * kukulu-waits-readiness — the rite's post-stand steps follow the new vessel's OWN readiness, never a fixed clock.
 *
 * Measured (2026-11-28, develop ecb0cf896): a no-terminal `lares rite kukulu` stood the new vessel (docker "healthy"), then
 * its first door call read `vessel-silent` while the face daemon island spent 83 s loading the control document, and the rite
 * ended exit 1 over a vessel that only worked. The cure: a door that answers silent, composing or unreached sends the rite to
 * the islands' BREATH (`lares vessel breath`: each island's own thread writes its state, phase, progress and the process's CPU
 * work off the vessel's main thread). A breath that moves keeps the wait open as long as it moves; one that names a fault
 * refuses `vessel-fault`; one that stands still between two reads refuses `vessel-stalled`. The clock paces the reads and
 * decides nothing.
 *
 * Every rite port answers from a FAKE.
 */
import { describe, expect, it } from "vitest";
import type { IslandBreathRecord } from "@lararium/mesh/island-breath-verdict";
import { riteKukulu, type RitePorts, type StandReading, type StandingAnswer } from "../src/rite-kukulu.js";
import { awaitVesselAnswer, breathOf } from "../src/vessel-readiness-wait.js";

const HEAD = "a".repeat(40), IMAGE = "sha256:" + "ab".repeat(32);
const DOWN: StandReading = { revision: HEAD, image: IMAGE, how: "built", vessel: "down", current: false, pulama: "off", lit: null, admitted: null, offer: false };
const SILENT = { ok: false as const, code: "vessel-silent", message: "the vessel's custody door gave no answer: `lares vessel read` names what holds the store" };
const NONE: StandingAnswer = { ok: true, begins: [], pending: [] };
const FACE = "lar:///ha.ka.ba/daemon/h0";

/** One island mounting at `phase`, its progress `progress`, the process having spent `cpuUsec`. */
const mounting = (progress: number, cpuUsec = 1_000_000, phase = "slot bags/control"): IslandBreathRecord[] =>
  [{ wikiUri: FACE, state: "mounting", phase, progress, cpuUsec }];

/** A vessel that answers silent `silentReads` times, then reads; its breath answers `breath(n)` on the n-th breath read. */
function fakes(over: { silentReads: number; breath?: (n: number) => IslandBreathRecord[] | null }) {
  const lines: string[] = [];
  let reads = 0, breaths = 0, paces = 0;
  const ports: RitePorts = {
    checkout: async () => ({ head: HEAD, branch: "main" }),
    stage: async () => ({ code: 0, reading: DOWN }),
    raise: async () => 0,
    tty: () => false,
    row: async () => ({ ok: false, code: "swarm-lei-absent", message: "no lei" }),
    standing: async () => (reads++ < over.silentReads ? SILENT : NONE),
    ...(over.breath ? { breath: async () => over.breath!(breaths++), pace: async () => { paces++; } } : {}),
    say: (line) => { lines.push(line); },
  };
  return { ports, lines, reads: () => reads, paces: () => paces };
}

describe("kukulu follows the new vessel's own readiness after the stand", () => {
  it("RED: a door that reads silent while an island's breath advances keeps the rite waiting, and the rite lands once the door answers", async () => {
    const f = fakes({ silentReads: 3, breath: (n) => mounting(n) });
    const out = await riteKukulu(f.ports, {});
    expect(out.code, f.lines.join("\n")).toBe(0);
    expect(f.reads()).toBe(4);
    expect(f.paces()).toBe(3);
    expect(f.lines.some((l) => /the new vessel still works/.test(l))).toBe(true);
    expect(f.lines.some((l) => /reads no begun halves/.test(l))).toBe(false);
  });

  it("RED: a held main thread with a frozen island still moves the breath by the process's CPU work, and the rite waits", async () => {
    const f = fakes({ silentReads: 2, breath: (n) => mounting(7, 1_000_000 + n * 4_000_000) });
    const out = await riteKukulu(f.ports, {});
    expect(out.code, f.lines.join("\n")).toBe(0);
    expect(f.reads()).toBe(3);
  });

  it("RED: a breath that stands still between two reads refuses `vessel-stalled`, naming the island's phase and where to read", async () => {
    const f = fakes({ silentReads: Number.POSITIVE_INFINITY, breath: () => mounting(7, 42_000_000) });
    const out = await riteKukulu(f.ports, {});
    expect(out.code).toBe(1);
    expect(out.data["refusal"]).toBe("vessel-stalled");
    expect(f.reads()).toBe(2);
    expect(f.lines.join("\n")).toMatch(/slot bags\/control#7/);
    expect(f.lines.join("\n")).toMatch(/lares-container\.sh logs/);
  });

  it("RED: an island whose breath names a fault refuses `vessel-fault` at once, naming the island and the fault", async () => {
    const f = fakes({ silentReads: Number.POSITIVE_INFINITY, breath: () => [{ wikiUri: FACE, state: "fault", phase: "slot bags/control", progress: 3, cpuUsec: 9, fault: "manifest handler threw: boom" }] });
    const out = await riteKukulu(f.ports, {});
    expect(out.code).toBe(1);
    expect(out.data["refusal"]).toBe("vessel-fault");
    expect(f.reads()).toBe(1);
    expect(f.lines.join("\n")).toMatch(/boom/);
  });

  it("CONTROL: with no breath port, or a breath that reads nowhere, the door's own refusal stands as before (no wait)", async () => {
    for (const breath of [undefined, () => null]) {
      const f = fakes({ silentReads: Number.POSITIVE_INFINITY, ...(breath ? { breath } : {}) });
      const out = await riteKukulu(f.ports, {});
      expect(out.code).toBe(1);
      expect(out.data["refusal"]).toBe("vessel-silent");
      expect(f.reads()).toBe(1);
    }
  });
});

describe("awaitVesselAnswer", () => {
  const rig = (answers: Array<{ ok: true } | { ok: false; code: string; message: string }>, breaths: Array<IslandBreathRecord[] | null>) => {
    let i = 0, b = 0;
    return () => awaitVesselAnswer(async () => answers[Math.min(i++, answers.length - 1)]!, {
      breath: async () => breaths[Math.min(b++, breaths.length - 1)]!, pace: async () => {}, say: () => {}, what: "the new vessel",
    });
  };

  it("a refusal the vessel's readiness does not explain (a lock, a lei) returns at once, unread", async () => {
    expect(await rig([{ ok: false, code: "vessel-locked", message: "locked" }], [mounting(0)])()).toEqual({ ok: false, code: "vessel-locked", message: "locked" });
  });

  it("composing, unreached and a timed-out door each wait on the breath too", async () => {
    for (const code of ["vessel-composing", "daemon-unreachable", "store-door-timeout"]) {
      expect(await rig([{ ok: false, code, message: code }, { ok: true }], [mounting(0)])()).toEqual({ ok: true });
    }
  });
});

describe("breathOf", () => {
  it("reads the `vessel breath` answer's records, and null where it names none", () => {
    expect(breathOf({ breath: mounting(2) })).toEqual(mounting(2));
    expect(breathOf({ breath: null })).toBeNull();
    expect(breathOf(null)).toBeNull();
    expect(breathOf({ breath: [{ wikiUri: FACE, state: "asleep" }] })).toEqual([]);
  });
});
