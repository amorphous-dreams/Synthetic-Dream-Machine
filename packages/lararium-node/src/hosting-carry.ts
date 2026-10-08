/**
 * hosting-carry — W: a hearth CARRIES a walker's own documents as SEALED CIPHERTEXT (operator-ruled).
 *
 * CARRY ⊥ READ. The walker seals each document under a secret derived from its own leaf (`walkCarrySecret`) and
 * hands the hearth only the ciphertext and its content address (`cid = BLAKE3(ciphertext)`). The hearth verifies
 * the address — that needs no key — stores the bytes, and can never open them. The read stays with the walker's
 * own leaf, root and fleet. The hearth's carriage is a CONVENIENCE: the walker's own devices (its PersonaGroup)
 * hold the durable copy, and nothing here is backup.
 *
 *   walker → hearth  `hosting/carry {cid, ciphertext}` → `hosting/carried {cid, held}` or `{cid, refused}`
 *   walker → hearth  `hosting/fetch {cid}`             → `hosting/fetched {cid, ciphertext}` (its own bytes only)
 *   hearth → walker  `hosting/notice {pending: true}`  on a contact while the walker's carriage stands marked
 *
 * ONE RECORD PER LEAF, REACHED ONLY BY A GRANT THAT PROVES THAT LEAF. The hearth keys each guest's carriage under
 * `carryRecordKey(hearthLeafSeed, N, G)` — G the per-Nexus leaf the socket's grant names and its leaf proof
 * proves — so a record is reached by proof alone, whichever lineage the grant rides, and nothing the hearth hands
 * out names it. A guest that lapsed and walks back in on a fresh invite under the same leaf reaches its carriage
 * again; a fresh leaf is a fresh carriage, and a kapae'd leaf reaches nothing through a new one. Every dial on G
 * is a CONTACT — the grant arm and the token arm alike (`socket-sorter`) — so the notice reaches a guest by a
 * plain dial. It holds per-guest SCALARS and the blobs: the bytes it carries, the hearth epoch it last saw the
 * guest, the guest's own typical gap between contacts, and a pending mark. Never a lineage and never a leaf.
 *
 * TWO BOUNDS, NAMED. The records are a directory of opaque rows, so their COUNT and each row's contact rhythm are
 * enumerable from the store — never who. A holder of the hearth seed can test a KNOWN leaf against the rows; the
 * sealed custody root closes both at rest.
 *
 * QUOTA IS TOLERANCE. Each guest may carry up to `perGrantBytes`; a deposit past it is refused, nothing detected.
 *
 * RECLAIM — PRESSURE IS THE ONLY TRIGGER, THE GUEST'S OWN RHYTHM THE MEASURE, NOTICE BEFORE DISCARD. Nothing is
 * evicted for lapsing alone. Only when a deposit would pass `totalBytes` does the hearth reclaim, choosing among
 * grants lapsed past `RECLAIM_RATIO` × their OWN typical gap (counted in the hearth's own epochs, so how often the
 * hearth rolls cancels out), the most-lapsed-for-itself first. A chosen grant is first MARKED pending; its next
 * contact receives the notice, and a contact in a later epoch clears the mark. Its bytes are discarded only once
 * the mark has stood unrenewed through the guest's own threshold again. A guest's device keeps its own receipt of
 * what is carried, so it detects the risk with no list on the hearth's side.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-walkers-carriage
 */

import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  verifyCiphertextCid, lapseRatio, foldRhythm, carryRecordKey, grantVerifiesAt, base64UrlEncode, base64UrlDecode,
  RECLAIM_RATIO, HOSTING_CARRY_SESSION_KIND, HOSTING_CARRIED_SESSION_KIND, HOSTING_FETCH_SESSION_KIND, HOSTING_FETCHED_SESSION_KIND,
} from "@lararium/mesh";
import { atomicWriteFileSync } from "./fs-atomic.js";
import { hostingDir, readHostingState, liveEpochs } from "./hosting-store.js";
import type { DaemonAuthGate } from "./daemon-auth-gate.js";

/** How much a hearth carries for walkers: per guest, and in all. */
export interface CarryLimits {
  readonly perGrantBytes: number;
  readonly totalBytes:    number;
}

export const DEFAULT_CARRY_LIMITS: CarryLimits = { perGrantBytes: 8 * 1024 * 1024, totalBytes: 256 * 1024 * 1024 };

