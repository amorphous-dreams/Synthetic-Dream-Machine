/**
 * swarm — the store holder runs the swarm's hand-only rows against the face's pinned board and the daemon wiki.
 *
 * The cap and the shares land on the face-private promote board (a sibling record family), and a go lands in the daemon wiki under
 * `$:/lares/swarm/`. The signer is the face's root seed, loaded only for the rows that sign; `show` reads and never touches the seed.
 * The wiki is checked first: with no standing daemon every row refuses by name before a face loads.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { wardRootSigner } from "../ward-signer.js";
import { loadPersonaGroupRootVerifyingKey } from "../node-vessel-identity.js";
import type { WardCredential } from "../ward-credential.js";
import type { Repo } from "@automerge/automerge-repo";
import {
  SwarmRefused, faceRecordsOf, promotePlaneUrl, swarmBoardRecords, swarmCommand, writeSwarmBoardAct,
  type LarDoc, type SwarmRequest, type SwarmSignerPort, type SwarmWikiPort,
} from "@lararium/mesh";
import { loadFaceFold, nodeWardCosignPortOf, IntentRefused, type FaceFold } from "./intent.js";

export async function runSwarmVerb(opts: {
  repo: Repo; catalogUrl?: string; face?: number; action: SwarmRequest["action"];
  args: Readonly<Record<string, unknown>>; wiki?: SwarmWikiPort;
  /** The face's ward route for this act: the house cap, a lane share and a push go each sign under it alone (seat-harness#/the-ward). */
  ward?: WardCredential;
}): Promise<Record<string, unknown>> {
  if (!opts.wiki) throw new SwarmRefused("swarm-no-daemon", "no standing daemon: swarm controls need the founded wiki");
  let loaded: FaceFold;
  try { loaded = await loadFaceFold(opts.repo, opts.catalogUrl, { index: opts.face }); }
  catch (e) { if (e instanceof IntentRefused) throw new SwarmRefused("face-log-unreadable", e.message); throw e; }
  const { group, index, face, personaPlane, signer } = loaded;
  if (!personaPlane) throw new SwarmRefused("face-log-unreadable", "the catalog names no persona plane for the face");
  const projection = face.project(faceRecordsOf([personaPlane.doc()], group), group);
  if (!projection.founded || projection.fork) throw new SwarmRefused("face-log-unreadable", "the face's signed log does not fold");
  const url = promotePlaneUrl(projection, group);
  if (!url) throw new SwarmRefused("swarm-board-unpinned", "the face pins no board for the swarm's cap and shares");
  const handle = await opts.repo.find<LarDoc>(url as never);
  const grant = (key: string) => face.currentSigner(key);
  // `show` signs nothing, so it never opens the ward; a signing row signs through the ward signer (S1's SwarmSignerPort), the root
  // seed opening fresh under this act's ward route at its signature and zeroing after it. The route is asked at the signature, so
  // a co-signed act the gate holds (the house cap, a go) asks no route at all.
  let signing: SwarmSignerPort = { key: "", sign: async () => { throw new SwarmRefused("swarm-show-signs-nothing", "show holds no signer"); } };
  const wardRefusal = (e: unknown): unknown => (e instanceof Error && /^ward-/.test(e.message) ? new SwarmRefused(e.message.split(":")[0]!, e.message) : e);
  if (opts.action !== "show") {
    const key = await loadPersonaGroupRootVerifyingKey(index);
    if (!key) throw new Error(`[ward-signer] this vessel holds no root at h${index}: a joinee signs as its device, never as the root`);
    signing = { key, sign: async (bytes) => {
      try { return await (await wardRootSigner(index, opts.ward, "a swarm control")).sign(bytes); }
      catch (e) { throw wardRefusal(e); }
    } };
  }
  const str = (key: string): string => (typeof opts.args[key] === "string" ? opts.args[key] as string : "");
  const request: SwarmRequest = opts.action === "show" ? { action: "show", ...(str("branch") && str("head") ? { branch: str("branch"), head: str("head") } : {}) }
    : opts.action === "cap-set" ? { action: "cap-set", value: opts.args["value"], ...(opts.args["supersede"] === true ? { supersede: true } : {}) }
    : opts.action === "share-set" ? { action: "share-set", lane: str("lane"), value: opts.args["value"], ...(opts.args["supersede"] === true ? { supersede: true } : {}) }
    : { action: "go-issue", branch: str("branch"), head: str("head") };
  return await swarmCommand(request, {
    group, face: { group, grant }, signer: signing, epoch: () => face.lineage[face.lineage.length - 1]!.epoch, wiki: opts.wiki,
    // The vessel and lead trust join at the slices that sign roster, receipt and lane state; at S1 the hand alone signs.
    trust: { hand: grant, vessel: () => false, lead: () => false },
    board: { records: async () => swarmBoardRecords(handle.doc(), group), land: async (act) => { handle.change((d) => writeSwarmBoardAct(d, act)); await opts.repo.flush(); } },
    // A local process names its own hand; the session gate refuses declared seat hands before custody reads. That `who` is
    // advisory for `show` alone: every signing row now signs under the ward, which no unlocked custody opens.
    who: { kind: "hand", id: signer.key },
    // THE CO-SIGN GATE: the house cap and a go wait on a second device of the face where it holds two (seat-harness#/the-swarm-slices).
    cosign: () => nodeWardCosignPortOf(opts.repo, loaded),
  });
}
