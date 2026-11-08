/**
 * relay-claim — the broker's sign of life to a lead waiting on its receipt (seat-harness#/the-broker).
 *
 * When the relay picks up `req-<id>.json` it stands `run-<id>.json` in the relay dir, stirs it (mtime) while the door's
 * child speaks, and clears it once `res-<id>.json` lands. `wait-receipt` reads any claim's stir as the broker's life, so
 * a long, talkative run never reads as a dead broker. The walled lead can write the relay dir, so a claim proves life and
 * never sets a bound: the waiter's silence bound and hard cap derive here from the doors' own bounds.
 */
import { lutimesSync, unlinkSync, writeFileSync } from "node:fs";

/** The relay's pause between reads of the relay dir (commit-relay's PACING). */
export const RELAY_PAUSE_MS = 5_000;
/** The longest a door runs with no sign of life: the install seat's silence, the check seat's per-check bound. */
export const DOOR_SILENCE_MS = 120_000;
/** The longest any door runs at all; the test and install seats stop their child here. */
export const DOOR_RUN_MAX_MS = 30 * 60_000;
/** A waiter's bounds: a door's bound plus a relay pause on each side (pickup, then the answer's write). */
export const RECEIPT_SILENCE_MS = DOOR_SILENCE_MS + 2 * RELAY_PAUSE_MS;
export const RECEIPT_CAP_MS = DOOR_RUN_MAX_MS + 2 * RELAY_PAUSE_MS;

export const claimName = (id) => `run-${id}.json`;
export const isClaimName = (name) => /^run-[^/]+\.json$/.test(name);

/**
 * Stands the claim for request `id` inside the held relay dir. A name the lead planted first stays (O_EXCL refuses to
 * write through it); `beat` stirs the entry itself with lutimes and `clear` unlinks the entry, so neither follows a link.
 * A claim only advises the waiter, so `beat` and `clear` stay best-effort: whatever the lead planted at the name (a
 * directory, a link, a mode it set), neither throws into the broker.
 */
export function openClaim(relayHeld, id, { now = Date.now() } = {}) {
  const at = relayHeld.at(claimName(id));
  try { writeFileSync(at, `${JSON.stringify({ id })}\n`, { flag: "wx" }); } catch { /* advisory: a planted name stays, and the waiter's cap holds without a claim */ }
  let last = now;
  return {
    /** PACING: at most one stir per relay pause, so a chatty door never floods the relay dir; `force` stirs at once (before a long synchronous step). */
    beat({ now: t = Date.now(), force = false } = {}) {
      if (!force && t - last < RELAY_PAUSE_MS) return false;
      last = t;
      const stamp = new Date(t);
      try { lutimesSync(at, stamp, stamp); } catch { /* advisory: the waiter's cap holds without it */ }
      return true;
    },
    clear() { try { unlinkSync(at); } catch { /* advisory: a planted entry outlives its request harmlessly */ } },
  };
}
