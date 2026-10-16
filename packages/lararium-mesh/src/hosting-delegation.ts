/**
 * hosting-delegation — the operator's SEAT delegates hosting to ONE key, and that key signs every hosting act a hearth
 * publishes in a Nexus, with the three dials the user road's bound rides. Platform-blind and pure; it keeps no store
 * and holds no key past a call.
 *
 * ── THE DELEGATION ─────────────────────────────────────────────────────────────────────────────────
 * The seat signs `{kind, nexusAid, seat, hostingKey}` under `hosting-delegation`, once. No epoch, no session and no
 * face rides it, so it stands across sessions and every roll: an ended session changes no signed byte. The Nexus
 * rides it because one seat may hold chairs in many Nexuses, and a delegation for one never hosts in another. A seat
 * that names itself as its hosting key delegates nothing, and the mint refuses it: the seat stays cold.
 *
 * ── THE ACT ────────────────────────────────────────────────────────────────────────────────────────
 * The hosting key signs `{kind, nexusAid, seat, hostingKey, delegation, oprfPub, prev, dials}` under
 * `hosting-delegated-act`, where `delegation` carries the seat's signature and `dials` the three counts
 * (`membership-doctrine#/the-invite`): `openIntroductions` (unanswered introductions one guest may hold),
 * `preAnswered` (the pre-answered allowance's cap, which `allowance` reads), `strangersHeld` (strangers'
 * introductions the hearth keeps). No dial reads a clock. The reader checks the delegation under the seat AND the
 * act under the hosting key, so a moved seat, delegation, hosting key, Nexus, parent or dial refuses by name. The
 * act's CID names the hosting EPOCH, as the leaf-signed act's did.
 *
 * ── THE HOSTING KEY SEEDS EACH EPOCH ───────────────────────────────────────────────────────────────
 * Two keys derive per epoch from the hosting key's seed and from nothing else: the POPRF key the token path
 * evaluates under (`hostingKeyPair`, keyed by the parent, so the act can carry its public key), and the Ed25519 key
 * that signs walker grants (HKDF under `hosting-grant-key`, over the Nexus and the epoch's own CID). The grant key's
 * public half stays OFF the act: a serving row holds it, and a seized walker's grant proves "this hearth hosts G"
 * to no reader of the hosting doc (`walker-grant`).
 *
 * WHO CALLS IT. `walker-grant` alone; no live route calls it yet, and it stands for the walker route's signed-byte
 * act, out of the package barrel. The leaf-signed act in `hosting.ts` serves the live callers (the issuer, the
 * reader, `hosting-store` and the socket sorter). Whether a seat sits seated in the Nexus's charter rides the
 * reader's `seatedKeys`, which its caller reads off the charter.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */
import * as ed25519 from "@noble/ed25519";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalJsonBytes, hex, sha256HexBytesSync } from "./crypto.js";
import { HOSTING_DELEGATED_ACT_DOMAIN, HOSTING_DELEGATION_DOMAIN, HOSTING_GRANT_KEY_INFO } from "./domains.js";
import { acceptEd25519Key, verifyEd25519 } from "./ed25519-door.js";
import { hostingKeyPair } from "./hosting.js";

const HEX_64  = /^[0-9a-f]{64}$/;
const HEX_128 = /^[0-9a-f]{128}$/;
const normAid = (aid: string): string => aid.trim().toLowerCase();

/** The three dials a hosting act carries — each a count, none a clock. */
export interface HostingDials {
  /** How many introductions one guest may hold unanswered. */
  readonly openIntroductions: number;
  /** The pre-answered allowance's cap: the most invites one lineage may mint in an epoch (`allowance`). */
  readonly preAnswered:       number;
  /** How many strangers' introductions the hearth keeps; overflow drops. */
  readonly strangersHeld:     number;
}

/** The seat's one delegation to a hosting key in one Nexus. */
export interface HostingDelegation {
  readonly kind:       typeof HOSTING_DELEGATION_DOMAIN;
  readonly nexusAid:   string;
  /** The operator seat's Ed25519 verifying key (hex) — the key a charter seats. */
  readonly seat:       string;
  /** The hosting key's Ed25519 verifying key (hex) — its public identity. */
  readonly hostingKey: string;
  /** Ed25519 by `seat` over `hostingDelegationBytes`. */
  readonly sig:        string;
}

