/**
 * wait-handle — resolve a doc at boot without hanging on one the local store has not seen yet.
 *
 * ── THE PROBLEM A BOOT PATH ACTUALLY HAS ────────────────────────────────────────────────────────
 * A vessel opens by resolving a handful of doc URLs. Some of them the local store already holds; some
 * belong to a peer that has not synced yet. Waiting on the second kind hangs the boot; refusing to wait
 * gives a blank fork. Neither answer serves a household whose phone woke before the hearth did.
 *
 * So this races local readiness against a short window, and — the part that carries the whole value —
 * KEEPS THE REMOTE ALIVE AFTER FALLING BACK. When the doc arrives late, it merges into the handle the
 * caller already holds. Boot proceeds immediately; the content lands when it lands.
 *
 * ── WHY IT LIVES IN MESH, AND WHY IT DID NOT ────────────────────────────────────────────────────
 * The keel documents one strategy for both vessels. It ran as two: a node helper that raced and
 * late-merged, and a browser inline that awaited bare and, on rejection, took the fallback and DROPPED
 * THE REMOTE FOREVER. A doc arriving one tick past the window left a blank fork that never reconciled —
 * on a boot path, in the vessel most likely to open before its peer has synced, since a browser holds no
 * store of its own from a previous run of the hearth.
 *
 * Nothing here touches a platform: a `Repo`, a `DocHandle`, and a timer. One implementation, injected by
 * both recipes, so a keel that says "unified" says something a reader can check.
 *
 * ── THE LINE THAT MUST NOT BE DELETED ───────────────────────────────────────────────────────────
 * `progress.whenReady().then(h => fresh.merge(h))` IS the late-merge. Remove it and every call still
 * returns a handle, every boot still completes, and every test that only asserts "a handle came back"
 * still passes — while a peer's content silently never arrives. Its guard reds on exactly that deletion.
 */

import { interpretAsDocumentId, isValidAutomergeUrl, parseAutomergeUrl, type AutomergeUrl, type DocHandle, type DocumentId, type DocumentProgress, type QueryState, type Repo } from "@automerge/automerge-repo";
import { mergeGuarded } from "./prototype-key-shore.js";
import { isVerbRefusal } from "./verb-refusal.js";
import { holdSealedUnopened, markStandIn, openSealed, releaseStandIn, sealedUnopened } from "./automerge-doc-store.js";
import { isIntegrityRefusal } from "./sealed-doc-store.js";

/** Each fallback the late merge reached, by its id, with the id of the document merged into it. An entry lives as long as
 *  its fallback handle: the registry drops it once the handle is collected, so the map holds live stand-ins alone. */
const MERGED_FROM = new Map<string, string>();
const FORGET_MERGE = new FinalizationRegistry<string>((documentId) => { MERGED_FROM.delete(documentId); });
/**
 * The document whose content a fallback carries by a late merge, or undefined. A store that rests a document sealed reads it
 * at a save under the fallback's id, an id its bag map does not name, so the merged content never lands clear there.
 *
 * A BACKSTOP, NOT A ROAD: a Repo that seats its sealed rest (`seatSealedRest`) mints no fallback for a sealed document, so
 * no merge reaches one. It guards a Repo over a sealed store that seats no door.
 */
export function mergedSourceOf(documentId: string): string | undefined { return MERGED_FROM.get(documentId); }

/**
 * THE SEALED REST A REPO STANDS ON, as `waitHandle` asks it: whether a document rests sealed, and the refusal its keyed load
 * ended on. A vessel seats it once, beside its Repo (`seatSealedRest`), so every caller of `waitHandle` over that Repo reads
 * it, whichever bag it resolves for.
 */
