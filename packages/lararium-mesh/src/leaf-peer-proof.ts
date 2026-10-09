/**
 * leaf-peer-proof — two LEAVES of one PersonaGroup prove their device keys to each other over a relay that
 * reads nothing, and the proof binds the session it admits.
 *
 * WHAT IT PROVES. Each leaf answers "the key across from me is a device my own PersonaGroup delegated, that
 * device holds its key on THIS exchange, and every frame after this one comes from it". Three parts compose:
 *   · the peer's DeviceDelegation edge, licensed CLOCKLESSLY against the verifier's own persona-KEL head
 *     (`verifyEdgeAgainstPersonaKel` — an edge a rotated-away op-key signed reads as rolled past and refuses);
 *   · a signature by the peer's DEVICE key over the whole TRANSCRIPT (`leafPeerProofBytes`): both nonces, both
 *     ephemeral keys and the prover's role, so a proof made for one exchange verifies on no other and a relay
 *     that swaps any ephemeral key breaks it on the side that reads the swap;
 *   · a SESSION both sides derive from the two ephemeral keys and that same transcript (`LeafPeerSession`):
 *     every later frame rides sealed under a per-direction key, its AEAD bound to a hash CHAIN of the frames
 *     before it. This follows the Noise channel-binding idea with the house's own primitives (X25519, HKDF-SHA256,
 *     XChaCha20-Poly1305): the key that seals the traffic derives from the very ephemerals the device keys signed.
 * The output is a proven peer key and its session — the input a PersonaGroup ring's `provenVesselKey` reads.
 *
 * WHAT THE RELAY SEES. Three proof frames cross: `hello` (a nonce and an ephemeral X25519 key), `answer` (the
 * same, plus a sealed box) and `finish` (a sealed box). The edge and the device signature ride ONLY inside a box
 * sealed to the other leaf's ephemeral key (`sealToRecipient`, info `LEAF_PEER_SEAL_INFO`, salted with both
 * nonces), so the relay carries the leaf↔root edge without reading it. Session frames carry ciphertext alone. No
 * root signs anything here and no root-signed byte travels in the clear.
 *
 * WHAT AN ACTIVE RELAY GAINS. Nothing it can use. A relay that swaps its own ephemeral key into the exchange can
 * open the box sealed to it, and so reads one leaf's edge, yet the signature inside names the transcript that leaf
 * saw, which the other leaf's transcript does not match. After the proof, a relay holds no session key: a frame it
 * injects fails the AEAD, and a frame it replays or reorders fails the chain. The session REFUSES on the first such
 * frame, stays refused, and says why (`refusal`) — the divergence surfaces and is never dropped in silence.
 *
 * NO CLOCK, NO COUNTER. Freshness is each leaf's own nonce; licensing is KEL event order and the edge's lease
 * epoch; frame order is a hash chain, never a sequence number.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/leaf-peer-proof
 */

import { x25519 } from "@noble/curves/ed25519.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { base64UrlDecode, base64UrlEncode, canonicalJsonBytes, hex, hexToBytes, webGetRandomValues } from "./crypto.js";
import { LEAF_PEER_PROOF_DOMAIN, LEAF_PEER_SEAL_INFO, LEAF_SESSION_INFO } from "./domains.js";
import { ed25519VerifyHex } from "./auth-wire.js";
import { sealToRecipient, openFromSender, SEALED_BOX_AEAD_NONCE_LEN } from "./sealed-box.js";
import { verifyEdgeAgainstPersonaKel, type PersonaKelEvent } from "./persona-kel.js";
import type { DeviceDelegationTiddler } from "./device-delegation.js";

const KEY_RE = /^[0-9a-f]{64}$/;
const SIG_RE = /^[0-9a-f]{128}$/;
const SEAL_INFO = new TextEncoder().encode(LEAF_PEER_SEAL_INFO);
const SESSION_INFO = new TextEncoder().encode(LEAF_SESSION_INFO);

/** A sealed box on the wire — hex, opaque to every hand but the recipient's. */
export interface LeafPeerSealedHex {
  readonly e: string;   // the sender's fresh ephemeral X25519 key
  readonly n: string;   // the AEAD nonce
  readonly c: string;   // the ciphertext
}

/** The three frames of one exchange. */
export type LeafPeerFrame =
  | { readonly step: "hello";  readonly nonce: string; readonly eph: string }
  | { readonly step: "answer"; readonly nonce: string; readonly eph: string; readonly box: LeafPeerSealedHex }
  | { readonly step: "finish"; readonly box: LeafPeerSealedHex };

