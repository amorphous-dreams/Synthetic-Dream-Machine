/**
 * P27 · a browser leaf floors secrets by ESTABLISHED ABSENCE (the seat's ruling, 2026-11-07, on the road's own law): the
 * secrets vault stands on the node alone, and the daemon drives the swarm only once its credentials rest there, never on a
 * surface ("no key on a surface"). A leaf is a surface, so no gate lets a secrets plane reach it; it names no secrets relation
 * because it holds none. Before this, the leaf read a face registry it could never bind (the node's face catalog stands
 * vessel-private), and every face plane it held refused its siblings and its hearth, with no act to clear it.
 *
 * The floor here runs with the browser's own reader shape (`open-browser-vessel.ts`): no face catalog, `faceOwns` off the
 * sealed map, the deterministic public gate.
 */
import { expect, test } from "vitest";
import { Repo, type DocumentId } from "@automerge/automerge-repo";
import { DeterministicFederationGate, NO_CONTRACT_SECRETS_PLANE, emptyLarDoc, makeHeldShareFloor, personaScopedBagIds,
  storedLarRecord, type LarDoc } from "@lararium/mesh";

const NEXUS = "ab".repeat(32);

async function leaf(secrets: "leaf" | "node") {
  const repo = new Repo({ network: [] });
  const face = personaScopedBagIds("p27-leaf-face");
  const circles = repo.create<LarDoc>(emptyLarDoc());
  // A face plane whose own carrier tightens it to VEIL: the declaration, not the absent registry, withholds it.
  const veiled = repo.create<LarDoc>(emptyLarDoc());
  veiled.change((d) => { d.tiddlers[face.intents] = storedLarRecord(face.intents, { bag: face.intents.slice("lar:///ha.ka.ba/bags/".length), "cap-tier": "veil" }, "test"); });
  await Promise.all([circles.whenReady(), veiled.whenReady()]);
  const gate = new DeterministicFederationGate(NEXUS);
  const sealed = new Set<string>([circles.documentId, veiled.documentId]);
  const refused: Error[] = [];
  const readers = {
    genesisCids: () => new Set<string>(), handles: () => repo.handles, catalog: () => undefined,
    bindings: () => [[face.circles, circles.documentId], [face.intents, veiled.documentId]] as const,
    publicPlane: (id: string) => gate.mayFederate(id as DocumentId), sealedPlane: (id: string) => sealed.has(id),
    nonBagTier: () => null, faceOwns: (id: string) => sealed.has(id),
    onRefusal: (error: Error) => refused.push(error),
  };
  const floor = secrets === "leaf"
    ? makeHeldShareFloor({ ...readers, secrets: { establishedAbsence: NO_CONTRACT_SECRETS_PLANE } })
    // The node: the face's registry over a catalog the leaf shape never binds.
    : makeHeldShareFloor({ ...readers, secrets: { catalog: { face: () => null, sealed: () => false, failure: () => null, flush: async () => {} } } });
  return { repo, floor, circles, veiled, refused };
}

test("P27 leaf: a face plane reaches its sibling at fleet by its declared tier, under established absence", async () => {
  const h = await leaf("leaf");
  try {
    expect(h.floor.tiers.allows(true, h.circles.documentId, "fleet", true)).toBe(true);
    expect(h.floor.tiers.allows(true, h.circles.documentId, "world", true), "PERSONAGROUP still withholds from the world").toBe(false);
    // CONTROL: a leaf plane its own carrier declares VEIL still refuses fleet.
    expect(h.floor.tiers.allows(true, h.veiled.documentId, "fleet", true)).toBe(false);
    expect(h.refused.at(-1)).toMatchObject({ name: "DeclaredTierRefusal", reason: "declared-tier-audience" });
  } finally { await h.repo.shutdown(); }
});

test("P27 leaf CONTROL: the node keeps its real registry, which refuses a face plane until its catalog binds", async () => {
  const h = await leaf("node");
  try {
    expect(h.floor.tiers.allows(true, h.circles.documentId, "fleet", true)).toBe(false);
    expect(h.refused.at(-1)).toMatchObject({ name: "SecretsRegistryRefusal", reason: "secrets-registry-unread" });
  } finally { await h.repo.shutdown(); }
});

test("P27 leaf: established absence names the one constant, never an ad hoc plane", () => {
  const base = { genesisCids: () => new Set<string>(), handles: () => ({}), catalog: () => undefined, bindings: () => [],
    publicPlane: () => false, sealedPlane: () => false, nonBagTier: () => null, faceOwns: () => false, onRefusal: () => {} };
  expect(() => makeHeldShareFloor({ ...base, secrets: { establishedAbsence: { isContractSecretsPlane: () => false } } }))
    .toThrow(/secrets-absence-unestablished/);
});
