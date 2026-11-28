/**
 * lares shore log — the vessel's log as records: one per distinct event (`@lararium/mesh/shore-log`).
 *
 *   lares shore log [kind=<k>] [held=true] [boot=<id>]
 *
 * The vessel folds its console at the source (`vessel-log-sink`): each event's record rests in the worn face's daemon temp
 * layer, where `$:/lares/shore/log` renders it. This reads the same records through the tiddler door's `wiki-filter` over the
 * daemon wiki (`recipe=default`): `kind=` names one kind, `held=true` keeps the records no hand acknowledged (or that recurred
 * past the seq their ack named), `boot=` names one boot's ring.
 *
 * THE FLAT FALLBACK: where no vessel answers (the door dark, the face shut), this reads `run/vessel-live.log` (the live log's
 * closing slice, one record per event) and the month ash older boots folded into (`run/shore-ash/*.jsonl`), and names that it
 * does on its first line. A fallback record carries no ack: every one reads held.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { larRuntimeHome, SHORE_ASH_DIR, VESSEL_LIVE_LOG } from "@lararium/node";
import {
  SHORE_LOG_PREFIX, closingSlice, shoreLogHeld, shoreLogRecordOf,
  type ShoreLogRecord,
} from "@lararium/mesh/shore-log";
import type { ParsedArgs } from "../parse-args.js";
import { emit, exitFor } from "../render.js";
import { verbFailure } from "../verb-call.js";
import { tryDoor, type DoorAnswer } from "./door-call.js";

/** A record as this command reads it: its ack beside it (null where none stands, or on the flat fallback). */
export type ShoreLogRow = ShoreLogRecord & { readonly ack: number | null };

/** The query a line names. */
export interface ShoreLogQuery {
  readonly kind: string | null;
  readonly held: boolean;
  readonly boot: string | null;
}

const RECORD_FIELDS = ["shore-key", "kind", "subject", "severity", "count", "first-seq", "last-seq", "boot", "first-at", "last-at", "ack", "text"] as const;

/** A word a filter operand can carry whole: no bracket, no newline. */
const OPERAND = /^[^\][\n\r]{1,200}$/;

/** The query, or the usage fault that stops it. */
export function shoreLogQuery(args: ParsedArgs): ShoreLogQuery | { readonly usage: string } {
  const kind = args.options["kind"]?.trim() || null;
  const boot = args.options["boot"]?.trim() || null;
  if (kind !== null && !OPERAND.test(kind)) return { usage: `kind= names a kind (no brackets): "${kind}"` };
  if (boot !== null && !/^[0-9a-f]{1,32}$/.test(boot)) return { usage: `boot= names a boot id (hex, as \`lares shore log\` prints it): "${boot}"` };
  return { kind, held: args.flags["held"] === true, boot };
}

/** The filter the door runs in the daemon wiki's engine. */
export function shoreLogFilter(q: ShoreLogQuery): string {
  return `[prefix[${SHORE_LOG_PREFIX}]${q.kind !== null ? `field:kind[${q.kind}]` : ""}${q.boot !== null ? `field:boot[${q.boot}]` : ""}]`;
}

/** The rows a query keeps, newest event change first. */
export function selectShoreLog(rows: readonly ShoreLogRow[], q: ShoreLogQuery): ShoreLogRow[] {
  return rows
    .filter((r) => (q.kind === null || r.kind === q.kind) && (q.boot === null || r.boot === q.boot) && (!q.held || shoreLogHeld(r)))
    .sort((a, b) => (a.boot === b.boot ? b.lastSeq - a.lastSeq : 0));
}

/** The flat fallback: the live log's closing slice and every month's ash, each record held (no ack rides a flat file). */
export function readFlatShoreLog(runDir: string): { readonly rows: ShoreLogRow[]; readonly sources: string[] } {
  const sources: string[] = [];
  const lines: string[] = [];
  const ashDir = join(runDir, SHORE_ASH_DIR);
  if (existsSync(ashDir)) {
    for (const name of readdirSync(ashDir).filter((n) => n.endsWith(".jsonl")).sort()) {
      const path = join(ashDir, name);
      try { lines.push(...readFileSync(path, "utf8").split("\n")); sources.push(path); } catch { /* an unreadable ash reads nothing */ }
    }
  }
  const live = join(runDir, VESSEL_LIVE_LOG);
  if (existsSync(live)) {
    try { lines.push(...readFileSync(live, "utf8").split("\n")); sources.push(live); } catch { /* an unreadable live log reads nothing */ }
  }
  return { rows: closingSlice(lines).map((r) => ({ ...r, ack: null })), sources };
}

