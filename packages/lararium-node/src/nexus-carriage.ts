/**
 * nexus-carriage — the node holder that answers the CARRIER-vs-STRANGER consult on the live sharePolicy path
 * (the carry-split's carriage gate). "Carrier" names a contracted vessel, never a Cabal member — the two
 * relations run orthogonal (carriage-registry).
 *
 * The mesh breathes across a Nexus because a cross-operator the consult names a MEMBER blind-transits a
 * sealed private plane (carry the ciphertext, never the read-cap); a STRANGER reaches only the public shelf.
 *
 * ── TWO MAPS, AND THEY NEVER LINK ──────────────────────────────────────────────────────────────────
 * No proof binding a per-Nexus LEAF to a persona ROOT ever travels on the wire, so this vessel keeps two maps
 * keyed by peer that fill independently:
 *   · the LEAF MAP (`peerId → leaf nym`) — the ONLY thing the membership consult reads. A peer enters it when
 *     the socket it stands on PRESENTED an admit and ALL of these hold, checked here at the seat:
 *       (a) the admit's leaf signed this socket's nonce, this gate's key, the wire vessel key and the admit's
 *           act CID (`verifyLeafProof`);
 *       (b) `verifyPresentedAdmit` reads the admit `held` against its Nexus N — N's roster off the charter this
 *           vessel holds for N, N's carriage board read as a DENY board (counted revokes only), and N's
 *           antigen through its own roster and verifier;
 *       (c) N stands in this vessel's carried set.
 *     `unsettled`, `wrong-epoch`, `denied` and `rejected` all leave the peer a STRANGER. The nym written is the
 *     verdict's own — the admit's leaf — and nothing from any root.
 *   · the ROOT MAP (`peerContractNymMap`) — what the REALM consult reads (`contractNymOfPeer`). Nothing fills
 *     it: no root-signed edge travels on any socket (the lar:auth contract slot is retired), and linking a leaf
 *     to a root would carry the forbidden binding. The seat stays for the realm doc's write side to fill. The
 *     membership consult never reads it.
 *
 * No admit is folded into an allow set and no raw wire key is read as a nym: a peer whose wire key equals a
 * nym the board admits, presenting nothing, stays a STRANGER. The carriage board's admits reach this vessel
 * only as what a subject PRESENTS; the board itself is read for its revokes.
 *
 * ── THE CARRIERS, HELD APART ──────────────────────────────────────────────────────────────────────
 * The faceless PLACES that signed a carrier seal (`foldCarrierSet`) fold off this vessel's own board and never
 * meet the leaf map: a place is not an operator (heraldry#/the-herm-card).
 *
 * ── REFOLD ────────────────────────────────────────────────────────────────────────────────────────
 * Three steps, swapped whole: re-read the carried Nexuses' deny boards and antigens, re-verify every standing
 * presentation against them, replace the leaf map, fire `onRefold` (the caller re-verdicts its Repo). A
 * revoke descending from a presented admit drops that peer to STRANGER on the refold that reads it.
 *
 * ONE CHAIN. Every `present()` and `refold()` runs through one serial chain, in call order, so no write to
 * the leaf map lands from readings older than a write already landed: a presentation judged on the readings
 * before a revoke never re-seats a peer after the refold that read the revoke.
 *
 * NO GLOBAL NOW: every reading is this vessel's own replica as of its last sync, and the gate's single-use
 * nonce is the only freshness the leaf proof carries.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/nexus-membership
 */

