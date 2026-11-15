/**
 * swarm-door — the hand-only verbs over the swarm model: `show`, `cap-set`, `share-set`, `lei-kui`.
 *
 * ADVISORY at this slice: a client names its own hand, so the socket gate (`SWARM_VERB_HAND_CODES`) and the `who` check here refuse a
 * seat but cannot bind a script holding the face's custody; the ward slice binds them. The signer arrives as a `SwarmSignerPort`, so
 * the ward's signer replaces the face's root signer without touching a verb.
 *
 * With no standing daemon wiki every act, `show` too, refuses by name and writes nothing: no flat-file fallback.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { readSwarmBoard, readSwarmBoardAct, signSwarmCap, signSwarmShare, swarmBoardActCid, swarmCapHead, type SignedSwarmBoardAct, type SwarmBoardFace } from "./swarm-board.js";
import {
  SwarmRefused, readLei, readLeiChain, signSwarmAct, swarmActCid, swarmCapRefusal, swarmLeiHead, swarmLeiRowTitle, swarmShareRefusal, swarmShareTitle,
  type SwarmSignerPort, type SwarmTrust, type SwarmLeiReach, type SwarmLeiTerms, type SwarmWikiPort,
} from "./swarm-tiddlers.js";
import { isSwarmLeiRite, wardLeiVerb, type SwarmLeiRite } from "./swarm-lei-rite.js";
import { cosignPortWitness, WardActAlreadyRun, wardCosignGate, type WardCosignAct, type WardCosignPort } from "./ward-cosign-gate.js";
import { WARD_GATE_DECIDED } from "./ward-door-decided.js";
import { WardRefused } from "./ward-slots.js";

/** The verbs only a hand runs, by the code each refuses under. `swarm-show` stays open to a seat. */
export const SWARM_VERB_HAND_CODES: Readonly<Record<string, string>> = {
  "swarm-cap-set": "swarm-needs-hand", "swarm-share-set": "swarm-needs-hand", "swarm-lei-kui": "swarm-needs-hand",
};

export type SwarmRequest =
  /** `rite`, `branch` and `head` together ask after one rite's lei; a branch and head with no rite refuse. */
  | { readonly action: "show"; readonly rite?: SwarmLeiRite; readonly branch?: string; readonly head?: string }
  /** `supersede`: the hand starts an unavailable or braked line again, citing its dangling heads; on a line that folds clear it refuses. */
  | { readonly action: "cap-set"; readonly value: unknown; readonly supersede?: boolean }
  | { readonly action: "share-set"; readonly lane: string; readonly value: unknown; readonly supersede?: boolean }
  /** `rite`: the one power the lei carries (`push` · `restart`); the door refuses a lei that names none. `after`: the cid of the lei
   *  this one follows at its rite's line for the branch (`show` names it), null for the first there. One issue names one lei, so a
   *  fresh lei for one head asks afresh, and a replay of an approved lei names the same intent and refuses spent. */
  | { readonly action: "lei-kui"; readonly rite: SwarmLeiRite; readonly branch: string; readonly after: string | null;
      /** The lei's reach. Absent reads `wide`, the default: the lei names no head and needs `returns`, the count of spends the hand
       *  writes into it. `head` pins one head and needs `head`. A lei that mixes the two refuses. */
      readonly reach?: SwarmLeiReach; readonly returns?: number; readonly head?: string };

export interface SwarmDoorDeps {
  readonly group: string;
  /** The face the door signs under; its board reads compose the co-sign witness from `cosign` at each act. */
  readonly face: Omit<SwarmBoardFace, "ward">;
  readonly signer: SwarmSignerPort;
  readonly trust: SwarmTrust;
  readonly epoch: () => number;
  readonly board: { readonly records: () => Promise<unknown[]>; readonly land: (act: SignedSwarmBoardAct) => Promise<void> };
  /** The daemon wiki, where one stands; absent before the wiki stands. */
  readonly wiki?: SwarmWikiPort;
  readonly who: { readonly kind: "hand" | "seat"; readonly id: string };
  /** The face's intent plane, where the house cap's and a lei's co-sign ride (seat-harness#/the-swarm-slices). */
  readonly cosign: () => WardCosignPort | Promise<WardCosignPort>;
}

