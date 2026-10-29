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
 * `carryRecordKey(hearthLeafSeed, N, G)` — G the per-Nexus leaf the socket's grant names and a walker socket's leaf proof
 * proves (the walker route ships SHUT by name, the shut-routes house ruling (stable-founding-road #/rulings)) — so a record is reached by proof alone,
 * whichever lineage the grant rides, and nothing the hearth hands
 * out names it. A guest that lapsed and walks back in on a fresh invite under the same leaf reaches its carriage
 * again; a fresh leaf is a fresh carriage, and a kapae'd leaf reaches nothing through a new one. Every dial on G
 * is a CONTACT — the grant arm and the token arm alike (`socket-sorter`) — so the notice reaches a guest by a
 * plain dial. It holds per-guest SCALARS and the blobs: the bytes it carries, the hearth epoch it last saw the
 * guest, the guest's own typical gap between contacts, and a pending mark. Never a lineage and never a leaf.
 *
 * WHAT RESTS, per guest, each row sealed under the vessel key (`hosting/<aid digest>/carry/<record key>/`):
 *   · `record.json` — the guest's rhythm: the epoch last seen, its typical gap, and a pending mark.
 *   · `blobs/<address>.<bytes>` — one carried value, the walker's own ciphertext sealed again at rest. Its name
 *     carries the value's address and its length.
 *
 * THE BLOB ROW COMMITS, AND THE COUNT RE-DERIVES. A deposit stands once its blob row rests. How many bytes a guest
 * carries reads off the blob rows standing, by name: the record keeps no counter, so a deposit or a discard that
 * stops midway leaves no count ahead of the bytes it counts.
 *
 * THE ROWS REST IN THE CUSTODY HOME. The store takes no directory: each row resolves through the custody seat. A
 * vessel at the floor reads no carriage row and answers no carriage frame.
 *
 * ONE PROCESS SERVES A HEARTH'S CARRIAGE, ONE ACT AT A TIME. A contact and a deposit reach this module through the
 * standing vessel's own gate alone, and that vessel holds the store's claim for its life: no command deposits, and
 * no second vessel stands on the same home. So the acts of this process form the whole set, and each contact and
 * each deposit (with any reclaim it triggers) waits for the one before it. A quota therefore reads the bytes the
 * last deposit left, and a reclaim never discards on a reading a contact moved meanwhile.
 *
 * TWO BOUNDS, NAMED. The records form a directory of opaque rows, so their COUNT, and each guest's blob count and
 * sizes, stay enumerable from the store — never who, and never a rhythm without the vessel key. A holder of the
 * hearth seed can test a KNOWN leaf against the row names.
 *
 * QUOTA IS TOLERANCE. Each guest may carry up to `perGuestBytes`; a deposit past it is refused, nothing detected.
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

import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  verifyCiphertextCid, lapseRatio, foldRhythm, carryRecordKey, grantVerifiesAt, base64UrlEncode, base64UrlDecode,
  RECLAIM_RATIO, HOSTING_CARRY_SESSION_KIND, HOSTING_CARRIED_SESSION_KIND, HOSTING_FETCH_SESSION_KIND, HOSTING_FETCHED_SESSION_KIND,
} from "@lararium/mesh";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { readCustodyRow, removeCustodyRow, updateCustodyRow, writeCustodyRow } from "./custody-seat.js";
import { readHostingState, liveEpochs } from "./hosting-store.js";
import { hostingDirPath, hostingFaceOf, hostingRowDir } from "./hosting-face.js";
import type { HostingGrant, LarSessionMsg, PeerClass } from "@lararium/mesh";

/**
 * THE WALKER'S SESSION DOOR: a gate's authenticated sessions, each with its class and the hosting grant it stands
 * on. The walker arms ship SHUT by name (`socket-sorter` `SHUT_ARMS`), so no gate seats a walker and
 * no composer stands this door; the carriage and mint servers keep their shape for the reader that opens them.
 */
export interface WalkerSessionDoor<S = unknown> {
  onSession(listener: (socket: S, msg: LarSessionMsg) => void): () => void;
  sendSession(socket: S, kind: string, body: unknown): boolean;
  getClassForSocket(socket: S): PeerClass | undefined;
  getGrantForSocket(socket: S): HostingGrant | undefined;
}

/** How much a hearth carries for walkers: per guest, and in all. */
export interface CarryLimits {
  readonly perGuestBytes: number;
  readonly totalBytes:    number;
}

export const DEFAULT_CARRY_LIMITS: CarryLimits = { perGuestBytes: 8 * 1024 * 1024, totalBytes: 256 * 1024 * 1024 };

/** One guest's rhythm, as its record row holds it. */
interface CarryRhythm {
  /** The hearth epoch (`HostingState.depth`) the guest was last in contact at. */
  readonly lastSeen: number;
  /** The guest's own typical gap between contacts, in hearth epochs (0 until it has one). */
  readonly gap:      number;
  /** The hearth epoch a reclaim marked this carriage pending at, or null. */
  readonly pending:  number | null;
}

/** One guest's carriage scalars: its rhythm, and the bytes its blob rows hold (derived from the rows standing). */
export interface CarryRecord extends CarryRhythm {
  readonly bytes: number;
}

/** The outcome of a deposit. */
export type DepositOutcome = "held" | "quota" | "pressure";

/** A record's key stands as one plain path segment; anything else names no row. */
const SEGMENT = /^[0-9A-Za-z_-]{1,128}$/;
/** A carried value's address: `blake3:` over its ciphertext. */
const ADDRESS = /^blake3:([0-9a-f]{64})$/;
/** A blob row's file name: the address's digest and the value's length in bytes. */
const BLOB_FILE = /^([0-9a-f]{64})\.(0|[1-9][0-9]{0,15})$/;

function segment(key: string): string {
  if (!SEGMENT.test(key)) throw new Error("[hosting-carry] a record key names no carriage row");
  return key;
}
/** Where a Nexus's carriage rests: the face that holds its hosting, and the AID. */
interface Home { readonly face: number; readonly nexusAid: string }
const guestRowDir = (home: Home, key: string): string => `${hostingRowDir(home.face, home.nexusAid)}/carry/${segment(key)}`;
const recordFile = (home: Home, key: string): string => `${guestRowDir(home, key)}/record.json`;
/** The Nexus's carriage home when a face holds its hosting (`create` founds it under the face named, else the one face standing open); null where none does. */
async function homeOf(nexusAid: string, create: boolean): Promise<Home | null> {
  const face = await hostingFaceOf(nexusAid, create);
  return face === null ? null : { face, nexusAid };
}
/** The directory path of one guest-side subtree of the carriage, inside the hosting face's own directory. */
const carryPath = (home: Home, ...rest: string[]): string => join(hostingDirPath(home.face, home.nexusAid)!, "carry", ...rest);
const unlistable = (row: string, err: unknown): CustodyRowUnavailable =>
  new CustodyRowUnavailable("identity", row, `unlistable (${(err as NodeJS.ErrnoException).code ?? "unreadable"})`);

/** The names under one directory of the carriage; no directory holds none, and any other fault refuses by name. */
function namesUnder(dir: string, row: string): string[] {
  try { return readdirSync(dir); }
  catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw unlistable(row, err);
  }
}

