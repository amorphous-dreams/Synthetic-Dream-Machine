/**
 * tiddler-verbs — `wiki-filter` / `tiddler-get` / `wiki-render` / `tiddler-put` / `tiddler-delete` / `wiki-status`,
 * the TIDDLER DOOR: every act TiddlyWiki defines over one record or one wiki's engine, answered by the island's own
 * `$tw` and never by a second parser (lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout #/a-lean, Shape D, lane 1).
 *
 * The contract every skin (this, the CLI's `lares tiddler|wiki`, the MCP seat's `tiddler_*|wiki_*`) carries verbatim:
 *
 *   wiki-filter    { recipe, filter, fields?, after?, limit?, maxBytes? } → { recipe, filter, titles | rows, total, next, asOf, withheld? }
 *   tiddler-get    { recipe, title, meme?, grain?, slot?, after?, fields?, maxBytes? }
 *                                                                         → { has, recipe, title, lens, tiddler?: { fields, hash, textHash, bag, position, family?, orphan?, omitted? } | null,
 *                                                                             meme?: { uri, text?, canonicalHash, bytes, slots, slot?, page? }, grain, next, note? }
 *   wiki-render    { recipe, title | text, type?, form?, after?, maxBytes? } → { recipe, title, form, text, bytes, truncated, next }
 *   tiddler-put    { recipe, title, text?, fields?, unset?, tagsAdd?, tagsRemove?, base?, create? }
 *                                                                         → { recipe, title, decision: put|noop|conflict|exists, bag, created, changed, hash, textHash, position, family? }
 *   tiddler-delete { recipe, title, base?, family?, mode? }               → { recipe, title, decision: removed|absent|conflict|refused, mode, tombstoned, retracted, hash?, refusal?, why?, consequence? }
 *   wiki-status    { recipe }                                             → { recipe, working, layers: [{ bag, mounted: writable|read-only|promotion-only, read, write, working?, why? }] }
 *
 * EVERY WIKI ITS ENGINE. `recipe: "default"` answers through the daemon island's live `$tw.wiki`, the daemon mount's daemon
 * wiki. `recipe: <slug>` answers through THAT wiki's own engine (`wiki-engine`: the one per-face engine machinery laid over
 * the wiki's recipe as the face sees it, its canon by reference, the shared working layer and the face's personal and draft
 * layers), which the island's door (`wikis`) composes on the first ask and closes when cold; a write lands in that engine's
 * write layer (`working`, or the face's `personal` where it holds no writer's seat). A wiki the door reaches no engine for
 * (no recipe names it, none of its layers stands for the face, or the island holds no door) refuses `wiki-unreached` by
 * name; `recipe: "daemon"` refuses the same way, since the daemon wiki answers to `default` alone. The container law of the
 * meme door holds (exactly one of `recipe` / `bag`, else `no-container`); a bag names no wiki and so no engine, and refuses
 * `wiki-not-anchored`.
 *
 * THE FENCES. The caller's face decides reach: every read asks the face's read cap on the anchor's working bag, and a
 * record another bag answers stays out where the face holds no read on that bag (`withheld` counts them). A filter and a
 * render COMPUTE over a reader's view of the wiki (`readerView`) that holds none of those records, so no operator and
 * no transclusion reads what the face may not: the gate stands inside the engine, never only on the answer. Every write
 * asks the Kahu predicate and the face's write cap on the bag the cascade lands in (wikis-first: the working layer).
 * A title that stays home (`offerWithheldTitle`: the temp and state namespaces, the control and secret homes, `cap/**`;
 * and the volatile VM plane, the daemon's own scratch and verb trail)
 * answers no read and takes no write. Every other record lands natively, as a person's edit in the wiki lands it: a `$:/`
 * title or tag, a module or plugin field and a script type alike (the island holds a document's code as data; its code
 * comes from the floor-admitted preloads alone). A RENDERED TIDDLER (`rendered-from`) takes no put and no delete here:
 * only the renderer writes it, and both refuse `rendered-derives`. THE ONE WALL A SEAT KEEPS: a seat-asked put carrying a
 * record the mesh's one executable-class list names refuses `seat-startup-offer` (it runs in the operator's tab), and the
 * operator's own hand lands it. No action string and no `tm-*` message rides this door (the `act` ask, phase 2).
 *
 * THE FAMILY LAW (`@lararium/mesh/family`) DECIDES WHERE A RECORD STANDS AND WHAT A DELETE MOVES. `position` and
 * `family` read through `familyOf`; a delete reads its `consequence` before anything lands, over the reader's view,
 * so a record the face may not read enters no consequence. A plain tiddler leaves. A meme root or slot answers its
 * consequence and `decision: "refused"` (`refusal: "tiddler-delete-in-a-family"`) unless the call names the family act
 * (`family: true`); with it the consequence's acts land as ONE change per layer. A slot its parent
 * calls by `kahea` refuses even then, since the parent's text would have to move: that rides `meme put`.
 *
 * A DELETE DELETES PLAINLY; ONLY A LOWER LAYER MAKES IT A CHOICE (lar:///ha.ka.ba/lares/api/pono/kapae #/core-cut). With
 * no `mode` named, each record leaves its own layer to absent (`mode: "plain"` in the answer): no tombstone rises and no
 * `.kapae` shadow lands on disk, since nothing beneath needs hiding. Where a lower layer holds the title too, or a member
 * rests in a layer this face cannot remove it from, the plain delete refuses `delete-mode-needed` and names both
 * meanings, and the caller names one. `kapae`: a tombstone in a writable layer at or above the working layer, which
 * shadows every record of the title beneath, so the wiki reads the title gone and the lower layers keep theirs. `reveal`:
 * the topmost record retracts to absent and the record beneath surfaces; it refuses `reveal-top-unwritable` where the
 * face cannot write the layer that holds the topmost record. Each act of the consequence names the layers that hold the
 * title (`holds`) and what the wiki reads afterward (`shadowed: [bags]` or `reveals: bag | null`). One mode covers a
 * whole family, and each layer takes its members as one change. A kāpae over a title the wiki reads absent still answers: a plain
 * delete retracts a tombstone that hides nothing, and a reveal retracts one that hides a lower record.
 *
 * EVERY ANSWER STAYS BOUNDED. A filter pages by rows and bytes under a cursor that names the answer it continues
 * (`pageFilterAnswer`, the one page law the record port's `filter` ask shares); a render and a get hold a byte cap.
 *
 * Runs daemon-side (a plain module, never a plugin tiddler).
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/tiddler-verbs
 */

import {
  NoWorkingLayerRefusal, VerbRefusal, verifyCidBytes, canonicalJsonBytes, refuseEffectLedgerWrite, refuseRenderedWrite, admitSeatExecutable, renderedWriteFault, requireKahuReach, RENDERED_DERIVES_REASON, sha256HexBytesSync, wikiSlotKindOf, DAEMON_WIKI_SLUG,
  type ChangeOrigin, type CompositeStore, type KahuReachSource, type LarTiddlerStore,
} from "@lararium/mesh";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import { consequence, familyOf, retractsOf, rootAddressOf, tombstonesOf, type Consequence, type DeleteMode, type FamilyPosition, type FamilyView } from "@lararium/mesh/family";
import { anchorBagOf, readBagStore, readContainer, type MemeVerbOptions } from "./meme-verbs.js";
import { isMemeRoot, readMeme, wikiFamilyView, stageMemeTitle, STAGE_PATH_SHAPE_CODE, STAGE_MEME_PREFIX, type MemeSink } from "./place-meme.js";
import { READ_PAGE_BYTES, byteLength, cardBase, memeBase, readBase, grainOf, hasLine, memeGradient, param, slotHasLines, tagTokens, type GrainEcho, type ReadGrain } from "./read-gradient.js";
import { skinnyCid } from "./lazy-resolver.js";
import { readCarrierShape } from "./carrier-shape.js";
import type { TiddlerFields } from "./deserializer.js";
import { staysHome } from "./stay-home.js";
import { canonFiltersText, functionPragmasOf, houseWidgetOf, refuseUnknownHouseOperators } from "./house-filters.js";
import { pageFilterAnswer, checkFilter, WIKI_FILTER_ROWS, WIKI_FILTER_BYTES, WIKI_ANSWER_BYTES_MAX, type FilterRow, type FilterWiki } from "./filter-page.js";
import { optionalStringArg, stringArg } from "./handler-args.js";
import type { TW5Engine } from "./tw5-vm.js";
import { wornOrigin } from "./verb-dispatcher.js";
import { wikiWearsNext } from "./island-recipe.js";
import type { VerbContext, VerbReactor } from "./verb-dispatcher.js";

export interface TiddlerVerbOptions extends Partial<Pick<MemeVerbOptions, "reach" | "slotStore" | "realmWritable" | "recipeOf" | "writeSlot" | "faceLane">> {
  readonly composite: CompositeStore;
  /** The daemon island's engine: its live `$tw.wiki` answers every verb here. Read lazily, at verb time. */
  readonly tw5: Pick<TW5Engine, "$tw">;
  /**
   * THE NAMED WIKIS' DOOR: a registered wiki's own engine under the island's worn face (`wiki-engine`), or null where the face
   * reaches no such wiki. `write` asks for the face's write layer of it (minted where none stands). Absent: every named wiki
   * refuses `wiki-unreached`.
   */
  readonly wikis?: { of(slug: string, need: { readonly write: boolean }): Promise<NamedWikiEngine | null> };
  /** Set on a named wiki's engine options alone: the wiki this engine composes. Absent: the daemon anchor. */
  readonly wiki?: { readonly slug: string; readonly gate?: string };
  readonly kahuReach?: KahuReachSource;
  /** A house canon bag's floor snapshot, where the floor this island mounted carries one (it rests public by CID). */
  readonly floorCanon?: (bag: string) => LarTiddlerStore | null;
  /** The corpus CAS, by CID alone: the `resolved` grain reads a pointer's bytes here and verifies them. Absent: a pointer answers its handle. */
  readonly resolveByCid?: (cid: string) => Promise<Uint8Array | null>;
}

/** What the named wikis' door answers: the wiki's own engine and composition, and the bag a read gates on where no write layer stands. */
export interface NamedWikiEngine {
  readonly tw5: Pick<TW5Engine, "$tw">;
  readonly composite: CompositeStore;
  readonly gate?: string;
}

// ── THE BOUNDS AND THE PAGE LAW live in `filter-page.ts`, the leaf the record port's `filter` ask shares ──

export { pageFilterAnswer, checkFilter, WIKI_FILTER_ROWS, WIKI_FILTER_BYTES, WIKI_ANSWER_BYTES_MAX } from "./filter-page.js";
export type { FilterPage, FilterPageQuery, FilterRow, FilterWiki } from "./filter-page.js";
/** The bytes one render or one get answers by default. */
export const WIKI_RENDER_BYTES = 65_536;

const utf8 = new TextEncoder();
const bytesOf = (value: unknown): number => utf8.encode(typeof value === "string" ? value : JSON.stringify(value)).length;
const digestOf = (value: unknown): string => sha256HexBytesSync(canonicalJsonBytes(value));

