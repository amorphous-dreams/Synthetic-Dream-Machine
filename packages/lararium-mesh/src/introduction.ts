/**
 * introduction — a guest introduces, an operator admits.
 *
 * ''A user introduces; an operator admits.'' A hosted guest puts a friend forward to the hearth's operator as
 * a SIGNED act, so the operator sees who asks. Only the operator's answer admits: a friend of a guest stands
 * nowhere until then. ''The answer consumes the introduction'': no introduction's signature outlives the
 * operator's answer, so no record chains who introduced whom.
 *
 * The invariants:
 *   · THE GUEST SIGNS. An introduction names the hearth's Nexus, the hosting epoch the guest read, a nonce
 *     for the newcomer, and the guest's own proven key, all under that key's signature. It stands only in
 *     that Nexus, at an epoch the hearth still holds live, and as signed.
 *   · THE NEWCOMER IS A SECRET'S HOLDER, NEVER A NAME. The nonce commits to 32 bytes the friend holds; the
 *     friend who shows them owns the answer. The introduction names nobody but the guest.
 *   · THE ANSWER NAMES NO INTRODUCER. An answer gets built field by field from the admit, the Nexus, the
 *     epoch and the nonce. No field of it holds or derives from the guest's key or the signature, so two
 *     guests' answers for one newcomer read alike. On an admit the caller's mint yields a fresh host-purpose
 *     token whose random nonce links to nothing here.
 *   · THE DIAL READS A COUNT. How many introductions one guest may hold open is a number on the hosting act;
 *     no field anywhere holds a clock reading.
 *   · THIS MODULE KEEPS NOTHING. It holds no store and no key. Consuming an introduction means the caller
 *     drops it once it holds the answer.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { canonicalJson, canonicalJsonBytes, hex, hexToBytes, sha256HexSync } from "./crypto.js";
import { HOSTING_INTRODUCTION_DOMAIN } from "./domains.js";
import { isInviteToken, type InviteToken } from "./hosting.js";

/** A fault the caller made: malformed fields handed to a signer, a secret of the wrong length, an answer asked
 *  of something that is no introduction. Its message leads with the fault's name and carries no secret. */
export class IntroductionError extends Error {}

const HEX_64 = /^[0-9a-f]{64}$/;
const HEX_128 = /^[0-9a-f]{128}$/;
const normAid = (aid: string): string => aid.trim().toLowerCase();

/** What the guest signs. Every field holds a string; none holds a clock reading. */
export interface Introduction {
  readonly kind:          string;   // HOSTING_INTRODUCTION_DOMAIN
  readonly nexus:         string;   // the Nexus AID the hearth hosts in
  readonly epoch:         string;   // the CID of the hosting act the guest read
  readonly newcomerNonce: string;   // `newcomerNonceOf` of a secret the FRIEND holds
  readonly introducer:    string;   // the guest's proven per-Nexus key at this hearth
  readonly signature:     string;   // Ed25519 by `introducer` over `introductionBytes`
}
export type IntroductionFields = Omit<Introduction, "kind" | "signature">;

const FIELD_KEYS = ["nexus", "epoch", "newcomerNonce", "introducer"] as const;
const INTRODUCTION_KEYS = ["kind", ...FIELD_KEYS, "signature"] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
const exactKeys = (x: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(x).length === keys.length && keys.every((k) => Object.hasOwn(x, k));
const hex64 = (v: unknown): v is string => typeof v === "string" && HEX_64.test(v);
const aid = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function fieldsHold(x: Record<string, unknown>): boolean {
  return aid(x["nexus"]) && hex64(x["epoch"]) && hex64(x["newcomerNonce"]) && hex64(x["introducer"]);
}

/** The nonce a newcomer's 32-byte secret commits to. One-way: the nonce shows nothing of the secret. */
export function newcomerNonceOf(secret: Uint8Array): string {
  if (!(secret instanceof Uint8Array) || secret.length !== 32) throw new IntroductionError("newcomer-secret-malformed");
  return sha256HexSync(canonicalJson({ kind: HOSTING_INTRODUCTION_DOMAIN, part: "newcomer", secret: hex(secret) }));
}

/** The bytes a guest signs: the four fields under the introduction's own name and part. */
export function introductionBytes(fields: IntroductionFields): Uint8Array {
  return canonicalJsonBytes({
    kind: HOSTING_INTRODUCTION_DOMAIN, part: "introduction", nexus: normAid(fields.nexus),
    epoch: fields.epoch, newcomerNonce: fields.newcomerNonce, introducer: fields.introducer,
  });
}

/** Structural guard: exactly the six keys, each of its lawful shape. `verifyIntroduction` reads the signature. */
export function isIntroduction(v: unknown): v is Introduction {
  return isRecord(v) && exactKeys(v, INTRODUCTION_KEYS) && v["kind"] === HOSTING_INTRODUCTION_DOMAIN &&
    fieldsHold(v) && typeof v["signature"] === "string" && HEX_128.test(v["signature"]);
}

/** Sign an introduction. Malformed fields refuse before the signer gets asked for anything. */
export async function signIntroduction(
  fields: IntroductionFields,
  sign:   (bytes: Uint8Array) => Promise<string>,
): Promise<Introduction> {
  if (!isRecord(fields) || !exactKeys(fields, FIELD_KEYS) || !fieldsHold(fields)) throw new IntroductionError("introduction-malformed");
  const signature = await sign(introductionBytes(fields));
  if (typeof signature !== "string" || !HEX_128.test(signature)) throw new IntroductionError("introduction-signature-malformed");
  return {
    kind: HOSTING_INTRODUCTION_DOMAIN, nexus: normAid(fields.nexus), epoch: fields.epoch,
    newcomerNonce: fields.newcomerNonce, introducer: fields.introducer, signature,
  };
}

export type IntroductionRefusal =
  | "introduction-malformed" | "introduction-nexus-foreign" | "introduction-epoch-dead" | "introduction-unsigned";
export type IntroductionVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly refusal: IntroductionRefusal };

