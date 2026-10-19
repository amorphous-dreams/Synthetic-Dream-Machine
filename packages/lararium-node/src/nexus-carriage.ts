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
 *     the gated session it stands on PRESENTED an admit and ALL of these hold, checked here at every refold:
 *       (a) the session's proven face key (`face-gate`'s chain) stands at the head of the admitted nym's key line;
 *       (b) `readAdmitAtHeldRoot` reads the admit `held` against its Nexus N — N's held root built from the charter this
 *           vessel holds for N, N's carriage board read as a DENY board (counted revokes only), and N's
 *           antigen through its own roster and verifier;
 *       (c) N stands in this vessel's carried set.
 *     `unsettled`, `wrong-epoch`, `denied` and `rejected` all leave the peer a STRANGER. The nym written is the
 *     verdict's own — the admit's leaf — and nothing from any root.
 *   · the ROOT MAP (`peerContractNymMap`) — what the REALM consult reads (`contractNymOfPeer`). Nothing fills
 *     it: no root-signed edge travels on any socket (no socket carries a contract slot), and linking a leaf
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
 * Three steps, swapped whole: re-read the carried Nexuses' held roots, re-verify every standing
 * presentation against them, replace the leaf map, fire `onRefold` (the caller re-verdicts its Repo). A
 * revoke descending from a presented admit drops that peer to STRANGER on the refold that reads it.
 *
 * ONE CHAIN. Every `present()` and `refold()` runs through one serial chain, in call order, so no write to
 * the leaf map lands from readings older than a write already landed: a presentation judged on the readings
 * before a revoke never re-seats a peer after the refold that read the revoke.
 *
 * NO GLOBAL NOW: every reading is this vessel's own replica as of its last sync, and the gate's Noise session
 * is the only freshness the face proof carries.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/nexus-membership
 */

import type { DocHandle, Repo } from "@automerge/automerge-repo";
import type {
  NexusMembership, LarDoc, RealmCharterConsult, PresentedAdmit,
  SealEpoch, FederationPosture,
} from "@lararium/mesh";
import {
  nexusAidOf,
  federationPostureFromDoc,
  seatedKahuKeys,
  foundingRoster,
  foldCarrierSet,
  carriageAncestryFromBoard,
  carriageEntriesFromBoard,
  antigenEntriesFromBoard,
  carriageDocUrl,
  kapaeAntigenDocUrl,
  materializeSharedLarDoc,
  makeMultiSigQuorumVerifier,
  heldNexusRoot, heldRootFor, readAdmitAtHeldRoot,
  presentationFromBoardDoc,
  presentationFindingLine,
  carriageEntryActCid,
  presentedActCid,
  nexusKeyHandOversFromBoard,
  admittedKeyOf,
  type AdmitPresentation,
  type NexusKeyHandOver,
  type PresentationFinding,
} from "@lararium/mesh";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import { readNexusDoc } from "./nexus-doc.js";
import type { HeldNexusRoot } from "@lararium/mesh";
import { carriedReadings, charterHomeFor, readKeyLine } from "./carried-set.js";
import { nodeNexusIsland } from "./nexus-standing.js";
import { heldNexusLeaves, type NexusLeaf } from "./nexus-leaf.js";
import { admitBundleHolds, dialedNexusAid, readKeptAdmitBundle } from "./admit-bundle.js";

/** A verifying-key nym reads clean only at the exact ed25519 length — a stray value never seats a member. */
const NYM_RE = /^[0-9a-f]{64}$/;

/**
 * What a gated session presented, bound to the face key its gate proved it under (`face-gate`): the admit and its
 * lineage as they rode the presentation's arm. The gate read them held once; every refold reads them again, and the
 * face key must still stand at the head of the admitted key's line, so a hand-over the line made since unseats it.
 */
export interface SocketBinding {
  readonly presentedAdmit: Pick<PresentedAdmit, "admit" | "lineage">;
  /** The session's proven face key: the key the gate's chain verified, never a key the presentation named. */
  readonly faceKey:        string;
}

/**
 * THE GATE'S HELD ROOT (`face-gate` `presentedAdmitReader`): the reading this vessel holds for the ONE Nexus a gate
 * stands in, or null where it carries no such Nexus. A gate reads its own Nexus's root alone, so an admit for any
 * other Nexus finds no root of its own epoch there.
 */
