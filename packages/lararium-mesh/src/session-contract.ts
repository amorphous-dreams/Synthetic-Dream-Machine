/**
 * session-contract — the contract a SESSION holds with the vessel it rides.
 *
 * One vessel holds one durable Repo, one store lock, custody and one face-blind daemon. Each browser tab or
 * CLI run opens a volatile SESSION that wears exactly one verified face. This module holds the session's
 * shape, its validators, the holder's message kinds, and the owner's in-memory table of live routes.
 *
 * The invariants:
 *   · THE ID ROUTES; THE BINDING AUTHORIZES. The owner mints a session's id and binds it to one port or one
 *     socket with owner epoch, session id, generation, verified face reference and fixed hand profile.
 *     A copied id presented on another binding opens nothing. What a session may DO rests with the
 *     facets the sovereign worker holds for it; the table carries their labels alone.
 *   · THE OWNER'S EPOCH FENCES A RESTARTED OWNER. Every message after the open names the epoch of the owner
 *     that minted its session. The epoch stands opaque: the owner's own boot epoch, never a clock reading.
 *   · A GENERATION FENCES AN EFFECT. A switch advances the generation by one; a message of any other
 *     generation refuses, so an effect of an earlier generation never lands in a later one.
 *   · A FACE HOLDS REFERENCES. Every field of a session's face names something by string. No field can
 *     hold a persona root, a seed, a signer or any bytes, in the type or at the validator.
 *   · NO ROSTER. The table lives in memory, hands out frozen copies, and offers no serializer and no
 *     enumeration: a list of live sessions would record which faces one vessel wore together.
 *   · HANDS DIFFER BY PROFILE, NEVER BY KEY. Every hand that reaches a vessel opens a session, and a session
 *     carries one capability profile for its whole life. The owner names the profile from the hand it
 *     verified; no message claims one, and a switch of face keeps it.
 *   · A CLOSED ID NEVER ROUTES AGAIN. Within one owner epoch no id serves two sessions, so an envelope kept
 *     from a closed session opens nothing. The table keeps a closed session's id for that, and nothing else
 *     of it: no face, no binding.
 *
 * Pure: no Repo, no key, no signer, no I/O, no timer, no clock.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/session-contract
 */
import { defaultCryptoProvider } from "./crypto.js";
import type {
  LAR_CONTROL_EVENT, LAR_CONTROL_RESULT, LAR_FRAME, LarMsg_ControlEvent, LarMsg_ControlResult, LarMsg_Frame,
} from "./lar-camera.js";

export type SessionState = "opening" | "live" | "switching" | "revoked" | "closing" | "closed";

/** Every named refusal the table answers. A refusal never mutates the table. */
export const SESSION_REFUSALS = [
  "malformed-message", "stale-owner-epoch", "unknown-session", "unbound-session", "stale-generation", "wrong-face",
  "session-not-live", "session-not-switching", "binding-already-bound", "face-malformed", "profile-unknown",
] as const;
export type SessionRefusal = (typeof SESSION_REFUSALS)[number];

/** A programming fault against the contract: an illegal state step, an unknown id handed to `transition`,
 *  or a mint that yields no fresh id. Its message leads with the fault's name. */
export class SessionContractError extends Error {}

// ── The hands and their profiles ────────────────────────────────────────────────────────────────

/**
 * The capability profiles, one per hand: `face` (a person in a live wiki: the face's own reach), `verb` (a
 * person at the CLI: the reach of the verb the run names), `ingest` (the disk watcher: ingest for the wikis
 * it leases) and `seat` (a spirit: narrower than the face's, its writes landing in the working layer alone).
 */
export const CAPABILITY_PROFILES = ["face", "verb", "ingest", "seat"] as const;
export type CapabilityProfile = (typeof CAPABILITY_PROFILES)[number];

/**
 * The profile a faceless PLACE's seat carries at a gate: it carries bytes it cannot open and signs no act of
 * a face. It stands OUTSIDE `CAPABILITY_PROFILES`: those name the hands of a face and feed a session's
 * certificate, and a place holds no session and no certificate.
 */
export const PLACE_PROFILE = "carriage" as const;
/** What a gate's seat may carry: a hand's profile, or the place's. */
export type SeatProfile = CapabilityProfile | typeof PLACE_PROFILE;

