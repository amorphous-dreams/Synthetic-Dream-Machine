/**
 * oracle-substrate — the read-only PUBLIC substrate: a content-addressed snapshot
 * (the floor) + a signed causal pointer (the ratchet face).
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/lararium-identity#the-oracle-plane
 * (the Two-Faced Substrate). The read face serves the oracle doc as
 * an IMMUTABLE blob — `Automerge.save(doc)` bytes named by their content hash — so
 * write-refusal needs no check: a hash-named blob holds no mutable surface, no sync
 * session, no inbound frame to refuse. The thin signed pointer carries currency:
 * a reader verifies semantic act identity and causal ancestry locally (no global now).
 * Real-time streaming (Hypercore, read-only by keypair) rides ABOVE this floor as the
 * named end-goal — deferred.
 *
 * This module is the PURE core (isomorphic, no I/O): export a snapshot, build/sign a
 * pointer, and run the reader rule. Hardened like device-delegation — it NEVER throws
 * on untrusted input; `verifyOraclePointer` returns a verdict, never an exception.
 * Wiring (serve the blob over the node's HTTP server, publish the pointer on the
 * existing channel) rides a separate, node-side module.
 */

import { ORACLE_POINTER_DOMAIN } from "./domains.js";
import * as ed25519 from "@noble/ed25519";
import { save, getHeads, type Doc } from "@automerge/automerge";
import { hex, hexToBytes, sha256Hex, utf8Bytes, defaultCryptoProvider, type DigestProvider } from "./crypto.js";

export { ORACLE_POINTER_DOMAIN } from "./domains.js";
const HEX64_RE = /^[0-9a-f]{64}$/;   // sha256 hex / ed25519 verifying-key hex / automerge head
const SIG_RE   = /^[0-9a-f]{128}$/;  // 64-byte ed25519 signature hex

function canonicalHeads(heads: readonly string[]): string[] {
  return [...new Set(heads)].sort();
}

/** A point-in-time export of the oracle doc — the immutable read-face artifact. */
export interface OracleSnapshot {
  /** sha256(bytes) hex — THE content address; the reader rehashes to verify. */
  readonly cid:   string;
  /** Automerge heads of the doc at export — the local document frontier. */
  readonly heads: readonly string[];
  /** `Automerge.save(doc)` output — the whole doc, history included. */
  readonly bytes: Uint8Array;
}

/** The signed causal pointer to a snapshot. */
export interface OraclePointer {
  readonly cid:     string;             // content address of the current snapshot
  readonly heads:   readonly string[];  // its automerge heads
  readonly actCid:  string;             // semantic identity, excluding signature
  readonly parents: readonly string[];  // causal pointer identities
  readonly pub:     string;             // signer verifying-key hex (self-describing)
  readonly sig:     string;             // ed25519 sig over the canonical signing string
}

/** Export the oracle doc as a content-addressed snapshot (the read-face artifact). */
export async function exportOracleSnapshot<T>(
  doc: Doc<T>,
  provider: DigestProvider = defaultCryptoProvider,
): Promise<OracleSnapshot> {
  const bytes = save(doc);
  const cid   = await sha256Hex(bytes, provider);
  const heads = canonicalHeads(getHeads(doc) as string[]);
  return { cid, heads, bytes };
}

/** A downloaded blob is the named snapshot iff its hash matches the cid. */
export async function verifyOracleSnapshotBytes(
  bytes: Uint8Array,
  cid: string,
  provider: DigestProvider = defaultCryptoProvider,
): Promise<boolean> {
  if (!HEX64_RE.test(cid)) return false;
  return (await sha256Hex(bytes, provider)) === cid;
}

/**
 * The pointer's IDENTITY string — the content and causal fields, excluding only the
 * signature. Domain+schema tagged, `|`-delimited, every
 * field strict-charset so no separator can shift a boundary (device-delegation pattern).
 */
function pointerIdentityString(p: Pick<OraclePointer, "cid" | "heads" | "actCid" | "parents" | "pub">): string {
  return [
    ORACLE_POINTER_DOMAIN,
    p.cid,
    p.heads.join(","),
    p.actCid,
    [...new Set(p.parents)].sort().join(","),
    p.pub,
  ].join("|");
}

/**
 * The SIGNED string — the identity itself; the signature covers every pointer field
 * except the signature.
 */
function pointerSigningString(p: Omit<OraclePointer, "sig">): string {
  return pointerIdentityString(p);
}

/**
 * The pointer's stable semantic id. A changed content or causal field changes it.
 */
export async function oraclePointerId(
  p: OraclePointer,
  provider: DigestProvider = defaultCryptoProvider,
): Promise<string> {
  void provider;
  return p.actCid;
}

/** Build + sign a pointer. Parent sets are canonicalized; no scalar sequence is minted. */
export async function buildOraclePointer(args: {
  readonly snapshot: OracleSnapshot;
  readonly parents:  readonly string[];
  /** 32-byte ed25519 seed (the publisher's signing key — operator/node). */
  readonly signerSeed: Uint8Array;
}): Promise<OraclePointer> {
  const pub    = hex(await ed25519.getPublicKeyAsync(args.signerSeed));
  const base = {
    cid:     args.snapshot.cid,
    heads:   canonicalHeads(args.snapshot.heads),
    parents: [...new Set(args.parents)].sort(),
    pub,
  };
  const actCid = await sha256Hex(utf8Bytes(pointerIdentityString({ ...base, actCid: "" })), defaultCryptoProvider);
  const fields: Omit<OraclePointer, "sig"> = { ...base, actCid };
  const sig = hex(await ed25519.signAsync(utf8Bytes(pointerSigningString(fields)), args.signerSeed));
  return { ...fields, sig };
}

