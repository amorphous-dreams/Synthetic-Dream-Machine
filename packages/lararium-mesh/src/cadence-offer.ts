/**
 * cadence-offer — the ENGINE CADENCE's offer lineage: the `prev`-linked offers that advance a Nexus's engine window,
 * the release-denies that drop an engine mid-window, and the one fold a device's adoption gate reads
 * (kahu#/contract, the cadence lineage).
 *
 * The cadence alone offers engines. The kahu quorum never offers one, and the cadence threshold never admits
 * anyone: nothing here reads a seat, a charter roster or a floor release. A floor may CARRY these records as
 * evidence; the gate judges them against the cadence inception and nothing else.
 *
 * ── THE WINDOW ──────────────────────────────────────────────────────────────────────────────────
 * An engine stands while its offer sits within k hops of the head a hearth holds (the head at hop 0, an offer
 * trailing it by k hops at the edge) and no release-deny names it. k rides each offer, and the fold reads it off
 * the head. The window advances and ages only by offers: never by time, never by counting who runs what. A
 * release-deny drops its engine from every window of its inception, monotone; a later offer of the same CID never
 * revives it (a re-offer mints a new engine CID).
 *
 * ── READINGS TAKEN WHERE CANON STAYS SILENT ─────────────────────────────────────────────────────
 *   · THE RELEASE-DENY'S SIGNER: canon names none. This module reads it as the cadence joint itself, the same t of
 *     the inception's holders that signs an offer (a deny drops a WHEN, and WHEN belongs to the cadence).
 *   · THE RELEASE-DENY'S `prev`: present on every deny, a digest or null, so its bytes stay one spelling. It names
 *     the offer head the holders stood at when they denied, anchoring the act in the lineage; it gates nothing in
 *     the fold, since a carried window holds only k + 1 offers and an anchor further back would read as missing.
 *   · THE WALK READS k + 1 OFFERS: the fold walks `prev` from the head only as far as the window's edge, so a floor
 *     carries the window's own offers and nothing older. Every offer and deny handed in verifies, on the walk or off
 *     it: the evidence set holds nothing the inception did not sign.
 *   · EVIDENCE REFUSES WHOLE: a malformed, foreign or under-signed record anywhere in the set refuses the fold by
 *     name, never drops silently. A carrier may drop records; it can never forge one.
 *   · TWO OFFERS ON ONE `prev`: the head the hearth holds picks the branch; the fold orders no branches.
 *
 * ── OWED, THE NEXT SLICES ───────────────────────────────────────────────────────────────────────
 * This fold verifies against the INCEPTION's keys and threshold alone. Cadence seat events (rotate onto a committed
 * next key, seat, unseat) move the signing set, and the first holder rotation needs them: the next slice. The
 * corpus-kahu lineage check ("a Nexus offers only engines the corpus-kahu lineage contains") and the device's
 * adoption gate sit outside this module too.
 *
 * Pure: no I/O, no clock, no log. Platform-blind.
 * Meme: lar:///ha.ka.ba/lararium/mesh/kahu#/contract
 */
import { canonicalJson, canonicalJsonBytes, sha256HexSync } from "./crypto.js";
import { CADENCE_OFFER_DOMAIN, CADENCE_RELEASE_DENY_DOMAIN } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";
import type { QuorumSignature } from "./kapae-antigen.js";
import {
  cadenceInceptionDigest, verifyCadenceInception, type CadenceInception, type CadenceRefusal,
} from "./cadence-lineage.js";

/** The exact body t of the cadence holders sign to offer one engine. */
export interface CadenceOfferBody {
  readonly kind:      typeof CADENCE_OFFER_DOMAIN;
  /** The cadence inception's digest (`cadenceInceptionDigest`). */
  readonly inception: string;
  /** The prior offer's digest (`cadenceOfferDigest`); null for the lineage's first offer. */
  readonly prev:      string | null;
  /** The offered engine's CID: a CIDv1 raw sha-256 in its one spelling. */
  readonly engine:    string;
  /** The window's width in hops: how far an offer may trail the head and still stand. */
  readonly k:         number;
}

