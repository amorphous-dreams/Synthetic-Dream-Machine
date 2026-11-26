/**
 * boot-wait — a boot step prints its own lines: what it waits on as it enters the wait, and its measured span (with what
 * landed, where the caller counts it) as the awaited work lands. The pacing timer prints a "still awaits" line and nothing
 * else: it ends no wait and fails no step. Every line of one step files under one shore-log event, at info, and none
 * reads as a boot milestone.
 *
 * CONTROL: a step whose work throws prints a `failed` line at error and throws the same cause on.
 */

import { describe, expect, test } from "vitest";

import { BOOT_PACE_MS, bootAwaitsLine, bootFailedLine, bootStillLine, bootStoodLine, bootWaits } from "../src/boot-wait.js";
import { classifyLogLine } from "../src/shore-log.js";

/** A boot wait over a hand-fired pacing timer and a hand-moved annotation clock. */
function rig(paceMs?: number) {
  const lines: string[] = [];
  let at = 0;
  let fire: (() => void) | null = null;
  let stopped = 0;
  const wait = bootWaits({
    log: (line) => lines.push(line),
    now: () => at,
    ...(paceMs !== undefined ? { paceMs } : {}),
    pace: (fn) => { fire = fn; return () => { fire = null; stopped++; }; },
  });
  return { wait, lines, advance: (ms: number) => { at += ms; }, pace: () => fire?.(), armed: () => fire !== null, stopped: () => stopped };
}

describe("a boot step names what it waits on", () => {
  test("the entry line lands before the work runs; the landing line carries the span and the count", async () => {
    const r = rig();
    let release!: (rows: number) => void;
    const landed = r.wait("face-catalog", "the sealed catalog's hydration", () => new Promise<number>((resolve) => { release = resolve; }), (rows) => `${rows} row(s)`);
    expect(r.lines).toEqual(["[boot] face-catalog: awaits the sealed catalog's hydration"]);
    r.advance(15_012);
    release(41);
    expect(await landed).toBe(41);
    expect(r.lines).toEqual([
      "[boot] face-catalog: awaits the sealed catalog's hydration",
      "[boot] face-catalog: stood in 15012ms (41 row(s))",
    ]);
    expect(r.armed()).toBe(false);
  });

  test("a step with no count closes on its span alone; a count that throws leaves the line bare", async () => {
    const r = rig();
    r.advance(0);
    await r.wait("place-session", "the place session's stand", async () => { r.advance(7); });
    await r.wait("share-config", "the share config", () => 3, () => { throw new Error("unreadable"); });
    expect(r.lines.filter((l) => l.includes("stood"))).toEqual(["[boot] place-session: stood in 7ms", "[boot] share-config: stood in 0ms"]);
  });

  test("the pacing timer prints a still line per figure and ends nothing", async () => {
    const r = rig(250);
    let release!: () => void;
    const landed = r.wait("daemon-island", "the daemon island's open", () => new Promise<void>((resolve) => { release = resolve; }));
    r.pace();
    r.pace();
    r.pace();
    expect(r.lines.slice(1)).toEqual([
      "[boot] daemon-island: still awaits the daemon island's open (1 pacing figure(s) of 250ms)",
      "[boot] daemon-island: still awaits the daemon island's open (2 pacing figure(s) of 250ms)",
      "[boot] daemon-island: still awaits the daemon island's open (3 pacing figure(s) of 250ms)",
    ]);
    // Three figures passed and the step still waits: only its own work ends it.
    expect(r.armed()).toBe(true);
    release();
    await landed;
    expect(r.lines.at(-1)).toBe("[boot] daemon-island: stood in 0ms");
    expect(r.stopped()).toBe(1);
  });

  test("the pacing figure reads BOOT_PACE_MS where none rides", async () => {
    const lines: string[] = [];
    let fire: (() => void) | null = null;
    let asked = -1;
    const wait = bootWaits({ log: (l) => lines.push(l), now: () => 0, pace: (fn, ms) => { fire = fn; asked = ms; return () => { fire = null; }; } });
    let release!: () => void;
    const landed = wait("sealed-map", "the map", () => new Promise<void>((resolve) => { release = resolve; }));
    (fire as (() => void) | null)?.();
    release();
    await landed;
    expect(asked).toBe(BOOT_PACE_MS);
    expect(lines[1]).toBe(bootStillLine("sealed-map", "the map", 1, BOOT_PACE_MS));
  });

  test("CONTROL: a step that throws prints its failed line, stops its pacing and throws the same cause", async () => {
    const r = rig();
    const cause = new Error("holder-locked");
    await expect(r.wait("face-catalog", "the holder", async () => { r.advance(40); throw cause; })).rejects.toBe(cause);
    expect(r.lines).toEqual(["[boot] face-catalog: awaits the holder", "[boot] face-catalog: failed after 40ms (holder-locked)"]);
    expect(r.armed()).toBe(false);
  });
});

describe("the boot lines in the shore log and beside the milestones", () => {
  const lines = [
    bootAwaitsLine("face-catalog", "the sealed catalog's hydration through the daemon island's holder"),
    bootStillLine("face-catalog", "the sealed catalog's hydration through the daemon island's holder", 2, BOOT_PACE_MS),
    bootStoodLine("face-catalog", 15_012, "41 row(s)"),
  ];

  test("every line of one step files under one event, at info", () => {
    for (const line of lines) {
      const e = classifyLogLine(line);
      expect(e?.kind).toBe("boot/face-catalog");
      expect(e?.severity).toBe("info");
      expect(e?.subject).toBe("");
    }
    expect(classifyLogLine(bootStoodLine("daemon-island", 3))?.kind).toBe("boot/daemon-island");
  });

  test("a failed step reads error under its own step's event", () => {
    const e = classifyLogLine(bootFailedLine("face-catalog", 40, "holder-locked"));
    expect(e?.kind).toBe("boot/face-catalog");
    expect(e?.severity).toBe("error");
  });

  test("no boot line carries the milestone marker a supervisor reads", () => {
    for (const line of [...lines, bootFailedLine("face-catalog", 40, "holder-locked")]) expect(line).not.toMatch(/phase → /);
  });
});
