/**
 * pre-seat-reach — a binding minted while the vessel stood ALONE must reach the member seated AFTER it.
 *
 * The hazard: a bag delegated and SEALED before a face took its seat looks healthy from every angle — the seat
 * lands, the group carries it into the bag's key agreement — yet the member reads `Key not found`. keyhive
 * reads FORWARD-ONLY, so a seat moves no already-sealed chunk. Reach needs the holder to RE-SEAL each pre-seat
 * chunk at the current epoch; the grant carries the fresh ciphertext out.
 *
 * The provider is the REAL KeyhiveProvider — the crypto answers, never a stub. The direct pattern (a leaf holds
 * its own PersonaGroup, seals, then seats) mirrors leaf-fleet-admit, where the seat holds the group itself.
 */
import { describe, test, expect } from "vitest";
import { buildDeviceDelegation } from "@lararium/mesh";
import { KeyhiveProvider } from "../src/keyhive-provider.js";
import { runFaceJoin, type FaceJoinContext, type FaceJoinGrant } from "../src/face-join.js";

const noopStore = { put: async () => {}, list: async () => [] };
const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const b64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

async function leaf(fill: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: seedOf(fill), eventStore: noopStore });
  return p;
}
const rawKeyOf = async (p: KeyhiveProvider) => (await p.whoami()).replace(/^0x/, "");

async function leafEdge(rootSeed: Uint8Array, joinee: KeyhiveProvider) {
  return buildDeviceDelegation({
    personaRootSeed: rootSeed,
    deviceVerifyingKey: await rawKeyOf(joinee),
    hearthTrueName: "",
    boundEpoch: 0,
  });
}

async function faceOf(hearth: KeyhiveProvider, uri: string) {
  void uri;
  return hearth.createGroup();   // the founding identity stands seated in the group it founds
}

const ctxFor = (rootDid: string, pg: { groupId: string }, reseal?: readonly string[]): FaceJoinContext => ({
  personaRootDid: rootDid,
  hearthTrueName: "",
  personaGroupId: pg.groupId,
  dyad: () => "clear", leaseEpoch: 0,
  ...(reseal ? { reseal } : {}),
});

const summonsFor = async (joinee: KeyhiveProvider, edge: Awaited<ReturnType<typeof leafEdge>>) => ({
  kind: "face-join/v1" as const,
  contactCard: new TextDecoder().decode(await joinee.contactCard()),
  deviceEdge: edge,
});

/** What a seated member's boot does with the grant it reads back: become known, ingest the reach, adopt the bag. */
async function absorb(joinee: KeyhiveProvider, grant: FaceJoinGrant, bag: { bagUrl: string; docIdHex: string }) {
  await joinee.receiveContactCard(new TextEncoder().encode(grant.founderCard));
  await joinee.ingestPeerEvents(grant.capEvents.map(b64));
  joinee.adoptBag(bag.bagUrl, bag.docIdHex);
}

