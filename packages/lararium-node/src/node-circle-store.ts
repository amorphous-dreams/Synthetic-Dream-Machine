/**
 * node-circle-store — the node's LOCAL adapters for the IoC follow: the private CIRCLE-membership graph and the
 * recogniser's HANDLE-BOOK. Both rest under the identity home, sealed under the vessel key, and never federate.
 *
 * "Adding to a circle IS the follow; the graph never federates; private to the owning node" (social-seed).
 * The never-federates wall stays STRUCTURAL: no board write exists on either store.
 *
 * The three identity stores stay distinct here as everywhere: the handle-book (others' nyms + the
 * recogniser's private labels) ⊥ the persona-petname map (the human's OWN faces) ⊥ the published glamour
 * (the ONE federated surface, deliberately posted). This module holds the first; it touches neither the
 * second nor the wire.
 *
 * ── AT REST ─────────────────────────────────────────────────────────────────────────────────────
 * Each row passes through the custody seat (`custody-seat`): the one sealed writer on the way down, the sealed
 * open on the way up. At the floor every door here refuses `CustodyLocked`.
 *
 * ── A ROW READS WHOLE OR REFUSES ────────────────────────────────────────────────────────────────
 * Nothing at a row's path reads as a graph with no edge, or as a book that recognises nobody: a vessel learns
 * both from its own acts, and a lost row costs only this vessel's own memory, which the same cards teach again.
 * A row that stands and does not open (torn, bare, another key's) refuses `CustodyRowUnavailable`, and so does one
 * that opens to another shape. No reader folds a refusal to empty, so no follow and no recognition writes over a
 * row it could not read.
 *
 * ── THE GRAPH CHANGES UNDER ONE HOLDER ──────────────────────────────────────────────────────────
 * A follow and an unfollow each read, decide and write the graph under one custody holder (`updateCustodyRow`),
 * so two acts in two processes never drop each other's edge. The handle-book saves as a whole snapshot the caller
 * built: its acts verify cards and may call a standing vessel in between, and no custody hold spans those.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-two-stacks
 */

import { mkdirSync } from "node:fs";
import { HandleBook, HANDLE_BOOK_SNAPSHOT_ERA, type HandleBookSnapshot, type CircleStore } from "@lararium/mesh";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { readCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { larIdentityDir } from "./vessel-paths.js";

/** The private follow-graph row: one JSON map `{ circles: { circleId -> nym[] } }`. */
export const CIRCLES_FILE     = ".circles-follow.json";
/** The recogniser's serialised handle-book: others' nyms and the private labels the reader keeps for them. */
export const HANDLE_BOOK_FILE = ".handle-book.json";

const utf8 = new TextEncoder();
type CirclesMap = Record<string, string[]>;

function parseJson(bytes: Uint8Array, file: string): unknown {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new CustodyRowUnavailable("identity", file, "malformed"); }
}

/** The graph a row's plaintext carries; nothing standing reads as no edge, and every other shape refuses. */
function parseCircles(bytes: Uint8Array | null): CirclesMap {
  if (bytes === null) return Object.create(null) as CirclesMap;
  const raw = parseJson(bytes, CIRCLES_FILE) as { circles?: unknown } | null;
  const circles = raw && typeof raw === "object" ? raw.circles : undefined;
  if (!circles || typeof circles !== "object" || Array.isArray(circles)) throw new CustodyRowUnavailable("identity", CIRCLES_FILE, "malformed");
  // A map with no prototype: a circle may carry any name, and none of them reaches an inherited slot.
  const out: CirclesMap = Object.create(null) as CirclesMap;
  for (const [id, nyms] of Object.entries(circles as Record<string, unknown>)) {
    if (!Array.isArray(nyms) || nyms.some((n) => typeof n !== "string")) throw new CustodyRowUnavailable("identity", CIRCLES_FILE, "malformed");
    out[id] = [...(nyms as string[])];
  }
  return out;
}

