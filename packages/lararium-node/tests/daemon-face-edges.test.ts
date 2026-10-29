/**
 * daemon-face-edges — the K19 daemon's edges past the content fence (Aftermath on PR #110: M2, L1, L2).
 *
 *   · M2: the verifier's Kahu door refuses a call that names no presenter, as the verb fence does; the mounted
 *     presenter still reaches its own hand (CONTROL).
 *   · L1: a repeated `daemon:face-lit` for a lit face whose inputs changed refuses by name and never reads as success;
 *     the same inputs again settle as they stand (CONTROL), and the mounted face's key takes the same rule.
 *   · L2: a face's drop waits for a verb already past its verify that still holds that face's provider.
 */
import { afterEach, expect, test, vi } from "vitest";
import * as ed from "@noble/ed25519";
import { KeyhiveProvider } from "@lararium/keyhive";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import { BAG_IDS, DAEMON_BAG_ID, hex, kahuRealmGroup, openKahuCabalAct, signKahuCabalAct, type CapabilityVerifier, type KahuCabalBoardReader, type KahuQuorumSeats } from "@lararium/mesh";
import { VerbTable } from "@lararium/tw5";
import { standFoundedIsland } from "./stand-founded-island.js";

vi.setConfig({ testTimeout: 900_000, hookTimeout: 900_000 });
const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) { try { teardown.pop()!(); } catch { /* best-effort */ } } });
const entry = (auth: any) => {
  const { atom, personaGroupId, faceAnchor, personaKel, deviceEdge, signerDid, meshCabalDocIdHex, veilArchiveBytes, faceAddressSecret, registerBags } = auth;
  return { atom, personaGroupId, faceAnchor, personaKel, deviceEdge, signerDid, meshCabalDocIdHex, veilArchiveBytes, faceAddressSecret, registerBags };
};
/** Every queued callback runs and every settled promise resolves: event-loop turns, never a clock. */
const turns = async (n: number) => { for (let i = 0; i < n; i++) await new Promise<void>((resolve) => setImmediate(resolve)); };

const SEAT = new Uint8Array(32).fill(9);
/** A one-seat cabal board that admits `group` to the Kahu realm. */
async function boardAdmitting(group: string): Promise<KahuCabalBoardReader> {
  const nexus = "nexus-" + "ab".repeat(32);
  const roster: KahuQuorumSeats = { keys: [hex(await ed.getPublicKeyAsync(SEAT))], threshold: 1, sealEpochCid: "epoch-founded-1" };
  const acts = [await signKahuCabalAct(openKahuCabalAct({ nexus, group, action: "admit", roster }),
    [{ signer: roster.keys[0]!, sign: (b) => ed.signAsync(b, SEAT).then(hex) }], roster)];
  return () => ({ nexus, roster, acts });
}

test("M2: the Kahu door refuses a call that names no presenter; the mounted presenter reaches its hand (CONTROL)", async () => {
  const a = await standFoundedIsland(teardown);
  const b = await standFoundedIsland(teardown, { seedOffset: 10 });
  const board = await boardAdmitting(kahuRealmGroup(a.daemonAuth.personaGroupId));
  const opts = operatorDaemonOptions({ daemonAuth: { ...a.daemonAuth, joinedFaces: [entry(b.daemonAuth)] } } as never,
    { dyadReading: () => "clear", kahuCabal: () => board });
  const verifier = await opts.verifierFactory!(a.ctx) as CapabilityVerifier & { dispose?: () => Promise<void> };
  teardown.push(() => { void verifier.dispose?.(); });
  // CONTROL first: the mounted presenter holds the hand, so a refusal below reads the missing presenter and nothing else.
  await expect(verifier.kahuReach!(BAG_IDS.lares, "wiki-act", `0x${a.daemonAuth.atom.key}`)).resolves.toBeUndefined();
  await expect(verifier.kahuReach!(BAG_IDS.lares, "wiki-act", `0x${b.daemonAuth.atom.key}`)).rejects.toMatchObject({ reason: "kahu-reach" });
  await expect(verifier.kahuReach!(BAG_IDS.lares, "wiki-act")).rejects.toMatchObject({ reason: "kahu-reach", message: expect.stringContaining("names no presenter") });
});

