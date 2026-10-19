/**
 * face-key-custody — THE FACE PROOF'S TWO CUSTODY ROWS and the two signing doors on the custody seat.
 *
 * The face proof's library (`@lararium/mesh` `face-authority`) holds no secret at rest and writes no row: it mints a
 * key as bytes the caller hands straight to its custody row, and every signature comes back through a door the
 * caller supplies. This module stands as that caller's shore on a node vessel. `FACE_PROOF_CUSTODY_ROWS` names the
 * two rows, and the carrier table (`vault-carriers`) carries them under the same names:
 *
 *   face-proof-key    COLD. One face's key at one Nexus, its PER-NEXUS KEY: 32 secret bytes minted at random,
 *                     never derived from a seed. The ROOT-HOLDING vessel alone holds it. Its file names the face
 *                     (`-h<N>-`) and a digest of the Nexus, so one face holds one row per Nexus and a backup
 *                     bundle of that one face carries it and no other face's. It opens for one act (a signature
 *                     at a walk, a contract or a hosting act; a certificate; a withdrawal; a hand-over) and closes.
 *                     While a RE-ISSUE stands half done, the row holds 64 bytes: the standing key, then its
 *                     successor, and the standing key still signs until the hand-over lands.
 *   vessel-face-key   HOT. This vessel's own face-scoped key under one face at one Nexus: 32 secret bytes minted
 *                     at random ON this vessel. It signs at a session open or a dial. It names no face index and
 *                     stays on its vessel: no bundle carries it.
 *
 * ── A READ NEVER MINTS ──────────────────────────────────────────────────────────────────────────
 * `readNexusKey` answers the key standing for a face at a Nexus, or null. Only an act that presents the face at a
 * Nexus mints one (`mintNexusKey`): a walk taken, a contract signed, a hearth's hosting, a steward's seal.
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
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-key-hierarchy
 */
