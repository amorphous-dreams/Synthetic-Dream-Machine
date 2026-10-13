/**
 * host — the hearth's three hosting doors behind `lares host`: read what it hosts, ROLL its hosting epoch, and
 * mint an invite of its own.
 *
 *   · `runHostState`  — per Nexus this hearth hosts in: the current and previous epochs (act CIDs), the cap, and
 *     how many tokens were redeemed this epoch and the last — counts, never a row.
 *   · `runHostRoll`   — sign the hearth's next hosting act in N with its per-Nexus leaf, keep the old act as the
 *     previous epoch, remove the spend rows of every older epoch, and LAND the act on this hearth's HOSTING DOC in N
 *     (`hostingDocUrl(N, gate key)`, the one doc its walkers read and N's carriers replicate). Rolling twice
 *     kills every grant and token two epochs back — the hard roll is a roll done twice.
 *   · `runHostInvite` — mint a `host-invite` token at the current epoch, in process (the hearth IS the minter,
 *     so blindness against it is moot), and hand back the one carried string. Nothing is written: no record
 *     of the invite stays here to name whom it was for.
 *
 * A hearth hosts through the face it WEARS: that face's leaf in N signs the act and seeds the act's key, the same
 * face its walks present. A vessel wearing no face hosts no one, and says so. Before its first act in N, a roll
 * reads the hosting doc: an act this face signed there that no local state holds refuses the roll.
 *
 * THE CUSTODY DOOR. The hosting rows rest sealed under the vessel key, so these doors run as acts of the sealed-act
 * table (`host.state`, `host.roll`, `host.invite`): an invite as a store verb's outcome would rest in the daemon's
 * document in the clear. When the vessel stands unlocked the roll lands on the running Repo — the replica its
 * walkers sync — so a walker's next dial reads the act with no restart. When none stands, the command holds the
 * store for the moment of the act; either way one process holds the store at a time.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import type { Repo } from "@automerge/automerge-repo";
import {
  hostingDocUrl, materializeSharedLarDoc, writeHostingAct, hostingActsFromBoard, hostingActCid, mintHostToken, encodeInvite,
  verifyHostingAct, type HostingAct, type LarDoc,
} from "@lararium/mesh";

/** The acts on a hosting doc that `hearthLeaf` itself signed FOR this Nexus. `hostingActsFromBoard` reads shape
 *  alone, and an act the leaf signed for another Nexus, copied here, says nothing about this one. */
async function signedActsOf(doc: LarDoc | undefined | null, hearthLeaf: string, nexusAid: string): Promise<HostingAct[]> {
  const signed: HostingAct[] = [];
  for (const act of hostingActsFromBoard(doc, hearthLeaf)) {
    if (act.nexusAid.toLowerCase() === nexusAid.toLowerCase() && (await verifyHostingAct(act))) signed.push(act);
  }
  return signed;
}
import { primaryNexusAid, carriedSet, charterHomeFor } from "../carried-set.js";
import { wornNexusLeaf, type NexusLeaf } from "../nexus-leaf.js";
import { loadVesselVerifyingKey } from "../node-vessel-identity.js";
import {
  readHostingState, rollHosting, liveEpochs, redeemedCount, HostingStateMoved, type HostingState,
} from "../hosting-store.js";

/**
 * LAND what the sealed state holds on the hosting doc: the current act and the previous one, each written only
 * where the doc lacks it. THE STATE ROW COMMITS A ROLL, and the doc re-derives from it: a roll that sealed its
 * state and stopped before its act reached the doc leaves an epoch no walker can read, and this lands it. The
 * next roll runs it first, and a sovereign composition runs it for every Nexus it hosts in as it stands. Answers
 * how many acts it landed.
 */
export async function landHostingActs(opts: { readonly nexusAid: string; readonly repo: Repo }): Promise<number> {
  const state = await readHostingState(opts.nexusAid);
  if (!state) return 0;
  const handle = await materializeSharedLarDoc(opts.repo, hostingDocUrl(opts.nexusAid, await loadVesselVerifyingKey()), "hosting");
  const standing = new Set(hostingActsFromBoard(handle.doc()).map(hostingActCid));
  const owed = [state.previous, state.current].filter((act): act is HostingAct => act !== null && !standing.has(hostingActCid(act)));
  if (owed.length === 0) return 0;
  handle.change((d) => { for (const act of owed) writeHostingAct(d, act); });
  await opts.repo.flush();
  return owed.length;
}

/** Land the sealed state's acts for every Nexus this hearth carries and hosts in. Answers how many acts it landed. */
export async function landEveryHostingAct(opts: { readonly sealHome: string; readonly repo: Repo }): Promise<number> {
  let landed = 0;
  for (const aid of [...(await carriedSet(opts.sealHome).catch(() => new Set<string>()))].sort()) {
    landed += await landHostingActs({ nexusAid: aid, repo: opts.repo });
  }
  return landed;
}

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

