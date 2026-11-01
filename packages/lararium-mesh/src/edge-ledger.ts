/**
 * edge-ledger — what ONE vessel has counted on the edge boards it reads, kept in a document of its own.
 *
 * ACTS ONLY ACCRETE, AND THE READER MAKES IT SO (kapae#/accretion). A board holds documents any writer may
 * edit, so a hand can delete a raise from it. Every vessel therefore keeps each act and each anchor it has
 * counted, folds the board together with what it kept (`readEdgeBoard`), and writes a kept act back onto a
 * board that lost it. A delete changes no reading at a vessel that once counted the raise.
 *
 * The ledger also remembers two things no board can: which quorum acts this vessel counted while their epoch
 * still stood as its charter head (`seen` — a raise so marked keeps counting across a roll, kapae#/rolls), and
 * which raises this vessel already answered on the key side (`rolled` — every counted raise owes one roll of
 * the seat it names at each acting vessel, once, kapae#/keys).
 *
 * It holds signed acts and signed rolls, and nothing compiled about anyone. It crosses to no peer: the vessel classes
 * it `vessel-private` under the `device` owner, which no relation opens (road `T33`).
 *
 * A ROLL MARK COUNTS ONLY UNDER ITS RECEIPT (road `T33`). Each `rolled/<raise>` row holds the whole roll this vessel's
 * own island signed, and every reader counts a row only where that receipt verifies under the ledger's own key and
 * the roll answers that raise. A row a hand planted answers nothing, and never blocks the genuine mark.
 *
 * `readLedgeredEdgeBoard` gives every shore the ONE read a door takes: the board replica and the ledger, in one
 * call, keeping what counted and restoring what the board lost. A node and a browser leaf compose the same call.
 *
 * Platform-blind: rides ./base-doc + ./edge-kapae + ./deterministic-doc. NO node: imports.
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/accretion
 */
import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import type { LarDoc } from "./base-doc.js";
import { edgeLedgerDocUrl, materializeSharedLarDoc, realmVouchBoardDocUrl } from "./deterministic-doc.js";
import type { CabalInvite } from "./cabal-invite.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { verifiedVouchesFromBoard, verifiedVouchesFromRecords, vouchEdgeId, vouchEntryKey, writeVouch } from "./vouch-board.js";
import { tiddlerText } from "./base-doc.js";
import { storedLarRecord } from "./stored-record.js";
import { NEXUS_AID_PATTERN } from "./wax-stamp.js";
import { verifiedSeatRoll, type SignedSeatRoll } from "./seat-duties.js";
import {
  edgeKapaeActsFromRecords, edgeRollAnchorsFromRecords, edgeRollAnchorCid, writeEdgeKapae, writeEdgeRollAnchor, mergeEdgeActs, mergeEdgeRollAnchors,
  readEdgeBoard, type CountedEdgeBoard, type EdgeAuthority, type EdgeBoardRead, type EdgeCharter, type EdgeKapae, type EdgeRollAnchor, type KeptEdgeRows,
} from "./edge-kapae.js";

/** The tiddler-key prefix every ledger row rides under: `<prefix><scope>/<act|anchor|rolled>/<cid>`. */
export const EDGE_LEDGER_PREFIX = "lar:///ha.ka.ba/dreamnet/edge-ledger/" as const;

const rowKey = (scope: string, kind: "act" | "anchor" | "rolled" | "seen" | "realm" | "vouch" | "nexus", cid: string): string =>
  `${EDGE_LEDGER_PREFIX}${scope}/${kind}/${cid}`;

/** The ledger's stored rows of one kind for one board. */
function rowsOf(ledger: LarDoc | undefined | null, scope: string, kind: "act" | "anchor") {
  const prefix = `${EDGE_LEDGER_PREFIX}${scope}/${kind}/`;
  return Object.entries(ledger?.tiddlers ?? {}).filter(([key]) => key.startsWith(prefix)).map(([, record]) => record);
}

/** The `<cid> → text` rows of one marker kind for one board. */
function marksOf(ledger: LarDoc | undefined | null, scope: string, kind: "rolled" | "seen"): Map<string, string> {
  const prefix = `${EDGE_LEDGER_PREFIX}${scope}/${kind}/`;
  const out = new Map<string, string>();
  for (const [key, record] of Object.entries(ledger?.tiddlers ?? {})) {
    if (!key.startsWith(prefix)) continue;
    const text = tiddlerText(record);
    if (text !== null) out.set(key.slice(prefix.length), text);
  }
  return out;
}

