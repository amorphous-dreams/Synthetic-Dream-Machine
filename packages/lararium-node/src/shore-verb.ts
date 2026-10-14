/**
 * shore-verb — a person's answers at the disk shore, carried to the projector that holds the mirror.
 *
 * The disk projector surfaces what it will not decide alone: a STANDOFF, where the disk and the records
 * say different things and no rule picks, and a PENDING REMOVAL, where a file vanished from the path its
 * base names. A person reads what stands (`list`) and answers by name. The verb rides `wiki:place-verb`
 * into the island that mounts the projector (`lares shore` sends it through `wiki-act`), and each island
 * answers for the mirrors it holds.
 *
 *   list           look at the disk, then name what stands: each standoff with its key and its states, each
 *                  pending removal, a page at a time (`after` names the page behind, `next` answers its
 *                  cursor); `uris` narrows the answer to named carriers
 *   sense          look at the disk for the named carriers (the watcher sends what vanished or returned)
 *   take-records   take the records' side of one standoff, named by its key
 *   restore        write a vanished file back from the records and pin its base
 *   remove         delete the vanished carrier in the wiki, by the wiki shore's own delete door
 *
 * ONE STANDOFF, TWO DOORS. `take-records` settles a standoff toward the records, and this island's
 * projector performs it: the records' render writes over the file. Its twin, `lares shore take-disk`,
 * settles toward the disk, and no projector performs that: no disk byte reaches a record through the
 * projecting leg. The CLI reads the standoff's states here (`list`, by carrier), proves the key and the
 * file's bytes still name them, and sends the file through the ingest leg with the records the person
 * read as its base, so the gate lands the disk's words only where those records still stand.
 *
 * Every answer names the state the person read: a standoff's key, and for more than one pending removal
 * the count that stood pending. An answer that names a state which moved since takes nothing and says so:
 * no answer ever lands on a state its giver never saw.
 */

import { sha256HexBytesSync } from "@lararium/mesh";
import type { LarDiskProjector } from "./disk-projector.js";

/** The verb an island answers at its disk shore. */
export const SHORE_VERB = "shore";

/** The acts the verb carries. */
export const SHORE_OPS = ["list", "sense", "take-records", "restore", "remove"] as const;
export type ShoreOp = (typeof SHORE_OPS)[number];

/**
 * THE PAGE A LISTING ANSWERS. A verb's outcome carries at most 32 rows of any array and turns a longer one
 * into a count and a sample (`AUDIT_ARRAY_CAP`, `@lararium/tw5` `verb-vm.ts`). A list that named every row in
 * one answer would lose its rows past that cap, so `list` answers a page at a time: at most this many rows,
 * standoffs and pending removals together, and `next`, the cursor of the page behind it.
 */
export const SHORE_LIST_PAGE = 32;

const text = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

type StandoffRow = ReturnType<LarDiskProjector["standing"]>[number];
type PendingRow = ReturnType<LarDiskProjector["pendingRemovals"]>[number];

/**
 * The cursor of one listed row: its kind, its bag and its carrier, spelled as one JSON array, so no two
 * rows share a cursor whatever their names hold. A (bag, carrier) stands in at most one standoff and one
 * pending removal, so the cursor names one row, and the listing orders rows by it, code unit by code unit,
 * so a caller reads a cursor that moves forward page after page.
 */
export function shoreCursorOf(kind: "standoff" | "pending", row: { readonly bagId: string; readonly uri: string }): string {
  return JSON.stringify([kind === "standoff" ? "s" : "p", row.bagId, row.uri]);
}

