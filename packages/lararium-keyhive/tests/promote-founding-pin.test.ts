/**
 * promote-founding-pin — the face's founding pins its promote board: the root that signs the genesis log signs the board's
 * `plane` act beside the intents plane act, in the same pass and under the same hand, so a face never stands without its
 * board pinned and no later unlock owes a mint.
 *
 * SECURITY CLASS (signed founding acts). Red: the founded log pins the face's derived board, once, and the board doc stands
 * in the founder's repo. Controls: the log still folds whole (founded, no fork, the five planes, the founder atom as the
 * first admission), and a founding re-entered from its checkpoint lands the same bytes (one pin, never two).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import {
  groupSecretOpenerFromSeed, heldDocOf, makeIslandRepo, materializeSharedLarDoc, personaKelBoardDocUrl, personaKelChainForPrefix,
  personaLineageFromKel, personaActRecordsOfGroup, projectPersonaLog, faceAtomKeyFromSeed, PROMOTE_PLANE, promotePlaneUrl, promoteBoardDocUrl,
  type LarDoc,
} from "@lararium/mesh";
import { foundTheFace, foundThePlace, foundingHearthOf } from "../src/index.js";
import { testVesselTagDoor } from "../../lararium-mesh/tests/vessel-tag-fixture.js";
import { withMemorySecretHome } from "../../lararium-mesh/tests/secret-home-fixture.js";

const key = (seed: Uint8Array) => groupSecretOpenerFromSeed(seed).deviceKey;

async function founded() {
  const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const vesselSeed = new Uint8Array(32).fill(71), signerSeed = new Uint8Array(32).fill(72), atomSeed = new Uint8Array(32).fill(73);
  const place = withMemorySecretHome(await foundThePlace({ repo, vesselSeed, hearthTrueName: "hearth" }), repo);
  const input = {
    vesselTag: testVesselTagDoor(1),
    repo, daemonHandle: place.daemonHandle, secretHandle: place.secretHandle, secretRest: { assertSealed: async () => true }, placeVerifyingKey: key(vesselSeed), vesselDisplayName: "founder",
    binding: { mode: "self-stood" as const, signerSeed }, hearthTrueName: "hearth", nexusPubkey: key(vesselSeed), atomSeed,
  };
  const face = await foundTheFace(input);
  const board = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(key(vesselSeed)), "board:persona-kel");
  const lineage = personaLineageFromKel(personaKelChainForPrefix(board.doc(), face.personaKelPrefix)!)!;
  const persona = await repo.find<LarDoc>(face.personaUrl as never);
  const records = () => personaActRecordsOfGroup(persona.doc(), face.personaGroupId);
  const project = () => projectPersonaLog(records(), { group: face.personaGroupId, lineage, authorize: () => true });
  const promoteActs = () => records().filter((r) => (r as { body: Record<string, unknown> }).body["act"] === "plane" && (r as { body: Record<string, unknown> }).body["plane"] === PROMOTE_PLANE);
  return { repo, face, input, project, promoteActs, atomKey: faceAtomKeyFromSeed(atomSeed, face.personaGroupId).key };
}

describe("the founding pins the face's promote board", () => {
  test("RED: the founded log pins the derived board once, and the board doc stands in the founder's repo", async () => {
    const f = await founded();
    const group = f.face.personaGroupId;
    expect(promotePlaneUrl(f.project(), group)).toBe(promoteBoardDocUrl(group));
    expect(f.promoteActs()).toHaveLength(1);
    expect(heldDocOf(f.repo, promoteBoardDocUrl(group))).toBeDefined();
  });

  test("CONTROL: the log folds whole under the root, the founder's atom stands as the first admission, and a re-entered founding pins nothing twice", async () => {
    const f = await founded();
    const projection = f.project();
    expect(projection.founded).toBe(true);
    expect(projection.fork).toBeNull();
    for (const plane of ["persona", "identities", "circles", "sessions", "intents"]) expect(projection.planes[plane]).toBeTruthy();
    expect(foundingHearthOf(projection)).toBe(f.atomKey);
    const head = projection.head, pins = f.promoteActs().length;
    await foundTheFace(f.input);
    expect(f.promoteActs()).toHaveLength(pins);
    expect(f.project().head).toEqual(head);
  });
});
