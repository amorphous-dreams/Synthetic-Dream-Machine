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
 *   settle         answer once the projection that landed records cause has run (`lares ingest --apply`
 *                  names each carrier it landed, the hash its records render and the causal heads it landed;
 *                  the word ends when the wiki holds them, or by name when the far side closes first)
 *   take-records   take the records' side of one standoff, named by its key
 *   render         answer the records' render one standoff weighed, named by its key (`take-disk` merges it)
 *   restore        write a vanished file back from the records and pin its base
 *   remove         delete the vanished carrier in the wiki, by the wiki shore's own delete door
 *   census         name every carrier the projector has not settled: each its queue still owes (`pending`) and
 *                  each whose latest reconcile threw (`failed`), after a bounded wait for the queue to drain
 *                  (`lares vessel census`, read before a stop); its first page also names, by path, each file a
 *                  mirror's checkout never tracked (`untracked`, an owed commit) and each checkout git could not
 *                  read (`untrackedUnread`)
 *   flush          write what this island holds in memory to its mirrors now: retry each carrier whose reconcile threw,
 *                  wait (bounded) for the queue to drain, then answer what reached disk (`written`), what did not
 *                  (`unwritten`, each with its state and why) and how many files the flush wrote (`fileWrites`). The
 *                  reconcile gate holds no window, so a flush crests no new wave: it drains what the queue owes now.
 *                  The teardown's flush phase and a fallen engine's exit ask it of every island (`flushEveryShore`);
 *                  `lares shore flush` asks it by hand, through the vessel's own whole-island flush (the custody door's
 *                  `shore-flush` frame), so a hand's flush reaches every island the teardown reaches
 *   drafts         name the drafts the disk side of a carrier's stand-offs loaded (`standoff-drafts.ts`), each with its
 *                  target, its stand-off's key and whether a person kept it; titles alone, never a draft's words
 *   keep-both      a person keeps both sides of one stand-off, named by its key: its drafts stay past its end as parallel
 *                  drafts, and the records' render writes over the file, as `take-records` writes it. A stand-off whose
 *                  file loaded no draft holds nothing to keep, and refuses `no-drafts-to-keep`, naming keep-disk and
 *                  keep-records
 *
 * A LIT SIBLING'S SHORE ANSWERS BY ITS FACE. The daemon island mounts one projector for the worn face and one for each lit
 * sibling (`mountLitFaceProjection`), each over its own root. An act that names `face` (a handle index) answers at that
 * face's projector (`answerShoreSeats`): the worn face's own, or a lit sibling's, so a sibling's standoffs read and answer
 * without wearing it. A face that stands no projection here refuses `face-unprojected` by name. A flush that names no face
 * reaches the worn projector and every lit sibling's, each unwritten row naming its face.
 *
 * SETTLING A STAND-OFF STAYS A HAND ACT. `take-records` and `keep-both` read the asker the vessel's own door read off the
 * line's peer (`ctx.asker`, never a word of the frame): a seat refuses `hand-act-only`, a line whose peer read nothing
 * refuses `hand-unattested`, and each refusal names the command the operator runs at their own terminal. The CLI reads
 * the hand behind its own process first (`readOwnHand`).
 *
 * ONE STANDOFF, TWO DOORS. `take-records` settles a standoff toward the records, and this island's
 * projector performs it: the records' render writes over the file. Its twin, `lares shore take-disk`,
 * settles toward the disk, and no projector performs that: no disk byte reaches a record through the
 * projecting leg. The CLI reads the standoff's states here (`list`, by carrier), proves the key and the
 * file's bytes still name them, and sends the file through the ingest leg with the records the person
 * read as its base, so the gate lands the disk's words only where those records still stand. Where the
 * records moved one slot and the file another, the CLI first reads the render this island weighed under the
 * key (`render`) and merges it with the file against the base's words, slot by slot, so neither edit drowns.
 *
 * Every answer names the state the person read: a standoff's key, and for more than one pending removal
 * the count that stood pending. An answer that names a state which moved since takes nothing and says so:
 * no answer ever lands on a state its giver never saw.
 */

