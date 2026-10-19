/**
 * seat-key-store — A SEAT'S OWN KEY, one COLD row per key, sealed under the vessel key on the custody seat.
 *
 * A seat names one chair in a charter's k-of-n, and a seat holds a key, never a person. That key stands apart from
 * the persona root and apart from the per-Nexus dialing leaf: it mints at random on this vessel, signs only what a
 * chair signs, and derives from nothing a face holds. The carrier table (`vault-carriers`) names its row:
 *
 *   seat-key   COLD. 32 secret bytes minted at random. It opens for ONE signature and closes. Its file names the
 *              face whose seat claim stood for the chair (`-h<N>-`) and a digest of the seat's public key, so a
 *              directory listing names no key. It stays on its vessel: a face's backup bundle carries no key of
 *              any seat.
 *
 * ── THE DISK NAMES THE KEYS ─────────────────────────────────────────────────────────────────────
 * No index stands beside the rows. `heldSeatKey` answers whether this vessel holds a seat's key by spelling the
 * name that key's digest gives and reading the directory; `listSeatKeys` reads the same names. Both read names
 * alone and open nothing, so both answer at the floor. A caller who already holds a public key tests whether its
 * row stands here; a holder of the disk who lacks the key recovers none from a name.
 *
 * ── THE DOOR SIGNS AND RETURNS ──────────────────────────────────────────────────────────────────
 * `signAsSeat` signs exactly the image handed in and hands back the 64 signature bytes. It hands out no secret.
 * A key no row holds refuses `absent`; a row whose secret answers another public key than the one its name
 * commits to refuses `names-another-key`; a row that stands and does not open, or opens to another length,
 * refuses by name. At the floor the door, the mint, the store and the retirement refuse `CustodyLocked`.
 *
 * ── A STORE NEVER LANDS OVER ANOTHER KEY, AND A RETIREMENT REMOVES ONLY WHAT THIS VESSEL'S KEY OPENS ────
 * A store reads, decides and writes under one custody holder: nothing standing takes the key, the same key again
 * changes nothing, and other standing bytes refuse untouched. One seat key rests under ONE face: a store of the
 * same key under another face refuses, and the look at the other faces' rows runs under the same hold as the
 * write. `retireSeatKey` removes through the holder, which removes only a row its own vessel key opens, and only
 * once the row's own bytes answer the key asked for: a row sealed under another key stays, and so does a row that
 * holds another key under this key's name.
 *
 * ── ONE FACE'S PUBLIC HALVES, FOR A RITE THAT MUST NAME THEM ────────────────────────────────────
 * A name commits to a key and reveals none, so a rite that must spell a key-set (the roll that seats the keys a
 * head committed) asks `seatKeysOfFace`: each row of ONE face opens once, for that read, and answers the public
 * half its secret derives. Nothing secret leaves the call.
 *
 * Callers: the seal rite (`seal-ceremony`: the arming of a genesis and of a roll, the roll's hand, a crossing's
 * marks) and the quorum doors' choice of signers (`held-quorum`).
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/kahu#/seed-and-nexus · lar:///ha.ka.ba/lararium/mesh/custody#/the-table
 */
import { createPrivateKey, createPublicKey, randomFillSync, sign } from "node:crypto";
import { readdirSync } from "node:fs";
import { bytesEqual, sha256HexBytesSync } from "@lararium/mesh";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { openColdCustodyRow, openedCustody, removeColdCustodyRow, updateColdCustodyRow } from "./custody-seat.js";
import { larIdentityDir } from "./vessel-paths.js";

/** The seat key's file, for the carrier table: `seat-key-h<N>-<32 hex of the key's name>.bin`. */
export const SEAT_KEY_FILE = /^seat-key-h(0|[1-9]\d*)-([0-9a-f]{32})\.bin$/;

const utf8 = new TextEncoder();
const PKCS8_ED25519 = Buffer.from("302e020100300506032b657004220420", "hex");
const HEX64 = /^[0-9a-f]{64}$/;

/** One seat key this vessel holds, as its file names it. It carries no key byte. */
export interface HeldSeatKey {
  /** The face whose seat claim stood for the chair. */
  readonly handleIndex: number;
  /** The digest name the key's public half gives its row (32 lower hex). */
  readonly name:        string;
  readonly file:        string;
}

function assertKey(verifyingKey: string): string {
  const key = typeof verifyingKey === "string" ? verifyingKey.toLowerCase() : "";
  if (!HEX64.test(key)) throw new RangeError("seat-key-store: a seat's public key reads as 64 hex");
  return key;
}
function assertFace(handleIndex: number): void {
  if (!Number.isSafeInteger(handleIndex) || handleIndex < 0) throw new RangeError(`seat-key-store: handle-index out of range: ${handleIndex}`);
}
function assertSecret(secret: Uint8Array): void {
  if (!(secret instanceof Uint8Array) || secret.length !== 32) throw new RangeError("seat-key-store: a seat key row holds exactly 32 secret bytes");
}

/** The name a seat's public key gives its row: a digest, so the key never reads off a directory listing. */
export function seatKeyName(verifyingKey: string): string {
  return sha256HexBytesSync(utf8.encode(`seat-key\n${assertKey(verifyingKey)}`)).slice(0, 32);
}

/** The file face `handleIndex`'s row for one seat key rests at. */
export function seatKeyFile(verifyingKey: string, handleIndex: number): string {
  assertFace(handleIndex);
  return `seat-key-h${handleIndex}-${seatKeyName(verifyingKey)}.bin`;
}

