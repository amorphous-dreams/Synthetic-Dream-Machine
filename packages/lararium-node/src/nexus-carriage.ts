/**
 * nexus-carriage — the node holder that answers the nexus-doc CARRIER-vs-STRANGER consult on the live
 * sharePolicy path (the carry-split's carriage gate). "Carrier" names a contracted vessel, never a
 * Cabal member — the two relations run orthogonal (carriage-registry).
 *
 * The mesh breathes across a Nexus because a cross-operator the nexus doc names a MEMBER blind-transits a
 * sealed private plane (carry the ciphertext, never the read-cap); a STRANGER reaches only the public shelf.
 * This holder stands the `NexusMembership` the node's `carrierShareDecision` consults, reading the
 * node's OWN nexus-doc replica (as of last sync; no global now — never a global truth).
 *
 * THE MEMBER SET = the seated-KAHU floor ∪ the folded operator MEMBERS-registry (members{}). Two sources,
 * unioned, each fail-closed:
 *   · the seated-kahu FLOOR — the founding-kahu charter ROSTER read off `bags/nexus` (`seatedKahuKeys`).
 *     Every seated kahu IS a contracted member (a strict subset), so it stands even when the members board is
 *     empty / unsynced — the conservative floor that never over-grants.
 *   · the MEMBERS-registry — the quorum-signed, contract-in members{} board (the antigen's ALLOW-twin), folded
 *     through `foldCarriageSet` against the SAME charter roster the antigen folds against. A general contracted
 *     operator (not a kahu) reads MEMBER off THIS source — which is what LIGHTS SELF-SLOT-B: the carry-split's
 *     member gate now names contracted operators, not kahu alone, so a contracted peer would blind-transit a
 *     sealed plane the moment a sealed plane type registers (planeSeal is DENY-ALL today; the lane stands ready).
 *
 * The board fold is OPTIONAL: without a `repo` + `nexusPubkey` the holder stands the kahu-floor alone (the prior
 * behavior, fully preserved), so a caller that has not yet wired the board still gets the conservative floor.
 *
 * NYM RESOLUTION reuses the antigen's proven binding: the DaemonAuthGate already keyed a peerId → verifying-key
 * Identifier hex into `peerIdentifierMap` (this holder SURFACES that nym, never re-authenticates). An
 * unresolved / unauthenticated peer → NOT a member (fail-closed: a node never assumes a peer is Nexus-pono).
 *
 * THE WIRE KEY BINDS TO THE NYM THROUGH THE CONTRACT EDGE. A contracted operator authenticates at the wire by
 * its VESSEL key while the board names its PERSONA-ROOT nym (`accept-carriage` signs as the root). The board keeps
 * the floor and nothing above it (membership-doctrine: no device rides it), so the binding is a capability the
 * FACE CARRIES (#/the-carried-cap): the persona root signs a device edge naming the vessel key, the vessel presents
 * it in the wire's CONTRACT slot (never the fleet slot — that one chains to THIS hearth's KEL), the gate proves it
 * offline (`contractNymOf`) and keeps the nym it proves beside the identifier (`peerContractNymMap`), and the consult
 * reads that nym AHEAD of the raw wire key. The pin is the member set itself: a proven edge names a root, and the
 * root must stand CONTRACTED on this vessel's own board or the peer stays a STRANGER — "someone signed" alone
 * seats nobody. A peer presenting no contract edge resolves exactly as before (byte-identical).
 *
 * FAILS CLOSED, every way:
 *   · an absent / unseated charter → empty roster → the members fold ignores every entry AND the kahu floor is
 *     empty → NOBODY reads member (every cross-operator STRANGER). No quorum, no members.
 *   · an unverified / contract-in-short members entry → ignored at the fold (never trusted).
 *   · an unresolvable / malformed presenter → no nym → NOT a member.
 *   · the members board not yet resolved / synced → the kahu floor alone stands (never a false member).
 *
 * USER-NEVER-WRITTEN: this holder reads operator-pubkey nyms ONLY (kahu keys + members{} nyms). A user leaves no
 * roster trace, so nothing a user does ever enters this set — there is no surface here to hold a user.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/nexus-membership
 */

import type { DocHandle, Repo } from "@automerge/automerge-repo";
import type { NexusMembership, LarDoc } from "@lararium/mesh";
import {
  seatedKahuKeys,
  foundingRoster,
  foldCarriageSet,
  carriageEntriesFromBoard,
  carriageDocUrl,
  materializeSharedLarDoc,
} from "@lararium/mesh";
import { verifyDeviceDelegation, verifyingKeyFromDid, type DeviceDelegationTiddler } from "@lararium/mesh";
import { readNexusDoc } from "./nexus-doc.js";

