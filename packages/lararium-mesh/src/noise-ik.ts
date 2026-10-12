/**
 * noise-ik — the Noise IK handshake, `Noise_IK_25519_ChaChaPoly_SHA256`.
 *
 *     <- s
 *     ...
 *     -> e, es, s, ss
 *     <- e, ee, se
 *
 * The initiator knows the responder's static key in advance and sends its own static key encrypted inside
 * message one. The responder emits nothing before a valid first message.
 *
 * What each message proves, and to whom:
 *   · MESSAGE ONE proves to the responder that its writer knew the responder's static key and held the secret of
 *     the static key it carries. It proves NOTHING about now: the same bytes replay. So the initiator's static
 *     and the first payload stand PROVISIONAL, and no transport exists on either side.
 *   · MESSAGE TWO proves to the initiator that the responder holds its static secret and read message one. The
 *     initiator's first transport message then proves to the responder that a live initiator finished: only a
 *     holder of this exchange's ephemeral secret derives the transport keys.
 *
 * The invariants:
 *   · ONE ERROR, AND SILENCE ABOUT THE STEP. Every failure (a short message, a bad tag, a malformed key, a
 *     low-order point, a second use) throws `NoiseHandshakeError` with one fixed message and no cause.
 *   · A TRANSPORT EXISTS ONLY AFTER MESSAGE TWO. It rides in the return of `readMessage2` and `writeMessage2`
 *     and nowhere else; a pending side exposes no key, no chaining key and no cipher.
 *   · A PENDING SIDE SERVES ONE EXCHANGE. Its second use refuses, and a failure spends it.
 *   · SECRETS DROP AT THE SPLIT. The ephemeral secret, the chaining key, the handshake key and every DH output
 *     get zeroed once the transport keys stand, or once the exchange fails.
 *   · THE CALLER OWNS THE KEYS AND THE PROLOGUE. This module knows no Nexus, no face, no gate, no key's
 *     derivation and no socket. Both sides must hold one prologue, or the first tag fails.
 *
 * Pure: no I/O, no clock, no timer, no log. The protocol name is the handshake's own domain separation.
 *
 * Specification: The Noise Protocol Framework, revision 34 (https://noiseprotocol.org/noise.html), sections 5,
 * 7.5 and 12.
 */
