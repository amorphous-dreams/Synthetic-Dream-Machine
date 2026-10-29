/** The intent-admission service's vessel-owned cold S row. */
import { createPrivateKey, createPublicKey, randomFillSync, sign } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { openColdCustodyRow, updateColdCustodyRow } from "./custody-seat.js";
import { larIdentityDir } from "./vessel-paths.js";

export const INTENT_RELAY_KEY_FILE = "intent-relay-key.bin";
const prefix = Buffer.from("302e020100300506032b657004220420", "hex");
function privateOf(secret: Uint8Array) {
  const der = Buffer.concat([prefix, secret]);
  try { return createPrivateKey({ key: der, format: "der", type: "pkcs8" }); }
  finally { der.fill(0); }
}
function publicOf(secret: Uint8Array): string {
  return Buffer.from((createPublicKey(privateOf(secret)).export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
}
function requireSecret(secret: Uint8Array): Uint8Array {
  if (secret.length !== 32) throw new CustodyRowUnavailable("identity", INTENT_RELAY_KEY_FILE, "malformed");
  return secret;
}
/** Name the row without opening custody; this works at the floor. */
export function heldIntentRelayKey(): boolean { return existsSync(join(larIdentityDir(), INTENT_RELAY_KEY_FILE)); }
export async function mintIntentRelayKey(): Promise<{ key: string }> {
  const secret = randomFillSync(new Uint8Array(32));
  try {
    return await updateColdCustodyRow("identity", INTENT_RELAY_KEY_FILE, (prior) => {
      if (prior !== null) throw new CustodyRowUnavailable("identity", INTENT_RELAY_KEY_FILE, "names-another-key");
      return { plaintext: secret, value: { key: publicOf(secret) } };
    });
  } finally { secret.fill(0); }
}
export async function intentRelayPublicKey(): Promise<string> {
  return openColdCustodyRow("identity", INTENT_RELAY_KEY_FILE, (secret) => publicOf(requireSecret(secret)));
}
/** Sign exactly the supplied image through this row's scoped custody door. */
export async function signAsIntentRelay(image: Uint8Array): Promise<string> {
  return openColdCustodyRow("identity", INTENT_RELAY_KEY_FILE, (secret) =>
    Buffer.from(sign(null, Buffer.from(image), privateOf(requireSecret(secret)))).toString("hex"));
}
/** Rotation takes one custody hold and answers both public keys. */
export async function rotateIntentRelayKey(): Promise<{ previous: string; key: string }> {
  const next = randomFillSync(new Uint8Array(32));
  try {
    return await updateColdCustodyRow("identity", INTENT_RELAY_KEY_FILE, (prior) => {
      if (prior === null) throw new CustodyRowUnavailable("identity", INTENT_RELAY_KEY_FILE, "absent");
      return { plaintext: next, value: { previous: publicOf(requireSecret(prior)), key: publicOf(next) } };
    });
  } finally { next.fill(0); }
}
export async function intentRelayKeyOrMint(): Promise<{ key: string }> {
  if (heldIntentRelayKey()) return { key: await intentRelayPublicKey() };
  try { return await mintIntentRelayKey(); }
  catch (error) {
    if (error instanceof CustodyRowUnavailable && error.reading === "names-another-key") return { key: await intentRelayPublicKey() };
    throw error;
  }
}
