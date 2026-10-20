/**
 * persona-group-roll — A FACE'S PERSONAGROUP FOUNDS AS A KEYHIVE GROUP, so a seat's revocation rolls the key of
 * every bag the group reaches (kapae#/keys; roadmap loop `K12`).
 *
 * Every step runs the production road: the founding ceremony stands the face, the persona crossing seats a
 * second device and delegates a bag to the face's group, and the seat executor's key shore (`keyhiveSeatShore`,
 * the shore `answerFleetSeatDuties` rides) revokes that device. What the device can still open afterwards reads
 * the substrate: a sentinel Document's revocation rolls no bag key (`seat-roll-substrate.probe.test.ts`, 8), a
 * group's does (9).
 *
 *   R1  the founding stands the face's PersonaGroup as a Keyhive group, the founding veil seated in it.
 *   R2  THE ROLL: after the executor's shore revokes a device, content the vessel seals into the face's bag
 *       opens for the device no more; what it read before stays its own (forward only).
 *   R3  CONTROL: with no revocation the device opens the same later content.
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import {
  runFoundingCeremony, replayCapEvents, KeyhiveProvider, InMemoryEventStore, packPersonaCrossing, applyPersonaCrossing,
  keyhiveSeatShore,
} from "@lararium/keyhive";
import * as ed25519 from "@noble/ed25519";
import { hex } from "@lararium/mesh";

const FOUNDER_SEED = new Uint8Array(32).fill(0x37);
const DEVICE_SEED  = new Uint8Array(32).fill(0x38);
const BAG = "lar:///ha.ka.ba/bags/catalog/persona-group-roll";
const enc = (s: string) => new TextEncoder().encode(s);
const b64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

/** The production founding, then the face's veil (the group's founder) and the vessel stood as a boot stands them. */
async function foundAndSeat() {
  const repo = new Repo({ sharePolicy: async () => true });
  const verifyingKey = hex(await ed25519.getPublicKeyAsync(FOUNDER_SEED));
  const f = await runFoundingCeremony({
    repo, vesselSeed: FOUNDER_SEED, vesselVerifyingKey: verifyingKey, vesselDisplayName: "The Roll Test Hearth",
    binding: { mode: "self-stood", signerSeed: FOUNDER_SEED }, hearthTrueName: "", nexusPubkey: verifyingKey,
  });
  const handle = await repo.find(f.daemonUrl as AutomergeUrl);
  const veil = new KeyhiveProvider();
  await veil.init({ seed: f.atomSeed, eventStore: await replayCapEvents(handle as never), archiveBytes: f.veilArchive });
  await veil.hydrateFromEventStore();
  const vessel = new KeyhiveProvider();
  await vessel.init({ seed: FOUNDER_SEED, eventStore: await replayCapEvents(handle as never) });
  await vessel.hydrateFromEventStore();
  // A second device of the same face, seated by the production crossing, which also delegates the bag to the group.
  const device = new KeyhiveProvider();
  await device.init({ seed: DEVICE_SEED, eventStore: new InMemoryEventStore() });
  const { docId } = await vessel.registerBag(BAG);
  const bundle = await packPersonaCrossing(
    vessel, await device.contactCard(), { groupId: f.personaGroupId },
    [{ bagUrl: BAG, docIdHex: docId, plaintext: enc("sealed while the device stood") }], veil,
  );
  const read = await applyPersonaCrossing(device, bundle);
  const before = b64(bundle.content[0]!.ciphertext);
  /** Seal through the hand that holds the bag under the group (the crossing's seat), and carry it to the device. */
  const sealLater = async (text: string): Promise<Uint8Array> => {
    const ct = await veil.encryptContent(BAG, enc(text));
    await device.ingestPeerEvents(await veil.eventsForPeer(await device.vesselIdentifierHex()));
    return ct;
  };
  const opens = (ct: Uint8Array) => device.decryptContent(BAG, ct).then((b) => new TextDecoder().decode(b), () => null);
  return { f, veil, vessel, device, read, before, sealLater, opens };
}

describe("a face's PersonaGroup stands as a Keyhive group", () => {
  test("R1: the founding stands the PersonaGroup as a Keyhive group, its founding veil seated", async () => {
    const { f, veil } = await foundAndSeat();
    const members = await veil.groupMembers(f.personaGroupId);
    expect(members).toContain(await veil.vesselIdentifierHex());
  }, 60_000);

  test("R2: THE ROLL — after the executor's shore revokes the device, the face's bag opens nothing new for it", async () => {
    const { f, veil, device, read, before, sealLater, opens } = await foundAndSeat();
    expect(new TextDecoder().decode(read[0]!.plaintext)).toBe("sealed while the device stood");
    const member = await device.vesselIdentifierHex();
    expect(await keyhiveSeatShore(veil).revokeSeat({ group: f.personaGroupId, member })).toBe("revoked");
    const after = await sealLater("sealed after the device left");
    expect(await opens(after), "the removed device opens content sealed after its removal").toBeNull();
    expect(await opens(before)).toBe("sealed while the device stood");      // forward only: it keeps what it read
  }, 60_000);

  test("R3 CONTROL: with no revocation the device opens the same later content", async () => {
    const { sealLater, opens } = await foundAndSeat();
    const after = await sealLater("sealed with the device still seated");
    expect(await opens(after)).toBe("sealed with the device still seated");
  }, 60_000);
});