import { x25519 } from "@noble/curves/ed25519.js";
import { chacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { webGetRandomValues } from "./crypto.js";

export const NOISE_IK_PROTOCOL = "Noise_IK_25519_ChaChaPoly_SHA256";

const DHLEN = 32;
const TAGLEN = 16;
/** Message one over an empty payload: the ephemeral key, the sealed static key, the payload's tag. */
export const MIN_MESSAGE1_BYTES = DHLEN + (DHLEN + TAGLEN) + TAGLEN;
/** Message two over an empty payload: the ephemeral key and the payload's tag. */
export const MIN_MESSAGE2_BYTES = DHLEN + TAGLEN;

/** The one failure of a handshake or a transport read. Its message never varies and it carries no cause. */
export class NoiseHandshakeError extends Error {
  constructor() {
    super("noise-handshake-failed");
    this.name = "NoiseHandshakeError";
  }
}

/** An X25519 key pair, 32 bytes each. */
export interface NoiseKeyPair { readonly secretKey: Uint8Array; readonly publicKey: Uint8Array }

/** The source of one ephemeral secret: 32 bytes, used as the X25519 secret as they come. Asked once per side. */
export type NoiseEphemeralSource = () => Uint8Array;

/** One direction of the transport. Its nonce counts from zero and only moves forward; a failed open moves nothing. */
export interface NoiseCipher {
  seal(plaintext: Uint8Array, ad?: Uint8Array): Uint8Array;
  open(ciphertext: Uint8Array, ad?: Uint8Array): Uint8Array;
}

/** The two directions a finished handshake yields, and a copy of the hash that names this exchange. */
export interface NoiseTransport {
  readonly send:          NoiseCipher;
  readonly receive:       NoiseCipher;
  readonly handshakeHash: Uint8Array;
}

/** The initiator after message one. It holds NO transport and offers none until message two reads. */
export interface NoiseInitiatorPending {
  readonly message1: Uint8Array;
  readMessage2(message2: Uint8Array): { readonly payload: Uint8Array; readonly transport: NoiseTransport };
}

/** The responder after reading message one: the initiator's static key and payload stand PROVISIONAL, and no
 *  transport exists until it writes message two. */
export interface NoiseResponderPending {
  readonly initiatorStatic: Uint8Array;
  readonly payload:         Uint8Array;
  writeMessage2(payload?: Uint8Array): { readonly message2: Uint8Array; readonly transport: NoiseTransport };
}

const EMPTY = new Uint8Array(0);
/** 2^64 − 1 stays reserved: a cipher that reaches it refuses. */
const NONCE_LIMIT = 0xffffffffffffffffn;

const fail = (): never => { throw new NoiseHandshakeError(); };
const need = (ok: boolean): void => { if (!ok) fail(); };
const bytesOf = (v: unknown, length?: number): v is Uint8Array =>
  v instanceof Uint8Array && (length === undefined || v.length === length);

function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** A DH output, refused when it reads all zero: a low-order public key would hand every party the same secret. */
function dh(secretKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  need(bytesOf(secretKey, DHLEN) && bytesOf(publicKey, DHLEN));
  const out = x25519.getSharedSecret(secretKey, publicKey);
  let acc = 0;
  for (const b of out) acc |= b;
  need(acc !== 0);
  return out;
}

/** Noise's HKDF over HMAC-SHA256, two outputs. */
function hkdf2(chainingKey: Uint8Array, input: Uint8Array): [Uint8Array, Uint8Array] {
  const temp = hmac(sha256, chainingKey, input);
  const one = hmac(sha256, temp, Uint8Array.of(1));
  const two = hmac(sha256, temp, concat(one, Uint8Array.of(2)));
  temp.fill(0);
  return [one, two];
}

/** The ChaChaPoly nonce: 32 zero bits, then the counter as 64 bits little-endian. */
function nonceOf(n: bigint): Uint8Array {
  const nonce = new Uint8Array(12);
  for (let i = 0; i < 8; i++) nonce[4 + i] = Number((n >> BigInt(8 * i)) & 0xffn);
  return nonce;
}

/** The handshake's SymmetricState: the chaining key, the hash, and the handshake cipher key with its nonce. */
class SymmetricState {
  #ck: Uint8Array;
  #h: Uint8Array;
  #k: Uint8Array | null = null;
  #n = 0n;

  constructor() {
    const name = new TextEncoder().encode(NOISE_IK_PROTOCOL);
    this.#h = name.length <= 32 ? concat(name, new Uint8Array(32 - name.length)) : sha256(name);
    this.#ck = new Uint8Array(this.#h);
  }
  mixHash(data: Uint8Array): void { this.#h = sha256(concat(this.#h, data)); }
  mixKey(input: Uint8Array): void {
    const [ck, k] = hkdf2(this.#ck, input);
    this.#ck.fill(0); this.#k?.fill(0);
    this.#ck = ck; this.#k = k; this.#n = 0n;
  }
  /** MixKey over a DH output, which drops as soon as it is mixed. */
  mixDh(secretKey: Uint8Array, publicKey: Uint8Array): void {
    const shared = dh(secretKey, publicKey);
    try { this.mixKey(shared); } finally { shared.fill(0); }
  }
  /** Every field this pattern encrypts follows a DH, so the handshake key always stands here. */
  encryptAndHash(plaintext: Uint8Array): Uint8Array {
    const k = this.#k;
    if (k === null) return fail();
    const out = chacha20poly1305(k, nonceOf(this.#n), this.#h).encrypt(plaintext);
    this.#n++;
    this.mixHash(out);
    return out;
  }
  decryptAndHash(ciphertext: Uint8Array): Uint8Array {
    const k = this.#k;
    if (k === null) return fail();
    const out = chacha20poly1305(k, nonceOf(this.#n), this.#h).decrypt(ciphertext);
    this.#n++;
    this.mixHash(ciphertext);
    return out;
  }
  /** Split into the two transport keys and the handshake hash, then drop everything this state held. */
  split(): { readonly first: Uint8Array; readonly second: Uint8Array; readonly hash: Uint8Array } {
    const [first, second] = hkdf2(this.#ck, EMPTY);
    const hash = new Uint8Array(this.#h);
    this.drop();
    return { first, second, hash };
  }
  drop(): void {
    this.#ck.fill(0); this.#k?.fill(0); this.#h.fill(0);
    this.#k = null;
  }
}

function cipherOf(key: Uint8Array): NoiseCipher {
  let n = 0n;
  const run = (seal: boolean, input: Uint8Array, ad: Uint8Array): Uint8Array => {
    try {
      need(bytesOf(input) && bytesOf(ad) && n < NONCE_LIMIT);
      const aead = chacha20poly1305(key, nonceOf(n), ad);
      const out = seal ? aead.encrypt(input) : aead.decrypt(input);
      n++;                                   // only a seal or an open that held moves the counter
      return out;
    } catch { return fail(); }
  };
  return Object.freeze({
    seal: (plaintext: Uint8Array, ad: Uint8Array = EMPTY) => run(true, plaintext, ad),
    open: (ciphertext: Uint8Array, ad: Uint8Array = EMPTY) => run(false, ciphertext, ad),
  });
}

const transportOf = (sendKey: Uint8Array, receiveKey: Uint8Array, hash: Uint8Array): NoiseTransport =>
  Object.freeze({ send: cipherOf(sendKey), receive: cipherOf(receiveKey), handshakeHash: hash });

const platformEphemeral: NoiseEphemeralSource = () => webGetRandomValues(new Uint8Array(DHLEN));

/** The key pair an X25519 secret holds. The secret returned is a copy the caller owns. */
export function noiseKeyPair(secretKey: Uint8Array): NoiseKeyPair {
  try {
    need(bytesOf(secretKey, DHLEN));
    return { secretKey: new Uint8Array(secretKey), publicKey: x25519.getPublicKey(secretKey) };
  } catch { return fail(); }
}

/**
 * Write message one as the initiator: `s` its own static pair, `rs` the responder's static key it pinned.
 * The pending side it returns reads message two once and only then yields a transport.
 */
export function noiseInitiate(parts: {
  readonly prologue: Uint8Array; readonly s: NoiseKeyPair; readonly rs: Uint8Array; readonly payload?: Uint8Array;
  readonly ephemeral?: NoiseEphemeralSource;
}): NoiseInitiatorPending {
  const sym = new SymmetricState();
  let e: Uint8Array = EMPTY;
  const spend = (): void => { e.fill(0); sym.drop(); };
  try {
    const { prologue, s, rs } = parts, payload = parts.payload ?? EMPTY;
    need(bytesOf(prologue) && bytesOf(payload) && bytesOf(rs, DHLEN) && bytesOf(s.secretKey, DHLEN) && bytesOf(s.publicKey, DHLEN));
    const sSecret = new Uint8Array(s.secretKey);
    sym.mixHash(prologue);
    sym.mixHash(rs);                                             // <- s
    const drawn = (parts.ephemeral ?? platformEphemeral)();
    need(bytesOf(drawn, DHLEN));
    e = new Uint8Array(drawn);
    const ePublic = x25519.getPublicKey(e);
    sym.mixHash(ePublic);                                        // -> e
    sym.mixDh(e, rs);                                            //    es
    const sealedStatic = sym.encryptAndHash(s.publicKey);        //    s
    sym.mixDh(sSecret, rs);                                      //    ss
    const message1 = concat(ePublic, sealedStatic, sym.encryptAndHash(payload));

    let spent = false;
    const readMessage2 = (message2: Uint8Array) => {
      try {
        need(!spent);
        spent = true;
        need(bytesOf(message2) && message2.length >= MIN_MESSAGE2_BYTES);
        const re = message2.slice(0, DHLEN);
        sym.mixHash(re);                                         // <- e
        sym.mixDh(e, re);                                        //    ee
        sym.mixDh(sSecret, re);                                  //    se
        const read = sym.decryptAndHash(message2.slice(DHLEN));
        const { first, second, hash } = sym.split();
        e.fill(0); sSecret.fill(0);
        return { payload: read, transport: transportOf(first, second, hash) };
      } catch { spent = true; spend(); sSecret.fill(0); return fail(); }
    };
    return Object.freeze({ message1, readMessage2 });
  } catch { spend(); return fail(); }
}

/**
 * Read message one as the responder holding static pair `s`. What it returns stands provisional: the bytes may
 * be a replay. It writes message two once, and only that yields a transport.
 */
export function noiseRespond(parts: {
  readonly prologue: Uint8Array; readonly s: NoiseKeyPair; readonly message1: Uint8Array;
  readonly ephemeral?: NoiseEphemeralSource;
}): NoiseResponderPending {
  const sym = new SymmetricState();
  let e: Uint8Array = EMPTY;
  const spend = (): void => { e.fill(0); sym.drop(); };
  try {
    const { prologue, s, message1 } = parts;
    need(bytesOf(prologue) && bytesOf(message1) && message1.length >= MIN_MESSAGE1_BYTES &&
      bytesOf(s.secretKey, DHLEN) && bytesOf(s.publicKey, DHLEN));
    const sSecret = new Uint8Array(s.secretKey);
    sym.mixHash(prologue);
    sym.mixHash(s.publicKey);                                    // <- s
    const re = message1.slice(0, DHLEN);
    sym.mixHash(re);                                             // -> e
    sym.mixDh(sSecret, re);                                      //    es
    const rs = sym.decryptAndHash(message1.slice(DHLEN, DHLEN + DHLEN + TAGLEN));   // s
    need(rs.length === DHLEN);
    sym.mixDh(sSecret, rs);                                      //    ss
    sSecret.fill(0);
    const payload = sym.decryptAndHash(message1.slice(DHLEN + DHLEN + TAGLEN));
    const drawn = (parts.ephemeral ?? platformEphemeral)();
    need(bytesOf(drawn, DHLEN));
    e = new Uint8Array(drawn);

    let spent = false;
    const writeMessage2 = (answer: Uint8Array = EMPTY) => {
      try {
        need(!spent);
        spent = true;
        need(bytesOf(answer));
        const ePublic = x25519.getPublicKey(e);
        sym.mixHash(ePublic);                                    // <- e
        sym.mixDh(e, re);                                        //    ee
        sym.mixDh(e, rs);                                        //    se
        const message2 = concat(ePublic, sym.encryptAndHash(answer));
        const { first, second, hash } = sym.split();
        e.fill(0);
        return { message2, transport: transportOf(second, first, hash) };
      } catch { spent = true; spend(); return fail(); }
    };
    return Object.freeze({ initiatorStatic: new Uint8Array(rs), payload: new Uint8Array(payload), writeMessage2 });
  } catch { spend(); return fail(); }
}