/** The record keys standing under one Nexus's carriage root. */
async function carriedKeys(home: Home): Promise<string[]> {
  return namesUnder(carryPath(home), `${hostingRowDir(home.face, home.nexusAid)}/carry`).filter((key) => SEGMENT.test(key)).sort();
}

interface StandingBlob { readonly digest: string; readonly bytes: number; readonly file: string }

/** The blob rows one guest's carriage holds, read off their names. */
async function standingBlobs(home: Home, key: string): Promise<StandingBlob[]> {
  const row = `${guestRowDir(home, key)}/blobs`;
  const out: StandingBlob[] = [];
  for (const name of namesUnder(carryPath(home, key, "blobs"), row)) {
    const m = BLOB_FILE.exec(name);
    if (m) out.push({ digest: m[1]!, bytes: Number(m[2]), file: `${row}/${name}` });
  }
  return out;
}

const bytesOf = (blobs: readonly StandingBlob[]): number => blobs.reduce((sum, b) => sum + b.bytes, 0);

function parseRhythm(bytes: Uint8Array, file: string): CarryRhythm {
  const malformed = (): CustodyRowUnavailable => new CustodyRowUnavailable("identity", file, "malformed");
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw malformed(); }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw malformed();
  const { lastSeen, gap, pending, ...rest } = raw as Record<string, unknown>;
  const whole = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  if (Object.keys(rest).length > 0 || !whole(lastSeen) || typeof gap !== "number" || !Number.isFinite(gap) || gap < 0
      || !(pending === null || whole(pending))) throw malformed();
  return { lastSeen, gap, pending };
}

