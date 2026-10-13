/**
 * face-authority — PRIVATE AUTHORITY for the face proof, as a library.
 *
 * The face proof key rests with the root-holding vessel and never travels. This module holds what that key
 * does, and what a reader makes of it:
 *
 *   · ISSUE. A joining vessel mints its own face-scoped key and signs a request with it; the face key signs
 *     ONE certificate over that key.
 *   · WITHDRAW. The face key signs a denial of one vessel's key into a deny-only history, one event past
 *     the last. A withdrawn key never returns: the issuer refuses a certificate for it.
 *   · FOLD. A reader folds every withdrawal event it has verified into a MEMORY: the linked line from the
 *     genesis, the frontier that line reaches, the denials, and any proof that the face key signed two
 *     histories. The fold reads a bag of events and ignores their order, so learning stands as a union and
 *     a memory only accretes.
 *   · CHECK. A gate reads one presented chain against its memory and answers ONE OF SIX verdicts:
 *     `verified`, `unconfirmed`, `withdrawn`, `incomplete`, `forked` or `invalid`. No verdict reads as a
 *     boolean, and only `checkFaceChain` mints the value a `verified` verdict carries.
 *
 * What it never does: hold a secret at rest, write a custody row, read a clock, or keep a list of a face's
 * vessels. A key mints here as bytes the caller hands straight to its custody row (`FACE_PROOF_CUSTODY_ROWS`
 * names the rows), and every signature the face key or a vessel's face-scoped key makes comes back through a
 * custody door the caller supplies. A memory holds denials and the events that carry them, and no
 * certificate.
 *
 * What it leaves to the gate: the signed finish, which proves the presenter holds the session key in THIS
 * dial. A `verified` verdict states that two certificates verify and no learned denial names the vessel's
 * key; it states nothing of possession.
 *
 * Stands specified in code until the join door, the removal door and the gate consume it; out of the
 * package barrel till then.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-withdrawal-proof
 */
import * as ed25519 from "@noble/ed25519";
import { defaultCryptoProvider, hex, type RandomProvider } from "./crypto.js";
import {
  certificateImage, certificateRequestImage, genesisFrontier, own, readCertificate, readCertificateRequest,
  readFaceScope, readFrontier, readSessionCertificate, readVesselFaceKey, readWithdrawal, sameFaceScope,
  withdrawalHead, withdrawalImage, withdrawnKeyDigest,
  type Digest, type FaceKey, type FaceProofRefusal, type FaceScope, type FaceWithdrawal, type KeysHeldApart,
  type SessionCertificate, type SessionKey, type Signature, type VesselFaceCertificate,
  type VesselFaceCertificateRequest, type VesselFaceKey, type WithdrawalFrontier,
} from "./face-proof-subjects.js";
import type { CapabilityProfile } from "./session-contract.js";

// ── Where the keys rest ─────────────────────────────────────────────────────────────────────────

/**
 * The custody rows the face proof needs. This table states their SHAPE for the custody seat's owner; no
 * code here writes one. Both rows hold 32 secret bytes, sealed, read whole or refused by name. The
 * certificate and the withdrawal history hold no secret: they rest in the face's own private causal state.
 */
export const FACE_PROOF_CUSTODY_ROWS = Object.freeze([
  Object.freeze({
    row:     "face-proof-key",
    keyedBy: "(PersonaGroup, Nexus)",
    holder:  "the root-holding vessel alone",
    custody: "cold",
    holds:   "the face proof key's 32 secret bytes, minted at random",
    opensFor: "the join door (one certificate), the removal door (one withdrawal), a face-key roll",
  }),
  Object.freeze({
    row:     "vessel-face-key",
    keyedBy: "(PersonaGroup, Nexus), on each joined vessel",
    holder:  "that vessel",
    custody: "hot",
    holds:   "the vessel's face-scoped key's 32 secret bytes, minted at random on that vessel",
    opensFor: "a session open or a dial (one session certificate)",
  }),
] as const);

/** The custody seat's door for a face proof key: it signs exactly the image handed in, under the key the
 *  scope names, and hands back the 64 signature bytes. */
export interface FaceKeyCustody {
  signAsFace(scope: FaceScope, image: Uint8Array): Promise<Uint8Array>;
}
/** The custody seat's door for one vessel's face-scoped key. */
export interface VesselFaceKeyCustody {
  signAsVesselFace(scope: FaceScope, vesselFaceKey: VesselFaceKey, image: Uint8Array): Promise<Uint8Array>;
}

