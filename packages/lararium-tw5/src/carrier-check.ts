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

import { classifyPostamble, markCode, maskedExec, maskedExecAll, readFrame } from "@lararium/memetic-frame";
import { SOH_PREFIX_RE } from "./deserializer.js";
import { MEMETIC_SOURCE, type MemeDiagnostic } from "./meme-ast/diagnostics.js";

const ETX_CODE = markCode("ETX");

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

/** Every check a carrier's bytes owe beyond the frame verdict, on the shared diagnostics channel. */
export function checkCarrier(_uri: string, text: string): MemeDiagnostic[] {
  // THE SAME TOLERANT READ THE DESERIALIZER TAKES: a leading BOM and foreign line endings fold once,
  // so a check reads the bytes the records were built from.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.includes("\r")) text = text.replace(/\r\n?/g, "\n");
  return strandedPastEtx(text);
}
