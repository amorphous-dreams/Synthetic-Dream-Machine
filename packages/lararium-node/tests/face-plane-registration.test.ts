import { expect, test, vi } from "vitest";
import { personaBagIdFor, personaSiblingBagIds } from "@lararium/mesh";
import { registerFacePlanesForRelay } from "../src/face-plane-registration.js";

test("RED: an enabled proven sibling registers its four planes; CONTROL: disabled, unproven and absent planes register nothing extra", async () => {
  const group = "did:example:sibling";
  const ids = personaSiblingBagIds(personaBagIdFor(group))!;
  const proof = { circles: "circles-url", identities: "identities-url", sessions: "sessions-url", intents: "intents-url" };
  const prove = vi.fn(async (_group: string) => proof as typeof proof | null);
  const register = vi.fn();
  const relayEnabled = vi.fn(async (_group: string) => false);
  expect(await registerFacePlanesForRelay({ group, relayEnabled, prove, register })).toEqual([]);
  expect(prove).not.toHaveBeenCalled();
  expect(register).not.toHaveBeenCalled();
  relayEnabled.mockResolvedValue(true);
  prove.mockResolvedValueOnce(null);
  expect(await registerFacePlanesForRelay({ group, relayEnabled, prove, register })).toEqual([]);
  expect(register).not.toHaveBeenCalled();
  const result = await registerFacePlanesForRelay({ group, relayEnabled, prove, register });
  expect(new Set(result)).toEqual(new Set([ids.circles, ids.identities, ids.sessions, ids.intents]));
  for (const key of ["circles", "identities", "sessions", "intents"] as const) expect(register).toHaveBeenCalledWith(ids[key], proof[key]);
  register.mockClear();
  const partial = await registerFacePlanesForRelay({ group, relayEnabled, prove: async () => ({ ...proof, sessions: null }), register });
  expect(new Set(partial)).toEqual(new Set([ids.circles, ids.identities, ids.intents]));
  expect(register).toHaveBeenCalledTimes(3);
  expect(register).not.toHaveBeenCalledWith(ids.sessions, expect.anything());
});
