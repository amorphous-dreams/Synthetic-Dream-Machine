/**
 * sealed-store-rest — where lockboxes, signed records and the chunk index's rows rest, and how a vessel
 * finds them again.
 *
 * NOTHING HERE HOLDS A SECRET, A NAME OR A KEY IN THE CLEAR. A lockbox holds key-shore ciphertext and opaque
 * ids. A record holds a clear part of opaque ids and a sealed part. An index row holds opaque ids and
 * addresses. So they rest as plain bytes, beside the sealed values, and a carrier may hold every one.
 *
 * EVERY NAME DERIVES FROM ITS OWN BYTES. A name ends in a digest of the value it names (the first sixteen
 * bytes of its SHA-256), a write lands whole and once, and a value that no longer matches its name reads as
 * absent. The digest names a resting value; it authorizes nothing, and every name fits one file name
 * (255 characters). A restart therefore
 * finds what a vessel held and no second copy of it. The one exception, `own`, holds a vessel's local notes:
 * an opaque id under an opaque name, where the latest write replaces.
 *
 * THE OUTBOX ALONE STAYS ON ITS VESSEL, AND RESTS SEALED. A parcel carries the key shore's public operations,
 * which name reader identifiers, so it rides the member lane and never a carrier. A parcel a vessel wrapped rests in
 * its outbox until that lane takes it, sealed whole under the vessel's OUTBOX KEY (XChaCha20-Poly1305, a fresh
 * nonce per seal), with its reader inside the sealed body and a random lead in its name. A locked disk therefore
 * names no reader: a holder of it counts the parcels and weighs each, and opens none. A parcel lands by one whole
 * write under its final name (`put`), so before that commit nothing lists and after it the parcel opens again at
 * every unlock that hands back the same key.
 *
 * A HOLDER OF NO KEY ANSWERS FROM NAMES ALONE. A lockbox's name leads with its key version and its bag
 * locator; an index row's name leads with the locator, the key version and the entry locator. `heldNames`
 * lists what rests for a locator, and for a version under it, and reads no value.
 *
 * A ROW AUTHORIZES NOTHING. An address opens only through the verified manifest a row names
 * (`sealed-records` `authorizeFromManifest`), so a row altered at rest finds no entry and opens no byte.
 *
 * Platform-blind: a platform answers `SealedStoreRest` (the node answers it over files).
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalJson, defaultCryptoProvider, hex, hexToBytes, utf8Bytes, type RandomProvider } from "./crypto.js";
import {
  SEALED_INDEX_ROW_DOMAIN, SEALED_LOCKBOX_RECORD_DOMAIN, SEALED_OUTBOX_KEY_INFO, SEALED_OUTBOX_PARCEL_DOMAIN, SEALED_RECORD_REST_DOMAIN,
} from "./domains.js";
import { isChunkRole, readKeyVersionId, readSealedAddress, readSealedImage, sealedImage, type KeyVersionId, type SealedAddress } from "./sealed-chunk.js";
import {
  RECORD_KINDS, readBagLocator, readRecordId, recordIdOf,
  type BagLocator, type LockboxRecord, type RecordBodies, type RecordId, type RecordKind, type SealedChunkIndexRow, type SealedRecord,
} from "./sealed-records.js";

// ── The port ────────────────────────────────────────────────────────────────────────────────────
/** One kind per record kind (by the same word), plus the lockboxes, the index rows, the vessel's own notes and
 *  its outbox of parcels for the member lane. */
export const REST_KINDS = ["lockbox", ...RECORD_KINDS, "index", "own", "outbox"] as const;
export type RestKind = (typeof REST_KINDS)[number];
export function isRestKind(value: unknown): value is RestKind { return (REST_KINDS as readonly unknown[]).includes(value); }

/** The port a platform answers. It holds no secret. */
export interface SealedStoreRest {
  /** Write `bytes` whole under `name`. For every kind but `own`, a name that already rests keeps the bytes it
   *  holds while they still hash to the digest the name ends in (`restNameHolds`); bytes altered at rest give
   *  way to bytes that prove themselves, and to no others. For `own`, the latest write replaces. */
  put(kind: RestKind, name: string, bytes: Uint8Array): Promise<void>;
  get(kind: RestKind, name: string): Promise<Uint8Array | null>;
  /** The names of one kind that start with `prefix` (every name where absent), sorted ascending. */
  list(kind: RestKind, prefix?: string): Promise<readonly string[]>;
}

