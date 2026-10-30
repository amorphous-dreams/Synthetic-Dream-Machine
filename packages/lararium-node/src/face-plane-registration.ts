import { personaBagIdFor, personaSiblingBagIds } from "@lararium/mesh";

type FacePlanes = { circles: string | null; identities: string | null; sessions: string | null; intents: string | null };
export function provenPlaneUrls(projection: { planes: Readonly<Record<string, string | undefined>> }, urls: FacePlanes): FacePlanes | null {
  if (!urls.intents || projection.planes.intents !== urls.intents) return null;
  return {
    circles: urls.circles && projection.planes.circles === urls.circles ? urls.circles : null,
    identities: urls.identities && projection.planes.identities === urls.identities ? urls.identities : null,
    sessions: urls.sessions && projection.planes.sessions === urls.sessions ? urls.sessions : null,
    intents: urls.intents,
  };
}

export async function registerFacePlanesForRelay(ports: {
  group: string;
  relayEnabled: (group: string) => Promise<boolean>;
  prove: (group: string) => Promise<FacePlanes | null>;
  register: (bagId: string, url: string) => void;
}): Promise<string[]> {
  try { if (!await ports.relayEnabled(ports.group)) return []; } catch { return []; }
  const planes = await ports.prove(ports.group);
  // The proof awaits: a relay disabled meanwhile registers nothing (the ring is read again at the commit boundary).
  try { if (!await ports.relayEnabled(ports.group)) return []; } catch { return []; }
  const ids = personaSiblingBagIds(personaBagIdFor(ports.group));
  if (!planes || !ids) return [];
  const registered: string[] = [];
  for (const key of ["circles", "identities", "sessions", "intents"] as const) {
    const url = planes[key];
    if (url) { ports.register(ids[key], url); registered.push(ids[key]); }
  }
  return registered;
}
