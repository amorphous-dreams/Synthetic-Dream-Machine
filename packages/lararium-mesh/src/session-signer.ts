/**
 * session-signer — the key ONE session signs with, chained beneath its vessel's face-scoped key.
 *
 * Every hand that reaches a vessel opens a session, and every session holds one signer per Nexus: a key
 * minted at random at the open, certified by the vessel's face-scoped key for the face the session wears,
 * and gone when the session closes or switches. A tab, a CLI run, the disk watcher and a spirit's seat all
 * take the same chain. They differ by the profile their certificate names, and the profile bounds what the
 * signer signs: a seat's signer and the watcher's sign no act that changes who holds authority.
 *
 * The invariants:
 *   · THE SIGNER HOLDS THE ONLY COPY. The secret lives in this object alone. Nothing exports it, no custody
 *     row rests it, and `drop` overwrites it.
 *   · A SIGNER SERVES ONE SESSION AT ONE GENERATION, AND THE OWNER'S TABLE SAYS WHETHER IT STILL STANDS.
 *     A signer keeps the owner's table and the binding its session opened on, and asks the table before
 *     every signature. No caller hands it a record: a record kept from before a close or a switch proves
 *     nothing. A session the table no longer holds at the signer's generation DROPS the signer: the close
 *     or the switch already happened, and this key outlived it by one call at most. A session the table
 *     holds FROZEN (mid-switch, revoked, closing) signs nothing and keeps its signer: a refused preflight
 *     returns the old generation to `live` with its facets whole, and the owner drops the signer itself
 *     when it fences that generation.
 *   · THE BINDING NEVER CROSSES. A session id and an owner epoch belong to the vessel, and one owner epoch
 *     serves every face. Neither enters a signed image or a certificate; the certificate names the face,
 *     the Nexus, two keys and the profile.
 *   · A SPIRIT HOLDS NO KEY OF ITS OWN. A seat's session takes this signer under the face its standing
 *     grant names, as any session of that face does.
 *
 * Pure but for the key it mints: no I/O, no timer, no clock, no table of signers.
 * Called by the dial (`face-dial`), the session face (`session-face`) and the browser adapter; the package barrel
 * does not name it.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-key-hierarchy
 */
import * as ed25519 from "@noble/ed25519";
import { defaultCryptoProvider, hex, type RandomProvider } from "./crypto.js";
import type { VesselFaceKeyCustody } from "./face-authority.js";
import {
  faceProofSubjectRef, isPlaceSigningPurpose, isSessionSigningPurpose, own, placeProofSubjectRef, placeSessionCertificateImage,
  placeSessionSignatureImage, profileSigns, readCertificate, readPlaceScope, readPlaceSessionCertificate, readPlaceSessionSignature,
  readSessionCertificate, readSessionSignature, sessionCertificateImage, sessionSignatureImage,
  type FaceProofRefusal, type KeysHeldApart, type PlaceSessionCertificate, type SessionCertificate, type SessionKey, type Signature,
} from "./face-proof-subjects.js";
import {
  SessionTable, isCapabilityProfile, validateSessionFace,
  type CapabilityProfile, type Session, type SessionBinding,
} from "./session-contract.js";

export const SESSION_SIGNER_REFUSALS = [
  "table-foreign",              // no session table stands behind the mint
  "session-malformed",          // the record handed in reads as no session
  "session-not-live",           // the owner's table holds no live session of this id on this binding
  "session-other-face",         // the session wears another face than the certificate's
  "certificate-refused",        // the vessel's own certificate fails its reading
  "custody-astray",             // the custody door signed under another key than the certificate's
  "signer-dropped",             // the signer already dropped
  "stale-generation",           // the session moved on; the signer drops
  "purpose-unknown",
  "purpose-beyond-profile",     // the profile never signs under this purpose
  "payload-malformed",
  "anchor-moved",               // the place's head moved past the one the session bound; the signer drops
  "anchor-unread",              // the place's head read failed; this signature waits, and the signer stands
] as const;
export type SessionSignerRefusalName = (typeof SESSION_SIGNER_REFUSALS)[number];
export interface SessionSignerRefusal { readonly refusal: SessionSignerRefusalName; readonly cause?: FaceProofRefusal }

