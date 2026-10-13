/**
 * lockbox-wrap — one content key wrapped for the readers of one bag at one key version, and opened again.
 *
 * EACH LOCKBOX WRAPS INTO A KEY-GROUP DOCUMENT OF ITS OWN. The shore (`LockboxWrapShore`; Keyhive stands
 * behind it) mints a fresh document, seats exactly the readers the lockbox serves, and encrypts the payload
 * once under a content reference that cites no predecessor. That document takes no later member, so no
 * removal has to reach it and no later seat finds an earlier key in it.
 *
 * THE SHORE BINDS NO ASSOCIATED DATA, SO THE PAYLOAD'S OWN IMAGE BINDS THE LOCKBOX. The clear part of a
 * lockbox names a bag locator and a key version id; the payload names both again beside the bag's id and the
 * key. An opener refuses a payload whose locator or version differs from the clear part, so a box moved under
 * another lockbox's clear part refuses by name.
 *
 * THE BOX READS OPAQUE: the wrap document's id and the shore's ciphertext, and nothing else. The wrap's
 * public operations name its readers' identifiers; they travel the member lane alone, inside a PARCEL (one
 * lockbox, its key version record and those operations, for one reader), and never to a carrier.
 *
 * No bare key outlives a call here: the encoded payload gets overwritten once the shore took it, and an
 * opened payload's bytes get overwritten once its fields got read. Pure but for the reference's random draw.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-records (the lockbox)
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { defaultCryptoProvider, hexToBytes, type RandomProvider } from "./crypto.js";
import { SEALED_KEY_PARCEL_DOMAIN, SEALED_LOCKBOX_REF_INFO } from "./domains.js";
import { readKeyVersionId, readSealedImage, sealedImage } from "./sealed-chunk.js";
import {
  encodeLockboxPayload, readBagLocator, readLockboxPayload,
  type LockboxPayload, type LockboxRecord, type LockboxRefusalName, type SealedRecord,
} from "./sealed-records.js";
import { encodeCarriedRecord, encodeLockboxRecord, readCarriedRecord, readLockboxRecord } from "./sealed-store-rest.js";

/** A reader's name on the key shore: its Keyhive identifier, lower-case hex with or without `0x`. */
export type ReaderId = string;

/** What a lockbox asks of the key shore. Keyhive answers it (`@lararium/keyhive` `keyhive-lockbox`). */
export interface LockboxWrapShore {
  /**
   * Wrap `payload` into a FRESH key-group document that seats exactly `readers`, beside this vessel's own
   * seat, under the content reference `ref` and no predecessor. `served` names the readers it seated;
   * `unreached` names the readers it holds no contact card for. Throws where the wrap itself fails; a wrap
   * never answers a box some named reader got half-seated in.
   */
  wrap(args: { readonly readers: readonly ReaderId[]; readonly ref: Uint8Array; readonly payload: Uint8Array }):
    Promise<{ readonly box: Uint8Array; readonly served: readonly ReaderId[]; readonly unreached: readonly ReaderId[] }>;
  /** The payload a box holds, or null where no seat of this vessel opens it. Never throws for a box it cannot open. */
  unwrap(box: Uint8Array): Promise<Uint8Array | null>;
  /** The public operations `reader` needs before it opens what this vessel wrapped for it. Member lane alone. */
  opsFor(reader: ReaderId): Promise<readonly Uint8Array[]>;
  /** Take the public operations another vessel's wrap handed this one. */
  ingest(ops: readonly Uint8Array[]): Promise<void>;
  /** This vessel's own identifiers on the key shore. */
  self(): Promise<readonly ReaderId[]>;
}

export const WRAP_REFUSALS = ["payload-malformed", "wrap-failed"] as const;
export type WrapRefusalName = (typeof WRAP_REFUSALS)[number];
export interface WrappedLockbox {
  readonly lockbox:   LockboxRecord;
  readonly served:    readonly ReaderId[];
  /** Readers the vessel holds no contact card for: named, never silently dropped. */
  readonly unreached: readonly ReaderId[];
}

