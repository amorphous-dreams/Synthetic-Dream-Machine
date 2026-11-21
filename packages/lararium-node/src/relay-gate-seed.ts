/** The relay service's one durable S row and its relay-only opener. */
import { createPrivateKey, createPublicKey, randomBytes } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeSync } from "node:fs";
import { join } from "node:path";
import { larIdentityDir } from "./vessel-paths.js";

export const RELAY_GATE_SEED_FILE = "relay-gate-seed.hex";

export class RelayGateSeedRefused extends Error {
  override readonly name = "RelayGateSeedRefused";
}

const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

/** The Ed25519 verifying key (hex) a 32-byte seed names. */
function publicKeyHex(seed: Uint8Array): string {
  const priv = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]), format: "der", type: "pkcs8" });
  return Buffer.from(createPublicKey(priv).export({ format: "jwk" }).x as string, "base64url").toString("hex");
}

function rowPath(): string { return join(larIdentityDir(), RELAY_GATE_SEED_FILE); }
function readRow(path: string): Uint8Array {
  const raw = readFileSync(path, "utf8");
  if (!/^[0-9a-f]{64}\n?$/.test(raw)) throw new RelayGateSeedRefused("relay-gate-seed: malformed 32-byte hex row");
  return Uint8Array.from(Buffer.from(raw.slice(0, 64), "hex"));
}

function writeNew(path: string, bytes: Uint8Array): void {
  const fd = openSync(path, "wx", 0o600);
  try { writeSync(fd, Buffer.from(bytes).toString("hex") + "\n"); fsyncSync(fd); }
  finally { closeSync(fd); }
}

/** Open no other row; a relay receives a fresh copy solely for its gate handshake. */
export function openRelayGateSeed(): Uint8Array {
  const path = rowPath();
  if (!existsSync(path)) {
    mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
    const minted = randomBytes(32);
    try { writeNew(path, minted); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
    finally { minted.fill(0); }
  }
  return readRow(path);
}

/** Replace the row intentionally; the next relay standing publishes the new address pin. */
export function rotateRelayGateSeed(): string {
  const path = rowPath();
  if (existsSync(path)) readRow(path).fill(0); // malformed custody never silently rotates away
  else mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  const next = randomBytes(32);
  const stage = `${path}.${process.pid}.${randomBytes(8).toString("hex")}.next`;
  try {
    writeNew(stage, next);
    renameSync(stage, path);
    return publicKeyHex(next);
  } finally { next.fill(0); if (existsSync(stage)) unlinkSync(stage); }
}