describe("a binding minted vessel-only, before the seat", () => {
  test("the pre-seat sealed bag reaches the member — the grant carries the re-sealed chunk", async () => {
    const phone = await leaf(81);           // the vessel — it stands ALONE and seals a bag
    const ROOT = seedOf(230);
    const pg = await faceOf(phone, "lar:///ha.ka.ba/sentinel/pg-pre-seat");

    const BAG = "lar:///ha.ka.ba/bags/catalog/pre-seat-note";
    const { docId } = await phone.registerBag(BAG);
    await phone.delegate({ bagUrl: BAG, audience: pg.groupId, access: "read" });
    const preSeatSealed = await phone.encryptContent(BAG, new TextEncoder().encode("held before the seat"));

    // NOW a face joins and takes its seat, naming the pre-seat bag to re-seal.
    const laptop = await leaf(82);
    const edge = await leafEdge(ROOT, laptop);
    const out = await runFaceJoin(phone, await summonsFor(laptop, edge), ctxFor(edge.personaRootDid, pg, [BAG]));
    expect(out.ok).toBe(true);
    if (!out.ok) return;

    expect(out.grant.reSealed).toHaveLength(1);             // the standing chunk re-sealed — the reach
    expect(out.grant.reSealed[0]!.bagUrl).toBe(BAG);

    await absorb(laptop, out.grant, { bagUrl: BAG, docIdHex: docId });

    // The member reaches the pre-seat content through the RE-SEALED ciphertext the grant carried.
    const fresh = b64(out.grant.reSealed[0]!.ciphertextB64);
    expect(new TextDecoder().decode(await laptop.decryptContent(BAG, fresh))).toBe("held before the seat");

    // WHY the re-seal is needed: the ORIGINAL pre-seat bytes stay keyed to an epoch the member is outside of.
    await expect(laptop.decryptContent(BAG, preSeatSealed)).rejects.toThrow(/key not found/i);
  }, 60_000);

  test("a device that returns after a lift takes a fresh seat and opens nothing sealed before it", async () => {
    const phone = await leaf(87), ROOT = seedOf(234);
    const pg = await faceOf(phone, "lar:///ha.ka.ba/sentinel/pg-returned");
    const BAG = "lar:///ha.ka.ba/bags/catalog/returned";
    const { docId } = await phone.registerBag(BAG); await phone.delegate({ bagUrl: BAG, audience: pg.groupId, access: "read" });
    const preSeat = await phone.encryptContent(BAG, new TextEncoder().encode("before lift"));
    const laptop = await leaf(88), edge = await leafEdge(ROOT, laptop);
    const ctx = { ...ctxFor(edge.personaRootDid, pg, [BAG]), dyad: () => "returned" as const };
    const out = await runFaceJoin(phone, await summonsFor(laptop, edge), ctx); expect(out.ok).toBe(true); if (!out.ok) return;
    expect(out.grant.reSealed).toEqual([]); await absorb(laptop, out.grant, { bagUrl: BAG, docIdHex: docId });
    await expect(laptop.decryptContent(BAG, preSeat)).rejects.toThrow(/key not found/i);
    const postSeat = await phone.encryptContent(BAG, new TextEncoder().encode("after seat"));
    await laptop.ingestPeerEvents(await phone.eventsForPeer(out.grant.joineeAgentIdHex)); laptop.adoptBag(BAG, docId);
    expect(new TextDecoder().decode(await laptop.decryptContent(BAG, postSeat))).toBe("after seat");
  }, 60_000);

  test("REGRESSION GUARD — a pre-seat bag left OUT of the re-seal reaches nothing, visibly", async () => {
    // The gap this whole file exists for: the seat lands and reaches the bag forward, but the pre-seat chunk was
    // never named to re-seal. `reSealed` is empty and the member reads Key not found.
    const phone = await leaf(85);
    const ROOT = seedOf(233);
    const pg = await faceOf(phone, "lar:///ha.ka.ba/sentinel/pg-pre-seat-omitted");

    const BAG = "lar:///ha.ka.ba/bags/catalog/pre-seat-omitted";
    const { docId } = await phone.registerBag(BAG);
    await phone.delegate({ bagUrl: BAG, audience: pg.groupId, access: "read" });
    const preSeatSealed = await phone.encryptContent(BAG, new TextEncoder().encode("held before the seat"));

    const laptop = await leaf(86);
    const edge = await leafEdge(ROOT, laptop);
    const out = await runFaceJoin(phone, await summonsFor(laptop, edge), ctxFor(edge.personaRootDid, pg)); // no re-seal
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.grant.reSealed).toEqual([]);

    await absorb(laptop, out.grant, { bagUrl: BAG, docIdHex: docId });
    await expect(laptop.decryptContent(BAG, preSeatSealed)).rejects.toThrow(/key not found/i);
  }, 60_000);

  test("CONTROL — content sealed AFTER the seat reaches the member with NO re-seal", async () => {
    // Proves the fix targets the BACKWARD-propagation gap only: a chunk keyed at or after the seat is reachable
    // by the forward-only read on its own, so a blanket re-seal would be masking, never fixing, this path.
    const phone = await leaf(83);
    const ROOT = seedOf(231);
    const pg = await faceOf(phone, "lar:///ha.ka.ba/sentinel/pg-post-seat");

    const laptop = await leaf(84);
    const edge = await leafEdge(ROOT, laptop);
    const out = await runFaceJoin(phone, await summonsFor(laptop, edge), ctxFor(edge.personaRootDid, pg)); // no re-seal
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.grant.reSealed).toEqual([]);                 // nothing stood sealed at seat time

    await laptop.receiveContactCard(new TextEncoder().encode(out.grant.founderCard));
    await laptop.ingestPeerEvents(out.grant.capEvents.map(b64));

    // Seal AFTER the seat — the chunk keys to an epoch the member is already inside.
    const BAG = "lar:///ha.ka.ba/bags/catalog/post-seat-note";
    const { docId } = await phone.registerBag(BAG);
    await phone.delegate({ bagUrl: BAG, audience: pg.groupId, access: "read" });
    const postSeatSealed = await phone.encryptContent(BAG, new TextEncoder().encode("sealed after the seat"));

    await laptop.ingestPeerEvents(await phone.eventsForPeer(out.grant.joineeAgentIdHex));
    laptop.adoptBag(BAG, docId);
    expect(new TextDecoder().decode(await laptop.decryptContent(BAG, postSeatSealed))).toBe("sealed after the seat");
  }, 60_000);
});