export interface PointerVerdict {
  readonly ok:     boolean;
  readonly reason?: string;
}

/**
 * The reader rule — never throws. Pass what the reader remembers:
 *   - `verifyingKey`: pin the publisher; reject a pointer signed by anyone else.
 *   - `knownPointerIds`: locally held causal ancestors; missing parents are unavailable.
 *   - concurrent heads are surfaced by `foldOraclePointerVerdict`, never ordered by arrival.
 *     local observation/liveness policy stays outside this safety verdict.
 */
export async function verifyOraclePointer(
  p: OraclePointer,
  opts: {
    readonly verifyingKey?:     string;
    readonly knownPointerIds?: readonly string[];
  } = {},
): Promise<PointerVerdict> {
  // Shape — reject malformed input without throwing.
  if (!p || typeof p !== "object")                              return { ok: false, reason: "malformed pointer" };
  if (!HEX64_RE.test(p.cid))                                    return { ok: false, reason: "bad cid" };
  if (!HEX64_RE.test(p.pub))                                    return { ok: false, reason: "bad pub" };
  if (!SIG_RE.test(p.sig))                                      return { ok: false, reason: "bad sig format" };
  if (!HEX64_RE.test(p.actCid))                                return { ok: false, reason: "bad act cid" };
  if (!Array.isArray(p.parents) || !p.parents.every((h) => HEX64_RE.test(h))) return { ok: false, reason: "bad parents" };
  const canonicalParents = [...new Set(p.parents)].sort();
  if (canonicalParents.length !== p.parents.length || canonicalParents.some((parent, i) => parent !== p.parents[i]))
    return { ok: false, reason: "rejected non-canonical parents" };
  if (!Array.isArray(p.heads) || !p.heads.every((h) => HEX64_RE.test(h)))
    return { ok: false, reason: "bad heads" };
  const canonical = canonicalHeads(p.heads);
  if (canonical.length !== p.heads.length || canonical.some((head, i) => head !== p.heads[i]))
    return { ok: false, reason: "rejected non-canonical heads" };

  // Pinned publisher.
  if (opts.verifyingKey !== undefined && p.pub !== opts.verifyingKey)
    return { ok: false, reason: "unpinned publisher" };

  const derived = await sha256Hex(utf8Bytes(pointerIdentityString({ ...p, actCid: "" })), defaultCryptoProvider);
  if (p.actCid !== derived) return { ok: false, reason: "rejected semantic act cid" };

  // Signature.
  let sigOk = false;
  try {
    sigOk = await ed25519.verifyAsync(
      hexToBytes(p.sig), utf8Bytes(pointerSigningString(p)), hexToBytes(p.pub),
    );
  } catch { sigOk = false; }
  if (!sigOk) return { ok: false, reason: "signature verify failed" };

  if (opts.knownPointerIds && p.parents.some((parent) => !opts.knownPointerIds!.includes(parent)))
    return { ok: false, reason: "unavailable (missing causal parent)" };

  return { ok: true };
}

export type OraclePointerVerdict = "held" | "unsettled" | "unavailable" | "rejected";

/** Fold locally verified pointers; concurrent heads never choose by arrival order. */
export async function foldOraclePointerVerdict(
  pointers: readonly OraclePointer[], opts: { readonly verifyingKey?: string } = {},
): Promise<OraclePointerVerdict> {
  const ids = new Set(pointers.map((p) => p.actCid));
  let admissible: OraclePointer[] = [];
  let rejected = false;
  let unavailable = false;
  for (const p of pointers) {
    const v = await verifyOraclePointer(p, { ...(opts.verifyingKey ? { verifyingKey: opts.verifyingKey } : {}), knownPointerIds: [...ids] });
    if (!v.ok) {
      if (v.reason?.includes("unavailable")) unavailable = true;
      else rejected = true;
      continue;
    }
    admissible.push(p);
  }
  // A locally present immediate parent is insufficient when its own ancestry is
  // absent.  Close the admissible set to a fixed point before computing heads.
  for (;;) {
    const closedIds = new Set(admissible.map((p) => p.actCid));
    const closed = admissible.filter((p) => p.parents.every((parent) => closedIds.has(parent)));
    if (closed.length === admissible.length) break;
    admissible = closed;
  }
  // Inspect every record before deciding: rejection has precedence over
  // unavailable evidence so a forged record cannot disappear behind a gap.
  if (rejected) return "rejected";
  if (unavailable) return "unavailable";
  if (admissible.length !== pointers.length) return "unavailable";
  const covered = new Set(admissible.flatMap((p) => p.parents));
  const heads = admissible.filter((p) => !covered.has(p.actCid));
  if (!heads.length) return "unavailable";
  return heads.length > 1 ? "unsettled" : "held";
}
