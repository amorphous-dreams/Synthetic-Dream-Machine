/**
 * session-switch — the five-step fence that switches ONE session's face in place.
 *
 * A switch changes the face a live session wears and nothing else: every other session of the owner's table and
 * the daemon go on untouched. It runs five steps over the owner's `SessionTable`, each through a port the owner
 * supplies, in this order:
 *
 *   1. FREEZE AND PREFLIGHT. The session steps to `switching`, so a new call on it refuses `session-not-live`, and a
 *      second switch of it refuses the same way. The preflight verifies the target face afresh and answers an
 *      immutable description; it mounts nothing and mints no key. A refused or throwing preflight returns the
 *      session to `live` at the SAME generation, its facets whole. A target whose face equals the worn face in
 *      every reference (its admission and causal revision with it) changes nothing either (`switched: false`).
 *   2. WRITE THE INTENT. A vessel-private switch act names the causal position (owner epoch, generation), the
 *      outgoing face and the incoming face, and the port answers once it has flushed. An intent that never lands
 *      leaves the session `live` at its generation, since nothing has fallen yet, and the act closes `aborted`.
 *   3. FENCE THE OUTGOING GENERATION. The port drops the outgoing signer and closes the outgoing channels and surfaces. An effect
 *      in flight resolves through its durable receipt.
 *   4. ADVANCE, MOUNT, DIAL. The table advances the session one generation onto the target face and holds it
 *      `switching`; the port mints the new signer and mounts under the new face.
 *   5. WRITE THE OUTCOME, then step the session `live`. A fence, an advance, a commit or an outcome write that fails
 *      CLOSES this session and records the partial outcome; the caller opens afresh. Nothing restores the outgoing face's
 *      authority in silence, and no session runs on a switch its record does not hold.
 *
 * THE FENCE HOLDS WHATEVER ORDER ITS OWNER HANDS FRAMES IN. The session stays `switching` from the freeze to the
 * last step, so no call routes to it while it holds no signer, and a session the owner closes while a step awaits
 * (its socket or port gone) answers `session-closed`, its act closed, and nothing steps it again.
 *
 * Every act this module begins closes: `switched`, `aborted` or `closed`. The act records no session id: it names a
 * position and two faces, never which sessions stood. A refusal names a code alone; a port's own error detail goes to
 * `log` and never to the caller's wire.
 *
 * Pure but for its ports: no Repo, no key, no I/O, no timer, no clock.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/session-contract#/the-switch
 */
import { defaultCryptoProvider } from "./crypto.js";
import type { CapabilityProfile, Session, SessionBinding, SessionBoundEnvelope, SessionFace, SessionTable } from "./session-contract.js";

/** What a preflight answers: the target face, immutable, and the profile its hand carries where the door names one. */
export interface SessionSwitchTarget {
  readonly face:     SessionFace;
  readonly profile?: CapabilityProfile;
}

/** The vessel-private record a switch writes before its fence: the position and the two faces. */
export interface SwitchIntent {
  readonly actId:      string;
  readonly ownerEpoch: string;
  readonly generation: number;
  readonly outgoing:   string;
  readonly incoming:   string;
}
/** The record that closes a switch act: the switch committed, it stopped before its fence, or it closed the session. */
export interface SwitchOutcome extends SwitchIntent {
  readonly outcome:  "switched" | "aborted" | "closed";
  readonly refusal?: string;
}

/** The refusals a switch names beyond the table's own. */
export const SESSION_SWITCH_REFUSALS = [
  "preflight-failed", "profile-changed", "intent-unwritten", "fence-failed", "commit-failed", "outcome-unwritten", "session-closed",
  "switch-acts-set-aside-full",
] as const;

/**
 * The switch-act store kept every row it could not open as long as its cap allows, and keeps the rest: the intent
 * cannot rest, and the switch refuses by this name, never by deleting what an operator may still read.
 */
export class SwitchActsSetAsideFull extends Error {
  override readonly name = "SwitchActsSetAsideFull";
  readonly refusal = "switch-acts-set-aside-full" as const;
  constructor(readonly cap: number, readonly dir: string) {
    super(`the switch-act row does not open, and ${cap} set-aside rows already stand in ${dir}: an operator reads and clears them before the next switch`);
  }
}

export interface SessionSwitchPorts<T extends SessionSwitchTarget> {
  readonly table:    SessionTable;
  readonly binding:  SessionBinding;
  /** The bound envelope the switch frame carried: the face worn now, and the generation the caller expects to leave. */
  readonly envelope: SessionBoundEnvelope;
  /** Verify the target afresh and describe it; mount nothing, mint nothing. */
  readonly preflight:    () => Promise<{ readonly ok: true; readonly target: T } | { readonly ok: false; readonly refusal: string }>;
  /** Write the intent and flush it; answer once it rests. */
  readonly writeIntent:  (intent: SwitchIntent) => Promise<void>;
  /** Drop the outgoing generation's signer, channels and surfaces. */
  readonly fence:        (old: Session) => Promise<void>;
  /** Mint the new generation's signer and mount under it. The session stands `switching` at its new generation. */
  readonly commit:       (next: Session, target: T) => Promise<{ readonly ok: true } | { readonly ok: false; readonly refusal: string }>;
  /** Write the outcome and flush it. */
  readonly writeOutcome: (outcome: SwitchOutcome) => Promise<void>;
  readonly mintActId?:   () => string;
  /** Where a port's error detail goes; it never rides a refusal. */
  readonly log?:         (line: string) => void;
}

