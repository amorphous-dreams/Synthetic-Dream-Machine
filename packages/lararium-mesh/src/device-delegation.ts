/**
 * device-delegation — the signed capability edge that binds a vessel to its operator.
 *
 * Under capability-is-identity (lar:///ha.ka.ba/lares/api/pono/lararium-identity
 * #capability-and-petnames), the DELEGATION EDGE *is* the relationship and the capability:
 * the operator root signs "Operator O delegates to Device D at place P", and any peer
 * verifies it offline against a PINNED operator root (CAPABILITY-LAYER, Plane 0→1).
 *
 * The edge is a STANDING MEMBERSHIP grant (long-lived, revocable), NOT a per-use proof:
 * per-use replay defense (nonce + short exp + seen-cache) rides a separate INVOCATION
 * (the UCAN delegation/invocation split) — a follow-on, not this module. Revocation rides
 * the CRDT membership graph (observed-remove — the PRIMARY targeted revoke). NON-renewal
 * rides the `boundEpoch` LEASE below: the grant names a per-resource max-register epoch and
 * goes stale when that epoch rolls past it (coordinator-free; the epoch is a LEASE, not a
 * targeted revoker — api/pono/convergent-mesh).
 *
 * Canonical signed string (opens on `DEVICE_DELEGATION_DOMAIN` for separation — a FROZEN
 * registry name, read whole: its `/v1` tail names nothing and no successor will exist;
 * every field strict-charset so no `|` can shift a boundary):
 *   {DEVICE_DELEGATION_DOMAIN}|{personaRootDid}|{deviceDid}|{deviceVerifyingKey}|{hearthTrueName}|{boundEpoch}
 *
 * NO CLOCK rides the edge — no issue instant, no expiry. It decays by its LEASE alone (`boundEpoch`
 * against the resource's max-register epoch) and is withdrawn by the membership graph; a wall-clock
 * window would make an unreliable narrator a party to the grant. Two mints of one binding at one
 * lease are the same bytes.
 *
 * Trust rides the SIGNATURE + the PINNED root, never a doc's write-ACL (confused-deputy
 * guard). Hardened against untrusted input: never throws on
 * untrusted input · mandatory operator-root pin · lease epoch · canonical lowercase DIDs
 * · strict ZIP215-off verify · domain separation. Reuses the mesh's bare-Ed25519
 * surface (@noble/ed25519 v3 + ./crypto hex).
 */

import { DEVICE_DELEGATION_DOMAIN } from "./domains.js";
import * as ed25519 from "@noble/ed25519";
import { hex, hexToBytes } from "./crypto.js";
import { LAR_DID_RE as DID_RE, didFromVerifyingKey, verifyingKeyFromDid, type LarDid } from "./lar-did.js";
import type { AuthorityEvidenceVerdict } from "./authority-verdict.js";

export { DEVICE_DELEGATION_DOMAIN } from "./domains.js";
const VK_RE   = /^[0-9a-f]{64}$/;          // raw 32-byte verifying-key hex, lowercase
const SIG_RE  = /^[0-9a-f]{128}$/;         // 64-byte Ed25519 signature hex, lowercase
const TRUE_NAME_RE = /^[A-Za-z0-9._:/@-]*$/;   // CID / lar:-name safe; no `|`, no whitespace; "" allowed (place-agnostic)
const EPOCH_RE = /^\d{1,15}$/;             // decimal lease epoch; 1-15 digits, bounded < Number.MAX_SAFE_INTEGER

export interface DeviceDelegationTiddler {
  readonly kind:                "device-delegation";
  /** "0x"+hex — the operator root that SIGNED this edge; the verifier checks against it AND the pin. */
  readonly personaRootDid:         LarDid;
  /** "0x"+hex — the delegate vessel (MUST equal "0x"+deviceVerifyingKey). */
  readonly deviceDid:           LarDid;
  /** raw 32-byte Ed25519 verifying-key hex (64, lowercase) of the delegate vessel. */
  readonly deviceVerifyingKey:  string;
  /** the hearth true-name this edge binds the vessel TO — the engine blob's public True Name
   *  (the genesis engineCid), or "" if hearth-agnostic. The binding IS (vessel × hearthTrueName). */
  readonly hearthTrueName:             string;
  /** the LEASE epoch this grant binds to — a per-resource max-register value (1-15 decimal digits).
   *  The grant goes stale when the resource's epoch rolls past it (non-renewal). The epoch is a
   *  LEASE, never a targeted revoker (targeted revoke rides the Keyhive membership graph). */
  readonly boundEpoch:          string;
  /** Ed25519 signature hex (128) over the canonical proof string, by the operator root. */
  readonly signature:           string;
}