import type { DocHandle, Repo } from "@automerge/automerge-repo";
import type {
  NexusMembership, LarDoc, RealmCharterConsult, PresentedAdmit, CarriageEntry, KapaeAntigenEntry, KahuRoster,
  LeafIdentity, SealEpoch,
} from "@lararium/mesh";
import {
  realmIdOfCharter,
  seatedKahuKeys,
  foundingRoster,
  foldCarrierSet,
  carriageEntriesFromBoard,
  rollAnchorsFromBoard,
  antigenEntriesFromBoard,
  carriageDocUrl,
  kapaeAntigenDocUrl,
  materializeSharedLarDoc,
  makeMultiSigQuorumVerifier,
  verifyLeafProof,
  verifyPresentedAdmit,
  presentedAdmitFromBoard,
  ed25519SignerFromSeed,
  carriageEntryActCid,
  presentedActCid,
  type AdmitPresentation,
} from "@lararium/mesh";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import type { DeviceDelegationTiddler } from "@lararium/mesh";
import { readNexusDoc } from "./nexus-doc.js";
import { carriedReadings, charterHomeFor } from "./carried-set.js";
import { nodeNexusIsland } from "./nexus-standing.js";
import { heldNexusLeaves, type NexusLeaf } from "./nexus-leaf.js";
import { admitBundleHolds, dialedNexusAid, readKeptAdmitBundle } from "./admit-bundle.js";

/** A verifying-key nym reads clean only at the exact ed25519 length — a stray value never seats a member. */
const NYM_RE = /^[0-9a-f]{64}$/;

/**
 * What a socket presented, bound to the values THIS vessel's gate holds for it: the nonce it issued, its own
 * gate key, and the vessel key the V3 proof proved. The presentation is untrusted until `leafStandingFor` reads it.
 */
export interface SocketBinding {
  readonly presentedAdmit: PresentedAdmit;
  readonly nonce:          string;
  readonly gatePubKey:     string;
  readonly vesselKey:      string;
}

/**
 * WHY a vessel carries for a Nexus:
 *   · `consent`      — a kept consent verifies at N's held head under one of this vessel's leaves;
 *   · `seat`         — a held persona-root sits in N's verified roster;
 *   · `carrier-seal` — N's board counts a `carry` for this vessel's own key (a PLACE, `placeCarriedNexuses`).
 */
export type CarriedVia = "consent" | "seat" | "carrier-seal";

/** One Nexus this vessel carries for, read off its own replica: what a presented admit is judged against. */
export interface CarriedNexusReading {
  readonly aid:           string;
  /** Why this vessel carries for N. A reading for display and diagnosis; no verdict reads it. */
  readonly via:           CarriedVia;
  /** The island N's per-Nexus boards key on. */
  readonly island:        string;
  /** N's membership roster at the head of the charter this vessel holds for N. */
  readonly roster:        KahuRoster;
  /** The epoch lineage of that charter, genesis first, its last epoch the roster's head — what an admit at a
   *  rolled epoch is walked against (`verifyPresentedAdmit`). Empty for a charter with no pre-rotated chain. */
  readonly sealLineage:   readonly SealEpoch[];
  /** N's carriage board, read as a DENY board: the verifier reads its counted revokes and nothing else. */
  readonly denyBoard:     readonly CarriageEntry[];
  /** N's Kapae antigen entries. */
  readonly antigen:       readonly KapaeAntigenEntry[];
  /** The ANTIGEN quorum's roster, passed as its own input. `readCarriedNexuses` reads it off N's charter
   *  roster, exactly as the antigen ring folds its own board. */
  readonly antigenRoster: KahuRoster;
}

/** Opens a per-Nexus board by url on whatever replica the caller reads, returning its doc. */
export type BoardOpener = (url: AutomergeUrl, label: string) => Promise<LarDoc | undefined>;

/**
 * Read every Nexus this vessel carries for: each carried reading of `carriedReadings(sealHome)` (`via` names a
 * consent before a seat when both stand), each N's charter at `charterHomeFor` — its head roster and its
 * epoch lineage — its island exactly as the admit writer resolves it (`nodeNexusIsland` over N's charter
 * home), and its carriage and antigen boards through `open`. A Nexus whose charter reads unseated, or whose
 * island will not resolve, is left out — a presented admit for it reads STRANGER. A carried set that cannot
 * be read reads empty.
 */
