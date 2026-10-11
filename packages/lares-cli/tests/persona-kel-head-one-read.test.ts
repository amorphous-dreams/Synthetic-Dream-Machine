/**
 * L11 — `lares persona admit` reads a persona's KEL head and its seq through ONE `persona-kel-head` door read
 * per verification. Two reads could straddle a rotation and pair one key's head with the NEXT key's seq.
 */
import { describe, test, expect } from "vitest";
import { kelHeadResolvers } from "../src/commands/persona-admit-cmd.js";

/** A board that ROTATES between reads: read 1 answers key K1 at seq 1, read 2 answers key K2 at seq 2. */
function rotatingBoard() {
  let calls = 0;
  const read = async (_prefix: string): Promise<Record<string, unknown>> => {
    calls += 1;
    return calls === 1 ? { head: "k1", seq: 1 } : { head: "k2", seq: 2 };
  };
  return { read, calls: () => calls };
}

describe("kelHeadResolvers — one door read carries head AND seq (L11)", () => {
  test("the seq pairs with the head it was read beside, across a rotation, in ONE read", async () => {
    const board = rotatingBoard();
    const { resolveHeadOpKey, resolveHeadSeq } = kelHeadResolvers(board.read);
    expect(await resolveHeadOpKey("p")).toBe("k1");
    expect(await resolveHeadSeq("p")).toBe(1);
    expect(board.calls()).toBe(1);
  });

  test("CONTROL: two separate reads straddle the rotation (head k1, seq 2) — the shape this retires", async () => {
    const board = rotatingBoard();
    const head = (await board.read("p"))["head"];
    const seq = (await board.read("p"))["seq"];
    expect([head, seq]).toEqual(["k1", 2]);
    expect(board.calls()).toBe(2);
  });

  test("a seq asked with no head read before it answers null, never a second read", async () => {
    const board = rotatingBoard();
    const { resolveHeadSeq } = kelHeadResolvers(board.read);
    expect(await resolveHeadSeq("p")).toBeNull();
    expect(board.calls()).toBe(0);
  });

  test("a non-string head reads null; a non-number seq reads null", async () => {
    const { resolveHeadOpKey, resolveHeadSeq } = kelHeadResolvers(async () => ({ head: null, seq: "3" }));
    expect(await resolveHeadOpKey("p")).toBeNull();
    expect(await resolveHeadSeq("p")).toBeNull();
  });
});
