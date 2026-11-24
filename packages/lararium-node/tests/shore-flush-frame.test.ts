/**
 * THE `shore-flush` FRAME: the custody door answers the standing composition's whole-island flush (`flushShores`, the flush
 * the teardown runs), so `lares shore flush` and the keep's flush before its cut reach every island that mounts a disk shore.
 *   F1  it answers the composition's reading whole, every resident wiki island among its parts, with no credential.
 *   F2  while no composition sits (or none wires a flush) it refuses `flush-unavailable` by name, never an empty reading.
 *   F3  a flush that throws names its fault and never breaks the door.
 */
import { EventEmitter } from "node:events";
import type { Socket } from "node:net";
import { describe, expect, test } from "vitest";
import { custodyFrameHandler } from "../src/custody-frames.js";
import type { CustodyHolder } from "../src/custody-holder.js";
import type { ShoreFlushReading } from "../src/shore-verb.js";

function fakeSock(): { sock: Socket; answer: Promise<Record<string, unknown>> } {
  let settle!: (v: Record<string, unknown>) => void;
  const answer = new Promise<Record<string, unknown>>((r) => { settle = r; });
  const sock = Object.assign(new EventEmitter(), { end: (line: string) => settle(JSON.parse(line) as Record<string, unknown>) }) as unknown as Socket;
  return { sock, answer };
}

const door = (shoreFlush?: () => Promise<ShoreFlushReading> | null) => custodyFrameHandler({
  holder: { isUnlocked: () => false, openedSlot: () => null, attemptsLeft: () => 3, unlockedFaces: () => [] } as unknown as CustodyHolder,
  testScratch: false, standing: () => "hearth", recompose: async () => ({ standing: "hearth" }), onLog: () => {},
  ...(shoreFlush ? { shoreFlush } : {}),
});
const ask = (handle: ReturnType<typeof door>) => { const { sock, answer } = fakeSock(); expect(handle({ op: "shore-flush" }, sock)).toBe(true); return answer; };

const part = (island: string) => ({ island, answered: true as const, written: [], writtenCount: 0, unwritten: [], unwrittenCount: 0, fileWrites: 0, drained: true });
const reading: ShoreFlushReading = { islands: [part("daemon"), part("wiki:home"), part("wiki:notes")], whole: true };

describe("the shore-flush frame", () => {
  test("RED F1 — it answers the composition's whole-island reading, with no credential", async () => {
    expect(await ask(door(async () => reading))).toEqual({ op: "shore-flush", reading, standing: "hearth" });
  });

  test("RED F2 — no composition sitting refuses flush-unavailable; CONTROL: a door with no flush wired refuses the same", async () => {
    const none = await ask(door(() => null));
    expect(none).toMatchObject({ op: "shore-flush", status: "error", refusal: { reason: "flush-unavailable" } });
    expect(String(none["errorMessage"])).toContain("lares vessel stand");
    expect(await ask(door())).toMatchObject({ op: "shore-flush", status: "error", refusal: { reason: "flush-unavailable" } });
  });

  test("RED F3 — a flush that throws names its fault", async () => {
    expect(await ask(door(async () => { throw new Error("the pool went away"); }))).toMatchObject({ op: "shore-flush", status: "error", errorMessage: "the pool went away", refusal: { reason: "flush-failed" } });
  });
});
