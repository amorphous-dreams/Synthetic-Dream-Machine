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
 *   · A split reads TORN, fault `head-meta-split`. A head naming what the sealed meta never names reads
 *     `unbound` — the verdict `head-unbound`, visible, never `match` and never a tear.
 *   · An unaddressed head (``to=`?` ``) claims no address: it binds only where the meta names none,
 *     and over a sealed title or uri-path it reads split — the head dropped the address the seal names.
 *   · No head at all claims nothing, and binds trivially.
 *
 * ── ONE SPELLING, BY A LEXICAL READ ──────────────────────────────────────────────────────────────
 * The frame parses no TOML (ruled: the meta rides the body, and the body reader owns its fields). It
 * needs three root keys, and reads them in the one spelling every emitter writes —
 *
 *     title = "…"          uri-path = "…"          namespace = "…"
 *
 * — a bare key, a basic string with no escape, nothing after the closing quote. A binding key in ANY
 * other spelling (quoted, dotted, doubled, a literal or multi-line string, an escape, a trailing
 * comment) tears rather than binds, because a TOML parser might read it otherwise, and a frame that
 * read one value while the body read another would hand an author two addresses for one carrier.
 * The tear costs nothing honest: the whole corpus writes the one spelling (measured, 2026-11-01).
 *
 * PYRE LEDGER: KEEP, both refusals here. `head-meta-split` refuses a live hostile form, a head that
 * names another place than its seal, and the one-spelling tear guards a parser differential (the
 * frame's read against a TOML read). Each guards a live invariant, so the pyre leaves both standing.
 *
 * The root meta is the body reader's own: the first live ```` ```toml meta ```` opener at or past STX's
 * end, through the fence mask, closed at its `\n```. It binds only when it closes before the ETX —
 * inside the span the check covers. Keys past the first `[table]` header are no root keys.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */

import { fencedSpans, maskedExecAll, type MaskSpan } from "./fence-mask.js";
import { META_OPEN_RE } from "./meta-fence.js";
import { matchCarrierHead } from "./head.js";
import { readFrame, type FrameFault } from "./span.js";

/** An end the sealed meta never names: the head's address, or its namespace. */
export type UnboundEnd = "to" | "namespace";

export type HeadBinding =
  | { readonly kind: "bound" }
  | { readonly kind: "split"; readonly faults: readonly FrameFault[] }
  | { readonly kind: "unbound"; readonly unbound: readonly UnboundEnd[] };

const BINDING_KEYS = ["title", "uri-path", "namespace"] as const;
type BindingKey = (typeof BINDING_KEYS)[number];

/** The one spelling a binding key binds in. */
const CANON_LINE_RE = /^(title|uri-path|namespace)[ \t]*=[ \t]*"([^"\\\n]*)"[ \t]*$/;
/** Whether a line's key part names a binding key in any spelling: bare, quoted, or dotted. */
const NAMES_KEY_RE = /^[ \t]*["']?[ \t]*(title|uri-path|namespace)[ \t]*["']?[ \t]*[.=]/;
/** A quoted key carrying an escape could spell any key at all; it never reads as "not a binding key". */
const ESCAPED_KEY_RE = /^[ \t]*["'][^=]*\\[^=]*=/;
const TABLE_RE = /^[ \t]*\[/;

const split = (message: string): FrameFault => ({ kind: "head-meta-split", message });

/** Numeric character references read as the characters they name — a head writes glyphs, a meta entities. */
function decodeRefs(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]{1,6});/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]{1,7});/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)));
}

/** The sealed root meta's body, or null where none closes inside the span. */
function sealedMetaBody(text: string, spans: readonly MaskSpan[], from: number, to: number): string | null {
  const open = maskedExecAll(text, META_OPEN_RE, spans, true).find((m) => m.index >= from);
  if (!open) return null;
  const bodyStart = open.index + open[0].length;
  const closeAt = text.indexOf("\n```", bodyStart);
  if (closeAt < 0 || closeAt + 4 > to) return null;
  return text.slice(bodyStart, closeAt);
}

/** The three binding keys, read in their one spelling — or the faults a deviant spelling carries. */
function readBindingKeys(body: string): { keys: Partial<Record<BindingKey, string>>; faults: FrameFault[] } {
  const keys: Partial<Record<BindingKey, string>> = {};
  const faults: FrameFault[] = [];
  let inMulti: '"""' | "'''" | null = null;
  for (const line of body.split("\n")) {
    // A multi-line string's interior holds no key, whatever it spells.
    if (inMulti) {
      if (line.split(inMulti).length % 2 === 0) inMulti = null;
      continue;
    }
    if (TABLE_RE.test(line)) break;
    const names = NAMES_KEY_RE.exec(line);
    if (names || ESCAPED_KEY_RE.test(line)) {
      const canon = CANON_LINE_RE.exec(line);
      const key = (canon?.[1] ?? names?.[1]) as BindingKey | undefined;
      if (!canon) {
        faults.push(split(`\`${line.trim()}\` — a ${key ? `\`${key}\`` : "binding"} key binds the head only as \`${key ?? "title"} = "…"\` (a bare key, a basic string, no escape, nothing after it); nothing repairs it`));
      } else if (keys[key!] !== undefined) {
        faults.push(split(`\`${key}\` stands twice in the sealed meta — the head binds against one`));
      } else {
        keys[key!] = canon[2]!;
      }
    }
    for (const q of ['"""', "'''"] as const) if (line.split(q).length % 2 === 0) { inMulti = q; break; }
  }
  return { keys, faults };
}

/**
 * How the head binds to the sealed root meta. Read over a frame that already divides (STX, ETX, no
 * fault); a caller outside the frame verdict gets the same reading from the same bytes.
 */
export function headBinding(text: string, spans: readonly MaskSpan[] = fencedSpans(text)): HeadBinding {
  const frame = readFrame(text, spans);
  const head = matchCarrierHead(text);
  if (!head || !frame.stx || !frame.etx) return { kind: "bound" };

  const body = sealedMetaBody(text, spans, frame.stx.end, frame.etx.index);
  const { keys, faults } = body === null ? { keys: {} as Partial<Record<BindingKey, string>>, faults: [] } : readBindingKeys(body);
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
