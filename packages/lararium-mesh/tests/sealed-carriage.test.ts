/**
 * sealed-carriage vectors: the application frames that ride the sealed channel after the gate seat opens.
 *
 * Canon: operator house ruling "Frames after open".
 */
import { describe, expect, it } from "vitest";
import { NOISE_MAX_MESSAGE_BYTES, noiseInitiate, noiseKeyPair, noiseRespond } from "../src/noise-ik.js";
import {
  SEALED_BUFFER_MAX_BYTES, SEALED_CONCURRENT_MAX, SEALED_FRAME_VERSION, SEALED_HEADER_BYTES, SEALED_KINDS,
  SEALED_MESSAGE_MAX_BYTES, SEALED_PART_BODY_MAX, SEALED_REFUSALS, SEALED_SEAL_OVERHEAD,
  sealedParts, sealedReader, sealedWriter, type SealedKind, type SealedReader, type SealedRefusal,
} from "../src/sealed-carriage.js";

const MAX = SEALED_PART_BODY_MAX;
const filled = (n: number, seed = 7): Uint8Array => {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (i * 31 + seed) & 0xff;
  return out;
};
const toHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/** Compare a message by its fields and its bytes in one pass; a deep equal over megabytes crawls. */
function same(out: unknown, kind: SealedKind, messageId: number, bytes: Uint8Array): void {
  const m = out as { kind: SealedKind; messageId: number; bytes: Uint8Array };
  expect(m).not.toBeNull();
  expect(Object.keys(m).sort()).toEqual(["bytes", "kind", "messageId"]);
  expect([m.kind, m.messageId, m.bytes.length]).toEqual([kind, messageId, bytes.length]);
  expect(Buffer.from(m.bytes).equals(Buffer.from(bytes))).toBe(true);
  expect(Object.isFrozen(m)).toBe(true);
}

/** Write one header by hand, so a test can forge any field. */
function forge(f: { version?: number; kind?: number; id?: number; index?: number; count?: number; total?: number; body?: Uint8Array }): Uint8Array {
  const body = f.body ?? new Uint8Array(0);
  const frame = new Uint8Array(SEALED_HEADER_BYTES + body.length);
  const view = new DataView(frame.buffer);
  view.setUint8(0, f.version ?? SEALED_FRAME_VERSION);
  view.setUint8(1, f.kind ?? SEALED_KINDS.session);
  view.setUint32(2, f.id ?? 0);
  view.setUint16(6, f.index ?? 0);
  view.setUint16(8, f.count ?? 1);
  view.setUint32(10, f.total ?? body.length);
  frame.set(body, SEALED_HEADER_BYTES);
  return frame;
}

const reached = new Set<SealedRefusal>();
function refuses(reader: SealedReader, frame: Uint8Array, refusal: SealedRefusal): void {
  expect(reader.push(frame)).toEqual({ refusal });
  reached.add(refusal);
  // Any refusal spends the reader.
  expect(reader.push(forge({ id: 0xfffffff0 }))).toEqual({ refusal: "closed" });
  reached.add("closed");
}

function roundTrip(kind: SealedKind, bytes: Uint8Array): void {
  const frames = sealedWriter().parts(kind, bytes);
  const reader = sealedReader();
  frames.forEach((frame, i) => {
    const out = reader.push(frame);
    if (i < frames.length - 1) { expect(out).toBeNull(); expect(reader.inFlight).toBe(1); return; }
    same(out, kind, 0, bytes);
  });
  expect(reader.inFlight).toBe(0);
}