/** What a leaf brings to the exchange: its device key and signer, its own edge, and its PersonaGroup's KEL. */
export interface LeafPeerSelf {
  /** This leaf's device (vessel) verifying key, 64 hex. */
  readonly deviceKey: string;
  /** The DEVICE key's signer. A root's signer never belongs here. */
  readonly sign: (bytes: Uint8Array) => Promise<string> | string;
  /** This leaf's own DeviceDelegation edge from its PersonaGroup root. */
  readonly edge: DeviceDelegationTiddler;
  /** This PersonaGroup's persona-KEL as this leaf carries it — the license both edges must chain to. */
  readonly kel: readonly PersonaKelEvent[];
  /** The lease epoch the verifier holds for the edge's resource, when it holds one. */
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

function freshEphemeral(): { ephSecret: Uint8Array; ephPub: string; nonce: string } {
  const ephSecret = x25519.utils.randomSecretKey();
  return { ephSecret, ephPub: hex(x25519.getPublicKey(ephSecret)), nonce: hex(webGetRandomValues(new Uint8Array(32))) };
}

function nonceSalt(t: LeafPeerTranscript): Uint8Array[] {
  return [hexToBytes(t.initiatorNonce), hexToBytes(t.responderNonce)];
}

async function sealProof(self: LeafPeerSelf, t: LeafPeerTranscript, role: LeafPeerRole, sealTo: string): Promise<LeafPeerSealedHex> {
  const sig = await self.sign(leafPeerProofBytes({ transcript: t, role, proverKey: self.deviceKey }));
  const box = sealToRecipient({
    recipientPub: hexToBytes(sealTo),
    plaintext:    new TextEncoder().encode(JSON.stringify({ edge: self.edge, sig })),
    info:         SEAL_INFO,
    extraSalt:    nonceSalt(t),
  });
  return { e: hex(box.senderEphemeralPub), n: hex(box.aeadNonce), c: hex(box.ciphertext) };
}

type Judged = { readonly ok: true; readonly peerKey: string; readonly edge: DeviceDelegationTiddler } | { readonly ok: false; readonly reason: string };

/**
 * Open a sibling's sealed proof and judge it: the box opens under this leaf's ephemeral secret, the edge chains
 * to THIS leaf's KEL head, and the edge's device key signed THIS leaf's transcript in the peer's role. `from` —
 * the key the carrying channel PROVED for the sender, when it proved one — must name the same device.
 */
async function openProof(
  self: LeafPeerSelf, state: LeafPeerState, peerRole: LeafPeerRole, box: LeafPeerSealedHex, from: string | undefined,
): Promise<Judged> {
  const t = state.transcript;
  if (!t) return { ok: false, reason: "the exchange holds no transcript" };
  let plaintext: Uint8Array | null = null;
  try {
    plaintext = openFromSender({
      recipientSecret: state.ephSecret, senderEphemeralPub: hexToBytes(box.e), aeadNonce: hexToBytes(box.n),
      ciphertext: hexToBytes(box.c), info: SEAL_INFO, extraSalt: nonceSalt(t),
    });
  } catch { plaintext = null; }
  if (!plaintext) return { ok: false, reason: "the sealed proof does not open for this leaf" };
  let body: { edge?: DeviceDelegationTiddler; sig?: unknown };
  try { body = JSON.parse(new TextDecoder().decode(plaintext)) as typeof body; } catch { return { ok: false, reason: "the sealed proof is torn" }; }
  const edge = body.edge;
  const peerKey = typeof edge?.deviceVerifyingKey === "string" ? edge.deviceVerifyingKey.toLowerCase() : "";
  if (!edge || !KEY_RE.test(peerKey)) return { ok: false, reason: "the proof carries no device edge" };
  if (typeof body.sig !== "string" || !SIG_RE.test(body.sig)) return { ok: false, reason: "the proof carries no device signature" };
  if (from !== undefined && from.toLowerCase() !== peerKey) return { ok: false, reason: "the channel proved a different key than the edge names" };
  const licensed = await verifyEdgeAgainstPersonaKel(edge, self.kel,
    self.expectedEpoch !== undefined ? { expectedEpoch: self.expectedEpoch } : undefined);
  if (!licensed.ok) return { ok: false, reason: `the edge is not licensed by this PersonaGroup's KEL head: ${licensed.reason ?? "refused"}` };
  const signed = await ed25519VerifyHex(body.sig, leafPeerProofBytes({ transcript: t, role: peerRole, proverKey: peerKey }), peerKey);
  if (!signed) return { ok: false, reason: "the device key did not sign this exchange" };
  return { ok: true, peerKey, edge };
}

/** INITIATOR, step 1: open an exchange. */
export function startLeafPeerProof(): { frame: LeafPeerFrame & { step: "hello" }; state: LeafPeerState } {
  const { ephSecret, ephPub, nonce } = freshEphemeral();
  return { frame: { step: "hello", nonce, eph: ephPub }, state: { nonce, ephSecret, ephPub } };
}

/** RESPONDER, step 2: answer a hello with this leaf's sealed proof over the transcript and its own challenge. */
export async function answerLeafPeerProof(
  self: LeafPeerSelf, hello: LeafPeerFrame,
): Promise<{ frame: LeafPeerFrame & { step: "answer" }; state: LeafPeerState } | { error: string }> {
  if (hello.step !== "hello" || !KEY_RE.test(hello.nonce) || !KEY_RE.test(hello.eph)) return { error: "expected a hello" };
  const { ephSecret, ephPub, nonce } = freshEphemeral();
  const transcript: LeafPeerTranscript = { initiatorNonce: hello.nonce, initiatorEph: hello.eph, responderNonce: nonce, responderEph: ephPub };
  const box = await sealProof(self, transcript, "responder", hello.eph);
  return { frame: { step: "answer", nonce, eph: ephPub, box }, state: { nonce, ephSecret, ephPub, transcript } };
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
    frame: { step: "finish", box: await sealProof(self, transcript, "initiator", answer.eph) },
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
  /** The edge the peer proved with — kept so a moved KEL head can re-judge the session (`relicense`). */
  readonly peerEdge: DeviceDelegationTiddler;
  #sendKey:   Uint8Array;
  #recvKey:   Uint8Array;
  #sendChain: Uint8Array;
  #recvChain: Uint8Array;
  #refusal:   string | null = null;

  private constructor(args: {
    role: LeafPeerRole; peerKey: string; peerEdge: DeviceDelegationTiddler;
    sendKey: Uint8Array; recvKey: Uint8Array; sendChain: Uint8Array; recvChain: Uint8Array;
  }) {
    this.role = args.role; this.peerKey = args.peerKey; this.peerEdge = args.peerEdge;
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
   * Re-judge the session's edge against a KEL this leaf now carries. An edge the moved head rolled past refuses
   * the session, with the reason; a licensed edge leaves it standing.
   */
  async relicense(kel: readonly PersonaKelEvent[], expectedEpoch?: number): Promise<boolean> {
    if (this.#refusal !== null) return false;
    const licensed = await verifyEdgeAgainstPersonaKel(this.peerEdge, kel, expectedEpoch !== undefined ? { expectedEpoch } : undefined);
    if (licensed.ok) return true;
    this.refuse(`the edge is not licensed by this PersonaGroup's KEL head: ${licensed.reason ?? "refused"}`);
    return false;
  }
}

// ── THE EXCHANGE OVER A DUPLEX ─────────────────────────────────────────────────────────────────────────────

/** The duplex a transport hands the exchange: frames out, frames in, and the key the channel proved for the
 *  sender when it proved one (an authenticated relay's stamped `from`). */
export interface LeafPeerDuplex {
  send(frame: LeafPeerFrame): void | Promise<void>;
  recv(): Promise<{ frame: LeafPeerFrame; from?: string }>;
}

/** Run the INITIATOR side over a duplex. Resolves the sibling's proven key and session, or the refusal. */
export async function proveLeafPeerAsInitiator(self: LeafPeerSelf, duplex: LeafPeerDuplex): Promise<LeafPeerVerdict> {
  const { frame, state } = startLeafPeerProof();
  await duplex.send(frame);
  const { frame: answer, from } = await duplex.recv();
  const { verdict, frame: finish } = await finishLeafPeerProof(self, state, answer, from);
  if (finish) await duplex.send(finish);
  return verdict;
}

/** Run the RESPONDER side over a duplex. Resolves the sibling's proven key and session, or the refusal. */
export async function proveLeafPeerAsResponder(self: LeafPeerSelf, duplex: LeafPeerDuplex): Promise<LeafPeerVerdict> {
  const { frame: hello } = await duplex.recv();
  const answered = await answerLeafPeerProof(self, hello);
  if ("error" in answered) return { ok: false, reason: answered.error };
  await duplex.send(answered.frame);
  const { frame: finish, from } = await duplex.recv();
  return acceptLeafPeerProof(self, answered.state, finish, from);
}
