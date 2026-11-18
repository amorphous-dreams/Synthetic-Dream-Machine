/**
 * sealed-crossing-vessel — the house's first cross-vessel sealed-bag witness (persona-selves-sealed#/witnesses W3): a
 * sealed wiki bag written on one vessel reads whole on a second vessel of the same face, and every byte that second
 * vessel rests for the bag stays sealed.
 *
 * Each vessel stands as the node composes it, short of the daemon boot: its own Repo over `composeSealedRest`, the
 * document store's door (`vesselDocStoreDoor` ↔ `answerDocStoreAsks`) over a real MessageChannel, and behind the door a
 * content-key seat over its OWN real Keyhive identity, seated in the face's key group (`content-key-fleet`). The two
 * Repos sync live over a MessageChannel, as two awake vessels of one face do: B's rest books A's change as
 * `peer:<actor>` and seals it under B's own session (sealed-rest.ts, `SaveBook.receive`), so nothing crosses but the
 * opened document, and no key crosses at all.
 *
 *   X1  A writes a marker; B, its session standing (after its lift), reads it whole; no byte A or B rests for the bag
 *       spells the marker or a clear Automerge chunk; B restarted alone (A gone) hydrates the marker from its own rest.
 *   X2  CONTROL: B's rest seals to the face's key group. Handed every byte B rests and the key parcels B's holder
 *       answers (as a carrier would), a third vessel IN the key group reads the marker; a vessel outside it, wearing
 *       the same face, opens nothing and reads no marker, and so does a vessel of another face. The measure itself goes
 *       red: B's same sync over a rest whose map names no bag spells the marker on disk.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed · lar:///ha.ka.ba/kahua/memory/research/persona-selves-sealed
 */
import { afterEach, describe, expect, test } from "vitest";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import { SealedStore } from "@lararium/mesh";
import { faceProofSubjectRef } from "../../lararium-mesh/src/face-proof-subjects.js";
import { chain, siblingChain } from "../../lararium-mesh/tests/face-proof-fixture.js";
import { FLEET_NEXUS, fleet, type Device } from "../../lararium-keyhive/tests/content-key-fleet.js";
import { MAGIC, drain, everyByte, holds, islandOf, link, memoryAdapter, readWithin, spells, vessel as standVessel, type Island, type MemoryAdapter, type VesselOptions } from "./sealed-crossing-fixture.js";

const BAG = "lar:///ha.ka.ba/@test/bags/SEARCH-ME-crossing-notes";
const MARKER = "the-otter-crosses-at-the-second-weir";
afterEach(drain);

/** Does any resting byte spell the marker, or a clear Automerge chunk? */
const spellsClear = (bytes: readonly Uint8Array[]): boolean => spells(bytes, MARKER) || bytes.some((b) => holds(b, MAGIC));
/** One vessel whose bag map names each document of `mapped` as the bag's. */
const vessel = (label: string, island: Island, face: string, mapped: ReadonlySet<string>, opts: VesselOptions = {}) =>
  standVessel(label, island, face, (documentId) => (mapped.has(documentId) ? { bagId: BAG, face } : null), opts);
/** What `repo` reads of `url` within a bound: its note, or null where it found nothing it could open. */
const noteOf = (repo: Parameters<typeof readWithin>[0], url: AutomergeUrl, ms = 8_000) => readWithin<{ note?: string }, string>(repo, url, (doc) => doc?.note ?? null, ms);

/** One face's two vessels A and B, each seated in the face's key group on its own Keyhive identity, synced live. */
async function crossing(base: number, opts: { mapOnB?: boolean } = {}) {
  // A third vessel of the face, C, sits in the key group asleep: it stands no Repo here (X2 hands it B's bytes).
  const { devices: [a, b, c] } = await fleet(base, ["vessel-a", "vessel-b", "vessel-c"], {
    bags: [BAG],
    chainFor: async (name, founder) => (founder ? siblingChain(founder, `${name}-${base}`) : chain(`${name}-${base}`, FLEET_NEXUS)),
  });
  const face = faceProofSubjectRef(a!.chain.scope);
  expect(faceProofSubjectRef(b!.chain.scope), "SETUP: both vessels wear one face").toBe(face);
  const mapped = new Set<string>();
  const [toB, toA] = link();
  const A = vessel("a", islandOf(a!), face, mapped, { network: [toB] });
  const B = vessel("b", islandOf(b!), face, opts.mapOnB === false ? new Set() : mapped, { network: [toA] });
  const doc = A.repo.create<{ note?: string }>();
  mapped.add(doc.documentId);                                    // both vessels' bag maps name the document as the bag's
  A.rest.wrote(doc.documentId, A.session);
  doc.change((d) => { d.note = MARKER; });
  await A.settle();
  return { a: a!, b: b!, c: c!, face, mapped, A, B, doc };
}

