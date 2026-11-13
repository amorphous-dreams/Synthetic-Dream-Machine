/**
 * vessel-journal — epoch-scoped journal contracts and in-memory implementation.
 *
 * This module holds the environment-neutral journal contract plus shared cursor/ring/waiter
 * mechanics that durable journals reuse.
 */

export type JournalKind = "bag-projected" | "verb-receipt";

export interface JournalEntry<K extends JournalKind = JournalKind> {
  readonly epoch: string;
  readonly seq: number;
  readonly writer: string;
  readonly kind: K;
  readonly data:
    K extends "bag-projected" ? { readonly bagId: string; readonly path: string } :
    K extends "verb-receipt" ? { readonly verb: string; readonly ok: boolean } :
    never;
}

export interface JournalCursor {
  readonly epoch: string;
  readonly writer: string;
  readonly seq: number;
}

export interface VesselJournal {
  append<K extends JournalKind>(kind: K, data: JournalEntry<K>["data"]): JournalEntry<K>;
  since(cursor?: JournalCursor): readonly JournalEntry[];
  waitFor(
    match: (e: JournalEntry) => boolean,
    cursorOrOptions?: JournalCursor | JournalWaitOptions,
  ): Promise<JournalEntry>;
}

export interface JournalWaiter {
  readonly cursor: JournalCursor | undefined;
  readonly match: (e: JournalEntry) => boolean;
  readonly resolve: (entry: JournalEntry) => void;
  readonly reject: (reason?: unknown) => void;
  readonly signal: AbortSignal | undefined;
  onAbort: (() => void) | undefined;
}

export interface JournalWaitOptions {
  readonly cursor?: JournalCursor;
  readonly signal?: AbortSignal;
}

function asWaitOptions(cursorOrOptions?: JournalCursor | JournalWaitOptions): JournalWaitOptions {
  if (!cursorOrOptions) return {};
  if ("epoch" in cursorOrOptions && "writer" in cursorOrOptions && "seq" in cursorOrOptions) {
    return { cursor: cursorOrOptions };
  }
  return cursorOrOptions;
}

function journalAbortError(): Error {
  const err = new Error("journal wait aborted");
  err.name = "AbortError";
  return err;
}

export function journalRingBound(ringSize: number | undefined): number {
  if (ringSize === undefined) return 4096;
  const floored = Math.floor(ringSize);
  return floored >= 1 ? floored : 1;
}

export function journalAfterCursor(
  entries: readonly JournalEntry[],
  cursor: JournalCursor,
  epoch: string,
): readonly JournalEntry[] {
  if (cursor.epoch !== epoch) return entries;
  const at = entries.findIndex((entry) =>
    entry.epoch === cursor.epoch && entry.writer === cursor.writer && entry.seq === cursor.seq);
  if (at >= 0) return entries.slice(at + 1);
  return entries.filter((entry) => entry.writer === cursor.writer && entry.seq > cursor.seq);
}

export function journalSince(
  entries: readonly JournalEntry[],
  epoch: string,
  cursor?: JournalCursor,
): readonly JournalEntry[] {
  return cursor ? journalAfterCursor(entries, cursor, epoch) : entries.slice();
}

export function waitForJournalEntry(
  waiters: JournalWaiter[],
  since: (cursor?: JournalCursor) => readonly JournalEntry[],
  match: (entry: JournalEntry) => boolean,
  cursorOrOptions?: JournalCursor | JournalWaitOptions,
): Promise<JournalEntry> {
  const opts = asWaitOptions(cursorOrOptions);
  const cursor = opts.cursor;
  if (opts.signal?.aborted) return Promise.reject(journalAbortError());
  const found = since(cursor).find(match);
  if (found) return Promise.resolve(found);
  return new Promise<JournalEntry>((resolve, reject) => {
    const waiter: JournalWaiter = { cursor, match, resolve, reject, signal: opts.signal, onAbort: undefined };
    if (opts.signal) {
      const onAbort = (): void => {
        const at = waiters.indexOf(waiter);
        if (at >= 0) waiters.splice(at, 1);
        reject(journalAbortError());
      };
      opts.signal.addEventListener("abort", onAbort, { once: true });
      waiter.onAbort = onAbort;
    }
    waiters.push(waiter);
  });
}

export function resolveJournalWaiters(
  waiters: JournalWaiter[],
  since: (cursor?: JournalCursor) => readonly JournalEntry[],
): void {
  if (waiters.length === 0) return;
  const unresolved: JournalWaiter[] = [];
  for (const waiter of waiters) {
    const found = since(waiter.cursor).find(waiter.match);
    if (found) {
      if (waiter.signal && waiter.onAbort) waiter.signal.removeEventListener("abort", waiter.onAbort);
      waiter.resolve(found);
    }
    else unresolved.push(waiter);
  }
  waiters.splice(0, waiters.length, ...unresolved);
}

export function memoryJournal(epoch: string, writer: string, ringSize?: number): VesselJournal {
  const max = journalRingBound(ringSize);
  const entries: JournalEntry[] = [];
  const waiters: JournalWaiter[] = [];
  let seq = 0;

  const since = (cursor?: JournalCursor): readonly JournalEntry[] =>
    journalSince(entries, epoch, cursor);

  const notify = (): void => {
    resolveJournalWaiters(waiters, since);
  };

  return {
    append<K extends JournalKind>(kind: K, data: JournalEntry<K>["data"]): JournalEntry<K> {
      const entry = { epoch, writer, seq: ++seq, kind, data } as JournalEntry<K>;
      entries.push(entry);
      if (entries.length > max) entries.splice(0, entries.length - max);
      notify();
      return entry;
    },
    since,
    waitFor(match, cursorOrOptions) {
      return waitForJournalEntry(waiters, since, match, cursorOrOptions);
    },
  };
}
