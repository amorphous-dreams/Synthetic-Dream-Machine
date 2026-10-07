/**
 * leaf-peer-proof — two LEAVES of one PersonaGroup prove their device keys to each other over a relay that
 * reads nothing.
 *
 * WHAT IT PROVES. Each leaf answers "the key across from me is a device my own PersonaGroup delegated, and
 * that device holds its key on THIS exchange". Two existing parts compose:
 *   · the peer's DeviceDelegation edge, licensed CLOCKLESSLY against the verifier's own persona-KEL head
 *     (`verifyEdgeAgainstPersonaKel` — an edge a rotated-away op-key signed reads as rolled past and refuses);
 *   · an in-band nonce the peer signs with its DEVICE key (`leafPeerProofBytes`), bound to the ephemeral key
 *     its answer was sealed to, so a proof made for one exchange or one channel verifies on no other.
 * The output is a proven peer key — the input a PersonaGroup ring's `provenVesselKey` reads.
 *
 * WHAT THE RELAY SEES. Three frames cross: `hello` (a nonce and an ephemeral X25519 key), `answer` (the same,
 * plus a sealed box) and `finish` (a sealed box). The edge and the device signature ride ONLY inside a box
 * sealed to the other leaf's ephemeral key (`sealToRecipient`, info `LEAF_PEER_SEAL_INFO`, salted with both
 * nonces), so the relay carries the leaf↔root edge without reading it. No root signs anything here and no
 * root-signed byte travels in the clear.
 *
 * WHAT AN ACTIVE RELAY GAINS. A relay that swaps its own ephemeral key into the exchange can open the box
 * sealed to it, and so reads the answering leaf's edge — and then holds nothing it can use: the device
 * signature names the ephemeral key the answer was sealed to, so re-sealing the box toward the real
 * initiator fails verification there and the exchange refuses.
 *
 * NO CLOCK. Freshness is each leaf's own nonce; licensing is KEL event order and the edge's lease epoch.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/leaf-peer-proof
 */

import { x25519 } from "@noble/curves/ed25519.js";
import { canonicalJsonBytes, hex, hexToBytes, webGetRandomValues } from "./crypto.js";
import { LEAF_PEER_PROOF_DOMAIN, LEAF_PEER_SEAL_INFO } from "./domains.js";
import { ed25519VerifyHex } from "./auth-wire.js";
import { sealToRecipient, openFromSender } from "./sealed-box.js";
import { verifyEdgeAgainstPersonaKel, type PersonaKelEvent } from "./persona-kel.js";
import type { DeviceDelegationTiddler } from "./device-delegation.js";

const KEY_RE = /^[0-9a-f]{64}$/;
const SIG_RE = /^[0-9a-f]{128}$/;
const SEAL_INFO = new TextEncoder().encode(LEAF_PEER_SEAL_INFO);

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

export type LeafPeerVerdict =
  | { readonly ok: true;  readonly peerKey: string }
  | { readonly ok: false; readonly reason: string };

/** One side's private state across the exchange. Never leaves the leaf. */
export interface LeafPeerState {
  readonly nonce:     string;
  readonly ephSecret: Uint8Array;
  readonly ephPub:    string;
  /** The initiator's and responder's nonces, in that order — the salt both seals carry. */
  readonly salt?:     readonly [string, string];
}

/**
 * The bytes a leaf's DEVICE key signs to prove itself to a sibling: the sibling's nonce, the ephemeral key the
 * proof is sealed to, and the prover's own device key, under `LEAF_PEER_PROOF_DOMAIN`.
 */
export function leafPeerProofBytes(parts: { nonce: string; sealedTo: string; proverKey: string }): Uint8Array {
  return canonicalJsonBytes({
    domain:    LEAF_PEER_PROOF_DOMAIN,
    nonce:     parts.nonce.toLowerCase(),
    sealedTo:  parts.sealedTo.toLowerCase(),
    proverKey: parts.proverKey.toLowerCase(),
  });
}

function freshEphemeral(): { ephSecret: Uint8Array; ephPub: string; nonce: string } {
  const ephSecret = x25519.utils.randomSecretKey();
  return { ephSecret, ephPub: hex(x25519.getPublicKey(ephSecret)), nonce: hex(webGetRandomValues(new Uint8Array(32))) };
}

function saltOf(salt: readonly [string, string]): Uint8Array[] {
  return [hexToBytes(salt[0]), hexToBytes(salt[1])];
}

async function sealProof(self: LeafPeerSelf, peerNonce: string, peerEph: string, salt: readonly [string, string]): Promise<LeafPeerSealedHex> {
  const sig = await self.sign(leafPeerProofBytes({ nonce: peerNonce, sealedTo: peerEph, proverKey: self.deviceKey }));
  const box = sealToRecipient({
    recipientPub: hexToBytes(peerEph),
    plaintext:    new TextEncoder().encode(JSON.stringify({ edge: self.edge, sig })),
    info:         SEAL_INFO,
    extraSalt:    saltOf(salt),
  });
  return { e: hex(box.senderEphemeralPub), n: hex(box.aeadNonce), c: hex(box.ciphertext) };
}