export async function readCarriedNexuses(opts: {
  readonly sealHome:     string;
  readonly ownVesselKey: string;
  readonly open:         BoardOpener;
}): Promise<readonly CarriedNexusReading[]> {
  let carried: ReadonlyArray<{ aid: string; consented: boolean; carried: boolean }>;
  try { carried = (await carriedReadings(opts.sealHome)).filter((r) => r.carried); } catch { return []; }
  const out: CarriedNexusReading[] = [];
  for (const { aid, consented } of carried) {
    const home = charterHomeFor(opts.sealHome, aid);
    if (!home) continue;
    const doc = readNexusDoc(home);
    const roster = foundingRoster(doc);
    if (roster.sealEpochCid.length === 0) continue;
    let island: string;
    try { island = nodeNexusIsland({ ownVesselKey: opts.ownVesselKey, sealHome: home }); } catch { continue; }
    const denyDoc    = await opts.open(carriageDocUrl(island), "board:carriage-contracts");
    const antigenDoc = await opts.open(kapaeAntigenDocUrl(island), "board:kapae-antigen");
    out.push({
      aid, via: consented ? "consent" : "seat", island, roster,
      sealLineage:   doc?.sealLineage ?? [],
      denyBoard:     carriageEntriesFromBoard(denyDoc),
      antigen:       antigenEntriesFromBoard(antigenDoc),
      antigenRoster: roster,
    });
  }
  return out;
}

/**
 * A `BoardOpener` over a LIVE Repo: each board materializes once (`materializeSharedLarDoc`, so a board a peer
 * holds arrives by sync and an absent one stands blank under its deterministic id), its handle is kept, and
 * every change on it calls `onChange` — a revoke reaching this replica by sync refolds the caller.
 */
export function liveBoardOpener(repo: Repo, onChange: () => void): { readonly open: BoardOpener; dispose(): void } {
  const handles = new Map<string, Promise<DocHandle<LarDoc> | null>>();
  const attached: Array<DocHandle<LarDoc>> = [];
  const listener = (): void => { onChange(); };
  const open: BoardOpener = async (url, label) => {
    let pending = handles.get(url);
    if (!pending) {
      pending = materializeSharedLarDoc(repo, url, label)
        .then((handle) => { handle.on("change", listener); attached.push(handle); return handle; })
        .catch(() => { handles.delete(url); return null; });
      handles.set(url, pending);
    }
    return (await pending)?.doc();
  };
  return {
    open,
    dispose(): void { for (const h of attached) h.off("change", listener); attached.length = 0; handles.clear(); },
  };
}

/** A leaf a socket earned: the verdict's nym, and the carried Nexus whose deny board and antigen held it. */
export interface LeafStanding {
  readonly nym: string;
  readonly aid: string;
}

/**
 * The leaf standing a socket's presentation earns, or null (STRANGER). Pure over its inputs; never throws.
 *
 *   (a) the leaf proof must verify for this socket's nonce, gate key and wire vessel key;
 *   (b) the admit must root on an epoch of a Nexus in `readings` — its head, or an epoch on its charter
 *       lineage the presentation's roll anchors carry to the head — and `verifyPresentedAdmit` must read it
 *       `held` against that Nexus's charter lineage, deny board and antigen;
 *   (c) `readings` holds carried Nexuses only, so an admit for any other Nexus finds no reading.
 * The nym returned is the verdict's own.
 */
export async function leafStandingFor(binding: SocketBinding, readings: readonly CarriedNexusReading[]): Promise<LeafStanding | null> {
  try {
    if (!(await verifyLeafProof(binding))) return null;
    const admit = binding.presentedAdmit.admit;
    const reading = readings.find((r) => r.roster.sealEpochCid.length > 0 && r.roster.sealEpochCid === admit.sealEpochCid)
      ?? readings.find((r) => r.roster.sealEpochCid.length > 0 && r.sealLineage.some((e) => e.epochCid === admit.sealEpochCid));
    if (!reading) return null;
    const verdict = await verifyPresentedAdmit({
      admit,
      lineage:         binding.presentedAdmit.lineage,
      roster:          reading.roster,
      sealLineage:     reading.sealLineage,
      denyBoard:       reading.denyBoard,
      antigen:         reading.antigen,
      antigenRoster:   reading.antigenRoster,
      antigenVerifier: makeMultiSigQuorumVerifier(),
    });
    return verdict.state === "held" && NYM_RE.test(verdict.nym) ? { nym: verdict.nym, aid: reading.aid } : null;
  } catch { return null; }
}

