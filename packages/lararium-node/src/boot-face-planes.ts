/**
 * boot-face-planes — the face a boot reads, from the vessel's own bootstrap alone.
 *
 * A face's planes ride the bootstrap the founding wrote and register in the catalog at boot. A document
 * every holder may rewrite never answers for them: this function takes the bootstrap's tiddlers and the
 * worn PersonaGroup id, and no other source, so no value of the shared oracle can reach a face.
 * The worn face stays a parameter; nothing here reads a vault pointer.
 */

import {
  PERSONA_GROUP_DOC_ID_TIDDLER, readPersonaPlanes, mountedPlaneBagId, personaPlanesFault,
  personaSiblingBagIds, DAEMON_BAG_ID, type PersonaPlaneRef, type PlaneEntry,
} from "@lararium/mesh";

export interface BootFacePlanes {
  readonly personaPlanes:  PersonaPlaneRef[];
  readonly personaGroupId: string | null;
  readonly personaBagId:   string | null;
  readonly personaUrl:     string | null;
  readonly identitiesUrl:  string | null;
  readonly circlesUrl:     string | null;
  readonly sessionsUrl:    string | null;
}

export function bootFacePlanes(
  bootstrapTiddlers: Readonly<Record<string, { text?: string }>>,
  wornPersonaGroupId: string | null,
): BootFacePlanes {
  // THE ONE RESOLUTION POINT on this platform. The vessel reads back the whole FAMILY of compartments
  // it carries, then resolves the gesture — "the one I stand in" — to that plane's absolute name.
  const planeEntries: PlaneEntry[] =
    Object.entries(bootstrapTiddlers).map(([title, t]) => ({ title, text: t?.text ?? null }));
  const personaPlanes = readPersonaPlanes(planeEntries);
  // A family that could shadow itself never boots: one group entered twice derives ONE bag id and
  // would mount a second writable layer over the first.
  const planesFault = personaPlanes.length ? personaPlanesFault(personaPlanes) : null;
  if (planesFault) throw new Error(`[lararium] the PersonaGroup planes this vessel carries do not stand: ${planesFault}`);
  // The WORN face decides which plane mounts; the bootstrap pin names the founding face where no
  // switch is owed.
  const personaGroupId = wornPersonaGroupId ?? bootstrapTiddlers[PERSONA_GROUP_DOC_ID_TIDDLER]?.text ?? null;
  // A vessel standing in compartments but told to wear none it carries halts rather than wearing
  // whichever loaded first.
  const personaBagId = personaGroupId && personaPlanes.length
    ? mountedPlaneBagId(personaPlanes, personaGroupId)
    : null;
  const personaUrl = personaPlanes.find((p) => p.personaGroupId === personaGroupId)?.url ?? null;
  // The three planes that travel with the face derive from the plane id: the name is the index.
  const siblings = personaBagId ? personaSiblingBagIds(personaBagId) : null;
  const readPlane = (bagId: string | undefined): string | null =>
    bagId ? (bootstrapTiddlers[bagId]?.text ?? null) : null;
  return {
    personaPlanes, personaGroupId, personaBagId, personaUrl,
    identitiesUrl: readPlane(siblings?.identities),
    circlesUrl:    readPlane(siblings?.circles),
    sessionsUrl:   readPlane(siblings?.sessions),
  };
}

/** The daemon doc url this vessel names: its bootstrap's, and no other source. */
export function bootDaemonUrl(bootstrapTiddlers: Readonly<Record<string, { text?: string }>>): string | null {
  return bootstrapTiddlers[DAEMON_BAG_ID]?.text ?? null;
}
