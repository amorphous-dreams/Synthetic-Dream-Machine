/**
 * nexus-board-climb — the boards a CLIMB moves, and the two different acts that move them.
 *
 * Connecting re-keys every per-Nexus board (`nexusScopeMoved`), and nothing carries across on its own.
 * `carryPersonaKelUpTheGradient` (`./persona-kel-climb`) carries the one board whose gate refuses rather than
 * degrades. This module carries the rest that move, and names the boards that stay where they stand.
 *
 * ── CARRY ⊥ RE-ANNOUNCE: the difference lies in WHERE THE TRUTH LIVES ───────────────────────────────
 * A board whose entries ARE the record takes a CARRY: the bytes move verbatim, their own signatures travel
 * with them, and the destination's fold judges them exactly as the source's did. A quorum-signed ban carries.
 *
 * A board whose entries PROJECT a record kept elsewhere takes a RE-ANNOUNCE: the projection re-derives from
 * the record's current state onto the new address. Copying such a row launders it, since the row carries no
 * signature to re-check. The crossroads announce reads as this kind.
 *
 * ── TWO PER-NEXUS BOARDS TAKE NEITHER ──────────────────────────────────────────────────────────────
 * A migration compiles an about-set at a new address, which the registry filter refuses. So:
 *
 *   · WHO — NEITHER. `whoFaceCap` takes no card and publishes nothing; the card announce stays a deliberate
 *     act the holder chooses, never a boot side-effect. A card announced at a private nexus of one reached
 *     nobody, and re-landing it on a shared island would disclose a face its holder never published there.
 *     An empty WHO board names nobody, the correct default. Crossing re-announces by an act (`handle`).
 *   · CARRIAGE — NEITHER. An allow takes a fresh consent at the new epoch. Its loss fails closed (every
 *     cross-operator reads as a stranger), so leaving it costs availability and never safety.
 *
 * ── WHAT NEVER RIDES A NEXUS KEY, AND SO NEVER CLIMBS ──────────────────────────────────────────────
 * A realm's vouch board and edge board key on the realm's own id, and a fleet's edge board keys on the fleet
 * root (`deterministic-doc`). A climb re-keys none of them, so a shadow stands across every climb with no
 * carry at all (kapae#/four-edges).
 *
 * ── THE ANTIGEN FAILS OPEN WHEN EMPTY, so it carries ───────────────────────────────────────────────
 * An empty antigen bans nobody, which re-admits a Kapae'd presenter. The board federates on the mandatory
 * tier, so an island with other members heals by sync, bounded by sync latency; a vessel that climbs onto an
 * island where it stands first heals from nobody. The carry closes that.
 *
 * ── THE EPOCH LAW MAKES THE ANTIGEN CARRY SELF-LIMITING ────────────────────────────────────────────
 * `makeMultiSigQuorumVerifier` refuses an entry whose `sealEpochCid` differs from the roster's. A carry
 * across a charter change moves bytes that never count, and a carry across a re-key that keeps the charter
 * moves bytes that count exactly as they did. The carry grants nothing: it moves bytes, and the fold decides.
 *
 * ── THE GRADIENT LAW HOLDS BY CONSTRUCTION ─────────────────────────────────────────────────────────
 * Every source comes from `nexusIslandsBelow`, which reads empty at the bottom of the gradient and empty
 * when TORN, so nothing ever descends. A torn island never reaches here: `nexusScopeOrThrow` refuses before
 * any board gets addressed.
 *
 * ── A MONOTONE SET UNIONS; A CHAIN TAKES THE FIRST ─────────────────────────────────────────────────
 * The KEL carry stops at the first island below that holds the chain, one object. An accretive SET differs:
 * each island below may hold acts the others never saw, so this carry reads every island below and unions.
 *
 * ── IDEMPOTENT, since a boot-time migration runs every boot ────────────────────────────────────────
 * Every act writes only what the destination lacks. A key already standing stays exactly as it stands.
 *
 * Platform-blind: rides ./deterministic-doc + ./base-doc + ./realm-bag only. NO node: imports — a browser
 * leaf climbing from its own island to the anchor it dials composes the identical call. A leaf's gradient
 * runs three rungs (own → anchor → explicit) where a node's runs two, and its crossroads re-announce stands
 * inert: a leaf keeps no seal home, holds no charter, and passes `realmId: null`.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/nexus-identity
 */