/** Run a co-signed swarm act through the gate, its refusals named as the swarm's own. */
async function gated<T>(deps: SwarmDoorDeps, act: WardCosignAct, effect: () => Promise<T>): Promise<T> {
  try { return await wardCosignGate(await deps.cosign(), act, effect); }
  catch (e) { if (e instanceof WardRefused) throw new SwarmRefused(e.reading, e.message.slice(e.reading.length + 2)); throw e; }
}

/**
 * Where a fresh lei may follow on its branch: a lei naming an `after` a co-signed lei already follows forks the chain and refuses
 * `swarm-lei-forked`; one naming neither a tip of the longest co-signed chain (nor null on a branch with none) refuses
 * `swarm-lei-after-moved`. This very lei resting already (a replay) passes on to the gate, which names it spent or already run.
 */
function leiFollowRefusal(chain: Awaited<ReturnType<typeof readLeiChain>>, branch: string, leiHead: string, after: string | null): SwarmRefused | null {
  if (chain.resting.some((g) => swarmLeiHead(g.body) === leiHead)) return null;
  if (chain.cosigned.some((g) => g.body.after === after)) return new SwarmRefused("swarm-lei-forked", `a lei at "${branch}" already follows ${after ?? "the branch's start"}; name the chain's tip`);
  const tips = chain.tips.map((g) => g.cid);
  if (tips.length === 0 ? after !== null : after === null || !tips.includes(after)) {
    return new SwarmRefused("swarm-lei-after-moved", `the lei at "${branch}" moved since this issue named the one it follows; name ${tips.join(" or ") || "null"}`);
  }
  return null;
}