/** What this vessel kept for one board. Shape only: `readEdgeBoard` counts every kept act again. */
export function keptFromLedger(ledger: LarDoc | undefined | null, scope: string): KeptEdgeRows {
  return {
    acts:       edgeKapaeActsFromRecords(rowsOf(ledger, scope, "act")),
    anchors:    edgeRollAnchorsFromRecords(rowsOf(ledger, scope, "anchor")),
    seenAtHead: marksOf(ledger, scope, "seen"),
  };
}

/**
 * Remember that this vessel reads one REALM's boards: it vouched there, crossed there, or acted on an edge
 * there. The vessel's own note of its own relations, kept where no other operator reads it; the gates read the
 * boards of every realm so noted. Call INSIDE a `handle.change()` callback.
 *
 * A REALM STANDS UNDER ONE NEXUS (kapae#/edge-hands). An ACT names that Nexus (`nexusAid`, the AID of the
 * charter the realm's quorum answers to), and the first act's word stands: a later act never adds a second pin,
 * so no other Nexus's quorum ever counts on this realm's boards here. Each pin rests under a key of its own, so
 * two replicas that each pinned a different Nexus before they met keep BOTH pins, and the realm then reads as
 * conflicted (`ledgerRealmNexus` answers none) until a person settles it. A READ notes the realm and pins nothing.
 */
export function noteRealm(draft: LarDoc, realm: string, nexusAid?: string): void {
  const scope = realm.trim().toLowerCase();
  const key = rowKey(scope, "realm", "known");
  if (draft.tiddlers[key] === undefined) draft.tiddlers[key] = storedLarRecord(key, { text: "realm" }, "edge-ledger");
  if (nexusAid === undefined) return;
  const aid = nexusAid.trim().toLowerCase();
  if (!NEXUS_AID_PATTERN.test(aid)) throw new Error(`edge-ledger: a realm stands under a Nexus AID, and "${nexusAid}" reads as none`);
  if (ledgerRealmNexuses(draft, scope).length > 0) return;
  const pin = rowKey(scope, "nexus", aid);
  draft.tiddlers[pin] = storedLarRecord(pin, { text: aid }, "edge-ledger");
}

/** Every Nexus pin the ledger holds for a realm, sorted: none, one, or (after two replicas met) a conflict. */
export function ledgerRealmNexuses(ledger: LarDoc | undefined | null, realm: string): string[] {
  const prefix = `${EDGE_LEDGER_PREFIX}${realm.trim().toLowerCase()}/nexus/`;
  const out = new Set<string>();
  for (const [key, record] of Object.entries(ledger?.tiddlers ?? {})) {
    if (!key.startsWith(prefix)) continue;
    const aid = key.slice(prefix.length);
    // A pin reads only where its key and its text name the same Nexus AID.
    if (NEXUS_AID_PATTERN.test(aid) && tiddlerText(record)?.trim().toLowerCase() === aid) out.add(aid);
  }
  return [...out].sort();
}

/**
 * The Nexus a realm stands under at this vessel: the one AID its first act pinned, or null where no act pinned
 * one OR two pins conflict. A null reads no quorum hand on that realm's boards.
 */
export function ledgerRealmNexus(ledger: LarDoc | undefined | null, realm: string): string | null {
  const pins = ledgerRealmNexuses(ledger, realm);
  return pins.length === 1 ? pins[0]! : null;
}

/** The realms this vessel noted. Sorted. */
export function ledgerRealms(ledger: LarDoc | undefined | null): string[] {
  const out = new Set<string>();
  for (const key of Object.keys(ledger?.tiddlers ?? {})) {
    if (!key.startsWith(EDGE_LEDGER_PREFIX)) continue;
    const m = /^([^/]+)\/realm\/known$/.exec(key.slice(EDGE_LEDGER_PREFIX.length));
    if (m) out.add(m[1]!);
  }
  return [...out].sort();
}

