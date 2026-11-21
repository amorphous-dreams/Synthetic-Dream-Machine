/**
 * lock-receipt — a lock whose answer never reached the caller confirms itself by a fresh census.
 *
 * A lock that composes the vessel again (down to the floor) may close the caller's line with the composition it leaves, so its
 * own answer reads null though the lock landed. The custody door answers a `census` frame at once, at the floor or above it: the
 * CLI asks it again once a composition sits (`standing` past "recomposing"), and reads the lock from what stands. A face's lock
 * landed where that face stands out of the lit set; the vessel's lock landed where the census reads it locked. A census that
 * reads neither, or no answer at all within the looks, leaves the lock unconfirmed.
 */
import type { CustodyDoorAnswer } from "./custody-door.js";

/** How many census reads a confirmation takes before it names the lock unconfirmed. */
export const LOCK_CONFIRM_LOOKS = 120;

export type LockConfirmation = { readonly confirmed: true; readonly census: CustodyDoorAnswer } | { readonly confirmed: false; readonly census: CustodyDoorAnswer | null };

/** Read the census until a composition sits, then read whether the lock (`face`, or the vessel's own) landed. */
export async function confirmLockByCensus(
  face: number | undefined,
  read: () => Promise<CustodyDoorAnswer | null>,
  pause: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 500)),
  looks = LOCK_CONFIRM_LOOKS,
): Promise<LockConfirmation> {
  let census: CustodyDoorAnswer | null = null;
  for (let look = 0; look < looks; look++) {
    census = await read();
    if (census !== null && census["op"] === "census" && census["standing"] !== "recomposing") break;
    census = null;
    await pause();
  }
  if (census === null) return { confirmed: false, census: null };
  const lit = Array.isArray(census["facesLit"]) ? census["facesLit"] as unknown[] : [];
  const landed = face === undefined ? census["locked"] === true : !lit.includes(face);
  return landed ? { confirmed: true, census } : { confirmed: false, census };
}
