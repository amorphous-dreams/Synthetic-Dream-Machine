/**
 * held-quorum — the SEAT KEYS this vessel holds that sit IN a seated roster, chosen as one quorum's signers.
 *
 * A seat holds its own key (`seat-key-store`): it stands apart from every persona root and every dialing leaf, so
 * no root and no leaf signs a quorum's act. The quorum doors (membership `nexus contract`, antigen `nexus kapae`,
 * the roll anchors, the edge board's quorum hand) bring signers the same way: a roster key counts only when this
 * vessel holds its seat row, each seated key counts once, and the walk stops at the threshold. What differs is the
 * act a sub-quorum would have minted, so each door hands in its own refusal and the message names that act.
 *
 * THE CHOICE OPENS NO ROW. A roster names public keys, and a row's name commits to one, so the choice reads file
 * names alone. A signer's `sign` opens its one cold row for that one signature, behind the custody seat: a locked
 * vessel refuses `CustodyLocked` there, and a row that stands and does not open refuses by name.
 *
 * The ROSTER is the caller's. Each door reads its own roster source and its own seated-quorum refusal;
 * the antigen quorum and the membership quorum stay two relations that happen to select alike.
 */

import type { KahuQuorumSeats } from "@lararium/mesh";
import { heldSeatKey, signAsSeat } from "./seat-key-store.js";

/** One seat of a roster this vessel holds the key for: its public key and a hand that signs as that seat. */
export interface HeldQuorumSigner {
  /** The seat's public key, lower-case hex. */
  readonly verifyingKey: string;
  /** Sign `bytes` as this seat; answers the signature as lower-case hex. The cold row opens for this one signature. */
  readonly sign:         (bytes: Uint8Array) => Promise<string>;
}

const bare = (key: string): string => key.trim().toLowerCase().replace(/^0x/, "");
const HEX64 = /^[0-9a-f]{64}$/;

/**
 * Every seat of `roster` this vessel holds a seat row for, in the roster's own order, each key once. `except`
 * names seats that already signed. No threshold: a partial takes any count.
 */
export function heldSeatSigners(roster: KahuQuorumSeats, except: ReadonlySet<string> = new Set()): HeldQuorumSigner[] {
  const out: HeldQuorumSigner[] = [];
  const seen = new Set<string>();
  for (const seated of roster.keys) {
    const verifyingKey = bare(seated);
    if (!HEX64.test(verifyingKey) || seen.has(verifyingKey) || except.has(verifyingKey)) continue;
    seen.add(verifyingKey);
    if (heldSeatKey(verifyingKey) === null) continue;                  // a read of names; never a mint, never an open
    out.push({ verifyingKey, sign: async (bytes) => Buffer.from(await signAsSeat(verifyingKey, bytes)).toString("hex") });
  }
  return out;
}

/**
 * Resolve exactly `roster.threshold` distinct seats of `roster` whose keys this vessel holds. FAIL CLOSED: fewer
 * throws `refuse(held, threshold)`, so no sub-quorum act is ever minted.
 */
export async function selectHeldQuorumSigners(
  roster: KahuQuorumSeats,
  refuse: (held: number, k: number) => Error,
): Promise<HeldQuorumSigner[]> {
  const held = heldSeatSigners(roster);
  if (held.length < roster.threshold) throw refuse(held.length, roster.threshold);
  return held.slice(0, roster.threshold);
}