async function readCircles(): Promise<CirclesMap> {
  return parseCircles(await readCustodyRow("identity", CIRCLES_FILE));
}

/** Read the graph, change one circle's set, and write it, under one custody holder. A set that did not change writes nothing. */
function changeCircle(circleId: string, change: (set: Set<string>) => void): Promise<void> {
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  return updateCustodyRow("identity", CIRCLES_FILE, (bytes) => {
    const map = parseCircles(bytes);
    const before = [...(map[circleId] ?? [])].sort();
    const set = new Set(before);
    change(set);
    const after = [...set].sort();
    if (after.length === before.length && after.every((n, i) => n === before[i])) return { plaintext: null, value: undefined };
    map[circleId] = after;
    return { plaintext: utf8.encode(JSON.stringify({ circles: map }, null, 2)), value: undefined };
  });
}

/**
 * Build the node CircleStore: the private follow-graph. Every op reads or writes the one sealed row; no board
 * write exists on it, so the graph cannot reach the wire (the never-federates wall, made structural).
 */
export function makeNodeCircleStore(): CircleStore {
  return {
    add(circleId, nym)    { return changeCircle(circleId, (set) => { set.add(nym); }); },
    remove(circleId, nym) { return changeCircle(circleId, (set) => { set.delete(nym); }); },
    async members(circleId) { return [...((await readCircles())[circleId] ?? [])].sort(); },
    async circles() { return Object.keys(await readCircles()).sort(); },
  };
}

/** The snapshot a row's plaintext carries: this era, a record list, and every record shaped as a record. Any other shape refuses. */
function parseSnapshot(bytes: Uint8Array): HandleBookSnapshot {
  const bad = (): CustodyRowUnavailable => new CustodyRowUnavailable("identity", HANDLE_BOOK_FILE, "malformed");
  const snapshot = parseJson(bytes, HANDLE_BOOK_FILE) as Partial<HandleBookSnapshot> | null;
  if (!snapshot || typeof snapshot !== "object" || snapshot.era !== HANDLE_BOOK_SNAPSHOT_ERA || !Array.isArray(snapshot.records)) throw bad();
  for (const raw of snapshot.records as unknown[]) {
    const record = raw as { nym?: unknown; accepted?: unknown } | null;
    if (!record || typeof record !== "object" || typeof record.nym !== "string" || !Array.isArray(record.accepted)) throw bad();
    for (const card of record.accepted as unknown[]) {
      if (!card || typeof card !== "object" || (card as { nym?: unknown }).nym !== record.nym) throw bad();
    }
  }
  return snapshot as HandleBookSnapshot;
}

/**
 * Load the recogniser's handle-book through the async verification boundary: raw JSON never enters a recogniser
 * by constructor, and `HandleBook.restore` drops any record whose own causal closure does not verify. Nothing at
 * the path reads as a book that recognises nobody. A row that does not open, or opens to anything but a snapshot
 * of this era whose every record holds a record's shape, refuses by name.
 */
export async function loadNodeHandleBook(): Promise<HandleBook> {
  const bytes = await readCustodyRow("identity", HANDLE_BOOK_FILE);
  if (bytes === null) return new HandleBook();
  return HandleBook.restore(parseSnapshot(bytes));
}

/**
 * Seal the handle-book snapshot: the recogniser's private memory of others' keys and labels. The save reads what
 * stands inside its own custody hold and lands only over nothing or over a snapshot that reads whole, so a row
 * that turned unreadable since the caller loaded its book keeps its bytes.
 */
export async function saveNodeHandleBook(book: HandleBook): Promise<void> {
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  const next = utf8.encode(JSON.stringify(book.snapshot(), null, 2));
  await updateCustodyRow("identity", HANDLE_BOOK_FILE, (bytes) => {
    if (bytes !== null) parseSnapshot(bytes);
    return { plaintext: next, value: undefined };
  });
}
