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

import { classifyPostamble, fencedSpans, frameAlt, markCode } from "@lararium/memetic-frame";
import { findMetaFence, type CarrierRead, type CarrierReading } from "./deserializer.js";
import { findTopLevelAhuBlocks, type AhuBlock } from "./meme-ast/ahu-scan.js";
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
function strandedPastEtx(reading: CarrierReading): MemeDiagnostic[] {
  const slot = classifyPostamble(reading.slotText);
  if (slot.kind !== "foreign") return [];
  return [error("postamble-content",
    `${slot.lines} line(s) stand between ETX and EOT. The text ends at ETX; that slot `
    + `carries the block check alone. Move the content above the \`<<^ code="${ETX_CODE}">>\` close.`, reading.text.length)];
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
 *
 * READ relation: `rootUri` stays the CARRIER root across the whole recursion — a nested open already
 * carries its WHOLE path from that root (canon), so the child's address is `rootUri + block.slot`
 * verbatim, never `childUri`'s MINT composition (which would double a shared segment under a deeper
 * `parent`).
 */
function slotTextKeys(rootUri: string, text: string, blocks: readonly AhuBlock[], out: string[]): void {
  for (const block of blocks) {
    const child = rootUri + block.slot;
    const body = text.slice(block.bodyStart, block.bodyEnd);
    slotTextKeys(rootUri, body, findTopLevelAhuBlocks(body), out);
    const meta = findMetaFence(body, false);
    if (meta && body.slice(0, meta.start).trim() === "" && "text" in tomlOf(meta)) out.push(TEXT_KEY(child));
  }
}

/**
 * NESTED-SLOT-OUTSIDE-PARENT — canon: a nested open carries its WHOLE path from the carrier root, so
 * it must stand a STRICT DESCENDANT of its enclosing open's path. Three shapes fault here, each a
 * tolerance the no-back-compat law forbids a reader from silently resolving:
 *   - a RELATIVE form (`#/fern` inside `#/ridge`, meant as `#/ridge/fern`) — unnormalized authoring;
 *   - an address EQUAL to its parent (`#/a` inside `#/a`) — a collision with the parent's own address;
 *   - a DIFFERENT BRANCH entirely (neither equal nor a descendant).
 * `normalizeMemeSource` is where an authored relative/flat form gets rewritten to the full-path
 * nested chain — an author runs normalize, this check never tolerates the unnormalized form.
 */
function isStrictDescendant(slot: string, parent: string): boolean {
  return slot !== parent && slot.startsWith(`${parent}/`);
}

function nestedSlotOutsideParent(
  uri: string, text: string, blocks: readonly AhuBlock[], enclosing: string | null, out: MemeDiagnostic[],
): void {
  for (const block of blocks) {
    if (enclosing !== null && !isStrictDescendant(block.slot, enclosing)) {
      out.push(error("nested-slot-outside-parent",
        `${uri}: nested slot "${block.slot}" is not a strict descendant of its enclosing slot `
        + `"${enclosing}" — a nested open carries its whole address from the carrier root. `
        + `Run normalize to rewrite the authored form into the full-path nested chain.`, text.length));
    }
    const body = text.slice(block.bodyStart, block.bodyEnd);
    nestedSlotOutsideParent(uri, body, findTopLevelAhuBlocks(body), block.slot, out);
  }
}

/**
 * THE AUTHORING ADVISORIES — what the split reads past without losing a byte, and a person must
 * still settle: a closer swallowed by a fence, a root `title`/`uri-path` naming another address than
 * the head, a `text` key the body overrides. (Root meta above STX is the frame verdict's tear.)
 */
function advisories(read: CarrierRead): string[] {
  const { uri, division: d } = read;
  const out: string[] = [];
  out.push(...swallowedEtx(uri, d.noSoh, d.frame.etx !== null));
  const root = tomlOf(d.bodyMeta);
  if ("text" in root) out.push(TEXT_KEY(uri));
  if (root["title"] !== undefined && String(root["title"]) !== uri) {
    out.push(`${uri}: root TOML title "${String(root["title"])}" does not match SOH target "${uri}"`);
  }
  if (root["uri-path"] !== undefined) {
    const expected = uri.startsWith("lar:///") ? uri.slice(7) : uri;
    if (String(root["uri-path"]) !== expected) {
      out.push(`${uri}: root TOML uri-path "${String(root["uri-path"])}" does not match SOH target path "${expected}"`);
    }
  }
  slotTextKeys(uri, d.body, read.scan.blocks, out);
  return out;
}

/**
 * Every check a carrier's bytes owe beyond the frame verdict, on the shared diagnostics channel — read
 * off the deserializer's own reading, so a check judges exactly the division, scan and slot the records
 * were built from and never reads the bytes a second time.
 */
export function checkCarrier(reading: CarrierReading): MemeDiagnostic[] {
  const out = strandedPastEtx(reading);
  for (const read of reading.reads) {
    for (const line of advisories(read)) out.push(shoreDiagnostic(line, reading.text.length));
    nestedSlotOutsideParent(read.uri, read.division.body, read.scan.blocks, null, out);
  }
  return out;
}
