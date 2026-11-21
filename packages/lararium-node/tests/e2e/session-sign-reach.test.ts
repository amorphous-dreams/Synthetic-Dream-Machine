/**
 * session-sign-reach — A NODE SEATS `session:sign` ON A SOVEREIGN COMPOSITION ALONE.
 *
 * The lift seats `sessionSign` on the island record only where the composition stands sovereign (the node key and the
 * mounted face both open; slice 5b). A floor holds no key to sign with: its record carries no door, so a daemon
 * island's `session:sign` answers `signer-unavailable` by name, whatever the vessel's book holds, a standing dial
 * session seated there among it. The floor maps no sealed bag (the sealed rest seals a face's bags only while that face
 * stands lit and proved), so no save of a floor waits on a signature.
 *
 *   S1  PIN: a floor node (no face founded) answers a booked call's `session:sign` `signer-unavailable`; its record
 *       carries no door, and the booked signer signs nothing.
 *   S2  PIN: a founded node composed at the floor, a session seated in its book as a standing dial session would sit,
 *       answers the same: `signer-unavailable`, nothing signed.
 *   S0  CONTROL: a sovereign node signs a booked place session's call through its record's door.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices (slice 5b)
 */
import { afterEach, describe, expect, test } from "vitest";
import { EventEmitter } from "node:events";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withLarRoot } from "../../../../tests/harness/with-lar-root.js";
import { direct } from "../direct-store.js";
import { TEST_CUSTODY, TEST_SLOT } from "../found-route.js";
import { runInit, runFoundTheFace, foundSeedCharter, openNodeVessel, seatFaceRoute, seatWardGatherer } from "../../dist/src/index.js";
import { answerSessionSign } from "../../dist/src/worker-handle.js";
import type { NodeVesselResult } from "../../dist/src/open-node-vessel.js";

seatFaceRoute(async () => [TEST_SLOT]);
seatWardGatherer(async () => TEST_SLOT.pins.flatMap((pin) => (pin.kind === "passphrase" ? [{ kind: "passphrase" as const, passphrase: pin.passphrase }] : [])));

const leaving: Array<() => Promise<void>> = [];
afterEach(async () => { while (leaving.length) await leaving.pop()!(); });

interface Staged { readonly root: string; readonly storageDir: string; readonly genesisDir: string }

async function stage(founded: boolean): Promise<Staged> {
  const root = mkdtempSync(join(tmpdir(), "session-sign-reach-"));
  const genesisDir = join(root, "genesis");
  const storageDir = join(root, "hearth", "vessel");
  cpSync(join(import.meta.dirname, "..", "..", "..", "..", "genesis"), genesisDir, { recursive: true });
  leaving.push(async () => { rmSync(root, { recursive: true, force: true }); });
  await withLarRoot(root, () => direct(runInit)({ storageDir, genesisDir, custody: TEST_CUSTODY, placeFoundingCard: { readBack: async () => {} } }));
  if (founded) {
    await withLarRoot(root, () => foundSeedCharter({ name: "session sign reach founder", readBack: async () => {} }));
    await withLarRoot(root, () => direct(runFoundTheFace)({ storageDir, genesisDir }));
  }
  return { root, storageDir, genesisDir };
}

async function compose(at: Staged, floor: boolean): Promise<NodeVesselResult> {
  const vessel = await withLarRoot(at.root, () => openNodeVessel({
    hostId: "session-sign-reach", wikiId: "lares", storageDir: at.storageDir, genesisDir: at.genesisDir, wss: new EventEmitter() as never,
    ...(floor ? { sovereign: null } : {}),
  }));
  leaving.push(async () => { await withLarRoot(at.root, () => vessel.teardown()); });
  await withLarRoot(at.root, () => vessel.daemon.workerEa);
  return vessel;
}

/** A session's signer as the book reads it, counting what it signed. */
function signer(): { dropped: boolean; certificate: unknown; signed: Uint8Array[]; sign(p: "act", b: Uint8Array): Promise<{ signature: string }> } {
  const signed: Uint8Array[] = [];
  return { dropped: false, certificate: { stand: "in" }, signed, async sign(_p, bytes) { signed.push(bytes); return { signature: "sig-standing" }; } };
}
const payload = new Uint8Array([7, 7, 7]);
const signAsk = (ask: string) => ({ type: "session:sign", requestId: `w-${ask}`, op: "sign", ask, verb: "sealed-seal", payload });

describe("a node seats session:sign on a sovereign composition alone", () => {
  test("S1 PIN: a floor node answers a booked call `signer-unavailable`; its record carries no door", async () => {
    const vessel = await compose(await stage(false), true);
    const s = signer();
    vessel.sessionSigns.hold("req-floor", "sealed-seal", { signer: s, anchor: { kind: "nexus" }, subject: "subject-floor" });
    expect(vessel.islandCaps.sessionSign, "the floor's record carries no session sign door").toBeUndefined();
    expect(await answerSessionSign(vessel.islandCaps, signAsk("req-floor"))).toMatchObject({ refusal: "signer-unavailable" });
    expect(s.signed).toEqual([]);
  }, 300_000);

  test("S2 PIN: a founded node at the floor, a dial session standing in its book, answers `signer-unavailable`", async () => {
    const vessel = await compose(await stage(true), true);
    const s = signer();
    const standing = { signer: s, anchor: { kind: "nexus" as const }, subject: "subject-dial" };
    vessel.sessionSigns.seat(standing);
    vessel.sessionSigns.hold("req-dial", "sealed-seal", standing);
    expect(vessel.sessionSigns.seated(), "the dial session stands seated in the book").toContain(standing);
    expect(vessel.islandCaps.sessionSign, "the floor's record carries no session sign door").toBeUndefined();
    expect(await answerSessionSign(vessel.islandCaps, signAsk("req-dial"))).toMatchObject({ refusal: "signer-unavailable" });
    expect(s.signed).toEqual([]);
  }, 600_000);

  test("S0 CONTROL: a sovereign node signs a booked place session's call through its record's door", async () => {
    const vessel = await compose(await stage(true), false);
    const s = signer();
    vessel.sessionSigns.hold("req-sov", "sealed-seal", { signer: s, anchor: { kind: "place" }, subject: "subject-place" });
    expect(vessel.islandCaps.sessionSign, "the sovereign lift seats the door").toBeDefined();
    expect(await answerSessionSign(vessel.islandCaps, signAsk("req-sov"))).toMatchObject({ signature: "sig-standing" });
    expect(s.signed).toEqual([payload]);
  }, 600_000);
});
