/**
 * boot-invite — the invite an end user boots into a Nexus on. Any face that stands in that Nexus may mint
 * one; the newcomer spends it once; nobody remembers who invited whom.
 *
 * An end user needs no quorum admit. It needs an INVITE from a face that already stands in the Nexus — a
 * Kahu, a Lamplighter, or another member — and nothing else.
 *
 * WHAT IT IS, AND IS NOT:
 *   · SIGNED BY THE INVITER'S FACE FOR THAT NEXUS — the persona's per-Nexus leaf
 *     (`m / handle' / context' / nexus-scope'`, `deriveNexusScopedKey`), never a vessel key and never a
 *     PersonaGroup root. The leaf names the inviter to this one Nexus and to nothing else, so an invite read
 *     in two Nexuses links no face across them.
 *   · IT CARRIES ITS OWN STANDING. The verifier holds no roster and looks nothing up: the invite presents what
 *     proves its inviter stands, and the gate reads that proof against the kahu quorum's seats, the Nexus's
 *     DENY-only board and the Kapae antigen. What proves standing is named on `InviterStanding`.
 *   · CARRIED, never fetched — the newcomer holds it (paste / QR / URL fragment); no relay sees it in transit.
 *     It verifies OFFLINE.
 *   · SINGLE-USE, burned LOCALLY. The newcomer's vessel records the invite's burn id in its OWN spent-set and
 *     refuses a second spend. No federated burn-registry exists: a mesh-wide spent list would track exactly
 *     what the doctrine forbids tracking. The single-use burn is what CLOSES an invite — it carries no clock.
 *     A signature does not age; the invite's scope (one Nexus, one spend) bounds it.
 *   · ONE HOP, REMEMBERED BY NO ONE. Spending records nothing about who invited whom: no board entry, nothing
 *     at the inviter, and on the newcomer only a burn id that digests the Nexus and the nonce — never the
 *     inviter's key, never its standing. A newcomer's own standing never cites the invite it spent, so
 *     invites never chain into a lineage (a lineage of who-invited-whom IS a roster). The inviter carries no
 *     liability for whom it invited: membership never confers trust.
 *   · WITHHOLD, never forge. A garbled / absent / wrong-Nexus / unsigned / unstanding / already-spent invite
 *     does NOT throw and does NOT admit — the vessel founds its OWN group and stands at the anon floor.
 *
 * Platform-blind: rides ./crypto and @noble/ed25519 only. The LOCAL spent-set lives in the boot host (node:
 * boot-invite-burn; browser: browser-boot-invite-burn) and arrives here through an injected `isSpent` shore.
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { NEXUS_INVITE_DOMAIN } from "./domains.js";
import * as ed25519 from "@noble/ed25519";
import { canonicalJsonBytes, hexToBytes, sha256HexBytesSync } from "./crypto.js";
import {
  verifyPresentedAdmit,
  type CarriageEntry, type PresentedAdmitInput, type PresentedLineageAct,
} from "./carriage-registry.js";

/** The domain an invite signs over. A signature is meaningless without the domain it was made in. */
export { NEXUS_INVITE_DOMAIN } from "./domains.js";

/**
 * What proves the inviter stands in the Nexus. Every kind is checked against the deny board and the antigen;
 * none consults a roster of members.
 *
 *   · `admit` — the inviter's own quorum-signed member admit on its leaf nym, with that admit's closed, tight
 *     causal lineage (`presentationFromBoardDoc`). A Lamplighter stands this way, and so does any face the
 *     kahu quorum admitted — a Kahu included, on its leaf. Read by `verifyPresentedAdmit`; only `held` stands.
 *   · `seat`  — the inviter's key sits as a chair of the kahu quorum's seats. REFUSED (`seat-standing-owed`):
 *     a chair carries a PersonaGroup root key, and a root proof never rides a wire. The arm stands at the
 *     re-found, which re-keys the chairs to per-Nexus leaves.
 */
export type InviterStanding =
  | { readonly kind: "admit"; readonly admit: CarriageEntry; readonly lineage: readonly PresentedLineageAct[] }
  | { readonly kind: "seat" };

