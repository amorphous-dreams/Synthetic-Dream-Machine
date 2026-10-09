/**
 * leaf-peer-proof — two LEAVES of one PersonaGroup prove their device keys to each other over a relay that
 * reads nothing, and the proof binds the session it admits.
 *
 * WHAT IT PROVES. Each leaf answers "the key across from me is a device my own PersonaGroup delegated, that
 * device holds its key on THIS exchange, and every frame after this one comes from it". Three parts compose:
 *   · the peer's DeviceDelegation edge, licensed CLOCKLESSLY against the verifier's own persona-KEL head and the
 *     lease epoch the verifier holds (`verifyEdgeAgainstPersonaKel` — an edge a rotated-away op-key signed reads
 *     as rolled past, and an edge bound below the held epoch reads as lapsed; both refuse);
 *   · a signature by the peer's DEVICE key over the whole TRANSCRIPT (`leafPeerProofBytes`): both nonces, both
 *     ephemeral keys and the prover's role, so a proof made for one exchange verifies on no other and a relay
 *     that swaps any ephemeral key breaks it on the side that reads the swap;
 *   · a SESSION both sides derive from the two ephemeral keys and that same transcript (`LeafPeerSession`):
 *     every later frame rides sealed under a per-direction key, its AEAD bound to a hash CHAIN of the frames
 *     before it. This follows the Noise channel-binding idea with the house's own primitives (X25519, HKDF-SHA256,
 *     XChaCha20-Poly1305): the key that seals the traffic derives from the very ephemerals the device keys signed.
 * The output is a proven peer key and its session — the input a PersonaGroup ring's sibling source reads.
 *
 * THE PERSONAGROUP SECRET GATES THE BOXES (`persona-group-secret`). Every member holds a secret its root sealed to
 * it at enrolment, one per op-key epoch. A `hello` carries a HINT — an HMAC under the sender's newest secret over
 * its nonce and ephemeral key — and every sealed box mixes the shared secret into its key. So a hello from the
 * herm, or from anyone who holds the group's id and no secret, matches nothing and draws no box; and a box a
 * non-member somehow drew opens for no one but the member it was sealed to.
 *
 * A STALE SIBLING CATCHES UP INSIDE THE SEAL. A responder that finds the hint under an OLDER secret than its own
 * newest answers with a `catch-up`: the persona-KEL suffix past that secret's op-key — the rotations, each with its
 * re-enrolments — sealed under the older secret both hold. The stale side extends its KEL by a quorum-verified
 * suffix of its own chain, opens the seal the rotation addressed to it and proves again under the new secret. A
 * leaf the rotation left out finds no seal addressed to it: it stands revoked, and nothing else crosses. A
 * responder whose secrets hold no match answers with its own hello, so a sibling ahead of it runs the catch-up.
 *
 * WHAT THE RELAY SEES. `hello` (a nonce, an ephemeral X25519 key, a hint), `answer` (the same, plus a sealed box),
 * `catch-up` and `finish` (a sealed box each). The edge, the device signature and the KEL suffix ride ONLY inside
 * boxes sealed to the other leaf's ephemeral key under the shared secret, so the relay carries the leaf↔root edge
 * without reading it, even when it is active. Session frames carry ciphertext alone.
 *
 * AFTER THE PROOF, a relay holds no session key: a frame it injects fails the AEAD, and a frame it replays or
 * reorders fails the chain. The session REFUSES on the first such frame, stays refused, and says why
 * (`refusal`) — the divergence surfaces and is never dropped in silence.
 *
 * NO CLOCK, NO COUNTER. Freshness is each leaf's own nonce; licensing is KEL event order and the edge's lease
 * epoch; frame order is a hash chain, never a sequence number.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/leaf-peer-proof
 */

