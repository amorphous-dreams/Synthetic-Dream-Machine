/**
 * face-key-custody — THE FACE PROOF'S TWO CUSTODY ROWS and the two signing doors on the custody seat.
 *
 * The face proof's library (`@lararium/mesh` `face-authority`) holds no secret at rest and writes no row: it mints a
 * key as bytes the caller hands straight to its custody row, and every signature comes back through a door the
 * caller supplies. This module stands as that caller's shore on a node vessel. `FACE_PROOF_CUSTODY_ROWS` names the
 * two rows, and the carrier table (`vault-carriers`) carries them under the same names:
 *
 *   face-proof-key    COLD. One face's proof key at one Nexus: 32 secret bytes minted at random. The ROOT-HOLDING
 *                     vessel alone holds it. It opens for one act (a certificate at the join door, a withdrawal at
 *                     the removal door, a face-key roll) and closes. Its file names the face (`-h<N>-`), so a
 *                     backup bundle of that one face carries it and no other face's.
 *   vessel-face-key   HOT. This vessel's own face-scoped key under one face at one Nexus: 32 secret bytes minted
 *                     at random ON this vessel. It signs at a session open or a dial. It names no face index and
 *                     stays on its vessel: no bundle carries it.
 *
 * ── THE DOORS SIGN AND RETURN ───────────────────────────────────────────────────────────────────
 * `signAsFace` and `signAsVesselFace` sign exactly the image handed in and hand back the 64 signature bytes. No door
 * hands out a secret, and the library verifies each signature before it releases anything. A door asked for a scope
 * no row holds refuses `absent`; a row whose key answers another public key than the one asked for refuses
 * `names-another-key`; a row that stands and does not open, or opens to another length, refuses by name. At the
 * floor every door and every store refuses `CustodyLocked`.
 *
 * ── A STORE NEVER LANDS OVER ANOTHER KEY ────────────────────────────────────────────────────────
 * Each store reads, decides and writes under one custody holder: nothing standing takes the key, the same key
 * again changes nothing, and a different standing key refuses with its bytes untouched.
 *
 * No production path calls this module yet: the fleet-join door, the removal door and the session open will.
 * Until one does it stands SPECIFIED in code and stays out of the package barrel.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof
 */