describe("sealed-carriage — layout", () => {
  it("names constants that sit outside the handshake tags and fit the Noise bound", () => {
    expect(SEALED_FRAME_VERSION).toBe(0x80);
    expect(SEALED_FRAME_VERSION > 0x13).toBe(true);
    expect(SEALED_HEADER_BYTES).toBe(14);
    expect(SEALED_SEAL_OVERHEAD).toBe(16);
    expect(MAX).toBe(65535 - 16 - 14);
    expect(SEALED_MESSAGE_MAX_BYTES).toBe(16 * 1024 * 1024);
    expect(SEALED_BUFFER_MAX_BYTES).toBe(32 * 1024 * 1024);
    expect(SEALED_CONCURRENT_MAX).toBe(8);
    expect(Object.isFrozen(SEALED_KINDS)).toBe(true);
  });

  it("freezes one header as a fixed byte vector", () => {
    const [frame] = sealedParts("sync", 0x01020304, Uint8Array.of(0xaa, 0xbb, 0xcc));
    expect(toHex(frame!)).toBe("80" + "02" + "01020304" + "0000" + "0001" + "00000003" + "aabbcc");
    const [ctl] = sealedParts("control/close", 0xffffffff, new Uint8Array(0));
    expect(toHex(ctl!)).toBe("8010ffffffff0000000100000000");
  });

  it("cuts every part but the last full, and an empty message into one empty part", () => {
    expect(sealedParts("session", 0, new Uint8Array(0)).map((f) => f.length)).toEqual([SEALED_HEADER_BYTES]);
    expect(sealedParts("session", 0, filled(MAX)).map((f) => f.length)).toEqual([SEALED_HEADER_BYTES + MAX]);
    expect(sealedParts("session", 0, filled(2 * MAX)).map((f) => f.length)).toEqual([SEALED_HEADER_BYTES + MAX, SEALED_HEADER_BYTES + MAX]);
    const big = sealedParts("session", 0, filled(3 * MAX + 7));
    expect(big.map((f) => f.length)).toEqual([MAX, MAX, MAX, 7].map((n) => n + SEALED_HEADER_BYTES));
    big.forEach((f, i) => { expect(f[7]).toBe(i); expect(f[9]).toBe(4); });
  });

  it("throws on an unknown kind, an id outside u32, and a message past its bound", () => {
    expect(() => sealedParts("control/nope" as SealedKind, 0, new Uint8Array(1))).toThrow(RangeError);
    expect(() => sealedParts("toString" as SealedKind, 0, new Uint8Array(1))).toThrow(RangeError);
    expect(() => sealedParts("session", -1, new Uint8Array(1))).toThrow(RangeError);
    expect(() => sealedParts("session", 0x100000000, new Uint8Array(1))).toThrow(RangeError);
    expect(() => sealedParts("session", 1.5, new Uint8Array(1))).toThrow(RangeError);
    expect(() => sealedParts("session", 0, new Uint8Array(SEALED_MESSAGE_MAX_BYTES + 1))).toThrow(RangeError);
    expect(sealedParts("session", 0, new Uint8Array(SEALED_MESSAGE_MAX_BYTES)).length).toBe(Math.ceil(SEALED_MESSAGE_MAX_BYTES / MAX));
  });

  it("a full part sealed through a real Noise transport stays within the Noise bound, and one byte more overflows", () => {
    const prologue = Uint8Array.of(9);
    const responder = noiseKeyPair(new Uint8Array(32).fill(0x21));
    const flight = noiseInitiate({ prologue, s: noiseKeyPair(new Uint8Array(32).fill(0x22)), rs: responder.publicKey });
    const answer = noiseRespond({ prologue, s: responder, message1: flight.message1 }).writeMessage2();
    const { transport } = flight.readMessage2(answer.message2);
    const [full] = sealedParts("session", 0, filled(MAX));
    const sealed = transport.send.seal(full!);
    expect(sealed.length).toBe(NOISE_MAX_MESSAGE_BYTES);
    expect(sealed.length + 1 > NOISE_MAX_MESSAGE_BYTES).toBe(true);
    const opened = answer.transport.receive.open(sealed);
    same(sealedReader().push(opened), "session", 0, filled(MAX));
  });
});

