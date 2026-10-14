/**
 * meme-verbs — `meme-put` / `meme-get` / `meme-list` / `meme-delete` / `meme-project`, the daemon
 * island's skins of the meme laws.
 *
 * The contract every skin (this, the HTTP route, the MCP tool) carries verbatim:
 *
 *   meme-put      { recipe?, bag?, uri, text, base? }   → PlaceMemeReceipt
 *   meme-get      { recipe?, bag?, uri }                → { uri, meme: { text, canonicalHash } | null }
 *   meme-list     { recipe?, bag?, tree?, after?, limit? } → { bag | recipe, roots: MemeListing[], next }
 *   meme-delete   { recipe?, bag?, uri, base? }         → { uri, decision: removed|absent|conflict, tombstoned, canonicalHash? }
 *   meme-project  { recipe?, bag?, uri, to, dialect?, tongue? } → { uri, to, text, contentType, meta? }
 *
 * `meme-list` answers every ROOT the seat holds with the canonical hash a writer hands back as its base,
 * a page at a time (`MEME_LIST_PAGE` roots, in title order): `next` names the cursor of the page behind,
 * a caller hands it back as `after`, and `next: null` ends the listing. A bag lists its own records; a
 * named recipe lists the roots its whole stack resolves, each row naming the bag that answered
 * (`listRecipeStack`). `tree` nests each root's slot tree. `meme-delete` removes the whole group through `removeMeme` — a
 * stale `base` answers `conflict` and moves nothing; an absent root answers `absent`.
 *
 * `to` names a target — mem · md · html · tid · json (`meme-project.ts`); `meta` rides on `md` alone,
 * the `.md.meta` sidecar. The anchor projects through the in-VM face (`$tw.lares.meme.project`), so
 * every target renders through the wiki that holds the records; a recipe or bag target holds records
 * in a store, never a wiki, so it projects the TEXT targets (mem · md) and refuses the wiki renders
 * loud. An unknown target refuses naming the targets; an absent meme refuses naming the URI.
 *
 * Exactly one of `recipe` / `bag` names the container; neither, or both, refuses as `no-container`.
 * Three targets follow:
 *
 *   · `recipes/default` — the host's ANCHOR, the daemon's own wiki (never "the active wiki"). The
 *     placement goes through the live `$tw.wiki`, so the in-wiki cascade
 *     (`lar:///ha.ka.ba/lararium/config/bag-paths`) routes it to the top bag exactly as an in-wiki
 *     edit would — the daemon's own working layer once its late-attach lands, its own bag until then.
 *   · `recipe: <slug>` — an edit AS THAT WIKI, under TWO LAWS:
 *       PUT WRITES THE DESIGNATED BAG. The slug names its recipe record (the user's catalog plane
 *       first, the oracle system plane after); the record's `writable-bag` (else the top of its
 *       `bag-stack`) names the bag; the placement lands in THAT BAG's own store — a layer the island
 *       mounts writable, else an instance slot's doc through THE ONE slot-doc resolver (draft ·
 *       working · personal — the same doc the wiki island mounts, so the placement surfaces in the
 *       running wiki), else the bag's doc reached by access across the registry planes.
 *       GET READS THE STACK. The read walks the wiki's whole cascade top-down — the instance slots
 *       above, the canon and libraries beneath, the oracle floor — exactly as the wiki's own face
 *       reads it, and answers from the first bag holding a record under the meme's root. The draft
 *       shadows canon when both hold it; a meme living in canon reads through `--recipe` when the draft
 *       holds nothing; a TOMBSTONE in a bag above shadows canon too, so the read answers no meme (the
 *       wiki's own delete of a canon carrier lands exactly that tombstone in the working layer).
 *     WRITE-THEN-SYNC: the daemon never reaches into that wiki's mounted island.
 *   · `bag: <slug>` — a residency placement through the island's writable layer for that bag. A bag
 *     the island cannot write fails loud, naming the bag; a placement never shadows up.
 *
 * `base` carries the canonical hash the writer read; records that moved past it read as a CONFLICT.
 * Bag and wiki slugs ride BARE (`sdm`, `lares`); a full `lar:` bag URI passes through.
 *
 * Runs daemon-side (a plain module, never a plugin tiddler).
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/meme-verbs
 */