/**
 * A sealed, single-use invite into ONE Nexus. Absent by construction: any joiner identity, any place edge,
 * any expiry. The inviter's leaf rides only so the seal and the standing can be checked; the burn digests
 * neither.
 */
export interface BootInvite {
  readonly kind:       typeof NEXUS_INVITE_DOMAIN;
  /** The Nexus this invite boots INTO — its genesis AID (`realmIdOfCharter`). An invite is never a general pass. */
  readonly nexusAid:   string;
  /** A random freshness nonce (hex) — makes each invite unique and keys its local burn. Carries no identity. */
  readonly nonce:      string;
  /** The inviter's per-Nexus leaf verifying key (hex). Signs the invite; never a vessel key, never a root. */
  readonly inviterKey: string;
  /** What proves the inviter stands in this Nexus. */
  readonly standing:   InviterStanding;
  /** Ed25519 by `inviterKey` over the canonical bytes of everything above. */
  readonly sig:        string;
}

/** The bytes an invite signs over. Canonical, so one invite yields one signature. */
export function bootInviteBytes(parts: Omit<BootInvite, "sig">): Uint8Array {
  return canonicalJsonBytes({
    kind:       parts.kind,
    nexusAid:   parts.nexusAid,
    nonce:      parts.nonce,
    inviterKey: parts.inviterKey,
    standing:   parts.standing,
  });
}

/**
 * Mint an invite. The caller supplies the inviter's leaf signer (this module holds no key) and a fresh CSPRNG
 * nonce (the caller owns the RNG so the module stays platform-blind).
 */
export async function signBootInvite(
  parts: Omit<BootInvite, "kind" | "sig">,
  sign: (bytes: Uint8Array) => Promise<string>,
): Promise<BootInvite> {
  const unsigned = { ...parts, inviterKey: parts.inviterKey.toLowerCase(), kind: NEXUS_INVITE_DOMAIN } as Omit<BootInvite, "sig">;
  return { ...unsigned, sig: await sign(bootInviteBytes(unsigned)) };
}

/**
 * The LOCAL burn key: a digest over the domain, the Nexus and the nonce ALONE. It names no inviter and no
 * standing, so the spent-set a newcomer keeps remembers that AN invite spent, never whose. Two invites that
 * share a Nexus and a nonce burn as one.
 */
export function bootInviteId(inv: Pick<BootInvite, "nexusAid" | "nonce">): string {
  return sha256HexBytesSync(canonicalJsonBytes({
    kind: NEXUS_INVITE_DOMAIN, nexusAid: normAid(inv.nexusAid), nonce: inv.nonce,
  }));
}

/** The OFFLINE Ed25519 check over @noble/ed25519. False on any malformed input — a torn seal reads as withhold. */
export async function verifyBootInviteSig(bytes: Uint8Array, sigHex: string, keyHex: string): Promise<boolean> {
  try { return await ed25519.verifyAsync(hexToBytes(sigHex), bytes, hexToBytes(keyHex)); }
  catch { return false; }
}

/** How the boot answers "may this vessel cross into the Nexus?". The operator turns it — code never bakes it in. */
export type BootInvitePolicy =
  /** invite-only — a sealed, unspent invite from a standing face is REQUIRED, or the vessel founds its own group. */
  | { readonly kind: "invite-only" }
  /** open — no invite required; every vessel boots into the Nexus. */
  | { readonly kind: "open" };

/** Why a boot crossing was refused. A refused vessel founds its own group at the anon floor. */
export type BootRefusal =
  | "no-invite"            // invite-only, and none arrived (absent / garbled)
  | "wrong-nexus"          // the invite names a different Nexus
  | "bad-signature"        // the inviter's leaf did not sign this — forged or torn
  | "inviter-not-standing" // the standing it presents does not hold here (rejected, denied, unsettled, unread)
  | "seat-standing-owed"   // a `seat` claim: a chair carries a PersonaGroup root, so the arm stands only once chairs carry leaves
  | "already-spent";       // single-use: this invite was burned already (local island fact)

export interface BootVerdict {
  /** True → the vessel boots INTO the Nexus. False → it founds its own group + stands at the anon floor. */
  readonly admitted: boolean;
  /** Present only on a refusal. */
  readonly refusal?: BootRefusal;
  /** Present only on an admission — the caller MUST burn this id in its LOCAL spent-set before granting. */
  readonly burnId?:  string;
}