describe("sealed-carriage — round trips", () => {
  it("carries a CONTROL: an empty message", () => roundTrip("control/close", new Uint8Array(0)));
  it("carries a one-part message", () => roundTrip("session", filled(300)));
  it("carries an exact multiple of the part body", () => roundTrip("sync", filled(2 * MAX)));
  it("carries a large multi-part message", () => roundTrip("sync", filled(3 * MAX + 7)));
  it("carries a full message at the module bound", () => roundTrip("session", filled(SEALED_MESSAGE_MAX_BYTES, 3)));

  it("numbers a writer's messages from 0 upward", () => {
    const writer = sealedWriter();
    const reader = sealedReader();
    for (let i = 0; i < 3; i++) {
      const frames = writer.parts("control/announce", Uint8Array.of(i));
      expect(reader.push(frames[0]!)).toEqual({ kind: "control/announce", messageId: i, bytes: Uint8Array.of(i) });
    }
  });

  it("joins interleaved concurrent messages", () => {
    const writer = sealedWriter();
    const a = writer.parts("session", filled(2 * MAX + 5, 1));
    const b = writer.parts("sync", filled(MAX + 1, 2));
    const c = writer.parts("control/announce", Uint8Array.of(1, 2));
    const reader = sealedReader();
    expect(reader.push(a[0]!)).toBeNull();
    expect(reader.push(b[0]!)).toBeNull();
    expect(reader.inFlight).toBe(2);
    expect(reader.push(a[1]!)).toBeNull();
    expect(reader.push(c[0]!)).toEqual({ kind: "control/announce", messageId: 2, bytes: Uint8Array.of(1, 2) });
    same(reader.push(b[1]!), "sync", 1, filled(MAX + 1, 2));
    same(reader.push(a[2]!), "session", 0, filled(2 * MAX + 5, 1));
    expect(reader.inFlight).toBe(0);
  });

  it("copies bytes out of frames, so a caller may reuse its buffer", () => {
    const [frame] = sealedParts("session", 0, Uint8Array.of(1, 2, 3));
    const reader = sealedReader();
    const out = reader.push(frame!) as { bytes: Uint8Array };
    frame!.fill(0);
    expect(out.bytes).toEqual(Uint8Array.of(1, 2, 3));
  });

  it("throws past the last u32 id", () => {
    const writer = sealedWriter();
    expect(writer.parts("session", new Uint8Array(0))[0]![5]).toBe(0);
    expect(() => writer.parts("session", new Uint8Array(SEALED_MESSAGE_MAX_BYTES + 1))).toThrow(RangeError);
    // A refused cut spends no id.
    expect(writer.parts("session", new Uint8Array(0))[0]![5]).toBe(1);
    // 2^32 messages cost too much to walk; a writer may start late to reach the edge.
    const late = sealedWriter(0xfffffffe);
    expect(toHex(late.parts("session", new Uint8Array(0))[0]!.subarray(2, 6))).toBe("fffffffe");
    expect(toHex(late.parts("session", new Uint8Array(0))[0]!.subarray(2, 6))).toBe("ffffffff");
    expect(() => late.parts("session", new Uint8Array(0))).toThrow(RangeError);
    expect(() => late.parts("session", new Uint8Array(0))).toThrow(RangeError);
    expect(() => sealedWriter(-1)).toThrow(RangeError);
    expect(() => sealedWriter(0x100000000)).toThrow(RangeError);
  });
});