/** A freshly minted key: its public half, and the secret the caller hands to its custody row and to nothing else. */
export interface MintedKey<K extends string> {
  readonly publicKey: K;
  readonly secret:    Uint8Array;
}

async function mint<K extends string>(random: RandomProvider): Promise<MintedKey<K>> {
  const secret = random.getRandomValues(new Uint8Array(32));
  return { publicKey: hex(await ed25519.getPublicKeyAsync(secret)) as K, secret };
}
/** Mint a face proof key at random. It derives from nothing: no seed, no root, no other key. */
export const mintFaceProofKey = (random: RandomProvider = defaultCryptoProvider): Promise<MintedKey<FaceKey>> => mint<FaceKey>(random);
/** Mint one vessel's face-scoped key at random, on that vessel. */
export const mintVesselFaceKey = (random: RandomProvider = defaultCryptoProvider): Promise<MintedKey<VesselFaceKey>> => mint<VesselFaceKey>(random);

// ── The withdrawal memory ───────────────────────────────────────────────────────────────────────

/** How many withdrawal events one face key's history may hold. A reader keeps no more for one face, and
 *  the issuer signs no event past it: a face that needs more rolls its key. */
export const WITHDRAWAL_HISTORY_BOUND = 1024;

/**
 * What a reader has LEARNED of one face's withdrawals. Only `foldWithdrawals` and `learnWithdrawals` build
 * one, from events each verified under the face key.
 */
export interface WithdrawalMemory {
  readonly scope:    FaceScope;
  /** The linked line from the genesis: positions 1..n, each naming the head before it. */
  readonly line:     readonly FaceWithdrawal[];
  /** How far the line reaches. */
  readonly frontier: WithdrawalFrontier;
  /** Verified events the line does not reach: past a gap, or beside a fork. Their denials still count. */
  readonly loose:    readonly FaceWithdrawal[];
  /** Every key digest any verified event denies, sorted. */
  readonly denied:   readonly Digest[];
  /** Proof that the face key signed two histories: two events at one position, or an event that names a
   *  predecessor the line does not hold. Null while none stands. */
  readonly fork:     readonly FaceWithdrawal[] | null;
}

const MEMORIES = new WeakSet<WithdrawalMemory>();
/** Did this module's own fold build `value`? */
export function isWithdrawalMemory(value: unknown): value is WithdrawalMemory {
  return typeof value === "object" && value !== null && MEMORIES.has(value as WithdrawalMemory);
}

export const WITHDRAWAL_FOLD_REFUSALS = ["carried-malformed", "carried-event-refused", "carried-other-face", "history-over-bound", "memory-foreign"] as const;
export type WithdrawalFoldRefusal = (typeof WITHDRAWAL_FOLD_REFUSALS)[number];
export type WithdrawalFold =
  | { readonly memory: WithdrawalMemory }
  | { readonly refusal: WithdrawalFoldRefusal; readonly cause?: FaceProofRefusal };

const byHead = (a: FaceWithdrawal, b: FaceWithdrawal): number => (withdrawalHead(a) < withdrawalHead(b) ? -1 : withdrawalHead(a) > withdrawalHead(b) ? 1 : 0);

/** Build a memory from events already read and scoped. Order never matters: the result depends on the set. */
function build(scope: FaceScope, events: readonly FaceWithdrawal[]): WithdrawalFold {
  const held = new Map<Digest, FaceWithdrawal>();
  for (const event of events) held.set(withdrawalHead(event), event);
  if (held.size > WITHDRAWAL_HISTORY_BOUND) return { refusal: "history-over-bound" };

  const at = new Map<number, FaceWithdrawal[]>();
  for (const event of held.values()) at.set(event.position, [...(at.get(event.position) ?? []), event]);

  let fork: FaceWithdrawal[] | null = null;
  const contested = [...at.entries()].filter(([, here]) => here.length > 1).sort(([a], [b]) => a - b)[0];
  if (contested) fork = [...contested[1]].sort(byHead).slice(0, 2);

  const line: FaceWithdrawal[] = [];
  let frontier = genesisFrontier(scope);
  for (let position = 1; ; position++) {
    const here = at.get(position);
    if (!here || here.length !== 1) break;
    const event = here[0]!;
    if (event.previous !== frontier.head) {
      // The face key signed an event over a predecessor this line does not hold: a second history.
      const breach = line.length > 0 ? [line[line.length - 1]!, event] : [event];
      if (fork === null || breach[breach.length - 1]!.position < fork[0]!.position) fork = breach;
      break;
    }
    line.push(event);
    frontier = Object.freeze({ position, head: withdrawalHead(event) });
  }

  const onLine = new Set(line.map(withdrawalHead));
  const loose = [...held.values()].filter((event) => !onLine.has(withdrawalHead(event))).sort((a, b) => a.position - b.position || byHead(a, b));
  const denied = [...new Set([...held.values()].map((event) => event.withdrawn))].sort();
  const memory: WithdrawalMemory = Object.freeze({
    scope, line: Object.freeze(line), frontier, loose: Object.freeze(loose), denied: Object.freeze(denied),
    fork: fork === null ? null : Object.freeze(fork),
  });
  MEMORIES.add(memory);
  return { memory };
}

