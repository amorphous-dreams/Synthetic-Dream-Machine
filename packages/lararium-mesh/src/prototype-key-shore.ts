/**
 * prototype-key-shore — bytes carrying a `__proto__` key refuse BY NAME before the house's doc holds them.
 *
 * Automerge materializes a map key spelled `__proto__` as the materialized object's prototype. A doc that
 * carries one loads under every engine version (3.5.0 refuses only a LOCAL write), so a hostile peer, a
 * Rust peer or any raw-op author can forge `tiddlers.__proto__ = { t: … }` and every bare `tiddlers[t]`
 * would answer a phantom record. The read door (`stored-value.ts`, `ownEntry`) already answers own keys
 * only; this shore refuses the bytes themselves, so the house never holds such a doc at all:
 *
 *   · `syncMessagePrototypeKey` reads a sync message's changes ahead of the Repo: a raw change by its ops,
 *     a document chunk (the form a first sync sends) by loading it into a SCRATCH doc and walking the view.
 *   · `shoreInbound` seats that reading on one network adapter, keeping the adapter's identity (the peer
 *     arrival table keys on it), and drops a poisoned message with a named refusal.
 *   · `assertNoPrototypeKeys` guards a byte-load door (`load` of a snapshot) over the loaded view.
 *
 * A message the shore cannot decode passes to the doors that judge torn bytes; the shore answers only the
 * question it owns. KEEP: it refuses a live hostile form, guarding a live invariant.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/stored-value
 */
import { decodeChange, decodeSyncMessage, load } from "@automerge/automerge";
import { isPrototypeKey, prototypeKeyFault } from "./stored-value.js";
import { PROTOTYPE_KEY_CODE } from "./stored-record.js";
import { VerbRefusal } from "./verb-refusal.js";

export { PROTOTYPE_KEY_CODE } from "./stored-record.js";

/** Where one change or document chunk carries a `__proto__` key, or null where it carries none (or reads as neither). */
export function chunkPrototypeKey(bytes: Uint8Array): string | null {
  try {
    const change = decodeChange(bytes);
    // ONE KEY SET ON EVERY PATH: the change path refuses the three keys the load path and the write doors do.
    const op = change.ops.find((o) => typeof o.key === "string" && isPrototypeKey(o.key));
    return op ? `change ${change.hash} writes a \`${String(op.key)}\` key` : null;
  } catch { /* not a raw change: a document chunk, read below */ }
  try {
    return prototypeKeyFault(load(bytes), "chunk");
  } catch {
    return null;
  }
}

/** Where a sync message's changes carry a `__proto__` key, or null. Undecodable bytes read null: other doors judge them. */
export function syncMessagePrototypeKey(data: Uint8Array): string | null {
  let changes: Uint8Array[];
  try { changes = decodeSyncMessage(data).changes; } catch { return null; }
  for (const chunk of changes) {
    const fault = chunkPrototypeKey(chunk);
    if (fault) return fault;
  }
  return null;
}

/** THE LOAD DOOR'S CHECK: throws a named refusal where a loaded view carries a prototype key. */
export function assertNoPrototypeKeys(doc: unknown, where: string): void {
  const fault = prototypeKeyFault(doc);
  if (fault) throw new VerbRefusal(PROTOTYPE_KEY_CODE, `${PROTOTYPE_KEY_CODE}: ${where}: ${fault} — a by-key map never holds one; the bytes refuse`);
}

/** One message the shore dropped. */
export interface PrototypeKeyRefusal {
  readonly reason:      typeof PROTOTYPE_KEY_CODE;
  readonly detail:      string;
  readonly peerId:      string;
  readonly documentId?: string;
}

interface Emitting { emit(event: string, ...args: unknown[]): boolean }

const SHORED = new WeakSet<object>();

/**
 * Seat the shore on one network adapter: an inbound `sync` or `request` message whose changes carry a
 * `__proto__` key never reaches the Repo's listeners. Every other event passes untouched, so the adapter's
 * peer arrivals and its own listeners read as before. Idempotent per adapter. Answers the adapter.
 */
export function shoreInbound<T extends object>(adapter: T, onRefusal?: (refusal: PrototypeKeyRefusal) => void): T {
  if (SHORED.has(adapter)) return adapter;
  SHORED.add(adapter);
  const target = adapter as unknown as Emitting;
  const emit = target.emit.bind(adapter);
  target.emit = (event: string, ...args: unknown[]): boolean => {
    if (event === "message") {
      const m = args[0] as { type?: unknown; data?: unknown; senderId?: unknown; documentId?: unknown } | undefined;
      if (m && (m.type === "sync" || m.type === "request") && m.data instanceof Uint8Array) {
        const detail = syncMessagePrototypeKey(m.data);
        if (detail) {
          try {
            onRefusal?.({
              reason: PROTOTYPE_KEY_CODE, detail, peerId: String(m.senderId ?? "?"),
              ...(typeof m.documentId === "string" ? { documentId: m.documentId } : {}),
            });
          } catch { /* a sink never breaks the shore */ }
          if (!onRefusal) console.warn(`[prototype-key-shore] ${PROTOTYPE_KEY_CODE}: refused a message from ${String(m.senderId ?? "?")}: ${detail}`);
          return false;
        }
      }
    }
    return emit(event, ...args);
  };
  return adapter;
}

/**
 * THE LOCAL STORAGE SHORE (blind security read B3). A peer's bytes cross `shoreInbound`; a store's own
 * bytes never crossed any shore, and a store written under automerge 3.4.1 (whose LOCAL write seats a
 * `__proto__` key) may hold such a document. So the storage adapter every Repo loads from rides this
 * wrapper: each document chunk it hands back (`load`, `loadRange`) reads through `chunkPrototypeKey`, and a
 * chunk carrying one of the three keys refuses by name (`prototype-key`) rather than materializing. Sync
 * state and other non-document chunks read null and pass. Saves and removes pass untouched. KEEP: a live
 * hostile form. Answers the same adapter shape; idempotent per adapter.
 */
interface StorageLike {
  load(key: string[]): Promise<Uint8Array | undefined>;
  loadRange(keyPrefix: string[]): Promise<Array<{ key: string[]; data: Uint8Array | undefined }>>;
}
const SHORED_STORAGE = new WeakSet<object>();

function refuseChunk(key: readonly string[], data: Uint8Array | undefined): void {
  if (!data || key[1] === "sync-state") return;
  const fault = chunkPrototypeKey(data);
  if (fault) throw new VerbRefusal(PROTOTYPE_KEY_CODE, `${PROTOTYPE_KEY_CODE}: stored chunk ${key.join("/")}: ${fault} — a by-key map never holds one; the store's bytes refuse`);
}

export function shoreStorage<T extends StorageLike>(adapter: T): T {
  if (SHORED_STORAGE.has(adapter)) return adapter;
  const load = adapter.load.bind(adapter);
  const loadRange = adapter.loadRange.bind(adapter);
  adapter.load = async (key) => { const data = await load(key); refuseChunk(key, data); return data; };
  adapter.loadRange = async (prefix) => { const chunks = await loadRange(prefix); for (const c of chunks) refuseChunk(c.key, c.data); return chunks; };
  SHORED_STORAGE.add(adapter);
  return adapter;
}
