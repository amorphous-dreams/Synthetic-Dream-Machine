/**
 * lease-advance — a PersonaGroup's lease epoch as SIGNED per-writer slots.
 *
 * A face's lease folds signed per-writer slots to a verified maximum. Nexus and realm resources use
 * signed charter-quorum advances (`quorum-lease.ts`). For a face, a slot counts only when it carries
 * the writer's own signature over `{kind, resource, writer, epoch}` and the writer's key stands in
 * the face's roster. An unsigned slot, a slot
 * signed by a stranger, a slot naming another resource, and a deleted slot each raise nothing; the sealed anchor's
 * frontier keeps what a verified read already saw. The per-writer shape stays, so two writers rolling at once never
 * fork: each lands in its own slot and the max climbs.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/research/identity-invariants-2026
 */

import { canonicalJsonBytes } from "./crypto.js";
import { LEASE_ADVANCE_DOMAIN } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";

export interface LeaseAdvanceBody {
  readonly kind: typeof LEASE_ADVANCE_DOMAIN;
  readonly resource: string;
  /** The signer's verifying key (hex): the slot's owner. */
  readonly writer: string;
  readonly epoch: number;
}

/** Sign an advance; the result is the slot's `text`. */
export async function signLeaseAdvance(
  parts: { resource: string; epoch: number },
  signer: { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> },
): Promise<string> {
  if (!Number.isSafeInteger(parts.epoch) || parts.epoch < 0) throw new Error("lease-advance: epoch reads a non-negative integer");
  const body: LeaseAdvanceBody = { kind: LEASE_ADVANCE_DOMAIN, resource: parts.resource, writer: signer.key.toLowerCase(), epoch: parts.epoch };
  return JSON.stringify({ body, sig: await signer.sign(canonicalJsonBytes(body)) });
}

/** Read one slot's text: the epoch it carries when it verifies for `resource` and its writer is authorized, else null. */
export function readLeaseAdvance(resource: string, text: unknown, authorize: (writerHex: string) => boolean): number | null {
  if (typeof text !== "string") return null;
  let raw: { body?: Record<string, unknown>; sig?: unknown };
  try { raw = JSON.parse(text) as typeof raw; } catch { return null; }
  const b = raw.body;
  if (typeof b !== "object" || b === null || typeof raw.sig !== "string") return null;
  if (b["kind"] !== LEASE_ADVANCE_DOMAIN || b["resource"] !== resource) return null;
  if (typeof b["writer"] !== "string" || !Number.isSafeInteger(b["epoch"]) || (b["epoch"] as number) < 0) return null;
  const body = b as unknown as LeaseAdvanceBody;
  let ok = false;
  try { ok = verifyEd25519(raw.sig, canonicalJsonBytes(body), body.writer); } catch { ok = false; }
  return ok && authorize(body.writer.toLowerCase()) ? body.epoch : null;
}

/** The effective epoch over a resource's slot texts: the max of the advances that verify. Nothing verified reads 0. */
export function signedLeaseEpoch(resource: string, slotTexts: Iterable<unknown>, authorize: (writerHex: string) => boolean): number {
  let max = 0;
  for (const t of slotTexts) {
    const n = readLeaseAdvance(resource, t, authorize);
    if (n !== null && n > max) max = n;
  }
  return max;
}