/**
 * The Nexus material an inviter's standing is read against — the presented-admit verifier's inputs without
 * the presentation: the kahu roster at the charter head, the charter lineage, the deny board and the antigen.
 * The caller owns which Nexus this material belongs to.
 */
export type InviteStandingContext = Omit<PresentedAdmitInput, "admit" | "lineage">;

const normAid = (aid: string): string => aid.trim().toLowerCase();

/**
 * Does the presented standing hold for `inviterKey` against the Nexus material? Fail-closed; never throws.
 * Answers null when it holds, else the refusal that names why.
 */
async function inviterRefusal(inviterKey: string, standing: InviterStanding, ctx: InviteStandingContext): Promise<BootRefusal | null> {
  try {
    if (standing.kind === "admit") {
      if (standing.admit?.nym?.toLowerCase() !== inviterKey) return "inviter-not-standing";   // the admit must name the signer
      const v = await verifyPresentedAdmit({ ...ctx, admit: standing.admit, lineage: standing.lineage });
      return v.state === "held" ? null : "inviter-not-standing";
    }
    return "inviter-not-standing";
  } catch {
    return "inviter-not-standing";
  }
}

/**
 * THE GATE. Decide whether a vessel boots into the Nexus on a carried invite. OFFLINE, clockless and pure:
 * it checks the Nexus binding, the inviter's leaf seal, the inviter's presented standing against `standing`
 * (the roster, deny board and antigen the caller holds for this Nexus), and the LOCAL burn set. Every failure
 * returns `admitted:false`; nothing throws.
 *
 * The caller MUST, on an admission, burn `burnId` in its local spent-set BEFORE granting — this fn does not
 * mutate the set (the host burns first, then grants, so a crash between never double-spends).
 */
export async function decideBootInvite(args: {
  readonly policy:   BootInvitePolicy;
  /** The genesis AID of the Nexus this vessel crosses into. */
  readonly nexusAid: string;
  readonly invite:   BootInvite | null;
  /** The Nexus material standing is read against. Absent → no invite can show standing, so invite-only withholds. */
  readonly standing: InviteStandingContext | null;
  /** Has this burn id been spent on THIS island already? A LOCAL fact — never a federated lookup. */
  readonly isSpent:  (burnId: string) => boolean | Promise<boolean>;
}): Promise<BootVerdict> {
  if (args.policy.kind === "open") return { admitted: true };

  const inv = args.invite;
  if (!inv || typeof inv !== "object" || inv.kind !== NEXUS_INVITE_DOMAIN
      || typeof inv.nexusAid !== "string" || typeof inv.nonce !== "string"
      || typeof inv.inviterKey !== "string" || typeof inv.sig !== "string"
      || !inv.standing || typeof inv.standing !== "object") {
    return { admitted: false, refusal: "no-invite" };
  }

  // Bind to THIS Nexus BEFORE the seal — a valid invite into another Nexus is a valid signature and an
  // invalid admission here.
  if (normAid(inv.nexusAid) !== normAid(args.nexusAid)) return { admitted: false, refusal: "wrong-nexus" };

  const inviterKey = inv.inviterKey.toLowerCase();
  if (!(await verifyBootInviteSig(bootInviteBytes(inv), inv.sig, inviterKey))) {
    return { admitted: false, refusal: "bad-signature" };
  }

  // A chair carries a PersonaGroup root key, and a root proof never rides a wire: the `seat` arm stands only
  // once the chairs carry per-Nexus leaves. Refused before any Nexus material is read.
  if (inv.standing.kind === "seat") return { admitted: false, refusal: "seat-standing-owed" };
  if (!args.standing) return { admitted: false, refusal: "inviter-not-standing" };
  const refusal = await inviterRefusal(inviterKey, inv.standing, args.standing);
  if (refusal) return { admitted: false, refusal };

  const burnId = bootInviteId(inv);
  if (await args.isSpent(burnId)) return { admitted: false, refusal: "already-spent" };

  return { admitted: true, burnId };
}
