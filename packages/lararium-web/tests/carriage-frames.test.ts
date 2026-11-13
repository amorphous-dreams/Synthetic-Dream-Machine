/** A carried file crosses as frames a small carrier holds, in any order, and the assembly refuses by name. */
import { describe, expect, test } from "vitest";
import { CarriageAssembly, carriageFrames, carriageTag, isCarriageFrame, CARRIAGE_FRAME_BOUND } from "../src/fleet/carriage-frames.js";

const FILE = JSON.stringify({ kind: "fleet-join-answer", note: "ʻōlelo — 言葉 — слово", body: "ab".repeat(3000) });
const assemble = (frames: readonly string[]) => { const a = new CarriageAssembly(); let last; for (const f of frames) last = a.take(f); return { last, a }; };

describe("carriage frames", () => {
  test("RED: a long file crosses in many frames and joins whole, read in any order and more than once", () => {
    const frames = carriageFrames(FILE);
    expect(frames.length).toBeGreaterThan(5);
    expect(frames.every(isCarriageFrame)).toBe(true);
    expect(assemble(frames).last).toEqual({ done: FILE });
    const shuffled = [...frames].reverse().flatMap((f, i) => (i % 3 === 0 ? [f, f] : [f]));
    expect(assemble(shuffled).last).toEqual({ done: FILE });
  });

  test("RED: a short file rides one frame, and an assembly short of a frame names how many it holds", () => {
    const offer = JSON.stringify({ kind: "fleet-join-offer", nonce: "ab".repeat(32) });
    expect(carriageFrames(offer)).toHaveLength(1);
    expect(assemble(carriageFrames(offer)).last).toEqual({ done: offer });
    const frames = carriageFrames(FILE);
    expect(assemble(frames.slice(1)).last).toEqual({ held: frames.length - 1, of: frames.length });
  });

  test("RED: another file's frame, a moved chunk and a malformed frame each refuse by name, and the assembly keeps what it holds", () => {
    const frames = carriageFrames(FILE);
    const other = carriageFrames(FILE + " ");
    const a = new CarriageAssembly();
    a.take(frames[0]!);
    expect(a.take(other[1]!)).toEqual({ refusal: "frame-other-carriage" });
    expect(a.take("lar-carry:zz:1.1:AAAA")).toEqual({ refusal: "frame-malformed" });
    expect(a.take(`lar-carry:${carriageTag(new Uint8Array())}:9.2:AAAA`)).toEqual({ refusal: "frame-malformed" });
    expect(a.take("{\"kind\":\"fleet-join-offer\"}")).toEqual({ refusal: "frame-malformed" });
    // The same place under other bytes: a courier moved a chunk.
    const moved = frames[0]!.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
    expect(a.take(moved)).toEqual({ refusal: "carriage-torn" });
    // CONTROL: the honest frames still join.
    let last;
    for (const f of frames) last = a.take(f);
    expect(last).toEqual({ done: FILE });
  });

  test("RED: every place filled with bytes that digest to another tag refuses carriage-torn", () => {
    const frames = carriageFrames(FILE);
    const forged = frames.map((f, i) => (i === 2 ? f.replace(/(\.\d+:)([A-Za-z0-9_-]{8})/, (_m, lead: string, head: string) => `${lead}${head.split("").reverse().join("")}`) : f));
    expect(forged[2]).not.toBe(frames[2]);
    expect(assemble(forged).last).toEqual({ refusal: "carriage-torn" });
  });

  test("a file past the frame bound refuses to frame", () => {
    expect(() => carriageFrames("x".repeat(40), 4 * 1)).not.toThrow();
    expect(() => carriageFrames("x".repeat(4 * (CARRIAGE_FRAME_BOUND + 1)), 4)).toThrow(/carriage-too-long/);
  });
});