async function readRhythm(home: Home, key: string): Promise<CarryRhythm | null> {
  const file = recordFile(home, key);
  const bytes = await readCustodyRow("identity", file);
  return bytes === null ? null : parseRhythm(bytes, file);
}

/**
 * One guest's record, reached by its key — or null where this hearth carries nothing for it. The rhythm rests
 * sealed under the vessel key, and `bytes` reads off the blob rows standing; a row that stands and does not read
 * whole refuses by name.
 */
export async function readCarryRecord(nexusAid: string, key: string): Promise<CarryRecord | null> {
  const home = await homeOf(nexusAid, false);
  if (home === null) return null;
  const rhythm = await readRhythm(home, key);
  return rhythm === null ? null : { ...rhythm, bytes: bytesOf(await standingBlobs(home, key)) };
}

/** Read a guest's rhythm, decide and write it under one custody holder. `decide` answers the next rhythm, or null to leave it. */
async function updateRhythm<T>(
  home: Home, key: string, decide: (standing: CarryRhythm | null) => { readonly next: CarryRhythm | null; readonly value: T },
): Promise<T> {
  const file = recordFile(home, key);
  mkdirSync(carryPath(home, segment(key), "blobs"), { recursive: true, mode: 0o700 });
  return updateCustodyRow("identity", file, (standing) => {
    const d = decide(standing === null ? null : parseRhythm(standing, file));
    return { plaintext: d.next === null ? null : new TextEncoder().encode(JSON.stringify(d.next)), value: d.value };
  });
}

/**
 * A guest's CONTACT at hearth epoch `depth`: fold its gap into its own rhythm, move its last-seen epoch, and clear
 * a pending mark set in an earlier epoch. Returns whether the guest should hear the notice. A guest this hearth
 * carries nothing for stays untouched, and no directory stands for a mere contact.
 */
export function noteContact(nexusAid: string, key: string, depth: number): Promise<{ readonly notice: boolean }> {
  return inTurn(() => contactInTurn(nexusAid, key, depth));
}

async function contactInTurn(nexusAid: string, key: string, depth: number): Promise<{ readonly notice: boolean }> {
  const home = await homeOf(nexusAid, false);
  if (home === null || (await readRhythm(home, key)) === null) return { notice: false };
  return updateRhythm(home, key, (record) => {
    if (!record) return { next: null, value: { notice: false } };
    const renewed = depth > record.lastSeen;
    const next: CarryRhythm = {
      lastSeen: Math.max(record.lastSeen, depth),
      gap: renewed ? foldRhythm(record.gap, depth - record.lastSeen) : record.gap,
      pending: record.pending !== null && depth > record.pending ? null : record.pending,
    };
    return { next, value: { notice: next.pending !== null } };
  });
}

/** Bytes carried in all, across every guest's blob rows. */
async function totalCarried(home: Home): Promise<number> {
  let total = 0;
  for (const key of await carriedKeys(home)) total += bytesOf(await standingBlobs(home, key));
  return total;
}