export type SessionSwitchResult =
  | { readonly ok: true; readonly session: Session; readonly switched: boolean }
  | { readonly ok: false; readonly refusal: string; readonly closed: boolean };

/** Two faces are one when every reference they hold reads the same. */
function sameFace(a: SessionFace, b: SessionFace): boolean {
  return a.personaGroup === b.personaGroup && a.proofSubject === b.proofSubject && a.admitRef === b.admitRef
    && a.causalRevision === b.causalRevision
    && (Object.keys(a.planes) as (keyof SessionFace["planes"])[]).every((k) => a.planes[k] === b.planes[k]);
}

/** Switch the session the envelope names to the face the preflight answers, by the five steps above. */
export async function switchSession<T extends SessionSwitchTarget>(ports: SessionSwitchPorts<T>): Promise<SessionSwitchResult> {
  const { table, binding, envelope } = ports;
  const log = (step: string, error: unknown): void => ports.log?.(`switch ${step}: ${error instanceof Error ? error.message : String(error)}`);
  const checked = table.checkBound(envelope, binding);
  if (!checked.ok) return { ok: false, refusal: checked.refusal, closed: false };
  const old = checked.session;
  const sessionId = old.sessionId;
  /** The session still stands on this binding, mid-switch, at `generation`. */
  const stands = (generation: number): boolean =>
    table.held({ ownerEpoch: old.ownerEpoch, sessionId, generation }, binding).ok;

  // 1. FREEZE AND PREFLIGHT. No await sits between the check above and this step.
  table.transition(sessionId, "switching");
  const thaw = (refusal: string): SessionSwitchResult => {
    if (!stands(old.generation)) return { ok: false, refusal: "session-closed", closed: true };
    table.transition(sessionId, "live");
    return { ok: false, refusal, closed: false };
  };
  let target: T;
  try {
    const pre = await ports.preflight();
    if (!pre.ok) return thaw(pre.refusal);
    target = pre.target;
  } catch (error) { log("preflight", error); return thaw("preflight-failed"); }
  if (target.profile !== undefined && target.profile !== old.profile) return thaw("profile-changed");
  if (sameFace(target.face, old.face)) {
    if (!stands(old.generation)) return { ok: false, refusal: "session-closed", closed: true };
    return { ok: true, session: table.transition(sessionId, "live"), switched: false };
  }
  if (!stands(old.generation)) return { ok: false, refusal: "session-closed", closed: true };

  // 2. WRITE THE INTENT.
  const intent: SwitchIntent = Object.freeze({
    actId: (ports.mintActId ?? (() => defaultCryptoProvider.randomUUID()))(), ownerEpoch: old.ownerEpoch,
    generation: old.generation, outgoing: old.face.proofSubject, incoming: target.face.proofSubject,
  });
  // An outcome its row refuses (the same refusal the intent met, past the set-aside cap) rests in the vessel's log by
  // name: the act, the outcome, its refusal and why the row took none of it.
  const closeAct = async (outcome: SwitchOutcome["outcome"], refusal: string): Promise<void> => {
    try { await ports.writeOutcome(Object.freeze({ ...intent, outcome, refusal })); }
    catch (error) { log(`outcome unrecorded in its row: act ${intent.actId} ${outcome} (${refusal})`, error); }
  };
  try { await ports.writeIntent(intent); }
  catch (error) {
    log("intent", error);
    const refusal = error instanceof SwitchActsSetAsideFull ? error.refusal : "intent-unwritten";
    await closeAct("aborted", refusal);
    return thaw(refusal);
  }

  // From the fence on, the outgoing generation has fallen: a fault closes the session and records what stood.
  const closeWith = async (refusal: string): Promise<SessionSwitchResult> => {
    table.close(sessionId);
    await closeAct("closed", refusal);
    return { ok: false, refusal, closed: true };
  };
  if (!stands(old.generation)) return closeWith("session-closed");

  // 3. FENCE THE OUTGOING GENERATION.
  try { await ports.fence(old); }
  catch (error) { log("fence", error); return closeWith("fence-failed"); }
  if (!stands(old.generation)) return closeWith("session-closed");

  // 4. ADVANCE, MOUNT, DIAL. The session stays `switching` at its new generation until step 5 steps it live.
  const advanced = table.advance(sessionId, old.generation, target.face);
  if (!advanced.ok) return closeWith(advanced.refusal);
  const next = advanced.session.generation;
  try {
    const committed = await ports.commit(advanced.session, target);
    if (!committed.ok) return closeWith(committed.refusal);
  } catch (error) { log("commit", error); return closeWith("commit-failed"); }
  if (!stands(next)) return closeWith("session-closed");

  // 5. WRITE THE OUTCOME, then step live.
  try { await ports.writeOutcome(Object.freeze({ ...intent, outcome: "switched" })); }
  catch (error) { log("outcome", error); return closeWith("outcome-unwritten"); }
  if (!stands(next)) return { ok: false, refusal: "session-closed", closed: true };
  return { ok: true, session: table.transition(sessionId, "live"), switched: true };
}