export type DeviceDelegationEvidence = AuthorityEvidenceVerdict<"device-face-delegation">;


type ProofFields = Pick<
  DeviceDelegationTiddler,
  "personaRootDid" | "deviceDid" | "deviceVerifyingKey" | "hearthTrueName" | "boundEpoch"
>;

function delegationProofBytes(d: ProofFields): Uint8Array {
  return new TextEncoder().encode(
    `${DEVICE_DELEGATION_DOMAIN}|${d.personaRootDid}|${d.deviceDid}|${d.deviceVerifyingKey}|${d.hearthTrueName}|${d.boundEpoch}`,
  );
}

/**
 * Field hygiene shared by build (throws — controlled minter) and verify (returns reason —
 * untrusted CRDT input). Strict-charset on EVERY field closes delimiter injection entirely
 * (no field can carry `|`) and honors verify's "never throws" contract via typeof guards.
 */
function fieldError(d: Partial<DeviceDelegationTiddler>): string | null {
  if (d.kind !== "device-delegation")                            return "not a device-delegation";
  if (typeof d.personaRootDid !== "string" || !DID_RE.test(d.personaRootDid))                 return "personaRootDid not 0x+32-byte lowercase hex";
  if (typeof d.deviceVerifyingKey !== "string" || !VK_RE.test(d.deviceVerifyingKey))    return "deviceVerifyingKey not 32-byte lowercase hex";
  if (typeof d.deviceDid !== "string" || d.deviceDid !== didFromVerifyingKey(d.deviceVerifyingKey)) return "deviceDid not bound to deviceVerifyingKey";
  if (typeof d.hearthTrueName !== "string" || !TRUE_NAME_RE.test(d.hearthTrueName))                       return "hearthTrueName has illegal characters";
  if (typeof d.boundEpoch !== "string" || !EPOCH_RE.test(d.boundEpoch))                 return "boundEpoch not a 1-15 digit decimal";
  if (typeof d.signature !== "string" || !SIG_RE.test(d.signature))                     return "signature not 64-byte lowercase hex";
  return null;
}

/**
 * Mint a signed device-delegation edge. The PERSONA ROOT's 32-byte seed signs, and personaRootDid
 * derives from that same seed (self-attribution) — the group's key, never the device's. `hearthTrueName` and
 * `boundEpoch` are caller-supplied (pure, no clock). Throws on malformed inputs — it is the
 * controlled minter, never fed untrusted data.
 */
export async function buildDeviceDelegation(args: {
  personaRootSeed:    Uint8Array; // the PERSONA ROOT's 32-byte Ed25519 seed — the HUMAN's side, and the signer
  deviceVerifyingKey: string;     // raw Ed25519 verifying-key hex (64, lowercase) of the delegate
  hearthTrueName:            string;     // hearth true-name (genesis CID), or "" if place-agnostic
  boundEpoch:         number;     // the per-resource lease epoch this grant binds to (non-negative integer)
}): Promise<DeviceDelegationTiddler> {
  const personaRootDid = didFromVerifyingKey(hex(await ed25519.getPublicKeyAsync(args.personaRootSeed)));
  const fields: ProofFields = {
    personaRootDid,
    deviceDid:          didFromVerifyingKey(args.deviceVerifyingKey),
    deviceVerifyingKey: args.deviceVerifyingKey,
    hearthTrueName:            args.hearthTrueName,
    boundEpoch:         String(args.boundEpoch),
  };
  const candidate = { kind: "device-delegation" as const, ...fields, signature: "0".repeat(128) };
  const err = fieldError(candidate);
  if (err) throw new Error(`[device-delegation] cannot mint: ${err}`);
  const signature = hex(await ed25519.signAsync(delegationProofBytes(fields), args.personaRootSeed));
  return { ...candidate, signature };
}

