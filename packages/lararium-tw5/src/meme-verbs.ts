/**
 * meme-verbs — `meme-put` / `meme-get` / `meme-project`, the daemon island's skins of the meme laws.
 *
 * The contract every skin (this, the HTTP route, the MCP tool) carries verbatim:
 *
 *   meme-put      { recipe?, bag?, uri, text, base? }   → PlaceMemeReceipt
 *   meme-get      { recipe?, bag?, uri }                → { uri, meme: { text, canonicalHash } | null }
 *   meme-project  { recipe?, bag?, uri, to }            → { uri, to, text, contentType, meta? }
 *
 * `to` names a target — mem · md · html · tid · json (`meme-project.ts`); `meta` rides on `md` alone,
 * the `.md.meta` sidecar. The anchor projects through the in-VM face (`$tw.lares.meme.project`), so
 * every target renders through the wiki that holds the records; a recipe or bag target holds records
 * in a store, never a wiki, so it projects the TEXT targets (mem · md) and refuses the wiki renders
 * loud. An unknown target refuses naming the targets; an absent meme refuses naming the URI.
 *
 * At most one of `recipe` / `bag`; neither names `recipe: "default"`. Three targets follow:
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
 *       reads it, and answers from the first bag holding the meme live. The draft shadows canon when
 *       both hold it; a meme living in canon reads through `--recipe` when the draft holds nothing.
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
  AutomergeDocStore, DAEMON_BAG_ID, bagUri, designatedBagOf, expandRecipe, recipeFromRecord, recipeUri, wikiSlotKindOf,
  type ChangeOrigin, type CompositeStore, type LarTiddlerRecord, type LarTiddlerStore, type WikiSlotKind,
} from "@lararium/mesh";
import { findOrThrow, makeCatalogAccessor } from "./catalog-accessor.js";
import type { IslandContext } from "./island-context.js";
import { placeMeme, readMeme, wikiMemeSink, type MemeSink } from "./place-meme.js";
import { compositeMemeSink, storeMemeSink } from "./meme-sinks.js";
import { projectCarrierText, projectTargetOf } from "./meme-project.js";
import type { TW5Engine } from "./tw5-vm.js";
import type { LaresTw5Extension } from "./types/lares-globals.js";
import type { VerbReactor } from "./verb-dispatcher.js";
import { optionalStringArg, stringArg } from "./handler-args.js";

export interface MemeVerbOptions {
  readonly composite: CompositeStore;
  /** The daemon island's engine — its live `$tw.wiki` is the anchor. Read lazily, at verb time. */
  readonly tw5: Pick<TW5Engine, "$tw">;
  /** A wiki's recipe record by slug, or null when no plane holds one. Absent = no named recipes. */
  readonly recipeOf?: (slug: string) => Promise<LarTiddlerRecord | null>;
  /** A registered bag's own store by its registry KEY, presented as `bag`; null = unregistered. */
  readonly reach?: (key: string, bag: string) => Promise<LarTiddlerStore | null>;
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
  // A user recipe lives in the catalog plane under `bags/catalog/recipes/<slug>`; a system wiki's
  // (lares, lararium) in the oracle plane under `bags/oracle/recipes/<slug>`.
  const recipePlanes = [
    ...(catalog ? [{ accessor: catalog, root: "catalog" }] : []),
    ...(oracle  ? [{ accessor: oracle,  root: "oracle"  }] : []),
  ];
  const planes = recipePlanes.map((p) => p.accessor);
  return {
    composite: ctx.composite,
    tw5: ctx.tw5,
    slotStore: async (slug, kind, bag, opts) => {
      const url = await slotDocUrl(slug, kind, opts);
      if (!url) return null;
      const handle = await findOrThrow(ctx.repo, url, `${bag} (${kind} slot of ${slug})`);
      return new AutomergeDocStore(handle, bag);
    },
    recipeOf: async (slug) => {
      for (const { accessor, root } of recipePlanes) {
        const rec = await accessor.recordOf(recipeUri(root, slug)).catch(() => null);
        if (rec) return rec;
      }
      return null;
    },
    reach: async (key, bag) => {
      for (const accessor of planes) {
        const handle = await accessor.find(key).catch(() => null);
        if (handle) return new AutomergeDocStore(handle, bag);
      }
      return null;
    },
  };
}