import { x25519 } from "@noble/curves/ed25519.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { base64UrlDecode, base64UrlEncode, canonicalJsonBytes, hex, hexToBytes, webGetRandomValues } from "./crypto.js";
import { LEAF_CATCH_UP_SEAL_INFO, LEAF_PEER_HINT_INFO, LEAF_PEER_PROOF_DOMAIN, LEAF_PEER_SEAL_INFO, LEAF_SESSION_INFO } from "./domains.js";
import { ed25519VerifyHex } from "./auth-wire.js";
import { sealToRecipient, openFromSender, SEALED_BOX_AEAD_NONCE_LEN } from "./sealed-box.js";
import { verifyEdgeAgainstPersonaKel, verifyPersonaKelFull, type PersonaKelEvent } from "./persona-kel.js";
import type { GroupSecret } from "./persona-group-secret.js";
import type { DeviceDelegationTiddler } from "./device-delegation.js";

const KEY_RE = /^[0-9a-f]{64}$/;
const SIG_RE = /^[0-9a-f]{128}$/;
const SEAL_INFO = new TextEncoder().encode(LEAF_PEER_SEAL_INFO);
const CATCH_UP_INFO = new TextEncoder().encode(LEAF_CATCH_UP_SEAL_INFO);
const SESSION_INFO = new TextEncoder().encode(LEAF_SESSION_INFO);

/** A sealed box on the wire — hex, opaque to every hand but the recipient's. */
export interface LeafPeerSealedHex {
  readonly e: string;   // the sender's fresh ephemeral X25519 key
  readonly n: string;   // the AEAD nonce
  readonly c: string;   // the ciphertext
}

/** The frames of one exchange. */
export type LeafPeerFrame =
  | { readonly step: "hello";    readonly nonce: string; readonly eph: string; readonly hint: string }
  | { readonly step: "answer";   readonly nonce: string; readonly eph: string; readonly box: LeafPeerSealedHex }
  | { readonly step: "catch-up"; readonly box: LeafPeerSealedHex }
  | { readonly step: "finish";   readonly box: LeafPeerSealedHex };

/** What a leaf brings to the exchange: its device key and signer, its newest edge, its KEL and its secrets. */
export interface LeafPeerSelf {
  /** This leaf's device (vessel) verifying key, 64 hex. */
  readonly deviceKey: string;
  /** The DEVICE key's signer. A root's signer never belongs here. */
  readonly sign: (bytes: Uint8Array) => Promise<string> | string;
  /** This leaf's newest edge from its PersonaGroup's root — handed at enrolment, or re-delegated by a rotation. */
  readonly edge: DeviceDelegationTiddler;
  /** This PersonaGroup's persona-KEL as this leaf carries it — the license both edges must chain to. */
  readonly kel: readonly PersonaKelEvent[];
  /** The PersonaGroup secrets this leaf holds, oldest first (`leafStandingUnder`). The newest opens its hellos. */
  readonly secrets: readonly GroupSecret[];
  /** The lease epoch the verifier holds for the PersonaGroup — an edge bound below it reads as lapsed. */
  readonly expectedEpoch?: number;
}

/** Both nonces and both ephemeral keys of one exchange, as one side saw them — what every signature covers. */
export interface LeafPeerTranscript {
  readonly initiatorNonce: string;
  readonly initiatorEph:   string;
  readonly responderNonce: string;
  readonly responderEph:   string;
}

export type LeafPeerRole = "initiator" | "responder";

export type LeafPeerVerdict =
  | { readonly ok: true;  readonly peerKey: string; readonly session: LeafPeerSession }
  | { readonly ok: false; readonly reason: string };

/** One side's private state across the exchange. Never leaves the leaf. */
export interface LeafPeerState {
  readonly nonce:      string;
  readonly ephSecret:  Uint8Array;
  readonly ephPub:     string;
  /** The PersonaGroup secret this exchange runs under. */
  readonly secret:     GroupSecret;
  /** The transcript, once both halves of it have crossed. */
  readonly transcript?: LeafPeerTranscript;
}

