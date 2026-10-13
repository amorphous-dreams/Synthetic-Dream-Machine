/**
 * gate-exchange — what crosses between a dialer and a gate, and the bytes each signature covers.
 *
 * The exchange, in the order it runs (lar:///ha.ka.ba/lares/api/pono/face-proof#/the-gate-exchange):
 *
 *     dialer → gate   the FIRST FLIGHT: the knock, and Noise IK message one over an empty payload
 *     gate → dialer   message two, over an empty payload: no verdict rides it
 *     dialer → gate   the PRESENTATION, sealed: two certificates, at most one arm, a frontier, carried events
 *     dialer → gate   the SIGNED FINISH, sealed: the session key signs this handshake and this presentation
 *     gate → dialer   the ANSWER and the gate's signature over it, sealed; or nothing at all
 *
 * This module holds the subjects both ends share: the presentation and its reader, the answer and its
 * reader, the image of the finish, the image of the verdict, and the frames the sealed channel carries.
 * It decides nothing: `face-gate` reads a presentation and answers; `face-dial` presents and reads the
 * answer.
 *
 * The invariants:
 *   · A SIGNATURE COVERS THE BYTES THAT CROSSED. The finish signs a digest of the presentation's own bytes
 *     and the verdict signs a digest of the answer's own bytes, so neither end signs a re-encoding.
 *   · THE FINISH BINDS ONE DIAL. It covers the completed handshake's hash, the gate bundle's digest, the
 *     presentation and the audience; the session signature's own image adds the face key, the Nexus and the
 *     session key. A recorder of a first flight holds no handshake hash to sign.
 *   · NO VESSEL STANDS IN A PRESENTATION. Its reader takes exact keys: no card, no vessel key, no root, no
 *     edge and no handle rides one.
 *   · ONE ARM AT MOST, and a face's arm names the face key as its subject.
 *   · A PLACE STANDS OUTSIDE THE FACE PROOF. A faceless place presents its own key and at most its carriage
 *     contract, under its own exact keys, and signs its finish under its own name: a place's presentation
 *     reads as no face's, and a face's as no place's.
 *
 * THE FRAME LAYOUT STANDS PROVISIONAL. A sealed frame leads with one tag byte, and a presentation or an
 * answer that outgrows one frame rides in parts. The house reads this layout as its own until the browser's
 * exchange gets measured through real proxies; the cutover may move it, and nothing here stands as law.
 *
 * Pure: no key, no I/O, no clock, no timer, no randomness.
 * Stands specified in code until the socket cutover consumes it; out of the package barrel till then.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { isPresentedAdmit } from "./auth-wire.js";
import type { CarriageEntry, PresentedLineageAct } from "./carriage-registry.js";
import { canonicalJsonBytes, hex, hexToBytes, utf8Bytes } from "./crypto.js";
import { CARRIAGE_ENTRY_DOMAIN, GATE_FINISH_DOMAIN, GATE_PLACE_FINISH_DOMAIN, GATE_PRESENTATION_DOMAIN, GATE_VERDICT_DOMAIN } from "./domains.js";
import { acceptEd25519Key } from "./ed25519-door.js";
import { WITHDRAWAL_HISTORY_BOUND } from "./face-authority.js";
import type { FaceWithdrawal, SessionCertificate, VesselFaceCertificate, WithdrawalFrontier } from "./face-proof-subjects.js";
import { gateFields } from "./gate-bundle.js";
import { isHostingGrant, isInviteToken, type HostingGrant, type InviteToken } from "./hosting.js";
import { NOISE_MAX_MESSAGE_BYTES } from "./noise-ik.js";

// ── Frames on the sealed channel (provisional layout) ───────────────────────────────────────────

/** The tag a sealed frame leads with. */
export const GATE_FRAME = Object.freeze({
  presentationPart: 0x01, presentationEnd: 0x02, finish: 0x03,
  answerPart: 0x11, answerEnd: 0x12, verdict: 0x13,
} as const);

