/**
 * island-repo — the Automerge Repo-in-island factory.
 *
 * Repo construction + network-adapter wiring is a CRDT concern, so it lives in
 * mesh (the package that owns the automerge dependency and re-exports its
 * vocabulary). Higher layers — the sovereign kernel, the vessels — compose this
 * factory through the mesh facade and never import `@automerge/*` directly.
 *
 * Every island boots its own Repo over a transferred `syncPort` (MessagePort);
 * CRDT sync over that port is the sole delta channel (Island Sovereignty Law).
 */

import { Repo } from "@automerge/automerge-repo";
import { getHeads } from "@automerge/automerge";
import type { PeerId, StorageAdapterInterface } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";

export interface IslandRepoConfig {
  /** Platform storage adapter (NodeFS / IndexedDB); undefined = in-memory. */
  storage?: StorageAdapterInterface;
  /** The transferred MessagePort the island syncs over. */
  syncPort: MessagePort;
  /** Optional single document scope. Other docs are refused at this crossing. */
  documentScope?: string;
  /** Refuse this document while carrying all other documents on the crossing. */
  denyDocument?: string;
  /** The peer ID the vessel's owner named for this island. An island under a session-scoped document view
   *  announces this ID and no other; absent, the Repo names its own. */
  peerId?: string;
}

/** The heads a replica holds of one document, as hex change hashes; empty while the document has not loaded. */
export function replicaHeads(handle: { doc(): unknown }): string[] {
  try {
    const doc = handle.doc();
    return doc ? [...getHeads(doc as Parameters<typeof getHeads>[0])] : [];
  } catch { return []; }
}

function documentIdOf(url: string): string {
  return url.startsWith("automerge:") ? url.slice("automerge:".length) : url;
}

/**
 * Whether one arrival reads as a message the stock message-channel adapter may take. The adapter dereferences an
 * arrival inside its port listener (`"targetId" in message`, `message.type`, `new Uint8Array(message.data)`), and a
 * throw there can end the process that owns the port. So an arrival passes only as a plain object with a string
 * `type` and a string `senderId`; a `targetId` that reads as a string when present; `data` that reads as bytes when
 * present, never as a length; and `peerMetadata` that reads as an object when present. The `type` must name the
 * adapter's own handshake or a message the Repo knows: the Repo prints any other type whole, and a value that
 * cannot print throws inside the same listener.
 */
const SYNC_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  "arrive", "welcome", "leave",
  "sync", "request", "doc-unavailable", "ephemeral", "remote-subscription-change", "remote-heads-changed",
]);

export function readsAsSyncMessage(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return false;
  const m = raw as Record<string, unknown>;
  if (typeof m["type"] !== "string" || !SYNC_MESSAGE_TYPES.has(m["type"]) || typeof m["senderId"] !== "string") return false;
  if ("targetId" in m && m["targetId"] !== undefined && typeof m["targetId"] !== "string") return false;
  const data = m["data"];
  if (data !== undefined && data !== null && !(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) return false;
  const meta = m["peerMetadata"];
  if (meta !== undefined && (typeof meta !== "object" || meta === null || Array.isArray(meta))) return false;
  return true;
}

/**
 * A BROAD SYNC PORT, HARDENED. A worker on a broad port (the daemon island's, a wiki island's) runs code the
 * owner did not write, and whatever that code posts lands in the owner's port listener. This facade stands
 * between the port and the stock adapter: an arrival that does not read as a sync message drops here, named to
 * the sink, and the adapter's listener never sees it. Every other member passes straight through. A session's
 * scoped leg goes further and judges every message through a gate (`gated-sync-leg`).
 */
export function hardenedSyncPort(port: MessagePort, onDropped?: (why: string) => void): MessagePort {
  const facade = {
    addEventListener(type: string, listener: (event: MessageEvent) => void): void {
      if (type !== "message") { port.addEventListener(type as "messageerror", listener as (e: Event) => void); return; }
      port.addEventListener("message", (event: MessageEvent) => {
        if (readsAsSyncMessage(event.data)) { listener(event); return; }
        const shape = event.data === null ? "null" : Array.isArray(event.data) ? "array" : typeof event.data;
        try { onDropped?.(`an arrival that reads as no sync message (${shape}) dropped at the port`); } catch { /* a sink never breaks the leg */ }
      });
    },
    postMessage: (message: unknown, transfer?: Transferable[]): void => port.postMessage(message, transfer ?? []),
    start: (): void => port.start(),
    close: (): void => port.close(),
  };
  return facade as unknown as MessagePort;
}

/** Construct an island's sovereign Repo over its transferred syncPort. */
export function makeIslandRepo(cfg: IslandRepoConfig): Repo {
  return new Repo({
    ...(cfg.storage ? { storage: cfg.storage } : {}),
    ...(cfg.peerId ? { peerId: cfg.peerId as PeerId } : {}),
    network: [new MessageChannelNetworkAdapter(hardenedSyncPort(cfg.syncPort))],
    ...((cfg.documentScope || cfg.denyDocument) ? { shareConfig: {
          announce: async (_peerId, documentId) => cfg.documentScope
            ? documentId === documentIdOf(cfg.documentScope)
            : documentId !== documentIdOf(cfg.denyDocument!),
          access: async (_peerId, documentId) => cfg.documentScope
            ? documentId === documentIdOf(cfg.documentScope)
            : documentId !== documentIdOf(cfg.denyDocument!),
        } } : {}),
  });
}

/**
 * Attach a MessageChannel sync leg to an EXISTING repo (the vessel's main Repo).
 * The vessel keeps the main port; the island receives the transferred peer port.
 * Network-adapter construction is a CRDT concern owned by mesh — callers compose
 * this through the facade rather than importing @automerge/* themselves.
 */
export function attachMessageChannelSync(repo: Repo, mainPort: MessagePort, onPeer?: (peerId: string) => void, onDropped?: (why: string) => void): () => void {
  const adapter = new MessageChannelNetworkAdapter(hardenedSyncPort(mainPort, onDropped));
  if (onPeer) adapter.on("peer-candidate", ({ peerId }) => onPeer(peerId));
  repo.networkSubsystem.addNetworkAdapter(adapter);
  return () => adapter.disconnect();
}
