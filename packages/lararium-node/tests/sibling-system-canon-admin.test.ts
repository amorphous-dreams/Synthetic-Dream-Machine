import { afterEach, expect, test, vi } from "vitest";
import { KeyhiveProvider } from "@lararium/keyhive";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import { BAG_IDS } from "@lararium/mesh";
import { standFoundedIsland } from "./stand-founded-island.js";

vi.setConfig({ testTimeout: 900_000, hookTimeout: 900_000 });
const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) teardown.pop()!(); });
const B_BAG = "lar:///ha.ka.ba/@test/bags/face-b";

test("system canon admin takes only the mounted face's Kahu hand", async () => {
  const a = await standFoundedIsland(teardown);
  const b = await standFoundedIsland(teardown, { seedOffset: 10 });
  const { atom, personaGroupId, faceAnchor, personaKel, deviceEdge, signerDid,
    meshCabalDocIdHex, veilArchiveBytes, faceAddressSecret } = b.daemonAuth;
  const daemonAuth = { ...a.daemonAuth, joinedFaces: [{ atom, personaGroupId, faceAnchor, personaKel, deviceEdge,
    signerDid, meshCabalDocIdHex, veilArchiveBytes, faceAddressSecret, registerBags: [BAG_IDS.lares, B_BAG] }] };
  const providers: KeyhiveProvider[] = [];
  const init = KeyhiveProvider.prototype.init;
  const spy = vi.spyOn(KeyhiveProvider.prototype, "init").mockImplementation(function (this: KeyhiveProvider, ...args) {
    providers.push(this);
    return init.apply(this, args);
  });
  try {
    const verifier = await operatorDaemonOptions({ daemonAuth } as never, { dyadReading: () => "clear" }).verifierFactory!(a.ctx);
    const siblingVerify = vi.spyOn(providers[1]!, "verify");
    expect(await verifier.verify({ presenter: `0x${atom.key}`, bagUrl: BAG_IDS.lares, access: "admin", channel: "local" }))
      .toEqual({ ok: false, reason: "kahu-reach: system canon takes the mounted face's hand; a sibling face holds none here" });
    expect(siblingVerify).not.toHaveBeenCalled();
    expect(await verifier.verify({ presenter: `0x${a.daemonAuth.atom.key}`, bagUrl: BAG_IDS.lares, access: "admin", channel: "local" }))
      .toMatchObject({ ok: false, reason: expect.stringContaining("system canon takes a hand in the Kahu cabal") });
    expect(await verifier.verify({ presenter: `0x${atom.key}`, bagUrl: B_BAG, access: "read", channel: "local" }))
      .toMatchObject({ ok: true });
  } finally {
    spy.mockRestore();
    await Promise.all(providers.map((provider) => provider.dispose()));
  }
});
