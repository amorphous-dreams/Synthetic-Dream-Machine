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
 *   · A FRESH PEER ID FOR EACH COMPOSITION. A MOUNT switch (`vault unlock --face N`) tears the composition down and stands
 *     a fresh one; each mints its peer id from fresh randomness here, by this module's own hand, never by an engine
 *     default. A SESSION switch (`session:switch`) and a sibling's light recompose nothing, so the composition's own
 *     ids stay inside the house: no seated wire leg presents them.
 *   · EACH SEATED WIRE LEG PRESENTS ITS (FACE, NEXUS) ALONE (`leg`, the second cut). A leg seats for the face it serves
 *     and the Nexus it stands at, and presents that pair's ALIAS: a store id derived from a secret the store keeps for
 *     that face's scope (so it holds across a restart, whichever face the composition wears), and a peer id minted for
 *     this composition. Two faces lit in one composition show two unrelated pairs, and one face shows a pair for each
 *     Nexus. The leg rewrites its own words outbound, restores the Repo's own id inbound, and hands the Repo a remote
 *     store id under the local pair's scope, so the sync state one face rested with a peer never opens another face's
 *     exchange with it. A leg holds no alias for a peer its seat does not name, and says nothing to that peer.
 *   · DOCUMENTS STAY ONE SET. The scope moves the identity alone; every document chunk passes untouched.
 *
 * A scope's name in the store derives from the PersonaGroup by a one-way digest, so the store's own key names hold no
 * group id. The store itself rests vessel-private (it joins a human's faces as every vessel-private record does).
 *
 * Pure but for the store it wraps: no key, no signer, no timer, no clock.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/residency-follows-the-contract#/faces-sit-flat
 */
import type { Chunk, PeerId, PeerMetadata, StorageAdapterInterface, StorageKey } from "@automerge/automerge-repo";
import { sha256HexSync } from "./crypto.js";
import { WIRE_ALIAS_DOMAIN, WIRE_SCOPE_DOMAIN } from "./domains.js";

/** The face a composition wears (its PersonaGroup), or null at the veil floor; a boot that settles its face late hands a promise. */
export type WornFace = string | null | Promise<string | null>;

/** The (face, Nexus) one wire leg serves: the local face (its PersonaGroup, or null at the veil floor) and the Nexus the
 *  leg stands at (null where it stands at none). */
export interface WireLegAt { readonly face: string | null; readonly nexus: string | null }

/** A leg's seat: one (face, Nexus) for every peer it meets (a dial), or a reading of the pair for each remote peer (a
 *  gate, which seats many sessions). A reading that answers null names no pair: the leg says nothing to that peer. */
export type WireLegSeat = WireLegAt | ((remote: PeerId) => WireLegAt | null);

/** What one (face, Nexus) presents at the wire in one composition. */
export interface WireAlias {
  /** Minted for this composition: a restart, or a mount switch, mints another. */
  readonly peerId: PeerId;
  /** Derived from the face scope's own secret and the Nexus: it holds across a restart, so a peer's rested sync state resumes. */
  readonly storeId: string;
  /** The local scope a remote store id rests under for this pair; it never leaves the vessel. */
  readonly scope: string;
}

/** Why a leg withheld a word: its seat named no (face, Nexus) for the peer, the pair's alias had not settled, or the word
 *  carries store ids of other peers (the engine's remote-heads gossip, which no vessel arms). */
export type WireLegRefusal = "unseated" | "alias-unsettled" | "store-gossip";

/** What a composition hands its Repo: the store that presents the worn scope's id, and this composition's own peer id. */
export interface WireIdentity {
  readonly storage: StorageAdapterInterface;
  /** The Repo's own peer id. It reaches the house's own islands; every seated wire leg presents an alias (`leg`). */
  readonly peerId: PeerId;
  /** The store id this composition's Repo holds in its peer metadata (read, or minted on the scope's first stand). */
  storeId(): Promise<string>;
  /** The alias `at` presents in this composition: settled once, and every later reading answers it. */
  alias(at: WireLegAt): Promise<WireAlias>;
  /**
   * SEAT ONE WIRE LEG for the (face, Nexus) it serves, before it joins the Repo's network. Answers the adapter.
   * A gate's leg (a seat that reads the pair for each peer) presents an alias only once that pair's alias settled
   * (`alias`), so its composer settles it before the session's first word reaches the adapter.
   */
  leg<T extends object>(adapter: T, seat: WireLegSeat, onRefusal?: (refusal: WireLegRefusal, peerId: string) => void): T;
}

/** The engine's own key for a store's id, and the key segment under which it rests a peer's sync state. */
const STORE_ID = "storage-adapter-id";
const SYNC_STATE = "sync-state";
/** The veil floor's scope: an id of its own that no face shares. */
const FLOOR_SCOPE = "floor";

/** The scope a worn face names in the store: a one-way digest of its PersonaGroup, or the floor's own. */
function wireScopeOf(face: string | null): string {
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

/** `hex` (32 digits or more) shaped as a version-4 UUID, as the engine shapes a store id. */
function uuidShaped(hex: string): string {
  const h = `${hex.slice(0, 12)}4${hex.slice(13, 16)}${"89ab"[parseInt(hex[16]!, 16) & 3]}${hex.slice(17, 32)}`;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const base36Of = (bytes: Uint8Array): string => { let n = 0n; for (const b of bytes) n = (n << 8n) | BigInt(b); return n.toString(36); };
const hexOf = (bytes: Uint8Array): string => [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("");

/** A fresh peer id, shaped as the engine's own (`peer-` and a short base-36 tail) so it marks no house. */
function freshWirePeerId(): PeerId {
  return `peer-${base36Of(globalThis.crypto.getRandomValues(new Uint8Array(8)))}` as PeerId;
}

/** A value the store keeps under one of its own keys, read or minted once for a composition. */
type RestedOnce = (key: string, mint: () => string) => Promise<Uint8Array>;

/**
 * Every reading of a key answers the bytes the first one read or rested, and a reading that refused lets the next one
 * ask again.
 */
function restedOnce(store: StorageAdapterInterface): RestedOnce {
  const held = new Map<string, Promise<Uint8Array>>();
  return (key, mint) => {
    let reading = held.get(key);
    if (reading === undefined) {
      reading = (async () => {
        const rested = await store.load([key]);
        if (rested !== undefined && rested.length > 0) return rested;
        const minted = new TextEncoder().encode(mint());
        await store.save([key], minted);
        return minted;
      })().catch((e: unknown) => { held.delete(key); throw e; });
      held.set(key, reading);
    }
    return reading;
  };
}

/**
 * `store`, read and written under one wire scope. The store id's key and each sync state's key carry the scope; every
 * other key passes as written. A range read answers this scope's rows under the engine's own keys and passes over
 * every other scope's.
 */
function wireScopedStore(store: StorageAdapterInterface, face: WornFace, rested: RestedOnce): StorageAdapterInterface {
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
  const storeId = async (): Promise<Uint8Array> => rested(idKey(await scope), freshStoreId);
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

/** The engine's words that carry store ids of OTHER peers (its remote-heads gossip). No vessel arms that gossip; a leg
 *  passes neither, since each would carry a store id from one leg's scope to another's. */
const STORE_GOSSIP = new Set(["remote-subscription-change", "remote-heads-changed"]);

interface LegMessage { type?: unknown; senderId?: unknown; targetId?: unknown; sessionId?: unknown; peerMetadata?: PeerMetadata }
interface LegAdapter {
  connect(peerId: PeerId, peerMetadata?: PeerMetadata): unknown;
  send(message: LegMessage): void;
  emit(event: string, ...args: unknown[]): boolean;
}

/**
 * THE WIRE IDENTITY OF ONE COMPOSITION: the vessel's store under the worn face's scope, a fresh peer id for the Repo, and
 * the seat of every wire leg (`leg`). Both vessels stand their Repo on this (`new Repo({ ...wireIdentityOf(…), network,
 * shareConfig })`), so no composition presents an identifier another face's composition presented, and no seated leg
 * presents an identifier another (face, Nexus) presents.
 */
export function wireIdentityOf(input: { readonly store: StorageAdapterInterface; readonly face: WornFace }): WireIdentity {
  const rested = restedOnce(input.store);
  const storage = wireScopedStore(input.store, input.face, rested);
  const peerId = freshWirePeerId();
  const pairOf = (at: WireLegAt): string => `${wireScopeOf(at.face)}\n${at.nexus ?? ""}`;
  const settling = new Map<string, Promise<WireAlias>>();
  const settled = new Map<string, WireAlias>();
  /** What a pair's alias keeps beside what it presents: the salt under which a relayed word's author reads to this pair. */
  const salts = new Map<WireAlias, string>();
  const storeIdOf = (own: PeerMetadata, held: WireAlias): PeerMetadata =>
    own.storageId === undefined ? own : { ...own, storageId: held.storeId as NonNullable<PeerMetadata["storageId"]> };
  const alias = (at: WireLegAt): Promise<WireAlias> => {
    const pair = pairOf(at);
    let reading = settling.get(pair);
    if (reading === undefined) {
      reading = (async () => {
        // THE FACE SCOPE'S OWN SECRET: random, kept under the scope's name beside its store id, and never presented. A
        // pair's store id and local scope derive from it and the Nexus, so neither names the face, the secret or the
        // composition's own store id, and two faces' aliases share nothing.
        const secret = new TextDecoder().decode(await rested(`${STORE_ID}-${wireScopeOf(at.face)}.veil`, () => hexOf(globalThis.crypto.getRandomValues(new Uint8Array(32)))));
        const tag = (label: string): string => sha256HexSync(`${WIRE_ALIAS_DOMAIN}\n${label}\n${secret}\n${at.nexus ?? ""}`);
        const made: WireAlias = { peerId: freshWirePeerId(), storeId: uuidShaped(tag("store")), scope: `veil-${tag("scope").slice(0, 32)}` };
        salts.set(made, hexOf(globalThis.crypto.getRandomValues(new Uint8Array(16))));
        settled.set(pair, made);
        return made;
      })().catch((e: unknown) => { settling.delete(pair); throw e; });
      settling.set(pair, reading);
    }
    return reading;
  };

  const leg = <T extends object>(adapter: T, seat: WireLegSeat, onRefusal?: (refusal: WireLegRefusal, peerId: string) => void): T => {
    const target = adapter as unknown as LegAdapter;
    const connect = target.connect.bind(adapter), send = target.send.bind(adapter), emit = target.emit.bind(adapter);
    const fixed = typeof seat === "function" ? null : seat;
    // A GATE'S LEG CONNECTS UNDER A NAME OF ITS OWN, minted here and presented by no pair: the adapter keeps it as its
    // own id, and every word it sends leaves under the alias of the pair its target seats.
    const standIn = freshWirePeerId();
    let ownMetadata: PeerMetadata = {};
    const refuse = (refusal: WireLegRefusal, peer: unknown): void => { try { onRefusal?.(refusal, String(peer ?? "?")); } catch { /* a sink never decides the leg */ } };
    const heldFor = (remote: unknown): WireAlias | null => {
      const at = fixed ?? (typeof remote === "string" && typeof seat === "function" ? seat(remote as PeerId) : null);
      if (at === null) { refuse("unseated", remote); return null; }
      const held = settled.get(pairOf(at)) ?? null;
      if (held === null) refuse("alias-unsettled", remote);
      return held;
    };
    const mine = (id: unknown): boolean => id === peerId || id === standIn;
    /** A relayed word's author and session, as this pair reads them: one name for each author under each pair. */
    const relayed = (held: WireAlias, name: unknown, digits: number): string =>
      BigInt(`0x${sha256HexSync(`${WIRE_ALIAS_DOMAIN}\nrelay\n${salts.get(held) ?? ""}\n${String(name)}`).slice(0, digits)}`).toString(36);

    target.connect = (_repoPeerId, peerMetadata) => {
      ownMetadata = peerMetadata ?? {};
      if (fixed === null) return connect(standIn, {});
      return alias(fixed).then((held) => connect(held.peerId, storeIdOf(ownMetadata, held)));
    };
    target.send = (message) => {
      if (STORE_GOSSIP.has(String(message.type))) { refuse("store-gossip", message.targetId); return; }
      const held = heldFor(message.targetId);
      if (held === null) return;
      let out: LegMessage = message;
      if (mine(message.senderId)) {
        // The Repo's own ephemeral session reads one name under every leg; each pair hears a name of its own.
        out = { ...out, senderId: held.peerId, ...(message.type === "ephemeral" ? { sessionId: relayed(held, message.sessionId, 14) } : {}) };
      } else if (message.type === "ephemeral") {
        // A WORD THE REPO RELAYS keeps its author's name out of this pair's hearing: an island of this house, or a peer
        // on another leg, reads as one stable stranger here and as another under every other pair.
        out = { ...out, senderId: `peer-${relayed(held, message.senderId, 16)}`, sessionId: relayed(held, message.sessionId, 14) };
      }
      if (out.peerMetadata !== undefined) out = { ...out, peerMetadata: storeIdOf(ownMetadata, held) };
      send(out);
    };
    target.emit = (event, ...args) => {
      if (event === "peer-candidate") {
        const arrival = args[0] as { peerId?: unknown; peerMetadata?: PeerMetadata } | undefined;
        const held = heldFor(arrival?.peerId);
        if (held === null) return false;
        const metadata = arrival?.peerMetadata ?? {};
        // THE REMOTE STORE ID RESTS UNDER THIS PAIR'S SCOPE: the Repo keys a peer's sync state on it.
        return emit(event, { ...arrival, peerMetadata: typeof metadata.storageId === "string" ? { ...metadata, storageId: `${held.scope}.${metadata.storageId}` } : metadata });
      }
      if (event === "message") {
        const message = args[0] as LegMessage | undefined;
        if (!message || STORE_GOSSIP.has(String(message.type))) { refuse("store-gossip", message?.senderId); return false; }
        // A direct word names its sender; a relayed ephemeral names its author, whom a gate's seat cannot place.
        const held = heldFor(message.senderId);
        if (held === null) return false;
        return emit(event, message.targetId === held.peerId || message.targetId === standIn ? { ...message, targetId: peerId } : message);
      }
      return emit(event, ...args);
    };
    return adapter;
  };

  return {
    storage, peerId, alias, leg,
    storeId: async () => new TextDecoder().decode(await storage.load([STORE_ID])),
  };
}