import {
  AutomergeDocStore, NoWorkingLayerRefusal, VerbRefusal, bagUri, designatedBagOf, expandRecipe, recipeFromRecord, wikiSlotKindOf,
  REALM_ID_TIDDLER, realmDocPointer, realmDocUrl, realmStewardPointer, realmStandingPointer, readRealmStanding, mayWriteRealmBag, tiddlerText,
  type ChangeOrigin, type CompositeStore, type LarTiddlerRecord, type LarTiddlerStore, type WikiSlotKind,
} from "@lararium/mesh";
import { findOrThrow, makeCatalogAccessor } from "./catalog-accessor.js";
import { effectiveRecipeOf } from "./recipe-planes.js";
import type { IslandContext } from "./island-context.js";
import { holdsUnreadPointer, isMemeRoot, listMemePage, listOneMeme, placeMeme, POINTER_BODY_CODE, readMeme, removeMeme, wikiMemeSink, type MemeListing, type MemeSink } from "./place-meme.js";
import { compositeMemeSink, storeMemeSink } from "./meme-sinks.js";
import { projectCarrierText, projectTargetOf } from "./meme-project.js";
import { pinTargetsOf, profileOf } from "./weave/index.js";
import type { TW5Engine } from "./tw5-vm.js";
import type { LaresTw5Extension } from "./types/lares-globals.js";
import type { VerbReactor } from "./verb-dispatcher.js";
import { optionalStringArg, stringArg } from "./handler-args.js";
import { AUDIT_ARRAY_CAP } from "./verb-vm.js";
import type { TiddlerFields } from "./deserializer.js";

export interface MemeVerbOptions {
  readonly composite: CompositeStore;
  /** The daemon island's engine — its live `$tw.wiki` is the anchor. Read lazily, at verb time. */
  readonly tw5: Pick<TW5Engine, "$tw">;
  /** A wiki's recipe record by slug, or null when no plane holds one. Absent = no named recipes. */
  readonly recipeOf?: (slug: string) => Promise<LarTiddlerRecord | null>;
  /** A registered bag's own store by its registry KEY, presented as `bag`; null = unregistered. */
  readonly reach?: (key: string, bag: string, realm?: string) => Promise<LarTiddlerStore | null>;
  /** THE STEWARD WRITE PATH. A bag the REALM carries, as a WRITABLE store, when this vessel's own steward
   *  nym stands in the standing registration's `keptBy`. Null for every other hand and every other bag, so
   *  the put falls through to the path it walked before the realm carried anything. */
  readonly realmWritable?: (bag: string, realm?: string) => Promise<LarTiddlerStore | null>;
  /** A wiki's INSTANCE slot (draft · working · personal) as a store over the doc THE ONE slot-doc
   *  resolver names — the doc the wiki island mounts. `mint` false reads what stands (a get), true
   *  mints on absent (a put). Absent = instance slots resolve by their bare key only. */
  readonly slotStore?: (slug: string, kind: WikiSlotKind, bag: string, opts: { mint: boolean }) => Promise<LarTiddlerStore | null>;
}

