/**
 * fixture keys — a REAL Ed25519 verifying key from a one-byte seed, read synchronously.
 *
 * A charter seat, a guardian, an op-key and an admitted device each pass the mesh package's Ed25519 door, which
 * refuses a value that names no lawful key (`"b2".repeat(32)` names a mixed-order point, `"7a".repeat(32)` no
 * point at all). A fixture that only needs "some seat" takes one here: deterministic in its seed, and built by
 * Node's own key machinery so a module-level constant needs no await. Each key books its seed with the charter
 * fixture, so a charter seated over it signs its inception.
 */
import { bookSeat } from "../../lararium-mesh/tests/charter-fixture.js";

export function fixtureKey(seedByte: number): string {
  return bookSeat(new Uint8Array(32).fill(seedByte));
}