/** What a dial presents: the dialed island's admit head for one held leaf, its lineage, and that leaf. */
export interface DialPresentation extends AdmitPresentation {
  readonly aid:    string;
  readonly island: string;
  readonly leaf:   NexusLeaf;
}

/**
 * The admit this vessel presents when it dials `gatePubKey`, or null (it presents no admit).
 *
 * THE DIALED NEXUS ONLY. The Nexus is the one POSITIVELY tied to the dialed gate key (`dialedNexusAid`: a kept
 * bundle the hearth at that key wrote, or the hearth pin's charter island). No tie → null: the primary charter
 * is never assumed, so an admit for any other Nexus never presents at this gate. That Nexus's board is read
 * off this vessel's own replica through `open`, at the island the admit writer resolves over its charter home.
 *
 * KEPT vs BOARD. When a bundle is kept for the Nexus, its admit must still hold at the charter head and its nym
 * must be a held leaf; the board's counted admit head for that leaf then presents ONLY when it descends from
 * the kept admit (the kept admit is the head or sits in the head's lineage) — both are counted acts, and the
 * board's head wins only by extending the kept one. Otherwise the kept bundle presents as it was taken. With
 * no holding kept bundle, each held leaf's counted board head is tried in roster order. The board's
 * roll anchors ride every board read, so an admit at an epoch the charter has rolled past presents with the
 * anchors that carry it to the head; a kept bundle taken before the roll does not hold at the head on its
 * own, and the board's anchored head presents instead.
 *
 * A charter that reads unseated, an island that will not resolve, or leaves that cannot be read all answer null.
 */
export async function dialPresentation(opts: {
  readonly sealHome:       string;
  readonly ownVesselKey:   string;
  /** The gate key this dial commits its proof to — the dial target. */
  readonly gatePubKey:     string | null;
  readonly open:           BoardOpener;
  /** The leaves this vessel's held personas present to a Nexus. Defaults to the persona vault's. */
  readonly leaves?:        (aid: string) => Promise<readonly NexusLeaf[]>;
  /** The bootstrap the hearth pin rides in. Defaults to this vessel's own. */
  readonly bootstrapPath?: string;
}): Promise<DialPresentation | null> {
  try {
    const aid = dialedNexusAid({
      sealHome: opts.sealHome, gatePubKey: opts.gatePubKey,
      ...(opts.bootstrapPath ? { bootstrapPath: opts.bootstrapPath } : {}),
    });
    if (!aid) return null;
    const home = charterHomeFor(opts.sealHome, aid);
    if (!home) return null;
    const doc = readNexusDoc(home);
    const roster = foundingRoster(doc);
    if (roster.sealEpochCid.length === 0) return null;
    const island = nodeNexusIsland({ ownVesselKey: opts.ownVesselKey, sealHome: home });
    const held = await (opts.leaves ?? heldNexusLeaves)(aid);
    const board = await opts.open(carriageDocUrl(island), "board:carriage-contracts");
    const entries = carriageEntriesFromBoard(board);
    const anchors = rollAnchorsFromBoard(board);

    const kept = readKeptAdmitBundle(opts.sealHome, aid);
    const keptLeaf = kept ? held.find((l) => l.verifyingKey.toLowerCase() === kept.admit.nym.toLowerCase()) : undefined;
    if (kept && keptLeaf && (await admitBundleHolds(kept, roster, doc?.sealLineage ?? []))) {
      const head = await presentedAdmitFromBoard(entries, keptLeaf.verifyingKey, roster, anchors);
      const keptCid = carriageEntryActCid(kept.admit);
      const extends_ = head !== null &&
        (carriageEntryActCid(head.admit) === keptCid || head.lineage.some((e) => presentedActCid(e) === keptCid));
      const pick: AdmitPresentation = extends_ ? head! : { admit: kept.admit, lineage: kept.lineage };
      return { ...pick, aid, island, leaf: keptLeaf };
    }
    for (const leaf of held) {
      const presented = await presentedAdmitFromBoard(entries, leaf.verifyingKey, roster, anchors);
      if (presented) return { ...presented, aid, island, leaf };
    }
    return null;
  } catch { return null; }
}