/** A verifying-key nym reads clean only at the exact ed25519 length — a stray value never seats a member. */
const NYM_RE = /^[0-9a-f]{64}$/;

/**
 * The persona-root nym a CONTRACT edge proves for the vessel key at the wire — or null. The edge must name the
 * presented vessel key (`deviceVerifyingKey` = the Identifier's raw-key tail), verify under the root that signed
 * it, and stand fresh at `now`. No hearth binding and no lease here: the contract names the RELATION (the charter
 * epoch on the board) and the edge names the VESSEL; the hearth × lease binding belongs to the fleet credential.
 * The root this answers is NOT yet trusted — the consult pins it against the contracted member set.
 */
export async function contractNymOf(
  edge: DeviceDelegationTiddler, presentedIdentHex: string, now: number,
): Promise<string | null> {
  const vesselKey = presentedIdentHex.slice(-64).toLowerCase();
  if (!NYM_RE.test(vesselKey)) return null;
  if (typeof edge?.deviceVerifyingKey !== "string" || edge.deviceVerifyingKey.toLowerCase() !== vesselKey) return null;
  if (typeof edge.personaRootDid !== "string") return null;
  const r = await verifyDeviceDelegation(edge, edge.personaRootDid, { now });
  if (!r.ok) return null;
  let nym: string;
  try { nym = verifyingKeyFromDid(edge.personaRootDid).toLowerCase(); } catch { return null; }
  return NYM_RE.test(nym) ? nym : null;
}

export interface NexusMembershipHolder {
  /** The live consult the node sharePolicy passes to `carrierShareDecision`. */
  readonly membership: NexusMembership;
  /** Re-read the kahu floor off disk (idempotent; safe any time). Does NOT touch the members board. */
  refresh(): void;
  /** Re-read the kahu floor AND re-fold the members board, swapping the union whole. No-op board when unwired. */
  refold(): Promise<void>;
  /** Re-fold the member union against an EXTERNALLY-materialized members board (fresh storage bytes) + the disk
   *  charter (kahu floor). The live-refresh path: an OUT-OF-PROCESS admit/revoke (the `lares nexus admit` CLI
   *  writes through its OWN repo) never reaches this holder's cached handle — NodeFS carries no cross-process
   *  change bus — so the refresh caller materializes the board on a throwaway repo and hands the fresh doc here.
   *  Swaps the union whole; a fold fault leaves the prior union standing (fail-closed: never a false member). */
  refoldWithBoard(boardDoc: LarDoc | undefined): Promise<void>;
  /** Detach the members-board change listener (graceful shutdown). */
  dispose(): void;
}

/**
 * Stand the nexus-doc membership holder. Reads the seated-kahu floor SYNCHRONOUSLY at construction (the charter
 * doc is a disk file the operator seats, not a hot-syncing board), and — when a `repo` + `nexusPubkey` are
 * supplied — resolves the always-carried members board under its deterministic id and re-folds members{} ∪ the
 * kahu floor on every board change. `sealHome` sites the seal's authority home; `peerIdentifierMap` carries
 * the DaemonAuthGate's proven peerId → Identifier-hex bindings.
 */
