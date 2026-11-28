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
 *   $:/state/lares/watch/<id>   filter · recipe · face · until? · digest · count
 *
 * ONE LISTENER PER WIKI. The book hears `change` with the same `changedTiddlers` map every widget's `refresh()` reads, and re-runs
 * only the watches a changed title could touch: a title the watch's reader view can see (its caller's face and recipe), whose
 * record moved past the hash the watch last read. A title that stays home (the verb trail, a temp title, the watch records'
 * own digests), a record in a bag the caller holds no read on, and the shore's echo (which moves only `$origin-bag`) re-run
 * nothing; N watchers cost at most N filter runs per change, counted (`runs`). No clock decides anything here.
 *
 * THE DIGEST: the answering titles, each beside its record's hash over the caller's view (`answerDigestOf`), so an edit moves it
 * and the stamp never does. A watch record's own digest and count leave its hash, so a watch that lists watches settles.
 *
 * A WATCH READS, LISTS AND DIES LIKE ANY RECORD: `[prefix[$:/state/lares/watch/]]` lists every live watch, and `drop` (the call's
 * `mu=unask`) deletes one. The held call (`filter-watch` in `tiddler-verbs.ts`) answers when its watch tiddler moves. The book
 * holds at most `WATCH_BOOK_MAX` watches per wiki; a bind past it lets go the longest-bound watch no call holds.
 *
 * Meme: lar:///ha.ka.ba/lares/afford/engine.filter.watches
 */
import { canonicalJsonBytes, sha256HexBytesSync } from "@lararium/mesh/crypto";
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
/** The watches one wiki's book holds at most. */
export const WATCH_BOOK_MAX = 64;
/** The fields a watch record moves on every re-run; its hash leaves them out, so a watch that lists watches settles. */
const WATCH_MOVING_FIELDS = ["digest", "count"] as const;

export const watchTitleOf = (id: string): string => `${WATCH_PREFIX}${id}`;

/** One tiddler as the book reads it. */
interface BookTiddler { readonly fields: Readonly<Record<string, unknown>>; getFieldStrings?(): Record<string, string> }
/** The slice of a TiddlyWiki wiki the book reads and writes. */
export interface WatchWiki {
  getTiddler(title: string): BookTiddler | undefined;
  addTiddler(fields: Record<string, unknown>): void;
  deleteTiddler(title: string): void;
  addEventListener(type: "change", listener: (changed: Record<string, { deleted?: boolean; modified?: boolean }>) => void): void;
  removeEventListener?(type: "change", listener: (changed: Record<string, { deleted?: boolean; modified?: boolean }>) => void): void;
}
/** The caller's reader view a watch computes over: it holds only what the caller's face may read. */
export interface WatchView {
  filterTiddlers(filter: string): string[];
  getTiddler(title: string): BookTiddler | undefined;
}

/** What a watch binds: its id, its filter and caller, the view it reads, and the reader's visibility predicate. */
export interface WatchSpec {
  readonly id: string;
  readonly filter: string;
  readonly recipe: string;
  readonly face: string;
  readonly until?: string | undefined;
  readonly view: WatchView;
  /** True for a title the caller's view may read (the door's own predicate, a missing record included). */
  readonly visible: (title: string, tiddler: BookTiddler | undefined) => boolean;
}

/** One watch as the book holds it. */
export interface WatchEntry extends WatchSpec {
  readonly title: string;
  digest: string;
  titles: string[];
  hashes: Map<string, string | null>;
  /** The filter runs this watch cost, counted. */
  runs: number;
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
  private readonly listener = (changed: Record<string, { deleted?: boolean; modified?: boolean }>): void => this.heard(changed);

  constructor(private readonly wiki: WatchWiki) {
    wiki.addEventListener("change", this.listener);
  }

  /** The watch under `id`, or undefined. */
  entry(id: string): WatchEntry | undefined { return this.entries.get(id); }
  /** Every live watch's id, bound order. */
  ids(): string[] { return [...this.entries.keys()]; }

  /**
   * BIND (or re-bind) a watch: its spec replaces any it held (a new view each held call, so a bag the caller gains or loses
   * reads at the next call), the filter runs once, and the record lands where the digest moved. A bind past the book's bound
   * lets go the longest-bound watch no call holds.
   */
  bind(spec: WatchSpec): WatchEntry {
    const prior = this.entries.get(spec.id);
    if (prior === undefined && this.entries.size >= WATCH_BOOK_MAX) {
      const idle = [...this.entries.values()].find((e) => (this.holding.get(e.id) ?? 0) === 0);
      if (idle !== undefined) this.drop(idle.id);
    }
    if (prior !== undefined) this.entries.delete(spec.id);
    const entry: WatchEntry = { ...spec, title: watchTitleOf(spec.id), digest: prior?.digest ?? "", titles: [], hashes: new Map(), runs: prior?.runs ?? 0 };
    this.entries.set(spec.id, entry);
    this.rerun(entry, prior === undefined || prior.filter !== spec.filter || prior.until !== spec.until || prior.face !== spec.face);
    return entry;
  }

  /** A held call takes its stand on a watch (`+1`) or leaves it (`-1`); a held watch never leaves for the book's bound. */
  hold(id: string, step: 1 | -1): void {
    const n = Math.max(0, (this.holding.get(id) ?? 0) + step);
    if (n === 0) this.holding.delete(id);
    else this.holding.set(id, n);
  }

  /** DROP a watch: its record leaves the wiki and the book forgets it. Answers whether one stood. */
  drop(id: string): boolean {
    const entry = this.entries.get(id);
    this.entries.delete(id);
    const title = watchTitleOf(id);
    const stood = entry !== undefined || this.wiki.getTiddler(title) !== undefined;
    if (this.wiki.getTiddler(title) !== undefined) this.wiki.deleteTiddler(title);
    return stood;
  }

  /** Stop hearing the wiki: every watch drops with its record. */
  close(): void {
    for (const id of this.ids()) this.drop(id);
    this.wiki.removeEventListener?.("change", this.listener);
  }

  /** The titles a watch's `until` answers over its view, counted as a run. */
  untilAnswers(entry: WatchEntry): string[] {
    if (entry.until === undefined || entry.until === "") return [];
    this.runs++;
    entry.runs++;
    return entry.view.filterTiddlers(entry.until).filter((t) => entry.visible(t, this.wiki.getTiddler(t)));
  }

  /** A changed title this watch could see: never its own record, never one its view withholds, never a record unmoved. */
  private couldSee(entry: WatchEntry, title: string, deleted: boolean): boolean {
    if (title === entry.title) return false;
    const tiddler = this.wiki.getTiddler(title);
    if (deleted || tiddler === undefined) return entry.hashes.has(title) || entry.visible(title, undefined);
    if (!entry.visible(title, tiddler)) return false;
    // THE SHORE'S ECHO MOVES NOTHING: a listed record whose hash still reads as the watch last read it re-runs no filter.
    return !(entry.hashes.has(title) && entry.hashes.get(title) === watchHashOf(title, tiddler));
  }

  private heard(changed: Record<string, { deleted?: boolean; modified?: boolean }>): void {
    // A WATCH RECORD THE BOOK MOVED BY ITS DIGEST ALONE re-runs no watch: only a watch that joins, leaves or changes its spec does.
    const titles = Object.keys(changed).filter((t) => !this.quiet.delete(t));
    for (const entry of [...this.entries.values()]) {
      if (!this.entries.has(entry.id)) continue;
      if (titles.some((t) => this.couldSee(entry, t, changed[t]?.deleted === true))) this.rerun(entry, false);
    }
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
