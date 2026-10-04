/**
 * @lararium/memetic-frame — the memetic carrier FRAME, and only the frame.
 *
 * A carrier is a body inside a frame. The frame — declaration, head, STX/ETX bounds, the block check,
 * the release — is a law over bytes that needs no grammar table, no TOML parser and no store, so it
 * lives here with a single dependency (`@noble/hashes`) and reaches every context a carrier travels
 * to: a vessel, a browser island, a stock TiddlyWiki (as ONE library tiddler), a relay that holds
 * `pull` and not `read`.
 *
 * What is NOT here, by ruling: the sigil grammar tables, TOML meta parsing, and turn-harvest kinds.
 * The meta block rides INSIDE the body; reading it is the body reader's concern.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */

export { FRAME_MARKS, FRAME_CODES, frameMark, frameHex, frameAlt, type FrameMark } from "./marks.js";
export {
  fencedSpans, inMask, inMaskInterior, maskedExec, maskedExecAll, fenceLineOpen, fenceLineClose,
  type MaskSpan,
} from "./fence-mask.js";
export { META_OPEN_CANON, META_OPEN_RE, META_OPEN_LINE_RE, PLAIN_OPEN_RE, isCanonicalMetaOpen } from "./meta-fence.js";
export {
  carrierHeadPattern, carrierHeadLinePattern, carrierMarkPattern, carrierReleasePattern,
  matchCarrierHead, matchCarrierMark, matchCarrierHeadLine, headUriOf,
  type CarrierHead, type CarrierMark,
} from "./head.js";
export {
  frameMarks, readFrame, frameStanding, checkSpan,
  type MarkHit, type FrameMarks, type FrameRead, type FrameFault, type FrameStanding,
} from "./span.js";
export {
  CHECK_ALG, bccOfSpan, nihOfSpan, bccOf, verifyBcc, BCC_RE, classifyPostamble, classifyPostEot,
  type Postamble,
} from "./check.js";
export {
  CARRIER_DECLARATION, markCode, headSigil, frameCarrier, stampCarrier,
  type FrameHeadSpec, type FrameCarrierInput,
} from "./write.js";