/** The signing key 32 secret bytes spell. The one byte image this builds on the way zero-fills before it returns. */
function keyOf(secret: Uint8Array) {
  const der = Buffer.concat([PKCS8_ED25519, secret]);
  try { return createPrivateKey({ key: der, format: "der", type: "pkcs8" }); } finally { der.fill(0); }
}
/** The Ed25519 public key (lower hex) 32 secret bytes derive. */
function publicOf(secret: Uint8Array): string {
  return Buffer.from((createPublicKey(keyOf(secret)).export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
}

/** Every seat key this vessel holds, by name. Reads the directory alone: it opens no row and answers at the floor. */
export function listSeatKeys(): HeldSeatKey[] {
  let names: string[];
  try { names = readdirSync(larIdentityDir()); } catch { return []; }
  const out: HeldSeatKey[] = [];
  for (const file of names.sort()) {
    const m = SEAT_KEY_FILE.exec(file);
    if (m) out.push({ handleIndex: Number(m[1]), name: m[2]!, file });
  }
  return out;
}

/** The row this vessel holds for one seat's public key, or null. Reads names alone. */
export function heldSeatKey(verifyingKey: string): HeldSeatKey | null {
  const name = seatKeyName(verifyingKey);
  return listSeatKeys().find((k) => k.name === name) ?? null;
}

/**
 * The public half of every seat key face `handleIndex` holds, ascending. Each row of that face opens once, for
 * this read; its secret answers the key its name commits to or the read refuses by name, and no secret leaves.
 * No row of another face opens. At the floor it refuses `CustodyLocked` before it says what the face holds.
 */
export async function seatKeysOfFace(handleIndex: number): Promise<string[]> {
  assertFace(handleIndex);
  await openedCustody();
  const keys: string[] = [];
  for (const held of listSeatKeys()) {
    if (held.handleIndex !== handleIndex) continue;
    keys.push(await openColdCustodyRow("identity", held.file, (secret) => {
      if (secret.length !== 32) throw new CustodyRowUnavailable("identity", held.file, "malformed");
      const key = publicOf(secret);
      if (seatKeyName(key) !== held.name) throw new CustodyRowUnavailable("identity", held.file, "names-another-key");
      return key;
    }));
  }
  return keys.sort();
}

/**
 * Seal 32 secret bytes as face `handleIndex`'s row for the seat key they derive, and answer that key's public
 * half. Nothing standing takes the key; the same key again changes nothing; other standing bytes refuse untouched.
 * One seat key rests under one face: a row standing under another face refuses before any write. The store works
 * from its own copy of the bytes handed in, taken before anything waits, and zero-fills that copy.
 */
export async function storeSeatKey(handleIndex: number, secret: Uint8Array): Promise<string> {
  assertSecret(secret);
  const own = Uint8Array.from(secret);
  try {
    const verifyingKey = publicOf(own);
    const file = seatKeyFile(verifyingKey, handleIndex);
    await updateColdCustodyRow("identity", file, (bytes) => {
      // The look at the other faces' rows runs under the same custody hold as the write: two stores of one key
      // under two faces never both land.
      const standing = heldSeatKey(verifyingKey);
      if (standing !== null && standing.file !== file) {
        throw new Error(`seat-key-store: this seat key stands under another face (${standing.file}); nothing was written`);
      }
      // The writer seals this store's own copy, which zero-fills below once the write has settled: no second
      // image of the secret outlives the store.
      if (bytes === null) return { plaintext: own, value: undefined };
      if (!bytesEqual(bytes, own)) throw new CustodyRowUnavailable("identity", file, "names-another-key");
      return { plaintext: null, value: undefined };
    });
    return verifyingKey;
  } finally { own.fill(0); }
}

/**
 * Mint a seat key at random for face `handleIndex`, seal it, and answer its public half. The secret lives in this
 * call alone and zero-fills before it returns; it derives from no root, leaf or seed this vessel holds.
 */
export async function mintSeatKey(handleIndex: number): Promise<string> {
  const secret = new Uint8Array(32);
  try { randomFillSync(secret); return await storeSeatKey(handleIndex, secret); } finally { secret.fill(0); }
}

/** The seat's door: the cold row opens for this one signature over exactly `image`. */
export async function signAsSeat(verifyingKey: string, image: Uint8Array): Promise<Uint8Array> {
  const key = assertKey(verifyingKey);
  const held = heldSeatKey(key);
  if (held === null) {
    // The seat still answers first: a locked vessel refuses `CustodyLocked` before it says what it holds.
    await openedCustody();
    throw new CustodyRowUnavailable("identity", `seat-key-h*-${seatKeyName(key)}.bin`, "absent");
  }
  return openColdCustodyRow("identity", held.file, (secret) => {
    if (secret.length !== 32) throw new CustodyRowUnavailable("identity", held.file, "malformed");
    if (publicOf(secret) !== key) throw new CustodyRowUnavailable("identity", held.file, "names-another-key");
    return new Uint8Array(sign(null, Buffer.from(image), keyOf(secret)));
  });
}

/**
 * Retire one seat key: its row leaves, and this answers whether one stood. The holder removes only a row its own
 * vessel key opens, so a row that stands and does not open refuses `CustodyRowUnavailable` and stays.
 */
export async function retireSeatKey(verifyingKey: string): Promise<boolean> {
  const held = heldSeatKey(verifyingKey);
  if (held === null) { await openedCustody(); return false; }
  const key = assertKey(verifyingKey);
  // The row's own bytes answer for it, under the same hold as the removal: a row under this key's name that holds
  // another key, or another length, stays and refuses by name.
  const row: { reading: "malformed" | "names-another-key" | null } = { reading: null };
  const left = await removeColdCustodyRow("identity", held.file, (secret) => {
    row.reading = secret.length !== 32 ? "malformed" : publicOf(secret) !== key ? "names-another-key" : null;
    return row.reading === null;
  });
  if (row.reading !== null) throw new CustodyRowUnavailable("identity", held.file, row.reading);
  return left;
}