describe("sealed-carriage — refusals", () => {
  it("refuses a handshake tag after open (control: every gate tag 0x01–0x13)", () => {
    for (let tag = 0x01; tag <= 0x13; tag++) refuses(sealedReader(), forge({ version: tag }), "handshake-tag");
    refuses(sealedReader(), Uint8Array.of(0x01), "handshake-tag");
  });

  it("refuses any foreign first byte", () => {
    for (const v of [0x00, 0x14, 0x7f, 0x81, 0xff, 0x5a]) refuses(sealedReader(), forge({ version: v }), "version-foreign");
  });

  it("refuses a short header", () => {
    refuses(sealedReader(), new Uint8Array(0), "header-short");
    refuses(sealedReader(), forge({}).subarray(0, SEALED_HEADER_BYTES - 1), "header-short");
  });

  it("refuses a foreign kind", () => {
    for (const k of [0x00, 0x03, 0x0f, 0x12, 0xff]) refuses(sealedReader(), forge({ kind: k }), "kind-foreign");
  });

  it("refuses an overlong part and an overlong total", () => {
    refuses(sealedReader(), forge({ body: new Uint8Array(MAX + 1), total: MAX + 1, count: 2 }), "part-overlong");
    const total = SEALED_MESSAGE_MAX_BYTES + 1;
    refuses(sealedReader(), forge({ body: new Uint8Array(MAX), total, count: Math.ceil(total / MAX) }), "total-overlong");
  });

  it("refuses a count that does not match the total, an index past the count, and a count or total that shifts", () => {
    refuses(sealedReader(), forge({ total: 0, count: 2 }), "count-mismatch");
    refuses(sealedReader(), forge({ total: 0, count: 0 }), "count-mismatch");
    refuses(sealedReader(), forge({ total: MAX + 1, count: 1, body: new Uint8Array(MAX) }), "count-mismatch");
    refuses(sealedReader(), forge({ total: 3, count: 1, index: 1, body: new Uint8Array(3) }), "count-mismatch");
    const [first, second] = sealedParts("session", 0, filled(MAX + 10));
    const reader = sealedReader();
    expect(reader.push(first!)).toBeNull();
    const shifted = second!.slice();
    new DataView(shifted.buffer).setUint32(10, 2 * MAX + 10); new DataView(shifted.buffer).setUint16(8, 3);
    refuses(reader, shifted, "count-mismatch");
    // Only the total shifts; the count still reads 2.
    const steady = sealedReader();
    expect(steady.push(first!)).toBeNull();
    const drifted = second!.slice();
    new DataView(drifted.buffer).setUint32(10, MAX + 11);
    expect(drifted[9]).toBe(2);
    refuses(steady, drifted, "count-mismatch");
  });

  it("refuses a later part under another kind", () => {
    const [first, second] = sealedParts("session", 4, filled(MAX + 10));
    const reader = sealedReader();
    expect(reader.push(first!)).toBeNull();
    const mixed = second!.slice(); mixed[1] = SEALED_KINDS.sync;
    refuses(reader, mixed, "kind-mixed");
  });

  it("refuses a duplicate part and a missing part", () => {
    const parts = sealedParts("sync", 2, filled(3 * MAX + 7));
    const dup = sealedReader();
    expect(dup.push(parts[0]!)).toBeNull();
    expect(dup.push(parts[1]!)).toBeNull();
    refuses(dup, parts[1]!, "part-duplicate");
    const dup0 = sealedReader();
    expect(dup0.push(parts[0]!)).toBeNull();
    refuses(dup0, parts[0]!, "part-duplicate");
    const gap = sealedReader();
    expect(gap.push(parts[0]!)).toBeNull();
    refuses(gap, parts[2]!, "part-missing");
  });

  it("refuses a short non-last part and a last part that misses its total", () => {
    const reader = sealedReader();
    refuses(reader, forge({ total: MAX + 10, count: 2, body: new Uint8Array(MAX - 1) }), "part-short");
    refuses(sealedReader(), forge({ total: 10, count: 1, body: new Uint8Array(9) }), "part-short");
    refuses(sealedReader(), forge({ total: 10, count: 1, body: new Uint8Array(11) }), "part-short");
    const [first] = sealedParts("session", 0, filled(MAX + 10));
    const tail = sealedReader();
    expect(tail.push(first!)).toBeNull();
    refuses(tail, forge({ id: 0, index: 1, count: 2, total: MAX + 10, body: new Uint8Array(9) }), "part-short");
  });

  it("refuses a stale id: a new message that does not climb past every id begun", () => {
    const reader = sealedReader();
    expect(reader.push(forge({ id: 5 }))).not.toBeNull();
    refuses(reader, forge({ id: 5 }), "id-stale");
    const lower = sealedReader();
    expect(lower.push(forge({ id: 5 }))).not.toBeNull();
    refuses(lower, forge({ id: 4 }), "id-stale");
  });

  it("refuses an orphan part of a message never begun", () => {
    refuses(sealedReader(), forge({ id: 3, index: 1, count: 2, total: MAX + 1, body: new Uint8Array(1) }), "orphan-part");
  });

  it("refuses a message begun past the concurrent bound", () => {
    const reader = sealedReader();
    const writer = sealedWriter();
    for (let i = 0; i < SEALED_CONCURRENT_MAX; i++) expect(reader.push(writer.parts("session", filled(MAX + 1))[0]!)).toBeNull();
    expect(reader.inFlight).toBe(SEALED_CONCURRENT_MAX);
    refuses(reader, writer.parts("control/announce", filled(MAX + 1))[0]!, "concurrent-overflow");
  });

  it("delivers a one-part message while the concurrent bound stands full: it buffers nothing", () => {
    const reader = sealedReader();
    const writer = sealedWriter();
    const held = Array.from({ length: SEALED_CONCURRENT_MAX }, (_, i) => writer.parts("session", filled(MAX + 1, i)));
    for (const parts of held) expect(reader.push(parts[0]!)).toBeNull();
    expect(reader.inFlight).toBe(SEALED_CONCURRENT_MAX);
    const [close] = writer.parts("control/close", new Uint8Array(0));
    same(reader.push(close!), "control/close", SEALED_CONCURRENT_MAX, new Uint8Array(0));
    const [note] = writer.parts("sync", filled(MAX, 9));
    same(reader.push(note!), "sync", SEALED_CONCURRENT_MAX + 1, filled(MAX, 9));
    expect(reader.inFlight).toBe(SEALED_CONCURRENT_MAX);
    held.forEach((parts, i) => same(reader.push(parts[1]!), "session", i, filled(MAX + 1, i)));
    expect(reader.inFlight).toBe(0);
    // A one-part message still answers to the message bound and to the id climb.
    refuses(sealedReader({ messageBytes: 10 }), forge({ body: new Uint8Array(11) }), "total-overlong");
  });

  it("delivers a one-part message while the buffer bound stands full", () => {
    const reader = sealedReader({ bufferBytes: MAX + 1 });
    expect(reader.push(forge({ id: 0, count: 2, total: MAX + 1, body: new Uint8Array(MAX) }))).toBeNull();
    same(reader.push(forge({ id: 1, body: filled(MAX) })), "session", 1, filled(MAX));
  });

  it("gives declared bytes back when a message ends", () => {
    // Room for one large message at a time: four in a row must all pass.
    const reader = sealedReader({ bufferBytes: 2 * MAX + 5 });
    const writer = sealedWriter();
    for (let i = 0; i < 4; i++) {
      const parts = writer.parts("sync", filled(2 * MAX + 5, i));
      for (const part of parts.slice(0, -1)) expect(reader.push(part)).toBeNull();
      same(reader.push(parts[parts.length - 1]!), "sync", i, filled(2 * MAX + 5, i));
    }
  });

  it("accepts a beginning that lifts the declared sum to exactly the default buffer bound, and refuses one byte more", () => {
    const head = (id: number, total: number): Uint8Array => forge({ id, total, count: Math.ceil(total / MAX), body: new Uint8Array(MAX) });
    const edge = sealedReader();
    expect(edge.push(head(0, SEALED_MESSAGE_MAX_BYTES))).toBeNull();
    expect(edge.push(head(1, SEALED_BUFFER_MAX_BYTES - SEALED_MESSAGE_MAX_BYTES))).toBeNull();
    expect(edge.inFlight).toBe(2);
    const over = sealedReader();
    expect(over.push(head(0, SEALED_MESSAGE_MAX_BYTES))).toBeNull();
    expect(over.push(head(1, SEALED_BUFFER_MAX_BYTES - SEALED_MESSAGE_MAX_BYTES - 1))).toBeNull();
    refuses(over, head(2, MAX + 2), "buffer-overflow");
  });

  it("refuses a message whose declared total lifts the in-flight sum past the buffer bound", () => {
    const reader = sealedReader();
    const writer = sealedWriter();
    expect(reader.push(writer.parts("session", new Uint8Array(SEALED_MESSAGE_MAX_BYTES))[0]!)).toBeNull();
    expect(reader.push(writer.parts("session", new Uint8Array(SEALED_MESSAGE_MAX_BYTES - MAX))[0]!)).toBeNull();
    // MAX bytes of room stand; MAX + 1 overflows.
    refuses(reader, writer.parts("sync", new Uint8Array(MAX + 1))[0]!, "buffer-overflow");
  });

  it("refuses every push after close, and close drops partials, counts them, and stays idempotent", () => {
    const reader = sealedReader();
    const [first] = sealedParts("session", 0, filled(MAX + 1));
    expect(reader.push(first!)).toBeNull();
    expect(reader.closed).toBe(false);
    expect(reader.close()).toEqual({ unfinished: 1 });
    expect(reader.closed).toBe(true);
    expect(reader.inFlight).toBe(0);
    expect(reader.close()).toEqual({ unfinished: 0 });
    expect(reader.push(forge({ id: 9 }))).toEqual({ refusal: "closed" });
    reached.add("closed");
  });

  it("a refusal spends the reader even for a frame that would read well", () => {
    const reader = sealedReader();
    expect(reader.push(Uint8Array.of(0x02))).toEqual({ refusal: "handshake-tag" });
    expect(reader.closed).toBe(true);
    expect(reader.push(sealedParts("session", 0, new Uint8Array(0))[0]!)).toEqual({ refusal: "closed" });
  });

  it("refuses a non-byte frame as a short header", () => {
    refuses(sealedReader(), "nonsense" as unknown as Uint8Array, "header-short");
  });

  it("census: every named refusal reached", () => {
    expect([...reached].sort()).toEqual([...SEALED_REFUSALS].sort());
  });
});

