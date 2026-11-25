/**
 * sealed-crossing-fixture — vessels of one face as the node composes their sealed rest, short of the daemon boot: each
 * vessel's own Repo over `composeSealedRest`, the document store's door (`vesselDocStoreDoor` ↔ `answerDocStoreAsks`)
 * over a real MessageChannel, and behind the door a content-key seat over its OWN real Keyhive identity
 * (`content-key-fleet`). Two Repos sync live over a MessageChannel, as two awake vessels of one face do.
 *
 * The cross-vessel sealed-bag witness (`sealed-crossing-vessel`) and the selves record's witnesses
 * (persona-selves-sealed#/witnesses) stand on it.
 */
import { Repo, type AutomergeUrl, type Chunk, type PeerId, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { REST_KINDS, type SealedStoreRest } from "@lararium/mesh/sealed-store-rest";
import { answerDocStoreAsks, composeSealedRest, vesselDocStoreDoor, type SealedBag } from "@lararium/mesh/sealed-rest";
import { utf8Bytes } from "@lararium/mesh/crypto";
import { type SealedAddress } from "@lararium/mesh/sealed-chunk";
import type { Device } from "../../lararium-keyhive/tests/content-key-fleet.js";

/** What each test stood, torn down after it (`afterEach(drain)`). */
export const teardown: Array<() => unknown> = [];
export async function drain(): Promise<void> {
  while (teardown.length) { try { await teardown.pop()!(); } catch { /* best-effort */ } }
}

/** The magic bytes every clear Automerge chunk opens with. */
export const MAGIC = [0x85, 0x6f, 0x4a, 0x83] as const;

export type MemoryAdapter = StorageAdapterInterface & { readonly bytes: Map<string, Uint8Array> };
export function memoryAdapter(): MemoryAdapter {
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
export const holds = (hay: Uint8Array, needle: readonly number[]): boolean => {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) { for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer; return true; }
  return false;
};
/** Does any byte spell `text`? */
export const spells = (bytes: readonly Uint8Array[], text: string): boolean => bytes.some((b) => holds(b, [...utf8Bytes(text)]));

const portOf = (p: MessagePort) => {
  teardown.push(() => p.close());
  return {
    post: (msg: unknown) => p.postMessage(msg),
    listen: (cb: (msg: unknown) => void) => { const h = (e: MessageEvent) => cb(e.data); p.addEventListener("message", h as never); p.start(); return () => p.removeEventListener("message", h as never); },
  };
};

/** Every byte one vessel rests: its Repo's rest, its seat's sealed values, and every shelf of its seat's own rest. */
export interface Resting { readonly inner: Map<string, Uint8Array>; readonly values: Map<SealedAddress, Uint8Array>; readonly rest: SealedStoreRest }
/** Every byte `r` rests, for one document (`documentId`) or for every document its Repo rests (no id). */
export async function everyByte(r: Resting, documentId?: string): Promise<Uint8Array[]> {
  const out = [...r.inner].filter(([key]) => documentId === undefined || key.startsWith(documentId)).map(([, data]) => data);
  out.push(...r.values.values());
  for (const kind of REST_KINDS) for (const name of await r.rest.list(kind)) { const got = await r.rest.get(kind, name); if (got) out.push(got); }
  return out;
}

export type Session = { id: string; subject: string };
/** The content-key seat a vessel's island stands, over the rest and values the vessel's island holds. */
export type Island = { seat: Device["seat"]; signer: Device["signer"]; values: Map<SealedAddress, Uint8Array>; rest: SealedStoreRest };
export const islandOf = (d: Device): Island => ({ seat: d.seat, signer: d.signer, values: d.values, rest: d.rest });

export interface VesselOptions {
  readonly inner?: MemoryAdapter;
  readonly network?: MessageChannelNetworkAdapter[];
  /** The face this vessel's session wears now; null for a floor no face lights (default: the vessel's face). */
  readonly sessionFace?: string | null;
}

/** One vessel: its Repo over the sealed rest, `bagOf` its bag map, the door to its island over a real MessageChannel. */
export function vessel(label: string, island: Island, face: string, bagOf: (documentId: string) => SealedBag | null, opts: VesselOptions = {}) {
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
  const worn = opts.sessionFace === undefined ? face : opts.sessionFace;
  let repo: Repo | null = null;
  const rest = composeSealedRest<Session>({
    inner, bagOf, sessionFace: () => worn,
    door: vesselDocStoreDoor<Session>(() => vesselSide, { book: () => () => {}, idPrefix: `${label}-door` }),
    flushRepo: async () => { await repo?.flush(); },
  });
  repo = new Repo({ storage: rest.store, network: opts.network ?? [], peerId: `${label}-peer` as PeerId, sharePolicy: async () => true });
  const unwatch = rest.watch(repo, () => (worn === null ? null : session));
  const r = repo;
  teardown.push(async () => { unwatch(); await r.shutdown().catch(() => undefined); });
  const settle = async (): Promise<void> => { await r.flush(); await rest.store.flush(); };
  return { repo: r, rest, inner, session, opens, settle, resting: { inner: inner.bytes, values: island.values, rest: island.rest } satisfies Resting };
}
export type Vessel = ReturnType<typeof vessel>;

/** A live sync link between two vessels' Repos, as two awake vessels of one face hold. */
export function link(): [MessageChannelNetworkAdapter, MessageChannelNetworkAdapter] {
  const { port1, port2 } = new MessageChannel();
  teardown.push(() => { port1.close(); port2.close(); });
  return [new MessageChannelNetworkAdapter(port1 as never), new MessageChannelNetworkAdapter(port2 as never)];
}

/** What `repo` reads of `url` within a bound, through `read`; null where it found nothing it could open. */
export async function readWithin<D, T>(repo: Repo, url: AutomergeUrl, read: (doc: D | undefined) => T | null, ms = 8_000): Promise<T | null> {
  try {
    const handle = await Promise.race([repo.find<D>(url), new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);
    return read(handle.doc());
  } catch { return null; }
}
