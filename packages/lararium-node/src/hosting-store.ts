/**
 * hosting-store — what a hearth keeps to host walkers in a Nexus: its current and previous hosting acts, and
 * one sealed row per spend of each live epoch. Nothing else. Every row rests under the vessel key.
 *
 * WHAT IT HOLDS, per Nexus it hosts in (`hosting/<aid digest>/` under the custody seat's storage home, owner-only
 * like the root above it):
 *   · `state.json` — the current hosting act and the previous one (or none), with the current act's depth.
 *   · `spent-<epoch>-n-<digest of the nonce>` — one row per token redeemed at this epoch; it holds the nonce and
 *     the digest binding the claim to the leaf that proved over the redeeming socket.
 *   · `spent-<epoch>-m-<digest of the marker>` — one row per lineage's mint at this epoch; it holds the marker and
 *     the digest of the batch that lineage minted.
 *   A row's name carries a digest of its nonce or marker, never the value, and its sealed plaintext carries a
 *   digest of a claim or a batch, never either.
 *
 * WHY ONE ROW PER SPEND. The sealed writer writes a whole file (sidecar, re-open, compare, rename) and appends
 * to none. A spend therefore lands as its own file: the row's presence at its name IS the burn.
 *
 * WHAT IT NEVER HOLDS: a grant, a guest leaf, a lineage, a blinded element, a token it evaluated, who minted,
 * who redeemed, or any mapping between them. Seized, it reveals how many rows of each kind stand in the live
 * epochs — a count, never a roster — and nothing else without the vessel key.
 *
 * REFUSE BEFORE DESTROY. A spend reads its own row, decides and writes under ONE custody holder, so no two
 * burns of one nonce interleave, in this process or between two. The same nonce redeemed again with the same
 * claim by the same leaf reads `retry` and earns the identical grant, so an answer lost after the burn destroys
 * nothing. A different claim, or the same claim under another leaf, reads `spent-other` — silence at the gate —
 * and writes nothing. A row that stands and does not open refuses the spend by name: a burn nobody can read
 * never reads as unspent.
 *
 * THE SPEND ROW COMMITS, AND EVERYTHING AHEAD OF IT RE-DERIVES. A redemption answers only after its row rests.
 * The grant a redemption earns derives from the epoch, the leaf, the nonce and the claim, so a crash after the row
 * and before the answer replays as `retry` and earns the identical grant. The counts an operator reads derive
 * from the rows standing, by name; the store keeps no counter beside them.
 *
 * A ROLL keeps exactly two epochs live: the new act becomes current, the old current becomes previous, and the
 * spend rows of any epoch outside those two leave. The state row commits the roll; a roll that stops before its
 * sweep leaves dead rows that the next roll sweeps, and so does a redemption that read an epoch as live and
 * sealed its spend after a roll retired it: such a row burns nothing live and leaves with the next sweep. Rolling twice kills every grant and token of the epoch
 * before — the hard roll is a roll done twice.
 *
 * THE ROWS REST IN THE CUSTODY HOME. The store takes no directory: each row resolves through the custody seat, so
 * a hosting row rests where every sealed row of this vessel rests, whatever directory a Repo got handed. A vessel
 * at the floor reads no hosting row and hosts no walker.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  sha256HexSync, isHostingAct, hostingActCid, hostingEpochOf, mintHostingAct,
  type HostingAct, type HostingEpoch,
} from "@lararium/mesh";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { openedCustody, readCustodyRow, removeCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { ownerOnlyDir } from "./fs-atomic.js";

/** The allowance cap a hearth hosts under until its operator names another. */
export const DEFAULT_HOSTING_CAP = 3;

/** A hearth's hosting standing in one Nexus. The current act names the allowance cap. */
export interface HostingState {
  readonly current:  HostingAct;
  readonly previous: HostingAct | null;
  /** The current act's place along its own hash links — the first act is 1. Derived from the chain, never a
   *  free counter: the hearth's own epochs, the unit a guest's rhythm is measured in. */
  readonly depth:    number;
}

const utf8 = new TextEncoder();
const HEX64 = /^[0-9a-f]{64}$/;
const malformed = (file: string): CustodyRowUnavailable => new CustodyRowUnavailable("storage", file, "malformed");

/** One Nexus's hosting directory, relative to the storage home. */
export function hostingRowDir(nexusAid: string): string {
  return `hosting/${sha256HexSync(nexusAid.trim().toLowerCase()).slice(0, 32)}`;
}

