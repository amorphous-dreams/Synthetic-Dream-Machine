/**
 * root-meta — the ONE locator every reader of a carrier's root ```toml meta fence reads.
 *
 * ── WHY ONE ─────────────────────────────────────────────────────────────────────────────────────
 * Every reader of a carrier's root meta fence composes THIS locator — starting at STX, through the
 * fence mask, requiring a closer — so their semantics agree by construction rather than by
 * vigilance. An unlabelled ```toml teaching fence names no root meta: the mask refuses its interior,
 * and a reader that matched ANY ```toml fence would let an authored example shadow the real one.
 *
 * ── THE ROOT META RIDES THE BODY ────────────────────────────────────────────────────────────────
 * Where a frame opens (STX stands), the carrier's identity block is the first thing in the BODY — a
 * meta fence sitting ABOVE STX is the frame verdict's own tear (`meta-before-stx`), never the
 * carrier's root. A carrier with no STX is all body, and the root meta reads from the top.
 *
 * ── LIVE, MASKED, CLOSED ─────────────────────────────────────────────────────────────────────────
 * The opener is read through the fence mask (`maskedExecAll`, `allowSpanStart = true`): a meta
 * example quoted inside a ````-fenced lesson never counts, while the declaration's own opening fence
 * — which sits exactly at a mask span's start — still does. An opener with no closer states nothing
 * a reader can act on, so it answers null rather than reading to EOF.
 *
 * ── WHAT THIS MODULE DOES NOT OWN ───────────────────────────────────────────────────────────────
 * PARSING the body into fields is not the frame's job (ruled) and is not this locator's job either —
 * `rootMetaFields` composes `parseTaploFields` (toml-ast.ts) onto the body this module finds. A
 * caller needing a different close (the deserializer's byte-exact round-trip span, or a slot body's
 * own fence) composes `metaFenceAt` directly rather than routing through `rootMetaFence`.
 *
 * Meme: lar:///tw5.root-meta.helper
 */

import {
  fencedSpans, maskedExecAll, readFrame, META_OPEN_RE, type MaskSpan,
} from "@lararium/memetic-frame";
import { parseTaploFields, duplicateTomlKeys, duplicateKeyMessage } from "./toml-ast.js";
import type { TiddlerFields } from "./deserializer.js";

/** One located, closed meta fence: offsets into the ORIGINAL text, plus its parts pre-sliced. */
export interface MetaFenceSpan {
  /** Where the opener ```` ```toml meta ```` begins. */
  readonly openStart: number;
  /** The opener line, without its trailing newline. */
  readonly openLine: string;
  /** Where the body begins (just past the opener's newline). */
  readonly bodyStart: number;
  /** Where the body ends — the index of the `\n` before the closing ```` ``` ````. */
  readonly bodyEnd: number;
  /** The body text itself, `text.slice(bodyStart, bodyEnd)`. */
  readonly body: string;
}

/**
 * The first LIVE meta opener at or past `from`, closed at its own `\n```.
 *
 * Returns null where no opener stands at or past `from`, or where an opener stands with no closer —
 * half a fence states nothing a reader can act on.
 */
export function metaFenceAt(
  text: string,
  from = 0,
  spans: readonly MaskSpan[] = fencedSpans(text),
): MetaFenceSpan | null {
  const open = maskedExecAll(text, META_OPEN_RE, spans, true).find((m) => m.index >= from);
  if (!open) return null;
  const openStart = open.index;
  const bodyStart = openStart + open[0].length;
  const closeAt = text.indexOf("\n```", bodyStart);
  if (closeAt < 0) return null;
  return {
    openStart,
    openLine: open[0].replace(/\n$/, ""),
    bodyStart,
    bodyEnd: closeAt,
    body: text.slice(bodyStart, closeAt),
  };
}

/**
 * The carrier's ROOT meta fence. THE ROOT META RIDES THE BODY: a meta block above STX is the frame
 * verdict's tear, never the root, so the search starts at STX's end (or the top, where no STX stands).
 */
export function rootMetaFence(
  text: string,
  spans: readonly MaskSpan[] = fencedSpans(text),
): MetaFenceSpan | null {
  return metaFenceAt(text, readFrame(text, spans).stx?.end ?? 0, spans);
}

/** The root meta's fields, parsed; `{}` where the carrier writes no root meta. */
export function rootMetaFields(text: string): TiddlerFields {
  const fence = rootMetaFence(text);
  return fence ? parseTaploFields(fence.body) : {};
}

/** Every LIVE, closed meta fence in the text, in order — the root's and each slot's own. */
export function metaFences(text: string, spans: readonly MaskSpan[] = fencedSpans(text)): MetaFenceSpan[] {
  const out: MetaFenceSpan[] = [];
  for (let at = 0; ;) {
    const fence = metaFenceAt(text, at, spans);
    if (!fence) return out;
    out.push(fence);
    at = fence.bodyEnd;
  }
}

/** A meta fence that defines a key twice: where its body starts, and the wording naming the key. */
export interface MetaKeyRedefinition {
  readonly bodyStart: number;
  readonly key: string;
  readonly message: string;
}

/**
 * Every key a live meta fence defines twice. TOML forbids it, and a reader handed such a body keeps
 * neither value (the spec parser refuses the whole fence), so the carrier states no fields at all
 * there. A ```toml teaching fence names no meta and is never read.
 */
export function metaKeyRedefinitions(text: string): MetaKeyRedefinition[] {
  return metaFences(text).flatMap((fence) => duplicateTomlKeys(fence.body).map((d) => ({
    bodyStart: fence.bodyStart, key: d.key, message: `meta fence: ${duplicateKeyMessage(d)}`,
  })));
}

/**
 * One top-level toml value, raw and quoted, read WITHOUT a parser — for shape readers that must
 * survive a malformed or mid-write body rather than fault on it.
 */
export function metaValueRaw(body: string, key: string): string | null {
  const m = new RegExp(String.raw`^[ \t]*${key}[ \t]*=[ \t]*"([^"]*)"`, "m").exec(body);
  return m ? m[1]! : null;
}