export interface SealedRestDoor {
  /** Does the rest hold this document sealed: its bag maps sealed now, it mapped sealed this process, or its rest holds a
   *  sealed value (`SealedRest.restsSealed`)? */
  restsSealed(documentId: string): boolean | Promise<boolean>;
  /** The refusal the document's latest keyed load ended on (`SealedDocumentStore#refusalOf`); absent or null: none named. */
  refusalOf?(documentId: string): string | null;
  /** Move a document's bytes aside on integrity evidence (the probe's quarantine, held across boots); absent: nothing moves. */
  quarantine?(documentId: string, why: string): void;
  /** Told when a sealed document held read-only settles: opened, refused on integrity evidence, or pending. A pending one
   *  whose bytes arrive later (a peer's sync) settles again, `mounted`. */
  onSettled?(settled: SealedSettlement): void;
  /** Why the vessel holds this document back from its engine (a resting engine fall names it in flight), or null. A held
   *  document stands read-only and unread over its own id, never under a writable fallback, until the hand releases it. */
  heldBack?(documentId: string): string | null;
  /**
   * THE MAP BEFORE THE BYTES: a caller that knows the bag a document belongs to names it here before any byte of it moves
   * (`waitHandle`'s `bagId`), so a sealed bag's document the map has not named yet (a sibling's draft, a slot ahead of its
   * announcement) maps sealed from the first byte: it stands held over its own id, never under a clear fallback, and its
   * bytes arriving by sync rest sealed, or wait in memory while the bag's face has not lit, never clear. Answers whether the
   * bag rests sealed (`SealedDocumentStore#nameDocument`); a clear bag names nothing.
   */
  nameDocument?(documentId: string, bagId: string): boolean;
  /**
   * THE ROSTER'S LOCAL HALF: told each document this vessel mints over the Repo (`create`, `import`, `clone`). A mint is born
   * here, never pushed by a peer. A find names nothing by itself: a caller that opens a bag's document names its bag
   * (`waitHandle`, `nameDocumentFor`), and a peer's push reaches the Repo by none of these (`SealedDocumentStore#solicited`).
   */
  solicited?(documentId: string): void;
}

/** How a sealed document held read-only over its own id settled. */
export interface SealedSettlement {
  readonly documentId: string;
  /** `mounted`: the keyed load opened it, and it takes writes over the real id. `degraded`: the load refused on integrity
   *  evidence, and its bytes moved aside. `pending`: the load ended with no integrity evidence (liveness, a foreign face,
   *  custody): no byte moved, and the next boot reads it again. The last two keep it read-only. */
  readonly status: "mounted" | "degraded" | "pending";
  readonly reason?: string;
}

const SEALED_DOORS = new WeakMap<Repo, SealedRestDoor>();
/** Seat the sealed rest `repo` stands on: `waitHandle` over this Repo then mints no writable fallback for a sealed document,
 *  and every document a local caller opens over it reaches the door's roster (`solicited`). */
export function seatSealedRest(repo: Repo, door: SealedRestDoor): void {
  SEALED_DOORS.set(repo, door);
  if (door.solicited !== undefined) hearSolicitations(repo, door.solicited);
}

/** The Repos whose local callers already reach a roster: each is heard once, by the first door seated over it. */
const HEARD = new WeakMap<Repo, (documentId: string) => void>();

/**
 * NAME A DOCUMENT FOR ITS BAG over a seated Repo, outside `waitHandle` (a caller that finds or mints a bag's document by its
 * own road): a sealed bag's document maps sealed from its first byte, a clear bag's joins the clear-name roster. A Repo that
 * seats no sealed rest names nothing. Answers whether the bag rests sealed.
 */
export function nameDocumentFor(repo: Repo, documentId: string, bagId: string): boolean {
  return SEALED_DOORS.get(repo)?.nameDocument?.(documentIdOf(documentId), bagId) ?? false;
}

/**
 * THE REPO'S MINTS NAME WHAT THE VESSEL MADE. Each public door that mints a document (`create`, `import`, `clone`) tells
 * `solicited` the id of the handle it answers. A find names nothing: it opens a document that may belong to a sealed bag the
 * map has not named yet, so only its caller's bag names it (`waitHandle`, `nameDocumentFor`). The Repo's inbound path (a
 * peer's sync, `#ensureQuery`) passes through none of these. A later seat over the same Repo re-points the roster; the
 * surface is wrapped once.
 */
function hearSolicitations(repo: Repo, solicited: (documentId: string) => void): void {
  const first = !HEARD.has(repo);
  HEARD.set(repo, solicited);
  if (!first) return;
  const tell = (id: unknown): void => {
    try { if (typeof id === "string" && id.length > 0) HEARD.get(repo)?.(documentIdOf(id)); } catch { /* a roster's fault never holds a find */ }
  };
  const target = repo as unknown as Record<string, (...args: unknown[]) => unknown>;
  for (const by of ["create", "import", "clone"] as const) {
    const own = target[by];
    if (typeof own !== "function") continue;
    target[by] = function (this: unknown, ...args: unknown[]) {
      const handle = own.call(repo, ...args) as { readonly documentId?: unknown } | undefined;
      tell(handle?.documentId);
      return handle;
    };
  }
}