/** A bare slug becomes its bag URI; a full `lar:` URI passes through. */
function bagUriOf(slug: string): string {
  return slug.startsWith("lar:") ? slug : bagUri(slug);
}

interface MemeArgs {
  readonly uri: string;
  readonly recipe: string | null;
  readonly bag: string | null;
}

function readTarget(args: Readonly<Record<string, unknown>>, verb: string): MemeArgs {
  const uri = stringArg(args, "uri");
  if (!uri) throw new Error(`${verb}: args.uri is required (the meme's root lar: URI)`);
  const recipe = optionalStringArg(args, "recipe");
  const bag = optionalStringArg(args, "bag");
  if (recipe && bag) throw new Error(`${verb}: at most one of args.recipe / args.bag`);
  return { uri, recipe: recipe ?? (bag ? null : "default"), bag };
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
 * store. GET: the whole cascade top-down, the first bag holding the meme LIVE; when none does, the
 * designated bag's store (the read answers null there, never a refusal for an absent meme).
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
      const held = await store.get(uri);
      if (held && !held.meta?.deleted) return { bag, store };
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

/** The cascade's config tiddler naming where a `lar:` save lands in this wiki (island-adaptor reads it). */
const CURRENT_WIKI_BAG = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";

/**
 * The bag the anchor's cap gate checks: the one the in-wiki cascade routes a `lar:` title to — the same
 * bag the placement will land in through `wikiMemeSink`: the daemon's working layer once its
 * late-attach re-seeds the cascade, the daemon bag until then.
 */
function anchorBagOf(opts: MemeVerbOptions): string {
  const wiki = opts.tw5.$tw.wiki as { getTiddlerText?: (t: string, d?: string) => string };
  const configured = wiki.getTiddlerText?.(CURRENT_WIKI_BAG, "") ?? "";
  return configured || DAEMON_BAG_ID;
}

async function resolveSink(opts: MemeVerbOptions, target: MemeArgs, origin: ChangeOrigin, mode: "put" | "get"): Promise<Resolved> {
  if (target.bag) {
    const bag = bagUriOf(target.bag);
    if (mode === "put") return { bag, sink: compositeMemeSink(opts.composite, bag, origin), anchor: false };
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
    return { uri: target.uri, meme: await readMeme(target.uri, sink) };
  };
}

export function makeMemeProjectReactor(opts: MemeVerbOptions): VerbReactor {
  return async (args, ctx) => {
    const target = readTarget(args, "meme-project");
    const to = stringArg(args, "to");
    if (!to) throw new Error("meme-project: args.to is required (mem · md · html · tid · json)");
    const projectTarget = projectTargetOf(to);
    const origin: ChangeOrigin = { kind: "lares-verb", requestId: ctx.invocation.requestId };
    const { bag, sink, anchor } = await resolveSink(opts, target, origin, "get");
    const proof = await ctx.cap("read", bag);
    if (!proof.ok) throw new Error(`cap-denied: read on ${bag} required (${proof.reason ?? "no reason"})`);
    if (anchor) {
      const face = (opts.tw5.$tw as LaresTw5Extension).lares?.meme;
      if (!face) throw new Error("meme-project: the anchor wiki publishes no $tw.lares.meme (the meme-face startup module is absent)");
      return { ...face.project(target.uri, projectTarget) };
    }
    if (projectTarget !== "mem" && projectTarget !== "md") {
      throw new Error(`meme-project: "${projectTarget}" renders through a wiki and projects from the anchor only; a recipe or bag target projects mem · md`);
    }
    const meme = await readMeme(target.uri, sink);
    if (!meme) throw new Error(`meme-project: no meme stands under ${target.uri} in ${bag}`);
    return { ...projectCarrierText(meme.text, target.uri, projectTarget) };
  };
}
