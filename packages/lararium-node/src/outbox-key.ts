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
import { join } from "node:path";
import { readOutboxKey, mintOutboxKey, type OutboxKey } from "@lararium/mesh";
import { updateCustodyRow } from "./custody-seat.js";
import { larIdentityDir } from "./vessel-paths.js";

const OUTBOX_KEY_FILE = "outbox-key.bin";

/** The outbox key's carrier path in the identity home. The carrier table spells its row through it. */
export function outboxKeyPath(identityDir: string = larIdentityDir()): string {
  return join(identityDir, OUTBOX_KEY_FILE);
}

/** A row that opens to anything but one outbox key: the act stops and mints nothing over it. */
export class OutboxKeyUnreadable extends Error {
  override readonly name = "OutboxKeyUnreadable";
  constructor(width: number) { super(`[outbox-key] the outbox key's row opens to ${width} bytes; an outbox key holds 32, and nothing mints over it`); }
}

/**
 * The vessel's outbox key: the row's bytes where it stands, a fresh key sealed into it where it does not. Refuses
 * `CustodyLocked` on a locked vessel and `CustodyRowUnavailable` on a row the seat's key does not open, before any
 * mint.
 */
export function openOutboxKey(): Promise<OutboxKey> {
  return updateCustodyRow<OutboxKey>("identity", OUTBOX_KEY_FILE, (standing) => {
    if (standing !== null) {
      const key = readOutboxKey(standing);
      if (key === null) throw new OutboxKeyUnreadable(standing.length);
      return { plaintext: null, value: key };
    }
    const minted = mintOutboxKey();
    return { plaintext: Uint8Array.from(minted), value: minted };
  });
}