/**
 * The identity a dial presents — ONE FACE PER VESSEL PER NEXUS. A leaf admit presents with its leaf signer and
 * no root-signed edge. Without one, the FLEET edge (`fleetEdge`: a self edge a root this vessel does NOT hold
 * signed — a hearth's admit of this device) presents in its slot; with none, the ContactCard alone. A
 * self-founded vessel's own root-signed edge never presents: no slot carries it.
 */
export function dialIdentityFor(
  base: LeafIdentity,
  presented: DialPresentation | null,
  fleetEdge: DeviceDelegationTiddler | null,
): LeafIdentity {
  if (presented) {
    return {
      contactCard: base.contactCard, peerPubKey: base.peerPubKey, sign: base.sign,
      presentedAdmit: { admit: presented.admit, lineage: presented.lineage },
      leafSign: leafSignerOf(presented),
    };
  }
  return fleetEdge ? { ...base, edge: fleetEdge } : base;
}

/** The identity of a presentation: its admit's act CID and its lineage's, so a re-dial fires only on a move. */
export function presentationKey(p: AdmitPresentation | null | undefined): string {
  if (!p) return "";
  return [carriageEntryActCid(p.admit), ...p.lineage.map((e) => presentedActCid(e)).sort()].join(",");
}

/** The leaf signer a dial presentation's proof signs with — the leaf's own seed, and only for that proof. */
export function leafSignerOf(p: DialPresentation): (bytes: Uint8Array) => Promise<string> {
  return ed25519SignerFromSeed(p.leaf.seed);
}

export interface NexusMembershipHolder {
  /** The live consult the node sharePolicy passes to `carrierShareDecision`. It reads the LEAF MAP alone. */
  readonly membership: NexusMembership;
  /** The contracted CARRIER nyms — faceless PLACES that signed a carrier contract with their own vessel
   *  key (`foldCarrierSet`) on this vessel's own board. Held APART from the leaf map: a place is not an
   *  operator, so `holdsCarriagePeer` stays false for every nym here (heraldry#/the-herm-card). */
  carriers(): ReadonlySet<string>;
  /** The leaf nym standing for a peer, or null. Read-only; the realm consult never reads it. */
  leafNymOf(peerId: string): string | null;
  /** How many peers stand held per carried Nexus (by AID). */
  heldCounts(): ReadonlyMap<string, number>;
  /** Record what a peer's socket presented (null when it presented no admit), verify it against the current
   *  readings, and swap the leaf map. Fires `onRefold` when the peer's standing moved. */
  present(peerId: string, binding: SocketBinding | null): Promise<void>;
  /** Re-read the carried Nexuses' deny boards and antigens, re-verify every standing presentation, swap the
   *  leaf map whole, and fire `onRefold`. Refolds the carrier set off this vessel's own board beside it. */
  refold(): Promise<void>;
  /** The carried readings the last refold judged against — what `nexus-refresh` reports per Nexus. */
  readings(): readonly CarriedNexusReading[];
  /** Detach every board change listener (graceful shutdown). */
  dispose(): void;
}

/**
 * Stand the membership holder. `readCarried` supplies the carried Nexuses' readings (the live boot passes a
 * reader over its own Repo; a test passes its own); when absent, no presentation ever reads held. `repo` +
 * `nexusPubkey` wire this vessel's own carriage board for the CARRIER fold and re-fold on its change.
 */
