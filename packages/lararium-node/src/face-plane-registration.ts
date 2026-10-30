import { personaBagIdFor, personaSiblingBagIds } from "@lararium/mesh";

type FacePlanes = { circles: string | null; identities: string | null; sessions: string | null; intents: string | null };
export async function registerFacePlanesForRelay(ports: {
  group: string;
  relayEnabled: (group: string) => Promise<boolean>;
  prove: (group: string) => Promise<FacePlanes | null>;
  register: (bagId: string, url: string) => void;
}): Promise<string[]> {
  if (!await ports.relayEnabled(ports.group)) return [];
  const planes = await ports.prove(ports.group);
  const ids = personaSiblingBagIds(personaBagIdFor(ports.group));
  if (!planes || !ids) return [];
  const registered: string[] = [];
  for (const key of ["circles", "identities", "sessions", "intents"] as const) {
    const url = planes[key];
    if (url) { ports.register(ids[key], url); registered.push(ids[key]); }
  }
  return registered;
}
