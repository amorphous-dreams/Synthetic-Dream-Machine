/**
 * walker-grant — H8: a walker's hosting grant the hearth SIGNS, and the public-half reader a SERVING checker runs
 * holding no minting secret. Platform-blind and pure; it keeps no store.
 *
 * ── THE GRANT ──────────────────────────────────────────────────────────────────────────────────────
 * `{kind, nexusAid, epoch, leaf, lineage, survived, from, sig}`, where the epoch's GRANT KEY (seeded by the hosting
 * key, `hosting-delegation`) signs the rest under `hosting-walker-grant`. The keyed POPRF tag it supersedes let only
 * a holder of the epoch secret check a grant; a serving tier that held that secret could mint as well as check. The
 * signature splits the two: the minting tier holds the grant key's seed, and a serving row holds its public half
 * alone (`grantPublicHalf`). Renewal stays deterministic (Ed25519 signs deterministically): a grant at the previous
 * epoch renews to `{L, e_cur, s+1}`, the same grant in yielding the same grant out.
 *
 * ── WHO CAN CHECK ONE ──────────────────────────────────────────────────────────────────────────────
 * The grant key's public half rides no public record: the hosting act carries the POPRF key and never the grant key,
 * so a seized phone's grant still proves "this hearth hosts G" to no reader of the hosting doc, only to a holder of
 * the hearth's serving rows. (An Ed25519 signature names no key a reader could recover from it.)
 *
 * ── THE READER ─────────────────────────────────────────────────────────────────────────────────────
 * `readWalkerGrant(half, grant, {revokedLeaves})` refuses by name: a malformed grant or half, a grant of another
 * Nexus, of another epoch (a roll, or non-renewal), a signature that fails over any field (class, leaf, lineage,
 * survived), or a leaf the reader holds revoked (a kapae of the guest's leaf). Revocation reads only after the
 * signature, so an unsigned grant learns nothing of the revoked set.
 *
 * WHAT WAITS FOR THE LIVE CUT. The keyed tag (`issueGrant`, `grantVerifiesAt`, `renewGrant` in `hosting.ts`) still
 * stands for its live callers; the one signed-byte cut moves the issuer, the sorter's check and the serving rows onto
 * this shape together, and E's walker arm waits on that cut.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/ember#/the-tiers
 */
import * as ed25519 from "@noble/ed25519";
import { canonicalJsonBytes, hex } from "./crypto.js";
import { HOSTING_WALKER_GRANT_DOMAIN } from "./domains.js";
import { acceptEd25519Key, verifyEd25519 } from "./ed25519-door.js";
import type { DelegatedHostingEpoch } from "./hosting-delegation.js";

const HEX_64  = /^[0-9a-f]{64}$/;
const HEX_128 = /^[0-9a-f]{128}$/;
const normAid = (aid: string): string => aid.trim().toLowerCase();

/** A walker's signed hosting grant — carried by the walker, stored nowhere at the hearth. */
export interface WalkerGrant {
  readonly kind:     typeof HOSTING_WALKER_GRANT_DOMAIN;
  readonly nexusAid: string;
  /** The epoch (delegated hosting act CID) the grant was issued at. */
  readonly epoch:    string;
  /** The walker's per-Nexus leaf (hex) — the key that proves over each socket the grant rides. */
  readonly leaf:     string;
  /** The lineage `L` (hex) — opaque to anyone who holds no claim. */
  readonly lineage:  string;
  /** Hosting epochs this lineage has survived — a causal count its renewals carry, never days. */
  readonly survived: number;
  /** The class of the invite this lineage opened on. */
  readonly from:     "host" | "walker";
  /** Ed25519 by the epoch's grant key over `walkerGrantBytes`. */
  readonly sig:      string;
}

/** What a SERVING row holds to check grants at one epoch: three public fields, no minting secret. */
export interface GrantPublicHalf {
  readonly nexusAid: string;
  readonly epoch:    string;
  /** The epoch's grant key, public half (hex). */
  readonly grantKey: string;
}

/** Why a grant refuses. */
export type WalkerGrantRefusal =
  | "half-malformed"            // the serving row's half reads out of shape, or its key fails the Ed25519 door
  | "grant-malformed"           // a field missing, extra, or out of shape
  | "grant-nexus-foreign"       // the grant names another Nexus than the half
  | "grant-epoch-foreign"       // the grant names another epoch: a roll passed, or it went unrenewed
  | "grant-signature-refused"   // the grant key's signature fails over the grant's fields
  | "grant-revoked";            // the reader holds the grant's leaf revoked

export type WalkerGrantReading =
  | { readonly ok: true; readonly grant: WalkerGrant }
  | { readonly ok: false; readonly refusal: WalkerGrantRefusal };

