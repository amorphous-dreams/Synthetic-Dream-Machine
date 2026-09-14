/**
 * nexus-board-climb — the boards a CLIMB moves, and the two different acts that move them.
 *
 * `nexusScopeMoved` names the shape: connecting re-keys every per-Nexus board, nothing carries across on
 * its own, and the design stopped one step short of the cure. `carryPersonaKelUpTheGradient` took that step
 * for the ONE board that refuses rather than degrades. This takes it for the rest — and the first finding is
 * that "the rest" is not one act but THREE, and that three of the seven boards must be left exactly where
 * they are.
 *
 * ── CARRY ⊥ RE-ANNOUNCE, and the difference is WHERE THE TRUTH LIVES ────────────────────────────────
 * A board whose entries ARE the record wants a CARRY: the bytes move verbatim, their own signatures travel
 * with them, and the destination's fold judges them exactly as the source's did. A KEL chain carries. A
 * raised shadow carries. A quorum-signed ban carries.
 *
 * A board whose entries are a PROJECTION of a record kept elsewhere wants a RE-ANNOUNCE: the projection is
 * re-derived from the record's CURRENT state onto the new address. Copying such a row launders it — the row
 * carries no signature to re-check, so a stale, revoked or foreign-realm row would arrive wearing the same
 * clothes as a live one. The crossroads announce is this kind.
 *
 * ── AND THREE BOARDS WANT NEITHER, which is the finding worth more than the code ───────────────────
 * The register the laws forbid is not a board; it is a COMPILED ABOUT-SET at a new address. A migration is
 * exactly the act that compiles one. So:
 *
 *   · WHO — DELIBERATELY NEITHER. `whoFaceCap` takes no card and publishes nothing: "composing a cap is
 *     binding, and binding never announces", and the card announce is "a deliberate act the holder chooses,
 *     NEVER a boot side-effect". A boot-time re-announce would break that law in the one place it matters
 *     most — a card announced at a PRIVATE NEXUS OF ONE reached nobody, and re-landing it on a shared
 *     island DISCLOSES a face to strangers the operator never published to. An empty WHO board naming
 *     nobody reads as the correct default, not as damage. Crossing re-announces BY AN ACT (`handle`), and
 *     the card's island-blind signature is what makes that act cheap.
 *   · CARRIAGE — DELIBERATELY NEITHER. The ALLOW-twin, and the asymmetry is law: "a deny may be shared, an
 *     allow wants a fresh consent… an admit only ever WIDENS whom a vessel carries for, and an operator
 *     consents at ONE epoch." A roster of who belongs IS a global invariant, and the board is the one
 *     roster-shaped surface in the stack. Its loss FAILS CLOSED (the seated-kahu floor alone stands, every
 *     cross-operator a stranger), so leaving it costs availability and never safety. The operator
 *     re-contracts by an act at the new epoch, which is the fresh consent the law asks for.
 *   · VOUCH — DELIBERATELY NEITHER, and for a reason the other two do not carry. The board is NOT in
 *     `DeterministicFederationGate`'s list, so no peer replica will ever correct what one vessel writes
 *     onto a fresh one. Its own law forbids exactly what a carry would manufacture: "no read in this module,
 *     and nothing built on one, may report a count as TOTAL, a set as COMPLETE." A carried PARTIAL replica
 *     becomes the whole content of the new board, and the admission price would then price a crossing off
 *     one vessel's partial view while reading it as the lineage. The honest cure is FEDERATING the vouch
 *     board, not migrating it. Naming that beats building this.
 *
 * ── WHAT THE DESIGN GOT WRONG, measured ─────────────────────────────────────────────────────────────
 * `nexusScopeMoved` reads: "Every OTHER per-Nexus board degrades gracefully across a climb: an empty
 * antigen bans nobody, an empty WHO board names nobody, an empty crossroads announces nothing. The gate
 * alone turns a moved board into a vessel that never boots again, so it is the one that is cured."
 *
 * The gate is not alone. TWO of the other six fail OPEN rather than gracefully:
 *   · EDGE-KĀPAE — an empty shadow board LOWERS EVERY SHADOW. A relationship a hand deliberately set aside
 *     stands re-admittable on the new island, which is precisely the resurrection the residency model names
 *     as anti-pattern #3 ("a re-add cannot resurrect it while the marker holds"). And unlike the antigen,
 *     nothing re-supplies it: the board is absent from the federation gate, so no peer's replica heals it.
 *     This is the highest-value board in the set, and the docblock counted it as graceful.
 *   · ANTIGEN — an empty antigen bans nobody, which reads graceful only until you notice that "bans nobody"
 *     means a Kapae'd presenter is re-admitted. It IS federated (MANDATORY tier), so an island with other
 *     members heals it by sync — bounded by sync-latency, never instantly, and never at all for the vessel
 *     that climbs onto an island where it stands first.
 *
 * ── THE EPOCH LAW MAKES THE ANTIGEN CARRY SELF-LIMITING, so it needs no epoch logic of its own ──────
 * `makeMultiSigQuorumVerifier` refuses an entry whose `sealEpochCid` differs from the roster's ("roots on an
 * unknown epoch → deny"). So a carry across a CHARTER CHANGE moves bytes that can never count, and a carry
 * across a re-key that KEEPS the charter (an explicit scope named above a standing charter — the reachable
 * case) moves bytes that count exactly as they did. The carry therefore grants nothing anywhere: it moves
 * bytes, and the fold decides, which is the same discipline the KEL carry holds. Nothing here re-signs, and
 * an entry that could not be verified on the board it came off cannot be verified on the one it lands on.
 *
 * ── THE GRADIENT LAW HOLDS BY CONSTRUCTION ──────────────────────────────────────────────────────────
 * Every source comes from `nexusIslandsBelow`, which reads empty at the bottom of the gradient and empty
 * when TORN — so nothing ever descends, and a charter that merely VANISHED moves nothing. A torn island
 * never reaches here at all: `nexusScopeOrThrow` refuses before any board is addressed, so the vessel HALTS
 * rather than re-keying onto a board it cannot name. A migration that fired on an unreadable charter would
 * descend a serving vessel in silence.
 *
 * ── A MONOTONE SET UNIONS; A CHAIN TAKES THE FIRST ──────────────────────────────────────────────────
 * `carryPersonaKelUpTheGradient` stops at the first island below that carries the chain, because a chain is
 * ONE object and the lower boards hold the same one. An accretive SET is different: each island below may
 * hold acts the others never saw, so these carries read EVERY island below and union them. That difference
 * is the only place this departs from the worked example, and it departs because the boards differ in kind.
 *
 * ── IDEMPOTENT, because a boot-time migration runs every boot ────────────────────────────────────────
 * Every act writes only what the destination LACKS. A key already standing is left exactly as it stands —
 * never overwritten, so a torn or forged variant at the destination is not replaced by a source's version
 * (the fold's business, not a migration's). Run three times, one effect.
 *
 * Platform-blind: rides ./deterministic-doc + ./base-doc + ./realm-bag only. NO node: imports — a browser
 * leaf climbing from its own island to the anchor it dials composes the identical call.
 *
 * ── AND IT NOW DOES, which took measuring rather than asserting ─────────────────────────────────────
 * That vow read ASPIRATIONAL for as long as it stood: `open-browser-vessel` composed neither this call nor
 * the KEL carry, and it is the only shore supplying `explicitScope`, so it was the only shore reaching the
 * crossroads' stated reachable case. Both carries are wired at the leaf boot now. Two differences in the
 * leaf's shape are worth carrying here, because they are the ones an analogy would get wrong:
 *   · A LEAF'S GRADIENT RUNS THREE RUNGS — own → anchor → explicit — where a node's runs two. A leaf passes
 *     no `genesisEpochCid` and no `charterStands` at all; `nexusIslandsBelow` answers that correctly, and
 *     it is verified rather than assumed (`nexus-board-climb-at-leaf`, the browser shore).
 *   · THE CROSSROADS RE-ANNOUNCE STANDS INERT AT A LEAF, which reads as the leaf's shape and not a gap: a
 *     leaf keeps no seal home, so it holds no charter, so `realmIdOfCharter` has no analogue and there is
 *     no realm to re-derive from. It passes `null`, and the guard above answers "a vessel outside every
 *     realm announces nothing — it registers nothing either." Borrowing some other id would announce
 *     ANOTHER realm's books, which is the foreign-realm laundering this act exists to refuse.
 * The KEL carry moved to `./persona-kel-climb` in the same act, for the same reason: it had the property
 * from the day it was written and sat in a package no leaf could import.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/nexus-identity
 */
