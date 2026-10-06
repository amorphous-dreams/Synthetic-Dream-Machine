/**
 * held-quorum — the HELD persona-roots that sit IN a seated roster, chosen as one quorum's signers.
 *
 * Both quorum doors (membership `nexus contract`, antigen `nexus kapae`) bring signers the same way: a held
 * root counts only when the roster seats its key, each seated key counts once, and the walk stops at the
 * threshold. What differs is the act a sub-quorum would have minted, so each door hands in its own refusal
 * and the message names that act.
 *
 * The ROSTER is the caller's. Each door reads its own roster source and its own seated-quorum refusal;
 * the antigen quorum and the membership quorum stay two relations that happen to select alike.
 */

import type { KahuRoster } from "@lararium/mesh";
import { listPersonaRoots, generateOrLoadPersonaGroupRoot } from "./node-vessel-identity.js";

export interface HeldQuorumSigner {
  readonly handleIndex:  number;
  readonly verifyingKey: string;
}

/**
 * Resolve exactly `roster.threshold` distinct HELD persona-roots seated in `roster`. FAIL CLOSED: fewer
 * throws `refuse(held, threshold)`, so no sub-quorum act is ever minted.
 */
export async function selectHeldQuorumSigners(
  roster: KahuRoster,
  refuse: (held: number, k: number) => Error,
): Promise<HeldQuorumSigner[]> {
  const rosterKeys = new Set(roster.keys.map((k) => k.toLowerCase()));
  const candidates: HeldQuorumSigner[] = [];
  const seen       = new Set<string>();
  for (const handleIndex of await listPersonaRoots()) {
    const root = await generateOrLoadPersonaGroupRoot(handleIndex);   // loads a HELD root; never mints here
    const vk   = root.verifyingKey.toLowerCase();
    if (!rosterKeys.has(vk) || seen.has(vk)) continue;                 // only a seated, not-yet-counted key
    seen.add(vk);
    candidates.push({ handleIndex, verifyingKey: vk });
    if (candidates.length >= roster.threshold) break;
  }
  if (candidates.length < roster.threshold) throw refuse(candidates.length, roster.threshold);
  return candidates;
}
