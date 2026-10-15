/**
 * realm-edges — the two edges a realm's removals ride, and who STANDS in a realm by its vouch lineage.
 *
 * LINEAGE STANDING reads as a live query, never a stored fact. A member stands in a realm while some path of standing vouches reaches the realm's seed and no shadow
 * stands over the member's own edge (kapae#/reach). Two edges carry the two removals:
 *   · the VOUCH edge names one voucher's stake (`vouchEdgeId`): its voucher may withdraw it, and the realm's
 *     seat quorum may strike it;
 *   · the MEMBER edge names the member's whole relation to the realm, whoever vouched (`memberEdgeId`): the
 *     seat quorum alone sets it aside, and it holds against a fresh vouch from a hand that never saw the removal.
 *
 * NO READ HERE CLAIMS A WHOLE SET. The fold answers over the vouches and acts this replica holds, as of its
 * last sync (vouch-board's invariant). A standing answer names a relation that reads as standing here; it
 * lists nobody. (`realm-standing` reads a different thing: who feeds a realm, off its lease slots.)
 *
 * Platform-blind: rides ./crypto + ./vouch-board + ./vouch-dag. NO node: imports.
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/reach
 */
import { MEMBER_EDGE_DOMAIN } from "./domains.js";
import { sha256HexSync, canonicalJson } from "./crypto.js";
import type { CabalInvite } from "./cabal-invite.js";
import { vouchEdgeId } from "./vouch-board.js";
import { canonicalIdentity } from "./vouch-dag.js";
import type { EdgeAuthority } from "./edge-kapae.js";

export { MEMBER_EDGE_DOMAIN } from "./domains.js";

/** The relationship id a member's whole standing in one realm presents to the kāpae plane. */
export function memberEdgeId(realmDocIdHex: string, memberIdentityHex: string): string {
  return sha256HexSync(canonicalJson({
    kind: MEMBER_EDGE_DOMAIN,
    realmDocIdHex:     realmDocIdHex.trim().toLowerCase(),
    memberIdentityHex: canonicalIdentity(memberIdentityHex),
  }));
}

/**
 * Whose hands hold each edge on one realm's edge board, read off the verified vouches this reader holds.
 * A vouch edge answers to its voucher AND to the seat quorum. Every other edge on the board answers to the
 * seat quorum alone (kapae#/edge-hands): the quorum holds each member's edge to its realm, and a quorum act
 * over an id that names no relation moves nothing, since no gate ever asks for it. No single key holds a
 * member edge, so a holder act over one drops.
 */
export function realmEdgeAuthority(
  invites: readonly CabalInvite[],
): (edgeId: string) => EdgeAuthority {
  const vouches = new Map<string, EdgeAuthority>();
  for (const i of invites) vouches.set(vouchEdgeId(i), { holder: i.voucherDid, quorum: true });
  return (edgeId) => vouches.get(edgeId) ?? { quorum: true };
}

/**
 * The identities that hold standing in one realm at this replica, as canonical keys.
 *
 * `invites` arrive VERIFIED for this realm. `stands(edgeId)` answers whether a shadow stands over an edge
 * (`readEdgeBoard`).
 *
 * THE ROOTS ARRIVE AUTHENTICATED, never inferred. `roots` names the keys the reader can prove entered this
 * realm by a road other than a vouch: the seats of the charter the realm stands under, read off the reader's
 * own charter. A key that merely signs a vouch roots nothing, since anyone can sign one; and a missing vouch
 * proves nothing about how a hand entered. A root stands unless a shadow stands over its own member edge. A
 * joiner stands when a standing vouch from a standing voucher names it and its member edge reads clear.
 */
export function lineageStanding(input: {
  readonly realmDocIdHex: string;
  readonly roots:         readonly string[];
  readonly invites:       readonly CabalInvite[];
  readonly stands:        (edgeId: string) => boolean;
}): Set<string> {
  const realm = input.realmDocIdHex.trim().toLowerCase();
  const clear = (id: string) => !input.stands(memberEdgeId(realm, id));
  const here = input.invites.filter((i) => i.realmDocIdHex.trim().toLowerCase() === realm);
  const out = new Map<string, string[]>();
  for (const i of here) {
    if (input.stands(vouchEdgeId(i))) continue;
    const voucher = canonicalIdentity(i.voucherDid);
    (out.get(voucher) ?? (out.set(voucher, []), out.get(voucher)!)).push(canonicalIdentity(i.joinerIdentityHex));
  }
  const standing = new Set<string>();
  const queue: string[] = [];
  for (const named of input.roots) {
    let root: string;
    try { root = canonicalIdentity(named); } catch { continue; }   // a root this fold cannot read roots nothing
    if (standing.has(root) || !clear(root)) continue;
    standing.add(root);
    queue.push(root);
  }
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const joiner of out.get(at) ?? []) {
      if (standing.has(joiner) || !clear(joiner)) continue;
      standing.add(joiner);
      queue.push(joiner);
    }
  }
  return standing;
}

/**
 * Does a shadow set this member aside from one realm? True when a shadow stands over the member's own edge,
 * or when the member entered by a vouch and no path of standing vouches still reaches a root. A root, and a
 * peer no vouch names (a charter's own hearth), leave only by a shadow over the member edge: the absence of a
 * vouch proves no removal. `invites` MUST come through the vessel's own ledger (`readLedgeredVouches`), so a
 * vouch a hand deleted from the board still names its joiner here.
 */
export function memberStandsAside(input: {
  readonly realmDocIdHex: string;
  readonly member:        string;
  readonly roots:         readonly string[];
  readonly invites:       readonly CabalInvite[];
  readonly stands:        (edgeId: string) => boolean;
}): boolean {
  let member: string;
  try { member = canonicalIdentity(input.member); } catch { return false; }   // a key this fold cannot read names no member
  if (input.stands(memberEdgeId(input.realmDocIdHex, member))) return true;
  const realm = input.realmDocIdHex.trim().toLowerCase();
  const vouched = input.invites.some((i) => i.realmDocIdHex.trim().toLowerCase() === realm && canonicalIdentity(i.joinerIdentityHex) === member);
  return vouched && !lineageStanding(input).has(member);
}