/** The daemon's options off its island context — reach across both registry planes (access ≠ load). */
export function memeVerbOptions(
  ctx: Pick<IslandContext, "composite" | "tw5" | "repo" | "catalogUrl" | "oracleUrl">,
  /** The instance-slot doc url by THE ONE resolver; null when nothing stands and `mint` is false. */
  slotDocUrl: (slug: string, kind: WikiSlotKind, opts: { mint: boolean }) => Promise<string | null>,
): MemeVerbOptions {
  const catalog = ctx.catalogUrl ? makeCatalogAccessor(ctx.repo, ctx.catalogUrl) : null;
  const oracle  = ctx.oracleUrl  ? makeCatalogAccessor(ctx.repo, ctx.oracleUrl)  : null;
  const planes = [...(catalog ? [catalog] : []), ...(oracle ? [oracle] : [])];
  return {
    composite: ctx.composite,
    tw5: ctx.tw5,
    slotStore: async (slug, kind, bag, opts) => {
      const url = await slotDocUrl(slug, kind, opts);
      if (!url) return null;
      const handle = await findOrThrow(ctx.repo, url, `${bag} (${kind} slot of ${slug})`);
      return new AutomergeDocStore(handle, bag);
    },
    // The vessel's own composition shadows a system wiki's default: the one reader, own first.
    recipeOf: async (slug) => (await effectiveRecipeOf(slug, { catalog, oracle }))?.record ?? null,
    reach: async (key, bag, namedRealm) => {
      // THE REALM PLANE FIRST. A bag the relation carries (registered on the realm's shared CRDT by its
      // stewards' own signatures) shadows this vessel's own bag of the same name: the ford's one book,
      // never the two chests. Absent a realm, or a registration that fails to count, the walk falls
      // through unchanged.
      const realm = await realmReach(key, bag, namedRealm);
      if (realm) return realm;
      if (namedRealm) return null;
      for (const accessor of planes) {
        const handle = await accessor.find(key).catch(() => null);
        if (handle) return new AutomergeDocStore(handle, bag);
      }
      return null;
    },
    // The realm's WRITE answer: the standing registration's doc as a writable store, for a steward alone.
    realmWritable: async (bag, namedRealm) => {
      const standing = await realmStanding(namedRealm);
      if (!standing) return null;
      const nym = tiddlerText(await oracle!.recordOf(realmStewardPointer(standing.realmId)).catch(() => null));
      if (!mayWriteRealmBag(standing.bags, bag, nym)) return null;
      const rec = standing.bags.get(bag)!;
      const handle = await findOrThrow(ctx.repo, rec.docUrl, `${bag} (realm bag)`).catch(() => null);
      return handle ? new AutomergeDocStore(handle, bag) : null;
    },
  };

  /** The realm this vessel stands in, and the registrations its doc carries as of the last sync. Null when
   *  no oracle plane, no realm id, or no realm doc has arrived — each a vessel outside every realm. */
  async function realmStanding(namedRealm?: string): Promise<{ realmId: string; bags: ReadonlyMap<string, import("@lararium/mesh").RealmBagRegistration> } | null> {
    if (!oracle) return null;
    const realmId = namedRealm?.trim().toLowerCase() || tiddlerText(await oracle.recordOf(REALM_ID_TIDDLER).catch(() => null));
    if (!realmId) return null;
    // A realm this vessel stands in pins its doc on the vessel's own plane: with no such pin the vessel stands
    // outside that realm, and no verdict a departed plane left behind answers for it.
    if (tiddlerText(await oracle.recordOf(realmDocPointer(realmId)).catch(() => null)) !== realmDocUrl(realmId)) return null;
    const text = tiddlerText(await oracle.recordOf(realmStandingPointer(realmId)).catch(() => null));
    return { realmId, bags: readRealmStanding(text) };
  }

  /** The realm plane's answer for a bag: the STANDING registration's doc, by access. Null when this vessel
   *  stands in no realm, the realm doc has not arrived, or no counted registration names the bag. */
  async function realmReach(key: string, bag: string, namedRealm?: string): Promise<LarTiddlerStore | null> {
    const standing = (await realmStanding(namedRealm))?.bags.get(key);
    if (!standing) return null;
    const handle = await findOrThrow(ctx.repo, standing.docUrl, `${bag} (realm bag)`).catch(() => null);
    return handle ? new AutomergeDocStore(handle, bag) : null;
  }
}

/** A bare slug becomes its bag URI; a full `lar:` URI passes through. */
function bagUriOf(slug: string): string {
  return slug.startsWith("lar:") ? slug : bagUri(slug);
}