/** What a signer stays bound to, on its own vessel. None of it enters a signed image. */
export interface SessionSignerBinding {
  readonly sessionId:  string;
  readonly ownerEpoch: string;
  readonly generation: number;
  readonly profile:    CapabilityProfile;
}

interface SessionRecord extends SessionSignerBinding { readonly proofSubject: string }

/** Read what a signer needs of a session record, each value once. */
function readSession(value: unknown): SessionRecord | null {
  try {
    if (typeof value !== "object" || value === null) return null;
    const { sessionId, ownerEpoch, generation, profile, face } = value as Session;
    const worn = validateSessionFace(face);
    if (typeof sessionId !== "string" || sessionId.length === 0 || typeof ownerEpoch !== "string" || ownerEpoch.length === 0) return null;
    if (typeof generation !== "number" || !Number.isSafeInteger(generation) || generation < 0) return null;
    if (!isCapabilityProfile(profile) || worn === null) return null;
    return { sessionId, ownerEpoch, generation, profile, proofSubject: worn.proofSubject };
  } catch { return null; }
}

/**
 * Ask the owner's table for the session it holds LIVE under this id, epoch and generation, on this binding.
 * A refusal says whether the session has GONE (closed, moved a generation on, another owner's, another
 * binding's) or merely stands frozen in a state that may return to `live`.
 */
function standing(table: SessionTable, binding: SessionBinding, at: Pick<SessionSignerBinding, "sessionId" | "ownerEpoch" | "generation">, mid = false):
  { readonly record: SessionRecord } | { readonly refusal: "stale-generation" | "session-not-live"; readonly gone: boolean } {
  const envelope = { ownerEpoch: at.ownerEpoch, sessionId: at.sessionId, generation: at.generation };
  const checked = mid ? table.held(envelope, binding) : table.check(envelope, binding);
  if (!checked.ok) {
    if (checked.refusal === "stale-generation") return { refusal: "stale-generation", gone: true };
    return { refusal: "session-not-live", gone: checked.refusal !== "session-not-live" };
  }
  const record = readSession(checked.session);
  return record === null ? { refusal: "session-not-live", gone: true } : { record };
}

/**
 * One session's signer. Built by `mintSessionSigner` alone. It hands out its certificate, signs under a
 * purpose its profile allows while the owner's table holds its session live, and drops.
 */
export class SessionSigner {
  readonly certificate: SessionCertificate;
  readonly binding:     SessionSignerBinding;
  readonly #table:      SessionTable;
  readonly #port:       SessionBinding;
  readonly #secret:     Uint8Array;
  #dropped = false;

  /** @internal `mintSessionSigner` builds the one signer a session holds. */
  constructor(lock: symbol, certificate: SessionCertificate, binding: SessionSignerBinding, table: SessionTable, port: SessionBinding, secret: Uint8Array) {
    if (lock !== MINT) throw new TypeError("session-signer: a signer mints through mintSessionSigner alone");
    this.certificate = certificate;
    this.binding = Object.freeze({ ...binding });
    this.#table = table;
    this.#port = port;
    this.#secret = secret;
    Object.freeze(this);
  }

