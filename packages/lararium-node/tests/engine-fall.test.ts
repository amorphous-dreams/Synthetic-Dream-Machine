/**
 * AN ENGINE THAT FALLS FLUSHES, STOPS AND RISES ONCE.
 *
 * One isolate shares one Automerge wasm engine, and nothing in-process re-instantiates it, so a fallen vessel flushes what
 * its islands hold and exits once, and the supervisor raises a fresh engine. The house's count bounds it: a second fall
 * before a clean stop keeps the vessel down and names the hand act.
 *
 *   F1  an injected fall: health answers 503, the flush runs before the exit, the exit names `ENGINE_FALL_EXIT`, and the
 *       fall rests with its life and the document in flight.
 *   F2  a second fall within the count (a fall from an earlier life rests uncleared): the flush runs, no exit, and the log
 *       names the hand act.
 *   F3  the count clears: a cleared file reads no falls, and the next fall rises once again. A torn file reads as one fall,
 *       never a clean run.
 *   F4  a flush that throws or stands absent never holds the exit back.
 *   F6  the document in flight: a trap met inside a tapped inbound message names its document; one met outside names none.
 *   F7  a fall that cannot rest stays down: a disk that refuses the record never feeds a loop of exits.
 *   F8  no run clears the count by itself: a fall after any span of healthy running stays down and names the hand act; only
 *       a clean stop or the hand's act clears it (`clearEngineFalls`).
 *   F9  the hand act's words match what the code does: it names the read that works with the engine down, the stop and the
 *       stand by their exact commands, and the document in flight mounts writable after the hand's stop, never "stays held".
 *
 * The boot's hold-back of the document in flight reads through the real probe wiring (`engine-fall-holds-back.test.ts`).
 *
 * Every fall comes injected: no wasm instance runs out of anything, and no live vessel stands.
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { createEngineWatch, tapInboundDocs, tapRepoLogs, type EngineFall } from "../src/engine-watch.js";
import { createReadinessState } from "../src/readiness-face.js";
import * as engineFall from "../src/engine-fall.js";
import {
  answerEngineFall, clearEngineFalls, engineFallsPath, heldInFlight, keepFallDown, readEngineFalls, restEngineFall,
  ENGINE_DOWN_HAND_ACT, ENGINE_FALL_EXIT, ENGINE_RESTART_CAP, HELD_HAND_ACT,
} from "../src/engine-fall.js";
import type { ShoreFlushReading } from "../src/shore-verb.js";

let dir = "";
afterEach(() => { if (dir) { rmSync(dir, { recursive: true, force: true }); dir = ""; } });
const scratch = (): string => (dir = mkdtempSync(join(tmpdir(), "lar-engine-fall-")));

const trap = (): Error => new WebAssembly.RuntimeError("unreachable");
const clock = (): Date => new Date("2026-11-22T10:00:00.000Z");
const FLUSHED: ShoreFlushReading = { whole: true, islands: [{ island: "daemon", answered: true, written: [], writtenCount: 0, unwritten: [], unwrittenCount: 0, fileWrites: 3, drained: true }] };

/** A fallen watch whose trap struck while the Repo handled `documentId`. */
function fallen(documentId: string | null): { fall: EngineFall; watch: ReturnType<typeof createEngineWatch> } {
  const watch = createEngineWatch(clock);
  if (documentId === null) watch.note(trap(), "ledger");
  else watch.carrying(documentId, () => watch.note(trap(), "repo"));
  return { fall: watch.fallen()!, watch };
}

/** The ports a fall reaches, each one recorded in order. */
function ports(storageDir: string, life: string, flush: () => Promise<ShoreFlushReading | null> = async () => FLUSHED) {
  const acts: string[] = [];
  const lines: string[] = [];
  return {
    acts, lines,
    ports: {
      storageDir, life,
      flush: async () => { acts.push("flush"); return flush(); },
      exit: (code: number) => { acts.push(`exit ${code}`); },
      log: (line: string) => { lines.push(line); },
    },
  };
}

