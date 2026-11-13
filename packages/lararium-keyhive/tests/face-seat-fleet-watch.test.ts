import { describe, expect, test } from "vitest";
import { makeFaceSeat, watchFaceSeatFleet } from "../src/face-seat.js";
import { FACE_GRANT_PREFIX, type FaceGrantRecord } from "../src/face-grant-record.js";

describe("the face seat follows its local fleet board", () => {
  test("a retry requested during a failed open attaches once; later retries do nothing", async () => {
    let reject!: (error: Error) => void;
    let opens = 0, attachments = 0, wakes = 0, logs = 0;
    const first = new Promise<never>((_resolve, fail) => { reject = fail; });
    const watch = watchFaceSeatFleet({
      open: async () => {
        if (++opens === 1) return first;
        return { on: () => { attachments++; }, off: () => {} };
      },
      wake: () => { wakes++; }, log: () => { logs++; },
    });
    const opening = watch.attach();
    void watch.attach(); // a causal retry arrives before the first open rejects
    reject(new Error("offline"));
    await opening;
    expect({ opens, attachments, wakes, logs }).toEqual({ opens: 2, attachments: 1, wakes: 1, logs: 1 });
    await watch.attach(); // CONTROL: an attached watcher does not reopen
    expect({ opens, attachments, wakes, logs }).toEqual({ opens: 2, attachments: 1, wakes: 1, logs: 1 });
    watch.stop();
  });

  test("attachment wakes an already present proof, changes wake again, and stop detaches", async () => {
    let listener: (() => void) | undefined;
    let wakes = 0;
    const handle = {
      on: (_event: "change", fn: () => void) => { listener = fn; },
      off: (_event: "change", fn: () => void) => { if (listener === fn) listener = undefined; },
    };
    const watch = watchFaceSeatFleet({ open: async () => handle, wake: () => { wakes++; }, log: () => {} });
    await watch.attach();
    expect(wakes).toBe(1);
    listener?.();
    expect(wakes).toBe(2);
    watch.stop();
    expect(listener).toBeUndefined();
  });

  test("a stop while opening never attaches or wakes", async () => {
    let resolve!: (value: { on: () => void; off: () => void }) => void;
    let attached = 0, wakes = 0;
    const opening = new Promise<{ on: () => void; off: () => void }>((r) => { resolve = r; });
    const watch = watchFaceSeatFleet({ open: () => opening, wake: () => { wakes++; }, log: () => {} });
    const pending = watch.attach();
    watch.stop();
    resolve({ on: () => { attached++; }, off: () => {} });
    await pending;
    expect({ attached, wakes }).toEqual({ attached: 0, wakes: 0 });
  });

  test("a board lift during a standing read queues a fresh pass; an unchanged aside stays unseated", async () => {
    const exercise = async (lift: boolean) => {
      let listener: (() => void) | undefined, known = false, reads = 0, ingests = 0;
      let standing: "clear" | "aside" = "aside";
      let release!: () => void, started!: () => void;
      const blocked = new Promise<void>((resolve) => { release = resolve; });
      const reading = new Promise<void>((resolve) => { started = resolve; });
      const seat = makeFaceSeat({
        group: "group", selfVerifyingKey: "abcd", personaRootDid: "root", personaKel: { prefix: "root", chain: [] },
        knowsAgent: async () => known,
        grants: async () => [{ title: `${FACE_GRANT_PREFIX}group/abcd`, record: { sig: "sig", capEvents: [], founderEdge: { deviceVerifyingKey: "founder" } } as unknown as FaceGrantRecord }],
        founderStanding: async () => { const snapshot = standing; if (++reads === 1) { started(); await blocked; } return snapshot; },
        verify: async (_record, context) => context.dyad?.("founder") === "aside" ? { ok: false, reason: "aside" } : { ok: true },
        ingest: async () => { ingests++; known = true; }, lift: async () => {}, log: () => {},
      });
      const watch = watchFaceSeatFleet({
        open: async () => ({ on: (_event, fn) => { listener = fn; }, off: () => { listener = undefined; } }),
        wake: () => { seat.daemonChanged("fleet-board"); seat.wake(); }, log: () => {},
      });
      await watch.attach(); await reading;
      if (lift) standing = "clear";
      listener?.(); release(); await seat.settled(); watch.stop();
      return { reads, ingests, known };
    };
    expect(await exercise(false)).toEqual({ reads: 2, ingests: 0, known: false });
    expect(await exercise(true)).toEqual({ reads: 2, ingests: 1, known: true });
  });
});
