import { describe, expect, it, vi } from "vitest";
import { makeIslandRepo, groupSecretOpenerFromSeed, mintFaceAtomSeed } from "@lararium/mesh";
import { foundTheFace, foundThePlace } from "../src/index.js";
import { KeyhiveProvider } from "../src/keyhive-provider.js";

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
    expect(Object.keys(place).sort()).toEqual(["daemonHandle", "daemonUrl"]);
    const titles = Object.keys(place.daemonHandle.doc()!.tiddlers);
    expect(titles.some((title) => title.includes("/cap/"))).toBe(false);
    expect(JSON.stringify(place.daemonHandle.doc())).not.toContain(placeKey);
    const face = await foundTheFace({ repo, daemonHandle: place.daemonHandle,
      placeVerifyingKey: placeKey, vesselDisplayName: "place",
      binding: { mode: "self-stood", signerSeed: rootSeed },
      hearthTrueName: "hearth", nexusPubkey: placeKey, atomSeed });
    expect(face.veilArchive.byteLength).toBeGreaterThan(0);
    expect(init).toHaveBeenCalled(); // control: the same spy sees face founding initialize Keyhive
    expect(face.founderEdge.deviceVerifyingKey).not.toBe(placeKey);
    init.mockRestore();
  });
});