/**
 * Does this introduction stand at this hearth? `live` names the hearth's Nexus and the hosting epochs it holds
 * live (the current and the previous). The first fault in this order names the refusal: a malformed shape,
 * another Nexus, an epoch outside the live set, a signature that fails under the named introducer. Never throws.
 */
export function verifyIntroduction(
  intro: unknown,
  live:  { readonly nexus: string; readonly epochs: readonly string[] },
): IntroductionVerdict {
  if (!isIntroduction(intro)) return { ok: false, refusal: "introduction-malformed" };
  if (normAid(intro.nexus) !== normAid(live.nexus)) return { ok: false, refusal: "introduction-nexus-foreign" };
  if (!live.epochs.includes(intro.epoch)) return { ok: false, refusal: "introduction-epoch-dead" };
  let signed = false;
  try { signed = ed25519.verify(hexToBytes(intro.signature), introductionBytes(intro), hexToBytes(intro.introducer)); }
  catch { signed = false; }
  return signed ? { ok: true } : { ok: false, refusal: "introduction-unsigned" };
}

/** The operator's answer. No field names, or derives from, the introducer or the signature. */
export interface Answer {
  readonly admitted:      boolean;
  readonly nexus:         string;
  readonly epoch:         string;
  readonly newcomerNonce: string;
  readonly token?:        InviteToken;   // on an admit alone, when the caller supplied a mint
}

/**
 * Consume an introduction into the operator's answer. The caller verifies first and drops `intro` after. On an
 * admit, `mint` (the hearth passes its own host-token mint) runs once; on a decline it never runs. The answer
 * takes exactly four values from the introduction, one by one, so a field an introduction gains later never
 * reaches an answer.
 */
export function answerIntroduction(intro: Introduction, admit: boolean, mint?: () => InviteToken): Answer {
  if (!isIntroduction(intro)) throw new IntroductionError("introduction-malformed");
  const admitted = admit === true;
  const nexus = normAid(intro.nexus), epoch = intro.epoch, newcomerNonce = intro.newcomerNonce;
  if (!admitted || mint === undefined) return { admitted, nexus, epoch, newcomerNonce };
  const token = mint();
  if (!isInviteToken(token)) throw new IntroductionError("answer-token-malformed");
  return { admitted, nexus, epoch, newcomerNonce, token: { purpose: token.purpose, n: token.n, y: token.y } };
}

/** Structural guard: the four keys, and a token on an admit alone. One more key refuses the whole answer. */
export function isAnswer(v: unknown): v is Answer {
  if (!isRecord(v)) return false;
  const base = ["admitted", "nexus", "epoch", "newcomerNonce"];
  const tokened = Object.hasOwn(v, "token");
  if (!exactKeys(v, tokened ? [...base, "token"] : base)) return false;
  if (typeof v["admitted"] !== "boolean" || !aid(v["nexus"]) || !hex64(v["epoch"]) || !hex64(v["newcomerNonce"])) return false;
  return !tokened || (v["admitted"] === true && isInviteToken(v["token"]));
}

/** Does the friend holding `secret` own this answer? True only when the secret commits to the answer's nonce. */
export function answerIsFor(answer: Answer, secret: Uint8Array): boolean {
  if (!isAnswer(answer) || !(secret instanceof Uint8Array) || secret.length !== 32) return false;
  return newcomerNonceOf(secret) === answer.newcomerNonce;
}

/**
 * How many MORE introductions this guest may hold open: the dial, less the held introductions its key signed,
 * never below zero. `dial` reads a COUNT off the hosting act; anything but a whole number of zero or more reads
 * as a closed dial.
 */
export function openSlots(held: readonly Introduction[], introducer: string, dial: number): number {
  if (!Number.isSafeInteger(dial) || dial < 0) return 0;
  const who = introducer.toLowerCase();
  const open = held.filter((intro) => isIntroduction(intro) && intro.introducer === who).length;
  return Math.max(0, dial - open);
}
