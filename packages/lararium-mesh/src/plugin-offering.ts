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

/**
 * PUBLISHER PROVENANCE — the claim this Nexus makes about where a blob's bytes came from, carried
 * INSIDE the signed preimage (the offerings handoff's "Signed region: ... per plugin, provenance").
 *
 * TWO RELATIONS, NEVER FUSED (offerings-handoff.md "Who signs"):
 *   - PUBLISHER: this Nexus signs that it offers exactly these bytes, fetched from `source` at the
 *     immutable `commit`. That is everything the offeror's signature actually attests.
 *   - AUTHORSHIP: `author`, when present, is carried as a bare CLAIM inside that attestation —
 *     "Saq Imtiaz wrote Streams" — never the author's own signature. If the author ever signs, that
 *     rides as a SEPARATE relation and a separate signature; this field never stands in for it.
 *
 * `dependents` names other blob ids THIS offering must carry alongside this one (the "offered only as
 * complete pairs" rule — dynannotate+dynaview, xlsx-utils+jszip): a offering that declares a dependent
 * but omits it refuses as `unmet-dependents`, never silently drops the pairing.
 *
 * `runtimes`, when present, narrows where the blob runs; absent = both. A value outside the closed set
 * refuses as `unsupported-runtime` rather than silently passing an opaque tag through to a vessel that
 * cannot act on it.
 */
export interface PluginProvenance {
  /** The upstream source this Nexus fetched from (a URL, never a roster entry). */
  readonly source:   string;
  /** The IMMUTABLE upstream commit the bytes came from — never a tag, never "latest". */
  readonly commit:   string;
  /** The artifact's path within that commit. */
  readonly path:     string;
  /** An SPDX-style licence identifier (e.g. "BSD-3-Clause", "MIT"). */
  readonly licence:  string;
  /** AUTHORSHIP AS A CLAIM — never this offeror's own attestation standing in for the author's. */
  readonly author?:  string;
  /** Other blob ids this offering must also carry (the complete-pairs rule). */
  readonly dependents?: readonly string[];
  /** Where this blob runs; absent = both. A tag outside {"node","browser"} refuses. */
  readonly runtimes?: readonly PluginRuntime[];
}

/** The closed set of runtimes a provenance block may name. */
export const PLUGIN_RUNTIMES = ["node", "browser"] as const;
export type PluginRuntime = typeof PLUGIN_RUNTIMES[number];