/** The exact body t of the cadence holders sign to drop one engine from the window. */
export interface CadenceReleaseDenyBody {
  readonly kind:      typeof CADENCE_RELEASE_DENY_DOMAIN;
  readonly inception: string;
  /** The offer head the holders stood at when they denied; null when unanchored. Gates nothing in the fold. */
  readonly prev:      string | null;
  readonly engine:    string;
}

export interface SignedCadenceOffer {
  readonly body:       CadenceOfferBody;
  readonly signatures: readonly QuorumSignature[];
}

export interface SignedCadenceReleaseDeny {
  readonly body:       CadenceReleaseDenyBody;
  readonly signatures: readonly QuorumSignature[];
}

export type CadenceOfferRefusal =
  | "cadence-offer-malformed" | "cadence-offer-foreign-inception" | "cadence-offer-foreign-signer"
  | "cadence-offer-unsigned" | "cadence-offer-chain-broken";

export type CadenceReleaseDenyRefusal =
  | "cadence-release-deny-malformed" | "cadence-release-deny-foreign-inception" | "cadence-release-deny-foreign-signer"
  | "cadence-release-deny-unsigned";

export type EngineWindow =
  | { readonly ok: true;  readonly engines: readonly string[] }
  | { readonly ok: false; readonly refusal: CadenceOfferRefusal | CadenceReleaseDenyRefusal | CadenceRefusal };

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
const CID_SHAPE = /^b[a-z2-7]{58}$/;
const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";
const MAX_SIGNERS = 256;
const record = (v: unknown): Record<string, unknown> | null => typeof v === "object" && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : null;
const exactKeys = (r: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(r).length === keys.length && keys.every((k) => Object.hasOwn(r, k));
const isDigest = (v: unknown): v is string => typeof v === "string" && HEX64.test(v);
const isPrev = (v: unknown): v is string | null => v === null || isDigest(v);
const isWidth = (k: unknown): k is number => typeof k === "number" && Number.isSafeInteger(k) && k >= 0;

/** A CIDv1 raw sha-256 in its one spelling: lower base32, the raw/sha-256 header, and no stray tail bits. */
function isEngineCid(v: unknown): v is string {
  if (typeof v !== "string" || !CID_SHAPE.test(v)) return false;
  let bits = 0, acc = 0;
  const out: number[] = [];
  for (const c of v.slice(1)) {
    acc = ((acc << 5) | BASE32.indexOf(c)) & 0xffff; bits += 5;
    if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); }
  }
  if (bits > 0 && (acc & ((1 << bits) - 1)) !== 0) return false;
  return out.length === 36 && out[0] === 0x01 && out[1] === 0x55 && out[2] === 0x12 && out[3] === 0x20;
}

function readSignatures(raw: unknown): QuorumSignature[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_SIGNERS) return null;
  const out: QuorumSignature[] = [];
  for (const s of raw) {
    const q = record(s);
    if (!q || !exactKeys(q, ["signer", "sig"]) || !isDigest(q["signer"]) || typeof q["sig"] !== "string" || !HEX128.test(q["sig"])) return null;
    out.push({ signer: q["signer"], sig: q["sig"] });
  }
  return out;
}

/** t distinct holders sign `bytes`: a signer outside the holders or named twice reads foreign; a failing signature
 *  or a count short of t reads unsigned. */
function judgeSignatures(inception: CadenceInception, signatures: readonly QuorumSignature[], bytes: Uint8Array): "foreign" | "unsigned" | null {
  const holders = new Set(inception.image.keys), named = new Set<string>();
  for (const s of signatures) {
    if (!holders.has(s.signer) || named.has(s.signer)) return "foreign";
    named.add(s.signer);
  }
  if (!signatures.every((s) => verifyEd25519(s.sig, bytes, s.signer))) return "unsigned";
  return named.size < inception.image.threshold ? "unsigned" : null;
}