/** The most bytes one frame's body holds: a Noise message less its tag and this layout's own tag byte. */
export const GATE_FRAME_BODY_MAX = NOISE_MAX_MESSAGE_BYTES - 16 - 1;
/** The most bytes a presentation or an answer holds. It bounds what one dial can make either end buffer. */
export const GATE_SUBJECT_MAX_BYTES = 1 << 20;

/** Cut `bytes` into frames: every frame but the last under `partTag`, the last under `endTag`. */
export function gateParts(partTag: number, endTag: number, bytes: Uint8Array): Uint8Array[] {
  if (bytes.length > GATE_SUBJECT_MAX_BYTES) throw new RangeError("gate-exchange: a subject outgrew its bound");
  const frames: Uint8Array[] = [];
  for (let at = 0; ; at += GATE_FRAME_BODY_MAX) {
    const body = bytes.subarray(at, at + GATE_FRAME_BODY_MAX);
    const last = at + GATE_FRAME_BODY_MAX >= bytes.length;
    const frame = new Uint8Array(1 + body.length);
    frame[0] = last ? endTag : partTag;
    frame.set(body, 1);
    frames.push(frame);
    if (last) return frames;
  }
}

/**
 * Join frames back into one subject. `push` answers the whole subject at the end frame, `null` while parts
 * still arrive, and `"refused"` for a foreign tag, a part that rides less than full, or a subject past its
 * bound; a refusal spends the reader.
 */
export function gatePartReader(partTag: number, endTag: number): { push(frame: Uint8Array): Uint8Array | null | "refused" } {
  const parts: Uint8Array[] = [];
  let size = 0;
  let spent = false;
  return {
    push(frame) {
      if (spent || !(frame instanceof Uint8Array) || frame.length < 1 || (frame[0] !== partTag && frame[0] !== endTag)) { spent = true; return "refused"; }
      // Every part but the last rides full, so the bound on a subject's bytes bounds its frames too.
      if (frame[0] === partTag && frame.length !== 1 + GATE_FRAME_BODY_MAX) { spent = true; return "refused"; }
      size += frame.length - 1;
      if (size > GATE_SUBJECT_MAX_BYTES) { spent = true; return "refused"; }
      parts.push(frame.subarray(1));
      if (frame[0] !== endTag) return null;
      spent = true;
      const out = new Uint8Array(size);
      let at = 0;
      for (const part of parts) { out.set(part, at); at += part.length; }
      return out;
    },
  };
}

/** One frame under one tag. */
export function gateFrame(tag: number, body: Uint8Array): Uint8Array {
  const frame = new Uint8Array(1 + body.length);
  frame[0] = tag;
  frame.set(body, 1);
  return frame;
}

// ── The presentation ────────────────────────────────────────────────────────────────────────────

/** What a socket stands as beyond its chain: an admit, a hosting grant, or an invite claim. One at most. */
export type PresentationArm =
  | { readonly kind: "admit"; readonly admit: CarriageEntry; readonly lineage: readonly PresentedLineageAct[] }
  | { readonly kind: "grant"; readonly grant: HostingGrant }
  | { readonly kind: "claim"; readonly nexusAid: string; readonly token: InviteToken; readonly claim: string };

/** What a dialer presents. The face key rides inside both certificates' scope. */
export interface GatePresentation {
  readonly certificate:        VesselFaceCertificate;
  readonly sessionCertificate: SessionCertificate;
  /** At most one arm; null where the dialer stands on its chain alone. */
  readonly arm:                PresentationArm | null;
  /** How much of the face's withdrawal history the presenter holds. */
  readonly frontier:           WithdrawalFrontier;
  /** Withdrawal events the gate may lack. */
  readonly carried:            readonly FaceWithdrawal[];
  /** What the dial asks to reach. */
  readonly audience:           string;
}

const PRESENTATION_KEYS = ["certificate", "sessionCertificate", "arm", "frontier", "carried", "audience"] as const;
const ARM_KEYS = Object.freeze({
  admit: ["kind", "admit", "lineage"], grant: ["kind", "grant"], claim: ["kind", "nexusAid", "token", "claim"],
} as const);
/** An audience: printable ASCII with no space, bounded. One spelling. */
const AUDIENCE = /^[\x21-\x7e]{1,512}$/;
const HEX64 = /^[0-9a-f]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Reflect.ownKeys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