/** Every board this vessel has kept an act or an anchor for — what a seal roll anchors (kapae#/rolls). */
export function ledgerScopes(ledger: LarDoc | undefined | null): string[] {
  const scopes = new Set<string>();
  for (const key of Object.keys(ledger?.tiddlers ?? {})) {
    if (!key.startsWith(EDGE_LEDGER_PREFIX)) continue;
    const m = /^([^/]+)\/(?:act|anchor)\//.exec(key.slice(EDGE_LEDGER_PREFIX.length));
    if (m) scopes.add(m[1]!);
  }
  return [...scopes].sort();
}

/**
 * Keep what a read counted. Call INSIDE a `handle.change()` callback. Returns how many rows it added.
 *
 * `headEpochCid` names the charter head this vessel held at the read. A quorum act of that same epoch gets
 * marked as SEEN AT HEAD, once and for good: after a roll the mark lets this vessel keep counting a raise it
 * counted before the roll, anchored or not. An act first met after its epoch rolled never earns the mark.
 */
export function keepInLedger(draft: LarDoc, scope: string, counted: CountedEdgeBoard, headEpochCid?: string): number {
  let added = 0;
  const put = (key: string, value: EdgeKapae | EdgeRollAnchor) => {
    if (draft.tiddlers[key] !== undefined) return;
    draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(value) }, scope);
    added++;
  };
  for (const a of counted.acts) {
    // One row per act, its signatures gathered: a row grows when a read counted more signatures than it holds.
    const key = rowKey(scope, "act", a.actCid);
    const [have] = draft.tiddlers[key] !== undefined ? edgeKapaeActsFromRecords([draft.tiddlers[key]!]) : [];
    if (have === undefined) put(key, a);
    else {
      const [merged] = mergeEdgeActs([have, a]);
      if (merged!.signatures.length > have.signatures.length) { draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(merged) }, scope); added++; }
    }
    if (headEpochCid === undefined || a.hand !== "quorum" || a.epochCid !== headEpochCid) continue;
    const seen = rowKey(scope, "seen", a.actCid);
    if (draft.tiddlers[seen] === undefined) draft.tiddlers[seen] = storedLarRecord(seen, { text: headEpochCid }, scope);
  }
  for (const a of counted.anchors) {
    const key = rowKey(scope, "anchor", edgeRollAnchorCid(a));
    const [have] = draft.tiddlers[key] !== undefined ? edgeRollAnchorsFromRecords([draft.tiddlers[key]!]) : [];
    if (have === undefined) put(key, a);
    else {
      const [merged] = mergeEdgeRollAnchors([have, a]);
      if (merged!.signatures.length > have.signatures.length) { draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(merged) }, scope); added++; }
    }
  }
  return added;
}

/** Write kept acts and anchors back onto a board that lost them. Call INSIDE a `handle.change()` callback. */
export function restoreToBoard(draft: LarDoc, missing: CountedEdgeBoard): number {
  for (const a of missing.acts) writeEdgeKapae(draft, a);
  for (const a of missing.anchors) writeEdgeRollAnchor(draft, a);
  return missing.acts.length + missing.anchors.length;
}

/**
 * The roll marks one board holds that THIS vessel signed: raise cid → the roll, receipt and all. A row counts only
 * where its receipt verifies under `vesselKey` (the key the ledger is named by), its scope names this board, and its
 * raises name the row's own raise. Every other row (no receipt, another key's, one altered after signing) reads as
 * no mark at all.
 */
export function verifiedRollMarks(ledger: LarDoc | undefined | null, scope: string, vesselKey: string): Map<string, SignedSeatRoll> {
  const out = new Map<string, SignedSeatRoll>();
  const board = scope.trim().toLowerCase();
  for (const [raiseCid, text] of marksOf(ledger, scope, "rolled")) {
    const roll = signedRollOf(text, vesselKey);
    if (roll === null || roll.scope.trim().toLowerCase() !== board || !roll.raiseCids.some((c) => c.toLowerCase() === raiseCid.toLowerCase())) continue;
    out.set(raiseCid, roll);
  }
  return out;
}

/** One row's text as a roll this vessel signed, or null. */
function signedRollOf(text: string, vesselKey: string): SignedSeatRoll | null {
  let parsed: unknown = null;
  try { parsed = JSON.parse(text); } catch { return null; }
  const roll = verifiedSeatRoll(parsed, vesselKey);
  return roll === null ? null : { ...roll, receipt: (parsed as { receipt: string }).receipt };
}

/** The raises this vessel already answered on the key side, for one board: its own signed marks alone. */
export function rolledRaises(ledger: LarDoc | undefined | null, scope: string, vesselKey: string): Set<string> {
  return new Set(verifiedRollMarks(ledger, scope, vesselKey).keys());
}