function countArg(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && /^[0-9]+$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  return Number.isInteger(n) && n >= 1 ? Math.max(min, Math.min(n, max)) : fallback;
}

/** A list argument: an array of names (the MCP seat), or one comma-joined string (the CLI). */
function namesArg(raw: unknown): string[] | null {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" && raw.trim() !== "" ? raw.split(",") : null;
  if (list === null) return null;
  return list.map((name) => String(name).trim()).filter((name) => name !== "");
}

const flagOn = (raw: unknown): boolean => raw === true || raw === "true" || raw === "1";

// ── THE ENGINE, AS THIS DOOR READS IT ─────────────────────────────────────────────────────────────────

interface EngineTiddler { fields: Record<string, unknown>; getFieldStrings(): Record<string, string> }
interface EngineWiki extends FilterWiki {
  filterTiddlers(filter: string): string[];
  getTiddler(title: string): EngineTiddler | undefined;
  tiddlerExists(title: string): boolean;
  addTiddler(tiddler: unknown): void;
  deleteTiddler(title: string): void;
  each(callback: (tiddler: EngineTiddler, title: string) => void): void;
  eachShadow(callback: (tiddler: EngineTiddler, title: string) => void): void;
  eachTiddlerPlusShadows(callback: (tiddler: EngineTiddler, title: string) => void): void;
  eachShadowPlusTiddlers(callback: (tiddler: EngineTiddler, title: string) => void): void;
  allTitles(): string[];
  allShadowTitles(): string[];
  renderText(outputType: string, textType: string, text: string, options?: { variables?: Record<string, string> }): string;
}
interface Engine {
  wiki: EngineWiki;
  Tiddler: new (...fields: Array<Record<string, unknown>>) => EngineTiddler;
  utils: { parseStringArray(value: string): string[] | null; stringifyList(list: readonly string[]): string };
}
const engineOf = (opts: TiddlerVerbOptions): Engine => opts.tw5.$tw as unknown as Engine;

const ORIGIN_BAG = "$origin-bag";
/** The config tiddler naming where a `lar:` save lands in a wiki (`island-recipe` seeds it). */
const CURRENT_WIKI_BAG = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";

/** A record's fields as strings, the host's residency stamp lifted off beside them. */
function readRecord(tiddler: EngineTiddler): { fields: Record<string, string>; bag: string | null } {
  const { [ORIGIN_BAG]: stamp, ...fields } = tiddler.getFieldStrings();
  return { fields, bag: typeof stamp === "string" && stamp !== "" ? stamp : null };
}

const sha = (value: string): string => `sha256-${value}`;
/** The base a writer hands back: a digest over every field the record carries (the residency stamp left out). */
const hashOf = (fields: Record<string, string>): string => sha(digestOf(fields));
const textHashOf = (fields: Record<string, string>): string | null =>
  typeof fields["text"] === "string" ? sha(sha256HexBytesSync(utf8.encode(fields["text"]))) : null;

// ── FAMILY POSITION ───────────────────────────────────────────────────────────────────────────────────

export type TiddlerPosition = FamilyPosition;

// ── THE GATES ─────────────────────────────────────────────────────────────────────────────────────────

interface Anchor {
  readonly engine: Engine;
  /** The bag the door gates on: the write layer, or (a named wiki's read where no write layer stands) its canon. */
  readonly bag: string;
  /** The wiki as the caller names it: `default`, or a named wiki's slug. Every answer carries it. */
  readonly recipe: string;
  /** The wiki's own slug: `daemon` for the anchor. */
  readonly slug: string;
}

const refuseUnreached = (verb: string, why: string): VerbRefusal =>
  new VerbRefusal("wiki-unreached", `wiki-unreached: ${verb} — ${why}; \`lares wiki list\` names the wikis this face reaches, and \`--recipe default\` names its daemon wiki.`);

/**
 * THE NAMED WIKI'S OPTIONS: where the call names a registered wiki, the options its own engine answers under, or null where
 * the anchor answers (`recipe: "default"`, a bag, or options already a named wiki's). A wiki the door reaches no engine for
 * refuses `wiki-unreached` before a cap ask, a read or a write.
 */
async function namedWikiOptions(opts: TiddlerVerbOptions, args: Readonly<Record<string, unknown>>, verb: string, write: boolean): Promise<TiddlerVerbOptions | null> {
  if (opts.wiki) return null;
  const target = readContainer(args, verb);
  if (target.recipe === null || target.recipe === "default") return null;
  const slug = target.recipe;
  if (slug === DAEMON_WIKI_SLUG) throw refuseUnreached(verb, `the daemon wiki answers to \`recipe: "default"\` alone`);
  if (!opts.wikis) throw refuseUnreached(verb, `this island holds no door to a named wiki's engine, so "${slug}" answers nothing here`);
  const engine = await opts.wikis.of(slug, { write });
  if (engine === null) throw refuseUnreached(verb, `no wiki "${slug}" this face reaches: no recipe names it, or none of its layers stands for this face`);
  const { wikis: _door, ...rest } = opts;
  return { ...rest, tw5: engine.tw5, composite: engine.composite, wiki: { slug, ...(engine.gate !== undefined ? { gate: engine.gate } : {}) } };
}

/** A reactor that answers the anchor itself, and a named wiki in that wiki's own engine. */
function everyWiki(verb: string, write: boolean, make: (opts: TiddlerVerbOptions) => VerbReactor): (opts: TiddlerVerbOptions) => VerbReactor {
  return (opts) => {
    const anchor = make(opts);
    return async (args, ctx) => {
      const named = await namedWikiOptions(opts, args, verb, write);
      return named ? make(named)(args, ctx) : anchor(args, ctx);
    };
  };
}

/** The wiki this call reaches: the container law, then the anchor or the named wiki these options compose. */
function wikiOf(opts: TiddlerVerbOptions, args: Readonly<Record<string, unknown>>, verb: string): { readonly recipe: string; readonly slug: string } {
  const target = readContainer(args, verb);
  const recipe = opts.wiki?.slug ?? "default";
  if (target.recipe !== recipe) {
    const write = /^tiddler-(put|delete)$/.test(verb);
    const door = write
      ? "A bag takes a record through the meme door: `lares meme put --bag <slug>` · `lares meme delete --bag <slug>`."
      : "A bag reads through its own doors: `lares tiddler get <title> --bag <slug>` (one record; `--meme` a meme) · `lares meme list --bag <slug>` (its roots).";
    const named = target.bag ? `bag "${target.bag}" names one bag and no wiki` : `wiki "${target.recipe}" names another engine than this one`;
    throw new VerbRefusal("wiki-not-anchored", `wiki-not-anchored: ${verb} runs in a wiki's own engine; ${named}. ${door} To use ${verb}, name the wiki: \`--recipe <slug>\` (\`recipe: "default"\` for the daemon wiki).`);
  }
  return { recipe, slug: opts.wiki?.slug ?? DAEMON_WIKI_SLUG };
}

/** The bag a named wiki's engine routes a `lar:` save to, or "" where no write layer stands. */
function writeLayerOf(opts: TiddlerVerbOptions): string {
  const wiki = opts.tw5.$tw.wiki as { getTiddlerText?: (title: string, fallback?: string) => string };
  return wiki.getTiddlerText?.(CURRENT_WIKI_BAG, "") ?? "";
}

/** The container law, then the anchor: the daemon wiki, or the named wiki these options compose. */
function anchorOf(opts: TiddlerVerbOptions, args: Readonly<Record<string, unknown>>, verb: string, write = false): Anchor {
  const { recipe, slug } = wikiOf(opts, args, verb);
  if (!opts.wiki) return { engine: engineOf(opts), bag: anchorBagOf(opts), recipe, slug };
  const layer = writeLayerOf(opts);
  if (layer) return { engine: engineOf(opts), bag: layer, recipe, slug };
  if (write || opts.wiki.gate === undefined) {
    throw new NoWorkingLayerRefusal(`The ${verb} into wiki "${slug}"`, "This face holds no layer of the wiki a write lands in (no writer's seat in its workbench and no personal layer of it).");
  }
  return { engine: engineOf(opts), bag: opts.wiki.gate, recipe, slug };
}

/**
 * True for a title that stays home: it answers no read here and takes no write. The volatile VM plane
 * (`lar:///lararium.local.vm/…`) stays home with the temp namespaces: it holds the daemon VM's own scratch, the verb
 * trail among it (each call's invocation rests at `…/verbs/<requestId>` while its reactor runs), never shared truth.
 * A read that counted it would move the answer it reads, and a paged filter would refuse its own cursor on every call.
 */


function refuseWithheld(title: string, verb: string): void {
  if (staysHome(title)) throw new VerbRefusal("tiddler-withheld", `tiddler-withheld: "${title}" stays home (a temp, state, volatile-VM, control, secret or cap/** title); ${verb} neither reads nor writes it.`);
}

/**
 * THE CALLER'S FACE DECIDES REACH. The door's own gate asks the face's read cap on the anchor's working bag. Past it, a
 * record names the bag that answered it (`$origin-bag`): the face reads that record where it holds a read on that bag,
 * where the bag's floor snapshot rests public, or where the bag names the daemon wiki's own device-local temp slot.
 * A record with no stamp belongs to the engine itself (a shadow, a boot tiddler). One ask per bag per verb.
 */
async function reachOf(opts: TiddlerVerbOptions, anchor: Anchor, cap: VerbContext["cap"]): Promise<(bag: string | null) => Promise<boolean>> {
  const proof = await cap("read", anchor.bag);
  if (!proof.ok) throw new Error(`cap-denied: read on ${anchor.bag} required (${proof.reason ?? "no reason"})`);
  const memo = new Map<string, Promise<boolean>>([[anchor.bag, Promise.resolve(true)]]);
  return (bag) => {
    if (bag === null) return Promise.resolve(true);
    let known = memo.get(bag);
    if (!known) {
      known = (async () => wikiSlotKindOf(anchor.slug, bag) === "temp" || (await cap("read", bag)).ok || (opts.floorCanon?.(bag) ?? null) !== null)();
      memo.set(bag, known);
    }
    return known;
  };
}

/** Whether the face reads a record: its title leaves home, and the bag that answered it stands outside `hidden`. */
type Visible = (title: string, tiddler: EngineTiddler | undefined) => boolean;

/**
 * THE READER'S VIEW: the island's own wiki, minus every record the session's face may not read. A filter operator and
 * a widget reach records through the wiki they run on (`getTiddler`, the `each` iterators, the title lists), so a
 * gate on the ANSWER alone would let `[[withheld]get[text]]` or `{{withheld}}` carry a hidden record's words out as a
 * value. The view inherits the engine's wiki (one engine, never a second parser) and answers those reads itself; a
 * record outside the face's reach reads as absent to every operator, text reference and transclusion that runs on it.
 * It keeps caches of its own, so a filter compiled or a parse cached on the whole wiki never answers here, and it
 * lives for one verb call. The wiki's indexes (tags, fields, backlinks) still name hidden TITLES; the verb's answer
 * gate drops those and counts them `withheld`. Writes never ride the view.
 */