function readEvents(scope: FaceScope, carried: unknown): { events: FaceWithdrawal[] } | { refusal: WithdrawalFoldRefusal; cause?: FaceProofRefusal } {
  let items: unknown[];
  try {
    if (!Array.isArray(carried)) return { refusal: "carried-malformed" };
    // One read of the length, then exactly that many reads: an array that grows while read teaches nothing more.
    const count = carried.length;
    if (!Number.isSafeInteger(count) || count < 0 || count > WITHDRAWAL_HISTORY_BOUND) return { refusal: "history-over-bound" };
    items = [];
    for (let index = 0; index < count; index++) items.push(carried[index]);
  } catch { return { refusal: "carried-malformed" }; }
  const events: FaceWithdrawal[] = [];
  for (const item of items) {
    const reading = readWithdrawal(item);
    if (!own(reading, "read")) return { refusal: "carried-event-refused", cause: reading };
    if (!sameFaceScope(reading.read.scope, scope)) return { refusal: "carried-other-face" };
    events.push(reading.read);
  }
  return { events };
}

/**
 * Fold a bag of withdrawal events into a memory for `scope`. Every event gets read through the one door
 * and must name this scope; one that fails refuses the whole fold, so a reader learns nothing from a
 * presentation that carries a bad event. An empty bag gives the memory of a face that withdrew nothing.
 */
export function foldWithdrawals(scope: FaceScope, events: unknown = []): WithdrawalFold {
  const read = readFaceScope(scope);
  if (!own(read, "read")) return { refusal: "carried-malformed", cause: read };
  const carried = readEvents(read.read, events);
  return own(carried, "refusal") ? carried : build(read.read, carried.events);
}

/** Every event a memory holds: its line, and its loose events. */
export function heldWithdrawals(memory: WithdrawalMemory): readonly FaceWithdrawal[] {
  return [...memory.line, ...memory.loose];
}

/**
 * Learn carried events into a memory: the union of what it held and what arrived. A memory only accretes:
 * every event it verified stays, a denial once counted keeps counting, and a fork once proven stays proven.
 * While no fork stands the frontier never moves back. A fork stops the line below the first contested
 * position, and from then on the face refuses whatever the frontier reads.
 */
export function learnWithdrawals(memory: WithdrawalMemory, carried: unknown): WithdrawalFold {
  if (!isWithdrawalMemory(memory)) return { refusal: "memory-foreign" };
  const read = readEvents(memory.scope, carried);
  if (own(read, "refusal")) return read;
  return build(memory.scope, [...heldWithdrawals(memory), ...read.events]);
}

/** The head a memory's line holds at `position`: the genesis head at zero, null past the frontier. */
function headAt(memory: WithdrawalMemory, position: number): Digest | null {
  if (position === 0) return genesisFrontier(memory.scope).head;
  const event = memory.line[position - 1];
  return event ? withdrawalHead(event) : null;
}

/** How one vessel reads its OWN key against the history it holds. */
export type OwnStanding = "standing" | "withdrawn" | "forked" | "incomplete";
export function readOwnStanding(memory: WithdrawalMemory, vesselFaceKey: VesselFaceKey): OwnStanding {
  if (!isWithdrawalMemory(memory)) return "incomplete";
  if (memory.denied.includes(withdrawnKeyDigest(memory.scope, vesselFaceKey))) return "withdrawn";
  if (memory.fork !== null) return "forked";
  return memory.loose.length > 0 ? "incomplete" : "standing";
}

// ── Issue and withdraw: the root holder's acts ──────────────────────────────────────────────────