describe("a sealed wiki bag crosses between two vessels of one face", () => {
  test("X1 — written on A, B reads the marker whole after its lift; every byte either rests stays sealed; B restarted alone reads it from its own rest", async () => {
    const { b, face, mapped, A, B, doc } = await crossing(0xc0);
    // A RESTS SEALED (the one-vessel law this witness stands on).
    expect([...A.inner.bytes.keys()].some((k) => k.startsWith(doc.documentId)), "SETUP: A rested the document").toBe(true);
    expect(spellsClear(await everyByte(A.resting, doc.documentId)), "A rests no clear byte for the bag").toBe(false);
    // B READS IT WHOLE, live, over the sync link.
    expect(await noteOf(B.repo, doc.url)).toBe(MARKER);
    await B.settle();
    // B RESTS IT, SEALED UNDER ITS OWN SESSION: values reached B's rest for the document, no save waits, no byte is clear.
    expect([...B.inner.bytes.keys()].some((k) => k.startsWith(doc.documentId)), "B rested the document").toBe(true);
    expect(B.rest.store.waiting(doc.documentId), "no save of A's change waits unsealed on B").toBe(0);
    expect(B.resting.values.size, "B's own seat sealed values for the bag").toBeGreaterThan(0);
    expect(spellsClear(await everyByte(B.resting, doc.documentId)), "B rests no clear byte for the bag").toBe(false);
    // B RESTARTED ALONE: A stands nowhere on the link, and B hydrates the marker from its own sealed rest and its own key.
    await A.repo.shutdown();
    await B.repo.shutdown();
    const again = vessel("b-again", islandOf(b), face, mapped, { inner: B.inner });
    expect(await noteOf(again.repo, doc.url)).toBe(MARKER);
    expect(again.opens.length, "the restart opened through B's own seat").toBeGreaterThan(0);
    expect(again.opens.every((o) => o.ok), JSON.stringify(again.opens)).toBe(true);
  }, 120_000);

  test("X2 — CONTROL: handed every byte B rests and the parcels B answers, a third vessel in the key group reads the marker; one outside it, or of another face, opens nothing; the measure goes red on a clear rest", async () => {
    const { b, c, face, mapped, B, doc } = await crossing(0xd0);
    expect(await noteOf(B.repo, doc.url), "SETUP: B read the marker").toBe(MARKER);
    await B.settle();
    await B.repo.shutdown();
    const copy = (): MemoryAdapter => { const m = memoryAdapter(); for (const [k, v] of B.inner.bytes) m.bytes.set(k, Uint8Array.from(v)); return m; };
    /** Hand `to` everything B rests for the bag, as a carrier would (sealed-store step four's shape): B's sealed values,
     *  the key parcels B's holder answers for `to`'s identity, B's manifests and hand-overs, and a copy of B's Repo rest. */
    const handOver = async (to: Device, label: string, wears: string, map: ReadonlySet<string>) => {
      for (const [address, bytes] of b.values) to.values.set(address, Uint8Array.from(bytes));
      const parcels = await b.seat.holder.parcelsFor({ bagId: BAG, reader: to.id });
      if (!Array.isArray(parcels)) throw new Error(`SETUP: B's holder answered no parcels: ${JSON.stringify(parcels)}`);
      const store = new SealedStore(b.rest);
      const took = await to.seat.holder.receive({ parcels, records: [...await store.records("manifest"), ...await store.records("hand-over")] });
      return { took: "refusal" in took ? took.refusal : "received", ...vessel(label, islandOf(to), wears, map, { inner: copy() }) };
    };
    // CONTROL THAT IT CAN READ: a third vessel of the face, seated in the key group and asleep through the write, handed
    // B's bytes, reads the marker. The handing-over below differs for the next two only in the key group.
    const member = await handOver(c, "member", face, mapped);
    expect(member.took).toBe("received");
    expect(await noteOf(member.repo, doc.url), JSON.stringify(member.opens)).toBe(MARKER);
    // AN OUTSIDER OF THE KEY GROUP wearing the same face: its own Keyhive identity in no group the face holds.
    const { devices: [x] } = await fleet(0xd8, ["outsider"], { bags: [BAG], group: false, chainFor: async (name) => siblingChain(b.chain, `${name}-0xd8`) });
    expect(faceProofSubjectRef(x!.chain.scope), "SETUP: the outsider wears the face").toBe(face);
    const outsider = await handOver(x!, "outsider", face, mapped);
    expect(await noteOf(outsider.repo, doc.url, 4_000), "the outsider reads no marker").not.toBe(MARKER);
    expect(outsider.opens.length, "the outsider's store asked its seat to open").toBeGreaterThan(0);
    expect(outsider.opens.some((o) => o.ok), JSON.stringify(outsider.opens)).toBe(false);
    // A VESSEL OF ANOTHER FACE, seated in its own face's key group, handed the same: it opens nothing.
    const { devices: [y] } = await fleet(0xe0, ["other-face"], { bags: [BAG] });
    const otherFace = faceProofSubjectRef(y!.chain.scope);
    expect(otherFace).not.toBe(face);
    const stranger = await handOver(y!, "stranger", otherFace, mapped);
    expect(await noteOf(stranger.repo, doc.url, 4_000), "another face reads no marker").not.toBe(MARKER);
    expect(stranger.opens.some((o) => o.ok), JSON.stringify(stranger.opens)).toBe(false);
    // THE MEASURE GOES RED: the same crossing to a B whose map names no bag rests the change clear, and the census says so.
    const clear = await crossing(0xe8, { mapOnB: false });
    expect(await noteOf(clear.B.repo, clear.doc.url)).toBe(MARKER);
    await clear.B.settle();
    expect(spellsClear(await everyByte(clear.B.resting, clear.doc.documentId)), "a clear rest spells the marker").toBe(true);
  }, 120_000);
});
