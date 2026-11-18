import { afterEach, expect, test, vi } from "vitest";
import { KeyhiveProvider } from "@lararium/keyhive";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import { DAEMON_BAG_ID } from "@lararium/mesh";
import { standFoundedIsland } from "./stand-founded-island.js";

vi.setConfig({ testTimeout: 900_000, hookTimeout: 900_000 });
const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) teardown.pop()!(); });
const B_BAG = "lar:///ha.ka.ba/@test/bags/face-b";

test("one daemon routes presenters to their joined face providers", async () => {
  const a = await standFoundedIsland(teardown);
  const b = await standFoundedIsland(teardown, { seedOffset: 10 });
  const c = await standFoundedIsland(teardown, { seedOffset: 20 });
  const { atom, personaGroupId, faceAnchor, personaKel, deviceEdge, signerDid,
    meshCabalDocIdHex, veilArchiveBytes, faceAddressSecret } = b.daemonAuth;
  const daemonAuth = { ...a.daemonAuth, joinedFaces: [{ atom, personaGroupId, faceAnchor, personaKel, deviceEdge,
    signerDid, meshCabalDocIdHex, veilArchiveBytes, faceAddressSecret, registerBags: [DAEMON_BAG_ID, B_BAG] }] };
  const providers: KeyhiveProvider[] = [];
  const init = KeyhiveProvider.prototype.init;
  const spy = vi.spyOn(KeyhiveProvider.prototype, "init").mockImplementation(function (this: KeyhiveProvider, ...args) {
    providers.push(this);
    return init.apply(this, args);
  });
  try {
    const verifier = await operatorDaemonOptions({ daemonAuth } as never, { dyadReading: () => "clear" }).verifierFactory!(a.ctx);
    const ask = (presenter: string, bagUrl: string) => verifier.verify({ presenter, bagUrl, access: "read", channel: "local" });
    expect.soft(await ask(`0x${a.daemonAuth.atom.key}`, DAEMON_BAG_ID)).toMatchObject({ ok: true });
    expect.soft(await ask(`0x${b.daemonAuth.atom.key}`, DAEMON_BAG_ID)).toMatchObject({ ok: true });
    expect.soft(await ask(`0x${b.daemonAuth.atom.key}`, B_BAG)).toMatchObject({ ok: true });
    expect.soft(await ask(`0x${c.daemonAuth.atom.key}`, DAEMON_BAG_ID)).toMatchObject({ ok: false, reason: expect.stringContaining("no provider") });
    expect.soft(await ask(`0x${a.daemonAuth.placeVerifyingKey}`, DAEMON_BAG_ID)).toMatchObject({ ok: false });
  } finally {
    spy.mockRestore();
    await Promise.all(providers.map((provider) => provider.dispose()));
  }
});
