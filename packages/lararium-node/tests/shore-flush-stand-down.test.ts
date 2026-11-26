/**
 * shore-flush-stand-down — a graceful stop flushes every shore before the islands go down.
 *
 * `lares rite kukulu` replaces a standing vessel through the shim's down path: `compose stop` (or `down`) sends SIGTERM, and
 * the node's shutdown runs the composition's teardown registry (`shutdownComposition`). The shore's flush stands in that
 * registry's `flush` phase (`shoreFlushStandDown`), pushed after the Repo's own flush entries, so it runs first among them,
 * and always before the `islands` phase stands any island down. Its reading names each island that gave no answer and each
 * that left carriers unwritten.
 *
 *   SD1  the shore's flush runs ahead of the Repo's final flush and before any island goes down; a whole reading warns nothing
 *   SD2  an island that did not answer, and one that left carriers unwritten, each warn by name; the stop goes on
 *   SD3  the stand-down seals before the shore's last pins land: the sealed rest's stand-down runs first, once, and its own
 *        entry reads that same run
 *   SD4  a seal that faults warns by name and the flush still runs; the sealed rest's own entry names the fault
 */
import { describe, expect, test } from "vitest";
import { shutdownComposition, type ShutdownEntry } from "../src/composition-shutdown.js";
import { shoreFlushStandDown, type ShoreFlushReading } from "../src/shore-verb.js";

const WHOLE: ShoreFlushReading = { whole: true, islands: [{ island: "daemon", answered: true, written: [], writtenCount: 2, unwritten: [], unwrittenCount: 0, fileWrites: 2, drained: true }] };

/** The registry the vessel stands, in the order it pushes: the sealed rest, the Repo's flush, an island, then (after live) the
 *  shore's flush, which seals first through the same once-only run the sealed rest's entry reads. */
function registry(reading: ShoreFlushReading, sealFault?: Error) {
  const order: string[] = [], warned: string[] = [];
  let sealed: Promise<void> | null = null;
  const seal = (): Promise<void> => (sealed ??= (async () => { order.push("seal"); if (sealFault) throw sealFault; })());
  const entries: ShutdownEntry[] = [
    { what: "the sealed rest", phase: "flush", down: () => seal() },
    { what: "the Repo's final session flush", phase: "flush", down: () => { order.push("repo-flush"); } },
    { what: "the daemon island", phase: "islands", down: () => { order.push("island-down"); } },
    shoreFlushStandDown(async () => { order.push("shore-flush"); return reading; }, { seal, warn: (line) => warned.push(line) }),
  ];
  return { entries, order, warned };
}

describe("a graceful stop flushes every shore before the islands go down", () => {
  test("SD1 the shore's flush runs first in the flush phase, ahead of the Repo's flush and every island's stand-down", async () => {
    const r = registry(WHOLE);
    await shutdownComposition(r.entries);
    expect(r.order).toEqual(["seal", "shore-flush", "repo-flush", "island-down"]);
    expect(r.warned).toEqual([]);
  });

  test("SD2 an island that gave no answer and one that left carriers unwritten each warn by name, and the stop goes on", async () => {
    const r = registry({ whole: false, islands: [
      { island: "daemon", answered: false, why: "the island gave no answer within 15000ms" },
      { island: "wiki:sdm", answered: true, written: [], writtenCount: 0, unwritten: [{ state: "pending", uri: "lar:///a.b.c/owed", bagId: "lar:///ha.ka.ba/bags/sdm", why: "the queue still owed it" }] as never, unwrittenCount: 1, fileWrites: 0, drained: false },
    ] });
    await shutdownComposition(r.entries);
    expect(r.order).toEqual(["seal", "shore-flush", "repo-flush", "island-down"]);
    expect(r.warned.join("\n")).toMatch(/the daemon island did not answer: the island gave no answer within 15000ms/);
    expect(r.warned.join("\n")).toMatch(/the wiki:sdm island left 1 carrier\(s\) unwritten/);
  });

  test("SD3 the stand-down seals before the shore's last pins land, once, and the sealed rest's own entry reads that run", async () => {
    const r = registry(WHOLE);
    await shutdownComposition(r.entries);
    expect(r.order.indexOf("seal")).toBeLessThan(r.order.indexOf("shore-flush"));
    expect(r.order.filter((step) => step === "seal")).toHaveLength(1);
  });

  test("SD4 a seal that faults warns by name and the flush still runs; the sealed rest's entry names the fault", async () => {
    const r = registry(WHOLE, new Error("the holder refused the seal"));
    await expect(shutdownComposition(r.entries)).rejects.toThrow(/the holder refused the seal/);
    expect(r.order).toEqual(["seal", "shore-flush", "repo-flush", "island-down"]);
    expect(r.warned.join("\n")).toMatch(/the sealed rest's stand-down faulted ahead of it: the holder refused the seal/);
  });
});
