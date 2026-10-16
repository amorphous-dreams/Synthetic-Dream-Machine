/**
 * sealed-carriage — the application frames that ride a sealed channel once the gate seat opens.
 *
 * The handshake owns tags 0x01–0x13 and nothing past it. Once the seat opens, every plaintext frame a side
 * seals leads with SEALED_FRAME_VERSION and a fixed header:
 *
 *   version u8 · kind u8 · messageId u32 BE · partIndex u16 BE · partCount u16 BE · totalLength u32 BE · body
 *
 * A writer cuts one message into parts: every part but the last carries a full body, so one Noise message
 * holds header, body and tag with no byte to spare. A reader joins the parts back, in order, while several
 * messages interleave, and refuses by name: a missing, duplicate, mixed-kind, overlong or post-close part
 * spends the reader, and the caller closes the channel.
 *
 * BOUNDS. One message holds at most SEALED_MESSAGE_MAX_BYTES; at most SEALED_CONCURRENT_MAX messages stand
 * begun and unfinished at once; their declared totals sum to at most SEALED_BUFFER_MAX_BYTES. A reader may
 * tighten each bound and never loosen one; a concurrent or buffer bound of zero throws, since it would refuse
 * every multi-part message. A one-part message ends in the push that begins it and buffers nothing, so it
 * takes no concurrent slot and no declared bytes: a `control/close` still lands while the reader stands full.
 *
 * Pure: no key, no socket, no clock and no randomness. A caller seals each frame with NoiseTransport.send.seal
 * and hands each opened frame to the reader.
 *
 * Canon: operator house ruling "Frames after open".
 */
import { NOISE_MAX_MESSAGE_BYTES } from "./noise-ik.js";

/** The first byte of every application frame; it stands outside the handshake's tags 0x01–0x13. */
export const SEALED_FRAME_VERSION = 0x80;
/** The kinds a message rides under: a session, a sync, or a named control. */
export const SEALED_KINDS = Object.freeze({ session: 0x01, sync: 0x02, "control/close": 0x10, "control/announce": 0x11 } as const);
export type SealedKind = keyof typeof SEALED_KINDS;
/** version u8 · kind u8 · messageId u32 · partIndex u16 · partCount u16 · totalLength u32, big-endian. */
export const SEALED_HEADER_BYTES = 14;
/** The Noise AEAD tag each sealed frame carries. */
export const SEALED_SEAL_OVERHEAD = 16;
/** The most body bytes one part holds: the Noise bound less the tag and the header. */
export const SEALED_PART_BODY_MAX = NOISE_MAX_MESSAGE_BYTES - SEALED_SEAL_OVERHEAD - SEALED_HEADER_BYTES;
/** The most bytes one message holds. */
export const SEALED_MESSAGE_MAX_BYTES = 16 * 1024 * 1024;
/** The most messages begun and not yet ended, at once. */
export const SEALED_CONCURRENT_MAX = 8;
/** The most declared bytes summed over messages in flight. */
export const SEALED_BUFFER_MAX_BYTES = 32 * 1024 * 1024;

const U32_MAX = 0xffffffff;

export interface SealedMessage { readonly kind: SealedKind; readonly messageId: number; readonly bytes: Uint8Array }

const KIND_OF_BYTE: ReadonlyMap<number, SealedKind> = new Map(
  (Object.entries(SEALED_KINDS) as [SealedKind, number][]).map(([name, byte]) => [byte, name]),
);
const kindByte = (kind: SealedKind): number => {
  if (typeof kind !== "string" || !Object.prototype.hasOwnProperty.call(SEALED_KINDS, kind)) {
    throw new RangeError("sealed-carriage: an unknown kind");
  }
  return SEALED_KINDS[kind];
};
const isU32 = (n: number): boolean => Number.isInteger(n) && n >= 0 && n <= U32_MAX;
/** How many parts a message of `total` bytes rides in. */
const partsFor = (total: number): number => Math.max(1, Math.ceil(total / SEALED_PART_BODY_MAX));

/**
 * Cut one message into plaintext frames. Every part but the last carries exactly SEALED_PART_BODY_MAX body
 * bytes; an empty message rides one part with an empty body. Throws RangeError past SEALED_MESSAGE_MAX_BYTES,
 * for an unknown kind, or for a messageId outside u32.
 */
