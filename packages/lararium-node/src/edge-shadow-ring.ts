/**
 * edge-shadow-ring — the ONE live reading of this vessel's edge boards that every gate consults (kapae#/reach).
 *
 * A standing shadow reaches every gate, so the gates read one fold: the socket sorter (`deviceAside`), the
 * share verdict and carriage serve (`aside`), the realm's own gate (`memberAside`), the lane the realm's boards
 * cross by (`standsInRealm`), and the key side (`fold`). The ring reads each board through `readVesselEdgeBoard`,
 * so every refold keeps what it counted and returns a kept act to a board that lost it.
 *
 * FAIL CLOSED UNTIL THE FIRST FOLD LANDS. Before any refold the ring answers every device as aside, every
 * member as aside, and nobody as standing: a vessel that armed its gates before reading its boards shares
 * nothing with anyone, loudly, where a permissive start would re-admit every relation a hand set aside.
 *
 * THE PEER DRAWS MU. The ring answers booleans and names no cause to a peer; the operator's own doors read
 * `fold()` and name each shadow with its reading, a fork included.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/reach
 */
import type { AutomergeUrl, DocHandle, DocumentId, Repo } from "@automerge/automerge-repo";
import { interpretAsDocumentId } from "@automerge/automerge-repo";
import {
  fleetEdgeBoardDocUrl, realmEdgeBoardDocUrl, realmVouchBoardDocUrl, materializeSharedLarDoc,
  fleetEdgeAuthority, deviceEdgeId, realmEdgeAuthority, memberEdgeId, memberStandsAside, lineageStanding,
  readLedgeredVouches, canonicalIdentity, edgeLedgerDocUrl, ledgerRealms, edgeStandingAsOf, raisesSeenThrough, readFleetFrontier, fleetRaiseCids, readFrontierPins, writeFrontierPin, FLEET_HAND, charterHandLineage, readRealmBoardFrontiers, holderHand, vouchEdgeId,
  type CabalInvite, type EdgeReading, type EdgeStanding, type LarDoc, type ShadowConsult, type HandLineage, type WideningRead,
} from "@lararium/mesh";
import { readVesselEdgeBoard, realmNexusIn, vesselEdgeCharter } from "./edge-board.js";

const bare = (key: string): string => key.trim().toLowerCase().replace(/^0x/, "").slice(-64);

export interface EdgeShadowRingDeps {
  readonly repo:       Repo;
  /** This vessel's own verifying key — it keys the ledger, and names this vessel's own device edge. */
  readonly vesselKey:  () => string;
  /** The charter DOC's authority home: the seats a quorum act answers to. */
  readonly sealHome:   string;
  /** The fleet roots this vessel serves: the root of each face it holds. */
  readonly fleetRoots: () => Promise<readonly string[]> | readonly string[];
  /** The fleet root's roster per epoch (its persona KEL lineage), or null where this vessel holds no verified chain for it. */
  readonly lineageOfFleet?: (fleetRoot: string) => Promise<HandLineage | null> | HandLineage | null;
  /** The realm of the charter this vessel stands under, when one stands. */
  readonly charterRealm?: () => string | null;
  /** Fired after each fold a board's own change set off — the standing vessel re-reads its share verdicts there. */
  readonly onRefold?:  () => void;
  /** The proven vessel key behind a sync peer id, or null for a peer the wire has not named. */
  readonly vesselKeyOfPeer: (peerId: string) => string | null;
  /** The identity a peer holds standing under in a realm (the nym its vouch names), or null. */
  readonly realmNymOfPeer:  (peerId: string) => string | null;
}

/** What one fold read off one realm's two boards. */
export interface RealmFold {
  readonly realm:    string;
  /** The authenticated roots of this realm's lineage: the seats of the charter this vessel holds. */
  readonly roots:    readonly string[];
  readonly invites:  readonly CabalInvite[];
  readonly readings: ReadonlyMap<string, EdgeReading>;
  /** The identities that hold lineage standing here, as this replica reads it. Never a whole set. */
  readonly standing: ReadonlySet<string>;
  readonly frontier: WideningRead;
  readonly holders: ReadonlyMap<string, WideningRead>;
}

