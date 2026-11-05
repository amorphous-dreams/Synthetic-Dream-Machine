/**
 * swarm — the store holder runs the swarm's hand-only rows against the face's pinned board and the daemon wiki.
 *
 * The cap and the shares land on the face-private promote board (a sibling record family), and a go lands in the daemon wiki under
 * `$:/lares/swarm/`. The signer is the face's root seed, loaded only for the rows that sign; `show` reads and never touches the seed.
 * The wiki is checked first: with no standing daemon every row refuses by name before a face loads.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import type { Repo } from "@automerge/automerge-repo";
import {
  SwarmRefused, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, faceRecordsOf, promotePlaneUrl, swarmBoardRecords, swarmCommand, writeSwarmBoardAct,
  type LarDoc, type SwarmRequest, type SwarmSignerPort, type SwarmWikiPort,
} from "@lararium/mesh";
import { loadIntentFace, IntentRefused } from "./intent.js";
import { loadPersonaGroupRootSeed } from "../node-vessel-identity.js";

export async function runSwarmVerb(opts: {
  repo: Repo; catalogUrl?: string; face?: number; action: SwarmRequest["action"];
  args: Readonly<Record<string, unknown>>; wiki?: SwarmWikiPort;
}): Promise<Record<string, unknown>> {
  if (!opts.wiki) throw new SwarmRefused("swarm-no-daemon", "no standing daemon: swarm controls need the founded wiki");
  let loaded: Awaited<ReturnType<typeof loadIntentFace>>;
  try { loaded = await loadIntentFace(opts.repo, opts.catalogUrl, { index: opts.face }); }
  catch (e) { if (e instanceof IntentRefused) throw new SwarmRefused("face-log-unreadable", e.message); throw e; }
  const { group, index, face, personaPlane, signer } = loaded;
  if (!personaPlane) throw new SwarmRefused("face-log-unreadable", "the catalog names no persona plane for the face");
  const projection = face.project(faceRecordsOf([personaPlane.doc()], group), group);
  if (!projection.founded || projection.fork) throw new SwarmRefused("face-log-unreadable", "the face's signed log does not fold");
  const url = promotePlaneUrl(projection, group);
  if (!url) throw new SwarmRefused("swarm-board-unpinned", "the face pins no board for the swarm's cap and shares");
  const handle = await opts.repo.find<LarDoc>(url as never);
  const grant = (key: string) => face.currentSigner(key);
  // `show` signs nothing, so it never reads the root seed; a signing row loads it once, here.
  let signing: SwarmSignerPort = { key: "", sign: async () => { throw new SwarmRefused("swarm-show-signs-nothing", "show holds no signer"); } };
  if (opts.action !== "show") {
    const seed = await loadPersonaGroupRootSeed(index);
    signing = { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
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
    // ADVISORY: a script holding the face's unlocked custody names the same hand, until the ward binds the signing rows.
    who: { kind: "hand", id: signer.key },
  });
}
