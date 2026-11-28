/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/watch
type: application/javascript
module-type: startup
\*/
/**
 * watch — THE WATCH BOOK (lar:///engine.filter.watches, comms-ux-enacts landing 16): a filter subscription that stands as a
 * TIDDLER, moved by the wiki's own `change` event (the operator, 2026-11-27: "re-use the existing TW5 listen-for-changes
 * patterns; the TW5 wikis serve as the memory state machine").
 *
 *   $:/state/lares/watch/<id>   filter · recipe · face (who bound it) · until? · digest · count
 *
 * ONE LISTENER PER WIKI. The book hears `change` with the same `changedTiddlers` map every widget's `refresh()` reads, and re-runs
 * only the watches a changed title could touch: a title the watch's reader view can see (its caller's face and recipe), whose
 * record moved past the hash the watch last read. A title that stays home (the verb trail, a temp title, the watch records'
 * own digests), a record in a bag the caller holds no read on, and the shore's echo (which moves only `$origin-bag`) re-run
 * nothing; N watchers cost at most N filter runs per change, counted (`runs`). No clock decides anything here.
 *
 * THE VIEW WEIGHS AGAIN BEFORE EACH RE-RUN (`reweigh`), against the caller's own reach: a bag the caller lost leaves the watch's
 * answer, and a watch whose caller lost the wiki's own read stops tracking and drops with its record.
 *
 * THE DIGEST: the answering titles, each beside its record's hash over the caller's view (`answerDigestOf`), so an edit moves it
 * and the stamp never does. A watch record's own digest and count leave its hash, so a watch that lists watches settles.
 *
 * THE HOUSE'S FACES SHARE ONE BOOK: each watch names the face that bound it (`face`, the presenter the session door verified),
 * as attribution. Any face of the house reads, re-binds or unasks any watch. The bound is housekeeping per binding face:
 * `WATCH_BOOK_MAX` watches each, a bind past it letting go that face's own longest-bound watch no call holds, and refusing
 * (`watch-bound`) where every one stands held.
 *
 * A WATCH READS, LISTS AND DIES LIKE ANY RECORD: `[prefix[$:/state/lares/watch/]]` lists the live watches, and
 * `unask` (the call's `mu=unask`) deletes one. The held call (`filter-watch` in `tiddler-verbs.ts`) answers when its watch
 * tiddler moves.
 *
 * Meme: lar:///ha.ka.ba/lares/afford/engine.filter.watches
 */
import { canonicalJsonBytes, sha256HexBytesSync } from "@lararium/mesh/crypto";
import { VerbRefusal } from "@lararium/mesh/verb-refusal";
import { answerDigestOf } from "../filter-page.js";
import type { LaresTw5Extension } from "../types/lares-globals.js";
import type { TW5Instance } from "../types/tiddlywiki.js";

export const name        = "lararium-watch";
export const after       = ["startup"];
export const synchronous = true;

declare const $tw: (Partial<TW5Instance> & LaresTw5Extension) | undefined;

/** Where a watch's record stands: one id segment under the prefix (`stay-home`'s `WATCH_RECORD_PREFIX`). */
export const WATCH_PREFIX = "$:/state/lares/watch/";
/** The spelling an id takes: lower-case words and dashes, at most 64. */
export const WATCH_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** The watches one binding face holds in one wiki's book at most. */
export const WATCH_BOOK_MAX = 64;
/** The fields a watch record moves on every re-run; its hash leaves them out, so a watch that lists watches settles. */
const WATCH_MOVING_FIELDS = ["digest", "count"] as const;

export const watchTitleOf = (id: string): string => `${WATCH_PREFIX}${id}`;

/** One tiddler as the book reads it. */
interface BookTiddler { readonly fields: Readonly<Record<string, unknown>>; getFieldStrings?(): Record<string, string> }
type ChangeMap = Record<string, { deleted?: boolean; modified?: boolean }>;
/** The slice of a TiddlyWiki wiki the book reads and writes. */
export interface WatchWiki {
  getTiddler(title: string): BookTiddler | undefined;
  addTiddler(fields: Record<string, unknown>): void;
  deleteTiddler(title: string): void;
  addEventListener(type: "change", listener: (changed: ChangeMap) => void): void;
  removeEventListener?(type: "change", listener: (changed: ChangeMap) => void): void;
}
/** The caller's reader view a watch computes over: it holds only what the caller's face may read. */
export interface WatchView {
  filterTiddlers(filter: string): string[];
  getTiddler(title: string): BookTiddler | undefined;
}