/**
 * Verify a device-delegation edge offline. NEVER throws on bad input (returns {ok,reason}).
 *
 * MANDATORY PIN: `expectedOperatorDid` is the trusted operator root the edge MUST chain to.
 * A clear result proves the edge was signed by THAT root for THIS delegate — designation
 * carries authority, no ambient fallback. (verify proving only "someone signed" was the
 * confused-deputy bait the verification swarm flagged; the pin is now a required argument.)
 *
 * Lease: pass `opts.expectedEpoch` (the resource's current max-register epoch) to enforce
 * non-renewal; omit it to check signature + pin alone. Strict RFC8032 verify
 * (`zip215:false`) → strongly-binding signatures (exclusive ownership; safe to key dedup on
 * canonical content, never on the malleable signature bytes).
 */
export async function verifyDeviceDelegation(
  edge: DeviceDelegationTiddler,
  expectedOperatorDid: string,
  opts?: { expectedEpoch?: number },
): Promise<{ ok: boolean; reason?: string }> {
  const evidence = await evaluateDeviceDelegation(edge, expectedOperatorDid, opts);
  return evidence.cryptographicallyValid
    ? { ok: true }
    : { ok: false, ...(evidence.reason ? { reason: evidence.reason } : {}) };
}

/**
 * Read the device edge with an explicit relation-scoped evidence state.
 *
 * `expectedEpoch` is the authority witness. When it is absent, a valid
 * signature is still reported as cryptographically valid, but the evidence is
 * `unavailable`; callers that mutate authority must choose a named local
 * refusal or pending path rather than treating omission as a current lease.
 * The legacy `verifyDeviceDelegation` wrapper remains signature-compatible.
 */
export async function evaluateDeviceDelegation(
  edge: DeviceDelegationTiddler,
  expectedOperatorDid: string,
  opts?: { expectedEpoch?: number },
): Promise<DeviceDelegationEvidence> {
  const verdict = (state: DeviceDelegationEvidence["state"], cryptographicallyValid: boolean, reason?: string): DeviceDelegationEvidence => ({
    relation: "device-face-delegation",
    state,
    cryptographicallyValid,
    ...(reason ? { reason } : {}),
  });
  const err = fieldError(edge);
  if (err) return verdict("malformed", false, err);

  // PIN — the edge's operator MUST be the trusted root (compare canonical key bytes).
  if (typeof expectedOperatorDid !== "string" || !DID_RE.test(expectedOperatorDid)) {
    return verdict("malformed", false, "expectedOperatorDid not 0x+32-byte lowercase hex");
  }
  if (edge.personaRootDid !== expectedOperatorDid) {
    return verdict("rejected", false, "operator is not the pinned root");
  }

  // Lease (non-renewal) — the epoch the grant binds to must not have rolled past. OPTIONAL:
  // pass expectedEpoch (the resource's current max-register epoch the verifier holds) to enforce
  // the lease; omit to check signature + pin alone. The epoch is the edge's only decay.
  // Targeted revocation rides the Keyhive membership graph, never this counter.
  if (opts?.expectedEpoch !== undefined) {
    const bound = Number(edge.boundEpoch);
    if (!Number.isFinite(bound))        return verdict("malformed", false, "unparseable boundEpoch");
    if (bound < opts.expectedEpoch)     return verdict("stale", false, "delegation lease stale (resource epoch rolled past boundEpoch)");
  }

  try {
    const ok = await ed25519.verifyAsync(
      hexToBytes(edge.signature),
      delegationProofBytes(edge),
      hexToBytes(verifyingKeyFromDid(edge.personaRootDid)),
      { zip215: false },
    );
    if (!ok) return verdict("rejected", false, "signature mismatch");
    return opts?.expectedEpoch === undefined
      ? verdict("unavailable", true, "current resource epoch unavailable")
      : verdict("checked-valid", true);
  } catch (e) {
    return verdict("malformed", false, e instanceof Error ? e.message : "ed25519 verify threw");
  }
}