/**
 * The bytes a leaf's DEVICE key signs to prove itself to a sibling: the whole transcript, the prover's role in
 * it and the prover's own device key, under `LEAF_PEER_PROOF_DOMAIN`. The role keeps the initiator's signature
 * from answering as the responder's on a reflected exchange.
 */
export function leafPeerProofBytes(parts: { transcript: LeafPeerTranscript; role: LeafPeerRole; proverKey: string }): Uint8Array {
  const t = parts.transcript;
  return canonicalJsonBytes({
    domain:         LEAF_PEER_PROOF_DOMAIN,
    role:           parts.role,
    initiatorNonce: t.initiatorNonce.toLowerCase(),
    initiatorEph:   t.initiatorEph.toLowerCase(),
    responderNonce: t.responderNonce.toLowerCase(),
    responderEph:   t.responderEph.toLowerCase(),
    proverKey:      parts.proverKey.toLowerCase(),
  });
}

/** A hello's hint: an HMAC under one PersonaGroup secret over the hello's nonce and ephemeral key. */
export function leafPeerHint(secret: Uint8Array, nonce: string, eph: string): string {
  return hex(hmac(sha256, secret, canonicalJsonBytes({ domain: LEAF_PEER_HINT_INFO, nonce: nonce.toLowerCase(), eph: eph.toLowerCase() })));
}

/** The constant-time-enough compare a hint reads under: both sides hex of one width. */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function freshEphemeral(): { ephSecret: Uint8Array; ephPub: string; nonce: string } {
  const ephSecret = x25519.utils.randomSecretKey();
  return { ephSecret, ephPub: hex(x25519.getPublicKey(ephSecret)), nonce: hex(webGetRandomValues(new Uint8Array(32))) };
}

/** The salt a proof box binds: both nonces and the PersonaGroup secret, so only a member derives its key. */
function proofSalt(t: LeafPeerTranscript, secret: GroupSecret): Uint8Array[] {
  return [hexToBytes(t.initiatorNonce), hexToBytes(t.responderNonce), secret.secret];
}

function hexBox(box: { senderEphemeralPub: Uint8Array; aeadNonce: Uint8Array; ciphertext: Uint8Array }): LeafPeerSealedHex {
  return { e: hex(box.senderEphemeralPub), n: hex(box.aeadNonce), c: hex(box.ciphertext) };
}

function isSealedHex(v: unknown): v is LeafPeerSealedHex {
  const b = v as Partial<LeafPeerSealedHex> | null;
  return typeof b === "object" && b !== null && typeof b.e === "string" && typeof b.n === "string" && typeof b.c === "string"
    && KEY_RE.test(b.e) && /^[0-9a-f]+$/.test(b.n) && /^[0-9a-f]+$/.test(b.c);
}

function openHexBox(box: LeafPeerSealedHex, ephSecret: Uint8Array, info: Uint8Array, salt: Uint8Array[]): Uint8Array | null {
  if (!isSealedHex(box)) return null;
  return openFromSender({
    recipientSecret: ephSecret, senderEphemeralPub: hexToBytes(box.e), aeadNonce: hexToBytes(box.n),
    ciphertext: hexToBytes(box.c), info, extraSalt: salt,
  });
}

async function sealProof(self: LeafPeerSelf, state: LeafPeerState, t: LeafPeerTranscript, role: LeafPeerRole, sealTo: string): Promise<LeafPeerSealedHex> {
  const sig = await self.sign(leafPeerProofBytes({ transcript: t, role, proverKey: self.deviceKey }));
  return hexBox(sealToRecipient({
    recipientPub: hexToBytes(sealTo),
    plaintext:    new TextEncoder().encode(JSON.stringify({ edge: self.edge, sig })),
    info:         SEAL_INFO,
    extraSalt:    proofSalt(t, state.secret),
  }));
}

type Judged = { readonly ok: true; readonly peerKey: string; readonly edge: DeviceDelegationTiddler } | { readonly ok: false; readonly reason: string };

