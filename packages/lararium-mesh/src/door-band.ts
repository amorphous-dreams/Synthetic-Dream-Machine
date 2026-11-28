/**
 * door-band — the five bands every door answers on, each announced, so a caller reads where its act stands and never
 * guesses from a slow answer or a missing one (lar:///ha.ka.ba/kahua/memory/research/the-door-gradient).
 *
 *   answered  the outcome comes back inline.
 *   admitted  the door took the act; its outcome follows, read back by the act's id.
 *   owed      the act stands, its outcome has not reached the caller; read it back by id, and a retry sends the same
 *             id and answers from the record, never acting twice.
 *   asks      a person must answer (a hand act, a route, a pending removal); the answer names what answers it and who may.
 *   void      a named refusal with its runnable cure.
 *
 * NO CLOCK DECIDES A BAND. A wait that ends with no outcome reads "owed", never "timed out": an attacker can set any
 * clock, so a timer may pace a caller's next look but never turns an act into a verdict.
 *
 * Platform-blind and pure.
 */

/** The five bands, in the order a gradient degrades. */
export const DOOR_BANDS = ["answered", "admitted", "owed", "asks", "void"] as const;
export type DoorBand = typeof DOOR_BANDS[number];

/** True where `value` names one of the five bands. */
export function isDoorBand(value: unknown): value is DoorBand {
  return typeof value === "string" && (DOOR_BANDS as readonly string[]).includes(value);
}
