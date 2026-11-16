/**
 * pulama-wire — THE CODEC between a vessel and the pūlama that holds its custody.
 *
 * One frame per line, JSON, the custody door's own style. A vessel asks record operations and derivations; the pūlama
 * answers plaintext records and derived children. NO FRAME CARRIES A KEY: the vessel key, the serving key, the custody
 * root, a face's custody key and a ward key rest in the pūlama's holder and never enter a frame, and no frame carries
 * a credential either (a passphrase rides nothing).
 *
 * ── THE FRAMES ──────────────────────────────────────────────────────────────────────────────────
 *   vessel → pūlama   `hello`   the offer a kūkulu wears (its lei and its vouch); the first frame, once
 *                     `req`     one operation: `id`, `op`, `a` (its arguments)
 *   pūlama → vessel   `session` the hello stands: the session's scope, the holder's standing, the derived children
 *                     `refused` the hello refuses, by reading; the channel closes after it
 *                     `res`     one answer: `id`, `ok`, then `v` (a value) or `err` (a named refusal)
 *                     `ev`      the holder's standing moved (a face opened): the standing and the children again
 *
 * Bytes ride as `{ "$b": "<base64>" }` wherever a value holds a `Uint8Array`. A refusal rides by its class name and
 * its own fields, and the far side raises the same class, so a caller's `instanceof` reads true across the channel.
 *
 * The channel is a port (`PulamaChannel`): a unix socket on a Node host (`pulama-socket`), a pair in memory for a
 * suite, a `MessagePort` in a browser. The codec names no host.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import {
  CustodyLocked, CustodyRowUnavailable, CustodyRowUnknown, FaceCustodyAbsent, FaceLocked, WardAbsent, WardNeedsFreshUnlock,
  type RecordReading,
} from "./custody-holder.js";
import type { CustodyHome } from "./vault-carriers.js";

export type PulamaFrame = { readonly t: string } & Readonly<Record<string, unknown>>;

/** One ordered, framed channel between a vessel and its pūlama. `send` encodes before it returns. */
export interface PulamaChannel {
  send(frame: PulamaFrame): void;
  onFrame(listener: (frame: PulamaFrame) => void): void;
  /** Fires once, when either side closes or the transport drops. */
  onClose(listener: () => void): void;
  close(): void;
}

/** The longest line a side reads: one sealed row's plaintext, base64, and its envelope. */
export const PULAMA_MAX_LINE = 96 * 1024 * 1024;

/** A refusal the pūlama names: a hello it does not serve, an operation outside the session, a pūlama that rests unlit. */
export class PulamaRefused extends Error {
  override readonly name = "PulamaRefused";
  constructor(readonly reading: string, detail = "") { super(detail ? `${reading}: ${detail}` : reading); }
}

/** Replace every `Uint8Array` in a value with its `{ $b }` form. */
export function packBytes(value: unknown): unknown {
  if (value instanceof Uint8Array) return { $b: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("base64") };
  if (Array.isArray(value)) return value.map(packBytes);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = packBytes(v);
    return out;
  }
  return value;
}

/** The inverse of `packBytes`. */
export function unpackBytes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(unpackBytes);
  if (typeof value === "object" && value !== null) {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === "$b" && typeof (value as { $b: unknown }).$b === "string") {
      return new Uint8Array(Buffer.from((value as { $b: string }).$b, "base64"));
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = unpackBytes(v);
    return out;
  }
  return value;
}

/** One frame as its line (no newline). */
export function encodeFrame(frame: PulamaFrame): string { return JSON.stringify(packBytes(frame)); }

/** One line as its frame, or null where the line forms none. */
export function decodeFrame(line: string): PulamaFrame | null {
  if (line.length > PULAMA_MAX_LINE) return null;
  let raw: unknown;
  try { raw = JSON.parse(line); } catch { return null; }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw) || typeof (raw as { t?: unknown }).t !== "string") return null;
  return unpackBytes(raw) as PulamaFrame;
}

/** A refusal as it rides a `res` frame: its class name, its message, and the fields its class carries. */
export interface PackedRefusal { readonly name: string; readonly message: string; readonly fcid?: string; readonly home?: string; readonly file?: string; readonly reading?: string }

export function packRefusal(err: unknown): PackedRefusal {
  if (!(err instanceof Error)) return { name: "Error", message: String(err) };
  const e = err as Error & { fcid?: unknown; home?: unknown; file?: unknown; reading?: unknown };
  return {
    name: e.name, message: e.message,
    ...(typeof e.fcid === "string" ? { fcid: e.fcid } : {}), ...(typeof e.home === "string" ? { home: e.home } : {}),
    ...(typeof e.file === "string" ? { file: e.file } : {}), ...(typeof e.reading === "string" ? { reading: e.reading } : {}),
  };
}

