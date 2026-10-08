/**
 * host — the hearth's three hosting doors behind `lares host`: read what it hosts, ROLL its hosting epoch, and
 * mint an invite of its own.
 *
 *   · `runHostState`  — per Nexus this hearth hosts in: the current and previous epochs (act CIDs), the cap, and
 *     how many tokens were redeemed this epoch and the last — counts, never a row.
 *   · `runHostRoll`   — sign the hearth's next hosting act in N with its per-Nexus leaf, keep the old act as the
 *     previous epoch, delete every older spent-set, and LAND the act on N's carriage board (the per-Nexus
 *     public/infra board a walker reads to check what its hearth published). Rolling twice kills every grant
 *     and token two epochs back — the hard roll is a roll done twice.
 *   · `runHostInvite` — mint a `host-invite` token at the current epoch, in process (the hearth IS the minter,
 *     so blindness against it is moot), and hand back the one carried string. Nothing is written: no record
 *     of the invite stays here to name whom it was for.
 *
 * A hearth hosts through its FACE: the first leaf its held personas present to N signs the act and seeds the
 * act's key. A vessel with no face in N hosts no one there, and says so.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  carriageDocUrl, materializeSharedLarDoc, writeHostingAct, hostingActCid, mintHostToken, encodeInvite,
  type HostingAct,
} from "@lararium/mesh";
import { larDataDir } from "../vessel-paths.js";
import { primaryNexusAid, carriedSet, charterHomeFor } from "../carried-set.js";
import { nodeNexusIsland } from "../nexus-standing.js";
import { heldNexusLeaves } from "../nexus-leaf.js";
import { loadVesselVerifyingKey } from "../node-vessel-identity.js";
import {
  readHostingState, rollHosting, liveEpochs, redeemedCount, type HostingState,
} from "../hosting-store.js";

/** A refusal a hosting door names, with nothing written. */
export class HostRefusal extends Error {}

/** The Nexus a door acts on: the one named, else the hearth's own charter. It must be one this hearth carries. */
async function hostedNexus(sealHome: string, nexusAid?: string): Promise<string> {
  const aid = (nexusAid ?? primaryNexusAid(sealHome) ?? "").trim().toLowerCase();
  if (!aid) throw new HostRefusal("this vessel holds no charter — name the Nexus to host in (--nexus <aid>)");
  const carried = await carriedSet(sealHome).catch(() => new Set<string>());
  if (![...carried].some((a) => a.toLowerCase() === aid)) {
    throw new HostRefusal(`this hearth does not carry ${aid.slice(0, 18)}… — it hosts only in a Nexus it carries`);
  }
  return aid;
}

async function hostingLeaf(aid: string): Promise<Uint8Array> {
  const leaf = (await heldNexusLeaves(aid))[0];
  if (!leaf) throw new HostRefusal("no face here holds a leaf in this Nexus — a hearth hosts through its face");
  return leaf.seed;
}

/** One Nexus this hearth hosts in, as `lares host` reads it. */
export interface HostedNexusReading {
  readonly nexusAid:         string;
  readonly epoch:            string;
  readonly previousEpoch:    string | null;
  readonly cap:              number;
  readonly redeemed:         number;
  readonly redeemedPrevious: number;
}

/** Every Nexus this hearth carries and hosts in, with its live epochs and its redemption counts. */
export async function runHostState(opts: { readonly sealHome: string; readonly storageDir?: string }): Promise<readonly HostedNexusReading[]> {
  const storageDir = opts.storageDir ?? larDataDir();
  const out: HostedNexusReading[] = [];
  for (const aid of [...(await carriedSet(opts.sealHome).catch(() => new Set<string>()))].sort()) {
    const state = readHostingState(storageDir, aid);
    if (!state) continue;
    const epoch = hostingActCid(state.current);
    const previousEpoch = state.previous ? hostingActCid(state.previous) : null;
    out.push({
      nexusAid: aid, epoch, previousEpoch, cap: state.current.cap,
      redeemed: redeemedCount(storageDir, aid, epoch),
      redeemedPrevious: previousEpoch ? redeemedCount(storageDir, aid, previousEpoch) : 0,
    });
  }
  return out;
}

/** What a roll leaves. */
export interface HostRollResult {
  readonly nexusAid: string;
  readonly act:      HostingAct;
  readonly epoch:    string;
  readonly previous: string | null;
  readonly cap:      number;
  readonly boardUrl: string;
}

/** ROLL the hearth's hosting epoch in N and land the new act on N's carriage board. */
export async function runHostRoll(opts: {
  readonly sealHome: string; readonly storageDir?: string; readonly nexusAid?: string; readonly cap?: number;
}): Promise<HostRollResult> {
  const storageDir = opts.storageDir ?? larDataDir();
  const aid = await hostedNexus(opts.sealHome, opts.nexusAid);
  const home = charterHomeFor(opts.sealHome, aid);
  if (!home) throw new HostRefusal(`no charter for ${aid.slice(0, 18)}… stands here`);
  const leafSeed = await hostingLeaf(aid);
  const island = nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: home });
  const boardUrl = carriageDocUrl(island);
  const { act, state } = await rollHosting({ storageDir, nexusAid: aid, leafSeed, ...(opts.cap !== undefined ? { cap: opts.cap } : {}) });
  const repo = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  try {
    const handle = await materializeSharedLarDoc(repo, boardUrl, "board:carriage-contracts");
    handle.change((d) => writeHostingAct(d, act));
    await repo.flush();
  } finally {
    await repo.shutdown().catch(() => { /* best-effort */ });
  }
  return { nexusAid: aid, act, epoch: hostingActCid(act), previous: state.previous ? hostingActCid(state.previous) : null, cap: act.cap, boardUrl };
}

/** Mint the hearth's own invite at the current epoch in N: the one carried string, and nothing kept. */
export async function runHostInvite(opts: {
  readonly sealHome: string; readonly storageDir?: string; readonly nexusAid?: string; readonly relay?: string;
}): Promise<{ readonly nexusAid: string; readonly epoch: string; readonly invite: string }> {
  const storageDir = opts.storageDir ?? larDataDir();
  const aid = await hostedNexus(opts.sealHome, opts.nexusAid);
  const state: HostingState | null = readHostingState(storageDir, aid);
  if (!state) throw new HostRefusal("this hearth hosts no one here yet — `lares host roll` opens its first epoch");
  const live = liveEpochs(state, await hostingLeaf(aid));
  if (!live) throw new HostRefusal("the hosting act names a key this face's leaf does not derive — roll again");
  const invite = encodeInvite({
    nexusAid: aid, gatePubKey: await loadVesselVerifyingKey(), token: mintHostToken(live.current),
    ...(opts.relay ? { relay: opts.relay } : {}),
  });
  return { nexusAid: aid, epoch: live.current.cid, invite };
}