export function makeNexusMembership(opts: {
  /** The seal home whose primary charter roots this vessel's own board's carrier fold. */
  readonly sealHome?:    string;
  readonly readCarried?: () => Promise<readonly CarriedNexusReading[]>;
  /** The Automerge repo — supply to fold this vessel's own board's carriers; omit for a leaf-only holder. */
  readonly repo?:        Repo;
  /** This vessel's own island — its own carriage board's address seed. Required with `repo`. */
  readonly nexusPubkey?: string;
  /** Fires after the leaf map swaps. The Repo caches a share verdict per (doc, peer) at admission, so the
   *  caller re-verdicts (`repo.shareConfigChanged()`). */
  readonly onRefold?:    () => void;
}): NexusMembershipHolder {
  const { sealHome, readCarried, repo, nexusPubkey, onRefold } = opts;

  // The standing presentations, keyed by peer — the input every refold re-verifies.
  const bindings = new Map<string, SocketBinding>();
  // THE LEAF MAP — swapped whole on each refold (no partial window a lookup could read).
  let leafMap: ReadonlyMap<string, LeafStanding> = new Map<string, LeafStanding>();
  let carriers: ReadonlySet<string> = new Set<string>();
  let current: readonly CarriedNexusReading[] = [];
  let boardHandle: DocHandle<LarDoc> | null = null;
  let onChange: (() => void) | null = null;
  let boardResolve: Promise<DocHandle<LarDoc> | null> | null = null;

  /** Resolve (once) this vessel's own carriage board for the carrier fold, and refold on its change. */
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
          console.warn(`[nexus-membership] own board resolve skipped — no carriers fold: ${(err as Error)?.message ?? err}`);
          return null;
        });
    }
    return boardResolve;
  };

  const readCurrent = async (): Promise<readonly CarriedNexusReading[]> => {
    if (!readCarried) return [];
    try { return await readCarried(); } catch { return []; }
  };

  const verifyAll = async (readings: readonly CarriedNexusReading[]): Promise<Map<string, LeafStanding>> => {
    const next = new Map<string, LeafStanding>();
    for (const [peerId, binding] of bindings) {
      const standing = await leafStandingFor(binding, readings);
      if (standing) next.set(peerId, standing);
    }
    return next;
  };

  // ONE CHAIN — every present() and refold() runs here, in call order, and a fault never breaks the chain.
  let chain: Promise<void> = Promise.resolve();
  const serial = (step: () => Promise<void>): Promise<void> => {
    const run = chain.then(step);
    chain = run.catch(() => { /* the caller sees its own fault; the chain runs on */ });
    return run;
  };

  const refoldNow = async (): Promise<void> => {
    const readings = await readCurrent();
    const next = await verifyAll(readings);
    // THE OTHER FOLD, off this vessel's own board: the places. Never unioned into the leaf map.
    const board = await ensureBoard();
    if (board && sealHome) {
      const placed = await foldCarrierSet(carriageEntriesFromBoard(board.doc()), foundingRoster(readNexusDoc(sealHome)));
      carriers = new Set<string>([...placed].map((n) => n.toLowerCase()));
    }
    current = readings;
    leafMap = next;
    onRefold?.();
  };

  const presentNow = async (peerId: string, binding: SocketBinding | null): Promise<void> => {
    const before = leafMap.get(peerId)?.nym ?? null;
    if (binding) bindings.set(peerId, binding); else bindings.delete(peerId);
    if (!binding && before === null) return;            // nothing presented, nothing standing — no move
    if (binding && current.length === 0) current = await readCurrent();
    const standing = binding ? await leafStandingFor(binding, current) : null;
    const next = new Map(leafMap);
    if (standing) next.set(peerId, standing); else next.delete(peerId);
    leafMap = next;
    if ((standing?.nym ?? null) !== before) onRefold?.();
  };

  const refold = (): Promise<void> => serial(refoldNow);
  const present = (peerId: string, binding: SocketBinding | null): Promise<void> => serial(() => presentNow(peerId, binding));

  if (repo && nexusPubkey) void refold();

  const membership: NexusMembership = {
    holdsCarriagePeer(peerId: string): boolean {
      return leafMap.has(peerId);                          // the LEAF MAP alone; an absent peer is a STRANGER
    },
  };

  return {
    membership,
    carriers: () => carriers,
    leafNymOf: (peerId) => leafMap.get(peerId)?.nym ?? null,
    heldCounts: () => {
      const out = new Map<string, number>();
      for (const { aid } of leafMap.values()) out.set(aid, (out.get(aid) ?? 0) + 1);
      return out;
    },
    present,
    refold,
    readings: () => current,
    dispose(): void {
      if (boardHandle && onChange) boardHandle.off("change", onChange);
      boardHandle = null;
      onChange = null;
    },
  };
}

