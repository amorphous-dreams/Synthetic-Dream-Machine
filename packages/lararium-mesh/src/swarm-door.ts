/**
 * swarm-door — the hand-only verbs over the swarm model: `show`, `cap-set`, `share-set`, `go-issue`.
 *
 * ADVISORY at this slice: a client names its own hand, so the socket gate (`SWARM_VERB_HAND_CODES`) and the `who` check here refuse a
 * seat but cannot bind a script holding the face's custody; the ward slice binds them. The signer arrives as a `SwarmSignerPort`, so
 * the ward's signer replaces the face's root signer without touching a verb.
 *
 * With no standing daemon wiki every act, `show` too, refuses by name and writes nothing: no flat-file fallback.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { readSwarmBoard, signSwarmCap, signSwarmShare, swarmBoardActCid, type SignedSwarmBoardAct, type SwarmBoardFace } from "./swarm-board.js";
import {
  SwarmRefused, putSwarmAct, readGo, signSwarmAct, swarmCapRefusal, swarmGoTitle, swarmShareRefusal, swarmShareTitle,
  type SwarmSignerPort, type SwarmTrust, type SwarmWikiPort,
} from "./swarm-tiddlers.js";
import { wardCosignGate, type WardCosignAct, type WardCosignPort } from "./ward-cosign-gate.js";
import { WardRefused } from "./ward-slots.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";

/** The verbs only a hand runs, by the code each refuses under. `swarm-show` stays open to a seat. */
export const SWARM_VERB_HAND_CODES: Readonly<Record<string, string>> = {
  "swarm-cap-set": "swarm-needs-hand", "swarm-share-set": "swarm-needs-hand", "swarm-go-issue": "swarm-needs-hand",
};

export type SwarmRequest =
  | { readonly action: "show"; readonly branch?: string; readonly head?: string }
  /** `supersede`: the hand starts an unavailable line again, citing its dangling heads; on a line that folds it refuses. */
  | { readonly action: "cap-set"; readonly value: unknown; readonly supersede?: boolean }
  | { readonly action: "share-set"; readonly lane: string; readonly value: unknown; readonly supersede?: boolean }
  | { readonly action: "go-issue"; readonly branch: string; readonly head: string };

export interface SwarmDoorDeps {
  readonly group: string;
  readonly face: SwarmBoardFace;
  readonly signer: SwarmSignerPort;
  readonly trust: SwarmTrust;
  readonly epoch: () => number;
  readonly board: { readonly records: () => Promise<unknown[]>; readonly land: (act: SignedSwarmBoardAct) => Promise<void> };
  /** The daemon wiki, where one stands; absent before the wiki stands. */
  readonly wiki?: SwarmWikiPort;
  readonly who: { readonly kind: "hand" | "seat"; readonly id: string };
  /** The face's intent plane, where the house cap's and a go's co-sign ride (seat-harness#/the-swarm-slices). */
  readonly cosign: () => WardCosignPort | Promise<WardCosignPort>;
}

/** Run a co-signed swarm act through the gate, its refusals named as the swarm's own. */
async function gated<T>(deps: SwarmDoorDeps, act: WardCosignAct, effect: () => Promise<T>): Promise<T> {
  try { return await wardCosignGate(await deps.cosign(), act, effect); }
  catch (e) { if (e instanceof WardRefused) throw new SwarmRefused(e.reading, e.message.slice(e.reading.length + 2)); throw e; }
}
const headOf = (value: unknown): string => sha256HexBytesSync(canonicalJsonBytes(value));

const nonce = (): string => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");

export async function swarmCommand(req: SwarmRequest, deps: SwarmDoorDeps): Promise<Record<string, unknown>> {
  const wiki = deps.wiki;
  if (!wiki) throw new SwarmRefused("swarm-no-daemon", "no standing daemon: swarm controls need the founded wiki");
  const reading = async () => readSwarmBoard(await deps.board.records(), deps.face);
  if (req.action === "show") {
    const r = await reading();
    const go = req.branch !== undefined && req.head !== undefined ? await readGo(wiki, { branch: req.branch, head: req.head }, deps.trust, deps.group) : undefined;
    return {
      cap: r.cap, ok: r.ok, ...(r.refusal ? { refusal: r.refusal } : {}), shares: Object.fromEntries([...r.shares].sort(([a], [b]) => a.localeCompare(b))), refused: r.refused.length,
      ...(r.unavailable.cap || r.unavailable.shares.size > 0 ? { unavailable: {
        ...(r.unavailable.cap ? { cap: r.unavailable.cap } : {}),
        shares: Object.fromEntries([...r.unavailable.shares].sort(([a], [b]) => a.localeCompare(b))),
      } } : {}),
      ...(go ? { go: go.ok ? { standing: true } : { standing: false, refusal: go.refusal } } : {}),
    };
  }
  if (deps.who.kind !== "hand") throw new SwarmRefused("swarm-needs-hand", "a hand must decide");
  if (!deps.face.grant(deps.signer.key.toLowerCase())) throw new SwarmRefused("swarm-signer-not-grant", "the signer holds no grant of this face");
  if (req.action === "go-issue") {
    if (typeof req.branch !== "string" || req.branch.length === 0 || typeof req.head !== "string" || req.head.length === 0) throw new SwarmRefused("swarm-go-malformed", "a go names a branch and a head");
    const branch = req.branch, head = req.head;
    return gated(deps, { verb: "ward-push-go", wiki: "daemon", head: headOf({ branch, head }) }, async () => {
      const act = await signSwarmAct({ act: "go", group: deps.group, branch, head, nonce: nonce() }, deps.signer);
      await putSwarmAct(wiki, swarmGoTitle(branch), act);
      return { branch, head };
    });
  }
  const r = await reading();
  /** The parents a write cites: the line's heads where it folds; on an unavailable line, a hand's supersede alone, citing its dangling heads. */
  const parentsOf = (line: string, unavailable: string | undefined, heads: string[], dangling: string[], supersede: boolean | undefined): { parents: string[]; supersede?: true } => {
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
    const line = parentsOf("cap", r.unavailable.cap, r.capHeads(), r.capDangling(), req.supersede);
    const value = req.value as number;
    // The co-sign names the value and the line it extends: a line that moved after the answer asks again.
    return gated(deps, { verb: "ward-house-cap", wiki: "daemon", head: headOf({ value, parents: [...line.parents].sort(), supersede: line.supersede === true }) }, async () => {
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