/**
 * Open a sibling's sealed proof and judge it: the box opens under this leaf's ephemeral secret, the edge chains
 * to THIS leaf's KEL head, and the edge's device key signed this leaf's nonce and ephemeral key. `from` — the
 * key the carrying channel PROVED for the sender, when it proved one — must name the same device.
 */
async function openProof(
  self: LeafPeerSelf, state: LeafPeerState, box: LeafPeerSealedHex, from: string | undefined,
): Promise<LeafPeerVerdict> {
  if (!state.salt) return { ok: false, reason: "the exchange holds no nonce pair" };
  let plaintext: Uint8Array | null = null;
  try {
    plaintext = openFromSender({
      recipientSecret: state.ephSecret, senderEphemeralPub: hexToBytes(box.e), aeadNonce: hexToBytes(box.n),
      ciphertext: hexToBytes(box.c), info: SEAL_INFO, extraSalt: saltOf(state.salt),
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
  const signed = await ed25519VerifyHex(body.sig, leafPeerProofBytes({ nonce: state.nonce, sealedTo: state.ephPub, proverKey: peerKey }), peerKey);
  if (!signed) return { ok: false, reason: "the device key did not sign this exchange" };
  return { ok: true, peerKey };
}

/** INITIATOR, step 1: open an exchange. */
export function startLeafPeerProof(): { frame: LeafPeerFrame & { step: "hello" }; state: LeafPeerState } {
  const { ephSecret, ephPub, nonce } = freshEphemeral();
  return { frame: { step: "hello", nonce, eph: ephPub }, state: { nonce, ephSecret, ephPub } };
}

/** RESPONDER, step 2: answer a hello with this leaf's sealed proof and its own challenge. */
export async function answerLeafPeerProof(
  self: LeafPeerSelf, hello: LeafPeerFrame,
): Promise<{ frame: LeafPeerFrame & { step: "answer" }; state: LeafPeerState } | { error: string }> {
  if (hello.step !== "hello" || !KEY_RE.test(hello.nonce) || !KEY_RE.test(hello.eph)) return { error: "expected a hello" };
  const { ephSecret, ephPub, nonce } = freshEphemeral();
  const salt: readonly [string, string] = [hello.nonce, nonce];
  const box = await sealProof(self, hello.nonce, hello.eph, salt);
  return { frame: { step: "answer", nonce, eph: ephPub, box }, state: { nonce, ephSecret, ephPub, salt } };
}

/** INITIATOR, step 3: judge the answer, and on a pass seal this leaf's own proof back. */
export async function finishLeafPeerProof(
  self: LeafPeerSelf, state: LeafPeerState, answer: LeafPeerFrame, from?: string,
): Promise<{ verdict: LeafPeerVerdict; frame?: LeafPeerFrame & { step: "finish" } }> {
  if (answer.step !== "answer" || !KEY_RE.test(answer.nonce) || !KEY_RE.test(answer.eph)) {
    return { verdict: { ok: false, reason: "expected an answer" } };
  }
  const salt: readonly [string, string] = [state.nonce, answer.nonce];
  const verdict = await openProof(self, { ...state, salt }, answer.box, from);
  if (!verdict.ok) return { verdict };
  return { verdict, frame: { step: "finish", box: await sealProof(self, answer.nonce, answer.eph, salt) } };
}

/** RESPONDER, step 4: judge the initiator's proof. */
export async function acceptLeafPeerProof(
  self: LeafPeerSelf, state: LeafPeerState, finish: LeafPeerFrame, from?: string,
): Promise<LeafPeerVerdict> {
  if (finish.step !== "finish") return { ok: false, reason: "expected a finish" };
  return openProof(self, state, finish.box, from);
}

/** The duplex a transport hands the exchange: frames out, frames in, and the key the channel proved for the
 *  sender when it proved one (an authenticated relay's stamped `from`). */
export interface LeafPeerDuplex {
  send(frame: LeafPeerFrame): void | Promise<void>;
  recv(): Promise<{ frame: LeafPeerFrame; from?: string }>;
}

/** Run the INITIATOR side over a duplex. Resolves the sibling's proven key, or the refusal. */
export async function proveLeafPeerAsInitiator(self: LeafPeerSelf, duplex: LeafPeerDuplex): Promise<LeafPeerVerdict> {
  const { frame, state } = startLeafPeerProof();
  await duplex.send(frame);
  const { frame: answer, from } = await duplex.recv();
  const { verdict, frame: finish } = await finishLeafPeerProof(self, state, answer, from);
  if (finish) await duplex.send(finish);
  return verdict;
}

/** Run the RESPONDER side over a duplex. Resolves the sibling's proven key, or the refusal. */
export async function proveLeafPeerAsResponder(self: LeafPeerSelf, duplex: LeafPeerDuplex): Promise<LeafPeerVerdict> {
  const { frame: hello } = await duplex.recv();
  const answered = await answerLeafPeerProof(self, hello);
  if ("error" in answered) return { ok: false, reason: answered.error };
  await duplex.send(answered.frame);
  const { frame: finish, from } = await duplex.recv();
  return acceptLeafPeerProof(self, answered.state, finish, from);
}