/** The serialized presentation a dialer sends. Canonical JSON: one encoding of one presentation. */
export function encodeGatePresentation(presentation: GatePresentation): Uint8Array {
  return canonicalJsonBytes(presentation);
}

/** A presentation as a gate first reads it: its shape, and nothing verified. */
export interface ReadGatePresentation {
  readonly certificate:        unknown;
  readonly sessionCertificate: unknown;
  readonly arm:                PresentationArm | null;
  /** The key the arm stands under, lower-case hex; null where no arm rides or the arm names no key of its own. */
  readonly armSubject:         string | null;
  readonly frontier:           unknown;
  readonly carried:            unknown;
  readonly audience:           string;
  /** The digest of the bytes that crossed: what the finish signs. */
  readonly digest:             string;
}

function readArm(value: unknown): { arm: PresentationArm; subject: string | null } | null {
  if (!isRecord(value)) return null;
  const kind = value["kind"];
  if (kind === "admit") {
    if (!exactKeys(value, ARM_KEYS.admit) || !isPresentedAdmit({ admit: value["admit"], lineage: value["lineage"] })) return null;
    const admit = value["admit"] as CarriageEntry;
    return { arm: { kind, admit, lineage: value["lineage"] as PresentedLineageAct[] }, subject: admit.nym };
  }
  if (kind === "grant") {
    if (!exactKeys(value, ARM_KEYS.grant) || !isHostingGrant(value["grant"])) return null;
    return { arm: { kind, grant: value["grant"] }, subject: value["grant"].leaf };
  }
  if (kind === "claim") {
    const { nexusAid, token, claim } = value;
    if (!exactKeys(value, ARM_KEYS.claim) || typeof nexusAid !== "string" || nexusAid.length === 0 || !isInviteToken(token) || typeof claim !== "string" || !HEX64.test(claim)) return null;
    // A claim names no key of its own: the grant it earns names the face key that presents it.
    return { arm: { kind, nexusAid, token, claim }, subject: null };
  }
  return null;
}

/**
 * Read the bytes of a presentation: bounded, canonical JSON, exact keys, an audience in its one spelling,
 * and an arm of a known kind. Null for anything else. The chain's own subjects stay unread here: the chain
 * check reads each through its own reader.
 */
export function readGatePresentation(bytes: Uint8Array): ReadGatePresentation | null {
  try {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > GATE_SUBJECT_MAX_BYTES) return null;
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!isRecord(value) || !exactKeys(value, PRESENTATION_KEYS)) return null;
    // One presentation, one encoding: bytes that parse to it under another spelling name another digest, and refuse.
    if (hex(canonicalJsonBytes(value)) !== hex(bytes)) return null;
    const audience = value["audience"];
    if (typeof audience !== "string" || !AUDIENCE.test(audience)) return null;
    let arm: PresentationArm | null = null;
    let armSubject: string | null = null;
    if (value["arm"] !== null) {
      const read = readArm(value["arm"]);
      if (read === null) return null;
      arm = read.arm;
      armSubject = read.subject === null ? null : read.subject.toLowerCase();
    }
    if (!Array.isArray(value["carried"]) || value["carried"].length > WITHDRAWAL_HISTORY_BOUND) return null;
    return Object.freeze({
      certificate: value["certificate"], sessionCertificate: value["sessionCertificate"], arm, armSubject,
      frontier: value["frontier"], carried: value["carried"], audience, digest: gatePresentationDigest(bytes),
    });
  } catch { return null; }
}

/** The digest the finish signs for a presentation: over the bytes that crossed, under its own name. */
export function gatePresentationDigest(bytes: Uint8Array): string {
  return hex(sha256(gateFields(GATE_PRESENTATION_DOMAIN, bytes)));
}

// ── The place's presentation: a faceless place, outside the face proof ──────────────────────────

