import { describe, expect, test } from "vitest";
import { runRealmBags, type RealmDoorPlanes } from "../src/realm-steward.js";

const REALM = `nexus-${"ab".repeat(32)}`;
const registration = { realmId: REALM, bagUri: "lar:///ha.ka.ba/bags/public-book", docUrl: "automerge:public-book", keptBy: ["face"], readTier: "public" as const };

function holder(): RealmDoorPlanes {
  const carried = {
    realmId: () => REALM,
    realmUrl: () => "automerge:realm-doc",
    standing: async () => new Map([[registration.bagUri, registration]]),
  };
  return {
    realmId: () => null,
    realmUrl: () => null,
    standing: async () => new Map(),
    realms: () => [REALM],
    plane: (id?: string | null) => id === REALM ? carried as never : null,
  } as unknown as RealmDoorPlanes;
}

describe("realm-bags lists every realm the holder stands in", () => {
  test("no realm argument includes a carried plane and names its realm", async () => {
    await expect(runRealmBags({ plane: holder() })).resolves.toMatchObject({ realm: REALM, realmDoc: "automerge:realm-doc", realms: [REALM], bags: [{ bag: registration.bagUri, doc: registration.docUrl }] });
  });

  test("CONTROL: --realm narrows the list to that realm", async () => {
    await expect(runRealmBags({ plane: holder(), args: { realm: REALM } })).resolves.toMatchObject({ realm: REALM, bags: [{ bag: registration.bagUri }] });
    await expect(runRealmBags({ plane: holder(), args: { realm: "nexus-unknown" } })).resolves.toMatchObject({ realm: "nexus-unknown", bags: [] });
  });
});