function readerView(wiki: EngineWiki, visible: Visible, house?: { text: string; document: { createElement(tag: string): unknown } } | null): EngineWiki {
  const view = Object.create(wiki) as EngineWiki & Record<string, unknown>;
  view["filterCache"] = Object.create(null);
  view["filterCacheCount"] = 0;
  view["caches"] = Object.create(null);
  view["globalCache"] = Object.create(null);
  const shown = (title: string): boolean => visible(title, wiki.getTiddler(title));
  view.getTiddler = (title) => { const tiddler = wiki.getTiddler(title); return tiddler && visible(title, tiddler) ? tiddler : undefined; };
  view.tiddlerExists = (title) => wiki.tiddlerExists(title) && shown(title);
  view.each = (callback) => wiki.each((tiddler, title) => { if (visible(title, tiddler)) callback(tiddler, title); });
  view.eachShadow = (callback) => wiki.eachShadow((tiddler, title) => { if (visible(title, tiddler)) callback(tiddler, title); });
  view.eachTiddlerPlusShadows = (callback) => wiki.eachTiddlerPlusShadows((tiddler, title) => { if (visible(title, tiddler)) callback(tiddler, title); });
  view.eachShadowPlusTiddlers = (callback) => wiki.eachShadowPlusTiddlers((tiddler, title) => { if (visible(title, tiddler)) callback(tiddler, title); });
  view.allTitles = () => wiki.allTitles().filter(shown);
  view.allShadowTitles = () => wiki.allShadowTitles().filter(shown);
  if (house) {
    // THE HOUSE'S FUNCTIONS COME FROM CANON ALONE: a filter run with no widget of its own runs under the widget the canon
    // carrier's text builds (house-filters), never under the wiki's `$:/tags/Global` imports, which a working-layer record shadows.
    let widget: unknown;
    const run = wiki.filterTiddlers as unknown as (this: unknown, filter: string, widget?: unknown, source?: unknown) => string[];
    view["filterTiddlers"] = (filter: string, given?: unknown, source?: unknown): string[] => {
      refuseUnknownHouseOperators(filter);
      if (given === undefined) {
        // EVERY FILTER THE CALLER GIVES NO WIDGET RUNS UNDER THE HOUSE WIDGET, an indirect one (`[subfilter{$:/x}]`) included.
        widget ??= houseWidgetOf(view as never, house.document, house.text);
        given = widget;
      }
      return run.call(view, filter, given, source);
    };
  }
  return view;
}

/**
 * The view a read verb computes over, and the predicate that built it. The door's own gate runs first (`reachOf`); then
 * each bag any record names answers the face's reach once, so the predicate itself reads no cap and stays synchronous
 * inside the engine.
 */
async function viewFor(opts: TiddlerVerbOptions, anchor: Anchor, cap: VerbContext["cap"]): Promise<{ view: EngineWiki; visible: Visible; mayRead: (bag: string | null) => Promise<boolean>; pragmas: string }> {
  const mayRead = await reachOf(opts, anchor, cap);
  const wiki = anchor.engine.wiki;
  const bags = new Set<string>();
  wiki.each((tiddler) => { const bag = tiddler.fields[ORIGIN_BAG]; if (typeof bag === "string" && bag !== "") bags.add(bag); });
  const hidden = new Set<string>();
  for (const bag of bags) if (!(await mayRead(bag))) hidden.add(bag);
  const visible: Visible = (title, tiddler) => !staysHome(title) && !hidden.has(String(tiddler?.fields[ORIGIN_BAG] ?? ""));
  const text = await canonFiltersText(opts.composite, wiki, mayRead);
  const document = (engineOf(opts) as unknown as { fakeDocument?: { createElement(tag: string): unknown } }).fakeDocument;
  return { view: readerView(wiki, visible, document ? { text, document } : null), visible, mayRead, pragmas: functionPragmasOf(text) };
}

/**
 * THE FAMILY VIEW THIS DOOR READS THROUGH: the one family law over a wiki (the reader's view, so a hidden record
 * enters no reading), lent the anchor's layer facts. Every write at the anchor lands in the working layer, so a record
 * another layer answers takes its tombstone there as a shadow; a record's version reads as the `hash` a writer holds.
 */
function familyViewAt(anchor: Anchor, wiki: EngineWiki, layers?: LayerFacts): FamilyView {
  return wikiFamilyView(wiki as never, {
    bagOf: (title) => {
      const top = layers?.of.get(title)?.[0];
      if (top) return top.bag;
      const tiddler = wiki.getTiddler(title);
      return tiddler ? (readRecord(tiddler).bag ?? anchor.bag) : null;
    },
    writable: (bag) => (layers ? layers.writable.has(bag) : bag === anchor.bag),
    workingBag: () => anchor.bag,
    ...(layers ? { layersOf: (title: string) => layers.of.get(title) ?? [] } : {}),
    version: (title) => { const tiddler = wiki.getTiddler(title); return tiddler ? hashOf(readRecord(tiddler).fields) : null; },
  });
}

/** What the composition holds for a delete's candidates: each title's layers, topmost first, and the layers this face's delete may write. */
interface LayerFacts {
  readonly of: Map<string, Array<{ bag: string; state: "live" | "kapae" }>>;
  readonly writable: Set<string>;
}

/** The layers a delete reads (topmost first, minus those the face may not read) and the ones its delete may write. */
async function layerReach(
  opts: TiddlerVerbOptions, anchor: Anchor, cap: VerbContext["cap"], mayRead: (bag: string | null) => Promise<boolean>, asker?: VerbContext["asker"],
): Promise<{ readable: string[]; writable: Set<string> }> {
  const composite = opts.composite;
  const stack = [...composite.layerIds].reverse();
  const workingIndex = composite.layerIndexOf(anchor.bag);
  const writable = new Set<string>();
  const readable: string[] = [];
  for (const bag of stack) {
    if (!(await mayRead(bag))) continue;
    readable.push(bag);
    if (!composite.hasWritableBag(bag) || workingIndex < 0 || composite.layerIndexOf(bag) < workingIndex) continue;
    try {
      await requireKahuReach(bag, opts.kahuReach, "tiddler delete", asker);
      if ((await cap("admin", bag)).ok) writable.add(bag);
    } catch { /* a layer the Kahu predicate keeps from this hand takes no delete of its */ }
  }
  return { readable, writable };
}

/**
 * THE LAYERS A DELETE READS. For the target and every title that composes onto its root address (the only titles a
 * component can hold): each mounted layer that holds a record, topmost first, live or a raised kāpae, minus the layers
 * the face may not read. A layer takes this face's delete where the island mounts it writable at or above the working
 * layer (a tombstone shadows only from above, and a canon layer beneath takes no hand's delete: the adaptor's own rule)
 * and the Kahu predicate and the face's write cap both admit it.
 */
async function layerFactsFor(
  opts: TiddlerVerbOptions, anchor: Anchor, cap: VerbContext["cap"], view: EngineWiki, mayRead: (bag: string | null) => Promise<boolean>, title: string,
  asker?: VerbContext["asker"],
): Promise<LayerFacts> {
  const composite = opts.composite;
  const { readable, writable } = await layerReach(opts, anchor, cap, mayRead, asker);
  const address = rootAddressOf(title);
  const prefix = `${address}#`;
  const of: LayerFacts["of"] = new Map();
  for (const candidate of view.allTitles()) {
    if (candidate !== title && candidate !== address && !candidate.startsWith(prefix)) continue;
    const held: Array<{ bag: string; state: "live" | "kapae" }> = [];
    for (const bag of readable) {
      const record = await composite.storeForBag(bag)?.get(candidate);
      if (record) held.push({ bag, state: record.meta?.deleted ? "kapae" : "live" });
    }
    of.set(candidate, held);
  }
  return { of, writable };
}

/** Where a title stands, as an answer names it: its position, its family's root, and whether it stands orphaned. */
function placeOf(anchor: Anchor, wiki: EngineWiki, title: string): { position: TiddlerPosition; family: string | null; orphan: boolean } {
  const reading = familyOf(familyViewAt(anchor, wiki), title);
  return { position: reading.position, family: reading.root, orphan: reading.orphan };
}
const placeFields = (place: { position: TiddlerPosition; family: string | null; orphan: boolean }): Record<string, unknown> =>
  ({ position: place.position, ...(place.family ? { family: place.family } : {}), ...(place.orphan ? { orphan: true } : {}) });

/** The write gate, in the meme door's own order: the Kahu predicate, then the face's write cap on the landing bag. */
async function requireWrite(opts: TiddlerVerbOptions, anchor: Anchor, cap: VerbContext["cap"], verb: string, asker?: VerbContext["asker"]): Promise<void> {
  await requireKahuReach(anchor.bag, opts.kahuReach, verb, asker);
  const proof = await cap("admin", anchor.bag);
  if (!proof.ok) throw new Error(`cap-denied: admin on ${anchor.bag} required (${proof.reason ?? "no reason"})`);
}

// ── wiki-filter ───────────────────────────────────────────────────────────────────────────────────────

export const makeWikiFilterReactor = everyWiki("wiki-filter", false, (opts: TiddlerVerbOptions): VerbReactor => {
  return async (args, ctx) => {
    const anchor = anchorOf(opts, args, "wiki-filter");
    const filter = stringArg(args, "filter");
    if (!filter.trim()) throw new Error("wiki-filter: args.filter is required (a TiddlyWiki filter, e.g. \"[tag[memory]sort[title]]\")");
    const { view, visible } = await viewFor(opts, anchor, ctx.cap);
    const wiki = anchor.engine.wiki;
    checkFilter(view, filter);
    // The filter runs on the reader's view; the answer gate then drops a hidden TITLE an index still named.
    const answered = view.filterTiddlers(filter);
    const titles: string[] = [];
    let withheld = 0;
    for (const title of answered) {
      if (visible(title, wiki.getTiddler(title))) titles.push(title);
      else withheld++;
    }
    const names = namesArg(args["fields"]);
    const rowOf = names === null ? undefined : (title: string): FilterRow => {
      const tiddler = view.getTiddler(title);
      const held = tiddler ? readRecord(tiddler).fields : {};
      const fields: Record<string, string> = {};
      for (const name of names) if (typeof held[name] === "string") fields[name] = held[name]!;
      return { title, fields };
    };
    const page = pageFilterAnswer(titles, {
      after: optionalStringArg(args, "after"),
      limit: countArg(args["limit"], WIKI_FILTER_ROWS, 1, WIKI_FILTER_ROWS),
      maxBytes: countArg(args["maxBytes"], WIKI_FILTER_BYTES, 64, WIKI_ANSWER_BYTES_MAX),
      ...(rowOf ? { rowOf } : {}),
    });
    return {
      recipe: anchor.recipe, filter,
      ...(page.rows ? { rows: page.rows } : { titles: page.titles }),
      total: page.total, next: page.next, asOf: page.asOf,
      ...(withheld > 0 ? { withheld } : {}),
    };
  };
});

