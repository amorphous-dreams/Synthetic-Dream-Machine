/**
 * vessel-journal-file — durable vessel journal over jsonl.
 *
 * This module appends each entry as one row and fsyncs before notifying waiters, replays
 * durable rows on open, and compacts oversized files at startup.
 *
 * A torn final line marks an append that never reached its fsync; no waiter ever saw it, so a reopen drops it.
 */

import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, truncateSync, writeFileSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import {
  journalRingBound,
  journalSince,
  resolveJournalWaiters,
  waitForJournalEntry,
  type JournalEntry,
  type JournalKind,
  type VesselJournal,
  type JournalCursor,
  type JournalWaiter,
} from "@lararium/mesh";

const ENTRY_KINDS: ReadonlySet<JournalKind> = new Set(["bag-projected", "verb-receipt"]);

function hasOnlyKeys(obj: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(obj).sort();
  const sorted = [...keys].sort();
  return own.length === sorted.length && own.every((k, i) => k === sorted[i]);
}

function parseEntry(raw: unknown, lineNo: number): JournalEntry {
  if (!raw || typeof raw !== "object") throw new Error(`journal line ${lineNo}: expected object`);
  const row = raw as Record<string, unknown>;
  if (!hasOnlyKeys(row, ["epoch", "seq", "writer", "kind", "data"])) {
    throw new Error(`journal line ${lineNo}: invalid row shape`);
  }
  const epoch = row["epoch"];
  const seq = row["seq"];
  const writer = row["writer"];
  const kindRaw = row["kind"];
  const data = row["data"];
  if (typeof epoch !== "string" || epoch.length === 0) throw new Error(`journal line ${lineNo}: invalid epoch`);
  if (!Number.isInteger(seq) || (seq as number) < 1) throw new Error(`journal line ${lineNo}: invalid seq`);
  if (typeof writer !== "string" || writer.length === 0) throw new Error(`journal line ${lineNo}: invalid writer`);
  if (typeof kindRaw !== "string" || !ENTRY_KINDS.has(kindRaw as JournalKind)) throw new Error(`journal line ${lineNo}: invalid kind`);
  if (!data || typeof data !== "object") throw new Error(`journal line ${lineNo}: invalid data`);
  const kind = kindRaw as JournalKind;
  const payload = data as Record<string, unknown>;
  if (kind === "bag-projected") {
    if (!hasOnlyKeys(payload, ["bagId", "path"])) throw new Error(`journal line ${lineNo}: invalid bag-projected data shape`);
    if (typeof payload["bagId"] !== "string" || typeof payload["path"] !== "string") {
      throw new Error(`journal line ${lineNo}: invalid bag-projected data`);
    }
    return {
      epoch,
      seq: seq as number,
      writer,
      kind,
      data: { bagId: payload["bagId"] as string, path: payload["path"] as string },
    };
  }
  if (!hasOnlyKeys(payload, ["verb", "ok"])) throw new Error(`journal line ${lineNo}: invalid verb-receipt data shape`);
  if (typeof payload["verb"] !== "string" || typeof payload["ok"] !== "boolean") {
    throw new Error(`journal line ${lineNo}: invalid verb-receipt data`);
  }
  return {
    epoch,
    seq: seq as number,
    writer,
    kind,
    data: { verb: payload["verb"] as string, ok: payload["ok"] as boolean },
  };
}

/** A whole row that does not read as an entry refuses by name and drops out of the replay; one damaged row
 * never keeps the daemon from booting over the rows around it. */
function parseEntries(text: string, path: string): readonly JournalEntry[] {
  if (text.trim().length === 0) return [];
  const lines = text.split("\n");
  const out: JournalEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim().length === 0) continue;
    try {
      out.push(parseEntry(JSON.parse(line), i + 1));
    } catch (err) {
      console.warn(`vessel journal ${path}: line ${i + 1} refused and skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}

function trimTornTail(path: string): string {
  if (!existsSync(path)) return "";
  const text = readFileSync(path, "utf8");
  if (text.length === 0 || text.endsWith("\n")) return text;
  const keep = text.lastIndexOf("\n");
  const next = keep >= 0 ? text.slice(0, keep + 1) : "";
  truncateSync(path, Buffer.byteLength(next, "utf8"));
  return next;
}

function rewriteFile(path: string, rows: readonly JournalEntry[]): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  const body = rows.length === 0 ? "" : `${rows.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
  writeFileSync(tmp, body, "utf8");
  const fd = openSync(tmp, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, path);
  try {
    const dirFd = openSync(dirname(path), "r");
    try { fsyncSync(dirFd); }
    finally { closeSync(dirFd); }
  } catch {
    // Some filesystems refuse fsync on directories.
  }
}

export function fileJournal(path: string, epoch: string, writer: string, ringSize?: number): VesselJournal {
  const max = journalRingBound(ringSize);
  const waiters: JournalWaiter[] = [];
  let entries: JournalEntry[] = [];
  let ownSeq = 0;

  const notify = (): void => {
    resolveJournalWaiters(waiters, since);
  };

  const loadFromDisk = (compactOnOpen: boolean): void => {
    const loaded = parseEntries(trimTornTail(path), path);
    const bounded = compactOnOpen && loaded.length > max * 2 ? loaded.slice(loaded.length - max) : loaded;
    if (compactOnOpen && bounded !== loaded) rewriteFile(path, bounded);
    const epochEntries = bounded.filter((entry) => entry.epoch === epoch);
    entries = epochEntries.slice(epochEntries.length > max ? epochEntries.length - max : 0);
    ownSeq = entries.reduce(
      (high, entry) => (entry.writer === writer && entry.seq > high ? entry.seq : high),
      ownSeq,
    );
  };

  const since = (cursor?: JournalCursor): readonly JournalEntry[] => {
    return journalSince(entries, epoch, cursor);
  };

  loadFromDisk(true);

  return {
    append<K extends JournalKind>(kind: K, data: JournalEntry<K>["data"]): JournalEntry<K> {
      const entry = { epoch, seq: ownSeq + 1, writer, kind, data } as JournalEntry<K>;
      mkdirSync(dirname(path), { recursive: true });
      const fd = openSync(path, "a");
      try {
        writeSync(fd, `${JSON.stringify(entry)}\n`);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      ownSeq = entry.seq;
      entries.push(entry);
      if (entries.length > max) entries.splice(0, entries.length - max);
      notify();
      return entry;
    },
    since,
    waitFor(match, cursor) {
      return waitForJournalEntry(waiters, since, match, cursor);
    },
  };
}
