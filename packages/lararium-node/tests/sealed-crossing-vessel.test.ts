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
import { Repo, type AutomergeUrl, type Chunk, type PeerId, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import {
  REST_KINDS, SealedStore, answerDocStoreAsks, composeSealedRest, utf8Bytes, vesselDocStoreDoor,
  type SealedAddress, type SealedStoreRest,
} from "@lararium/mesh";
import { faceProofSubjectRef } from "../../lararium-mesh/src/face-proof-subjects.js";
import { chain, siblingChain } from "../../lararium-mesh/tests/face-proof-fixture.js";
import { FLEET_NEXUS, fleet, type Device } from "../../lararium-keyhive/tests/content-key-fleet.js";

const BAG = "lar:///ha.ka.ba/@test/bags/SEARCH-ME-crossing-notes";
const MARKER = "the-otter-crosses-at-the-second-weir";
const MAGIC = [0x85, 0x6f, 0x4a, 0x83];
const teardown: Array<() => unknown> = [];
afterEach(async () => { while (teardown.length) { try { await teardown.pop()!(); } catch { /* best-effort */ } } });

function memoryAdapter(): StorageAdapterInterface & { readonly bytes: Map<string, Uint8Array> } {
  const bytes = new Map<string, Uint8Array>();
  const name = (key: StorageKey): string => key.join("\u0000");
  const starts = (key: string, prefix: StorageKey): boolean => key.split("\u0000").slice(0, prefix.length).join("\u0000") === name(prefix);
  return {
    bytes,
    async load(key) { const got = bytes.get(name(key)); return got ? Uint8Array.from(got) : undefined; },
    async save(key, data) { bytes.set(name(key), Uint8Array.from(data)); },
    async remove(key) { bytes.delete(name(key)); },
    async loadRange(prefix): Promise<Chunk[]> { return [...bytes].filter(([key]) => starts(key, prefix)).map(([key, data]) => ({ key: key.split("\u0000"), data: Uint8Array.from(data) })); },
    async removeRange(prefix) { for (const key of [...bytes.keys()]) if (starts(key, prefix)) bytes.delete(key); },
  };
}
const holds = (hay: Uint8Array, needle: readonly number[]): boolean => {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) { for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer; return true; }
  return false;
};
const portOf = (p: MessagePort) => {
  teardown.push(() => p.close());
  return {
    post: (msg: unknown) => p.postMessage(msg),
    listen: (cb: (msg: unknown) => void) => { const h = (e: MessageEvent) => cb(e.data); p.addEventListener("message", h as never); p.start(); return () => p.removeEventListener("message", h as never); },
  };
};

/** Every byte one vessel rests: its Repo's rest, its seat's sealed values, and every shelf of its seat's own rest. */
interface Resting { readonly inner: Map<string, Uint8Array>; readonly values: Map<SealedAddress, Uint8Array>; readonly rest: SealedStoreRest }
async function everyByte(r: Resting, documentId: string): Promise<Uint8Array[]> {
  const out = [...r.inner].filter(([key]) => key.startsWith(documentId)).map(([, data]) => data);
  out.push(...r.values.values());
  for (const kind of REST_KINDS) for (const name of await r.rest.list(kind)) { const got = await r.rest.get(kind, name); if (got) out.push(got); }
  return out;
}
/** Does any resting byte spell the marker, or a clear Automerge chunk? */
const spellsClear = (bytes: readonly Uint8Array[]): boolean => bytes.some((b) => holds(b, [...utf8Bytes(MARKER)]) || holds(b, MAGIC));

type Session = { id: string; subject: string };
/** The content-key seat a vessel's island stands, over the rest and values the vessel's island holds. */
type Island = { seat: Device["seat"]; signer: Device["signer"]; values: Map<SealedAddress, Uint8Array>; rest: SealedStoreRest };
const islandOf = (d: Device): Island => ({ seat: d.seat, signer: d.signer, values: d.values, rest: d.rest });

/** One vessel: its Repo over the sealed rest, the door to its island over a real MessageChannel, and its session. */
function vessel(label: string, island: Island, face: string, mapped: ReadonlySet<string>, opts: { inner?: ReturnType<typeof memoryAdapter>; network?: MessageChannelNetworkAdapter[] } = {}) {
  const inner = opts.inner ?? memoryAdapter();
  const opens: Array<{ ok: boolean; refusal?: string }> = [];
  const door = new MessageChannel();
  teardown.push(answerDocStoreAsks(portOf(door.port2), {
    seal: ({ bagId, values, peer }) => island.seat.sealValues({ bagId, values, signer: island.signer, ...(peer !== undefined ? { peer } : {}) }),
    open: async (args) => {
      const out = await island.seat.holder.openValue(args);
      opens.push("refusal" in out ? { ok: false, refusal: out.refusal } : { ok: true });
      return out;
    },
  }));
  const vesselSide = portOf(door.port1);
  const session: Session = { id: `${label}-session`, subject: face };
  let repo: Repo | null = null;
  const rest = composeSealedRest<Session>({
    inner, bagOf: (documentId) => (mapped.has(documentId) ? { bagId: BAG, face } : null), sessionFace: () => face,
    door: vesselDocStoreDoor<Session>(() => vesselSide, { book: () => () => {}, idPrefix: `${label}-door` }),
    flushRepo: async () => { await repo?.flush(); },
  });
  repo = new Repo({ storage: rest.store, network: opts.network ?? [], peerId: `${label}-peer` as PeerId, sharePolicy: async () => true });
  const unwatch = rest.watch(repo, () => session);
  const r = repo;
  teardown.push(async () => { unwatch(); await r.shutdown().catch(() => undefined); });
  const settle = async (): Promise<void> => { await r.flush(); await rest.store.flush(); };
  return { repo: r, rest, inner, session, opens, settle, resting: { inner: inner.bytes, values: island.values, rest: island.rest } satisfies Resting };
}

/** A live sync link between two vessels' Repos, as two awake vessels of one face hold. */
function link(): [MessageChannelNetworkAdapter, MessageChannelNetworkAdapter] {
  const { port1, port2 } = new MessageChannel();
  teardown.push(() => { port1.close(); port2.close(); });
  return [new MessageChannelNetworkAdapter(port1 as never), new MessageChannelNetworkAdapter(port2 as never)];
}
/** What `repo` reads of `url` within a bound: its note, or null where it found nothing it could open. */
async function noteOf(repo: Repo, url: AutomergeUrl, ms = 8_000): Promise<string | null> {
  try {
    const handle = await Promise.race([repo.find<{ note?: string }>(url), new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);
    return handle.doc()?.note ?? null;
  } catch { return null; }
}

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
    const copy = (): ReturnType<typeof memoryAdapter> => { const m = memoryAdapter(); for (const [k, v] of B.inner.bytes) m.bytes.set(k, Uint8Array.from(v)); return m; };
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
