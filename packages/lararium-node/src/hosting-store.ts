/**
 * hosting-store — what a hearth keeps to host walkers in a Nexus: its current and previous hosting acts, and
 * one spent-set per live epoch. Nothing else.
 *
 * WHAT IT HOLDS, per Nexus it hosts in (`<storage>/hosting/<aid digest>/`):
 *   · `state.json` — the current hosting act and the previous one (or none). Both acts are public: each stands
 *     on the Nexus's carriage board too, and the current act names the allowance cap.
 *   · `spent-<epoch>` — append-only lines, fsynced before any answer:
 *       `n <nonce> <claim digest>`     — a token redeemed at this epoch;
 *       `m <marker> <batch digest>`    — a lineage's mint at this epoch.
 *     The nonces are random and name no one; a claim digest is a digest of the redeemer's claim, never the claim,
 *     so a seizer cannot compute any grant's lineage from it. A marker digests a lineage the hearth never sees.
 *
 * WHAT IT NEVER HOLDS: a grant, a guest leaf, a lineage, a blinded element, a token it evaluated, who minted,
 * who redeemed, or any mapping between them. Seized, it reveals how many tokens were redeemed and how many
 * mints happened in the live epochs — a count, never a roster.
 *
 * REFUSE BEFORE DESTROY. A spend is idempotent for its own claim: the same nonce redeemed again with the same
 * claim reads `retry` and earns the identical grant, so an answer lost after the burn destroys nothing. A
 * different claim on a burned nonce reads `spent-other` — silence at the gate. Every append is fsynced before
 * the gate answers; each burn reads and appends in one synchronous step, so no two burns interleave.
 *
 * A ROLL keeps exactly two epochs live: the new act becomes current, the old current becomes previous, and the
 * spent-set of any epoch outside those two is deleted. Rolling twice kills every grant and token of the epoch
 * before — the hard roll is a roll done twice.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { mkdirSync, readFileSync, readdirSync, rmSync, openSync, writeSync, fsyncSync, closeSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  sha256HexSync, isHostingAct, hostingActCid, hostingEpochOf, mintHostingAct,
  type HostingAct, type HostingEpoch,
} from "@lararium/mesh";
import { atomicWriteFileSync } from "./fs-atomic.js";

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

/** The directory one Nexus's hosting state lives in. */
export function hostingDir(storageDir: string, nexusAid: string): string {
  return join(storageDir, "hosting", sha256HexSync(nexusAid.trim().toLowerCase()).slice(0, 32));
}

/** Read the hosting state for N, or null where this hearth hosts nowhere in N (or the state is torn). */
export function readHostingState(storageDir: string, nexusAid: string): HostingState | null {
  try {
    const raw = JSON.parse(readFileSync(join(hostingDir(storageDir, nexusAid), "state.json"), "utf8")) as Record<string, unknown>;
    if (!isHostingAct(raw["current"])) return null;
    const previous = raw["previous"] === null ? null : isHostingAct(raw["previous"]) ? raw["previous"] : undefined;
    if (previous === undefined) return null;
    const depth = raw["depth"];
    if (typeof depth !== "number" || !Number.isSafeInteger(depth) || depth < 1) return null;
    return { current: raw["current"], previous, depth };
  } catch { return null; }
}

/** The live epochs a state names, re-derived from the hearth's leaf seed. Null where the seed derives other keys. */
export function liveEpochs(state: HostingState, leafSeed: Uint8Array): { readonly current: HostingEpoch; readonly previous: HostingEpoch | null } | null {
  const current = hostingEpochOf(state.current, leafSeed);
  if (!current) return null;
  const previous = state.previous ? hostingEpochOf(state.previous, leafSeed) : null;
  return { current, previous };
}

/**
 * ROLL: sign the hearth's next hosting act in N (rolling from its current one, or its first), make it current,
 * keep the old current as previous, and delete the spent-set of every other epoch. Returns the new act — the
 * caller lands it on N's carriage board. `cap` names a new allowance cap; absent, the standing one holds.
 */
