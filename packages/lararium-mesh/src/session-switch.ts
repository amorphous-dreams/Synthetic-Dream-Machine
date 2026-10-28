/**
 * session-switch — the five-step fence that switches ONE session's face in place.
 *
 * A switch changes the face a live session wears and nothing else: every other session of the owner's table and
 * the daemon go on untouched. It runs five steps over the owner's `SessionTable`, each through a port the owner
 * supplies, in this order:
 *
 *   1. FREEZE AND PREFLIGHT. The session steps to `switching`, so a new call on it refuses `session-not-live`. The
 *      preflight verifies the target face afresh and answers an immutable description; it mounts nothing and mints
 *      no key. A refused or throwing preflight returns the session to `live` at the SAME generation, its facets
 *      whole. A target that names the face the session already wears changes nothing either: the session returns
 *      to `live` at its generation and its signer keeps signing (`switched: false`).
 *   2. WRITE THE INTENT. A vessel-private switch act names the causal position (owner epoch, generation), the
 *      outgoing face and the incoming face, and the port answers once it has flushed. An intent that never lands
 *      leaves the session `live` at its generation, since nothing has fallen yet.
 *   3. FENCE THE OLD GENERATION. The port drops the old signer and closes the old channels and surfaces. An effect
 *      in flight resolves through its durable receipt.
 *   4. ADVANCE, MOUNT, DIAL. The table advances the session one generation onto the target face; the port mints
 *      the new signer and mounts under the new face.
 *   5. WRITE THE OUTCOME. A fence, a commit or an outcome write that fails CLOSES this session and records the
 *      partial outcome; the caller opens afresh. Nothing restores the old face's authority in silence.
 *
 * The switch act records no session id: an act names a position and two faces, never which sessions stood.
 *
 * Pure but for its ports: no Repo, no key, no I/O, no timer, no clock.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/session-contract#/the-switch
 */
import { defaultCryptoProvider } from "./crypto.js";
import type { CapabilityProfile, Session, SessionBinding, SessionEnvelope, SessionFace, SessionTable } from "./session-contract.js";

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
/** The record a switch writes after its commit, or after the step that closed the session. */
export interface SwitchOutcome extends SwitchIntent {
  readonly outcome:  "switched" | "closed";
  readonly refusal?: string;
}

export interface SessionSwitchPorts<T extends SessionSwitchTarget> {
  readonly table:    SessionTable;
  readonly binding:  SessionBinding;
  /** The envelope the switch frame carried: its generation names the generation the caller expects to leave. */
  readonly envelope: SessionEnvelope;
  /** Verify the target afresh and describe it; mount nothing, mint nothing. */
  readonly preflight:    () => Promise<{ readonly ok: true; readonly target: T } | { readonly ok: false; readonly refusal: string }>;
  /** Write the intent and flush it; answer once it rests. */
  readonly writeIntent:  (intent: SwitchIntent) => Promise<void>;
  /** Drop the old generation's signer, channels and surfaces. */
  readonly fence:        (old: Session) => Promise<void>;
  /** Mint the new generation's signer and mount under it. */
  readonly commit:       (next: Session, target: T) => Promise<{ readonly ok: true } | { readonly ok: false; readonly refusal: string }>;
  /** Write the outcome and flush it. */
  readonly writeOutcome: (outcome: SwitchOutcome) => Promise<void>;
  readonly mintActId?:   () => string;
}

export type SessionSwitchResult =
  | { readonly ok: true; readonly session: Session; readonly switched: boolean }
  | { readonly ok: false; readonly refusal: string; readonly closed: boolean };

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error)) || "threw";

/** Switch the session the envelope names to the face the preflight answers, by the five steps above. */
export async function switchSession<T extends SessionSwitchTarget>(ports: SessionSwitchPorts<T>): Promise<SessionSwitchResult> {
  const { table, binding, envelope } = ports;
  const checked = table.check(envelope, binding);
  if (!checked.ok) return { ok: false, refusal: checked.refusal, closed: false };
  const old = checked.session;
  const sessionId = old.sessionId;

  // 1. FREEZE AND PREFLIGHT.
  table.transition(sessionId, "switching");
  const thaw = (refusal: string): SessionSwitchResult => {
    table.transition(sessionId, "live");
    return { ok: false, refusal, closed: false };
  };
  let target: T;
  try {
    const pre = await ports.preflight();
    if (!pre.ok) return thaw(pre.refusal);
    target = pre.target;
  } catch (error) { return thaw(`preflight-failed: ${reason(error)}`); }
  if (target.profile !== undefined && target.profile !== old.profile) return thaw("profile-changed");
  if (target.face.proofSubject === old.face.proofSubject) {
    const still = table.transition(sessionId, "live");
    return { ok: true, session: still, switched: false };
  }

  // 2. WRITE THE INTENT.
  const intent: SwitchIntent = Object.freeze({
    actId: (ports.mintActId ?? (() => defaultCryptoProvider.randomUUID()))(), ownerEpoch: old.ownerEpoch,
    generation: old.generation, outgoing: old.face.proofSubject, incoming: target.face.proofSubject,
  });
  try { await ports.writeIntent(intent); }
  catch (error) { return thaw(`intent-unwritten: ${reason(error)}`); }

  // From here the old generation falls: a fault closes the session and records what stood.
  const closeWith = async (refusal: string): Promise<SessionSwitchResult> => {
    table.close(sessionId);
    try { await ports.writeOutcome(Object.freeze({ ...intent, outcome: "closed", refusal })); } catch { /* the intent stands without its outcome; a reader reads it unfinished */ }
    return { ok: false, refusal, closed: true };
  };

  // 3. FENCE THE OLD GENERATION.
  try { await ports.fence(old); }
  catch (error) { return closeWith(`fence-failed: ${reason(error)}`); }

  // 4. ADVANCE, MOUNT, DIAL.
  const advanced = table.advance(sessionId, old.generation, target.face);
  if (!advanced.ok) return closeWith(advanced.refusal);
  try {
    const committed = await ports.commit(advanced.session, target);
    if (!committed.ok) return closeWith(committed.refusal);
  } catch (error) { return closeWith(`commit-failed: ${reason(error)}`); }

  // 5. WRITE THE OUTCOME.
  try { await ports.writeOutcome(Object.freeze({ ...intent, outcome: "switched" })); }
  catch (error) { return closeWith(`outcome-unwritten: ${reason(error)}`); }
  return { ok: true, session: advanced.session, switched: true };
}
