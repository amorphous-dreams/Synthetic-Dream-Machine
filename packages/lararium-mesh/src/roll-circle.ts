/**
 * roll-circle — a charter roll whose seats rest in more than one vault (kahu#/seed-and-nexus, wax-stamp's roll law).
 *
 * A roll seats a key-set and re-arms every seat with a fresh successor, and its hands sign ONE image over all of it:
 * the predecessor head, every seat key, the rule, and every successor digest. Where the seats rest in several vaults,
 * no vault knows the whole image until every holder has spoken, so the roll crosses as a CIRCLE file in two passes:
 *
 *   · CONTRIBUTE — each holder adds one chair: its seat key (a successor the head committed, now revealed, or a key
 *     minted fresh for an added chair) and the digest of its own fresh successor card. A chair speaks for itself.
 *   · SIGN — once the chairs stand, each holder signs the exact image. The first signature freezes the circle: a
 *     chair joined after it would move the bytes every signer consented to, so a signed circle takes no new chair.
 *
 * The roll law decides the rest, unchanged (`verifySealRoll`): a revealed quorum at the head's own count, the new
 * quorum at the new rule, possession for every added key, no seated key returning, no successor digest spent twice,
 * and the genesis seats revealed on the first roll. A circle that verifies yields the epoch; nothing here files it.
 *
 * Verdicts, from causal position alone: `invalid` (torn, or the law refuses for a reason more signatures cannot cure,
 * among them a signed circle that reveals fewer committed successors than the head's count),
 * `stale` (the circle steps from another head than the lineage holds), `ready` (short of a quorum the next signature
 * may meet), `complete` (the epoch verifies). No clock.
 *
 * Pure: no I/O, no clock. Platform-blind.
 * Meme: lar:///ha.ka.ba/lararium/mesh/kahu#/seed-and-nexus
 */
import type { QuorumSignature } from "./kapae-antigen.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { seatNextDigest } from "./cold-key-card.js";
import {
  NEXUS_AID_PATTERN, epochSeats, mintCharterEpoch, sealKeySetHash, sealRollBytes, verifySealRoll, type SealEpoch,
} from "./wax-stamp.js";

/** The circle file's own tag. It signs nothing: the roll's hands sign `rollCircleBytes`. */
export const ROLL_CIRCLE_KIND = "nexus-roll-circle" as const;

/** One chair of a roll: the key it seats and the digest of the successor card its holder minted. */
export interface RollChair {
  readonly seat: string;
  readonly next: string;
}

export interface RollCircle {
  readonly kind:        typeof ROLL_CIRCLE_KIND;
  /** The Nexus the roll moves: the charter's genesis epoch. */
  readonly aid:         string;
  /** The head the roll steps from. */
  readonly predecessor: string;
  /** The new rule; every successor re-arms at it. */
  readonly threshold:   number;
  /** Sorted by seat; seats distinct, successor digests distinct. */
  readonly chairs:      readonly RollChair[];
  readonly signatures:  readonly QuorumSignature[];
}

export type RollCircleVerdict = "invalid" | "stale" | "ready" | "complete";

export interface RollCircleJudgement {
  readonly verdict: RollCircleVerdict;
  /** The chairs whose signature verifies over the image, sorted. */
  readonly signed:  readonly string[];
  /** The epoch the roll mints, once it reads `complete`. */
  readonly epoch?:  SealEpoch;
  readonly why?:    string;
}

/** A refusal a circle step names; nothing moved. */
export class RollCircleRefusal extends Error {
  override readonly name = "RollCircleRefusal";
  constructor(readonly code: string, message: string) { super(`${code}: ${message}`); }
}

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
const record = (v: unknown): Record<string, unknown> | null => typeof v === "object" && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : null;
const exactKeys = (r: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(r).length === keys.length && keys.every((k) => Object.hasOwn(r, k));

function readChairs(v: unknown): RollChair[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > 64) return null;
  const out: RollChair[] = [];
  for (const c of v) {
    const r = record(c);
    if (!r || !exactKeys(r, ["seat", "next"]) || typeof r["seat"] !== "string" || !HEX64.test(r["seat"]) ||
        typeof r["next"] !== "string" || !HEX64.test(r["next"])) return null;
    if (out.length > 0 && out[out.length - 1]!.seat >= r["seat"]) return null;   // one spelling: sorted, distinct
    out.push({ seat: r["seat"], next: r["next"] });
  }
  return new Set(out.map((c) => c.next)).size === out.length ? out : null;
}