import { createPrivateKey, createPublicKey, randomBytes, sign } from "node:crypto";
import { mkdirSync, readdirSync } from "node:fs";
import { bytesEqual, sha256HexBytesSync } from "@lararium/mesh";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { openColdCustodyRow, readCustodyRow, updateColdCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { larIdentityDir } from "./vessel-paths.js";

/** ONE face at ONE Nexus, as the face proof's library spells it (`FaceScope`): the face's public key and the Nexus's AID. */
export interface FaceKeyScope {
  readonly faceKey: string;
  readonly nexus:   string;
}

/** The face proof key's file, for the carrier table: `face-proof-key-h<N>-<32 hex of a digest of the Nexus>.bin`. */
export const FACE_PROOF_KEY_FILE = /^face-proof-key-h(0|[1-9]\d*)-([0-9a-f]{32})\.bin$/;
/** A vessel's face-scoped key's file: `vessel-face-key-<32 hex of the scope>.bin`. */
export const VESSEL_FACE_KEY_FILE = /^vessel-face-key-([0-9a-f]{32})\.bin$/;

const utf8 = new TextEncoder();
const PKCS8_ED25519 = Buffer.from("302e020100300506032b657004220420", "hex");

/** The name a vessel's face-scoped key gives its row: a digest of the face key and the Nexus. */
function scopeName(scope: FaceKeyScope): string {
  return sha256HexBytesSync(utf8.encode(`${scope.faceKey.toLowerCase()}\n${scope.nexus}`)).slice(0, 32);
}
/** The name a face's per-Nexus key gives its row: a digest of the Nexus alone, so a face finds its key at a Nexus
 *  by the Nexus, and a listing names no Nexus. */
export function nexusKeyRowName(nexus: string): string {
  const aid = nexus.trim().toLowerCase();
  if (aid.length === 0) throw new RangeError("face-key-custody: a per-Nexus key names its Nexus");
  return sha256HexBytesSync(utf8.encode(`face-proof-key\n${aid}`)).slice(0, 32);
}

/** Face `handleIndex`'s per-Nexus key row at `nexus`. */
export function faceProofKeyFile(handleIndex: number, nexus: string): string {
  if (!Number.isSafeInteger(handleIndex) || handleIndex < 0) throw new RangeError(`face-key-custody: handle-index out of range: ${handleIndex}`);
  return `face-proof-key-h${handleIndex}-${nexusKeyRowName(nexus)}.bin`;
}
export function vesselFaceKeyFile(scope: FaceKeyScope): string {
  return `vessel-face-key-${scopeName(scope)}.bin`;
}

const keyOf = (secret: Uint8Array) => createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, Buffer.from(secret)]), format: "der", type: "pkcs8" });
/** The Ed25519 public key (lower hex) 32 secret bytes derive. */
function publicOf(secret: Uint8Array): string {
  return Buffer.from((createPublicKey(keyOf(secret)).export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
}
export { publicOf as nexusKeyPublicOf };

/** Sign `image` under the row's secret, once that secret answers the public key the caller named. */
function signUnder(file: string, secret: Uint8Array, answersTo: string, image: Uint8Array): Uint8Array {
  if (secret.length !== 32) throw new CustodyRowUnavailable("identity", file, "malformed");
  if (publicOf(secret) !== answersTo.toLowerCase()) throw new CustodyRowUnavailable("identity", file, "names-another-key");
  return new Uint8Array(sign(null, Buffer.from(image), keyOf(secret)));
}

function assertSecret(secret: Uint8Array): void {
  if (!(secret instanceof Uint8Array) || secret.length !== 32) throw new RangeError("face-key-custody: a key row holds exactly 32 secret bytes");
}

/** The standing key of a per-Nexus row's plaintext: its first 32 bytes, whole or mid re-issue; null for any other
 *  length. */
function standingOf(bytes: Uint8Array): Uint8Array | null {
  return bytes.length === 32 || bytes.length === 64 ? bytes.subarray(0, 32) : null;
}

/** Every face's per-Nexus row at `nexus` this vessel holds. Reads names alone. */
function rowsAtNexus(nexus: string): string[] {
  const name = nexusKeyRowName(nexus);
  let names: string[];
  try { names = readdirSync(larIdentityDir()); } catch { return []; }
  return names.filter((n) => FACE_PROOF_KEY_FILE.exec(n)?.[2] === name).sort();
}

// ── The per-Nexus key: read, mint, re-issue ───────────────────────────────────────────────────────

/**
 * Every key face `handleIndex` may present at `nexus` (32 secret bytes each, the caller's to zero-fill): none, the
 * standing key alone, or, while a re-issue stands half done, the standing key and then its successor. A read never
 * mints. A presenter offers the one that heads the line its reader holds, so a crash between the hand-over's
 * landing and the row's close strands no presentation.
 */
export async function readNexusKeys(handleIndex: number, nexus: string): Promise<Uint8Array[]> {
  const file = faceProofKeyFile(handleIndex, nexus);
  return updateColdCustodyRow("identity", file, (bytes) => {
    if (bytes === null) return { plaintext: null, value: [] };
    if (bytes.length === 32) return { plaintext: null, value: [Uint8Array.from(bytes)] };
    if (bytes.length === 64) return { plaintext: null, value: [Uint8Array.from(bytes.subarray(0, 32)), Uint8Array.from(bytes.subarray(32))] };
    throw new CustodyRowUnavailable("identity", file, "malformed");
  });
}

/** The key face `handleIndex` holds at `nexus` (its 32 secret bytes, the caller's to zero-fill), or null when none
 *  stands. A read never mints. Mid re-issue it answers the STANDING key; `readNexusKeys` offers both. */
export async function readNexusKey(handleIndex: number, nexus: string): Promise<Uint8Array | null> {
  const file = faceProofKeyFile(handleIndex, nexus);
  // One custody holder reads the row and writes nothing: a locked vessel refuses `CustodyLocked` before it says
  // what it holds, and an absent row answers null.
  return updateColdCustodyRow("identity", file, (bytes) => {
    if (bytes === null) return { plaintext: null, value: null };
    const standing = standingOf(bytes);
    if (standing === null) throw new CustodyRowUnavailable("identity", file, "malformed");
    return { plaintext: null, value: Uint8Array.from(standing) };
  });
}

/** The key face `handleIndex` holds at `nexus`, minted at random where none stands, under one custody holder: a
 *  second mint racing the first finds the first's key. The caller presents the face at that Nexus. */
export async function mintNexusKey(handleIndex: number, nexus: string): Promise<Uint8Array> {
  const file = faceProofKeyFile(handleIndex, nexus);
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  return updateColdCustodyRow("identity", file, (bytes) => {
    if (bytes !== null) {
      const standing = standingOf(bytes);
      if (standing === null) throw new CustodyRowUnavailable("identity", file, "malformed");
      return { plaintext: null, value: Uint8Array.from(standing) };
    }
    const fresh = new Uint8Array(randomBytes(32));
    return { plaintext: Uint8Array.from(fresh), value: fresh };
  });
}

/** One re-issue's two keys: the standing key that hands its standing on, and its successor. The caller zero-fills both. */
export interface NexusKeyReissue {
  readonly from: Uint8Array;
  readonly to:   Uint8Array;
}

/**
 * Open a re-issue of face `handleIndex`'s key at `nexus`: the row takes the standing key and a successor minted at
 * random, in one sealed write, so a crash before the hand-over lands loses neither. A re-issue already half done
 * answers its own two keys again, so the act resumes where it stopped. Refuses where no key stands.
 */
export async function beginNexusKeyReissue(handleIndex: number, nexus: string): Promise<NexusKeyReissue> {
  const file = faceProofKeyFile(handleIndex, nexus);
  return updateColdCustodyRow("identity", file, (bytes) => {
    if (bytes === null) throw new CustodyRowUnavailable("identity", file, "absent");
    if (bytes.length === 64) return { plaintext: null, value: { from: Uint8Array.from(bytes.subarray(0, 32)), to: Uint8Array.from(bytes.subarray(32)) } };
    if (bytes.length !== 32) throw new CustodyRowUnavailable("identity", file, "malformed");
    const to = new Uint8Array(randomBytes(32));
    const both = new Uint8Array(64);
    both.set(bytes, 0); both.set(to, 32);
    return { plaintext: both, value: { from: Uint8Array.from(bytes), to } };
  });
}

/**
 * Close a re-issue once its hand-over landed: the row keeps the successor alone, and the standing key leaves this
 * vessel. Refuses unless the row stands half done with exactly `to` as its successor.
 */
export async function finishNexusKeyReissue(handleIndex: number, nexus: string, to: Uint8Array): Promise<void> {
  assertSecret(to);
  const file = faceProofKeyFile(handleIndex, nexus);
  await updateColdCustodyRow("identity", file, (bytes) => {
    if (bytes === null) throw new CustodyRowUnavailable("identity", file, "absent");
    if (bytes.length !== 64 || !bytesEqual(bytes.subarray(32), to)) throw new CustodyRowUnavailable("identity", file, "names-another-key");
    return { plaintext: Uint8Array.from(to), value: undefined };
  });
}

/** Drop a half-done re-issue's successor `to`: the row keeps its standing key alone. Refuses unless the row stands
 *  half done with exactly `to` as its successor. */
export async function abandonNexusKeyReissue(handleIndex: number, nexus: string, to: Uint8Array): Promise<void> {
  assertSecret(to);
  const file = faceProofKeyFile(handleIndex, nexus);
  await updateColdCustodyRow("identity", file, (bytes) => {
    if (bytes === null) throw new CustodyRowUnavailable("identity", file, "absent");
    if (bytes.length !== 64 || !bytesEqual(bytes.subarray(32), to)) throw new CustodyRowUnavailable("identity", file, "names-another-key");
    return { plaintext: Uint8Array.from(bytes.subarray(0, 32)), value: undefined };
  });
}

// ── The face proof's library: store, list, land, sign ───────────────────────────────────────────

/**
 * Seal a face's key for `scope` as face `handleIndex`'s row at `scope.nexus`. The secret answers the scope's own
 * face key, or nothing lands; a row standing under other bytes refuses untouched.
 */
export async function storeFaceProofKey(scope: FaceKeyScope, secret: Uint8Array, handleIndex: number): Promise<void> {
  assertSecret(secret);
  const file = faceProofKeyFile(handleIndex, scope.nexus);
  if (publicOf(secret) !== scope.faceKey.toLowerCase()) throw new CustodyRowUnavailable("identity", file, "names-another-key");
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  await updateColdCustodyRow("identity", file, (bytes) => {
    if (bytes === null) return { plaintext: Uint8Array.from(secret), value: undefined };
    if (!bytesEqual(bytes, secret)) throw new CustodyRowUnavailable("identity", file, "names-another-key");
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
    if (!bytesEqual(bytes, secret)) throw new CustodyRowUnavailable("identity", file, "names-another-key");
    return { plaintext: null, value: undefined };
  });
}

/** The public half of this vessel's face-scoped key for `scope`, or null where no row stands. The secret opens for
 *  this one read and leaves zero-filled; a session names its own key from here, never from a certificate. */
export async function readVesselFaceKeyPublic(scope: FaceKeyScope): Promise<string | null> {
  const file = vesselFaceKeyFile(scope);
  const secret = await readCustodyRow("identity", file);
  if (secret === null) return null;
  try {
    if (secret.length !== 32) throw new CustodyRowUnavailable("identity", file, "malformed");
    return publicOf(secret);
  } finally { secret.fill(0); }
}

/**
 * Every per-Nexus key this vessel holds for face `handleIndex`, each beside its row's own name, for that face's
 * backup bundle. Each cold row opens for the length of this one read; the caller owns the bytes and zero-fills
 * them. A row whose re-issue stands half done refuses the read by name: a bundle carries one key per Nexus.
 */
export async function listFaceProofKeys(handleIndex: number): Promise<Array<{ readonly scope: string; readonly secret: Uint8Array }>> {
  let names: string[];
  try { names = readdirSync(larIdentityDir()); } catch { names = []; }
  const out: Array<{ scope: string; secret: Uint8Array }> = [];
  for (const file of names.sort()) {
    const m = FACE_PROOF_KEY_FILE.exec(file);
    if (!m || Number(m[1]) !== handleIndex) continue;
    out.push({ scope: m[2]!, secret: await openColdCustodyRow("identity", file, (secret) => {
      if (secret.length === 64) throw new Error(`face-key-custody: a re-issue stands half done at ${file}; finish it before a bundle carries this face`);
      if (secret.length !== 32) throw new CustodyRowUnavailable("identity", file, "malformed");
      return Uint8Array.from(secret);
    }) });
  }
  return out;
}

/** What stands for one carried face proof key at `handleIndex`: nothing, the same bytes, or a conflict. Opens the row and writes nothing. */
export async function faceProofKeyStanding(scope: string, secret: Uint8Array, handleIndex: number): Promise<"absent" | "same" | "conflict"> {
  assertSecret(secret);
  if (!/^[0-9a-f]{32}$/.test(scope)) throw new RangeError("face-key-custody: a scope's name reads as 32 lower hex");
  let names: string[];
  try { names = readdirSync(larIdentityDir()); } catch { names = []; }
  const file = `face-proof-key-h${handleIndex}-${scope}.bin`;
  if (!names.includes(file)) return "absent";
  return openColdCustodyRow("identity", file, (bytes) => (bytesEqual(bytes, secret) ? "same" : "conflict"));
}

/**
 * Land one CARRIED face proof key as face `handleIndex`'s row for the scope named `scope` (a restore). Nothing
 * standing takes the key, the same key again changes nothing, and any other standing bytes refuse untouched.
 */
export async function landFaceProofKey(scope: string, secret: Uint8Array, handleIndex: number): Promise<void> {
  assertSecret(secret);
  if (!/^[0-9a-f]{32}$/.test(scope) || !Number.isSafeInteger(handleIndex) || handleIndex < 0) throw new RangeError("face-key-custody: a carried key names a scope (32 lower hex) and a handle-index");
  const file = `face-proof-key-h${handleIndex}-${scope}.bin`;
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  await updateColdCustodyRow("identity", file, (bytes) => {
    if (bytes === null) return { plaintext: Uint8Array.from(secret), value: undefined };
    if (!bytesEqual(bytes, secret)) throw new CustodyRowUnavailable("identity", file, "names-another-key");
    return { plaintext: null, value: undefined };
  });
}

/** The custody seat's door for a face proof key (`FaceKeyCustody`): the row at the scope's Nexus whose standing key
 *  answers the scope's face key opens for this one signature. */
export const nodeFaceKeyCustody = {
  async signAsFace(scope: FaceKeyScope, image: Uint8Array): Promise<Uint8Array> {
    const candidates = rowsAtNexus(scope.nexus);
    if (candidates.length === 0) {
      // The seat still answers first: a locked vessel refuses `CustodyLocked` before it says what it holds.
      return updateColdCustodyRow("identity", faceProofKeyFile(0, scope.nexus), () => {
        throw new CustodyRowUnavailable("identity", `face-proof-key-h*-${nexusKeyRowName(scope.nexus)}.bin`, "absent");
      });
    }
    for (const file of candidates) {
      const signed = await openColdCustodyRow("identity", file, (bytes) => {
        const standing = standingOf(bytes);
        if (standing === null) throw new CustodyRowUnavailable("identity", file, "malformed");
        return publicOf(standing) === scope.faceKey.toLowerCase() ? signUnder(file, Uint8Array.from(standing), scope.faceKey, image) : null;
      });
      if (signed !== null) return signed;
    }
    throw new CustodyRowUnavailable("identity", candidates[0]!, "names-another-key");
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