/** How a sealed document's keyed load ended: it opened, or it refused on integrity evidence, or it ended with none. */
export type SealedLoadEnding<T> =
  | { readonly status: "opened"; readonly handle: DocHandle<T> }
  | { readonly status: "refused"; readonly why: string }
  | { readonly status: "pending"; readonly why: string };

/**
 * Wait for a sealed document's keyed load to end, and read how. ONLY INTEGRITY EVIDENCE READS `refused`: the store names the
 * refusal its load ended on (`refusalOf`), and liveness (no session yet, the rest standing down at a stop), a foreign face,
 * custody, or no named refusal reads `pending`. A load that waits on a session that never stands keeps the promise open.
 */
export function sealedLoadEnding<T>(progress: DocumentProgress<T>, documentId: string, refusalOf?: (documentId: string) => string | null): Promise<SealedLoadEnding<T>> {
  return new Promise((ended) => {
    let done = false;
    const read = (state: QueryState<T>): void => {
      if (done || state.state === "loading") return;
      done = true;
      if (state.state === "ready") { ended({ status: "opened", handle: state.handle }); return; }
      const refusal = refusalOf?.(documentId) ?? null;
      const why = refusal ?? (state.state === "failed" ? state.error.message : "no source could open it");
      ended(isIntegrityRefusal(refusal) ? { status: "refused", why } : { status: "pending", why });
    };
    const unsubscribe = progress.subscribe((state) => { read(state); if (done) unsubscribe(); });
    read(progress.peek());
    if (done) unsubscribe();
  });
}

/**
 * A SEALED DOCUMENT WAITS FOR ITS KEY, NEVER FOR A WINDOW. Past the window it stands read-only over its own id: the handle
 * the keyed load fills, marked a stand-in (it reads unknown) and held unopened (a write into it refuses by name). The load
 * that opens releases both, so writes land under the real id and seal there; one that refuses on integrity evidence moves
 * the bytes aside (`quarantine`); one that ends with none leaves them in place. Either keeps the handle read-only.
 */
function holdSealed<T>(repo: Repo, progress: DocumentProgress<T>, documentId: string, door: SealedRestDoor): DocHandle<T> | null {
  const own = (repo.handles as Record<DocumentId, DocHandle<T> | undefined>)[documentId as DocumentId];
  if (own === undefined) return null;
  markStandIn(own);
  holdSealedUnopened(own, "its keyed load has not opened");
  void sealedLoadEnding(progress, documentId, (id) => door.refusalOf?.(id) ?? null).then((ending) => {
    let settled: SealedSettlement;
    if (ending.status === "opened") {
      releaseStandIn(own);
      openSealed(own);
      settled = { documentId, status: "mounted" };
    } else if (ending.status === "refused") {
      const reason = `sealed: the keyed load refused (${ending.why})`;
      holdSealedUnopened(own, `${reason}; its bytes moved aside`);
      door.quarantine?.(documentId, reason);
      settled = { documentId, status: "degraded", reason };
    } else {
      const reason = `sealed: the keyed load ended with no integrity evidence (${ending.why}); no bytes moved, the next boot reads it again`;
      holdSealedUnopened(own, reason);
      settled = { documentId, status: "pending", reason };
      // BYTES THAT ARRIVE LATER OPEN IT: a document none of whose sources held it (its bytes live on a sibling) reads ready once
      // a peer's sync lands them, through the same sealed rest; the hold then opens over the same id.
      const unsubscribe = progress.subscribe((state) => {
        if (state.state !== "ready" || sealedUnopened(own) === undefined) return;
        unsubscribe();
        releaseStandIn(own);
        openSealed(own);
        try { door.onSettled?.({ documentId, status: "mounted" }); } catch { /* a listener's fault never holds the document */ }
      });
    }
    try { door.onSettled?.(settled); } catch { /* a listener's fault never holds the document */ }
  });
  return own;
}