/** The contract a place presents: the quorum's `carry` act over its key, with the acts that act cites. */
export interface PlaceArm {
  readonly kind:     "place";
  readonly contract: CarriageEntry;
  readonly lineage:  readonly CarriageEntry[];
}

/**
 * What a faceless place presents: its own key, and at most one arm. No certificate, no session certificate,
 * no frontier and no carried event rides it: a place holds no face, so no chain and no withdrawal history
 * stands behind it.
 */
export interface PlacePresentation {
  /** The place's own key: the key that signs this dial's finish. */
  readonly placeKey: string;
  readonly arm:      PlaceArm | null;
  readonly audience: string;
}

const PLACE_KEYS = ["placeKey", "arm", "audience"] as const;
const PLACE_ARM_KEYS = ["kind", "contract", "lineage"] as const;
/** How many acts a contract's lineage may carry. */
export const PLACE_LINEAGE_BOUND = 64;

function isCarrierAct(value: unknown): value is CarriageEntry {
  if (!isRecord(value)) return false;
  return value["kind"] === CARRIAGE_ENTRY_DOMAIN && typeof value["nym"] === "string" && HEX64.test(value["nym"]) &&
    (value["action"] === "carry" || value["action"] === "uncarry") &&
    Array.isArray(value["parents"]) && value["parents"].every((parent) => typeof parent === "string") &&
    typeof value["sealEpochCid"] === "string" && value["sealEpochCid"].length > 0 && Array.isArray(value["signatures"]);
}

export function encodePlacePresentation(presentation: PlacePresentation): Uint8Array {
  return canonicalJsonBytes(presentation);
}

/** A place's presentation as a gate first reads it: its shape, and nothing verified. */
export interface ReadPlacePresentation {
  readonly placeKey: string;
  readonly arm:      PlaceArm | null;
  readonly audience: string;
  readonly digest:   string;
}

/**
 * Read the bytes of a place's presentation: exact keys, one encoding, a key the one door accepts, an
 * audience in its one spelling, and at most a `place` arm whose contract reads as a `carry` act over that
 * same key. Null for anything else: a presentation that carries a certificate beside a place key, or a
 * face's arm under a place key, reads as none.
 */
export function readPlacePresentation(bytes: Uint8Array): ReadPlacePresentation | null {
  try {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > GATE_SUBJECT_MAX_BYTES) return null;
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!isRecord(value) || !exactKeys(value, PLACE_KEYS)) return null;
    if (hex(canonicalJsonBytes(value)) !== hex(bytes)) return null;
    const { placeKey, audience } = value;
    if (typeof placeKey !== "string" || !HEX64.test(placeKey) || !acceptEd25519Key(placeKey).ok) return null;
    if (typeof audience !== "string" || !AUDIENCE.test(audience)) return null;
    let arm: PlaceArm | null = null;
    if (value["arm"] !== null) {
      const raw = value["arm"];
      if (!isRecord(raw) || !exactKeys(raw, PLACE_ARM_KEYS) || raw["kind"] !== "place") return null;
      const { contract, lineage } = raw;
      if (!isCarrierAct(contract) || contract.action !== "carry" || contract.nym !== placeKey) return null;
      if (!Array.isArray(lineage) || lineage.length > PLACE_LINEAGE_BOUND || !lineage.every((act) => isCarrierAct(act) && act.nym === placeKey)) return null;
      arm = { kind: "place", contract, lineage: lineage as CarriageEntry[] };
    }
    return Object.freeze({ placeKey, arm, audience, digest: gatePresentationDigest(bytes) });
  } catch { return null; }
}

/**
 * The image a place's own key signs as its finish: the completed handshake's hash, the bundle's digest, its
 * presentation's digest, the audience and the place key, under the place finish's own name.
 */
export function gatePlaceFinishImage(parts: { handshakeHash: Uint8Array; bundleDigest: string; presentationDigest: string; audience: string; placeKey: string }): Uint8Array {
  return gateFields(GATE_PLACE_FINISH_DOMAIN, parts.handshakeHash, hexToBytes(parts.bundleDigest), hexToBytes(parts.presentationDigest), utf8Bytes(parts.audience), hexToBytes(parts.placeKey));
}