/** Wrap one payload for `readers`. Each call mints a wrap document and a content reference of its own. */
export async function wrapLockbox(args: {
  readonly payload: LockboxPayload; readonly readers: readonly ReaderId[]; readonly shore: LockboxWrapShore;
  readonly random?: Pick<RandomProvider, "getRandomValues">;
}): Promise<WrappedLockbox | { readonly refusal: WrapRefusalName; readonly cause?: string }> {
  let image: Uint8Array;
  try { image = encodeLockboxPayload(args.payload); } catch { return { refusal: "payload-malformed" }; }
  try {
    const draw = new Uint8Array(32);
    (args.random ?? defaultCryptoProvider).getRandomValues(draw);
    const ref = sha256(sealedImage(SEALED_LOCKBOX_REF_INFO, hexToBytes(args.payload.locator), hexToBytes(args.payload.keyVersion), draw));
    const wrapped = await args.shore.wrap({ readers: [...new Set(args.readers)], ref, payload: image });
    if (!(wrapped.box instanceof Uint8Array) || wrapped.box.length === 0) return { refusal: "wrap-failed", cause: "the shore answered no box" };
    const lockbox: LockboxRecord = Object.freeze({ bag: args.payload.locator, keyVersion: args.payload.keyVersion, wrap: "keyhive", box: wrapped.box });
    return { lockbox, served: Object.freeze([...wrapped.served]), unreached: Object.freeze([...wrapped.unreached]) };
  } catch (err) {
    // The cause names the shore's own words. It never names a key: the shore holds the payload as opaque bytes.
    return { refusal: "wrap-failed", cause: err instanceof Error ? err.message : String(err) };
  } finally {
    image.fill(0);
  }
}

export const OPEN_LOCKBOX_REFUSALS = ["lockbox-not-ours", "lockbox-record-malformed"] as const;
export type OpenLockboxRefusalName = LockboxRefusalName | (typeof OPEN_LOCKBOX_REFUSALS)[number];

/**
 * Open one lockbox. The payload must name the locator and the key version the clear part names, and its key
 * must recompute to that version under the bag the payload names. `expect` adds what the reader already
 * holds for the bag.
 */
export async function openLockbox(args: {
  readonly lockbox: unknown; readonly shore: LockboxWrapShore; readonly expect?: { readonly bagId?: string };
}): Promise<{ readonly payload: LockboxPayload } | { readonly refusal: OpenLockboxRefusalName }> {
  const record = readLockboxRecord(args.lockbox instanceof Uint8Array ? args.lockbox : encodeOrNull(args.lockbox));
  if (record === null) return { refusal: "lockbox-record-malformed" };
  let bytes: Uint8Array | null;
  try { bytes = await args.shore.unwrap(record.box); } catch { bytes = null; }
  if (bytes === null) return { refusal: "lockbox-not-ours" };
  try {
    return readLockboxPayload(bytes, { ...(args.expect?.bagId !== undefined ? { bagId: args.expect.bagId } : {}), locator: record.bag, keyVersion: record.keyVersion });
  } finally {
    bytes.fill(0);
  }
}
function encodeOrNull(value: unknown): Uint8Array | null {
  try { return encodeLockboxRecord(value as LockboxRecord); } catch { return null; }
}

// ── The parcel ──────────────────────────────────────────────────────────────────────────────────
/** What crosses the member lane to ONE reader for ONE key version: the lockbox, the key version record and
 *  the wrap's public operations. The operations name reader identifiers, so a parcel never rides to a carrier. */
export interface KeyParcel {
  readonly lockbox: LockboxRecord;
  readonly record:  SealedRecord<"key-version">;
  readonly ops:     readonly Uint8Array[];
}
export function encodeKeyParcel(parcel: KeyParcel): Uint8Array {
  return sealedImage(SEALED_KEY_PARCEL_DOMAIN, encodeLockboxRecord(parcel.lockbox), encodeCarriedRecord(parcel.record), sealedImage("", ...parcel.ops));
}
export function readKeyParcel(bytes: unknown): KeyParcel | null {
  try {
    const fields = readSealedImage(SEALED_KEY_PARCEL_DOMAIN, bytes, 3);
    if (fields === null) return null;
    const lockbox = readLockboxRecord(fields[0]!);
    const record = readCarriedRecord(fields[1]!);
    const ops = readList(fields[2]!);
    if (lockbox === null || record === null || record.kind !== "key-version" || ops === null) return null;
    const body = record.body as { bag?: unknown; keyVersion?: unknown };
    if (readBagLocator(body.bag) !== lockbox.bag || readKeyVersionId(body.keyVersion) !== lockbox.keyVersion) return null;
    return { lockbox, record: record as SealedRecord<"key-version">, ops };
  } catch { return null; }
}
/** Read a list field: an image with an empty name and any count of members. */
function readList(bytes: Uint8Array): Uint8Array[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [];
  let at = 0;
  while (at < bytes.length) {
    if (at + 4 > bytes.length) return null;
    const size = view.getUint32(at, false);
    if (at + 4 + size > bytes.length) return null;
    parts.push(bytes.slice(at + 4, at + 4 + size));
    at += 4 + size;
  }
  return parts.length >= 1 && parts[0]!.length === 0 ? parts.slice(1) : null;
}
