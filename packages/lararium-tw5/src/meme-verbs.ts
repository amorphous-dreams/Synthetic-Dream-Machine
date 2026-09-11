/**
 * meme-verbs — `meme-put` / `meme-get`, the daemon island's skins of the one placement function.
 *
 * The contract every skin (this, the HTTP route, the MCP tool) carries verbatim:
 *
 *   meme-put  { recipe?, bag?, uri, text, base? }   → PlaceMemeReceipt
 *   meme-get  { recipe?, bag?, uri }                → { uri, meme: { text, canonicalHash } | null }
 *
 * At most one of `recipe` / `bag`; neither names `recipe: "default"`. Three targets follow:
 *
 *   · `recipes/default` — the host's ANCHOR, the daemon's own wiki (never "the active wiki"). The
 *     placement goes through the live `$tw.wiki`, so the in-wiki cascade
 *     (`lar:///ha.ka.ba/lararium/config/bag-paths`) routes it to the top bag exactly as an in-wiki
 *     edit would.
 *   · `recipe: <slug>` — an edit AS THAT WIKI. The slug names its recipe record (the user's catalog
 *     plane first, the oracle system plane after); the record's `writable-bag` (else the top of its
 *     `bag-stack`) names the designated bag; the placement lands in THAT BAG's own store — a layer the
 *     island mounts writable, else the bag's doc reached by access across the registry planes. A
 *     wiki's draft bag keys its doc per vessel DID (`wikis/<slug>/drafts/<did>`), the same key the
 *     host walks at mount. WRITE-THEN-SYNC: the daemon never reaches into that wiki's mounted island.
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
  AutomergeDocStore, DAEMON_BAG_ID, bagStackFromRec, bagUri, recipeUri, wikiDraftBagUri, wikiDraftDocKey,
  type ChangeOrigin, type CompositeStore, type LarTiddlerRecord, type LarTiddlerStore,
} from "@lararium/mesh";
import { makeCatalogAccessor } from "./catalog-accessor.js";
import type { IslandContext } from "./island-context.js";
import { placeMeme, readMeme, wikiMemeSink, type MemeSink } from "./place-meme.js";
import { compositeMemeSink, storeMemeSink } from "./meme-sinks.js";
import type { TW5Engine } from "./tw5-vm.js";
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
  /** The vessel DID a wiki's draft doc keys under. Absent = draft bags resolve by their bare key only. */
  readonly vesselDid?: () => string | Promise<string>;
}

/** The daemon's options off its island context — reach across both registry planes (access ≠ load). */
export function memeVerbOptions(
  ctx: Pick<IslandContext, "composite" | "tw5" | "repo" | "catalogUrl" | "oracleUrl">,
  vesselDid: () => string | Promise<string>,
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
    vesselDid,
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

/** The designated writable bag a wiki's recipe names: `writable-bag`, else the top of its stack. */
function designatedBagOf(rec: LarTiddlerRecord, slug: string): string {
  const declared = rec.tiddler["writable-bag"];
  if (typeof declared === "string" && declared) return declared;
  const stack = bagStackFromRec(rec);
  const top = stack[stack.length - 1];
  if (!top) throw new Error(`meme: recipe "${slug}" names no writable bag and an empty bag-stack`);
  return top;
}

/** Resolve a named wiki's designated bag to its own store — mounted writable layer, else by access. */
async function reachRecipeBag(
  opts: MemeVerbOptions, slug: string, mode: "put" | "get",
): Promise<{ bag: string; store: LarTiddlerStore }> {
  const rec = await opts.recipeOf?.(slug);
  if (!rec) throw new Error(`meme: recipe "${slug}" not found in any registry plane — run \`lares wiki init ${slug}\` first`);
  const bag = designatedBagOf(rec, slug);
  const mounted = mode === "put" ? opts.composite.writableStoreForBag(bag) : opts.composite.storeForBag(bag);
  if (mounted) return { bag, store: mounted };
  const tried: string[] = [];
  if (opts.reach) {
    if (bag === wikiDraftBagUri(slug) && opts.vesselDid) {
      const key = wikiDraftDocKey(slug, await opts.vesselDid());
      tried.push(key);
      const store = await opts.reach(key, bag);
      if (store) return { bag, store };
    }
    tried.push(bag);
    const store = await opts.reach(bag, bag);
    if (store) return { bag, store };
  }
  throw new Error(`meme: recipe "${slug}" designates bag "${bag}", which this island neither mounts writable nor reaches by access (tried: ${tried.join(", ") || "no reach"})`);
}

interface Resolved {
  /** The bag the cap gate checks against. */
  readonly bag: string;
  readonly sink: MemeSink;
}

async function resolveSink(opts: MemeVerbOptions, target: MemeArgs, origin: ChangeOrigin, mode: "put" | "get"): Promise<Resolved> {
  if (target.bag) {
    const bag = bagUriOf(target.bag);
    if (mode === "put") return { bag, sink: compositeMemeSink(opts.composite, bag, origin) };
    const store = opts.composite.storeForBag(bag) ?? (await opts.reach?.(bag, bag)) ?? null;
    if (!store) throw new Error(`meme: bag "${bag}" holds no layer in this island and nothing reaches it by access`);
    return { bag, sink: storeMemeSink(store, bag, origin) };
  }
  if (target.recipe && target.recipe !== "default") {
    const { bag, store } = await reachRecipeBag(opts, target.recipe, mode);
    return { bag, sink: storeMemeSink(store, bag, origin) };
  }
  // The anchor: the daemon's own wiki, its cascade routing the records to the top bag.
  return { bag: opts.composite.defaultWritableBagId() ?? DAEMON_BAG_ID, sink: wikiMemeSink(opts.tw5.$tw.wiki) };
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