/**
 * Remember that this vessel answered one raise on the key side, and HOW. The row holds the signed roll itself, so the
 * ledger doubles as the roll's durable record: a subscriber that stands later reads every roll this vessel kept
 * (`keptSeatRolls`), whether or not anyone listened when the key act ran. Call INSIDE a `handle.change()` callback,
 * with a roll whose receipt the caller already verified under this vessel's key (`verifiedSeatRoll`).
 *
 * The first SIGNED answer stands, with one step up: a seat this vessel could not revoke may leave later under the hand
 * that seated it, and the row then takes that later answer. A row standing there that verifies under no key of this
 * vessel holds nothing, so the genuine answer lands over it.
 */
export function markRaiseRolled(draft: LarDoc, scope: string, raiseCid: string, roll: SignedSeatRoll, vesselKey: string): void {
  const key = rowKey(scope, "rolled", raiseCid);
  const had = draft.tiddlers[key] !== undefined ? signedRollOf(tiddlerText(draft.tiddlers[key]!) ?? "", vesselKey) : null;
  if (had !== null && (had.how !== "no-authority" || roll.how === "no-authority")) return;
  const text = JSON.stringify({
    kind: roll.kind, scope: roll.scope, edgeId: roll.edgeId, raiseCids: [...roll.raiseCids], how: roll.how,
    ...(roll.seat ? { seat: { group: roll.seat.group, member: roll.seat.member } } : {}), receipt: roll.receipt,
  });
  draft.tiddlers[key] = storedLarRecord(key, { text }, scope);
}

/**
 * The raises whose seat this vessel SAW LEAVE, for one board: revoked here, or gone already, under its own signed
 * mark. A raise it answered with no authority over the seat stays out: that seat may still stand, so the raise stays
 * owed here, and this vessel tries it again at each settle until it sees the seat leave.
 */
export function raisesSeenThrough(ledger: LarDoc | undefined | null, scope: string, vesselKey: string): Set<string> {
  const out = new Set<string>();
  for (const [raiseCid, roll] of verifiedRollMarks(ledger, scope, vesselKey)) if (roll.how !== "no-authority") out.add(raiseCid);
  return out;
}

/**
 * Every roll this vessel kept and signed for one board, one per raise, sorted by raise, each with its receipt. THE
 * CONTENT-KEY SEAM'S DURABLE HALF (kapae#/keys): a subscriber catches up from here and verifies each receipt again.
 */
export function keptSeatRolls(ledger: LarDoc | undefined | null, scope: string, vesselKey: string): SignedSeatRoll[] {
  return [...verifiedRollMarks(ledger, scope, vesselKey)].sort(([a], [b]) => a.localeCompare(b)).map(([, roll]) => roll);
}

/** One read of one edge board as one vessel, with the handles a door goes on to write through. */
export interface LedgeredEdgeBoardRead extends EdgeBoardRead {
  /** The board's own handle, for a door that goes on to write an act. */
  readonly handle:   DocHandle<LarDoc>;
  /** The vessel's ledger handle, for a door that marks a raise answered. */
  readonly ledger:   DocHandle<LarDoc>;
  /** How many kept acts and anchors this read wrote back onto the board. */
  readonly restored: number;
}

/**
 * Read one edge board as one vessel: union the replica with the ledger's rows for `scope`, count, fold, keep
 * what counted, and restore what the board lost. A REALM's board gets noted in the ledger, so the vessel's gates
 * read it from then on.
 */
