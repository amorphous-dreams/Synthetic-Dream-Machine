/**
 * THE VERB DOOR'S SEAT (`makeUdsSeat`): one composition's hold on the verb socket. It reads each line or session frame,
 * gates it (the engine's fall, a locked control document, the hand and seat walls, the chore face, a visit's target, the
 * face's actor), arbitrates its request id in memory (`AskBook`, beside the answer ring and a write's verdict row), hands
 * the invocation to the daemon island over the direct channel, and answers once the outcome lands. No receipt rests: a
 * same-id re-ask reads the ring or the row, joins a running ask, or runs again where neither names it.
 * Heleuma ha: see lararium/mesh/uds-channel-seat.
 */

import type { Socket } from "node:net";
import { crossFaceTargetAtDoor, faceRefOrdinal, namedFaceOf, seatFaceRefusal, seatKindOf, seatRefusalClass } from "../seat-hand.js";
import { peerKindOf, peerSeatOf, type PeerKind } from "../uds-peer.js";
import { handRefusalOf } from "../hand-act-gate.js";
import { HEARTH_CLOSING, HEARTH_ROSTER_VERB, hearthRosterOf } from "../hearth-roster-read.js";
import { choreAtDoor, entersADrain, isChore } from "../chore-face.js";
import type { ChoreReceiptMark } from "@lararium/mesh/chore-ask";
import { FLOOR_VERBS } from "../floor-verbs.js";
import { NoWorkingLayerRefusal } from "@lararium/mesh/composite-store";
import { newRequestId, verbInputDigest } from "@lararium/mesh/verb-tiddler";
import { CONTROL_HOME_ID } from "@lararium/mesh/lar-uris";
import { ControlHomeUnavailable, controlHomeRefusal, assertControlHomeOpen, answerRingOf } from "@lararium/mesh/control-home";
import { SessionTable, sessionBinding, type SessionBinding, type Hand } from "@lararium/mesh/session-contract";
import { faceScopedId } from "@lararium/mesh/face-scoped-id";
import { type DurabilityReceipt } from "@lararium/mesh/durability-receipt";
import { switchSession, type SwitchIntent, type SwitchOutcome } from "@lararium/mesh/session-switch";
import { ingestWaveRefusal } from "@lararium/mesh/ingest-wave-budget";
import { answersUntracked, inCallScope, ridesAnswerRing, takeCallTouches, takeCallUntracked, READ_VERBS, type CallTouches } from "@lararium/mesh/call-touches";
import type { VisitTicket, WorkTicket } from "../face-lifecycle.js";
import { ENGINE_TERMINATED, engineTerminatedRefusal } from "../engine-watch.js";
import { AskBook } from "./ask-book.js";
import { serveUdsFront } from "./front.js";
import { makeOutcomeReads } from "./outcome-reads.js";
import { boundVerdictRows } from "./row-bound.js";
import { heldAsk, inputDigestOf, isCancelQuery, isReceiptQuery, mergeCallTouches, reusedWithChangedInput, toldOutcome, touchedOfField, VesselWaitExpired, withheldVisit } from "./outcome.js";
import { makeDoorReceipts } from "./receipts.js";
import { sameAnchor, SLOW_DOOR_CALL_MS, type DoorGate, type Invocation, type RestOwedBand, type SessionAnchor, type UdsChannel, type UdsChannelOptions, type UdsSeat, type UdsSessionSigner, type UdsSessionSupply } from "./shapes.js";