/** Judge an edge against this leaf's KEL head and the lease epoch it holds. */
async function licenses(self: Pick<LeafPeerSelf, "kel" | "expectedEpoch">, edge: DeviceDelegationTiddler): Promise<{ ok: boolean; reason?: string }> {
  return verifyEdgeAgainstPersonaKel(edge, self.kel, self.expectedEpoch !== undefined ? { expectedEpoch: self.expectedEpoch } : undefined);
}

/**
 * Open a sibling's sealed proof and judge it: the box opens under this leaf's ephemeral secret and the shared
 * PersonaGroup secret, the edge chains to THIS leaf's KEL head at the lease epoch it holds, and the edge's device
 * key signed THIS leaf's transcript in the peer's role. `from` — the key the carrying channel PROVED for the
 * sender, when it proved one — must name the same device.
 */
async function openProof(
  self: LeafPeerSelf, state: LeafPeerState, peerRole: LeafPeerRole, box: LeafPeerSealedHex, from: string | undefined,
): Promise<Judged> {
  const t = state.transcript;
  if (!t) return { ok: false, reason: "the exchange holds no transcript" };
  const plaintext = openHexBox(box, state.ephSecret, SEAL_INFO, proofSalt(t, state.secret));
  if (!plaintext) return { ok: false, reason: "the sealed proof does not open for this leaf" };
  let body: { edge?: DeviceDelegationTiddler; sig?: unknown };
  try { body = JSON.parse(new TextDecoder().decode(plaintext)) as typeof body; } catch { return { ok: false, reason: "the sealed proof is torn" }; }
  const edge = body.edge;
  const peerKey = typeof edge?.deviceVerifyingKey === "string" ? edge.deviceVerifyingKey.toLowerCase() : "";
  if (!edge || !KEY_RE.test(peerKey)) return { ok: false, reason: "the proof carries no device edge" };
  if (typeof body.sig !== "string" || !SIG_RE.test(body.sig)) return { ok: false, reason: "the proof carries no device signature" };
  if (from !== undefined && from.toLowerCase() !== peerKey) return { ok: false, reason: "the channel proved a different key than the edge names" };
  const licensed = await licenses(self, edge);
  if (!licensed.ok) return { ok: false, reason: `the edge is not licensed by this PersonaGroup's KEL head: ${licensed.reason ?? "refused"}` };
  const signed = await ed25519VerifyHex(body.sig, leafPeerProofBytes({ transcript: t, role: peerRole, proverKey: peerKey }), peerKey);
  if (!signed) return { ok: false, reason: "the device key did not sign this exchange" };
  return { ok: true, peerKey, edge };
}

/** INITIATOR, step 1: open an exchange under this leaf's newest secret. Throws for a leaf that holds none. */
export function startLeafPeerProof(self: Pick<LeafPeerSelf, "secrets">): { frame: LeafPeerFrame & { step: "hello" }; state: LeafPeerState } {
  const secret = self.secrets[self.secrets.length - 1];
  if (!secret) throw new Error("leaf-peer-proof: a leaf that holds no PersonaGroup secret opens no exchange");
  const { ephSecret, ephPub, nonce } = freshEphemeral();
  return { frame: { step: "hello", nonce, eph: ephPub, hint: leafPeerHint(secret.secret, nonce, ephPub) }, state: { nonce, ephSecret, ephPub, secret } };
}

/** What a responder does with a hello. */
export type LeafPeerAnswer =
  /** The hint names this leaf's newest secret: answer with its sealed proof. */
  | { readonly kind: "answer"; readonly frame: LeafPeerFrame & { step: "answer" }; readonly state: LeafPeerState }
  /** The hint names an OLDER secret: hand the sibling the KEL suffix it lacks, sealed under that secret. */
  | { readonly kind: "catch-up"; readonly frame: LeafPeerFrame & { step: "catch-up" } }
  /** The hint names no secret this leaf holds: the sibling stands ahead of it, or holds no secret at all. */
  | { readonly kind: "unmatched" }
  | { readonly kind: "malformed"; readonly reason: string };

