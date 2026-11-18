/**
 * carriage-frames — one carried file as a run of small frames, for a carrier that holds little at once (a QR code).
 *
 * A fleet-join offer fits one frame. A request or an answer runs longer than one QR code holds, so it crosses as a run
 * of frames, read in any order and any number of times:
 *
 *   lar-carry:<tag>:<index>.<count>:<chunk>
 *
 * `tag` names the whole file (a digest of its bytes, sixteen hex), so frames of two files never braid; `index` and
 * `count` place the chunk; `chunk` carries its bytes in base64url. The assembly answers the file once every place
 * holds a chunk and the joined bytes digest to the tag.
 *
 * THE TAG GUARDS ASSEMBLY, NOT AUTHORITY. The files this carries verify by their own signatures at the door that reads
 * them (`@lararium/mesh` `fleet-join`); a frame a stranger showed the camera can spoil an assembly and nothing more.
 * The digest runs in plain arithmetic (FNV-1a over two lanes), so a page outside a secure context still assembles.
 *
 * Pure: no DOM, no clock.
 */

/** How many base64url characters one frame's chunk holds: a QR code a phone camera reads at arm's length. */
export const CARRIAGE_FRAME_CHARS = 600;
/** How many frames one file may run to. */
export const CARRIAGE_FRAME_BOUND = 512;

const FRAME = /^lar-carry:([0-9a-f]{16}):(\d{1,3})\.(\d{1,3}):([A-Za-z0-9_-]+)$/;

/** The file's tag: two FNV-1a lanes over its bytes, sixteen hex. */
export function carriageTag(bytes: Uint8Array): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    a = Math.imul(a ^ bytes[i]!, 0x01000193);
    b = Math.imul(b ^ bytes[bytes.length - 1 - i]!, 0x01000193) ^ (b >>> 13);
  }
  const word = (n: number): string => (n >>> 0).toString(16).padStart(8, "0");
  return word(a) + word(b);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** The frames that carry `text`, in order. A text past the frame bound refuses by throwing `carriage-too-long`. */
export function carriageFrames(text: string, chars: number = CARRIAGE_FRAME_CHARS): string[] {
  const bytes = new TextEncoder().encode(text);
  const whole = toBase64Url(bytes);
  const size = Math.max(4, chars - (chars % 4));   // a chunk decodes alone only on a four-character boundary
  const count = Math.max(1, Math.ceil(whole.length / size));
  if (count > CARRIAGE_FRAME_BOUND) throw new RangeError("carriage-too-long: this file runs past the frames one carriage holds; carry it as a file.");
  const tag = carriageTag(bytes);
  return Array.from({ length: count }, (_, i) => `lar-carry:${tag}:${i + 1}.${count}:${whole.slice(i * size, (i + 1) * size)}`);
}

/** Whether a read text stands as a carriage frame (a QR code may carry any text). */
export function isCarriageFrame(text: string): boolean { return FRAME.test(text.trim()); }

export type CarriageTaking =
  | { readonly done: string }
  | { readonly held: number; readonly of: number }
  | { readonly refusal: "frame-malformed" | "frame-other-carriage" | "carriage-torn" };

/** One file's assembly: it takes frames in any order, and answers the file once whole. */
export class CarriageAssembly {
  private tag: string | null = null;
  private count = 0;
  private readonly chunks = new Map<number, string>();

  /** How many places hold a chunk, of how many. */
  get progress(): { readonly held: number; readonly of: number } { return { held: this.chunks.size, of: this.count }; }

  take(frame: string): CarriageTaking {
    const m = FRAME.exec(frame.trim());
    if (!m) return { refusal: "frame-malformed" };
    const [, tag, indexText, countText, chunk] = m as unknown as [string, string, string, string, string];
    const index = Number(indexText), count = Number(countText);
    if (count < 1 || count > CARRIAGE_FRAME_BOUND || index < 1 || index > count) return { refusal: "frame-malformed" };
    if (this.tag === null) { this.tag = tag; this.count = count; }
    // A frame of another file, or one that places the same file otherwise: this assembly keeps what it holds.
    if (tag !== this.tag || count !== this.count) return { refusal: "frame-other-carriage" };
    const standing = this.chunks.get(index);
    if (standing !== undefined && standing !== chunk) return { refusal: "carriage-torn" };
    this.chunks.set(index, chunk);
    if (this.chunks.size < this.count) return this.progress;
    let bytes: Uint8Array;
    try { bytes = fromBase64Url(Array.from({ length: this.count }, (_, i) => this.chunks.get(i + 1)!).join("")); }
    catch { return { refusal: "carriage-torn" }; }
    if (carriageTag(bytes) !== this.tag) return { refusal: "carriage-torn" };
    try { return { done: new TextDecoder("utf-8", { fatal: true }).decode(bytes) }; } catch { return { refusal: "carriage-torn" }; }
  }
}
