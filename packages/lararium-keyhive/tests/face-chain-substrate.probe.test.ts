/**
 * face-chain-substrate — THE PROBE THAT SCOPES THE FACE PROOF'S PRIVATE AUTHORITY.
 *
 * The question, exactly: can a Keyhive 0.3.0-alpha.1 group carry the face → vessel delegation and its
 * withdrawal so that a GATE outside the group reads both, or does the house keep its own signed chain?
 * A gate may hold the denials it needs and never a member directory, every signature it accepts passes
 * the house's one strict door, and two faces of one vessel share no identifier.
 *
 * Four readings, each a measurement:
 *   1. THE DOOR. Does a delegation hand out the bytes its signature covers, so the strict door can read it?
 *   2. THE DENIAL ALONE. Does an outsider that receives ONLY the revocation come to hold it?
 *   3. THE DIRECTORY. What else does an outsider learn once it holds enough history to hold the revocation?
 *   4. THE SHARED NAME. Does one instance wear one identifier inside two groups?
 *
 * A probe measures; it does not wish. Each expectation below records what the 0.3.0-alpha.1 line answered,
 * and stands as the alarm that rings when an upstream move changes the answer.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/owed
 */
import { describe, test, expect, beforeAll } from "vitest";
import * as KH from "@keyhive/keyhive/slim";
import { ensureKeyhiveWasm } from "../src/index.js";

interface Peer { readonly kh: KH.Keyhive; readonly events: Uint8Array[] }

async function peer(fill: number): Promise<Peer> {
  const events: Uint8Array[] = [];
  const signer = KH.Signer.memorySignerFromBytes(new Uint8Array(32).fill(fill));
  const kh = await KH.Keyhive.init(signer, KH.CiphertextStore.newInMemory(), (event: KH.Event) => { events.push(event.toBytes()); });
  return { kh, events };
}

const hexOf = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** Introduce `stranger` to `host`, and return the stranger's identifier as the host reads it. */
async function introduce(host: Peer, stranger: Peer): Promise<KH.Identifier> {
  return (await host.kh.receiveContactCard(await stranger.kh.contactCard())).toIdentifier();
}

async function memberHexes(p: Peer, groupId: KH.GroupId): Promise<string[] | null> {
  const group = await p.kh.getGroup(groupId);
  if (!group) return null;
  return (await group.members()).map((cap) => hexOf(cap.who.id.toBytes())).sort();
}

describe("Keyhive 0.3 as the face chain's substrate", () => {
  beforeAll(() => { ensureKeyhiveWasm(); });

  test("READING 1: a delegation exposes a signature and a key, and no signed bytes for the house's door", async () => {
    const root = await peer(0x51);
    const vessel = await peer(0x52);
    const face = await root.kh.generateGroup([]);
    const delegation = await root.kh.addMember(await introduce(root, vessel), KH.MemberedId.group(face), KH.Access.read(), []);

    expect(delegation.signature.length).toBe(64);
    expect(delegation.verifyingKey.length).toBe(32);
    expect(delegation.verify()).toBe(true);
    // The measurement: nothing on the object returns the payload its signature covers.
    const surface = Object.getOwnPropertyNames(Object.getPrototypeOf(delegation)).sort();
    expect(surface.filter((name) => /payload|bytes/i.test(name))).toEqual([]);
    // CONTROL: the reflection reads a real surface, so an empty filter states an absence.
    expect(surface).toContain("verify");
    expect(surface).toContain("signature");
  });

  test("READINGS 2 and 3: the denial alone lands nowhere; the history that lands it lists every vessel", async () => {
    const root = await peer(0x61);
    const kept = await peer(0x62);
    const removed = await peer(0x63);
    const gate = await peer(0x64);

    const face = await root.kh.generateGroup([]);
    const membered = KH.MemberedId.group(face);
    const keptId = await introduce(root, kept);
    const removedId = await introduce(root, removed);
    await root.kh.addMember(keptId, membered, KH.Access.read(), []);
    await root.kh.addMember(removedId, membered, KH.Access.read(), []);

    const before = root.events.length;
    const revocations = await root.kh.revokeMember(removedId, true, membered);
    expect(revocations.length).toBeGreaterThan(0);
    const revocationEvents = root.events.slice(before);
    expect(revocationEvents.length).toBeGreaterThan(0);                 // the setup took: the act emitted events

    // READING 2. The gate receives the revocation's own events and nothing else. `ingestEventsBytes`
    // answers with the events it could not apply.
    const unapplied = await gate.kh.ingestEventsBytes(revocationEvents);
    expect(unapplied.length).toBeGreaterThan(0);                         // a denial came back unapplied
    expect(await gate.kh.hasGroup(face)).toBe(false);                    // and the gate holds no group to ask

    // READING 3. The least history that lets the revocation land: every event the root emitted, AND the
    // events Keyhive routes for the root. Either alone leaves the delegations unapplied.
    const rootAgent = await root.kh.getAgent(root.kh.id.toIdentifier());
    const routed = [...(await root.kh.eventsForAgent(rootAgent!)).values()] as Uint8Array[];
    expect((await gate.kh.ingestEventsBytes(root.events)).length).toBeGreaterThan(0);   // the emitted events alone: still unapplied
    expect(await gate.kh.hasGroup(face)).toBe(false);
    expect(await gate.kh.ingestEventsBytes(routed)).toEqual([]);                        // with the routed history: everything lands
    const members = await memberHexes(gate, face);
    expect(members).not.toBeNull();
    const keptHex = hexOf(keptId.toBytes());
    const removedHex = hexOf(removedId.toBytes());
    // The gate now reads the vessel that stayed, by its stable identifier: a directory of current members.
    expect(members).toContain(keptHex);
    expect(members).not.toContain(removedHex);
    // CONTROL: the two vessels carry different identifiers, so the listing distinguishes them.
    expect(keptHex).not.toBe(removedHex);
  });

  test("READING 4: one instance wears one identifier inside two faces", async () => {
    const rootA = await peer(0x71);
    const rootB = await peer(0x72);
    const vessel = await peer(0x73);

    const faceA = await rootA.kh.generateGroup([]);
    const faceB = await rootB.kh.generateGroup([]);
    const underA = await rootA.kh.addMember(await introduce(rootA, vessel), KH.MemberedId.group(faceA), KH.Access.read(), []);
    const underB = await rootB.kh.addMember(await introduce(rootB, vessel), KH.MemberedId.group(faceB), KH.Access.read(), []);

    const delegateA = hexOf(underA.delegation.delegate.id.toBytes());
    const delegateB = hexOf(underB.delegation.delegate.id.toBytes());
    // The same vessel stands as the same delegate under two unrelated faces: a reader of both links them.
    expect(delegateA).toBe(delegateB);
    expect(delegateA).toBe(hexOf(vessel.kh.id.toBytes()));
    // CONTROL: the two faces themselves differ.
    expect(hexOf(faceA.toBytes())).not.toBe(hexOf(faceB.toBytes()));
  });
});