export function makeNexusMembership(opts: {
  sealHome:           string;
  peerIdentifierMap: ReadonlyMap<string, string>;
  /** peerId → the persona-root nym the peer's CONTRACT edge proved at the gate (`contractNymOf`). Read AHEAD of
   *  the raw wire key; absent for a peer that presented none (that peer resolves exactly as before). */
  peerContractNymMap?: ReadonlyMap<string, string>;
  /** The Automerge repo — supply to fold the members board; omit for the kahu-floor-only holder. */
  repo?:             Repo;
  /** The node's own gate key (its Nexus key) — the members board's deterministic address seed. Required with `repo`. */
  nexusPubkey?:      string;
  /** Fires after the member set swaps. The Repo caches a share verdict per (doc, peer) at admission; a member
   *  admitted AFTER its socket stood reads DENIED until the caller re-verdicts (`repo.shareConfigChanged()`). */
  onRefold?:         () => void;
}): NexusMembershipHolder {
  const { sealHome, peerIdentifierMap, peerContractNymMap, repo, nexusPubkey, onRefold } = opts;

  // The member nym set — swapped whole on each refresh/refold (no partial-set window a lookup could read).
  let members: ReadonlySet<string> = new Set<string>();
  let boardHandle: DocHandle<LarDoc> | null = null;
  let onChange: (() => void) | null = null;
  // Resolve the members board at most once (the promise is cached); a lazy refold awaits it so a caller that
  // refolds before the constructor's kick-off completes still reads the board (never a null-board false miss).
  let boardResolve: Promise<DocHandle<LarDoc> | null> | null = null;

  /** The seated-kahu floor read off disk — lowercased. An absent / unseated charter yields the empty floor. */
  const kahuFloor = (): Set<string> =>
    new Set<string>(seatedKahuKeys(readNexusDoc(sealHome)).map((k) => k.toLowerCase()));

  /** Resolve (once) the always-carried members board, wire the change listener, and cache the handle. A holder
   *  without a repo / nexusPubkey resolves to null (kahu-floor-only). A resolve fault resolves to null too
   *  (fail-closed: the kahu floor stands). */
  const ensureBoard = (): Promise<DocHandle<LarDoc> | null> => {
    if (boardHandle) return Promise.resolve(boardHandle);
    if (!repo || !nexusPubkey) return Promise.resolve(null);
    if (!boardResolve) {
      boardResolve = materializeSharedLarDoc(repo, carriageDocUrl(nexusPubkey), "board:carriage-contracts")
        .then((handle) => {
          boardHandle = handle;
          onChange = () => { void refold(); };
          handle.on("change", onChange);
          return handle;
        })
        .catch((err) => {
          console.warn(`[nexus-membership] members board resolve skipped — kahu floor stands: ${(err as Error)?.message ?? err}`);
          return null;
        });
    }
    return boardResolve;
  };

  const refresh = (): void => {
    // Floor-only swap — union with whatever the board fold last produced (empty until refold runs).
    if (boardHandle || boardResolve) { void refold(); return; }   // a wired board owns the union; fold it
    members = kahuFloor();
    onRefold?.();
  };

  // Fold the member union (kahu floor ∪ members{}) against a SUPPLIED board doc + the disk charter — the one
  // fold body both the live handle-change refold (its own cached board) and the out-of-process refresh (a
  // freshly-materialized board) share. An absent / unseated charter folds empty (inert) AND yields an empty
  // floor; a lowercased union never silently misses a case match.
  const foldBoard = async (boardDoc: LarDoc | undefined): Promise<void> => {
    const doc     = readNexusDoc(sealHome);
    const roster  = foundingRoster(doc);
    const floor   = new Set<string>(seatedKahuKeys(doc).map((k) => k.toLowerCase()));
    const entries = carriageEntriesFromBoard(boardDoc);
    const folded  = await foldCarriageSet(entries, roster);
    const union = new Set<string>(floor);
    for (const n of folded) union.add(n.toLowerCase());
    members = union;
    onRefold?.();
  };

  const refold = async (): Promise<void> => {
    const board = await ensureBoard();   // resolve the board first (lazy, once) — no null-board false miss
    await foldBoard(board?.doc());       // the live WS-sync path folds THIS holder's own cached board handle
  };
  // The out-of-process refresh path: fold a board the caller materialized fresh off storage (see the interface).
  const refoldWithBoard = (boardDoc: LarDoc | undefined): Promise<void> => foldBoard(boardDoc);

  // First floor read (synchronous), then — when wired — resolve the members board + first fold asynchronously.
  members = kahuFloor();
  if (repo && nexusPubkey) void refold();

  const memberNym = (peerId: string): string | null => {
    const identHex = peerIdentifierMap.get(peerId);
    if (identHex === undefined) return null;               // unauthenticated / unknown peer → not named → STRANGER
    // The contract edge's proven root reads AHEAD of the wire key — the vessel key names a device, the nym an operator.
    const contractNym = peerContractNymMap?.get(peerId);
    if (contractNym !== undefined) return NYM_RE.test(contractNym) ? contractNym.toLowerCase() : null;
    const nym = identHex.slice(-64).toLowerCase();         // the raw ed25519 verifying key (the nym)
    return NYM_RE.test(nym) ? nym : null;                  // a malformed identifier resolves to no nym
  };

  const membership: NexusMembership = {
    holdsCarriagePeer(peerId: string): boolean {
      const nym = memberNym(peerId);
      if (nym === null) return false;                      // fail-closed: an unresolvable peer is never a member
      return members.has(nym);
    },
  };

  return {
    membership,
    refresh,
    refold,
    refoldWithBoard,
    dispose(): void {
      if (boardHandle && onChange) boardHandle.off("change", onChange);
      boardHandle = null;
      onChange = null;
    },
  };
}