/** The KEL events past the last one seating `opKeyDid` — what a sibling holding that op-key's secret lacks. */
function suffixPast(kel: readonly PersonaKelEvent[], opKeyDid: string): PersonaKelEvent[] {
  const did = opKeyDid.toLowerCase();
  for (let i = kel.length - 1; i >= 0; i--) if (kel[i]!.opKeyDid.toLowerCase() === did) return kel.slice(i + 1);
  return [];
}

/** RESPONDER, step 2: answer a hello by the secret its hint names. */
export async function answerLeafPeerProof(self: LeafPeerSelf, hello: LeafPeerFrame): Promise<LeafPeerAnswer> {
  if (hello.step !== "hello" || !KEY_RE.test(hello.nonce) || !KEY_RE.test(hello.eph) || typeof hello.hint !== "string" || !KEY_RE.test(hello.hint)) {
    return { kind: "malformed", reason: "expected a hello" };
  }
  let at = -1;
  for (let i = self.secrets.length - 1; i >= 0; i--) {
    if (sameHex(leafPeerHint(self.secrets[i]!.secret, hello.nonce, hello.eph), hello.hint.toLowerCase())) { at = i; break; }
  }
  if (at < 0) return { kind: "unmatched" };
  const secret = self.secrets[at]!;
  if (at < self.secrets.length - 1) {
    const box = sealToRecipient({
      recipientPub: hexToBytes(hello.eph),
      plaintext:    new TextEncoder().encode(JSON.stringify({ suffix: suffixPast(self.kel, secret.opKeyDid) })),
      info:         CATCH_UP_INFO,
      extraSalt:    [hexToBytes(hello.nonce), secret.secret],
    });
    return { kind: "catch-up", frame: { step: "catch-up", box: hexBox(box) } };
  }
  const { ephSecret, ephPub, nonce } = freshEphemeral();
  const transcript: LeafPeerTranscript = { initiatorNonce: hello.nonce, initiatorEph: hello.eph, responderNonce: nonce, responderEph: ephPub };
  const state: LeafPeerState = { nonce, ephSecret, ephPub, secret, transcript };
  const box = await sealProof(self, state, transcript, "responder", hello.eph);
  return { kind: "answer", frame: { step: "answer", nonce, eph: ephPub, box }, state };
}

/**
 * INITIATOR, on a catch-up: open the suffix under the secret this exchange ran on, and extend this leaf's KEL by
 * it. The suffix must link onto this leaf's own head, and the whole chain must verify with every rotation's quorum
 * — a suffix that forks, breaks or carries an unattested rotation refuses. Events this leaf already holds fall away.
 */
export async function openLeafCatchUp(
  self: LeafPeerSelf, state: LeafPeerState, frame: LeafPeerFrame,
): Promise<{ readonly ok: true; readonly kel: readonly PersonaKelEvent[] } | { readonly ok: false; readonly reason: string }> {
  if (frame.step !== "catch-up") return { ok: false, reason: "expected a catch-up" };
  const plaintext = openHexBox(frame.box, state.ephSecret, CATCH_UP_INFO, [hexToBytes(state.nonce), state.secret.secret]);
  if (!plaintext) return { ok: false, reason: "the catch-up does not open for this leaf" };
  let suffix: unknown;
  try { suffix = (JSON.parse(new TextDecoder().decode(plaintext)) as { suffix?: unknown }).suffix; } catch { return { ok: false, reason: "the catch-up is torn" }; }
  if (!Array.isArray(suffix)) return { ok: false, reason: "the catch-up carries no KEL suffix" };
  const held = new Set(self.kel.map((e) => e.eventCid));
  const fresh = (suffix as PersonaKelEvent[]).filter((e) => typeof e?.eventCid === "string" && !held.has(e.eventCid));
  if (fresh.length === 0) return { ok: false, reason: "the catch-up carries nothing this leaf lacks" };
  const head = self.kel[self.kel.length - 1];
  if (!head || fresh[0]!.prevEventCid !== head.eventCid) return { ok: false, reason: "the catch-up does not extend this leaf's own KEL head" };
  const kel = [...self.kel, ...fresh];
  const verified = await verifyPersonaKelFull(kel);
  if (!verified.ok) return { ok: false, reason: `the catch-up's KEL does not verify: ${verified.reason ?? "refused"}` };
  return { ok: true, kel };
}