/** Each hand's profile. A hand names WHO moved; the face names the relation the move speaks in. */
export const HAND_PROFILES = Object.freeze({ tab: "face", cli: "verb", watcher: "ingest", seat: "seat" } as const);
export type Hand = keyof typeof HAND_PROFILES;

export function isCapabilityProfile(value: unknown): value is CapabilityProfile {
  return typeof value === "string" && (CAPABILITY_PROFILES as readonly string[]).includes(value);
}

/** A verb beyond a profile refuses by name: the refusal carries the profile and the verb it refused. */
export interface ProfileRefusal {
  readonly ok:      false;
  readonly refusal: "beyond-profile";
  readonly profile: CapabilityProfile;
  readonly verb:    string;
}
export function refuseBeyondProfile(profile: CapabilityProfile, verb: string): ProfileRefusal {
  return Object.freeze({ ok: false, refusal: "beyond-profile", profile, verb });
}

/** The absolute ids of a face's five planes. */
export interface SessionFacePlanes {
  readonly persona:    string;
  readonly circles:    string;
  readonly identities: string;
  readonly sessions:   string;
  readonly intents:    string;
}

/** The resolved face a session wears, immutable within one generation. Every field holds a string REFERENCE. */
export interface SessionFace {
  readonly personaGroup:   string;              // the PersonaGroup the face stands in
  readonly proofSubject:   string;              // the subject the face proves as on the wire
  readonly admitRef:       string;              // the verified admit the face rides
  readonly causalRevision: string;              // the causal revision the relation stood at
  readonly planes:         SessionFacePlanes;
}

/** The leaves of `T` that hold anything but a string; `never` when every leaf names by string. */
type NonStringLeaves<T> = T extends string ? never : T extends object ? { [K in keyof T]-?: NonStringLeaves<T[K]> }[keyof T] : T;
type Holds<T extends never> = T;
/**
 * THE FACE HOLDS REFERENCES, proven where the type-check reads it. The first line compiles only while every
 * leaf of a face is a string. The second carries its own control: a face widened by one byte-holding field
 * fails the same test, and the expectation of that failure fails the build if the test ever stops seeing it.
 */
export type SessionFaceHoldsReferences = Holds<NonStringLeaves<SessionFace>>;
// @ts-expect-error a face that could hold root bytes fails the references-only law
export type SessionFaceWithRootRefuses = Holds<NonStringLeaves<SessionFace & { readonly root: Uint8Array }>>;

