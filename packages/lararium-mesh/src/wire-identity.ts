/**
 * wire-identity — what a vessel's Repo presents at the wire, scoped to the face its composition wears.
 *
 * A Repo names itself to every peer with a peer id and, in its peer metadata, the id of its store. The stock engine
 * mints one store id for a store and keeps it for good, so a vessel that wears face A and later face B over one store
 * would hand both peers the same id, and a peer that met both would join them with no help from timing. The engine also
 * rests, for each document, the sync state it reached with each peer; read back under another face, that state would
 * open the next exchange from the heads the first face reached with that peer, which the peer could match.
 *
 * The invariants:
 *   · ONE STORE ID FOR EACH FACE, AND ONE FOR THE FLOOR. The store keeps an id for each scope it has stood under: the
 *     worn face's, or the veil floor's own. A composition reads and mints only its own scope's id. The same face reads
 *     the same id across a restart, so a peer's rested sync state for this vessel still names it.
 *   · ONE READING MINTS. The engine reads a store's id from more than one place and mints at each on a fresh store, so two
 *     readings could present one id and rest another. Here a scope's id reads or mints once for a composition, and every
 *     later reading answers those bytes.
 *   · A FACE'S SYNC STATE RESTS UNDER THAT FACE. A composition reads back only the sync state its own scope rested.
 *   · A FRESH PEER ID FOR EACH COMPOSITION. A face switch tears the composition down and stands a fresh one; each mints its
 *     peer id from fresh randomness here, by this module's own hand, never by an engine default.
 *   · DOCUMENTS STAY ONE SET. The scope moves the identity alone; every document chunk passes untouched.
 *
 * A scope's name in the store derives from the PersonaGroup by a one-way digest, so the store's own key names hold no
 * group id. The store itself rests vessel-private (it joins a human's faces as every vessel-private record does).
 *
 * Pure but for the store it wraps: no key, no signer, no timer, no clock.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/residency-follows-the-contract#/faces-sit-flat
 */
import type { Chunk, PeerId, StorageAdapterInterface, StorageKey } from "@automerge/automerge-repo";
import { sha256HexSync } from "./crypto.js";
import { WIRE_SCOPE_DOMAIN } from "./domains.js";

/** The face a composition wears (its PersonaGroup), or null at the veil floor; a boot that settles its face late hands a promise. */
export type WornFace = string | null | Promise<string | null>;

/** What a composition hands its Repo: the store that presents the worn scope's id, and this composition's own peer id. */
export interface WireIdentity {
  readonly storage: StorageAdapterInterface;
  readonly peerId: PeerId;
  /** The store id this composition presents in its peer metadata (read, or minted on the scope's first stand). */
  storeId(): Promise<string>;
}

/** The engine's own key for a store's id, and the key segment under which it rests a peer's sync state. */
const STORE_ID = "storage-adapter-id";
const SYNC_STATE = "sync-state";
/** The veil floor's scope: an id of its own that no face shares. */
const FLOOR_SCOPE = "floor";

/** The scope a worn face names in the store: a one-way digest of its PersonaGroup, or the floor's own. */
export function wireScopeOf(face: string | null): string {
  return face === null ? FLOOR_SCOPE : `face-${sha256HexSync(`${WIRE_SCOPE_DOMAIN}\n${face}`).slice(0, 32)}`;
}

/** A fresh store id: a version-4 UUID, as the engine mints, from `getRandomValues` (it stands outside a secure context too). */
function freshStoreId(): string {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** A fresh peer id, shaped as the engine's own (`peer-` and a short base-36 tail) so it marks no house. */
export function freshWirePeerId(): PeerId {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(8));
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return `peer-${n.toString(36)}` as PeerId;
}

/**
 * `store`, read and written under one wire scope. The store id's key and each sync state's key carry the scope; every
 * other key passes as written. A range read answers this scope's rows under the engine's own keys and passes over
 * every other scope's.
 */
