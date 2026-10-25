/**
 * outbox-key — THE OUTBOX KEY: one hot row, sealed under the vessel key, that seals the sealed store's outbox parcels
 * and nothing beside them (custody#/the-table, the outbox).
 *
 * ── MINTED ONCE, THEN STABLE ────────────────────────────────────────────────────────────────────
 * The first unlocked composition that asks finds no row and mints 32 random bytes into it, inside one custody hold
 * (`updateCustodyRow`): a second ask, in this process or another, reads the row the first one landed and mints
 * nothing. Every later unlock opens the same key, so a parcel sealed before a restart opens again after it.
 *
 * ── HANDED TO THE DAEMON ISLAND AT UNLOCK ───────────────────────────────────────────────────────
 * The vessel's main thread opens the row through the custody seat and hands the bytes across the worker boundary on
 * the daemon's manifest (`daemonAuth.outboxKey`), the road the keyhive Archive already rides and the content keys
 * stand on. A floor composition holds no vessel key, opens no row and hands no key, so its island's outbox holds
 * shut and every parcel verb refuses by name.
 *
 * ── A VESSEL-KEY ROTATION RE-SEALS THIS ROW AND NO PARCEL ───────────────────────────────────────
 * The row counts among the VK-sealed carriers, so a rotation re-seals it under the new VK with its bytes unchanged.
 * The parcels rest under the outbox key's own seal, which the rotation never reads.
 */
import { readOutboxKey, mintOutboxKey, type OutboxKey } from "@lararium/mesh";
import { updateCustodyRow } from "./custody-seat.js";

/** One outbox key per SENDING FACE: `outbox-key-h<N>.bin`, in that face's own directory under its key. */
export const OUTBOX_KEY_FILE = /^outbox-key-h(0|[1-9]\d*)\.bin$/;
export const outboxKeyFile = (face: number): string => `outbox-key-h${face}.bin`;

/** A row that opens to anything but one outbox key: the act stops and mints nothing over it. */
export class OutboxKeyUnreadable extends Error {
  override readonly name = "OutboxKeyUnreadable";
  constructor(width: number) { super(`[outbox-key] the outbox key's row opens to ${width} bytes; an outbox key holds 32, and nothing mints over it`); }
}

/**
 * The outbox key of the sending face `face`: the row's bytes where it stands, a fresh key sealed into it where it does not. Refuses
 * `CustodyLocked` on a locked vessel and `CustodyRowUnavailable` on a row the seat's key does not open, before any
 * mint.
 */
export function openOutboxKey(face: number): Promise<OutboxKey> {
  return updateCustodyRow<OutboxKey>("identity", outboxKeyFile(face), (standing) => {
    if (standing !== null) {
      const key = readOutboxKey(standing);
      if (key === null) throw new OutboxKeyUnreadable(standing.length);
      return { plaintext: null, value: key };
    }
    const minted = mintOutboxKey();
    return { plaintext: Uint8Array.from(minted), value: minted };
  });
}
