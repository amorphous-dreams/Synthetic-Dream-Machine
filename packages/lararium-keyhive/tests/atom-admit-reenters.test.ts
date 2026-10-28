import { describe, expect, it, vi } from "vitest";
import { makeIslandRepo, groupSecretOpenerFromSeed, materializeSharedLarDoc, personaKelBoardDocUrl, personaKelChainForPrefix, vesselDyads, seedDaemonDoc, verifyDeviceDelegation, type DeviceDelegationTiddler } from "@lararium/mesh";
import { founderAndJoineeActs, frontierFromFoundingSeed } from "./admit-acts.js";
import { foundThePlace, foundTheFace, runDeviceAdmitEdge, runApplyAdmitPayload } from "../src/index.js";

const rootSeed = new Uint8Array(32).fill(52);
const vesselSeed = new Uint8Array(32).fill(53);
const atomSeed = new Uint8Array(32).fill(54);
const joineeVesselSeed = new Uint8Array(32).fill(55);
const joineeAtomSeed = new Uint8Array(32).fill(56);
const key = (seed: Uint8Array) => groupSecretOpenerFromSeed(seed).deviceKey;
const repo = () => makeIslandRepo({ syncPort: new MessageChannel().port1 });

describe("atom admit re-entry", () => {
  it("the joinee completes the root half and re-entry lands one atom seat", async () => {
    const founderRepo = repo();
    const place = await foundThePlace({ repo: founderRepo, vesselSeed, hearthTrueName: "hearth" });
    const face = await foundTheFace({ repo: founderRepo, daemonHandle: place.daemonHandle, vesselSeed,
      placeVerifyingKey: key(vesselSeed), vesselDisplayName: "founder", binding: { mode: "self-stood", signerSeed: rootSeed },
      hearthTrueName: "hearth", nexusPubkey: key(vesselSeed), atomSeed });
    const board = await materializeSharedLarDoc(founderRepo, personaKelBoardDocUrl(key(vesselSeed)), "board:persona-kel");
    const chain = personaKelChainForPrefix(board.doc(), face.personaKelPrefix);
    if (!chain) throw new Error("founder KEL chain absent");
    const payload = await runDeviceAdmitEdge({ signerSeed: rootSeed, edgeFrontier: await frontierFromFoundingSeed(rootSeed), joineeVerifyingKey: key(joineeAtomSeed),
      personaKelPrefix: face.personaKelPrefix, personaKelChain: chain, hearthTrueName: "hearth", personaGroupId: face.personaGroupId,
      meshCabalDocIdHex: face.meshCabalDocIdHex, syncUrl: null, hearthDaemonUrl: place.daemonUrl, personaUrl: face.personaUrl,
      personaActs: await founderAndJoineeActs({ face, signerSeed: rootSeed, founderAtomSeed: atomSeed, joineeKey: key(joineeAtomSeed), chain }) });
    expect(payload.deviceEdge).not.toHaveProperty("atomSignature");
    expect(await verifyDeviceDelegation(payload.deviceEdge as DeviceDelegationTiddler, payload.signerDid)).toMatchObject({ ok: false, reason: "atom countersignature missing" });
    const joineeRepo = repo();
    const daemonHandle = seedDaemonDoc(joineeRepo);
    const input = { repo: joineeRepo, daemonHandle, vesselSeed: joineeVesselSeed, placeVerifyingKey: key(joineeVesselSeed),
      atomSeed: joineeAtomSeed, vesselDisplayName: "joinee", payload, nexusPubkey: key(joineeVesselSeed),
      };
    const original = daemonHandle.change.bind(daemonHandle);
    let writes = 0;
    const cut = vi.spyOn(daemonHandle, "change").mockImplementation(((fn: never) => {
      writes += 1;
      if (writes === 2) throw new Error("cut between daemon writes");
      return original(fn);
    }) as never);
    await expect(runApplyAdmitPayload(input)).rejects.toThrow("cut between daemon writes");
    cut.mockRestore();
    expect(writes).toBe(2);
    const first = await runApplyAdmitPayload(input);
    const landed = JSON.stringify(daemonHandle.doc());
    const second = await runApplyAdmitPayload(input);
    expect(second).toEqual(first);
    expect(JSON.stringify(daemonHandle.doc())).toBe(landed);
    const daemon = await joineeRepo.find(first.daemonUrl as never);
    const slots = vesselDyads(daemon.doc() as never);
    expect(slots).toHaveLength(1);
    expect(slots[0]!.ref.deviceDid).toBe("0x" + key(joineeAtomSeed));
    expect(slots[0]!.edge).toHaveProperty("atomSignature");
    const card = JSON.parse(first.contactCardJson) as { Rotate: { issuer: number[] } };
    expect(Buffer.from(card.Rotate.issuer).toString("hex")).toBe(key(joineeAtomSeed));

    // A checkpoint answers only the payload it was cut for: a different admit to the same atom lands its own edge.
    const other = await runDeviceAdmitEdge({ signerSeed: rootSeed, edgeFrontier: await frontierFromFoundingSeed(rootSeed), joineeVerifyingKey: key(joineeAtomSeed),
      personaKelPrefix: face.personaKelPrefix, personaKelChain: chain, hearthTrueName: "hearth-two", personaGroupId: face.personaGroupId,
      meshCabalDocIdHex: face.meshCabalDocIdHex, syncUrl: null, hearthDaemonUrl: place.daemonUrl, personaUrl: face.personaUrl,
      personaActs: await founderAndJoineeActs({ face, signerSeed: rootSeed, founderAtomSeed: atomSeed, joineeKey: key(joineeAtomSeed), chain }) });
    const third = await runApplyAdmitPayload({ ...input, payload: other });
    expect(third.deviceEdge.hearthTrueName).toBe("hearth-two");
    expect(first.deviceEdge.hearthTrueName).toBe("hearth");
  });
});