export const FACE_AUTHORITY_REFUSALS = [
  "request-refused",         // the request fails its own reading; `cause` names why
  "request-other-face",      // the request names another face or another Nexus than the issuer's history
  "key-withdrawn",           // the face key already denied this key: a withdrawn key never returns
  "already-withdrawn",       // a second denial of one key
  "history-foreign",         // a memory this module never built
  "history-forked",          // the issuer's own history shows a fork: the face key rolls before it signs again
  "history-incomplete",      // the issuer's own history holds a gap
  "history-at-bound",        // the history holds as many events as a reader keeps: the face key rolls
  "key-refused",             // the key to withdraw fails the one door
  "custody-astray",          // the custody door answered with a signature that fails under the expected key
] as const;
export type FaceAuthorityRefusalName = (typeof FACE_AUTHORITY_REFUSALS)[number];
export interface FaceAuthorityRefusal { readonly refusal: FaceAuthorityRefusalName; readonly cause?: FaceProofRefusal }

function wholeHistory(memory: WithdrawalMemory): FaceAuthorityRefusal | null {
  if (!isWithdrawalMemory(memory)) return { refusal: "history-foreign" };
  if (memory.fork !== null) return { refusal: "history-forked" };
  if (memory.loose.length > 0) return { refusal: "history-incomplete" };
  return null;
}

const signatureHex = (bytes: unknown): Signature => (bytes instanceof Uint8Array ? hex(bytes) : "") as Signature;

/**
 * The joining vessel's half: sign a request over its own freshly minted face-scoped key. `apart` names the
 * keys this vessel holds for anything else (its roots, its other faces' keys); a request over one of them
 * refuses.
 */
export async function requestCertificate(args: {
  scope: FaceScope; vesselFaceKey: VesselFaceKey; apart: KeysHeldApart; custody: VesselFaceKeyCustody;
}): Promise<{ readonly request: VesselFaceCertificateRequest } | FaceAuthorityRefusal> {
  // Everything but the signature reads BEFORE the key signs: a key held apart signs no request at all.
  const scope = readFaceScope(args.scope);
  if (!own(scope, "read")) return { refusal: "request-refused", cause: scope };
  const key = readVesselFaceKey(args.vesselFaceKey);
  if (!own(key, "read")) return { refusal: "request-refused", cause: key };
  const apart = [...args.apart];
  if ((key.read as string) === scope.read.faceKey) return { refusal: "request-refused", cause: { refusal: "keys-not-distinct" } };
  if (apart.includes(key.read) || apart.includes(scope.read.faceKey)) return { refusal: "request-refused", cause: { refusal: "key-held-apart" } };
  const signature = signatureHex(await args.custody.signAsVesselFace(scope.read, key.read, certificateRequestImage(scope.read, key.read)));
  const reading = readCertificateRequest({ scope: scope.read, vesselFaceKey: key.read, signature }, apart);
  if (own(reading, "read")) return { request: reading.read };
  return { refusal: reading.refusal === "signature-refused" ? "custody-astray" : "request-refused", cause: reading };
}

/**
 * The root holder's half: read the request, and sign ONE certificate. `history` holds the issuer's own
 * withdrawal memory for this face; a key it already denied gets no certificate.
 */
export async function issueCertificate(args: {
  request: unknown; history: WithdrawalMemory; apart: KeysHeldApart; custody: FaceKeyCustody;
}): Promise<{ readonly certificate: VesselFaceCertificate } | FaceAuthorityRefusal> {
  const unfit = wholeHistory(args.history);
  if (unfit) return unfit;
  const reading = readCertificateRequest(args.request, args.apart);
  if (!own(reading, "read")) return { refusal: "request-refused", cause: reading };
  const { scope, vesselFaceKey } = reading.read;
  if (!sameFaceScope(scope, args.history.scope)) return { refusal: "request-other-face" };
  if (args.history.denied.includes(withdrawnKeyDigest(scope, vesselFaceKey))) return { refusal: "key-withdrawn" };
  const signature = signatureHex(await args.custody.signAsFace(scope, certificateImage(scope, vesselFaceKey)));
  const certificate = readCertificate({ scope, vesselFaceKey, signature }, args.apart);
  return own(certificate, "read") ? { certificate: certificate.read } : { refusal: "custody-astray", cause: certificate };
}

/**
 * The root holder's removal: sign one denial of `vesselFaceKey`, one position past the history's frontier.
 * It answers the event and the history that now holds it.
 */