/**
 * THE REALM'S OWN CONSULT — what this vessel knows, off its OWN replica, about the hand behind a wire key
 * (the 2026-09-12 ruling: the Nexus plane decides whether a SOCKET stands; the REALM's own registration
 * decides which DOCUMENTS cross it). It answers the realm's questions and never the membership question:
 *
 *   · `contractNymOfPeer` reads the ROOT MAP (`peerContractNymMap`) and returns null for every peer: no root
 *     edge travels on any socket, so nothing fills that map. It never reads the LEAF MAP — a leaf a socket
 *     proved is not a root, and routing one here would link the two on this vessel's behalf.
 *   · `holdsCharter` reads this vessel's OWN charter on disk: the charter names a realm (its genesis epoch),
 *     and a hand SEATED in that charter's founding-kahu roster holds it. Any other nym, and any charter this
 *     vessel does not itself hold, reads false — fail-closed, and never a roster of anybody else's members.
 *   · `holdsCharterPeer` names the peers standing on a socket THIS vessel dialed to the hearth whose charter
 *     it holds. The binding is the operator's own out-of-band act (the gate key the config pins, the charter
 *     `nexus seal import` landed), so it opens the realm's own registered books back toward that hearth — the
 *     RETURN LANE — and reaches no other doc and no other peer.
 *
 * The membership consult (the leaf map) stays the Nexus answer for every peer this consult does not name.
 */
export function makeRealmCharterConsult(opts: {
  readonly sealHome:            string;
  /** THE ROOT MAP — peerId → a persona-root nym. Nothing fills it today: no root-signed edge travels on any
   *  socket. The seat stands for the realm doc's write side to fill; `contractNymOfPeer` reads it alone. */
  readonly peerContractNymMap:  ReadonlyMap<string, string>;
  /** Peers on a socket this vessel dialed to the charter's hearth (filled by the dial; empty until it stands). */
  readonly charterHearthPeers?: ReadonlySet<string>;
  /** peerId → the Identifier hex the DaemonAuthGate proved at the wire. A faceless PLACE holds no persona root,
   *  so its WIRE KEY is the only nym it ever has — and that key IS the nym its carrier contract names. Read
   *  here, and nowhere else, for exactly that reason. */
  readonly peerIdentifierMap?:  ReadonlyMap<string, string>;
  /** The contracted CARRIER set, read live off this vessel's own board fold (`NexusMembershipHolder.carriers`). */
  readonly carrierSet?:         () => ReadonlySet<string>;
}): RealmCharterConsult {
  const { sealHome, peerContractNymMap, charterHearthPeers, peerIdentifierMap, carrierSet } = opts;
  return {
    contractNymOfPeer(peerId: string): string | null {
      const nym = peerContractNymMap.get(peerId);
      return nym !== undefined && NYM_RE.test(nym) ? nym.toLowerCase() : null;
    },
    holdsCharter(nym: string, charterId: string): boolean {
      const want = nym.toLowerCase();
      if (!NYM_RE.test(want)) return false;
      const doc = readNexusDoc(sealHome);
      if (realmIdOfCharter(doc) !== charterId) return false;   // a charter this vessel never held names nobody
      return seatedKahuKeys(doc).some((k) => k.toLowerCase() === want);
    },
    holdsCharterPeer(peerId: string): boolean {
      return charterHearthPeers?.has(peerId) ?? false;
    },
    carrierPeer(peerId: string): boolean {
      if (!carrierSet || !peerIdentifierMap) return false;               // unwired → answers exactly as before
      // A peer the ROOT MAP names stands behind a persona root, which the class forbids a place. Refuse rather
      // than fall through: the carrier lane is for the faceless alone. A place never presents a root.
      if (peerContractNymMap.has(peerId)) return false;
      const identHex = peerIdentifierMap.get(peerId);
      if (identHex === undefined) return false;                          // unauthenticated → never a carrier
      const nym = identHex.slice(-64).toLowerCase();
      return NYM_RE.test(nym) && carrierSet().has(nym);
    },
  };
}
