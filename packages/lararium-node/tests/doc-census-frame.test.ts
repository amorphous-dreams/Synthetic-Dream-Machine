/**
 * THE `doc-census` FRAME: the custody door answers the standing composition's document census, read-only.
 *   D1  it answers the census the composition reads, beside the chain, with no credential.
 *   D2  while no composition sits (or none wires a census) it refuses `census-unavailable` by name, never an empty census.
 *   D3  a census that throws names its fault to its caller and never breaks the door.
 */
import { EventEmitter } from "node:events";
import type { Socket } from "node:net";
import { describe, expect, test } from "vitest";
import type { DocCensusReading } from "@lararium/mesh";
import { custodyFrameHandler } from "../src/custody-frames.js";
import type { CustodyHolder } from "../src/custody-holder.js";

function fakeSock(): { sock: Socket; answer: Promise<Record<string, unknown>> } {
  let settle!: (v: Record<string, unknown>) => void;
  const answer = new Promise<Record<string, unknown>>((r) => { settle = r; });
  const sock = Object.assign(new EventEmitter(), { end: (line: string) => settle(JSON.parse(line) as Record<string, unknown>) }) as unknown as Socket;
  return { sock, answer };
}

const door = (docCensus?: () => Promise<DocCensusReading> | null) => custodyFrameHandler({
  holder: { isUnlocked: () => false, openedSlot: () => null, attemptsLeft: () => 3, unlockedFaces: () => [] } as unknown as CustodyHolder,
  testScratch: false, standing: () => "hearth", recompose: async () => ({ standing: "hearth" }), onLog: () => {},
  ...(docCensus ? { docCensus } : {}),
});
const ask = (handle: ReturnType<typeof door>) => { const { sock, answer } = fakeSock(); expect(handle({ op: "doc-census" }, sock)).toBe(true); return answer; };

const reading: DocCensusReading = {
  stores: [{ name: "(root)", documents: 1, bytes: 10 }],
  rows: [{ id: "doc-a", store: "(root)", bytes: 10, clearChunks: 1, sealedChunks: 0, syncStates: 0, temps: 0, class: "orphan", read: "clear", names: [], why: "unnamed" }],
  counts: { current: 0, duplicate: 0, orphan: 1, "last-version": 0, "sealed-unread": 0 },
  unreadSealed: 0,
};

describe("the doc-census frame", () => {
  test("D1 — it answers the composition's census, with no credential", async () => {
    expect(await ask(door(async () => reading))).toEqual({ op: "doc-census", census: reading, standing: "hearth" });
  });

  test("D2 — no composition sitting refuses census-unavailable; CONTROL: a door with no census wired refuses the same", async () => {
    expect(await ask(door(() => null))).toMatchObject({ op: "doc-census", status: "error", refusal: { reason: "census-unavailable" } });
    expect(await ask(door())).toMatchObject({ op: "doc-census", status: "error", refusal: { reason: "census-unavailable" } });
  });

  test("D3 — a census that throws names its fault", async () => {
    expect(await ask(door(async () => { throw new Error("the store walk fell"); }))).toMatchObject({ op: "doc-census", status: "error", errorMessage: "the store walk fell", refusal: { reason: "census-failed" } });
  });
});