/** The directory one Nexus's hosting rows rest in, under the storage home of the custody this vessel holds open. */
export async function hostingDir(nexusAid: string): Promise<string> {
  return join((await openedCustody()).homes.storage, ...hostingRowDir(nexusAid).split("/"));
}

/** Stand one Nexus's hosting directory, and the `hosting/` root above it, at the owner-only mode. */
export async function standHostingDir(nexusAid: string): Promise<string> {
  ownerOnlyDir(join((await openedCustody()).homes.storage, "hosting"));
  const dir = await hostingDir(nexusAid);
  ownerOnlyDir(dir);
  return dir;
}

const stateFile = (nexusAid: string): string => `${hostingRowDir(nexusAid)}/state.json`;

function parseState(bytes: Uint8Array, file: string): HostingState {
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw malformed(file); }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw malformed(file);
  const { current, previous, depth, ...rest } = raw as Record<string, unknown>;
  if (Object.keys(rest).length > 0 || !isHostingAct(current)) throw malformed(file);
  if (previous !== null && !isHostingAct(previous)) throw malformed(file);
  if (typeof depth !== "number" || !Number.isSafeInteger(depth)) throw malformed(file);
  // The two acts form one chain: the current act rolls from the previous one, and a first act rolls from none
  // and stands at depth one.
  const chained = previous === null
    ? current.prev === null && depth === 1
    : current.prev === hostingActCid(previous) && depth >= 2;
  if (!chained) throw malformed(file);
  return { current, previous, depth };
}

/**
 * The hosting state for N, or null where this hearth hosts nowhere in N. A state row that stands and does not
 * read whole refuses by name: a hearth never reads a torn state as "hosts nowhere" and never rolls over it.
 */
export async function readHostingState(nexusAid: string): Promise<HostingState | null> {
  const file = stateFile(nexusAid);
  const bytes = await readCustodyRow("storage", file);
  return bytes === null ? null : parseState(bytes, file);
}

/** The live epochs a state names, re-derived from the hearth's leaf seed. Null where the seed derives other keys. */
export function liveEpochs(state: HostingState, leafSeed: Uint8Array): { readonly current: HostingEpoch; readonly previous: HostingEpoch | null } | null {
  const current = hostingEpochOf(state.current, leafSeed);
  if (!current) return null;
  const previous = state.previous ? hostingEpochOf(state.previous, leafSeed) : null;
  return { current, previous };
}

// ── the spend rows ────────────────────────────────────────────────────────────────────────────────

/** A spend row's file name: its epoch, its kind (`n` a redeemed nonce, `m` a mint marker) and a digest of its key. */
const SPEND_FILE = /^spent-([0-9a-f]{64})-([nm])-([0-9a-f]{32})$/;

/** The spend rows standing in one Nexus's directory, by file name. No directory holds none; any other fault refuses. */
async function spendNames(nexusAid: string): Promise<string[]> {
  const dir = await hostingDir(nexusAid);
  try { return readdirSync(dir).filter((n) => SPEND_FILE.test(n)); }
  catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new CustodyRowUnavailable("storage", hostingRowDir(nexusAid), `unlistable (${(err as NodeJS.ErrnoException).code ?? "unreadable"})`);
  }
}

/** A roll that another roll overtook: the state moved between this roll's read and its write. Nothing rolled. */
export class HostingStateMoved extends Error {
  override readonly name = "HostingStateMoved";
  constructor() { super("the hosting state moved under this roll; nothing rolled — run it again"); }
}

/**
 * ROLL: sign the hearth's next hosting act in N (rolling from its current one, or its first), make it current,
 * keep the old current as previous, and remove the spend rows of every other epoch. Returns the new act — the
 * caller lands it on this hearth's hosting doc in N. `cap` names a new allowance cap; absent, the standing one
 * holds. The state row reads, decides and writes under one custody holder, so two rolls never fork a state: the
 * act chains from the state this roll read, and a state another roll moved meanwhile refuses this one.
 * `unswept` names the dead rows that refused their removal (bytes this vessel's key does not open); they stay.
 */