import { createPrivateKey, createPublicKey, sign } from "node:crypto";
import { mkdirSync, readdirSync } from "node:fs";
import { sha256HexBytesSync } from "@lararium/mesh";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { openColdCustodyRow, readCustodyRow, updateColdCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { larIdentityDir } from "./vessel-paths.js";

/** ONE face at ONE Nexus, as the face proof's library spells it (`FaceScope`): the face's public key and the Nexus's AID. */
export interface FaceKeyScope {
  readonly faceKey: string;
  readonly nexus:   string;
}

/** The face proof key's file, for the carrier table: `face-proof-key-h<N>-<32 hex of the scope>.bin`. */
export const FACE_PROOF_KEY_FILE = /^face-proof-key-h(0|[1-9]\d*)-([0-9a-f]{32})\.bin$/;
/** A vessel's face-scoped key's file: `vessel-face-key-<32 hex of the scope>.bin`. */
export const VESSEL_FACE_KEY_FILE = /^vessel-face-key-([0-9a-f]{32})\.bin$/;

const utf8 = new TextEncoder();
const PKCS8_ED25519 = Buffer.from("302e020100300506032b657004220420", "hex");

/** The name a scope gives its rows: a digest of the face key and the Nexus, so neither reads off a directory listing. */
function scopeName(scope: FaceKeyScope): string {
  return sha256HexBytesSync(utf8.encode(`${scope.faceKey.toLowerCase()}\n${scope.nexus}`)).slice(0, 32);
}

export function faceProofKeyFile(scope: FaceKeyScope, handleIndex: number): string {
  if (!Number.isSafeInteger(handleIndex) || handleIndex < 0) throw new RangeError(`face-key-custody: handle-index out of range: ${handleIndex}`);
  return `face-proof-key-h${handleIndex}-${scopeName(scope)}.bin`;
}
export function vesselFaceKeyFile(scope: FaceKeyScope): string {
  return `vessel-face-key-${scopeName(scope)}.bin`;
}

const keyOf = (secret: Uint8Array) => createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, Buffer.from(secret)]), format: "der", type: "pkcs8" });
/** The Ed25519 public key (lower hex) 32 secret bytes derive. */
function publicOf(secret: Uint8Array): string {
  return Buffer.from((createPublicKey(keyOf(secret)).export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
}

/** Sign `image` under the row's secret, once that secret answers the public key the caller named. */
function signUnder(file: string, secret: Uint8Array, answersTo: string, image: Uint8Array): Uint8Array {
  if (secret.length !== 32) throw new CustodyRowUnavailable("identity", file, "malformed");
  if (publicOf(secret) !== answersTo.toLowerCase()) throw new CustodyRowUnavailable("identity", file, "names-another-key");
  return new Uint8Array(sign(null, Buffer.from(image), keyOf(secret)));
}

function assertSecret(secret: Uint8Array): void {
  if (!(secret instanceof Uint8Array) || secret.length !== 32) throw new RangeError("face-key-custody: a key row holds exactly 32 secret bytes");
}
const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

/** The face-proof-key file standing for `scope`, whatever face it names; null when none stands. Reads names alone. */
function standingFaceProofKeyFile(scope: FaceKeyScope): string | null {
  const name = scopeName(scope);
  let names: string[];
  try { names = readdirSync(larIdentityDir()); } catch { return null; }
  return names.find((n) => FACE_PROOF_KEY_FILE.exec(n)?.[2] === name) ?? null;
}

/**
 * Seal a freshly minted face proof key as face `handleIndex`'s row for `scope`. The secret answers the scope's own
 * face key, or nothing lands. One scope rests under one face: a row standing under another face refuses.
 */
export async function storeFaceProofKey(scope: FaceKeyScope, secret: Uint8Array, handleIndex: number): Promise<void> {
  assertSecret(secret);
  const file = faceProofKeyFile(scope, handleIndex);
  if (publicOf(secret) !== scope.faceKey.toLowerCase()) throw new CustodyRowUnavailable("identity", file, "names-another-key");
  const standing = standingFaceProofKeyFile(scope);
  if (standing !== null && standing !== file) {
    throw new Error(`face-key-custody: the face proof key for this scope stands under another face (${standing}); nothing was written`);
  }
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  await updateColdCustodyRow("identity", file, (bytes) => {
    if (bytes === null) return { plaintext: Uint8Array.from(secret), value: undefined };
    if (!sameBytes(bytes, secret)) throw new CustodyRowUnavailable("identity", file, "names-another-key");
    return { plaintext: null, value: undefined };
  });
}

/** Seal this vessel's freshly minted face-scoped key for `scope`. */
export async function storeVesselFaceKey(scope: FaceKeyScope, secret: Uint8Array): Promise<void> {
  assertSecret(secret);
  const file = vesselFaceKeyFile(scope);
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  await updateCustodyRow("identity", file, (bytes) => {
    if (bytes === null) return { plaintext: Uint8Array.from(secret), value: undefined };
    if (!sameBytes(bytes, secret)) throw new CustodyRowUnavailable("identity", file, "names-another-key");
    return { plaintext: null, value: undefined };
  });
}

/** The custody seat's door for a face proof key (`FaceKeyCustody`): the cold row opens for this one signature. */
export const nodeFaceKeyCustody = {
  async signAsFace(scope: FaceKeyScope, image: Uint8Array): Promise<Uint8Array> {
    const file = standingFaceProofKeyFile(scope);
    if (file === null) {
      // The seat still answers first: a locked vessel refuses `CustodyLocked` before it says what it holds.
      return openColdCustodyRow("identity", faceProofKeyFile(scope, 0), () => { throw new CustodyRowUnavailable("identity", `face-proof-key-h*-${scopeName(scope)}.bin`, "absent"); });
    }
    return openColdCustodyRow("identity", file, (secret) => signUnder(file, secret, scope.faceKey, image));
  },
};

/** The custody seat's door for this vessel's face-scoped key (`VesselFaceKeyCustody`). */
export const nodeVesselFaceKeyCustody = {
  async signAsVesselFace(scope: FaceKeyScope, vesselFaceKey: string, image: Uint8Array): Promise<Uint8Array> {
    const file = vesselFaceKeyFile(scope);
    const secret = await readCustodyRow("identity", file);
    if (secret === null) throw new CustodyRowUnavailable("identity", file, "absent");
    try { return signUnder(file, secret, vesselFaceKey, image); } finally { secret.fill(0); }
  },
};