export function gateHeldRoot(readings: () => Promise<readonly CarriedNexusReading[]>, nexus: string): () => Promise<CarriedNexusReading | null> {
  const aid = nexus.trim().toLowerCase();
  return async () => (await readings()).find((r) => r.aid.toLowerCase() === aid) ?? null;
}

/**
 * WHY a vessel carries for a Nexus:
 *   · `consent`      — a kept consent verifies at N's held head under one of this vessel's leaves;
 *   · `seat`         — a held persona-root sits in N's verified roster;
 *   · `carrier-seal` — N's board counts a `carry` for this vessel's own key (a PLACE, `placeCarriedNexuses`).
 */
export type CarriedVia = "consent" | "seat" | "carrier-seal";

/** One Nexus this vessel carries for, read off its own replica: what a presented admit is judged against.
 * The inherited root holds the charter roster and lineage, its carriage board as a DENY board whose counted
 * revokes affect verdicts, the antigen entries, and the antigen quorum seated from that charter roster.
 */
export interface CarriedNexusReading extends HeldNexusRoot {
  readonly nexus: string;
  readonly aid:           string;
  /** Why this vessel carries for N. A reading for display and diagnosis; no verdict reads it. */
  readonly via:           CarriedVia;
  /** The island N's per-Nexus boards key on. */
  readonly island:        string;
  /** The epoch lineage of that charter, genesis first, its last epoch the roster's head. */
  readonly sealLineage:   readonly SealEpoch[];
  /** N's federation posture off the charter this vessel holds for N (PRIVATE when absent or torn). The gate
   *  answers strangers iff some carried Nexus reads OPEN (`answersStrangers`). */
  readonly posture:       FederationPosture;
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
    const root = heldNexusRoot({ nexus: aid, charter: doc, denyBoard: carriageEntriesFromBoard(denyDoc),
      antigen: antigenEntriesFromBoard(antigenDoc), antigenVerifier: makeMultiSigQuorumVerifier(),
      handOvers: keyLineAt(opts.sealHome, aid, denyDoc) });
    if ("absent" in root) continue;
    out.push({ ...root, sealLineage: root.sealLineage ?? [], aid, via: consented ? "consent" : "seat", island,
      posture: federationPostureFromDoc(doc) });
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

/**
 * Every per-Nexus key hand-over a reader holds at N: the records N's carriage board carries, every face's, and the
 * ones this vessel keeps for its own faces (a hand-over it signed reads here before the board syncs). Each record
 * proves itself, so the union adds no trust; the line's fold refuses a fork wherever it shows.
 */
export function keyLineAt(sealHome: string, aid: string, board: Parameters<typeof nexusKeyHandOversFromBoard>[0]): NexusKeyHandOver[] {
  const out = new Map<string, NexusKeyHandOver>();
  for (const r of [...nexusKeyHandOversFromBoard(board, aid), ...readKeyLine(sealHome, aid)]) out.set(`${r.from}>${r.to}`, r);
  return [...out.values()];
}

/** A leaf a socket earned: the verdict's nym, and the carried Nexus whose deny board and antigen held it. */
export interface LeafStanding {
  readonly nym: string;
  readonly aid: string;
}

/**
 * The leaf standing a gated session's presentation earns, or null (STRANGER). Pure over its inputs; never throws.
 *
 *   (a) the admit must root on an epoch of a Nexus in `readings` — its head, or an epoch on its charter
 *       lineage the presentation's roll anchors carry to the head — and `readAdmitAtHeldRoot` must read it
 *       `held` against that Nexus's charter lineage, deny board, antigen and key line;
 *   (b) the session's proven face key must stand at the HEAD of the admitted nym's key line (the nym itself
 *       where no hand-over stands): a key the line handed on stands for nothing;
 *   (c) `readings` holds carried Nexuses only, so an admit for any other Nexus finds no reading.
 * The nym returned is the verdict's own.
 */
export async function leafReadingFor(binding: SocketBinding, readings: readonly CarriedNexusReading[]): Promise<{ readonly standing: LeafStanding } | { readonly refusal: string }> {
  // Each way out wears a name the vessel's own operator may read; the peer draws silence whichever one fires:
  // `admit-head-other` · `no-held-root` (the admit names no Nexus this vessel holds a root for) ·
  // `admit-<state>:<reason>` (the verifier's own verdict) · `admit-nym-unreadable` · `unreadable` (a throw).
  try {
    const admit = binding.presentedAdmit.admit;
    const root = heldRootFor(admit, readings);
    if (!root) return { refusal: "no-held-root" };
    const read = await readAdmitAtHeldRoot({ admit, lineage: binding.presentedAdmit.lineage }, root);
    if ("refusal" in read) return read;
    if (read.verdict.state !== "held") return { refusal: `admit-${read.verdict.state}:${read.verdict.reason}` };
    if (!NYM_RE.test(read.verdict.nym) || !NYM_RE.test(read.head)) return { refusal: "admit-nym-unreadable" };
    if (typeof binding.faceKey !== "string" || binding.faceKey.trim().toLowerCase() !== read.head) return { refusal: "admit-head-other" };
    return { standing: { nym: read.verdict.nym, aid: root.nexus } };
  } catch { return { refusal: "unreadable" }; }
}

/** The leaf standing a socket's presentation earns, or null (STRANGER): `leafReadingFor` with its refusal's name dropped. */
export async function leafStandingFor(binding: SocketBinding, readings: readonly CarriedNexusReading[]): Promise<LeafStanding | null> {
  const result = await leafReadingFor(binding, readings);
  return "standing" in result ? result.standing : null;
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
 * no holding kept bundle, each held leaf's counted board head is tried in roster order. Every board read goes
 * through the one presenter (`presentationFromBoardDoc`), which reads the board's roll anchors with its acts, so an admit at an epoch the charter has rolled past presents with the
 * anchors that carry it to the head; a kept bundle taken before the roll does not hold at the head on its
 * own, and the board's anchored head presents instead.
 *
 * A charter that reads unseated, an island that will not resolve, or leaves that cannot be read all answer null.
 *
 * WHAT THE PRESENTER NOTICED SURFACES. Every board read hands its findings (two roll anchors opening one
 * epoch) to `onFinding`, once each per dial, whether or not an admit presents. A finding never refuses and
 * never changes the pick. The vessel's warn channel hears them unless the caller names its own.
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
  /** Where the presenter's findings surface. Defaults to the vessel's warn channel. */
  readonly onFinding?:     (finding: PresentationFinding) => void;
}): Promise<DialPresentation | null> {
  const onFinding = opts.onFinding ?? ((f: PresentationFinding) => console.warn(`[nexus-dial] ${presentationFindingLine(f)}`));
  try {
    const aid = dialedNexusAid({
      sealHome: opts.sealHome, gatePubKey: opts.gatePubKey,
      ...(opts.bootstrapPath ? { bootstrapPath: opts.bootstrapPath } : {}),
    });
    if (!aid) return null;
    return await ownPresentationFor({ ...opts, aid, onFinding });
  } catch { return null; }
}