/**
 * RECLAIM under pressure at hearth epoch `depth`, for a deposit of `need` bytes by the grant keyed `except`.
 * Among grants lapsed past `RECLAIM_RATIO` × their own rhythm, the most-lapsed-for-itself first, just enough are
 * taken to cover the shortfall: one already marked whose mark has stood unrenewed through its own threshold again
 * gets discarded; one not yet marked gets MARKED and kept (notice first). A guest within its rhythm never gets
 * taken. Returns true when enough room stands.
 */
async function reclaim(home: Home, depth: number, need: number, limits: CarryLimits, except: string): Promise<boolean> {
  const shortfall = await totalCarried(home) + need - limits.totalBytes;
  const read: { key: string; record: CarryRecord | null }[] = [];
  for (const key of await carriedKeys(home)) if (key !== except) read.push({ key, record: await readCarryRecord(home.nexusAid, key) });
  const lapsed = read
    .filter((r): r is { key: string; record: CarryRecord } => r.record !== null && r.record.bytes > 0)
    .map((r) => ({ ...r, ratio: lapseRatio(depth, r.record.lastSeen, r.record.gap) }))
    .filter((r) => r.ratio > RECLAIM_RATIO)
    .sort((a, b) => b.ratio - a.ratio);
  let covered = 0;
  for (const { key, record } of lapsed) {
    if (covered >= shortfall) break;
    covered += record.bytes;
    if (record.pending === null) {
      await updateRhythm(home, key, (standing) => ({ next: standing ? { ...standing, pending: depth } : null, value: undefined }));   // notice first
    } else if (lapseRatio(depth, record.pending, record.gap) > RECLAIM_RATIO) {
      // The blob rows leave first; the mark clears once they have left, so a discard that stops midway keeps its mark.
      for (const blob of await standingBlobs(home, key)) await removeCustodyRow("identity", blob.file);
      await updateRhythm(home, key, (standing) => ({ next: standing ? { ...standing, pending: null } : null, value: undefined }));
    }
  }
  return await totalCarried(home) + need <= limits.totalBytes;
}

/** The carriage's acts in flight (contacts, deposits and the reclaims they trigger): each waits for the one before it. */
let carriageInTurn: Promise<unknown> = Promise.resolve();
function inTurn<T>(act: () => Promise<T>): Promise<T> {
  const run = carriageInTurn.then(act, act);
  carriageInTurn = run.catch(() => undefined);
  return run;
}

/** Hold `ciphertext` (verified against `cid` by the caller) for the grant keyed `key`, under quota and pressure. */
export function depositCarried(opts: {
  readonly nexusAid: string; readonly key: string; readonly depth: number;
  readonly cid: string; readonly ciphertext: Uint8Array; readonly limits?: CarryLimits;
}): Promise<DepositOutcome> {
  return inTurn(() => depositInTurn(opts));
}

async function depositInTurn(opts: {
  readonly nexusAid: string; readonly key: string; readonly depth: number;
  readonly cid: string; readonly ciphertext: Uint8Array; readonly limits?: CarryLimits;
}): Promise<DepositOutcome> {
  const limits = opts.limits ?? DEFAULT_CARRY_LIMITS;
  const address = ADDRESS.exec(opts.cid);
  if (!address) throw new Error("[hosting-carry] a carried value's address reads `blake3:<64 hex>`");
  const home = (await homeOf(opts.nexusAid, true))!;
  const held = await standingBlobs(home, opts.key);
  const size = opts.ciphertext.byteLength;
  const twin = held.find((b) => b.digest === address[1]);
  if (twin) {
    // Already carried: idempotent. The row must open to the same bytes before this hearth says so; a row that
    // stands and does not open refuses by name, where an answer of `held` would promise bytes nobody can fetch.
    const standing = await readCustodyRow("identity", twin.file);
    if (standing !== null && standing.length === size && standing.every((byte, i) => byte === opts.ciphertext[i])) return "held";
    throw new CustodyRowUnavailable("identity", twin.file, "holds other bytes than its address names");
  }
  if (bytesOf(held) + size > limits.perGuestBytes) return "quota";
  if (await totalCarried(home) + size > limits.totalBytes
      && !(await reclaim(home, opts.depth, size, limits, opts.key))) return "pressure";
  // The rhythm stands before the blob, and counts nothing; the blob row then commits the deposit.
  await updateRhythm(home, opts.key, (standing) => ({ next: standing ? null : { lastSeen: opts.depth, gap: 0, pending: null }, value: undefined }));
  await writeCustodyRow("identity", `${guestRowDir(home, opts.key)}/blobs/${address[1]}.${size}`, opts.ciphertext);
  return "held";
}