/** One guest's carriage scalars. */
export interface CarryRecord {
  /** Bytes this guest's carriage holds. */
  readonly bytes:    number;
  /** The hearth epoch (`HostingState.depth`) the guest was last in contact at. */
  readonly lastSeen: number;
  /** The guest's own typical gap between contacts, in hearth epochs (0 until it has one). */
  readonly gap:      number;
  /** The hearth epoch a reclaim marked this carriage pending at, or null. */
  readonly pending:  number | null;
}

/** The outcome of a deposit. */
export type DepositOutcome = "held" | "quota" | "pressure";

function carryRoot(storageDir: string, nexusAid: string): string { return join(hostingDir(storageDir, nexusAid), "carry"); }
function recordDir(storageDir: string, nexusAid: string, key: string): string { return join(carryRoot(storageDir, nexusAid), key); }
const blobName = (cid: string): string => cid.replace(/^blake3:/, "");

/** One guest's record, reached by its key — or null where this hearth carries nothing for it. */
export function readCarryRecord(storageDir: string, nexusAid: string, key: string): CarryRecord | null {
  try { return JSON.parse(readFileSync(join(recordDir(storageDir, nexusAid, key), "record.json"), "utf8")) as CarryRecord; }
  catch { return null; }
}

function writeRecord(storageDir: string, nexusAid: string, key: string, record: CarryRecord): void {
  mkdirSync(join(recordDir(storageDir, nexusAid, key), "blobs"), { recursive: true });
  atomicWriteFileSync(join(recordDir(storageDir, nexusAid, key), "record.json"), JSON.stringify(record));
}

/**
 * A guest's CONTACT at hearth epoch `depth`: fold its gap into its own rhythm, move its last-seen epoch, and clear
 * a pending mark set in an earlier epoch. Returns whether the guest should hear the notice. A guest this hearth
 * carries nothing for is left untouched.
 */
export function noteContact(storageDir: string, nexusAid: string, key: string, depth: number): { readonly notice: boolean } {
  const record = readCarryRecord(storageDir, nexusAid, key);
  if (!record) return { notice: false };
  const renewed = depth > record.lastSeen;
  const next: CarryRecord = {
    bytes: record.bytes,
    lastSeen: Math.max(record.lastSeen, depth),
    gap: renewed ? foldRhythm(record.gap, depth - record.lastSeen) : record.gap,
    pending: record.pending !== null && depth > record.pending ? null : record.pending,
  };
  writeRecord(storageDir, nexusAid, key, next);
  return { notice: next.pending !== null };
}

/** Bytes carried in all, across every guest's record. */
function totalCarried(storageDir: string, nexusAid: string): number {
  const root = carryRoot(storageDir, nexusAid);
  if (!existsSync(root)) return 0;
  let total = 0;
  for (const key of readdirSync(root)) total += readCarryRecord(storageDir, nexusAid, key)?.bytes ?? 0;
  return total;
}

/**
 * RECLAIM under pressure at hearth epoch `depth`, for a deposit of `need` bytes by the grant keyed `except`.
 * Among grants lapsed past `RECLAIM_RATIO` × their own rhythm, the most-lapsed-for-itself first, just enough are
 * taken to cover the shortfall: one already marked whose mark has stood unrenewed through its own threshold again
 * is discarded; one not yet marked is MARKED and kept (notice first). A guest within its rhythm is never taken.
 * Returns true when enough room now stands.
 */
function reclaim(storageDir: string, nexusAid: string, depth: number, need: number, limits: CarryLimits, except: string): boolean {
  const root = carryRoot(storageDir, nexusAid);
  const shortfall = totalCarried(storageDir, nexusAid) + need - limits.totalBytes;
  const lapsed = (existsSync(root) ? readdirSync(root) : [])
    .filter((key) => key !== except)
    .map((key) => ({ key, record: readCarryRecord(storageDir, nexusAid, key) }))
    .filter((r): r is { key: string; record: CarryRecord } => r.record !== null && r.record.bytes > 0)
    .map((r) => ({ ...r, ratio: lapseRatio(depth, r.record.lastSeen, r.record.gap) }))
    .filter((r) => r.ratio > RECLAIM_RATIO)
    .sort((a, b) => b.ratio - a.ratio);
  let covered = 0;
  for (const { key, record } of lapsed) {
    if (covered >= shortfall) break;
    covered += record.bytes;
    if (record.pending === null) {
      writeRecord(storageDir, nexusAid, key, { ...record, pending: depth });             // notice first
    } else if (lapseRatio(depth, record.pending, record.gap) > RECLAIM_RATIO) {
      rmSync(join(recordDir(storageDir, nexusAid, key), "blobs"), { recursive: true, force: true });
      writeRecord(storageDir, nexusAid, key, { ...record, bytes: 0, pending: null });
    }
  }
  return totalCarried(storageDir, nexusAid) + need <= limits.totalBytes;
}

