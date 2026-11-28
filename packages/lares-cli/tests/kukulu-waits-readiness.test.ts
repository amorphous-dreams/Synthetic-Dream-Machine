/**
 * kukulu-waits-readiness — the rite's post-stand steps follow the new vessel's OWN readiness, never a fixed clock.
 *
 * Measured (2026-11-28, develop ecb0cf896): a no-terminal `lares rite kukulu` stood the new vessel (docker "healthy"), then
 * its first door call read `vessel-silent` while the face daemon island spent 83 s loading the control document, and the rite
 * ended exit 1 over a vessel that only worked. The cure: a door that answers silent, composing or unreached sends the rite to
 * the vessel's pulse (the container's state and its cumulative CPU work). A vessel that still works keeps the wait open, as
 * long as it works; one that stopped (not running) refuses `vessel-fault`; one that stands running and spends no work
 * between two reads refuses `vessel-stalled`. The clock paces the reads and decides nothing.
 *
 * Every rite port answers from a FAKE.
 */
import { describe, expect, it } from "vitest";
import { riteKukulu, type RitePorts, type StandReading, type StandingAnswer, type RiteVerbAnswer } from "../src/rite-kukulu.js";
import { awaitVesselAnswer, WORK_USEC, type VesselPulse } from "../src/vessel-readiness-wait.js";

const HEAD = "a".repeat(40), IMAGE = "sha256:" + "ab".repeat(32);
const DOWN: StandReading = { revision: HEAD, image: IMAGE, how: "built", vessel: "down", current: false, pulama: "off", lit: null, admitted: null, offer: false };
const SILENT = { ok: false as const, code: "vessel-silent", message: "the vessel's custody door gave no answer: `lares vessel read` names what holds the store" };
const NONE: StandingAnswer = { ok: true, begins: [], pending: [] };

/** A vessel that answers silent `silentReads` times, then reads; its pulse spends `workPerRead` µs of CPU between reads. */
function fakes(over: { silentReads: number; pulse?: (n: number) => VesselPulse | null; land?: RiteVerbAnswer[] }) {
  const lines: string[] = [];
  let reads = 0, pulses = 0, paces = 0;
  const ports: RitePorts = {
    checkout: async () => ({ head: HEAD, branch: "main" }),
    stage: async () => ({ code: 0, reading: DOWN }),
    raise: async () => 0,
    tty: () => false,
    row: async () => ({ ok: false, code: "swarm-lei-absent", message: "no lei" }),
    standing: async () => (reads++ < over.silentReads ? SILENT : NONE),
    ...(over.pulse ? { vesselPulse: async () => over.pulse!(pulses++), pace: async () => { paces++; } } : {}),
    say: (line) => { lines.push(line); },
  };
  return { ports, lines, reads: () => reads, paces: () => paces };
}

const working = (n: number): VesselPulse => ({ status: "running", health: "healthy", exitCode: null, cpuUsec: 1_000_000 + n * 5_000_000 });

describe("kukulu follows the new vessel's own readiness after the stand", () => {
  it("RED: a door that reads silent while the vessel still works keeps the rite waiting, and the rite lands once the door answers", async () => {
    const f = fakes({ silentReads: 3, pulse: working });
    const out = await riteKukulu(f.ports, {});
    expect(out.code, f.lines.join("\n")).toBe(0);
    expect(f.reads()).toBe(4);
    expect(f.paces()).toBe(3);
    expect(f.lines.some((l) => /the new vessel still works/.test(l))).toBe(true);
    expect(f.lines.some((l) => /reads no begun halves/.test(l))).toBe(false);
  });

  it("RED: a vessel that stands running and spends no work between two reads refuses `vessel-stalled`, naming where to read", async () => {
    const f = fakes({ silentReads: Number.POSITIVE_INFINITY, pulse: () => ({ status: "running", health: "healthy", exitCode: null, cpuUsec: 42_000_000 }) });
    const out = await riteKukulu(f.ports, {});
    expect(out.code).toBe(1);
    expect(out.data["refusal"]).toBe("vessel-stalled");
    expect(f.reads()).toBe(2);
    expect(f.lines.join("\n")).toMatch(/lares-container\.sh logs/);
  });

  it("RED: a vessel that stopped refuses `vessel-fault` at once, naming its exit", async () => {
    const f = fakes({ silentReads: Number.POSITIVE_INFINITY, pulse: () => ({ status: "exited", health: "none", exitCode: 137, cpuUsec: null }) });
    const out = await riteKukulu(f.ports, {});
    expect(out.code).toBe(1);
    expect(out.data["refusal"]).toBe("vessel-fault");
    expect(f.reads()).toBe(1);
    expect(f.lines.join("\n")).toMatch(/137/);
  });

  it("CONTROL: with no pulse port, the door's own refusal stands as before (no wait)", async () => {
    const f = fakes({ silentReads: Number.POSITIVE_INFINITY });
    const out = await riteKukulu(f.ports, {});
    expect(out.code).toBe(1);
    expect(out.data["refusal"]).toBe("vessel-silent");
    expect(f.reads()).toBe(1);
  });
});

describe("awaitVesselAnswer", () => {
  const rig = (answers: Array<{ ok: true } | { ok: false; code: string; message: string }>, pulses: Array<VesselPulse | null>) => {
    let i = 0, p = 0;
    const lines: string[] = [];
    return {
      lines,
      run: () => awaitVesselAnswer(async () => answers[Math.min(i++, answers.length - 1)]!, {
        pulse: async () => pulses[Math.min(p++, pulses.length - 1)]!, pace: async () => {}, say: (l) => lines.push(l), what: "the new vessel",
      }),
    };
  };

  it("a refusal the vessel's readiness does not explain (a lei, a lock) returns at once, unpulsed", async () => {
    const r = rig([{ ok: false, code: "vessel-locked", message: "locked" }], [working(0)]);
    expect(await r.run()).toEqual({ ok: false, code: "vessel-locked", message: "locked" });
  });

  it("a pulse that reads nowhere (no docker) leaves the door's refusal standing", async () => {
    const r = rig([SILENT], [null]);
    expect(await r.run()).toEqual(SILENT);
  });

  it("work just under the bound reads as no work: the wait judges by the vessel's CPU counter, never by elapsed time", async () => {
    const r = rig([SILENT], [working(0), { ...working(0), cpuUsec: working(0).cpuUsec! + WORK_USEC - 1 }]);
    const out = await r.run();
    expect(out.ok).toBe(false);
    expect((out as { code: string }).code).toBe("vessel-stalled");
  });

  it("composing, unreached and a timed-out door each wait on the pulse too", async () => {
    for (const code of ["vessel-composing", "daemon-unreachable", "store-door-timeout"]) {
      const r = rig([{ ok: false, code, message: code }, { ok: true }], [working(0)]);
      expect(await r.run()).toEqual({ ok: true });
    }
  });
});
