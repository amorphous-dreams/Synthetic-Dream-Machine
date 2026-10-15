/**
 * cas-stage — the operator gesture's CAS staging shore.
 *
 * A verb NEVER inlines a body. The disk/fetch-holding gesture stages each carrier body
 * to the corpus CAS (content-addressed, hex sha256) and rides the verb with a skinny
 * `textCid` handle. The daemon worker resolves it back via `resolveByCid` from the SAME
 * corpus CAS dir (process-shared filesystem, no IPC) and re-verifies cid==hash(bytes).
 *
 * This keeps an oversized carrier body (a whole book) out of the daemon command doc, whose
 * automerge scalar-string value overflows past ~2^24 chars — the wall that fells the seed
 * when a giant body inlines into a summons. Bag-agnostic: any carrier whose body would
 * overflow rides a reference, regardless of which bag holds it.
 *
 * The gesture holds the body, so it also DECIDES the shape — THE BLOB LAW (content-handle.ts):
 *   · KIND picks it. A body whose `type` (the `.meta` declaration first, else TW5's registry by
 *     extension) rides as a pointer (`ridesAsPointer`) stages and rides `skinny: true`; the daemon
 *     writes a pointer instead of materializing the body as a CRDT text field.
 *   · The `_lar_cas` flag is the ONE override — a utf8 body pushed to the cid/ tier on purpose.
 *   · A utf8 body past the 1 MiB wall stages for transport (never a giant inline arg) but rides
 *     `skinny: false`, so the island faults it. Under the wall it inlines unchanged.
 *
 * THE CID HASHES THE RAW BYTES. A pointer-kind carrier that rode base64 (a binary file) decodes
 * BEFORE it hashes and stores, so the blob under `cid/<hex>` IS the file on disk, `_integrity`
 * verifies `photo.png`, and a foreign verifier agrees. Every other carrier stages its `text`
 * string as utf8 (a utf8 file's bytes ARE its text), and the worker utf8-decodes the resolved
 * bytes back to the same string. The read side (`lazy-resolver.ts`) re-encodes base64 for the
 * VM's `text` when the tiddler's type registers base64 — TW5's own expectation.
 *
 * Meme: lar:///ha.ka.ba/lares/api/cas-stage
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sha256HexBytesSync, utf8Bytes, isOversizedBody, ridesAsPointer, mediaTypeFromExt } from "@lararium/mesh";
import { larCasDir } from "./env.js";

/** The one override. A utf8 body reaches the cid/ tier only when the operator marks `_lar_cas = "yes"`
 *  in a `.meta` sidecar (`_lar_cas: yes`, TW5 field form) OR a per-ahu `toml meta`
 *  (`_lar_cas = "yes"`). The flag reads off text the gesture already holds — never a CAS
 *  resolve. Matches either `:` or `=`, with or without quotes. */
const CAS_FLAG_RE = /(?:^|\n)\s*_lar_cas\s*[:=]\s*"?yes"?/i;

/** Does a carrier opt IN to CAS externalization? Reads the `.meta` sidecar and the body meta
 *  (both in hand at scan time — a flag read is never a body resolve). */
export function carrierCasFlagged(text: string, meta?: string): boolean {
  return CAS_FLAG_RE.test(meta ?? "") || CAS_FLAG_RE.test(text);
}

/** The `type:` a `.meta` sidecar declares — the declaration the kind decision reads FIRST (a
 *  `.svg` declared `text/xml` inlines; a `.bin` declared `image/png` rides a pointer). Undefined
 *  when the sidecar is absent or names no type. */
export function declaredType(meta?: string): string | undefined {
  const m = /(?:^|\n)type\s*:\s*(\S+)/.exec(meta ?? "");
  return m?.[1];
}

export interface StageCarrierOpts {
  /** The file extension (".png"/".mem"/…) — resolves the type through TW5's registry when no
   *  `.meta` declares one. */
  readonly ext?:     string;
  /** The `.meta`-declared `type` (`declaredType`) — wins over the extension. */
  readonly type?:    string;
  /** The operator opted in via `_lar_cas` (a pointer, whatever the kind). */
  readonly flagged?: boolean;
  /** The body failed the utf8 round-trip and rides base64 — a pointer-kind carrier decodes it
   *  back to raw bytes before hashing. */
  readonly binary?:  boolean;
}

export interface StagedCarrier {
  /** Content-address (hex sha256 of the staged bytes) — the CAS key + the verb handle. Valid only when `staged`. */
  readonly cid:    string;
  /** The staged bytes' length — the RAW byte length for a pointer-kind binary. */
  readonly size:   number;
  /** The daemon writes a POINTER: the kind rides as one, or the flag fired. */
  readonly skinny: boolean;
  /** A CAS blob was written — the verb rides `textCid`, not the inline body. `skinny` implies
   *  `staged`; an OVERSIZED un-flagged utf8 body also stages (transport stays skinny) but lands
   *  inline-then-faults island-side rather than as a pointer. */
  readonly staged: boolean;
}

/**
 * Decide a carrier body's disposition under THE BLOB LAW. KIND-PRIMARY: a pointer-kind `type`
 * (TW5's base64 registry + the image family) OR the operator's `_lar_cas` elects a POINTER; the
 * body stages to the corpus CAS and the verb rides a `textCid`, never the body. A utf8 body under
 * the wall stays INLINE — no CAS blob, a meme is an inline-by-nature tiddler bundle. A utf8 body
 * past the wall stages for transport even un-flagged (never a giant inline arg), but rides
 * `skinny = false` so the island faults it (a verb rides a reference, never a body) rather than
 * materializing it. Idempotent when it stages (content-addressed, immutable → skip an existing blob).
 */
export function stageBodyToCas(text: string, opts: StageCarrierOpts = {}): StagedCarrier {
  const mediaType = opts.type ?? mediaTypeFromExt(opts.ext ?? "", opts.binary ?? false);
  const pointer = ridesAsPointer(mediaType);
  // A pointer-kind binary hashes + stores its RAW bytes; everything else stages its text string.
  const bytes = pointer && opts.binary ? new Uint8Array(Buffer.from(text, "base64")) : utf8Bytes(text);
  const size = bytes.length;
  const skinny = pointer || (opts.flagged ?? false);
  // Un-flagged utf8 under the wall → inline (no CAS blob). Only a pointer or the wall's transport stages.
  if (!skinny && !isOversizedBody(size)) return { cid: "", size, skinny: false, staged: false };
  const cid = sha256HexBytesSync(bytes);
  const dir = larCasDir();
  mkdirSync(dir, { recursive: true });
  const path = join(dir, cid);
  if (!existsSync(path)) writeFileSync(path, bytes);
  return { cid, size, skinny, staged: true };
}
