/**
 * cadence-key-store — A HEARTH'S OWN CADENCE KEY and its next key, one COLD row per key, sealed under the vessel key.
 *
 * The engine cadence keeps its own lineage and threshold, apart from every seat key (kahu#/contract). Each founder's
 * hearth, the device that bears the reboot, holds one cadence key per founding it seats. The carrier table
 * (`vault-carriers`) names its row:
 *
 *   cadence-key   COLD. 64 secret bytes minted at random on this device: the cadence key's 32, then its next key's
 *                 32. Neither derives from serving or floor material, nor from any root, leaf or seat. The row
 *                 opens for ONE act and closes. Its file names a digest of the cadence key's public half, so a
 *                 directory listing names no key. It stays on its vessel: no face's bundle carries it.
 *
 * No card prints at a founding: the next key rests in the row beside the key it succeeds, and the cadence image
 * commits its digest (`cadenceNextDigest`). A holder may later rotate onto a cold card by its own choice.
 *
 * `mintCadenceKey` mints and seals a fresh row and answers the public material a founding commits; `signAsCadence`
 * signs exactly the image handed in and hands back the signature. A key no row holds refuses `absent`, a row whose
 * bytes answer another key than its name commits to refuses `names-another-key`, and at the floor every act
 * refuses `CustodyLocked`.
 *
 * Callers: the cofound ceremony (`cofound-ceremony`): the offer and the join mint one, the join and the seal sign the
 * cadence inception with it.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/kahu#/contract · lar:///ha.ka.ba/lararium/mesh/custody#/the-table
 */
import { createPrivateKey, createPublicKey, randomFillSync, sign } from "node:crypto";
import { faceFileNames } from "./face-index.js";
import { cadenceNextDigest, sha256HexBytesSync, type CadenceHolder } from "@lararium/mesh";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { openColdCustodyRow, openedCustody, removeColdCustodyRow, updateColdCustodyRow } from "./custody-seat.js";
import { larIdentityDir } from "./vessel-paths.js";

/** The cadence key's file, for the carrier table: `cadence-key-h<N>-<32 hex of the key's name>.bin`, in the face that minted it. */
export const CADENCE_KEY_FILE = /^cadence-key-h(0|[1-9]\d*)-([0-9a-f]{32})\.bin$/;

const utf8 = new TextEncoder();
const PKCS8_ED25519 = Buffer.from("302e020100300506032b657004220420", "hex");
const HEX64 = /^[0-9a-f]{64}$/;
const ROW_BYTES = 64;

function assertKey(verifyingKey: string): string {
  const key = typeof verifyingKey === "string" ? verifyingKey.toLowerCase() : "";
  if (!HEX64.test(key)) throw new RangeError("cadence-key-store: a cadence key reads as 64 hex");
  return key;
}

/** The name a cadence key's public half gives its row: a digest, so the key never reads off a directory listing. */
export function cadenceKeyName(verifyingKey: string): string {
  return sha256HexBytesSync(utf8.encode(`cadence-key\n${assertKey(verifyingKey)}`)).slice(0, 32);
}

/** The file one cadence key's row rests at. */
export function cadenceKeyFile(handleIndex: number, verifyingKey: string): string {
  if (!Number.isSafeInteger(handleIndex) || handleIndex < 0) throw new RangeError(`cadence-key-store: handle-index out of range: ${handleIndex}`);
  return `cadence-key-h${handleIndex}-${cadenceKeyName(verifyingKey)}.bin`;
}

/** The row standing for `verifyingKey`, in whichever face minted it: the file name carries that face's handle index. Names alone; null where none. */
function heldCadenceFile(verifyingKey: string): string | null {
  const name = cadenceKeyName(verifyingKey);
  let names: string[];
  try { names = faceFileNames(larIdentityDir()); } catch { return null; }
  return names.find((f) => CADENCE_KEY_FILE.exec(f)?.[2] === name) ?? null;
}

function keyOf(secret: Uint8Array) {
  const der = Buffer.concat([PKCS8_ED25519, secret]);
  try { return createPrivateKey({ key: der, format: "der", type: "pkcs8" }); } finally { der.fill(0); }
}
function publicOf(secret: Uint8Array): string {
  return Buffer.from((createPublicKey(keyOf(secret)).export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
}

/** Whether this vessel holds a row for `verifyingKey`. Reads names alone: it opens nothing and answers at the floor. */
export function heldCadenceKey(verifyingKey: string): boolean {
  return heldCadenceFile(verifyingKey) !== null;
}

/**
 * Mint a cadence key and its next key at random on this device, seal them as one row, and answer the public material
 * a founding commits: the key, and its next key's digest. Both secrets live in this call alone and zero-fill before it
 * returns. A row that already stands under the minted name refuses untouched.
 */
export async function mintCadenceKey(handleIndex: number): Promise<CadenceHolder> {
  const secret = new Uint8Array(ROW_BYTES);
  try {
    randomFillSync(secret);
    const key = publicOf(secret.subarray(0, 32));
    const next = cadenceNextDigest(publicOf(secret.subarray(32)));
    const file = cadenceKeyFile(handleIndex, key);
    await updateColdCustodyRow("identity", file, (bytes) => {
      if (bytes !== null) throw new CustodyRowUnavailable("identity", file, "names-another-key");
      return { plaintext: secret, value: undefined };
    });
    return { key, next };
  } finally { secret.fill(0); }
}

/** The cadence key's door: its cold row opens for this one signature over exactly `image`. Answers lower hex. */
export async function signAsCadence(verifyingKey: string, image: Uint8Array): Promise<string> {
  const key = assertKey(verifyingKey);
  const file = heldCadenceFile(key);
  if (file === null) {
    await openedCustody();
    throw new CustodyRowUnavailable("identity", `cadence-key-${cadenceKeyName(key)}`, "absent");
  }
  return openColdCustodyRow("identity", file, (secret) => {
    if (secret.length !== ROW_BYTES) throw new CustodyRowUnavailable("identity", file, "malformed");
    const own = secret.subarray(0, 32);
    if (publicOf(own) !== key) throw new CustodyRowUnavailable("identity", file, "names-another-key");
    return Buffer.from(sign(null, Buffer.from(image), keyOf(own))).toString("hex");
  });
}

/**
 * Retire one cadence key a founding never seated: its row leaves, and this answers whether one stood. Only a row
 * whose own bytes answer the key asked for leaves; any other stays and refuses by name.
 */
export async function retireCadenceKey(verifyingKey: string): Promise<boolean> {
  const key = assertKey(verifyingKey);
  const file = heldCadenceFile(key);
  if (file === null) { await openedCustody(); return false; }
  let reading: "malformed" | "names-another-key" | null = null;
  const left = await removeColdCustodyRow("identity", file, (secret) => {
    reading = secret.length !== ROW_BYTES ? "malformed" : publicOf(secret.subarray(0, 32)) !== key ? "names-another-key" : null;
    return reading === null;
  });
  if (reading !== null) throw new CustodyRowUnavailable("identity", file, reading);
  return left;
}
