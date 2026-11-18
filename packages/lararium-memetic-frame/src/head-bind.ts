/**
 * head-bind — THE SEAL BINDS THE HEAD ADDRESS.
 *
 * ── THE HOLE ─────────────────────────────────────────────────────────────────────────────────────
 * The SOH head names where a carrier lives (``to=`lar:///…` ``) and under which namespace, and it
 * stands OUTSIDE the STX..ETX span the block check covers: a head is routing, read before the text.
 * So a head rewritten in transit left every sealed byte in place and read `match`. The sealed root
 * meta already mirrors what the head names (`title`, `uri-path`, `namespace`), so the frame compares
 * the two, and the seal reaches the head through the meta without a byte added to the check.
 *
 * ── THE LAW (controller ruling, 2026-11-01) ──────────────────────────────────────────────────────
 *   · `to=` binds against the meta `title` where one stands, else against `lar:///` + `uri-path`. A
 *     title and a uri-path that disagree with each other tear as well: the seal would name two places.
 *   · `namespace=` binds only where the meta carries `namespace`; both sides read through their numeric
 *     character references, so the head's glyphs (`ॐ ँ`) meet the meta's entities (`&#x0950; &#x0901;`).
 *     A head namespace over a meta carrying none reads `head-unbound`: the seal never reaches it.
 *   · A split reads TORN, fault `head-meta-split`. A head naming what the sealed meta never names reads
 *     `unbound` — the verdict `head-unbound`, visible, never `match` and never a tear.
 *   · An unaddressed head (``to=`?` ``) claims no address: it binds only where the meta names none,
 *     and over a sealed title or uri-path it reads split — the head dropped the address the seal names.
 *   · No head at all claims nothing, and binds trivially.
 *
 * ── THE ROOT META: THE FENCE OPENS THE BODY ──────────────────────────────────────────────────────
 * The meta the head binds against comes from `rootMetaFence` (root-meta.ts): the first live meta fence
 * after STX with nothing but spacing before it, closed at its first tick run — the deserializer's own
 * rule, so the frame binds against exactly the fields the record holds, and a slot's meta never names the
 * carrier.
 *
 * ── ONE GRAMMAR, READ ONE LINE AT A TIME ─────────────────────────────────────────────────────────
 * The frame parses no TOML (ruled: one dependency, no parser). So it reads the sealed meta only where
 * every line stands whole by itself, where a line read and a TOML read cannot part (blind security read
 * A1, 2026-11-01: a multi-line string tracked by a line read fell out of step with TOML's, and the two read
 * different titles under one `match`). The body binds only when it holds no `"""` or `'''` anywhere, no
 * character but tab and newline below U+0020, no byte-order mark, and every line reads as one of
 *
 *     a blank line · a `#` comment · a `[table]` or `[[table]]` header · `key = value  # comment`
 *
 * where the key is bare (dotted segments allowed) and the value closes on its own line: a basic or literal
 * string, a bare scalar (a number, a boolean, a date with no space), or a one-line array or inline table of
 * those. Anything else tears. The three binding keys read in the one spelling every emitter writes —
 *
 *     title = "…"          uri-path = "…"          namespace = "…"
 *
 * — a bare key, a basic string with no escape, nothing after the closing quote, each at most once, before
 * the first header. Inside that grammar a line means what TOML says it means, so the frame and the body
 * reader read one value; the tw5 gate also compares the frame's keys with smol-toml's and tears on any
 * difference (meta-parity.ts), the belt beside these braces. The whole corpus fits the grammar (measured,
 * 2026-11-01: 804 root metas, no multi-line string, no stray line).
 *
 * PYRE LEDGER: KEEP, every refusal here. `head-meta-split` refuses a live hostile form, a head that names
 * another place than its seal, and the grammar tears guard a parser differential (the frame's read
 * against a TOML read). Each guards a live invariant, so the pyre leaves them standing.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */

import { fencedSpans, type MaskSpan } from "./fence-mask.js";
import { matchCarrierHead } from "./head.js";
import { rootMetaFence } from "./root-meta.js";
import { readFrame, type FrameFault } from "./span.js";

