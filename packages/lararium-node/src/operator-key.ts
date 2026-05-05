/**
 * operator-key — device Ed25519 keypair lifecycle.
 *
 * Local-first identity root (Brooklyn Zelenka / UCAN / Keyhive alignment):
 *   - keypair is generated device-local, persists to disk with mode 0o600
 *   - verifyingKey (hex 32 bytes) feeds did:key derivation
 *   - did:key derivation happens in the TW5 VM (cold-boot-ceremony module)
 *   - GitHub / BlueSky auth enriches displayName; it does not own the DID
 *
 * Key file naming:
 *   Local dev (gh CLI active):  {dataDir}/.operator-key-{login}.json
 *   CI / offline:               {dataDir}/.operator-key.json
 *
 * Different developers on the same machine each get their own keypair.
 * The keypair is random Ed25519 — not derived from GitHub credentials.
 *
 * MUST NOT be placed inside any Automerge doc storage path — MUST NOT sync.
 * Mode 0o600 at write time; caller must ensure dataDir is not world-readable.
 */

import { generateKeyPairSync } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { getGhCliOperatorReceipt } from "./github-cli-auth.js";

interface PersistedKey {
  /** Hex-encoded 32-byte Ed25519 public key. Input to did:key derivation. */
  verifyingKey: string;
  /** Hex-encoded 32-byte Ed25519 private key seed. Local signing only. Never synced. */
  signingKey:   string;
  /** GitHub login at key-generation time. Informational only — not the DID. */
  githubLogin?: string;
}

export interface OperatorIdentity {
  /** Hex-encoded 32-byte Ed25519 verifying key. */
  verifyingKey: string;
  /** Display name from GitHub / local fallback. Enriches IdentityTiddler only. */
  displayName?: string;
}

function keyFileName(login: string | null): string {
  return login ? `.operator-key-${login}.json` : ".operator-key.json";
}

/**
 * Generate or load the device Ed25519 operator keypair.
 *
 * Key file is named by GitHub login for local dev — different developers on the
 * same machine each hold separate keys. Falls back to a shared file when offline.
 *
 * Causal-islands alignment: keypair generation runs as a device-local operation that
 * MUST complete before any Automerge doc opens. The verifyingKey flows into the
 * cold-boot ceremony which writes the IdentityTiddler into IdentitiesDoc via
 * direct handle.change() — not through the TW5 sync adaptor (wrong island).
 */
export async function generateOrLoadOperatorKeypair(
  dataDir: string,
): Promise<OperatorIdentity> {
  mkdirSync(dataDir, { recursive: true });

  const ghReceipt  = await getGhCliOperatorReceipt().catch(() => null);
  const ghLogin    = ghReceipt?.subject?.replace("github:", "") ?? null;
  const keyFile    = join(dataDir, keyFileName(ghLogin));

  let verifyingKey: string;

  if (existsSync(keyFile)) {
    const raw = JSON.parse(readFileSync(keyFile, "utf8")) as PersistedKey;
    verifyingKey = raw.verifyingKey;
    console.log(`[operator-key] loaded keypair${ghLogin ? ` for github:${ghLogin}` : ""}`);
  } else {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const pubJwk  = publicKey.export({ format: "jwk" }) as { x: string };
    const privJwk = privateKey.export({ format: "jwk" }) as { d: string };

    verifyingKey           = Buffer.from(pubJwk.x,  "base64url").toString("hex");
    const signingKey       = Buffer.from(privJwk.d, "base64url").toString("hex");
    const persisted: PersistedKey = { verifyingKey, signingKey, ...(ghLogin ? { githubLogin: ghLogin } : {}) };

    writeFileSync(keyFile, JSON.stringify(persisted, null, 2), { mode: 0o600, encoding: "utf8" });
    chmodSync(keyFile, 0o600);
    console.log(`[operator-key] generated new Ed25519 keypair${ghLogin ? ` for github:${ghLogin}` : ""}`);
  }

  const base: OperatorIdentity = { verifyingKey };
  return ghReceipt?.displayName ? { ...base, displayName: ghReceipt.displayName } : base;
}
