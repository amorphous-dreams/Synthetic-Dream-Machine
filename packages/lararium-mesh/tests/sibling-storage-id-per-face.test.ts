/**
 * sibling-storage-id-per-face.test — the sibling channel's peer metadata scopes to the FACE (the veil's second cut,
 * road `C1`).
 *
 * A sibling names its Repo's peer metadata inside the proven session, and that metadata carries a store id. One vessel
 * that lights faces A and B in one composition stands one Repo, so a party admitted as a sibling under both faces reads
 * one store id inside both sessions and joins the faces by it, whatever peer id each session derives. The vessel in
 * turn keys a sibling's sync state on the store id the sibling names, so one remote store met under two faces opens
 * each face's exchange from the heads the other reached.
 *
 * The vessel side stands as a vessel stands it: ONE Repo over one store (`wireIdentityOf`), and a sibling channel for
 * each lit face, each seated through the channel's own door (`seatSiblingLeg`, the door `standSiblingChannel` calls).
 * The observer stands a Repo of its own under each face, both over stores that name ONE store id, as one party's does.
 *
 *   S1  RED: the observer reads two unrelated store ids inside the two proven sessions, and neither reads the
 *       composition's own
 *   S2  RED: the vessel rests the observer's one store id under two local scopes, never bare
 *   S3  CONTROL: one face at one Nexus keeps its store id across a restart and reads back the sync state it rested
 *   S4  RED: `standSiblingChannel` seats the channel it stands for the face and the Nexus it was handed
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/residency-follows-the-contract#/faces-sit-flat
 */