function readSignatures(v: unknown): QuorumSignature[] | null {
  if (!Array.isArray(v) || v.length > 64) return null;
  const out: QuorumSignature[] = [];
  for (const s of v) {
    const r = record(s);
    if (!r || !exactKeys(r, ["signer", "sig"]) || typeof r["signer"] !== "string" || !HEX64.test(r["signer"]) ||
        typeof r["sig"] !== "string" || !HEX128.test(r["sig"])) return null;
    out.push({ signer: r["signer"], sig: r["sig"] });
  }
  return out;
}

/** Read a circle at its exact shape, from parsed JSON; null for anything torn. */
export function readRollCircle(parsed: unknown): RollCircle | null {
  const r = record(parsed);
  if (!r || !exactKeys(r, ["kind", "aid", "predecessor", "threshold", "chairs", "signatures"]) || r["kind"] !== ROLL_CIRCLE_KIND) return null;
  if (typeof r["aid"] !== "string" || !NEXUS_AID_PATTERN.test(r["aid"])) return null;
  if (typeof r["predecessor"] !== "string" || r["predecessor"].length === 0) return null;
  const t = r["threshold"];
  if (typeof t !== "number" || !Number.isInteger(t) || t < 1) return null;
  const chairs = readChairs(r["chairs"]);
  const signatures = readSignatures(r["signatures"]);
  if (!chairs || !signatures) return null;
  return { kind: ROLL_CIRCLE_KIND, aid: r["aid"], predecessor: r["predecessor"], threshold: t, chairs, signatures };
}

const circleOrRefuse = (parsed: unknown): RollCircle => {
  const c = readRollCircle(parsed);
  if (!c) throw new RollCircleRefusal("circle-torn", "the file does not read as a roll circle at its exact shape");
  return c;
};

const chairOrRefuse = (chair: RollChair): RollChair => {
  if (!chair || typeof chair.seat !== "string" || !HEX64.test(chair.seat) || typeof chair.next !== "string" || !HEX64.test(chair.next)) {
    throw new RollCircleRefusal("chair-torn", "a chair names its seat key and its successor digest, each 64 lower hex");
  }
  return { seat: chair.seat, next: chair.next };
};

/** Open a circle: the Nexus, the head it steps from, the new rule, and the opener's own chair. */
export function openRollCircle(parts: { readonly aid: string; readonly predecessor: string; readonly threshold: number; readonly chair: RollChair }): RollCircle {
  const circle = readRollCircle({ kind: ROLL_CIRCLE_KIND, aid: parts.aid, predecessor: parts.predecessor, threshold: parts.threshold,
    chairs: [chairOrRefuse(parts.chair)], signatures: [] });
  if (!circle) throw new RollCircleRefusal("circle-torn", "the Nexus, the head and the rule do not read as one roll circle");
  return circle;
}

/**
 * Add one chair. Refuses a circle any hand already signed (the bytes it consented to would move), a seat the circle
 * already holds, and a successor digest the circle already holds.
 */
export function joinRollCircle(parsed: unknown, chair: RollChair): RollCircle {
  const circle = circleOrRefuse(parsed);
  const c = chairOrRefuse(chair);
  if (circle.signatures.length > 0) throw new RollCircleRefusal("circle-signed", "a hand already signed this circle, so no chair joins it: open a new circle from the head");
  if (circle.chairs.some((x) => x.seat === c.seat)) throw new RollCircleRefusal("seat-twice", "that seat already holds a chair in this circle");
  if (circle.chairs.some((x) => x.next === c.next)) throw new RollCircleRefusal("successor-twice", "that successor digest already arms a chair in this circle");
  const chairs = [...circle.chairs, c].sort((a, b) => (a.seat < b.seat ? -1 : 1));
  return { ...circle, chairs };
}

/** The bytes every hand of the roll signs: wax-stamp's roll image over the circle's chairs. */
export function rollCircleBytes(circle: RollCircle): Uint8Array {
  return sealRollBytes({ predecessor: circle.predecessor, keys: circle.chairs.map((c) => c.seat), threshold: circle.threshold,
    nextKeyDigests: circle.chairs.map((c) => c.next), nextThreshold: circle.threshold });
}

