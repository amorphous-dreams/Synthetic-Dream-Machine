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
 * It holds signed acts and nothing compiled about anyone. It crosses to no other operator: no federation gate
 * names its address (`edgeLedgerDocUrl`).
 *
 * `readLedgeredEdgeBoard` gives every shore the ONE read a door takes: the board replica and the ledger, in one
 * call, keeping what counted and restoring what the board lost. A node and a browser leaf compose the same call.
 *
 * Platform-blind: rides ./base-doc + ./edge-kapae + ./deterministic-doc. NO node: imports.
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/accretion
 */
import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import type { LarDoc } from "./base-doc.js";
import { edgeLedgerDocUrl, materializeSharedLarDoc } from "./deterministic-doc.js";
import { tiddlerText } from "./base-doc.js";
import { storedLarRecord } from "./stored-record.js";
import {
  edgeKapaeActsFromRecords, edgeRollAnchorsFromRecords, edgeRollAnchorCid, writeEdgeKapae, writeEdgeRollAnchor, mergeEdgeActs, mergeEdgeRollAnchors,
  readEdgeBoard, type CountedEdgeBoard, type EdgeAuthority, type EdgeBoardRead, type EdgeCharter, type EdgeKapae, type EdgeRollAnchor, type KeptEdgeRows,
} from "./edge-kapae.js";

/** The tiddler-key prefix every ledger row rides under: `<prefix><scope>/<act|anchor|rolled>/<cid>`. */
export const EDGE_LEDGER_PREFIX = "lar:///ha.ka.ba/dreamnet/edge-ledger/" as const;

const rowKey = (scope: string, kind: "act" | "anchor" | "rolled" | "seen" | "realm", cid: string): string =>
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
 */
export function noteRealm(draft: LarDoc, realm: string): void {
  const key = rowKey(realm.trim().toLowerCase(), "realm", "known");
  if (draft.tiddlers[key] === undefined) draft.tiddlers[key] = storedLarRecord(key, { text: "realm" }, "edge-ledger");
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

/** The raises this vessel already answered on the key side, for one board. */
export function rolledRaises(ledger: LarDoc | undefined | null, scope: string): Set<string> {
  return new Set(marksOf(ledger, scope, "rolled").keys());
}

/** Remember that this vessel answered one raise on the key side. Call INSIDE a `handle.change()` callback. */
export function markRaiseRolled(draft: LarDoc, scope: string, raiseCid: string): void {
  const key = rowKey(scope, "rolled", raiseCid);
  if (draft.tiddlers[key] === undefined) draft.tiddlers[key] = storedLarRecord(key, { text: "rolled" }, scope);
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

