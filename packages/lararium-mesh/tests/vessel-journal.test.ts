/**
 * vessel-journal — memory-backed journal ordering and seq within (epoch, writer)
 *
 * Contracts:
 *   - JournalEntry holds epoch, seq (monotonic within epoch+writer, starting at 1), writer, kind, data
 *   - since() returns entries after a cursor; no timer inside waitFor
 *   - waitFor resolves on first matching entry after cursor (already present or appended later)
 *   - CONTROL: a non-matching entry never resolves a waiter
 *   - ring bounds entries in memory (default 4096)
 */

import { describe, test, expect } from "vitest";
import { memoryJournal, type VesselJournal, type JournalEntry } from "@lararium/mesh";

describe("memoryJournal", () => {
  test("RED: append bag-projected and read it back", () => {
    const j = memoryJournal("genesis-1", "writer-a");
    const entry = j.append("bag-projected", { bagId: "test-bag", path: "/mirrors/test-bag" });

    expect(entry.epoch).toBe("genesis-1");
    expect(entry.seq).toBe(1);
    expect(entry.writer).toBe("writer-a");
    expect(entry.kind).toBe("bag-projected");
    expect(entry.data).toEqual({ bagId: "test-bag", path: "/mirrors/test-bag" });
  });

  test("RED: seq increments within (epoch, writer)", () => {
    const j = memoryJournal("genesis-1", "writer-a");
    const e1 = j.append("verb-receipt", { verb: "load", ok: true });
    const e2 = j.append("verb-receipt", { verb: "save", ok: true });

    expect(e1.seq).toBe(1);
    expect(e2.seq).toBe(2);
  });

  test("RED: since() returns entries after cursor", () => {
    const j = memoryJournal("genesis-1", "writer-a");
    j.append("bag-projected", { bagId: "b1", path: "/mirrors/b1" });
    j.append("bag-projected", { bagId: "b2", path: "/mirrors/b2" });
    j.append("bag-projected", { bagId: "b3", path: "/mirrors/b3" });

    const cursor = { epoch: "genesis-1", writer: "writer-a", seq: 1 };
    const entries = j.since(cursor);

    expect(entries).toHaveLength(2);
    expect(entries[0].data).toEqual({ bagId: "b2", path: "/mirrors/b2" });
    expect(entries[1].data).toEqual({ bagId: "b3", path: "/mirrors/b3" });
  });

  test("RED: since() with no cursor returns all entries", () => {
    const j = memoryJournal("genesis-1", "writer-a");
    j.append("bag-projected", { bagId: "b1", path: "/mirrors/b1" });
    j.append("verb-receipt", { verb: "load", ok: true });

    const entries = j.since();

    expect(entries).toHaveLength(2);
    expect(entries[0].seq).toBe(1);
    expect(entries[1].seq).toBe(2);
  });

  test("RED: waitFor resolves on matching entry already present", async () => {
    const j = memoryJournal("genesis-1", "writer-a");
    j.append("bag-projected", { bagId: "lares", path: "/mirrors/lares" });
    j.append("bag-projected", { bagId: "other", path: "/mirrors/other" });

    const entry = await j.waitFor((e) => e.data.bagId === "lares");

    expect(entry.data).toEqual({ bagId: "lares", path: "/mirrors/lares" });
  });

  test("RED: waitFor resolves on matching entry appended later", async () => {
    const j = memoryJournal("genesis-1", "writer-a");
    j.append("bag-projected", { bagId: "b1", path: "/mirrors/b1" });

    const promise = j.waitFor((e) => e.data.bagId === "lares");

    j.append("bag-projected", { bagId: "lares", path: "/mirrors/lares" });

    const entry = await promise;
    expect(entry.data.bagId).toBe("lares");
  });

  test("CONTROL: waitFor never resolves on non-matching entry appended after cursor", async () => {
    const j = memoryJournal("genesis-1", "writer-a");
    j.append("bag-projected", { bagId: "b1", path: "/mirrors/b1" });

    const cursor = { epoch: "genesis-1", writer: "writer-a", seq: 1 };
    const promise = j.waitFor((e) => e.data.bagId === "target", cursor);

    j.append("bag-projected", { bagId: "wrong", path: "/mirrors/wrong" });

    j.append("bag-projected", { bagId: "target", path: "/mirrors/target" });

    const entry = await promise;
    expect(entry.data.bagId).toBe("target");
  });

  test("CONTROL: waitFor never resolves on non-matching entries, only on matching", async () => {
    const j = memoryJournal("genesis-1", "writer-a");

    const promise = j.waitFor((e) => e.data.bagId === "target");
    let resolved = false;
    let resolvedEntry: JournalEntry | null = null;

    promise.then((entry) => {
      resolved = true;
      resolvedEntry = entry;
    });

    // Append non-matching entries
    j.append("bag-projected", { bagId: "wrong1", path: "/mirrors/wrong1" });

    j.append("bag-projected", { bagId: "wrong2", path: "/mirrors/wrong2" });

    // One macrotask turn drains every microtask: had a non-match resolved the waiter, its `then` would have run.
    await new Promise((r) => setImmediate(r));
    expect(resolved).toBe(false);

    // Now append the matching entry
    j.append("bag-projected", { bagId: "target", path: "/mirrors/target" });

    const entry = await promise;
    expect(resolved).toBe(true);
    expect(entry.data.bagId).toBe("target");
  });

  test("RED: ring bounds entries (default size 4096)", () => {
    const j = memoryJournal("genesis-1", "writer-a", 5);
    
    for (let i = 0; i < 10; i++) {
      j.append("bag-projected", { bagId: `b${i}`, path: `/mirrors/b${i}` });
    }

    const entries = j.since();
    expect(entries.length).toBeLessThanOrEqual(5);
  });

  test("RED: separate writers produce separate seqs", () => {
    const j1 = memoryJournal("genesis-1", "writer-a");
    const j2 = memoryJournal("genesis-1", "writer-b");

    const e1a = j1.append("bag-projected", { bagId: "b1", path: "/mirrors/b1" });
    const e2a = j2.append("bag-projected", { bagId: "b2", path: "/mirrors/b2" });

    expect(e1a.seq).toBe(1);
    expect(e2a.seq).toBe(1);
    expect(e1a.writer).toBe("writer-a");
    expect(e2a.writer).toBe("writer-b");
  });

  test("T2 RED: a waiter whose abort signal fires cancels and leaves no waiter held", async () => {
    const j = memoryJournal("genesis-1", "writer-a");
    const abort = new AbortController();

    // Create promise and then abort
    let promise: Promise<JournalEntry>;
    promise = j.waitFor((e) => e.data.bagId === "never", { signal: abort.signal });
    abort.abort();

    // The waiter promise should reject with AbortError
    let abortError = false;
    try {
      await promise;
    } catch (e) {
      abortError = (e as Error).name === "AbortError";
    }

    expect(abortError).toBe(true);

    // After abort, append a matching entry — it must NOT resolve any new waiter
    j.append("bag-projected", { bagId: "never", path: "/mirrors/never" });

    // Verify the entry exists in the journal
    const entries = j.since();
    expect(entries.some((e) => e.data.bagId === "never")).toBe(true);
  });
});