export async function withdrawKey(args: {
  history: WithdrawalMemory; vesselFaceKey: unknown; custody: FaceKeyCustody;
}): Promise<{ readonly event: FaceWithdrawal; readonly history: WithdrawalMemory } | FaceAuthorityRefusal> {
  const unfit = wholeHistory(args.history);
  if (unfit) return unfit;
  const key = readVesselFaceKey(args.vesselFaceKey);
  if (!own(key, "read")) return { refusal: "key-refused", cause: key };
  const { scope, frontier, line } = args.history;
  if (line.length >= WITHDRAWAL_HISTORY_BOUND) return { refusal: "history-at-bound" };
  const withdrawn = withdrawnKeyDigest(scope, key.read);
  if (args.history.denied.includes(withdrawn)) return { refusal: "already-withdrawn" };
  const position = frontier.position + 1;
  const signature = signatureHex(await args.custody.signAsFace(scope, withdrawalImage(scope, position, frontier.head, withdrawn)));
  const event = readWithdrawal({ scope, position, previous: frontier.head, withdrawn, signature });
  if (!own(event, "read")) return { refusal: "custody-astray", cause: event };
  const next = build(scope, [...heldWithdrawals(args.history), event.read]);
  if (own(next, "refusal")) return { refusal: "history-at-bound" };
  return { event: event.read, history: next.memory };
}

// ── The chain check: what a gate answers ────────────────────────────────────────────────────────

/**
 * A chain whose two certificates verified under an admitted face key, against a memory that held no denial
 * of its vessel key, no fork and no gap. Only `checkFaceChain` mints one. It carries no proof that the
 * presenter holds the session key: the signed finish proves that, at the gate.
 */
export interface VerifiedFaceChain {
  readonly scope:              FaceScope;
  readonly vesselFaceKey:      VesselFaceKey;
  readonly sessionKey:         SessionKey;
  readonly profile:            CapabilityProfile;
  readonly sessionCertificate: SessionCertificate;
  /** The frontier the check stood at. */
  readonly frontier:           WithdrawalFrontier;
}

const CHAINS = new WeakSet<VerifiedFaceChain>();
/** Did `checkFaceChain` mint `value`? An object spelled by hand never did. */
export function isVerifiedFaceChain(value: unknown): value is VerifiedFaceChain {
  return typeof value === "object" && value !== null && CHAINS.has(value as VerifiedFaceChain);
}

export const FACE_CHAIN_REFUSALS = [
  "admitted-malformed", "memory-foreign", "memory-other-face",
  "certificate-refused", "certificate-other-face", "certificate-other-nexus",
  "session-certificate-refused", "session-certificate-other-scope", "session-certificate-other-vessel",
  "frontier-malformed",
  ...WITHDRAWAL_FOLD_REFUSALS,
] as const;
export type FaceChainRefusal = (typeof FACE_CHAIN_REFUSALS)[number];

/** The six verdicts. Every verdict but `invalid` hands back the memory, holding whatever the presenter carried. */
export const FACE_CHAIN_VERDICTS = ["verified", "unconfirmed", "withdrawn", "incomplete", "forked", "invalid"] as const;
export type FaceChainVerdictName = (typeof FACE_CHAIN_VERDICTS)[number];

export type FaceChainVerdict =
  /** Attach the session. */
  | { readonly verdict: "verified";    readonly chain: VerifiedFaceChain; readonly memory: WithdrawalMemory }
  /** The gate holds later history than the presenter showed: hand over `catchUp`, attach nothing. */
  | { readonly verdict: "unconfirmed"; readonly frontier: WithdrawalFrontier; readonly catchUp: readonly FaceWithdrawal[]; readonly memory: WithdrawalMemory }
  /** A learned denial names the vessel's key: refuse, and hand over `evidence`. */
  | { readonly verdict: "withdrawn";   readonly evidence: readonly FaceWithdrawal[]; readonly memory: WithdrawalMemory }
  /** The gate cannot join the presenter's frontier to its own: abstain, and ask for the history from its genesis. */
  | { readonly verdict: "incomplete";  readonly frontier: WithdrawalFrontier; readonly memory: WithdrawalMemory }
  /** The face key signed two histories: refuse every certificate under it, and keep `evidence`. */
  | { readonly verdict: "forked";      readonly evidence: readonly FaceWithdrawal[]; readonly memory: WithdrawalMemory }
  /** A key, a signature, a scope or a binding failed: the stranger's silence. Nothing got learned. */
  | { readonly verdict: "invalid";     readonly refusal: FaceChainRefusal; readonly cause?: FaceProofRefusal };