import { describe, test, expect, afterEach, vi } from "vitest";
import { Repo, type AutomergeUrl, type Chunk, type DocHandle, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import * as channel from "../src/sibling-channel.js";
import { SiblingNetworkAdapter, siblingKelDropsOf, siblingPeerIdOf, standSiblingChannel, type SiblingRefusal } from "../src/sibling-channel.js";
import { wireIdentityOf, type WireIdentity, type WireLegAt } from "../src/wire-identity.js";
import { shareConfigOf } from "../src/federation-gate.js";
import { provisionThresholdRecoveryAtFounding } from "../src/recovery-keel-core.js";
import { recoveryContactRegistrationCard } from "../src/recovery-registration.js";
import { groupSecretOpenerFromSeed } from "../src/persona-group-secret.js";
import type { PersonaKelEvent } from "../src/persona-kel.js";
import { SEEDS, didOf, pubOf, signerOf, enrol, leafOf, memoryRelay } from "./fixtures/sibling-fleet.js";

type Doc = { marks: Record<string, number> };
type Seat = (wire: Pick<WireIdentity, "leg">, adapter: SiblingNetworkAdapter, at: WireLegAt) => SiblingNetworkAdapter;

/** The channel's own seat. A channel that exports none stands bare, as an unseated leg does. */
const seatSiblingLeg: Seat = (channel as { seatSiblingLeg?: Seat }).seatSiblingLeg ?? ((_wire, adapter) => adapter);

class MemoryStore implements StorageAdapterInterface {
  readonly #rows = new Map<string, { key: StorageKey; data: Uint8Array }>();
  async load(key: StorageKey) { return this.#rows.get(key.join("\u0000"))?.data; }
  async save(key: StorageKey, data: Uint8Array) { this.#rows.set(key.join("\u0000"), { key: [...key], data }); }
  async remove(key: StorageKey) { this.#rows.delete(key.join("\u0000")); }
  async loadRange(prefix: StorageKey): Promise<Chunk[]> { return [...this.#rows.values()].filter((r) => prefix.every((p, i) => r.key[i] === p)); }
  async removeRange(prefix: StorageKey) { for (const [name, r] of [...this.#rows]) if (prefix.every((p, i) => r.key[i] === p)) this.#rows.delete(name); }
}

const GROUP_A = "persona-group-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const GROUP_B = "persona-group-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const NEXUS = "9b".repeat(32);
/** The observer's stores both name this one id: one party, met under two faces. */
const OBSERVER_STORE = "observer-store";

/** One face as the fixture founds it: its root, its inception, the vessel's device and the observer's device under it. */
interface Face { readonly group: string; readonly root: Uint8Array; readonly inception: PersonaKelEvent; readonly vesselDevice: Uint8Array; readonly observerDevice: Uint8Array }

async function faceOf(group: string, root: Uint8Array, vesselDevice: Uint8Array, observerDevice: Uint8Array): Promise<Face> {
  const keys = await Promise.all([pubOf(SEEDS.g1), pubOf(SEEDS.g2), pubOf(SEEDS.g3)]);
  const slots = ["mine", "contact-a", "contact-b"] as const;
  const { inception } = provisionThresholdRecoveryAtFounding({
    foundingOpKeyDid: await didOf(root), recoveryContacts: keys.map((k, i) => recoveryContactRegistrationCard(slots[i]!, k, null)), recoveryThreshold: 2,
  });
  return { group, root, inception, vesselDevice, observerDevice };
}
const faceA = (): Promise<Face> => faceOf(GROUP_A, SEEDS.opA, SEEDS.deviceX, SEEDS.deviceY);
const faceB = (): Promise<Face> => faceOf(GROUP_B, SEEDS.opB, SEEDS.deviceZ, SEEDS.deviceW);

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => { for (const down of cleanups.splice(0).reverse()) await down(); });

/** A sibling channel for `device` under `face` over `relay`, as the fixture's leaves stand theirs. */
async function channelOf(face: Face, device: Uint8Array, relay: ReturnType<typeof memoryRelay>, refusals: SiblingRefusal[]): Promise<SiblingNetworkAdapter> {
  const enrolment = await enrol(face.root, device, face.inception.prefix);
  const self = await leafOf(device, enrolment, [face.inception]);
  return new SiblingNetworkAdapter({
    transports: [relay.transportFor(self.deviceKey)], kel: self.kel,
    leaf: (kel) => leafOf(device, enrolment, kel),
    drops: siblingKelDropsOf(relay.drops),
    onRefusal: (r) => refusals.push(r),
  });
}

/** ONE COMPOSITION over the vessel's one store, wearing `worn`. */
function compose(store: StorageAdapterInterface, worn: string | null) {
  const wire = wireIdentityOf({ store, face: worn });
  const repo = new Repo({ storage: wire.storage, peerId: wire.peerId, network: [], shareConfig: shareConfigOf(async () => true) });
  let stood = true;
  const down = async (): Promise<void> => { if (!stood) return; stood = false; await repo.shutdown(); };
  cleanups.push(down);
  return { wire, repo, refusals: [] as SiblingRefusal[], down };
}
type Vessel = ReturnType<typeof compose>;

/** What the observer read of the vessel inside one proven session, and what the vessel read of the observer. */
interface Meeting {
  /** The store id the vessel's metadata names, as the observer's Repo holds it. */
  readonly storageId: string | undefined;
  /** The observer's store id as the vessel's Repo holds it for this sibling. */
  readonly observerStoreAtVessel: string | undefined;
  readonly observer: Repo;
  readonly shared: DocHandle<Doc>;
  readonly refusals: SiblingRefusal[];
}

/** Light `face` on the vessel (its sibling channel, seated) and meet the observer's device under that face. */
async function meet(v: Vessel, face: Face, observerStore: MemoryStore = new MemoryStore(), sharedUrl?: AutomergeUrl): Promise<Meeting> {
  const relay = memoryRelay();
  const vesselKey = await pubOf(face.vesselDevice), observerKey = await pubOf(face.observerDevice);
  await observerStore.save(["storage-adapter-id"], new TextEncoder().encode(OBSERVER_STORE));
  const refusals: SiblingRefusal[] = [];
  const observerChannel = await channelOf(face, face.observerDevice, relay, refusals);
  const observer = new Repo({ storage: observerStore, network: [observerChannel], shareConfig: shareConfigOf(async () => true) });
  observerChannel.bindRepo(observer);
  cleanups.push(() => observer.shutdown());
  const seen: Array<string | undefined> = [];
  observer.networkSubsystem.on("peer", (p) => { if (p.peerId === siblingPeerIdOf(vesselKey, face.inception.prefix)) seen.push(p.peerMetadata.storageId); });
  const atVessel: Array<string | undefined> = [];
  v.repo.networkSubsystem.on("peer", (p) => { if (p.peerId === siblingPeerIdOf(observerKey, face.inception.prefix)) atVessel.push(p.peerMetadata.storageId); });
  const lit = await channelOf(face, face.vesselDevice, relay, v.refusals);
  v.repo.networkSubsystem.addNetworkAdapter(seatSiblingLeg(v.wire, lit, { face: face.group, nexus: NEXUS }));
  lit.bindRepo(v.repo);
  await vi.waitFor(() => { expect(seen.length).toBeGreaterThan(0); expect(atVessel.length).toBeGreaterThan(0); }, { timeout: 10_000 });
  const shared = sharedUrl ? await observer.find<Doc>(sharedUrl) : observer.create<Doc>({ marks: {} });
  return { storageId: seen[0], observerStoreAtVessel: atVessel[0], observer, shared, refusals };
}

/** The vessel writes one mark into the observer's document and the observer reads it: sync crosses the session both ways. */
async function cross(v: Vessel, m: Meeting, mark: string): Promise<void> {
  const handle = await v.repo.find<Doc>(m.shared.url);
  handle.change((d) => { d.marks[mark] = 1; });
  await vi.waitFor(() => { expect(m.shared.doc()!.marks[mark]).toBe(1); }, { timeout: 10_000 });
}

describe("the sibling channel's metadata scopes to the face", () => {
  test("S1 RED: a sibling of two lit faces reads two unrelated store ids, and neither reads the composition's own", async () => {
    const [a, b] = [await faceA(), await faceB()];
    expect(b.inception.prefix).not.toBe(a.inception.prefix);
    const v = compose(new MemoryStore(), GROUP_A);
    const own = await v.wire.storeId();
    const underA = await meet(v, a);
    const underB = await meet(v, b);
    expect(underA.storageId).toMatch(/\S/);
    expect(underB.storageId).toMatch(/\S/);
    expect(underB.storageId, "a sibling of both faces reads one store id inside both sessions").not.toBe(underA.storageId);
    for (const m of [underA, underB]) expect(m.storageId, "a sibling reads the composition's own store id").not.toBe(own);
    // The seat carries sync: the observer reads the vessel's change under each face.
    await cross(v, underA, "a");
    await cross(v, underB, "b");
    expect([...v.refusals, ...underA.refusals, ...underB.refusals]).toEqual([]);
  });

  test("S2 RED: the vessel rests one remote store id under each lit face's own scope, never bare", async () => {
    const [a, b] = [await faceA(), await faceB()];
    const v = compose(new MemoryStore(), GROUP_A);
    const underA = await meet(v, a);
    const underB = await meet(v, b);
    expect(underA.observerStoreAtVessel, "the vessel holds the sibling's store id bare").not.toBe(OBSERVER_STORE);
    expect(underA.observerStoreAtVessel).toContain(OBSERVER_STORE);
    expect(underB.observerStoreAtVessel, "two lit faces key one remote store's sync state alike").not.toBe(underA.observerStoreAtVessel);
  });

  test("S3 CONTROL: one face at one Nexus keeps its store id across a restart and reads back the sync state it rested", async () => {
    const a = await faceA();
    const store = new MemoryStore(), observerStore = new MemoryStore();
    const first = compose(store, GROUP_A);
    const before = await meet(first, a, observerStore);
    await cross(first, before, "a1");
    const key = [before.shared.documentId, "sync-state", before.observerStoreAtVessel!];
    await vi.waitFor(async () => { expect(await first.wire.storage.load(key)).toBeDefined(); }, { timeout: 10_000, interval: 50 });
    await first.repo.flush();
    await before.observer.flush();
    await before.observer.shutdown();
    await first.down();
    const again = compose(store, GROUP_A);
    const after = await meet(again, a, observerStore, before.shared.url);
    expect(after.storageId, "sync resumption keys on the store id: it holds across the restart").toBe(before.storageId);
    expect(after.observerStoreAtVessel, "the local scope a sibling's store rests under holds across the restart").toBe(before.observerStoreAtVessel);
    expect(await again.wire.storage.load(key), "the face reads back the sync state it rested with its sibling").toBeDefined();
    await cross(again, after, "a2");
  });

  test("S4 RED: standSiblingChannel seats the channel it stands for the face and the Nexus it was handed", async () => {
    const a = await faceA();
    const repo = new Repo({ network: [], shareConfig: shareConfigOf(async () => true) });
    cleanups.push(() => repo.shutdown());
    const seats: unknown[] = [];
    const wire: Pick<WireIdentity, "leg"> = { leg: (adapter, seat) => { seats.push(seat); return adapter; } };
    const key = await pubOf(a.vesselDevice);
    const adapter = await standSiblingChannel({
      repo, wire, face: GROUP_A, herms: [], nexusPubkey: NEXUS, personaKelPrefix: a.inception.prefix,
      deviceKey: key, sign: signerOf(a.vesselDevice),
      enrolment: await enrol(a.root, a.vesselDevice, a.inception.prefix),
      open: groupSecretOpenerFromSeed(a.vesselDevice),
      expectedEpoch: () => 0,
    } as Parameters<typeof standSiblingChannel>[0]);
    await adapter.whenReady();
    expect(seats, "the channel joins the Repo unseated").toEqual([{ face: GROUP_A, nexus: NEXUS }]);
  });
});