/** The held-back document's own handle, marked a stand-in and held unopened with the door's reason; null where none holds. */
function heldBackHandle(repo: Repo, url: string): DocHandle<unknown> | null {
  const heldBack = SEALED_DOORS.get(repo)?.heldBack;
  if (heldBack === undefined) return null;
  const documentId = documentIdOf(url);
  const why = heldBack(documentId);
  if (why === null) return null;
  const own = (repo.handles as Record<DocumentId, DocHandle<unknown> | undefined>)[documentId as DocumentId];
  if (own === undefined) return null;
  markStandIn(own);
  holdSealedUnopened(own, why);
  return own;
}

const documentIdOf = (url: string): string =>
  isValidAutomergeUrl(url) ? parseAutomergeUrl(url).documentId : interpretAsDocumentId(url as never);

/** How long local readiness gets before the caller takes a fallback and boot moves on. */
export const LOCAL_READY_MS = 3000;

/**
 * Resolve `url`, or hand back `fallbackFn()`'s handle and merge the real doc into it when it arrives.
 *
 * `readyMs` overrides the window for a test; a caller in a causal island may also shorten it where it
 * knows its own peer is far. Zero and negative read as "do not wait" rather than as an error — a caller
 * asking for no window means it, and the late-merge still stands behind the fallback.
 *
 * `bagId` names the bag the document belongs to; every caller names it. Over a Repo that seats its sealed rest, the document
 * is named for that bag before any byte of it moves (`SealedRestDoor.nameDocument`, the map before the bytes), and so is a
 * fallback it mints: a sealed bag's document maps sealed from its first byte, a clear bag's joins the clear-name roster.
 */
export async function waitHandle<T>(
  repo: Repo,
  url: AutomergeUrl | string,
  bagId: string,
  fallbackFn: () => DocHandle<T>,
  readyMs: number = LOCAL_READY_MS,
): Promise<DocHandle<T>> {
  const door = SEALED_DOORS.get(repo);
  // Only a Repo that seats its sealed rest reads the document's id here.
  const documentId = door === undefined ? null : documentIdOf(String(url));
  // THE MAP BEFORE THE BYTES: named ahead of the find, so a byte that lands in the window (a local read, a peer's sync) already
  // rests by the bag's own class.
  if (door !== undefined && documentId !== null) door.nameDocument?.(documentId, bagId);
  const progress = repo.findWithProgress<T>(url as AutomergeUrl);
  // A HELD-BACK DOCUMENT MOUNTS NO WRITABLE FALLBACK: the storage hands the engine none of its bytes, so it stands read-only
  // and unread over its own id at once, and a write into it refuses naming why; nothing lands under a fresh id.
  const held = heldBackHandle(repo, String(url));
  if (held !== null) return held as DocHandle<T>;
  const ready = await Promise.race([
    progress.whenReady().then((h) => h).catch(() => null),
    // LIVENESS: a peer-held document may never arrive; the fallback can still merge later.
    new Promise<null>((r) => setTimeout(() => r(null), Math.max(0, readyMs))),
  ]);
  if (ready) return ready;

  // A SEALED BAG MOUNTS NO WRITABLE FALLBACK: its document stands read-only over its own id until the keyed load opens it.
  if (door !== undefined && documentId !== null) {
    if (await door.restsSealed(documentId)) {
      const held = holdSealed(repo, progress, documentId, door);
      if (held !== null) return held;
    }
  }

  const fresh = fallbackFn();
  // THE FALLBACK NAMES ITS BAG: a mint stands under the caller's bag, so its class reads by that bag's row, never by a guess.
  door?.nameDocument?.(fresh.documentId, bagId);
  // THE FALLBACK STANDS IN, UNREAD: until the real doc merges, its emptiness says nothing of what the doc holds, so a store
  // over it reads `unknown()` and a delete above it raises a kāpae rather than trusting the blank.
  markStandIn(fresh);
  // The remote stays alive past the fallback. A doc that lands after the window merges into the handle
  // the caller is already using, so a late peer costs latency rather than content.
  progress.whenReady().then((h) => { MERGED_FROM.set(fresh.documentId, h.documentId); FORGET_MERGE.register(fresh, fresh.documentId); mergeGuarded(fresh, h, "waitHandle"); releaseStandIn(fresh); }).catch((e) => { if (isVerbRefusal(e)) console.warn(`[waitHandle] ${(e as Error).message}`); /* else: the remote never came */ });
  return fresh;
}