import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { type LarDoc, mutableLarRecord, tiddlerText } from "./base-doc.js";
import {
  kapaeAntigenDocUrl, edgeKapaeBoardDocUrl, crossroadsDocUrl, materializeSharedLarDoc,
} from "./deterministic-doc.js";
import { ANTIGEN_ENTRY_PREFIX } from "./antigen-board.js";
import { EDGE_KAPAE_PREFIX } from "./edge-kapae.js";
import {
  crossroadsAnnounceOf, foldRealmBags, realmBagAnnounceKey, realmDocUrl,
} from "./realm-bag.js";

/** What one act of the climb did. `from` names the islands actually READ, so a caller can say where it looked. */
export interface BoardClimbResult {
  /** Which board moved — the name a log line and a test both read. */
  readonly board:  "antigen" | "edge-kapae" | "crossroads";
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
 * ONE migration model, parameterised — the antigen and the shadow board differ in what their entries MEAN
 * and not at all in how they move: each stores one entry per tiddler under a prefix, each keys that tiddler
 * by the entry's own identity so distinct acts ACCRETE rather than overwrite, and each leaves adjudication
 * entirely to a fold the destination runs. So the move is a prefix copy of the keys the destination lacks,
 * and a second implementation of the same act would only be a second place to get it wrong.
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
        draft.tiddlers[key] = mutableLarRecord(key, { text }, `board-climb:${nexusPubkey.slice(0, 18)}`);
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
 * THE SHADOW CARRY — the board whose empty state RE-ADMITS, and which no peer replica will heal.
 *
 * Remove-wins and accretive, so the carry is safe in the one direction that matters: a carried RAISE raises,
 * and a carried LOWER cannot beat a shadow raised on a chain the reader walks, because an act rooting on an
 * unknown epochCid ranks BELOW every known one. The asymmetry runs fail-closed by construction.
 */
export function carryEdgeShadowsUpTheGradient(opts: {
  repo: Repo; nexusPubkey: string; priorIslands: readonly string[];
}): Promise<BoardClimbResult> {
  return carryAccretiveBoard({
    ...opts, board: "edge-kapae", urlOf: edgeKapaeBoardDocUrl,
    label: "board:edge-kapae", prefix: EDGE_KAPAE_PREFIX,
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
  /** The realm this vessel stands in (`realmIdOfCharter`). Null/absent ⇒ no realm, so nothing to announce. */
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
        draft.tiddlers[key] = mutableLarRecord(key, { text }, "board-climb:re-announce");
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
  /** The realm this vessel stands in (`realmIdOfCharter`), for the crossroads re-announce alone. */
  realmId?:     string | null;
}): Promise<NexusBoardClimb> {
  const acts: BoardClimbResult[] = [
    await carryAntigenUpTheGradient(opts),
    await carryEdgeShadowsUpTheGradient(opts),
    await reAnnounceRealmBooksAtIsland({ repo: opts.repo, nexusPubkey: opts.nexusPubkey, realmId: opts.realmId }),
  ];
  return { acts, landed: acts.reduce((n, a) => n + a.landed, 0) };
}
