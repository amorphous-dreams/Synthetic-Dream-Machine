import { afterEach, expect, test, vi } from "vitest";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import { DAEMON_BAG_ID } from "@lararium/mesh";
import { standFoundedIsland } from "./stand-founded-island.js";

vi.setConfig({ testTimeout: 900_000, hookTimeout: 900_000 });
const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) teardown.pop()!(); });
const entry = (auth: any) => {
  const { atom, personaGroupId, faceAnchor, personaKel, deviceEdge, signerDid, meshCabalDocIdHex, veilArchiveBytes, faceAddressSecret, registerBags } = auth;
  return { atom, personaGroupId, faceAnchor, personaKel, deviceEdge, signerDid, meshCabalDocIdHex, veilArchiveBytes, faceAddressSecret, registerBags };
};

test("faces drop and light through the host door", async () => {
  const a = await standFoundedIsland(teardown);
  const b = await standFoundedIsland(teardown, { seedOffset: 10 });
  const c = await standFoundedIsland(teardown, { seedOffset: 20 });
  const opts = operatorDaemonOptions({ daemonAuth: { ...a.daemonAuth, joinedFaces: [entry(b.daemonAuth)] } } as never, { dyadReading: () => "clear" });
  const verifier = await opts.verifierFactory!(a.ctx);
  const ask = (key: string) => verifier.verify({ presenter: `0x${key}`, bagUrl: DAEMON_BAG_ID, access: "read", channel: "local" });
  const host = (message: unknown) => opts.onHostMessage!(message as never, a.ctx);
  expect(await ask(b.daemonAuth.atom.key)).toMatchObject({ ok: true });
  await host({ type: "daemon:face-drop", atomKey: b.daemonAuth.atom.key });
  expect(await ask(b.daemonAuth.atom.key)).toMatchObject({ ok: false, reason: expect.stringContaining("no provider for face") });
  expect(await ask(a.daemonAuth.atom.key)).toMatchObject({ ok: true });
  await expect(host({ type: "daemon:face-drop", atomKey: a.daemonAuth.atom.key })).rejects.toThrow(/mounted face/);
  expect(await ask(a.daemonAuth.atom.key)).toMatchObject({ ok: true });
  await expect(host({ type: "daemon:face-lit", entry: { ...entry(c.daemonAuth), faceAnchor: null } })).rejects.toThrow();
  expect(await ask(c.daemonAuth.atom.key)).toMatchObject({ ok: false, reason: expect.stringContaining("no provider for face") });
  await host({ type: "daemon:face-lit", entry: entry(c.daemonAuth) });
  expect(await ask(c.daemonAuth.atom.key)).toMatchObject({ ok: true });
});