/** Raise the class a packed refusal names, carrying its own message. A name this codec does not know raises a plain `Error` under that name. */
export function unpackRefusal(raw: unknown): Error {
  const p = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<PackedRefusal>;
  const message = typeof p.message === "string" ? p.message : "the pūlama refused";
  const made = ((): Error => {
    switch (p.name) {
      case "FaceLocked": return new FaceLocked(p.fcid ?? "");
      case "CustodyLocked": return new CustodyLocked();
      case "FaceCustodyAbsent": return new FaceCustodyAbsent(p.file ?? "");
      case "CustodyRowUnavailable": return new CustodyRowUnavailable((p.home ?? "identity") as CustodyHome, p.file ?? "", p.reading ?? "");
      case "CustodyRowUnknown": return new CustodyRowUnknown((p.home ?? "identity") as CustodyHome, p.file ?? "");
      case "WardNeedsFreshUnlock": return new WardNeedsFreshUnlock("");
      case "WardAbsent": return new WardAbsent(p.fcid ?? "");
      case "PulamaRefused": return new PulamaRefused(p.reading ?? "refused");
      default: { const e = new Error(message); e.name = typeof p.name === "string" ? p.name : "Error"; return e; }
    }
  })();
  made.message = message;
  return made;
}

/** A row's reading, copied: the bytes a holder hands a decision zero-fill once it returns, so what crosses holds its own. */
export function copyReading(r: RecordReading): RecordReading {
  return r.reading === "opens" ? { reading: "opens", plaintext: Uint8Array.from(r.plaintext) } : r;
}

export const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** Whether two readings name the same standing row: the same reading, the same bytes, the same refusal. */
export function sameReading(a: RecordReading, b: RecordReading): boolean {
  if (a.reading !== b.reading) return false;
  if (a.reading === "opens" && b.reading === "opens") return sameBytes(a.plaintext, b.plaintext);
  if (a.reading === "unavailable" && b.reading === "unavailable") return a.why === b.why;
  if (a.reading === "locked" && b.reading === "locked") return a.fcid === b.fcid;
  return true;
}

/** A reading as it arrived off the channel, or null where the value forms none. */
export function readingOf(raw: unknown): RecordReading | null {
  const r = raw as { reading?: unknown; plaintext?: unknown; why?: unknown; fcid?: unknown } | null;
  if (typeof r !== "object" || r === null) return null;
  if (r.reading === "opens" && r.plaintext instanceof Uint8Array) return { reading: "opens", plaintext: r.plaintext };
  if (r.reading === "absent") return { reading: "absent" };
  if (r.reading === "locked") return typeof r.fcid === "string" ? { reading: "locked", fcid: r.fcid } : { reading: "locked" };
  if (r.reading === "unavailable" && typeof r.why === "string") return { reading: "unavailable", why: r.why };
  return null;
}

/**
 * Two ends of one channel, in memory: each `send` encodes its frame to a line at once and the far end decodes it on a later
 * microtask, so a suite crosses the same codec a socket does. `lines` keeps every line each end sent, for a witness to scan.
 */
export function pulamaChannelPair(): { readonly vessel: PulamaChannel; readonly pulama: PulamaChannel; readonly lines: { readonly fromVessel: string[]; readonly fromPulama: string[] } } {
  const lines = { fromVessel: [] as string[], fromPulama: [] as string[] };
  let open = true;
  let closing = false;
  const ends = [0, 1].map(() => ({ frames: [] as Array<(f: PulamaFrame) => void>, closes: [] as Array<() => void>, held: [] as PulamaFrame[] }));
  // A close lands behind every frame already sent, as a socket flushes what it wrote before it ends.
  const closeBoth = (): void => {
    if (closing) return;
    closing = true;
    queueMicrotask(() => { open = false; for (const end of ends) for (const l of end.closes) l(); });
  };
  const end = (self: number, sent: string[]): PulamaChannel => ({
    send(frame) {
      if (closing) return;
      const line = encodeFrame(frame);
      sent.push(line);
      queueMicrotask(() => {
        if (!open) return;
        const far = ends[1 - self]!, decoded = decodeFrame(line);
        if (decoded === null) return closeBoth();
        if (far.frames.length === 0) far.held.push(decoded); else for (const l of far.frames) l(decoded);
      });
    },
    onFrame(listener) { const mine = ends[self]!; mine.frames.push(listener); for (const f of mine.held.splice(0)) listener(f); },
    onClose(listener) { ends[self]!.closes.push(listener); },
    close: closeBoth,
  });
  return { vessel: end(0, lines.fromVessel), pulama: end(1, lines.fromPulama), lines };
}
