/** A face atom answers the holder's per-port challenge without handing the holder a key. */
import { HOLDER_SESSION_DOMAIN } from "./domains.js";
import { verifyDeviceDelegation, type DeviceDelegationTiddler } from "./device-delegation.js";
import { verifyEd25519 } from "./ed25519-door.js";

export { HOLDER_SESSION_DOMAIN } from "./domains.js";

export interface HolderSessionProofFields {
  readonly ownerEpoch: string;
  readonly sessionId: string;
  readonly nonce: string;
  readonly personaGroup: string;
}

export type HolderSessionProofReading =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "session-open-malformed" | "session-edge-invalid" | "session-proof-invalid" };

const FIELD = /^[^|\x00-\x1f\x7f]+$/u;
const NONCE = /^(?:[0-9a-f]{2})+$/;

function fieldsStand(fields: HolderSessionProofFields): boolean {
  return typeof fields.ownerEpoch === "string" && FIELD.test(fields.ownerEpoch)
    && typeof fields.sessionId === "string" && FIELD.test(fields.sessionId)
    && typeof fields.nonce === "string" && NONCE.test(fields.nonce)
    && typeof fields.personaGroup === "string" && FIELD.test(fields.personaGroup);
}

/** The exact signed image: domain|ownerEpoch|sessionId|nonce|personaGroup, UTF-8. */
export function holderSessionProofBytes(fields: HolderSessionProofFields): Uint8Array {
  if (!fieldsStand(fields)) throw new Error("holder-session-proof: malformed field");
  return new TextEncoder().encode(
    `${HOLDER_SESSION_DOMAIN}|${fields.ownerEpoch}|${fields.sessionId}|${fields.nonce}|${fields.personaGroup}`,
  );
}

/** The tab signs with its face atom; the holder receives only the signature and public edge. */
export function signHolderSessionProof(
  atom: { sign(bytes: Uint8Array): Promise<string> | string },
  fields: HolderSessionProofFields,
): Promise<string> {
  return Promise.resolve(atom.sign(holderSessionProofBytes(fields)));
}

/** Check the whole edge, then the challenge signature under that edge's atom key. Never throws. */
export async function verifyHolderSessionProof(args: {
  readonly edge: DeviceDelegationTiddler;
  readonly signature: string;
  readonly fields: HolderSessionProofFields;
}): Promise<HolderSessionProofReading> {
  try {
    const bytes = holderSessionProofBytes(args.fields);
    if (!args.edge || typeof args.edge.personaRootDid !== "string") return { ok: false, reason: "session-edge-invalid" };
    const edge = await verifyDeviceDelegation(args.edge, args.edge.personaRootDid);
    if (!edge.ok) return { ok: false, reason: "session-edge-invalid" };
    return verifyEd25519(args.signature, bytes, args.edge.deviceVerifyingKey)
      ? { ok: true }
      : { ok: false, reason: "session-proof-invalid" };
  } catch {
    return { ok: false, reason: "session-open-malformed" };
  }
}