export async function rollHosting(opts: {
  readonly storageDir: string; readonly nexusAid: string; readonly leafSeed: Uint8Array; readonly cap?: number;
}): Promise<{ readonly act: HostingAct; readonly state: HostingState }> {
  const prior = readHostingState(opts.storageDir, opts.nexusAid);
  const cap = opts.cap ?? prior?.current.cap ?? DEFAULT_HOSTING_CAP;
  const minted = await mintHostingAct({ leafSeed: opts.leafSeed, nexusAid: opts.nexusAid, prev: prior ? hostingActCid(prior.current) : null, cap });
  const state: HostingState = { current: minted.act, previous: prior?.current ?? null, depth: (prior?.depth ?? 0) + 1 };
  const dir = hostingDir(opts.storageDir, opts.nexusAid);
  mkdirSync(dir, { recursive: true });
  atomicWriteFileSync(join(dir, "state.json"), JSON.stringify(state));
  const live = new Set([`spent-${minted.cid}`, ...(state.previous ? [`spent-${hostingActCid(state.previous)}`] : [])]);
  for (const name of readdirSync(dir)) {
    if (name.startsWith("spent-") && !live.has(name)) rmSync(join(dir, name), { force: true });
  }
  return { act: minted.act, state };
}

// ── the spent-sets ────────────────────────────────────────────────────────────────────────────────

/** The outcome of a burn: first of its kind, the same claim/batch again, or a different one on a burned entry. */
export type SpendOutcome = "fresh" | "retry" | "spent-other";

function spentPath(storageDir: string, nexusAid: string, epochCid: string): string {
  return join(hostingDir(storageDir, nexusAid), `spent-${epochCid}`);
}

/** The lines of one spent-set: `tag key value`. An absent set reads empty. */
function spentLines(path: string): Array<[string, string, string]> {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter((l) => l.length > 0)
    .map((l) => l.split(" ") as [string, string, string]).filter((p) => p.length === 3);
}

/** Append one line and fsync it before returning — the burn lands before any answer. */
function appendDurably(path: string, line: string): void {
  const fd = openSync(path, "a");
  try { writeSync(fd, `${line}\n`); fsyncSync(fd); } finally { closeSync(fd); }
}

/** Read-then-append in one synchronous step: no other burn interleaves between the read and the write. */
async function burn(path: string, tag: "n" | "m", key: string, value: string): Promise<SpendOutcome> {
  for (const [t, k, v] of spentLines(path)) {
    if (t === tag && k === key) return v === value ? "retry" : "spent-other";
  }
  appendDurably(path, `${tag} ${key} ${value}`);
  return "fresh";
}

/** Burn a redeemed token's nonce at `epochCid`, keyed to the redeemer's claim digest. */
export function spendToken(opts: {
  readonly storageDir: string; readonly nexusAid: string; readonly epochCid: string; readonly n: string; readonly claimDigest: string;
}): Promise<SpendOutcome> {
  mkdirSync(hostingDir(opts.storageDir, opts.nexusAid), { recursive: true });
  return burn(spentPath(opts.storageDir, opts.nexusAid, opts.epochCid), "n", opts.n.toLowerCase(), opts.claimDigest.toLowerCase());
}

/** Burn a lineage's mint marker at `epochCid`, keyed to the digest of the batch it minted. */
export function spendMintMarker(opts: {
  readonly storageDir: string; readonly nexusAid: string; readonly epochCid: string; readonly marker: string; readonly batchDigest: string;
}): Promise<SpendOutcome> {
  mkdirSync(hostingDir(opts.storageDir, opts.nexusAid), { recursive: true });
  return burn(spentPath(opts.storageDir, opts.nexusAid, opts.epochCid), "m", opts.marker.toLowerCase(), opts.batchDigest.toLowerCase());
}

/** How many tokens were redeemed at `epochCid` — the count the hearth's operator reads, never a row. */
export function redeemedCount(storageDir: string, nexusAid: string, epochCid: string): number {
  return spentLines(spentPath(storageDir, nexusAid, epochCid)).filter(([t]) => t === "n").length;
}

/** How many lineages minted at `epochCid` — a count, never a row. */
export function mintedCount(storageDir: string, nexusAid: string, epochCid: string): number {
  return spentLines(spentPath(storageDir, nexusAid, epochCid)).filter(([t]) => t === "m").length;
}
