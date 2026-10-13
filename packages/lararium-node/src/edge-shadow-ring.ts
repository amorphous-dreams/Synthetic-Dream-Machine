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
  readLedgeredVouches, canonicalIdentity, edgeLedgerDocUrl, ledgerRealms,
  type CabalInvite, type EdgeReading, type LarDoc, type ShadowConsult,
} from "@lararium/mesh";
import { readVesselEdgeBoard, vesselEdgeCharter } from "./edge-board.js";

const bare = (key: string): string => key.trim().toLowerCase().replace(/^0x/, "").slice(-64);

export interface EdgeShadowRingDeps {
  readonly repo:       Repo;
  /** This vessel's own verifying key — it keys the ledger, and names this vessel's own device edge. */
  readonly vesselKey:  string;
  /** The charter DOC's authority home: the seats a quorum act answers to. */
  readonly sealHome:   string;
  /** The fleet roots this vessel serves: the root of each face it holds. */
  readonly fleetRoots: () => Promise<readonly string[]> | readonly string[];
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
}

/** What one fold read off one fleet's board. */
export interface FleetFold {
  readonly fleetRoot: string;
  readonly readings:  ReadonlyMap<string, EdgeReading>;
  /** True when a shadow stands over THIS vessel's own device edge in this fleet. */
  readonly selfAside: boolean;
}

export interface EdgeShadowFold {
  readonly fleets: readonly FleetFold[];
  readonly realms: readonly RealmFold[];
}

export interface EdgeShadowRing extends ShadowConsult {
  /** Read every board again. Every gate reads the result from its next ask on. The realms read: the charter's
   *  own, and every realm this vessel noted in its ledger (a vouch, a crossing, an edge act). */
  refold(): Promise<EdgeShadowFold>;
  /** Stop following the boards' changes. */
  dispose(): void;
  /** The last fold, or null before the first one lands. */
  fold(): EdgeShadowFold | null;
  /** THE SORTER'S CONSULT: does a standing shadow set this device aside from a fleet this vessel serves? */
  deviceAside(vesselKey: string): boolean;
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
  const follow = (url: string, handle: DocHandle<LarDoc>): void => {
    if (watched.has(url) || disposed) return;
    const onChange = (): void => {
      if (disposed) return;
      // THE READING GOES DARK THE MOMENT A BOARD MOVES. The last fold may predate the very act that just
      // arrived, so every gate answers closed until the next fold lands; a peer asked in that gap draws the
      // same Mu, and the standing vessel re-reads its verdicts when the fold completes.
      last = null;
      // `refold` leaves NO reading behind a fold that fails, so every gate answers closed until one lands again.
      chain = chain.then(() => ring.refold()).catch(() => undefined).then(() => { if (!disposed) deps.onRefold?.(); });
    };
    handle.on("change", onChange);
    watched.set(url, { off: () => handle.off("change", onChange) });
  };

  const deviceAside = (vesselKey: string): boolean => {
    if (!last) return true;                                    // no fold yet → fail closed
    const device = bare(vesselKey);
    return last.fleets.some((f) => f.readings.get(deviceEdgeId(f.fleetRoot, device))?.stands === true);
  };

  const realmFold = (realm: string): RealmFold | undefined =>
    last?.realms.find((r) => r.realm === realm.trim().toLowerCase());

  const ring: EdgeShadowRing = {
    async refold() {
      // The last reading may predate the very act that set this fold off. A fold that fails therefore leaves NO
      // reading, and the gates fail closed, where a kept one would go on admitting a relation a hand set aside.
      try { return await foldOnce(); }
      catch (err) { last = null; throw err; }
    },
    fold: () => last,
    deviceAside,
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
        return memberStandsAside({
          realmDocIdHex: at.realm, member: nym, roots: at.roots, invites: at.invites,
          stands: (edgeId) => at.readings.get(edgeId)?.stands === true,
        });
      };
    },
    standsInRealm(peerId, realm) {
      const nym = deps.realmNymOfPeer(peerId);
      const at = realmFold(realm);
      if (!at || nym === null) return false;
      let key: string;
      try { key = canonicalIdentity(nym); } catch { return false; }
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
      const fleets: FleetFold[] = [];
      const urls: AutomergeUrl[] = [];
      for (const fleetRoot of (await deps.fleetRoots()).map(bare)) {
        const boardUrl = fleetEdgeBoardDocUrl(fleetRoot);
        urls.push(boardUrl);
        const read = await readVesselEdgeBoard({
          repo: deps.repo, scope: fleetRoot, kind: "fleet", boardUrl, label: "board:edge-kapae", vesselKey: deps.vesselKey,
          authorityFor: fleetEdgeAuthority(fleetRoot),
        });
        follow(boardUrl, read.handle);
        fleets.push({
          fleetRoot, readings: read.readings,
          selfAside: read.readings.get(deviceEdgeId(fleetRoot, deps.vesselKey))?.stands === true,
        });
      }
      const realms: RealmFold[] = [];
      const docs = new Map<DocumentId, string>();
      const ledger = await materializeSharedLarDoc(deps.repo, edgeLedgerDocUrl(deps.vesselKey), "ledger:edge");
      const charterRealm = deps.charterRealm?.() ?? null;
      const named = new Set<string>([...(charterRealm ? [charterRealm.trim().toLowerCase()] : []), ...ledgerRealms(ledger.doc())]);
      for (const realm of [...named].sort()) {
        const vouchUrl = realmVouchBoardDocUrl(realm), edgeUrl = realmEdgeBoardDocUrl(realm);
        docs.set(interpretAsDocumentId(vouchUrl) as DocumentId, realm);
        docs.set(interpretAsDocumentId(edgeUrl) as DocumentId, realm);
        // The vouches read through the vessel's own ledger: a vouch a hand deleted still names its joiner here.
        const vouches = await readLedgeredVouches({ repo: deps.repo, realm, vesselKey: deps.vesselKey });
        const invites = vouches.invites;
        const charter = vesselEdgeCharter(realm, deps.sealHome);
        const read = await readVesselEdgeBoard({
          repo: deps.repo, scope: realm, kind: "realm", boardUrl: edgeUrl, label: "board:edge-kapae", vesselKey: deps.vesselKey,
          authorityFor: realmEdgeAuthority(invites),
          charter,
        });
        // THE LINEAGE'S ROOTS: the seats of the charter this vessel holds. Nothing else roots a lineage, so a
        // vessel that holds no charter reads no joiner as standing.
        const roots = charter?.head.keys ?? [];
        follow(vouchUrl, vouches.handle);
        follow(edgeUrl, read.handle);
        const stands = (edgeId: string): boolean => read.readings.get(edgeId)?.stands === true;
        realms.push({
          realm, roots, invites, readings: read.readings,
          standing: lineageStanding({ realmDocIdHex: realm, roots, invites, stands }),
        });
      }
      last = { fleets, realms };
      boards = docs;
      fleetUrls = urls;
      return last;
  }
}
