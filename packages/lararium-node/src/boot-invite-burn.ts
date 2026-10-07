/**
 * boot-invite-burn — the LOCAL, causal-island burn store for the Nexus invite, plus the node-side mint (by the
 * inviter's per-Nexus leaf) and spend-on-boot. The burn is deliberately LOCAL: a spent invite id lands in this
 * vessel's OWN store and never federates. A mesh-wide "which invites are spent" list would re-introduce the tracking the doctrine
 * forbids (and demand a global now) — so single-use is enforced island-local, not by a federated registry.
 *
 * SPEND-ON-BOOT ATOMICITY: `runBootInviteSpend` decides then BURNS BEFORE returning `admitted:true`. A crash
 * between burn and grant loses only the grant (the vessel re-boots to the anon floor — fail-closed); it never
 * double-spends a granted invite, because the id is already burned when the grant is attempted.
 *
 * WITHHOLD-NEVER-FORGE: every refusal (garbled, wrong-Nexus, bad-seal, inviter-not-standing, already-spent) returns the pure
 * `BootVerdict{admitted:false}` — the caller reads that as "found your own group at the anon floor", never a throw.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, dirname } from "node:path";
import * as ed25519 from "@noble/ed25519";
import {
  decideBootInvite, signBootInvite, bootInviteId,
  type BootInvite, type BootInvitePolicy, type BootVerdict, type InviterStanding, type InviteStandingContext,
} from "@lararium/mesh";
import { larDataDir } from "./vessel-paths.js";
import { nexusLeafFor } from "./nexus-leaf.js";

/** The local burn ledger path — one spent invite-id per line, under the vessel store. Never federated. */
export function bootInviteBurnPath(storageDir: string): string {
  return join(storageDir, "boot-invite-burned");
}

/** Read the local spent-set — the burned invite-ids on THIS island. An absent ledger reads the empty set. */
export function readBurnSet(storageDir: string): Set<string> {
  const path = bootInviteBurnPath(storageDir);
  if (!existsSync(path)) return new Set<string>();
  try {
    return new Set(readFileSync(path, "utf8").split("\n").map((l) => l.trim()).filter((l) => l.length > 0));
  } catch {
    return new Set<string>();   // an unreadable ledger fails closed to empty (a fresh invite may still spend once)
  }
}

/** Is this invite id burned on THIS island already? A LOCAL fact — never a federated lookup. */
export function isBurned(storageDir: string, burnId: string): boolean {
  return readBurnSet(storageDir).has(burnId);
}

/** Burn an invite id — append it to the local ledger (idempotent; a re-burn is a no-op). */
export function burn(storageDir: string, burnId: string): void {
  const set = readBurnSet(storageDir);
  if (set.has(burnId)) return;
  set.add(burnId);
  const path = bootInviteBurnPath(storageDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, [...set].sort().join("\n") + "\n", "utf8");
}

/**
 * Mint an invite into the Nexus named by `nexusAid`, signed by the per-Nexus LEAF of the held persona at
 * `handleIndex` — the inviter's face for that Nexus, never this vessel's key and never the persona root.
 * The caller supplies the inviter's `standing` (a member admit presentation from a board it holds —
 * `presentedAdmitFromBoard` — or a kahu `seat`). A random nonce makes each invite unique. The mint writes
 * NOTHING: no record of the invite stays at the inviter, so nothing there can name whom it invited. The
 * caller carries the token out-of-band (paste / QR / URL fragment).
 */
export async function runBootInviteMint(opts: {
  handleIndex: number; nexusAid: string; standing: InviterStanding;
}): Promise<BootInvite> {
  const leaf  = await nexusLeafFor(opts.handleIndex, opts.nexusAid);
  const nonce = randomBytes(16).toString("hex");
  return signBootInvite(
    { nexusAid: opts.nexusAid, nonce, inviterKey: leaf.verifyingKey, standing: opts.standing },
    async (bytes) => Buffer.from(await ed25519.signAsync(bytes, leaf.seed)).toString("hex"),
  );
}

/**
 * Decide a carried invite AND spend it on boot — the atomic decide-then-burn. Reads the inviter's presented
 * standing against `standing` (the roster, deny board and antigen this vessel holds for the Nexus), checks
 * the local spent-set, and — on an admission — BURNS the id BEFORE returning `admitted:true`. The burn
 * line is a digest of the Nexus and nonce alone, so the ledger never names the inviter. A refused invite
 * returns `admitted:false` and burns nothing (the vessel founds its own group at the anon floor).
 */
export async function runBootInviteSpend(opts: {
  invite: BootInvite | null; nexusAid: string; standing: InviteStandingContext | null;
  policy?: BootInvitePolicy; storageDir?: string;
}): Promise<BootVerdict> {
  const storageDir = opts.storageDir ?? larDataDir();
  const verdict = await decideBootInvite({
    policy:   opts.policy ?? { kind: "invite-only" },
    nexusAid: opts.nexusAid,
    invite:   opts.invite,
    standing: opts.standing,
    isSpent:  (burnId) => isBurned(storageDir, burnId),
  });
  // SPEND-ON-BOOT: burn FIRST, then the caller grants. A crash after the burn re-boots to the anon floor (safe);
  // it never re-grants a spent invite.
  if (verdict.admitted && verdict.burnId) burn(storageDir, verdict.burnId);
  return verdict;
}

/** Re-export the pure id fn so a caller can pre-compute a burn key without re-deciding. */
export { bootInviteId };
