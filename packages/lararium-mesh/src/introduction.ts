/**
 * introduction — a guest introduces, an operator admits.
 *
 * ''A user introduces; an operator admits.'' A hosted guest puts a friend forward to the hearth's operator as
 * a SIGNED act, so the operator sees who asks. Only the operator's answer admits: a friend of a guest stands
 * nowhere until then. ''The answer consumes the introduction'': no introduction's signature outlives the
 * operator's answer, so no record chains who introduced whom.
 *
 * The invariants:
 *   · THE GUEST SIGNS. An introduction names the hearth's Nexus, the hosting epoch the guest read, a key for
 *     the newcomer, and the guest's own proven key, all under that key's signature. It stands only in that
 *     Nexus, at an epoch the hearth still holds live, and as signed. The signature reads under the STRICT
 *     Ed25519 equation: a small-order key, which a cofactored verify lets sign for anyone, signs for nobody.
 *   · THE NEWCOMER IS A SECRET'S HOLDER, NEVER A NAME. The friend holds 32 secret bytes; the introduction
 *     carries the X25519 key they derive. The introduction names nobody but the guest.
 *   · THE ANSWER RIDES SEALED TO THE NEWCOMER AND REPEATS NOTHING. The operator's answer holds the admit, the
 *     Nexus, the epoch and, on an admit, a fresh host-purpose token: no key, no nonce and no signature of the
 *     introduction. It leaves this module sealed to the newcomer's key under a fresh sender key, padded to one
 *     length. So an answer shares no byte with its introduction; a holder of both records finds nothing in
 *     them to match one to the other; an admit and a decline weigh the same; and the friend's secret opens
 *     it. (The seal hides its recipient from a reader. It makes no promise that a box an adversary BUILT
 *     opens under one key alone; nothing here leans on that.)
 *   · EVERY VALUE GETS READ ONCE. A handed-in introduction is copied field by field into a frozen record
 *     before anything is checked, and the bytes signed and the key verified under both read that copy. A
 *     value that answers differently at each read gains nothing.
 *   · ONLY A VERIFIED COPY GETS ANSWERED. `verifyIntroduction` hands back the frozen copy it verified, and
 *     `answerIntroduction` answers that very object and nothing else: not the value that was handed in, and
 *     not a look-alike. So an answer always seals to the newcomer key the guest signed.
 *   · ONLY THE ENCODER'S OWN BYTES OPEN. An opened answer must re-encode to exactly the plaintext that was
 *     sealed, so no extra key, repeated key or stray byte rides inside a box.
 *   · THE DIAL READS A COUNT. How many introductions one guest may hold open is a number on the hosting act;
 *     no field anywhere holds a clock reading.
 *   · THIS MODULE KEEPS NOTHING. It holds no store and no key. Consuming an introduction means the caller
 *     drops it once it holds the sealed answer.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */
import { x25519 } from "@noble/curves/ed25519.js";
import { canonicalJson, canonicalJsonBytes, hex, hexToBytes, sha256BytesSync, utf8Bytes } from "./crypto.js";
import { HOSTING_INTRODUCTION_DOMAIN } from "./domains.js";
import { isInviteToken, type InviteToken } from "./hosting.js";
import { sealToRecipient, openFromSender, SEALED_BOX_AEAD_NONCE_LEN } from "./sealed-box.js";
import { verifyEd25519 } from "./ed25519-door.js";

/** A fault the caller made: malformed fields handed to a signer, a secret of the wrong length, an answer asked
 *  of something that is no introduction. Its message leads with the fault's name and carries no secret. */
export class IntroductionError extends Error {}

const HEX_64 = /^[0-9a-f]{64}$/;
const HEX_128 = /^[0-9a-f]{128}$/;
const HEX_EVEN = /^(?:[0-9a-f]{2})+$/;

/** The plaintext width every answer pads to before it seals, so an admit and a decline weigh the same. */
const ANSWER_PLAINTEXT_BYTES = 512;
/** The sealed box's key separation: the introduction's own name, under the part that seals an answer. */
const ANSWER_SEAL_INFO = canonicalJsonBytes({ kind: HOSTING_INTRODUCTION_DOMAIN, part: "answer" });

/** The frozen copies `verifyIntroduction` handed back, by identity. Held weakly: a copy the caller drops leaves
 *  no trace here, so this keeps no record of any introduction. */
const VERIFIED = new WeakSet<Introduction>();
const normAid = (aid: string): string => aid.trim().toLowerCase();