export function makeUdsSeat(opts: UdsChannelOptions): UdsSeat {
  const { controlHandle, claim } = opts;
  const floorVerbs = opts.floorVerbs ?? FLOOR_VERBS;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const log = opts.onLog ?? (() => { /* quiet */ });
  /**
   * A DOOR CALL THAT RAN LONG SAYS WHERE ITS TIME WENT, one line: the span from this seat's read of the line to its admitted
   * arbitration (the peer reading, the target, the digest, the ring and row reads), and the span on the island until the
   * outcome landed. Monotonic readings (`performance.now()`), an annotation alone: no reading here admits, refuses or ends
   * anything, and a call under {@link SLOW_DOOR_CALL_MS} says nothing.
   */
  const noteSlowCall = (verb: string, requestId: string, readAt: number, admittedAt: number): void => {
    const landedAt = performance.now();
    if (landedAt - readAt < SLOW_DOOR_CALL_MS) return;
    log(`slow door call "${verb}" (request ${requestId}): ${Math.round(admittedAt - readAt)} ms from the read to the dispatch, ${Math.round(landedAt - admittedAt)} ms on the island until its outcome landed`);
  };

  // The verdict rows a write leaves rest in the vessel's control document, the control store's one default writable.
  const composite = opts.control;
  if (composite.defaultWritableBagId() !== CONTROL_HOME_ID) {
    throw new NoWorkingLayerRefusal("Opening the UDS channel", "Stand the vessel's control document (`standControlHome`) as the control store's default writable first.");
  }

  // THE OWNER'S EPOCH IS THE VESSEL'S LIFE (session-contract): one name for one relation, minted by the store claim.
  const ownerEpoch = claim.life;
  // NO RECEIPT CLAIMS DURABILITY OVER MEMORY: a stand-in control handle (the vessel's key shut) refuses by name, never
  // answers heads a save still holds.
  const settleDurably = async (): Promise<DurabilityReceipt> => {
    assertControlHomeOpen(controlHandle);
    const heads = controlHandle.heads();
    await opts.repo.flush([controlHandle.documentId]);
    return { docUrl: controlHandle.url, heads, ownerEpoch };
  };

  // THE ANSWER RING (`control-home` `answerRingOf`): the whole outcomes of the verbs this vessel ran, in memory alone. The
  // island hands each across as it concludes; the control document rests a write's verdict row and no body.
  const reads = makeOutcomeReads({ composite, controlHandle, ring: answerRingOf(composite), timeoutMs });
  const { heldFieldsOf, rowFieldsOf, retrievedOutcome, awaitOutcome, outcomeLanded } = reads;
  // THE ASK BOOK: what this door holds in memory about each request id it met in this life (running, abandoned, an act's
  // verdict). An answer that lands in the ring marks the running entry landed: the ring answers from then on.
  const book = new AskBook();
  const unsubLanded = reads.onAnswer((requestId) => book.landed(requestId));
  const { answerReceipt, settledReceipt, sessionReceipt } = makeDoorReceipts({ reads, book, ownerEpoch, settleDurably, log });
  // THE VERDICT ROWS HOLD A COUNT (`row-bound`): the newest rows stay, the oldest leave whole with their effect rows.
  const rowBound = boundVerdictRows({ composite, bagId: CONTROL_HOME_ID, open: () => controlHomeRefusal(controlHandle) === null, onFault: log });

  // Hand the invocation (verb + args CONTENT) to the daemon worker over the DIRECT
  // MessageChannel (placeVerb → the worker's volatile invocation), then await the
  // outcome via the answer ring and the control store's change events. The carriers NEVER enter
  // the daemon's documents. A co-located CLI shares the worker's process, so the CRDT summons
  // (the remote-peer transport) would be a pointless content-bloating round-trip.
  const runVerb = async (inv: Invocation, requestId: string, needsRow = false): Promise<Record<string, unknown>> => {
    reads.owe(requestId);
    opts.placeVerb({
      origin: "channel",
      verb:        inv.verb,
      args:        inv.args ?? {},
      requestedBy: inv.requestedBy,
      requestId,
      ...(inv.face !== undefined && { face: inv.face }),
      ...(inv.face !== undefined && inv.ordinal !== undefined && { ordinal: inv.ordinal }),
      ...(inv.asker !== undefined && { asker: inv.asker }),
      ...(inv.chore !== undefined && { chore: inv.chore }),
      ...(inv.effectKey !== undefined && { effectKey: inv.effectKey }),
    });
    try { return await awaitOutcome(inv.verb, requestId, inv.timeoutMs, needsRow); }
    finally { opts.retireAsk?.(requestId); }
  };

  /** The held asks (`heldAsk`) dispatched here and still holding, by their scoped request id: a withdrawal reaches these alone. */
  const heldInFlight = new Set<string>();

  /**
   * A CANCEL ASKS; IT NEVER COMMANDS (lar:///ha.ka.ba/lararium/mesh/receipt-ledger#/three-receipts). Where nothing this
   * vessel holds names the id (no answer in the ring, no verdict row, no entry in the book), the book marks it abandoned,
   * so a later dispatch under it in this life refuses. A cancel that meets a running ask or a landed outcome changes nothing.
   */
  const cancelAsk = async (requestId: string): Promise<void> => {
    const row = await rowFieldsOf(requestId);
    // One turn from here: the ring read and the book's own check, so an answer that landed during the row read wins.
    if (row === null && heldFieldsOf(requestId) === null) book.abandon(requestId);
  };

  // EVERY FRAME THIS SEAT HOLDS, until its answer leaves or its caller goes. A seat that closes waits these out:
  // a request mid-arbitration or mid-wait finishes against the book and worker it started on.
  // `arbitrating` counts the frames still inside their own digest / arbitration turn, so a caller that hangs up early
  // never lets the seat read as drained while its arbitration still reads.
  const inFlight = new Set<Socket>();
  const table = new SessionTable(ownerEpoch);
  let closing = false;
  /** The event that ends every hearth-roster plane read still open: the seat's close fires it (`HEARTH_CLOSING`). */
  let interruptRosters: (reason: string) => void = () => {};
  const rosterInterrupt = new Promise<string>((resolve) => { interruptRosters = resolve; });
  /** Flush, then drop: a session's signer leaves only after every save it booked rested sealed. */
  const flushThenDrop = async (signer: UdsSessionSigner | undefined): Promise<void> => {
    if (!signer) return;
    try { await opts.beforeSignerDrops?.(signer); } catch { /* a refused flush keeps its changes in memory; the drop still lands */ }
    opts.signers?.unseat(signer);
    signer.drop();
  };
  const sessionSockets = new Map<Socket, { binding: SessionBinding; sessionId?: string; hand?: Hand; unattested?: boolean; anchor?: SessionAnchor; supply?: UdsSessionSupply; signer?: UdsSessionSigner }>();
  // THE HAND GATE'S READER (`hand-act-gate` reads the same `peerKindOf`): each line or session reads its peer once here and books
  // the reading (the seat's hand, the `cli` asker, or none and unattested), the gate's cached reading for every verb downstream.
  const kindOfPeer = opts.peerKind ?? peerKindOf;
  const sessionTurns = new Map<Socket, Promise<void>>();
  const sessionReply = (sock: Socket, answer: Record<string, unknown>): void => {
    try { sock.write(JSON.stringify(answer) + "\n"); } catch { /* gone */ }
  };
  // The lent set, or null where none reads (no reader, or custody shut): the seat then falls to the worn rule.
  const lentOf = async (): Promise<readonly number[] | null> => {
    if (!opts.lentOrdinals) return null;
    try { return await opts.lentOrdinals(); } catch { return null; }
  };
  const sessionRefuse = (sock: Socket, refusal: string, requestId?: string, message?: string): void =>
    sessionReply(sock, { kind: "session:refused", ...(requestId !== undefined && { requestId }), refusal, ...(message !== undefined && { message }) });
  /** The daemon mount's ordinal, or null where no mount reads (no reader, or the floor): the chore gate then stands aside. */
  const mountOf = (): number | null => opts.mountOrdinal?.() ?? null;
  /** The refusal a face the actor will not admit reads: closing while its close runs, dark by name where its light refused, shut otherwise. */
  const shutRefusal = (face: number, what: string): { readonly ok: false; readonly refusal: string; readonly message: string } => {
    let line: string | null = null;
    try { line = opts.faceDark?.(face) ?? null; } catch { line = null; }
    if (opts.faceLife?.state(face).kind === "closing") {
      // A CLOSE THE ISLAND'S REFUSAL BEGAN THAT HOLDS OVER UNSEALED SAVES names itself and the line that drives it again.
      return { ok: false, refusal: "face-closing", message: line !== null ? `face-closing: ${line}; no ${what} ran` : `face-closing: face h${face} is closing on this vessel; its saves drain and it takes no new ${what}` };
    }
    return { ok: false, refusal: "face-not-open", message: line !== null ? `face-not-open: ${line}; no ${what} ran` : `face-not-open: face h${face} stands shut on this vessel, and no ${what} ran` };
  };
  /** The face a call VISITS: a visit verb naming, as its numeric `target`, a face other than the one it wears; else null. */
  const visitTargetOf = (worn: number | null, verb: string, args: Record<string, unknown> | undefined): number | null =>
    opts.visitVerbs?.has(verb) && typeof args?.["target"] === "number" && args["target"] !== worn ? args["target"] : null;
  /**
   * A LIT FACE RECEIVES VISITS (`crossFaceTargetAtDoor`): a target named by ordinal or pet name resolves to its ordinal, a private
   * bag refuses first, a target naming the worn face leaves the args, and a write naming another face refuses, all before the
   * gate; whether the target stands lit its own actor answers (`gateFor`). Answers the args the call carries on, or a refusal.
   */
  const resolveTarget = (verb: string, args: Record<string, unknown> | undefined, worn: number | null) =>
    crossFaceTargetAtDoor({ verb, args, worn, ...(opts.petnames ? { petnames: opts.petnames } : {}) });
  /**
   * The gate a session call meets at its dispatch: a VISIT (a visit verb naming another face as its numeric `target`) admits on
   * the target's actor; any other call admits as work on the face the session wears. A face the vessel never knew passes ungated.
   */
  const gateFor = (worn: number, verb: string, args: Record<string, unknown>): DoorGate | null => {
    const life = opts.faceLife;
    if (!life) return null;
    const target = visitTargetOf(worn, verb, args);
    if (target !== null) {
      return { visit: true, admit: (refuse) => {
        const visit = life.admitVisit(target, refuse);
        return visit !== null ? { ok: true, visit } : shutRefusal(target, "visit");
      } };
    }
    return workGate(worn);
  };
  /**
   * WORK ON A FACE HOLDS ITS CLOSE, whichever door it came by: a session's verb on the face it wears, or a one-shot line's verb
   * on the face it acts as (the face it names, or the mount). It admits on that face's actor at dispatch, so no write enters a
   * drain; a face closing refuses `face-closing`, a shut one `face-not-open`. A face the vessel never knew passes ungated.
   */
  const workGate = (face: number): DoorGate | null => {
    const life = opts.faceLife;
    if (!life?.known(face)) return null;
    return { visit: false, admit: () => {
      const work = life.admitWork(face);
      return work !== null ? { ok: true, work } : shutRefusal(face, "verb");
    } };
  };
  const sessionState = (sock: Socket) => {
    let state = sessionSockets.get(sock);
    if (!state) {
      state = { binding: sessionBinding("socket") };
      sessionSockets.set(sock, state);
      sock.once("close", () => {
        if (state?.sessionId) table.close(state.sessionId);
        void flushThenDrop(state?.signer);
        sessionSockets.delete(sock);
        sessionTurns.delete(sock);
      });
    }
    return state;
  };
  /**
   * THE ANCHOR HOLDS OR THE SESSION ENDS: a vessel that left a bound session's anchor (a dial pin stood, moved or fell)
   * serves it nothing more. The session closes, its signer drops, and the caller opens afresh at the anchor the vessel
   * stands at now. Answers whether it ended the session.
   */
  const anchorLeft = async (sock: Socket, state: NonNullable<ReturnType<typeof sessionSockets.get>>, requestId: string | undefined): Promise<boolean> => {
    if (!opts.sessions || !state.sessionId) return false;
    // A READ THAT FAILS IS NO MOVE: the frame refuses `anchor-unread` and the session stands for the next frame.
    const now = await opts.sessions.anchorNow().catch((error: unknown) => {
      log(`session anchor read failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    });
    if (now === null) {
      if (!closing && !sock.destroyed) sessionRefuse(sock, "anchor-unread", requestId);
      return true;
    }
    if (sameAnchor(state.anchor, now)) return false;
    state.signer?.drop();
    delete state.signer;
    delete state.supply;
    table.close(state.sessionId);
    delete state.sessionId;
    if (closing || sock.destroyed) return true;
    sessionReply(sock, { kind: "session:refused", ...(requestId !== undefined && { requestId }), refusal: "anchor-moved", closed: true });
    sock.end();
    return true;
  };
  const processSession = async (parsed: unknown, sock: Socket): Promise<void> => {
    const frame = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    const state = sessionState(sock);
    const requestId = typeof frame["requestId"] === "string" ? frame["requestId"] : undefined;
    if (frame["op"] === "session:open") {
      if (state.sessionId) return sessionRefuse(sock, "binding-already-bound", requestId);
      if (typeof frame["faceRef"] !== "string" || !frame["faceRef"] ||
          !["tab", "cli", "watcher", "seat"].includes(String(frame["hand"])) || !requestId) {
        return sessionRefuse(sock, "malformed-message", requestId);
      }
      if (!opts.sessions) return sessionRefuse(sock, "no-session-door", requestId);
      // THE PEER BINDS THE HAND (`uds-peer`): ANY session opened from a harness's branch (`cli`, `tab`, `watcher` alike) wears
      // the seat's hand and profile, so no hand a client names lifts a harness's line past the seat's gates.
      // A PEER NOTHING READS BOOKS NO HAND: the session keeps the hand it names for its profile, but a hand-only act refuses
      // `hand-unattested` and no call it places carries an asker (hitl-reads-a-hand).
      const peer: PeerKind = frame["hand"] !== "seat" ? await kindOfPeer(sock) : "hand";
      // A FRAME MARKED BY A SEAT OPENS THE SEAT'S PROFILE, as its one-shot line reads it: the mark never rides a `cli` hand.
      if (peer === "ai" || seatKindOf(frame) !== null) frame["hand"] = "seat";
      if (closing || sock.destroyed) return;
      // THE AI SEAT OPENS A FACE INSIDE THE LENT SET: a `seat` hand (or a frame marked `seat: "ai"`) naming a face outside it refuses.
      // The set reads only where a seat names a face, so no other opening touches custody.
      const seatAsks = (frame["hand"] === "seat" || seatKindOf(frame) !== null) && faceRefOrdinal(frame["faceRef"]) !== null;
      const seatRefused = !seatAsks ? null : seatFaceRefusal({ seat: frame["hand"] === "seat" ? "ai" : seatKindOf(frame), named: faceRefOrdinal(frame["faceRef"]), worn: opts.mountOrdinal?.() ?? null, lent: await lentOf() });
      if (seatRefused !== null) return sessionRefuse(sock, seatRefusalClass(seatRefused), requestId);
      const supplied = await opts.sessions.open({ faceRef: frame["faceRef"], hand: frame["hand"] as Hand })
        .catch((error: unknown) => {
          log(`session door failed: ${error instanceof Error ? error.message : String(error)}`);
          return { ok: false as const, refusal: "door-failed" };
        });
      if (closing || sock.destroyed || sock.writableEnded) return;
      if (!supplied.ok) return sessionRefuse(sock, supplied.refusal, requestId);
      const opened = table.open(state.binding, supplied.supply.face, supplied.supply.profile, supplied.supply.caps ?? []);
      if (!opened.ok) return sessionRefuse(sock, opened.refusal, requestId);
      // NO MESSAGE ROUTES TO A SESSION THAT HOLDS A FACE AND NO SIGNER: a mint that refuses closes the session it opened.
      const minted = await supplied.supply.mint({ table, binding: state.binding, session: opened.session })
        .catch((error: unknown) => {
          log(`session mint failed: ${error instanceof Error ? error.message : String(error)}`);
          return { ok: false as const, refusal: "mint-failed" };
        });
      if (!minted.ok || closing || sock.destroyed) {
        table.close(opened.session.sessionId);
        if (minted.ok) minted.signer.drop();
        return minted.ok ? undefined : sessionRefuse(sock, minted.refusal, requestId);
      }
      state.sessionId = opened.session.sessionId;
      state.hand = frame["hand"] as Hand;
      state.unattested = peer === "unknown";
      state.anchor = supplied.supply.anchor;
      state.supply = supplied.supply;
      state.signer = minted.signer;
      // P2-4: the session stands seated while its signer stands, so a change written with no call in flight books it.
      const seatFace = opts.siblingFaceOf?.(supplied.supply.presenter);
      opts.signers?.seat({ signer: minted.signer, anchor: supplied.supply.anchor, subject: opened.session.face.proofSubject, ...(seatFace !== undefined ? { face: seatFace } : {}) });
      sessionReply(sock, { kind: "session:opened", requestId, ownerEpoch: opened.session.ownerEpoch,
        sessionId: opened.session.sessionId, generation: opened.session.generation,
        faceRef: opened.session.face.proofSubject, caps: opened.session.caps });
      return;
    }
    if (frame["op"] === "session:switch") {
      if (table.checkBound(frame, state.binding).ok && await anchorLeft(sock, state, requestId)) return;
      return switchOn(sock, state, frame, requestId);
    }
    if (frame["op"] !== "session:call" && frame["op"] !== "session:close" && frame["op"] !== "session:act" &&
        frame["op"] !== "session:receipt" && frame["op"] !== "session:cancel") return sessionRefuse(sock, "unknown-op", requestId);
    const checked = table.checkBound(frame, state.binding);
    if (!checked.ok) return sessionRefuse(sock, checked.refusal, requestId);
    // A DEAD ENGINE REFUSES BY NAME before any session verb, act, receipt or cancel reads the control document; a close still closes.
    const sessionFall = opts.engine?.fallen();
    if (sessionFall && frame["op"] !== "session:close") return sessionRefuse(sock, ENGINE_TERMINATED, requestId, engineTerminatedRefusal(sessionFall).message);
    if (frame["op"] !== "session:close" && await anchorLeft(sock, state, requestId)) return;
    if (frame["op"] === "session:close") {
      table.close(checked.session.sessionId);
      const leaving = state.signer;
      delete state.signer;
      delete state.sessionId;
      await flushThenDrop(leaving);
      sessionReply(sock, { kind: "session:closed" });
      sock.end();
      return;
    }
    if (frame["op"] === "session:act") return actOn(sock, state, checked.session.face.proofSubject, frame, requestId);
    if (frame["op"] === "session:receipt" || frame["op"] === "session:cancel") {
      if (!requestId) return sessionRefuse(sock, "malformed-message", requestId);
      const face = checked.session.face.proofSubject;
      if (frame["op"] === "session:cancel") {
        await cancelAsk(faceScopedId(face, requestId));
        // Only a HELD ask this face placed withdraws: the id is scoped to the session's verified face.
        if (heldInFlight.has(faceScopedId(face, requestId))) opts.withdrawAsk?.(faceScopedId(face, requestId));
      }
      sessionReply(sock, { kind: "session:receipt", requestId, receipt: await sessionReceipt(requestId, face) });
      return;
    }
    if (!requestId || typeof frame["verb"] !== "string" || !frame["verb"] ||
        !frame["args"] || typeof frame["args"] !== "object" || Array.isArray(frame["args"]) ||
        !state.supply || typeof state.supply.presenter !== "string" || !state.supply.presenter) {
      return sessionRefuse(sock, "malformed-message", requestId);
    }
    // A FACE ROW'S ANSWER RIDES THE SOCKET ALONE (`session:act`), as does a realm verb's that names a face's key: a call's
    // outcome body rests in the vessel's control document beside the session's face, so neither rides one.
    if (opts.sessionVerbs?.has(frame["verb"]) || opts.socketVerbs?.has(frame["verb"])) return sessionRefuse(sock, "answers-on-the-socket", requestId);
    // A SPIRIT'S HAND PROPOSES on a call too: a hand-only island verb (`retire-wiki`) refuses a seat session by its code.
    if (state.supply.profile === "seat" && opts.handOnlyActs?.has(frame["verb"])) return sessionRefuse(sock, opts.handOnlyCodes?.get(frame["verb"]) ?? "beyond-profile", requestId);
    if (state.unattested && opts.handOnlyActs?.has(frame["verb"])) return sessionRefuse(sock, "hand-unattested", requestId);
    const opCode = opts.handOnlyOp?.(frame["verb"], frame["args"]) ?? null;
    if (opCode !== null && state.supply.profile === "seat") return sessionRefuse(sock, opCode, requestId);
    if (opCode !== null && state.unattested) return sessionRefuse(sock, "hand-unattested", requestId);
    if (opts.unattendedIngest && (state.supply.profile === "seat" || state.unattested)) frame["args"] = opts.unattendedIngest(frame["verb"], frame["args"]) as Record<string, unknown>;
    // NO SILENT STEWARD (`chore-face`): the daemon runs a chore on its mount's authority, so the session's face meets
    // `actingFaceOf` before any signer books or anything places; one wearing another lent face refuses by name, naming both.
    const mount = mountOf();
    const chore = choreAtDoor({ verb: frame["verb"], face: state.supply.ordinal, mount, lent: mount !== null && isChore(frame["verb"]) ? await lentOf() : null,
      lit: opts.litOrdinals?.() ?? [],
      hand: state.hand ?? "cli", session: checked.session.sessionId, generation: checked.session.generation });
    if (chore !== null && !chore.ok) return sessionRefuse(sock, chore.refusal, requestId, chore.message);
    // A LIT FACE RECEIVES VISITS: a read naming another face as its `target` keeps the face this SESSION wears (never the mount).
    const resolved = await resolveTarget(frame["verb"], frame["args"] as Record<string, unknown>, state.supply.ordinal);
    if (!resolved.ok) return sessionRefuse(sock, resolved.refusal, requestId, resolved.message);
    if (closing || sock.destroyed || !state.supply) return;
    const args = resolved.args ?? {};
    const face = checked.session.face.proofSubject;
    // EACH FACE LIVES ONE LIFE: the call admits on its face's actor at its dispatch, after arbitration (`gateFor`); a visit admits
    // on its target's actor, and its answer delivers through that actor's mailbox.
    const gate = gateFor(state.supply.ordinal, frame["verb"], args);
    // THE SIGN DOOR'S BOOKING: the daemon island signs a sealed record through the session that placed this call, for
    // the call's life and under its verb alone; the booking drops when the call concludes or its socket goes.
    const release = opts.signers && state.signer && state.supply
      ? opts.signers.hold(faceScopedId(face, requestId), frame["verb"], { signer: state.signer, anchor: state.supply.anchor, subject: face,
        ...((): { face?: string } => { const key = opts.siblingFaceOf?.(state.supply!.presenter); return key !== undefined ? { face: key } : {}; })() })
      : () => {};
    await new Promise<void>((resolve) => {
      const closed = () => resolve();
      sock.once("close", closed);
      handle({ verb: frame["verb"], args, requestId: faceScopedId(face, requestId),
        requestedBy: state.supply!.presenter, face: checked.session.face.proofSubject, ordinal: state.supply!.ordinal, ...(state.unattested ? {} : { asker: state.hand ?? "cli" }),
        ...(typeof frame["effectKey"] === "string" && { effectKey: faceScopedId(face, frame["effectKey"]) }),
        ...(typeof frame["timeoutMs"] === "number" && { timeoutMs: frame["timeoutMs"] }) }, sock, requestId,
        () => { sock.off("close", closed); resolve(); }, chore?.ok ? chore.mark : undefined, gate ?? undefined);
    }).finally(release);
  };
  /**
   * `session:switch`: the five-step fence over THIS socket's session (`switchSession`). The frame rides the bound
   * envelope (`faceRef` names the face worn now), `expectedGeneration` (the generation it leaves, equal to the
   * envelope's) and `target`, the target face's hint, which the door verifies afresh as the preflight. The intent and
   * the outcome rest in the vessel's sealed switch-act row and land before the step after them.
   * The new signer lands on the socket's state the moment it mints, so a socket that goes mid-switch drops it with
   * the rest; a switch that cannot commit, or whose socket went, closes this session, and the caller opens afresh.
   * A refusal names a code; the detail stays in this vessel's log.
   */
  /**
   * `session:act`: one sealed act that acts as a face, run on the custody door's chain as the session's face. The act's
   * `face` or `handleIndex` names the session's face or refuses `face-row-other-face`. An act keyed by `face` that names
   * none takes the session's as `face`; an act keyed by `handleIndex` alone (crossing.sign and .witness, carriage.accept,
   * persona.recovery-contact.enrol, persona.confirm, selves.carry and .clear) names it by that key, and naming none refuses
   * `bad-args` at the act's own reading, which takes no `face`. Its arguments
   * and its answer ride this socket alone, as a custody frame's do: the receipt it leaves names the act and the face
   * (its digest covers those two, never an argument), and no outcome body rests anywhere.
   * A RETRY UNDER ONE requestId READS THE RECEIPT OF THE ACT THAT RAN under it, whatever arguments it carries: an act
   * runs once per id, and its answer, which rode the first socket alone, never survives a hang-up.
   * The ask book holds the act's verdict in memory for this life, so a retry reads it there.
   * The act counts as work the seat waits out on close. An act that throws once running answers its own error,
   * `act-faulted`, and its receipt reads error.
   */
  const actOn = async (sock: Socket, state: NonNullable<ReturnType<typeof sessionSockets.get>>, face: string,
    frame: Record<string, unknown>, requestId: string | undefined): Promise<void> => {
    const name = frame["act"];
    const given = frame["args"] ?? {};
    if (!requestId || typeof name !== "string" || !name || !given || typeof given !== "object" || Array.isArray(given) || !state.supply) {
      return sessionRefuse(sock, "malformed-message", requestId);
    }
    if (!opts.sessionActs) return sessionRefuse(sock, "no-session-acts", requestId);
    if (!opts.sessionActs.names.has(name)) return sessionRefuse(sock, "act-rides-the-custody-door", requestId);
    // A SPIRIT'S HAND PROPOSES: the seat profile never runs an act the operator's hand alone runs.
    if (state.supply.profile === "seat" && opts.handOnlyActs?.has(name)) return sessionRefuse(sock, opts.handOnlyCodes?.get(name) ?? "beyond-profile", requestId);
    if (state.unattested && opts.handOnlyActs?.has(name)) return sessionRefuse(sock, "hand-unattested", requestId);
    const args = given as Record<string, unknown>;
    // An act names its face by `face` or by `handleIndex`; either naming another face refuses. An act that names none
    // gets the session's face as `face`, which an act keyed by `handleIndex` alone refuses `bad-args`; one that names it
    // keeps the key it named, and no other (an act takes only its keys).
    for (const key of ["face", "handleIndex"] as const) {
      if (args[key] !== undefined && args[key] !== state.supply.ordinal) return sessionRefuse(sock, "face-row-other-face", requestId);
    }
    const bound = args["handleIndex"] !== undefined ? args : { ...args, face: state.supply.ordinal };
    const scoped = faceScopedId(face, requestId);
    const action = `act:${name}`;
    const run = opts.sessionActs.run;
    const worn = { ordinal: state.supply.ordinal, presenter: state.supply.presenter };
    // EACH FACE LIVES ONE LIFE: the act admits as work on its face's actor before its arbitration, and holds that face's close
    // until it settles; a face closing refuses `face-closing`, a shut one `face-not-open`.
    const life = opts.faceLife;
    let work: WorkTicket | null = null;
    if (life?.known(worn.ordinal)) {
      work = life.admitWork(worn.ordinal);
      if (work === null) { const shut = shutRefusal(worn.ordinal, "act"); return sessionRefuse(sock, shut.refusal, requestId, shut.message); }
    }
    arbitrating += 1;
    let ran = false;
    try {
      const digest = await verbInputDigest({ verb: action, args: {}, face });
      const verdict = book.begin(scoped, digest, action);
      if (verdict.verdict === "standing") {
        return sessionReply(sock, { kind: "session:receipt", requestId, receipt: await sessionReceipt(requestId, face) });
      }
      if (verdict.verdict === "refuse") return sessionRefuse(sock, verdict.reason, requestId);
      let answer: Record<string, unknown>;
      ran = true;
      const owedSince = opts.restOwed ? opts.restOwed.mark() : null;
      try {
        // AN ACT RUNS IN ITS OWN SCOPE (`call-touches`): what it changes here tags it, and its answer carries the owed band.
        answer = await inCallScope(scoped, () => run(name, bound, worn));
      } catch (error) {
        log(`session act ${name} faulted for ${requestId}: ${error instanceof Error ? error.message : String(error)}`);
        answer = { status: "error", reason: "act-faulted" };
      }
      const actRest = await owedFor(owedSince, touchesOf(scoped, undefined), takeCallUntracked(scoped));
      if (actRest !== null) answer = { ...answer, rest: actRest };
      const status = answer["status"] === "error" ? "error" : "done";
      book.settle(scoped, status, digest, action);
      sessionReply(sock, { kind: "session:act-result", requestId, answer });
    } finally {
      if (ran) { try { opts.sessionActs?.settled?.(name, bound); } catch (error) { log(`session act ${name} settle hook failed: ${error instanceof Error ? error.message : String(error)}`); } }
      work?.done();
      arbitrating -= 1;
      if (idle()) drained?.();
    }
  };
  // The acts rest in the vessel's own sealed row, never in a document the face's fleet syncs (`switch-act-log`).
  const writeSwitchAct = async (act: SwitchIntent | SwitchOutcome): Promise<void> => {
    if (!opts.switchActs) throw new Error("no switch-act log stands on this seat");
    await opts.switchActs.write(act);
  };
  const switchOn = async (sock: Socket, state: NonNullable<ReturnType<typeof sessionSockets.get>>,
    frame: Record<string, unknown>, requestId: string | undefined): Promise<void> => {
    const hint = frame["target"];
    if (!requestId || typeof hint !== "string" || !hint || frame["expectedGeneration"] !== frame["generation"]) {
      return sessionRefuse(sock, "malformed-message", requestId);
    }
    if (!opts.sessions || !state.hand) return sessionRefuse(sock, state.hand ? "no-session-door" : "unknown-session", requestId);
    if (!opts.switchActs) return sessionRefuse(sock, "no-switch-act-log", requestId);
    const door = opts.sessions;
    const hand = state.hand;
    const gone = (): boolean => closing || sock.destroyed || sessionSockets.get(sock) !== state;
    const result = await switchSession({
      table, binding: state.binding,
      envelope: { ownerEpoch: frame["ownerEpoch"] as string, sessionId: frame["sessionId"] as string,
        generation: frame["generation"] as number, faceRef: frame["faceRef"] as string },
      preflight: async () => {
        const supplied = await door.open({ faceRef: hint, hand });
        if (!supplied.ok) return supplied;
        // ONE SESSION BINDS ONE (face, anchor): a proof made at another anchor than the session's own moves nothing.
        if (!sameAnchor(state.anchor, supplied.supply.anchor)) return { ok: false, refusal: "anchor-moved" };
        return { ok: true, target: { face: supplied.supply.face, profile: supplied.supply.profile, supply: supplied.supply } };
      },
      writeIntent: writeSwitchAct,
      fence: async () => { const leaving = state.signer; delete state.signer; delete state.supply; await flushThenDrop(leaving); },
      commit: async (session, target) => {
        if (gone()) return { ok: false, refusal: "session-closed" };
        const minted = await target.supply.mint({ table, binding: state.binding, session });
        if (!minted.ok) return minted;
        // The socket's state owns the signer from here: its close handler drops it.
        state.signer = minted.signer;
        state.supply = target.supply;
        if (gone()) { minted.signer.drop(); return { ok: false, refusal: "session-closed" }; }
        opts.signers?.seat({ signer: minted.signer, anchor: target.supply.anchor, subject: session.face.proofSubject });
        return { ok: true };
      },
      writeOutcome: writeSwitchAct,
      log: (line) => log(line),
    });
    const bound = table.bound(state.binding);
    if (!result.ok || gone() || bound === null) {
      if (result.ok || result.closed || bound === null) {
        state.signer?.drop();
        delete state.signer;
        delete state.supply;
        if (state.sessionId) table.close(state.sessionId);
        delete state.sessionId;
        if (gone()) return;
        sessionReply(sock, { kind: "session:refused", requestId, refusal: result.ok ? "session-closed" : result.refusal, closed: true });
        sock.end();
        return;
      }
      return sessionRefuse(sock, result.refusal, requestId);
    }
    sessionReply(sock, { kind: "session:switch-result", requestId, outcome: result.switched ? "switched" : "unchanged",
      ownerEpoch: result.session.ownerEpoch, sessionId: result.session.sessionId, generation: result.session.generation,
      faceRef: result.session.face.proofSubject });
  };
  const queueSession = (parsed: unknown, sock: Socket): void => {
    sessionState(sock);
    if (closing) { sock.end(); return; }
    const prior = sessionTurns.get(sock) ?? Promise.resolve();
    const next = prior.then(() => processSession(parsed, sock));
    // A fault answers a fixed code under the frame's own requestId, so the caller's waiter matches it; the detail is logged.
    const requestId = parsed && typeof parsed === "object" && typeof (parsed as Record<string, unknown>)["requestId"] === "string"
      ? (parsed as Record<string, unknown>)["requestId"] as string : undefined;
    sessionTurns.set(sock, next.catch((error) => {
      log(`session frame failed: ${error instanceof Error ? error.message : String(error)}`);
      sessionRefuse(sock, error instanceof ControlHomeUnavailable ? error.refusal : "session-fault", requestId);
    }));
  };
  let arbitrating = 0;
  let drained: (() => void) | null = null;
  const idle = (): boolean => inFlight.size === 0 && arbitrating === 0;
  const settleOne = (sock: Socket): void => {
    if (inFlight.delete(sock) && idle()) drained?.();
  };
  /** EVERY CALL RUNS IN ITS OWN SCOPE (`call-touches`): what the vessel's main thread changes for it tags the call's id. */
  const handle = (parsed: unknown, sock: Socket, sessionRequestId?: string, onSessionReply?: () => void, mark?: ChoreReceiptMark, gate?: DoorGate): void => {
    const callId = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>)["requestId"] : undefined;
    if (typeof callId !== "string" || callId.length === 0) return handleCall(parsed, sock, null, sessionRequestId, onSessionReply, mark, gate);
    return inCallScope(callId, () => handleCall(parsed, sock, callId, sessionRequestId, onSessionReply, mark, gate));
  };
  /** The documents a call changed here and on the island, the control document's own bookkeeping left out. */
  const touchesOf = (callId: string | null, island: unknown): CallTouches | null => {
    const merged = mergeCallTouches(touchedOfField(island), callId !== null ? takeCallTouches(callId) : null);
    if (merged === null) return null;
    const { [controlHandle.documentId]: _control, ...rest } = merged;
    return Object.keys(rest).length > 0 ? rest : null;
  };
  /** The owed band for one call's own changes; a reading that fails answers owed by name, never sealed. A path that ran
   *  for the call and reported nothing (`untracked`) joins the band by its verb: visible, never ok. */
  const owedFor = async (since: number | null, touches: CallTouches | null, untracked: readonly string[] = []): Promise<RestOwedBand | null> => {
    if (since === null || !opts.restOwed) return null;
    let band: RestOwedBand | null = null;
    if (touches !== null) {
      try { band = await opts.restOwed.owed(since, touches); }
      catch (error) { band = { band: "owed", documents: Object.keys(touches).map((documentId) => ({ documentId, refusal: "owed-unread", error: error instanceof Error ? error.message : String(error) })) }; }
    }
    if (untracked.length === 0) return band;
    return { band: "owed", documents: [...(band?.documents ?? []), ...untracked.map((what) => ({ documentId: "untracked", refusal: "untracked", error: `${what}: no change report reached the seat, so whether its writes rest stands unread` }))] };
  };
  const handleCall = (parsed: unknown, sock: Socket, callId: string | null, sessionRequestId?: string, onSessionReply?: () => void, mark?: ChoreReceiptMark, gate?: DoorGate): void => {
    // THE REST-OWED MARK: every call notes the held saves standing as it begins; its answer names what its own changes left owed.
    const owedSince = opts.restOwed ? opts.restOwed.mark() : null;
    /** The verb this call dispatched to the island (its answer carries the island's change report, or reads untracked). */
    let dispatched: string | null = null;
    // The receipt mark of a dispatched chore (`ChoreReceiptMark`: the acting face, the asker's hand, its session), carried on
    // its answer as `chore`; unset for a read or a refusal. A session's door hands it in; a one-shot's deferred tick reads it.
    let choreMark: ChoreReceiptMark | undefined = mark;
    /** The visit this call admitted: its reply delivers through the target's actor, at the write. */
    let visit: VisitTicket | null = null;
    /** A session line written as its own frame (a refusal the actor answered first, or the reply itself). */
    const writeLine = (payload: Record<string, unknown>): void => {
      try {
        const line = JSON.stringify(payload) + "\n";
        if (sessionRequestId === undefined) sock.end(line);
        else sock.write(line);
      } catch { /* gone */ }
    };
    const refusedVisit = (reason: string): Record<string, unknown> => ({
      ...(sessionRequestId !== undefined ? { kind: "session:result", requestId: sessionRequestId } : {}),
      status: "error", errorMessage: reason, refusal: { reason: "face-not-open" } });
    /** EVERY ANSWER OF A VISIT RIDES THE ACTOR'S ONE DELIVERY TURN (its reply, its failure, a fault): exactly one reaches the asker. */
    const answerLine = (payload: Record<string, unknown>): void => {
      if (visit !== null) visit.deliver(() => writeLine(payload), (reason) => writeLine(refusedVisit(reason)));
      else writeLine(payload);
    };
    /** A session refusal by its code, through the visit's delivery turn where the call visits. */
    const refuseSession = (refusal: string): void => {
      if (visit !== null) answerLine({ kind: "session:refused", requestId: sessionRequestId, refusal });
      else sessionRefuse(sock, refusal, sessionRequestId);
    };
    /** The admitted work's release: the face's close waits out every admitted dispatch until it settles. */
    let settled = (): void => {};
    /** Release the work when the verb itself settles: a caller's wait that gave up (`VesselWaitExpired`) waits on the outcome. */
    const releaseWhenSettled = (run: Promise<unknown>, requestId: string): void => {
      run.then(() => settled(), (err: unknown) => { if (err instanceof VesselWaitExpired) void outcomeLanded(requestId).then(() => settled()); else settled(); });
    };
    /**
     * A DROPPED LINE WITHDRAWS ITS HELD ASK: a socket that closes while a held ask (`heldAsk`) still holds tells the island, once.
     * Any other ask runs on past its caller's hang-up, its outcome owed to a later read, as its dispatch promised.
     */
    const withdrawOnHangUp = (run: Promise<unknown>, inv: Invocation, requestId: string): void => {
      const withdraw = opts.withdrawAsk;
      if (withdraw === undefined || !heldAsk(inv.verb, inv.args)) return;
      heldInFlight.add(requestId);
      const gone = (): void => withdraw(requestId);
      sock.once("close", gone);
      const off = (): void => { sock.off("close", gone); heldInFlight.delete(requestId); };
      run.then(off, off);
    };
    /**
     * THE CALL ADMITS ON THE FACE'S ACTOR before its arbitration, with no await between the actor's yes and the book's turn: a
     * refusal answers and nothing runs. Admitted work holds the face's close (its drain waits) until it settles, so no
     * write enters a drain. A visit's reply rides its own request id: the session reads its next frame at once, and a peer that
     * leaves drops it.
     */
    const admit = (): boolean => {
      if (!gate) return true;
      const ticket = gate.admit((reason) => { if (!sock.destroyed) writeLine(refusedVisit(reason)); });
      if (!ticket.ok) { fail(ticket.message, ticket.refusal); return false; }
      if (ticket.visit) {
        visit = ticket.visit;
        const held = ticket.visit;
        sock.once("close", () => held.drop());
        onSessionReply?.();
      }
      if (ticket.work) settled = () => ticket.work!.done();
      return true;
    };
    const respond = (answer: Record<string, unknown>): void => {
      void (async () => {
        // A WRITE THAT CANNOT SEAL ANSWERS `owed`, NEVER A BARE OK: the change stands in memory and rests nowhere yet.
        // ONE PLACE FOR EVERY VERB: whatever the call changed (on the island, or here) reads its rest before the answer leaves.
        const { touched: islandTouched, ...plain } = answer;
        const terminal = answer["status"] === "done" || answer["status"] === "error";
        // FAIL-SAFE: a dispatched verb no read allow-list names, whose answer carries no change report, reads untracked.
        const untracked = callId !== null ? takeCallUntracked(callId) : [];
        if (terminal && dispatched !== null && answersUntracked(dispatched, islandTouched !== undefined)) untracked.push(dispatched);
        const rest = terminal ? await owedFor(owedSince, touchesOf(callId, islandTouched), untracked) : null;
        const stamped = rest !== null ? { ...plain, rest } : plain;
        const named = choreMark !== undefined ? { ...stamped, chore: choreMark } : stamped;
        const payload = sessionRequestId === undefined ? named : {
          kind: "session:result", ...named, requestId: sessionRequestId,
          ...((answer["status"] === "done" || answer["status"] === "error") && controlHomeRefusal(controlHandle) === null ? { durable: await settleDurably() } : {}),
        };
        // THE CHECK AND THE WRITE IN ONE TURN: past every await, the target's actor reads its opening and writes, or refuses.
        answerLine(payload);
      })().catch((error) => {
        log(`session reply failed: ${error instanceof Error ? error.message : String(error)}`);
        refuseSession("session-fault");
      })
        .finally(() => onSessionReply?.());
    };
    if (!inFlight.has(sock)) {
      inFlight.add(sock);
      sock.once("finish", () => settleOne(sock));   // this side wrote its answer
      sock.once("close",  () => settleOne(sock));   // or the caller went away
      if (sock.destroyed || sock.writableFinished) settleOne(sock);
    }
    const fail = (msg: string, reason?: string) => {
      respond({ status: "error", errorMessage: msg, ...(reason !== undefined && { refusal: { reason } }) });
    };
    const answerUnknown = (requestId: string) => { respond({ status: "unknown", requestId }); };
      if (parsed && typeof parsed === "object" && (parsed as { op?: unknown }).op === "session:open") {
        queueSession(parsed, sock);
        return;
      }
      // A DEAD ENGINE REFUSES BY NAME, BEFORE ANY HANDLER RUNS (`engine-watch`). A receipt answers from the door's memory
      // alone; every other line (a verb, a cancel, the roster's plane reads) refuses `engine-terminated` and nothing runs.
      const fall = opts.engine?.fallen();
      if (fall) {
        if (isReceiptQuery(parsed)) { respond(settledReceipt(parsed.requestId, fall) as unknown as Record<string, unknown>); return; }
        const refused = engineTerminatedRefusal(fall);
        if (sessionRequestId !== undefined) { refuseSession(refused.refusal); onSessionReply?.(); return; }
        return fail(refused.message, refused.refusal);
      }
      // THE HEARTH ROSTER READS WHAT THIS CHANNEL HOLDS (`hearth-roster-read`): the sessions bound on this socket, the worn slot
      // and the worn faces' intent planes. A read, so it never reaches `placeVerb` and marks nothing, and it answers a locked
      // vessel too: the sessions stand whatever custody holds, and a plane that cannot read says why.
      // A READ NEVER HOLDS THE DRAIN: the roster's socket leaves the frames this seat waits out and counts in no arbitration,
      // so a plane read that hangs (an Automerge or board read) never keeps the vessel from closing. The close interrupts it
      // instead (`rosterInterrupt`, an event and never a timer), and every face still unread answers `vessel-closing`.
      if (sessionRequestId === undefined && (parsed as { verb?: unknown } | null)?.verb === HEARTH_ROSTER_VERB) {
        settleOne(sock);
        const asked = (parsed as { requestId?: unknown }).requestId;
        // The id echoes back only as a short token; any other id the caller sent is replaced, never repeated.
        const requestId = typeof asked === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(asked) ? asked : newRequestId();
        void (async () => {
          const asker = seatKindOf(parsed) !== null || await peerSeatOf(sock) === "ai" ? "seat" as const : "hand" as const;
          const local = [...sessionSockets.values()].flatMap((state) => state.sessionId && state.supply && state.hand && state.anchor
            ? [{ session: state.sessionId, face: state.supply.ordinal, hand: state.hand, anchor: state.anchor.kind }] : []);
          const output = await hearthRosterOf({ worn: mountOf(), lit: opts.litOrdinals?.() ?? [], lent: await lentOf(), local, asker,
            interrupt: rosterInterrupt, ...(opts.hearthPlanes ? { planes: opts.hearthPlanes } : {}) });
          if (!sock.destroyed) respond({ status: "done", requestId, results: { summary: { ok: true, output } } });
        })().catch((err: unknown) => { if (!sock.destroyed) fail(err instanceof Error ? err.message : String(err)); });
        return;
      }
      // A LOCKED VESSEL FAILS CLOSED, AND A FACELESS PLACE HOLDS NO CONTROL DOCUMENT: with the control document unread (the
      // key shut, or no face named one), a session's frame and a cancel refuse by that name before they read the document.
      // THE FLOOR STILL ANSWERS: a one-shot floor verb runs on the floor (below), and an act that writes a control record
      // refuses by the same name at that write; its answer waits in the floor store's memory and rests nowhere.
      const controlRefused = controlHomeRefusal(controlHandle);
      if (controlRefused && (sessionRequestId !== undefined || isCancelQuery(parsed))) return fail(controlRefused.message, controlRefused.refusal);
      if (controlRefused && isReceiptQuery(parsed)) {
        // The floor answers from its memory alone: an answer it still holds reads back; any other refuses by name.
        void retrievedOutcome(parsed.requestId).then((held) => held
          ? respond({ requestId: parsed.requestId, state: held["status"], ...(held["results"] !== undefined ? { results: held["results"] } : {}),
            ...(held["body"] !== undefined ? { body: held["body"] } : {}), ...(held["visit"] !== undefined ? { visit: held["visit"] } : {}),
            ...(held["errorMessage"] !== undefined ? { errorMessage: held["errorMessage"] } : {}), ...(held["refusal"] !== undefined ? { refusal: held["refusal"] } : {}) })
          : fail(controlRefused.message, controlRefused.refusal), (err) => fail(err instanceof Error ? err.message : String(err)));
        return;
      }
      // READ-ONLY QUERIES NEVER REACH `placeVerb`.
      // BOTH DOORS BELOW COUNT AS WORK THE SEAT WAITS OUT: a caller that hangs up while its cancel or its read still reads
      // the control document never lets the seat read as drained under them.
      const tended = (work: Promise<void>): void => {
        arbitrating += 1;
        void work.finally(() => { arbitrating -= 1; if (idle()) drained?.(); });
      };
      if (isReceiptQuery(parsed)) {
        tended(answerReceipt(parsed.requestId).then(
          (answer) => { respond(answer as unknown as Record<string, unknown>); },
          (err)    => fail(err instanceof Error ? err.message : String(err)),
        ));
        return;
      }
      if (isCancelQuery(parsed)) {
        // THE ANSWER CARRIES THE VESSEL'S OUTCOME, NEVER THE CALLER'S ABANDONMENT RETOLD
        // (lar:///ha.ka.ba/lararium/mesh/receipt-ledger#/three-receipts). The cancel line already states that its
        // caller withdrew. What it asks back: what this vessel holds for the id after the cancel took its turn. A
        // cancel that met nothing reads `abandoned`; one that met a dispatch reads what the vessel holds for that act,
        // which runs on.
        tended(cancelAsk(parsed.requestId).then(() => answerReceipt(parsed.requestId)).then(
          (answer) => { respond(answer as unknown as Record<string, unknown>); },
          (err) => fail(err instanceof Error ? err.message : String(err)),
        ));
        return;
      }

      const oneShot = { ...(parsed as Invocation) };
      delete oneShot.face;
      delete oneShot.ordinal;
      delete oneShot.asker;
      delete oneShot.chore;
      const inv: Invocation = sessionRequestId === undefined ? oneShot : { ...(parsed as Invocation), ...(mark ? { chore: mark } : {}) };
      if (!inv.verb || !inv.requestedBy) return fail("verb + requestedBy required");
      // THE DAEMON BOUNDS THE WAVE IT HANDS ITS ENGINE (`ingest-wave-budget`): an INGEST past one document's wave budget
      // refuses by name before arbitration, so a direct client that skips the gestures' paging meets the bound too.
      const overweight = ingestWaveRefusal(inv.verb, inv.args);
      if (overweight) return fail(overweight.message, overweight.reason);
      // A ROW THAT ACTS AS A FACE RIDES THAT FACE'S SESSION: the maintenance frame carries no face, so it serves none.
      if (sessionRequestId === undefined && opts.sessionVerbs?.has(inv.verb)) {
        return fail(`"${inv.verb}" acts as a face, and rides a session of that face`, "face-row-rides-a-session");
      }
      const requestId = inv.requestId ?? newRequestId();
      // H1′: DEFER DISPATCH, NOT SYNCHRONOUSLY. A vessel frozen between the caller's write and this
      // read can thaw well after the caller gave up and destroyed its own end — its FIN/RST sits
      // queued right behind this very `data` event, undelivered only because this process could not
      // run at all. A dispatch made SYNCHRONOUSLY inside this handler runs the verb before that
      // notification ever gets its own turn. ONE `setImmediate` is not enough: `data` and the
      // underlying EOF can land in two separate libuv poll passes (the data chunk resolves this read,
      // the FIN surfaces only on the NEXT one) — measured live, a single deferred tick still saw
      // `readableEnded: false` for an already-half-closed peer. Nesting a second `setImmediate` lets
      // that extra poll pass run first. A live caller never half-closes before its own answer, so an
      // end seen here always means abandonment.
      arbitrating += 1;
      const readAt = performance.now();
      setImmediate(() => setImmediate(() => { void (async () => {
        // A READ WHOSE CALLER LEFT DROPS FIRST, AND MARKS NOTHING. A read verb (`READ_VERBS`: it writes no document) under a
        // caller already gone has nothing to protect: no effect could land twice, so a later line under the same id simply
        // reads. So the hang-up check leads this tick for a read, ahead of the peer reading, the lent set, the target and the
        // digest, and the drop marks nothing: a vessel answering slowly pays nothing for each reader whose budget ran out.
        // Every other verb keeps the drop below (`AskBook.abandon`): an act that could land answers `abandoned` to a retry.
        if (sessionRequestId === undefined && READ_VERBS.has(inv.verb) && (sock.destroyed || sock.readableEnded)) {
          log(`dropped a hung-up "${inv.verb}" read (request ${requestId}): its caller's socket ended before this vessel read it, so it never ran; the caller reads again under any id`);
          return;
        }
        // THE AI SEAT ACTS INSIDE THE LENT SET, read off the seat kind its request line carries (`seat-hand`): a marked call
        // naming a face outside the set refuses by name before any dispatch; the operator's hand (no seat kind) names any open
        // face. The set reads async, so the check rides this deferred tick, and only where a seat names a face.
        // THE PEER BINDS THE SEAT (`uds-peer`): a line with no mark whose peer descends from a harness reads `seat` all the same.
        const peer: PeerKind | null = sessionRequestId === undefined && seatKindOf(parsed) === null ? await kindOfPeer(sock) : null;
        const seat = seatKindOf(parsed) ?? (peer === "ai" ? "ai" : null);
        // THE ASKER THE DOOR READ rides the placed ask (`ctx.asker`): the one-shot line's seat kind, `cli` where the peer reads a
        // hand, and none where the peer reads nothing (hitl-reads-a-hand): a hand-only verb from it refuses `hand-unattested`.
        if (sessionRequestId === undefined) {
          if (seat !== null) inv.asker = "seat";
          else if (peer === "unknown") {
            delete inv.asker;
            if (opts.handOnlyActs?.has(inv.verb) || opts.handOnlyOp?.(inv.verb, inv.args) != null) return fail(handRefusalOf("hand-unattested", { act: `"${inv.verb}"`, reads: "peer" }).message, "hand-unattested");
          } else inv.asker = "cli";
        }
        const named = namedFaceOf(inv.args);
        // THE AI SEAT PROPOSES on a one-shot line as on a session: a hand-only verb refuses the seat by its code before it places.
        if (sessionRequestId === undefined && seat !== null && opts.handOnlyActs?.has(inv.verb)) return fail(`"${inv.verb}" runs on a person's hand; a seat proposes`, opts.handOnlyCodes?.get(inv.verb) ?? "beyond-profile");
        const opCode = sessionRequestId === undefined && seat !== null ? opts.handOnlyOp?.(inv.verb, inv.args) ?? null : null;
        if (opCode === "hand-act-only") return fail(handRefusalOf(opCode, { act: `"${inv.verb}" (it settles a stand-off; a seat lists and reads)`, reads: "peer", line: "lares shore <act> <uri> --key <key>" }).message, opCode);
        if (opCode !== null) return fail(`"${inv.verb}" names a routing field of the wrong shape`, opCode);
        // A malformed routing field refuses whoever asks: the handler would refuse it too, and no shape slips the gate.
        if (sessionRequestId === undefined && opts.handOnlyOp?.(inv.verb, inv.args) === "routing-arg-malformed") return fail(`"${inv.verb}" names a routing field of the wrong shape`, "routing-arg-malformed");
        if (sessionRequestId === undefined && opts.unattendedIngest && (seat !== null || peer === "unknown")) inv.args = opts.unattendedIngest(inv.verb, inv.args) as Record<string, unknown>;
        const mount = mountOf();
        // NO SILENT STEWARD (`chore-face`): a one-shot chore designates its face (the face it names, or with none named the
        // mount, as `face.resolve` answers a seat) and meets `actingFaceOf` on the lent set the seat wall reads, one read for
        // both. The seat naming a lent face other than the mount refuses `chore-face-not-mounted`, naming both. The operator's own
        // hand naming another open face (a seed, an import) keeps its path and carries no mark.
        const oneShotChore = sessionRequestId === undefined && mount !== null && isChore(inv.verb) && (seat !== null || named === null || named === mount);
        const lent = (seat !== null && named !== null) || oneShotChore ? await lentOf() : null;
        const seatRefused = seat === null || named === null ? null : seatFaceRefusal({ seat, named, worn: opts.mountOrdinal?.() ?? null, lent });
        if (seatRefused !== null) return fail(seatRefused, seatRefusalClass(seatRefused));
        if (sessionRequestId === undefined) {
          // THE ONE-SHOT LINE PRESENTS THE WORN FACE ALONE: a line whose `requestedBy` names a lit sibling would present as that
          // face and reach its own lane; a lit sibling acts through a session of its own, which the door binds under this life.
          if (opts.siblingFaceOf?.(inv.requestedBy) !== undefined) {
            return fail("presenter-rides-a-session: this one-shot line names a lit sibling face as its presenter; the line presents the worn face alone, and a sibling acts on a session of its own (`--face N`)", "presenter-rides-a-session");
          }
          // A LIT FACE RECEIVES VISITS on the one-shot line too: the face it wears is the mount, and a visit admits on the
          // target's actor (`gateFor`) exactly as a session's does, its answer delivered through that actor's mailbox.
          const resolved = await resolveTarget(inv.verb, inv.args, mount);
          if (!resolved.ok) return fail(resolved.message, resolved.refusal);
          if (resolved.args !== undefined) inv.args = resolved.args;
          // ONE GATE PER ONE-SHOT, decided once: a visit admits on its target's actor (`gateFor`); otherwise a write (a chore, or a
          // chore-free write into the daemon layer such as realm-feed: `entersADrain`) admits as work on the face it acts as (the
          // face it names, or the mount), as a session's verb does on the face it wears, so no one-shot write enters that face's
          // drain. ONLY A WRITE ENTERS A DRAIN: a read, or a row of the place, that visits no face keeps its path.
          const acts = named ?? mount;
          gate = mount !== null && visitTargetOf(mount, inv.verb, inv.args) !== null ? gateFor(mount, inv.verb, inv.args ?? {}) ?? undefined
            : acts !== null && entersADrain(inv.verb) ? workGate(acts) ?? undefined
            : undefined;
        }
        if (oneShotChore) {
          const chore = choreAtDoor({ verb: inv.verb, face: named ?? mount!, mount, lent, hand: seat !== null ? "seat" : "cli", session: null, generation: null });
          if (chore !== null && !chore.ok) return fail(chore.message, chore.refusal);
          if (chore?.ok) { choreMark = chore.mark; inv.chore = chore.mark; }
        }
        // The worker's own digest formula (`verbInputDigest`, mesh) — async, so computed inside
        // this deferred tick rather than synchronously in the `data` handler above.
        const inputDigest = await inputDigestOf(inv);
        const floorRefused = controlHomeRefusal(controlHandle);
        // THE FLOOR'S ONE-SHOT: a floor verb alone runs while the control document stands as a stand-in; its answer waits
        // in the floor store's memory and rests nowhere.
        if (floorRefused && !floorVerbs.has(inv.verb)) return fail(floorRefused.message, floorRefused.refusal);
        // A READ RIDES THE ANSWER RING AND LEAVES NO ROW (`ridesAnswerRing`: a READ verb, no effect key). A write leaves its
        // verdict row (the act record), and its answer leaves only once that row stands (`awaitOutcome` `needsRow`).
        const read = ridesAnswerRing(inv.verb, inv.effectKey);
        const needsRow = !read && floorRefused === null;
        const waitFailed = (err: unknown): void => {
          if (err instanceof VesselWaitExpired) return answerUnknown(requestId); // M2: never told as {status:"error"}
          fail(err instanceof Error ? err.message : String(err));
        };
        if (sock.destroyed || sock.readableEnded) {
          // A READ, OR A FLOOR VERB, WHOSE CALLER LEFT never runs and marks nothing: the caller asks again under any id.
          if (read || floorRefused !== null) {
            log(`dropped a hung-up "${inv.verb}" ${read ? "read" : "floor invocation"} (request ${requestId}): its caller's socket ended before this vessel dispatched it, so it never ran`);
            return;
          }
          // A WRITE WHOSE CALLER LEFT before this vessel read it never runs, and the book marks it abandoned: a later line
          // under the same id in this life meets the refusal instead of a dispatch that would run it unannounced.
          book.abandon(requestId, inputDigest, inv.verb);
          log(`dropped a hung-up "${inv.verb}" invocation (request ${requestId}) — the caller's own socket had already ended before this vessel could read it; refusing rather than running it unannounced, and marking the id abandoned for this life`);
          return;
        }
        // THE WINNER AT THE INSTANT OF GIVING UP: this causal EOF check, plus the book's own turn just below, are the ONLY
        // abandonment this vessel arbitrates before dispatch — no wall-clock deadline competes with either. Past a "run"
        // verdict `runVerb` calls `placeVerb` unconditionally, and nothing after may un-dispatch it. A caller's own
        // later-expiring wait never reaches back here to cancel; it reads the receipt back by the same request id.
        if (floorRefused === null && !admit()) return;
        const row = await rowFieldsOf(requestId);
        // ONE TURN FROM HERE: the ring, the row read just above, and the book decide together, so an answer that lands
        // during the row's read marks the book's entry landed only once the ring already holds it.
        // THE HELD ANSWER: the same id with the same input reads it back and places nothing (a visit's body withheld); the
        // same id with changed input refuses by name. An answer that names no digest compares against the input the book
        // kept for the ask, and reads back where the book kept none.
        const held = heldFieldsOf(requestId) ?? row;
        if (held !== null) {
          settled();
          const heldDigest = typeof held["input-digest"] === "string" ? held["input-digest"] : book.get(requestId)?.digest;
          if (typeof heldDigest === "string" && heldDigest !== inputDigest) return fail(reusedWithChangedInput(requestId), "request-id-reused-with-changed-input");
          dispatched = inv.verb;
          return respond(withheldVisit(toldOutcome(held, requestId)));
        }
        const verdict = book.begin(requestId, inputDigest, inv.verb);
        if (verdict.verdict === "refuse") {
          settled();
          const why = verdict.reason === "abandoned"
            ? `this vessel already refused request ${requestId} before dispatch — mint a fresh request id`
            : reusedWithChangedInput(requestId);
          return fail(why, verdict.reason);
        }
        dispatched = inv.verb;
        if (verdict.verdict === "standing") {
          // THE SAME ID WHILE THE FIRST RUNS joins its wait, and never a second `placeVerb`. A RE-ASK READS BACK, never
          // the live answer: a visit's body stays withheld under a reused id.
          const awaited = awaitOutcome(inv.verb, requestId, inv.timeoutMs, needsRow);
          releaseWhenSettled(awaited, requestId);
          awaited.then((outcome) => { respond(withheldVisit(outcome)); }, waitFailed);
          return;
        }
        // The work releases when the verb itself settles, never when this caller's wait gives up.
        const admittedAt = performance.now();
        const running = runVerb(inv, requestId, needsRow);
        withdrawOnHangUp(running, inv, requestId);
        releaseWhenSettled(running, requestId);
        running.then((outcome) => {
          noteSlowCall(inv.verb, requestId, readAt, admittedAt);
          if (read) {
            // EVIDENCE BACKS THE DECLARATION: a read's change report comes back empty. One that names a document wrote
            // after all, and the island landed its verdict row after the fact.
            const wrote = touchesOf(null, outcome["touched"]);
            if (wrote !== null) log(`read-verb-wrote: "${inv.verb}" (request ${requestId}) stands in the read set and its call changed ${Object.keys(wrote).length} document(s); its verdict row lands after the fact. Take "${inv.verb}" out of READ_VERBS (mesh call-touches) or end the write in its handler.`);
          } else if (needsRow) {
            // A WRITE'S VERDICT ROW STOOD BESIDE ITS ANSWER: the last settled wave a fall names.
            try { opts.engine?.settled(controlHandle.heads()); } catch { /* heads unread: the write still landed */ }
          }
          respond(outcome);
        }, waitFailed);
      })().catch((error: unknown) => {
        // A fault before the dispatch (the digest, or the row's read) dispatched nothing; the caller hears a fixed code
        // under its own requestId, and the detail stays in this vessel's log.
        log(`invocation ${requestId} faulted before dispatch: ${error instanceof Error ? error.message : String(error)}`);
        settled();
        if (opts.engine?.note(error, "ledger")) {
          const refused = engineTerminatedRefusal(opts.engine.fallen()!);
          if (sessionRequestId !== undefined) { refuseSession(refused.refusal); onSessionReply?.(); }
          else fail(refused.message, refused.refusal);
          return;
        }
        const named = error instanceof ControlHomeUnavailable ? error.refusal : null;
        if (sessionRequestId !== undefined) { refuseSession(named ?? "session-fault"); onSessionReply?.(); }
        else fail(named ? (error as Error).message : "this vessel faulted before dispatch; nothing ran", named ?? "door-fault");
      }).finally(() => { arbitrating -= 1; if (idle()) drained?.(); }); }));
  };

  return {
    handle,
    handleSessionFrame: queueSession,
    close: async () => {
      closing = true;
      interruptRosters(HEARTH_CLOSING);
      for (const [sock, state] of sessionSockets) {
        if (state.sessionId) table.close(state.sessionId);
        await flushThenDrop(state.signer);
        sock.end();
      }
      if (!idle()) await new Promise<void>((resolve) => { drained = resolve; });
      unsubLanded();
      rowBound.close();
      reads.close();
    },
  };
}

export function startUdsChannel(opts: UdsChannelOptions): UdsChannel {
  const front = serveUdsFront({ claim: opts.claim, ...(opts.onLog ? { onLog: opts.onLog } : {}) });
  front.attach(makeUdsSeat(opts));
  return { close: () => front.close() };
}
