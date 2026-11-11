/**
 * shore-core — the two lines every shore act rides: `wiki-act` carrying the `shore` verb into the active
 * wiki's island, and the `shore` verb itself into the daemon island, each answer read whole and the two read
 * as one shore (`askShore`). `lares shore` sends a person's answers through it; `lares watch` sends what it
 * sensed on disk; `lares ingest --apply` asks its settle word.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { larRuntimeHome } from "@lararium/node";
import { summaryOutput, type SubmitResult } from "./verb-result.js";
import { runVerb } from "./verb-call.js";
import { LocalWaitExpired } from "./local-connector.js";

/** The verb the island answers at its disk shore (`@lararium/node` `shore-verb.ts`, `SHORE_VERB`). */
export const SHORE_VERB = "shore";

/** The island's answer to one shore act, read whole. */
export interface ShoreAnswer {
  readonly ok:      boolean;
  readonly output:  Record<string, unknown>;
  readonly refusal: string | null;
  readonly why:     string | null;
  readonly requestId?: string;
}

/** Read a `wiki-act` outcome as the island's shore answer. A verb that failed outright answers as a refusal. */
export function readShoreAnswer(result: SubmitResult): ShoreAnswer {
  if (result.status === "error") {
    return { ok: false, output: {}, refusal: "verb-error", why: result.errorMessage ?? "the daemon refused and named no reason", requestId: result.requestId };
  }
  const output = summaryOutput(result) ?? {};
  const ok = output["ok"] === true;
  return {
    ok, output,
    refusal: ok ? null : typeof output["refusal"] === "string" ? output["refusal"] : "shore-answer-unread",
    why: ok ? null : typeof output["why"] === "string" ? output["why"] : "the island answered in a shape this door cannot read",
    requestId: result.requestId,
  };
}

/** Every row one island's shore listed, read across its pages. */
export interface ShoreListing {
  readonly ok:        true;
  readonly standoffs: ReadonlyArray<Record<string, unknown>>;
  readonly pending:   ReadonlyArray<Record<string, unknown>>;
  readonly requestId?: string;
}

/**
 * READ EVERY PAGE OF ONE ISLAND'S LIST. The island answers a page at a time and names the cursor of the page
 * behind (`next`); this hands each cursor back as `after` until none remains. A page that carries a count
 * where its rows belong refuses by name (`shore-list-unpaged`): a list that printed nothing over a full shore
 * would state a thing nobody measured. A cursor that fails to move forward refuses the same way. Each page
 * names the mark of the shore it read (`mark`, folding every row that stands); a mark that moves between two
 * pages refuses as `shore-list-moved`, since the rows read would then name no one shore.
 */
export async function readShoreList(
  ask: (shoreArgs: Readonly<Record<string, unknown>>) => Promise<ShoreAnswer>,
  listArgs: Readonly<Record<string, unknown>>,
): Promise<ShoreListing | (ShoreAnswer & { readonly ok: false })> {
  const standoffs: Array<Record<string, unknown>> = [];
  const pending: Array<Record<string, unknown>> = [];
  let counts: string | null = null;
  let mark: string | null = null;
  let requestId: string | undefined;
  const refuse = (refusal: string, why: string): ShoreAnswer & { readonly ok: false } =>
    ({ ok: false, output: {}, refusal, why, ...(requestId !== undefined ? { requestId } : {}) });
  for (let after: string | null = null; ;) {
    const answer = await ask(after === null ? { ...listArgs, op: "list" } : { ...listArgs, op: "list", after });
    requestId = answer.requestId;
    if (!answer.ok) return answer as ShoreAnswer & { readonly ok: false };
    const o = answer.output;
    for (const name of ["standoffs", "pending"] as const) {
      if (!Array.isArray(o[name])) {
        const count = (o[name] as { boundedArrayCount?: unknown } | null | undefined)?.boundedArrayCount;
        return refuse("shore-list-unpaged", typeof count === "number"
          ? `the shore's ${name} arrived as a count of ${count} and named none of them; this vessel answers an unpaged list`
          : `the shore's answer named no ${name} array`);
      }
    }
    // The mark folds every row that stands; two pages under one mark read one shore.
    const told = `${String(o["standoffCount"])}/${String(o["pendingCount"])}`;
    const markNow = typeof o["mark"] === "string" ? o["mark"] : null;
    if (markNow === null) return refuse("shore-list-unpaged", "the shore's page named no mark of the shore it read; this vessel answers an unpaged list");
    if (mark !== null && markNow !== mark) return refuse("shore-list-moved", `the shore moved while its pages were read (${counts} standoffs/pending, then ${told}); read it again`);
    mark = markNow;
    counts = told;
    standoffs.push(...(o["standoffs"] as Array<Record<string, unknown>>));
    pending.push(...(o["pending"] as Array<Record<string, unknown>>));
    const next = o["next"];
    if (typeof next !== "string" || next === "") break;
    if (after !== null && next <= after) return refuse("shore-list-unpaged", "the shore's cursor stood still between two pages");
    after = next;
  }
  // The pages owe every row the counts name.
  if (counts !== `${standoffs.length}/${pending.length}`) return refuse("shore-list-unpaged", `the shore counted ${counts} standoffs/pending and its pages named ${standoffs.length}/${pending.length}`);
  return { ok: true, standoffs, pending, ...(requestId !== undefined ? { requestId } : {}) };
}

