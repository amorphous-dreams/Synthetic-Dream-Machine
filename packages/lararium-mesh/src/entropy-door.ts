/**
 * entropy-door — the house's one door for outside randomness.
 *
 * A cast that draws chance (a ddate exclamation, an oracle throw) takes its bytes from an `EntropyDoor` the caller
 * hands in, never from a hidden global. The door names its source in a field, so a result that drew from it can say
 * what it drew from, and a test stands a seeded door in its place.
 *
 * The platform door reads `crypto.getRandomValues`: real randomness, drawn at the call and kept nowhere. A
 * deterministic door (a seeded list, a day-keyed hash) names itself plainly as one, so no reader mistakes a replay
 * for a cast.
 *
 * Platform-blind: this file reads only `globalThis.crypto` (Node 19+ and every modern browser) through the mesh's
 * Web Crypto port.
 */

import { webGetRandomValues } from "./crypto.js";

/** A source of bytes, named. `fill` overwrites the whole view and hands it back. */
export interface EntropyDoor {
  /** What the bytes come from, in words a reader can quote: `platform:crypto.getRandomValues`. */
  readonly source: string;
  fill(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer>;
}

/** The platform's own randomness: the default door for a live cast. */
export const PLATFORM_ENTROPY: EntropyDoor = {
  source: "platform:crypto.getRandomValues",
  fill: (bytes) => webGetRandomValues(bytes),
};

const UINT32_SPAN = 0x1_0000_0000;

/**
 * One integer in `[0, bound)` drawn from `door`, unbiased: a draw landing in the short tail of the 32-bit span
 * (where `bound` does not divide it evenly) is thrown back and drawn again.
 */
export function entropyBelow(door: EntropyDoor, bound: number): number {
  if (!Number.isInteger(bound) || bound < 1 || bound > UINT32_SPAN) {
    throw new RangeError(`entropyBelow: bound must be an integer in [1, 2^32]; got ${String(bound)}`);
  }
  const limit = UINT32_SPAN - (UINT32_SPAN % bound);
  const cell = new Uint8Array(4);
  for (;;) {
    door.fill(cell);
    const draw = ((cell[0] as number) * 0x1_00_00_00) + ((cell[1] as number) << 16) + ((cell[2] as number) << 8) + (cell[3] as number);
    if (draw < limit) return draw % bound;
  }
}

/** One member of a non-empty list, chosen through `door`. */
export function entropyPick<T>(door: EntropyDoor, list: readonly T[]): T {
  if (list.length === 0) throw new RangeError("entropyPick: the list holds nothing to pick");
  return list[entropyBelow(door, list.length)] as T;
}
