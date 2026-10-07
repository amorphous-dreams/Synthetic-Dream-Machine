/**
 * browser-boot-invite-burn — the LOCAL, causal-island burn store for the Nexus invite on the
 * BROWSER (island-of-one), plus the spend-on-boot. The browser twin of node's boot-invite-burn: the burn is
 * deliberately LOCAL — a spent invite-id lands in this vessel's OWN IndexedDB and NEVER federates. A mesh-wide
 * "which invites are spent" list would re-introduce the tracking the doctrine forbids (and demand a global
 * now the mesh does not have), so single-use is enforced island-local, not by any federated registry.
 *
 * SPEND-ON-BOOT ATOMICITY: `runBrowserBootInviteSpend` decides then BURNS BEFORE returning `admitted:true`. A
 * reload between burn and grant loses only the grant (the vessel re-boots to the anon floor — fail-closed);
 * it never double-spends a granted invite, because the id is already burned when the grant is attempted.
 *
 * WITHHOLD-NEVER-FORGE: every refusal (garbled, absent, wrong-Nexus, bad-seal, inviter-not-standing, already-spent)
 * returns the pure `BootVerdict{admitted:false}` — the caller reads that as "found your own group at the anon
 * floor", never a throw. And it BURNS NOTHING and writes NO record on the withhold path (the traceless proof).
 *
 * Platform: IndexedDB for the burn-set (the browser floor); the OFFLINE seal and standing check is mesh's
 * `decideBootInvite` (no added dep). NO relay, no authority, no clock.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import {
  decideBootInvite, bootInviteId,
  type BootInvite, type BootInvitePolicy, type BootVerdict, type InviteStandingContext,
} from "@lararium/mesh";
import { openVesselIdb, idbGet, idbPut, idbKeys, BOOT_INVITE_BURN_STORE } from "./browser-vessel-identity.js";

/** Is this invite id burned on THIS island already? A LOCAL IndexedDB fact — never a federated lookup. */
export async function isBootInviteBurned(idbName: string, burnId: string): Promise<boolean> {
  const db = await openVesselIdb(idbName);
  const v  = await idbGet<number>(db, BOOT_INVITE_BURN_STORE, burnId);
  db.close();
  return v !== undefined;
}

/** Burn an invite id — record it in the local IndexedDB burn-set (idempotent; a re-burn is a no-op). */
export async function burnBootInvite(idbName: string, burnId: string): Promise<void> {
  const db = await openVesselIdb(idbName);
  await idbPut(db, BOOT_INVITE_BURN_STORE, burnId, 1);
  db.close();
}

/** The local spent-set — the burned invite-ids on THIS island (a read, e.g. for a test's traceless proof). */
export async function readBootInviteBurnSet(idbName: string): Promise<Set<string>> {
  const db = await openVesselIdb(idbName);
  const keys = await idbKeys(db, BOOT_INVITE_BURN_STORE);
  db.close();
  return new Set(keys);
}

/**
 * Decide a carried invite AND spend it on boot — the atomic decide-then-burn for the browser. Checks the
 * inviter's leaf seal and its presented standing OFFLINE against `standing` (the roster, deny board and
 * antigen the boot holds for the Nexus named by `nexusAid`), checks the local spent-set, and — on an
 * admission — BURNS the id in IndexedDB BEFORE returning `admitted:true`. The burn id digests the Nexus and
 * nonce alone, so the IndexedDB entry never names the inviter. A refused invite returns `admitted:false`,
 * burns nothing, and writes no record. The OPEN policy admits with no invite.
 */
export async function runBrowserBootInviteSpend(opts: {
  readonly idbName:  string;
  readonly nexusAid: string;
  readonly standing: InviteStandingContext | null;
  readonly invite:   BootInvite | null;
  readonly policy?:  BootInvitePolicy;
}): Promise<BootVerdict> {
  const verdict = await decideBootInvite({
    policy:   opts.policy ?? { kind: "invite-only" },
    nexusAid: opts.nexusAid,
    invite:   opts.invite,
    standing: opts.standing,
    isSpent:  (burnId) => isBootInviteBurned(opts.idbName, burnId),
  });
  // SPEND-ON-BOOT: burn FIRST, then the caller grants. A reload after the burn re-boots to the anon floor
  // (safe); it never re-grants a spent invite. Withhold burns nothing (the traceless path writes no record).
  if (verdict.admitted && verdict.burnId) await burnBootInvite(opts.idbName, verdict.burnId);
  return verdict;
}

/** Re-export the pure id fn so a caller can pre-compute a burn key without re-deciding (parity with node). */
export { bootInviteId };