/**
 * A settle ask's page: at most this many carriers, so every row an island answers rides whole under the outcome's
 * row cap (`AUDIT_ARRAY_CAP`, `@lararium/tw5` `verb-vm.ts`); `tests/shore-two-islands.test.ts` welds the two.
 */
export const SETTLE_PAGE = 32;

/**
 * THE STALL WINDOW. A settle keeps asking while pages keep settling, and stops only where no page newly settled
 * for this long. A live seed of a 468-carrier bag ran its projector past one page's own wait while it still made
 * progress; a window measured from the last settled page tells "slow" apart from "stopped".
 */
export const SETTLE_STALL_MS = 120_000;

/** A pause between two retry rounds, so a retry queue never spins against an island that answers at once. */
export const SETTLE_RETRY_PAUSE_MS = 1_000;

/** The carriers a settle reading names by uri at most; the counts carry the rest, the record holds them all. */
export const SETTLE_NAMED = 64;

/** The seams a settle's wait reads: the stall window, the clock, and the pause between retry rounds. */
export interface SettleWaitOptions {
  readonly stallMs?: number;
  readonly now?: () => number;
  readonly pauseMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

/** One carrier as a settle word names it. */
export interface SettleCarrier { readonly uri: string; readonly records: string; readonly heads?: readonly string[] }

/** What the settle word said, as a gesture reports it. */
export interface SettleReading {
  /** True where the island answered that the projection the named records cause has run. */
  readonly settled: boolean;
  /** False where no island of the vessel mounts a disk shore: no projection follows these records at all. */
  readonly shore: boolean;
  /** False where no mirror of the island holds the bag: it projects nothing of these records. */
  readonly mirrored: boolean;
  readonly settledCount: number;
  readonly elsewhereCount: number;
  /** Carriers a later settle word took over: this word ended, claiming no projection for them. */
  readonly supersededCount: number;
  /** True where the settle ended on the stall window: no page newly settled for `SETTLE_STALL_MS`. */
  readonly stalled: boolean;
  /** Carriers no word reached when the settle ended (0 where it settled whole). */
  readonly pendingCount: number;
  /** Of those, the carriers whose page was asked and timed out without a word (the rest went unasked). */
  readonly stalledCount: number;
  /** The pending carriers by uri, at most `SETTLE_NAMED` of them. */
  readonly pendingUris: readonly string[];
  /** Where a stalled settle left its resumable record (`lares shore settle --bag <bag> --pending`). */
  readonly recordPath?: string;
  readonly refusal?: string;
  readonly why?: string;
}

/**
 * THE RESUMABLE RECORD. A settle that stalled writes the carriers still waiting under the house's run dir
 * (`<LAR_ROOT>/run/settle-pending/<bag slug>.json`): run state, outliving the process yet no house content.
 * A settle that ends whole clears it.
 */
export interface SettlePendingRecord { readonly bag: string; readonly carriers: SettleCarrier[] }

/** A bag's slug: the uri with every run outside `[A-Za-z0-9._-]` folded to `_`. A bare slug reads as itself. */
export function settleBagSlug(bag: string): string { return bag.replace(/[^A-Za-z0-9._-]+/g, "_"); }

export function settlePendingPath(bag: string): string {
  return join(larRuntimeHome(), "settle-pending", `${settleBagSlug(bag)}.json`);
}

/** The record a stalled settle left for the bag (by uri or slug), or null where none stands. */
export function readSettlePending(bag: string): SettlePendingRecord | null {
  const path = settlePendingPath(bag);
  if (!existsSync(path)) return null;
  const read = JSON.parse(readFileSync(path, "utf8")) as Partial<SettlePendingRecord>;
  if (typeof read.bag !== "string" || !Array.isArray(read.carriers)) return null;
  return { bag: read.bag, carriers: read.carriers };
}

export function writeSettlePending(record: SettlePendingRecord): string {
  const path = settlePendingPath(record.bag);
  mkdirSync(join(larRuntimeHome(), "settle-pending"), { recursive: true });
  writeFileSync(`${path}.tmp`, JSON.stringify(record, null, 2) + "\n");
  renameSync(`${path}.tmp`, path);
  return path;
}

export function clearSettlePending(bag: string): void { rmSync(settlePendingPath(bag), { force: true }); }

/**
 * THE SETTLE WORD. A gesture that landed records names each carrier with the hash its records render, and with
 * the causal heads it landed where the island's store keeps history; the island answers once the projection
 * those records cause has run (`settle`, `shore-verb.ts`), so a scan that follows reads what the projection
 * left. The island holds no clock for it. A word that named heads ends by name (`far-side-closed`) when the
 * link that would carry them closes first, so the caller's own wait stands as one bound among others.
 *
 * With `record`, a settle that stalled writes its still-pending carriers as the bag's resumable record, and a
 * settle that ended whole clears it.
 */
export async function askSettle(
  ask: (shoreArgs: Readonly<Record<string, unknown>>) => Promise<ShoreAnswer>,
  bag: string, carriers: ReadonlyArray<SettleCarrier>,
  opts: { readonly record?: boolean } = {},
): Promise<SettleReading> {
  const answer = await ask({ op: "settle", bag, carriers: carriers.map((c) => ({ uri: c.uri, records: c.records, ...(c.heads !== undefined && c.heads.length > 0 ? { heads: [...c.heads] } : {}) })) });
  const o = answer.output;
  const count = (name: string): number => (typeof o[name] === "number" ? (o[name] as number) : 0);
  const idle = { stalled: false, pendingCount: 0, stalledCount: 0, pendingUris: [] as string[] };
  if (!answer.ok) return { settled: false, shore: true, mirrored: true, settledCount: 0, elsewhereCount: 0, supersededCount: 0, ...idle, refusal: answer.refusal ?? "verb-error", why: answer.why ?? "the island refused" };
  const base = { shore: o["shore"] !== false, mirrored: o["mirrored"] !== false, settledCount: count("settledCount"), elsewhereCount: count("elsewhereCount"), supersededCount: count("supersededCount") };
  const pendingAll = Array.isArray(o["pendingUris"]) ? (o["pendingUris"] as string[]) : [];
  if (o["stalled"] !== true) {
    if (opts.record) clearSettlePending(bag);
    return { settled: true, ...base, ...idle };
  }
  const waiting = new Set(pendingAll);
  let recordPath: string | undefined;
  if (opts.record) recordPath = writeSettlePending({ bag, carriers: carriers.filter((c) => waiting.has(c.uri)).map((c) => ({ uri: c.uri, records: c.records, ...(c.heads !== undefined && c.heads.length > 0 ? { heads: [...c.heads] } : {}) })) });
  return {
    settled: false, ...base, stalled: true,
    pendingCount: count("pendingCount"), stalledCount: count("stalledCount"), pendingUris: pendingAll.slice(0, SETTLE_NAMED),
    ...(recordPath !== undefined ? { recordPath } : {}),
    refusal: "settle-stalled", why: typeof o["why"] === "string" ? o["why"] : "no page of the settle settled within the stall window",
  };
}

type RunVerb = (name: string, args: Record<string, unknown>, did: string, opts: { timeoutMs: number }) => Promise<SubmitResult>;

/**
 * THE TWO ISLANDS THAT MOUNT A DISK SHORE. The active wiki's island answers the shore verb for the mirrors its
 * recipe designates, reached through `wiki-act`; the daemon island answers it for the mirrors it mounts (the
 * daemon wiki's working layer and crossroads), reached by the verb itself (`shore`, registered where the
 * node entry injects its door). Each answers for the standoffs and pending removals its own projector holds.
 */
export const SHORE_ISLANDS = ["wiki", "daemon"] as const;
export type ShoreIsland = (typeof SHORE_ISLANDS)[number];

/** Send one shore act to ONE island and read its answer. Throws what `runVerb` throws. */
export async function askIsland(
  island: ShoreIsland, shoreArgs: Readonly<Record<string, unknown>>, did: string, run: RunVerb = runVerb,
): Promise<ShoreAnswer> {
  // A sense, a settle or an answer over many carriers reconciles each one: the wait grows with the count.
  const many = (Array.isArray(shoreArgs["uris"]) ? (shoreArgs["uris"] as unknown[]).length : 0)
    + (Array.isArray(shoreArgs["carriers"]) ? (shoreArgs["carriers"] as unknown[]).length : 0);
  const opts = { timeoutMs: 30_000 + many * 200 };
  return readShoreAnswer(island === "wiki"
    ? await run("wiki-act", { verb: SHORE_VERB, args: { ...shoreArgs } }, did, opts)
    : await run(SHORE_VERB, { ...shoreArgs }, did, opts));
}

/** An island that mounts no projection holds nothing at its shore: its refusal reads as an empty shore. */
const holdsNoShore = (a: ShoreAnswer): boolean => !a.ok && a.refusal === "no-disk-shore";

/** An island's refusal, its name kept and the island named in its reason. */
const refusedAt = (island: ShoreIsland, a: ShoreAnswer): ShoreAnswer =>
  ({ ...a, why: `the ${island === "wiki" ? "active wiki's" : "daemon"} island: ${a.why ?? "refused"}` });

/**
 * Send one shore act to every island that mounts a disk shore, and answer as one shore. Throws what
 * `runVerb` throws.
 *
 *   list     reads every page of each island (`readShoreList`) and answers both lists as one page, each
 *            row naming its island; an island that mounts no projection lists nothing
 *   sense    each island looks; the counts add
 *   settle   asked in pages of at most SETTLE_PAGE carriers, so each island's rows ride whole; each island
 *            answers for the mirrors it holds, and the word stands where every island gave it. Each carrier
 *            reads ONCE across islands: settled where any island that mirrors the bag projected it, superseded
 *            where a later word took it and none projected it, elsewhere otherwise. `mirrored` reads true where
 *            any island mirrors the bag, and `shore` false where no island mounts a disk shore at all. A
 *            page whose ask ran out this caller's own wait retries while other pages keep settling; the
 *            settle ends `stalled` where no page newly settled for the stall window (`SETTLE_STALL_MS`),
 *            naming what still waits (`pendingCount`, `stalledCount`, `pendingUris`)
 *   answers  (`take-records`, `restore`, `remove`) go to the island whose list holds the state: the standoff
 *            under the named key, or the pending removals the answer names (by carrier, by bag, or all).
 *            Where both islands hold it, or a set splits across them, the answer refuses by name
 *            (`shore-answer-incomplete`) and names how to split it: two bags never fold into one answer.
 *            Where neither holds it, the active wiki's island answers and names what stands there.
 *
 * Any other refusal keeps its name and says which island gave it. The CLI reaches a node vessel over its
 * sock alone, and the node entry injects the daemon island's shore door at every boot
 * (`node-daemon-island.ts`), so the second line stands wherever the first does; a line that fails refuses
 * by name rather than reading as an empty shore.
 */
export async function askShore(shoreArgs: Readonly<Record<string, unknown>>, did: string, run: RunVerb = runVerb, wait: SettleWaitOptions = {}): Promise<ShoreAnswer> {
  const ask = (island: ShoreIsland) => (a: Readonly<Record<string, unknown>>) => askIsland(island, a, did, run);
  const op = typeof shoreArgs["op"] === "string" ? shoreArgs["op"] : "list";

  if (op === "list") {
    const standoffs: Array<Record<string, unknown>> = [];
    const pending: Array<Record<string, unknown>> = [];
    const marks: string[] = [];
    let requestId: string | undefined;
    for (const island of SHORE_ISLANDS) {
      const listed = await readShoreList(ask(island), { ...shoreArgs, op: "list" });
      if (!listed.ok) { if (holdsNoShore(listed)) { marks.push(`${island}:none`); continue; } return refusedAt(island, listed); }
      requestId ??= listed.requestId;
      standoffs.push(...listed.standoffs.map((r) => ({ ...r, island })));
      pending.push(...listed.pending.map((r) => ({ ...r, island })));
      marks.push(`${island}:${listed.standoffs.length}/${listed.pending.length}`);
    }
    return {
      ok: true, refusal: null, why: null, ...(requestId !== undefined ? { requestId } : {}),
      output: { ok: true, op: "list", standoffs, standoffCount: standoffs.length, pending, pendingCount: pending.length, mark: marks.join(" "), next: null },
    };
  }

  if (op === "sense") {
    const answers: Array<{ island: ShoreIsland; answer: ShoreAnswer }> = [];
    for (const island of SHORE_ISLANDS) answers.push({ island, answer: await ask(island)(shoreArgs) });
    const refused = answers.find((a) => !a.answer.ok && !holdsNoShore(a.answer));
    if (refused) return refusedAt(refused.island, refused.answer);
    const held = answers.filter((a) => a.answer.ok).map((a) => a.answer.output);
    const sum = (name: string): number => held.reduce((n, o) => n + (typeof o[name] === "number" ? (o[name] as number) : 0), 0);
    const output: Record<string, unknown> = { ok: true, op, standoffCount: sum("standoffCount"), pendingCount: sum("pendingCount") };
    const requestId = answers.find((a) => a.answer.requestId !== undefined)?.answer.requestId;
    return { ok: true, output, refusal: null, why: null, ...(requestId !== undefined ? { requestId } : {}) };
  }

  if (op === "settle") {
    const carriers = Array.isArray(shoreArgs["carriers"]) ? (shoreArgs["carriers"] as unknown[]) : [];
    const pages: unknown[][] = [];
    for (let at = 0; at < carriers.length; at += SETTLE_PAGE) pages.push(carriers.slice(at, at + SETTLE_PAGE));
    if (pages.length === 0) pages.push([]);
    const kinds = ["settled", "elsewhere", "superseded"] as const;
    const reading = new Map<string, Set<(typeof kinds)[number]>>();
    let shore = false; let mirrored = false; let requestId: string | undefined;
    const stallMs = wait.stallMs ?? SETTLE_STALL_MS;
    const now = wait.now ?? Date.now;
    const pauseMs = wait.pauseMs ?? SETTLE_RETRY_PAUSE_MS;
    const sleep = wait.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    // SETTLE BY PROGRESS. The unit of work: one page at one island. A unit whose ask ran out this caller's own
    // wait (`LocalWaitExpired`) goes back on the retry queue, and the loop asks the rest; a page stands settled
    // once every island answered it. The settle stops only where no page newly settled for the stall window.
    // The per-page wait keeps `askIsland`'s formula (36.4 s at a full page): well inside the window, so one slow
    // page never spends the window alone, and a shorter wait would only re-ask a page the projector still works.
    // Re-asking a page sends the same word again; the island answers it once the projection has run.
    const answered = pages.map(() => new Set<ShoreIsland>());
    const timedOut = new Set<number>();
    let queue = pages.map((_, i) => i);
    let lastProgress = now();
    let stalled = false;
    let round = 0;
    outer: while (queue.length > 0) {
      if (round++ > 0) await sleep(pauseMs);
      const retry: number[] = [];
      for (const p of queue) {
        const page = pages[p]!;
        for (const island of SHORE_ISLANDS) {
          if (answered[p]!.has(island)) continue;
          if (now() - lastProgress >= stallMs) { stalled = true; break outer; }
          let answer: ShoreAnswer;
          try {
            answer = await ask(island)({ ...shoreArgs, carriers: page });
          } catch (err) {
            if (!(err instanceof LocalWaitExpired)) throw err;
            timedOut.add(p);
            continue;
          }
          answered[p]!.add(island);
          if (!answer.ok) { if (holdsNoShore(answer)) continue; return refusedAt(island, answer); }
          shore = true;
          requestId ??= answer.requestId;
          const o = answer.output;
          if (o["mirrored"] !== true) continue;
          mirrored = true;
          // AN ISLAND THAT MIRRORS THE BAG READS EVERY CARRIER OF THE PAGE EXACTLY ONCE: rows that miss one, name
          // one twice, or name one the page never asked refuse by name, never count.
          const asked = (page as Array<{ uri?: unknown }>).map((c) => String(c?.uri)).sort();
          const named = kinds.flatMap((kind) => (Array.isArray(o[kind]) ? (o[kind] as unknown[]).map(String) : [])).sort();
          if (asked.length !== named.length || asked.some((uri, i) => uri !== named[i])) {
            return { ok: false, output: {}, refusal: "shore-answer-incomplete", why: `the ${island === "wiki" ? "active wiki's" : "daemon"} island's settle answer reads ${named.length} row(s) for the ${asked.length} carrier(s) it was asked` };
          }
          for (const kind of kinds) {
            const rows = o[kind];
            const count = o[`${kind}Count`];
            if (!Array.isArray(rows) || (typeof count === "number" && count !== rows.length)) {
              return { ok: false, output: {}, refusal: "shore-answer-incomplete", why: `the ${island === "wiki" ? "active wiki's" : "daemon"} island's settle answer carries no whole ${kind} rows` };
            }
            for (const uri of rows as string[]) {
              let held = reading.get(uri);
              if (!held) { held = new Set(); reading.set(uri, held); }
              held.add(kind);
            }
          }
        }
        if (answered[p]!.size === SHORE_ISLANDS.length) lastProgress = now();
        else retry.push(p);
      }
      queue = retry;
    }
    // ONE READING PER CARRIER, whichever islands mirror its bag.
    let settledCount = 0, elsewhereCount = 0, supersededCount = 0;
    for (const held of reading.values()) {
      if (held.has("settled")) settledCount += 1;
      else if (held.has("superseded")) supersededCount += 1;
      else elsewhereCount += 1;
    }
    // WHAT STILL WAITS: every carrier of a page some island never answered; stalled where that page was asked
    // and timed out, the rest never asked before the window closed.
    const uriOfRow = (c: unknown): string => String((c as { uri?: unknown } | null)?.uri);
    const pendingPages = pages.map((_, i) => i).filter((i) => answered[i]!.size < SHORE_ISLANDS.length);
    const pendingUris = pendingPages.flatMap((i) => pages[i]!.map(uriOfRow));
    const stalledCount = pendingPages.filter((i) => timedOut.has(i)).reduce((n, i) => n + pages[i]!.length, 0);
    const output: Record<string, unknown> = {
      ok: true, op, ...(typeof shoreArgs["bag"] === "string" ? { bag: shoreArgs["bag"] } : {}), shore, mirrored, settledCount, elsewhereCount, supersededCount,
      stalled, pendingCount: pendingUris.length, stalledCount, pendingUris,
      ...(stalled ? { why: `no page of the settle settled for ${Math.round(stallMs / 1000)}s; ${pendingUris.length} carrier(s) still wait` } : {}),
    };
    return { ok: true, output, refusal: null, why: null, ...(requestId !== undefined ? { requestId } : {}) };
  }

  // AN ANSWER GOES TO THE ISLAND THAT HOLDS ITS STATE, read from what each island lists right now: a key
  // folds the bag and the states, never the island, and a set of carriers may stand at either. Where the
  // state stands at both islands, or a set splits across them, the answer refuses by name and changes nothing.
  const uri = typeof shoreArgs["uri"] === "string" ? shoreArgs["uri"] : null;
  const uris = Array.isArray(shoreArgs["uris"]) ? (shoreArgs["uris"] as unknown[]).filter((u): u is string => typeof u === "string") : [];
  const bag = typeof shoreArgs["bag"] === "string" ? shoreArgs["bag"] : null;
  const holders: ShoreIsland[] = [];
  const keysSeen: string[] = [];
  for (const island of SHORE_ISLANDS) {
    const listed = await readShoreList(ask(island), { op: "list", ...(op === "take-records" && uri !== null ? { uris: [uri] } : uris.length > 0 ? { uris } : {}), ...(bag !== null ? { bag } : {}) });
    if (!listed.ok) { if (holdsNoShore(listed)) continue; return refusedAt(island, listed); }
    if (op === "take-records") {
      const stands = listed.standoffs.filter((s) => s["uri"] === uri);
      keysSeen.push(...stands.map((s) => String(s["standoff"])));
      if (stands.some((s) => s["standoff"] === shoreArgs["key"])) holders.push(island);
    } else if (listed.pending.length > 0) {
      holders.push(island);
    }
  }
  if (holders.length > 1) {
    return { ok: false, output: {}, refusal: "shore-answer-incomplete", why: op === "take-records"
      ? `the standoff under key ${String(shoreArgs["key"])} stands at both islands over one bag; the door cannot name which one a person read, so it takes neither`
      : `what the answer names stands pending at both islands; name one bag with \`bag\`, or answer each island's carriers apart` };
  }
  if (holders.length === 0 && op === "take-records" && keysSeen.length > 0) {
    return { ok: false, output: {}, refusal: "standoff-key-moved", why: `the standoff for ${uri} stands under key ${keysSeen.join(", ")}; the answer names ${String(shoreArgs["key"])}` };
  }
  // No island lists the state: the active wiki's island answers, and names what stands there.
  const island = holders[0] ?? "wiki";
  const answer = await ask(island)(shoreArgs);
  return answer.ok ? answer : refusedAt(island, answer);
}

/** How long one island's census page may take: the island's own drain wait (five seconds) and the page beside it. */
export const CENSUS_PAGE_MS = 15_000;

/** What one census read of every disk shore names: each carrier not settled, and each island that could not answer. */
export interface ShoreCensus {
  readonly carriers: ReadonlyArray<{ readonly state: string; readonly uri: string; readonly bagId: string | null; readonly island: ShoreIsland }>;
  readonly unanswered: ReadonlyArray<{ readonly part: string; readonly why: string }>;
}

/**
 * THE SHORE'S CENSUS: ask every island that mounts a disk shore which carriers its projector has not settled, reading
 * each island's pages to the end. An island that mounts no projection holds none; an island that refuses, throws, or
 * answers in a shape this door cannot read lands in `unanswered`, by name, and never reads as an empty shore.
 */
export async function askShoreCensus(did: string, run: RunVerb = runVerb): Promise<ShoreCensus> {
  const carriers: Array<ShoreCensus["carriers"][number]> = [];
  const unanswered: Array<ShoreCensus["unanswered"][number]> = [];
  for (const island of SHORE_ISLANDS) {
    const part = `${island === "wiki" ? "the active wiki's" : "the daemon"} island's disk projector`;
    const rows: Array<ShoreCensus["carriers"][number]> = [];
    let failed: string | null = null;
    for (let after: string | null = null, pages = 0; ; pages++) {
      const shoreArgs: Record<string, unknown> = after === null ? { op: "census" } : { op: "census", after };
      let answer: ShoreAnswer;
      try {
        answer = readShoreAnswer(island === "wiki"
          ? await run("wiki-act", { verb: SHORE_VERB, args: shoreArgs }, did, { timeoutMs: CENSUS_PAGE_MS })
          : await run(SHORE_VERB, shoreArgs, did, { timeoutMs: CENSUS_PAGE_MS }));
      } catch (e) { failed = e instanceof Error ? e.message : String(e); break; }
      if (!answer.ok) { if (!holdsNoShore(answer)) failed = `${answer.refusal ?? "refused"}: ${answer.why ?? "named no reason"}`; break; }
      const o = answer.output;
      if (!Array.isArray(o["carriers"])) { failed = "the census answered no carrier array (a vessel older than this door, or a page past the outcome's row cap)"; break; }
      for (const c of o["carriers"] as Array<Record<string, unknown>>) {
        rows.push({ state: String(c["state"]), uri: String(c["uri"]), bagId: typeof c["bagId"] === "string" ? c["bagId"] : null, island });
      }
      const next = o["next"];
      if (typeof next !== "string" || next === "") {
        if (typeof o["carrierCount"] === "number" && o["carrierCount"] !== rows.length && pages === 0) failed = `the census counted ${String(o["carrierCount"])} carriers and named ${rows.length}`;
        break;
      }
      if (after !== null && next <= after) { failed = "the census cursor stood still between two pages"; break; }
      after = next;
    }
    carriers.push(...rows);
    if (failed !== null) unanswered.push({ part, why: failed });
  }
  return { carriers, unanswered };
}
