/**
 * unavailable-settled — when an `unavailable` may be believed.
 *
 * ── THE TWO ABSENCES LOOK IDENTICAL ─────────────────────────────────────────────────────────────
 * A hearth-private doc never crosses the tideline, so the library answering `unavailable` reads as a
 * terminal answer: no peer will ever supply it, and failing fast beats waiting out a deadline for a
 * doc that will never come. That reading holds for a doc nobody wrote. It fails for a doc THIS VESSEL
 * JUST WROTE, where an in-flight local write is indistinguishable from an absent one at the moment of
 * asking.
 *
 * ── THE WRITER'S OWN EVENT DECIDES, NEVER A CLOCK ────────────────────────────────────────────────
 * A caller that reads back its own write hands `settled`, the writer's flush. The first `unavailable`
 * waits for that event, asks again, and believes the second answer. A caller that names no pending write
 * gets the terminal answer at once. A mesh-shared `unavailable` was never terminal and stays that way.
 *
 *   RED:      a throwing clock spy over the boot read: no wall or monotonic clock is read.
 *   CONTROL:  a doc already rested reads at once, and settled never runs.
 *   POSITIVE: an unrested own write resolves on its flush.
 */
import { describe, it, expect, vi } from "vitest";
import { resolveBootDoc, unavailableVerdict } from "../src/boot-resolver.js";

type Reading = { state: "ready"; handle: unknown } | { state: "unavailable" };

/** A repo whose n-th ask answers the n-th reading; a later ask than the script reads the last one. */
function scriptedRepo(readings: readonly Reading[]) {
  let asks = 0;
  return {
    asks: () => asks,
    repo: {
      findWithProgress: () => {
        const reading = readings[Math.min(asks++, readings.length - 1)]!;
        return {
          subscribe: (fn: (s: Reading) => void) => { queueMicrotask(() => fn(reading)); return () => {}; },
          whenReady: () => reading.state === "ready" ? Promise.resolve(reading.handle) : Promise.reject(new Error("unavailable")),
        };
      },
    } as never,
  };
}
const URL = "automerge:doc" as never;

describe("unavailable-settled — a local absence waits for the writer's own flush", () => {
  it("★ the verdict: hearth-private waits only while its own write is pending; mesh-shared always waits ★", () => {
    expect(unavailableVerdict({ tideline: "hearth-private", awaitingOwnWrite: true })).toBe("wait");
    expect(unavailableVerdict({ tideline: "hearth-private", awaitingOwnWrite: false })).toBe("terminal");
    expect(unavailableVerdict({ tideline: "mesh-shared", awaitingOwnWrite: false })).toBe("wait");
  });

  it("★ RED: the boot read reads no clock — a throwing spy over Date.now and performance.now stays silent ★", async () => {
    const boom = (): never => { throw new Error("a clock was read"); };
    const dateSpy = vi.spyOn(Date, "now").mockImplementation(boom);
    const perfSpy = vi.spyOn(performance, "now").mockImplementation(boom);
    try {
      const handle = { url: URL };
      const own = scriptedRepo([{ state: "unavailable" }, { state: "ready", handle }]);
      await expect(resolveBootDoc(own.repo, URL, { tideline: "hearth-private", label: "t", settled: () => Promise.resolve() })).resolves.toBe(handle);
      const absent = scriptedRepo([{ state: "unavailable" }]);
      await expect(resolveBootDoc(absent.repo, URL, { tideline: "hearth-private", label: "t" })).rejects.toMatchObject({ reason: "doc-unavailable" });
      // CONTROL: the spies bite, so a silent run proves no read.
      expect(() => Date.now()).toThrow("a clock was read");
    } finally { dateSpy.mockRestore(); perfSpy.mockRestore(); }
  });

  it("★ CONTROL: a doc already rested reads at once, and the flush never runs ★", async () => {
    const handle = { url: URL };
    const rested = scriptedRepo([{ state: "ready", handle }]);
    const settled = vi.fn(() => Promise.resolve());
    await expect(resolveBootDoc(rested.repo, URL, { tideline: "hearth-private", label: "t", settled })).resolves.toBe(handle);
    expect(settled).not.toHaveBeenCalled();
    expect(rested.asks()).toBe(1);
  });

  it("★ POSITIVE: an unrested own write resolves on its flush, asking again once ★", async () => {
    const handle = { url: URL };
    const own = scriptedRepo([{ state: "unavailable" }, { state: "ready", handle }]);
    let flushed!: () => void;
    const settled = new Promise<void>((resolve) => { flushed = resolve; });
    const read = resolveBootDoc(own.repo, URL, { tideline: "hearth-private", label: "t", settled });
    await Promise.resolve();
    expect(own.asks()).toBe(1);          // still waiting on the write
    flushed();
    await expect(read).resolves.toBe(handle);
    expect(own.asks()).toBe(2);
  });

  it("★ a write that rests and still leaves the doc unavailable reads terminal: nothing is landing now ★", async () => {
    const own = scriptedRepo([{ state: "unavailable" }]);
    await expect(resolveBootDoc(own.repo, URL, { tideline: "hearth-private", label: "t", settled: () => Promise.resolve() }))
      .rejects.toMatchObject({ reason: "doc-unavailable" });
  });
});