// ── THE OFFER ───────────────────────────────────────────────────────────────────────────────────

/** Read an offer body at its exact shape; null for anything else. */
export function readCadenceOfferBody(parsed: unknown): CadenceOfferBody | null {
  const r = record(parsed);
  if (!r || r["kind"] !== CADENCE_OFFER_DOMAIN || !exactKeys(r, ["kind", "inception", "prev", "engine", "k"])) return null;
  const { inception, prev, engine, k } = r;
  if (!isDigest(inception) || !isPrev(prev) || !isEngineCid(engine) || !isWidth(k)) return null;
  return { kind: CADENCE_OFFER_DOMAIN, inception, prev, engine, k };
}

/** Compose the offer body the holders sign; refuses what its reader would refuse. */
export function cadenceOfferBody(fields: { inception: string; prev: string | null; engine: string; k: number }): CadenceOfferBody {
  const body = readCadenceOfferBody({ kind: CADENCE_OFFER_DOMAIN, inception: fields.inception, prev: fields.prev, engine: fields.engine, k: fields.k });
  if (!body) throw new TypeError("cadence-offer-malformed: an offer needs an inception digest, a prior offer's digest or null, an engine CIDv1 raw sha-256 and a whole k of zero or more");
  return body;
}

/** The bytes t of the cadence holders sign: the body's canonical JSON. */
export function cadenceOfferBytes(body: CadenceOfferBody): Uint8Array {
  return canonicalJsonBytes(body);
}

/** The digest the next offer's `prev` names: 64 lower hex over the body's canonical bytes. */
export function cadenceOfferDigest(body: CadenceOfferBody): string {
  return sha256HexSync(canonicalJson(body));
}

/** Read a signed offer at its exact shape; `verifyCadenceOffer` judges its signatures. */
export function readCadenceOffer(parsed: unknown): SignedCadenceOffer | null {
  const r = record(parsed);
  if (!r || !exactKeys(r, ["body", "signatures"])) return null;
  const body = readCadenceOfferBody(r["body"]);
  const signatures = readSignatures(r["signatures"]);
  return body && signatures ? { body, signatures } : null;
}

/** Does t of this inception's holders sign this offer, naming this inception? Null when they do; else the refusal.
 *  The caller verifies the inception itself (`engineWindow` does). */
export function verifyCadenceOffer(inception: CadenceInception, parsed: unknown): CadenceOfferRefusal | null {
  const offer = readCadenceOffer(parsed);
  if (!offer) return "cadence-offer-malformed";
  if (offer.body.inception !== cadenceInceptionDigest(inception.image)) return "cadence-offer-foreign-inception";
  const judged = judgeSignatures(inception, offer.signatures, cadenceOfferBytes(offer.body));
  return judged === "foreign" ? "cadence-offer-foreign-signer" : judged === "unsigned" ? "cadence-offer-unsigned" : null;
}

// ── THE RELEASE-DENY ────────────────────────────────────────────────────────────────────────────

/** Read a release-deny body at its exact shape; null for anything else. */
export function readCadenceReleaseDenyBody(parsed: unknown): CadenceReleaseDenyBody | null {
  const r = record(parsed);
  if (!r || r["kind"] !== CADENCE_RELEASE_DENY_DOMAIN || !exactKeys(r, ["kind", "inception", "prev", "engine"])) return null;
  const { inception, prev, engine } = r;
  if (!isDigest(inception) || !isPrev(prev) || !isEngineCid(engine)) return null;
  return { kind: CADENCE_RELEASE_DENY_DOMAIN, inception, prev, engine };
}