/** What one fold read off one fleet's board. */
export interface FleetFold {
  readonly fleetRoot: string;
  readonly readings:  ReadonlyMap<string, EdgeReading>;
  readonly frontier: WideningRead;
  /** True when a shadow stands over THIS vessel's own device edge in this fleet. */
  readonly selfAside: boolean;
  /** The raises whose seat this vessel saw leave (revoked here, or gone already), for this fleet's board. */
  readonly rolled:    ReadonlySet<string>;
}

export interface EdgeShadowFold {
  readonly fleets: readonly FleetFold[];
  readonly realms: readonly RealmFold[];
}

export interface EdgeShadowRing extends ShadowConsult {
  /** Read every board again. Every gate reads the result from its next ask on, unless a board moved while this
   *  fold read: that fold publishes nothing, and the fold the move set off lands the reading. The realms read: the charter's
   *  own, and every realm this vessel noted in its ledger (a vouch, a crossing, an edge act). */
  refold(): Promise<EdgeShadowFold>;
  /** Stop following the boards' changes. */
  dispose(): void;
  /** The last fold, or null before the first one lands. */
  fold(): EdgeShadowFold | null;
  /** THE SORTER'S CONSULT: does a standing shadow set this device aside from a fleet this vessel serves? */
  deviceAside(vesselKey: string): boolean;
  widenBlocked(fleetRoot: string): boolean;
  frontierOf(fleetRoot: string): WideningRead | null;
  realmFrontierOf(realm: string): WideningRead | null;
  realmHoldersOf(realm: string): ReadonlyMap<string, WideningRead> | null;
  /**
   * THE BINDING GATE'S CONSULT: what one device's edge reads in one fleet (`edgeStandingAsOf`), against the raises
   * this vessel already answered. `aside` until the first fold lands, and for a fleet this vessel reads no board
   * for: a gate that binds or seats a device never reads an unfolded board as clear. A mark in the ledger moves
   * no board, so the reading takes it at the next fold.
   */
  deviceStanding(fleetRoot: string, vesselKey: string): EdgeStanding;
  /** THE REALM GATE'S CONSULT, bound to one realm: does a shadow set this peer aside from it? */
  memberAside(realm: string): (peerId: string) => boolean;
  /** THE BOARD LANE'S CONSULT: does this peer hold lineage standing in this realm? */
  standsInRealm(peerId: string, realm: string): boolean;
  /** The realm board documents this vessel reads, each with its realm — what `RealmBoardGate` opens a lane for. */
  realmBoards(): ReadonlyMap<DocumentId, string>;
  /** The fleet board addresses this vessel reads — what the sibling lane carries beside the public boards. */
  fleetBoardUrls(): readonly AutomergeUrl[];
}