export function sealedParts(kind: SealedKind, messageId: number, bytes: Uint8Array): Uint8Array[] {
  const kb = kindByte(kind);
  if (!isU32(messageId)) throw new RangeError("sealed-carriage: a message id outside u32");
  if (!(bytes instanceof Uint8Array)) throw new TypeError("sealed-carriage: a message carries bytes");
  if (bytes.length > SEALED_MESSAGE_MAX_BYTES) throw new RangeError("sealed-carriage: a message outgrew its bound");
  const count = partsFor(bytes.length);
  const frames: Uint8Array[] = [];
  for (let index = 0; index < count; index++) {
    const body = bytes.subarray(index * SEALED_PART_BODY_MAX, (index + 1) * SEALED_PART_BODY_MAX);
    const frame = new Uint8Array(SEALED_HEADER_BYTES + body.length);
    const view = new DataView(frame.buffer);
    view.setUint8(0, SEALED_FRAME_VERSION);
    view.setUint8(1, kb);
    view.setUint32(2, messageId);
    view.setUint16(6, index);
    view.setUint16(8, count);
    view.setUint32(10, bytes.length);
    frame.set(body, SEALED_HEADER_BYTES);
    frames.push(frame);
  }
  return frames;
}

/** The writer spent every message id a u32 names: the channel that holds it must close. */
export class SealedIdsSpent extends RangeError {
  override readonly name = "SealedIdsSpent";
  constructor() { super("sealed-carriage: message ids ran out; close the channel"); }
}

/**
 * A writer that numbers its messages: ids start at `firstId` (0 unless a caller names one) and climb by one.
 * Past 0xffffffff it throws `SealedIdsSpent`, and the channel must close. A cut that throws spends no id.
 */
export function sealedWriter(firstId = 0): { parts(kind: SealedKind, bytes: Uint8Array): Uint8Array[] } {
  if (!isU32(firstId)) throw new RangeError("sealed-carriage: a first id outside u32");
  let next = firstId;
  return {
    parts(kind, bytes) {
      if (next > U32_MAX) throw new SealedIdsSpent();
      const frames = sealedParts(kind, next, bytes);
      next += 1;
      return frames;
    },
  };
}

export const SEALED_REFUSALS = [
  "closed",              // a part after close(), or after an earlier refusal spent the reader
  "handshake-tag",       // first byte in 0x01–0x13: a handshake frame after open
  "version-foreign",     // any other first byte than SEALED_FRAME_VERSION
  "header-short",        // fewer bytes than the header
  "kind-foreign",        // a kind byte outside SEALED_KINDS
  "part-overlong",       // a body longer than SEALED_PART_BODY_MAX
  "total-overlong",      // totalLength past the message bound
  "count-mismatch",      // a count that the total does not name, an index past the count, or a count/total that shifts
  "kind-mixed",          // a later part under another kind than its first
  "part-duplicate",      // a partIndex already received for this message
  "part-missing",        // a partIndex past the next expected one (parts ride in order)
  "part-short",          // a non-last part short of a full body, or a last part that leaves the total unmet or exceeded
  "id-stale",            // a new message whose id does not exceed every id begun before
  "orphan-part",         // partIndex > 0 for a message never begun
  "concurrent-overflow", // beginning a multi-part message while the concurrent bound stands full
  "buffer-overflow",     // beginning a multi-part message whose total would lift the in-flight sum past the buffer bound
] as const;
export type SealedRefusal = (typeof SEALED_REFUSALS)[number];

export interface SealedReader {
  /** One plaintext frame (already opened). Answers the whole message when its last part lands, null while parts
   *  still arrive, or a refusal. Any refusal spends the reader: every later push answers { refusal: "closed" }. */
  push(frame: Uint8Array): SealedMessage | null | { readonly refusal: SealedRefusal };
  /** Close the reader: it drops every partial message and reports how many stood unfinished. Idempotent. */
  close(): { readonly unfinished: number };
  /** True once closed or spent by a refusal. */
  readonly closed: boolean;
  /** Messages begun and not yet ended. */
  readonly inFlight: number;
}

interface Partial {
  readonly kind: number;
  readonly count: number;
  readonly total: number;
  readonly bodies: Uint8Array[];
  next: number;
  received: number;
}