/** Compose the release-deny body the holders sign; refuses what its reader would refuse. */
export function cadenceReleaseDenyBody(fields: { inception: string; prev: string | null; engine: string }): CadenceReleaseDenyBody {
  const body = readCadenceReleaseDenyBody({ kind: CADENCE_RELEASE_DENY_DOMAIN, inception: fields.inception, prev: fields.prev, engine: fields.engine });
  if (!body) throw new TypeError("cadence-release-deny-malformed: a deny needs an inception digest, an offer digest or null, and an engine CIDv1 raw sha-256");
  return body;
}

/** The bytes t of the cadence holders sign to deny: the body's canonical JSON. */
export function cadenceReleaseDenyBytes(body: CadenceReleaseDenyBody): Uint8Array {
  return canonicalJsonBytes(body);
}

/** 64 lower hex over the deny body's canonical bytes. */
export function cadenceReleaseDenyDigest(body: CadenceReleaseDenyBody): string {
  return sha256HexSync(canonicalJson(body));
}

/** Read a signed release-deny at its exact shape; `verifyCadenceReleaseDeny` judges its signatures. */
export function readCadenceReleaseDeny(parsed: unknown): SignedCadenceReleaseDeny | null {
  const r = record(parsed);
  if (!r || !exactKeys(r, ["body", "signatures"])) return null;
  const body = readCadenceReleaseDenyBody(r["body"]);
  const signatures = readSignatures(r["signatures"]);
  return body && signatures ? { body, signatures } : null;
}

/** Does t of this inception's holders sign this deny, naming this inception? Null when they do; else the refusal. */
export function verifyCadenceReleaseDeny(inception: CadenceInception, parsed: unknown): CadenceReleaseDenyRefusal | null {
  const deny = readCadenceReleaseDeny(parsed);
  if (!deny) return "cadence-release-deny-malformed";
  if (deny.body.inception !== cadenceInceptionDigest(inception.image)) return "cadence-release-deny-foreign-inception";
  const judged = judgeSignatures(inception, deny.signatures, cadenceReleaseDenyBytes(deny.body));
  return judged === "foreign" ? "cadence-release-deny-foreign-signer" : judged === "unsigned" ? "cadence-release-deny-unsigned" : null;
}

// ── THE WINDOW ──────────────────────────────────────────────────────────────────────────────────

/**
 * The engines standing at `head`: every engine whose offer sits within k hops of the head (k read off the head
 * offer), nearest first, each CID once, minus every engine a release-deny names. Refuses by name an inception its
 * holders did not all sign, any offer or deny the inception's t of holders did not sign or that names another
 * inception, and a `prev` walk that cannot reach the window's edge.
 */
export function engineWindow(
  inception: CadenceInception,
  offers: readonly unknown[],
  denies: readonly unknown[],
  head: string,
): EngineWindow {
  const unsigned = verifyCadenceInception(inception);
  if (unsigned) return { ok: false, refusal: unsigned };

  const byDigest = new Map<string, CadenceOfferBody>();
  for (const raw of offers) {
    const refusal = verifyCadenceOffer(inception, raw);
    if (refusal) return { ok: false, refusal };
    const body = (readCadenceOffer(raw) as SignedCadenceOffer).body;
    byDigest.set(cadenceOfferDigest(body), body);
  }
  const denied = new Set<string>();
  for (const raw of denies) {
    const refusal = verifyCadenceReleaseDeny(inception, raw);
    if (refusal) return { ok: false, refusal };
    denied.add((readCadenceReleaseDeny(raw) as SignedCadenceReleaseDeny).body.engine);
  }

  const top = byDigest.get(head);
  if (!top) return { ok: false, refusal: "cadence-offer-chain-broken" };
  const walked: string[] = [];
  let at: CadenceOfferBody = top;
  for (let hop = 0; ; hop++) {
    if (!walked.includes(at.engine)) walked.push(at.engine);
    if (hop === top.k || at.prev === null) break;
    const next = byDigest.get(at.prev);
    if (!next) return { ok: false, refusal: "cadence-offer-chain-broken" };
    at = next;
  }
  return { ok: true, engines: walked.filter((e) => !denied.has(e)) };
}