/** INITIATOR, step 3: judge the answer, and on a pass seal this leaf's own proof back and stand the session. */
export async function finishLeafPeerProof(
  self: LeafPeerSelf, state: LeafPeerState, answer: LeafPeerFrame, from?: string,
): Promise<{ verdict: LeafPeerVerdict; frame?: LeafPeerFrame & { step: "finish" } }> {
  if (answer.step !== "answer" || !KEY_RE.test(answer.nonce) || !KEY_RE.test(answer.eph)) {
    return { verdict: { ok: false, reason: "expected an answer" } };
  }
  const transcript: LeafPeerTranscript = { initiatorNonce: state.nonce, initiatorEph: state.ephPub, responderNonce: answer.nonce, responderEph: answer.eph };
  const full: LeafPeerState = { ...state, transcript };
  const judged = await openProof(self, full, "responder", answer.box, from);
  if (!judged.ok) return { verdict: judged };
  const session = LeafPeerSession.derive({ role: "initiator", state: full, selfKey: self.deviceKey, peerKey: judged.peerKey, peerEdge: judged.edge });
  return {
    verdict: { ok: true, peerKey: judged.peerKey, session },
    frame: { step: "finish", box: await sealProof(self, full, transcript, "initiator", answer.eph) },
  };
}

/** RESPONDER, step 4: judge the initiator's proof, and on a pass stand the session. */
export async function acceptLeafPeerProof(
  self: LeafPeerSelf, state: LeafPeerState, finish: LeafPeerFrame, from?: string,
): Promise<LeafPeerVerdict> {
  if (finish.step !== "finish") return { ok: false, reason: "expected a finish" };
  const judged = await openProof(self, state, "initiator", finish.box, from);
  if (!judged.ok) return judged;
  const session = LeafPeerSession.derive({ role: "responder", state, selfKey: self.deviceKey, peerKey: judged.peerKey, peerEdge: judged.edge });
  return { ok: true, peerKey: judged.peerKey, session };
}

// ── THE SESSION THE PROOF ADMITS ──────────────────────────────────────────────────────────────────────────────

/** One sealed session frame on the wire: the AEAD nonce and the ciphertext, base64url. Nothing else crosses. */
export interface LeafSessionFrame {
  readonly n: string;
  readonly c: string;
}

export function isLeafSessionFrame(v: unknown): v is LeafSessionFrame {
  return typeof v === "object" && v !== null
    && typeof (v as { n?: unknown }).n === "string" && typeof (v as { c?: unknown }).c === "string";
}

function chainNext(chain: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  const buf = new Uint8Array(chain.length + nonce.length + ciphertext.length);
  buf.set(chain, 0); buf.set(nonce, chain.length); buf.set(ciphertext, chain.length + nonce.length);
  return sha256(buf);
}

/**
 * The channel a passing proof admits. Both sides derive it alone, from the X25519 agreement of the two ephemeral
 * keys the device signatures covered, salted with the hash of the transcript and both proven device keys:
 * HKDF yields one key and one chain seed per direction. A frame seals under the sender's key with its AEAD's
 * associated data set to the sender's chain; the chain then advances to the hash of itself, the nonce and the
 * ciphertext. So the receiver accepts exactly the next frame the sender sealed: an injected frame fails the key,
 * a replayed or reordered one fails the chain.
 *
 * A REFUSAL IS STICKY AND SPOKEN. The first frame that fails to open refuses the session for good and records
 * why (`refusal`); every later frame refuses with the same reason. A session never skips a bad frame and reads
 * on, because a skip would let the relay choose what this leaf hears.
 */
