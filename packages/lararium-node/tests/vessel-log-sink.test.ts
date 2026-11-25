/**
 * vessel-log-sink — the vessel's console folded at the source: a storm writes nothing per line, a flush writes each
 * changed record once (one JSON line in run/vessel-live.log, one placement to the island), the live log stays bounded,
 * an earlier boot's live log folds into the month's ash, and the tap passes every byte through unchanged.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */

import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closingSlice, type ShoreLogPlacement } from "@lararium/mesh/shore-log";
import { openVesselLogSink, otakiageLiveLog, tapProcessStreams, SHORE_ASH_DIR, VESSEL_LIVE_LOG } from "../src/vessel-log-sink.js";

const dirs: string[] = [];
const scratch = (): string => { const d = mkdtempSync(join(tmpdir(), "vessel-log-sink-")); dirs.push(d); return d; };
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

/** A hand-driven timer: the test fires the flush. */
function handTimer() {
  const armed: Array<() => void> = [];
  return { schedule: (run: () => void) => { armed.push(run); return { cancel: () => { const i = armed.indexOf(run); if (i >= 0) armed.splice(i, 1); } }; }, armed };
}
const liveLines = (run: string): string[] => existsSync(join(run, VESSEL_LIVE_LOG)) ? readFileSync(join(run, VESSEL_LIVE_LOG), "utf8").split("\n").filter((l) => l !== "") : [];
const UNSEALED = "[sealed-rest] save-unsealed (holder-silent): 3xYqAbCdEfGh… waits in memory, never clear, until a session seals it";

describe("a storm folds at the source", () => {
  test("ten thousand lines write nothing until the flush, then one JSON line and one placement", () => {
    const run = scratch();
    const timer = handTimer();
    const sink = openVesselLogSink({ runDir: run, boot: "b1", schedule: timer.schedule });
    const placed: ShoreLogPlacement[][] = [];
    sink.attach((records) => placed.push([...records]));
    for (let i = 0; i < 10_000; i++) sink.take(UNSEALED);
    expect(timer.armed).toHaveLength(1);            // one flush armed, never one per line
    expect(liveLines(run)).toHaveLength(0);
    expect(placed).toHaveLength(0);
    timer.armed[0]!();
    const lines = liveLines(run);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({ kind: "sealed-rest/save-unsealed", subject: "3xYqAbCdEfGh", count: 10_000, boot: "b1" });
    expect(placed).toHaveLength(1);
    expect(placed[0]![0]!.fields["count"]).toBe("10000");
  });

  test("attach hands the whole ring first; replay hands it again; a refusing island never breaks the sink", () => {
    const run = scratch();
    const sink = openVesselLogSink({ runDir: run, boot: "b1", schedule: handTimer().schedule });
    sink.take("[faces] skips h1");
    sink.take(UNSEALED);
    const placed: number[] = [];
    sink.attach((records) => placed.push(records.length));
    sink.replay();
    expect(placed).toEqual([2, 2]);
    sink.attach(() => { throw new Error("daemon-restarting"); });
    expect(() => { sink.take("[x] more"); sink.flush(); }).not.toThrow();
  });

  test("past its byte bound the live log rewrites as the ring's own state, one line per event", () => {
    const run = scratch();
    const sink = openVesselLogSink({ runDir: run, boot: "b1", schedule: handTimer().schedule, liveMaxBytes: 2000 });
    for (let i = 0; i < 40; i++) { sink.take(UNSEALED); sink.take("[faces] skips h1"); sink.flush(); }
    const lines = liveLines(run);
    expect(lines.length).toBeLessThan(20);
    sink.close();
    expect(liveLines(run)).toHaveLength(2);         // the closing slice: one line per event
    expect(closingSlice(liveLines(run)).every((r) => r.count === 40)).toBe(true);
  });
});

describe("o-takiage of old rings", () => {
  test("an earlier boot's live log folds into the month's ash, and this boot's live log starts empty", () => {
    const run = scratch();
    const old = openVesselLogSink({ runDir: run, boot: "old", schedule: handTimer().schedule });
    old.take(UNSEALED); old.take(UNSEALED); old.flush(); old.take(UNSEALED); old.flush();
    expect(liveLines(run)).toHaveLength(2);
    const fresh = openVesselLogSink({ runDir: run, boot: "new", schedule: handTimer().schedule, now: () => new Date(Date.UTC(2026, 10, 25)) });
    expect(liveLines(run)).toHaveLength(0);
    const ash = readFileSync(join(run, SHORE_ASH_DIR, "2026-11.jsonl"), "utf8").split("\n").filter((l) => l !== "");
    expect(ash).toHaveLength(1);
    expect(JSON.parse(ash[0]!)).toMatchObject({ boot: "old", count: 3 });
    expect(fresh.boot).toBe("new");
  });
  test("the ash keeps its last lines alone; an absent or empty live log folds nothing", () => {
    const run = scratch();
    expect(otakiageLiveLog(run)).toBe(0);
    mkdirSync(join(run, SHORE_ASH_DIR), { recursive: true });
    for (let b = 0; b < 5; b++) {
      const s = openVesselLogSink({ runDir: run, boot: `b${b}`, schedule: handTimer().schedule });
      s.take(UNSEALED); s.flush();
      otakiageLiveLog(run, { now: new Date(Date.UTC(2026, 10, 1)), ashMaxLines: 3 });
    }
    const ash = readFileSync(join(run, SHORE_ASH_DIR, "2026-11.jsonl"), "utf8").split("\n").filter((l) => l !== "");
    expect(ash.map((l) => JSON.parse(l).boot)).toEqual(["b2", "b3", "b4"]);
    writeFileSync(join(run, VESSEL_LIVE_LOG), "");
    expect(otakiageLiveLog(run)).toBe(0);
  });
});

describe("the tap", () => {
  test("every byte passes through unchanged; whole lines fold; a partial line waits for its newline", () => {
    const seen: Array<[string, string]> = [];
    const written: string[] = [];
    const fake = { write: function (chunk: unknown) { written.push(String(chunk)); return true; } as typeof process.stdout.write };
    const fakeErr = { write: function (chunk: unknown) { written.push(`E:${String(chunk)}`); return true; } as typeof process.stdout.write };
    const untap = tapProcessStreams({ take: (line, stream) => { seen.push([line, stream ?? "stdout"]); } }, { stdout: fake, stderr: fakeErr });
    fake.write("[a] one\n[b] tw");
    fake.write("o\n");
    fakeErr.write(Buffer.from("[c] three\n"));
    expect(written).toEqual(["[a] one\n[b] tw", "o\n", "E:[c] three\n"]);
    expect(seen).toEqual([["[a] one", "stdout"], ["[b] two", "stdout"], ["[c] three", "stderr"]]);
    untap();
    fake.write("[d] after\n");
    expect(seen).toHaveLength(3);
  });
  test("a run dir that refuses keeps the records for the island", () => {
    const run = scratch();
    const blocked = join(run, "file-not-dir");
    writeFileSync(blocked, "");
    const sink = openVesselLogSink({ runDir: blocked, boot: "b", schedule: handTimer().schedule });
    const placed: number[] = [];
    sink.attach((r) => placed.push(r.length));
    sink.take(UNSEALED); sink.flush();
    expect(placed).toEqual([1]);
    expect(existsSync(join(blocked, VESSEL_LIVE_LOG))).toBe(false);
  });
});