/** A hearth's hosting act under the seat's delegation. Its CID names the epoch. */
export interface DelegatedHostingAct {
  readonly kind:       typeof HOSTING_DELEGATED_ACT_DOMAIN;
  readonly nexusAid:   string;
  readonly seat:       string;
  readonly hostingKey: string;
  /** The seat's signature over the delegation (`HostingDelegation.sig`). */
  readonly delegation: string;
  /** The act's POPRF public key (ristretto255, hex), seeded by the hosting key. */
  readonly oprfPub:    string;
  /** The CID of the act this one rolls from; null for the hearth's first act in this Nexus. */
  readonly prev:       string | null;
  readonly dials:      HostingDials;
  /** Ed25519 by `hostingKey` over `delegatedHostingActBytes`. */
  readonly sig:        string;
}

/** One epoch as the minting tier holds it: the act, its CID, both secrets the hosting key seeds, the grant key's public half. */
export interface DelegatedHostingEpoch {
  readonly act:         DelegatedHostingAct;
  readonly cid:         string;
  /** The POPRF secret the token path evaluates under. A minting secret. */
  readonly oprfSecret:  Uint8Array;
  /** The Ed25519 seed that signs walker grants at this epoch. A minting secret. */
  readonly grantSecret: Uint8Array;
  /** The grant key's public half (hex): what a serving row holds. */
  readonly grantKey:    string;
}

/** Why an act refuses. */
export type HostingActRefusal =
  | "act-malformed"            // a field missing, extra, or out of shape; a dial that names no count
  | "seat-key-refused"         // a seat the Ed25519 door refuses
  | "hosting-key-refused"      // a hosting key the Ed25519 door refuses
  | "delegation-to-self"       // the seat names itself as its hosting key
  | "delegation-refused"       // the seat's signature fails over this Nexus, seat and hosting key
  | "act-signature-refused"    // the hosting key's signature fails over the act
  | "seat-unseated";           // the reader holds a seated set, and the seat sits outside it

export type HostingActReading =
  | { readonly ok: true; readonly act: DelegatedHostingAct }
  | { readonly ok: false; readonly refusal: HostingActRefusal };