export class LeafPeerSession {
  readonly role:     LeafPeerRole;
  readonly peerKey:  string;
  readonly #peerEdge: DeviceDelegationTiddler;
  #sendKey:   Uint8Array;
  #recvKey:   Uint8Array;
  #sendChain: Uint8Array;
  #recvChain: Uint8Array;
  #refusal:   string | null = null;

  private constructor(args: {
    role: LeafPeerRole; peerKey: string; peerEdge: DeviceDelegationTiddler;
    sendKey: Uint8Array; recvKey: Uint8Array; sendChain: Uint8Array; recvChain: Uint8Array;
  }) {
    this.role = args.role; this.peerKey = args.peerKey; this.#peerEdge = args.peerEdge;
    this.#sendKey = args.sendKey; this.#recvKey = args.recvKey;
    this.#sendChain = args.sendChain; this.#recvChain = args.recvChain;
  }

  /** Derive one side's session from the exchange it just passed. */
  static derive(args: {
    role: LeafPeerRole; state: LeafPeerState; selfKey: string; peerKey: string; peerEdge: DeviceDelegationTiddler;
  }): LeafPeerSession {
    const t = args.state.transcript;
    if (!t) throw new Error("leaf-peer-session: no transcript to bind");
    const peerEph = args.role === "initiator" ? t.responderEph : t.initiatorEph;
    const shared = x25519.getSharedSecret(args.state.ephSecret, hexToBytes(peerEph));
    const initiatorKey = (args.role === "initiator" ? args.selfKey : args.peerKey).toLowerCase();
    const responderKey = (args.role === "initiator" ? args.peerKey : args.selfKey).toLowerCase();
    const salt = sha256(canonicalJsonBytes({
      domain: LEAF_SESSION_INFO,
      initiatorNonce: t.initiatorNonce.toLowerCase(), initiatorEph: t.initiatorEph.toLowerCase(),
      responderNonce: t.responderNonce.toLowerCase(), responderEph: t.responderEph.toLowerCase(),
      initiatorKey, responderKey,
    }));
    const okm = hkdf(sha256, shared, salt, SESSION_INFO, 128);
    const i2r = { key: okm.slice(0, 32), chain: okm.slice(64, 96) };
    const r2i = { key: okm.slice(32, 64), chain: okm.slice(96, 128) };
    const send = args.role === "initiator" ? i2r : r2i;
    const recv = args.role === "initiator" ? r2i : i2r;
    return new LeafPeerSession({
      role: args.role, peerKey: args.peerKey.toLowerCase(), peerEdge: args.peerEdge,
      sendKey: send.key, recvKey: recv.key, sendChain: send.chain, recvChain: recv.chain,
    });
  }

