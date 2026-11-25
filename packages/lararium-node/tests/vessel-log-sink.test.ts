/**
 * vessel-log-sink — the vessel's console folded at the source and landed as the nalu lands: each event key one FAMILY on
 * the shore's queue, crests of whole families, the next crest only once the last one landed. No clock paces it: time alone
 * lands nothing. A storm writes nothing per line; a burst of N identical lines lands ONE family with count N; no crest cuts a
 * family; the live log stays bounded; an earlier boot's live log folds into the month's ash; the tap passes every byte.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closingSlice, type ShoreLogPlacement } from "@lararium/mesh/shore-log";
import { openVesselLogSink, otakiageLiveLog, tapProcessStreams, SHORE_ASH_DIR, VESSEL_LIVE_LOG } from "../src/vessel-log-sink.js";
import { readFileSync as readSource } from "node:fs";

const dirs: string[] = [];
const scratch = (): string => { const d = mkdtempSync(join(tmpdir(), "vessel-log-sink-")); dirs.push(d); return d; };
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

/** A hand-held host task: each yield waits until the test gives the host its turn. Never a timer. */
function handHost() {
  const waiting: Array<() => void> = [];
  const yieldHost = () => new Promise<void>((resolve) => { waiting.push(resolve); });
  /** Give the host turns until the sink stands idle (each turn resolves the pending yield, then lets its crest land). */
  const turn = async (times = 1): Promise<void> => {
    for (let i = 0; i < times; i++) { const next = waiting.shift(); if (!next) return; next(); await new Promise<void>((r) => setImmediate(r)); }
  };
  const settle = async (): Promise<void> => { while (waiting.length > 0) await turn(); };
  return { yieldHost, waiting, turn, settle };
}
const liveLines = (run: string): string[] => existsSync(join(run, VESSEL_LIVE_LOG)) ? readFileSync(join(run, VESSEL_LIVE_LOG), "utf8").split("\n").filter((l) => l !== "") : [];
const UNSEALED = "[sealed-rest] save-unsealed (holder-silent): 3xYqAbCdEfGh… waits in memory, never clear, until a session seals it";