import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { type LarDoc, tiddlerText } from "./base-doc.js";
import { kapaeAntigenDocUrl, crossroadsDocUrl, materializeSharedLarDoc } from "./deterministic-doc.js";
import { ANTIGEN_ENTRY_PREFIX } from "./antigen-board.js";
import {
  crossroadsAnnounceOf, foldRealmBags, realmBagAnnounceKey, realmDocUrl,
} from "./realm-bag.js";
import { storedLarRecord } from "./stored-record.js";

/** What one act of the climb did. `from` names the islands actually READ, so a caller can say where it looked. */
export interface BoardClimbResult {
  /** Which board moved — the name a log line and a test both read. */
  readonly board:  "antigen" | "crossroads";
  /** CARRY moves bytes verbatim; RE-ANNOUNCE re-derives a projection from the record it projects. */
  readonly act:    "carry" | "re-announce";
  /** How many entries CHANGED the destination. Zero on every boot after the one that landed them. */
  readonly landed: number;
  /** The islands this act read, in the order it read them (empty ⇒ nothing below, or nothing to read). */
  readonly from:   readonly string[];
}

/** The whole climb, one act per board that moves. A board left DELIBERATELY un-migrated appears nowhere. */
export interface NexusBoardClimb {
  readonly acts: readonly BoardClimbResult[];
  /** The total that changed a destination — 0 means the climb had nothing to do, which is most boots. */
  readonly landed: number;
}

/** A source island that will not open names no source — say so and keep walking down. */
function sourceFault(board: string, island: string, err: unknown): void {
  console.warn(`[${board}] the island below (${island.slice(0, 18)}…) would not open: `
             + `${(err as Error)?.message ?? String(err)}`);
}

/**
 * Carry every accretive entry under one prefix from the islands BELOW onto the island this boot resolved.
 *
 * The board stores one entry per tiddler under a prefix and keys that tiddler by the entry's own identity,
 * so distinct acts ACCRETE rather than overwrite, and it leaves adjudication entirely to a fold the
 * destination runs. So the move copies, by prefix, the keys the destination lacks.
 *
 * IT NEVER LOWERS A GATE. The text lands verbatim — its own signatures, its own epoch root — so every
 * verifier judges it identically on both boards. It mints nothing and admits nobody.
 * IT NEVER EMPTIES THE SOURCE. A carry copies; the island below keeps every act it held.
 * IT NEVER OVERWRITES. A key already standing at the destination stays as it stands.
 */