interface MemeArgs {
  readonly uri: string;
  readonly recipe: string | null;
  readonly bag: string | null;
  readonly realm: string | null;
}

function readTarget(args: Readonly<Record<string, unknown>>, verb: string): MemeArgs {
  const container = readContainer(args, verb);
  const uri = stringArg(args, "uri");
  if (!uri) throw new Error(`${verb}: args.uri is required (the meme's root lar: URI)`);
  return { uri, ...container };
}

/**
 * THE CONTAINER LAW, for every meme verb at this door: a content verb names its container. Exactly one of
 * `args.recipe` (a wiki, read or written AS that wiki) or `args.bag` (that one bag) stands; neither, or
 * both, refuses as `no-container` before any cap ask, read or write. No default wiki exists: the daemon's
 * own wiki answers to its explicit name, `recipe: "default"`.
 */
function readContainer(args: Readonly<Record<string, unknown>>, verb: string): Omit<MemeArgs, "uri"> {
  const recipe = optionalStringArg(args, "recipe");
  const bag = optionalStringArg(args, "bag");
  const realm = optionalStringArg(args, "realm")?.trim().toLowerCase() || null;
  if (realm && recipe) throw new VerbRefusal("no-container", `no-container: ${verb} --realm names a bag's realm; it cannot accompany args.recipe.`);
  if (recipe && bag) throw new VerbRefusal("no-container", `no-container: ${verb} names both args.recipe and args.bag; name one of them, never both.`);
  if (!recipe && !bag) {
    throw new VerbRefusal("no-container", `no-container: ${verb} names no container; pass args.recipe (a wiki, e.g. "lares"; the daemon's own wiki answers to "default") or args.bag (that one bag). No default wiki exists.`);
  }
  return { recipe: recipe ?? null, bag: bag ?? null, realm };
}

/** A bag's own store, by the three reaches in order: a mounted layer (writable for a put), an
 *  instance slot's doc through THE ONE resolver, a registered bag by access. Null when none reaches. */
async function storeOfBag(opts: MemeVerbOptions, slug: string, bag: string, mode: "put" | "get"): Promise<LarTiddlerStore | null> {
  const mounted = mode === "put" ? opts.composite.writableStoreForBag(bag) : opts.composite.storeForBag(bag);
  if (mounted) return mounted;
  const kind = wikiSlotKindOf(slug, bag);
  if (kind === "temp") return null;   // volatile — lives in the wiki island alone, never reached
  if (kind && opts.slotStore) return opts.slotStore(slug, kind, bag, { mint: mode === "put" });
  return (await opts.reach?.(bag, bag)) ?? null;
}

/**
 * Resolve a named wiki's bag + store for a verb. PUT: the recipe record's designated bag, its own
 * store. GET: the whole cascade top-down, the first bag holding a record under the root, live or
 * tombstoned; when none does, the designated bag's store (the read answers null there, never a refusal
 * for an absent meme).
 */
async function reachRecipeBag(
  opts: MemeVerbOptions, slug: string, mode: "put" | "get", uri?: string,
): Promise<{ bag: string; store: LarTiddlerStore }> {
  const rec = await opts.recipeOf?.(slug);
  if (!rec) throw new Error(`meme: recipe "${slug}" not found in any registry plane — run \`lares wiki init ${slug}\` first`);
  const designated = designatedBagOf(rec, slug);
  if (mode === "get" && uri) {
    for (const bag of expandRecipe(recipeFromRecord(rec, slug))) {
      const store = await storeOfBag(opts, slug, bag, "get");
      if (!store) continue;
      // THE FIRST BAG THAT HOLDS A RECORD ANSWERS, A TOMBSTONE INCLUDED. A tombstone shadows every bag
      // beneath it, as the wiki's own composite reads it (`CompositeStore.get`): the read stops there and
      // that bag's store answers the meme absent. A bag that holds no record at all lets the walk go on.
      if (await store.get(uri)) return { bag, store };
    }
  }
  const store = await storeOfBag(opts, slug, designated, mode);
  if (store) return { bag: designated, store };
  throw new Error(`meme: recipe "${slug}" designates bag "${designated}", which this island neither mounts${mode === "put" ? " writable" : ""} nor reaches by access`);
}

