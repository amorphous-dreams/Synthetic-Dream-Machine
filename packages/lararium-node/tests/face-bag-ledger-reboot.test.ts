import { afterEach, expect, test, vi } from "vitest";
import { KeyhiveProvider } from "@lararium/keyhive";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import { DAEMON_BAG_ID } from "@lararium/mesh";
import { standFoundedIsland } from "./stand-founded-island.js";
vi.setConfig({ testTimeout: 900_000, hookTimeout: 900_000 });
const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) teardown.pop()!(); });

test("mounted and sibling retain separate vessel bag documents across reboot", async () => {
  const a = await standFoundedIsland(teardown);
  const b = await standFoundedIsland(teardown, { seedOffset: 10 });
  const { atom, personaGroupId, faceAnchor, personaKel, deviceEdge, signerDid, meshCabalDocIdHex, veilArchiveBytes, faceAddressSecret } = b.daemonAuth;
  const daemonAuth = { ...a.daemonAuth, joinedFaces: [{ atom, personaGroupId, faceAnchor, personaKel, deviceEdge, signerDid, meshCabalDocIdHex, veilArchiveBytes, faceAddressSecret, registerBags: [DAEMON_BAG_ID] }] };
  const providers: KeyhiveProvider[] = [];
  const init = KeyhiveProvider.prototype.init;
  const spy = vi.spyOn(KeyhiveProvider.prototype, "init").mockImplementation(function (this: KeyhiveProvider, ...args) { providers.push(this); return init.apply(this, args); });
  try {
    await operatorDaemonOptions({ daemonAuth } as never, { dyadReading: () => "clear" }).verifierFactory!(a.ctx);
    const ids = providers.map(p => p.docIdOfBag(DAEMON_BAG_ID));
    expect(ids).toHaveLength(2); expect(ids[0]).toBeTruthy(); expect(ids[1]).toBeTruthy(); expect(ids[0]).not.toBe(ids[1]);
    await Promise.all(providers.map(p => p.dispose())); providers.length = 0;
    await operatorDaemonOptions({ daemonAuth } as never, { dyadReading: () => "clear" }).verifierFactory!(a.ctx);
    expect(providers.map(p => p.docIdOfBag(DAEMON_BAG_ID))).toEqual(ids);
  } finally { spy.mockRestore(); await Promise.all(providers.map(p => p.dispose())); }
});