async function carryAccretiveBoard(opts: {
  repo:         Repo;
  board:        BoardClimbResult["board"];
  urlOf:        (island: string) => AutomergeUrl;
  label:        string;
  prefix:       string;
  nexusPubkey:  string;
  priorIslands: readonly string[];
}): Promise<BoardClimbResult> {
  const { repo, board, urlOf, label, prefix, nexusPubkey, priorIslands } = opts;
  if (priorIslands.length === 0) return { board, act: "carry", landed: 0, from: [] };

  const open = (island: string): Promise<DocHandle<LarDoc>> =>
    materializeSharedLarDoc(repo, urlOf(island), label);

  const destination = await open(nexusPubkey);
  const standing = new Set(Object.keys(destination.doc()?.tiddlers ?? {}));

  // Gather across EVERY island below — an accretive set unions, it does not take the first match.
  const incoming = new Map<string, string>();
  const read: string[] = [];
  for (const island of priorIslands) {
    let doc: LarDoc | undefined;
    try { doc = (await open(island)).doc(); }
    catch (err) { sourceFault(board, island, err); continue; }
    read.push(island);
    for (const [key, record] of Object.entries(doc?.tiddlers ?? {})) {
      if (!key.startsWith(prefix)) continue;      // a foreign tiddler on the board is not this board's content
      if (standing.has(key)) continue;            // already at the destination — never overwritten
      if (incoming.has(key)) continue;            // a higher island below already supplied this exact act
      const text = tiddlerText(record);
      if (text === null) continue;                // a torn record carries no act to move
      incoming.set(key, text);
    }
  }

  if (incoming.size > 0) {
    destination.change((draft) => {
      for (const [key, text] of incoming) {
        draft.tiddlers[key] = storedLarRecord(key, { text }, `board-climb:${nexusPubkey.slice(0, 18)}`);
      }
    });
    console.log(`[${board}] carried ${incoming.size} entr${incoming.size === 1 ? "y" : "ies"} up the gradient — `
              + `from ${read.length} island(s) below onto ${nexusPubkey.slice(0, 18)}…. The bytes moved verbatim; `
              + "the destination's own fold judges them exactly as the board below did.");
  }
  return { board, act: "carry", landed: incoming.size, from: read };
}

/**
 * THE ANTIGEN CARRY — the immune memory a climb would otherwise drop.
 *
 * A deny may be shared: the set is MONOTONE, so a carry can only ever TIGHTEN this vessel, and the quorum
 * epoch check keeps it honest without a line of epoch logic here (an entry rooting on a charter epoch the
 * destination's roster does not name is IGNORED at the fold). Losing it fails OPEN — a Kapae'd presenter
 * re-admitted — which is why it moves at all.
 */
export function carryAntigenUpTheGradient(opts: {
  repo: Repo; nexusPubkey: string; priorIslands: readonly string[];
}): Promise<BoardClimbResult> {
  return carryAccretiveBoard({
    ...opts, board: "antigen", urlOf: kapaeAntigenDocUrl,
    label: "board:kapae-antigen", prefix: ANTIGEN_ENTRY_PREFIX,
  });
}

/**
 * THE CROSSROADS RE-ANNOUNCE — and the reason a CARRY here would be a fault rather than a shortcut.
 *
 * The announce carries NO signature: `crossroadsAnnounceOf` strips the record down to `{kind, bagUri, keptBy}`
 * plus, for a PUBLIC-tier book alone, its `docUrl`. The n-of-n-signed registration stays on the REALM doc.
 * So a copied row has nothing a reader could re-check, and three different stale rows would arrive wearing
 * the same clothes as a live one:
 *   · a row whose registration was later replaced or EQUIVOCATED (two counted records naming different docs
 *     fold to UNREGISTERED — a carried row would keep announcing the ford the fold withdrew),
 *   · a row whose registration LAPSED past its lease,
 *   · and the sharp one — a row belonging to ANOTHER REALM. The realm doc's id is the charter's genesis
 *     epoch, which is the same value as the CHARTER ISLAND scope, so an island below that was a different
 *     charter was a different realm. `RealmBagRegistration.realmId` exists because "a record carried onto
 *     another realm's doc never counts"; a carried ANNOUNCE would carry exactly what the record refuses to.
 *
 * Re-deriving closes all three at once. The projection is recomputed from `foldRealmBags` — the counted,
 * non-equivocal registrations of the realm THIS vessel stands in — so the new board states current truth
 * about one realm and nothing else. A book the realm never registered cannot appear, and a book the realm
 * still keeps cannot be missed.
 *
 * The reachable case, named honestly: `register` refuses without a realm, and a realm exists only where a
 * charter does, so a vessel at its own island holds no realm books to lose. The climb that orphans them is
 * the one that moves the island while the charter STANDS — an explicit scope named above a standing charter.
 * There the realm doc keeps every registration and the crossroads board mints blank, and this is the cure.
 * At an own→charter climb it does the other useful thing: it states the realm's books, including a peer's
 * that synced in, onto the board the island actually reads.
 */