const invalid = (refusal: FaceChainRefusal, cause?: FaceProofRefusal): FaceChainVerdict =>
  Object.freeze(cause === undefined ? { verdict: "invalid", refusal } : { verdict: "invalid", refusal, cause });

/**
 * Read one presented chain against what this reader has learned.
 *
 * `admitted` names the reader's OWN ground: the face key its Nexus admitted, and its own Nexus. A
 * certificate for any other face key or any other Nexus refuses, whatever it verifies under. `memory` holds
 * what the reader learned of that face's withdrawals; `frontier` and `carried` come from the presenter.
 *
 * The order of reading: the reader's own memory, the certificate, the session certificate, the presenter's
 * frontier, the carried events. Past that point both certificates verified, so the answer may name a state:
 * a fork first, then a denial of this key, then a gap, then the two frontiers.
 */
export function checkFaceChain(input: {
  admitted: FaceScope; certificate: unknown; sessionCertificate: unknown;
  frontier: unknown; carried: unknown; memory: WithdrawalMemory;
}): FaceChainVerdict {
  // Each input gets read ONCE, here: a getter that answers differently later changes nothing below.
  let taken: { admitted: unknown; certificate: unknown; sessionCertificate: unknown; frontier: unknown; carried: unknown; memory: unknown };
  try {
    taken = { admitted: input.admitted, certificate: input.certificate, sessionCertificate: input.sessionCertificate, frontier: input.frontier, carried: input.carried, memory: input.memory };
  } catch { return invalid("admitted-malformed"); }
  const { memory } = taken;
  if (!isWithdrawalMemory(memory)) return invalid("memory-foreign");
  const ground = readFaceScope(taken.admitted);
  if (!own(ground, "read")) return invalid("admitted-malformed", ground);
  const admitted = ground.read;
  if (!sameFaceScope(memory.scope, admitted)) return invalid("memory-other-face");

  const certificate = readCertificate(taken.certificate);
  if (!own(certificate, "read")) return invalid("certificate-refused", certificate);
  if (certificate.read.scope.faceKey !== admitted.faceKey) return invalid("certificate-other-face");
  if (certificate.read.scope.nexus !== admitted.nexus) return invalid("certificate-other-nexus");

  const session = readSessionCertificate(taken.sessionCertificate);
  if (!own(session, "read")) return invalid("session-certificate-refused", session);
  if (!sameFaceScope(session.read.scope, admitted)) return invalid("session-certificate-other-scope");
  if (session.read.vesselFaceKey !== certificate.read.vesselFaceKey) return invalid("session-certificate-other-vessel");

  const presented = readFrontier(taken.frontier);
  if (!own(presented, "read")) return invalid("frontier-malformed", presented);

  const learned = learnWithdrawals(memory, taken.carried);
  if (own(learned, "refusal")) return invalid(learned.refusal, learned.cause);
  const now = learned.memory;

  if (now.fork !== null) return Object.freeze({ verdict: "forked", evidence: now.fork, memory: now });

  const denial = withdrawnKeyDigest(admitted, certificate.read.vesselFaceKey);
  if (now.denied.includes(denial)) {
    const evidence = Object.freeze(heldWithdrawals(now).filter((event) => event.withdrawn === denial));
    return Object.freeze({ verdict: "withdrawn", evidence, memory: now });
  }

  const incomplete = (): FaceChainVerdict => Object.freeze({ verdict: "incomplete", frontier: now.frontier, memory: now });
  if (now.loose.length > 0) return incomplete();
  const { position, head } = presented.read;
  // The line holds no head past its frontier, so a later frontier named and never carried reads as another
  // head at a position this line holds does: nothing here joins the two.
  if (headAt(now, position) !== head) return incomplete();
  if (position < now.frontier.position) {
    return Object.freeze({ verdict: "unconfirmed", frontier: now.frontier, catchUp: Object.freeze(now.line.slice(position)), memory: now });
  }

  const chain: VerifiedFaceChain = Object.freeze({
    scope: certificate.read.scope, vesselFaceKey: certificate.read.vesselFaceKey, sessionKey: session.read.sessionKey,
    profile: session.read.profile, sessionCertificate: session.read, frontier: now.frontier,
  });
  CHAINS.add(chain);
  return Object.freeze({ verdict: "verified", chain, memory: now });
}
