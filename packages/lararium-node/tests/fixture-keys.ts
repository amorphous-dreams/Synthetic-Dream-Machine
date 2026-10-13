/**
 * fixture keys — a REAL Ed25519 verifying key from a one-byte seed, read synchronously.
 *
 * A charter seat, a guardian, an op-key and an admitted device each pass the mesh package's Ed25519 door, which
 * refuses a value that names no lawful key (`"b2".repeat(32)` names a mixed-order point, `"7a".repeat(32)` no
 * point at all). A fixture that only needs "some seat" takes one here: deterministic in its seed, and built by
 * Node's own key machinery so a module-level constant needs no await.
 */
import { createPrivateKey, createPublicKey } from "node:crypto";

const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export function fixtureKey(seedByte: number): string {
  const privateKey = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, Buffer.alloc(32, seedByte)]), format: "der", type: "pkcs8" });
  return Buffer.from(createPublicKey(privateKey).export({ format: "jwk" }).x!, "base64url").toString("hex");
}