export async function rollHosting(opts: {
  readonly nexusAid: string; readonly leafSeed: Uint8Array; readonly cap?: number;
}): Promise<{ readonly act: HostingAct; readonly state: HostingState; readonly unswept: readonly string[] }> {
  const file = stateFile(opts.nexusAid);
  const prior = await readHostingState(opts.nexusAid);
  const priorCid = prior ? hostingActCid(prior.current) : null;
  const cap = opts.cap ?? prior?.current.cap ?? DEFAULT_HOSTING_CAP;
  const minted = await mintHostingAct({ leafSeed: opts.leafSeed, nexusAid: opts.nexusAid, prev: priorCid, cap });
  const state: HostingState = { current: minted.act, previous: prior?.current ?? null, depth: (prior?.depth ?? 0) + 1 };
  await standHostingDir(opts.nexusAid);
  await updateCustodyRow("storage", file, (standing) => {
    const held = standing === null ? null : parseState(standing, file);
    if ((held ? hostingActCid(held.current) : null) !== priorCid) throw new HostingStateMoved();
    return { plaintext: utf8.encode(JSON.stringify(state)), value: undefined };
  });
  const live = new Set([minted.cid, ...(state.previous ? [hostingActCid(state.previous)] : [])]);
  const unswept: string[] = [];
  for (const name of await spendNames(opts.nexusAid)) {
    if (live.has(SPEND_FILE.exec(name)![1]!)) continue;
    const row = `${hostingRowDir(opts.nexusAid)}/${name}`;
    try { await removeCustodyRow("storage", row); }
    catch (err) { if (err instanceof CustodyRowUnavailable) unswept.push(row); else throw err; }
  }
  return { act: minted.act, state, unswept };
}

/** The outcome of a burn: first of its kind, the same claim/batch again, or a different one on a burned entry. */
export type SpendOutcome = "fresh" | "retry" | "spent-other";

function spendFile(nexusAid: string, epochCid: string, tag: "n" | "m", key: string): string {
  const epoch = epochCid.toLowerCase();
  if (!HEX64.test(epoch)) throw new Error("[hosting-store] a spend names its epoch by a 64-hex act id");
  // The tag in the name keeps a nonce's row and a marker's row apart; the digest hides the value itself.
  return `${hostingRowDir(nexusAid)}/spent-${epoch}-${tag}-${sha256HexSync(key).slice(0, 32)}`;
}

/** Read one spend row, decide and write it under one custody holder: the row's presence IS the burn. */
async function burn(nexusAid: string, epochCid: string, tag: "n" | "m", key: string, value: string): Promise<SpendOutcome> {
  if (!/^\S+$/.test(key) || !/^\S+$/.test(value)) throw new Error("[hosting-store] a spend's key and value each stand as one word");
  const file = spendFile(nexusAid, epochCid, tag, key);
  await standHostingDir(nexusAid);
  // The row binds its own key beside its value: a digest collision in the name never reads as that key's burn.
  const line = `${tag} ${key} ${value}`;
  return updateCustodyRow<SpendOutcome>("storage", file, (standing) => {
    if (standing === null) return { plaintext: utf8.encode(line), value: "fresh" };
    let held: string;
    try { held = new TextDecoder("utf-8", { fatal: true }).decode(standing); } catch { throw malformed(file); }
    const parts = held.split(" ");
    if (parts.length !== 3 || parts[0] !== tag) throw malformed(file);
    return { plaintext: null, value: parts[1] === key && parts[2] === value ? "retry" : "spent-other" };
  });
}

/** Burn a redeemed token's nonce at `epochCid`, keyed to the redeemer's claim digest. */
export function spendToken(opts: {
  readonly nexusAid: string; readonly epochCid: string; readonly n: string; readonly claimDigest: string;
}): Promise<SpendOutcome> {
  return burn(opts.nexusAid, opts.epochCid, "n", opts.n.toLowerCase(), opts.claimDigest.toLowerCase());
}

/** Burn a lineage's mint marker at `epochCid`, keyed to the digest of the batch it minted. */
export function spendMintMarker(opts: {
  readonly nexusAid: string; readonly epochCid: string; readonly marker: string; readonly batchDigest: string;
}): Promise<SpendOutcome> {
  return burn(opts.nexusAid, opts.epochCid, "m", opts.marker.toLowerCase(), opts.batchDigest.toLowerCase());
}

async function countSpends(nexusAid: string, epochCid: string, tag: "n" | "m"): Promise<number> {
  const epoch = epochCid.toLowerCase();
  return (await spendNames(nexusAid)).filter((name) => { const m = SPEND_FILE.exec(name)!; return m[1] === epoch && m[2] === tag; }).length;
}

/** How many tokens were redeemed at `epochCid` — the count the hearth's operator reads, never a row. */
export function redeemedCount(nexusAid: string, epochCid: string): Promise<number> {
  return countSpends(nexusAid, epochCid, "n");
}

/** How many lineages minted at `epochCid` — a count, never a row. */
export function mintedCount(nexusAid: string, epochCid: string): Promise<number> {
  return countSpends(nexusAid, epochCid, "m");
}