describe("sealed-carriage — bounds", () => {
  it("tightens each bound", () => {
    const few = sealedReader({ concurrent: 1 });
    expect(few.push(forge({ id: 0, count: 2, total: MAX + 1, body: new Uint8Array(MAX) }))).toBeNull();
    refuses(few, forge({ id: 1, count: 2, total: MAX + 1, body: new Uint8Array(MAX) }), "concurrent-overflow");
    const small = sealedReader({ messageBytes: 10 });
    expect(small.push(forge({ body: new Uint8Array(10) }))).not.toBeNull();
    refuses(small, forge({ id: 1, body: new Uint8Array(11) }), "total-overlong");
    const tight = sealedReader({ bufferBytes: 2 * MAX + 1 });
    expect(tight.push(forge({ id: 0, count: 2, total: MAX + 1, body: new Uint8Array(MAX) }))).toBeNull();
    refuses(tight, forge({ id: 1, count: 2, total: MAX + 1, body: new Uint8Array(MAX) }), "buffer-overflow");
  });

  it("clamps a loosened bound to the module constant", () => {
    const loose = sealedReader({ concurrent: 1000, bufferBytes: 1 << 30, messageBytes: 1 << 30 });
    const writer = sealedWriter();
    for (let i = 0; i < SEALED_CONCURRENT_MAX; i++) expect(loose.push(writer.parts("session", filled(MAX + 1))[0]!)).toBeNull();
    refuses(loose, writer.parts("session", filled(MAX + 1))[0]!, "concurrent-overflow");
    const total = SEALED_MESSAGE_MAX_BYTES + 1;
    refuses(sealedReader({ messageBytes: 1 << 30 }), forge({ body: new Uint8Array(MAX), total, count: Math.ceil(total / MAX) }), "total-overlong");
  });

  it("throws on a bound that names no count", () => {
    expect(() => sealedReader({ concurrent: -1 })).toThrow(RangeError);
    expect(() => sealedReader({ bufferBytes: Number.NaN })).toThrow(RangeError);
    expect(() => sealedReader({ messageBytes: 1.5 })).toThrow(RangeError);
    // A reader that could begin no multi-part message reads as misconfiguration.
    expect(() => sealedReader({ concurrent: 0 })).toThrow(RangeError);
    expect(() => sealedReader({ bufferBytes: 0 })).toThrow(RangeError);
    // A reader for empty controls alone stays sensible.
    same(sealedReader({ messageBytes: 0 }).push(forge({ kind: SEALED_KINDS["control/close"] })), "control/close", 0, new Uint8Array(0));
  });
});
