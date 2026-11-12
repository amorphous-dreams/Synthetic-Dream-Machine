/**
 * browser-fleet-seat — THE CARRIED SEAT on a browser vessel: the second round of two files that seats a joined leaf with
 * no road to the vessel that holds its face (`@lararium/keyhive` `carried-seat`; device-capabilities-2026#/device-seats).
 *
 *   JOINED LEAF   `browserSeatRequest`    its own `face-join` intent as a file: the card its landing minted, the edge the
 *                                         root signed for it, signed by its atom and pinned to the founding hearth
 *   ROOT HOLDER   `browserSeatGrant`      lays that intent on its own intents plane, where its standing door answers
 *                                         through the one gate, and hands back the grant the door wrote
 *   JOINED LEAF   `browserSeatGrantLand`  keeps the grant in its secret home; its standing seat reads it there at the next
 *                                         boot, verifies it, ingests it, and runs the Lift
 *
 * The files carry signed public records alone. No ward opens here: the root holder's grant signs under the face's ATOM
 * (the daemon island's own key for the face), never its root, so seating a device the root already admitted asks nobody.
 */
import type { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import {
  DOCUMENT_HANG_BOUND_MS, ed25519SignerFromSeed, faceAtomKeyFromSeed, personaActRecordsOfGroup, type EdgeStanding, type HandLineage, type LarDoc,
} from "@lararium/mesh";
import {
  CarriedSeatRefused, boardDyadReader, composeSeatRequest, dropCarriedSeatGrant, keepCarriedSeatGrant, keptSeatGrant, placeSeatRequest, readSeatGrant, readSeatRequest, seatGrantAnswering, verifyCarriedSeatGrant,
  type FaceGrantVerdict, type FleetSeatGrant, type FleetSeatRequest, type FounderLineage,
} from "@lararium/keyhive";
import { requireBrowserFaceAtomSeed } from "./browser-face-atom.js";
import { browserRootFaces, keptOverlays } from "./browser-fleet-root.js";
import { openBrowserSecretHome } from "./browser-secret-home.js";

const refuse = (refusal: string, detail: string): never => { throw new CarriedSeatRefused(refusal, detail); };

/** The founding hearth a joined leaf pins: the first admission in the persona acts its admit carried (lowest seq). The
 *  intent door of the vessel that takes the request answers only an intent pinned to its own atom, so a wrong reading
 *  here earns silence there and seats nobody. */
function carriedFoundingAtom(home: LarDoc | undefined, group: string): string | null {
  const admissions = personaActRecordsOfGroup(home, group)
    .map((r) => (r as { body?: { act?: unknown; seq?: unknown; deviceKey?: unknown } } | null)?.body)
    .filter((b): b is { act: "admission"; seq: number; deviceKey: string } => b?.act === "admission" && typeof b.seq === "number" && typeof b.deviceKey === "string")
    .sort((a, b) => a.seq - b.seq);
  return admissions[0]?.deviceKey.toLowerCase() ?? null;
}

/** The joined leaf's seat request for one face it landed. */
export async function browserSeatRequest(opts: { readonly idbName: string; readonly repo: Repo; readonly personaGroup: string }): Promise<FleetSeatRequest> {
  const overlay = (await keptOverlays(opts.idbName))[opts.personaGroup];
  if (!overlay?.contactCard || !overlay.deviceEdge) return refuse("seat-face-unlanded", "this browser landed no join of that face; land the fleet-join answer first.");
  const home = await openBrowserSecretHome(opts.idbName, opts.repo);
  const hearthAtom = carriedFoundingAtom(home.handle.doc(), opts.personaGroup);
  if (hearthAtom === null) return refuse("seat-hearth-unread", "the landed join carried no founding admission to pin the seat request to.");
  const seed = await requireBrowserFaceAtomSeed(opts.idbName, opts.personaGroup);
  try {
    const atom = { key: faceAtomKeyFromSeed(seed, opts.personaGroup).key, sign: ed25519SignerFromSeed(seed) };
    if (atom.key.toLowerCase() === hearthAtom) return refuse("seat-self", "this browser founded that face: it holds the seat it would ask for.");
    return await composeSeatRequest({ group: opts.personaGroup, atom, hearthAtom, contactCard: overlay.contactCard, deviceEdge: overlay.deviceEdge });
  } finally { seed.fill(0); }
}

/** The root holder's grant for one carried seat request, through its own standing intent door. */
export async function browserSeatGrant(opts: { readonly idbName: string; readonly repo: Repo; readonly request: unknown; readonly withinMs?: number }): Promise<FleetSeatGrant> {
  const group = (opts.request as { personaGroup?: unknown } | null)?.personaGroup;
  if (typeof group !== "string") return refuse("seat-request-malformed", "the file names no face.");
  const request = readSeatRequest(opts.request, group);
  if (!(await browserRootFaces(opts.idbName)).some((f) => f.personaGroup === group)) return refuse("root-absent", "this browser holds no root for that face; the vessel that founded the face seats its devices.");
  const overlay = (await keptOverlays(opts.idbName))[group];
  if (!overlay?.intentsUrl || !overlay.personaUrl) return refuse("seat-planes-unread", "this browser's record names no intents or persona plane for that face.");
  const [intents, persona] = await Promise.all([opts.repo.find<LarDoc>(overlay.intentsUrl as AutomergeUrl), opts.repo.find<LarDoc>(overlay.personaUrl as AutomergeUrl)]);
  // THE GRANT THAT ANSWERS THIS REQUEST (`seatGrantAnswering`): the door's outcome for this very intent names the grant it
  // wrote. A replayed request meets that outcome again; a request whose card the leaf minted again is another intent, and a
  // grant an earlier intent left standing for the device never answers it.
  placeSeatRequest(intents, request);
  // THE DOOR ANSWERS ON THE PLANES: wait on the intents and persona planes' own changes. The one bound here reads LIVENESS
  // (the house's document hang bound): a door that never answers refuses by name, and the person asks again.
  return new Promise<FleetSeatGrant>((resolve, reject) => {
    const stop = (): void => { clearTimeout(bound); intents.off("change", settle); persona.off("change", settle); };
    const settle = (): void => {
      const answer = seatGrantAnswering(intents.doc(), persona.doc(), request);
      if (answer.state === "pending") return;
      stop();
      if (answer.state === "granted") resolve(answer.grant);
      else reject(new CarriedSeatRefused("seat-grant-refused", `this face's intent door answered the request and wrote no grant: ${answer.reason}`));
    };
    const bound = setTimeout(() => { stop(); reject(new CarriedSeatRefused("seat-grant-unanswered", "this face's intent door wrote no grant: the request's edge, standing or pinned hearth did not pass its gate, or the door stands shut; read the vessel's console and ask again.")); }, opts.withinMs ?? DOCUMENT_HANG_BOUND_MS);
    intents.on("change", settle);
    persona.on("change", settle);
    settle();
  });
}

/** Keep a carried seat grant on the joined leaf. The next boot's seat reads it; answers the face it seats. */
export async function browserSeatGrantLand(opts: { readonly idbName: string; readonly repo: Repo; readonly grant: unknown; readonly ground: SeatVerifyGround | null }): Promise<{ readonly personaGroup: string }> {
  const group = (opts.grant as { personaGroup?: unknown } | null)?.personaGroup;
  if (typeof group !== "string") return refuse("seat-grant-malformed", "the file names no face.");
  const overlay = (await keptOverlays(opts.idbName))[group];
  if (!overlay?.deviceEdge) return refuse("seat-grant-other-face", "this browser landed no join of that face.");
  const grant = readSeatGrant(opts.grant, { group, deviceKey: overlay.deviceEdge.deviceVerifyingKey });
  // THE FULL VERIFICATION FIRST: a grant that fails it never rests where the boot or the seat reads it.
  if (opts.ground === null) return refuse("seat-grant-unverified", "this boot holds no pinned root or persona-KEL to verify the grant against.");
  const verdict = await browserVerifySeat({ idbName: opts.idbName, repo: opts.repo, grant, ground: opts.ground });
  if (!verdict.ok) return refuse("seat-grant-unverified", `the grant did not verify: ${verdict.reason}`);
  const home = await openBrowserSecretHome(opts.idbName, opts.repo);
  keepCarriedSeatGrant(home.handle, grant);
  await opts.repo.flush([home.handle.documentId]);
  return { personaGroup: group };
}

/** What the full verification of a carried grant reads, all of it held by this vessel before any road: the root it pinned,
 *  the face's persona-KEL off its own board, and the face's lineage for the founder's standing off its fleet board. */
export interface SeatVerifyGround {
  readonly personaRootDid: string;
  readonly personaKel: FounderLineage;
  readonly lineage: HandLineage | null;
}

/**
 * THE FULL VERIFICATION OF A CARRIED GRANT on this browser (`verifyCarriedSeatGrant`): the grant answers this leaf's own
 * request (the leaf composes it again from its landing's card and edge), and its record verifies under the pinned root, the
 * persona-KEL head and the founder's standing, read off this vessel's own fold of the face's fleet board.
 */
export async function browserVerifySeat(opts: { readonly idbName: string; readonly repo: Repo; readonly grant: FleetSeatGrant; readonly ground: SeatVerifyGround }): Promise<FaceGrantVerdict> {
  const group = opts.grant.personaGroup;
  const overlay = (await keptOverlays(opts.idbName))[group];
  if (!overlay?.deviceEdge) return { ok: false, reason: "this browser landed no join of that face" };
  let request: FleetSeatRequest;
  try { request = await browserSeatRequest({ idbName: opts.idbName, repo: opts.repo, personaGroup: group }); }
  catch (error) { return { ok: false, reason: `this leaf cannot compose its own seat request: ${error instanceof Error ? error.message : String(error)}` }; }
  const founderKey = opts.grant.record.founderEdge?.deviceVerifyingKey;
  const scope = opts.ground.personaRootDid.trim().toLowerCase().replace(/^0x/, "");
  const standing: EdgeStanding = typeof founderKey === "string"
    ? await boardDyadReader(opts.repo, undefined, undefined, undefined, undefined, scope, opts.ground.lineage)(opts.ground.personaRootDid, founderKey)
    : "unknown";
  return verifyCarriedSeatGrant({ grant: opts.grant, request, ctx: {
    personaRootDid: opts.ground.personaRootDid, personaKel: opts.ground.personaKel, selfVerifyingKey: overlay.deviceEdge.deviceVerifyingKey, groupId: group,
    dyad: (asked) => (typeof founderKey === "string" && asked.toLowerCase() === founderKey.toLowerCase() ? standing : "unknown"),
  } });
}

/**
 * Does this browser keep a VERIFIED carried seat grant for its own device of `personaGroup`? Only a grant that passes the
 * full verification reads kept, and a kept grant that now fails it (never a pending one) leaves the secret home, so the
 * daemon island's seat never reads it either. A secret home that does not open reads as no grant.
 */
export async function browserSeatKept(opts: { readonly idbName: string; readonly repo: Repo; readonly personaGroup: string; readonly ground: SeatVerifyGround | null }): Promise<{ readonly kept: boolean; readonly reason?: string }> {
  const overlay = (await keptOverlays(opts.idbName))[opts.personaGroup];
  if (!overlay?.deviceEdge) return { kept: false };
  let home: Awaited<ReturnType<typeof openBrowserSecretHome>>;
  try { home = await openBrowserSecretHome(opts.idbName, opts.repo); } catch { return { kept: false }; }
  const grant = keptSeatGrant(home.handle.doc(), opts.personaGroup, overlay.deviceEdge.deviceVerifyingKey);
  if (grant === null) return { kept: false };
  if (opts.ground === null) return { kept: false, reason: "this boot holds no pinned root or persona-KEL to verify the kept grant against" };
  const verdict = await browserVerifySeat({ idbName: opts.idbName, repo: opts.repo, grant, ground: opts.ground });
  if (verdict.ok) return { kept: true };
  if (!verdict.pending) { dropCarriedSeatGrant(home.handle, grant.title); await opts.repo.flush([home.handle.documentId]); }
  return { kept: false, reason: verdict.reason };
}

/** The faces this browser JOINED (it holds their edge and no root): each may ask its seat by file. */
export async function browserJoinedFaces(idbName: string): Promise<readonly { readonly personaGroup: string; readonly label: string }[]> {
  const rooted = new Set((await browserRootFaces(idbName)).map((f) => f.personaGroup));
  return Object.entries(await keptOverlays(idbName))
    .filter(([group, overlay]) => !rooted.has(group) && overlay.deviceEdge !== undefined && typeof overlay.contactCard === "string")
    .map(([personaGroup]) => ({ personaGroup, label: `${personaGroup.slice(0, 10)}…` }));
}