export async function reAnnounceRealmBooksAtIsland(opts: {
  repo:        Repo;
  /** The island this boot RESOLVED — the crossroads board the announce lands on. */
  nexusPubkey: string;
  /** The realm this vessel stands in (`nexusAidOf`). Null/absent ⇒ no realm, so nothing to announce. */
  realmId:     string | null | undefined;
}): Promise<BoardClimbResult> {
  const { repo, nexusPubkey, realmId } = opts;
  const nothing: BoardClimbResult = { board: "crossroads", act: "re-announce", landed: 0, from: [] };
  if (!realmId) return nothing;   // a vessel outside every realm announces nothing — it registers nothing either

  let realmDoc: LarDoc | undefined;
  try { realmDoc = (await materializeSharedLarDoc(repo, realmDocUrl(realmId), "realm")).doc(); }
  catch (err) { sourceFault("crossroads", realmId, err); return nothing; }

  const standing = await foldRealmBags(realmDoc, realmId);
  if (standing.size === 0) return { ...nothing, from: [realmId] };

  const board = await materializeSharedLarDoc(repo, crossroadsDocUrl(nexusPubkey), "board:crossroads");
  const already = board.doc()?.tiddlers ?? {};
  // Write only what the board does not already STATE — the projection is content-addressed by its own text,
  // so an unchanged announce writes nothing and the every-boot run has no second effect.
  const owed = new Map<string, string>();
  for (const rec of standing.values()) {
    const key  = realmBagAnnounceKey(rec.bagUri);
    const text = JSON.stringify(crossroadsAnnounceOf(rec));
    if (tiddlerText(already[key]) === text) continue;
    owed.set(key, text);
  }
  if (owed.size > 0) {
    board.change((draft) => {
      for (const [key, text] of owed) {
        draft.tiddlers[key] = storedLarRecord(key, { text }, "board-climb:re-announce");
      }
    });
    console.log(`[crossroads] re-announced ${owed.size} book(s) of realm ${realmId.slice(0, 18)}… onto island `
              + `${nexusPubkey.slice(0, 18)}…. Re-derived from the realm's counted registrations, never copied `
              + "from a lower board — the announce carries no signature a reader could re-check.");
  }
  return { board: "crossroads", act: "re-announce", landed: owed.size, from: [realmId] };
}

/**
 * THE ONE DOOR a boot walks — every board a climb moves, in one call, after the island resolved.
 *
 * Call it AT BOOT and never at the rite, for the reason the KEL carry already records: a rite-time migration
 * would have to fire at every act that can move an island, and the path nobody thought of is precisely the
 * one that leaves a vessel broken — while a vessel ALREADY climbed would have no remedy at all. Read at boot
 * the climb is DERIVED from the state rather than enumerated from the acts.
 *
 * A board this refuses to migrate (WHO · carriage · vouch) appears in no result, deliberately. Adding one
 * here is adding a compiled about-set at a new address, and the module header says why for each.
 */
export async function climbNexusBoards(opts: {
  repo:         Repo;
  /** The island this boot RESOLVED (`nexusScopeOrThrow` — a TORN standing never reaches here). */
  nexusPubkey:  string;
  /** The islands beneath it (`nexusIslandsBelow`). Empty ⇒ standing at the bottom, or torn: nothing moves. */
  priorIslands: readonly string[];
  /** The realm this vessel stands in (`nexusAidOf`), for the crossroads re-announce alone. */
  realmId?:     string | null;
}): Promise<NexusBoardClimb> {
  const acts: BoardClimbResult[] = [
    await carryAntigenUpTheGradient(opts),
    await reAnnounceRealmBooksAtIsland({ repo: opts.repo, nexusPubkey: opts.nexusPubkey, realmId: opts.realmId }),
  ];
  return { acts, landed: acts.reduce((n, a) => n + a.landed, 0) };
}
