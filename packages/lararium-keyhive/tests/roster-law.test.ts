import { founderAndJoineeActs } from "./admit-acts.js";
import { describe, expect, it } from "vitest";
import { makeIslandRepo, groupSecretOpenerFromSeed, materializeSharedLarDoc, personaKelBoardDocUrl, personaKelChainForPrefix } from "@lararium/mesh";
import { foundTheFace, foundThePlace, InMemoryEventStore, KeyhiveProvider, runApplyAdmitPayload, runDeviceAdmitEdge } from "../src/index.js";

const rootSeed = new Uint8Array(32).fill(71);
const founderVesselSeed = new Uint8Array(32).fill(72);
const founderAtomSeed = new Uint8Array(32).fill(73);
const joineeVesselSeed = new Uint8Array(32).fill(74);
const joineeAtomSeed = new Uint8Array(32).fill(75);
const key = (seed: Uint8Array) => groupSecretOpenerFromSeed(seed).deviceKey;
const repo = () => makeIslandRepo({ syncPort: new MessageChannel().port1 });

async function withArchive(seed: Uint8Array, archiveBytes: Uint8Array): Promise<KeyhiveProvider> {
  const provider = new KeyhiveProvider();
  await provider.init({ seed, archiveBytes, eventStore: new InMemoryEventStore() });
  return provider;
}

async function isGroupMember(provider: KeyhiveProvider, groupId: string, identifierHex: string): Promise<boolean> {
  return (await provider.groupMembers(groupId)).includes(identifierHex);
}

async function readMembership(provider: KeyhiveProvider, groupId: string, identifierHex: string): Promise<{ reaches: true; stands: boolean } | { reaches: false; reason: string }> {
  try {
    return { reaches: true, stands: await isGroupMember(provider, groupId, identifierHex) };
  } catch (error) {
    return { reaches: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

describe("THE_ROSTER_LAW", () => {
  it("witnesses the place absent and the atoms present on the face roster after a founding, an admit and a fleet join seat", async () => {
    const founderRepo = repo();
    const founderPlace = await foundThePlace({ repo: founderRepo, vesselSeed: founderVesselSeed, hearthTrueName: "hearth" });
    const face = await foundTheFace({
      repo: founderRepo,
      daemonHandle: founderPlace.daemonHandle,
      vesselVerifyingKey: key(founderVesselSeed),
      vesselDisplayName: "founder",
      binding: { mode: "self-stood", signerSeed: rootSeed },
      hearthTrueName: "hearth",
      nexusPubkey: key(founderVesselSeed),
      atomSeed: founderAtomSeed,
    });

    const founderFace = await withArchive(founderAtomSeed, face.veilArchive);
    try {
      await founderFace.receiveContactCard(new TextEncoder().encode(founderPlace.contactCardJson));
      const founderAtomId = await founderFace.vesselIdentifierHex();
      expect(await isGroupMember(founderFace, face.personaGroupId, founderAtomId)).toBe(true);
      expect(await isGroupMember(founderFace, face.personaGroupId, founderPlace.vesselIdentifierHex)).toBe(false);
    } finally {
      await founderFace.dispose();
    }

    const board = await materializeSharedLarDoc(founderRepo, personaKelBoardDocUrl(key(founderVesselSeed)), "board:persona-kel");
    const chain = personaKelChainForPrefix(board.doc(), face.personaKelPrefix);
    if (!chain) throw new Error("founder KEL chain absent");
    const payload = await runDeviceAdmitEdge({
      signerSeed: rootSeed,
      joineeVerifyingKey: key(joineeAtomSeed),
      personaKelPrefix: face.personaKelPrefix,
      personaKelChain: chain,
      hearthTrueName: "hearth",
      personaGroupId: face.personaGroupId,
      meshCabalDocIdHex: face.meshCabalDocIdHex,
      syncUrl: null,
      hearthDaemonUrl: founderPlace.daemonUrl,
      personaUrl: face.personaUrl,
      personaActs: await founderAndJoineeActs({ face, signerSeed: rootSeed, founderAtomSeed: founderAtomSeed, joineeKey: key(joineeAtomSeed), chain }),
    });

    const joineeRepo = repo();
    const joineePlace = await foundThePlace({ repo: joineeRepo, vesselSeed: joineeVesselSeed, hearthTrueName: "hearth" });
    const joinee = await runApplyAdmitPayload({
      repo: joineeRepo,
      daemonHandle: joineePlace.daemonHandle,
      atomSeed: joineeAtomSeed,
      vesselDisplayName: "joinee",
      payload,
      nexusPubkey: key(joineeVesselSeed),
    });

    // The fleet join seats the joinee's ATOM through the founder's hand (runFaceJoinOperation adds its identifier).
    // The roster then reads exactly the two atoms; neither place stands on it.
    const joineeAtomProbe = await withArchive(joineeAtomSeed, joinee.archive);
    const joineeAtomId = await joineeAtomProbe.vesselIdentifierHex();
    await joineeAtomProbe.dispose();
    const seated = await withArchive(founderAtomSeed, face.veilArchive);
    try {
      await seated.receiveContactCard(new TextEncoder().encode(joinee.contactCardJson));
      await seated.addGroupMember(joineeAtomId, face.personaGroupId);
      const founderAtomId = await seated.vesselIdentifierHex();
      const roster = await seated.groupMembers(face.personaGroupId);
      expect(roster).toContain(founderAtomId);
      expect(roster).toContain(joineeAtomId);
      expect(roster).not.toContain(founderPlace.vesselIdentifierHex);
      expect(roster).not.toContain(joineePlace.vesselIdentifierHex);
    } finally {
      await seated.dispose();
    }
  });

  it("control — planted place member reads present on the face roster", async () => {
    const founderRepo = repo();
    const founderPlace = await foundThePlace({ repo: founderRepo, vesselSeed: founderVesselSeed, hearthTrueName: "hearth" });
    const face = await foundTheFace({
      repo: founderRepo,
      daemonHandle: founderPlace.daemonHandle,
      vesselVerifyingKey: key(founderVesselSeed),
      vesselDisplayName: "founder",
      binding: { mode: "self-stood", signerSeed: rootSeed },
      hearthTrueName: "hearth",
      nexusPubkey: key(founderVesselSeed),
      atomSeed: founderAtomSeed,
    });

    const founderFace = await withArchive(founderAtomSeed, face.veilArchive);
    try {
      await founderFace.receiveContactCard(new TextEncoder().encode(founderPlace.contactCardJson));
      await founderFace.addGroupMember(founderPlace.vesselIdentifierHex, face.personaGroupId);
      expect(await isGroupMember(founderFace, face.personaGroupId, founderPlace.vesselIdentifierHex)).toBe(true);
    } finally {
      await founderFace.dispose();
    }
  });
});