/**
 * The admit this vessel's own leaf presents in the Nexus named by `aid`, or null (it holds none there). The
 * one reading `dialPresentation` makes once it has tied a gate key to a Nexus: the kept bundle when the board's
 * head does not extend it, else the board's counted head for each held leaf in roster order, through the one
 * presenter.
 */
async function ownPresentationFor(opts: {
  readonly sealHome:     string;
  readonly ownVesselKey: string;
  readonly aid:          string;
  readonly open:         BoardOpener;
  readonly leaves?:      (aid: string) => Promise<readonly NexusLeaf[]>;
  readonly onFinding?:   (finding: PresentationFinding) => void;
}): Promise<DialPresentation | null> {
  const surfaced = new Set<string>();
  const onFinding = opts.onFinding ?? ((f: PresentationFinding) => console.warn(`[nexus-dial] ${presentationFindingLine(f)}`));
  const present = async (board: Parameters<typeof presentationFromBoardDoc>[0], nym: string, roster: Parameters<typeof presentationFromBoardDoc>[2]) => {
    const { presentation, findings } = await presentationFromBoardDoc(board, nym, roster);
    for (const f of findings) {
      const key = `${f.epochCid}:${f.anchorCids.join(",")}`;
      if (surfaced.has(key)) continue;
      surfaced.add(key);
      onFinding(f);
    }
    return presentation;
  };
  try {
    const aid = opts.aid;
    const home = charterHomeFor(opts.sealHome, aid);
    if (!home) return null;
    const doc = readNexusDoc(home);
    const roster = foundingRoster(doc);
    if (roster.sealEpochCid.length === 0) return null;
    const island = nodeNexusIsland({ ownVesselKey: opts.ownVesselKey, sealHome: home });
    const held = await (opts.leaves ?? heldNexusLeaves)(aid);
    const board = await opts.open(carriageDocUrl(island), "board:carriage-contracts");
    // THE ADMITTED NYM OF EACH HELD KEY: the key itself, or the key its line leads from where a hand-over moved it.
    // A key the line handed on admits nothing.
    const line = keyLineAt(opts.sealHome, aid, board);
    const admittedOf = (leaf: NexusLeaf): string | null => admittedKeyOf({ nexus: aid, key: leaf.verifyingKey, carried: line });

    const kept = readKeptAdmitBundle(opts.sealHome, aid);
    const keptLeaf = kept ? held.find((l) => admittedOf(l) === kept.admit.nym.toLowerCase()) : undefined;
    if (kept && keptLeaf && (await admitBundleHolds(kept, doc))) {
      const head = await present(board, kept.admit.nym.toLowerCase(), roster);
      const keptCid = carriageEntryActCid(kept.admit);
      const extends_ = head !== null &&
        (carriageEntryActCid(head.admit) === keptCid || head.lineage.some((e) => presentedActCid(e) === keptCid));
      const pick: AdmitPresentation = extends_ ? head! : { admit: kept.admit, lineage: kept.lineage };
      return { ...pick, aid, island, leaf: keptLeaf };
    }
    for (const leaf of held) {
      const admitted = admittedOf(leaf);
      if (admitted === null) continue;
      const presented = await present(board, admitted, roster);
      if (presented) return { ...presented, aid, island, leaf };
    }
    return null;
  } catch { return null; }
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
  /** The Nexus AID a peer's leaf stands under, or null: a realm plane scopes its Nexus lane to its own AID. */
  leafAidOf(peerId: string): string | null;
  /** How many peers stand held per carried Nexus (by AID). */
  heldCounts(): ReadonlyMap<string, number>;
  /** Record what a peer's socket presented (null when it presented no admit), verify it against the current
   *  readings, and swap the leaf map. Fires `onRefold` when the peer's standing moved. */
  present(peerId: string, binding: SocketBinding | null): Promise<void>;
  /** Re-read the carried Nexuses' held roots, re-verify every standing presentation, swap the
   *  leaf map whole, and fire `onRefold`. Refolds the carrier set off this vessel's own board beside it. */
  refold(): Promise<void>;
  /** The carried readings the last refold judged against — what the after-roll refold reports per Nexus. */
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
  /** THE LOCAL NAME OF A REFUSAL, for a caller that wants it: a presentation this holder reads and refuses
   *  names why (`leafReadingFor`). The peer draws silence. The socket seat reads each admit first and logs the
   *  name itself (`socket-sorter`), so this holder logs nothing of its own. A refold re-verifies quietly. */
  readonly onRefuse?:    (peerId: string, refusal: string) => void;
}): NexusMembershipHolder {
  const { sealHome, readCarried, repo, nexusPubkey, onRefold, onRefuse } = opts;

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
      const result = await leafReadingFor(binding, readings);
      if ("standing" in result) next.set(peerId, result.standing);
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
      const charter = readNexusDoc(sealHome);
      const placed = await foldCarrierSet(carriageEntriesFromBoard(board.doc()), foundingRoster(charter),
        carriageAncestryFromBoard(charter?.sealLineage, board.doc()));
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
    const result = binding ? await leafReadingFor(binding, current) : null;
    const standing = result && "standing" in result ? result.standing : null;
    if (result && "refusal" in result) {
      const refusal = result.refusal;
      // A name for the operator never decides the fold: a callback that throws leaves the leaf map's swap whole.
      try { onRefuse?.(peerId, refusal); } catch { /* the fold goes on */ }
    }
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
    leafAidOf: (peerId) => leafMap.get(peerId)?.aid ?? null,
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
 *     and a hand SEATED in that charter's founding kahu quorum holds it. Any other nym, and any charter this
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
  /** peerId → the key the face gate seated the socket under (the session's FACE key, or a faceless place's own key). A faceless PLACE holds no persona root,
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
      if (nexusAidOf(doc) !== charterId) return false;   // a charter this vessel never held names nobody
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
