/**
 * offering-inspection — a platform-blind receiver evidence seam.
 *
 * This module answers one bounded question: "does this exact signed offering, named by this exact CID,
 * have its declared bytes in the receiver's local CAS?" The CAS reader is injected so NodeFS, OPFS, or
 * another vessel can compose the same logic. A missing byte is pending, a mismatched byte is corrupt,
 * and neither reading is silently promoted to adoption, grammar, or an Offering Antigen verdict.
 *
 * The seam carries no clock, version selection, remote resolver, list/currentness rule, install action,
 * or mutation capability. Its CID is the complete signed record identity; its byte statuses are local
 * observations only.
 */
import { sha256HexBytesSync } from "./crypto.js";
import { pluginOfferingCid, verifyPluginOffering, type OfferingVerdict, type PluginOffering } from "./plugin-offering.js";

export type OfferingInspectionStatus = "refused" | "inspectable" | "pending" | "corrupt";

export interface OfferingCasReader {
  /** Read exactly one locally-held CID. `null` means this vessel does not hold the bytes. */
  readonly read: (cid: string) => Uint8Array | null | Promise<Uint8Array | null>;
}

export interface OfferingInspectionOptions {
  readonly offeringCid: string;
  readonly offering: PluginOffering;
  readonly read: OfferingCasReader["read"];
}

export interface OfferingByteEvidence {
  readonly held: readonly string[];
  /** Declared bytes absent from this local CAS; absence is recoverable evidence, not refusal. */
  readonly pending: readonly string[];
  /** Bytes present under a declared CID but failing its content hash. */
  readonly corrupt: readonly string[];
}

export interface OfferingInspectionVerified {
  readonly ok: true;
  readonly offeror: string;
  readonly pluginsCid: string;
  readonly blobCount: number;
}

export interface OfferingInspectionRefused {
  readonly ok: false;
  readonly reason: string;
}

export type OfferingInspection = {
  readonly offeringCid: string;
  readonly status: OfferingInspectionStatus;
  readonly verification: OfferingInspectionVerified | OfferingInspectionRefused;
  readonly bytes: OfferingByteEvidence;
  /** Present only when the signed record itself refuses; no CAS read was attempted. */
  readonly reason?: string;
};

const EMPTY_BYTES: OfferingByteEvidence = { held: [], pending: [], corrupt: [] };

function validOfferingCid(cid: string): boolean {
  return /^sha256:[0-9a-f]{64}$/.test(cid);
}

function refusal(offeringCid: string, reason: string): OfferingInspection {
  return {
    offeringCid,
    status: "refused",
    verification: { ok: false, reason },
    bytes: EMPTY_BYTES,
    reason,
  };
}

/**
 * Inspect one exact signed offering against local CAS evidence.
 *
 * The function deliberately returns a result rather than throwing for semantic refusal or incomplete
 * bytes. A vessel adapter can choose its command exit policy while preserving the evidence distinction.
 */
export async function inspectPluginOffering(opts: OfferingInspectionOptions): Promise<OfferingInspection> {
  if (!validOfferingCid(opts.offeringCid)) return refusal(opts.offeringCid, "malformed offering CID");

  let recordCid: string;
  let verdict: OfferingVerdict;
  try {
    recordCid = pluginOfferingCid(opts.offering);
    verdict = await verifyPluginOffering(opts.offering);
  } catch {
    return refusal(opts.offeringCid, "malformed plugin offering");
  }
  if (recordCid !== opts.offeringCid) return refusal(opts.offeringCid, "offering content CID does not match the supplied record");
  if (!verdict.ok) return refusal(opts.offeringCid, verdict.reason);

  const held: string[] = [];
  const pending: string[] = [];
  const corrupt: string[] = [];
  for (const blob of opts.offering.blobs) {
    const bytes = await opts.read(blob.sha256);
    if (bytes === null) {
      pending.push(blob.sha256);
    } else if (sha256HexBytesSync(bytes) !== blob.sha256) {
      corrupt.push(blob.sha256);
    } else {
      held.push(blob.sha256);
    }
  }
  const status: OfferingInspectionStatus = corrupt.length > 0
    ? "corrupt"
    : pending.length > 0
      ? "pending"
      : "inspectable";
  return {
    offeringCid: opts.offeringCid,
    status,
    verification: {
      ok: true,
      offeror: opts.offering.offeror,
      pluginsCid: opts.offering.pluginsCid,
      blobCount: opts.offering.blobs.length,
    },
    bytes: { held, pending, corrupt },
  };
}