  get dropped(): boolean { return this.#dropped; }

  /** Drop the key: overwrite it, and sign nothing again. The owner calls this at a close and at a switch. */
  drop(): void {
    this.#secret.fill(0);
    this.#dropped = true;
  }

  /**
   * Sign `payload` under `purpose`. The owner's table decides whether the session still stands: a session
   * it holds no longer, or one generation on, or under another face or profile, drops this signer; a
   * session it holds frozen signs nothing and keeps it.
   */
  async sign(purpose: unknown, payload: unknown): Promise<{ readonly signature: Signature } | SessionSignerRefusal> {
    if (this.#dropped) return { refusal: "signer-dropped" };
    const now = standing(this.#table, this.#port, this.binding);
    if (!own(now, "record")) { if (now.gone) this.drop(); return { refusal: now.refusal }; }
    if (now.record.profile !== this.binding.profile) { this.drop(); return { refusal: "session-not-live" }; }
    if (now.record.proofSubject !== faceProofSubjectRef(this.certificate.scope)) { this.drop(); return { refusal: "session-other-face" }; }
    if (!isSessionSigningPurpose(purpose)) return { refusal: "purpose-unknown" };
    if (!profileSigns(this.binding.profile, purpose)) return { refusal: "purpose-beyond-profile" };
    if (!(payload instanceof Uint8Array)) return { refusal: "payload-malformed" };
    const image = sessionSignatureImage(purpose, this.certificate.scope, this.certificate.sessionKey, payload);
    const signature = hex(await ed25519.signAsync(image, this.#secret)) as Signature;
    // A close, a switch or a drop that landed while the key signed: the signature never leaves.
    if (this.#dropped) return { refusal: "signer-dropped" };
    const after = standing(this.#table, this.#port, this.binding);
    if (!own(after, "record")) { if (after.gone) this.drop(); return { refusal: after.refusal }; }
    const reading = readSessionSignature(this.certificate, purpose, payload, signature);
    return own(reading, "read") ? { signature } : { refusal: "signer-dropped", cause: reading };
  }
}

const MINT = Symbol("session-signer mint");

/**
 * Mint the signer one live session holds at one Nexus.
 *
 * `table` and `binding` name the owner's own table and the port or socket the session opened on; the table
 * answers whether `session` stands live there, and the mint reads the table's record, never the caller's.
 * `certificate` names the vessel's OWN certificate under the face the session wears; `custody` signs the
 * session certificate with that vessel's face-scoped key. The session's worn face must name the same proof
 * subject as the certificate's scope, so a session wearing one face takes no signer under another. `apart`
 * names the keys this vessel holds for anything else.
 *
 * The key gets drawn into storage this module owns: the random source keeps no array that holds it, and a
 * mint that refuses or throws overwrites what it drew.
 */
export async function mintSessionSigner(args: {
  table: SessionTable; binding: SessionBinding; session: unknown;
  certificate: unknown; apart: KeysHeldApart; custody: VesselFaceKeyCustody; random?: RandomProvider;
}): Promise<{ readonly signer: SessionSigner } | SessionSignerRefusal> {
  if (!(args.table instanceof SessionTable)) return { refusal: "table-foreign" };
  const named = readSession(args.session);
  if (named === null) return { refusal: "session-malformed" };
  // A mint reads the session live, or mid-switch at its advanced generation (`SessionTable.held`): the switch's commit
  // mints before it steps the session live, and the signer signs nothing until then.
  const now = standing(args.table, args.binding, named, true);
  if (!own(now, "record")) return { refusal: now.refusal };
  const { record } = now;
  const certificate = readCertificate(args.certificate, args.apart);
  if (!own(certificate, "read")) return { refusal: "certificate-refused", cause: certificate };
  const { scope, vesselFaceKey } = certificate.read;
  if (record.proofSubject !== faceProofSubjectRef(scope)) return { refusal: "session-other-face" };

  // The source fills an array this function owns and overwrites, whether the draw returns or throws.
  const drawn = new Uint8Array(32);
  let secret: Uint8Array;
  try {
    (args.random ?? defaultCryptoProvider).getRandomValues(drawn);
    secret = Uint8Array.from(drawn);
  } finally {
    drawn.fill(0);
  }
  let kept = false;
  try {
    const sessionKey = hex(await ed25519.getPublicKeyAsync(secret)) as SessionKey;
    const signed = await args.custody.signAsVesselFace(scope, vesselFaceKey, sessionCertificateImage(scope, vesselFaceKey, sessionKey, record.profile));
    const signature = (signed instanceof Uint8Array ? hex(signed) : "") as Signature;
    const sessionCertificate = readSessionCertificate({ scope, vesselFaceKey, sessionKey, profile: record.profile, signature }, args.apart);
    if (!own(sessionCertificate, "read")) {
      return { refusal: sessionCertificate.refusal === "signature-refused" ? "custody-astray" : "certificate-refused", cause: sessionCertificate };
    }
    const binding = { sessionId: record.sessionId, ownerEpoch: record.ownerEpoch, generation: record.generation, profile: record.profile };
    kept = true;
    return { signer: new SessionSigner(MINT, sessionCertificate.read, binding, args.table, args.binding, secret) };
  } finally {
    if (!kept) secret.fill(0);
  }
}

/**
 * THE ONE DOOR that opens a session and mints its signer, in that order.
 *
 * The session opens first, wearing the face the supplier answered; the signer then mints the session's key
 * and its certificate under the vessel's face-scoped key. The owner answers its caller only when this
 * returns, so no message routes to a session that holds a face and no signer: a mint that refuses, or a
 * custody door that throws, closes the session this door opened before anything else hears of it.
 */
export async function openSignedSession(args: {
  table: SessionTable; binding: SessionBinding; face: unknown; profile: unknown; caps?: readonly string[];
  certificate: unknown; apart: KeysHeldApart; custody: VesselFaceKeyCustody; random?: RandomProvider;
}): Promise<{ readonly session: Session; readonly signer: SessionSigner } | SessionSignerRefusal | { readonly refusal: "session-malformed"; readonly open: string }> {
  if (!(args.table instanceof SessionTable)) return { refusal: "table-foreign" };
  const opened = args.table.open(args.binding, args.face, args.profile, args.caps ?? []);
  if (!opened.ok) return { refusal: "session-malformed", open: opened.refusal };
  let kept = false;
  try {
    const minted = await mintSessionSigner({
      table: args.table, binding: args.binding, session: opened.session, certificate: args.certificate, apart: args.apart, custody: args.custody,
      ...(args.random ? { random: args.random } : {}),
    });
    if (!own(minted, "signer")) return minted;
    kept = true;
    return { session: opened.session, signer: minted.signer };
  } finally {
    if (!kept) args.table.close(opened.session.sessionId);
  }
}

// ── THE PLACE-ANCHORED SIGNER ─────────────────────────────────────────────────────────────────────
//
// A vessel standing with no Nexus anchors its sessions at its own place (session-contract#/the-hands). There the
// face proves itself by its atom presented to its own vessel: the atom signs one session key's certificate at the
// mint, and the session key signs from then on, behind the same table gate as a Nexus session's signer. The atom's
// secret never rides the signer: the caller's `signAsAtom` signs the one certificate image and the signer keeps the
// session key alone.

/** One place session's signer. Built by `mintPlaceSessionSigner` alone. */
/** The place head a session bound, and the read of where the place stands now (it throws where the read fails). */
export interface PlaceAnchorWatch {
  readonly bound:   string;
  readonly headNow: () => Promise<string>;
}

export class PlaceSessionSigner {
  readonly certificate: PlaceSessionCertificate;
  readonly binding:     SessionSignerBinding;
  readonly #table:      SessionTable;
  readonly #port:       SessionBinding;
  readonly #secret:     Uint8Array;
  readonly #anchor:     PlaceAnchorWatch | undefined;
  #dropped = false;

  /** @internal `mintPlaceSessionSigner` builds the one signer a place session holds. */
  constructor(lock: symbol, certificate: PlaceSessionCertificate, binding: SessionSignerBinding, table: SessionTable, port: SessionBinding, secret: Uint8Array,
    anchor?: PlaceAnchorWatch) {
    if (lock !== MINT) throw new TypeError("session-signer: a place signer mints through mintPlaceSessionSigner alone");
    this.certificate = certificate;
    this.binding = Object.freeze({ ...binding });
    this.#table = table;
    this.#port = port;
    this.#secret = secret;
    this.#anchor = anchor;
    Object.freeze(this);
  }

  /** Where the place stands against the head the session bound: null while it stands there. */
  async #anchorMoved(): Promise<"anchor-moved" | "anchor-unread" | null> {
    if (!this.#anchor) return null;
    let head: string;
    try { head = await this.#anchor.headNow(); } catch { return "anchor-unread"; }
    if (head === this.#anchor.bound) return null;
    this.drop();
    return "anchor-moved";
  }

  get dropped(): boolean { return this.#dropped; }

  drop(): void {
    this.#secret.fill(0);
    this.#dropped = true;
  }

  /** Sign `payload` under `purpose` while the owner's table holds this session live, as `SessionSigner.sign` does. */
  async sign(purpose: unknown, payload: unknown): Promise<{ readonly signature: Signature } | SessionSignerRefusal> {
    if (this.#dropped) return { refusal: "signer-dropped" };
    const now = standing(this.#table, this.#port, this.binding);
    if (!own(now, "record")) { if (now.gone) this.drop(); return { refusal: now.refusal }; }
    if (now.record.profile !== this.binding.profile) { this.drop(); return { refusal: "session-not-live" }; }
    if (now.record.proofSubject !== placeProofSubjectRef(this.certificate.scope)) { this.drop(); return { refusal: "session-other-face" }; }
    if (!isPlaceSigningPurpose(purpose)) return { refusal: "purpose-unknown" };
    if (!profileSigns(this.binding.profile, purpose)) return { refusal: "purpose-beyond-profile" };
    if (!(payload instanceof Uint8Array)) return { refusal: "payload-malformed" };
    // THE PLACE'S HEAD READS AT THE SIGNATURE, before it and after it: a rotation between a frame's check and this
    // signature refuses `anchor-moved` and drops, so no signature leaves under a head the place has left.
    const before = await this.#anchorMoved();
    if (before !== null) return { refusal: before };
    const image = placeSessionSignatureImage(purpose, this.certificate.scope, this.certificate.sessionKey, payload);
    const signature = hex(await ed25519.signAsync(image, this.#secret)) as Signature;
    if (this.#dropped) return { refusal: "signer-dropped" };
    const after = standing(this.#table, this.#port, this.binding);
    if (!own(after, "record")) { if (after.gone) this.drop(); return { refusal: after.refusal }; }
    const moved = await this.#anchorMoved();
    if (moved !== null) return { refusal: moved };
    const reading = readPlaceSessionSignature(this.certificate, purpose, payload, signature);
    return own(reading, "read") ? { signature } : { refusal: "signer-dropped", cause: reading };
  }
}

/**
 * Mint the signer one live place session holds. `scope` names the face's atom key and the vessel's place; the
 * session's worn face must name that scope's proof subject. `signAsAtom` signs the certificate image with the face's
 * atom and answers its hex; a signature under another key refuses `custody-astray`.
 */
export async function mintPlaceSessionSigner(args: {
  table: SessionTable; binding: SessionBinding; session: unknown; scope: unknown;
  signAsAtom: (image: Uint8Array) => Promise<string>; random?: RandomProvider;
  /** The head the session bound and how to read the place's head now: each signature reads it (`anchor-moved`). */
  anchor?: PlaceAnchorWatch;
}): Promise<{ readonly signer: PlaceSessionSigner } | SessionSignerRefusal> {
  if (!(args.table instanceof SessionTable)) return { refusal: "table-foreign" };
  const named = readSession(args.session);
  if (named === null) return { refusal: "session-malformed" };
  const now = standing(args.table, args.binding, named, true);
  if (!own(now, "record")) return { refusal: now.refusal };
  const { record } = now;
  const scope = readPlaceScope(args.scope);
  if (!own(scope, "read")) return { refusal: "certificate-refused", cause: scope };
  if (record.proofSubject !== placeProofSubjectRef(scope.read)) return { refusal: "session-other-face" };

  const drawn = new Uint8Array(32);
  let secret: Uint8Array;
  try {
    (args.random ?? defaultCryptoProvider).getRandomValues(drawn);
    secret = Uint8Array.from(drawn);
  } finally {
    drawn.fill(0);
  }
  let kept = false;
  try {
    const sessionKey = hex(await ed25519.getPublicKeyAsync(secret)) as SessionKey;
    const signed = await args.signAsAtom(placeSessionCertificateImage(scope.read, sessionKey, record.profile));
    const certificate = readPlaceSessionCertificate({ scope: scope.read, sessionKey, profile: record.profile, signature: typeof signed === "string" ? signed : "" });
    if (!own(certificate, "read")) {
      return { refusal: certificate.refusal === "signature-refused" ? "custody-astray" : "certificate-refused", cause: certificate };
    }
    const binding = { sessionId: record.sessionId, ownerEpoch: record.ownerEpoch, generation: record.generation, profile: record.profile };
    kept = true;
    return { signer: new PlaceSessionSigner(MINT, certificate.read, binding, args.table, args.binding, secret, args.anchor) };
  } finally {
    if (!kept) secret.fill(0);
  }
}
