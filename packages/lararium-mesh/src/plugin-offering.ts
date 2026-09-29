/**
 * plugin-offering — one operator publishing their OWN collection for others to take.
 *
 * ── WHY NO STEWARD SET ───────────────────────────────────────────────────────────────────────────
 * `pluginsCid` folds THIS operator's collection: it layers on the required blobs, overturns nobody
 * else's reading, and moves with no ratchet act at all. Publishing it reads as a GIFT rather than a
 * governing act, and a taker settles it alone — the blobs fold to the declared region or they do not.
 * Nothing remains for a second hand to attest that the hash has not already settled, so the record
 * carries ONE signature and no steward set (operator ruling). Adding one would make a gift collective.
 *
 * ── THE VERIFY RECOMPUTES; A SIGNATURE ALONE PROVES THE WRONG THING ─────────────────────────────
 * A signature says "this offeror wrote these bytes". It does NOT say "these blobs fold to the region
 * these bytes declare" — and an offering that declared one region while carrying another's blobs would
 * hand a taker exactly the unattested claim the hash was supposed to retire. So the verify folds the
 * blobs itself, through the same `computePluginsCid` the genesis bake runs, and compares.
 *
 * ── WHAT IT IS NOT ──────────────────────────────────────────────────────────────────────────────
 * Not a kāhuli tier: the ratchets (`engineCid` · `grammarCid`) overturn what the MESH must agree on and
 * live at `nexus kahuli`. Not a roster: an offering names its offeror and nobody else, so no register of
 * who offers what accrues anywhere (the no-roster law the Lamplighters' resilience rests on).
 */

import * as ed25519 from "@noble/ed25519";
import { canonicalJsonBytes, hexToBytes, sha256HexBytesSync } from "./crypto.js";
import { computePluginsCid } from "./genesis-doc.js";
import { PLUGIN_OFFERING_DOMAIN } from "./domains.js";

/** One blob an offering carries — the same triple the genesis region folds over. */
export interface OfferedBlob {
  readonly id:      string;
  readonly version: string;
  readonly sha256:  string;
}

/** The signed record. Its field set IS the ruling: an offeror, a region, its blobs, one signature. */
export interface PluginOffering {
  readonly kind:       typeof PLUGIN_OFFERING_DOMAIN;
  /** The offeror's ed25519 verifying-key hex — a nym, never a roster seat. */
  readonly offeror:    string;
  /** The region this offering DECLARES. A taker recomputes it; the declaration never stands alone. */
  readonly pluginsCid: string;
  readonly blobs:      readonly OfferedBlob[];
  /** ONE signature. A gift carries no quorum. */
  readonly sig:        string;
}

/** Canonical descriptor order for both the signed preimage and the record CID. */
function canonicalOfferingBlobs(blobs: readonly OfferedBlob[]): OfferedBlob[] {
  return blobs
    .map((b) => ({ id: b.id, version: b.version, sha256: b.sha256 }))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1
      : a.version < b.version ? -1 : a.version > b.version ? 1
        : a.sha256 < b.sha256 ? -1 : a.sha256 > b.sha256 ? 1 : 0);
}

/** The signing preimage — offeror, declared region and blobs, canonically ordered. */
export function pluginOfferingBytes(parts: Omit<PluginOffering, "kind" | "sig">): Uint8Array {
  return canonicalJsonBytes({
    kind:       PLUGIN_OFFERING_DOMAIN,
    offeror:    parts.offeror,
    pluginsCid: parts.pluginsCid,
    blobs:      canonicalOfferingBlobs(parts.blobs),
  });
}

/** Exact immutable signed-record bytes used for content addressing and carriage. */
export function pluginOfferingRecordBytes(offering: PluginOffering): Uint8Array {
  return canonicalJsonBytes({
    kind:       PLUGIN_OFFERING_DOMAIN,
    offeror:    offering.offeror,
    pluginsCid: offering.pluginsCid,
    blobs:      canonicalOfferingBlobs(offering.blobs),
    sig:        offering.sig,
  });
}

/** Content CID for one complete signed offering record. The signature makes two offerors distinct. */
export function pluginOfferingCid(offering: PluginOffering): string {
  return `sha256:${sha256HexBytesSync(pluginOfferingRecordBytes(offering))}`;
}

/** Mint a signed offering. The caller supplies the signing hand; no seed reaches this module. */
export async function signPluginOffering(
  parts: Omit<PluginOffering, "kind" | "sig">,
  sign:  (bytes: Uint8Array) => Promise<string>,
): Promise<PluginOffering> {
  const canonical = {
    offeror: parts.offeror,
    pluginsCid: parts.pluginsCid,
    blobs: canonicalOfferingBlobs(parts.blobs),
  };
  const sig = await sign(pluginOfferingBytes(canonical));
  return { kind: PLUGIN_OFFERING_DOMAIN, ...canonical, sig };
}

export type OfferingVerdict = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** OfferedBlob follows the genesis/CAS convention: bare canonical lowercase SHA-256 hex. */
const OFFERED_BLOB_SHA256 = /^[0-9a-f]{64}$/;

/**
 * Verify an offering the way a TAKER must: the signature over its own bytes, AND the blobs folded back
 * to the declared region.
 *
 * FAIL-CLOSED in both halves. A wrong domain, a malformed key, a signature that does not verify, or a
 * region that does not match the fold each refuse — and the region check runs even when the signature
 * passes, because a valid signature over a mismatched body is precisely the interesting forgery.
 */
export async function verifyPluginOffering(offering: PluginOffering): Promise<OfferingVerdict> {
  if (offering?.kind !== PLUGIN_OFFERING_DOMAIN) return { ok: false, reason: "not a plugin offering" };
  if (
    typeof offering.offeror !== "string" || !/^[0-9a-f]{64}$/i.test(offering.offeror) ||
    typeof offering.pluginsCid !== "string" || offering.pluginsCid.length === 0 ||
    !Array.isArray(offering.blobs) || offering.blobs.some((b) =>
      !b || typeof b.id !== "string" || b.id.length === 0 ||
      typeof b.version !== "string" || b.version.length === 0 ||
      typeof b.sha256 !== "string" || !OFFERED_BLOB_SHA256.test(b.sha256)) ||
    typeof offering.sig !== "string" || !/^[0-9a-f]{128}$/i.test(offering.sig)
  ) return { ok: false, reason: "malformed plugin offering" };
  const ids = new Set<string>();
  for (const blob of offering.blobs) {
    if (ids.has(blob.id)) return { ok: false, reason: "malformed plugin offering" };
    ids.add(blob.id);
  }

  let sigOk = false;
  try {
    sigOk = await ed25519.verifyAsync(hexToBytes(offering.sig), pluginOfferingBytes(offering), hexToBytes(offering.offeror));
  } catch { sigOk = false; }                       // a malformed sig or key counts as no signature
  if (!sigOk) return { ok: false, reason: "the offeror's signature does not verify over these bytes" };

  // THE FOLD IS THE SECOND HAND. Same function the genesis bake runs, so an offering and a bake can never
  // disagree about what a collection folds to.
  const folded = computePluginsCid(offering.blobs);
  if (folded !== offering.pluginsCid) {
    return { ok: false, reason: `the blobs fold to ${folded}, not the declared region ${offering.pluginsCid}` };
  }
  return { ok: true };
}