const REST_NAME = /^[0-9a-z][0-9a-z.-]{0,254}$/;
/** A name a rest may hold: lower-case letters, digits, dots and dashes, 255 characters at most (one file
 *  name on every platform); no separator, no upper case, no leading dot. */
export function isRestName(value: unknown): value is string { return typeof value === "string" && REST_NAME.test(value); }
function requireName(kind: unknown, name: unknown): void {
  if (!isRestKind(kind)) throw new TypeError("sealed-store-rest: an unknown rest kind names no shelf");
  if (!isRestName(name)) throw new TypeError("sealed-store-rest: a rest name holds lower-case letters, digits, dots and dashes alone");
}

/** Do `bytes` hash to the digest `name` ends in? Every name but an `own` note ends in one. */
export function restNameHolds(name: string, bytes: Uint8Array): boolean { return name.endsWith(`.${restDigest(bytes)}`); }

/** A rest held in memory: the same rule as any other, for a vessel with no disk and for vectors. */
export function memorySealedStoreRest(): SealedStoreRest {
  const shelves = new Map<RestKind, Map<string, Uint8Array>>();
  const shelfOf = (kind: RestKind): Map<string, Uint8Array> => {
    let shelf = shelves.get(kind);
    if (!shelf) { shelf = new Map(); shelves.set(kind, shelf); }
    return shelf;
  };
  return {
    async put(kind, name, bytes) {
      requireName(kind, name);
      const shelf = shelfOf(kind);
      const resting = shelf.get(name);
      if (kind !== "own" && resting !== undefined && (restNameHolds(name, resting) || !restNameHolds(name, bytes))) return;
      shelf.set(name, Uint8Array.from(bytes));
    },
    async get(kind, name) {
      requireName(kind, name);
      const bytes = shelfOf(kind).get(name);
      return bytes === undefined ? null : Uint8Array.from(bytes);
    },
    async list(kind, prefix = "") {
      if (!isRestKind(kind)) throw new TypeError("sealed-store-rest: an unknown rest kind names no shelf");
      return [...shelfOf(kind).keys()].filter((name) => name.startsWith(prefix)).sort();
    },
  };
}

