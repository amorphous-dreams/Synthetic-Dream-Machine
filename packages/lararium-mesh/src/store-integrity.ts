/**
 * store-integrity — L5b: the cheap integrity gate that STANDS IN FRONT of the Automerge
 * WASM load. It reads a persisted chunk's framing and rejects a TORN chunk BEFORE the
 * bytes reach WASM, where a corrupt length-prefix reads as a giant allocation and aborts
 * the whole runtime (`capacity_overflow` at automerge's `op_set2/op_set/index.rs` —
 * uncatchable in-process, upstream closed "not planned"). The bounds-check here turns
 * that abort into a catchable pre-check for the common torn-tail case, sparing the
 * child-process round-trip (L1).
 *
 * Isomorphic BY CONSTRUCTION — pure `Uint8Array` plus the platform-blind `sha256BytesSync`
 * (`@noble/hashes`, browser-shippable). The node daemon reads its blobs off nodefs; a
 * browser vessel reads the same blobs off IndexedDB; both feed identical bytes here.
 *
 * The Automerge binary chunk framing (per file, one or more concatenated chunks):
 *   magic     4 bytes   0x85 0x6f 0x4a 0x83
 *   checksum  4 bytes   first 4 bytes of sha256 over [type, length-varint, contents]
 *   type      1 byte    chunk kind (document / change / compressed-change / …)
 *   length    LEB128    unsigned varint — byte-count of the contents that follow
 *   contents  <length>  the chunk payload
 *
 * The load-bearing guard reads `length ≤ remaining`: a torn write garbles the length
 * varint, and automerge trusts it into `Vec::with_capacity(huge)`. This gate refuses it.
 * The checksum verification rides as a second gate — a mismatch gets reported, never used
 * to relax the bounds verdict.
 *
 * A SEALED VALUE AT REST READS SEALED, NEVER TORN. A document of a sealed bag rests no
 * Automerge byte: each stored value holds either the sealed document store's pointer
 * (`lares-sealed-value:` and the value's `blake3:` address, nothing after) or a sealed value
 * itself (the `sealed-chunk` format mark, its header, its tagged segments). The gate holds no
 * key, so it reads the envelope alone: a well-formed one reads sealed (no WASM ever loads
 * those bytes here); an envelope whose framing breaks reads torn, as any garbled chunk does.
 * What the key-less read catches: a cut or garbled pointer, a sealed value shorter than its
 * header and one tag, and a last segment of 1 to 15 bytes. A sealed value carries no length
 * field, so any other cut, and any bytes behind a whole mark and header, read sealed here: the
 * keyed load at mount decides those (`sealed` never mounts writable on this word alone).
 */

import { sha256BytesSync } from "./crypto.js";
import { bearsSealedMark, namesSealedPointer, readSealedAddress, SEALED_HEADER_LEN, SEALED_SEGMENT_LEN, SEALED_TAG_LEN, SEALED_VALUE_POINTER } from "./sealed-chunk.js";

const MAGIC = Uint8Array.from([0x85, 0x6f, 0x4a, 0x83]);
const MAGIC_LEN = 4;
const CHECKSUM_LEN = 4;
const MIN_HEADER = MAGIC_LEN + CHECKSUM_LEN + 1; // magic + checksum + type, ahead of the varint

/** A verdict on one file's framing. `ok=false` names a torn / malformed file. */
export interface IntegrityVerdict {
  readonly ok: boolean;
  /** count of well-framed chunks parsed ahead of any tear. */
  readonly chunks: number;
  /** present when ok=false — names why the framing fails. */
  readonly reason?: string;
  /** flags a chunk whose stored checksum disagreed with the recomputed one. */
  readonly checksumMismatch?: boolean;
  /** present when the file holds one well-formed sealed value at rest (pointer or sealed value): sound framing, inner
   *  bytes unread, since the gate holds no key. */
  readonly sealed?: true;
}

/** The sealed forms a stored value takes at rest. */
export type SealedAtRestForm = "pointer" | "sealed-value";

