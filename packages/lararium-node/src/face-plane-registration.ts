import { personaBagIdFor, personaSiblingBagIds, type ProvenFacePlanes as FacePlanes } from "@lararium/mesh";
export { provenPlaneUrls } from "@lararium/mesh";

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