export function makeEdgeShadowRing(deps: EdgeShadowRingDeps): EdgeShadowRing {
  let last: EdgeShadowFold | null = null;
  let boards: ReadonlyMap<DocumentId, string> = new Map();
  let fleetUrls: readonly AutomergeUrl[] = [];
  // A board that changes (a peer's act arriving by sync) sets off one more fold; folds never overlap.
  const watched = new Map<string, { off: () => void }>();
  let chain: Promise<unknown> = Promise.resolve();
  let disposed = false;
  // Counts the moves of every board this ring follows. A fold publishes only when no board moved while it read:
  // a fold a move overtook read boards as they stood before that move, and the fold the move itself set off
  // lands the reading instead.
  let moved = 0;
  const follow = (url: string, handle: DocHandle<LarDoc>): void => {
    if (watched.has(url) || disposed) return;
    const onChange = (): void => {
      if (disposed) return;
      // THE READING GOES DARK THE MOMENT A BOARD MOVES. The last fold may predate the very act that just
      // arrived, so every gate answers closed until the next fold lands; a peer asked in that gap draws the
      // same Mu, and the standing vessel re-reads its verdicts when the fold completes.
      last = null;
      moved += 1;
      // `refold` leaves NO reading behind a fold that fails, so every gate answers closed until one lands again.
      chain = chain.then(() => ring.refold()).catch(() => undefined).then(() => { if (!disposed) deps.onRefold?.(); });
    };
    handle.on("change", onChange);
    watched.set(url, { off: () => handle.off("change", onChange) });
  };

  const deviceAside = (vesselKey: string): boolean => {
    if (!last) return true;                                    // no fold yet → fail closed
    const device = bare(vesselKey);
    const standings = last.fleets.map((f) => edgeStandingAsOf(f.readings.get(deviceEdgeId(f.fleetRoot, device)), f.rolled, f.frontier.status === "known"));
    if (standings.includes("aside")) return true;
    // ABSENCE IS NOT CLEAR: a fleet whose signed frontier reads unknown vouches for no device, so unless a fleet with a KNOWN
    // frontier names this device, the door answers aside (it widens nothing and waits for the frontier).
    const named = last.fleets.some((f) => f.frontier.status === "known" && f.readings.has(deviceEdgeId(f.fleetRoot, device)));
    return standings.includes("unknown") && !named;
  };

  const realmFold = (realm: string): RealmFold | undefined =>
    last?.realms.find((r) => r.realm === realm.trim().toLowerCase());

  const ring: EdgeShadowRing = {
    async refold() {
      // The last reading may predate the very act that set this fold off. A fold that fails therefore leaves NO
      // reading, and the gates fail closed, where a kept one would go on admitting a relation a hand set aside.
      const startedAt = moved;
      try { return await foldOnce(); }
      catch (err) { if (startedAt === moved) last = null; throw err; }
    },
    fold: () => last,
    deviceAside,
    widenBlocked: (fleetRoot) => last?.fleets.find((f) => f.fleetRoot === bare(fleetRoot))?.frontier.status !== "known",
    frontierOf: (fleetRoot) => last?.fleets.find((f) => f.fleetRoot === bare(fleetRoot))?.frontier ?? null,
    realmFrontierOf: (realm) => realmFold(realm)?.frontier ?? null,
    realmHoldersOf: (realm) => realmFold(realm)?.holders ?? null,
    deviceStanding(fleetRoot, vesselKey) {
      const at = last?.fleets.find((f) => f.fleetRoot === bare(fleetRoot));
      if (!at) return "aside";                                   // no fold yet, or a fleet this vessel never read
      return edgeStandingAsOf(at.readings.get(deviceEdgeId(at.fleetRoot, bare(vesselKey))), at.rolled, at.frontier.status === "known");
    },
    aside(peerId: string): boolean {
      const vesselKey = deps.vesselKeyOfPeer(peerId);
      return vesselKey === null ? false : deviceAside(vesselKey);   // a peer the wire has not named reads no fleet lane
    },
    memberAside(realm) {
      return (peerId) => {
        if (!last) return true;                                  // no fold yet → fail closed
        const nym = deps.realmNymOfPeer(peerId);
        if (nym === null) return false;                          // no proven realm identity → an honest nothing
        const at = realmFold(realm);
        if (!at) return false;                                   // a realm this vessel reads no board for
        const shadow = memberStandsAside({
          realmDocIdHex: at.realm, member: nym, roots: at.roots, invites: at.invites,
          stands: (edgeId) => at.readings.get(edgeId)?.stands === true,
        });
        return shadow || at.frontier.status !== "known";
      };
    },
    standsInRealm(peerId, realm) {
      const nym = deps.realmNymOfPeer(peerId);
      const at = realmFold(realm);
      if (!at || nym === null) return false;
      let key: string;
      try { key = canonicalIdentity(nym); } catch { return false; }
      if (at.readings.get(memberEdgeId(at.realm, key))?.stands === true) return false;
      if (at.frontier.status !== "known") return false;
      return at.standing.has(key) && at.readings.get(memberEdgeId(at.realm, key))?.stands !== true;
    },
    realmBoards: () => boards,
    fleetBoardUrls: () => fleetUrls,
    dispose() {
      disposed = true;
      for (const w of watched.values()) w.off();
      watched.clear();
    },
  };
  return ring;

  async function foldOnce(): Promise<EdgeShadowFold> {
      const startedAt = moved;
      const fleets: FleetFold[] = [];
      const urls: AutomergeUrl[] = [];
      for (const fleetRoot of (await deps.fleetRoots()).map(bare)) {
        const boardUrl = fleetEdgeBoardDocUrl(fleetRoot);
        urls.push(boardUrl);
        const read = await readVesselEdgeBoard({
          repo: deps.repo, scope: fleetRoot, kind: "fleet", boardUrl, label: "board:edge-kapae", vesselKey: deps.vesselKey(),
          authorityFor: fleetEdgeAuthority(fleetRoot),
        });
        follow(boardUrl, read.handle);
        const lineage = (await deps.lineageOfFleet?.(fleetRoot)) ?? null;
        const frontier: WideningRead = lineage ? readFleetFrontier({
          fleetRoot, board: read.handle.doc(), lineage, seenRaises: fleetRaiseCids(read.counted.acts),
          pinned: readFrontierPins(read.ledger.doc(), fleetRoot)[FLEET_HAND] ?? null,
        }) : { status: "unknown", missing: [{ hand: FLEET_HAND, why: "no-frontier" }] };
        if (frontier.status === "known") {
          read.ledger.change((draft) => { writeFrontierPin(draft, fleetRoot, FLEET_HAND, frontier.asOf[FLEET_HAND]!); });
        }
        fleets.push({
          fleetRoot, frontier, readings: read.readings,
          selfAside: read.readings.get(deviceEdgeId(fleetRoot, deps.vesselKey()))?.stands === true,
          rolled: raisesSeenThrough(read.ledger.doc(), fleetRoot),
        });
      }
      const realms: RealmFold[] = [];
      const docs = new Map<DocumentId, string>();
      const ledger = await materializeSharedLarDoc(deps.repo, edgeLedgerDocUrl(deps.vesselKey()), "ledger:edge");
      const charterRealm = deps.charterRealm?.() ?? null;
      const named = new Set<string>([...(charterRealm ? [charterRealm.trim().toLowerCase()] : []), ...ledgerRealms(ledger.doc())]);
      for (const realm of [...named].sort()) {
        const vouchUrl = realmVouchBoardDocUrl(realm), edgeUrl = realmEdgeBoardDocUrl(realm);
        docs.set(interpretAsDocumentId(vouchUrl) as DocumentId, realm);
        docs.set(interpretAsDocumentId(edgeUrl) as DocumentId, realm);
        // The vouches read through the vessel's own ledger: a vouch a hand deleted still names its joiner here.
        const vouches = await readLedgeredVouches({ repo: deps.repo, realm, vesselKey: deps.vesselKey() });
        const invites = vouches.invites;
        // The realm's quorum and its lineage roots read off the charter of the Nexus the realm stands under here.
        const charter = vesselEdgeCharter(realm, deps.sealHome, realmNexusIn(ledger.doc(), realm));
        const read = await readVesselEdgeBoard({
          repo: deps.repo, scope: realm, kind: "realm", boardUrl: edgeUrl, label: "board:edge-kapae", vesselKey: deps.vesselKey(),
          authorityFor: realmEdgeAuthority(invites),
          charter,
        });
        // THE LINEAGE'S ROOTS: the seats of the charter the realm stands under. Nothing else roots a lineage, so a
        // vessel that holds no charter of that Nexus, or notes the realm under none, reads no joiner as standing.
        const roots = charter?.head.keys ?? [];
        const vouchers = new Map<string, Set<string>>();
        for (const invite of invites) {
          const edges = vouchers.get(invite.voucherDid) ?? new Set<string>();
          edges.add(vouchEdgeId(invite));
          vouchers.set(invite.voucherDid, edges);
        }
        const hands = readRealmBoardFrontiers({ realm, board: read.handle.doc(),
          quorumLineage: charterHandLineage(charter?.sealLineage ?? [])?.lineage ?? null,
          vouchers, counted: read.counted.acts, pins: readFrontierPins(read.ledger.doc(), realm) });
        const frontier = hands.quorum;
        const pins = [...[["quorum", frontier] as const], ...[...hands.holders].map(([voucher, result]) => [holderHand(voucher), result] as const)]
          .filter(([, result]) => result.status === "known");
        if (pins.length) read.ledger.change((draft) => {
          for (const [hand, result] of pins) if (result.status === "known") writeFrontierPin(draft, realm, hand, result.asOf[hand]!);
        });
        follow(vouchUrl, vouches.handle);
        follow(edgeUrl, read.handle);
        const stands = (edgeId: string): boolean => read.readings.get(edgeId)?.stands === true;
        realms.push({
          realm, roots, invites, readings: read.readings, frontier, holders: hands.holders,
          standing: lineageStanding({ realmDocIdHex: realm, roots, invites: invites.filter((invite) => hands.holders.get(invite.voucherDid)?.status === "known"), stands }),
        });
      }
      const folded: EdgeShadowFold = { fleets, realms };
      if (startedAt !== moved) return folded;                    // overtaken: the caller holds it, no gate reads it
      last = folded;
      boards = docs;
      fleetUrls = urls;
      return last;
  }
}