const DIAL_KEYS = ["openIntroductions", "preAnswered", "strangersHeld"] as const;
const ACT_KEYS = ["kind", "nexusAid", "seat", "hostingKey", "delegation", "oprfPub", "prev", "dials", "sig"] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const exactKeys = (x: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(x).length === keys.length && keys.every((k) => Object.hasOwn(x, k));
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

/** Copy three dials out of a handed-in value, each read ONCE, or null when the shape fails. */
function dialsOf(v: unknown): HostingDials | null {
  if (!isRecord(v) || !exactKeys(v, DIAL_KEYS)) return null;
  const openIntroductions = v["openIntroductions"], preAnswered = v["preAnswered"], strangersHeld = v["strangersHeld"];
  if (!isCount(openIntroductions) || !isCount(preAnswered) || !isCount(strangersHeld)) return null;
  return Object.freeze({ openIntroductions, preAnswered, strangersHeld });
}

/** Copy a whole act out of a handed-in value, each field read ONCE, or null when the shape fails. */
function actOf(v: unknown): DelegatedHostingAct | null {
  try {
    if (!isRecord(v) || !exactKeys(v, ACT_KEYS)) return null;
    const kind = v["kind"], nexusAid = v["nexusAid"], seat = v["seat"], hostingKey = v["hostingKey"], delegation = v["delegation"];
    const oprfPub = v["oprfPub"], prev = v["prev"], sig = v["sig"];
    const dials = dialsOf(v["dials"]);
    if (kind !== HOSTING_DELEGATED_ACT_DOMAIN || dials === null) return null;
    if (typeof nexusAid !== "string" || nexusAid.trim().length === 0) return null;
    if (typeof seat !== "string" || !HEX_64.test(seat) || typeof hostingKey !== "string" || !HEX_64.test(hostingKey)) return null;
    if (typeof oprfPub !== "string" || !HEX_64.test(oprfPub)) return null;
    if (prev !== null && (typeof prev !== "string" || !HEX_64.test(prev))) return null;
    if (typeof delegation !== "string" || !HEX_128.test(delegation) || typeof sig !== "string" || !HEX_128.test(sig)) return null;
    return Object.freeze({ kind, nexusAid: normAid(nexusAid), seat, hostingKey, delegation, oprfPub, prev, dials, sig });
  } catch { return null; }
}

/** The bytes the seat signs to delegate hosting in one Nexus to one key. */
export function hostingDelegationBytes(parts: { readonly nexusAid: string; readonly seat: string; readonly hostingKey: string }): Uint8Array {
  return canonicalJsonBytes({
    kind: HOSTING_DELEGATION_DOMAIN, nexusAid: normAid(parts.nexusAid), seat: parts.seat.toLowerCase(), hostingKey: parts.hostingKey.toLowerCase(),
  });
}

/** The seat signs its one delegation. The caller zeroes `seatSeed`. */
export async function signHostingDelegation(parts: {
  readonly seatSeed: Uint8Array; readonly nexusAid: string; readonly hostingKey: string;
}): Promise<HostingDelegation> {
  const seat = hex(await ed25519.getPublicKeyAsync(parts.seatSeed));
  const hostingKey = parts.hostingKey.toLowerCase();
  const nexusAid = normAid(parts.nexusAid);
  const sig = hex(await ed25519.signAsync(hostingDelegationBytes({ nexusAid, seat, hostingKey }), parts.seatSeed));
  return Object.freeze({ kind: HOSTING_DELEGATION_DOMAIN, nexusAid, seat, hostingKey, sig });
}

/** The image the hosting key signs for one act, one spelling of each value. */
function actImage(parts: Omit<DelegatedHostingAct, "sig">): Record<string, unknown> {
  return {
    kind: HOSTING_DELEGATED_ACT_DOMAIN, nexusAid: normAid(parts.nexusAid), seat: parts.seat.toLowerCase(),
    hostingKey: parts.hostingKey.toLowerCase(), delegation: parts.delegation.toLowerCase(), oprfPub: parts.oprfPub.toLowerCase(),
    prev: parts.prev, dials: {
      openIntroductions: parts.dials.openIntroductions, preAnswered: parts.dials.preAnswered, strangersHeld: parts.dials.strangersHeld,
    },
  };
}

/** The bytes the hosting key signs for one act. */
export function delegatedHostingActBytes(parts: Omit<DelegatedHostingAct, "sig">): Uint8Array {
  return canonicalJsonBytes(actImage(parts));
}

/** The act's CID — the hosting epoch it names: a digest of the image and its signature together. */
export function delegatedHostingActCid(act: DelegatedHostingAct): string {
  const { sig, ...body } = act;
  return sha256HexBytesSync(canonicalJsonBytes({ ...actImage(body), sig: sig.toLowerCase() }));
}

/**
 * Read an act: its shape, both keys at the Ed25519 door, the seat's delegation, the hosting key's signature, and —
 * when the reader holds the Nexus's seated keys — the seat's chair. Pure; never throws. Hands back the frozen copy
 * it read.
 */
export function readDelegatedHostingAct(v: unknown, opts: { readonly seatedKeys?: readonly string[] } = {}): HostingActReading {
  const act = actOf(v);
  if (act === null) return { ok: false, refusal: "act-malformed" };
  if (!acceptEd25519Key(act.seat).ok) return { ok: false, refusal: "seat-key-refused" };
  if (!acceptEd25519Key(act.hostingKey).ok) return { ok: false, refusal: "hosting-key-refused" };
  if (act.seat === act.hostingKey) return { ok: false, refusal: "delegation-to-self" };
  if (!verifyEd25519(act.delegation, hostingDelegationBytes(act), act.seat)) return { ok: false, refusal: "delegation-refused" };
  const { sig, ...body } = act;
  if (!verifyEd25519(sig, delegatedHostingActBytes(body), act.hostingKey)) return { ok: false, refusal: "act-signature-refused" };
  if (opts.seatedKeys !== undefined && !opts.seatedKeys.some((k) => k.toLowerCase() === act.seat)) return { ok: false, refusal: "seat-unseated" };
  return { ok: true, act };
}

/** The same reading as a boolean. */
export function verifyDelegatedHostingAct(v: unknown, opts: { readonly seatedKeys?: readonly string[] } = {}): boolean {
  return readDelegatedHostingAct(v, opts).ok;
}

/** The grant key the hosting key seeds at one epoch. The caller zeroes the seed it gets back. */
function grantKeySeed(hostingSeed: Uint8Array, nexusAid: string, epochCid: string): Uint8Array {
  return hkdf(sha256, hostingSeed, new Uint8Array(0), canonicalJsonBytes({ domain: HOSTING_GRANT_KEY_INFO, nexusAid: normAid(nexusAid), epoch: epochCid }), 32);
}

async function epochOf(act: DelegatedHostingAct, cid: string, hostingSeed: Uint8Array, oprfSecret: Uint8Array): Promise<DelegatedHostingEpoch> {
  const grantSecret = grantKeySeed(hostingSeed, act.nexusAid, cid);
  return { act, cid, oprfSecret, grantSecret, grantKey: hex(await ed25519.getPublicKeyAsync(grantSecret)) };
}

/**
 * Sign the hearth's next act in the delegation's Nexus, rolling from `prev` (null for the first), under `dials`.
 * The hosting seed must hold the delegated key. Writes nothing.
 */
export async function mintDelegatedHostingAct(parts: {
  readonly hostingSeed: Uint8Array; readonly delegation: HostingDelegation; readonly prev: string | null; readonly dials: HostingDials;
}): Promise<DelegatedHostingEpoch> {
  const dials = dialsOf(parts.dials);
  if (dials === null) throw new Error("hosting-dials-malformed — each dial names a whole count of at least 0");
  const { delegation } = parts;
  const hostingKey = hex(await ed25519.getPublicKeyAsync(parts.hostingSeed));
  if (delegation.seat.toLowerCase() === delegation.hostingKey.toLowerCase()) throw new Error("delegation-to-self — a seat delegates hosting to another key");
  if (hostingKey !== delegation.hostingKey.toLowerCase()) throw new Error("hosting-key-mismatch — the hosting seed holds another key than the delegation names");
  const nexusAid = normAid(delegation.nexusAid);
  const kp = hostingKeyPair({ leafSeed: parts.hostingSeed, nexusAid, prev: parts.prev });
  const body: Omit<DelegatedHostingAct, "sig"> = {
    kind: HOSTING_DELEGATED_ACT_DOMAIN, nexusAid, seat: delegation.seat.toLowerCase(), hostingKey,
    delegation: delegation.sig.toLowerCase(), oprfPub: hex(kp.publicKey), prev: parts.prev, dials,
  };
  const sig = hex(await ed25519.signAsync(delegatedHostingActBytes(body), parts.hostingSeed));
  const read = readDelegatedHostingAct({ ...body, sig });
  if (!read.ok) throw new Error(`hosting-act-refused — the act this mint signed reads ${read.refusal}`);
  return epochOf(read.act, delegatedHostingActCid(read.act), parts.hostingSeed, kp.secretKey);
}

/** Re-derive the epoch an act names from the hosting seed. Null when the seed holds another key or derives another POPRF key. */
export async function delegatedHostingEpochOf(act: DelegatedHostingAct, hostingSeed: Uint8Array): Promise<DelegatedHostingEpoch | null> {
  if (hex(await ed25519.getPublicKeyAsync(hostingSeed)) !== act.hostingKey.toLowerCase()) return null;
  const kp = hostingKeyPair({ leafSeed: hostingSeed, nexusAid: act.nexusAid, prev: act.prev });
  if (hex(kp.publicKey) !== act.oprfPub.toLowerCase()) return null;
  return epochOf(act, delegatedHostingActCid(act), hostingSeed, kp.secretKey);
}