/** One row's line. */
export function shoreLogRowLine(r: ShoreLogRow): string {
  const held = shoreLogHeld(r) ? " held" : "";
  const subject = r.subject !== "" ? ` ${r.subject}` : "";
  return `${r.severity.padEnd(5)} ${r.kind}${subject} ×${r.count} seq ${r.firstSeq}..${r.lastSeq} boot ${r.boot}${held}\n      ${r.line}`;
}

/** The counts by kind, most first: the page's first rung. */
export function shoreLogKindCounts(rows: readonly ShoreLogRow[]): Array<{ readonly kind: string; readonly records: number; readonly lines: number }> {
  const by = new Map<string, { records: number; lines: number }>();
  for (const r of rows) { const k = by.get(r.kind) ?? { records: 0, lines: 0 }; k.records++; k.lines += r.count; by.set(r.kind, k); }
  return [...by.entries()].map(([kind, v]) => ({ kind, ...v })).sort((a, b) => b.lines - a.lines || a.kind.localeCompare(b.kind));
}

/** Every record the door answers for a query, page after page; the refusal or fault where the door could not answer. */
async function readThroughDoor(args: ParsedArgs, q: ShoreLogQuery): Promise<{ readonly rows: ShoreLogRow[] } | { readonly dark: string }> {
  const rows: ShoreLogRow[] = [];
  for (let after: string | null = null; ;) {
    let answer: DoorAnswer;
    try {
      answer = await tryDoor(args, { verb: "wiki-filter", args: { recipe: "default", filter: shoreLogFilter(q), fields: [...RECORD_FIELDS], ...(after ? { after } : {}) } });
    } catch (err) {
      return { dark: verbFailure(err).message };
    }
    if (!answer.ok) return { dark: answer.message };
    for (const row of (answer.output["rows"] as Array<{ title: string; fields?: Record<string, string> }> | undefined) ?? []) {
      const rec = shoreLogRecordOf(row.fields ?? {});
      if (rec !== null) rows.push(rec);
    }
    const next = answer.output["next"];
    if (typeof next !== "string" || next === "" || next === after) return { rows };
    after = next;
  }
}

/** `lares shore log`. Exit: 0 read · 2 usage · 3 neither the door nor the flat fallback answered. */
export async function cmdShoreLog(args: ParsedArgs): Promise<number> {
  const q = shoreLogQuery(args);
  if ("usage" in q) {
    emit(args, { ok: false, error: { code: "usage", message: q.usage }, human: () => console.error(`lares shore log: ${q.usage}`) });
    return exitFor("usage");
  }
  const door = await readThroughDoor(args, q);
  let rows: ShoreLogRow[];
  let fallback: { readonly reason: string; readonly sources: readonly string[] } | null = null;
  if ("rows" in door) rows = door.rows;
  else {
    let runDir: string;
    try { runDir = larRuntimeHome(); } catch (err) {
      const message = `no vessel answers (${door.dark}), and the flat fallback names no run dir (${err instanceof Error ? err.message : String(err)})`;
      emit(args, { ok: false, error: { code: "unavailable", message }, human: () => console.error(`lares shore log: ${message}`) });
      return 3;
    }
    const flat = readFlatShoreLog(runDir);
    if (flat.sources.length === 0) {
      const message = `no vessel answers (${door.dark}), and no flat log stands at ${join(runDir, VESSEL_LIVE_LOG)}`;
      emit(args, { ok: false, error: { code: "unavailable", message }, human: () => console.error(`lares shore log: ${message}`) });
      return 3;
    }
    rows = flat.rows;
    fallback = { reason: door.dark, sources: flat.sources };
  }
  const kept = selectShoreLog(rows, q);
  const kinds = shoreLogKindCounts(kept);
  emit(args, {
    ok: true,
    data: { source: fallback === null ? "door" : "flat", ...(fallback ? { fallback } : {}), kinds, records: kept },
    human: () => {
      if (fallback !== null) console.log(`no vessel answers (${fallback.reason}); reading the flat fallback: ${fallback.sources.join(", ")}`);
      if (kept.length === 0) { console.log("no record answers this query"); return; }
      if (q.kind === null) for (const k of kinds) console.log(`${String(k.lines).padStart(7)} line(s) ${String(k.records).padStart(4)} record(s)  ${k.kind}`);
      for (const r of kept) console.log(shoreLogRowLine(r));
    },
  });
  return 0;
}
