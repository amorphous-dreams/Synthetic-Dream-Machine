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

/** How long a named document may take to arrive before a standing caller's resolve refuses. */
export const DOCUMENT_READY_TIMEOUT_MS = 8_000;

/**
 * The bound a BOOT-FATAL mount passes: it names a HANG, never a slow healthy boot. A fresh-corpus boot
 * wedges the main thread and the island for whole seconds, so a flat short bound races it. The value
 * equals the island kernel's hard cap on a slot resolve; no healthy path waits on it.
 */
export const DOCUMENT_HANG_BOUND_MS = 60_000;

/** A named document did not arrive within the bounded wait. */
export class DocumentUnavailableRefusal extends Error {
  /** `waitedMs` is the bound that elapsed, or null when every reachable peer reported the document unavailable. */
  constructor(readonly url: string, readonly what: string, readonly waitedMs: number | null, cause?: unknown) {
    const how = waitedMs === null ? "was reported unavailable by every reachable peer" : `never arrived (${waitedMs}ms)`;
    super(`[document-unavailable] ${what} unavailable: doc ${url} ${how}; make the document reachable from a peer, then restart.`, { cause });
    this.name = "DocumentUnavailableRefusal";
  }
}

/** A wiki's working slot must resolve to its named CRDT document before it can accept writes. */
export class WorkingDocumentUnavailableRefusal extends DocumentUnavailableRefusal {
  constructor(url: string, what: string, waitedMs: number | null, cause?: unknown) {
    super(url, what, waitedMs, cause);
    this.name = "WorkingDocumentUnavailableRefusal";
  }
}

export interface FindOrThrowOptions {
  readonly timeoutMs?: number;
  /** The refusal class to raise; defaults to {@link DocumentUnavailableRefusal}. */
  readonly refusal?: typeof DocumentUnavailableRefusal;
}

export async function findOrThrow(repo: Repo, url: string, what: string, opts: FindOrThrowOptions = {}): Promise<DocHandle<LarDoc>> {
  const timeoutMs = opts.timeoutMs ?? DOCUMENT_READY_TIMEOUT_MS;
  const Refusal = opts.refusal ?? DocumentUnavailableRefusal;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failure: unknown;
  try {
    // automerge-repo 2.6: find() resolves only when READY and rejects on unavailable.
    const handle = await Promise.race([
      repo.find<LarDoc>(url as AutomergeUrl).catch((cause: unknown) => { failure = cause; return null; }),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); }),
    ]);
    if (handle) return handle;
    throw new Refusal(url, what, failure === undefined ? timeoutMs : null, failure);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
