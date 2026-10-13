/**
 * view-channel — a session island's two asked gates, carried over the worker's own message channel.
 *
 * An island that stands under a session's scoped document view holds no catalog document and no content
 * store. It ASKS: `view:catalog` for a name, `view:content` for the bytes at an address. The vessel's owner
 * answers each from the session's own view on the same `requestId`. This module holds the island's half: it
 * posts the ask, parks the caller, and settles it when the answer lands. A caller re-checks content bytes
 * against the address it asked for, as it does for bytes from any store.
 *
 * No timer: the owner answers on receipt. An island that tears down settles every parked ask as refused, so
 * no caller outlives its island waiting.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/session-contract#/the-document-view
 */
import { ISLAND_PROTOCOL_VERSION, type IslandToVesselMsg } from "@lararium/mesh";

export interface ViewChannel {
  /** Resolve a catalog name through the session's view: the document, or null when the view refuses. */
  catalog(name: string): Promise<string | null>;
  /** The content at `cid`, or null when the view refuses it or the vessel's store holds none. */
  content(cid: string): Promise<Uint8Array | null>;
  /** Wait until the vessel's owner holds the named heads of every document this island may write. False when
   *  the session's view closed first. An island keeps no store, so it asks this before it tears down. */
  settle(heads: Record<string, string[]>): Promise<boolean>;
  /** Offer an inbound message; true when it carried one of this channel's answers. */
  settleAnswer(raw: unknown): boolean;
  /** Settle every parked ask as refused. */
  close(): void;
}

export function makeViewChannel(post: (msg: IslandToVesselMsg) => void, mintId: () => string = () => crypto.randomUUID()): ViewChannel {
  type Answer = { documentUrl: string | null; bytes: Uint8Array | null; settled: boolean };
  const REFUSED: Answer = { documentUrl: null, bytes: null, settled: false };
  const parked = new Map<string, (answer: Answer) => void>();
  let closed = false;
  const ask = (msg: (requestId: string) => IslandToVesselMsg): Promise<Answer> => {
    if (closed) return Promise.resolve(REFUSED);
    const requestId = mintId();
    return new Promise((resolve) => {
      parked.set(requestId, resolve);
      post(msg(requestId));
    });
  };
  return {
    catalog: async (name) => (await ask((requestId) => ({ schema_version: ISLAND_PROTOCOL_VERSION, type: "view:catalog", requestId, name }))).documentUrl,
    content: async (cid) => (await ask((requestId) => ({ schema_version: ISLAND_PROTOCOL_VERSION, type: "view:content", requestId, cid }))).bytes,
    settle: async (heads) => (await ask((requestId) => ({ schema_version: ISLAND_PROTOCOL_VERSION, type: "view:settle", requestId, heads }))).settled,
    settleAnswer(raw) {
      if (typeof raw !== "object" || raw === null) return false;
      const { type, requestId, documentUrl, bytes, settled } = raw as Record<string, unknown>;
      if (type !== "view:catalog-result" && type !== "view:content-result" && type !== "view:settled") return false;
      const resolve = typeof requestId === "string" ? parked.get(requestId) : undefined;
      if (!resolve) return true;                           // an answer nobody waits for: consumed, ignored
      parked.delete(requestId as string);
      resolve({
        documentUrl: type === "view:catalog-result" && typeof documentUrl === "string" ? documentUrl : null,
        bytes: type === "view:content-result" && bytes instanceof Uint8Array ? bytes : null,
        settled: type === "view:settled" && settled === true,
      });
      return true;
    },
    close() {
      closed = true;
      for (const resolve of parked.values()) resolve(REFUSED);
      parked.clear();
    },
  };
}