/**
 * Read one stored value's sealed-at-rest envelope with no key. Null: the bytes open with neither sealed form. A form
 * whose framing holds names itself; one whose framing breaks names why.
 *   pointer       the whole value reads as UTF-8 `lares-sealed-value:blake3:<64 hex>`, nothing after.
 *   sealed-value  the format mark, the whole header, and segments that close on a tag: every segment but the last
 *                 carries a full body and its tag, and the last carries at least its tag.
 */
export function readSealedAtRest(buf: Uint8Array): { readonly form: SealedAtRestForm } | { readonly malformed: string } | null {
  if (namesSealedPointer(buf)) {
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { return { malformed: "sealed pointer does not read as UTF-8 — torn" }; }
    return readSealedAddress(text.slice(SEALED_VALUE_POINTER.length)) !== null
      ? { form: "pointer" }
      : { malformed: `sealed pointer names no sealed address (${buf.length} bytes) — torn` };
  }
  if (bearsSealedMark(buf)) {
    if (buf.length < SEALED_HEADER_LEN + SEALED_TAG_LEN) return { malformed: `sealed value of ${buf.length} bytes holds no whole header and tag — torn` };
    const last = (buf.length - SEALED_HEADER_LEN) % (SEALED_SEGMENT_LEN + SEALED_TAG_LEN);
    return last === 0 || last >= SEALED_TAG_LEN
      ? { form: "sealed-value" }
      : { malformed: `sealed value's last segment holds ${last} bytes, short of its tag — torn` };
  }
  return null;
}

/**
 * Decode an unsigned LEB128 varint at `off`. Caps at 10 bytes (the 64-bit ceiling) so a
 * torn varint with every continuation bit set cannot spin. Returns null on run-off /
 * overlong — both name a tear.
 */
function readUvarint(buf: Uint8Array, off: number): { value: number; next: number } | null {
  let result = 0;
  let shift = 0;
  let i = off;
  for (let byteCount = 0; byteCount < 10; byteCount++) {
    if (i >= buf.length) return null; // runs off the end mid-varint → torn
    const b = buf[i++];
    if (b === undefined) return null;
    // Number keeps 53 bits of integer precision; a change length past 2^53 names a tear itself.
    result += (b & 0x7f) * 2 ** shift;
    if ((b & 0x80) === 0) return { value: result, next: i };
    shift += 7;
    if (shift > 56) return null; // overlong → torn
  }
  return null; // no terminator inside 10 bytes → torn
}

function hasMagic(buf: Uint8Array, off: number): boolean {
  return (
    buf[off] === MAGIC[0] &&
    buf[off + 1] === MAGIC[1] &&
    buf[off + 2] === MAGIC[2] &&
    buf[off + 3] === MAGIC[3]
  );
}

/**
 * Validate the chunk framing of one persisted blob. Walks every concatenated chunk,
 * checks the magic, decodes the length varint, and enforces `length ≤ remaining`.
 * Recomputes the checksum as a second gate (reports a mismatch, never overrides bounds).
 */
