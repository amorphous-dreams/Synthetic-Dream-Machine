/**
 * tiddler-verbs — `wiki-filter` / `tiddler-get` / `wiki-render` / `tiddler-put` / `tiddler-delete` / `wiki-status`,
 * the TIDDLER DOOR: every act TiddlyWiki defines over one record or one wiki's engine, answered by the island's own
 * `$tw` and never by a second parser (lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout #/a-lean, Shape D, lane 1).
 *
 * The contract every skin (this, the CLI's `lares get|put|delete|rename`, the MCP seat's `tiddler_*|wiki_*`) carries verbatim:
 *
 *   wiki-filter    { recipe, filter, fields?, collapse?, match?, context?, depth?, after?, limit?, maxBytes? } → { recipe, filter, titles | rows, total, next, asOf, withheld? }
 *                                                                         (`match` adds each row's `lines: [{n, text, cut?}]` and `matches`; `depth: "card"` each row's
 *                                                                          `has` line, `depth: "whole"` the has line and the text, or its matching lines beside `match`)
 *   tiddler-get    { recipe, title, meme?, grain?, slot?, after?, fields?, maxBytes? }
 *                                                                         → { has, recipe, address?, title, lens, tiddler?: { fields, hash, textHash, bag, position, family?, orphan?, omitted? } | null,
 *                                                                             meme?: { uri, text?, canonicalHash, bytes, slots, slot?, page? }, grain, next, note? }
 *                                                                         (a bare affordance root no record titles reads the carrier the stack seats: `title` names it, `address` the root)
 *   wiki-render    { recipe, title | text, type?, form?, after?, maxBytes? } → { recipe, title, form, text, bytes, truncated, next }
 *   tiddler-put    { recipe | bag [realm], title, text?, append?, replace?, with?, fields?, unset?, tagsAdd?, tagsRemove?, cut?, base?, create?, dry? }
 *                                                                         → { recipe?, title, decision: put|noop|conflict|exists, bag, layer?, created, changed, hash, textHash, position, family?,
 *                                                                             appended?, appendedTo?, replaced?, canonicalHash?, landed?, kept?, tombstoned?, warnings? }
 *   tiddler-delete { recipe | bag [realm], title, base?, family?, mode?, dry? } → { recipe? | bag, title, decision: removed|absent|conflict|refused, mode: plain|kapae|reveal|cut, tombstoned, retracted, hash?,
 *                                                                             parent?, canonicalHash?, landed?, kept?, refusal?, why?, consequence? }
 *   tiddler-rename { recipe, title, to, base?, dry? }                    → { recipe, title, to, decision: renamed|absent|conflict|refused, forwarder?, relinked?, moved?, skipped?, unreachable?, withheld?, hash?, refusal?, why?, consequence? }
 *   wiki-status    { recipe }                                             → { recipe, working, layers: [{ bag, mounted: writable|read-only|promotion-only, read, write, working?, why? }] }
 *
 * A DRY WRITE LANDS NOTHING (comms-ux-enacts landing 7; `mu=_` on the call, `dry: "summary" | "diff"` here). Put, delete and
 * rename walk the same law to the last step: every fence, the ocap, the base, the family law and the Confluence gate. A put
 * runs whole over a DRY SEAT (`drySeatOf`), the real seat beneath an overlay that takes every landing and every tombstone, so
 * its answer names what the real put then lands, hash for hash; a delete and a rename stop at the step before their first
 * write. The answer adds `dry` (the depth), `needs` (the base the real call takes: `base`, and `carrierBase` on a family) and,
 * at `diff`, `diff` (each record the call would move: its fields before and after, its text line by line, `lineDiff`).
 *
 * EVERY WIKI ITS ENGINE. `recipe: "default"` answers through the daemon island's live `$tw.wiki`, the daemon mount's daemon
 * wiki. `recipe: <slug>` answers through THAT wiki's own engine (`wiki-engine`: the one per-face engine machinery laid over
 * the wiki's recipe as the face sees it, its canon by reference, the shared working layer and the face's personal and draft
 * layers), which the island's door (`wikis`) composes on the first ask and closes when cold; a write lands in that engine's
 * write layer (`working`, or the face's `personal` where it holds no writer's seat). A wiki the door reaches no engine for
 * (no recipe names it, none of its layers stands for the face, or the island holds no door) refuses `wiki-unreached` by
 * name; `recipe: "daemon"` refuses the same way, since the daemon wiki answers to `default` alone. A reactor reads exactly one
 * of `recipe` / `bag`; the one call (`modules/call.ts`) fills the container from the live `#/takes/container` row's `default/`
 * param before it dispatches here, so a call never meets a missing container, and naming both refuses `one-of-doubled` there.
 *
 * REACTORS REGISTER BY ADDRESS (`TIDDLER_CALL_SEATS`): each verb here answers one affordance address through the registry
 * `call` dispatches through (`VerbTable.answer`), so `call("get", {title})` lands on `tiddler-get` and its answer carries the
 * carrier receipt.
 *
 * A BAG TAKES ONE RECORD THROUGH ITS OWN STORE. `bag: <slug>` names one bag and no wiki, so no engine runs: a get reads the
 * record from that bag (`bagGet`), a put lands it there and a delete removes it there (`bagSeat`), under the reach and the
 * gates every bag placement walks (a lit sibling's own lane, a realm steward's write, a wiki's instance slot addressed as a
 * bag, a layer the island mounts writable; the Kahu predicate, then the admin cap). The one put law reads the same over a
 * bag as over a wiki, and the answer names the `bag` in place of a `recipe`. The verbs that compute in an engine (a filter,
 * a render, a status, a rename, an action) refuse a bag by name (`wiki-not-anchored`).
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
 * only the renderer writes it, and both refuse `rendered-derives`. No caller's action string rides these doors: an action string
 * runs only as a CARRIER'S OWN ACT (`carrier-act`, landing 13), the `acts/<title>` tiddler a carrier's skin row names, live on
 * the engine under the caller's face, its writes tagged with the act so its answer carries their receipts (the CRDT remembers every hand), and its writing
 * messages (`tm-rename-tiddler`, `tm-relink-tiddler`) through the rename door.
 *
 * THE FAMILY LAW (`@lararium/mesh/family`) DECIDES WHERE A RECORD STANDS AND WHAT A DELETE MOVES. `position` and
 * `family` read through `familyOf`; a delete reads its `consequence` before anything lands, over the reader's view,
 * so a record the face may not read enters no consequence. A plain tiddler leaves. A meme root or slot answers its
 * consequence and `decision: "refused"` (`refusal: "tiddler-delete-in-a-family"`) unless the call names the family act
 * (`family: true`); with it the consequence's acts land as ONE change per layer. A SLOT LEAVES BY THE EXPLICIT CUT: a delete
 * that names `<root>#/<slot>` lands as the put on the slot's parent with `cut` naming it (`cutSlot`), so the parent's text sheds
 * the call, the family reseals, and the answer (`mode: "cut"`) names what the cut tombstoned.
 *
 * A PUT MOVES A FAMILY'S TEXT THROUGH THE CONFLUENCE GATE. A root and its slots stand as tiddlers; a text put on one lands as
 * the family (the record takes its place, the carrier recomposes, the gate re-splits and reseals in the root's turn), and a
 * first record of the carrier type founds its family the same way. The answer adds `canonicalHash`, `landed`, `kept`, `tombstoned`. ABSENCE NEVER
 * DELETES: a slot the new text omits stays standing by reference (`kept`); `cut` names the slots that leave.
 * `base` reads a record hash (`sha256-…`) or, on a family's text, the carrier's canonical hash (`sha256:…`). A PARTIAL BASE
 * (a slot's read, a page short of the end) guards a put on a slot within the span it read and refuses `base-outside-span`
 * beyond it; a put that speaks for the whole carrier refuses it (`base-from-partial`). A slot's text put needs no base and
 * moves the slot's own record alone: its standing `$preamble` / `$postamble` carriage stays. AN APPEND ON A SLOT joins the
 * end of the slot's body: its postamble where one stands with text, the slot's own text otherwise, one blank line between.
 * A REPLACE IN PLACE (`replace` + `with`) changes one exact span of the standing text and lands as a text put of the result:
 * the same seat, base guard, swap and family split; the span must occur exactly once (`replace-absent`, `replace-ambiguous`).
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

import { NoWorkingLayerRefusal, type CompositeStore } from "@lararium/mesh/composite-store";
import { VerbRefusal } from "@lararium/mesh/verb-refusal";
import { verifyCidBytes } from "@lararium/mesh/cas-transit";
import { ridesAsPointer } from "@lararium/mesh/content-handle";
import { isContentAddress, POINTER_ADDRESS_FIELDS, POINTER_DIGEST_CODE, POINTER_INTEGRITY_CODE, readPointerAddress } from "@lararium/mesh/pointer-address";
import { canonicalJsonBytes, sha256HexBytesSync } from "@lararium/mesh/crypto";
import { refuseEffectLedgerWrite } from "@lararium/mesh/effect-record";
import { refuseRenderedWrite, renderedWriteFault, RENDERED_DERIVES_REASON } from "@lararium/mesh/rendered-derives";
import { requireKahuReach, type KahuReachSource } from "@lararium/mesh/kahu-canon-reach";
import { wikiSlotKindOf, DAEMON_WIKI_SLUG } from "@lararium/mesh/wiki-recipe";
import { type ChangeOrigin, type LarTiddlerStore } from "@lararium/mesh/tiddler-store";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import { fieldStringsOf, parseTitleList, stringifyList } from "@lararium/mesh/carrier-form";
import { askerRefusal, handRefusalOf } from "@lararium/mesh/hand-refusal";
import { consequence, familyOf, retractsOf, rootAddressOf, tombstonesOf, type Consequence, type DeleteMode, type FamilyPosition, type FamilyView } from "@lararium/mesh/family";
import { anchorBagOf, readBagStore, readContainer, writeBagStore, type MemeVerbOptions } from "./meme-verbs.js";
import { composeMemberCarrier, CUT_NOT_OMITTED_CODE, dropKaheaCalls, familyReadingIn, framesCarrier, isMemeRoot, joinedParagraph, placeMeme, readMeme, removeMeme, renameFamilyInWiki, slotAppendTarget, wikiFamilyView, wikiMemeSink, stageMemeTitle, STAGE_PATH_SHAPE_CODE, STAGE_MEME_PREFIX, type MemeSink } from "./place-meme.js";
import { READ_PAGE_BYTES, byteLength, cardBase, memeBase, readBase, grainOf, hasLine, memeGradient, pageOfSlot, param, partialSpanOf, slotHasLines, tagTokens, type CarrierSlot, type GrainEcho, type ReadGrain } from "./read-gradient.js";
import { skinnyCid } from "./lazy-resolver.js";
import { carrierOf } from "./affordance-read.js";
import { AFFORDANCE_TAG, bareAddressOf } from "./affordance-rows.js";
import { readCarrierShape } from "./carrier-shape.js";
import type { TiddlerFields } from "./deserializer.js";
import { alertNamedTitles, isHouseAlert, isOpenAlert, redactedAlertFields, staysHome, withheldFromReads } from "./stay-home.js";
import { filtersText, functionPragmasOf, houseNamesOf, houseWidgetOf, refuseUnknownHouseOperators } from "./house-filters.js";
import { pageFilterAnswer, filterCursor, checkFilter, lineLensOf, matchingLines, WIKI_FILTER_ROWS, WIKI_FILTER_BYTES, WIKI_ANSWER_BYTES_MAX, type FilterRow, type FilterWiki } from "./filter-page.js";
import { optionalStringArg, stringArg } from "./handler-args.js";
import type { TW5Engine } from "./tw5-vm.js";
import { wornOrigin } from "./verb-dispatcher.js";
import { CallRefusal, VOICE_SLOTS, callReaderOf, cureCall, floorReaderOf, type CallFloor, type CallSeat, type CallVoice, type MacroCallParse, type VoiceSlot } from "./modules/call.js";
import type { AffordancePack } from "./affordance-pack.js";
import { dryDepthOf, muWordsOf } from "./modules/mu.js";
import { APERTURE_RANKS, filterRangeArgs, readRangeArgs, type ApertureRank } from "./modules/aperture.js";
import { wikiCollectReceipts, wikiCollectsAct, wikiStampsReceipt, wikiWearsNext } from "./island-recipe.js";
import { isTw5DocsBag, refuseTw5DocsWrite } from "./tw5-docs-library.js";
import type { CallSource, VerbContext, VerbReactor } from "./verb-dispatcher.js";

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
  filterTiddlers(filter: string, widget?: unknown, iterator?: unknown): string[];
  makeTiddlerIterator(titles: string[]): unknown;
  parseTiddler(title: string): unknown;
  makeWidget(parser: unknown, options: { variables: Record<string, string> }): { render(container: unknown, nextSibling: null): void };
  getTiddler(title: string): EngineTiddler | undefined;
  tiddlerExists(title: string): boolean;
  addTiddler(tiddler: unknown): void;
  deleteTiddler(title: string): void;
  relinkTiddler(from: string, to: string, options?: unknown): void;
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
  rootWidget: unknown;
  fakeDocument: { createElement(name: string): { innerHTML: string; textContent: string } };
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
/**
 * THE ACT A DOOR WRITE CROSSES WITH (landing 13): the invocation's action and its request id, `<action>#<request>`. The shore's
 * receipt of each record the door lands names it; a carrier's act hands its own `acts/` title as the action, so every write
 * the act moves (its own action string's and the doors its messages reach) reads as that act.
 */
const actOf = (ctx: VerbContext): string => `${ctx.invocation.action || "verb"}#${ctx.invocation.requestId}`;
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
  new VerbRefusal("wiki-unreached", `wiki-unreached: ${verb} — ${why}; \`lares wiki status\` names the wikis this face reaches, and \`recipe=default\` names its daemon wiki.`);

/**
 * THE NAMED WIKI'S OPTIONS: where the call names a registered wiki, the options its own engine answers under, or null where
 * the anchor answers (`recipe: "default"`, a bag, or options already a named wiki's). A wiki the door reaches no engine for
 * refuses `wiki-unreached` before a cap ask, a read or a write.
 */
