/**
 * journal-expect — a test awaits a vessel's journal entry, never a clock (`docs/pono/mesh-goldens`).
 *
 * `expectEntry` asks the vessel `lares events --wait` from a cursor: the daemon answers the moment an entry of the
 * kind lands, and the harness reads on past entries that do not match until one does. One budget per call only
 * alarms: when it runs out, the error names the kind and the pattern it awaited and carries the vessel's journal
 * tail, so a red names the entry that never came.
 */
import type { LarInstance } from "./instance.js";
import type { JournalCursor, JournalEntry, JournalKind } from "@lararium/mesh";

export interface ExpectEntryRequest {
  readonly kind?: JournalKind;
  readonly match?: (e: JournalEntry) => boolean;
}

export interface ExpectEntryBudget {
  readonly budgetMs?: number;
}

function entriesOf(json: Record<string, unknown> | null | undefined): readonly JournalEntry[] | null {
  if (!json || json["ok"] !== true) return null;
  const data = json["data"] as Record<string, unknown> | undefined;
  return Array.isArray(data?.["entries"]) ? (data["entries"] as JournalEntry[]) : null;
}

const cursorArg = (c: JournalCursor): string => `${c.epoch}:${c.writer}:${c.seq}`;

async function journalTail(vessel: LarInstance): Promise<string> {
  const tail = await vessel.cli(["events", "--json"]);
  return tail.stdout.trim().slice(-4000);
}

export async function expectEntry(
  vessel: LarInstance,
  { kind, match }: ExpectEntryRequest,
  { budgetMs = 60_000 }: ExpectEntryBudget = {},
): Promise<JournalEntry> {
  const awaited = `kind=${kind ?? "any"} pattern=${match ? match.toString() : "any"}`;

  const abortRead = new AbortController();
  const read = async (): Promise<JournalEntry> => {
    let cursor: JournalCursor | undefined;
    for (;;) {
      // Check abort signal between calls
      if (abortRead.signal.aborted) {
        throw new Error(`expectEntry: read loop cancelled for ${awaited}`);
      }
      const args = ["events", "--wait", "--json", ...(kind ? ["--kind", kind] : []), ...(cursor ? ["--since", cursorArg(cursor)] : [])];
      const result = await vessel.cli(args);
      const entries = entriesOf(result.json);
      if (entries === null) {
        throw new Error(`expectEntry: the vessel answered no entries for ${awaited}\n${JSON.stringify(result.json ?? result.stdout)}\njournal tail:\n${await journalTail(vessel)}`);
      }
      for (const e of entries) {
        if (!match || match(e)) return e;
        cursor = { epoch: e.epoch, writer: e.writer, seq: e.seq };
      }
    }
  };

  let alarm: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<never>((_, reject) => {
    alarm = setTimeout(() => {
      abortRead.abort();
      void journalTail(vessel).then(
        (tail) => reject(new Error(`expectEntry: no entry for ${awaited} within its budget\njournal tail:\n${tail}`)),
        () => reject(new Error(`expectEntry: no entry for ${awaited} within its budget`)),
      );
    }, budgetMs);
  });
  try {
    return await Promise.race([read(), budget]);
  } finally {
    clearTimeout(alarm);
  }
}