/** The chairs whose signature verifies over the image, one per seat, sorted. */
export function rollCircleSigned(circle: RollCircle): string[] {
  const bytes = rollCircleBytes(circle);
  const seats = new Set(circle.chairs.map((c) => c.seat));
  const out = new Set<string>();
  for (const s of circle.signatures) {
    if (out.has(s.signer) || !seats.has(s.signer)) continue;
    if (verifyEd25519(s.sig, bytes, s.signer)) out.add(s.signer);
  }
  return [...out].sort();
}

/** Add signatures. Refuses a signer outside the circle's chairs, and one whose seat already signed. */
export function signRollCircle(parsed: unknown, signatures: readonly QuorumSignature[]): RollCircle {
  const circle = circleOrRefuse(parsed);
  const seats = new Set(circle.chairs.map((c) => c.seat));
  const signed = new Set(rollCircleSigned(circle));
  for (const s of signatures) {
    if (!seats.has(s.signer)) throw new RollCircleRefusal("signer-unseated", "a hand signs for a seat the circle seats no chair for");
    if (signed.has(s.signer)) throw new RollCircleRefusal("signer-twice", "that seat already signed this circle");
    signed.add(s.signer);
  }
  return { ...circle, signatures: [...circle.signatures, ...signatures] };
}

/** The roll law's refusals a later signature may still cure; any other refusal reads `invalid`. */
const SHORT = new Set(["roll-short-of-revealed-quorum", "roll-short-of-seated-quorum", "seat-change-without-proof-of-possession"]);

/**
 * Judge a circle against a VERIFIED lineage (genesis first, the head last), the way the roll law reads the epoch it
 * would mint. The caller supplies a lineage it already verified; the judge reads the head and the history off it.
 */
export function judgeRollCircle(parsed: unknown, lineage: readonly SealEpoch[]): RollCircleJudgement {
  const circle = readRollCircle(parsed);
  if (!circle) return { verdict: "invalid", signed: [], why: "the file does not read as a roll circle at its exact shape" };
  if (lineage.length === 0 || lineage[0]!.epochCid !== circle.aid) return { verdict: "invalid", signed: [], why: "the circle names another Nexus than the lineage this vessel reads" };
  const head = lineage[lineage.length - 1]!;
  const signed = rollCircleSigned(circle);
  if (circle.predecessor !== head.epochCid) return { verdict: "stale", signed, why: "the circle steps from another head than the one this lineage holds" };
  if (circle.threshold > circle.chairs.length) return { verdict: "ready", signed, why: "the rule asks more seats than the circle holds chairs; more chairs may join before any hand signs" };
  const keys = circle.chairs.map((c) => c.seat);
  const genesisSeats = head.predecessors.length === 0 ? epochSeats(head) : null;
  if (head.predecessors.length === 0 && !genesisSeats) return { verdict: "invalid", signed, why: "the genesis reads no seats to reveal on its first roll" };
  const epoch = mintCharterEpoch(
    { keySetHash: sealKeySetHash(keys, circle.threshold), nextKeyDigests: circle.chairs.map((c) => c.next), nextThreshold: circle.threshold,
      predecessors: [head.epochCid] },
    { keys, threshold: circle.threshold, signatures: [...circle.signatures],
      ...(genesisSeats ? { genesis: { keys: [...genesisSeats.keys], threshold: genesisSeats.threshold } } : {}) },
  );
  const code = verifySealRoll(head, epoch, lineage.slice(0, -1));
  if (code === null) return { verdict: "complete", signed, epoch };
  // A signed circle takes no chair, so one that reveals fewer committed successors than the head's count never
  // completes: it reads invalid, and its holders open a new circle rather than sign a dead one.
  const reveals = (seat: string): boolean => { try { return head.nextKeyDigests.includes(seatNextDigest(seat)); } catch { return false; } };
  const revealed = circle.chairs.filter((c) => reveals(c.seat)).length;
  if (circle.signatures.length > 0 && revealed < head.nextThreshold) {
    return { verdict: "invalid", signed, why: "roll-frozen-short-of-revealed-quorum" };
  }
  return { verdict: SHORT.has(code) ? "ready" : "invalid", signed, why: code };
}