interface Resolved {
  /** The bag the cap gate checks against. */
  readonly bag: string;
  readonly sink: MemeSink;
  /** True on the anchor — the daemon's own live wiki, where the in-VM face renders. */
  readonly anchor: boolean;
}

/** A wiki's instance slot addressed as a bag — `lar:///ha.ka.ba/wikis/<slug>/<draft|working|personal|temp>`. */
const WIKI_SLOT_BAG_RE = /^lar:\/\/\/ha\.ka\.ba\/wikis\/([^/]+)\/(temp|draft|working|personal)$/;

/** The cascade's config tiddler naming where a `lar:` save lands in this wiki (island-adaptor reads it). */
const CURRENT_WIKI_BAG = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";

/**
 * The bag the anchor's cap gate checks: the one the in-wiki cascade routes a `lar:` title to — the same
 * bag the placement will land in through `wikiMemeSink`: the daemon's mounted working layer.
 */
function anchorBagOf(opts: MemeVerbOptions): string {
  const wiki = opts.tw5.$tw.wiki as { getTiddlerText?: (t: string, d?: string) => string };
  const configured = wiki.getTiddlerText?.(CURRENT_WIKI_BAG, "") ?? "";
  if (!configured) throw new NoWorkingLayerRefusal("The meme write into the daemon's own wiki", "Wait until the daemon working layer attaches, or name another container (--recipe <slug> or --bag <slug>).");
  return configured;
}

async function resolveSink(opts: MemeVerbOptions, target: Omit<MemeArgs, "uri"> & { readonly uri?: string }, origin: ChangeOrigin, mode: "put" | "get"): Promise<Resolved> {
  if (target.bag) {
    const bag = bagUriOf(target.bag);
    if (target.realm) {
      if (WIKI_SLOT_BAG_RE.test(bag)) throw new VerbRefusal("no-container", `no-container: ${mode === "put" ? "meme-put" : "meme-get"} --realm names a bag's realm; a wiki slot lives in no realm.`);
      if (mode === "put") {
        const steward = await opts.realmWritable?.(bag, target.realm);
        if (!steward) throw new Error(`meme: bag "${bag}" holds no steward's write in realm ${target.realm}`);
        return { bag, sink: storeMemeSink(steward, bag, origin), anchor: false };
      }
      const store = await opts.reach?.(bag, bag, target.realm);
      if (!store) throw new Error(`meme: bag "${bag}" holds no layer in this island and nothing reaches it by access in realm ${target.realm}`);
      return { bag, sink: storeMemeSink(store, bag, origin), anchor: false };
    }
    // A NAMED WIKI'S INSTANCE SLOT, addressed as a bag. `--bag lar:///ha.ka.ba/wikis/<slug>/working` names the
    // doc THE ONE slot-doc resolver mints — the same doc `--recipe <slug>` walks and a `LOAD --to` that bag
    // lands in. The three reaches answer it (`storeOfBag`), and `temp` refuses there: it lives in the wiki
    // island alone and no door reaches it.
    const slot = WIKI_SLOT_BAG_RE.exec(bag);
    if (slot) {
      const store = await storeOfBag(opts, slot[1]!, bag, mode);
      if (!store) throw new Error(`meme: bag "${bag}" holds no layer in this island and nothing reaches it by access`);
      return { bag, sink: storeMemeSink(store, bag, origin), anchor: false };
    }
    if (mode === "put") {
      // THE REALM FIRST, as the read walks it first. A bag the relation carries is ONE book: a steward's
      // placement lands on the realm doc the registration names, never in this vessel's own layer of the
      // same name (that is the two-chests drift the ruling forbids). A hand outside `keptBy` reads null
      // here and draws exactly the refusal it drew before.
      const steward = await opts.realmWritable?.(bag);
      if (steward) return { bag, sink: storeMemeSink(steward, bag, origin), anchor: false };
      return { bag, sink: compositeMemeSink(opts.composite, bag, origin), anchor: false };
    }
    const store = opts.composite.storeForBag(bag) ?? (await opts.reach?.(bag, bag)) ?? null;
    if (!store) throw new Error(`meme: bag "${bag}" holds no layer in this island and nothing reaches it by access`);
    return { bag, sink: storeMemeSink(store, bag, origin), anchor: false };
  }
  if (target.recipe && target.recipe !== "default") {
    const { bag, store } = await reachRecipeBag(opts, target.recipe, mode, target.uri);
    return { bag, sink: storeMemeSink(store, bag, origin), anchor: false };
  }
  // The anchor: the daemon's own wiki, its cascade routing the records to the top bag.
  return { bag: anchorBagOf(opts), sink: wikiMemeSink(opts.tw5.$tw.wiki), anchor: true };
}