const FACE_KEYS = ["personaGroup", "proofSubject", "admitRef", "causalRevision", "planes"] as const;
const PLANE_KEYS = ["persona", "circles", "identities", "sessions", "intents"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
const nonEmptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0;

/**
 * Read a face, or null. EXACT keys only: one extra key (a root, a seed, a signer), one non-string or one
 * empty string refuses the whole face. The face returned is a frozen copy that shares nothing with its input:
 * each value gets read ONCE, so a getter that answers differently later changes nothing a session wears.
 */
export function validateSessionFace(v: unknown): SessionFace | null {
  try { return readSessionFace(v); } catch { return null; }      // a value that throws while read is no face
}
function readSessionFace(v: unknown): SessionFace | null {
  if (!isRecord(v) || !exactKeys(v, FACE_KEYS)) return null;
  const planes = v["planes"];
  if (!isRecord(planes) || !exactKeys(planes, PLANE_KEYS)) return null;
  const { personaGroup, proofSubject, admitRef, causalRevision } = v;
  const { persona, circles, identities, sessions, intents } = planes;
  if (!nonEmptyString(personaGroup) || !nonEmptyString(proofSubject) || !nonEmptyString(admitRef) || !nonEmptyString(causalRevision)) return null;
  if (!nonEmptyString(persona) || !nonEmptyString(circles) || !nonEmptyString(identities) || !nonEmptyString(sessions) || !nonEmptyString(intents)) return null;
  return Object.freeze({
    personaGroup, proofSubject, admitRef, causalRevision,
    planes: Object.freeze({ persona, circles, identities, sessions, intents }),
  });
}

/** One mounted surface and the island it leases. */
export interface SessionSurface {
  readonly surfaceId: string;
  readonly kind:      string;
  readonly island:    string;
}

/** A session as the owner holds it. The table hands out frozen copies, never its own record. */
export interface Session {
  readonly sessionId:  string;                    // routes, and authorizes nothing
  readonly ownerEpoch: string;                    // the minting owner's boot epoch
  readonly generation: number;                    // advances by one at each switch
  readonly face:       SessionFace;
  readonly profile:    CapabilityProfile;         // the hand's bound, fixed for the session's whole life
  readonly caps:       readonly string[];         // facet LABELS; the facets rest with the sovereign worker
  readonly state:      SessionState;
  readonly surfaces:   readonly SessionSurface[];
}

/** An opaque token standing for exactly one port or one socket. Two bindings compare by identity. */
export interface SessionBinding { readonly kind: "port" | "socket" }
export function sessionBinding(kind: "port" | "socket"): SessionBinding {
  return Object.freeze({ kind });
}

// ── The holder's message kinds ──────────────────────────────────────────────────────────────────

/** What every message after the open carries. */
export interface SessionEnvelope {
  readonly ownerEpoch:    string;
  readonly sessionId:     string;
  readonly generation:    number;
}
/** A socket or port presents the verified face's proof subject with every bound message. */
export type SessionBoundEnvelope = SessionEnvelope & { readonly faceRef: string };
/** A request, and the reply that returns to the binding that asked, name the request. */
export interface SessionRequestEnvelope extends SessionEnvelope { readonly requestId: string }
/** Surface traffic names its surface. */
export interface SessionSurfaceEnvelope extends SessionEnvelope { readonly surfaceId: string }

/**
 * The kinds a holder speaks. The open and its refusal ride BEFORE a session stands, so they carry no envelope;
 * every other kind does. A reply returns to the originating binding alone; the holder broadcasts nothing.
 * No kind carries a root, a Repo, or a general signer.
 */
export type SessionMessage =
  | { readonly kind: "session:open"; readonly requestId: string; readonly faceRef: string }
  | (SessionRequestEnvelope & { readonly kind: "session:opened"; readonly face: SessionFace; readonly caps: readonly string[] })
  | { readonly kind: "session:refused"; readonly requestId: string; readonly refusal: string }
  | (SessionRequestEnvelope & { readonly kind: "session:call"; readonly verb: string; readonly args: unknown })
  | (SessionRequestEnvelope & { readonly kind: "session:result"; readonly result: unknown })
  | (SessionRequestEnvelope & { readonly kind: "session:surface-open"; readonly surfaceKind: string; readonly ref: string })
  | (SessionRequestEnvelope & SessionSurfaceEnvelope & { readonly kind: "session:surface-ready"; readonly mountEpoch: number })
  | (SessionSurfaceEnvelope & { readonly kind: "session:surface-close" })
  | (SessionSurfaceEnvelope & { readonly kind: typeof LAR_FRAME } & Pick<LarMsg_Frame, "cameraId" | "mountEpoch" | "keys" | "sensedRevision">)
  // The control event rides WHOLE beside the envelope: its own `kind` names the crossing (act, sense, write,
  // service answer), and the holder hands `event` to the contract's reader and to the island unchanged.
  | (SessionSurfaceEnvelope & { readonly kind: typeof LAR_CONTROL_EVENT; readonly event: LarMsg_ControlEvent })
  | (SessionSurfaceEnvelope & { readonly kind: typeof LAR_CONTROL_RESULT } & Omit<LarMsg_ControlResult, "type">)
  | (SessionRequestEnvelope & { readonly kind: "session:switch"; readonly expectedGeneration: number; readonly faceRef: string })
  // The result names the session's generation and face after the fence: `switched` one generation on, or
  // `unchanged` where the target named the face the session already wore.
  | (SessionRequestEnvelope & { readonly kind: "session:switch-result"; readonly outcome: "switched" | "unchanged"; readonly faceRef: string })
  | (SessionEnvelope & { readonly kind: "session:revoke"; readonly reason: string })
  | (SessionEnvelope & { readonly kind: "session:close"; readonly cause: string })
  | (SessionEnvelope & { readonly kind: "session:closed" });

/** Read the envelope a message carries, or null: non-empty strings and a counting generation. */
export function validateSessionEnvelope(v: unknown): SessionEnvelope | null {
  try { return readSessionEnvelope(v); } catch { return null; }
}
export function validateSessionBoundEnvelope(v: unknown): SessionBoundEnvelope | null {
  try {
    const envelope = readSessionEnvelope(v);
    if (!envelope || !isRecord(v)) return null;
    const faceRef = v["faceRef"];
    return nonEmptyString(faceRef) ? Object.freeze({ ...envelope, faceRef }) : null;
  } catch { return null; }
}
function readSessionEnvelope(v: unknown): SessionEnvelope | null {
  if (!isRecord(v)) return null;
  const { ownerEpoch, sessionId, generation } = v;
  if (!nonEmptyString(ownerEpoch) || !nonEmptyString(sessionId)) return null;
  if (typeof generation !== "number" || !Number.isSafeInteger(generation) || generation < 0) return null;
  return Object.freeze({ ownerEpoch, sessionId, generation });
}

// ── The state machine ───────────────────────────────────────────────────────────────────────────

const TRANSITIONS: Readonly<Record<SessionState, readonly SessionState[]>> = Object.freeze({
  opening:   ["live", "closing", "closed"],
  live:      ["switching", "revoked", "closing"],
  switching: ["live", "revoked", "closing"],     // back to `live` at the SAME generation: a refused preflight
  revoked:   ["closing", "closed"],
  closing:   ["closed"],
  closed:    [],
});

/** May a session step from `from` to `to`? No state steps to itself, and `closed` steps nowhere. */
export function sessionTransitionLegal(from: SessionState, to: SessionState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// ── The owner's table ───────────────────────────────────────────────────────────────────────────

export type SessionOpenResult =
  | { readonly ok: true;  readonly session: Session }
  | { readonly ok: false; readonly refusal: SessionRefusal };
export type SessionCheckResult = SessionOpenResult;
/** The references fixed to one socket or port. */
export interface SessionBound {
  readonly ownerEpoch: string;
  readonly sessionId: string;
  readonly generation: number;
  readonly faceRef: string;
  readonly profile: CapabilityProfile;
}

interface SessionRecord { session: Session; readonly binding: SessionBinding }

const MINT_TRIES = 32;

function frozenSession(session: Session): Session {
  return Object.freeze({
    ...session,
    caps: Object.freeze([...session.caps]),
    surfaces: Object.freeze(session.surfaces.map((surface) => Object.freeze({ ...surface }))),
  });
}

/**
 * The owner's LIVE routes, in memory alone. The caller verifies custody or delegation, the admit, the proof
 * subject and the planes BEFORE it opens; the table then mints the id and binds it. It persists nothing and
 * enumerates nothing.
 */
export class SessionTable {
  readonly #ownerEpoch: string;
  readonly #mintId: () => string;
  readonly #records = new Map<string, SessionRecord>();
  readonly #bound = new Map<SessionBinding, string>();
  /** The ids of closed sessions: ids alone, so that none routes a second session within this owner's epoch. */
  readonly #spent = new Set<string>();

  constructor(ownerEpoch: string, mintId: () => string = () => defaultCryptoProvider.randomUUID()) {
    if (!nonEmptyString(ownerEpoch)) throw new SessionContractError("owner-epoch-absent");
    this.#ownerEpoch = ownerEpoch;
    this.#mintId = mintId;
  }

  /** How many sessions stand. A count, never a list. */
  get size(): number { return this.#records.size; }

  /**
   * Open a session on `binding` wearing `face` under `profile`, the bound of the hand the owner verified.
   * One binding holds at most one session. The session stands `live` at generation 0 under a freshly
   * minted id.
   */
  open(binding: SessionBinding, face: unknown, profile: unknown, caps: readonly string[] = []): SessionOpenResult {
    if (this.#bound.has(binding)) return { ok: false, refusal: "binding-already-bound" };
    const worn = validateSessionFace(face);
    if (!worn) return { ok: false, refusal: "face-malformed" };
    if (!isCapabilityProfile(profile)) return { ok: false, refusal: "profile-unknown" };
    if (!Array.isArray(caps) || !caps.every(nonEmptyString)) return { ok: false, refusal: "malformed-message" };
    let sessionId: string | null = null;
    for (let i = 0; i < MINT_TRIES && sessionId === null; i++) {
      const candidate = this.#mintId();
      if (nonEmptyString(candidate) && !this.#records.has(candidate) && !this.#spent.has(candidate)) sessionId = candidate;
    }
    if (sessionId === null) throw new SessionContractError("session-id-mint-exhausted");
    const session = frozenSession({
      sessionId, ownerEpoch: this.#ownerEpoch, generation: 0, face: worn, profile, caps, state: "live", surfaces: [],
    });
    this.#records.set(sessionId, { session, binding });
    this.#bound.set(binding, sessionId);
    return { ok: true, session };
  }

  /**
   * Does `message` stand on `binding`? The first fault in this order names the refusal: a malformed envelope,
   * another owner's epoch, an unknown id, an id bound elsewhere, a generation other than the session's own,
   * a session in any state but `live`.
   */
  check(message: unknown, binding: SessionBinding): SessionCheckResult {
    return this.#read(message, binding, false);
  }

  /** The bound socket or port also checks its verified face after generation and before liveness. */
  checkBound(message: unknown, binding: SessionBinding): SessionCheckResult {
    return this.#read(message, binding, true);
  }

  /** The five references bound to this socket or port, without face planes or root bytes. */
  bound(binding: SessionBinding): SessionBound | null {
    const id = this.#bound.get(binding);
    const session = id === undefined ? undefined : this.#records.get(id)?.session;
    if (!session) return null;
    return Object.freeze({ ownerEpoch: session.ownerEpoch, sessionId: session.sessionId,
      generation: session.generation, faceRef: session.face.proofSubject, profile: session.profile });
  }

  #read(message: unknown, binding: SessionBinding, faceBound: boolean): SessionCheckResult {
    const envelope = faceBound ? validateSessionBoundEnvelope(message) : validateSessionEnvelope(message);
    if (!envelope) return { ok: false, refusal: "malformed-message" };
    if (envelope.ownerEpoch !== this.#ownerEpoch) return { ok: false, refusal: "stale-owner-epoch" };
    const record = this.#records.get(envelope.sessionId);
    if (!record) return { ok: false, refusal: "unknown-session" };
    if (record.binding !== binding) return { ok: false, refusal: "unbound-session" };
    if (envelope.generation !== record.session.generation) return { ok: false, refusal: "stale-generation" };
    if (faceBound && (envelope as SessionBoundEnvelope).faceRef !== record.session.face.proofSubject) return { ok: false, refusal: "wrong-face" };
    if (record.session.state !== "live") return { ok: false, refusal: "session-not-live" };
    return { ok: true, session: record.session };
  }

  /** Step a session's state. An illegal step or an unknown id throws by name; `closed` removes the record. */
  transition(sessionId: string, to: SessionState): Session {
    const record = this.#records.get(sessionId);
    if (!record) throw new SessionContractError("unknown-session");
    const from = record.session.state;
    if (!sessionTransitionLegal(from, to)) throw new SessionContractError(`illegal-session-transition: ${from} -> ${to}`);
    const stepped = frozenSession({ ...record.session, state: to });
    if (to === "closed") this.close(sessionId);
    else record.session = stepped;
    return stepped;
  }

  /**
   * Commit a switch: only from `switching`, only at the expected generation, only onto a lawful face. The
   * session then wears the new face, live, one generation on. A refusal changes nothing.
   */
  advance(sessionId: string, expectedGeneration: number, face: unknown): SessionCheckResult {
    const record = this.#records.get(sessionId);
    if (!record) return { ok: false, refusal: "unknown-session" };
    if (record.session.state !== "switching") return { ok: false, refusal: "session-not-switching" };
    if (expectedGeneration !== record.session.generation) return { ok: false, refusal: "stale-generation" };
    const worn = validateSessionFace(face);
    if (!worn) return { ok: false, refusal: "face-malformed" };
    record.session = frozenSession({ ...record.session, generation: record.session.generation + 1, face: worn, state: "live" });
    return { ok: true, session: record.session };
  }

  /** End a session from any state: its record and its binding both drop, and its id never serves another
   *  session of this table. False when no such session stands. */
  close(sessionId: string): boolean {
    const record = this.#records.get(sessionId);
    if (!record) return false;
    this.#records.delete(sessionId);
    this.#bound.delete(record.binding);
    this.#spent.add(sessionId);
    return true;
  }
}