/** The leaf the face this vessel WEARS presents to N — the face that hosts. Nothing worn hosts no one. */
async function hostingLeaf(aid: string): Promise<NexusLeaf> {
  const leaf = await wornNexusLeaf(aid);
  if (!leaf) throw new HostRefusal("this vessel wears no face — a hearth hosts as the face it wears: `lares persona wear <N>` first");
  return leaf;
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
export async function runHostState(opts: { readonly sealHome: string }): Promise<readonly HostedNexusReading[]> {
  const out: HostedNexusReading[] = [];
  for (const aid of [...(await carriedSet(opts.sealHome).catch(() => new Set<string>()))].sort()) {
    const state = await readHostingState(aid);
    if (!state) continue;
    const epoch = hostingActCid(state.current);
    const previousEpoch = state.previous ? hostingActCid(state.previous) : null;
    out.push({
      nexusAid: aid, epoch, previousEpoch, cap: state.current.cap,
      redeemed: await redeemedCount(aid, epoch),
      redeemedPrevious: previousEpoch ? await redeemedCount(aid, previousEpoch) : 0,
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
  /** How many spend rows of dead epochs refused their removal (bytes this vessel's key does not open); they stay. */
  readonly unswept:  number;
}

/**
 * ROLL the hearth's hosting epoch in N and land the new act on its hosting doc. `repo` names the store's one
 * holder: the running vessel's own Repo when the vessel stands (the act reaches its walkers' sync at once), or
 * the direct holder's (`ownedStore`) when none stands.
 */
export async function runHostRoll(opts: {
  readonly sealHome: string; readonly nexusAid?: string; readonly cap?: number; readonly repo: Repo;
}): Promise<HostRollResult> {
  const aid = await hostedNexus(opts.sealHome, opts.nexusAid);
  if (!charterHomeFor(opts.sealHome, aid)) throw new HostRefusal(`no charter for ${aid.slice(0, 18)}… stands here`);
  const leaf = await hostingLeaf(aid);
  const docUrl = hostingDocUrl(aid, await loadVesselVerifyingKey());
  const land = async (repo: Repo): Promise<{ act: HostingAct; state: HostingState; unswept: readonly string[] }> => {
    const handle = await materializeSharedLarDoc(repo, docUrl, "hosting");
    // THE FIRST ACT READS BEFORE IT WRITES. An act this face signed on the doc that no local state holds means
    // the face already hosts here from another store; a second chain would split one face's spent-sets. It
    // surfaces, aloud, and nothing is written.
    // Only an act this face's own leaf SIGNED says so: the board reads by shape, and a planted act under this
    // leaf with a signature nobody made must never stop a lawful host from rolling.
    // A state an earlier roll sealed lands its acts first, so this roll chains from an act the doc carries.
    await landHostingActs({ nexusAid: aid, repo });
    if (!(await readHostingState(aid)) && (await signedActsOf(handle.doc(), leaf.verifyingKey, aid)).length > 0) {
      throw new HostRefusal("this face already hosts in this Nexus from another store — its act stands on the hosting doc and no local state holds it; nothing was written");
    }
    const rolled = await rollHosting({ nexusAid: aid, leafSeed: leaf.seed, ...(opts.cap !== undefined ? { cap: opts.cap } : {}) }).catch((err: unknown) => {
      if (err instanceof HostingStateMoved) throw new HostRefusal(err.message);
      throw err;
    });
    handle.change((d) => writeHostingAct(d, rolled.act));
    await repo.flush();
    return rolled;
  };
  const { act, state, unswept } = await land(opts.repo);
  return { nexusAid: aid, act, epoch: hostingActCid(act), previous: state.previous ? hostingActCid(state.previous) : null, cap: act.cap, docUrl, unswept: unswept.length };
}

/** Mint the hearth's own invite at the current epoch in N: the one carried string, and nothing kept. */
export async function runHostInvite(opts: {
  readonly sealHome: string; readonly nexusAid?: string; readonly relay?: string;
}): Promise<{ readonly nexusAid: string; readonly epoch: string; readonly invite: string }> {
  const aid = await hostedNexus(opts.sealHome, opts.nexusAid);
  const state: HostingState | null = await readHostingState(aid);
  if (!state) throw new HostRefusal("this hearth hosts no one here yet — `lares host roll` opens its first epoch");
  const live = liveEpochs(state, (await hostingLeaf(aid)).seed);
  if (!live) throw new HostRefusal("the hosting act names a key this face's leaf does not derive — roll again");
  const invite = encodeInvite({
    nexusAid: aid, gatePubKey: await loadVesselVerifyingKey(), token: mintHostToken(live.current),
    ...(opts.relay ? { relay: opts.relay } : {}),
  });
  return { nexusAid: aid, epoch: live.current.cid, invite };
}
