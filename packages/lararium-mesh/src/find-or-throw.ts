/**
 * find-or-throw — the ONE bounded document resolve.
 *
 * automerge-repo's `find()` waits for a document while any peer stays silent. A boot that mounts a named
 * document resolves it through this bounded wait and refuses by name when the document never arrives, so a
 * silent peer never hangs a mount and a missing document never becomes a blank one.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/find-or-throw
 */

import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import type { LarDoc } from "./base-doc.js";

/** How long a silent PEER may take to deliver a named document before a standing caller's resolve refuses. */
export const DOCUMENT_READY_TIMEOUT_MS = 8_000;

/**
 * The bound a BOOT-FATAL mount passes: it names a HANG, never a slow healthy boot. A fresh-corpus boot
 * wedges the main thread and the island for whole seconds, so a flat short bound races it. The value
 * equals the island kernel's hard cap on a slot resolve; no healthy path waits on it.
 */
export const DOCUMENT_HANG_BOUND_MS = 60_000;

/**
 * Which part of the resolve failed. `store`: this vessel's own store was still loading the document when the backstop
 * ended. `peers`: the store answered "not here" and no peer delivered within the bound. `answered`: the library itself
 * reported the document unavailable (every reachable peer said so, or the query failed outright).
 */
export type DocumentUnavailablePhase = "store" | "peers" | "answered";

/** A named document did not arrive within the bounded wait. */
export class DocumentUnavailableRefusal extends Error {
  /** `waitedMs` is the bound that elapsed, or null when the library itself answered unavailable. */
  constructor(
    readonly url: string,
    readonly what: string,
    readonly waitedMs: number | null,
    cause?: unknown,
    readonly phase: DocumentUnavailablePhase = waitedMs === null ? "answered" : "peers",
  ) {
    const how = phase === "answered" ? "was reported unavailable by every reachable peer"
      : phase === "store" ? `is not read yet: this vessel's store was still loading it after ${waitedMs}ms`
      : `is not in this vessel's store and no peer answered within ${waitedMs}ms`;
    const cure = phase === "store" ? "stand the vessel again once its store settles" : "make the document reachable from a peer, then restart";
    super(`[document-unavailable] ${what} unavailable: doc ${url} ${how}; ${cure}.`, { cause });
    this.name = "DocumentUnavailableRefusal";
  }
}

/** A wiki's working slot must resolve to its named CRDT document before it can accept writes. */
export class WorkingDocumentUnavailableRefusal extends DocumentUnavailableRefusal {
  constructor(url: string, what: string, waitedMs: number | null, cause?: unknown, phase?: DocumentUnavailablePhase) {
    super(url, what, waitedMs, cause, phase);
    this.name = "WorkingDocumentUnavailableRefusal";
  }
}

export interface FindOrThrowOptions {
  /** The bound on a silent PEER: it starts once this vessel's store has answered "not here". */
  readonly timeoutMs?: number;
  /** The backstop on a STORE that never answers (a stalled adapter); the store's own answer ends the wait sooner. */
  readonly storeBoundMs?: number;
  /** The refusal class to raise; defaults to {@link DocumentUnavailableRefusal}. */
  readonly refusal?: typeof DocumentUnavailableRefusal;
}

/**
 * A document that rests in this vessel's own store loads from the store, and the library says so: the query's
 * `storage` source stays `pending` until the store answers. The peer bound therefore starts only when the store has
 * answered "not here"; while the store loads, the wait rides the library's own event behind a hang backstop.
 */
export async function findOrThrow(repo: Repo, url: string, what: string, opts: FindOrThrowOptions = {}): Promise<DocHandle<LarDoc>> {
  const peerMs = opts.timeoutMs ?? DOCUMENT_READY_TIMEOUT_MS;
  const storeMs = Math.max(opts.storeBoundMs ?? DOCUMENT_HANG_BOUND_MS, peerMs);
  const Refusal = opts.refusal ?? DocumentUnavailableRefusal;
  const query = repo.findWithProgress<LarDoc>(url as AutomergeUrl);
  const storeLoading = (): boolean => query.peek().sources["storage"] === "pending";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  let failure: unknown;
  try {
    // automerge-repo 2.6: whenReady() resolves only when READY and rejects on unavailable or failed.
    const outcome = await new Promise<DocHandle<LarDoc> | { elapsed: "store" | "peers" } | null>((resolve) => {
      let phase: "store" | "peers" = storeLoading() ? "store" : "peers";
      const arm = (): void => {
        if (timer !== undefined) clearTimeout(timer);
        // LIVENESS: a peer holding the document may never answer, and a store may stall. Each phase carries its own bound.
        timer = setTimeout(() => resolve({ elapsed: phase }), phase === "store" ? storeMs : peerMs);
      };
      arm();
      unsubscribe = query.subscribe(() => {
        if (phase === "store" && !storeLoading()) { phase = "peers"; arm(); }
      });
      query.whenReady().then(resolve, (cause: unknown) => { failure = cause; resolve(null); });
    });
    if (outcome === null) throw new Refusal(url, what, null, failure, "answered");
    if ("elapsed" in outcome) throw new Refusal(url, what, outcome.elapsed === "store" ? storeMs : peerMs, undefined, outcome.elapsed);
    return outcome;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    unsubscribe?.();
  }
}