const byCode = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * What stands for a hand at this island's shore, optionally within one bag and optionally for named
 * carriers alone, one page at a time. The counts name every row that stands, on every page, so a reader
 * knows how many rows its pages owe it. `mark` folds every row that stands (its cursor, and a standoff's
 * key or a pending removal's path), so two pages under one mark read one shore, and a shore that moved
 * between two pages answers another mark, even where its counts held.
 */
export function shoreList(
  projector: LarDiskProjector, bag: string | null = null, uris: readonly string[] | null = null,
  page: { readonly after?: string | null; readonly limit?: number } = {},
): { standoffs: StandoffRow[]; standoffCount: number; pending: PendingRow[]; pendingCount: number; mark: string; next: string | null } {
  const named = (uri: string): boolean => uris === null || uris.includes(uri);
  const standing = projector.standing().filter((s) => (bag === null || s.bagId === bag) && named(s.uri));
  const pendingAll = projector.pendingRemovals().filter((p) => (bag === null || p.bagId === bag) && named(p.uri));
  const rows = [
    ...standing.map((row) => ({ cursor: shoreCursorOf("standoff", row), standoff: row })),
    ...pendingAll.map((row) => ({ cursor: shoreCursorOf("pending", row), pending: row })),
  ].sort((a, b) => byCode(a.cursor, b.cursor));
  const mark = sha256HexBytesSync(new TextEncoder().encode(JSON.stringify(rows.map((r) =>
    ("standoff" in r ? [r.cursor, r.standoff.standoff] : [r.cursor, r.pending.path]))))).slice(0, 24);
  const after = page.after ?? null;
  const limit = Math.max(1, Math.min(page.limit ?? SHORE_LIST_PAGE, SHORE_LIST_PAGE));
  const behind = after === null ? rows : rows.filter((r) => r.cursor > after);
  const taken = behind.slice(0, limit);
  const standoffs: StandoffRow[] = [];
  const pending: PendingRow[] = [];
  for (const r of taken) {
    if ("standoff" in r) standoffs.push(r.standoff);
    else pending.push(r.pending);
  }
  const next = behind.length > taken.length ? taken[taken.length - 1]!.cursor : null;
  return { standoffs, standoffCount: standing.length, pending, pendingCount: pendingAll.length, mark, next };
}

/** The counts alone: what an act that names no rows answers, whatever the shore holds. */
function shoreCounts(projector: LarDiskProjector, bag: string | null): { standoffCount: number; pendingCount: number } {
  const { standoffCount, pendingCount } = shoreList(projector, bag, null, { limit: 1 });
  return { standoffCount, pendingCount };
}

const uriList = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every((u) => typeof u === "string" && u !== "") ? (v as string[]) : null;

/**
 * Answer one shore act against one projector. A refusal comes back as `{ ok: false, refusal, why }` under
 * a stable name; an act that ran comes back `{ ok: true, ... }`.
 */
export async function answerShore(projector: LarDiskProjector, args: Readonly<Record<string, unknown>>): Promise<Record<string, unknown>> {
  const op = text(args["op"]) ?? "list";
  const bag = text(args["bag"]);
  if (op === "list") {
    // WHAT A PERSON READS STANDS TRUE TO THE DISK: the first page looks first, at every carrier that stands
    // in a standoff or a pending removal, so a file a hand put back or edited since reads as it stands, and
    // at every carrier whose file left where its base stands, so a file a hand removed with no watcher
    // running pends by the time the list answers. A later page (`after`, the cursor the page before named)
    // reads the shore that look left; its counts let a reader see a shore that moved between two pages.
    // `uris` narrows the answer to the carriers a door names; the look at the disk stays whole.
    const only = args["uris"] === undefined ? null : uriList(args["uris"]);
    if (args["uris"] !== undefined && only === null) return { ok: false, op, refusal: "shore-answer-incomplete", why: "list names carriers as a list of addresses (`uris`), or none for every carrier" };
    const after = args["after"] === undefined ? null : text(args["after"]);
    if (args["after"] !== undefined && after === null) return { ok: false, op, refusal: "shore-answer-incomplete", why: "list names the page behind by the cursor the page before answered (`after`), or none for the first page" };
    if (after === null) {
      await projector.sense([...new Set([...projector.standing().map((s) => s.uri), ...projector.pendingRemovals().map((p) => p.uri), ...projector.vanished(), ...(only ?? [])])]);
    }
    return { ok: true, op, ...shoreList(projector, bag, only, { after }) };
  }
  if (op === "sense") {
    // No carrier named = every carrier this island mirrors. The answer counts what stands; the rows ride
    // `list`, a page at a time.
    const uris = args["uris"] === undefined ? undefined : uriList(args["uris"]);
    if (uris === null) return { ok: false, op, refusal: "shore-answer-incomplete", why: "sense names carriers as a list of addresses (`uris`), or none for every mirrored carrier" };
    await projector.sense(uris);
    return { ok: true, op, ...shoreCounts(projector, bag) };
  }
  if (op === "restore" || op === "remove") {
    const uris = args["uris"] === undefined ? [] : uriList(args["uris"]);
    const all = args["all"] === true;
    if (uris === null || (all && uris.length > 0)) return { ok: false, op, refusal: "shore-answer-incomplete", why: `${op} names carriers (\`uris\`) or \`all\`, never both` };
    const count = typeof args["count"] === "number" && Number.isInteger(args["count"]) ? args["count"] : undefined;
    // The bag a person named, else the one bag that holds what they named; two bags never fold into one answer.
    const pending = projector.pendingRemovals();
    const bags = [...new Set((all ? pending : pending.filter((p) => uris.includes(p.uri))).map((p) => p.bagId))];
    const target = bag ?? (bags.length === 1 ? bags[0]! : null);
    if (target === null) {
      return bags.length === 0
        ? { ok: false, op, refusal: "not-pending", why: all ? "no carrier stands pending at this island's shore" : `${uris.join(", ")} stand(s) in no pending removal at this island's shore`, count: 0 }
        : { ok: false, op, refusal: "shore-answer-incomplete", why: `pending removals stand in ${bags.length} bags (${bags.join(", ")}); name one with \`bag\`` };
    }
    const answer = await projector.answerRemovals(op, target, { ...(all ? { all: true } : { uris }), ...(count !== undefined ? { count } : {}) });
    // The counts ride beside the rows: past the outcome's row cap the rows stay behind, and the counts still
    // say how many carriers the answer reached and how many it left pending.
    return answer.ok
      ? { ok: true, op, bag: target, done: answer.done, doneCount: answer.done.length, left: answer.left, leftCount: answer.left.length }
      : { ok: false, op, bag: target, refusal: answer.refusal, why: answer.why, ...(answer.count !== undefined ? { count: answer.count } : {}) };
  }
  if (op === "take-records") {
    const uri = text(args["uri"]);
    const key = text(args["key"]);
    if (uri === null || key === null) return { ok: false, op, refusal: "shore-answer-incomplete", why: "take-records names a carrier (`uri`) and the standoff's key (`key`)" };
    // The key names the bag: a person answers by what the alert showed, and the standoff that carries that
    // key in this island names its own mirror.
    const stands = projector.standing().filter((s) => s.uri === uri && (text(args["bag"]) === null || s.bagId === args["bag"]));
    const named = stands.find((s) => s.standoff === key);
    if (named === undefined) {
      return {
        ok: false, op, refusal: stands.length === 0 ? "no-standoff-stands" : "standoff-key-moved",
        why: stands.length === 0
          ? `no standoff stands for ${uri} at this island's shore`
          : `the standoff for ${uri} stands under key ${stands.map((s) => s.standoff).join(", ")}; the answer names ${key}`,
      };
    }
    const answer = await projector.takeRecords(named.bagId, uri, key);
    return answer.took
      ? { ok: true, op, bag: named.bagId, uri, key, took: "records" }
      : { ok: false, op, refusal: "standoff-key-moved", why: answer.why ?? "the states moved while the answer travelled" };
  }
  return { ok: false, op, refusal: "shore-op-unknown", why: `the shore verb carries ${SHORE_OPS.join(", ")}; it names no "${op}"` };
}