export async function swarmCommand(req: SwarmRequest, deps: SwarmDoorDeps): Promise<Record<string, unknown>> {
  const wiki = deps.wiki;
  if (!wiki) throw new SwarmRefused("swarm-no-daemon", "no standing daemon: swarm controls need the founded wiki");
  // Every read of the board and the lei names the co-sign witness over the face's plane, read at this act.
  const witness = async () => {
    try { return cosignPortWitness(await deps.cosign()); }
    catch (e) { if (e instanceof WardRefused) throw new SwarmRefused(e.reading, e.message.slice(e.reading.length + 2)); throw e; }
  };
  const reading = async () => readSwarmBoard(await deps.board.records(), { ...deps.face, ward: await witness() });
  if (req.action === "show") {
    const r = await reading();
    if (req.branch !== undefined && req.head !== undefined && !isSwarmLeiRite(req.rite)) throw new SwarmRefused("swarm-lei-malformed", "a lei names its rite (push or restart): show reads one rite's lei");
    const at = req.branch !== undefined && req.head !== undefined ? { rite: req.rite as SwarmLeiRite, branch: req.branch, head: req.head } : undefined;
    const lei = at ? await readLei(wiki, at, deps.trust, deps.group, await witness()) : undefined;
    // `after` names only a standing lei: the one tip of the branch's longest co-signed chain; a fork names its tips instead.
    const chain = at ? await readLeiChain(wiki, at, deps.trust, deps.group, await witness()) : undefined;
    const follows = chain ? (chain.tips.length === 1 ? chain.tips[0]!.cid : null) : undefined;
    const forks = chain && chain.tips.length > 1 ? chain.tips.map((g) => g.cid) : undefined;
    return {
      cap: r.cap, ok: r.ok, ...(r.refusal ? { refusal: r.refusal } : {}), ...(r.capBraked ? { braked: { cap: "refused-tip" as const } } : {}), shares: Object.fromEntries([...r.shares].sort(([a], [b]) => a.localeCompare(b))), refused: r.refused.length,
      ...(r.unavailable.cap || r.unavailable.shares.size > 0 ? { unavailable: {
        ...(r.unavailable.cap ? { cap: r.unavailable.cap } : {}),
        shares: Object.fromEntries([...r.unavailable.shares].sort(([a], [b]) => a.localeCompare(b))),
      } } : {}),
      // `after`: the lei a fresh issue at this branch names as the one it follows.
      ...(lei ? { lei: { ...(lei.ok ? { standing: true, reach: lei.reach, returnsLeft: lei.returnsLeft } : { standing: false, refusal: lei.refusal }), after: follows ?? null, ...(forks ? { forks } : {}) } } : {}),
    };
  }
  if (deps.who.kind !== "hand") throw new SwarmRefused("swarm-needs-hand", "a hand must decide");
  if (!deps.face.grant(deps.signer.key.toLowerCase())) throw new SwarmRefused("swarm-signer-not-grant", "the signer holds no grant of this face");
  if (req.action === "lei-kui") {
    if (!isSwarmLeiRite(req.rite)) throw new SwarmRefused("swarm-lei-malformed", "a lei names its rite (push or restart)");
    if (typeof req.branch !== "string" || req.branch.length === 0) throw new SwarmRefused("swarm-lei-malformed", "a lei names a branch");
    // THE REACH: wide stands as the default, and each reach holds its own terms whole.
    const reach = req.reach ?? "wide";
    if (reach !== "wide" && reach !== "head") throw new SwarmRefused("swarm-lei-malformed", "a lei's reach reads wide or head");
    let terms: SwarmLeiTerms;
    if (reach === "wide") {
      if (req.head !== undefined) throw new SwarmRefused("swarm-lei-malformed", "a wide lei names no head; name the head reach to pin one");
      if (typeof req.returns !== "number" || !Number.isSafeInteger(req.returns) || req.returns < 1) throw new SwarmRefused("swarm-lei-malformed", "a wide lei names its returns, a count of at least one");
      terms = { reach, returns: req.returns };
    } else {
      if (req.returns !== undefined) throw new SwarmRefused("swarm-lei-malformed", "a head lei spends once and names no returns");
      if (typeof req.head !== "string" || req.head.length === 0) throw new SwarmRefused("swarm-lei-malformed", "a head lei names its head");
      terms = { reach, head: req.head };
    }
    if (req.after !== null && !(typeof req.after === "string" && /^[0-9a-f]{64}$/.test(req.after))) throw new SwarmRefused("swarm-lei-malformed", "a lei names the lei it follows at its branch (`after`, a cid), or null for the branch's first");
    const rite = req.rite, branch = req.branch, after = req.after;
    const verb = wardLeiVerb(rite), leiHead = swarmLeiHead({ rite, branch, after, ...terms });
    // A fork or a moved chain refuses before the gate asks, so no second device answers an act that cannot land.
    const early = leiFollowRefusal(await readLeiChain(wiki, { rite, branch }, deps.trust, deps.group, await witness()), branch, leiHead, after);
    if (early) throw early;
    return gated(deps, { verb, wiki: "daemon", head: leiHead }, async () => {
      const chain = await readLeiChain(wiki, { rite, branch }, deps.trust, deps.group, await witness());
      // A REPLAY RUNS NOTHING: this very lei (its branch, head and `after`) already rests, its outcome never landed; the gate lands it.
      if (chain.resting.some((g) => swarmLeiHead(g.body) === leiHead)) throw new WardActAlreadyRun(verb, leiHead);
      const refused = leiFollowRefusal(chain, branch, leiHead, after);
      if (refused) throw refused;
      const act = await signSwarmAct({ act: "lei", group: deps.group, rite, branch, after, ...terms }, deps.signer);
      // Each lei claims its own row: a second writer of the same lei lands nothing more.
      if (!(await wiki.writeNew(swarmLeiRowTitle(rite, branch, swarmActCid(act)), JSON.stringify(act)))) throw new WardActAlreadyRun(verb, leiHead);
      return { rite, branch, ...terms };
    });
  }
  const r = await reading();
  /**
   * The parents a write cites: the line's heads where it folds; on an unavailable line, a hand's supersede alone, citing its dangling
   * heads. A BRAKED line (a refused tip holds it at its tightest) folds, so a write extends its heads, and a hand's supersede may root it again.
   */
  const parentsOf = (line: string, unavailable: string | undefined, heads: string[], dangling: string[], supersede: boolean | undefined, braked = false): { parents: string[]; supersede?: true } => {
    if (braked && supersede) return { parents: dangling, supersede: true };
    if (unavailable === undefined) {
      if (supersede) throw new SwarmRefused("swarm-supersede-unneeded", `the ${line} line folds; a supersede starts only a line that cannot`);
      return { parents: heads };
    }
    if (!supersede) throw new SwarmRefused("swarm-line-unavailable", `the ${line} line cannot fold (${unavailable}); a hand's supersede starts it again`);
    return { parents: dangling, supersede: true };
  };
  if (req.action === "cap-set") {
    const refusal = swarmCapRefusal(req.value, r.raw);
    if (refusal) throw new SwarmRefused(refusal, `the cap ${String(req.value)} cannot stand against the shares the board holds`);
    const line = parentsOf("cap", r.unavailable.cap, r.capHeads(), r.capDangling(), req.supersede, r.capBraked);
    const value = req.value as number;
    // The co-sign names the value and the line it extends: a line that moved after the answer asks again.
    const capHead = swarmCapHead({ value, parents: line.parents, supersede: line.supersede === true });
    return gated(deps, { verb: "ward-house-cap", wiki: "daemon", head: capHead }, async () => {
      // A REPLAY RUNS NOTHING: a cap of this value on this very line already rests on the board, its outcome never landed.
      const ran = (await deps.board.records()).some((raw) => {
        const read = readSwarmBoardAct(raw, { ...deps.face, ward: WARD_GATE_DECIDED });
        return read.ok && read.act.body.act === "cap" && swarmCapHead(read.act.body) === capHead;
      });
      if (ran) throw new WardActAlreadyRun("ward-house-cap", capHead);
      const act = await signSwarmCap({ group: deps.group, epoch: deps.epoch(), value, ...line }, deps.signer);
      await deps.board.land(act);
      return { cap: value, cid: swarmBoardActCid(act) };
    });
  }
  swarmShareTitle(req.lane);   // a lane rides one title segment, so it refuses where a title would
  const refusal = swarmShareRefusal(r.cap, r.raw, req.lane, req.value);
  if (refusal) throw new SwarmRefused(refusal, `the share ${String(req.value)} for "${req.lane}" cannot stand against the cap ${String(r.cap)}`);
  const line = parentsOf(`share "${req.lane}"`, r.unavailable.shares.get(req.lane), r.shareHeads(req.lane), r.shareDangling(req.lane), req.supersede);
  const act = await signSwarmShare({ group: deps.group, epoch: deps.epoch(), lane: req.lane, value: req.value as number, ...line }, deps.signer);
  await deps.board.land(act);
  return { lane: req.lane, share: req.value, cid: swarmBoardActCid(act) };
}

/**
 * Kui: string a lei. The hand grants one rite at one branch under one reach, and the door's `lei-kui` act runs it: the same
 * checks, the same co-sign gate, the same row. A caller that holds the lei's terms names them here without spelling the action.
 */
export const kuiLei = (lei: Omit<Extract<SwarmRequest, { readonly action: "lei-kui" }>, "action">, deps: SwarmDoorDeps): Promise<Record<string, unknown>> =>
  swarmCommand({ action: "lei-kui", ...lei }, deps);