// ── tiddler-get ───────────────────────────────────────────────────────────────────────────────────────

/** A slot's own title under its root: `#/name`, with the `#/` supplied where a caller wrote the bare name. */
function slotTitle(root: string, slot: string): string {
  return `${root}${slot.startsWith("#") ? slot : `#/${slot.replace(/^\/+/, "")}`}`;
}

/** What a get answers of a record: the named fields, or every field less the text the grain leaves home, under the byte cap (the largest fields leave first, by name). */
function narrowRecord(fields: Record<string, string>, title: string, args: Readonly<Record<string, unknown>>, textHome: boolean, carryWhole = false): { shown: Record<string, string>; omitted: string[] } {
  const names = namesArg(args["fields"]);
  const omitted: string[] = [];
  let shown: Record<string, string> = fields;
  if (names !== null) {
    shown = { title };
    for (const name of names) if (typeof fields[name] === "string") shown[name] = fields[name]!;
  } else if (textHome && typeof fields["text"] === "string") {
    const { text: _text, ...rest } = fields;
    shown = rest;
    omitted.push("text");
  }
  // THE BYTE CAP: the largest fields leave first, by name, and the hashes still speak for the whole record. AN EXPLICIT FAT (or
  // whole, or resolved) READ CARRIES THE RECORD WHOLE: the gradient's default answers the card past a page, so a caller who asks
  // for the text gets it, unless it names its own cap.
  const maxBytes = countArg(args["maxBytes"], WIKI_ANSWER_BYTES_MAX, 256, WIKI_ANSWER_BYTES_MAX);
  if (!(carryWhole && args["maxBytes"] === undefined) && bytesOf(shown) > maxBytes) {
    shown = { ...shown };
    for (const name of Object.keys(shown).filter((n) => n !== "title").sort((x, y) => bytesOf(shown[y]) - bytesOf(shown[x]))) {
      if (bytesOf(shown) <= maxBytes) break;
      delete shown[name];
      omitted.push(name);
    }
  }
  return { shown, omitted };
}

