/**
 * uds-channel — the co-located fast path of the lares↔lararium binding.
 *
 * The daemon already holds the WARM daemon replica and the worker VerbDispatcher. A co-located `lares` CLI hands the
 * daemon a capability-bearing invocation over this Unix-domain socket and awaits the answer: one-shot maintenance frames
 * and bound session frames. The daemon hands an invocation to its worker over the direct channel; the worker puts the
 * whole outcome in the vessel's answer ring (memory alone) and, for a write, a verdict row in the vessel's CONTROL
 * document (`control-home`), which no recipe composes and no mirror names. No receipt rests: what the door holds about a
 * request id in this life lives in its ask book (lar:///ha.ka.ba/lararium/mesh/receipt-ledger).
 *
 *   transport  = this socket (kernel-local, authority-agnostic)
 *   authority  = the session's verified face and worker-held profile on a bound socket;
 *                a one-shot maintenance invocation follows the worker's verify-then-delegate gate
 *   record     = the answer ring, a write's verdict row, an effect's effect row
 *
 * THE CHANNEL SERVES ITS VESSEL'S CLAIM. The vessel claimed the store's rendezvous name before it opened its Repo
 * (`claimStore`), and that one socket answers here once the vessel serves verbs: no second bind, and no unlink of a path
 * some other holder answers at.
 *
 * Auth: socket perms 0600 (owner-only) gate PRESENCE. A session socket binds its session to the verified face
 * (`SessionTable.checkBound`); a remote peer meets the sealed face gate on the WS path.
 * See lar:///ha.ka.ba/lararium/api/lares-lararium-binding.
 *
 * The modules live under `uds-channel/` (DAM checklist: lar:///ha.ka.ba/lararium/mesh/uds-channel-dam); this file names
 * the surface every caller imports.
 * Heleuma ha: see lararium/mesh/uds-channel-composer.
 */

export {
  SLOW_DOOR_CALL_MS, sameAnchor,
  type RestOwedBand, type UdsChannelOptions, type UdsSessionSigner, type UdsSessionSupply, type SessionAnchor, type UdsSessionDoor,
  type Invocation, type DoorGate, type ReceiptAnswer, type UdsChannel, type UdsSeat, type UdsFront,
} from "./uds-channel/shapes.js";
export { mergeCallTouches, touchedOfField, heldAsk, VesselWaitExpired, toldOutcome, withheldVisit } from "./uds-channel/outcome.js";
export { AskBook, type AskEntry, type AskVerdict } from "./uds-channel/ask-book.js";
export { boundVerdictRows, VERDICT_ROW_COUNT, VERDICT_ROW_SHED, type VerdictRowBound } from "./uds-channel/row-bound.js";
export { serveUdsFront } from "./uds-channel/front.js";
export { makeUdsSeat, startUdsChannel } from "./uds-channel/seat.js";