export function makeMemePutReactor(opts: MemeVerbOptions): VerbReactor {
  return async (args, ctx) => {
    const target = readTarget(args, "meme-put");
    const text = stringArg(args, "text");
    if (!text) throw new Error("meme-put: args.text is required (the whole meme, framed)");
    const base = optionalStringArg(args, "base");
    const origin: ChangeOrigin = { kind: "lares-verb", requestId: ctx.invocation.requestId };
    const { bag, sink } = await resolveSink(opts, target, origin, "put");
    const proof = await ctx.cap("admin", bag);
    if (!proof.ok) throw new Error(`cap-denied: admin on ${bag} required (${proof.reason ?? "no reason"})`);
    const receipt = await placeMeme({ uri: target.uri, text, baseHash: base }, sink);
    return { ...receipt };
  };
}

export function makeMemeGetReactor(opts: MemeVerbOptions): VerbReactor {
  return async (args, ctx) => {
    const target = readTarget(args, "meme-get");
    const origin: ChangeOrigin = { kind: "lares-verb", requestId: ctx.invocation.requestId };
    const { bag, sink } = await resolveSink(opts, target, origin, "get");
    const proof = await ctx.cap("read", bag);
    if (!proof.ok) throw new Error(`cap-denied: read on ${bag} required (${proof.reason ?? "no reason"})`);
    // The read hands a person the meme's TEXT: a pointer whose body rests in the content tier refuses by name.
    if (await holdsUnreadPointer(target.uri, sink)) {
      throw new VerbRefusal(POINTER_BODY_CODE, `${POINTER_BODY_CODE}: ${target.uri} holds a pointer whose body rests in the content tier; meme-get reads no pointer body.`);
    }
    return { uri: target.uri, meme: await readMeme(target.uri, sink) };
  };
}

/**
 * THE PAGE A LISTING ANSWERS. A verb's outcome carries at most `AUDIT_ARRAY_CAP` rows of any array and
 * turns a longer one into a count and a sample (`boundOutcomeOutput`, `verb-vm.ts`). A listing that named
 * its roots in one array would therefore reach its reader as no roots at all once a seat held more than
 * the cap. So the listing pages at the cap: every answer carries its roots whole, and `next` names the
 * cursor of the page behind it.
 */
export const MEME_LIST_PAGE = AUDIT_ARRAY_CAP;

/** The page size a caller asked for, held inside the outcome's cap; absent or unreadable reads as the cap. */
function pageLimitOf(raw: unknown): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && /^[0-9]+$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  return Number.isInteger(n) && n >= 1 ? Math.min(n, MEME_LIST_PAGE) : MEME_LIST_PAGE;
}

/** One root of a recipe's listing: the listing's own row, and the bag whose record answered it. */
type StackListing = MemeListing & { readonly bag: string };