export function precheckChunkBytes(buf: Uint8Array): IntegrityVerdict {
  if (buf.length === 0) return { ok: false, chunks: 0, reason: "empty file (zero bytes) — torn write" };
  const sealed = readSealedAtRest(buf);
  if (sealed !== null) return "form" in sealed ? { ok: true, chunks: 1, sealed: true } : { ok: false, chunks: 0, reason: sealed.malformed };

  let off = 0;
  let chunks = 0;
  let checksumMismatch = false;

  while (off < buf.length) {
    if (buf.length - off < MIN_HEADER) {
      return { ok: false, chunks, reason: `trailing ${buf.length - off} bytes < chunk header — torn tail` };
    }
    if (!hasMagic(buf, off)) {
      return { ok: false, chunks, reason: `bad magic at offset ${off} — not an automerge chunk / corrupt` };
    }
    const checksumOff = off + MAGIC_LEN;
    const typeOff = checksumOff + CHECKSUM_LEN;
    const lenAt = readUvarint(buf, typeOff + 1);
    if (!lenAt) {
      return { ok: false, chunks, reason: `unreadable length varint at offset ${typeOff + 1} — torn` };
    }
    const contentsOff = lenAt.next;
    const contentsEnd = contentsOff + lenAt.value;
    // THE GUARD: a length that overruns the buffer names the capacity_overflow class.
    if (contentsEnd > buf.length) {
      return {
        ok: false,
        chunks,
        reason: `chunk length ${lenAt.value} overruns file (needs ${contentsEnd}, holds ${buf.length}) — torn write`,
      };
    }
    // Second gate: recompute the checksum over [type, length-varint, contents].
    const stored = buf.subarray(checksumOff, checksumOff + CHECKSUM_LEN);
    const digest = sha256BytesSync(buf.subarray(typeOff, contentsEnd));
    if (
      digest[0] !== stored[0] || digest[1] !== stored[1] ||
      digest[2] !== stored[2] || digest[3] !== stored[3]
    ) {
      checksumMismatch = true;
    }
    off = contentsEnd;
    chunks++;
  }

  if (checksumMismatch) {
    return { ok: false, chunks, reason: "chunk checksum mismatch — corrupt bytes", checksumMismatch: true };
  }
  return { ok: true, chunks };
}

/** One persisted blob of a doc's store dir, kind-tagged. */
export interface BlobRef {
  readonly kind: "snapshot" | "incremental";
  readonly name: string;
  readonly data: Uint8Array;
}

/** A single condemned file within a doc's store dir. */
export interface TornFile {
  readonly kind: "snapshot" | "incremental";
  readonly name: string;
  readonly reason: string;
}

/** A verdict on a whole doc's on-disk store. */
export interface StoreIntegrityReport {
  readonly documentId: string;
  readonly ok: boolean;
  readonly snapshots: number;
  readonly incrementals: number;
  /** files that hold a well-formed sealed value at rest (counted among the snapshots and incrementals). */
  readonly sealed: number;
  readonly torn: readonly TornFile[];
}

/**
 * Pre-check every snapshot + incremental blob of one doc. Pure over the supplied blobs —
 * the platform (nodefs / IndexedDB) reads them; this walks the framing. Snapshots verify
 * first (a torn base condemns the whole doc); a torn incremental condemns only the tail
 * from that record on (the clean-tail cut rides L3 — this surfaces the per-file verdicts).
 */
export function precheckBlobs(documentId: string, blobs: readonly BlobRef[]): StoreIntegrityReport {
  const torn: TornFile[] = [];
  let snapshots = 0;
  let incrementals = 0;
  let sealed = 0;

  for (const blob of blobs) {
    if (blob.kind === "snapshot") snapshots++; else incrementals++;
    const v = precheckChunkBytes(blob.data);
    if (!v.ok) torn.push({ kind: blob.kind, name: blob.name, reason: v.reason ?? "torn" });
    else if (v.sealed) sealed++;
  }

  return { documentId, ok: torn.length === 0, snapshots, incrementals, sealed, torn };
}

/**
 * L3 clean-tail partition — split ordered records at the FIRST tear. Everything ahead of the
 * tear is the verified-loadable clean prefix; the torn record and EVERY record after it form
 * the tail to move aside. A CUTOFF, not a filter: a tear signals the writer died mid-append,
 * so nothing past it is trusted (a later "clean" record could depend on the lost one). A torn
 * BASE (first record) yields an empty prefix → unrecoverable, the whole doc stays condemned.
 * Pure over the supplied ordered blobs — the caller reads them in load order (snapshot(s)
 * then incrementals), matching what the loader concatenates.
 */
export function partitionCleanTail(blobs: readonly BlobRef[]): { keep: BlobRef[]; tornTail: BlobRef[] } {
  const keep: BlobRef[] = [];
  const tornTail: BlobRef[] = [];
  let cut = false;
  for (const b of blobs) {
    if (cut || !precheckChunkBytes(b.data).ok) { cut = true; tornTail.push(b); }
    else keep.push(b);
  }
  return { keep, tornTail };
}
