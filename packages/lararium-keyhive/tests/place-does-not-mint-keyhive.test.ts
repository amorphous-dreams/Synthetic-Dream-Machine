import { describe, expect, it, vi } from "vitest";
import { makeIslandRepo, groupSecretOpenerFromSeed, mintFaceAtomSeed, groupSecretSealTitle, DYAD_SLOT_PREFIX } from "@lararium/mesh";
import { foundTheFace, foundThePlace, replayCapEvents, runApplyAdmitPayload, runFoundingCeremony } from "../src/index.js";
import { KeyhiveProvider } from "../src/keyhive-provider.js";
import { testVesselTagDoor } from "../../lararium-mesh/tests/vessel-tag-fixture.js";

describe("a place carries no Keyhive identity", () => {
  it("seeds only the daemon and hearth name; a real face founding mints its own identity", async () => {
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    const placeSeed = new Uint8Array(32).fill(51);
    const rootSeed = new Uint8Array(32).fill(52);
    const atomSeed = mintFaceAtomSeed();
    const placeKey = groupSecretOpenerFromSeed(placeSeed).deviceKey;
    const init = vi.spyOn(KeyhiveProvider.prototype, "init");
    const place = await foundThePlace({ repo, hearthTrueName: "hearth" });
    expect(init).not.toHaveBeenCalled();
    expect(Object.keys(place).sort()).toEqual(["daemonHandle", "daemonUrl", "secretHandle", "secretUrl"]);
    expect(place.secretUrl).not.toBe(place.daemonUrl);
    const titles = Object.keys(place.daemonHandle.doc()!.tiddlers);
    expect(titles.some((title) => title.includes("/cap/"))).toBe(false);
    expect(JSON.stringify(place.daemonHandle.doc())).not.toContain(placeKey);
    const face = await foundTheFace({ vesselTag: testVesselTagDoor(1), repo, daemonHandle: place.daemonHandle, secretHandle: place.secretHandle, secretRest: { assertSealed: async () => true },
      placeVerifyingKey: placeKey, vesselDisplayName: "place",
      binding: { mode: "self-stood", signerSeed: rootSeed },
      hearthTrueName: "hearth", nexusPubkey: placeKey, atomSeed });
    expect(face.veilArchive.byteLength).toBeGreaterThan(0);
    expect(init).toHaveBeenCalled(); // control: the same spy sees face founding initialize Keyhive
    expect(face.founderEdge.deviceVerifyingKey).not.toBe(placeKey);
    const secretTitles = Object.keys(place.secretHandle.doc()!.tiddlers);
    expect(secretTitles.some((title) => title.includes("/cap/"))).toBe(true);
    expect(secretTitles).toContain(groupSecretSealTitle(face.personaGroupId));
    expect(secretTitles.some((title) => title.startsWith(DYAD_SLOT_PREFIX))).toBe(true);
    const daemonTitles = Object.keys(place.daemonHandle.doc()!.tiddlers);
    expect(daemonTitles.some((title) => title.includes("/cap/") || title.startsWith(DYAD_SLOT_PREFIX))).toBe(false);
    expect(daemonTitles).not.toContain(groupSecretSealTitle(face.personaGroupId));
    expect((await (await replayCapEvents(place.secretHandle, face.personaGroupId, { assertSealed: async () => true })).list()).length).toBeGreaterThan(0);
    init.mockRestore();
  });

  it("refuses a missing or aliased secret handle before founding a face", async () => {
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    const place = await foundThePlace({ repo, hearthTrueName: "hearth" });
    const bare = { repo, daemonHandle: place.daemonHandle } as Parameters<typeof foundTheFace>[0];
    await expect(foundTheFace(bare)).rejects.toThrow("secret-home-unavailable");
    await expect(foundTheFace({ ...bare, secretHandle: place.daemonHandle })).rejects.toThrow("secret-home-shared");
    await expect(foundTheFace({ ...bare, secretHandle: place.secretHandle })).rejects.toThrow("secret-home-unavailable");
    await expect(runApplyAdmitPayload(bare as never)).rejects.toThrow("secret-home-unavailable");
    await expect(runFoundingCeremony({ repo } as never)).rejects.toThrow("secret-home-unavailable");
    await expect(replayCapEvents(place.secretHandle, "face")).rejects.toThrow("secret-home-unavailable");
    expect(Object.keys(place.secretHandle.doc()!.tiddlers)).toEqual([]);
  });
});