/** An end the sealed meta never names: the head's address, or its namespace. */
export type UnboundEnd = "to" | "namespace";

export type HeadBinding =
  | { readonly kind: "bound" }
  | { readonly kind: "split"; readonly faults: readonly FrameFault[] }
  | { readonly kind: "unbound"; readonly unbound: readonly UnboundEnd[] };

type BindingKey = "title" | "uri-path" | "namespace";

/** What the sealed root meta names for the head, as the frame reads it. */
export type SealedBindingKeys = Readonly<Partial<Record<BindingKey, string>>>;

/** The one spelling a binding key binds in. */
const CANON_LINE_RE = /^(title|uri-path|namespace)[ \t]*=[ \t]*"([^"\\\n]*)"[ \t]*$/;
/** A bare key, dotted segments allowed, then `=`. Capture 1 holds the key. */
const KEY_RE = /^[ \t]*([A-Za-z0-9_-]+(?:[ \t]*\.[ \t]*[A-Za-z0-9_-]+)*)[ \t]*=[ \t]*/;
const BLANK_OR_COMMENT_RE = /^[ \t]*(?:#[^\n]*)?$/;
const HEADER_RE = /^[ \t]*\[\[?[ \t]*[A-Za-z0-9_.-]+(?:[ \t]*\.[ \t]*[A-Za-z0-9_-]+)*[ \t]*\]\]?[ \t]*(?:#[^\n]*)?$/;
/** No multi-line string, no byte-order mark, no control character but tab and newline. */
// eslint-disable-next-line no-control-regex
const OUTSIDE_RE = /"""|'''|﻿|[\u0000-\u0008\u000B-\u001F\u007F]/;
/** A bare scalar: a number, a boolean, a date or time with no space. */
const BARE_RE = /^[A-Za-z0-9_+.:-]+/;

const split = (message: string): FrameFault => ({ kind: "head-meta-split", message });

/** Numeric character references read as the characters they name — a head writes glyphs, a meta entities. */
function decodeRefs(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]{1,6});/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]{1,7});/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)));
}

/**
 * Where one value that starts at `at` ends on its line, or -1 where it does not close there: a basic or
 * literal string, a bare scalar, or a one-line array or inline table of values.
 */
function valueEnd(line: string, at: number, depth = 0): number {
  if (depth > 8) return -1;
  const c = line[at];
  if (c === '"') {
    for (let i = at + 1; i < line.length; i++) {
      if (line[i] === "\\") { i++; continue; }
      if (line[i] === '"') return i + 1;
    }
    return -1;
  }
  if (c === "'") {
    const close = line.indexOf("'", at + 1);
    return close < 0 ? -1 : close + 1;
  }
  if (c === "[" || c === "{") {
    const end = c === "[" ? "]" : "}";
    let i = skipSpace(line, at + 1);
    if (line[i] === end) return i + 1;
    for (;;) {
      if (c === "{") {
        const key = KEY_RE.exec(line.slice(i));
        if (!key) return -1;
        i += key[0].length;
      }
      i = valueEnd(line, i, depth + 1);
      if (i < 0) return -1;
      i = skipSpace(line, i);
      if (line[i] === ",") {
        i = skipSpace(line, i + 1);
        if (line[i] === end && c === "[") return i + 1;
        continue;
      }
      return line[i] === end ? i + 1 : -1;
    }
  }
  const bare = BARE_RE.exec(line.slice(at));
  return bare ? at + bare[0].length : -1;
}

function skipSpace(line: string, i: number): number {
  while (line[i] === " " || line[i] === "\t") i++;
  return i;
}

/** The three binding keys of a sealed meta body, read in the one grammar — or the faults it tears on. */
function readBindingKeys(body: string): { keys: Partial<Record<BindingKey, string>>; faults: FrameFault[] } {
  const keys: Partial<Record<BindingKey, string>> = {};
  const outside = OUTSIDE_RE.exec(body);
  if (outside) {
    const what = outside[0] === "﻿" ? "a byte-order mark" : outside[0].length === 3 ? `a multi-line string (\`${outside[0]}\`)` : "a control character";
    return { keys, faults: [split(`the sealed meta holds ${what} — the head binds only a meta whose every line reads whole by itself; nothing repairs it`)] };
  }
  const faults: FrameFault[] = [];
  let root = true;
  for (const line of body.split("\n")) {
    if (BLANK_OR_COMMENT_RE.test(line)) continue;
    if (HEADER_RE.test(line)) { root = false; continue; }
    const key = KEY_RE.exec(line);
    const end = key ? valueEnd(line, key[0].length) : -1;
    if (!key || end < 0 || !BLANK_OR_COMMENT_RE.test(line.slice(end))) {
      faults.push(split(`\`${line.trim()}\` — the head binds only a meta whose every line reads whole by itself (a blank, a comment, a header, or a bare \`key = value\` closing on its line); nothing repairs it`));
      continue;
    }
    if (!root) continue;
    const name = key[1]!.replace(/[ \t]/g, "");
    const head = name.split(".")[0]!;
    if (head !== "title" && head !== "uri-path" && head !== "namespace") continue;
    const canon = CANON_LINE_RE.exec(line);
    if (!canon || name !== head) {
      faults.push(split(`\`${line.trim()}\` — a \`${head}\` key binds the head only as \`${head} = "…"\` (a bare key, a basic string, no escape, nothing after it); nothing repairs it`));
    } else if (keys[head] !== undefined) {
      faults.push(split(`\`${head}\` stands twice in the sealed meta — the head binds against one`));
    } else {
      keys[head] = canon[2]!;
    }
  }
  return { keys, faults };
}

/**
 * The binding keys the sealed root meta names, as the frame reads them — `null` where no sealed root meta
 * stands, or where it reads outside the one grammar. The tw5 gate compares this with smol-toml's read.
 */
export function sealedBindingKeys(text: string, spans: readonly MaskSpan[] = fencedSpans(text)): SealedBindingKeys | null {
  const fence = rootMetaFence(text, spans);
  if (!fence) return null;
  const { keys, faults } = readBindingKeys(fence.body);
  return faults.length > 0 ? null : keys;
}

/**
 * How the head binds to the sealed root meta. Read over a frame that already divides (STX, ETX, no
 * fault); a caller outside the frame verdict gets the same reading from the same bytes.
 */
export function headBinding(text: string, spans: readonly MaskSpan[] = fencedSpans(text)): HeadBinding {
  const frame = readFrame(text, spans);
  const head = matchCarrierHead(text);
  if (!head || !frame.stx || !frame.etx) return { kind: "bound" };

  const fence = rootMetaFence(text, spans);
  const { keys, faults } = fence === null ? { keys: {} as Partial<Record<BindingKey, string>>, faults: [] } : readBindingKeys(fence.body);
  if (faults.length > 0) return { kind: "split", faults };

  const { title, "uri-path": uriPath, namespace } = keys;
  const viaPath = uriPath === undefined ? undefined : `lar:///${uriPath}`;
  if (title !== undefined && viaPath !== undefined && title !== viaPath) {
    faults.push(split(`the sealed meta names two places — title \`${title}\` and uri-path \`${uriPath}\` (\`${viaPath}\`)`));
  }
  const address = title ?? viaPath;
  const unbound: UnboundEnd[] = [];
  if (head.uri === "?") {
    if (address !== undefined) faults.push(split(`the head reads \`to=\`?\`\` where the sealed meta names \`${address}\` — the head dropped its address`));
  } else if (address === undefined) {
    unbound.push("to");
  } else if (head.uri !== address) {
    faults.push(split(`the head names \`${head.uri}\` where the sealed meta names \`${address}\` — the head moved outside the seal`));
  }

  if (namespace !== undefined) {
    if (decodeRefs(head.namespace ?? "") !== decodeRefs(namespace)) {
      faults.push(split(head.namespace === null
        ? `the head carries no namespace where the sealed meta names \`${namespace}\``
        : `the head's namespace \`${head.namespace}\` splits from the sealed meta's \`${namespace}\``));
    }
  } else if (head.namespace !== null) {
    unbound.push("namespace");
  }

  if (faults.length > 0) return { kind: "split", faults };
  return unbound.length > 0 ? { kind: "unbound", unbound } : { kind: "bound" };
}