  /** The edge the peer proved with on this session. */
  get peerEdge(): DeviceDelegationTiddler { return this.#peerEdge; }

  /** Why this session refused, or null while it stands. */
  get refusal(): string | null { return this.#refusal; }

  /** Refuse the session from outside (a moved KEL head, a closed channel). The first reason stays. */
  refuse(reason: string): void { if (this.#refusal === null) this.#refusal = reason; }

  /** Seal one frame toward the peer. Throws on a refused session — nothing seals into a channel that refused. */
  seal(plaintext: Uint8Array): LeafSessionFrame {
    if (this.#refusal !== null) throw new Error(`leaf-peer-session: refused — ${this.#refusal}`);
    const nonce = webGetRandomValues(new Uint8Array(SEALED_BOX_AEAD_NONCE_LEN));
    const ciphertext = xchacha20poly1305(this.#sendKey, nonce, this.#sendChain).encrypt(plaintext);
    this.#sendChain = chainNext(this.#sendChain, nonce, ciphertext);
    return { n: base64UrlEncode(nonce), c: base64UrlEncode(ciphertext) };
  }

  /** Open the next frame from the peer, or refuse — and on a refusal, refuse every frame after it. */
  open(frame: LeafSessionFrame): { readonly ok: true; readonly plaintext: Uint8Array } | { readonly ok: false; readonly reason: string } {
    if (this.#refusal !== null) return { ok: false, reason: this.#refusal };
    const nonce = base64UrlDecode(frame.n);
    const ciphertext = base64UrlDecode(frame.c);
    let plaintext: Uint8Array | null = null;
    if (nonce.length === SEALED_BOX_AEAD_NONCE_LEN) {
      try { plaintext = xchacha20poly1305(this.#recvKey, nonce, this.#recvChain).decrypt(ciphertext); } catch { plaintext = null; }
    }
    if (!plaintext) {
      this.#refusal = "a frame failed the session's key or chain — injected, replayed or reordered after the proof";
      return { ok: false, reason: this.#refusal };
    }
    this.#recvChain = chainNext(this.#recvChain, nonce, ciphertext);
    return { ok: true, plaintext };
  }

  /**
   * Re-judge the session against a KEL this leaf now carries: does the edge the peer proved with still license
   * under its head and the lease epoch held? An edge the moved head rolled past licenses no longer. The peer's
   * renewed edge, if the head's rotation re-enrolled it, rides sealed to the peer alone, so only a fresh proof can
   * show it: the caller closes the session and the pair proves again. The verdict refuses nothing by itself.
   */
  async relicense(kel: readonly PersonaKelEvent[], expectedEpoch?: number): Promise<{ readonly ok: boolean; readonly reason?: string }> {
    if (this.#refusal !== null) return { ok: false, reason: this.#refusal };
    const opts = expectedEpoch !== undefined ? { expectedEpoch } : undefined;
    const licensed = await verifyEdgeAgainstPersonaKel(this.#peerEdge, kel, opts);
    return licensed.ok ? { ok: true } : { ok: false, reason: licensed.reason ?? "the edge no longer licenses" };
  }
}

// ── THE EXCHANGE OVER A DUPLEX ─────────────────────────────────────────────────────────────────────────────

/** The duplex a transport hands the exchange: frames out, frames in, and the key the channel proved for the
 *  sender when it proved one (an authenticated relay's stamped `from`). */
export interface LeafPeerDuplex {
  send(frame: LeafPeerFrame): void | Promise<void>;
  recv(): Promise<{ frame: LeafPeerFrame; from?: string }>;
}

/** Run the INITIATOR side of one exchange over a duplex: the sibling's proven key and session, or the refusal.
 *  A catch-up refuses here — a leaf that extends its KEL proves again on a fresh exchange. */
export async function proveLeafPeerAsInitiator(self: LeafPeerSelf, duplex: LeafPeerDuplex): Promise<LeafPeerVerdict> {
  const { frame, state } = startLeafPeerProof(self);
  await duplex.send(frame);
  const { frame: answer, from } = await duplex.recv();
  if (answer.step === "catch-up") return { ok: false, reason: "the sibling answered with a catch-up — extend the KEL and prove again" };
  const { verdict, frame: finish } = await finishLeafPeerProof(self, state, answer, from);
  if (finish) await duplex.send(finish);
  return verdict;
}

/** Run the RESPONDER side of one exchange over a duplex: the sibling's proven key and session, or the refusal. */
export async function proveLeafPeerAsResponder(self: LeafPeerSelf, duplex: LeafPeerDuplex): Promise<LeafPeerVerdict> {
  const { frame: hello } = await duplex.recv();
  const answered = await answerLeafPeerProof(self, hello);
  if (answered.kind === "malformed") return { ok: false, reason: answered.reason };
  if (answered.kind === "unmatched") return { ok: false, reason: "the hello names no PersonaGroup secret this leaf holds" };
  await duplex.send(answered.frame);
  if (answered.kind === "catch-up") return { ok: false, reason: "the sibling stands behind this leaf — it was handed the KEL suffix" };
  const { frame: finish, from } = await duplex.recv();
  return acceptLeafPeerProof(self, answered.state, finish, from);
}