/**
 * The ciphertext a guest's carriage holds under `cid`, or null. Only the leaf that deposited it reaches it. The
 * blob rests sealed under the vessel key over the walker's own seal; a row that stands and does not open refuses.
 */
export async function fetchCarried(nexusAid: string, key: string, cid: string): Promise<Uint8Array | null> {
  const address = ADDRESS.exec(cid);
  if (!address || !SEGMENT.test(key)) return null;                              // a name no row could carry holds nothing
  const home = await homeOf(nexusAid, false);
  if (home === null) return null;
  const blob = (await standingBlobs(home, key)).find((b) => b.digest === address[1]);
  return blob ? readCustodyRow("identity", blob.file) : null;
}

/**
 * Serve walkers' carriage on `gate`'s sessions — walker sockets alone, each reaching only the record its own
 * proven leaf keys. Nothing in a request names a record, and nothing in an answer hands one out. A fault (a key
 * that locked, a row that does not open) answers nothing, exactly as a refusal does.
 */
export function serveHostingCarry<S>(
  gate: WalkerSessionDoor<S>,
  deps: { readonly leafSeedFor: (nexusAid: string) => Promise<Uint8Array | null>; readonly limits?: CarryLimits },
): () => void {
  return gate.onSession((socket, msg) => {
    if (msg.kind !== HOSTING_CARRY_SESSION_KIND && msg.kind !== HOSTING_FETCH_SESSION_KIND) return;
    void (async () => {
      if (gate.getClassForSocket(socket) !== "walker") return;
      const grant = gate.getGrantForSocket(socket);
      const body = msg.body as { cid?: unknown; ciphertext?: unknown } | null;
      if (!grant || typeof body?.cid !== "string" || !ADDRESS.test(body.cid)) return;
      const state = await readHostingState(grant.nexusAid);
      const seed = state ? await deps.leafSeedFor(grant.nexusAid) : null;
      const live = state && seed ? liveEpochs(state, seed) : null;
      if (!state || !seed || !live || !grantVerifiesAt(live.current, grant)) return;
      // The record the socket's proven leaf keys — the grant's leaf, which the sorter proved over this socket.
      const key = carryRecordKey(seed, grant.nexusAid, grant.leaf);
      if (msg.kind === HOSTING_FETCH_SESSION_KIND) {
        const bytes = await fetchCarried(grant.nexusAid, key, body.cid);
        if (bytes) gate.sendSession(socket, HOSTING_FETCHED_SESSION_KIND, { cid: body.cid, ciphertext: base64UrlEncode(bytes) });
        return;
      }
      if (typeof body.ciphertext !== "string") return;
      let ciphertext: Uint8Array;
      try { ciphertext = base64UrlDecode(body.ciphertext); } catch { return; }
      if (!verifyCiphertextCid(ciphertext, body.cid)) return;                              // carries only what it can address
      const outcome = await depositCarried({
        nexusAid: grant.nexusAid, key, depth: state.depth, cid: body.cid, ciphertext,
        ...(deps.limits ? { limits: deps.limits } : {}),
      });
      gate.sendSession(socket, HOSTING_CARRIED_SESSION_KIND, outcome === "held" ? { cid: body.cid, held: true } : { cid: body.cid, refused: outcome });
    })().catch(() => { /* a fault answers nothing */ });
  });
}