/** What the guest signs. Every field holds a string; none holds a clock reading. */
export interface Introduction {
  readonly kind:          string;   // HOSTING_INTRODUCTION_DOMAIN
  readonly nexus:         string;   // the Nexus AID the hearth hosts in
  readonly epoch:         string;   // the CID of the hosting act the guest read
  readonly newcomerKey:   string;   // `newcomerKeyOf` a secret the FRIEND holds; the answer seals to it
  readonly introducer:    string;   // the guest's proven per-Nexus key at this hearth
  readonly signature:     string;   // Ed25519 by `introducer` over `introductionBytes`
}
export type IntroductionFields = Omit<Introduction, "kind" | "signature">;

const FIELD_KEYS = ["nexus", "epoch", "newcomerKey", "introducer"] as const;
const INTRODUCTION_KEYS = ["kind", ...FIELD_KEYS, "signature"] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
const exactKeys = (x: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(x).length === keys.length && keys.every((k) => Object.hasOwn(x, k));
const hex64 = (v: unknown): v is string => typeof v === "string" && HEX_64.test(v);
const aid = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** Do four already-read values hold the shapes an introduction's fields take? */
function shapesHold(nexus: unknown, epoch: unknown, newcomerKey: unknown, introducer: unknown): boolean {
  return aid(nexus) && hex64(epoch) && hex64(newcomerKey) && hex64(introducer);
}

/** Copy an introduction's fields out of a handed-in value, each read ONCE, or null when the shape fails. */
function fieldsOf(v: unknown): IntroductionFields | null {
  try {
    if (!isRecord(v) || !exactKeys(v, FIELD_KEYS)) return null;
    const nexus = v["nexus"], epoch = v["epoch"], newcomerKey = v["newcomerKey"], introducer = v["introducer"];
    if (!shapesHold(nexus, epoch, newcomerKey, introducer)) return null;
    return Object.freeze({ nexus: normAid(nexus as string), epoch: epoch as string, newcomerKey: newcomerKey as string, introducer: introducer as string });
  } catch { return null; }
}

/** Copy a whole introduction out of a handed-in value, each field read ONCE, or null when the shape fails. */
function introductionOf(v: unknown): Introduction | null {
  try {
    if (!isRecord(v) || !exactKeys(v, INTRODUCTION_KEYS)) return null;
    const kind = v["kind"], signature = v["signature"];
    const nexus = v["nexus"], epoch = v["epoch"], newcomerKey = v["newcomerKey"], introducer = v["introducer"];
    if (kind !== HOSTING_INTRODUCTION_DOMAIN || !shapesHold(nexus, epoch, newcomerKey, introducer)) return null;
    if (typeof signature !== "string" || !HEX_128.test(signature)) return null;
    return Object.freeze({
      kind: HOSTING_INTRODUCTION_DOMAIN, nexus: normAid(nexus as string), epoch: epoch as string,
      newcomerKey: newcomerKey as string, introducer: introducer as string, signature,
    });
  } catch { return null; }
}

/** Run a structural read; a value that throws while being read (a proxy, a getter) reads as malformed. */
function guarded(read: () => boolean): boolean {
  try { return read(); } catch { return false; }
}

/** The X25519 secret a newcomer's 32 bytes derive, under the introduction's own name. The caller zeroes it. */
function newcomerSecretKey(secret: Uint8Array): Uint8Array {
  if (!(secret instanceof Uint8Array) || secret.length !== 32) throw new IntroductionError("newcomer-secret-malformed");
  return sha256BytesSync(utf8Bytes(canonicalJson({ kind: HOSTING_INTRODUCTION_DOMAIN, part: "newcomer", secret: hex(secret) })));
}

/** The key a newcomer's 32-byte secret derives: what an introduction carries and an answer seals to. One-way. */
export function newcomerKeyOf(secret: Uint8Array): string {
  const key = newcomerSecretKey(secret);
  try { return hex(x25519.getPublicKey(key)); }
  finally { key.fill(0); }
}

/** The bytes a guest signs: the four fields under the introduction's own name and part. */
export function introductionBytes(fields: IntroductionFields): Uint8Array {
  return canonicalJsonBytes({
    kind: HOSTING_INTRODUCTION_DOMAIN, part: "introduction", nexus: normAid(fields.nexus),
    epoch: fields.epoch, newcomerKey: fields.newcomerKey, introducer: fields.introducer,
  });
}

/** Structural guard: exactly the six keys, each of its lawful shape. `verifyIntroduction` reads the signature. */
export function isIntroduction(v: unknown): v is Introduction {
  return introductionOf(v) !== null;
}

/** Sign an introduction. Malformed fields refuse before the signer gets asked for anything, and the act
 *  returned names exactly the fields the signer saw. */
export async function signIntroduction(
  fields: IntroductionFields,
  sign:   (bytes: Uint8Array) => Promise<string>,
): Promise<Introduction> {
  const read = fieldsOf(fields);
  if (read === null) throw new IntroductionError("introduction-malformed");
  const signature = await sign(introductionBytes(read));
  if (typeof signature !== "string" || !HEX_128.test(signature)) throw new IntroductionError("introduction-signature-malformed");
  return Object.freeze({ kind: HOSTING_INTRODUCTION_DOMAIN, ...read, signature });
}

export type IntroductionRefusal =
  | "introduction-malformed" | "introduction-nexus-foreign" | "introduction-epoch-dead" | "introduction-unsigned";
/** A lawful verdict hands back the frozen copy it verified: the caller shows and answers THAT, never the value it
 *  was handed. */
export type IntroductionVerdict =
  | { readonly ok: true; readonly introduction: Introduction }
  | { readonly ok: false; readonly refusal: IntroductionRefusal };

/**
 * Does this introduction stand at this hearth? `live` names the hearth's Nexus and the hosting epochs it holds
 * live (the current and the previous). The first fault in this order names the refusal: a malformed shape,
 * another Nexus, an epoch outside the live set, a signature that fails under the named introducer. The
 * signature reads STRICT (RFC 8032, no cofactor): a small-order key or a non-canonical encoding refuses.
 * Never throws.
 */
export function verifyIntroduction(
  intro: unknown,
  live:  { readonly nexus: string; readonly epochs: readonly string[] },
): IntroductionVerdict {
  try {
    const read = introductionOf(intro);
    if (read === null) return { ok: false, refusal: "introduction-malformed" };
    const nexus = live.nexus, epochs = live.epochs;
    if (typeof nexus !== "string" || !Array.isArray(epochs)) return { ok: false, refusal: "introduction-malformed" };
    if (read.nexus !== normAid(nexus)) return { ok: false, refusal: "introduction-nexus-foreign" };
    if (!epochs.includes(read.epoch)) return { ok: false, refusal: "introduction-epoch-dead" };
    let signed = false;
    try {
      signed = verifyEd25519(read.signature, introductionBytes(read), read.introducer);
    } catch { signed = false; }
    if (!signed) return { ok: false, refusal: "introduction-unsigned" };
    VERIFIED.add(read);
    return { ok: true, introduction: read };
  } catch {
    return { ok: false, refusal: "introduction-malformed" };
  }
}

/** The operator's answer as the friend reads it. No field names, or derives from, anything in the introduction
 *  but the Nexus and the epoch every guest of the hearth shares. */
export interface Answer {
  readonly admitted: boolean;
  readonly nexus:    string;
  readonly epoch:    string;
  readonly token?:   InviteToken;   // on an admit alone, when the caller supplied a mint
}

/** An answer sealed to its newcomer: a fresh sender key, a fresh nonce, and ciphertext of one fixed width.
 *  Hex throughout. It names nobody and indexes by nothing. */
export interface SealedAnswer {
  readonly sender:     string;
  readonly nonce:      string;
  readonly ciphertext: string;
}

const ANSWER_KEYS = ["admitted", "nexus", "epoch"] as const;
const SEALED_KEYS = ["sender", "nonce", "ciphertext"] as const;

/** Structural guard: the three keys, and a token on an admit alone. One more key refuses the whole answer. */
export function isAnswer(v: unknown): v is Answer {
  return guarded(() => {
    if (!isRecord(v)) return false;
    const tokened = Object.hasOwn(v, "token");
    if (!exactKeys(v, tokened ? [...ANSWER_KEYS, "token"] : ANSWER_KEYS)) return false;
    if (typeof v["admitted"] !== "boolean" || !aid(v["nexus"]) || !hex64(v["epoch"])) return false;
    return !tokened || (v["admitted"] === true && isInviteToken(v["token"]));
  });
}

/** Structural guard for a sealed answer: exactly three hex strings of their lawful widths. */
export function isSealedAnswer(v: unknown): v is SealedAnswer {
  return guarded(() => isRecord(v) && exactKeys(v, SEALED_KEYS) && hex64(v["sender"]) &&
    typeof v["nonce"] === "string" && v["nonce"].length === SEALED_BOX_AEAD_NONCE_LEN * 2 && HEX_EVEN.test(v["nonce"]) &&
    typeof v["ciphertext"] === "string" && HEX_EVEN.test(v["ciphertext"]));
}

/** The one plaintext an answer seals as: its canonical JSON, then spaces out to the fixed width. */
function answerPlaintext(answer: Answer): Uint8Array {
  const body = utf8Bytes(canonicalJson(answer));
  if (body.length > ANSWER_PLAINTEXT_BYTES) throw new IntroductionError("answer-too-wide");
  const plaintext = new Uint8Array(ANSWER_PLAINTEXT_BYTES).fill(0x20);
  plaintext.set(body, 0);
  return plaintext;
}

/** Copy a token's three values out of a handed-in value, each read ONCE, or null when the copy is no token. */
function tokenOf(v: unknown): InviteToken | null {
  try {
    if (!isRecord(v)) return null;
    const copy = { purpose: v["purpose"], n: v["n"], y: v["y"] };
    return isInviteToken(copy) ? Object.freeze({ purpose: copy.purpose, n: copy.n, y: copy.y }) : null;
  } catch { return null; }
}

/** Rebuild an answer from a parsed value, key by key, or null: nothing beyond the lawful keys survives. */
function answerOf(v: unknown): Answer | null {
  if (!isAnswer(v)) return null;
  const admitted = v.admitted, nexus = normAid(v.nexus), epoch = v.epoch, token = v.token;
  return token === undefined ? { admitted, nexus, epoch } : { admitted, nexus, epoch, token: { purpose: token.purpose, n: token.n, y: token.y } };
}

/**
 * Consume a VERIFIED introduction into the operator's answer, sealed to the newcomer. `intro` must be the very
 * copy `verifyIntroduction` handed back; anything else refuses `introduction-unverified`. The caller drops it
 * after. On an admit, `mint` (the hearth passes its own host-token mint) runs once; on a decline
 * it never runs. The answer takes the Nexus and the epoch from the introduction and nothing else, one by one,
 * so a field an introduction gains later never reaches an answer. The seal draws a fresh sender key and nonce:
 * two seals of one answer share no byte.
 */
export function answerIntroduction(intro: Introduction, admit: boolean, mint?: () => InviteToken): SealedAnswer {
  let read: Introduction;
  try {
    if (!isRecord(intro)) throw new IntroductionError("introduction-malformed");
    if (!VERIFIED.has(intro)) throw new IntroductionError(introductionOf(intro) === null ? "introduction-malformed" : "introduction-unverified");
    read = intro;                                  // the frozen copy this module verified: plain data, no getter
  } catch (error) {
    throw error instanceof IntroductionError ? error : new IntroductionError("introduction-malformed");
  }
  const admitted = admit === true;
  const nexus = read.nexus, epoch = read.epoch;
  let answer: Answer = { admitted, nexus, epoch };
  if (admitted && mint !== undefined) {
    const token = tokenOf(mint());
    if (token === null) throw new IntroductionError("answer-token-malformed");
    answer = { admitted, nexus, epoch, token };
  }
  const plaintext = answerPlaintext(answer);
  let box;
  try { box = sealToRecipient({ recipientPub: hexToBytes(read.newcomerKey), plaintext, info: ANSWER_SEAL_INFO }); }
  catch { throw new IntroductionError("newcomer-key-malformed"); }
  return { sender: hex(box.senderEphemeralPub), nonce: hex(box.aeadNonce), ciphertext: hex(box.ciphertext) };
}

/**
 * Open a sealed answer as the friend who holds `secret`. Null on ANY failure: another secret, a tampered or
 * malformed box, a body that reads as no answer or that the answer's own encoder would not have written. The
 * caller learns nothing about which check refused.
 */
export function openAnswer(sealed: SealedAnswer, secret: Uint8Array): Answer | null {
  if (!isSealedAnswer(sealed)) return null;
  let key: Uint8Array;
  try { key = newcomerSecretKey(secret); } catch { return null; }
  try {
    const plaintext = openFromSender({
      recipientSecret: key, senderEphemeralPub: hexToBytes(sealed.sender), aeadNonce: hexToBytes(sealed.nonce),
      ciphertext: hexToBytes(sealed.ciphertext), info: ANSWER_SEAL_INFO,
    });
    if (plaintext === null || plaintext.length !== ANSWER_PLAINTEXT_BYTES) return null;
    const answer = answerOf(JSON.parse(new TextDecoder().decode(plaintext)));
    if (answer === null) return null;
    // Only the encoder's own bytes open: the answer read must re-encode to exactly what was sealed.
    const again = answerPlaintext(answer);
    let differs = 0;
    for (let i = 0; i < ANSWER_PLAINTEXT_BYTES; i++) differs |= again[i]! ^ plaintext[i]!;
    return differs === 0 ? answer : null;
  } catch {
    return null;
  } finally {
    key.fill(0);
  }
}

/**
 * How many MORE introductions this guest may hold open: the dial, less the held introductions that name its key,
 * never below zero. `dial` reads a COUNT off the hosting act; anything but a whole number of zero or more reads
 * as a closed dial.
 */
export function openSlots(held: readonly Introduction[], introducer: string, dial: number): number {
  if (!Number.isSafeInteger(dial) || dial < 0) return 0;
  const who = introducer.toLowerCase();
  // An entry counts by the introducer it names, well-formed or not: a damaged entry never frees a slot.
  const open = held.filter((intro) => guarded(() => isRecord(intro) && typeof intro["introducer"] === "string" && intro["introducer"].toLowerCase() === who)).length;
  return Math.max(0, dial - open);
}
