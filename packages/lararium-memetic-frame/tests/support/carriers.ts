/**
 * THE ONE CARRIER BUILDER FOR TESTS — every suite that needs a framed carrier builds it HERE, through
 * the frame's own writers (`frameCarrier`, `headSigil`, `markSigil`, `releaseSigil`).
 *
 * A hand-typed carrier pins the grammar of the day it was typed. When the corpus moved from quoted
 * values to ticked, named ones (Train Q, the kupono cut), about a hundred test files held the old ends
 * as literals and each one moved by hand. A suite that builds through the writer moves with it: the
 * next grammar move edits `write.ts` and nothing here.
 *
 * Other packages import this file by its relative path (`../../lararium-memetic-frame/tests/support/
 * carriers.js`), the same way they reach a sibling's other test fixtures.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */
import {
  CARRIER_DECLARATION, frameCarrier, headSigil, markSigil, releaseSigil,
  type FrameCarrierInput, type FrameHeadSpec,
} from "../../src/index.js";

export { CARRIER_DECLARATION, frameCarrier, headSigil, markSigil, releaseSigil };

/** The declaration line, as the writer mints it. */
export const DOCTYPE = CARRIER_DECLARATION;
/** ``<<^ code=`&#x0002;`>>`` — text begins. */
export const STX = markSigil("STX");
/** ``<<^ code=`&#x0003;`>>`` — text ends; the check follows it directly. */
export const ETX = markSigil("ETX");
/** ``<<^ code=`&#x0004;` to=`?`>>`` — the release. */
export const EOT = releaseSigil();

/** The head for `uri`, ticked, `from` before `to`. */
export function head(uri: string, opts: Omit<FrameHeadSpec, "uri"> = {}): string {
  return headSigil({ uri, ...opts });
}

/** A whole carrier, stamped with its check — the writer's own output. */
export function carrier(uri: string, body: string, opts: Omit<FrameCarrierInput, "head" | "body"> & Omit<FrameHeadSpec, "uri"> = {}): string {
  const { namespace, kapu, ...rest } = opts;
  return frameCarrier({ head: { uri, ...(namespace !== undefined ? { namespace } : {}), ...(kapu ? { kapu } : {}) }, body, ...rest });
}

/**
 * A whole carrier with NO check in its slot — the shape an author hands in before the writer stamps it,
 * and the shape most readers are fed. Same padding as the writer's.
 */
export function unstampedCarrier(uri: string, body: string, opts: Omit<FrameHeadSpec, "uri"> & { declaration?: string | null } = {}): string {
  const { declaration, ...headOpts } = opts;
  const decl = declaration === undefined ? DOCTYPE : declaration;
  return `${decl === null ? "" : `${decl}\n\n`}${head(uri, headOpts)}\n${STX}\n\n${body}\n\n${ETX}\n\n${EOT}\n`;
}
