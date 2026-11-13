/**
 * vessel-journal-file — durable journal on disk, appending then fsync before notify
 *
 * Contracts:
 *   - Each entry appends as one JSON line before waitFor resolves
 *   - File replay on open recovers seq and ring
 *   - CONTROL: fresh epoch starts at seq 1
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { fileJournal } from "@lararium/node";
import type { VesselJournal, JournalEntry } from "@lararium/mesh";

describe("fileJournal", () => {
  let tempDir: string;
  let journalPath: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `vessel-journal-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    mkdirSync(tempDir, { recursive: true });
    journalPath = join(tempDir, "journal.jsonl");
  });

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("RED: append bag-projected to file and read it back", async () => {
    const j = fileJournal(journalPath, "genesis-1", "writer-a");
    const entry = j.append("bag-projected", { bagId: "test-bag", path: "/mirrors/test-bag" });

    expect(entry.epoch).toBe("genesis-1");
    expect(entry.seq).toBe(1);
    expect(entry.writer).toBe("writer-a");

    // Entry must be written to file before append returns
    const lines = readFileSync(journalPath, "utf-8").trim().split("\n");
    expect(lines.length).toBe(1);
    const line = JSON.parse(lines[0]) as JournalEntry;
    if (line.kind === "bag-projected") {
      expect(line.data.bagId).toBe("test-bag");
    }
  });

  test("RED: waitFor resolves after entry is written to file", async () => {
    const j = fileJournal(journalPath, "genesis-1", "writer-a");

    const promise = j.waitFor((e) => {
      if (e.kind === "bag-projected" && "bagId" in e.data) {
        return e.data.bagId === "lares";
      }
      return false;
    });

    // The waiter stands before the entry lands: the promise exists, then the append runs.
    j.append("bag-projected", { bagId: "lares", path: "/mirrors/lares" });

    const entry = await promise;
    if (entry.kind === "bag-projected") {
      expect(entry.data.bagId).toBe("lares");
    }

    // Verify the entry stands in the file
    const lines = readFileSync(journalPath, "utf-8").trim().split("\n");
    expect(lines.length).toBeGreaterThan(0);
  });

  test("RED: replay after reopen continues seq", async () => {
    const j1 = fileJournal(journalPath, "genesis-1", "writer-a");
    j1.append("bag-projected", { bagId: "b1", path: "/mirrors/b1" });
    j1.append("bag-projected", { bagId: "b2", path: "/mirrors/b2" });

    // Reopen and append
    const j2 = fileJournal(journalPath, "genesis-1", "writer-a");
    const e3 = j2.append("bag-projected", { bagId: "b3", path: "/mirrors/b3" });

    expect(e3.seq).toBe(3);

    // All three entries in file
    const lines = readFileSync(journalPath, "utf-8").trim().split("\n");
    expect(lines.length).toBe(3);
  });

  test("CONTROL: fresh epoch starts at seq 1", () => {
    const j1 = fileJournal(journalPath, "genesis-1", "writer-a");
    j1.append("bag-projected", { bagId: "b1", path: "/mirrors/b1" });
    j1.append("bag-projected", { bagId: "b2", path: "/mirrors/b2" });

    // New epoch, same path
    const journalPath2 = join(tempDir, "journal2.jsonl");
    const j2 = fileJournal(journalPath2, "genesis-2", "writer-a");
    const e1 = j2.append("bag-projected", { bagId: "b3", path: "/mirrors/b3" });

    expect(e1.seq).toBe(1);
    expect(e1.epoch).toBe("genesis-2");
  });

  test("RED: epoch cursor crossing — old epoch cursor resolves on new epoch matching entry", async () => {
    const j1 = fileJournal(journalPath, "genesis-1", "writer-a");
    j1.append("bag-projected", { bagId: "target", path: "/mirrors/target" });
    j1.append("bag-projected", { bagId: "other", path: "/mirrors/other" });

    // Cursor from old epoch
    const oldCursor = { epoch: "genesis-1", writer: "writer-a", seq: 2 };

    // Reopen with new epoch
    const j2 = fileJournal(journalPath, "genesis-2", "writer-a");

    // Waiter with old epoch cursor should resolve on first matching entry in new epoch
    const promise = j2.waitFor((e) => {
      if (e.kind === "bag-projected" && "bagId" in e.data) {
        return e.data.bagId === "target";
      }
      return false;
    }, oldCursor);

    // The waiter stands before the entry lands: the promise exists, then the append runs.
    j2.append("bag-projected", { bagId: "target", path: "/mirrors/target-2" });

    const entry = await promise;
    expect(entry.epoch).toBe("genesis-2");
    if (entry.kind === "bag-projected") {
      expect(entry.data.bagId).toBe("target");
    }
  });

  test("RED: file compaction at reopen — truncate past twice ring size", () => {
    const ringSize = 5;
    const j1 = fileJournal(journalPath, "genesis-1", "writer-a", ringSize);

    // Write more than twice the ring
    for (let i = 0; i < 12; i++) {
      j1.append("bag-projected", { bagId: `b${i}`, path: `/mirrors/b${i}` });
    }

    const linesBeforeClose = readFileSync(journalPath, "utf-8").trim().split("\n");
    expect(linesBeforeClose.length).toBe(12);

    // Reopen should compact if > 2x ring
    const j2 = fileJournal(journalPath, "genesis-1", "writer-a", ringSize);

    const linesAfterReopen = readFileSync(journalPath, "utf-8").trim().split("\n");
    expect(linesAfterReopen.length).toBeLessThanOrEqual(ringSize);
    expect(linesAfterReopen.length).toBeGreaterThan(0);

    // Latest entries should be preserved
    const lastLine = JSON.parse(linesAfterReopen[linesAfterReopen.length - 1]) as JournalEntry;
    if (lastLine.kind === "bag-projected") {
      expect(lastLine.data.bagId).toBe("b11");
    }
  });

  test("RED: since() returns entries after cursor", () => {
    const j = fileJournal(journalPath, "genesis-1", "writer-a");
    j.append("bag-projected", { bagId: "b1", path: "/mirrors/b1" });
    j.append("bag-projected", { bagId: "b2", path: "/mirrors/b2" });
    j.append("bag-projected", { bagId: "b3", path: "/mirrors/b3" });

    const cursor = { epoch: "genesis-1", writer: "writer-a", seq: 1 };
    const entries = j.since(cursor);

    expect(entries).toHaveLength(2);
    const firstEntry = entries[0] as JournalEntry;
    if (firstEntry.kind === "bag-projected") {
      expect(firstEntry.data.bagId).toBe("b2");
    }
  });

  test("RED: one writer keeps every seq distinct across a compaction, and the next append continues the count", () => {
    const ringSize = 3;
    const j1 = fileJournal(journalPath, "boot-1", "node-daemon", ringSize);
    for (let i = 1; i <= 7; i++) j1.append("bag-projected", { bagId: `b${i}`, path: `/mirrors/b${i}` });
    const reopened = fileJournal(journalPath, "boot-1", "node-daemon", ringSize);
    const lines = readFileSync(journalPath, "utf-8").trim().split("\n");
    expect(lines.length).toBe(ringSize);
    expect(reopened.since().map((e) => e.seq)).toEqual([5, 6, 7]);
    expect(reopened.append("bag-projected", { bagId: "b8", path: "/mirrors/b8" }).seq).toBe(8);
  });
  test("RED: an entry handed in through the daemon's journal resolves a waiter held before it, and a non-matching entry before it resolves nothing", async () => {
    const daemon = fileJournal(journalPath, "boot-1", "node-daemon");
    const seen: string[] = [];
    const waiter = daemon.waitFor((e) => e.kind === "bag-projected" && (e.data as { bagId: string }).bagId === "lares")
      .then((e) => { seen.push((e.data as { bagId: string }).bagId); return e; });
    daemon.append("bag-projected", { bagId: "other", path: "/mirrors/other" });
    daemon.append("bag-projected", { bagId: "lares", path: "/mirrors/lares" });
    const entry = await waiter;
    expect(seen).toEqual(["lares"]);
    expect(entry.seq).toBe(2);
  });
  test("T1/B3 RED: second boot answers current epoch only; old epoch entries not returned without old cursor", () => {
    const j1 = fileJournal(journalPath, "genesis-1", "daemon");
    j1.append("bag-projected", { bagId: "lares", path: "/mirrors/lares" });
    j1.append("verb-receipt", { verb: "load", ok: true });

    // Fresh boot, new epoch
    const j2 = fileJournal(journalPath, "genesis-2", "daemon");
    const entries = j2.since();

    // No entries returned (from old epoch)
    expect(entries).toHaveLength(0);

    // Append in new epoch
    j2.append("bag-projected", { bagId: "lararium", path: "/mirrors/lararium" });
    const fresh = j2.since();
    expect(fresh).toHaveLength(1);
    expect(fresh[0].epoch).toBe("genesis-2");
  });

  test("T1/B3 RED: projector re-announces bag after restart when first file stands again", async () => {
    const j1 = fileJournal(journalPath, "genesis-1", "daemon");
    j1.append("bag-projected", { bagId: "lares", path: "/mirrors/lares" });

    // Fresh boot, new epoch — no old entries visible, so projector can re-announce
    const j2 = fileJournal(journalPath, "genesis-2", "daemon");

    // Projector sees no "lares" entry in current epoch, so can announce again
    const currentEntries = j2.since();
    const hasLares = currentEntries.some((e) => {
      if (e.kind === "bag-projected" && "bagId" in e.data) {
        return e.data.bagId === "lares";
      }
      return false;
    });
    expect(hasLares).toBe(false);

    // Append the same bag again
    j2.append("bag-projected", { bagId: "lares", path: "/mirrors/lares" });
    const updated = j2.since();
    const reannounced = updated.filter((e) => {
      if (e.kind === "bag-projected" && "bagId" in e.data) {
        return e.data.bagId === "lares";
      }
      return false;
    });
    expect(reannounced).toHaveLength(1);
  });

  test("RED: a torn line after a whole one truncates on reopen, and the next append reads back whole", () => {
    const j1 = fileJournal(journalPath, "boot-1", "node-daemon");
    j1.append("bag-projected", { bagId: "b1", path: "/mirrors/b1" });
    writeFileSync(journalPath, readFileSync(journalPath, "utf-8") + '{"epoch":"boot-1","seq":2,"wri');
    const j2 = fileJournal(journalPath, "boot-1", "node-daemon");
    expect(j2.append("bag-projected", { bagId: "b2", path: "/mirrors/b2" }).seq).toBe(2);
    const lines = readFileSync(journalPath, "utf-8").trim().split("\n").map((l) => JSON.parse(l) as JournalEntry);
    expect(lines.map((e) => (e.data as { bagId: string }).bagId)).toEqual(["b1", "b2"]);
  });
  test("RED: a damaged row between whole ones refuses by name, and the journal opens over the rows around it", () => {
    const j1 = fileJournal(journalPath, "boot-1", "node-daemon");
    j1.append("bag-projected", { bagId: "b1", path: "/mirrors/b1" });
    writeFileSync(journalPath, readFileSync(journalPath, "utf-8") + "not a row\n");
    j1.append("bag-projected", { bagId: "b2", path: "/mirrors/b2" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const j2 = fileJournal(journalPath, "boot-1", "node-daemon");
      expect(j2.since().map((e) => (e.data as { bagId: string }).bagId)).toEqual(["b1", "b2"]);
      expect(j2.append("bag-projected", { bagId: "b3", path: "/mirrors/b3" }).seq).toBe(3);
      expect(warn.mock.calls.some(([line]) => String(line).includes("line 2 refused"))).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });
});
