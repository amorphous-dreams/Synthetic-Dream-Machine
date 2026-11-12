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
  DOCUMENT_HANG_BOUND_MS, ed25519SignerFromSeed, faceAtomKeyFromSeed, personaActRecordsOfGroup, type LarDoc,
} from "@lararium/mesh";
import {
  CarriedSeatRefused, composeSeatRequest, keepCarriedSeatGrant, placeSeatRequest, readSeatGrant, readSeatRequest, seatGrantOnPlane,
  seatRequestDevice, type FleetSeatGrant, type FleetSeatRequest,
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
  const device = seatRequestDevice(request);
  const [intents, persona] = await Promise.all([opts.repo.find<LarDoc>(overlay.intentsUrl as AutomergeUrl), opts.repo.find<LarDoc>(overlay.personaUrl as AutomergeUrl)]);
  // A REPLAYED REQUEST meets the grant its first answer wrote: the door answers one intent once.
  const standing = seatGrantOnPlane(persona.doc(), group, device);
  placeSeatRequest(intents, request);
  if (standing !== null) return standing;
  // THE DOOR ANSWERS ON THE PLANE: wait on the persona plane's own changes. The one bound here reads LIVENESS (the house's
  // document hang bound): a door that never answers refuses by name, and the person asks again.
  return new Promise<FleetSeatGrant>((resolve, reject) => {
    const settle = (): void => {
      const grant = seatGrantOnPlane(persona.doc(), group, device);
      if (grant === null) return;
      clearTimeout(bound); persona.off("change", settle); resolve(grant);
    };
    const bound = setTimeout(() => { persona.off("change", settle); reject(new CarriedSeatRefused("seat-grant-unanswered", "this face's intent door wrote no grant: the request's edge, standing or pinned hearth did not pass its gate, or the door stands shut; read the vessel's console and ask again.")); }, opts.withinMs ?? DOCUMENT_HANG_BOUND_MS);
    persona.on("change", settle);
    settle();
  });
}

/** Keep a carried seat grant on the joined leaf. The next boot's seat reads it; answers the face it seats. */
export async function browserSeatGrantLand(opts: { readonly idbName: string; readonly repo: Repo; readonly grant: unknown }): Promise<{ readonly personaGroup: string }> {
  const group = (opts.grant as { personaGroup?: unknown } | null)?.personaGroup;
  if (typeof group !== "string") return refuse("seat-grant-malformed", "the file names no face.");
  const overlay = (await keptOverlays(opts.idbName))[group];
  if (!overlay?.deviceEdge) return refuse("seat-grant-other-face", "this browser landed no join of that face.");
  const grant = readSeatGrant(opts.grant, { group, deviceKey: overlay.deviceEdge.deviceVerifyingKey });
  const home = await openBrowserSecretHome(opts.idbName, opts.repo);
  keepCarriedSeatGrant(home.handle, grant);
  await opts.repo.flush([home.handle.documentId]);
  return { personaGroup: group };
}

/** The faces this browser JOINED (it holds their edge and no root): each may ask its seat by file. */
export async function browserJoinedFaces(idbName: string): Promise<readonly { readonly personaGroup: string; readonly label: string }[]> {
  const rooted = new Set((await browserRootFaces(idbName)).map((f) => f.personaGroup));
  return Object.entries(await keptOverlays(idbName))
    .filter(([group, overlay]) => !rooted.has(group) && overlay.deviceEdge !== undefined && typeof overlay.contactCard === "string")
    .map(([personaGroup]) => ({ personaGroup, label: `${personaGroup.slice(0, 10)}…` }));
}
