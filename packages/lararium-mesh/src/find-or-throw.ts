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
  /**
   * THE VESSEL'S OWN ISLAND NAMED THIS DOCUMENT, and stood it before naming it. An island that stands a document at a DERIVED
   * address (`materializeSharedLarDoc`: a realm workbench) asks every peer first, this repo among them, and this repo answers
   * `unavailable` and keeps that answer; the island's push of the stood document then races its reply on another port. So where
   * this repo ALREADY answered the url `unavailable` (the island asked here first), that answer reads as stale: the
   * resolve waits for the island's copy until the bound, and refuses by name (`waitedMs` set) where none arrives. A url this
   * repo was never asked about resolves as any other (an absence still refuses fast), and a `failed` load refuses at once.
   * Never a blank document.
   */
  readonly islandNamed?: boolean;
}

/**
 * This repo already answered `unavailable` for `url` (a peer asked here before it stood the document): the repo's find progress
 * reads that verdict at once, before any new ask. A url never asked reads `loading` here and resolves as any other.
 */
function askedUnavailable(repo: Repo, url: string): boolean {
  try { return repo.findWithProgress(url as AutomergeUrl).peek().state === "unavailable"; } catch { return false; }
}

/** Wait for `url` to read ready, through any `unavailable` sighting, until `timeoutMs`; null where it never does. */
function readyThroughUnavailable(repo: Repo, url: string, timeoutMs: number): Promise<{ handle: DocHandle<LarDoc> | null; failure?: unknown }> {
  const progress = repo.findWithProgress<LarDoc>(url as AutomergeUrl);
  return new Promise((resolve) => {
    let done = false;
    let unsub: (() => void) | undefined;
    const finish = (out: { handle: DocHandle<LarDoc> | null; failure?: unknown }): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsub?.();
      resolve(out);
    };
    // LIVENESS: the island's copy may never arrive; the bound refuses by name.
    const timer = setTimeout(() => finish({ handle: null }), timeoutMs);
    const read = (s: { state: string; handle?: DocHandle<LarDoc>; error?: unknown }): void => {
      if (s.state === "ready" && s.handle) finish({ handle: s.handle });
      else if (s.state === "failed") finish({ handle: null, failure: s.error ?? new Error(`document ${url} failed to load`) });
    };
    unsub = progress.subscribe(read as never);
    read(progress.peek() as never);
  });
}

export async function findOrThrow(repo: Repo, url: string, what: string, opts: FindOrThrowOptions = {}): Promise<DocHandle<LarDoc>> {
  const timeoutMs = opts.timeoutMs ?? DOCUMENT_READY_TIMEOUT_MS;
  const Refusal = opts.refusal ?? DocumentUnavailableRefusal;
  if (opts.islandNamed && askedUnavailable(repo, url)) {
    const { handle, failure } = await readyThroughUnavailable(repo, url, timeoutMs);
    if (handle) return handle;
    throw new Refusal(url, what, failure === undefined ? timeoutMs : null, failure);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failure: unknown;
  try {
    // automerge-repo 2.6: find() resolves only when READY and rejects on unavailable.
    const handle = await Promise.race([
      repo.find<LarDoc>(url as AutomergeUrl).catch((cause: unknown) => { failure = cause; return null; }),
      // LIVENESS: a peer holding the document may never answer; unavailability can settle sooner.
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); }),
    ]);
    if (handle) return handle;
    throw new Refusal(url, what, failure === undefined ? timeoutMs : null, failure);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
