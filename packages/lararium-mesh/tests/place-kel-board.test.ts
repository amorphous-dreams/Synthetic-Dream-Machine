import { ed25519 } from "@noble/curves/ed25519.js";
import { describe, expect, it } from "vitest";
import type { LarDoc } from "../src/base-doc.js";
import { carriageEntriesFromBoard } from "../src/carriage-board.js";
import { hex } from "../src/crypto.js";
import { PLACE_KEL_PREFIX, placeKelHeadFromBoard, writePlaceKelEvent } from "../src/place-kel-board.js";
import { mintPlaceInception, mintPlaceRotation } from "../src/vessel-kel.js";

const seed = (n: number) => new Uint8Array(32).fill(n);
const key = (n: number) => hex(ed25519.getPublicKey(seed(n)));
const emptyBoard = (): LarDoc => ({ schemaVersion: "lar/1", tiddlers: {} } as unknown as LarDoc);
const chain = () => {
  const start = mintPlaceInception({ signerSeed: seed(1), coldVerifyingKey: key(2) });
  const one = mintPlaceRotation({ chain: [start.event], coldSeed: seed(2), newSignerKey: key(3), nextColdVerifyingKey: key(4) });
  return { start, one };
};

describe("place KEL on the carriage board", () => {
  it("an inception-only reader descends to the rotated head from board rows; the acts extractor skips the rows", () => {
    const { start, one } = chain();
    const board = emptyBoard();
    writePlaceKelEvent(board, start.aid, start.event);
    const held = placeKelHeadFromBoard(board, { aid: start.aid }, null);
    expect(held.ok && held.seq).toBe(0);                     // control: an unrotated head reads unchanged
    writePlaceKelEvent(board, start.aid, one);
    const caught = placeKelHeadFromBoard(board, { aid: start.aid }, held.ok ? { aid: held.aid, seq: held.seq, headDigest: held.headDigest } : null);
    expect(caught.ok && caught.seq).toBe(1);
    expect(carriageEntriesFromBoard(board)).toEqual([]);
  });
  it("a forged row (wrong key, torn text, another aid's chain, no inception) advances nothing and a gap refuses", () => {
    const { start, one } = chain();
    const board = emptyBoard();
    writePlaceKelEvent(board, start.aid, start.event);
    board.tiddlers[`${PLACE_KEL_PREFIX}${start.aid}/${"0".repeat(64)}`] = { tiddler: { title: "x", text: "{not json" } } as never;
    const other = mintPlaceInception({ signerSeed: seed(7), coldVerifyingKey: key(8) });
    writePlaceKelEvent(board, start.aid, other.event);       // a foreign inception filed under this aid
    const forged = placeKelHeadFromBoard(board, { aid: start.aid }, null);
    expect(forged.ok && forged.seq).toBe(0);
    const gapped = emptyBoard();
    writePlaceKelEvent(gapped, start.aid, start.event);
    const two = mintPlaceRotation({ chain: [start.event, one], coldSeed: seed(4), newSignerKey: key(5), nextColdVerifyingKey: key(6) });
    writePlaceKelEvent(gapped, start.aid, two);
    const read = placeKelHeadFromBoard(gapped, { aid: start.aid }, null);
    expect(read.ok ? null : read.refusal).toBe("gap");
  });
});