/** Clamp a caller's bound to the module's own. `floor` 1 marks a bound whose zero would refuse every
 *  multi-part message: that reads as misconfiguration, and throws. */
const tighten = (name: string, given: number | undefined, ceiling: number, floor: 0 | 1): number => {
  if (given === undefined) return ceiling;
  if (!Number.isInteger(given) || given < floor) throw new RangeError(`sealed-carriage: bound ${name} names no sensible count`);
  return Math.min(given, ceiling);
};

/** A reader that joins parts back into messages, under bounds a caller may only tighten. */
export function sealedReader(bounds?: { readonly concurrent?: number; readonly bufferBytes?: number; readonly messageBytes?: number }): SealedReader {
  const concurrentMax = tighten("concurrent", bounds?.concurrent, SEALED_CONCURRENT_MAX, 1);
  const bufferMax = tighten("bufferBytes", bounds?.bufferBytes, SEALED_BUFFER_MAX_BYTES, 1);
  const messageMax = tighten("messageBytes", bounds?.messageBytes, SEALED_MESSAGE_MAX_BYTES, 0);

  const open = new Map<number, Partial>();
  let declared = 0;
  let highest = -1;
  let spent = false;

  const refuse = (refusal: SealedRefusal): { readonly refusal: SealedRefusal } => {
    spent = true;
    return Object.freeze({ refusal });
  };

  const read = (frame: Uint8Array): SealedMessage | null | { readonly refusal: SealedRefusal } => {
    if (!(frame instanceof Uint8Array) || frame.length < 1) return refuse("header-short");
    const first = frame[0]!;
    if (first >= 0x01 && first <= 0x13) return refuse("handshake-tag");
    if (first !== SEALED_FRAME_VERSION) return refuse("version-foreign");
    if (frame.length < SEALED_HEADER_BYTES) return refuse("header-short");

    const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    const kind = view.getUint8(1);
    const id = view.getUint32(2);
    const index = view.getUint16(6);
    const count = view.getUint16(8);
    const total = view.getUint32(10);
    const body = frame.subarray(SEALED_HEADER_BYTES);
    const kindName = KIND_OF_BYTE.get(kind);

    if (kindName === undefined) return refuse("kind-foreign");
    if (body.length > SEALED_PART_BODY_MAX) return refuse("part-overlong");
    if (total > messageMax) return refuse("total-overlong");
    if (count !== partsFor(total) || index >= count) return refuse("count-mismatch");

    let message = open.get(id);
    if (message !== undefined) {
      if (message.kind !== kind) return refuse("kind-mixed");
      if (message.count !== count || message.total !== total) return refuse("count-mismatch");
      if (index < message.next) return refuse("part-duplicate");
      if (index > message.next) return refuse("part-missing");
    } else {
      if (index > 0) return refuse("orphan-part");
      if (id <= highest) return refuse("id-stale");
      // A one-part message ends in the push that begins it and buffers nothing: it takes no slot and no bytes.
      if (count > 1 && open.size >= concurrentMax) return refuse("concurrent-overflow");
      if (count > 1 && declared + total > bufferMax) return refuse("buffer-overflow");
    }

    const last = index === count - 1;
    const received = (message?.received ?? 0) + body.length;
    if (last ? received !== total : body.length !== SEALED_PART_BODY_MAX) return refuse("part-short");

    if (message === undefined && last) {
      highest = id;
      return Object.freeze({ kind: kindName, messageId: id, bytes: body.slice() });
    }
    if (message === undefined) {
      message = { kind, count, total, bodies: [], next: 0, received: 0 };
      open.set(id, message);
      declared += total;
      highest = id;
    }
    message.bodies.push(body.slice());
    message.received = received;
    message.next = index + 1;
    if (!last) return null;

    open.delete(id);
    declared -= total;
    const bytes = new Uint8Array(total);
    let at = 0;
    for (const part of message.bodies) { bytes.set(part, at); at += part.length; }
    return Object.freeze({ kind: kindName, messageId: id, bytes });
  };

  return {
    push(frame) {
      if (spent) return Object.freeze({ refusal: "closed" as const });
      return read(frame);
    },
    close() {
      spent = true;
      const unfinished = open.size;
      open.clear();
      declared = 0;
      return Object.freeze({ unfinished });
    },
    get closed() { return spent; },
    get inFlight() { return open.size; },
  };
}