/**
 * A NAMED RECIPE'S LISTING READS THE STACK, as its `meme-get` does: every root the wiki resolves, each
 * answered by the first bag that holds a record under it. A tombstone in a bag above shadows the bags
 * beneath, so a carrier the wiki deleted lists nowhere; a root two bags hold lists once, from the upper
 * one, under that bag's own render. Each row names the bag that answered. A bag the island neither
 * mounts nor reaches gets named in `unreached`, so a partial listing says so.
 */
async function listRecipeStack(
  opts: MemeVerbOptions, slug: string, page: { tree: boolean; after: string | null; limit: number },
  origin: ChangeOrigin, cap: (access: "read", bag: string) => Promise<{ ok: boolean; reason?: string }>,
): Promise<Record<string, unknown>> {
  const rec = await opts.recipeOf?.(slug);
  if (!rec) throw new Error(`meme: recipe "${slug}" not found in any registry plane — run \`lares wiki init ${slug}\` first`);
  const layers: Array<{ bag: string; store: LarTiddlerStore; sink: Pick<MemeSink, "titles" | "read"> }> = [];
  const unreached: string[] = [];
  const candidates = new Set<string>();
  for (const bag of expandRecipe(recipeFromRecord(rec, slug))) {
    const store = await storeOfBag(opts, slug, bag, "get");
    // An instance slot with no store holds no record yet (nothing minted its doc), and `temp` lives in the
    // wiki island alone: neither hides a root. Any other bag with no store stands unreached, by name.
    if (!store) { if (!wikiSlotKindOf(slug, bag)) unreached.push(bag); continue; }
    const proof = await cap("read", bag);
    if (!proof.ok) throw new Error(`cap-denied: read on ${bag} required (${proof.reason ?? "no reason"})`);
    const titles = await store.listVisible();
    const base = storeMemeSink(store, bag, origin);
    layers.push({ bag, store, sink: { titles: () => titles, read: (title) => base.read(title) } });
    // A root's title carries no `#`; a title at or before the cursor rode an earlier page.
    for (const title of titles) if (!title.includes("#") && (page.after === null || title > page.after)) candidates.add(title);
  }
  const roots: StackListing[] = [];
  let next: string | null = null;
  for (const uri of [...candidates].sort()) {
    let answered: (typeof layers)[number] | null = null;
    for (const layer of layers) {
      const held = await layer.store.get(uri);
      if (!held) continue;
      // The first bag that holds a record answers: a live root lists from it, a tombstone shadows the rest.
      if (!held.meta?.deleted && isMemeRoot(uri, held.tiddler as unknown as TiddlerFields)) answered = layer;
      break;
    }
    if (!answered) continue;
    if (roots.length >= page.limit) { next = roots[roots.length - 1]!.uri; break; }
    const listed = await listOneMeme(uri, answered.sink, page.tree);
    if (listed) roots.push({ ...listed, bag: answered.bag });
  }
  return { recipe: slug, bags: layers.map((l) => l.bag), ...(unreached.length > 0 ? { unreached } : {}), roots, next };
}

export function makeMemeListReactor(opts: MemeVerbOptions): VerbReactor {
  return async (args, ctx) => {
    const target = readContainer(args, "meme-list");
    const tree = args["tree"] === true || args["tree"] === "1" || args["tree"] === "true";
    const page = { tree, after: optionalStringArg(args, "after") ?? null, limit: pageLimitOf(args["limit"]) };
    const origin: ChangeOrigin = { kind: "lares-verb", requestId: ctx.invocation.requestId };
    if (target.recipe && target.recipe !== "default") return listRecipeStack(opts, target.recipe, page, origin, ctx.cap);
    const { bag, sink } = await resolveSink(opts, target, origin, "get");
    const proof = await ctx.cap("read", bag);
    if (!proof.ok) throw new Error(`cap-denied: read on ${bag} required (${proof.reason ?? "no reason"})`);
    return { bag, ...(await listMemePage(sink, page)) };
  };
}