test("L1: a repeated face-lit with changed inputs refuses by name; the same inputs settle as they stand", async () => {
  const a = await standFoundedIsland(teardown);
  const b = await standFoundedIsland(teardown, { seedOffset: 10 });
  const opts = operatorDaemonOptions({ daemonAuth: { ...a.daemonAuth, joinedFaces: [entry(b.daemonAuth)] } } as never, { dyadReading: () => "clear" });
  const verifier = await opts.verifierFactory!(a.ctx) as CapabilityVerifier & { dispose?: () => Promise<void> };
  teardown.push(() => { void verifier.dispose?.(); });
  const host = (message: unknown) => opts.onHostMessage!(message as never, a.ctx);
  const moved = (auth: any) => ({ ...entry(auth), registerBags: [...auth.registerBags, "lar:///ha.ka.ba/@test/bags/moved"] });
  // CONTROL: the same inputs again change nothing and settle.
  await expect(host({ type: "daemon:face-lit", entry: entry(b.daemonAuth) })).resolves.toBeUndefined();
  await expect(host({ type: "daemon:face-lit", entry: moved(b.daemonAuth) })).rejects.toThrow(/face-lit-changed/);
  await expect(host({ type: "daemon:face-lit", entry: moved(a.daemonAuth) })).rejects.toThrow(/face-lit-changed/);
  await expect(host({ type: "daemon:face-lit", entry: entry(a.daemonAuth) })).resolves.toBeUndefined();
  expect(await verifier.verify({ presenter: `0x${b.daemonAuth.atom.key}`, bagUrl: DAEMON_BAG_ID, access: "read", channel: "local" })).toMatchObject({ ok: true });
});

test("L2: a face's drop waits for a verb past its verify that still holds the face's provider", async () => {
  const a = await standFoundedIsland(teardown);
  const b = await standFoundedIsland(teardown, { seedOffset: 10 });
  const opts = operatorDaemonOptions({ daemonAuth: { ...a.daemonAuth, joinedFaces: [entry(b.daemonAuth)] } } as never, { dyadReading: () => "clear" });
  const verifier = await opts.verifierFactory!(a.ctx) as CapabilityVerifier & { dispose?: () => Promise<void> };
  teardown.push(() => { void verifier.dispose?.(); });
  const registry = new VerbTable();
  opts.wireWorkerVerbs!(registry, a.ctx);
  const sibling = `0x${b.daemonAuth.atom.key}`;
  // The sibling's verb clears its verify, then reads the daemon layer: hold that read until the drop has been asked.
  const daemonStore = (a.ctx as any).composite.storeForBag(DAEMON_BAG_ID);
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const reading = new Promise<void>((resolve) => { entered = resolve; });
  const listVisible = daemonStore.listVisible.bind(daemonStore);
  const read = vi.spyOn(daemonStore, "listVisible").mockImplementation(async () => { entered(); await gate; return listVisible(); });
  const dispose = vi.spyOn(KeyhiveProvider.prototype, "dispose");
  try {
    const ctx = { daemon: {} as never, invocation: { requestId: "l2" } as never, presenter: sibling,
      cap: (access: "read", bagUrl: string) => verifier.verify({ presenter: sibling, bagUrl, access, channel: "local" }) } as never;
    const run = (async () => {
      expect(await verifier.verify({ presenter: sibling, bagUrl: DAEMON_BAG_ID, access: "read", channel: "local" })).toMatchObject({ ok: true });
      return registry.get("realm-clock")!({ realm: "ab".repeat(32) }, ctx);
    })();
    await reading;
    const drop = opts.onHostMessage!({ type: "daemon:face-drop", atomKey: b.daemonAuth.atom.key }, a.ctx);
    await turns(50);
    expect(dispose, "the drop disposed under a running verb").not.toHaveBeenCalled();
    release();
    await run;
    await drop;
    expect(dispose).toHaveBeenCalled();
  } finally { read.mockRestore(); dispose.mockRestore(); release(); }
});