import type { ShutdownEntry } from "./composition-shutdown.js";
import { sha256HexBytesSync } from "@lararium/mesh/crypto";
import type { Hand } from "@lararium/mesh/session-contract";
import { askerRefusal, handRefusalOf } from "./hand-act-gate.js";
import type { LarDiskProjector } from "./disk-projector.js";

/** The verb an island answers at its disk shore. */
export const SHORE_VERB = "shore";

/** The acts that settle a stand-off: a person's hand alone runs them. */
const HAND_OPS: ReadonlySet<string> = new Set(["take-records", "keep-both"]);

/** The acts the verb carries. */
export const SHORE_OPS = ["list", "sense", "settle", "take-records", "render", "restore", "remove", "census", "flush", "drafts", "keep-both"] as const;
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

/** How long a census's first page waits for the projector's queue to drain before it names what still waits. */
export const CENSUS_SETTLE_MS = 5_000;

/** One carrier the projector has not settled, as the census names it: its state, its title and its bag. */
export interface CensusCarrier { readonly state: "pending" | "failed"; readonly uri: string; readonly bagId: string | null }

/** One file a mirror's checkout never tracked, as the census names it: its path and the mirror's bag. */
export interface CensusUntracked { readonly path: string; readonly bagId: string }

/**
 * THE CENSUS: what this island's projector has not settled, a page at a time. The first page (no `after`) waits up
 * to `settleMs` for the queue to drain, so a routine stop reads clean; a page past it reads the state that stands.
 * `drained` says whether the wait saw the queue drain. Rows order by state, then title, code unit by code unit.
 */
export async function shoreCensus(
  projector: LarDiskProjector, after: string | null = null, settleMs = CENSUS_SETTLE_MS,
): Promise<{
  carriers: CensusCarrier[]; carrierCount: number; drained: boolean; next: string | null;
  untracked?: readonly CensusUntracked[]; untrackedUnread?: ReadonlyArray<{ readonly root: string; readonly why: string }>;
}> {
  let drained = true;
  if (after === null) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bound = new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), settleMs); });
    drained = await Promise.race([projector.idle().then(() => true as const), bound]).finally(() => { if (timer) clearTimeout(timer); });
  }
  const { pending, failed } = projector.unsettled();
  const failedUris = new Set(failed.map((f) => f.uri));
  const rows = [
    ...failed.map((f) => ({ state: "failed" as const, ...f })),
    // A carrier whose reconcile threw and waits again reads once, as failed.
    ...pending.filter((p) => !failedUris.has(p.uri)).map((p) => ({ state: "pending" as const, ...p })),
  ].map((row) => ({ cursor: JSON.stringify([row.state, row.uri]), row })).sort((a, b) => byCode(a.cursor, b.cursor));
  const behind = after === null ? rows : rows.filter((r) => r.cursor > after);
  const taken = behind.slice(0, SHORE_LIST_PAGE);
  const next = behind.length > taken.length ? taken[taken.length - 1]!.cursor : null;
  // THE OWED COMMITS ride the first page alone, whole: a file the checkout never tracked, by path.
  const owed = after === null ? projector.untrackedCarriers() : { files: [], unread: [] };
  return {
    carriers: taken.map((r) => r.row), carrierCount: rows.length, drained, next,
    ...(owed.files.length > 0 ? { untracked: owed.files } : {}),
    ...(owed.unread.length > 0 ? { untrackedUnread: owed.unread } : {}),
  };
}

/** One carrier a flush could not write, with its state and why. */
export interface FlushUnwritten { readonly state: "pending" | "failed"; readonly uri: string; readonly bagId: string | null; readonly why: string }

/** What one island's flush answers: what reached disk, what did not and why, and how many files it wrote. */
export interface ShoreFlush {
  readonly written: ReadonlyArray<{ readonly uri: string; readonly bagId: string | null }>;
  readonly writtenCount: number;
  readonly unwritten: readonly FlushUnwritten[];
  readonly unwrittenCount: number;
  readonly fileWrites: number;
  readonly drained: boolean;
}