export async function readLedgeredEdgeBoard(opts: {
  readonly repo:         Repo;
  /** The board's scope: a realm id, or a fleet root. It keys the ledger's rows and binds the anchors. */
  readonly scope:        string;
  readonly kind:         "realm" | "fleet";
  readonly boardUrl:     AutomergeUrl;
  /** A name for a human, in the boot resolver's own text (`board:<what-it-carries>`). */
  readonly label:        string;
  /** This vessel's own verifying key: it names the ledger. */
  readonly vesselKey:    string;
  readonly authorityFor: (edgeId: string) => EdgeAuthority | undefined;
  readonly charter?:     EdgeCharter | null;
}): Promise<LedgeredEdgeBoardRead> {
  const handle = await materializeSharedLarDoc(opts.repo, opts.boardUrl, opts.label);
  const ledger = await materializeSharedLarDoc(opts.repo, edgeLedgerDocUrl(opts.vesselKey), "ledger:edge");
  const read = await readEdgeBoard({
    board: handle.doc(), kept: keptFromLedger(ledger.doc(), opts.scope),
    authorityFor: opts.authorityFor, ...(opts.charter !== undefined ? { charter: opts.charter } : {}),
  });
  const noted = opts.kind === "realm" && !ledgerRealms(ledger.doc()).includes(opts.scope.trim().toLowerCase());
  if (noted || read.counted.acts.length + read.counted.anchors.length > 0) {
    ledger.change((d) => {
      if (opts.kind === "realm") noteRealm(d, opts.scope);
      keepInLedger(d, opts.scope, read.counted, opts.charter?.head.sealEpochCid);
    });
  }
  let restored = 0;
  if (read.missing.acts.length + read.missing.anchors.length > 0) {
    handle.change((d) => { restored = restoreToBoard(d, read.missing); });
  }
  return { ...read, handle, ledger, restored };
}

/**
 * Read one realm's vouch board as one vessel: the verifying read over the board replica AND over the vouches
 * this vessel kept, with what it read kept in turn and a kept vouch written back onto a board that lost it.
 *
 * A VOUCH ACCRETES LIKE AN ACT (kapae#/accretion). A member's standing reads off the vouches that name it, so a
 * hand that deleted a withdrawn vouch from the board would erase the very record that says its joiner entered
 * by that vouch. At a vessel that once read the vouch, the delete changes nothing.
 */
export async function readLedgeredVouches(opts: {
  readonly repo:      Repo;
  readonly realm:     string;
  readonly vesselKey: string;
}): Promise<{ readonly invites: readonly CabalInvite[]; readonly handle: DocHandle<LarDoc>; readonly restored: number }> {
  const realm = opts.realm.trim().toLowerCase();
  // Each vouch reads through the house's one Ed25519 door, under the voucher key the vouch itself names.
  const throughTheDoor = (bytes: Uint8Array, sigHex: string, voucherDid: string): Promise<boolean> =>
    Promise.resolve(verifyEd25519(sigHex, bytes, voucherDid.replace(/^0x/, "")));
  const handle = await materializeSharedLarDoc(opts.repo, realmVouchBoardDocUrl(realm), "board:vouch-registry");
  const ledger = await materializeSharedLarDoc(opts.repo, edgeLedgerDocUrl(opts.vesselKey), "ledger:edge");
  const onBoard = await verifiedVouchesFromBoard(handle.doc(), realm, throughTheDoor);
  const prefix = `${EDGE_LEDGER_PREFIX}${realm}/vouch/`;
  const keptRows = Object.entries(ledger.doc()?.tiddlers ?? {}).filter(([key]) => key.startsWith(prefix)).map(([, record]) => record);
  const kept = await verifiedVouchesFromRecords(keptRows, realm, throughTheDoor);
  const byEdge = new Map<string, CabalInvite>();
  for (const i of [...onBoard, ...kept]) if (!byEdge.has(vouchEdgeId(i))) byEdge.set(vouchEdgeId(i), i);
  const keptEdges = new Set(kept.map(vouchEdgeId)), boardEdges = new Set(onBoard.map(vouchEdgeId));
  const toKeep = onBoard.filter((i) => !keptEdges.has(vouchEdgeId(i)));
  const noted = !ledgerRealms(ledger.doc()).includes(realm);
  if (toKeep.length > 0 || noted) {
    ledger.change((d) => {
      noteRealm(d, realm);
      for (const i of toKeep) {
        const key = rowKey(realm, "vouch", vouchEdgeId(i));
        if (d.tiddlers[key] === undefined) d.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(i) }, realm);
      }
    });
  }
  const missing = kept.filter((i) => !boardEdges.has(vouchEdgeId(i)));
  if (missing.length > 0) {
    handle.change((d) => {
      for (const i of missing) {
        // Never overwrite a record standing at the vouch's own key: a re-issue by the same voucher lives there.
        if (d.tiddlers[vouchEntryKey(i.realmDocIdHex, i.voucherDid, i.joinerIdentityHex)] === undefined) writeVouch(d, i);
      }
    });
  }
  return { invites: [...byEdge.values()], handle, restored: missing.length };
}