/** Hold `ciphertext` (verified against `cid`) for the grant keyed `key`, under quota and pressure. */
export function depositCarried(opts: {
  readonly storageDir: string; readonly nexusAid: string; readonly key: string; readonly depth: number;
  readonly cid: string; readonly ciphertext: Uint8Array; readonly limits?: CarryLimits;
}): DepositOutcome {
  const limits = opts.limits ?? DEFAULT_CARRY_LIMITS;
  const record = readCarryRecord(opts.storageDir, opts.nexusAid, opts.key)
    ?? { bytes: 0, lastSeen: opts.depth, gap: 0, pending: null };
  const blobPath = join(recordDir(opts.storageDir, opts.nexusAid, opts.key), "blobs", blobName(opts.cid));
  if (existsSync(blobPath)) return "held";                                               // already carried: idempotent
  const size = opts.ciphertext.byteLength;
  if (record.bytes + size > limits.perGrantBytes) return "quota";
  if (totalCarried(opts.storageDir, opts.nexusAid) + size > limits.totalBytes
      && !reclaim(opts.storageDir, opts.nexusAid, opts.depth, size, limits, opts.key)) return "pressure";
  writeRecord(opts.storageDir, opts.nexusAid, opts.key, { ...record, bytes: record.bytes + size });
  atomicWriteFileSync(blobPath, opts.ciphertext);
  return "held";
}

/** The ciphertext a guest's carriage holds under `cid`, or null. Only the leaf that deposited it reaches it. */
export function fetchCarried(storageDir: string, nexusAid: string, key: string, cid: string): Uint8Array | null {
  const path = join(recordDir(storageDir, nexusAid, key), "blobs", blobName(cid));
  try { return statSync(path).isFile() ? new Uint8Array(readFileSync(path)) : null; } catch { return null; }
}

/**
 * Serve walkers' carriage on `gate`'s sessions — walker sockets alone, each reaching only the record its own
 * proven leaf keys. Nothing in a request names a record, and nothing in an answer hands one out.
 */
export function serveHostingCarry(
  gate: Pick<DaemonAuthGate, "onSession" | "sendSession" | "getClassForSocket" | "getGrantForSocket">,
  deps: { readonly storageDir: string; readonly leafSeedFor: (nexusAid: string) => Promise<Uint8Array | null>; readonly limits?: CarryLimits },
): () => void {
  return gate.onSession((socket, msg) => {
    if (msg.kind !== HOSTING_CARRY_SESSION_KIND && msg.kind !== HOSTING_FETCH_SESSION_KIND) return;
    void (async () => {
      if (gate.getClassForSocket(socket) !== "walker") return;
      const grant = gate.getGrantForSocket(socket);
      const body = msg.body as { cid?: unknown; ciphertext?: unknown } | null;
      if (!grant || typeof body?.cid !== "string") return;
      const state = readHostingState(deps.storageDir, grant.nexusAid);
      const seed = state ? await deps.leafSeedFor(grant.nexusAid) : null;
      const live = state && seed ? liveEpochs(state, seed) : null;
      if (!state || !seed || !live || !grantVerifiesAt(live.current, grant)) return;
      // The record the socket's proven leaf keys — the grant's leaf, which the sorter proved over this socket.
      const key = carryRecordKey(seed, grant.nexusAid, grant.leaf);
      if (msg.kind === HOSTING_FETCH_SESSION_KIND) {
        const bytes = fetchCarried(deps.storageDir, grant.nexusAid, key, body.cid);
        if (bytes) gate.sendSession(socket, HOSTING_FETCHED_SESSION_KIND, { cid: body.cid, ciphertext: base64UrlEncode(bytes) });
        return;
      }
      if (typeof body.ciphertext !== "string") return;
      let ciphertext: Uint8Array;
      try { ciphertext = base64UrlDecode(body.ciphertext); } catch { return; }
      if (!verifyCiphertextCid(ciphertext, body.cid)) return;                              // carries only what it can address
      const outcome = depositCarried({
        storageDir: deps.storageDir, nexusAid: grant.nexusAid, key, depth: state.depth, cid: body.cid, ciphertext,
        ...(deps.limits ? { limits: deps.limits } : {}),
      });
      gate.sendSession(socket, HOSTING_CARRIED_SESSION_KIND, outcome === "held" ? { cid: body.cid, held: true } : { cid: body.cid, refused: outcome });
    })().catch(() => { /* a fault answers nothing */ });
  });
}