const GRANT_KEYS = ["kind", "nexusAid", "epoch", "leaf", "lineage", "survived", "from", "sig"] as const;
const HALF_KEYS = ["nexusAid", "epoch", "grantKey"] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const exactKeys = (x: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(x).length === keys.length && keys.every((k) => Object.hasOwn(x, k));

/** Copy a grant out of a handed-in value, each field read ONCE, or null when the shape fails. */
function grantOf(v: unknown): WalkerGrant | null {
  try {
    if (!isRecord(v) || !exactKeys(v, GRANT_KEYS)) return null;
    const kind = v["kind"], nexusAid = v["nexusAid"], epoch = v["epoch"], leaf = v["leaf"], lineage = v["lineage"];
    const survived = v["survived"], from = v["from"], sig = v["sig"];
    if (kind !== HOSTING_WALKER_GRANT_DOMAIN) return null;
    if (typeof nexusAid !== "string" || nexusAid.trim().length === 0) return null;
    if (typeof epoch !== "string" || !HEX_64.test(epoch) || typeof leaf !== "string" || !HEX_64.test(leaf)) return null;
    if (typeof lineage !== "string" || !HEX_64.test(lineage)) return null;
    if (typeof survived !== "number" || !Number.isSafeInteger(survived) || survived < 0) return null;
    if (from !== "host" && from !== "walker") return null;
    if (typeof sig !== "string" || !HEX_128.test(sig)) return null;
    return Object.freeze({ kind, nexusAid: normAid(nexusAid), epoch, leaf, lineage, survived, from, sig });
  } catch { return null; }
}

/** Copy a half out of a handed-in value, or null when the shape fails. */
function halfOf(v: unknown): GrantPublicHalf | null {
  try {
    if (!isRecord(v) || !exactKeys(v, HALF_KEYS)) return null;
    const nexusAid = v["nexusAid"], epoch = v["epoch"], grantKey = v["grantKey"];
    if (typeof nexusAid !== "string" || nexusAid.trim().length === 0) return null;
    if (typeof epoch !== "string" || !HEX_64.test(epoch) || typeof grantKey !== "string" || !acceptEd25519Key(grantKey).ok) return null;
    return Object.freeze({ nexusAid: normAid(nexusAid), epoch, grantKey });
  } catch { return null; }
}

/** The bytes a grant key signs for one grant. */
export function walkerGrantBytes(parts: Omit<WalkerGrant, "kind" | "sig">): Uint8Array {
  return canonicalJsonBytes({
    kind: HOSTING_WALKER_GRANT_DOMAIN, nexusAid: normAid(parts.nexusAid), epoch: parts.epoch.toLowerCase(),
    leaf: parts.leaf.toLowerCase(), lineage: parts.lineage.toLowerCase(), survived: parts.survived, from: parts.from,
  });
}

/** The public half a SERVING row keeps for one epoch — derived at the roll, by the tier that holds the hosting key. */
export function grantPublicHalf(epoch: DelegatedHostingEpoch): GrantPublicHalf {
  return Object.freeze({ nexusAid: normAid(epoch.act.nexusAid), epoch: epoch.cid, grantKey: epoch.grantKey });
}

/** Issue a grant at `epoch` — deterministic: the same fields in yield the same grant out. The minting tier alone. */
export async function issueWalkerGrant(epoch: DelegatedHostingEpoch, parts: {
  readonly leaf: string; readonly lineage: string; readonly survived: number; readonly from: "host" | "walker";
}): Promise<WalkerGrant> {
  // The walker's leaf enters a durable record HERE, so a leaf the Ed25519 door refuses earns no grant.
  const leaf = typeof parts.leaf === "string" ? parts.leaf.toLowerCase() : parts.leaf;
  const door = acceptEd25519Key(leaf);
  if (!door.ok) throw new Error(`walker-grant-leaf-refused — the walker leaf refuses at the Ed25519 door (${door.refusal})`);
  const fields = {
    nexusAid: normAid(epoch.act.nexusAid), epoch: epoch.cid, leaf, lineage: parts.lineage.toLowerCase(), survived: parts.survived, from: parts.from,
  };
  const sig = hex(await ed25519.signAsync(walkerGrantBytes(fields), epoch.grantSecret));
  const grant = grantOf({ kind: HOSTING_WALKER_GRANT_DOMAIN, ...fields, sig });
  if (grant === null) throw new Error("walker-grant-malformed — a lineage names 32 bytes of hex, and survived a whole count");
  return grant;
}

/** Renew a previous-epoch grant into `current`: the same lineage and class, one more epoch survived. Deterministic. */
export function renewWalkerGrant(current: DelegatedHostingEpoch, grant: WalkerGrant): Promise<WalkerGrant> {
  return issueWalkerGrant(current, { leaf: grant.leaf, lineage: grant.lineage, survived: grant.survived + 1, from: grant.from });
}

/** Read a grant under a serving row's public half. Pure; never throws. Hands back the frozen copy it read. */
export function readWalkerGrant(
  half: GrantPublicHalf, v: unknown, opts: { readonly revokedLeaves?: ReadonlySet<string> } = {},
): WalkerGrantReading {
  const held = halfOf(half);
  if (held === null) return { ok: false, refusal: "half-malformed" };
  const grant = grantOf(v);
  if (grant === null) return { ok: false, refusal: "grant-malformed" };
  if (grant.nexusAid !== held.nexusAid) return { ok: false, refusal: "grant-nexus-foreign" };
  if (grant.epoch !== held.epoch) return { ok: false, refusal: "grant-epoch-foreign" };
  if (!verifyEd25519(grant.sig, walkerGrantBytes(grant), held.grantKey)) return { ok: false, refusal: "grant-signature-refused" };
  if (opts.revokedLeaves?.has(grant.leaf)) return { ok: false, refusal: "grant-revoked" };
  return { ok: true, grant };
}

/** The same reading as a boolean. */
export function verifyWalkerGrant(half: GrantPublicHalf, v: unknown, opts: { readonly revokedLeaves?: ReadonlySet<string> } = {}): boolean {
  return readWalkerGrant(half, v, opts).ok;
}