/** Base64 of raw bytes, engine-agnostic (no Buffer on a browser island). */
function base64Of(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** The pointer fields a has line carries verbatim. */
const POINTER_FIELDS = ["_canonical_uri", "textCid", "_integrity", "size"] as const;

/** A POINTER: a record that names its body by address (`_canonical_uri`, `textCid`, `_is_skinny`) and holds no text of it. */
const isPointer = (fields: Record<string, string>): boolean =>
  typeof fields["text"] !== "string" && (typeof fields["_canonical_uri"] === "string" || typeof fields["textCid"] === "string" || fields["_is_skinny"] !== undefined);

/** A blob type: a body TiddlyWiki carries as base64 (an image, a font, a binary), which a read leaves home unless asked. */
function isBlob(engine: Engine, fields: Record<string, string>): boolean {
  const type = fields["type"] ?? "";
  const info = (engine as unknown as { config?: { contentTypeInfo?: Record<string, { encoding?: string }> } }).config?.contentTypeInfo;
  return info?.[type]?.encoding === "base64" || /^(image|audio|video|font)\//.test(type) || fields["encoding"] === "base64";
}

/** Where an answer came from, as the has line's provenance names it: the wiki (and the layer that answered) or the bag. */
interface Provenance { readonly recipe?: string; readonly bag?: string; readonly layer?: string | null; readonly floor?: boolean }
const provenanceParams = (from: Provenance): string[] => [
  ...(from.recipe !== undefined ? [param("recipe", from.recipe)] : []),
  ...(from.bag !== undefined ? [param("bag", from.bag)] : []),
  ...(from.layer ? [param("layer", from.layer)] : []),
  ...(from.floor ? [param("floor", true)] : []),
];

/** The record's has line: provenance, the record's own tags, the wire's measure keys, the pointer fields verbatim, the tagline. */
function recordHas(title: string, fields: Record<string, string>, from: Provenance, place: { position: string; family?: string | null }, base: string): string {
  const measures = [
    ...(fields["type"] ? [param("type", fields["type"])] : []),
    param("position", place.position),
    ...(place.family && place.family !== title ? [param("family", place.family)] : []),
    ...(typeof fields["text"] === "string" ? [param("bytes", byteLength(fields["text"]))] : []),
    param("base", base),
    ...POINTER_FIELDS.filter((name) => typeof fields[name] === "string" && fields[name] !== "").map((name) => param(name, fields[name]!)),
  ];
  return hasLine(title, [...provenanceParams(from), ...tagTokens(fields["tags"]), ...measures], fields["description"] ?? fields["role"] ?? fields["caption"]);
}

/** The ports a read reaches beyond the engine: the corpus CAS, by CID alone (a web2 address names its body and never fetches). */
type CasPort = TiddlerVerbOptions["resolveByCid"];

/** What the record lens answers: the fields it shows, what it left home, and the grain it applied and why. */
interface RecordRead {
  readonly fields: Record<string, string>;
  readonly shown: Record<string, string>;
  readonly omitted: string[];
  readonly grain: GrainEcho;
  readonly next: { readonly grain: ReadGrain } | null;
}

/**
 * THE RECORD LENS ON THE GRADIENT. No grain named: a pointer answers its handle (the name travels, the body stays home); a blob
 * answers skinny (the blob law); a record whose text fits one page answers fat; a longer one answers skinny, with `next` naming
 * fat. `skinny` leaves the text home; `fat` (and `whole`) carries it; `handle` names a pointer's body; `resolved` (and `whole`) reads a pointer's
 * bytes from the local CAS by CID and verifies them, and a web2 `_canonical_uri` stays named, never fetched. A body grain on a
 * record that holds its text inline answers fat and says why; the record lens reads no slot grain beyond the slot's own record.
 */
async function recordRead(engine: Engine, held: Record<string, string>, title: string, args: Readonly<Record<string, unknown>>, asked: ReadGrain | null, cas: CasPort): Promise<RecordRead> {
  const named = namesArg(args["fields"]) !== null;
  const done = (fields: Record<string, string>, applied: ReadGrain, why: string, next: RecordRead["next"]): RecordRead => {
    const carryWhole = asked === "fat" || asked === "whole" || applied === "resolved";
    const { shown, omitted } = narrowRecord(fields, title, args, applied === "skinny", carryWhole);
    // THE ECHO NAMES WHAT RODE. At the tiddler grain, fat only where the text rode (named fields or the byte cap may leave it home);
    // a pointer's body grain (handle, resolved) stays its own word whatever the fields.
    const tiddlerGrain = applied === "fat" || applied === "skinny";
    const rode: ReadGrain = tiddlerGrain ? (typeof shown["text"] === "string" ? "fat" : "skinny") : applied;
    return { fields, shown, omitted, grain: { asked, applied: rode, why: named ? `the named fields (${rode === "fat" ? "the text among them" : "the text left home"})` : rode === applied ? why : `${why}; the byte cap left the text home` }, next };
  };
  if (isPointer(held)) {
    const cid = skinnyCid(held);
    const web2 = cid === null && typeof held["_canonical_uri"] === "string";
    // `whole` on a pointer asks for the whole body: the body grain's own word for it reads `resolved`.
    if (asked === "resolved" || asked === "whole") {
      if (web2) return done(held, "handle", `a web2 \`_canonical_uri\` names the body and the door never fetches it (web3 only): ${held["_canonical_uri"]}`, null);
      if (cid === null) return done(held, "handle", "the pointer names no CID to resolve", null);
      const bytes = cas ? await cas(cid) : null;
      if (!bytes) return done(held, "handle", cas ? `the local CAS holds no bytes for ${cid}` : "this island holds no CAS shore to resolve from", null);
      if (!verifyCidBytes(bytes, cid)) return done(held, "handle", `the bytes the local CAS holds for ${cid} hash otherwise: refused, never spliced`, null);
      const text = isBlob(engine, held) ? base64Of(bytes) : new TextDecoder().decode(bytes);
      return done({ ...held, text }, "resolved", `the body resolved from the local CAS by CID ${cid}, verified`, null);
    }
    const why = web2 ? "a pointer: its web2 `_canonical_uri` names the body, never fetched" : "a pointer: the handle names its body by CID";
    return done(held, "handle", asked === null || asked === "handle" ? why : `${why}; the tiddler grain reads no body a record does not hold`, web2 || cid === null ? null : { grain: "resolved" });
  }
  if (asked === "skinny") return done(held, "skinny", "asked: the fields, the text left home", { grain: "fat" });
  if (asked === "fat" || asked === "whole") return done(held, "fat", "asked: the record with its text", null);
  if (asked === "handle" || asked === "resolved") return done(held, "fat", `the record holds its body inline: no handle to read, so the record whole`, null);
  if (asked === "slot") return done(held, "fat", "the slot's own record", null);
  if (isBlob(engine, held)) return done(held, "skinny", "a blob: its body stays home (the blob law)", { grain: "fat" });
  const bytes = typeof held["text"] === "string" ? byteLength(held["text"]) : 0;
  if (bytes <= READ_PAGE_BYTES) return done(held, "fat", `fits one page (${bytes} of ${READ_PAGE_BYTES} bytes)`, null);
  return done(held, "skinny", `the text runs past one page (${bytes} of ${READ_PAGE_BYTES} bytes): the fields first`, { grain: "fat" });
}

/** A record lens answer: the has line first, then the record with its grain and next. */
function recordAnswer(from: Provenance & { readonly answered: Record<string, unknown> }, title: string, read: RecordRead, bag: string | null, place: { position: TiddlerPosition; family?: string | null; orphan?: boolean }, note?: string): Record<string, unknown> {
  // A CARD'S BASE NAMES THE CARD: an answer that left the text home hands a marked base, which no text write takes.
  const hash = cardBase(hashOf(read.fields), typeof read.fields["text"] === "string" && typeof read.shown["text"] !== "string");
  return {
    has: recordHas(title, read.fields, from, place, hash),
    ...from.answered, title, lens: "record",
    tiddler: {
      fields: read.shown, hash, textHash: textHashOf(read.fields), bag, position: place.position,
      ...(place.family ? { family: place.family } : {}), ...(place.orphan ? { orphan: true } : {}),
      ...(read.omitted.length > 0 ? { omitted: read.omitted } : {}),
    },
    grain: read.grain, next: read.next,
    ...(note ? { note } : {}),
  };
}

/**
 * THE MEME LENS: the root and its slot children recomposed into one carrier, sealed by its bcc, on the gradient (`memeGradient`).
 * A title that names a slot child recomposes from its root and points at the slot. A record that holds no meme answers the record
 * with a plain line saying so (graceful, never a refusal); a pointer root answers its handle. Every answer carries `base/` (the
 * canonical hash `meme patch --base` takes); a skinny answer carries one has line per top-level slot beneath the root's.
 */
async function memeAnswer(
  engine: Engine, sink: Pick<MemeSink, "titles" | "read">, from: Provenance & { readonly answered: Record<string, unknown> }, named: string,
  args: Readonly<Record<string, unknown>>, asked: ReadGrain | null, cas: CasPort, placeOfTitle: (title: string, fields: Record<string, string>) => { position: TiddlerPosition; family?: string | null; orphan?: boolean },
  withheld = 0,
): Promise<Record<string, unknown>> {
  const slotArg = optionalStringArg(args, "slot");
  const root = rootAddressOf(named);
  const pointed = named !== root && named.includes("#") ? named.slice(root.length) : null;
  const slot = slotArg ? (slotArg.startsWith("#") ? slotArg : `#/${slotArg.replace(/^\/+/, "")}`) : pointed;
  const rootHeld = await sink.read(root);
  const fieldsOf = (record: Record<string, unknown>): Record<string, string> => {
    const fields = new engine.Tiddler(record).getFieldStrings();
    delete fields[ORIGIN_BAG];
    return fields;
  };
  if (!rootHeld || !isMemeRoot(root, rootHeld)) {
    const held = rootHeld ?? (await sink.read(named));
    if (!held) return { ...from.answered, title: named, lens: "meme", tiddler: null };
    const title = rootHeld ? root : named;
    const fields = fieldsOf(held as Record<string, unknown>);
    const read = await recordRead(engine, fields, title, args, asked === "whole" || asked === "slot" ? null : asked, cas);
    return recordAnswer(from, title, read, from.layer ?? from.bag ?? null, placeOfTitle(title, fields), `${title} holds no meme: the record answers`);
  }
  const rootFields = fieldsOf(rootHeld as Record<string, unknown>);
  if (isPointer(rootFields)) {
    const read = await recordRead(engine, rootFields, root, args, asked === "resolved" ? "resolved" : "handle", cas);
    return recordAnswer(from, root, read, from.layer ?? from.bag ?? null, placeOfTitle(root, rootFields), `${root} holds a pointer: its body rests in the content tier`);
  }
  const meme = await readMeme(root, sink);
  if (meme === null) return { ...from.answered, title: root, lens: "meme", tiddler: null };
  const read = memeGradient(meme, { grain: asked, after: optionalStringArg(args, "after"), slot });
  const base = memeBase(meme.canonicalHash, read, slot);
  const measures = [param("type", CARRIER_TYPE), param("position", "root"), param("slots", read.slots.length), param("bytes", read.bytes), param("base", base)];
  const rootLine = hasLine(root, [...provenanceParams(from), ...tagTokens(rootFields["tags"]), ...measures], rootFields["description"] ?? rootFields["role"]);
  const lines = read.grain.applied === "skinny" ? [rootLine, ...slotHasLines(read.slots)] : [rootLine];
  // THE COMPOSITION READING rides a whole carrier answered in one: the join of a root and its slots is where a two-headed carrier
  // comes into being, so the read names its faults (report, never refuse; `child-grade-decision.mem` #/measured rows 11, 13).
  const shape = read.text !== undefined && !read.page && read.grain.applied === "whole" ? readCarrierShape(read.text) : null;
  // A SLOT'S SPAN RIDES `slotText`, a name no JSON reader mistakes for the whole carrier; the whole (or a page of it) rides `text`.
  const carried = read.text === undefined ? {} : read.grain.applied === "slot" ? { slotText: read.text } : { text: read.text };
  return {
    has: lines.join("\n"),
    ...from.answered, title: root, lens: "meme",
    meme: {
      uri: root, ...carried, canonicalHash: base, bytes: read.bytes,
      slots: read.slots, ...(slot ? { slot } : {}), ...(read.page ? { page: read.page } : {}),
    },
    grain: read.grain, next: read.next,
    ...(shape && shape.faults.length > 0 ? { shape: { check: shape.marks.check, faults: shape.faults } } : {}),
    // THE RECOMPOSITION NAMES WHAT IT LEFT OUT: slot records this face may not read never enter the carrier, and the answer says so.
    ...(withheld > 0 ? { withheld, note: `${withheld} slot record${withheld === 1 ? "" : "s"} of this meme ${withheld === 1 ? "rests" : "rest"} in a layer this face may not read: withheld from the carrier, which reads short of them` } : {}),
  };
}

/**
 * A BAG'S RECORD, READ FROM THAT ONE BAG. The reach and the read gate are the meme door's own (`readBagStore`: a mounted layer, an
 * instance slot, a bag by access, the floor snapshot where the face holds no read on a live house canon document, which the answer
 * names with `floor: true`). The record answers as the wiki door answers one: fields as TiddlyWiki writes them, `hash`, `textHash`,
 * the `bag`, and a `position` the bag's own titles decide (a title with `#` titles below it stands a root, one with `#/` in it a slot).
 * The answer names the bag in place of a wiki (`recipe` stays out), since no engine ran.
 */
async function bagGet(
  opts: TiddlerVerbOptions, container: ReturnType<typeof readContainer>, title: string, args: Readonly<Record<string, unknown>>, ctx: VerbContext, asked: ReadGrain | null,
): Promise<Record<string, unknown>> {
  const origin: ChangeOrigin = { kind: "lares-verb", requestId: ctx.invocation.requestId, ...wornOrigin(ctx.worn) };
  const { bag, sink, floor } = await readBagStore(opts as unknown as MemeVerbOptions, container.bag!, container.realm, origin, ctx.cap);
  const engine = engineOf(opts);
  const from = { bag, floor: floor === true, answered: { bag, ...(floor ? { floor: true } : {}) } };
  const titles = await sink.titles();
  const placeIn = (t: string): { position: TiddlerPosition; family?: string | null } => {
    const root = rootAddressOf(t);
    const position: TiddlerPosition = titles.some((x) => x.startsWith(`${t}#`)) ? "root" : t.includes("#") && root !== t ? "slot" : "plain";
    return { position, ...(position === "slot" ? { family: root } : {}) };
  };
  if (flagOn(args["meme"])) return memeAnswer(engine, sink, from, title, args, asked, opts.resolveByCid, placeIn);
  const held = await sink.read(title);
  if (!held) return { ...from.answered, title, tiddler: null };
  const fields = new engine.Tiddler(held as Record<string, unknown>).getFieldStrings();
  delete fields[ORIGIN_BAG];
  const read = await recordRead(engine, fields, title, args, asked, opts.resolveByCid);
  return recordAnswer(from, title, read, bag, placeIn(title));
}

/**
 * A WORD THE LENS OR THE GRAIN DOES NOT READ REFUSES BY NAME (`read-word-unread`), before anything reads: an answer that silently
 * dropped a word would misreport what it applied. `after` continues the meme's whole carrier alone; `fields` and `maxBytes` narrow a
 * record and no carrier; a slot names one slot, which neither the has-stack (skinny) nor the whole carrier reads.
 */
function refuseUnreadWords(args: Readonly<Record<string, unknown>>, title: string, lens: boolean, asked: ReadGrain | null, slot: string | null): void {
  const unread = (word: string, why: string): VerbRefusal =>
    new VerbRefusal("read-word-unread", `read-word-unread: tiddler-get reads no \`${word}\` here; ${why}. Nothing was read.`);
  if (!lens && optionalStringArg(args, "after")) throw unread("after", "a cursor continues a meme's whole carrier (`meme: true`, `--meme --all`), and a record answers in one");
  if (lens && args["fields"] !== undefined) throw unread("fields", "the meme lens answers the carrier, never a field subset; drop `meme` to narrow the record");
  if (lens && args["maxBytes"] !== undefined) throw unread("maxBytes", "the meme lens pages its carrier on slot boundaries; the byte cap narrows a record alone");
  const slotted = slot !== null || (title.includes("#/") && rootAddressOf(title) !== title);
  if (lens && slotted && (asked === "skinny" || asked === "whole")) throw unread("slot", `a slot names one slot, and the ${asked === "skinny" ? "has-stack" : "whole carrier"} reads them all; drop the slot, or the grain`);
}

export const makeTiddlerGetReactor = everyWiki("tiddler-get", false, (opts: TiddlerVerbOptions): VerbReactor => {
  return async (args, ctx) => {
    const container = readContainer(args, "tiddler-get");
    const named = stringArg(args, "title");
    if (!named) throw new Error("tiddler-get: args.title is required (the tiddler's title; a meme's root lar: URI beside `slot` reads one slot)");
    const asked = grainOf(args["grain"]);
    const lens = flagOn(args["meme"]);
    const slot = optionalStringArg(args, "slot");
    refuseUnreadWords(args, named, lens, asked, slot);
    // The meme lens reads the slot inside the recomposed carrier; the record lens reads the slot's own record.
    const title = slot && !lens ? slotTitle(named, slot) : named;
    // A BAG NAMES ONE STORE AND NO WIKI: the record reads from that bag through the meme door's own reach and read gate.
    if (container.bag !== null) {
      refuseWithheld(title, "tiddler-get");
      return await bagGet(opts, container, title, args, ctx, asked);
    }
    const anchor = anchorOf(opts, args, "tiddler-get");
    refuseWithheld(title, "tiddler-get");
    const { view, mayRead } = await viewFor(opts, anchor, ctx.cap);
    const engine = anchor.engine;
    const wiki = engine.wiki;
    const answered = { recipe: anchor.recipe };
    const placeIn = (t: string): { position: TiddlerPosition; family?: string | null; orphan?: boolean } => placeOf(anchor, view, t);
    if (lens) {
      // The meme lens reads through the reader's view, so a record this face may not read enters no carrier.
      const top = wiki.getTiddler(rootAddressOf(title)) ?? wiki.getTiddler(title);
      const bag = top ? readRecord(top).bag : null;
      if (top && !(await mayRead(bag))) throw new Error(`cap-denied: read on ${bag} required (the bag that answers "${title}")`);
      const sink = { titles: () => view.allTitles(), read: (t: string) => (view.getTiddler(t) as { fields?: TiddlerFields } | undefined)?.fields };
      const prefix = `${rootAddressOf(title)}#`;
      const withheld = wiki.allTitles().filter((t) => t.startsWith(prefix) && !staysHome(t) && !view.tiddlerExists(t)).length;
      return memeAnswer(engine, sink, { recipe: anchor.recipe, layer: bag, answered }, title, args, asked, opts.resolveByCid, placeIn, withheld);
    }
    const tiddler = wiki.getTiddler(title);
    if (!tiddler) return { ...answered, title, tiddler: null };
    const { fields, bag } = readRecord(tiddler);
    if (!(await mayRead(bag))) throw new Error(`cap-denied: read on ${bag} required (the bag that answers "${title}")`);
    const read = await recordRead(engine, fields, title, args, asked, opts.resolveByCid);
    return recordAnswer({ recipe: anchor.recipe, layer: bag, answered }, title, read, bag, placeIn(title));
  };
});

// ── wiki-render ───────────────────────────────────────────────────────────────────────────────────────

/** TiddlyWiki carries its global definitions through a filter, never the store: a raw render imports them itself. */
const GLOBAL_IMPORT = "\\import [all[shadows+tiddlers]tag[$:/tags/Global]!is[draft]]\n";
const WIKITEXT = "text/vnd.tiddlywiki";
const RENDER_FORMS: Readonly<Record<string, string>> = { text: "text/plain", html: "text/html" };

export const makeWikiRenderReactor = everyWiki("wiki-render", false, (opts: TiddlerVerbOptions): VerbReactor => {
  return async (args, ctx) => {
    const anchor = anchorOf(opts, args, "wiki-render");
    const title = optionalStringArg(args, "title");
    const span = typeof args["text"] === "string" && args["text"] !== "" ? args["text"] : null;
    if ((title === null) === (span === null)) throw new Error("wiki-render: name exactly one of args.title (a tiddler to render) or args.text (a wikitext span to wikify)");
    const form = optionalStringArg(args, "form") ?? "text";
    const outputType = RENDER_FORMS[form];
    if (!outputType) throw new Error(`wiki-render: args.form reads "text" or "html"; got "${form}"`);
    if (title !== null) refuseWithheld(title, "wiki-render");
    const { view, mayRead, pragmas } = await viewFor(opts, anchor, ctx.cap);
    // THE HOUSE'S FUNCTIONS RIDE AFTER THE GLOBAL IMPORT, from canon alone: a working-layer `$:/tags/Global` tiddler never shadows one.
    const globals = pragmas === "" ? GLOBAL_IMPORT : `${GLOBAL_IMPORT}${pragmas}\n\n`;
    const wiki = anchor.engine.wiki;
    let rendered: string;
    if (title !== null) {
      const tiddler = wiki.getTiddler(title);
      if (!tiddler) throw new VerbRefusal("tiddler-absent", `tiddler-absent: no tiddler stands at "${title}" in wiki "${anchor.recipe}"; wiki-render renders a title that stands, or a span passed as args.text.`);
      const { bag } = readRecord(tiddler);
      if (!(await mayRead(bag))) throw new Error(`cap-denied: read on ${bag} required (the bag that answers "${title}")`);
      rendered = view.renderText(outputType, WIKITEXT,
        // The blank lines keep the wrapper in block mode, so no stray paragraph wraps the tiddler's own blocks.
        `${globals}<$tiddler tiddler=<<lares-render-title>>>\n\n<$transclude $tiddler=<<lares-render-title>> $mode="block"/>\n\n</$tiddler>`,
        { variables: { "lares-render-title": title } });
    } else {
      const type = optionalStringArg(args, "type") ?? WIKITEXT;
      // The carrier type reads as a superset of wikitext, so the import pragma leads both; any other type renders as it stands.
      rendered = view.renderText(outputType, type, type === WIKITEXT || type === CARRIER_TYPE ? `${globals}${span}` : span!);
    }
    // THE BYTE CAP, WITH A CURSOR: the cursor names the render it continues (an offset and the render's digest), so a
    // wiki that moved between two pages refuses by name and never splices two renders.
    const asOf = sha256HexBytesSync(utf8.encode(rendered)).slice(0, 16);
    let offset = 0;
    const after = optionalStringArg(args, "after");
    if (after !== null) {
      const cursor = /^([0-9]{1,9})\.([0-9a-f]{16})$/.exec(after);
      if (!cursor) throw new VerbRefusal("render-cursor-malformed", `render-cursor-malformed: "${after}" reads as no cursor; hand back a render's own \`next\`, or drop \`after\`.`);
      if (cursor[2] !== asOf) throw new VerbRefusal("render-cursor-stale", "render-cursor-stale: the wiki moved and this render reads otherwise now; drop `after` and render again.");
      offset = Math.min(Number(cursor[1]), rendered.length);
    }
    const maxBytes = countArg(args["maxBytes"], WIKI_RENDER_BYTES, 16, WIKI_ANSWER_BYTES_MAX);
    let end = offset;
    let size = 0;
    while (end < rendered.length) {
      const point = rendered.codePointAt(end)!;
      const cost = point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
      if (size + cost > maxBytes && end > offset) break;
      size += cost;
      end += point > 0xffff ? 2 : 1;
    }
    return {
      recipe: anchor.recipe, title, form, text: rendered.slice(offset, end), bytes: bytesOf(rendered),
      truncated: end < rendered.length, next: end < rendered.length ? `${end}.${asOf}` : null,
    };
  };
});

// ── tiddler-put ───────────────────────────────────────────────────────────────────────────────────────

/** The stage meme law (`place-meme.ts`), on a plain record: a title under the memory stage reads one or two lowercase path segments. */
function refuseMalformedStagePath(title: string): void {
  if (!title.startsWith(STAGE_MEME_PREFIX)) return;
  try { stageMemeTitle(title.slice(STAGE_MEME_PREFIX.length)); }
  catch (fault) { throw new VerbRefusal(STAGE_PATH_SHAPE_CODE, fault instanceof Error ? `${fault.message} (${title})` : String(fault)); }
}

/** The field patch a put names: string values alone, at most 256 of them. */
function patchArg(raw: unknown): Record<string, string> {
  if (raw === undefined || raw === null || raw === "") return {};
  let value: unknown = raw;
  if (typeof raw === "string") {
    try { value = JSON.parse(raw); }
    catch { throw new VerbRefusal("fields-malformed", "fields-malformed: args.fields reads as a JSON object of field names to string values."); }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new VerbRefusal("fields-malformed", "fields-malformed: args.fields reads as an object of field names to string values.");
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 256) throw new VerbRefusal("fields-malformed", "fields-malformed: a put names at most 256 fields.");
  for (const [name, held] of entries) {
    if (name.trim() === "" || typeof held !== "string") throw new VerbRefusal("fields-malformed", `fields-malformed: field "${name}" must carry a string value (a list rides as TiddlyWiki writes it, e.g. "one [[two words]]").`);
  }
  return value as Record<string, string>;
}

export const makeTiddlerPutReactor = everyWiki("tiddler-put", true, (opts: TiddlerVerbOptions): VerbReactor => {
  return async (args, ctx) => {
    const anchor = anchorOf(opts, args, "tiddler-put", true);
    const title = stringArg(args, "title");
    if (!title) throw new Error("tiddler-put: args.title is required");
    refuseWithheld(title, "tiddler-put");
    refuseEffectLedgerWrite(title, "tiddler-put");
    await requireWrite(opts, anchor, ctx.cap, "tiddler put", ctx.asker);
    const { wiki, utils, Tiddler } = anchor.engine;
    const standing = wiki.getTiddler(title);
    const held = standing ? readRecord(standing) : null;
    const { view, mayRead } = await viewFor(opts, anchor, ctx.cap);
    if (held && !(await mayRead(held.bag))) throw new Error(`cap-denied: read on ${held.bag} required (the bag that answers "${title}")`);
    const before = held?.fields ?? null;
    const liveHash = before ? hashOf(before) : null;
    const place = standing ? placeOf(anchor, view, title) : { position: "plain" as TiddlerPosition, family: null, orphan: false };
    const answer = (decision: string, more: Record<string, unknown>): Record<string, unknown> =>
      ({ recipe: anchor.recipe, title, decision, bag: anchor.bag, ...more, ...placeFields(place) });

    // CREATE-ONLY ON REQUEST, and the base where one rides: either answers before any field moves.
    if (flagOn(args["create"]) && wiki.tiddlerExists(title)) return answer("exists", { created: false, changed: [], hash: liveHash, textHash: before ? textHashOf(before) : null });
    // A TEXT WRITE BY ANY PATH: `text`, a field patch naming `text`, or an unset of it. A card's base takes none of them.
    const writesText = typeof args["text"] === "string" || Object.prototype.hasOwnProperty.call(patchArg(args["fields"]), "text") || (namesArg(args["unset"]) ?? []).includes("text");
    const base = readBase(optionalStringArg(args, "base"), "tiddler-put", writesText);
    if (base !== null && base !== liveHash) return answer("conflict", { created: false, changed: [], hash: liveHash, textHash: before ? textHashOf(before) : null });

    // THE PATCH: named fields set, named fields unset, tags added and removed; the text moves only where the caller names it.
    const patch = patchArg(args["fields"]);
    if (patch["title"] !== undefined && patch["title"] !== title) throw new VerbRefusal("fields-malformed", "fields-malformed: a put never re-titles; `fields.title` must match args.title or stay absent.");
    const next: Record<string, string> = { ...(before ?? {}), ...patch, title };
    if (typeof args["text"] === "string") next["text"] = args["text"];
    for (const name of namesArg(args["unset"]) ?? []) if (name !== "title") delete next[name];
    const listArg = (raw: unknown): string[] => Array.isArray(raw) ? raw.map(String) : typeof raw === "string" ? (utils.parseStringArray(raw) ?? []) : [];
    const add = listArg(args["tagsAdd"]);
    const remove = new Set(listArg(args["tagsRemove"]));
    let tags = utils.parseStringArray(next["tags"] ?? "") ?? [];
    if (add.length > 0 || remove.size > 0) {
      tags = [...tags.filter((tag) => !remove.has(tag)), ...add.filter((tag) => !tags.includes(tag) && !remove.has(tag))];
      if (tags.length > 0) next["tags"] = utils.stringifyList(tags); else delete next["tags"];
    }
    if (bytesOf(next) > 1_048_576) throw new VerbRefusal("fields-malformed", "fields-malformed: one record carries at most 1048576 bytes through this door.");

    // THE FAMILY FENCE. A meme root or slot takes a field or tag patch here; its text, its type and its carriage fields
    // move through the meme door, which re-splits the family and re-mints its block check. A new record never joins a
    // family here either.
    const moved = (name: string): boolean => (before?.[name] ?? undefined) !== (next[name] ?? undefined);
    const structural = Object.keys({ ...(before ?? {}), ...next }).filter((name) => moved(name) && (name === "text" || name === "type" || name.startsWith("$")));
    const joinsFamily = !standing && (next["type"] === CARRIER_TYPE || next["$fragment-parent"] !== undefined);
    if ((place.position !== "plain" && structural.length > 0) || joinsFamily) {
      throw new VerbRefusal("tiddler-put-in-a-family", `tiddler-put-in-a-family: use the meme door. "${title}" ${joinsFamily ? "would land as a carrier or a slot" : `stands as a meme ${place.position} and this put moves ${structural.map((n) => `\`${n}\``).join(", ")}`}; \`lares meme put\` (meme_put) lands a family's text through the Confluence gate. A field or tag patch on a standing root or slot lands here.`);
    }
    // ONLY THE RENDERER WRITES A RENDERED TIDDLER: a put over one, or one that would land carrying `rendered-from`, refuses.
    refuseRenderedWrite(title, before, next, "tiddler put");
    refuseMalformedStagePath(title);

    const changed = Object.keys({ ...(before ?? {}), ...next }).filter(moved);
    if (standing && changed.length === 0) return answer("noop", { created: false, changed, hash: liveHash, textHash: textHashOf(before!) });
    // THE ONE WALL A SEAT KEEPS: a seat's executable record offers, or lands spending one return of a standing exec lei.
    await admitSeatExecutable(title, next, "tiddler put", ctx.asker, { wiki: anchor.recipe, port: ctx.execLei });
    // The record lands through the live wiki, so the in-wiki cascade routes it to the working layer as a person's edit would.
    // THE FACE CROSSES THE HOP: the shore's write of this title carries the session's worn face on its origin.
    wikiWearsNext(opts.tw5, title, wornOrigin(ctx.worn).face);
    wiki.addTiddler(new Tiddler(next));
    const landed = readRecord(wiki.getTiddler(title)!).fields;
    return answer("put", { created: !standing, changed, hash: hashOf(landed), textHash: textHashOf(landed) });
  };
});

// A row names a verified floor shadow and the sole record its native action may change.
// The caller supplies values only; no action text or message name crosses this door.
interface AdmittedWikiAction {
  readonly title: string;
  readonly target: string;
  readonly values: readonly string[];
}
const ADMITTED_WIKI_ACTIONS: Readonly<Record<string, AdmittedWikiAction>> = {
  "sidebar-layout": {
    title: "$:/core/ui/KeyboardShortcuts/change-sidebar-layout",
    target: "$:/themes/tiddlywiki/vanilla/options/sidebarlayout",
    values: ["fixed-fluid", "fluid-fixed"],
  },
};

export const makeWikiActionReactor = everyWiki("wiki-action", true, (opts: TiddlerVerbOptions): VerbReactor => {
  return async (args, ctx) => {
    const allowed = new Set(["recipe", "name", "expected", "resulting"]);
    const unknown = Object.keys(args).find((key) => !allowed.has(key));
    if (unknown) throw new VerbRefusal("wiki-action-parameter", `wiki-action-parameter: unknown parameter "${unknown}"`);
    const name = stringArg(args, "name");
    const action = Object.hasOwn(ADMITTED_WIKI_ACTIONS, name) ? ADMITTED_WIKI_ACTIONS[name] : undefined;
    if (!action) throw new VerbRefusal("wiki-action-unknown", `wiki-action-unknown: no admitted action "${name}"`);
    const expected = stringArg(args, "expected");
    const resulting = stringArg(args, "resulting");
    if (!action.values.includes(expected) || !action.values.includes(resulting) || expected === resulting)
      throw new VerbRefusal("wiki-action-parameter", `wiki-action-parameter: ${name} needs distinct admitted expected and resulting layout values`);
    const anchor = anchorOf(opts, args, "wiki-action", true);
    refuseWithheld(action.target, "wiki-action");
    refuseEffectLedgerWrite(action.target, "wiki-action");
    await requireWrite(opts, anchor, ctx.cap, "wiki action", ctx.asker);
    const wiki = anchor.engine.wiki as EngineWiki & {
      isShadowTiddler(title: string): boolean;
      getShadowSource(title: string): string | undefined;
      getTiddlerText(title: string, fallback?: string): string;
    };
    // A tiddler overriding the shadow would move the action bytes outside the pinned floor.
    if (!wiki.isShadowTiddler(action.title) || wiki.tiddlerExists(action.title) || wiki.getShadowSource(action.title) !== "$:/core")
      throw new VerbRefusal("wiki-action-origin", `wiki-action-origin: "${action.title}" needs its unoverridden floor shadow`);
    const { view } = await viewFor(opts, anchor, ctx.cap);
    const before = view.getTiddler(action.target);
    const beforeFields = before ? readRecord(before).fields : null;
    const observed = beforeFields?.["text"] ?? "";
    if (observed !== expected)
      return { has: hasLine(name, [param("recipe", anchor.recipe), param("decision", "conflict")]), recipe: anchor.recipe, name,
        title: action.target, decision: "conflict", expected, observed, resulting: observed };

    // The native widget receives a one-call copy-on-write view. Its add/delete ports can
    // record only this row's target, so no mutation reaches the authoritative wiki yet.
    let candidate: EngineTiddler | null = null;
    let changed = 0;
    const sandbox = Object.create(view) as EngineWiki;
    sandbox.addTiddler = (record) => {
      const next = record as EngineTiddler;
      if (next.fields["title"] !== action.target || ++changed > 1)
        throw new VerbRefusal("wiki-action-scope", `wiki-action-scope: ${name} tried a change outside its single admitted target`);
      candidate = next;
    };
    sandbox.deleteTiddler = () => { throw new VerbRefusal("wiki-action-scope", `wiki-action-scope: ${name} tried to delete a record`); };
    const root = (opts.tw5.$tw as unknown as { rootWidget: { wiki: EngineWiki; invokeActionString(s: string): void } }).rootWidget;
    const widget = Object.create(root) as typeof root;
    widget.wiki = sandbox;
    widget.invokeActionString(wiki.getTiddlerText(action.title));
    const nextFields = candidate ? readRecord(candidate).fields : null;
    if (changed !== 1 || nextFields?.["text"] !== resulting)
      throw new VerbRefusal("wiki-action-result", `wiki-action-result: ${name} did not produce the requested layout`);
    const put = await makeTiddlerPutReactor(opts)({ recipe: anchor.recipe, title: action.target,
      text: resulting, ...(beforeFields ? { base: hashOf(beforeFields) } : { create: true }) }, ctx);
    return { has: hasLine(name, [param("recipe", anchor.recipe), param("decision", String(put["decision"]))]),
      recipe: anchor.recipe, name, action: action.title, title: action.target, expected,
      resulting: put["decision"] === "put" ? resulting : observed, decision: put["decision"],
      receipt: ctx.invocation.requestId, change: put };
  };
});

// ── tiddler-delete ────────────────────────────────────────────────────────────────────────────────────

export const makeTiddlerDeleteReactor = everyWiki("tiddler-delete", true, (opts: TiddlerVerbOptions): VerbReactor => {
  return async (args, ctx) => {
    const anchor = anchorOf(opts, args, "tiddler-delete", true);
    const title = stringArg(args, "title");
    if (!title) throw new Error("tiddler-delete: args.title is required");
    refuseWithheld(title, "tiddler-delete");
    refuseEffectLedgerWrite(title, "tiddler-delete");
    await requireWrite(opts, anchor, ctx.cap, "tiddler delete", ctx.asker);
    const named = optionalStringArg(args, "mode");
    if (named !== null && named !== "kapae" && named !== "reveal") {
      throw new VerbRefusal("delete-mode-unknown", `delete-mode-unknown: args.mode reads "kapae" (a tombstone that keeps a lower layer's record of the title hidden) or "reveal" (the topmost record retracts and the one beneath surfaces); got "${named}". Name none for a plain delete.`);
    }
    const wiki = anchor.engine.wiki;
    const standing = wiki.tiddlerExists(title) ? wiki.getTiddler(title) : undefined;
    if (!standing) return await retractBareKapae(opts, anchor, args, ctx, title, named);
    const { fields, bag } = readRecord(standing);
    const { view, mayRead } = await viewFor(opts, anchor, ctx.cap);
    if (!(await mayRead(bag))) throw new Error(`cap-denied: read on ${bag} required (the bag that answers "${title}")`);
    const hash = hashOf(fields);

    // A PLAIN DELETE where no mode is named: the record leaves its own layer and nothing stays set aside. It reads as
    // a reveal that reveals nothing, so the reveal's consequence answers it; where a lower layer would surface, or a
    // member rests in a layer this face cannot retract from, the delete refuses `delete-mode-needed` below.
    const mode: DeleteMode = named === "kapae" ? "kapae" : "reveal";
    const modeName = named ?? "plain";

    // THE FAMILY LAW DECIDES WHAT A DELETE MOVES: the consequence gets read first, over the reader's view and the
    // layers the composition holds, and a refusal lands nothing. The read stays meme-aware (never `bare`): this door
    // strands no slot.
    const layers = await layerFactsFor(opts, anchor, ctx.cap, view, mayRead, title, ctx.asker);
    const read: Consequence = consequence(familyViewAt(anchor, view, layers), { kind: "delete", title, mode });
    const refused = (refusal: string, why: string): Record<string, unknown> =>
      ({ recipe: anchor.recipe, title, decision: "refused", mode: modeName, refusal, why: `${refusal}: ${why}`, tombstoned: [], retracted: [], hash, consequence: read });
    const tombstones = tombstonesOf(read);
    const retracts = retractsOf(read);
    const moves = tombstones.length + retracts.length;
    if (read.position !== "plain" && !flagOn(args["family"])) {
      return refused("tiddler-delete-in-a-family", `"${title}" stands as a meme ${read.position} of ${read.family}; this delete would move ${moves} record${moves === 1 ? "" : "s"} (the consequence names each). Name the family act (\`family: true\`, \`--family\`) to land it as one change, or use \`lares meme delete ${read.family}\` (meme_delete).`);
    }
    const rendered = renderedWriteFault(title, fields, null, "tiddler delete");
    if (rendered !== null) return refused(RENDERED_DERIVES_REASON, rendered.slice(RENDERED_DERIVES_REASON.length + 2) + " Nothing moved.");
    if (named === null) {
      // THE DEFAULT NEVER CHOOSES FOR A LOWER LAYER. A record of the title beneath the one this delete removes (or a
      // record this face cannot retract at all) makes the delete a choice between hiding it and letting it surface.
      const kept = read.refusals.find((row) => row.code === "reveal-top-unwritable")?.title
        ?? read.leaves.find((row) => row.why.startsWith("reveal-keeps:"))?.title;
      if (kept !== undefined) {
        const rests = layers.of.get(kept)?.find((layer) => layer.state === "live")?.bag ?? bag ?? "a lower layer";
        return refused("delete-mode-needed", `"${kept}" rests in ${rests}, a layer this face's delete cannot remove it from, so a plain delete would leave it standing. \`--mode kapae\` (\`mode: "kapae"\`) raises a tombstone in ${anchor.bag} that hides it; ${rests} keeps its record. Nothing moved.`);
      }
      const beneath = read.acts.find((row) => row.act === "retract" && typeof row.reveals === "string");
      if (beneath !== undefined) {
        return refused("delete-mode-needed", `"${beneath.title}" also stands in ${beneath.reveals} beneath the record in ${beneath.bag}, so this delete must name what happens to it: \`--mode kapae\` (\`mode: "kapae"\`) raises a tombstone that keeps it hidden; \`--mode reveal\` (\`mode: "reveal"\`) removes the record in ${beneath.bag} and lets ${beneath.reveals}'s surface. Nothing moved.`);
      }
      // AN UNREAD LAYER BENEATH COUNTS AS HOLDING THE TITLE: a recipe slot the composer could not reach, or a stand-in for a
      // document the vessel has not read, may hold any record (recipe-layer-model#/the-delete), so the plain delete asks.
      const unread = read.acts.find((row) => row.act === "retract" && opts.composite.unknownBeneath?.(row.bag ?? anchor.bag) === true);
      if (unread !== undefined) {
        return refused("delete-mode-needed", `"${unread.title}" may also stand in an unread layer beneath ${unread.bag ?? anchor.bag} (a recipe slot this composition could not reach, or a document this vessel has not read yet), so this delete must name what happens to it: \`--mode kapae\` (\`mode: "kapae"\`) raises a tombstone that keeps any such record hidden; \`--mode reveal\` (\`mode: "reveal"\`) removes the record in ${unread.bag ?? anchor.bag} and lets whatever stands beneath surface. Nothing moved.`);
      }
    }
    if (read.refusals.length > 0) {
      const first = read.refusals[0]!;
      const why = first.code === "reveal-top-unwritable"
        ? `a reveal retracts the topmost record of "${first.title}", and this face writes no record in the layer that holds it (${layers.of.get(first.title)?.[0]?.bag ?? "none"}); \`mode: "kapae"\` shadows it from the working layer instead. Nothing moved.`
        : `"${first.title}" refuses this delete; nothing moved.`;
      return refused(first.code, why);
    }
    // A slot its parent calls leaves with the call: the parent's text would move, and a family's text moves through the meme door.
    const dangling = read.acts.find((row) => row.act === "put") ?? read.leaves.find((row) => row.why === "reference-dangles:kahea");
    if (dangling) {
      return refused("tiddler-delete-in-a-family", `"${title}" stands as a slot "${dangling.title}" calls by \`kahea\`; the call leaves with the slot, and a family's text moves through the meme door: \`lares meme put ${read.family}\` (meme_put) with the slot's block gone.`);
    }
    // A record no mounted layer holds (the engine's own, or a wiki with no store beneath it) has nothing to retract.
    const unheld = named === "reveal" ? read.acts.find((row) => row.act === "retract" && (row.holds?.length ?? 0) === 0) : undefined;
    if (unheld) return refused("reveal-top-unwritable", `no mounted layer holds a record of "${unheld.title}", so a reveal has nothing to retract; \`mode: "kapae"\` removes it. Nothing moved.`);
    const base = readBase(optionalStringArg(args, "base"), "tiddler-delete", false);
    if (base !== null && base !== hash) return { recipe: anchor.recipe, title, decision: "conflict", mode: modeName, tombstoned: [], retracted: [], hash };

    // THE LANDING: each layer takes its members as ONE change (tombstones and retracts together), and the shore lands
    // that change in the wiki as one grain. A record no layer holds leaves through the live wiki, as a hand's delete.
    const origin: ChangeOrigin = { kind: "lares-verb", requestId: ctx.invocation.requestId, ...wornOrigin(ctx.worn) };
    const perBag = new Map<string, { tombstones: string[]; retracts: string[] }>();
    const byHand: string[] = [];
    for (const row of read.acts) {
      if (row.act !== "tombstone" && row.act !== "retract") continue;
      if (row.bag === null || (row.holds?.length ?? 0) === 0 || !opts.composite.hasWritableBag(row.bag)) { byHand.push(row.title); continue; }
      const group = perBag.get(row.bag) ?? { tombstones: [], retracts: [] };
      (row.act === "tombstone" ? group.tombstones : group.retracts).push(row.title);
      perBag.set(row.bag, group);
    }
    for (const [landing, group] of perBag) {
      await opts.composite.writeFamily([], group.tombstones, origin, { bag: landing as never, ...(group.retracts.length > 0 ? { retracts: group.retracts } : {}) });
    }
    for (const member of byHand) { wikiWearsNext(opts.tw5, member, wornOrigin(ctx.worn).face); wiki.deleteTiddler(member); }
    return { recipe: anchor.recipe, title, decision: "removed", mode: modeName, tombstoned: tombstones, retracted: retracts, hash, consequence: read };
  };
});

/**
 * A TOMBSTONE OVER A TITLE THE WIKI READS ABSENT still answers a delete. Where the wiki reads the title absent and a layer this
 * face may write holds a raised kāpae over it, a plain delete (or a reveal) retracts that kāpae to absent: the title
 * reads as it did before the kāpae rose, and the projector lowers its shadow file. A kāpae that hides a live record
 * beneath it (or over an unread layer: `unknownBeneath`) retracts only under `mode: "reveal"`, since the record would surface; no mode named refuses
 * `delete-mode-needed`, and `mode: "kapae"` answers absent (the kāpae it asks for already stands). A root address takes
 * its tombstoned slots with it only under `family: true`, as a standing family does.
 */
async function retractBareKapae(
  opts: TiddlerVerbOptions, anchor: Anchor, args: Record<string, unknown>, ctx: VerbContext, title: string, named: string | null,
): Promise<Record<string, unknown>> {
  const absent = { recipe: anchor.recipe, title, decision: "absent", tombstoned: [], retracted: [] };
  if (named === "kapae") return absent;
  const { mayRead } = await viewFor(opts, anchor, ctx.cap);
  const { readable, writable } = await layerReach(opts, anchor, ctx.cap, mayRead, ctx.asker);
  const recordsOf = async (candidate: string): Promise<Array<{ bag: string; state: "live" | "kapae" }>> => {
    const held: Array<{ bag: string; state: "live" | "kapae" }> = [];
    for (const bag of readable) {
      const record = await opts.composite.storeForBag(bag)?.get(candidate);
      if (record) held.push({ bag, state: record.meta?.deleted ? "kapae" : "live" });
    }
    return held;
  };
  /** The retract a candidate takes: its topmost record, where that record stands as a kāpae in a layer this face writes. */
  const retractOf = async (candidate: string) => {
    const held = await recordsOf(candidate);
    const top = held[0];
    if (top === undefined || top.state !== "kapae" || !writable.has(top.bag)) return null;
    const beneath = held[1];
    return { title: candidate, act: "retract" as const, bag: top.bag, holds: held.filter((layer) => layer.state === "live").map((layer) => layer.bag),
      // An unread layer beneath (`unknownBeneath`) counts as holding a record the kāpae hides.
      reveals: beneath !== undefined && beneath.state === "live" ? beneath.bag : opts.composite.unknownBeneath?.(top.bag) === true ? "an unread layer" : null };
  };
  const target = await retractOf(title);
  if (target === null) return absent;
  // The slots a root address held, tombstoned with it: each layer this face writes names its own.
  const slots = new Set<string>();
  if (rootAddressOf(title) === title) {
    for (const bag of writable) {
      const store = opts.composite.storeForBag(bag) as (LarTiddlerStore & { listTombstoned?: () => string[] }) | null | undefined;
      for (const candidate of store?.listTombstoned?.() ?? []) if (candidate.startsWith(`${title}#`)) slots.add(candidate);
    }
  }
  const acts = [target];
  for (const slot of [...slots].sort()) { const row = await retractOf(slot); if (row !== null) acts.push(row); }
  const consequence = { act: "delete", target: title, position: acts.length > 1 ? "root" : "plain", family: acts.length > 1 ? title : null, acts, leaves: [], orphans: [], refusals: [] };
  const mode = named ?? "plain";
  const refused = (refusal: string, why: string): Record<string, unknown> =>
    ({ recipe: anchor.recipe, title, decision: "refused", mode, refusal, why: `${refusal}: ${why}`, tombstoned: [], retracted: [], consequence });
  if (acts.length > 1 && !flagOn(args["family"])) {
    return refused("tiddler-delete-in-a-family", `"${title}" stands as a kāpae over a meme root whose ${acts.length - 1} slot${acts.length === 2 ? "" : "s"} stand tombstoned with it; name the family act (\`family: true\`, \`--family\`) to retract them as one change. Nothing moved.`);
  }
  const surfacing = acts.find((row) => row.reveals !== null);
  if (surfacing !== undefined && named !== "reveal") {
    return refused("delete-mode-needed", `the kāpae over "${surfacing.title}" in ${surfacing.bag} hides a record in ${surfacing.reveals}; \`--mode reveal\` (\`mode: "reveal"\`) retracts the kāpae and lets ${surfacing.reveals}'s surface, and \`--mode kapae\` keeps it hidden (it already stands). Nothing moved.`);
  }
  const origin: ChangeOrigin = { kind: "lares-verb", requestId: ctx.invocation.requestId, ...wornOrigin(ctx.worn) };
  const perBag = new Map<string, string[]>();
  for (const row of acts) perBag.set(row.bag, [...(perBag.get(row.bag) ?? []), row.title]);
  for (const [landing, retracts] of perBag) await opts.composite.writeFamily([], [], origin, { bag: landing as never, retracts });
  return { recipe: anchor.recipe, title, decision: "removed", mode, tombstoned: [], retracted: acts.map((row) => row.title), consequence };
}

/** Whether `bag` stands as this wiki's canon: a named wiki's gate, else the daemon wiki's per-face canon (`bags/daemon-<F>`). */
function isCanonLayer(opts: TiddlerVerbOptions, slug: string, bag: string): boolean {
  if (opts.wiki !== undefined) return opts.wiki.gate === bag;
  return slug === DAEMON_WIKI_SLUG && /^lar:\/\/\/ha\.ka\.ba\/bags\/daemon-[^/]+$/.test(bag);
}

// ── wiki-status ───────────────────────────────────────────────────────────────────────────────────────

export const makeWikiStatusReactor = everyWiki("wiki-status", false, (opts: TiddlerVerbOptions): VerbReactor => {
  return async (args, ctx) => {
    const { recipe, slug } = wikiOf(opts, args, "wiki-status");
    // A wiki with no working layer attached still answers its status: `working` reads null and no layer takes a write.
    let working: string | null = null;
    if (opts.wiki) working = writeLayerOf(opts) || null;
    else { try { working = anchorBagOf(opts); } catch { working = null; } }
    const layers: Array<Record<string, unknown>> = [];
    for (const bag of opts.composite.layerIds) {
      // CANON TAKES NO LANE WRITE: it mounts writable so a promotion (an ACTION verb) can land in it, and `defaultWritable: false` keeps
      // every put off it (`recipe-layer-model` #/the-recipe-stack). Status names it `promotion-only`, never a writable door.
      if (isCanonLayer(opts, slug, bag) && opts.composite.hasWritableBag(bag)) {
        const read = (await ctx.cap("read", bag)).ok || (opts.floorCanon?.(bag) ?? null) !== null;
        layers.push({ bag, mounted: "promotion-only", read, write: false });
        continue;
      }
      const mounted = opts.composite.hasWritableBag(bag);
      const read = (await ctx.cap("read", bag)).ok || (opts.floorCanon?.(bag) ?? null) !== null || wikiSlotKindOf(slug, bag) === "temp";
      let write = false;
      let why: string | undefined;
      if (mounted) {
        try {
          await requireKahuReach(bag, opts.kahuReach, "wiki status", ctx.asker);
          const proof = await ctx.cap("admin", bag);
          write = proof.ok;
          if (!proof.ok) why = proof.reason ?? "cap-denied";
        } catch (fault) { why = fault instanceof Error ? fault.message : String(fault); }
      }
      layers.push({ bag, mounted: mounted ? "writable" : "read-only", read, write, ...(bag === working ? { working: true } : {}), ...(why !== undefined ? { why } : {}) });
    }
    return { recipe, working, layers };
  };
});