// ── The signed finish ───────────────────────────────────────────────────────────────────────────

/**
 * The payload a session key signs under its `finish` purpose: the completed handshake's hash, the gate
 * bundle's digest, the presentation's digest and the audience. The session signature's own image leads it
 * with the face key, the Nexus and the session key.
 */
export function gateFinishPayload(parts: { handshakeHash: Uint8Array; bundleDigest: string; presentationDigest: string; audience: string }): Uint8Array {
  return gateFields(GATE_FINISH_DOMAIN, parts.handshakeHash, hexToBytes(parts.bundleDigest), hexToBytes(parts.presentationDigest), utf8Bytes(parts.audience));
}

// ── The answer ──────────────────────────────────────────────────────────────────────────────────

/**
 * What a gate answers a presenter whose three signatures verified under an admitted face key. Every other
 * presenter draws nothing. `verified` attaches the session; every other state attaches nothing.
 */
export type GateAnswer =
  | { readonly state: "verified" }
  /** The gate holds later history: `events` carries what the presenter lacks. */
  | { readonly state: "unconfirmed"; readonly frontier: WithdrawalFrontier; readonly events: readonly FaceWithdrawal[] }
  /** A learned denial names the presenter's key: `events` carries the denial. */
  | { readonly state: "withdrawn"; readonly events: readonly FaceWithdrawal[] }
  /** The gate cannot join the presenter's frontier to its own: it asks for the history from its genesis. */
  | { readonly state: "incomplete"; readonly frontier: WithdrawalFrontier }
  /** The face key signed two histories: `events` carries the proof. */
  | { readonly state: "forked"; readonly events: readonly FaceWithdrawal[] };

export const GATE_ANSWER_STATES = ["verified", "unconfirmed", "withdrawn", "incomplete", "forked"] as const;
export type GateAnswerState = (typeof GATE_ANSWER_STATES)[number];

const ANSWER_KEYS: Readonly<Record<GateAnswerState, readonly string[]>> = Object.freeze({
  verified: ["state"], unconfirmed: ["state", "frontier", "events"], withdrawn: ["state", "events"],
  incomplete: ["state", "frontier"], forked: ["state", "events"],
});

export function encodeGateAnswer(answer: GateAnswer): Uint8Array {
  return canonicalJsonBytes(answer);
}

/**
 * Read an answer's shape: a known state under exact keys, in its one encoding. The events and the frontier
 * stay unread: the dialer folds each event through the withdrawal's own reader before it believes one.
 */
export function readGateAnswer(bytes: Uint8Array): { readonly state: GateAnswerState; readonly frontier?: unknown; readonly events?: readonly unknown[] } | null {
  try {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > GATE_SUBJECT_MAX_BYTES) return null;
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!isRecord(value)) return null;
    const state = value["state"];
    if (typeof state !== "string" || !(GATE_ANSWER_STATES as readonly string[]).includes(state)) return null;
    if (!exactKeys(value, ANSWER_KEYS[state as GateAnswerState])) return null;
    if (hex(canonicalJsonBytes(value)) !== hex(bytes)) return null;
    const events = value["events"];
    if (events !== undefined && (!Array.isArray(events) || events.length > WITHDRAWAL_HISTORY_BOUND)) return null;
    return Object.freeze({
      state: state as GateAnswerState,
      ...(value["frontier"] !== undefined ? { frontier: value["frontier"] } : {}),
      ...(events !== undefined ? { events: events as unknown[] } : {}),
    });
  } catch { return null; }
}

/**
 * The image a gate's signing key signs over its answer: the handshake's hash, the bundle's digest and a
 * digest of the answer's own bytes, under the verdict's name. A verdict signed for one dial reads under no
 * other.
 */
export function gateVerdictImage(parts: { handshakeHash: Uint8Array; bundleDigest: string; answer: Uint8Array }): Uint8Array {
  return gateFields(GATE_VERDICT_DOMAIN, parts.handshakeHash, hexToBytes(parts.bundleDigest), sha256(parts.answer));
}

