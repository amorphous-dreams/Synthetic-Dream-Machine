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

test("a refused sibling leaves the mounted and healthy faces serving", async () => {
  const a = await standFoundedIsland(teardown);
  const b = await standFoundedIsland(teardown, { seedOffset: 10 });
  const c = await standFoundedIsland(teardown, { seedOffset: 20 });
  const opts = operatorDaemonOptions({ daemonAuth: { ...a.daemonAuth, joinedFaces: [{ ...entry(b.daemonAuth), faceAnchor: null }, entry(c.daemonAuth)] } } as never, { dyadReading: () => "clear" });
  const verifier = await opts.verifierFactory!(a.ctx);
  const ask = (key: string) => verifier.verify({ presenter: `0x${key}`, bagUrl: DAEMON_BAG_ID, access: "read", channel: "local" });
  expect(await ask(a.daemonAuth.atom.key)).toMatchObject({ ok: true });
  expect(await ask(c.daemonAuth.atom.key)).toMatchObject({ ok: true });
  expect(await ask(b.daemonAuth.atom.key)).toMatchObject({ ok: false, reason: expect.stringContaining("no provider for face") });
});

test("dropping waits for a captured verification before disposing", async () => {
  const a = await standFoundedIsland(teardown);
  const b = await standFoundedIsland(teardown, { seedOffset: 10 });
  const opts = operatorDaemonOptions({ daemonAuth: { ...a.daemonAuth, joinedFaces: [entry(b.daemonAuth)] } } as never, { dyadReading: () => "clear" });
  const verifier = await opts.verifierFactory!(a.ctx);
  const { KeyhiveProvider } = await import("@lararium/keyhive");
  let release!: () => void;
  let started!: () => void;
  const begun = new Promise<void>((resolve) => { started = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const original = KeyhiveProvider.prototype.verify;
  const verify = vi.spyOn(KeyhiveProvider.prototype, "verify").mockImplementation(async function (this: InstanceType<typeof KeyhiveProvider>, ...args) { started(); await gate; return original.apply(this, args); });
  const dispose = vi.spyOn(KeyhiveProvider.prototype, "dispose");
  try {
    const pending = verifier.verify({ presenter: `0x${b.daemonAuth.atom.key}`, bagUrl: DAEMON_BAG_ID, access: "read", channel: "local" });
    await begun;
    const drop = opts.onHostMessage!({ type: "daemon:face-drop", atomKey: b.daemonAuth.atom.key }, a.ctx);
    await Promise.resolve(); expect(dispose).not.toHaveBeenCalled();
    release(); expect(await pending).toMatchObject({ ok: true }); await drop;
    expect(dispose).toHaveBeenCalled();
  } finally { verify.mockRestore(); dispose.mockRestore(); }
});

test("a gate failure after initialization disposes its provider", async () => {
  const a = await standFoundedIsland(teardown);
  const { KeyhiveProvider, bootDaemonKeyhive } = await import("@lararium/keyhive");
  const dispose = vi.spyOn(KeyhiveProvider.prototype, "dispose");
  const init = vi.spyOn(KeyhiveProvider.prototype, "init").mockResolvedValue(undefined);
  const hydrate = vi.spyOn(KeyhiveProvider.prototype, "hydrateFromEventStore").mockRejectedValue(new Error("hydrate failed"));
  try {
    await expect(bootDaemonKeyhive({ ...a.daemonAuth, atomSeed: new Uint8Array(32), faceVerifyingKey: a.daemonAuth.atom.key, eventStore: {} as never, registerBags: [] })).rejects.toThrow("hydrate failed");
    expect(dispose).toHaveBeenCalledOnce();
  } finally { dispose.mockRestore(); init.mockRestore(); hydrate.mockRestore(); }
});
