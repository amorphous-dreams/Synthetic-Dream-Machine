/**
 * carrier-check — what a carrier's bytes owe beyond the frame verdict, read from the bytes alone.
 *
 * The deserializer is the PURE meme→tiddlers function (the TW5 `tiddlerdeserializer` contract: text
 * in, fields out); it verifies nothing and stamps no reading onto a record. The frame's own verdict —
 * match · stale · absent · torn · bare — is `@lararium/memetic-frame`'s `verdict`. What remains is
 * this module's: the checks that read the carrier's slots and its authored meta against the frame.
 * The ingest gate composes it into `memeticIngestOps.deserialize`, so every caller of the memetic
 * congruence hears one decision.
 *
 * NOT a meme law: the plugin packs `meme-laws` as one library the deserializer itself requires, and a
 * check that reads the deserializer's own regions would close a cycle there.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */

import { classifyPostamble, fencedSpans, frameAlt, markCode, maskedExec, maskedExecAll, readFrame } from "@lararium/memetic-frame";
import { SOH_PREFIX_RE, carrierTexts, divideCarrier, findMetaFence } from "./deserializer.js";
import { findTopLevelAhuBlocks, childUri } from "./meme-ast/ahu-scan.js";
import { MEMETIC_SOURCE, shoreDiagnostic, type MemeDiagnostic } from "./meme-ast/diagnostics.js";
import { parseTaploFields } from "./toml-ast.js";

const ETX_CODE = markCode("ETX");
/** The ETX entity ALONE — the fence-swallow check asks only whether a closer stands at all. */
const ETX_ENTITY_SRC = frameAlt("ETX");

function error(code: string, message: string, length: number): MemeDiagnostic {
  return { from: 0, to: length, severity: "error", source: MEMETIC_SOURCE, code, message };
}

/**
 * WHAT MAY STAND BETWEEN ETX AND EOT — the block check, and nothing else.
 *
 * ETX ends the text; the slot after it carries the check, never payload (memetic-frame `check.ts`
 * holds the why). Content there reaches no reader and no render reproduces it: two `#edges` blocks
 * vanished that way before anyone diffed a round-trip. So the slot is classified, and foreign content
 * is the NAK the original protocol answered with. The LAST carrier owns the file's tail, so the slot
 * read is that carrier's own.
 */
function strandedPastEtx(text: string): MemeDiagnostic[] {
  if (!maskedExec(text, SOH_PREFIX_RE)) return [];
  const lastSoh = maskedExecAll(text, new RegExp(SOH_PREFIX_RE.source, "g")).at(-1);
  const from = lastSoh ? lastSoh.index : 0;
  const tail = readFrame(text.slice(from));
  if (!tail.etx || !tail.eot) return [];
  const slot = classifyPostamble(text.slice(from + tail.etx.end, from + tail.eot.index));
  if (slot.kind !== "foreign") return [];
  return [error("postamble-content",
    `${slot.lines} line(s) stand between ETX and EOT. The text ends at ETX; that slot `
    + `carries the block check alone. Move the content above the \`<<^ code="${ETX_CODE}">>\` close.`, text.length)];
}

/**
 * A closer swallowed by an UNCLOSED fence tail would ride into the body as CONTENT, and every render
 * would append a fresh closer pair, doubling without bound — fence-teaching docs CommonMark itself
 * misread showed it. A closer inside a properly CLOSED fence is deliberate quotation: benign.
 */
function swallowedEtx(uri: string, noSoh: string, closed: boolean): string[] {
  if (closed || !new RegExp(ETX_ENTITY_SRC).test(noSoh)) return [];
  const spans = fencedSpans(noSoh);
  const tail = spans.at(-1);
  if (!tail || tail.end !== noSoh.length) return [];
  for (const m of noSoh.matchAll(new RegExp(ETX_ENTITY_SRC, "g"))) {
    if (m.index >= tail.start) {
      return [`${uri}: carrier close (${ETX_CODE}) sits inside an UNCLOSED code fence — `
        + `closers will double on every round trip. Check fence balance `
        + `(quote fences inside fences with a LONGER outer run).`];
    }
  }
  return [];
}

const TEXT_KEY = (context: string): string => `${context}: "text" in TOML ignored (derived from body)`;

/** A meta block's TOML keys, as the deserializer reads them. */
const tomlOf = (fence: { readonly content: string } | null): Record<string, unknown> =>
  fence ? parseTaploFields(fence.content) : {};

/**
 * Every slot's meta, full depth, in the order the split visits them (a slot's own children first):
 * an authored `text` key is ignored there — the body is the text — and named here.
 */
function slotTextKeys(parent: string, text: string, out: string[]): void {
  for (const block of findTopLevelAhuBlocks(text)) {
    const child = childUri(parent, block.slot);
    const body = text.slice(block.bodyStart, block.bodyEnd);
    slotTextKeys(child, body, out);
    const meta = findMetaFence(body, false);
    if (meta && body.slice(0, meta.start).trim() === "" && "text" in tomlOf(meta)) out.push(TEXT_KEY(child));
  }
}

/**
 * THE AUTHORING ADVISORIES — what the split reads past without losing a byte, and a person must
 * still settle: a closer swallowed by a fence, root meta standing before STX (or on both sides of it),
 * a root `title`/`uri-path` naming another address than the head, a `text` key the body overrides.
 */
function advisories(uri: string, text: string): string[] {
  const out: string[] = [];
  const d = divideCarrier(text);
  out.push(...swallowedEtx(uri, d.noSoh, d.frame.etx !== null));
  const header = tomlOf(d.headerMeta);
  const body = tomlOf(d.bodyMeta);
  if ("text" in header) out.push(TEXT_KEY(uri));
  if ("text" in body) out.push(TEXT_KEY(uri));
  if (d.headerMeta) out.push(`${uri}: root TOML metadata stands before STX; the carrier body begins at STX`);
  if (d.headerMeta && d.bodyMeta) out.push(`${uri}: duplicate root TOML metadata appears before and after STX`);
  const root = { ...header, ...body };
  if (root["title"] !== undefined && String(root["title"]) !== uri) {
    out.push(`${uri}: root TOML title "${String(root["title"])}" does not match SOH target "${uri}"`);
  }
  if (root["uri-path"] !== undefined) {
    const expected = uri.startsWith("lar:///") ? uri.slice(7) : uri;
    if (String(root["uri-path"]) !== expected) {
      out.push(`${uri}: root TOML uri-path "${String(root["uri-path"])}" does not match SOH target path "${expected}"`);
    }
  }
  slotTextKeys(uri, d.recoveredBody, out);
  return out;
}

/** Every check a carrier's bytes owe beyond the frame verdict, on the shared diagnostics channel. */
export function checkCarrier(uri: string, text: string): MemeDiagnostic[] {
  // THE SAME TOLERANT READ THE DESERIALIZER TAKES: a leading BOM and foreign line endings fold once,
  // so a check reads the bytes the records were built from.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.includes("\r")) text = text.replace(/\r\n?/g, "\n");
  const out = strandedPastEtx(text);
  for (const carrier of carrierTexts(text, uri)) {
    for (const line of advisories(carrier.uri, carrier.text)) out.push(shoreDiagnostic(line, text.length));
  }
  return out;
}