/**
 * THE FLUSH: write what this island's projector owes its mirrors, now. Each carrier whose reconcile threw marks again (one
 * retry); the queue gets up to `settleMs` to drain; then the answer reads the projector as it stands. A carrier owed before
 * the flush that now neither waits nor fails reads `written`; each still owed reads `unwritten`, with why. Rows ride at most a
 * page each (the outcome's row cap), and the counts name every row.
 */
export async function shoreFlush(projector: LarDiskProjector, settleMs = CENSUS_SETTLE_MS): Promise<ShoreFlush> {
  const owedBefore = projector.unsettled();
  const writesBefore = projector.fileWrites();
  projector.retryFailed();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), settleMs); });
  const drained = await Promise.race([projector.idle().then(() => true as const), bound]).finally(() => { if (timer) clearTimeout(timer); });
  const { pending, failed } = projector.unsettled();
  const left = new Set([...pending, ...failed].map((r) => r.uri));
  const seen = new Set<string>();
  const written = [...owedBefore.failed, ...owedBefore.pending]
    .filter((r) => !left.has(r.uri) && !seen.has(r.uri) && seen.add(r.uri))
    .sort((a, b) => byCode(a.uri, b.uri));
  const failedUris = new Set(failed.map((f) => f.uri));
  const unwritten: FlushUnwritten[] = [
    ...failed.map((f) => ({ state: "failed" as const, ...f, why: "its reconcile threw again on the retry; the file stands as the failure left it" })),
    ...pending.filter((p) => !failedUris.has(p.uri)).map((p) => ({ state: "pending" as const, ...p, why: `the queue still owed it when the ${settleMs}ms wait ended` })),
  ].sort((a, b) => byCode(JSON.stringify([a.state, a.uri]), JSON.stringify([b.state, b.uri])));
  return {
    written: written.slice(0, SHORE_LIST_PAGE), writtenCount: written.length,
    unwritten: unwritten.slice(0, SHORE_LIST_PAGE), unwrittenCount: unwritten.length,
    fileWrites: projector.fileWrites() - writesBefore, drained,
  };
}

/** One island a vessel asks to flush: its name, and the ask that reaches its shore. */
export interface ShoreIslandAsk { readonly island: string; readonly ask: () => Promise<unknown> }

/** One island's part of a vessel-wide flush: its own answer, or why it gave none. */
export type ShoreFlushIsland =
  | ({ readonly island: string; readonly answered: true } & ShoreFlush)
  | { readonly island: string; readonly answered: false; readonly why: string; readonly refusal?: string };

/** What a vessel-wide flush reads: each island that mounts a disk shore, and whether every carrier reached disk. */
export interface ShoreFlushReading {
  readonly islands: readonly ShoreFlushIsland[];
  /** True where every island answered and none left a carrier unwritten. */
  readonly whole: boolean;
}

/** How long a vessel-wide flush waits for one island before it names that island unanswered. */
export const FLUSH_ISLAND_BOUND_MS = 15_000;

/**
 * ASK EVERY ISLAND THAT MOUNTS A DISK SHORE TO FLUSH, each on its own road, side by side. An island that mounts no projection
 * (`no-disk-shore`) drops out of the reading; one that refuses, throws, answers a shape this reader cannot read, or stays
 * silent past `boundMs` reads `answered: false`, by name, and never as written. Nothing here throws.
 */