/** What a watch binds: its id, its filter and binding face, the view it reads, and the reader's visibility predicate. */
export interface WatchSpec {
  readonly id: string;
  readonly filter: string;
  readonly recipe: string;
  /** The face that bound the watch, as the presenter the session door verified: attribution, and the face its bound counts against. */
  readonly face: string;
  readonly until?: string | undefined;
  readonly view: WatchView;
  /** True for a title the caller's view may read (the door's own predicate, a missing record included). */
  readonly visible: (title: string, tiddler: BookTiddler | undefined) => boolean;
  /** Ask the caller's reach again before a re-run; a rejection (the caller lost the wiki's read) drops the watch. */
  readonly reweigh?: (() => Promise<void>) | undefined;
}

/** One watch as the book holds it. */
export interface WatchEntry extends WatchSpec {
  readonly title: string;
  digest: string;
  titles: string[];
  hashes: Map<string, string | null>;
  /** The filter runs this watch cost, counted. */
  runs: number;
  /** A reweigh runs for this watch now; `again` marks one more owed after it (the queue folds: one runs, one waits). */
  weighing: boolean;
  again: boolean;
}

/** A record's hash as a watch reads it: every field but the residency stamp (a watch record's digest and count left out too). */
export function watchHashOf(title: string, tiddler: BookTiddler | undefined): string | null {
  if (tiddler === undefined) return null;
  const all = tiddler.getFieldStrings ? tiddler.getFieldStrings() : Object.fromEntries(Object.entries(tiddler.fields).map(([k, v]) => [k, String(v)]));
  const { ["$origin-bag"]: _stamp, ...own } = all;
  if (title.startsWith(WATCH_PREFIX)) for (const moving of WATCH_MOVING_FIELDS) delete own[moving];
  return `sha256-${sha256HexBytesSync(canonicalJsonBytes(own))}`;
}

const BOOK_KEY = Symbol.for("lararium.watch.book");

export class WatchBook {
  private readonly entries = new Map<string, WatchEntry>();
  /** The held calls standing on each watch now, by id. */
  private readonly holding = new Map<string, number>();
  /** Watch records the book last moved by their digest alone: their next change re-runs no watch. */
  private readonly quiet = new Set<string>();
  /** Every filter run the book made, across its watches. */
  runs = 0;
  private readonly listener = (changed: ChangeMap): void => this.heard(changed);

  constructor(private readonly wiki: WatchWiki) {
    wiki.addEventListener("change", this.listener);
  }

  /** The watch under `id`, or undefined. */
  entry(id: string): WatchEntry | undefined { return this.entries.get(id); }
  /** Every live watch's id, bound order. */
  ids(): string[] { return [...this.entries.keys()]; }

  /**
   * BIND (or re-bind) a watch, in one turn with no await: the spec replaces any the watch held (a new view each held call, from
   * whichever face binds it), the filter runs once, and the record lands where the digest moved. A new watch past its binding
   * face's bound lets go that face's longest-bound watch no call holds, or refuses `watch-bound`.
   */
  bind(spec: WatchSpec): WatchEntry {
    const prior = this.entries.get(spec.id);
    if (prior === undefined) {
      const own = [...this.entries.values()].filter((e) => e.face === spec.face);
      if (own.length >= WATCH_BOOK_MAX) {
        const idle = own.find((e) => (this.holding.get(e.id) ?? 0) === 0);
        if (idle === undefined) {
          throw new VerbRefusal("watch-bound", `watch-bound: this face holds ${own.length} watches in this wiki, every one held by a call; let one answer, or drop one with \`lares watch id=<id> mu=unask\` (list them: \`lares get filter='[prefix[${WATCH_PREFIX}]]'\`).`);
        }
        this.let(idle.id);
      }
    }
    if (prior !== undefined) this.entries.delete(spec.id);
    const entry: WatchEntry = { ...spec, title: watchTitleOf(spec.id), digest: prior?.digest ?? "", titles: [], hashes: new Map(), runs: prior?.runs ?? 0, weighing: false, again: false };
    this.entries.set(spec.id, entry);
    this.rerun(entry, prior === undefined || prior.filter !== spec.filter || prior.until !== spec.until || prior.face !== spec.face);
    return entry;
  }

  /** A held call takes its stand on a watch (`+1`) or leaves it (`-1`); a held watch never leaves for the bound. */
  hold(id: string, step: 1 | -1): void {
    const n = Math.max(0, (this.holding.get(id) ?? 0) + step);
    if (n === 0) this.holding.delete(id);
    else this.holding.set(id, n);
  }

  /** UNASK: any face of the house drops a watch and its record. Answers whether one stood. */
  unask(id: string): boolean { return this.let(id); }

  /** The watch's own end (its `until` answered, or its caller left): the watch and its record leave. */
  end(id: string): void { this.let(id); }

  /** Stop hearing the wiki: every watch drops with its record. */
  close(): void {
    for (const id of this.ids()) this.end(id);
    this.wiki.removeEventListener?.("change", this.listener);
  }