describe("the shore's queue, crested", () => {
  test("no clock paces the sink: time alone lands nothing, and the sink arms no timer", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "Date"] });
    try {
      const run = scratch();
      const host = handHost();
      const sink = openVesselLogSink({ runDir: run, boot: "b1", yieldHost: host.yieldHost, now: () => new Date(0) });
      const placed: ShoreLogPlacement[][] = [];
      sink.attach((records) => { placed.push([...records]); });
      for (let i = 0; i < 100; i++) sink.take(UNSEALED);
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(3_600_000);
      expect(liveLines(run)).toHaveLength(0);
      expect(placed).toHaveLength(0);
      await host.settle();                          // the host's own turn, never the clock, lands the crest
      expect(liveLines(run)).toHaveLength(1);
      expect(placed).toHaveLength(1);
    } finally { vi.useRealTimers(); }
  });

  test("the sink's source names no timer and reads no duration", () => {
    const src = readSource(new URL("../src/vessel-log-sink.ts", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\bset(?:Timeout|Interval)\s*\(|performance\.now|Date\.now/);
  });

  test("a burst of N identical lines lands ONE family with count N: one JSON line, one placement", async () => {
    const run = scratch();
    const host = handHost();
    const sink = openVesselLogSink({ runDir: run, boot: "b1", yieldHost: host.yieldHost });
    const placed: ShoreLogPlacement[][] = [];
    sink.attach((records) => { placed.push([...records]); });
    for (let i = 0; i < 10_000; i++) sink.take(UNSEALED);
    expect(sink.queued()).toBe(1);                  // one family, queued once
    expect(liveLines(run)).toHaveLength(0);         // nothing written per line
    await host.settle();
    const lines = liveLines(run);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({ kind: "sealed-rest/save-unsealed", subject: "3xYqAbCdEfGh", count: 10_000, boot: "b1" });
    expect(placed).toEqual([[expect.objectContaining({ fields: expect.objectContaining({ count: "10000" }) })]]);
  });

  test("lines that fold while a crest lands raise the family's count; the family queues once again, never per line", async () => {
    const run = scratch();
    const host = handHost();
    const gate: { release?: () => void; held: boolean } = { held: false };
    const placed: string[] = [];
    const sink = openVesselLogSink({ runDir: run, boot: "b1", yieldHost: host.yieldHost });
    sink.attach((records) => {
      placed.push(records.map((r) => r.fields["count"]).join(","));
      if (gate.held) return;                        // only the first landing holds
      gate.held = true;
      return new Promise<void>((r) => { gate.release = r; });
    });
    sink.take(UNSEALED);
    await host.turn();                              // the first crest lands into the island and waits on it
    for (let i = 0; i < 500; i++) sink.take(UNSEALED);
    expect(sink.queued()).toBe(1);
    expect(placed).toEqual(["1"]);
    await host.turn();
    expect(placed).toEqual(["1"]);                  // the next crest waits on the landing's own backpressure
    gate.release?.();
    await host.settle();
    await sink.settled();
    expect(placed).toEqual(["1", "501"]);
  });

  test("a crest takes whole families up to its bound and never cuts one; the next crest waits for a host turn", async () => {
    const run = scratch();
    const host = handHost();
    const crests: string[][] = [];
    const sink = openVesselLogSink({ runDir: run, boot: "b1", yieldHost: host.yieldHost, crest: { count: 2, bytes: 1_000_000, ops: 1 } });
    sink.attach((records) => { crests.push(records.map((r) => r.fields["kind"]!)); });
    sink.take("[a] one thing"); sink.take("[b] two thing"); sink.take("[a] one thing"); sink.take("[c] three thing"); sink.take("[d] four thing");
    expect(sink.queued()).toBe(4);
    await host.turn();
    expect(crests).toEqual([["a/one-thing", "b/two-thing"]]);
    await host.settle();
    expect(crests).toEqual([["a/one-thing", "b/two-thing"], ["c/three-thing", "d/four-thing"]]);
    const a = closingSlice(liveLines(run)).find((r) => r.kind === "a/one-thing");
    expect(a?.count).toBe(2);                       // the family landed whole: both lines in one record
  });

  test("a family heavier than the byte bound crests alone; the queue moves on", async () => {
    const run = scratch();
    const host = handHost();
    const crests: number[] = [];
    const sink = openVesselLogSink({ runDir: run, boot: "b1", yieldHost: host.yieldHost, crest: { count: 64, bytes: 10, ops: 1 } });
    sink.attach((records) => { crests.push(records.length); });
    sink.take("[a] one thing"); sink.take("[b] two thing");
    await host.settle();
    expect(crests).toEqual([1, 1]);
  });

  test("attach hands the whole ring first; replay hands it again; a refusing island never breaks the sink", async () => {
    const run = scratch();
    const host = handHost();
    const sink = openVesselLogSink({ runDir: run, boot: "b1", yieldHost: host.yieldHost });
    sink.take("[faces] skips h1");
    sink.take(UNSEALED);
    const placed: number[] = [];
    sink.attach((records) => { placed.push(records.length); });
    sink.replay();
    expect(placed).toEqual([2, 2]);
    sink.attach(() => { throw new Error("daemon-restarting"); });
    sink.take("[x] more");
    await expect(host.settle()).resolves.toBeUndefined();
    sink.attach(() => Promise.reject(new Error("daemon-down")));
    sink.take("[x] more");
    await expect(host.settle()).resolves.toBeUndefined();
  });

  test("past its byte bound the live log rewrites as the ring's own state; the close leaves one line per event", async () => {
    const run = scratch();
    const host = handHost();
    const sink = openVesselLogSink({ runDir: run, boot: "b1", yieldHost: host.yieldHost, liveMaxBytes: 2000 });
    for (let i = 0; i < 40; i++) { sink.take(UNSEALED); sink.take("[faces] skips h1"); await host.settle(); }
    expect(liveLines(run).length).toBeLessThan(20);
    sink.close();
    expect(liveLines(run)).toHaveLength(2);
    expect(closingSlice(liveLines(run)).every((r) => r.count === 40)).toBe(true);
  });

  test("flush lands every queued family at once (the close's path), with no host turn", () => {
    const run = scratch();
    const host = handHost();
    const sink = openVesselLogSink({ runDir: run, boot: "b1", yieldHost: host.yieldHost });
    sink.take(UNSEALED); sink.take("[faces] skips h1");
    sink.flush();
    expect(liveLines(run)).toHaveLength(2);
    expect(sink.queued()).toBe(0);
  });
});

describe("o-takiage of old rings", () => {
  test("an earlier boot's live log folds into the month's ash, and this boot's live log starts empty", () => {
    const run = scratch();
    const old = openVesselLogSink({ runDir: run, boot: "old", yieldHost: handHost().yieldHost });
    old.take(UNSEALED); old.take(UNSEALED); old.flush(); old.take(UNSEALED); old.flush();
    expect(liveLines(run)).toHaveLength(2);
    const fresh = openVesselLogSink({ runDir: run, boot: "new", yieldHost: handHost().yieldHost, now: () => new Date(Date.UTC(2026, 10, 25)) });
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
      const s = openVesselLogSink({ runDir: run, boot: `b${b}`, yieldHost: handHost().yieldHost });
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
    const sink = openVesselLogSink({ runDir: blocked, boot: "b", yieldHost: handHost().yieldHost });
    const placed: number[] = [];
    sink.attach((r) => placed.push(r.length));
    sink.take(UNSEALED); sink.flush();
    expect(placed).toEqual([1]);
    expect(existsSync(join(blocked, VESSEL_LIVE_LOG))).toBe(false);
  });
});
