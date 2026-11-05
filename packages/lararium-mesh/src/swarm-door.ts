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

/** The verbs only a hand runs, by the code each refuses under. `swarm-show` stays open to a seat. */
export const SWARM_VERB_HAND_CODES: Readonly<Record<string, string>> = {
  "swarm-cap-set": "swarm-needs-hand", "swarm-share-set": "swarm-needs-hand", "swarm-go-issue": "swarm-needs-hand",
};

export type SwarmRequest =
  | { readonly action: "show"; readonly branch?: string; readonly head?: string }
  | { readonly action: "cap-set"; readonly value: unknown }
  | { readonly action: "share-set"; readonly lane: string; readonly value: unknown }
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
}

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
      ...(go ? { go: go.ok ? { standing: true } : { standing: false, refusal: go.refusal } } : {}),
    };
  }
  if (deps.who.kind !== "hand") throw new SwarmRefused("swarm-needs-hand", "a hand must decide");
  if (!deps.face.grant(deps.signer.key.toLowerCase())) throw new SwarmRefused("swarm-signer-not-grant", "the signer holds no grant of this face");
  if (req.action === "go-issue") {
    if (typeof req.branch !== "string" || req.branch.length === 0 || typeof req.head !== "string" || req.head.length === 0) throw new SwarmRefused("swarm-go-malformed", "a go names a branch and a head");
    const act = await signSwarmAct({ act: "go", group: deps.group, branch: req.branch, head: req.head, nonce: nonce() }, deps.signer);
    await putSwarmAct(wiki, swarmGoTitle(req.branch), act);
    return { branch: req.branch, head: req.head };
  }
  const r = await reading();
  if (req.action === "cap-set") {
    const refusal = swarmCapRefusal(req.value, r.raw);
    if (refusal) throw new SwarmRefused(refusal, `the cap ${String(req.value)} cannot stand against the shares the board holds`);
    const act = await signSwarmCap({ group: deps.group, epoch: deps.epoch(), value: req.value as number, parents: r.capHeads() }, deps.signer);
    await deps.board.land(act);
    return { cap: req.value, cid: swarmBoardActCid(act) };
  }
  swarmShareTitle(req.lane);   // a lane rides one title segment, so it refuses where a title would
  const refusal = swarmShareRefusal(r.cap, r.raw, req.lane, req.value);
  if (refusal) throw new SwarmRefused(refusal, `the share ${String(req.value)} for "${req.lane}" cannot stand against the cap ${String(r.cap)}`);
  const act = await signSwarmShare({ group: deps.group, epoch: deps.epoch(), lane: req.lane, value: req.value as number, parents: r.shareHeads(req.lane) }, deps.signer);
  await deps.board.land(act);
  return { lane: req.lane, share: req.value, cid: swarmBoardActCid(act) };
}