export async function flushEveryShore(asks: readonly ShoreIslandAsk[], boundMs = FLUSH_ISLAND_BOUND_MS): Promise<ShoreFlushReading> {
  const one = async ({ island, ask }: ShoreIslandAsk): Promise<ShoreFlushIsland | null> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const silent = new Promise<{ readonly silent: true }>((resolve) => { timer = setTimeout(() => resolve({ silent: true }), boundMs); });
    try {
      const answer = await Promise.race([ask(), silent]);
      if (answer !== null && typeof answer === "object" && "silent" in answer && (answer as { silent?: unknown }).silent === true) {
        return { island, answered: false, why: `the island gave no answer within ${boundMs}ms` };
      }
      const o = (answer ?? {}) as Record<string, unknown>;
      if (o["ok"] === false) {
        if (o["refusal"] === "no-disk-shore") return null;
        return { island, answered: false, why: typeof o["why"] === "string" ? o["why"] : "refused, naming no reason", ...(typeof o["refusal"] === "string" ? { refusal: o["refusal"] } : {}) };
      }
      if (!Array.isArray(o["written"]) || !Array.isArray(o["unwritten"]) || typeof o["fileWrites"] !== "number") {
        return { island, answered: false, why: "the island answered no flush (a vessel older than this op)" };
      }
      return {
        island, answered: true,
        written: o["written"] as ShoreFlush["written"], writtenCount: Number(o["writtenCount"] ?? (o["written"] as unknown[]).length),
        unwritten: o["unwritten"] as ShoreFlush["unwritten"], unwrittenCount: Number(o["unwrittenCount"] ?? (o["unwritten"] as unknown[]).length),
        fileWrites: o["fileWrites"] as number, drained: o["drained"] === true,
      };
    } catch (err) {
      const reason = (err as { reason?: unknown } | null)?.reason;
      return { island, answered: false, why: err instanceof Error ? err.message : String(err), ...(typeof reason === "string" ? { refusal: reason } : {}) };
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  const islands = (await Promise.all(asks.map(one))).filter((i): i is ShoreFlushIsland => i !== null);
  return { islands, whole: islands.every((i) => i.answered && i.unwrittenCount === 0) };
}

/**
 * THE TEARDOWN'S SHORE FLUSH, as one entry of the composition's stand-down registry (`shutdownComposition`), in its `flush`
 * phase. Pushed after the Repo's own flush entries it runs ahead of them (the registry stands down in reverse), and always before
 * the `islands` phase stands any island down: so a graceful stop (SIGTERM, a lock, a wear's recompose) writes what every island
 * holds to its mirrors while the islands still stand. Each island that gave no answer, or left carriers unwritten, warns by name.
 */
export function shoreFlushStandDown(flush: () => Promise<ShoreFlushReading>, warn: (line: string) => void = console.warn): ShutdownEntry {
  return { what: "the shore's flush", phase: "flush", down: async () => {
    const reading = await flush();
    for (const part of reading.islands) {
      if (!part.answered) warn(`[lararium] teardown: the shore's flush: the ${part.island} island did not answer: ${part.why}`);
      else if (part.unwrittenCount > 0) warn(`[lararium] teardown: the shore's flush: the ${part.island} island left ${part.unwrittenCount} carrier(s) unwritten`);
    }
  } };
}

/**
 * The faces whose carriers a flush left unwritten, in order: a row that names its face (a lit sibling's) reads that face, and
 * every other unwritten row reads the worn face (`worn`, the daemon's own projector and each resident wiki ride it).
 */
export function shoreStuckFaces(reading: ShoreFlushReading, worn: number | null): number[] {
  const faces = new Set<number>();
  for (const part of reading.islands) {
    if (!part.answered) continue;
    for (const row of part.unwritten) {
      const face = (row as { face?: unknown }).face;
      if (typeof face === "number") faces.add(face);
      else if (worn !== null) faces.add(worn);
    }
    if (part.unwrittenCount > part.unwritten.length && worn !== null) faces.add(worn);
  }
  return [...faces].sort((a, b) => a - b);
}

/** One line per island, for a log: what each flush wrote and what it left. */
export function shoreFlushLines(reading: ShoreFlushReading): string[] {
  if (reading.islands.length === 0) return ["shore flush: no island mounts a disk shore"];
  return reading.islands.map((i) => i.answered
    ? `shore flush: the ${i.island} island wrote ${i.writtenCount} owed carrier(s) (${i.fileWrites} file write(s))`
      + (i.unwrittenCount > 0 ? `; ${i.unwrittenCount} unwritten: ${i.unwritten.map((u) => `${u.uri}${typeof (u as { face?: unknown }).face === "number" ? ` on h${(u as { face?: number }).face}` : ""} (${u.state}: ${u.why})`).join("; ")}` : "")
    : `shore flush: the ${i.island} island did not answer: ${i.refusal !== undefined ? `${i.refusal}: ` : ""}${i.why}`);
}

/**
 * THE SHORE'S SETTLING ACTS, A PERSON'S HAND ALONE (the operator's standing law: a standoff settles only by a person). The
 * socket refuses each from a seat (`shoreHandCode`, read per op), on a session and on a one-shot line alike, whether it rides the
 * `shore` verb itself or `wiki-act` into the active wiki. A seat lists, reads a render and flushes; it never takes a side.
 */
export const SHORE_HAND_OPS: ReadonlySet<string> = new Set(["take-records", "keep-both", "restore", "remove"]);
/** The refusal a seat's settling act reads: the siblings' code, as every hand act answers an AI seat. */
export const SHORE_HAND_CODE = "hand-act-only";

/** The hand code a call's shore op reads, or null where the call settles nothing: per op, never per verb. */
export function shoreHandCode(verb: string, args: unknown): string | null {
  const a = (args ?? {}) as Record<string, unknown>;
  // THE GATE READS THE ROUTING FIELDS AS THE HANDLER DOES (`routing-arg`): a string, or a refusal. An inner verb, an op or an
  // inner argument object of any other shape refuses here, so no wrapping (`verb: ["shore"]`) routes past the gate.
  if (verb === "wiki-act" && ((a["verb"] !== undefined && typeof a["verb"] !== "string") || (a["args"] !== undefined && (typeof a["args"] !== "object" || a["args"] === null || Array.isArray(a["args"]))))) return "routing-arg-malformed";
  // CASE FOLDS, as the routed lookups read a verb (`routedReadOnlyBags`): `SHORE` or `Remove` reach the gate as `shore`/`remove`,
  // so a later case-folding lookup never reopens the gap. A wiki-act nested in a wiki-act refuses outright.
  const inner = verb === "wiki-act" && typeof a["verb"] === "string" ? a["verb"].toLowerCase() : null;
  if (inner === "wiki-act") return "routing-arg-malformed";
  const shore = verb.toLowerCase() === SHORE_VERB ? a : inner === SHORE_VERB ? (a["args"] ?? {}) as Record<string, unknown> : null;
  if (shore === null) return null;
  if (shore["op"] !== undefined && typeof shore["op"] !== "string") return "routing-arg-malformed";
  return typeof shore["op"] === "string" && SHORE_HAND_OPS.has(shore["op"].toLowerCase()) ? SHORE_HAND_CODE : null;
}

/**
 * AN INGEST NO PERSON ASKED RIDES UNATTENDED: a wave a seat or an unread peer sends (`INGEST`, or `wiki-act` carrying one) takes
 * `unattended: true` before it places, whatever it claims, so the gate's no-base verdict stands off and never adopts a file over
 * records that say something else. A stand-off settles by a person, on the ingest leg as at the shore. Answers the args to place.
 */
export function stampUnattendedIngest(verb: string, args: unknown): unknown {
  const a = (args ?? {}) as Record<string, unknown>;
  if (verb === "INGEST") return { ...a, unattended: true };
  if (verb === "wiki-act" && a["verb"] === "INGEST" && typeof a["args"] === "object" && a["args"] !== null && !Array.isArray(a["args"])) {
    return { ...a, args: { ...(a["args"] as Record<string, unknown>), unattended: true } };
  }
  return args;
}

/** The projectors one daemon island holds: the worn face's own, and each lit sibling's by its handle index. */
export interface ShoreSeats {
  /** The worn face's projector, or null where the island mounts none. */
  readonly own: LarDiskProjector | null;
  /** The worn face's handle index, or null where the island names none. */
  readonly worn: number | null;
  /** A lit sibling's projector, or null where that face stands no projection here. */
  readonly lit: (face: number) => LarDiskProjector | null;
  /** The handle index of each lit sibling whose projector stands now. */
  readonly litFaces: () => readonly number[];
}

/**
 * THE DAEMON ISLAND'S SHORE, FACE BY FACE. An act naming `face` answers at that face's projector, the worn one's or a lit
 * sibling's, and its answer names the face; one naming no face answers at the worn projector, except a flush, which reaches
 * the worn projector and every lit sibling's alike and answers as one, each unwritten row naming its face.
 */
export async function answerShoreSeats(seats: ShoreSeats, args: Readonly<Record<string, unknown>>, asker?: Hand): Promise<Record<string, unknown>> {
  const op = text(args["op"]) ?? "list";
  const noShore = { ok: false, refusal: "no-disk-shore", why: "the daemon island mounts no disk projection" };
  if (args["face"] !== undefined) {
    const face = args["face"];
    if (typeof face !== "number" || !Number.isSafeInteger(face) || face < 0) return { ok: false, op, refusal: "face-malformed", why: "`face` names a handle index (a whole number from 0): `lares shore --face 2`" };
    const { face: _face, ...rest } = args;
    const projector = face === seats.worn ? seats.own : seats.lit(face);
    if (projector === null) {
      return { ok: false, op, face, refusal: "face-unprojected", why: `face h${face} stands no projection on this vessel: it stands shut or unlit, or carries no folder (a lit face projects under its own root once it lights with one). \`lares vessel census\` names the faces lit and shut; \`lares vault unlock --face ${face}\` lights a shut one` };
    }
    return { ...(await answerShore(projector, rest, asker)), face };
  }
  if (op !== "flush") return seats.own === null ? noShore : answerShore(seats.own, args, asker);
  // Each projector drains side by side, so the island's answer waits one bounded drain, never one per face.
  const asked: Array<{ readonly face: number | null; readonly projector: LarDiskProjector }> = [];
  if (seats.own !== null) asked.push({ face: seats.worn, projector: seats.own });
  for (const face of seats.litFaces()) {
    const projector = face === seats.worn ? null : seats.lit(face);
    if (projector !== null) asked.push({ face, projector });
  }
  const parts = await Promise.all(asked.map(async ({ face, projector }) => ({ face, flushed: await shoreFlush(projector) })));
  if (parts.length === 0) return noShore;
  const tagged = <T extends object>(face: number | null, rows: readonly T[]): T[] => face === null || face === seats.worn ? [...rows] : rows.map((r) => ({ ...r, face }));
  const written = parts.flatMap((p) => tagged(p.face, p.flushed.written));
  const unwritten = parts.flatMap((p) => tagged(p.face, p.flushed.unwritten));
  return {
    ok: true, op,
    written: written.slice(0, SHORE_LIST_PAGE), writtenCount: parts.reduce((n, p) => n + p.flushed.writtenCount, 0),
    unwritten: unwritten.slice(0, SHORE_LIST_PAGE), unwrittenCount: parts.reduce((n, p) => n + p.flushed.unwrittenCount, 0),
    fileWrites: parts.reduce((n, p) => n + p.flushed.fileWrites, 0), drained: parts.every((p) => p.flushed.drained),
    ...(parts.some((p) => p.face !== seats.worn) ? { faces: parts.map((p) => p.face).filter((f): f is number => f !== null) } : {}),
  };
}

/**
 * Answer one shore act against one projector. A refusal comes back as `{ ok: false, refusal, why }` under
 * a stable name; an act that ran comes back `{ ok: true, ... }`.
 */
export async function answerShore(projector: LarDiskProjector, args: Readonly<Record<string, unknown>>, asker?: Hand): Promise<Record<string, unknown>> {
  const op = text(args["op"]) ?? "list";
  const bag = text(args["bag"]);
  // THE ASKER THE DOOR BOOKED reads as the hand gate's verdict (`askerRefusal`): the socket's cached reading of the peer.
  const unhanded = HAND_OPS.has(op) ? askerRefusal(asker) : null;
  if (unhanded !== null) {
    const line = `lares shore ${op} ${text(args["uri"]) ?? "<uri>"} --key ${text(args["key"]) ?? "<key>"}${bag !== null ? ` --bag ${bag}` : ""}`;
    return { ok: false, op, refusal: unhanded, why: handRefusalOf(unhanded, { act: "settling a stand-off", reads: "peer", line }).message };
  }
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
  if (op === "settle") {
    // THE SETTLE WORD: answer once the projection the named records cause has run (`settled`). A bag that no
    // mirror of this island holds answers at once (`mirrored: false`): this island projects nothing of it.
    // A carrier may name the causal heads its gesture landed (`heads`: a list of head hashes). The word follows
    // them through the view, and it ends by name when the far side closes before they arrive.
    const headsOf = (c: Record<string, unknown>): readonly string[] | null | undefined =>
      c["heads"] === undefined ? undefined : Array.isArray(c["heads"]) && (c["heads"] as unknown[]).every((h) => typeof h === "string" && h !== "") ? (c["heads"] as string[]) : null;
    const carriers = Array.isArray(args["carriers"])
      && (args["carriers"] as unknown[]).every((c) => c !== null && typeof c === "object" && text((c as Record<string, unknown>)["uri"]) !== null && text((c as Record<string, unknown>)["records"]) !== null && headsOf(c as Record<string, unknown>) !== null)
      ? (args["carriers"] as Array<Record<string, unknown>>).map((c) => { const heads = headsOf(c); return { uri: c["uri"] as string, records: c["records"] as string, ...(heads ? { heads } : {}) }; })
      : null;
    if (bag === null || carriers === null) return { ok: false, op, refusal: "shore-answer-incomplete", why: "settle names the bag the records landed in (`bag`) and each carrier with the hash its records render (`carriers`: `{ uri, records, heads? }`, `heads` a list of head hashes)" };
    const answer = await projector.settled(bag, carriers);
    if (!answer.mirrored) return { ok: true, op, bag, mirrored: false, settledCount: 0, elsewhereCount: 0, supersededCount: 0 };
    // Counts ride every answer; the rows of what never settled ride too (the outcome caps them past 32). A
    // carrier a later word took answers too: this word ends, naming it, and claims no projection for it.
    // The rows ride every answer too: the CLI asks in pages under the outcome's row cap and reads each carrier
    // once across islands (`askShore`, lares-cli shore-core.ts).
    const counts = { settledCount: answer.settled.length, elsewhereCount: answer.elsewhere.length, supersededCount: answer.superseded.length, settled: answer.settled, elsewhere: answer.elsewhere, superseded: answer.superseded };
    if (answer.failed.length > 0) {
      return { ok: false, op, bag, refusal: "projection-failed", why: `the reconcile threw for ${answer.failed.length} carrier(s); their files stand as the failure left them`, failed: answer.failed, failedCount: answer.failed.length, ...(answer.stopped.length > 0 ? { stopped: answer.stopped, stoppedCount: answer.stopped.length } : {}), ...counts };
    }
    if (answer.closed.length > 0) {
      return { ok: false, op, bag, refusal: "far-side-closed", why: `the far side closed before the heads of ${answer.closed.length} carrier(s) arrived; their records can no longer come through that link`, closed: answer.closed, closedCount: answer.closed.length, ...(answer.stopped.length > 0 ? { stopped: answer.stopped, stoppedCount: answer.stopped.length } : {}), ...counts };
    }
    return answer.stopped.length > 0
      ? { ok: false, op, bag, refusal: "projector-stopped", why: `the projection stopped before ${answer.stopped.length} carrier(s) settled`, stopped: answer.stopped, stoppedCount: answer.stopped.length, ...counts }
      : { ok: true, op, bag, mirrored: true, ...counts };
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
    // A carrier another bag answers now left this bag's pending set, and the meme still stands: it rides apart.
    return answer.ok
      ? { ok: true, op, bag: target, done: answer.done, doneCount: answer.done.length, left: answer.left, leftCount: answer.left.length, ...(answer.unshadowed.length > 0 ? { unshadowed: answer.unshadowed, unshadowedCount: answer.unshadowed.length } : {}) }
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
  if (op === "render") {
    const uri = text(args["uri"]);
    const key = text(args["key"]);
    if (uri === null || key === null) return { ok: false, op, refusal: "shore-answer-incomplete", why: "render names a carrier (`uri`) and the standoff's key (`key`)" };
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
    const render = projector.standoffRender(named.bagId, uri, key);
    return render === null
      ? { ok: false, op, refusal: "standoff-render-unheld", why: `the standoff for ${uri} holds no text render a merge can read (a sidecar, a pointer or a binary body)` }
      : { ok: true, op, bag: named.bagId, uri, key, records: render.records, text: render.text };
  }
  if (op === "drafts") {
    const uri = text(args["uri"]);
    if (uri === null) return { ok: false, op, refusal: "shore-answer-incomplete", why: "drafts names a carrier (`uri`)" };
    const keeper = projector.standoffKeeper;
    if (keeper === null) return { ok: false, op, refusal: "no-standoff-keeper", why: "this island loads no stand-off as drafts" };
    const drafts = keeper.draftsOf(uri);
    return { ok: true, op, uri, drafts: drafts.slice(0, SHORE_LIST_PAGE), draftCount: drafts.length };
  }
  if (op === "keep-both") {
    const uri = text(args["uri"]);
    const key = text(args["key"]);
    if (uri === null || key === null) return { ok: false, op, refusal: "shore-answer-incomplete", why: "keep-both names a carrier (`uri`) and the standoff's key (`key`)" };
    const keeper = projector.standoffKeeper;
    if (keeper === null) return { ok: false, op, refusal: "no-standoff-keeper", why: "this island loads no stand-off as drafts, so nothing stays to keep; `lares shore keep-records` takes the records' side" };
    const stands = projector.standing().filter((s) => s.uri === uri && (text(args["bag"]) === null || s.bagId === args["bag"]));
    const named = stands.find((s) => s.standoff === key);
    if (named === undefined) {
      return {
        ok: false, op, refusal: stands.length === 0 ? "no-standoff-stands" : "standoff-key-moved",
        why: stands.length === 0 ? `no standoff stands for ${uri} at this island's shore` : `the standoff for ${uri} stands under key ${stands.map((s) => s.standoff).join(", ")}; the answer names ${key}`,
      };
    }
    if (!keeper.draftsOf(uri).some((d) => d.standoff === key)) {
      return {
        ok: false, op, refusal: "no-drafts-to-keep",
        why: `the standoff ${key} of ${uri} loaded no draft of the file's words, so keep-both would keep nothing and write the records over the file; \`lares shore keep-disk ${uri} --key ${key}\` lands the file's words, \`lares shore keep-records ${uri} --key ${key}\` writes the records' render`,
      };
    }
    const kept = await keeper.keep(uri, key);
    const answer = await projector.takeRecords(named.bagId, uri, key);
    return answer.took
      ? { ok: true, op, bag: named.bagId, uri, key, took: "records", kept: kept.slice(0, SHORE_LIST_PAGE), keptCount: kept.length }
      : { ok: false, op, refusal: "standoff-key-moved", why: answer.why ?? "the states moved while the answer travelled", kept: kept.slice(0, SHORE_LIST_PAGE), keptCount: kept.length };
  }
  if (op === "census") {
    const after = args["after"] === undefined ? null : text(args["after"]);
    if (args["after"] !== undefined && after === null) return { ok: false, op, refusal: "shore-answer-incomplete", why: "census names the page behind by the cursor the page before answered (`after`), or none for the first page" };
    return { ok: true, op, ...(await shoreCensus(projector, after)) };
  }
  if (op === "flush") return { ok: true, op, ...(await shoreFlush(projector)) };
  return { ok: false, op, refusal: "shore-op-unknown", why: `the shore verb carries ${SHORE_OPS.join(", ")}; it names no "${op}"` };
}