  /** The titles a watch's `until` answers over its view, counted as a run. */
  untilAnswers(entry: WatchEntry): string[] {
    if (entry.until === undefined || entry.until === "") return [];
    this.runs++;
    entry.runs++;
    return entry.view.filterTiddlers(entry.until).filter((t) => entry.visible(t, this.wiki.getTiddler(t)));
  }

  /** Let a watch go: its record leaves the wiki. Answers whether one stood. */
  private let(id: string): boolean {
    const entry = this.entries.get(id);
    this.entries.delete(id);
    const title = watchTitleOf(id);
    const stood = entry !== undefined || this.wiki.getTiddler(title) !== undefined;
    if (this.wiki.getTiddler(title) !== undefined) this.wiki.deleteTiddler(title);
    return stood;
  }

  /** A changed title this watch could see: never its own record, never one its view withholds, never a record unmoved. */
  private couldSee(entry: WatchEntry, title: string, deleted: boolean): boolean {
    if (title === entry.title) return false;
    const tiddler = this.wiki.getTiddler(title);
    if (deleted || tiddler === undefined) return entry.hashes.has(title) || entry.visible(title, undefined);
    // A listed record the view no longer reads (a reach that moved) still re-runs, so it leaves the answer.
    if (!entry.visible(title, tiddler)) return entry.hashes.has(title);
    // THE SHORE'S ECHO MOVES NOTHING: a listed record whose hash still reads as the watch last read it re-runs no filter.
    return !(entry.hashes.has(title) && entry.hashes.get(title) === watchHashOf(title, tiddler));
  }

  private heard(changed: ChangeMap): void {
    // A WATCH RECORD THE BOOK MOVED BY ITS DIGEST ALONE re-runs no watch: only a watch that joins, leaves or changes its spec does.
    const titles = Object.keys(changed).filter((t) => !this.quiet.delete(t));
    for (const entry of [...this.entries.values()]) {
      if (this.entries.get(entry.id) !== entry) continue;
      if (!titles.some((t) => this.couldSee(entry, t, changed[t]?.deleted === true))) continue;
      if (entry.reweigh === undefined) { this.rerun(entry, false); continue; }
      this.weigh(entry);
    }
  }

  /**
   * THE REACH WEIGHS AGAIN FIRST, the queue folded: at most one weigh runs and one waits per watch, however many changes land
   * meanwhile. A watch whose caller lost the wiki's read stops tracking and drops with its record.
   */
  private weigh(entry: WatchEntry): void {
    if (entry.weighing) { entry.again = true; return; }
    const reweigh = entry.reweigh;
    if (reweigh === undefined) return;
    entry.weighing = true;
    void reweigh().then(
      () => { if (this.entries.get(entry.id) === entry) this.rerun(entry, false); },
      () => { if (this.entries.get(entry.id) === entry) this.end(entry.id); },
    ).finally(() => {
      entry.weighing = false;
      if (entry.again && this.entries.get(entry.id) === entry) { entry.again = false; this.weigh(entry); }
    });
  }

  /** Run the watch's filter over its view; land its record where the digest moved, or where `force` asks (a new spec). */
  private rerun(entry: WatchEntry, force: boolean): void {
    this.runs++;
    entry.runs++;
    const titles = entry.view.filterTiddlers(entry.filter).filter((t) => entry.visible(t, this.wiki.getTiddler(t)));
    const hashes = new Map<string, string | null>();
    for (const t of titles) hashes.set(t, watchHashOf(t, entry.view.getTiddler(t)));
    entry.titles = titles;
    entry.hashes = hashes;
    const digest = answerDigestOf(titles.map((t) => [t, hashes.get(t) ?? null] as const));
    if (digest === entry.digest && !force && this.wiki.getTiddler(entry.title) !== undefined) return;
    entry.digest = digest;
    const fields = {
      title: entry.title, filter: entry.filter, recipe: entry.recipe, face: entry.face,
      ...(entry.until !== undefined && entry.until !== "" ? { until: entry.until } : {}),
      digest, count: String(titles.length),
    };
    const before = this.wiki.getTiddler(entry.title);
    if (before !== undefined && watchHashOf(entry.title, before) === watchHashOf(entry.title, { fields })) this.quiet.add(entry.title);
    else this.quiet.delete(entry.title);
    this.wiki.addTiddler(fields);
  }
}

/** The one book a wiki holds, standing it on first ask: the startup module and the held call reach the same book. */
export function watchBookOf(wiki: WatchWiki): WatchBook {
  const held = wiki as unknown as Record<symbol, WatchBook | undefined>;
  return held[BOOK_KEY] ??= new WatchBook(wiki);
}

/** A fresh watch id: twelve hex digits from the platform's entropy, no clock. */
export function newWatchId(): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function startup(): void {
  if (!$tw?.wiki) return;
  $tw.lares ??= {};
  const lares = $tw.lares;
  lares["watch"] = watchBookOf($tw.wiki as unknown as WatchWiki);
}