async function namedWikiOptions(opts: TiddlerVerbOptions, args: Readonly<Record<string, unknown>>, verb: string, write: boolean): Promise<TiddlerVerbOptions | null> {
  if (opts.wiki) return null;
  const target = readContainer(args, verb);
  // THE TW5 DOCS LIBRARY TAKES NO WRITE, named as a wiki or as a bag (`tw5-docs-name`).
  if (write) { refuseTw5DocsWrite(target.recipe, verb); refuseTw5DocsWrite(target.bag, verb); }
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
    // A bag's own doors: one record reads, lands and leaves there with no engine running.
    const door = "A bag takes one record through its own store: `lares get title=<title> bag=<slug>` · `lares put title=<title> bag=<slug>` · `lares delete title=<title> bag=<slug>` (a family: `lares delete title=<root> bag=<slug> family=true`); `lares get meme=true bag=<slug>` lists its roots.";
    const named = target.bag ? `bag "${target.bag}" names one bag and no wiki` : `wiki "${target.recipe}" names another engine than this one`;
    throw new VerbRefusal("wiki-not-anchored", `wiki-not-anchored: ${verb} runs in a wiki's own engine; ${named}. ${door} To use ${verb}, name the wiki: \`recipe=<slug>\` (\`recipe: "default"\` for the daemon wiki).`);
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


/**
 * Where a person's stand-off collapse rules rest (`@lararium/node` standoff-collapse, `COLLAPSE_CONFIG_PREFIX`): a rule
 * there lets the house settle a stand-off with no hand present, so writing one is a hand act like settling one.
 */
export const SHORE_COLLAPSE_CONFIG_PREFIX = "$:/config/lares/shore/collapse/";

/**
 * A COLLAPSE RULE TAKES A HAND'S WRITE ALONE: the asker the vessel's door booked (the hand gate's cached reading of the line's
 * peer) reads as the gate's verdict (`askerRefusal`): a seat refuses `hand-act-only`, a line no door read (no asker) refuses
 * `hand-unattested`, and the refusal names the command the operator runs. The operator's line (`cli`) and a tab write.
 */
function refuseUnhandedCollapseRule(title: string, verb: string, asker: VerbContext["asker"]): void {
  const code = title.startsWith(SHORE_COLLAPSE_CONFIG_PREFIX) ? askerRefusal(asker) : null;
  if (code === null) return;
  const refused = handRefusalOf(code, { act: `writing "${title}" (a rule that settles stand-offs with no hand present)`, reads: "peer", line: `lares ${verb.replace(/^tiddler /, "")} title="${title}"` });
  throw new VerbRefusal(code, refused.message);
}

function refuseWithheld(title: string, verb: string, read = false): void {
  if (read ? withheldFromReads(title) : staysHome(title)) throw new VerbRefusal("tiddler-withheld", `tiddler-withheld: "${title}" stays home (a temp, state, volatile-VM, control, secret or cap/** title); ${verb} neither reads nor writes it.`);
}

/**
 * THE CALLER'S FACE DECIDES REACH. The door's own gate asks the face's read cap on the anchor's working bag. Past it, a
 * record names the bag that answered it (`$origin-bag`): the face reads that record where it holds a read on that bag,
 * where the bag's floor snapshot rests public, or where the bag names the daemon wiki's own device-local temp slot.
 * A record with no stamp belongs to the engine itself (a shadow, a boot tiddler). One ask per bag per verb.
 */
async function reachOf(opts: TiddlerVerbOptions, anchor: Anchor, cap: VerbContext["cap"]): Promise<(bag: string | null) => Promise<boolean>> {
  // The TW5 docs library rests public: its bag carries no house record, so every face reads it without a cap ask.
  const proof = isTw5DocsBag(anchor.bag) ? { ok: true as const } : await cap("read", anchor.bag);
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
/**
 * A house alert as the view answers it: its open fields alone, each secret shape redacted (`redactedAlertFields`). The view's
 * `visible` already shut every alert whose kind stays home, or that names a record this reader may not read.
 */
function redactedAlert(tiddler: EngineTiddler): EngineTiddler {
  const title = String(tiddler.fields["title"] ?? "");
  const fields = redactedAlertFields(title, tiddler.fields as Record<string, unknown>) ?? { title };
  const Make = (tiddler as unknown as { constructor: new (...fields: unknown[]) => EngineTiddler }).constructor;
  return new Make(fields);
}

function readerView(wiki: EngineWiki, visible: Visible, house?: { text: string; document: { createElement(tag: string): unknown } } | null): EngineWiki {
  const view = Object.create(wiki) as EngineWiki & Record<string, unknown>;
  view["filterCache"] = Object.create(null);
  view["filterCacheCount"] = 0;
  view["caches"] = Object.create(null);
  view["globalCache"] = Object.create(null);
  const shown = (title: string): boolean => visible(title, wiki.getTiddler(title));
  view.getTiddler = (title) => {
    const tiddler = wiki.getTiddler(title);
    if (!tiddler || !visible(title, tiddler)) return undefined;
    return isHouseAlert(title) ? redactedAlert(tiddler) : tiddler;
  };
  view.tiddlerExists = (title) => wiki.tiddlerExists(title) && shown(title);
  view.each = (callback) => wiki.each((tiddler, title) => { if (visible(title, tiddler)) callback(isHouseAlert(title) ? redactedAlert(tiddler) : tiddler, title); });
  view.eachShadow = (callback) => wiki.eachShadow((tiddler, title) => { if (visible(title, tiddler)) callback(isHouseAlert(title) ? redactedAlert(tiddler) : tiddler, title); });
  view.eachTiddlerPlusShadows = (callback) => wiki.eachTiddlerPlusShadows((tiddler, title) => { if (visible(title, tiddler)) callback(isHouseAlert(title) ? redactedAlert(tiddler) : tiddler, title); });
  view.eachShadowPlusTiddlers = (callback) => wiki.eachShadowPlusTiddlers((tiddler, title) => { if (visible(title, tiddler)) callback(isHouseAlert(title) ? redactedAlert(tiddler) : tiddler, title); });
  view.allTitles = () => wiki.allTitles().filter(shown);
  view.allShadowTitles = () => wiki.allShadowTitles().filter(shown);
  if (house) {
    // THE HOUSE'S FUNCTIONS COME FROM THE CARRIER AS THE READER'S STACK SEATS IT: a filter run with no widget of its own runs
    // under the widget that carrier's text builds (house-filters), never under the wiki's `$:/tags/Global` imports.
    let widget: unknown;
    const known = houseNamesOf(house.text);
    const run = wiki.filterTiddlers as unknown as (this: unknown, filter: string, widget?: unknown, source?: unknown) => string[];
    view["filterTiddlers"] = (filter: string, given?: unknown, source?: unknown): string[] => {
      refuseUnknownHouseOperators(filter, known);
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
  // AN ALERT ANSWERS ONLY A READER OF WHAT IT NAMES: each open alert that names a record reads absent where that record stands
  // in a bag this reader may not read, or stands nowhere this reader can weigh (a title the wiki does not hold names no bag
  // the door can check, so it shuts). The alert holds no bag of its own, so `hidden` alone never reaches it.
  const shutAlerts = new Set<string>();
  for (const title of wiki.allTitles()) {
    if (!isOpenAlert(title)) continue;
    for (const named of alertNamedTitles(title, wiki.getTiddler(title)?.fields ?? {})) {
      const record = wiki.getTiddler(named);
      const bag = record ? record.fields[ORIGIN_BAG] : undefined;
      if (!record || (typeof bag === "string" && bag !== "" && hidden.has(bag))) { shutAlerts.add(title); break; }
    }
  }
  const visible: Visible = (title, tiddler) => !withheldFromReads(title) && !shutAlerts.has(title) && !hidden.has(String(tiddler?.fields[ORIGIN_BAG] ?? ""));
  const text = await filtersText(opts.composite, wiki, mayRead);
  const document = (engineOf(opts) as unknown as { fakeDocument?: { createElement(tag: string): unknown } }).fakeDocument;
  return { view: readerView(wiki, visible, document ? { text, document } : null), visible, mayRead, pragmas: functionPragmasOf(text) };
}

/** What a sibling door reads of a reader's view: each record, one record, a filter run under the house widget. */
export interface ReaderViewWiki {
  each(callback: (tiddler: { readonly fields: Readonly<Record<string, unknown>> }, title: string) => void): void;
  getTiddler(title: string): { readonly fields: Readonly<Record<string, unknown>> } | undefined;
  filterTiddlers(filter: string): string[];
}

/**
 * THE READER'S VIEW, LENT TO A SIBLING DOOR (the msg door, `msg-verbs.ts`): the wiki a call's container reaches (the daemon wiki,
 * or a named wiki in its own engine), read as the caller's face may read it (`viewFor`), beside the whole wiki and the predicate
 * that built the view, so the door counts what the view withholds. A bag names no engine and refuses `wiki-not-anchored`.
 */
export async function readerViewOf(opts: TiddlerVerbOptions, args: Readonly<Record<string, unknown>>, ctx: VerbContext, verb: string): Promise<{ readonly recipe: string; readonly view: ReaderViewWiki; readonly wiki: ReaderViewWiki; readonly visible: (title: string) => boolean }> {
  const at = (await namedWikiOptions(opts, args, verb, false)) ?? opts;
  const anchor = anchorOf(at, args, verb);
  const { view, visible } = await viewFor(at, anchor, ctx.cap);
  const wiki = anchor.engine.wiki;
  return { recipe: anchor.recipe, view: view as unknown as ReaderViewWiki, wiki: wiki as unknown as ReaderViewWiki, visible: (title) => visible(title, wiki.getTiddler(title)) };
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

/** The write gate, in the one order every write door keeps: the Kahu predicate, then the face's write cap on the landing bag. */
async function requireWrite(opts: TiddlerVerbOptions, anchor: Anchor, cap: VerbContext["cap"], verb: string, asker?: VerbContext["asker"]): Promise<void> {
  await requireKahuReach(anchor.bag, opts.kahuReach, verb, asker);
  const proof = await cap("admin", anchor.bag);
  if (!proof.ok) throw new Error(`cap-denied: admin on ${anchor.bag} required (${proof.reason ?? "no reason"})`);
}

// ── wiki-filter ───────────────────────────────────────────────────────────────────────────────────────

/**
 * ONE ROW'S COLLAPSED FORM. A meme root answers the bytes of its whole carrier and its slots (`{slot, bytes, first}`), built by the
 * skinny grain of `memeGradient`, the builder `lares get title=… aperture=measure` reads; a pointer answers the `size` it names; any other
 * record answers the bytes of its text. The slots unfold one at a time by `lares get title=<root> slot=#/<name> aperture=arc`.
 */
async function collapseOf(
  sink: Pick<MemeSink, "titles" | "read">, title: string, fields: Record<string, string>,
): Promise<{ bytes: number; slots?: CarrierSlot[] }> {
  if (isMemeRoot(title, fields) && !isPointer(fields)) {
    const meme = await readMeme(title, sink);
    if (meme !== null) {
      const read = memeGradient(meme, { grain: "skinny" });
      return { bytes: read.bytes, slots: read.slots };
    }
  }
  if (isPointer(fields)) return { bytes: Number(fields["size"]) || 0 };
  return { bytes: byteLength(fields["text"] ?? "") };
}

/** A filter's depth (`depth`, the seat's reading of `mu`): `card` or `whole`, null where none rides; any other word refuses by name. */
function filterDepthOf(raw: unknown): "card" | "whole" | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (raw === "card" || raw === "whole") return raw;
  throw new VerbRefusal("filter-depth-unknown", `filter-depth-unknown: a filter's depth reads card or whole (got ${JSON.stringify(raw)}); a call names it as \`aperture=measure\` or \`aperture=arc\`.`);
}

export const makeWikiFilterReactor = everyWiki("wiki-filter", false, (opts: TiddlerVerbOptions): VerbReactor => {
  return async (args, ctx) => {
    const anchor = anchorOf(opts, args, "wiki-filter");
    const filter = stringArg(args, "filter");
    if (!filter.trim()) throw new Error("wiki-filter: args.filter is required (a TiddlyWiki filter, e.g. \"[tag[memory]sort[title]]\")");
    const { view, visible } = await viewFor(opts, anchor, ctx.cap);
    const wiki = anchor.engine.wiki;
    checkFilter(view, filter);
    // A misspelt lines lens refuses by name before the filter runs (`filter-context-alone`, `filter-context-range`, `filter-match-*`).
    const lens = lineLensOf(args["match"], args["context"]);
    // The filter runs on the reader's view; the answer gate then drops a hidden TITLE an index still named.
    const answered = view.filterTiddlers(filter);
    const titles: string[] = [];
    let withheld = 0;
    for (const title of answered) {
      if (visible(title, wiki.getTiddler(title))) titles.push(title);
      else withheld++;
    }
    const names = namesArg(args["fields"]);
    const collapse = flagOn(args["collapse"]);
    const depth = filterDepthOf(args["depth"]);
    const limit = countArg(args["limit"], WIKI_FILTER_ROWS, 1, WIKI_FILTER_ROWS);
    const after = optionalStringArg(args, "after");
    // THE COLLAPSE LENS: each row of the page's window carries its bytes, and a meme root its slots, read through the one skinny
    // builder (`collapseOf`: `readMeme` and `memeGradient` at the skinny grain, the has-stack `lares get title=… aperture=measure` answers).
    // The window reads ahead of the page law, which stays sync; a row the byte cap leaves for the next page costs one wasted read.
    const collapsed = new Map<string, { bytes: number; slots?: CarrierSlot[]; withheld?: number }>();
    if (collapse) {
      // The reader's titles and the wiki's read once for the whole window, never once per row.
      const readable = view.allTitles();
      const held = wiki.allTitles();
      const sink = { titles: () => readable, read: (t: string) => (view.getTiddler(t) as { fields?: TiddlerFields } | undefined)?.fields };
      const { offset } = filterCursor(titles, after);
      const readableSet = new Set(readable);
      for (const title of titles.slice(offset, offset + limit)) {
        const row = await collapseOf(sink, title, readRecord(view.getTiddler(title)!).fields);
        // As `lares get title=… meme=true` names it: slot records this face may not read never enter the slots, and the row says so.
        const prefix = `${title}#`;
        const withheldSlots = row.slots === undefined ? 0 : held.filter((t) => t.startsWith(prefix) && !staysHome(t) && !readableSet.has(t)).length;
        collapsed.set(title, withheldSlots > 0 ? { ...row, withheld: withheldSlots } : row);
      }
    }
    // THE LINES LENS (S5): `match` names the words (or a `/regexp/`) a line must hold and `context` the lines around each; every
    // row then carries its record's matching lines, read off the same view the filter ran on, so a sweep takes no read per title.
    // A record that holds no text (a pointer) carries no lines; a withheld title never reaches a row.
    // THE DEPTH (`mu`, landing 6): `card` hands each row its has line (`*?`, a page of has lines); `whole` adds the record's text,
    // or beside `match` its matching lines (`*!`, a page whose rows carry their lines). Both read the same view the filter ran on.
    const rowOf = names === null && !collapse && lens === null && depth === null ? undefined : (title: string): FilterRow => {
      const tiddler = view.getTiddler(title);
      const record = tiddler ? readRecord(tiddler) : null;
      const held = record?.fields ?? {};
      const fields: Record<string, string> = {};
      for (const name of names ?? []) if (typeof held[name] === "string") fields[name] = held[name]!;
      if (depth === "whole" && lens === null && typeof held["text"] === "string") fields["text"] = held["text"];
      const lines = lens !== null && typeof held["text"] === "string" ? matchingLines(held["text"], lens) : {};
      const has = depth !== null && record !== null
        ? { has: recordHas(title, held, { layer: record.bag }, placeOf(anchor, view, title), cardBase(hashOf(held), depth === "card" || typeof fields["text"] !== "string")) }
        : {};
      return { title, ...has, fields, ...collapsed.get(title), ...lines };
    };
    const page = pageFilterAnswer(titles, {
      after,
      limit,
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

/**
 * WHAT A POINTER'S BODY STANDS AS, on every answer that names one. `verified`: the bytes the content tier holds hash to the
 * digest the pointer names (the answer carries them, or the put read them). `owed`: no verified byte rode this answer (the handle
 * went unread, the tier holds none, a web2 address names them), so `owes` names what stands open and `cure` the act that
 * closes it. A pointer never answers clean on a body nobody verified.
 */
interface PointerBody {
  readonly cid?: string;
  readonly uri?: string;
  readonly integrity?: string;
  readonly body: "verified" | "owed";
  readonly owes?: string;
  readonly cure?: string;
  /** A put alone: the fields the door wrote to seat the pointer as the house reads it. */
  readonly seated?: readonly string[];
}
const CURE_READ = "read the body: `lares get title=<title> recipe=<wiki> form=text` (MCP `grain=\"resolved\"`)";
const CURE_STAGE = "`lares bag cas` surveys the content tier; an ingest of the file stages its bytes by their hash, and a resolved read then verifies them";
const CURE_SOURCE = "fetch the bytes by hand, stage them into the content tier, and put the pointer by their hash (`_canonical_uri` as `ni:///sha-256;<base64url>`)";
const CURE_NAME = "name the bytes in `_canonical_uri` as `ni:///sha-256;<base64url>`, `cid:<sha256 hex>` or `lar:///ha.ka.ba/cid/<sha256 hex>`";

/** What the record lens answers: the fields it shows, what it left home, and the grain it applied and why. */
interface RecordRead {
  readonly pointer?: PointerBody;
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
  const done = (fields: Record<string, string>, applied: ReadGrain, why: string, next: RecordRead["next"], pointer?: PointerBody): RecordRead => {
    const carryWhole = asked === "fat" || asked === "whole" || applied === "resolved";
    const { shown, omitted } = narrowRecord(fields, title, args, applied === "skinny", carryWhole);
    // THE ECHO NAMES WHAT RODE. At the tiddler grain, fat only where the text rode (named fields or the byte cap may leave it home);
    // a pointer's body grain (handle, resolved) stays its own word whatever the fields.
    const tiddlerGrain = applied === "fat" || applied === "skinny";
    const rode: ReadGrain = tiddlerGrain ? (typeof shown["text"] === "string" ? "fat" : "skinny") : applied;
    return { fields, shown, omitted, grain: { asked, applied: rode, why: named ? `the named fields (${rode === "fat" ? "the text among them" : "the text left home"})` : rode === applied ? why : `${why}; the byte cap left the text home` }, next, ...(pointer ? { pointer } : {}) };
  };
  if (isPointer(held)) {
    // ONE POINTER NAMES ONE DIGEST: names that disagree refuse before any byte reads.
    const reading = readPointerAddress(held);
    if (reading.kind === "refused" && reading.code === POINTER_INTEGRITY_CODE) throw new VerbRefusal(reading.code, `${reading.code}: "${title}": ${reading.why}. No byte read.`);
    const cid = skinnyCid(held);
    const web2 = cid === null && typeof held["_canonical_uri"] === "string";
    const integrity = reading.kind === "address" ? reading.integrity : held["_integrity"];
    const names = { ...(cid !== null ? { cid } : {}), ...(web2 ? { uri: held["_canonical_uri"]! } : {}), ...(integrity ? { integrity } : {}) };
    // AN UNREAD OR UNVERIFIED POINTER ANSWERS OWED, NEVER CLEAN.
    const owed = (owes: string, cure: string): PointerBody => ({ ...names, body: "owed", owes, cure });
    const unnamed = owed("the pointer names no content address", CURE_NAME);
    const source = owed("a web2 address names the body and the door never fetches it", CURE_SOURCE);
    // `whole` on a pointer asks for the whole body: the body grain's own word for it reads `resolved`.
    if (asked === "resolved" || asked === "whole") {
      if (web2) return done(held, "handle", `a web2 \`_canonical_uri\` names the body and the door never fetches it (web3 only): ${held["_canonical_uri"]}`, null, source);
      if (cid === null) return done(held, "handle", "the pointer names no CID to resolve", null, unnamed);
      const bytes = cas ? await cas(cid) : null;
      if (!bytes) {
        const miss = cas ? `the local CAS holds no bytes for ${cid}` : "this island holds no CAS shore to resolve from";
        return done(held, "handle", miss, null, owed(miss, CURE_STAGE));
      }
      // A WRONG DIGEST REFUSES BY NAME: bytes that hash otherwise never splice, and never answer as a quiet handle.
      if (!verifyCidBytes(bytes, cid)) throw new VerbRefusal(POINTER_DIGEST_CODE, `${POINTER_DIGEST_CODE}: the bytes the content tier holds for ${cid} hash otherwise, so "${title}" answers no body. ${CURE_STAGE}. No byte spliced.`);
      const text = isBlob(engine, held) ? base64Of(bytes) : new TextDecoder().decode(bytes);
      return done({ ...held, text }, "resolved", `the body resolved from the local CAS by CID ${cid}, verified`, null, { ...names, body: "verified" });
    }
    const why = web2 ? "a pointer: its web2 `_canonical_uri` names the body, never fetched" : "a pointer: the handle names its body by CID";
    const unread = web2 ? source : cid === null ? unnamed : owed("unread: the handle names the body and this answer carries none of it", CURE_READ);
    return done(held, "handle", asked === null || asked === "handle" ? why : `${why}; the tiddler grain reads no body a record does not hold`, web2 || cid === null ? null : { grain: "resolved" }, unread);
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
    ...(read.pointer ? { pointer: read.pointer } : {}),
    ...(note ? { note } : {}),
  };
}

/**
 * A PUT SEATS A POINTER. A record that lands with no `text` and a content address (`_canonical_uri` as `ni:///sha-256;…`,
 * `cid:…` or a `lar:` cid name, or a `textCid`) lands as the pointer every reader in the house already reads (THE BLOB LAW,
 * clause 3): `textCid` carries the CAS key, `_integrity` the RFC 6920 name of the same digest, `_is_skinny` marks the lazy
 * boundary. A type that rides as a pointer by kind (an image, audio, video, a font, a PDF) sheds its content-address
 * `_canonical_uri`, which TiddlyWiki's image widget would emit as a dead `src`; a utf8 type keeps the address as written.
 *
 * Names that disagree, or an address under no spelling the house reads, refuse by name and nothing lands. Bytes the content
 * tier already holds verify here: a wrong digest refuses, a right one stamps `size` and answers `verified`. Bytes the tier
 * lacks leave the pointer `owed`, never clean. Only a put that moves a pointer field seats one: a tag or field patch over a
 * standing pointer leaves it as it stood. The address names a hash and nothing else: no version, no counter, no clock.
 */
async function seatPointer(title: string, before: Record<string, string> | null, next: Record<string, string>, cas: CasPort): Promise<PointerBody | null> {
  if (!POINTER_ADDRESS_FIELDS.some((name) => (before?.[name] ?? undefined) !== (next[name] ?? undefined))) return null;
  const reading = readPointerAddress(next);
  if (reading.kind === "inline" || reading.kind === "source") return null;
  if (reading.kind === "refused") throw new VerbRefusal(reading.code, `${reading.code}: "${title}": ${reading.why}. Nothing moved.`);
  const { cid, integrity } = reading;
  const authored = { ...next };
  next["textCid"] = cid;
  next["_integrity"] = integrity;
  next["_is_skinny"] = "yes";
  const canonical = next["_canonical_uri"];
  if (canonical !== undefined && isContentAddress(canonical) && ridesAsPointer(next["type"] ?? "")) delete next["_canonical_uri"];
  const bytes = cas ? await cas(cid) : null;
  if (bytes && !verifyCidBytes(bytes, cid)) throw new VerbRefusal(POINTER_DIGEST_CODE, `${POINTER_DIGEST_CODE}: the bytes the content tier holds for ${cid} hash otherwise, so "${title}" lands no pointer at them. ${CURE_STAGE}. Nothing moved.`);
  if (bytes) next["size"] = String(bytes.length);
  const seated = Object.keys({ ...authored, ...next }).filter((name) => authored[name] !== next[name]).sort();
  return bytes
    ? { cid, integrity, body: "verified", seated }
    : { cid, integrity, body: "owed", owes: cas ? `the local CAS holds no bytes for ${cid}` : "this island holds no CAS shore to verify against", cure: CURE_STAGE, seated };
}

/**
 * THE MEME LENS: the root and its slot children recomposed into one carrier, sealed by its bcc, on the gradient (`memeGradient`).
 * A title that names a slot child recomposes from its root and points at the slot. A record that holds no meme answers the record
 * with a plain line saying so (graceful, never a refusal); a pointer root answers its handle. Every answer carries `base/` (the
 * canonical hash a `lares put` on the root or a slot takes as its `base`); a skinny answer carries one has line per top-level slot beneath the root's.
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
 * A BAG'S RECORD, READ FROM THAT ONE BAG. The reach and the read gate are every bag read's own (`readBagStore`: a mounted layer, an
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
  if (!lens && optionalStringArg(args, "after")) throw unread("after", "a cursor continues a meme's whole carrier (`meme: true`, `aperture=arc`), and a record answers in one");
  if (lens && args["fields"] !== undefined) throw unread("fields", "the meme lens answers the carrier, never a field subset; drop `meme` to narrow the record");
  if (lens && args["maxBytes"] !== undefined) throw unread("maxBytes", "the meme lens pages its carrier on slot boundaries; the byte cap narrows a record alone");
  const slotted = slot !== null || (title.includes("#/") && rootAddressOf(title) !== title);
  if (lens && slotted && (asked === "skinny" || asked === "whole")) throw unread("slot", `a slot names one slot, and the ${asked === "skinny" ? "has-stack" : "whole carrier"} reads them all; drop the slot, or the grain`);
}

/**
 * THE CARRIER A BARE ROOT READS (fork 3, `carrierOf`). A title whose root names an affordance address at the bare root
 * (`lar:///library.oracle.speaks`, or one of its slots) and which no record in the reader's view titles resolves to the
 * carrier the stack seats for that address (its stable seat, the topmost layer answering), the slot riding along. Null where
 * the title answers as written: a record titles it, its root names no bare address, or no carrier stands.
 */
function carrierTitleOf(view: EngineWiki, title: string): string | null {
  const root = rootAddressOf(title);
  if (bareAddressOf(root) === null) return null;
  const has = (t: string): boolean => view.getTiddler(t) !== undefined;
  if (has(root) || has(title)) return null;
  const carrier = carrierOf({ has, tagged: (address) => view.filterTiddlers(`[all[shadows+tiddlers]tag[${AFFORDANCE_TAG}]tag[${address}]!is[draft]]`) }, root);
  return carrier === null || carrier === root ? null : `${carrier}${title.slice(root.length)}`;
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
    let title = slot && !lens ? slotTitle(named, slot) : named;
    // A BAG NAMES ONE STORE AND NO WIKI: the record reads from that bag through the one bag reach and its read gate.
    if (container.bag !== null) {
      refuseWithheld(title, "tiddler-get");
      return await bagGet(opts, container, title, args, ctx, asked);
    }
    const anchor = anchorOf(opts, args, "tiddler-get");
    // AN OPEN HOUSE ALERT READS here (`withheldFromReads`): the wiki's own engine holds it; a bag's store never does. The meme
    // lens never reads one: an alert holds no meme, so the lens keeps the door's whole stay-home law.
    refuseWithheld(title, "tiddler-get", !lens);
    const { view, mayRead } = await viewFor(opts, anchor, ctx.cap);
    const engine = anchor.engine;
    const wiki = engine.wiki;
    // A BARE ROOT RESOLVES, AND THE STACK DECIDES (`carrierTitleOf`): an affordance address no record titles reads the carrier
    // the reader's view seats for it, and the answer names the address beside the carrier's title and layer.
    const carrier = carrierTitleOf(view, title);
    const answered = { recipe: anchor.recipe, ...(carrier !== null ? { address: rootAddressOf(named) } : {}) };
    if (carrier !== null) title = carrier;
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
    // A HOUSE ALERT READS THROUGH THE VIEW, so it leaves redacted (`redactedAlert`); every other record reads as the engine holds it.
    const tiddler = isHouseAlert(title) ? view.getTiddler(title) : wiki.getTiddler(title);
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

/** Prepare native --render output inside the caller's permission-filtered wiki. A node shore publishes the bytes. */
export const makeWikiRenderOutReactor = everyWiki("wiki-render-out-prepare", true, (opts: TiddlerVerbOptions): VerbReactor => async (args, ctx) => {
  const anchor = anchorOf(opts, args, "wiki-render-out-prepare", true);
  if (anchor.recipe === "default" || wikiSlotKindOf(anchor.slug, anchor.bag) !== "working") throw new VerbRefusal("render-output-grant-denied", "render-output-grant-denied: this face holds no writer's seat in the selected wiki's workbench");
  const allowed = await ctx.cap("admin", anchor.bag);
  if (!allowed.ok) throw new VerbRefusal("render-output-grant-denied", `render-output-grant-denied: write on ${anchor.bag} required`);
  if (args["output"] !== "workbench") throw new VerbRefusal("render-output-substrate-refused", "render-output-substrate-refused: only a node workbench grants output");
  const filter = stringArg(args, "filter");
  const filename = optionalStringArg(args, "filename") ?? "[is[tiddler]addsuffix[.html]]";
  const type = optionalStringArg(args, "type") ?? "text/html";
  const template = optionalStringArg(args, "template");
  const rawVariables = args["variables"];
  if (rawVariables !== undefined && (!rawVariables || typeof rawVariables !== "object" || Array.isArray(rawVariables) || Object.values(rawVariables).some((v) => typeof v !== "string")))
    throw new VerbRefusal("render-variables-malformed", "render-variables-malformed: variables must pair names with string values");
  const variables = (rawVariables ?? {}) as Record<string, string>;
  const { view } = await viewFor(opts, anchor, ctx.cap);
  const engine = anchor.engine;
  const titles = view.filterTiddlers(filter);
  if (titles.length > 128) throw new VerbRefusal("render-count-budget", "render-count-budget: the selection exceeds 128 sources");
  const files: Array<{ name: string; text: string; source: string }> = [];
  const skipped: string[] = [];
  let bytes = 0;
  for (const title of titles) {
    // The filename filter runs as the selection does: under the house widget over the reader's view, never the engine's root.
    const names = view.filterTiddlers(filename, undefined, view.makeTiddlerIterator([title]));
    if (names.length === 0 || names[0] === "") { skipped.push(title); continue; }
    const parser = view.parseTiddler(template ?? title);
    const widget = view.makeWidget(parser, { variables: { ...variables, currentTiddler: title, storyTiddler: title } });
    const container = engine.fakeDocument.createElement("div");
    widget.render(container, null);
    const text = type === "text/html" ? container.innerHTML : container.textContent;
    bytes += utf8.encode(text).length;
    if (bytes > 4_194_304) throw new VerbRefusal("render-byte-budget", "render-byte-budget: output exceeds four MiB");
    files.push({ name: names[0]!, text, source: title });
  }
  return { recipe: anchor.recipe, files, skipped };
});

export const makeWikiRenderReactor = everyWiki("wiki-render", false, (opts: TiddlerVerbOptions): VerbReactor => {
  return async (args, ctx) => {
    const anchor = anchorOf(opts, args, "wiki-render");
    const title = optionalStringArg(args, "title");
    const span = typeof args["text"] === "string" && args["text"] !== "" ? args["text"] : null;
    if ((title === null) === (span === null)) throw new Error("wiki-render: name exactly one of args.title (a tiddler to render) or args.text (a wikitext span to wikify)");
    const form = optionalStringArg(args, "form") ?? "text";
    const outputType = RENDER_FORMS[form];
    if (!outputType) throw new Error(`wiki-render: args.form reads "text" or "html"; got "${form}"`);
    if (title !== null) refuseWithheld(title, "wiki-render", true);
    const { view, mayRead, pragmas } = await viewFor(opts, anchor, ctx.cap);
    // THE HOUSE'S FUNCTIONS RIDE AFTER THE GLOBAL IMPORT, from canon alone: a working-layer `$:/tags/Global` tiddler never shadows one.
    const globals = pragmas === "" ? GLOBAL_IMPORT : `${GLOBAL_IMPORT}${pragmas}\n\n`;
    const wiki = anchor.engine.wiki;
    let rendered: string;
    if (title !== null) {
      // An alert renders through the view, so one this reader may not read stands absent here too.
      const tiddler = isHouseAlert(title) ? view.getTiddler(title) : wiki.getTiddler(title);
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

/** The stage meme law (`place-meme.ts`), on a plain record: a title under the memory stage reads one or two lowercase path
 *  segments. A slot's title (`<root>#/x`) reads its root's path: the fragment names a slot inside that family, never a segment. */
function refuseMalformedStagePath(title: string): void {
  if (!title.startsWith(STAGE_MEME_PREFIX)) return;
  try { stageMemeTitle(rootAddressOf(title).slice(STAGE_MEME_PREFIX.length)); }
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

/** THE APPEND JOIN: a standing text that does not end on a newline takes exactly one `\n` before the appended words; an empty
 *  or newline-ended text takes them as they come. */
export function appendedText(standing: string, words: string): string {
  return standing === "" || standing.endsWith("\n") ? standing + words : `${standing}\n${words}`;
}

/** How many times `span` occurs in `text`, overlaps counted: `aa` occurs twice in `aaa`, so a replace never guesses which. */
export function spanCount(text: string, span: string): number {
  if (span === "") return 0;
  let count = 0;
  for (let at = text.indexOf(span); at !== -1; at = text.indexOf(span, at + 1)) count++;
  return count;
}

/**
 * THE REPLACE IN PLACE: the standing text with its one occurrence of `span` turned to `words`. A span that occurs zero times
 * or more than once refuses by name, naming the count and the read that shows the text, and nothing moves.
 */
export function replacedText(standing: string, span: string, words: string, title: string, where: string): string {
  const count = spanCount(standing, span);
  const read = `\`lares get title="${title}" ${where}\` shows the text as it stands`;
  if (count === 0) throw new VerbRefusal("replace-absent", `replace-absent: the span occurs 0 times in the text of "${title}"; copy the span byte for byte from the text as it stands (${read}) and replace again. Nothing moved.`);
  if (count > 1) throw new VerbRefusal("replace-ambiguous", `replace-ambiguous: the span occurs ${count} times in the text of "${title}", and a replace changes exactly one; widen \`replace=\` with the words around the one you mean until it occurs once (${read}), or send the whole text with \`text=\` / \`file=\` and \`base=\`. Nothing moved.`);
  const at = standing.indexOf(span);
  return standing.slice(0, at) + words + standing.slice(at + span.length);
}

/** How many times one put re-reads a record that moved under its admission before it answers `conflict`. */
const PUT_SETTLE_ROUNDS = 16;

/** Where a title stands, as a put's answer names it. */
type Place = { position: TiddlerPosition; family: string | null; orphan: boolean };
const PLAIN_PLACE: Place = { position: "plain", family: null, orphan: false };

/**
 * WHERE A PUT LANDS, as the one put law reads it. A wiki's seat stands over that wiki's live engine: the record reads off
 * `$tw.wiki` and lands through it, so the in-wiki cascade routes it to the working layer as a person's edit would. A bag's
 * seat stands over that one bag's own store, no engine running. The law above the seat (the patch, the base, the family's
 * walls, the Confluence gate, the pointer, the executable wall) reads the same on both.
 */
interface PutSeat {
  /** The container an answer names first: `recipe` for a wiki; a bag's answer names its `bag` alone. */
  readonly answered: Record<string, unknown>;
  /** The bag the put lands in, and the slot of a named wiki that bag stands as (`working`, `personal`, `draft`). */
  readonly landing: { readonly bag: string; readonly layer?: string };
  /** The container as a cure spells it: `recipe=<slug>` or `bag=<slug>`. */
  readonly where: string;
  /** The container's `has` param. */
  readonly provenance: string;
  /** The wiki a seat's executable record names to its exec lei. */
  readonly wiki: string;
  /** The family's sink: the Confluence gate reads and lands through it. */
  readonly sink: MemeSink;
  /** The record under a title, its fields as strings, or null where none stands; a record this face may not read refuses. */
  read(title: string): Promise<Record<string, string> | null>;
  /** True where `create` finds a record standing. */
  exists(title: string): Promise<boolean>;
  place(title: string): Promise<Place>;
  /** A record as the family recompose reads a member of this seat. */
  member(next: Record<string, unknown>): TiddlerFields;
  /** A record as it would read once it lands, landing nothing: the fields the sink would hold and the strings a read answers. */
  settle(next: Record<string, unknown>): Settled;
  /**
   * THE SWAP: `next` lands only where the record still hashes as the round read it; false sends the round back. A wiki's
   * swap runs its re-read and its `addTiddler` in one synchronous step, so no other hand slips between them.
   */
  swap(title: string, liveHash: string | null, next: Record<string, string>): boolean | Promise<boolean>;
}

/** A record as it reads once it lands: the fields a sink holds and the strings a read answers (the residency stamp left out). */
interface Settled { readonly fields: TiddlerFields; readonly strings: Record<string, string> }

/** A store record's fields as strings, as TiddlyWiki writes them, read with no engine (the host's residency stamp left out). */
function stringsOf(held: Record<string, unknown>): Record<string, string> {
  const fields = fieldStringsOf(held);
  delete fields[ORIGIN_BAG];
  return fields;
}

/** A wiki's seat: the anchor's live engine, read through the reader's view. */
async function wikiSeat(opts: TiddlerVerbOptions, anchor: Anchor, ctx: VerbContext): Promise<PutSeat> {
  const { wiki, Tiddler } = anchor.engine;
  const { view, mayRead } = await viewFor(opts, anchor, ctx.cap);
  const face = wornOrigin(ctx.worn).face;
  const act = actOf(ctx);
  const bare = wikiMemeSink(wiki as unknown as Parameters<typeof wikiMemeSink>[0]);
  // THE FACE CROSSES THE HOP: the shore's write of each title carries the session's worn face on its origin.
  const sink: MemeSink = {
    ...bare,
    land: (fields) => { wikiWearsNext(opts.tw5, String((fields as { title?: unknown }).title ?? ""), face, act); return bare.land(fields); },
    tombstone: (gone) => { wikiWearsNext(opts.tw5, gone, face, act); return bare.tombstone(gone); },
  };
  const layer = opts.wiki ? wikiSlotKindOf(anchor.slug, anchor.bag) : null;
  return {
    answered: { recipe: anchor.recipe },
    landing: { bag: anchor.bag, ...(layer ? { layer } : {}) },
    where: `recipe=${anchor.recipe}`,
    provenance: param("recipe", anchor.recipe),
    wiki: anchor.recipe,
    sink,
    read: async (title) => {
      const standing = wiki.getTiddler(title);
      if (!standing) return null;
      const held = readRecord(standing);
      if (!(await mayRead(held.bag))) throw new Error(`cap-denied: read on ${held.bag} required (the bag that answers "${title}")`);
      return held.fields;
    },
    exists: async (title) => wiki.tiddlerExists(title),
    place: async (title) => placeOf(anchor, view, title),
    member: (next) => (new Tiddler(next) as unknown as EngineTiddler).fields as TiddlerFields,
    settle: (next) => { const record = new Tiddler(next); return { fields: record.fields as TiddlerFields, strings: readRecord(record).fields }; },
    swap: (title, liveHash, next) => {
      const now = wiki.getTiddler(title);
      if ((now ? hashOf(readRecord(now).fields) : null) !== liveHash) return false;
      wikiWearsNext(opts.tw5, title, face, act);
      wiki.addTiddler(new Tiddler(next));
      return true;
    },
  };
}

/**
 * A BAG'S SEAT: that one bag's own store, by the reach and the write gate every bag placement walks (`writeBagStore`: a lit
 * sibling's own lane, a realm steward's write, a wiki's instance slot addressed as a bag, a layer the island mounts
 * writable; the Kahu predicate, then the admin cap). No engine composes the bag, so position reads by the family law over
 * the bag's own titles, and a record lands as TiddlyWiki writes its fields.
 */
async function bagSeat(opts: TiddlerVerbOptions, container: ReturnType<typeof readContainer>, verb: string, ctx: VerbContext): Promise<PutSeat> {
  const origin: ChangeOrigin = { kind: "lares-verb", requestId: ctx.invocation.requestId, ...wornOrigin(ctx.worn) };
  const { bag, sink: bare, layer } = await writeBagStore(opts as unknown as MemeVerbOptions, { bag: container.bag!, realm: container.realm }, origin, ctx.cap, verb, ctx.asker);
  const read = async (title: string): Promise<Record<string, string> | null> => {
    const held = await bare.read(title);
    return held ? stringsOf(held as Record<string, unknown>) : null;
  };
  // A BAG'S OWN STORE PASSES BY THE SHORE (landing 13): where an act asked for its receipts, each record this seat lands or
  // removes joins them; any other put reads nothing more and digests nothing (the CRDT names its actor).
  const act = actOf(ctx);
  const stamp = (kind: "save" | "delete", title: string, before: Record<string, string> | null, after: Record<string, string> | null): void =>
    wikiStampsReceipt(opts.tw5, { kind, title, face: wornOrigin(ctx.worn).face, before: before ? hashOf(before) : null, after: after ? hashOf(after) : null, bag, act });
  const sink: MemeSink = !wikiCollectsAct(opts.tw5, act) ? bare : {
    ...bare,
    land: async (fields) => { const title = String((fields as { title?: unknown }).title ?? ""); const before = await read(title); await bare.land(fields); stamp("save", title, before, stringsOf(fields as Record<string, unknown>)); },
    tombstone: async (gone) => { const before = await read(gone); await bare.tombstone(gone); stamp("delete", gone, before, null); },
    ...(bare.tombstoneFamily ? { tombstoneFamily: async (titles: readonly string[]) => {
      const before = await Promise.all(titles.map(read));
      await bare.tombstoneFamily!(titles);
      titles.forEach((title, i) => stamp("delete", title, before[i] ?? null, null));
    } } : {}),
  };
  return {
    answered: {},
    landing: { bag, ...(layer ? { layer } : {}) },
    where: `bag=${container.bag!}${container.realm ? ` realm=${container.realm}` : ""}`,
    provenance: param("bag", bag),
    wiki: container.bag!,
    sink,
    read,
    exists: async (title) => (await sink.read(title)) !== undefined,
    place: async (title) => { const reading = await familyReadingIn(title, sink); return { position: reading.position, family: reading.root, orphan: reading.orphan }; },
    member: (next) => next as unknown as TiddlerFields,
    settle: (next) => ({ fields: next as unknown as TiddlerFields, strings: stringsOf(next) }),
    swap: async (title, liveHash, next) => {
      const now = await read(title);
      if ((now ? hashOf(now) : null) !== liveHash) return false;
      await sink.land(next as unknown as TiddlerFields);
      return true;
    },
  };
}

/** The seat a put names: the bag's own store where the call names a bag (a lit sibling's lane among them), else the wiki's engine. */
async function putSeatOf(opts: TiddlerVerbOptions, args: Readonly<Record<string, unknown>>, ctx: VerbContext): Promise<PutSeat> {
  const container = readContainer(args, "tiddler-put");
  if (container.bag !== null) return bagSeat(opts, container, "tiddler put", ctx);
  const anchor = anchorOf(opts, args, "tiddler-put", true);
  await requireWrite(opts, anchor, ctx.cap, "tiddler put", ctx.asker);
  return wikiSeat(opts, anchor, ctx);
}

/**
 * THE BASE A PUT NAMES. A record's hash guards the record; a carrier's canonical hash guards the family. A PARTIAL BASE
 * (one slot's read, `partial:#/a:<hash>`; a page short of the end, `partial:pN:<hash>`) names a carrier its reader saw in
 * part, so it guards a put WITHIN THE SPAN IT READ: a put whose title names that slot or a slot nested in it, or a slot
 * the page carried (recomputed from the carrier the base names; a carrier that moved reads stale at the gate). Beyond the
 * span the put refuses `base-outside-span`, and a partial that names no readable span refuses the same. A put that speaks
 * for the whole carrier (its title names the root) refuses a partial base by `readBase`'s own law (`base-from-partial`).
 */
async function putBaseOf(raw: string | null, title: string, writesText: boolean, seat: PutSeat): Promise<string | null> {
  const root = rootAddressOf(title);
  const slot = title.startsWith(`${root}#/`) ? title.slice(root.length) : null;
  if (raw === null || slot === null || !raw.startsWith("partial:")) return readBase(raw, "tiddler-put", writesText);
  const span = partialSpanOf(raw);
  if (!span || !/^partial:(?:#\/[^:]+|p[1-9][0-9]*):.+$/.test(raw)) {
    throw new VerbRefusal("base-outside-span", `base-outside-span: this partial base names no readable span; read the slot again (\`lares get title="${title}" ${seat.where} aperture=arc\`) or the whole carrier (\`lares get title="${root}" ${seat.where} aperture=arc\`) and put against that base. The span guards honest base reuse and grants no authorization. Nothing moved.`);
  }
  const base = readBase(raw, "tiddler-put", true, "accept");
  const outside = (why: string): VerbRefusal => new VerbRefusal("base-outside-span", `base-outside-span: this base came from ${why}, and ${slot} lies outside it; read ${slot} (\`lares get title="${title}" ${seat.where} aperture=arc\`) or the whole carrier (\`lares get title="${root}" ${seat.where} aperture=arc\`) and put against that base. Nothing moved.`);
  if ("slot" in span) {
    if (slot !== span.slot && !slot.startsWith(`${span.slot}/`)) throw outside(`a read of the slot ${span.slot}`);
  } else {
    const standing = await readMeme(root, seat.sink);
    if (standing && standing.canonicalHash === base && pageOfSlot(standing.text, slot) !== span.page) throw outside(`page ${span.page} of the whole carrier`);
  }
  return base;
}

/**
 * THE ONE PUT LAW, over a seat. THE LANDING, AS A COMPARE-AND-SWAP. A wiki serializes every writer that passes through it in
 * this process: its `addTiddler` runs synchronously on the event loop, and the shore's drain carries each title's wiki state
 * to the store in the order the wiki took it. A writer that reaches a store directly (a bag's seat, INGEST, a face lane, a
 * peer's wave) meets the drain's per-field merge instead, where two writes of one field resolve last-writer-wins. A round
 * reads the record, decides, awaits admission, then re-reads it; only a record that still hashes as it read lands (`swap`).
 * A record that moved meanwhile sends the round back to read again (an append re-composes over the newer text; a base the
 * moved record fails to match answers `conflict`), bounded, and a round that never settles answers `conflict`.
 */
async function putThrough(opts: TiddlerVerbOptions, seat: PutSeat, title: string, args: Readonly<Record<string, unknown>>, ctx: VerbContext): Promise<Record<string, unknown>> {
  // TiddlyWiki's own list reading, engine-free (`carrier-form`), so a bag's seat composes no engine to parse a tag list.
  const listOf = (raw: unknown): string[] => Array.isArray(raw) ? raw.map(String) : typeof raw === "string" ? [...(parseTitleList(raw) ?? [])] : [];
  const append = typeof args["append"] === "string" ? args["append"] : null;
  // A REPLACE NAMES ONE SPAN AND ITS NEW WORDS (`with` may read empty: the span leaves). It rides as a text put of the
  // result, so a base, a field patch beside the text and a tag patch ride with it; another text source does not.
  const spanRaw = args["replace"] !== undefined && args["replace"] !== null ? args["replace"] : null;
  const withRaw = args["with"] !== undefined && args["with"] !== null ? args["with"] : null;
  if (spanRaw !== null || withRaw !== null) {
    if (typeof spanRaw !== "string" || spanRaw === "") throw new VerbRefusal("replace-span-missing", "replace-span-missing: a replace names the one span it changes (`replace`, `replace='<old span>'`), copied from the standing text. Nothing moved.");
    if (typeof withRaw !== "string") throw new VerbRefusal("replace-with-missing", `replace-with-missing: a replace names the words the span turns into (\`with\`, \`with='<new span>'\`; \`with=''\` removes the span). Nothing moved.`);
    const crossed = ["text", "append", "cut"].filter((name) => args[name] !== undefined && args[name] !== null);
    if (flagOn(args["create"])) crossed.push("create");
    if (Object.prototype.hasOwnProperty.call(patchArg(args["fields"]), "text")) crossed.push("fields.text");
    if ((namesArg(args["unset"]) ?? []).includes("text")) crossed.push("unset text");
    if (crossed.length > 0) throw new VerbRefusal("replace-alone", `replace-alone: a replace changes one span of the standing text and carries no ${crossed.map((n) => `\`${n}\``).join(", ")}; send the whole text as its own put (\`lares put title="${title}" ${seat.where} file=<path> base=<hash>\`), or the replace alone. Nothing moved.`);
  }
  const replace = typeof spanRaw === "string" ? spanRaw : null;
  const replaceWith = typeof withRaw === "string" ? withRaw : "";
  if (append !== null) {
    // AN APPEND NAMES ONLY ITS WORDS: it overwrites nothing, so it carries no base, no whole text and no field patch.
    const crossed = ["text", "base", "fields", "unset"].filter((name) => args[name] !== undefined && args[name] !== null);
    if (crossed.length > 0) throw new VerbRefusal("append-alone", `append-alone: an append lands its words at the end of the standing text and carries no ${crossed.map((n) => `\`${n}\``).join(", ")}; send those as their own put. Nothing moved.`);
    if (append === "") throw new VerbRefusal("append-empty", "append-empty: an append names the words it lands. Nothing moved.");
  }
  // A CUT NAMES THE SLOTS THAT LEAVE: rooted paths (`#/a`), as a list or one TiddlyWiki list string. Absence never cuts.
  const cutRaw = args["cut"];
  const cut: string[] = listOf(cutRaw);
  const offPath = cut.filter((slot) => !/^#\/[^$\s]/.test(slot));
  if (offPath.length > 0) throw new VerbRefusal("cut-malformed", `cut-malformed: a cut names a slot by its rooted path (\`#/name\`, \`#/name/child\`); got ${offPath.map((slot) => `"${slot}"`).join(", ")}. Nothing moved.`);

  // The receipt a replace carries: the bytes the span held and the bytes that took its place.
  const replaced = replace !== null ? { span: bytesOf(replace), with: bytesOf(replaceWith) } : null;
  for (let round = 0; ; round++) {
    const before = await seat.read(title);
    const standing = before !== null;
    const liveHash = before ? hashOf(before) : null;
    const place = standing ? await seat.place(title) : PLAIN_PLACE;
    const answer = (decision: string, more: Record<string, unknown>): Record<string, unknown> =>
      ({ ...seat.answered, title, decision, ...seat.landing, ...more, ...placeFields(place) });
    const unmoved = { created: false, changed: [], hash: liveHash, textHash: before ? textHashOf(before) : null };
    if (round >= PUT_SETTLE_ROUNDS) return answer("conflict", { ...unmoved, unsettled: round });

    // CREATE-ONLY ON REQUEST, and the base where one rides: either answers before any field moves. An append to a missing
    // title refuses unless `create` names it; with `create`, an append lands a new record or joins the standing one.
    if (append !== null) {
      if (!standing && !flagOn(args["create"])) throw new VerbRefusal("append-target-missing", `append-target-missing: no record "${title}" stands to append to; name \`create\` (\`create=true\`) to land the words as a new record. Nothing moved.`);
    } else if (replace !== null) {
      if (!standing) throw new VerbRefusal("replace-target-missing", `replace-target-missing: no record "${title}" stands to replace a span in; \`lares get title="${title}" ${seat.where}\` reads what stands, and \`lares put title="${title}" ${seat.where} text=…\` lands a new record. Nothing moved.`);
    } else if (flagOn(args["create"]) && (await seat.exists(title))) return answer("exists", unmoved);
    // A TEXT WRITE BY ANY PATH: `text`, a field patch naming `text`, or an unset of it. A card's base takes none of them.
    const writesText = cut.length > 0 || append !== null || replace !== null || typeof args["text"] === "string" || Object.prototype.hasOwnProperty.call(patchArg(args["fields"]), "text") || (namesArg(args["unset"]) ?? []).includes("text");
    const base = await putBaseOf(optionalStringArg(args, "base"), title, writesText, seat);
    // TWO BASES, ONE DOOR: a record's hash (`sha256-…`, the record lens) guards the record; a carrier's canonical hash
    // (`sha256:…`, the meme lens) guards the family, and the Confluence gate reads it below where the put moves a family's text.
    const carrierBase = base !== null && base.startsWith("sha256:") ? base : null;
    if (base !== null && carrierBase === null && base !== liveHash) return answer("conflict", unmoved);

    // AN APPEND ON A SLOT JOINS ITS BODY'S END: the postamble's record where one stands with non-blank text, the slot's own
    // record otherwise, one blank line between (`slotAppendTarget`, `joinedParagraph`). A plain tiddler and a root keep the
    // plain record join (`appendedText`).
    const slotWords = append !== null && standing && place.position === "slot" && !place.orphan ? await slotAppendTarget(title, seat.sink) : null;
    const joined = slotWords && append !== null
      ? { title: slotWords.title, fields: { ...slotWords.fields, text: joinedParagraph(typeof slotWords.fields.text === "string" ? slotWords.fields.text : "", append) } as TiddlerFields }
      : null;

    // THE PATCH: named fields set, named fields unset, tags added and removed; the text moves only where the caller names it.
    const patch = patchArg(args["fields"]);
    if (patch["title"] !== undefined && patch["title"] !== title) throw new VerbRefusal("fields-malformed", "fields-malformed: a put never re-titles; `fields.title` must match args.title or stay absent.");
    const next: Record<string, string> = { ...(before ?? {}), ...patch, title };
    if (typeof args["text"] === "string") next["text"] = args["text"];
    // THE SPAN TURNS OVER THE TEXT THIS ROUND READ: a record that moved before the swap sends the round back, and the count
    // reads again over the newer text.
    if (replace !== null) next["text"] = replacedText(before?.["text"] ?? "", replace, replaceWith, title, seat.where);
    if (append !== null) {
      if (joined === null) next["text"] = appendedText(before?.["text"] ?? "", append);
      else if (joined.title === title) next["text"] = String(joined.fields.text);
    }
    // A cut takes the slot's call out of this record's text, so the text omits what the cut names.
    if (cut.length > 0 && typeof next["text"] === "string") next["text"] = dropKaheaCalls(next["text"], new Set(cut));
    for (const name of namesArg(args["unset"]) ?? []) if (name !== "title") delete next[name];
    const add = listOf(args["tagsAdd"]);
    const remove = new Set(listOf(args["tagsRemove"]));
    let tags = listOf(next["tags"] ?? "");
    if (add.length > 0 || remove.size > 0) {
      tags = [...tags.filter((tag) => !remove.has(tag)), ...add.filter((tag) => !tags.includes(tag) && !remove.has(tag))];
      if (tags.length > 0) next["tags"] = stringifyList(tags); else delete next["tags"];
    }
    // A POINTER SEATS BEFORE ANYTHING COMPARES: the record that lands reads as the house pointer, verified or owed.
    const pointer = await seatPointer(title, before, next, opts.resolveByCid);
    if (bytesOf(next) > 1_048_576) throw new VerbRefusal("fields-malformed", "fields-malformed: one record carries at most 1048576 bytes through this door.");

    // A FAMILY READS AS TIDDLERS. A meme root and its slots stand as ordinary records, and a put moves any of them: a field or
    // tag patch lands as it lands anywhere; a text write lands THROUGH the Confluence gate (below), which re-splits the
    // family and reseals its block check. A family's `type` and `$` carriage fields derive from the text at each split, so
    // no put sets them; a new slot joins through its parent's text, and a fragment address founds no meme.
    const moved = (name: string): boolean => (before?.[name] ?? undefined) !== (next[name] ?? undefined);
    const structural = Object.keys({ ...(before ?? {}), ...next }).filter((name) => moved(name) && (name === "text" || name === "type" || name.startsWith("$")));
    const member = place.position !== "plain";
    // A FIRST RECORD FOUNDS ITS FAMILY where it names the carrier type, or where its text frames a whole carrier and it names
    // no type at all (the carrier's own head mark says what it holds).
    const framed = append === null && typeof next["text"] === "string" && framesCarrier(next["text"]);
    const founds = !standing && next["$fragment-parent"] === undefined && !title.includes("#") && (next["type"] === CARRIER_TYPE || (next["type"] === undefined && framed));
    const carriage = structural.filter((name) => name !== "text");
    if (member && carriage.length > 0) {
      throw new VerbRefusal("family-carriage-derives", `family-carriage-derives: "${title}" stands as a meme ${place.position} and this put moves ${carriage.map((n) => `\`${n}\``).join(", ")}; a family's \`type\` and \`$\` carriage fields derive from its text at each split, and no put sets them. Put the text alone (\`lares put title="${title}" ${seat.where} text=…\`) and the split re-mints them; a field or tag patch lands in the same put. Nothing moved.`);
    }
    // A FRAGMENT ADDRESS UNDER A STANDING ROOT NAMES A SLOT: one the family does not hold joins through its parent's text alone.
    const strays = !standing && !founds && title.includes("#") && isMemeRoot(rootAddressOf(title), await seat.sink.read(rootAddressOf(title)));
    if (!standing && !founds && (next["type"] === CARRIER_TYPE || next["$fragment-parent"] !== undefined || strays)) {
      const parent = typeof next["$fragment-parent"] === "string" ? next["$fragment-parent"] : rootAddressOf(title);
      throw new VerbRefusal("family-joins-by-text", `family-joins-by-text: "${title}" would land as a slot no parent text calls; a slot joins its family through its parent's text, and a fragment address founds no meme. Write the slot's \`<<~ ahu slot=…>>\` block into the parent's text (\`lares put title="${parent}" ${seat.where} text=…\`) and the split lands the slot. Nothing moved.`);
    }
    const familyWrite = founds || (member && (structural.includes("text") || cut.length > 0 || joined !== null));
    if (cut.length > 0 && !(member && standing)) {
      throw new VerbRefusal("cut-not-omitted", `cut-not-omitted: a cut names slots of a standing meme family, and "${title}" stands as ${standing ? "a plain tiddler" : "no record"}. Name the family's root or the slot's parent (\`lares put title=<root> ${seat.where} cut-slot='#/slot'\`). Nothing moved.`);
    }
    if (carrierBase !== null && !familyWrite) return answer("conflict", unmoved);
    // ONLY THE RENDERER WRITES A RENDERED TIDDLER: a put over one, or one that would land carrying `rendered-from`, refuses.
    refuseRenderedWrite(title, before, next, "tiddler put");
    refuseMalformedStagePath(title);

    const changed = Object.keys({ ...(before ?? {}), ...next }).filter(moved);
    if (standing && changed.length === 0 && cut.length === 0 && joined === null) return answer("noop", { ...unmoved, ...(pointer ? { pointer } : {}) });

    // THE CONFLUENCE GATE, INSIDE THE PUT. A text write on a family member, or a first record that founds, lands as the
    // family: the member's record takes its place in a copy of the family, the one recompose frames the carrier
    // (`composeMemberCarrier`), and `placeMeme` lands it in the root's own turn under the hash it composed over. A root
    // text that frames a whole carrier (its own head mark) speaks for the family as it stands. ABSENCE NEVER DELETES: a slot
    // the new text omits stays standing by reference (`kept`), as a folded read hands it back; a slot leaves only where
    // `cut` names it (`tombstoned`), or by its own delete. A SLOT'S TEXT MOVES THE SLOT'S OWN RECORD: its standing
    // `$preamble` and `$postamble` carriage stays, since the recompose reads every record the put did not name.
    if (familyWrite) {
      const root = place.family ?? title;
      const whole = title === root && append === null && typeof next["text"] === "string" && moved("text") && framesCarrier(next["text"]);
      let carrier: { text: string; baseHash: string | null } | null = null;
      if (whole) {
        const beside = changed.filter((name) => name !== "text" && name !== "title" && !(name === "type" && !standing));
        if (beside.length > 0) throw new VerbRefusal("carrier-speaks-whole", `carrier-speaks-whole: this text frames a whole carrier, which names its fields in its own meta block, and the put also moves ${beside.map((n) => `\`${n}\``).join(", ")}. Send the carrier alone, or write those fields into its \`toml meta\` block; a field patch lands as its own put. Nothing moved.`);
        carrier = { text: next["text"]!, baseHash: carrierBase };
      } else {
        // The member that takes the write: the record this put names, or the postamble a slot's append joins.
        const taking = joined !== null && joined.title !== title ? joined : { title, fields: seat.member(next) };
        const composed = await composeMemberCarrier({ uri: root, title: taking.title, fields: taking.fields }, seat.sink);
        if (composed.kind === "carrier") carrier = { text: composed.text, baseHash: carrierBase ?? composed.canonicalHash };
      }
      // No carrier stands at the root (an orphaned slot, a root that left): the record lands plainly, below.
      if (carrier !== null) {
        const vet = async (records: readonly Record<string, unknown>[]): Promise<void> => {
          for (const record of records) {
            const landing = String(record["title"] ?? root);
            refuseEffectLedgerWrite(landing, "tiddler put");
            refuseRenderedWrite(landing, null, record, "tiddler put");
          }
        };
        // The record this round read still stands as it read; a record that moved sends the round back.
        const now = await seat.read(title);
        if ((now ? hashOf(now) : null) !== liveHash) continue;
        const receipt = await placeMeme({ uri: root, text: carrier.text, baseHash: carrier.baseHash, vet, keepAbsent: true, cut, holdAnswer: true, ...(ctx.signal ? { signal: ctx.signal } : {}) }, seat.sink);
        if (receipt.decision === "refuse") {
          const cutWall = receipt.diagnostics.find((d) => d.code === CUT_NOT_OMITTED_CODE);
          if (cutWall) throw new VerbRefusal(CUT_NOT_OMITTED_CODE, cutWall.message);
          throw new VerbRefusal("family-gate-refused", `family-gate-refused: with this text the family of "${root}" no longer reads as one carrier: ${receipt.warnings.join("; ") || "the gate named no finding"}. Mend the text and put again; \`lares get title="${root}" ${seat.where} aperture=arc\` shows the carrier as it stands. Nothing moved.`);
        }
        const landed = await seat.read(title);
        const family = { canonicalHash: receipt.canonicalHash ?? null, landed: receipt.landed, kept: receipt.kept ?? [], tombstoned: receipt.tombstoned, ...(receipt.warnings.length > 0 ? { warnings: receipt.warnings } : {}) };
        if (receipt.decision === "conflict") {
          // A base the caller named answers; a base this put composed over moved under it, and the round reads again.
          if (carrierBase === null) continue;
          return answer("conflict", { ...unmoved, ...family });
        }
        if (receipt.decision === "noop" && cut.length > 0) {
          throw new VerbRefusal(CUT_NOT_OMITTED_CODE, `${CUT_NOT_OMITTED_CODE}: "${title}" calls none of ${cut.map((slot) => `\`${slot}\``).join(", ")}, so the cut moved nothing. Name the slot's parent as the put's title (\`lares get meme=true tree=true ${seat.where}\` shows which record calls it). Nothing moved.`);
        }
        if (receipt.decision === "noop") return answer("noop", { ...unmoved, ...family });
        const hash = landed ? hashOf(landed) : null;
        return {
          ...(append !== null ? { has: hasLine(title, [seat.provenance, param("decision", "put"), param("hash", hash ?? "")]) } : {}),
          ...seat.answered, title, decision: "put", ...seat.landing, created: !standing, changed, hash, textHash: landed ? textHashOf(landed) : null,
          ...(append !== null ? { appended: bytesOf(append), ...(joined !== null ? { appendedTo: joined.title } : {}) } : {}), ...(replaced ? { replaced } : {}), ...family, ...placeFields(await seat.place(title)),
        };
      }
      // A slot's append that named the postamble found no carrier to recompose: the words join the slot's own record.
      if (joined !== null && joined.title !== title) next["text"] = joinedParagraph(before?.["text"] ?? "", append!);
    }
    // THE SWAP: the record lands only where it still stands as this round read it.
    if (!(await seat.swap(title, liveHash, next))) continue;
    const landed = (await seat.read(title))!;
    const hash = hashOf(landed);
    return {
      ...(append !== null ? { has: hasLine(title, [seat.provenance, param("decision", "put"), param("hash", hash)]) } : {}),
      ...answer("put", { created: !standing, changed: Object.keys({ ...(before ?? {}), ...next }).filter(moved), hash, textHash: textHashOf(landed), ...(append !== null ? { appended: bytesOf(append) } : {}), ...(replaced ? { replaced } : {}), ...(pointer ? { pointer } : {}) }),
    };
  }
}

// ── THE DRY PATH (comms-ux-enacts landing 7) ──────────────────────────────────────────────────────────

/** How deep a dry write answers: the summary (`_`, `_?`), or the summary and the full diff (`_!`). */
type DryDepth = "summary" | "diff";

/** The depth a write's `dry` arg names (the call's seat folds a `_` carry into it), or null for a write that lands. */
function dryOf(args: Readonly<Record<string, unknown>>): DryDepth | null {
  const raw = args["dry"];
  if (raw === "diff") return "diff";
  return raw === "summary" || raw === true || raw === "true" ? "summary" : null;
}

/** A dry seat: the real seat beneath an overlay holding what the run would land (a record as it would read, null where it leaves). */
interface DrySeat extends PutSeat { readonly overlay: ReadonlyMap<string, Settled | null> }

/**
 * THE DRY SEAT: the real seat beneath an overlay. Every read sees the overlay first; every landing (`swap`, the sink's `land`)
 * and every removal (`tombstone`, `leaveFamily`) writes the overlay alone, settled as the real seat would read it back. So the
 * one put law, the family recompose and the Confluence gate run whole over it and answer what the real call lands, while the
 * store, the wiki and the shore take nothing (no face rides `wikiWearsNext`, no alert rail rises).
 */
function drySeatOf(seat: PutSeat): DrySeat {
  const overlay = new Map<string, Settled | null>();
  const real = seat.sink;
  const { beneath, leaveFamily } = real;
  const sink: MemeSink = {
    titles: async () => {
      const held = new Set(await real.titles());
      for (const [title, next] of overlay) { if (next === null) held.delete(title); else held.add(title); }
      return [...held];
    },
    read: async (title) => (overlay.has(title) ? overlay.get(title)?.fields : await real.read(title)),
    land: (fields) => { overlay.set(String((fields as { title?: unknown }).title ?? ""), seat.settle(fields as unknown as Record<string, unknown>)); },
    tombstone: (gone) => { overlay.set(gone, null); },
    tombstoneFamily: (titles) => { for (const gone of titles) overlay.set(gone, null); },
    // A sink that knows its layers still answers which removal raises a kāpae; the removal itself lands in the overlay.
    ...(beneath !== undefined && leaveFamily !== undefined ? {
      beneath: (title: string) => beneath.call(real, title),
      leaveFamily: (tombstones: readonly string[], retracts: readonly string[]) => { for (const gone of [...tombstones, ...retracts]) overlay.set(gone, null); },
    } : {}),
  };
  const shown = (title: string): Record<string, string> | null => { const next = overlay.get(title); return next ? { ...next.strings } : null; };
  return {
    ...seat,
    sink,
    overlay,
    read: async (title) => (overlay.has(title) ? shown(title) : seat.read(title)),
    exists: async (title) => (overlay.has(title) ? overlay.get(title) !== null : seat.exists(title)),
    // Where the run moved nothing yet the real seat's reading stands; past that the family law reads over the overlay.
    place: async (title) => {
      if (overlay.size === 0) return seat.place(title);
      const reading = await familyReadingIn(title, sink);
      return { position: reading.position, family: reading.root, orphan: reading.orphan };
    },
    swap: async (title, liveHash, next) => {
      const now = overlay.has(title) ? shown(title) : await seat.read(title);
      if ((now ? hashOf(now) : null) !== liveHash) return false;
      overlay.set(title, seat.settle(next));
      return true;
    },
  };
}

/** The most cells a line diff's table spans; past it the diff answers every old line removed and every new line added. */
const LINE_DIFF_CELLS = 4_000_000;

/**
 * A LINE DIFF, unified: `@@ -a,n +b,m @@` hunk heads, then each line under ` ` (kept), `-` (leaves) or `+` (lands), three lines of
 * context around each change. The longest common run of lines decides what stays; a text pair past `LINE_DIFF_CELLS` answers
 * the whole middle removed and added, never a guess.
 */
export function lineDiff(before: string, after: string, context = 3): string[] {
  const a = before === "" ? [] : before.split("\n");
  const b = after === "" ? [] : after.split("\n");
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  const ops: Array<{ readonly op: " " | "-" | "+"; readonly line: string }> = a.slice(0, head).map((line) => ({ op: " " as const, line }));
  if (midA.length * midB.length <= LINE_DIFF_CELLS) {
    const n = midA.length;
    const m = midB.length;
    const run = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) run[i]![j] = midA[i] === midB[j] ? run[i + 1]![j + 1]! + 1 : Math.max(run[i + 1]![j]!, run[i]![j + 1]!);
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) { ops.push({ op: " ", line: midA[i]! }); i++; j++; }
      else if (run[i + 1]![j]! >= run[i]![j + 1]!) { ops.push({ op: "-", line: midA[i]! }); i++; }
      else { ops.push({ op: "+", line: midB[j]! }); j++; }
    }
    for (; i < n; i++) ops.push({ op: "-", line: midA[i]! });
    for (; j < m; j++) ops.push({ op: "+", line: midB[j]! });
  } else {
    for (const line of midA) ops.push({ op: "-", line });
    for (const line of midB) ops.push({ op: "+", line });
  }
  for (const line of a.slice(a.length - tail)) ops.push({ op: " ", line });
  // Each op's line number on either side, before it.
  const atA: number[] = [];
  const atB: number[] = [];
  let na = 0;
  let nb = 0;
  for (const { op } of ops) { atA.push(na); atB.push(nb); if (op !== "+") na++; if (op !== "-") nb++; }
  const changed = ops.flatMap((row, k) => (row.op === " " ? [] : [k]));
  const out: string[] = [];
  for (let g = 0; g < changed.length;) {
    let last = g;
    while (last + 1 < changed.length && changed[last + 1]! - changed[last]! <= 2 * context + 1) last++;
    const from = Math.max(0, changed[g]! - context);
    const to = Math.min(ops.length, changed[last]! + context + 1);
    const span = ops.slice(from, to);
    const countA = span.filter((row) => row.op !== "+").length;
    const countB = span.filter((row) => row.op !== "-").length;
    out.push(`@@ -${atA[from]! + (countA > 0 ? 1 : 0)},${countA} +${atB[from]! + (countB > 0 ? 1 : 0)},${countB} @@`);
    for (const row of span) out.push(`${row.op}${row.line}`);
    g = last + 1;
  }
  return out;
}

/** One record a dry run would move: how (`create`, `change`, `remove`, `retract`, `move`), its fields before and after, its text diff. */
interface DryChange {
  readonly title: string;
  readonly act: "create" | "change" | "remove" | "retract" | "move";
  readonly fields: Record<string, { readonly before: string | null; readonly after: string | null }>;
  /** The text, line by line (`lineDiff`), where it moves. */
  readonly text?: readonly string[];
  /** A move's new title. */
  readonly to?: string;
}

/** The change between a record as it stands and as it would read (null: absent), or null where nothing moves. */
function changeOf(title: string, before: Record<string, string> | null, after: Record<string, string> | null): DryChange | null {
  if (before === null && after === null) return null;
  const fields: Record<string, { before: string | null; after: string | null }> = {};
  for (const name of [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort()) {
    if (name === "text") continue;
    const was = before?.[name] ?? null;
    const now = after?.[name] ?? null;
    if (was !== now) fields[name] = { before: was, after: now };
  }
  const textMoves = (before?.["text"] ?? null) !== (after?.["text"] ?? null);
  if (before !== null && after !== null && !textMoves && Object.keys(fields).length === 0) return null;
  return {
    title, act: before === null ? "create" : after === null ? "remove" : "change", fields,
    ...(textMoves ? { text: lineDiff(before?.["text"] ?? "", after?.["text"] ?? "") } : {}),
  };
}

const changesOf = (rows: ReadonlyArray<DryChange | null>): DryChange[] => rows.filter((row): row is DryChange => row !== null);

/** The diff a dry seat's overlay holds: each record it would move, read against the real seat beneath. */
async function dryDiffOf(shadow: DrySeat, seat: PutSeat): Promise<DryChange[]> {
  const rows: Array<DryChange | null> = [];
  for (const title of [...shadow.overlay.keys()].sort()) {
    const held = await seat.sink.read(title);
    const before = held ? seat.settle(held as unknown as Record<string, unknown>).strings : null;
    rows.push(changeOf(title, before, shadow.overlay.get(title)?.strings ?? null));
  }
  return changesOf(rows);
}

/** The removals a delete would land, read off a wiki (the reader's view): each record as it stands, leaving. */
function removalsOf(wiki: EngineWiki, titles: readonly string[]): DryChange[] {
  return changesOf(titles.map((title) => { const held = wiki.getTiddler(title); return changeOf(title, held ? readRecord(held).fields : null, null); }));
}

/** A dry answer: the real call's answer as it would land, its depth, the base it needs, and at `diff` every record it would move. */
function dryAnswer(answer: Record<string, unknown>, depth: DryDepth, needs: Record<string, unknown>, diff: readonly DryChange[] | null): Record<string, unknown> {
  return { ...answer, dry: depth, needs, ...(diff !== null ? { diff } : {}), note: "a dry run: the door walked its law to the last step and landed nothing" };
}

/** The base a write on `title` takes: the record's hash, and on a family member the carrier's canonical hash. */
async function baseNeeded(seat: PutSeat, title: string): Promise<Record<string, unknown>> {
  const before = await seat.read(title);
  if (before === null) return { base: null };
  const place = await seat.place(title);
  const carrier = place.position === "plain" ? null : await readMeme(place.family ?? rootAddressOf(title), seat.sink);
  return { base: hashOf(before), ...(carrier ? { carrierBase: carrier.canonicalHash } : {}) };
}

/** A DRY PUT: the one put law, whole, over a dry seat; the answer names what the real put lands, hash for hash. */
async function dryPut(opts: TiddlerVerbOptions, seat: PutSeat, title: string, args: Readonly<Record<string, unknown>>, ctx: VerbContext, depth: DryDepth): Promise<Record<string, unknown>> {
  const needs = await baseNeeded(seat, title);
  const shadow = drySeatOf(seat);
  const answer = await putThrough(opts, shadow, title, args, ctx);
  return dryAnswer(answer, depth, needs, depth === "diff" ? await dryDiffOf(shadow, seat) : null);
}

/** The put over the seat its container names; a delete lands a slot's cut through it. A dry put lands nothing (`dryPut`). */
function tiddlerPut(opts: TiddlerVerbOptions): VerbReactor {
  return async (args, ctx) => {
    // THE CONTAINER FIRST, then the title: a call that names no container refuses before anything reads.
    readContainer(args, "tiddler-put");
    const title = stringArg(args, "title");
    if (!title) throw new Error("tiddler-put: args.title is required");
    refuseWithheld(title, "tiddler-put");
    refuseEffectLedgerWrite(title, "tiddler-put");
    refuseUnhandedCollapseRule(title, "tiddler put", ctx.asker);
    const seat = await putSeatOf(opts, args, ctx);
    const dry = dryOf(args);
    return dry === null ? putThrough(opts, seat, title, args, ctx) : dryPut(opts, seat, title, args, ctx, dry);
  };
}

export const makeTiddlerPutReactor = everyWiki("tiddler-put", true, tiddlerPut);

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

// ── carrier-act (comms-ux-enacts landing 13) ──────────────────────────────────────────────────────────

/** The daemon verb a carrier's own act runs through: `call` reaches it for an address whose skin row names `acts/<title>`. */
export const CARRIER_ACT_VERB = "carrier-act";

/** The `tm-*` messages that write: each runs through the door's own reactor, so it leaves a receipt as any door write does. */
export const WRITING_MESSAGES: ReadonlySet<string> = new Set(["tm-rename-tiddler", "tm-relink-tiddler"]);

interface ActEvent { readonly type: string; readonly param?: unknown; readonly paramObject?: Record<string, unknown>; readonly tiddlerTitle?: string }
interface ActWidget {
  wiki: EngineWiki;
  eventListeners: Record<string, Array<(event: ActEvent) => unknown>>;
  invokeActionString(actions: string, triggeringWidget?: unknown, event?: unknown, variables?: Record<string, string>): unknown;
}

/** One message an act sent, as its answer names it: a writing message with the door's decision, any other passed on. */
interface ActMessage { readonly type: string; readonly from?: string; readonly to?: string; readonly decision?: string; readonly refused?: string }

/**
 * The messages that reach a door of their own past the wiki: a hand's prompt (`tm-clear-password` seeds a custody clear a person
 * may confirm) and a host's render (`tm-download-file` renders a template and hands the text to the host). Each runs through
 * that door's own check when an act sends it; every other message passes to the engine's listeners untouched.
 */
export const HAND_MESSAGES: ReadonlySet<string> = new Set(["tm-clear-password"]);
export const RENDERING_MESSAGES: ReadonlySet<string> = new Set(["tm-download-file"]);

/**
 * A CARRIER BRINGS ITS OWN ACT (fork 11, the operator's trust lens): `{recipe, act, address?, params?, dry?}`. The `acts/` tiddler's
 * action string runs LIVE on the wiki's engine under the caller's face, as a person's click would, the bound params as its
 * variables: no sandbox stands around a trusted act, and THE DOOR KEEPS ITS GUARDS, as every write door does:
 *
 *   the cap    the Kahu predicate and the face's write cap on the bag the act lands in (`requireWrite`), before anything runs;
 *   the reach  the act reads through the face's reader view (`viewFor`), live and dry alike, so a record the face may not read
 *              reaches no write and no answer;
 *   the title  every title the act would write meets the put door's own refusals first (`tiddler-withheld`, the effect ledger,
 *              `rendered-derives`, a collapse rule's hand, and a meme family, which moves through the Confluence gate of the put
 *              door alone): the act runs once over a capture view, every title it would move meets them, and a refusal there
 *              lands nothing. The live run meets them again at each write.
 *
 * Every write crosses into the wiki tagged with the act (`<act>#<request>`), so the receipt of each record it moved rides this answer
 * (receipts where an act or a votum moves a record; the CRDT remembers every hand), and custody holds face against face at the shore (a write into another face's layer rides as a votum there).
 *
 * MESSAGES FLOW THROUGH THEIR DOORS. A writing message (`tm-rename-tiddler`, `tm-relink-tiddler`) runs through the rename door,
 * in the order the act sent it, once the action string returns; each walks that door dry in the capture pass first, so a rename
 * the door refuses refuses the act before anything lands (`act-message-refused`). A hand's prompt (`HAND_MESSAGES`) meets the hand gate's reading
 * of the asker (a seat refuses `hand-act-only`, an unread line `hand-unattested`). A host's render (`RENDERING_MESSAGES`) passes
 * only where the template renders the same through the face's reader view as through the whole wiki (else `act-message-withheld`).
 * A verb tiddler an act would mint stays home at the title guard. Every other message passes untouched.
 *
 * A PREVIEW LANDS NOTHING (`dry`, the call's `_` carry): the capture run's answer, what the act would write and every message
 * it would send (listed, never run), read through the reader view.
 */
export const makeCarrierActReactor = everyWiki(CARRIER_ACT_VERB, true, (opts: TiddlerVerbOptions): VerbReactor => async (args, ctx) => {
  const act = stringArg(args, "act");
  if (!act) throw new Error(`${CARRIER_ACT_VERB}: args.act names the action tiddler the carrier's skin row names (acts/<title>)`);
  const address = optionalStringArg(args, "address") ?? act;
  const anchor = anchorOf(opts, args, CARRIER_ACT_VERB, true);
  await requireWrite(opts, anchor, ctx.cap, "carrier act", ctx.asker);
  const engine = anchor.engine;
  const wiki = engine.wiki;
  type Reading = EngineWiki & { getTiddlerText(title: string, fallback?: string): string | undefined; renderTiddler(outputType: string, title: string, options?: { variables?: Record<string, unknown> }): string };
  const { view } = await viewFor(opts, anchor, ctx.cap);
  const reading = view as Reading;
  const actions = reading.getTiddlerText(act);
  if (actions === undefined) {
    throw new CallRefusal("act-missing", `${address} names its act ${act}, and no such tiddler stands in ${anchor.recipe} for this face`, cureCall("get", { title: `${address}#/skins` }));
  }
  const raw = args["params"];
  const named = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const variables = Object.fromEntries(Object.entries(named).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]));
  const dry = dryOf(args);
  const face = wornOrigin(ctx.worn).face;
  const crossing = `${act}#${ctx.invocation.requestId}`;
  const actCtx: VerbContext = { ...ctx, invocation: { ...ctx.invocation, action: act } };
  const titleOf = (t: unknown): string => String((t as { fields?: { title?: unknown }; title?: unknown }).fields?.title ?? (t as { title?: unknown }).title ?? "");
  const tiddlerOf = (t: unknown): EngineTiddler => ((t as { fields?: unknown }).fields ? t as EngineTiddler : new engine.Tiddler(t as Record<string, unknown>));
  const root = engine.rootWidget as ActWidget;

  /** THE TITLE GUARD: the put door's own refusals, read against the whole wiki's standing record. */
  const guard = (title: string, incoming: Record<string, string> | null): void => {
    refuseWithheld(title, "carrier act");
    refuseEffectLedgerWrite(title, CARRIER_ACT_VERB);
    refuseUnhandedCollapseRule(title, "carrier act", ctx.asker);
    const standing = wiki.getTiddler(title);
    const before = standing ? readRecord(standing).fields : null;
    refuseRenderedWrite(title, before, incoming, "carrier act");
    if (title.includes("#/") || before?.["type"] === CARRIER_TYPE || incoming?.["type"] === CARRIER_TYPE) {
      throw new CallRefusal("act-family-write", `the act ${act} would move "${title}", a meme family's record, and a family moves through the put door's Confluence gate alone (it re-splits and reseals); nothing landed`, cureCall("put", { title, text: "<the whole carrier>" }));
    }
  };

  // THE CAPTURE RUN: the act over a capture view of the reader view, every message stopped and listed.
  const captured = new Map<string, EngineTiddler | null>();
  const sent: ActMessage[] = [];
  const capture = Object.create(view) as EngineWiki;
  capture.addTiddler = (t) => { const tiddler = tiddlerOf(t); captured.set(titleOf(tiddler), tiddler); };
  capture.deleteTiddler = (title) => { captured.set(title, null); };
  capture.getTiddler = (title) => (captured.has(title) ? captured.get(title) ?? undefined : view.getTiddler(title));
  capture.tiddlerExists = (title) => (captured.has(title) ? captured.get(title) !== null : view.tiddlerExists(title));
  const preview = Object.create(root) as ActWidget;
  preview.wiki = capture;
  preview.eventListeners = new Proxy({}, { get: (_t, type) => (typeof type === "string" ? [(event: ActEvent) => { sent.push(messageOf(event)); return false; }] : undefined) }) as ActWidget["eventListeners"];
  preview.invokeActionString(actions, preview, undefined, variables);
  const writes = [...captured].map(([title, t]) => ({ title, fields: t === null ? null : readRecord(t).fields }));
  for (const { title, fields } of writes) guard(title, fields);
  // EVERY RENAME THE ACT WOULD SEND WALKS THE RENAME DOOR DRY FIRST: a rename the door refuses refuses the act, so no earlier
  // write or rename lands before a later one refuses. Each walks the wiki as it stands (a rename that leans on an earlier one in
  // the same act reads absent here and refuses: send the second from a later act).
  const rename = makeTiddlerRenameReactor(opts);
  for (const message of sent) {
    if (!WRITING_MESSAGES.has(message.type)) continue;
    if (message.from === undefined || message.to === undefined) {
      throw new CallRefusal("message-malformed", `the act ${act} sends ${message.type} without both a from and a to; nothing landed`, cureCall("get", { title: act }));
    }
    const walked = await rename({ recipe: anchor.recipe, title: message.from, to: message.to, dry: "summary" }, actCtx);
    if (walked["decision"] !== "renamed") {
      throw new CallRefusal("act-message-refused", `the act ${act} sends ${message.type} "${message.from}" → "${message.to}", which the rename door answers ${String(walked["decision"])}${walked["refusal"] ? ` (${String(walked["refusal"])})` : ""}; nothing landed`, cureCall("rename", { title: message.from, to: message.to, mu: "_" }));
    }
  }
  if (dry !== null) {
    return { has: hasLine(address, [param("recipe", anchor.recipe), param("act", act), param("decision", "dry")]),
      recipe: anchor.recipe, address, act, decision: "dry", dry, writes, messages: sent };
  }

  // LIVE: the reader view's reads, the live wiki's writes, each guarded and tagged with the act as it crosses. The act asks the shore
  // for the receipts its writes leave, and they ride this answer (no ring keeps them past it).
  const collector = wikiCollectReceipts(opts.tw5, crossing);
  const wrote: string[] = [];
  const removed: string[] = [];
  const messages: ActMessage[] = [];
  const live = Object.create(view) as EngineWiki & Record<string, unknown>;
  // A write moves the live wiki; the view's caches follow it, so the act's next read sees what it just wrote.
  const fresh = (): void => { live["filterCache"] = Object.create(null); live["filterCacheCount"] = 0; live["caches"] = Object.create(null); live["globalCache"] = Object.create(null); };
  live.addTiddler = (t) => {
    const tiddler = tiddlerOf(t);
    const title = titleOf(tiddler);
    guard(title, readRecord(tiddler).fields);
    wikiWearsNext(opts.tw5, title, face, crossing);
    wrote.push(title);
    wiki.addTiddler(tiddler);
    fresh();
  };
  live.deleteTiddler = (title) => {
    guard(title, null);
    wikiWearsNext(opts.tw5, title, face, crossing);
    removed.push(title);
    wiki.deleteTiddler(title);
    fresh();
  };
  const widget = Object.create(root) as ActWidget;
  widget.wiki = live;
  const owed: ActEvent[] = [];
  const passOn = (event: ActEvent): unknown => {
    for (const handler of root.eventListeners?.[event.type] ?? []) handler.call(root, event);
    return false;
  };
  const own: Record<string, Array<(event: ActEvent) => unknown>> = { ...(root.eventListeners ?? {}) };
  for (const type of WRITING_MESSAGES) own[type] = [(event: ActEvent) => { owed.push(event); return false; }];
  for (const type of HAND_MESSAGES) {
    own[type] = [(event: ActEvent) => {
      // THE HAND GATE'S READING OF THE ASKER: a seat or an unread line asks no person's confirmation through an act.
      const code = askerRefusal(ctx.asker);
      if (code !== null) { messages.push({ ...messageOf(event), refused: code }); return false; }
      messages.push({ ...messageOf(event), decision: "passed" });
      return passOn(event);
    }];
  }
  for (const type of RENDERING_MESSAGES) {
    own[type] = [(event: ActEvent) => {
      // THE READER VIEW DECIDES A RENDER: a template that renders otherwise through the whole wiki reads what this face may not.
      const template = typeof event.param === "string" && event.param !== "" ? event.param : "$:/core/save/all";
      const options = { variables: event.paramObject ?? {} };
      let same = false;
      try { same = reading.renderTiddler("text/plain", template, options) === (wiki as unknown as Reading).renderTiddler("text/plain", template, options); } catch { same = false; }
      if (!same) { messages.push({ ...messageOf(event), refused: "act-message-withheld" }); return false; }
      messages.push({ ...messageOf(event), decision: "passed" });
      return passOn(event);
    }];
  }
  widget.eventListeners = own;
  // A live run that refuses mid-way still lets its collector go: what landed before the refusal drains, and nothing keeps it.
  try { widget.invokeActionString(actions, widget, undefined, variables); }
  catch (fault: unknown) { void collector.done().catch(() => {}); throw fault; }
  for (const event of owed) {
    const message = messageOf(event);
    if (message.from === undefined || message.to === undefined) { messages.push({ ...message, refused: "message-malformed" }); continue; }
    try {
      const answer = await rename({ recipe: anchor.recipe, title: message.from, to: message.to }, actCtx);
      messages.push({ ...message, decision: String(answer["decision"]) });
    } catch (fault: unknown) {
      messages.push({ ...message, refused: fault instanceof VerbRefusal ? fault.reason : fault instanceof Error ? fault.message : String(fault) });
    }
  }
  return { has: hasLine(address, [param("recipe", anchor.recipe), param("act", act), param("decision", "acted")]),
    recipe: anchor.recipe, address, act, decision: "acted", wrote: [...new Set(wrote)], removed: [...new Set(removed)], messages, receipt: crossing, receipts: await collector.done() };
});

/** A message as an act's answer names it: its type, and a rename's `from` and `to` (the navigator's own reading of the event). */
function messageOf(event: ActEvent): ActMessage {
  const params = event.paramObject ?? {};
  const from = typeof params["from"] === "string" ? params["from"] : event.tiddlerTitle;
  const to = typeof params["to"] === "string" ? params["to"] : undefined;
  return { type: event.type, ...(typeof from === "string" ? { from } : {}), ...(to !== undefined ? { to } : {}) };
}

// ── tiddler-rename ────────────────────────────────────────────────────────────────────────────────────

/** The forwarder's text: a transclusion of the new title, so an old road renders what the new one holds. */
const forwarderText = (to: string): string => `<$transclude $tiddler=\`\`\`${to}\`\`\` mode="block"/>`;

/**
 * A SYSTEM TITLE TAKES NO RENAME, for a seat and a hand alike. A rename leaves a forwarder at the title it moves from and
 * relinks every tag and list that names it; the engine reads a `$:/` title as a setting, as a tag that hooks each tagged record into
 * boot or render, or as code. A forwarder there would answer as the setting, and a relink onto a system tag would hang every
 * tagged record on it with no record of theirs passing the seat's wall. The put and the delete move such a record by hand.
 */
function refuseSystemTitleRename(named: string, title: string, to: string, recipe: string): void {
  if (!named.startsWith("$:/")) return;
  throw new VerbRefusal("rename-system-title", `rename-system-title: "${named}" names a system title, and a rename leaves a forwarder at the title it moves from and relinks every tag and list onto the new one: the engine would read the forwarder as the setting, or hang every tagged record on a system tag. Land the record under its new title with \`lares put title="${to}" recipe=${recipe}\`, then clear the standing one with \`lares delete title="${title}" recipe=${recipe}\`. Nothing moved.`);
}

/** The titles Relink's report marks impossible for a rename, or none when the offering stands absent from the wiki. */
function relinkImpossibles(wiki: EngineWiki, tw: unknown, from: string, to: string): string[] {
  const UTILS = "$:/plugins/flibbles/relink/js/utils.js";
  const twish = tw as { modules?: { titles?: Record<string, unknown>; execute(title: string): unknown } } | undefined;
  if (!twish?.modules?.titles?.[UTILS]) return [];
  const utils = twish.modules.execute(UTILS) as { getIndexer(wiki: unknown): { relinkLookup(from: string, to: string, options: Record<string, unknown>): Record<string, Record<string, { impossible?: boolean }>> } };
  const records = utils.getIndexer(wiki).relinkLookup(from, to, {});
  return Object.keys(records).filter((name) => Object.values(records[name]!).some((entry) => entry.impossible === true));
}

/**
 * THE RENAME DOOR over TiddlyWiki's own relink. The record moves to `to` with its fields; every reference the engine's
 * relinkers rewrite (the core's tags and list fields, and whatever relinker a plugin mounts) follows; the title it leaves stays as
 * a FORWARDER, a pointer tiddler whose `forward-to` names the new title and whose text transcludes it, so an old road keeps
 * answering. A meme root re-titles through the family law's rename (its slots follow; one forwarder stands at the root's first title).
 *
 * THE FENCES, in the order put and delete keep them: no padded title (the relink trims), withheld titles, the effect ledger and the collapse rule on BOTH
 * titles, then the system-title wall on both (`rename-system-title`), the Kahu predicate and the write cap, then the
 * rendered-record guard. The move lands in the working layer alone, and a layer reads from a record's STAMP
 * and never from a guess: a record resting in any other layer, or carrying no stamp (the engine's own, or a write the shore
 * still carries), refuses `rename-source-layer` (a copy-up would hand its content to a layer with other readers), and a
 * `lar:` title that stands in another layer too takes a hand alone (`hand-act-only`).
 *
 * THE DECISION READS THE WHOLE WIKI; THE ANSWER READS THE FACE'S VIEW. The family law runs twice: over the whole wiki, so a
 * member the face cannot see strands nothing, and over the reader's view, whose consequence alone rides the answer. A
 * record the face may not read reaches no answer by title (no act, leave, refusal, version or cure names it); `withheld`
 * counts them. A title the caller named that such a record holds refuses `rename-target-stands` with no bag and no cure.
 *
 * THE RELINK RUNS AS A DRY RUN FIRST. The engine's relinkers run with the wiki's writes captured, never applied: a referrer
 * that stays home keeps its fields and counts `skipped`; each other record they would rewrite must rest in the working
 * layer, else the rename refuses `rename-referrers-unreachable` with a COUNT (`unreachable`, never titles), and nothing
 * moves. WITH THE RELINK OFFERING LOADED, a referrer it marks impossible (a link the new title cannot fit, as a list or tag field
 * cannot quote a title holding `]]`) refuses `rename-relink-impossible`, naming the titles the face reads and counting the rest.
 * THE RELINK FOLLOWS THE MOVE: a family member the relinkers rewrite (a slot tagged to its root, a record that lists
 * itself) takes its relinked fields in place first, so it lands once, under its new title. From the re-read of the record
 * against the hash this call read to the forwarder's landing no await stands, so `base` and a concurrent edit both hold (a
 * moved record sends the round back to read again, bounded).
 */
const RENAME_SETTLE_ROUNDS = 16;
export const makeTiddlerRenameReactor = everyWiki("tiddler-rename", true, (opts: TiddlerVerbOptions): VerbReactor => {
  return async (args, ctx) => {
    const anchor = anchorOf(opts, args, "tiddler-rename", true);
    const title = stringArg(args, "title");
    if (!title) throw new Error("tiddler-rename: name args.title (the record to move)");
    const to = stringArg(args, "to");
    if (!to) throw new Error("tiddler-rename: name args.to (the new title)");
    // THE ENGINE'S RELINK TRIMS BOTH TITLES: a padded title would pass each fence as one title and relink as another.
    for (const named of [title, to]) {
      if (named !== named.trim()) throw new VerbRefusal("fields-malformed", `fields-malformed: a rename's titles carry no leading or trailing space (the engine's relink trims both, so it would relink another title than the one named); got "${named}".`);
    }
    for (const named of [title, to]) {
      refuseWithheld(named, "tiddler-rename");
      refuseEffectLedgerWrite(named, "tiddler-rename");
      refuseUnhandedCollapseRule(named, "tiddler rename", ctx.asker);
      refuseSystemTitleRename(named, title, to, anchor.recipe);
    }
    await requireWrite(opts, anchor, ctx.cap, "tiddler rename", ctx.asker);
    if (to.includes("```")) throw new VerbRefusal("fields-malformed", "fields-malformed: a new title carries no triple backtick (the forwarder quotes it).");
    refuseMalformedStagePath(to);
    const { wiki, Tiddler } = anchor.engine;
    const { view, visible, mayRead } = await viewFor(opts, anchor, ctx.cap);
    const { readable } = await layerReach(opts, anchor, ctx.cap, mayRead, ctx.asker);
    const face = wornOrigin(ctx.worn).face;
    const act = actOf(ctx);
    const base = readBase(optionalStringArg(args, "base"), "tiddler-rename", false);
    /** A standing record this face reads. */
    const seen = (name: string): boolean => { const held = wiki.getTiddler(name); return held !== undefined && visible(name, held); };
    const reaches = `\`lares wiki status --recipe ${anchor.recipe}\` names the layers this face reaches`;

    for (let round = 0; ; round++) {
      const standing = wiki.tiddlerExists(title) ? wiki.getTiddler(title) : undefined;
      if (!standing) return { recipe: anchor.recipe, title, to, decision: "absent" };
      const { fields, bag } = readRecord(standing);
      if (!(await mayRead(bag))) throw new Error(`cap-denied: read on ${bag} required (the bag that answers "${title}")`);
      const hash = hashOf(fields);
      const refused = (refusal: string, why: string, more: Record<string, unknown> = {}): Record<string, unknown> =>
        ({ recipe: anchor.recipe, title, to, decision: "refused", refusal, why: `${refusal}: ${why}`, hash, ...more });
      if (round >= RENAME_SETTLE_ROUNDS) return { recipe: anchor.recipe, title, to, decision: "conflict", hash, unsettled: round };
      if (to === title) return refused("rename-same-title", `"${title}" already stands at that title; name a different new title.`);
      if (base !== null && base !== hash) return { recipe: anchor.recipe, title, to, decision: "conflict", hash };

      // THE LAYERS: the record, and every member of its family, move out of the working layer alone, and only a stamp names a layer.
      if (bag === null) {
        return refused("rename-source-layer", `"${title}" carries no layer's stamp (the engine's own record, or a write the shore still carries to its layer), so this door reads no layer it rests in and moves nothing on a guess. \`lares get title="${title}" recipe=${anchor.recipe}\` names its bag once it lands; rename it then. Nothing moved.`);
      }
      if (bag !== anchor.bag) {
        return refused("rename-source-layer", `"${title}" rests in ${bag}, not in the working layer ${anchor.bag}; a rename would copy its content into a layer with other readers. A hand that writes ${bag} renames it there. Nothing moved.`);
      }
      // A `lar:` title another layer holds too (canon under the working copy) takes a hand alone: the rename would shadow canon.
      for (const named of [title, to]) {
        if (!named.startsWith("lar:///")) continue;
        for (const other of readable) {
          if (other === anchor.bag) continue;
          const held = await opts.composite.storeForBag(other)?.get(named);
          // The booked asker reads as the hand gate's verdict (`askerRefusal`), never a bare compare.
          const code = held && !held.meta?.deleted ? askerRefusal(ctx.asker) : null;
          if (code !== null) {
            throw new VerbRefusal(code, `${code}: "${named}" also stands in ${other}, a layer a rename would shadow, so a person alone renames it; a seat proposes. Ask the operator to run \`lares rename title="${title}" to="${to}" recipe=${anchor.recipe}\` on their own terminal.`);
          }
        }
      }
      const rendered = renderedWriteFault(title, fields, null, "tiddler rename");
      if (rendered !== null) return refused(RENDERED_DERIVES_REASON, rendered.slice(RENDERED_DERIVES_REASON.length + 2) + " Nothing moved.");
      // ── THE SYNCHRONOUS STEP: no await from here to the last write, so every read below holds until the forwarder lands. ──
      const now = wiki.getTiddler(title);
      if ((now ? hashOf(readRecord(now).fields) : null) !== hash) continue;
      if (wiki.tiddlerExists(to)) {
        return refused("rename-target-stands", seen(to)
          ? `"${to}" already stands; run \`lares delete title="${to}" recipe=${anchor.recipe}\` to clear it (or name another title), then rename again. Nothing moved.`
          : `a record this face may not read holds the new title; name another title (${reaches}). Nothing moved.`);
      }

      // THE FAMILY LAW reads what a rename moves over the whole wiki (a member the face cannot see would strand): a slot
      // refuses, a root takes its slots, every member rests in the working layer. The answer carries the reading over the
      // face's own view, and a count of what the whole reading named beyond it.
      const read: Consequence = consequence(wikiFamilyView(wiki as never), { kind: "rename", title, to });
      const shown: Consequence = consequence(wikiFamilyView(view as never), { kind: "rename", title, to });
      const named = new Set<string>([...read.acts.map((row) => row.title), ...read.leaves.map((row) => row.title), ...read.orphans, ...read.refusals.map((row) => row.title)]);
      const withheld = [...named].filter((name) => wiki.getTiddler(name) !== undefined && !seen(name)).length;
      const answers = { consequence: shown, ...(withheld > 0 ? { withheld } : {}) };
      if (read.refusals.length > 0) {
        const first = read.refusals[0]!;
        let why = `a member of this family refuses the rename (${first.code}); nothing moved.`;
        if (first.code === "slot-without-root") {
          why = read.family !== null && seen(read.family)
            ? `"${title}" stands as a slot of ${read.family}; rename the root (\`lares rename title="${read.family}" to=<new> recipe=${anchor.recipe}\`) and its slots follow. Nothing moved.`
            : `"${title}" stands as a slot, and no root this face reads stands over it; a family moves from its root, by a hand that reads it. \`lares get title="${title}" recipe=${anchor.recipe}\` reads where this face sees it stand. Nothing moved.`;
        } else if (first.code === "rename-target-stands") {
          const taken = read.refusals.filter((row) => row.code === "rename-target-stands").map((row) => row.title);
          const open = taken.find(seen);
          const closed = taken.filter((name) => !seen(name)).length;
          why = open !== undefined
            ? `"${open}" already stands; run \`lares delete title="${open}" recipe=${anchor.recipe}\` to clear it (or name another title), then rename again. Nothing moved.`
            : `${closed} title${closed === 1 ? "" : "s"} this rename would take already stand${closed === 1 ? "s" : ""}, held by records this face may not read; name another title (${reaches}). Nothing moved.`;
        }
        return refused(first.code, why, answers);
      }
      if (read.position !== "plain" && read.position !== "root") return refused("tiddler-rename-in-a-family", `"${title}" stands as a meme ${read.position}; nothing moved.`, answers);
      const members = read.acts.filter((row) => row.act === "retitle").map((row) => row.title);
      for (const member of members) {
        const record = wiki.getTiddler(member);
        if (!record || readRecord(record).bag !== anchor.bag) {
          return refused("rename-source-layer", `a member of "${title}"'s family rests outside the working layer ${anchor.bag} (or carries no layer's stamp), so the family would split across layers. A hand that writes that layer renames it there (${reaches}). Nothing moved.`, answers);
        }
      }

      // DRY RUN: the engine's relinkers run with every write captured, so each record they would rewrite is known before
      // anything moves. The wiki takes its own `addTiddler` back exactly as it held it.
      const captured = new Map<string, EngineTiddler>();
      const own = Object.getOwnPropertyDescriptor(wiki, "addTiddler");
      wiki.addTiddler = (record: unknown) => { const next = record as EngineTiddler; captured.set(String(next.fields["title"]), next); };
      try { wiki.relinkTiddler(title, to); } finally {
        if (own) Object.defineProperty(wiki, "addTiddler", own); else delete (wiki as { addTiddler?: unknown }).addTiddler;
      }
      // A REFERRER THAT STAYS HOME takes no write here (the door writes none of its plane): it keeps its fields and counts.
      let skipped = 0;
      for (const name of [...captured.keys()]) if (staysHome(name)) { captured.delete(name); skipped++; }
      const unreachable = [...captured.keys()].filter((name) => {
        const held = wiki.getTiddler(name);
        return !held || readRecord(held).bag !== anchor.bag;
      }).length;
      if (unreachable > 0) {
        return refused("rename-referrers-unreachable", `${unreachable} record${unreachable === 1 ? "" : "s"} naming "${title}" rest outside the working layer ${anchor.bag} (or carry no layer's stamp), which this face may not rewrite, so the rename would leave stale references. A hand that writes those layers renames it, or those records move to the working layer first (${reaches}). Nothing moved.`, { unreachable });
      }
      // RELINK'S IMPOSSIBLES: a reference the relinkers cannot rewrite (a new title that fits no delimiter the link stands in, a `lar:///`
      // title renamed to a non-URI) is marked impossible and left stale, silently. The door asks Relink's report and refuses by name.
      const impossible = relinkImpossibles(wiki, opts.tw5.$tw, title, to).filter((name) => !staysHome(name) && wiki.getTiddler(name)?.fields["plugin-type"] === undefined);
      // A PLUGIN IS NEVER REWRITTEN: Relink marks any plugin quoting the title impossible, and no hand edits a plugin in place (it moves
      // through a rebuild or an offering), so the cure would name nothing runnable. The plugin keeps its quote, as under the core's own relink.
      if (impossible.length > 0) {
        const open = impossible.filter(seen);
        const closed = impossible.length - open.length;
        const one = impossible.length === 1;
        const who = open.length > 0 ? `: ${open.map((name) => `"${name}"`).join(", ")}${closed > 0 ? ` and ${closed} more held by records this face may not read` : ""}` : ` (${closed} held by records this face may not read)`;
        return refused("rename-relink-impossible", `${impossible.length} reference${one ? "" : "s"} to "${title}" cannot follow it to "${to}" (the new title fits no link ${one ? "that record holds" : "those records hold"} it in), so the rename would leave ${one ? "it" : "them"} stale${who}. Rename to a title that fits the link, or edit ${open.length > 0 ? "the referrer" : "those referrers"} by hand first (\`lares get title=<title> recipe=${anchor.recipe}\` reads one this face sees). Nothing moved.`, { impossible: impossible.length });
      }
      const family = new Set(members);
      const target = (member: string): string => (member === title ? to : to + member.slice(title.length));
      // A DRY RENAME (landing 7) stops here, every fence passed: it answers the move, the forwarder and the relinks, landing none.
      const dry = dryOf(args);
      if (dry !== null) {
        const own = family.has(title) ? captured.get(title) : undefined;
        const source = own ? readRecord(own).fields : fields;
        const forwarder = readRecord(new Tiddler({ title, type: WIKITEXT, text: forwarderText(to), "forward-to": to })).fields;
        const rows: Array<DryChange | null> = [changeOf(title, fields, forwarder)];
        let landsAs: string | null = null;
        if (read.position === "root") {
          for (const member of members) rows.push({ title: member, act: "move", to: target(member), fields: {} });
        } else {
          const moved: Record<string, string> = { ...source, title: to };
          if (typeof source["uri-path"] === "string" && to.startsWith("lar:///")) moved["uri-path"] = to.slice("lar:///".length);
          const settled = readRecord(new Tiddler(moved)).fields;
          landsAs = hashOf(settled);
          rows.push(changeOf(to, null, settled));
        }
        for (const [name, record] of captured) {
          if (family.has(name)) continue;
          const held = wiki.getTiddler(name);
          rows.push(changeOf(name, held ? readRecord(held).fields : null, readRecord(record).fields));
        }
        return dryAnswer({
          recipe: anchor.recipe, title, to, decision: "renamed", forwarder: title, relinked: [...captured.keys()].map((name) => (family.has(name) ? target(name) : name)),
          ...(landsAs !== null ? { hash: landsAs } : {}), ...(skipped > 0 ? { skipped } : {}),
          ...(read.position === "root" ? { moves: Object.fromEntries(members.map((member) => [member, target(member)])) } : {}), ...answers,
        }, dry, { base: hash }, dry === "diff" ? changesOf(rows) : null);
      }
      // THE RELINK FOLLOWS THE MOVE: a member the relinkers rewrite takes its relinked fields in place, and the move carries them.
      for (const [name, record] of captured) if (family.has(name)) { wikiWearsNext(opts.tw5, name, face, act); wiki.addTiddler(record); }
      for (const member of members) { wikiWearsNext(opts.tw5, member, face, act); wikiWearsNext(opts.tw5, target(member), face, act); }
      if (read.position === "root") {
        const moved = renameFamilyInWiki(wiki as never, title, to);
        if (moved.refusals.length > 0) throw new Error(`tiddler-rename-incomplete: the family law refused the move of "${title}" (${moved.refusals[0]!.code}) after this door read it clear. Read it again with \`lares get title="${title}" recipe=${anchor.recipe}\` before another rename.`);
      } else {
        const source = readRecord(wiki.getTiddler(title)!).fields;
        const moved: Record<string, string> = { ...source, title: to };
        if (typeof source["uri-path"] === "string" && to.startsWith("lar:///")) moved["uri-path"] = to.slice("lar:///".length);
        wiki.addTiddler(new Tiddler(moved));
      }
      for (const [name, record] of captured) if (!family.has(name)) { wikiWearsNext(opts.tw5, name, face, act); wiki.addTiddler(record); }
      wikiWearsNext(opts.tw5, title, face, act);
      wiki.addTiddler(new Tiddler({ title, type: WIKITEXT, text: forwarderText(to), "forward-to": to }));
      // THE FAMILY HOLDS AFTER THE MOVE: every member stands under its new title with its parent edge, else the rename fails loudly.
      const landedSlots: Record<string, string> = {};
      for (const member of members) {
        const record = wiki.getTiddler(target(member));
        if (!record || (member !== title && !String(readRecord(record).fields["$fragment-parent"] ?? "").startsWith(to))) {
          throw new Error(`tiddler-rename-incomplete: "${target(member)}" did not land under "${to}" with its parent edge; the family reads split. Read ${title} and ${to} before another rename.`);
        }
        landedSlots[target(member)] = hashOf(readRecord(record).fields);
      }
      const landed = readRecord(wiki.getTiddler(to)!).fields;
      return {
        recipe: anchor.recipe, title, to, decision: "renamed", forwarder: title, relinked: [...captured.keys()].map((name) => (family.has(name) ? target(name) : name)), hash: hashOf(landed),
        ...(skipped > 0 ? { skipped } : {}), ...(read.position === "root" ? { moved: landedSlots } : {}), ...answers,
      };
    }
  };
});

// ── tiddler-delete ────────────────────────────────────────────────────────────────────────────────────

/** True where a title stands as a slot the Confluence gate named (`$slot`, a rooted path) under a parent that stands: the delete that cuts. */
function cutsAsSlot(reading: { readonly position: string; readonly orphan: boolean; readonly parent: string | null }, fields: Record<string, string>): boolean {
  const slot = fields["$slot"];
  return reading.position === "slot" && !reading.orphan && reading.parent !== null && typeof slot === "string" && slot.startsWith("#/");
}

/**
 * A SLOT LEAVES BY THE EXPLICIT CUT. A delete that names `<root>#/<slot>` lands as the put on the slot's parent with `cut`
 * naming that slot: the parent's text sheds the slot's call, the Confluence gate re-splits and reseals the family in the
 * root's turn, and the slot (with the slots and carriage beneath it) leaves by name. The answer names what the cut
 * tombstoned, the parent whose text moved, and the carrier hash the family reads now. `base` guards the slot's own record
 * (`sha256-…`) or the family's carrier (`sha256:…`). A cut names no layer, so a `mode` refuses `delete-mode-unread`.
 */
async function cutSlot(
  opts: TiddlerVerbOptions, seat: PutSeat, from: Record<string, unknown>, title: string, parent: string, hash: string, base: string | null,
  mode: string | null, ctx: VerbContext, read?: Consequence,
): Promise<Record<string, unknown>> {
  if (mode !== null) {
    throw new VerbRefusal("delete-mode-unread", `delete-mode-unread: "${title}" stands as a slot, which leaves by a cut of its parent's text, and a cut names no layer for \`mode: "${mode}"\` to choose; drop the mode (\`lares delete title="${title}" ${seat.where}\`). Nothing moved.`);
  }
  const slot = title.slice(rootAddressOf(title).length);
  const carrierBase = base !== null && base.startsWith("sha256:") ? base : null;
  const answer = (decision: string, more: Record<string, unknown>): Record<string, unknown> =>
    ({ ...from, title, decision, mode: "cut", tombstoned: [], retracted: [], hash, parent, ...more, ...(read ? { consequence: read } : {}) });
  if (base !== null && carrierBase === null && base !== hash) return answer("conflict", {});
  const put = await putThrough(opts, seat, parent, { cut: [slot], ...(carrierBase !== null ? { base: carrierBase } : {}) }, ctx);
  const family = { canonicalHash: put["canonicalHash"] ?? null, landed: put["landed"] ?? [], kept: put["kept"] ?? [] };
  if (put["decision"] !== "put") return answer("conflict", family);
  return answer("removed", { tombstoned: put["tombstoned"] ?? [], ...family });
}

/** A slot's cut, dry or landing: a dry cut runs the put on the parent over a dry seat and answers what it would land. */
async function cutOrDry(
  opts: TiddlerVerbOptions, seat: PutSeat, from: Record<string, unknown>, title: string, parent: string, hash: string, base: string | null,
  mode: string | null, ctx: VerbContext, dry: DryDepth | null, read?: Consequence,
): Promise<Record<string, unknown>> {
  if (dry === null) return cutSlot(opts, seat, from, title, parent, hash, base, mode, ctx, read);
  const carrier = await readMeme(rootAddressOf(title), seat.sink);
  const shadow = drySeatOf(seat);
  const answer = await cutSlot(opts, shadow, from, title, parent, hash, base, mode, ctx, read);
  return dryAnswer(answer, dry, { base: hash, ...(carrier ? { carrierBase: carrier.canonicalHash } : {}) }, dry === "diff" ? await dryDiffOf(shadow, seat) : null);
}

/**
 * A BAG'S DELETE, IN THAT ONE BAG. The reach and the write gate are the bag put's own (`bagSeat`). A plain record leaves its
 * bag; a meme root answers `refused` (`tiddler-delete-in-a-family`) unless the call names the family act (`family: true`),
 * which removes the root and its slots through the store as ONE change (`removeMeme`); a slot leaves by the explicit cut
 * (`cutSlot`). A sink that knows its layers raises a kāpae only where a lower layer would surface and retracts plainly
 * elsewhere; any other bag's store takes a tombstone. `base` reads the record's hash, or on a family the carrier's
 * canonical hash; a stale one answers `conflict`. A bag holds one layer, so a `mode` refuses `delete-mode-unread`.
 */
async function bagDelete(opts: TiddlerVerbOptions, container: ReturnType<typeof readContainer>, args: Readonly<Record<string, unknown>>, ctx: VerbContext): Promise<Record<string, unknown>> {
  const title = stringArg(args, "title");
  if (!title) throw new Error("tiddler-delete: args.title is required");
  refuseWithheld(title, "tiddler-delete");
  refuseEffectLedgerWrite(title, "tiddler-delete");
  refuseUnhandedCollapseRule(title, "tiddler delete", ctx.asker);
  const mode = optionalStringArg(args, "mode");
  const seat = await bagSeat(opts, container, "tiddler delete", ctx);
  const from = { ...seat.landing };
  const before = await seat.read(title);
  if (!before) return { ...from, title, decision: "absent", tombstoned: [], retracted: [] };
  const hash = hashOf(before);
  const reading = await familyReadingIn(title, seat.sink);
  const refused = (refusal: string, why: string): Record<string, unknown> =>
    ({ ...from, title, decision: "refused", mode: "plain", refusal, why: `${refusal}: ${why}`, tombstoned: [], retracted: [], hash });
  const rendered = renderedWriteFault(title, before, null, "tiddler delete");
  if (rendered !== null) return refused(RENDERED_DERIVES_REASON, rendered.slice(RENDERED_DERIVES_REASON.length + 2) + " Nothing moved.");
  const base = readBase(optionalStringArg(args, "base"), "tiddler-delete", false);
  const dry = dryOf(args);
  if (cutsAsSlot(reading, before)) return cutOrDry(opts, seat, from, title, reading.parent!, hash, base, mode, ctx, dry);
  if (mode !== null) {
    throw new VerbRefusal("delete-mode-unread", `delete-mode-unread: a mode chooses between the layers of a wiki's stack (\`kapae\`, \`reveal\`), and a bag holds one layer; drop the mode (\`lares delete title="${title}" ${seat.where}\`), or name the wiki (\`recipe=<slug>\`). Nothing moved.`);
  }
  if (reading.position !== "plain" && !flagOn(args["family"])) {
    return refused("tiddler-delete-in-a-family", `"${title}" stands as a meme ${reading.position} of ${reading.root}, and this delete would move the family's records. Name the family act (\`family: true\`; \`lares delete title="${reading.root ?? title}" ${seat.where} family=true\`) to remove the root and its slots as one change. Nothing moved.`);
  }
  const carrierBase = base !== null && base.startsWith("sha256:") ? base : null;
  const conflict = { ...from, title, decision: "conflict", mode: "plain", tombstoned: [], retracted: [], hash };
  if (reading.position === "root") {
    if (base !== null && carrierBase === null && base !== hash) return conflict;
    // A DRY FAMILY REMOVAL runs the removal over a dry seat: the consequence and the split it reads, landing nothing.
    const shadow = dry !== null ? drySeatOf(seat) : null;
    const receipt = await removeMeme({ uri: title, baseHash: carrierBase }, shadow?.sink ?? seat.sink);
    const answer = {
      ...from, title, decision: receipt.decision, mode: "plain", tombstoned: receipt.tombstoned, retracted: receipt.retracted ?? [], hash,
      ...(receipt.canonicalHash !== undefined ? { canonicalHash: receipt.canonicalHash } : {}), ...(receipt.consequence ? { consequence: receipt.consequence } : {}),
    };
    if (dry === null || shadow === null) return answer;
    const needs = { base: hash, ...(receipt.canonicalHash !== undefined ? { carrierBase: receipt.canonicalHash } : {}) };
    return dryAnswer(answer, dry, needs, dry === "diff" ? await dryDiffOf(shadow, seat) : null);
  }
  if (base !== null && base !== hash) return conflict;
  const sink = seat.sink;
  if (dry !== null) {
    const hides = sink.beneath && sink.leaveFamily ? await sink.beneath(title) : true;
    const answer = { ...from, title, decision: "removed", mode: "plain", tombstoned: hides ? [title] : [], retracted: hides ? [] : [title], hash };
    return dryAnswer(answer, dry, { base: hash }, dry === "diff" ? changesOf([changeOf(title, before, null)]) : null);
  }
  if (sink.beneath && sink.leaveFamily) {
    const hides = await sink.beneath(title);
    await sink.leaveFamily(hides ? [title] : [], hides ? [] : [title]);
    return { ...from, title, decision: "removed", mode: "plain", tombstoned: hides ? [title] : [], retracted: hides ? [] : [title], hash };
  }
  await sink.tombstone(title);
  return { ...from, title, decision: "removed", mode: "plain", tombstoned: [title], retracted: [], hash };
}

export const makeTiddlerDeleteReactor = everyWiki("tiddler-delete", true, (opts: TiddlerVerbOptions): VerbReactor => {
  return async (args, ctx) => {
    // A BAG NAMES ONE STORE AND NO WIKI: the delete lands in that bag through its own store.
    const container = readContainer(args, "tiddler-delete");
    if (container.bag !== null) return bagDelete(opts, container, args, ctx);
    const title = stringArg(args, "title");
    if (!title) throw new Error("tiddler-delete: args.title is required");
    refuseWithheld(title, "tiddler-delete");
    refuseEffectLedgerWrite(title, "tiddler-delete");
    refuseUnhandedCollapseRule(title, "tiddler delete", ctx.asker);
    const anchor = anchorOf(opts, args, "tiddler-delete", true);
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
    // A SLOT LEAVES BY THE EXPLICIT CUT (`cutSlot`): the put on its parent, with the slot named. A slot whose parent this
    // face reads none of stands orphaned, and a record that carries no slot name of its own (a carriage part, a fragment a
    // hand laid) takes no cut: each leaves as the consequence below reads it.
    const standsAs = familyOf(familyViewAt(anchor, view, layers), title);
    if (cutsAsSlot(standsAs, fields)) {
      const fault = renderedWriteFault(title, fields, null, "tiddler delete");
      if (fault !== null) return refused(RENDERED_DERIVES_REASON, fault.slice(RENDERED_DERIVES_REASON.length + 2) + " Nothing moved.");
      const slotBase = readBase(optionalStringArg(args, "base"), "tiddler-delete", false);
      return cutOrDry(opts, await wikiSeat(opts, anchor, ctx), { recipe: anchor.recipe }, title, standsAs.parent!, hash, slotBase, named, ctx, dryOf(args), read);
    }
    if (read.position !== "plain" && !flagOn(args["family"])) {
      return refused("tiddler-delete-in-a-family", `"${title}" stands as a meme ${read.position} of ${read.family}; this delete would move ${moves} record${moves === 1 ? "" : "s"} (the consequence names each). Name the family act (\`family: true\`; \`lares delete title="${read.family ?? title}" recipe=${anchor.recipe} family=true\`) to land it as one change. Nothing moved.`);
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
        return refused("delete-mode-needed", `"${kept}" rests in ${rests}, a layer this face's delete cannot remove it from, so a plain delete would leave it standing. \`way=kapae\` raises a tombstone in ${anchor.bag} that hides it; ${rests} keeps its record. Nothing moved.`);
      }
      const beneath = read.acts.find((row) => row.act === "retract" && typeof row.reveals === "string");
      if (beneath !== undefined) {
        return refused("delete-mode-needed", `"${beneath.title}" also stands in ${beneath.reveals} beneath the record in ${beneath.bag}, so this delete must name what happens to it: \`way=kapae\` raises a tombstone that keeps it hidden; \`way=reveal\` removes the record in ${beneath.bag} and lets ${beneath.reveals}'s surface. Nothing moved.`);
      }
      // AN UNREAD LAYER BENEATH COUNTS AS HOLDING THE TITLE: a recipe slot the composer could not reach, or a stand-in for a
      // document the vessel has not read, may hold any record (recipe-layer-model#/the-delete), so the plain delete asks.
      const unread = read.acts.find((row) => row.act === "retract" && opts.composite.unknownBeneath?.(row.bag ?? anchor.bag) === true);
      if (unread !== undefined) {
        return refused("delete-mode-needed", `"${unread.title}" may also stand in an unread layer beneath ${unread.bag ?? anchor.bag} (a recipe slot this composition could not reach, or a document this vessel has not read yet), so this delete must name what happens to it: \`way=kapae\` raises a tombstone that keeps any such record hidden; \`way=reveal\` removes the record in ${unread.bag ?? anchor.bag} and lets whatever stands beneath surface. Nothing moved.`);
      }
    }
    if (read.refusals.length > 0) {
      const first = read.refusals[0]!;
      const why = first.code === "reveal-top-unwritable"
        ? `a reveal retracts the topmost record of "${first.title}", and this face writes no record in the layer that holds it (${layers.of.get(first.title)?.[0]?.bag ?? "none"}); \`mode: "kapae"\` shadows it from the working layer instead. Nothing moved.`
        : `"${first.title}" refuses this delete; nothing moved.`;
      return refused(first.code, why);
    }
    // A slot its parent calls leaves with the call: the parent's text would move, and that rides a put of the parent's text.
    const dangling = read.acts.find((row) => row.act === "put") ?? read.leaves.find((row) => row.why === "reference-dangles:kahea");
    if (dangling) {
      return refused("tiddler-delete-in-a-family", `"${title}" stands as a slot "${dangling.title}" calls by \`kahea\`; the call leaves with the slot, and the parent's text moves by its own put: \`lares put title="${dangling.title}" recipe=${anchor.recipe} cut-slot='${String(title).slice(rootAddressOf(title).length)}'\` cuts the slot and its call in one put.`);
    }
    // A record no mounted layer holds (the engine's own, or a wiki with no store beneath it) has nothing to retract.
    const unheld = named === "reveal" ? read.acts.find((row) => row.act === "retract" && (row.holds?.length ?? 0) === 0) : undefined;
    if (unheld) return refused("reveal-top-unwritable", `no mounted layer holds a record of "${unheld.title}", so a reveal has nothing to retract; \`mode: "kapae"\` removes it. Nothing moved.`);
    const base = readBase(optionalStringArg(args, "base"), "tiddler-delete", false);
    if (base !== null && base !== hash) return { recipe: anchor.recipe, title, decision: "conflict", mode: modeName, tombstoned: [], retracted: [], hash };
    // A DRY DELETE (landing 7) stops here, every fence passed: the consequence, the split between kāpae and retract, landing none.
    const dry = dryOf(args);
    if (dry !== null) {
      const answer = { recipe: anchor.recipe, title, decision: "removed", mode: modeName, tombstoned: tombstones, retracted: retracts, hash, consequence: read };
      return dryAnswer(answer, dry, { base: hash }, dry === "diff" ? removalsOf(view, [...tombstones, ...retracts]) : null);
    }

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
      // A LAYER'S ONE CHANGE PASSES BY THE SHORE (landing 13): where an act asked for its receipts, each member it removed joins
      // them; any other delete digests nothing.
      const collecting = wikiCollectsAct(opts.tw5, actOf(ctx));
      const before = collecting ? new Map([...group.tombstones, ...group.retracts].map((member) => { const t = wiki.getTiddler(member); return [member, t ? hashOf(readRecord(t).fields) : null] as const; })) : null;
      await opts.composite.writeFamily([], group.tombstones, origin, { bag: landing as never, ...(group.retracts.length > 0 ? { retracts: group.retracts } : {}) });
      if (before) for (const [member, hashBefore] of before) wikiStampsReceipt(opts.tw5, { kind: "delete", title: member, face: wornOrigin(ctx.worn).face, before: hashBefore, after: null, bag: landing, act: actOf(ctx) });
    }
    for (const member of byHand) { wikiWearsNext(opts.tw5, member, wornOrigin(ctx.worn).face, actOf(ctx)); wiki.deleteTiddler(member); }
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
    return refused("tiddler-delete-in-a-family", `"${title}" stands as a kāpae over a meme root whose ${acts.length - 1} slot${acts.length === 2 ? "" : "s"} stand tombstoned with it; name the family act (\`family: true\`, \`family=true\`) to retract them as one change. Nothing moved.`);
  }
  const surfacing = acts.find((row) => row.reveals !== null);
  if (surfacing !== undefined && named !== "reveal") {
    return refused("delete-mode-needed", `the kāpae over "${surfacing.title}" in ${surfacing.bag} hides a record in ${surfacing.reveals}; \`way=reveal\` retracts the kāpae and lets ${surfacing.reveals}'s surface, and \`way=kapae\` keeps it hidden (it already stands). Nothing moved.`);
  }
  const dry = dryOf(args);
  if (dry !== null) {
    const answer = { recipe: anchor.recipe, title, decision: "removed", mode, tombstoned: [], retracted: acts.map((row) => row.title), consequence };
    return dryAnswer(answer, dry, { base: null }, dry === "diff" ? acts.map((row): DryChange => ({ title: row.title, act: "retract", fields: {} })) : null);
  }
  const origin: ChangeOrigin = { kind: "lares-verb", requestId: ctx.invocation.requestId, ...wornOrigin(ctx.worn) };
  const perBag = new Map<string, string[]>();
  for (const row of acts) perBag.set(row.bag, [...(perBag.get(row.bag) ?? []), row.title]);
  for (const [landing, retracts] of perBag) {
    await opts.composite.writeFamily([], [], origin, { bag: landing as never, retracts });
    // A kāpae retracted holds no record before or after; where an act asked for its receipts, the retract joins them (landing 13).
    for (const member of retracts) wikiStampsReceipt(opts.tw5, { kind: "delete", title: member, face: wornOrigin(ctx.worn).face, before: null, after: null, bag: landing, act: actOf(ctx) });
  }
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
        const read = isTw5DocsBag(bag) || (await ctx.cap("read", bag)).ok || (opts.floorCanon?.(bag) ?? null) !== null;
        layers.push({ bag, mounted: "promotion-only", read, write: false });
        continue;
      }
      const mounted = opts.composite.hasWritableBag(bag);
      // The TW5 docs library reads freely (`reachOf`), and its status says so.
      const read = isTw5DocsBag(bag) || (await ctx.cap("read", bag)).ok || (opts.floorCanon?.(bag) ?? null) !== null || wikiSlotKindOf(slug, bag) === "temp";
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

// ── the call's seats ──────────────────────────────────────────────────────────────────────────────────

/**
 * THE TIDDLER DOOR'S SEATS IN THE CALL REGISTRY (comms-ux-enacts landing 4): each core-verb carrier's address and the daemon
 * verb that answers it. A param's neutral name reads as its camelCase arg (`max-bytes` → `maxBytes`); a seat names the
 * exceptions (`tag-add` → `tagsAdd`, `cut-slot` → `cut`) and folds a param that names another's value (a get's `all` reads the
 * whole grain; a put's `slot` folds into its title, `<root>#/x`).
 */
export const TIDDLER_CALL_SEATS: Readonly<Record<string, CallSeat>> = Object.freeze({
  "lar:///engine.record.reads": {
    verb: "tiddler-get",
    // THE RANGE (the keyword head): the plan's `aperture` rank turns into the read's lens and grain (`readRangeArgs`: the card at
    // pulse to measure, the whole at arc and theme); none keeps the gradient. The `mu` lens leaves the reactor's args (its cell
    // names how the answer reads; the read's bytes stand the same). `form=text` (a terminal's text alone, landing 8) asks the
    // whole text at the lens's grain where no range or cursor names one; the form itself shapes the terminal's print.
    fold: ({ form, mu: _mu, aperture, ...args }) => {
      const titled = typeof args["title"] === "string" && args["title"] !== "";
      const slotted = (typeof args["slot"] === "string" && args["slot"] !== "") || (titled && String(args["title"]).includes("#/"));
      const rank = rankArg(aperture);
      const read = rank !== null && titled ? { ...args, ...readRangeArgs(rank, slotted) } : args;
      const alone = form === "text" && read["grain"] === undefined && read["after"] === undefined && !(flagOn(read["meme"]) && slotted);
      return alone ? { ...read, grain: "whole" } : read;
    },
    // THE FAMILY LISTING (handed forward by landing 4): a get with `meme` and no title lists the families this view holds.
    verbOf: (args) => (!(typeof args["title"] === "string" && args["title"] !== "") && flagOn(args["meme"]) ? "meme-list" : "tiddler-get"),
  },
  // `all` (a terminal following every cursor) shapes the terminal's walk and leaves the reactor's args.
  "lar:///engine.filter.pages": {
    verb: "wiki-filter",
    fold: ({ mu: _mu, aperture, all: _all, ...args }) => { const rank = rankArg(aperture); return rank !== null ? { ...args, ...filterRangeArgs(rank) } : args; },
  },
  "lar:///engine.record.puts": {
    verb: "tiddler-put",
    dry: true,
    args: { "tag-add": "tagsAdd", "tag-remove": "tagsRemove", "cut-slot": "cut" },
    fold: (raw) => {
      const { slot, ...args } = dryArgs(raw, "put");
      return typeof slot === "string" && slot !== "" && typeof args["title"] === "string" ? { ...args, title: `${args["title"]}${slot}` } : args;
    },
  },
  // A delete's choice rides its own key, `way=kapae|reveal` (the set panel's `mode` stays the shared key, the keyword head); the
  // reactor reads it as `mode`.
  "lar:///engine.record.removes": { verb: "tiddler-delete", dry: true, args: { way: "mode" }, fold: (args) => dryArgs(args, "delete") },
  "lar:///engine.record.renames": { verb: "tiddler-rename", dry: true, fold: (args) => dryArgs(args, "rename") },
  // THE SIDEBAR ACT (landing 9): `wiki(verb="act")`'s one admitted action seats as a carrier and rides `call` by its address; the
  // reactor's own table names the action (`sidebar-layout`), so the call carries values alone, never action text.
  "lar:///render.sidebar.lays": { verb: "wiki-action", fold: ({ face: _face, ...args }) => ({ ...args, name: "sidebar-layout" }) },
});

/**
 * THE WRITE DOORS' DEPTH (landing 7): a dry carry folds into the reactor's `dry` arg (`_` and `_?` the summary, `_!` the diff,
 * `dryDepthOf`), and the door walks its law to the last step, landing nothing. Any other carry a layer above tables on a write
 * door refuses `mu-cell-empty` and names the plain call, so a depth never lands as a write. The `mu` leaves the args.
 */
function dryArgs(args: Record<string, unknown>, word: string): Record<string, unknown> {
  const { mu, ...rest } = args;
  // Rest, the Cup (`?0`, the write's default: the receipt's has line) and the Sword (`!0`, the receipt asserted) land the write.
  if (typeof mu !== "string" || mu === "00" || mu === "?0" || mu === "!0") return rest;
  const depth = dryDepthOf(mu);
  if (depth !== null) return { ...rest, dry: depth };
  // The fold reads reactor spellings; the cure names the title alone, the plain call a reader completes.
  const title = typeof rest["title"] === "string" ? { title: rest["title"] } : {};
  throw new CallRefusal("mu-cell-empty", `the ${word} door answers its receipt (?0 cup · !0 sword) and the dry band alone (_0 pentacle · _? overview · _! precision), and ${mu} (${muWordsOf(mu)}) names none, so it lands nothing`, cureCall(word, title));
}

/** The aperture rank a plan carried (the call seats the rank word), or null where none rides. */
function rankArg(raw: unknown): ApertureRank | null {
  return typeof raw === "string" && (APERTURE_RANKS as readonly string[]).includes(raw) ? raw as ApertureRank : null;
}

/**
 * Where the daemon `call` reads (landing 5): THE NAMED RECIPE'S READER VIEW. Each call resolves and binds over the stack of the
 * wiki its params name (`recipe`, else `default`; a call naming a `bag` reads the daemon wiki's), through that wiki's own engine
 * and the face's reader view (`viewFor`), so a carrier that wiki's layers seat shapes the call and a record the face may not read
 * enters no route and no `#/takes`. A sigil reads through the same engine's own macro-call parser.
 *
 * THE PACK BENEATH THE STACK (`floorReaderOf`): where that view holds no record for a title the plan reads (a house whose canon
 * lags its checkout holds none of the newer carriers), the baked pack's record answers, and the answer names `bag/pack`. A
 * carrier the stack holds still wins. `floor` seats another floor (a test's own bake); absent, the vessel's baked pack.
 */
export function tiddlerCallSource(opts: TiddlerVerbOptions, floor: () => CallFloor | null | Promise<CallFloor | null> = packFloor): CallSource {
  return {
    // The parser reads at the call, never at registration: a host that seats the verb before its engine boots (or a rig that
    // boots none) registers cleanly, and a sigil met with no engine answers `sigil-malformed` through callOfSigil's own path.
    get parse(): MacroCallParse | undefined {
      const utils = (opts.tw5?.$tw as unknown as { utils?: { parseMacroInvocationAsTransclusion?: MacroCallParse } } | undefined)?.utils;
      return utils?.parseMacroInvocationAsTransclusion?.bind(utils);
    },
    readerOf: async (ctx, params) => {
      const asked = params["recipe"];
      const container = { recipe: typeof asked === "string" && asked.trim() !== "" ? asked.trim() : "default" };
      const wiki = (await namedWikiOptions(opts, container, "call", false)) ?? opts;
      const { view } = await viewFor(wiki, anchorOf(wiki, container, "call"), ctx.cap);
      return floorReaderOf(callReaderOf(view as never), await floor());
    },
    // THE MACHINA'S VOICE (landing 21): Iris-Sprite's templates render in the anchor's own engine, read at the call; a rig that
    // boots no engine renders none and the plain words stand. The baked pack carries canon's templates as the floor.
    get voice(): CallVoice | undefined {
      const wiki = (opts.tw5?.$tw as unknown as { wiki?: { renderText?: (out: string, type: string, text: string, o?: { variables?: Record<string, string> }) => string } } | undefined)?.wiki;
      const renderText = wiki?.renderText;
      if (wiki === undefined || typeof renderText !== "function") return undefined;
      return {
        render: (template, variables) => renderText.call(wiki, "text/plain", "text/vnd.tiddlywiki", template, { variables: { ...variables } }),
        floor: packedVoice,
      };
    },
  };
}

/**
 * THE PACK, LOADED LAZILY AND BY A NAME NO BUNDLER FOLLOWS (as the oracle's consult reads it): the pack reader requires its JSON
 * through `node:module`, which a browser island never loads, so there the stack answers alone, and a node vessel reads the pack
 * its own binary baked. A pack that carries no records, or none at all, seats no floor.
 */
const PACK_MODULE = "./affordance-pack.js";
let packModule: Promise<{ affordancePack(): AffordancePack } | null> | null = null;
async function packFloor(): Promise<CallFloor | null> {
  packModule ??= (import(/* @vite-ignore */ PACK_MODULE) as Promise<{ affordancePack(): AffordancePack }>).catch(() => null);
  const pack = (await packModule)?.affordancePack();
  return pack?.records !== undefined ? { records: pack.records, hash: pack.hash } : null;
}

/** Iris-Sprite's floor templates, read off the same lazily loaded pack (its `voice`); none where no pack stands. */
async function packedVoice(): Promise<Partial<Record<VoiceSlot, string>>> {
  packModule ??= (import(/* @vite-ignore */ PACK_MODULE) as Promise<{ affordancePack(): AffordancePack }>).catch(() => null);
  const voice = ((await packModule)?.affordancePack() as { voice?: Partial<Record<string, string>> } | undefined)?.voice ?? {};
  const out: Partial<Record<VoiceSlot, string>> = {};
  for (const slot of VOICE_SLOTS) { const t = voice[slot]; if (typeof t === "string") out[slot] = t; }
  return out;
}