export function makeMemeDeleteReactor(opts: MemeVerbOptions): VerbReactor {
  return async (args, ctx) => {
    const target = readTarget(args, "meme-delete");
    const base = optionalStringArg(args, "base");
    const origin: ChangeOrigin = { kind: "lares-verb", requestId: ctx.invocation.requestId };
    const { bag, sink } = await resolveSink(opts, target, origin, "put");
    const proof = await ctx.cap("admin", bag);
    if (!proof.ok) throw new Error(`cap-denied: admin on ${bag} required (${proof.reason ?? "no reason"})`);
    const receipt = await removeMeme({ uri: target.uri, baseHash: base }, sink);
    return { uri: target.uri, ...receipt };
  };
}

export function makeMemeProjectReactor(opts: MemeVerbOptions): VerbReactor {
  return async (args, ctx) => {
    const target = readTarget(args, "meme-project");
    const to = stringArg(args, "to");
    if (!to) throw new Error("meme-project: args.to is required (mem · md · html · tid · json)");
    const projectTarget = projectTargetOf(to);
    const dialect = optionalStringArg(args, "dialect") ?? undefined;
    const tongue = optionalStringArg(args, "tongue") ?? undefined;
    if (projectTarget !== "md" && (dialect || tongue)) {
      throw new Error(`meme-project: --dialect/--tongue weave the "md" target alone; got "${projectTarget}"`);
    }
    const origin: ChangeOrigin = { kind: "lares-verb", requestId: ctx.invocation.requestId };
    const { bag, sink, anchor } = await resolveSink(opts, target, origin, "get");
    const proof = await ctx.cap("read", bag);
    if (!proof.ok) throw new Error(`cap-denied: read on ${bag} required (${proof.reason ?? "no reason"})`);
    // A projection renders the meme's TEXT: the same pointer refusal the read gives, at every seat.
    if (await holdsUnreadPointer(target.uri, sink)) {
      throw new VerbRefusal(POINTER_BODY_CODE, `${POINTER_BODY_CODE}: ${target.uri} holds a pointer whose body rests in the content tier; meme-project renders no pointer body.`);
    }
    if (anchor) {
      const face = (opts.tw5.$tw as LaresTw5Extension).lares?.meme;
      if (!face) throw new Error("meme-project: the anchor wiki publishes no $tw.lares.meme (the meme-face startup module is absent)");
      return { ...face.project(target.uri, projectTarget, { ...(dialect ? { dialect } : {}), ...(tongue ? { tongue } : {}) }) };
    }
    if (projectTarget !== "mem" && projectTarget !== "md") {
      throw new Error(`meme-project: "${projectTarget}" renders through a wiki and projects from the anchor only; a recipe or bag target projects mem · md`);
    }
    const meme = await readMeme(target.uri, sink);
    if (!meme) throw new Error(`meme-project: no meme stands under ${target.uri} in ${bag}`);
    if (projectTarget === "mem") return { ...projectCarrierText(meme.text, target.uri, projectTarget) };

    // THE STORE PATH, `md`: the recorded-target record (`submissionTitleOf(uri)`) is a RENDERED
    // pair's sidecar, never a carrier a store's `readMeme` can answer — a store seat holds carrier
    // text alone. So the store path's target is the explicit flag, or CommonMark/no-tongue, NEVER a
    // recorded default (that default belongs to a door that already holds the rendered pair, which
    // this one does not). Pins resolve by PREFETCH: every `aka`/`kanawai` target this carrier names
    // ({@link pinTargetsOf} — the one place the AKA line is read before the weave, since this
    // reactor has no live resolver to call synchronously mid-walk) reads once, up front, into a
    // plain map; the weave's `resolve` option is then a synchronous lookup over it.
    const pinMap = new Map<string, string | null>();
    for (const t of pinTargetsOf(meme.text)) pinMap.set(t, (await readMeme(t, sink))?.text ?? null);
    return {
      ...projectCarrierText(meme.text, target.uri, projectTarget, {
        ...(dialect ? { profile: profileOf(dialect) } : {}),
        ...(tongue ? { tongue } : {}),
        resolve: (t: string) => pinMap.get(t) ?? null,
      }),
    };
  };
}