export function wireScopedStore(store: StorageAdapterInterface, face: WornFace): StorageAdapterInterface {
  const scope = Promise.resolve(face).then(wireScopeOf);
  // A boot that refuses before its face settles rejects the scope; each act then refuses by that reason, never unhandled here.
  scope.catch(() => {});
  const idKey = (s: string): string => `${STORE_ID}-${s}`;
  const namesStoreId = (key: StorageKey): boolean => key.length === 1 && key[0] === STORE_ID;
  const inward = (key: StorageKey, s: string): StorageKey => {
    if (namesStoreId(key)) return [idKey(s)];
    if (key.length === 3 && key[1] === SYNC_STATE) return [key[0]!, SYNC_STATE, `${s}.${key[2]!}`];
    return key;
  };
  const outward = (chunk: Chunk, s: string): Chunk | null => {
    const key = chunk.key;
    if (key.length === 1 && typeof key[0] === "string" && (key[0] === STORE_ID || key[0].startsWith(`${STORE_ID}-`))) {
      return key[0] === idKey(s) ? { ...chunk, key: [STORE_ID] } : null;
    }
    if (key.length === 3 && key[1] === SYNC_STATE) {
      return key[2]!.startsWith(`${s}.`) ? { ...chunk, key: [key[0]!, SYNC_STATE, key[2]!.slice(s.length + 1)] } : null;
    }
    return chunk;
  };
  // THE SCOPE'S ID, read or minted once for this composition; a reading that refused lets the next one ask again.
  let id: Promise<Uint8Array> | null = null;
  const storeId = (): Promise<Uint8Array> => id ??= (async () => {
    const key = [idKey(await scope)];
    const rested = await store.load(key);
    if (rested !== undefined && rested.length > 0) return rested;
    const minted = new TextEncoder().encode(freshStoreId());
    await store.save(key, minted);
    return minted;
  })().catch((e: unknown) => { id = null; throw e; });
  // A DOCUMENT'S OWN BYTES NEVER WAIT ON THE FACE. Only a key the scope moves (the store id, a sync state) waits for a face
  // that settles late; a document chunk reads and rests at once, so a boot may load and found documents before it knows
  // which face it wears.
  const scoped = (key: StorageKey): boolean => namesStoreId(key) || key[1] === SYNC_STATE || (key.length === 1 && typeof key[0] === "string" && key[0].startsWith(`${STORE_ID}-`));
  return {
    async load(key) {
      if (namesStoreId(key)) return Uint8Array.from(await storeId());
      return store.load(scoped(key) ? inward(key, await scope) : key);
    },
    // The engine saves a store id only where its own read found none, and this store always answers one: such a save lands nothing.
    async save(key, data) { if (!namesStoreId(key)) await store.save(scoped(key) ? inward(key, await scope) : key, data); },
    async remove(key) { await store.remove(scoped(key) ? inward(key, await scope) : key); },
    async loadRange(prefix): Promise<Chunk[]> {
      // A range that names sync state reads this scope's rows; any other range reads documents, and passes over every
      // scope's store id and sync state (the engine reads neither through a document's range).
      if (prefix.length >= 2 && prefix[1] === SYNC_STATE) {
        const s = await scope;
        const out: Chunk[] = [];
        for (const chunk of await store.loadRange(inward(prefix, s))) { const read = outward(chunk, s); if (read !== null) out.push(read); }
        return out;
      }
      return (await store.loadRange(prefix)).filter((chunk) => !scoped(chunk.key));
    },
    // A document's removal takes every scope's sync state of it: the document left this store, for every face.
    async removeRange(prefix) { await store.removeRange(prefix.length >= 3 && scoped(prefix) ? inward(prefix, await scope) : prefix); },
    // THE REPO'S SHUTDOWN CLOSES ITS STORE THROUGH THIS FACE OF IT: a store that holds resources releases them, and a
    // store whose open never answered keeps its close waiting, as it did bare.
    ...(typeof store.close === "function" ? { close: () => store.close!() } : {}),
  };
}

/**
 * THE WIRE IDENTITY OF ONE COMPOSITION: the vessel's store under the worn face's scope, and a fresh peer id. Both vessels
 * stand their Repo on this (`new Repo({ ...wireIdentityOf(…), network, shareConfig })`), so no composition presents an
 * identifier another face's composition presented.
 */
export function wireIdentityOf(input: { readonly store: StorageAdapterInterface; readonly face: WornFace }): WireIdentity {
  const storage = wireScopedStore(input.store, input.face);
  return {
    storage, peerId: freshWirePeerId(),
    storeId: async () => new TextDecoder().decode(await storage.load([STORE_ID])),
  };
}