// ── Codecs: one canonical image each ────────────────────────────────────────────────────────────
const utf8 = (bytes: Uint8Array): string => new TextDecoder("utf-8", { fatal: true }).decode(bytes);
const listField = (members: readonly Uint8Array[]): Uint8Array => sealedImage("", ...members);
/** Read a list field back: an image under the empty name, with any count of members. */
function readListField(bytes: Uint8Array): Uint8Array[] | null {
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

/** A lockbox as it rests and travels. Throws on a lockbox that reads malformed. */
export function encodeLockboxRecord(record: LockboxRecord): Uint8Array {
  if (typeof record !== "object" || record === null || readBagLocator(record.bag) === null || readKeyVersionId(record.keyVersion) === null
    || record.wrap !== "keyhive" || !(record.box instanceof Uint8Array) || record.box.length === 0) {
    throw new TypeError("sealed-store-rest: a lockbox names a bag locator, a key version, its wrap and a box");
  }
  return sealedImage(SEALED_LOCKBOX_RECORD_DOMAIN, hexToBytes(record.bag), hexToBytes(record.keyVersion), utf8Bytes(record.wrap), record.box);
}
export function readLockboxRecord(bytes: unknown): LockboxRecord | null {
  try {
    const fields = readSealedImage(SEALED_LOCKBOX_RECORD_DOMAIN, bytes, 4);
    if (fields === null || fields[0]!.length !== 32 || fields[1]!.length !== 32 || fields[3]!.length === 0) return null;
    if (utf8(fields[2]!) !== "keyhive") return null;
    return { bag: hex(fields[0]!) as BagLocator, keyVersion: hex(fields[1]!) as KeyVersionId, wrap: "keyhive", box: fields[3]! };
  } catch { return null; }
}

/** A signed record as it rests and travels: its kind, its clear part and its sealed part. Throws on a clear
 *  part its kind refuses. */
export function encodeCarriedRecord(record: SealedRecord): Uint8Array {
  if (typeof record !== "object" || record === null || !(record.sealed instanceof Uint8Array) || record.sealed.length === 0) {
    throw new TypeError("sealed-store-rest: a carried record holds a kind, a clear part and a sealed part");
  }
  recordIdOf(record.kind, record.body);
  return sealedImage(SEALED_RECORD_REST_DOMAIN, utf8Bytes(record.kind), utf8Bytes(canonicalJson(record.body)), record.sealed);
}
/** Read a carried record's shape: a known kind, a clear part its kind accepts in its one canonical spelling,
 *  and a sealed part. Its signature and its standing belong to `readRecord`. */
export function readCarriedRecord(bytes: unknown): SealedRecord | null {
  try {
    const fields = readSealedImage(SEALED_RECORD_REST_DOMAIN, bytes, 3);
    if (fields === null || fields[2]!.length === 0) return null;
    const kind = utf8(fields[0]!);
    if (!(RECORD_KINDS as readonly string[]).includes(kind)) return null;
    const spelled = utf8(fields[1]!);
    const body = JSON.parse(spelled) as RecordBodies[RecordKind];
    recordIdOf(kind as RecordKind, body);
    if (canonicalJson(body) !== spelled) return null;
    return { kind: kind as RecordKind, body, sealed: fields[2]! };
  } catch { return null; }
}

/** One row of the chunk index as it rests. Throws on a row that reads malformed. */
export function encodeIndexRow(row: SealedChunkIndexRow): Uint8Array {
  if (readIndexRowFields(row) === null) throw new TypeError("sealed-store-rest: an index row names a bag locator, a key version, a role, an address, an entry locator, its parents and a manifest");
  return sealedImage(SEALED_INDEX_ROW_DOMAIN, hexToBytes(row.bag), hexToBytes(row.keyVersion), utf8Bytes(row.role), utf8Bytes(row.address),
    hexToBytes(row.locator), listField(row.parents.map((parent) => utf8Bytes(parent))), hexToBytes(row.manifest));
}
/** A row's fields, each through its own reader: parents unique and ascending, and none under a blob. */
function readIndexRowFields(row: SealedChunkIndexRow): SealedChunkIndexRow | null {
  if (typeof row !== "object" || row === null || !Array.isArray(row.parents)) return null;
  const bag = readBagLocator(row.bag), keyVersion = readKeyVersionId(row.keyVersion), address = readSealedAddress(row.address), manifest = readRecordId(row.manifest);
  if (bag === null || keyVersion === null || address === null || manifest === null || !isChunkRole(row.role) || readKeyVersionId(row.locator) === null) return null;
  const parents: SealedAddress[] = [];
  for (const member of row.parents) {
    const parent = readSealedAddress(member);
    if (parent === null || (parents.length > 0 && !(parents[parents.length - 1]! < parent))) return null;
    parents.push(parent);
  }
  if (row.role === "blob" && parents.length > 0) return null;
  return { bag, keyVersion, role: row.role, address, locator: row.locator, parents, manifest };
}
export function readIndexRow(bytes: unknown): SealedChunkIndexRow | null {
  try {
    const fields = readSealedImage(SEALED_INDEX_ROW_DOMAIN, bytes, 7);
    if (fields === null || fields[0]!.length !== 32 || fields[1]!.length !== 32 || fields[4]!.length !== 32 || fields[6]!.length !== 32) return null;
    const parents = readListField(fields[5]!);
    if (parents === null) return null;
    return readIndexRowFields({
      bag: hex(fields[0]!) as BagLocator, keyVersion: hex(fields[1]!) as KeyVersionId, role: utf8(fields[2]!) as SealedChunkIndexRow["role"],
      address: utf8(fields[3]!) as SealedAddress, locator: hex(fields[4]!), parents: parents.map((parent) => utf8(parent) as SealedAddress),
      manifest: hex(fields[6]!) as RecordId,
    });
  } catch { return null; }
}

// ── Names ───────────────────────────────────────────────────────────────────────────────────────
/** The tail of a resting value's name: lower-case hex of the first sixteen bytes of its SHA-256. */
export function restDigest(bytes: Uint8Array): string { return hex(sha256(bytes).slice(0, 16)); }
/** `<key version>.<bag locator>.<digest>`: a version's lockboxes list by prefix. */
export function lockboxNameOf(record: LockboxRecord): string { return `${record.keyVersion}.${record.bag}.${restDigest(encodeLockboxRecord(record))}`; }
/** `<record id>.<digest>`: two unlike sealed parts under one record id rest side by side. */
export function recordNameOf(record: SealedRecord): string { return `${recordIdOf(record.kind, record.body)}.${restDigest(encodeCarriedRecord(record))}`; }
/** `<bag locator>.<key version>.<entry locator>.<digest>`: an entry's rows list by prefix. */
export function indexRowNameOf(row: SealedChunkIndexRow): string { return `${row.bag}.${row.keyVersion}.${row.locator}.${restDigest(encodeIndexRow(row))}`; }

// ── The outbox's seal ───────────────────────────────────────────────────────────────────────────
declare const outboxKeyBrand: unique symbol;
/** The OUTBOX KEY: 32 random bytes, minted once per vessel, resting under the vessel key and handed to the daemon
 *  island at unlock. No key derives it, and it derives only its parcels' AEAD key. */
export type OutboxKey = Uint8Array & { readonly [outboxKeyBrand]: true };
export const OUTBOX_KEY_LENGTH = 32;
/** The magic that names the outbox seal: a scheme of the house family, so no tree key census reads it as its own. */
export const OUTBOX_SEAL_MAGIC: Uint8Array = utf8Bytes("lares-outbox-seal");
const OUTBOX_NONCE_LENGTH = 24;
const OUTBOX_TAG_LENGTH = 16;
/** The random lead of an outbox name: sixteen bytes, as lower-case hex. */
const OUTBOX_NAME_LEAD = 16;

/** Mint a fresh outbox key. */
export function mintOutboxKey(rng: RandomProvider = defaultCryptoProvider): OutboxKey {
  return rng.getRandomValues(new Uint8Array(OUTBOX_KEY_LENGTH)) as OutboxKey;
}
/** Read 32 bytes back as an outbox key; null for any other width or type. */
export function readOutboxKey(bytes: unknown): OutboxKey | null {
  return bytes instanceof Uint8Array && bytes.length === OUTBOX_KEY_LENGTH ? (Uint8Array.from(bytes) as OutboxKey) : null;
}

/** The outbox holds shut: no unlock handed this island an outbox key, so no parcel seals and none opens. */
export class OutboxShut extends Error {
  override readonly name = "OutboxShut";
  constructor() { super("sealed-store-rest: the outbox holds shut — no unlock handed this vessel its outbox key, so no parcel seals or opens"); }
}

const bareReader = (reader: string): string => reader.trim().toLowerCase().replace(/^0x/, "");
const outboxAeadKey = (key: OutboxKey): Uint8Array => hkdf(sha256, key, new Uint8Array(0), utf8Bytes(SEALED_OUTBOX_KEY_INFO), 32);
const OUTBOX_AAD = utf8Bytes(SEALED_OUTBOX_PARCEL_DOMAIN);

/** Seal one parcel whole, its reader inside: `magic ‖ nonce(24) ‖ ciphertext‖tag(16)` under a fresh nonce. */
export function sealOutboxParcel(key: OutboxKey, reader: string, parcel: Uint8Array, rng: RandomProvider = defaultCryptoProvider): Uint8Array {
  if (readOutboxKey(key) === null) throw new TypeError("sealed-store-rest: an outbox key holds 32 bytes");
  const named = bareReader(reader);
  if (named.length === 0) throw new TypeError("sealed-store-rest: a parcel names its reader");
  const nonce = rng.getRandomValues(new Uint8Array(OUTBOX_NONCE_LENGTH));
  const ciphertext = xchacha20poly1305(outboxAeadKey(key), nonce, OUTBOX_AAD).encrypt(sealedImage(SEALED_OUTBOX_PARCEL_DOMAIN, utf8Bytes(named), parcel));
  const out = new Uint8Array(OUTBOX_SEAL_MAGIC.length + nonce.length + ciphertext.length);
  out.set(OUTBOX_SEAL_MAGIC, 0);
  out.set(nonce, OUTBOX_SEAL_MAGIC.length);
  out.set(ciphertext, OUTBOX_SEAL_MAGIC.length + nonce.length);
  return out;
}
/** Does `bytes` frame as an outbox seal (its magic over room for a nonce and a tag)? Reads no key. */
export function readsAsOutboxSeal(bytes: unknown): boolean {
  return bytes instanceof Uint8Array && bytes.length >= OUTBOX_SEAL_MAGIC.length + OUTBOX_NONCE_LENGTH + OUTBOX_TAG_LENGTH
    && OUTBOX_SEAL_MAGIC.every((b, i) => bytes[i] === b);
}
/** Open one sealed parcel; null on any failure (a wrong key, a moved byte, a malformed frame), naming none. */
export function openOutboxParcel(key: OutboxKey, bytes: unknown): { readonly reader: string; readonly parcel: Uint8Array } | null {
  if (readOutboxKey(key) === null || !readsAsOutboxSeal(bytes)) return null;
  const frame = bytes as Uint8Array;
  try {
    const nonce = frame.subarray(OUTBOX_SEAL_MAGIC.length, OUTBOX_SEAL_MAGIC.length + OUTBOX_NONCE_LENGTH);
    const plain = xchacha20poly1305(outboxAeadKey(key), nonce, OUTBOX_AAD).decrypt(frame.subarray(OUTBOX_SEAL_MAGIC.length + OUTBOX_NONCE_LENGTH));
    const fields = readSealedImage(SEALED_OUTBOX_PARCEL_DOMAIN, plain, 2);
    if (fields === null || fields[0]!.length === 0) return null;
    return { reader: utf8(fields[0]!), parcel: fields[1]! };
  } catch { return null; }
}

// ── The store ───────────────────────────────────────────────────────────────────────────────────
/** The store a vessel asks, over one rest. Every read checks a value against its own name. */
export class SealedStore {
  readonly #rest: SealedStoreRest;
  readonly #outboxKey: OutboxKey | null;
  readonly #rng: RandomProvider;
  /** `outboxKey`: the key an unlock handed this vessel's island; absent, the outbox stays shut (`OutboxShut`). */
  constructor(rest: SealedStoreRest, opts: { readonly outboxKey?: OutboxKey | null; readonly rng?: RandomProvider } = {}) {
    this.#rest = rest;
    this.#outboxKey = opts.outboxKey ?? null;
    this.#rng = opts.rng ?? defaultCryptoProvider;
  }

  /** A resting value whose bytes still hash to the digest its name ends in; null otherwise. */
  async #whole(kind: RestKind, name: string): Promise<Uint8Array | null> {
    const bytes = await this.#rest.get(kind, name);
    return bytes !== null && restNameHolds(name, bytes) ? bytes : null;
  }

  /** Rest one lockbox. Answers its name; the same lockbox again changes nothing. */
  async putLockbox(record: LockboxRecord): Promise<string> {
    const name = lockboxNameOf(record);
    await this.#rest.put("lockbox", name, encodeLockboxRecord(record));
    return name;
  }
  /** Every resting lockbox that reads whole and matches its name; `keyVersion` narrows by name prefix. */
  async lockboxes(keyVersion?: KeyVersionId): Promise<LockboxRecord[]> {
    const out: LockboxRecord[] = [];
    for (const name of await this.#rest.list("lockbox", keyVersion === undefined ? undefined : `${keyVersion}.`)) {
      const bytes = await this.#whole("lockbox", name);
      const record = bytes === null ? null : readLockboxRecord(bytes);
      if (record !== null && lockboxNameOf(record) === name) out.push(record);
    }
    return out;
  }

  /** Rest one signed record. Answers its id; two unlike byte strings of one id both rest. */
  async putRecord(record: SealedRecord): Promise<RecordId> {
    await this.#rest.put(record.kind, recordNameOf(record), encodeCarriedRecord(record));
    return recordIdOf(record.kind, record.body);
  }
  async #records<K extends RecordKind>(kind: K, prefix?: string): Promise<SealedRecord<K>[]> {
    const out: SealedRecord<K>[] = [];
    for (const name of await this.#rest.list(kind, prefix)) {
      const bytes = await this.#whole(kind, name);
      const record = bytes === null ? null : readCarriedRecord(bytes);
      if (record !== null && record.kind === kind && recordNameOf(record) === name) out.push(record as SealedRecord<K>);
    }
    return out;
  }
  /** Every resting copy under one id that reads whole, matches its name, and whose clear part re-derives the id. */
  record<K extends RecordKind>(kind: K, id: RecordId): Promise<SealedRecord<K>[]> {
    if (readRecordId(id) === null) return Promise.resolve([]);
    return this.#records(kind, `${id}.`);
  }
  records<K extends RecordKind>(kind: K): Promise<SealedRecord<K>[]> { return this.#records(kind); }

  async putIndexRows(rows: readonly SealedChunkIndexRow[]): Promise<void> {
    for (const row of rows) await this.#rest.put("index", indexRowNameOf(row), encodeIndexRow(row));
  }
  /** NAMES ALONE: what rests for a locator, and for a key version under it. Reads no value. */
  async heldNames(bag: BagLocator, keyVersion?: KeyVersionId): Promise<{ readonly lockboxes: readonly string[]; readonly rows: readonly string[] }> {
    if (readBagLocator(bag) === null || (keyVersion !== undefined && readKeyVersionId(keyVersion) === null)) return { lockboxes: [], rows: [] };
    const lockboxes = (await this.#rest.list("lockbox", keyVersion === undefined ? undefined : `${keyVersion}.`)).filter((name) => name.split(".")[1] === bag);
    const rows = await this.#rest.list("index", keyVersion === undefined ? `${bag}.` : `${bag}.${keyVersion}.`);
    return { lockboxes, rows };
  }
  async #rows(prefix: string): Promise<SealedChunkIndexRow[]> {
    const out: SealedChunkIndexRow[] = [];
    for (const name of await this.#rest.list("index", prefix)) {
      const bytes = await this.#whole("index", name);
      const row = bytes === null ? null : readIndexRow(bytes);
      // A row moved under another name keeps its digest and loses its place: its own fields must spell the name.
      if (row !== null && indexRowNameOf(row) === name) out.push(row);
    }
    return out;
  }
  /** The decoded rows of a locator, or of one key version under it. */
  rowsOf(bag: BagLocator, keyVersion?: KeyVersionId): Promise<SealedChunkIndexRow[]> {
    if (readBagLocator(bag) === null || (keyVersion !== undefined && readKeyVersionId(keyVersion) === null)) return Promise.resolve([]);
    return this.#rows(keyVersion === undefined ? `${bag}.` : `${bag}.${keyVersion}.`);
  }
  /** The rows one entry locator names under one key version. */
  rowsAt(bag: BagLocator, keyVersion: KeyVersionId, locator: string): Promise<SealedChunkIndexRow[]> {
    if (readBagLocator(bag) === null || readKeyVersionId(keyVersion) === null || readKeyVersionId(locator) === null) return Promise.resolve([]);
    return this.#rows(`${bag}.${keyVersion}.${locator}.`);
  }

  /** Seal one encoded parcel for the member lane under the outbox key, its reader inside the seal, and rest it
   *  under a random name by one whole write. Answers its name. Vessel-local: no carrier takes it. A shut outbox
   *  refuses (`OutboxShut`) before any byte moves. */
  async putOutbox(reader: string, parcel: Uint8Array): Promise<string> {
    const key = this.#openOutbox();
    const sealed = sealOutboxParcel(key, reader, parcel, this.#rng);
    const name = `${hex(this.#rng.getRandomValues(new Uint8Array(OUTBOX_NAME_LEAD)))}.${restDigest(sealed)}`;
    await this.#rest.put("outbox", name, sealed);
    return name;
  }
  /** The parcels that rest for one reader (every reader where absent): each opens under the outbox key and names its
   *  reader inside the seal, and the filter reads that name after the opening. A parcel that opens under no key this
   *  vessel holds, or whose bytes fail its name, lists nowhere. A shut outbox refuses (`OutboxShut`). */
  async outbox(reader?: string): Promise<{ readonly name: string; readonly reader: string; readonly parcel: Uint8Array }[]> {
    const key = this.#openOutbox();
    const wanted = reader === undefined ? undefined : bareReader(reader);
    const out: { name: string; reader: string; parcel: Uint8Array }[] = [];
    for (const name of await this.#rest.list("outbox")) {
      const sealed = await this.#whole("outbox", name);
      const opened = sealed === null ? null : openOutboxParcel(key, sealed);
      if (opened !== null && (wanted === undefined || opened.reader === wanted)) out.push({ name, ...opened });
    }
    return out;
  }
  #openOutbox(): OutboxKey {
    if (this.#outboxKey === null) throw new OutboxShut();
    return this.#outboxKey;
  }

  /** A vessel-local note: an opaque id under an opaque name. The latest write replaces. */
  noteOwn(name: string, bytes: Uint8Array): Promise<void> { return this.#rest.put("own", name, bytes); }
  own(name: string): Promise<Uint8Array | null> { return this.#rest.get("own", name); }
}