/** One blob an offering carries — the genesis-region triple plus the PUBLISHER's provenance claim. */
export interface OfferedBlob {
  readonly id:         string;
  readonly version:    string;
  readonly sha256:     string;
  /** Present on a provenance-bearing offering (R2a); absent on a bare genesis-style blob descriptor. */
  readonly provenance?: PluginProvenance;
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

/** Canonical provenance field order — stable under re-serialization, with array claims sorted so the
 *  preimage never moves for writing the same set in a different order. */
function canonicalProvenance(p: PluginProvenance): PluginProvenance {
  return {
    source:  p.source,
    commit:  p.commit,
    path:    p.path,
    licence: p.licence,
    ...(p.author !== undefined ? { author: p.author } : {}),
    ...(p.dependents ? { dependents: [...p.dependents].sort() } : {}),
    ...(p.runtimes ? { runtimes: [...p.runtimes].sort() } : {}),
  };
}

/** Canonical descriptor order for both the signed preimage and the record CID. */
function canonicalOfferingBlobs(blobs: readonly OfferedBlob[]): OfferedBlob[] {
  return blobs
    .map((b) => ({
      id: b.id, version: b.version, sha256: b.sha256,
      ...(b.provenance ? { provenance: canonicalProvenance(b.provenance) } : {}),
    }))
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

/**
 * NAMED FAILURE CODES — offerings-handoff.md R2a: "verify names each failure distinctly", so a caller
 * can switch on `code` instead of pattern-matching free text. `reason` stays as the human-legible detail.
 *
 * NOT ALL NINE NAMES IN THE HANDOFF LIVE HERE. `cid-mismatch` belongs to the SELECTOR
 * (`plugin-offering-selector.ts`): it compares a CALLER-NAMED cid against this offering's own content
 * CID, and this module — reasoning about one offering in isolation — holds no caller-named cid to
 * compare against. `missing-bytes` and `corrupt-bytes` belong to the CAS-reading layer R3 wires: this
 * module and the selector carry signed DESCRIPTORS, never raw bytes, by design (an explicit ownership
 * boundary this iteration, not an oversight — see plugin-offering-selector.ts's docblock).
 */
export type OfferingFailureCode =
  | "malformed"
  | "duplicate-plugin"
  | "malformed-provenance"
  | "unmet-dependents"
  | "unsupported-runtime"
  | "bad-signature"
  | "fold-mismatch";

export type OfferingVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: OfferingFailureCode; readonly reason: string };

/** OfferedBlob follows the genesis/CAS convention: bare canonical lowercase SHA-256 hex. */
const OFFERED_BLOB_SHA256 = /^[0-9a-f]{64}$/;

/** An SPDX-style identifier: a plain token, never free prose (so a licence field can't carry a claim
 *  of its own that nothing here checks). */
const LICENCE_ID = /^[A-Za-z0-9][A-Za-z0-9.+-]*$/;

function provenanceMalformed(p: PluginProvenance | undefined): boolean {
  if (p === undefined) return false;
  return (
    typeof p.source !== "string" || p.source.length === 0 ||
    typeof p.commit !== "string" || p.commit.length === 0 ||
    typeof p.path !== "string" || p.path.length === 0 ||
    typeof p.licence !== "string" || !LICENCE_ID.test(p.licence) ||
    (p.author !== undefined && (typeof p.author !== "string" || p.author.length === 0)) ||
    (p.dependents !== undefined && (!Array.isArray(p.dependents) || p.dependents.some((d) => typeof d !== "string" || d.length === 0))) ||
    (p.runtimes !== undefined && (!Array.isArray(p.runtimes) || p.runtimes.length === 0))
  );
}

/**
 * Verify an offering the way a TAKER must: the shape (incl. any provenance block), the signature over
 * its own bytes, AND the blobs folded back to the declared region.
 *
 * FAIL-CLOSED throughout, cheapest/pure checks first. A wrong domain, a malformed key, a malformed or
 * incomplete provenance claim, an unmet dependent pairing, an unsupported runtime tag, a signature that
 * does not verify, or a region that does not match the fold each refuse with their OWN named code — and
 * the fold check runs even when the signature passes, because a valid signature over a mismatched body
 * is precisely the interesting forgery the fold recomputation exists to catch.
 */
export async function verifyPluginOffering(offering: PluginOffering): Promise<OfferingVerdict> {
  if (offering?.kind !== PLUGIN_OFFERING_DOMAIN) return { ok: false, code: "malformed", reason: "not a plugin offering" };
  if (
    typeof offering.offeror !== "string" || !/^[0-9a-f]{64}$/i.test(offering.offeror) ||
    typeof offering.pluginsCid !== "string" || offering.pluginsCid.length === 0 ||
    !Array.isArray(offering.blobs) || offering.blobs.some((b) =>
      !b || typeof b.id !== "string" || b.id.length === 0 ||
      typeof b.version !== "string" || b.version.length === 0 ||
      typeof b.sha256 !== "string" || !OFFERED_BLOB_SHA256.test(b.sha256)) ||
    typeof offering.sig !== "string" || !/^[0-9a-f]{128}$/i.test(offering.sig)
  ) return { ok: false, code: "malformed", reason: "malformed plugin offering" };

  const ids = new Set<string>();
  for (const blob of offering.blobs) {
    if (ids.has(blob.id)) return { ok: false, code: "duplicate-plugin", reason: `blob id ${blob.id} appears twice in one offering` };
    ids.add(blob.id);
  }

  for (const blob of offering.blobs) {
    if (provenanceMalformed(blob.provenance)) {
      return { ok: false, code: "malformed-provenance", reason: `blob ${blob.id} carries a malformed provenance claim` };
    }
  }

  // UNMET DEPENDENTS — "offered only as complete pairs" (offerings-handoff.md): a blob that names a
  // dependent must carry it IN THIS SAME OFFERING. A half-pair never reads as a successful selection.
  for (const blob of offering.blobs) {
    for (const dep of blob.provenance?.dependents ?? []) {
      if (!ids.has(dep)) {
        return { ok: false, code: "unmet-dependents", reason: `blob ${blob.id} declares dependent ${dep}, which this offering does not carry` };
      }
    }
  }

  // UNSUPPORTED RUNTIME — a tag outside the closed set names nothing a vessel can act on.
  for (const blob of offering.blobs) {
    for (const runtime of blob.provenance?.runtimes ?? []) {
      if (!(PLUGIN_RUNTIMES as readonly string[]).includes(runtime)) {
        return { ok: false, code: "unsupported-runtime", reason: `blob ${blob.id} names unsupported runtime "${runtime}"` };
      }
    }
  }

  let sigOk = false;
  try {
    sigOk = await ed25519.verifyAsync(hexToBytes(offering.sig), pluginOfferingBytes(offering), hexToBytes(offering.offeror));
  } catch { sigOk = false; }                       // a malformed sig or key counts as no signature
  if (!sigOk) return { ok: false, code: "bad-signature", reason: "the offeror's signature does not verify over these bytes" };

  // THE FOLD IS THE SECOND HAND. Same function the genesis bake runs, so an offering and a bake can never
  // disagree about what a collection folds to.
  const folded = computePluginsCid(offering.blobs);
  if (folded !== offering.pluginsCid) {
    return { ok: false, code: "fold-mismatch", reason: `the blobs fold to ${folded}, not the declared region ${offering.pluginsCid}` };
  }
  return { ok: true };
}