describe("an engine that falls flushes, stops and rises once", () => {
  test("F1 — an injected fall: health 503, the flush before the exit, the exit code, the fall at rest", async () => {
    const storageDir = scratch();
    const { fall, watch } = fallen("doc-in-flight");
    const health = createReadinessState(watch);
    health.markReady();
    expect(health.status()).toBe("engine-terminated");
    expect(health.fall?.()).toMatchObject({ status: "engine-terminated", inFlight: "doc-in-flight" });

    const p = ports(storageDir, "a".repeat(32));
    const answer = await answerEngineFall(fall, p.ports);
    expect(answer).toMatchObject({ verdict: "rise-once", exit: ENGINE_FALL_EXIT, flush: FLUSHED });
    expect(p.acts).toEqual(["flush", `exit ${ENGINE_FALL_EXIT}`]);
    expect(ENGINE_FALL_EXIT).not.toBe(0);
    expect([1, 2, 75, 76]).not.toContain(ENGINE_FALL_EXIT);
    expect(p.lines.join("\n")).toMatch(/wasm-unreachable/);
    expect(p.lines.join("\n")).toMatch(/doc-in-flight/);
    expect(p.lines.join("\n")).toMatch(/daemon island wrote 0 owed carrier\(s\) \(3 file write\(s\)\)/);
    expect(readEngineFalls(storageDir)).toEqual([{ life: "a".repeat(32), pid: process.pid, cause: "wasm-unreachable", path: "repo", since: fall.since, inFlight: "doc-in-flight" }]);
  });

  test("F2 — a second fall within the count stays down and names the hand act", async () => {
    const storageDir = scratch();
    expect(ENGINE_RESTART_CAP).toBe(1);
    restEngineFall(storageDir, fallen("doc-in-flight").fall, "a".repeat(32));
    const p = ports(storageDir, "b".repeat(32));
    const answer = await answerEngineFall(fallen(null).fall, p.ports);
    expect(answer).toMatchObject({ verdict: "stays-down", hand: ENGINE_DOWN_HAND_ACT });
    expect(p.acts).toEqual(["flush"]);
    expect(p.lines.join("\n")).toContain(ENGINE_DOWN_HAND_ACT);
    expect(p.lines.join("\n")).toMatch(/stays down/);
    expect(readEngineFalls(storageDir)).toHaveLength(2);
  });

  test("F3 — a cleared count rises once again; a torn count reads as a fall, never a clean run", async () => {
    const storageDir = scratch();
    restEngineFall(storageDir, fallen(null).fall, "a".repeat(32));
    clearEngineFalls(storageDir);
    expect(readEngineFalls(storageDir)).toEqual([]);
    const p = ports(storageDir, "b".repeat(32));
    expect((await answerEngineFall(fallen(null).fall, p.ports)).verdict).toBe("rise-once");

    clearEngineFalls(storageDir);
    writeFileSync(engineFallsPath(storageDir), "{ torn");
    expect(readEngineFalls(storageDir)).toHaveLength(1);
    const q = ports(storageDir, "c".repeat(32));
    expect((await answerEngineFall(fallen(null).fall, q.ports)).verdict).toBe("stays-down");
  });

  test("F4 — a flush that throws, or no composition to ask, never holds the exit back", async () => {
    const storageDir = scratch();
    const p = ports(storageDir, "a".repeat(32), async () => { throw new Error("the daemon island answered nothing"); });
    expect((await answerEngineFall(fallen(null).fall, p.ports)).verdict).toBe("rise-once");
    expect(p.acts).toEqual(["flush", `exit ${ENGINE_FALL_EXIT}`]);
    expect(p.lines.join("\n")).toMatch(/the flush threw: the daemon island answered nothing/);

    clearEngineFalls(storageDir);
    const q = ports(storageDir, "b".repeat(32), async () => null);
    await answerEngineFall(fallen(null).fall, q.ports);
    expect(q.acts).toEqual(["flush", `exit ${ENGINE_FALL_EXIT}`]);
    expect(q.lines.join("\n")).toMatch(/no composition stands to flush/);
  });

  test("F6 — a trap inside a tapped inbound message names its document; one outside names none", () => {
    const watch = createEngineWatch(clock);
    const subsystem = new EventEmitter();
    const logger = tapRepoLogs(watch, () => {})("automerge-repo:repo");
    // The Repo's own listener: it catches the handler's throw and logs it, inside the same synchronous emit.
    subsystem.on("message", (msg: { documentId: string }) => { if (msg.documentId === "heavy-doc") logger.error("error handling inbound message", trap()); });
    tapInboundDocs(subsystem, watch);
    subsystem.emit("message", { documentId: "light-doc" });
    expect(watch.fallen()).toBeNull();
    subsystem.emit("message", { documentId: "heavy-doc" });
    expect(watch.fallen()).toMatchObject({ cause: "wasm-unreachable", path: "repo", inFlight: "heavy-doc" });

    const outside = createEngineWatch(clock);
    outside.carrying("passed-doc", () => {});
    outside.note(new Error("Module terminated"), "ledger");
    expect(outside.fallen()?.inFlight).toBeNull();
  });

  test("F7 — a fall that cannot rest stays down rather than exit", async () => {
    const storageDir = join(scratch(), "no-such-dir", "deeper");
    const p = ports(storageDir, "a".repeat(32));
    const answer = await answerEngineFall(fallen(null).fall, p.ports);
    expect(answer.verdict).toBe("stays-down");
    expect(p.acts).toEqual(["flush"]);
    expect(p.lines.join("\n")).toMatch(/did not rest/);
    expect(p.lines.join("\n")).toMatch(/stays down/);
  });

  test("F8 — no run clears the count by itself; a fall after a healthy span stays down", async () => {
    const storageDir = scratch();
    expect("clearOnceSettled" in engineFall).toBe(false);
    restEngineFall(storageDir, fallen(null).fall, "a".repeat(32));
    const p = ports(storageDir, "b".repeat(32));
    const answer = await answerEngineFall(fallen(null).fall, p.ports);
    expect(answer.verdict).toBe("stays-down");
    expect(p.lines.join("\n")).toContain(ENGINE_DOWN_HAND_ACT);
  });

  test("F9 — the hand act names its commands, and its words match the code: the hand's stop frees the document in flight", async () => {
    // The words: the read that answers with the engine down, the stop and the stand, each by its exact command.
    for (const command of ["`lares vessel read`", "`lares vessel stop`", "`lares vessel stand`", "`lares vessel read vessel`"]) {
      expect(ENGINE_DOWN_HAND_ACT).toContain(command);
    }
    expect(HELD_HAND_ACT).toContain("`lares vessel stop`");
    expect(HELD_HAND_ACT).toContain("`lares vessel stand`");
    expect(ENGINE_DOWN_HAND_ACT).not.toMatch(/stays held/);
    expect(ENGINE_DOWN_HAND_ACT).toMatch(/mounts writable/);
    expect(ENGINE_DOWN_HAND_ACT).not.toMatch(/repair or restore from a keep bundle;/);
    // The restore names runbook 11a, the road the keep drill walks (house-keep.test.mjs H4), in the form the host bridge runs:
    // the keep binds as a workspace and the import reads it at its /lar path (a host path outside LARES_HOUSE refuses). A
    // face's backup bundle (`found --hearth --restore`) restores one face, never a house, and a reset clears the damaged hearth.
    expect(ENGINE_DOWN_HAND_ACT).toContain("founding runbook 11a");
    expect(ENGINE_DOWN_HAND_ACT).toContain("`lares up --workspace house-backup=<keep checkout>`");
    expect(ENGINE_DOWN_HAND_ACT).toContain("`lares import /lar/workspaces/house-backup/house apply=true`");
    expect(ENGINE_DOWN_HAND_ACT).not.toMatch(/--restore|`lares reset`/);

    // The code: a vessel that stays down, holding a document in flight, takes the hand's stop; the count and the hold clear.
    const storageDir = scratch();
    restEngineFall(storageDir, fallen("doc-held").fall, "a".repeat(32));
    expect(heldInFlight(readEngineFalls(storageDir))).toEqual(["doc-held"]);
    const watch = createEngineWatch(clock);
    const acts: string[] = [];
    const keeper = keepFallDown(watch, {
      storageDir, life: () => "b".repeat(32), flush: async () => FLUSHED,
      exit: (code) => { acts.push(`exit ${code}`); }, log: () => {}, hold: () => { acts.push("hold"); },
    });
    watch.carrying("doc-held", () => watch.note(trap(), "repo"));
    await new Promise((r) => setTimeout(r, 0));
    expect(keeper.verdict()).toBe("stays-down");
    expect(keeper.handStop("SIGTERM")).toBe(true);
    expect(acts).toEqual(["hold", "exit 0"]);
    expect(heldInFlight(readEngineFalls(storageDir))).toEqual([]);
  });

  test("F10 — a row rested before falls named their pid reads whole, its pid null: the hold it names stands across the upgrade", () => {
    const storageDir = scratch();
    writeFileSync(engineFallsPath(storageDir), JSON.stringify({ falls: [
      { life: "a".repeat(32), cause: "wasm-unreachable", path: "repo", since: "2026-11-22T10:00:00.000Z", inFlight: "doc-held" },
    ] }));
    expect(readEngineFalls(storageDir)).toEqual([
      { life: "a".repeat(32), pid: null, cause: "wasm-unreachable", path: "repo", since: "2026-11-22T10:00:00.000Z", inFlight: "doc-held" },
    ]);
    expect(heldInFlight(readEngineFalls(storageDir))).toEqual(["doc-held"]);
    // The next rest writes the cap beside the count, its one owner, for every reader outside this process.
    restEngineFall(storageDir, fallen(null).fall, "b".repeat(32));
    expect(JSON.parse(readFileSync(engineFallsPath(storageDir), "utf8"))).toMatchObject({ cap: ENGINE_RESTART_CAP });
    expect(readEngineFalls(storageDir).map((f) => f.inFlight)).toEqual(["doc-held", null]);
    // CONTROL: a pid of the wrong kind still reads the file torn, never a clean run.
    writeFileSync(engineFallsPath(storageDir), JSON.stringify({ falls: [{ life: null, pid: "7", cause: "x", path: "repo", since: "s", inFlight: null }] }));
    expect(readEngineFalls(storageDir)).toEqual([{ life: null, pid: null, cause: "unknown", path: "unknown", since: "unknown", inFlight: null }]);
  });
});
