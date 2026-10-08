/**
 * host — the hearth's three hosting doors behind `lares host`: read what it hosts, ROLL its hosting epoch, and
 * mint an invite of its own.
 *
 *   · `runHostState`  — per Nexus this hearth hosts in: the current and previous epochs (act CIDs), the cap, and
 *     how many tokens were redeemed this epoch and the last — counts, never a row.
 *   · `runHostRoll`   — sign the hearth's next hosting act in N with its per-Nexus leaf, keep the old act as the
 *     previous epoch, delete every older spent-set, and LAND the act on this hearth's HOSTING DOC in N
 *     (`hostingDocUrl(N, gate key)`, the one doc its walkers read and N's carriers replicate). Rolling twice
 *     kills every grant and token two epochs back — the hard roll is a roll done twice.
 *   · `runHostInvite` — mint a `host-invite` token at the current epoch, in process (the hearth IS the minter,
 *     so blindness against it is moot), and hand back the one carried string. Nothing is written: no record
 *     of the invite stays here to name whom it was for.
 *
 * A hearth hosts through its FACE: the first leaf its held personas present to N signs the act and seeds the
 * act's key. A vessel with no face in N hosts no one there, and says so.
 *
 * ONE STORE, ONE HOLDER. When the vessel stands, these doors run INSIDE it (`host-*` verbs over the local socket)
 * and the roll lands on the running Repo — the replica its walkers sync — so a walker's next dial reads the act
 * with no restart. When it does not stand, the CLI owns the store and opens it itself; either way one process
 * holds the store at a time.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  hostingDocUrl, materializeSharedLarDoc, writeHostingAct, hostingActCid, mintHostToken, encodeInvite,
  type HostingAct,
} from "@lararium/mesh";
import { larDataDir } from "../vessel-paths.js";
import { primaryNexusAid, carriedSet, charterHomeFor } from "../carried-set.js";
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
  /** The hearth's hosting doc in N — the doc the act landed on. */
  readonly docUrl:   string;
}

/**
 * ROLL the hearth's hosting epoch in N and land the new act on its hosting doc. `repo` is the running vessel's
 * own Repo when the vessel stands (the act reaches its walkers' sync at once); absent, the door opens the store
 * itself and flushes before it returns.
 */
export async function runHostRoll(opts: {
  readonly sealHome: string; readonly storageDir?: string; readonly nexusAid?: string; readonly cap?: number; readonly repo?: Repo;
}): Promise<HostRollResult> {
  const storageDir = opts.storageDir ?? larDataDir();
  const aid = await hostedNexus(opts.sealHome, opts.nexusAid);
  if (!charterHomeFor(opts.sealHome, aid)) throw new HostRefusal(`no charter for ${aid.slice(0, 18)}… stands here`);
  const leafSeed = await hostingLeaf(aid);
  const docUrl = hostingDocUrl(aid, await loadVesselVerifyingKey());
  const { act, state } = await rollHosting({ storageDir, nexusAid: aid, leafSeed, ...(opts.cap !== undefined ? { cap: opts.cap } : {}) });
  const land = async (repo: Repo): Promise<void> => {
    const handle = await materializeSharedLarDoc(repo, docUrl, "hosting");
    handle.change((d) => writeHostingAct(d, act));
    await repo.flush();
  };
  if (opts.repo) {
    await land(opts.repo);
  } else {
    const repo = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
    try { await land(repo); } finally { await repo.shutdown().catch(() => { /* best-effort */ }); }
  }
  return { nexusAid: aid, act, epoch: hostingActCid(act), previous: state.previous ? hostingActCid(state.previous) : null, cap: act.cap, docUrl };
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
