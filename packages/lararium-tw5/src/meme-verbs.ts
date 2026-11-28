/**
 * meme-verbs — `meme-get` / `meme-list` / `meme-project`, the daemon island's read skins of the meme laws, and the ONE
 * REACH every door shares for a bag's own store (`readBagStore`, `writeBagStore`).
 *
 * The contract every skin (this, the HTTP route, the MCP tool) carries verbatim:
 *
 *   meme-get      { recipe?, bag?, uri }                → { uri, meme: { text, canonicalHash } | null }
 *   meme-list     { recipe?, bag?, tree?, after?, limit? } → { bag | recipe, roots: MemeListing[], next }
 *   meme-project  { recipe?, bag?, uri, to, dialect?, tongue? } → { uri, to, text, contentType, meta? }
 *
 * A FAMILY WRITES AND LEAVES AS TIDDLERS. The tiddler door carries every write (`tiddler-verbs`: `tiddler-put` lands a
 * family's text through the Confluence gate, in a wiki's engine or a bag's own store; `tiddler-delete` removes a family or
 * cuts a slot). This module lends that door its reach: the container law, a bag's store by the three reaches, the Kahu
 * predicate and the cap gate.
 *
 * `meme-list` answers every ROOT the seat holds with the canonical hash a writer hands back as its base,
 * a page at a time (`MEME_LIST_PAGE` roots, in title order): `next` names the cursor of the page behind,
 * a caller hands it back as `after`, and `next: null` ends the listing. A bag lists its own records; a
 * named recipe lists the roots its whole stack resolves, each row naming the bag that answered
 * (`listRecipeStack`). `tree` nests each root's slot tree.
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
 *   · `recipe: <slug>` — a read AS THAT WIKI. THE READ WALKS THE STACK: the wiki's whole cascade top-down — the instance
 *     slots above, the canon and libraries beneath, the oracle floor — exactly as the wiki's own face reads it, answering
 *     from the first bag holding a record under the meme's root. The draft shadows canon when both hold it; a meme living
 *     in canon reads through `recipe` when the draft holds nothing; a TOMBSTONE in a bag above shadows canon too, so the
 *     read answers no meme.
 *   · `bag: <slug>` — that one bag's own store: a layer the island mounts (writable, for a write), an instance slot's doc
 *     through THE ONE slot-doc resolver, a registered bag by access. A bag the island cannot write fails a write loud,
 *     naming the bag; a placement never shadows up.
 *
 * Bag and wiki slugs ride BARE (`sdm`, `lares`); a full `lar:` bag URI passes through.
 *
 * Runs daemon-side (a plain module, never a plugin tiddler).
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/meme-verbs
 */

import { wearOf } from "@lararium/mesh/repo-wear";
import { staysHome } from "./stay-home.js";
import { AutomergeDocStore } from "@lararium/mesh/automerge-doc-store";
import { NoWorkingLayerRefusal, type CompositeStore } from "@lararium/mesh/composite-store";
import { VerbRefusal } from "@lararium/mesh/verb-refusal";
import { floorReadFace } from "@lararium/mesh/floor-manifest";
import { isHouseCanonBag, requireKahuReach, type KahuReachSource } from "@lararium/mesh/kahu-canon-reach";
import { resolveHouseCanon } from "@lararium/mesh/house-canon-doc";
import { bagUri } from "@lararium/mesh/lar-uris";
import { designatedBagOf } from "@lararium/mesh/recipe";
import { expandRecipe, recipeFromRecord, wikiSlotKindOf, type WikiSlotKind } from "@lararium/mesh/wiki-recipe";
import {
  REALM_ID_TIDDLER,
  realmDocPointer,
  realmDocUrl,
  realmStewardPointer,
  realmStandingPointer,
  readRealmStanding,
  mayWriteRealmBag,
} from "@lararium/mesh/realm-bag";
import { tiddlerText } from "@lararium/mesh/base-doc";
import { carrierHashOf } from "@lararium/mesh/carrier-form";
import { isWorkingLayerBag, overrideBaseOf } from "@lararium/mesh/override-base";
import { type ChangeOrigin, type LarTiddlerRecord, type LarTiddlerStore } from "@lararium/mesh/tiddler-store";
import { findOrThrow, makeCatalogAccessor } from "./catalog-accessor.js";
import { effectiveRecipeOf } from "./recipe-planes.js";
import type { IslandContext } from "./island-context.js";
import { holdsUnreadPointer, isMemeRoot, listMemePage, listOneMeme, POINTER_BODY_CODE, readMeme, wikiMemeSink, type MemeListing, type MemeSink } from "./place-meme.js";
import { compositeMemeSink, storeMemeSink } from "./meme-sinks.js";
import { projectCarrierText, projectTargetOf } from "./meme-project.js";
import { pinTargetsOf, profileOf } from "./weave/index.js";
import type { TW5Engine } from "./tw5-vm.js";
import { wornOrigin } from "./verb-dispatcher.js";
import { wikiWearsNext } from "./island-recipe.js";
import type { LaresTw5Extension } from "./types/lares-globals.js";
import type { VerbContext, VerbReactor } from "./verb-dispatcher.js";
import { optionalStringArg, stringArg } from "./handler-args.js";
import { grainOf, hasLine, param, memeBase, memeGradient } from "./read-gradient.js";

/** Name the family source at the reactor that answered it. */
function familyHas(name: string, source: Record<string, unknown>, kind: string): string {
  const parts = [param("kind", kind)];
  for (const key of ["recipe", "bag", "floor", "canonicalHash"]) {
    const value = source[key];
    if (typeof value === "string" || typeof value === "boolean") parts.push(param(key === "canonicalHash" ? "base" : key, value));
  }
  return hasLine(name, parts);
}
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
  /**
   * THE LAYER THIS FACE'S SAVES OF A WIKI LAND IN (cabal-realm#/the-workbench): `working` where the face holds a writer's seat
   * in the wiki's workbench, `personal` where it holds none (seated `read`, or seated nowhere while another face of the vessel
   * stands the wiki), null where no layer takes a write. A named wiki's engine reads it as it composes (`wiki-engine`).
   */
  readonly writeSlot?: (slug: string) => Promise<"working" | "personal" | null>;
  /** The vessel's source of the Kahu predicate's facts. A put or a delete that lands in a house canon bag asks it
   *  BEFORE the cap gate, so a realm steward's grant stands in for no check. Absent → a stranger (fail closed). */
  readonly kahuReach?: KahuReachSource;
  /** A house canon bag's FLOOR SNAPSHOT as a read-only store, off the floor this island mounted (`IslandContext.floorCanon`);
   *  null where the floor carries none of it. A read door answers from it where the hand holds no read on the live document. */
  readonly floorCanon?: (bag: string) => LarTiddlerStore | null;
  /**
   * EACH HAT REACHED BY NAME: a LIT sibling face's own lane. Set, the verbs reach this one bag of that face's own (its
   * document, as the island resolved it for that face) and nothing else: a container naming any other bag, any recipe or
   * any realm refuses `face-lane-holds-its-own` before a cap ask, a read or a write. The cap, the Kahu predicate and the
   * gate stand as on every door; the write seals under the face's own chain because its session booked it.
   */
  readonly faceLane?: { readonly bag: string; readonly store: LarTiddlerStore };
}

/** The lane's one bag, or a refusal by name: a lit sibling's verb reaches only that face's own document. */
function laneResolved(lane: NonNullable<MemeVerbOptions["faceLane"]>, target: Omit<MemeArgs, "uri">, origin: ChangeOrigin): Resolved {
  const named = target.bag && !target.realm && !target.recipe ? bagUriOf(target.bag) : null;
  if (named !== lane.bag) {
    throw new VerbRefusal("face-lane-holds-its-own", `face-lane-holds-its-own: a lit sibling face reaches its own lane alone (bag=${lane.bag}); this container names another, and nothing moved.`);
  }
  return { bag: lane.bag, sink: storeMemeSink(lane.store, lane.bag, origin), anchor: false };
}

/** The daemon's options off its island context — reach across both registry planes (access ≠ load). */
export function memeVerbOptions(
  ctx: Pick<IslandContext, "composite" | "tw5" | "repo" | "catalogUrl" | "faceCatalogUrl" | "oracleUrl" | "floorCanon">,
  /** The instance-slot doc url by THE ONE resolver; null when nothing stands and `mint` is false. */
  slotDocUrl: (slug: string, kind: WikiSlotKind, opts: { mint: boolean }) => Promise<string | null>,
  /** A house canon bag's live document, which rests in the Kahu realm (no registry plane names it). Naming it asks nothing. */
  systemCanonUrl?: (bag: string) => Promise<string | null>,
): MemeVerbOptions {
  const catalog = ctx.catalogUrl ? makeCatalogAccessor(ctx.repo, ctx.catalogUrl, ctx.faceCatalogUrl) : null;
  const oracle  = ctx.oracleUrl  ? makeCatalogAccessor(ctx.repo, ctx.oracleUrl)  : null;
  const planes = [...(catalog ? [catalog] : []), ...(oracle ? [oracle] : [])];
  return {
    composite: ctx.composite,
    tw5: ctx.tw5,
    ...(ctx.floorCanon ? { floorCanon: (bag: string) => { const rows = ctx.floorCanon!(bag); return rows ? floorReadFace({ rows: [rows] }) : null; } } : {}),
    slotStore: async (slug, kind, bag, opts) => {
      const url = await slotDocUrl(slug, kind, opts);
      if (!url) return null;
      const handle = await findOrThrow(ctx.repo, url, `${bag} (${kind} slot of ${slug})`);
      return new AutomergeDocStore(handle, bag, wearOf(ctx.repo));
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
      // HOUSE CANON'S ONE DOCUMENT: where the vessel names the Kahu realm's standing document for the bag, that document
      // answers ahead of every registry plane; a registry row that names another document for the bag answers only where the
      // realm names none (a rig, a vessel outside every realm).
      const answer = await resolveHouseCanon<LarTiddlerStore>(bag, {
        realm: systemCanonUrl ? (b) => systemCanonUrl(b).catch(() => null) : undefined,
        row: async () => {
          for (const accessor of planes) {
            const handle = await accessor.find(key).catch(() => null);
            if (handle) return new AutomergeDocStore(handle, bag, wearOf(ctx.repo));
          }
          return null;
        },
      });
      if (answer === null) return null;
      if ("row" in answer) return answer.row;
      const handle = await findOrThrow(ctx.repo, answer.realm, bag).catch(() => null);
      return handle ? new AutomergeDocStore(handle, bag, wearOf(ctx.repo)) : null;
    },
    // The realm's WRITE answer: the standing registration's doc as a writable store, for a steward alone.
    realmWritable: async (bag, namedRealm) => {
      const standing = await realmStanding(namedRealm);
      if (!standing) return null;
      const nym = tiddlerText(await catalog!.recordOf(realmStewardPointer(standing.realmId)).catch(() => null));
      if (!mayWriteRealmBag(standing.bags, bag, nym)) return null;
      const rec = standing.bags.get(bag)!;
      const handle = await findOrThrow(ctx.repo, rec.docUrl, `${bag} (realm bag)`).catch(() => null);
      return handle ? new AutomergeDocStore(handle, bag, wearOf(ctx.repo)) : null;
    },
  };

  /** The realm this vessel stands in, and the registrations its doc carries as of the last sync. Null when
   *  no catalog plane, no realm id, or no realm doc has arrived — each a vessel outside every realm. */
  async function realmStanding(namedRealm?: string): Promise<{ realmId: string; bags: ReadonlyMap<string, import("@lararium/mesh/realm-bag").RealmBagRegistration> } | null> {
    if (!catalog) return null;
    const realmId = namedRealm?.trim().toLowerCase() || tiddlerText(await catalog.recordOf(REALM_ID_TIDDLER).catch(() => null));
    if (!realmId) return null;
    // A realm this vessel stands in pins its doc on the vessel's own plane: with no such pin the vessel stands
    // outside that realm, and no verdict a departed plane left behind answers for it.
    if (tiddlerText(await catalog.recordOf(realmDocPointer(realmId)).catch(() => null)) !== realmDocUrl(realmId)) return null;
    const text = tiddlerText(await catalog.recordOf(realmStandingPointer(realmId)).catch(() => null));
    return { realmId, bags: readRealmStanding(text) };
  }

  /** The realm plane's answer for a bag: the STANDING registration's doc, by access. Null when this vessel
   *  stands in no realm, the realm doc has not arrived, or no counted registration names the bag. */
  async function realmReach(key: string, bag: string, namedRealm?: string): Promise<LarTiddlerStore | null> {
    const standing = (await realmStanding(namedRealm))?.bags.get(key);
    if (!standing) return null;
    const handle = await findOrThrow(ctx.repo, standing.docUrl, `${bag} (realm bag)`).catch(() => null);
    return handle ? new AutomergeDocStore(handle, bag, wearOf(ctx.repo)) : null;
  }
}

/** THE ANCHOR'S HOP CARRIES THE FACE: each member the wiki sink lands or removes names the origin's face on the shore first,
 *  so the shore's write of it lands under that face's actor. An origin that names no face hands the sink back unchanged. */
function wornWikiSink(sink: MemeSink, tw5: object, origin: ChangeOrigin): MemeSink {
  // THE ACT CROSSES WITH THE FACE (landing 13): the shore's receipt of each member names the verb's request that moved it.
  const act = origin.kind === "lares-verb" ? `lares-verb#${origin.requestId}` : undefined;
  if (origin.face === undefined && act === undefined) return sink;
  const face = origin.face;
  return {
    ...sink,
    land: (fields) => { wikiWearsNext(tw5, String((fields as { title?: unknown }).title ?? ""), face, act); return sink.land(fields); },
    tombstone: (title) => { wikiWearsNext(tw5, title, face, act); return sink.tombstone(title); },
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
  readonly realm: string | null;
}

function readTarget(args: Readonly<Record<string, unknown>>, verb: string): MemeArgs {
  const container = readContainer(args, verb);
  const uri = stringArg(args, "uri");
  if (!uri) throw new Error(`${verb}: args.uri is required (the meme's root lar: URI)`);
  return { uri, ...container };
}

/**
 * A SLUG CARRIES NO MARKER (state/decisions, "Naming freedom and the `@` marker"): the kind-plane segment names the entity, so a
 * leading `@` on a bag or recipe slug reads as the slug itself (`@notes` -> `notes`), as `bag declare` reads it. A `lar:` URI
 * passes untouched; a bare `@` names nothing and reads as no slug.
 */
function unmarked(slug: string | null): string | null {
  if (slug === null || slug.startsWith("lar:")) return slug;
  return slug.replace(/^@/, "") || null;
}

/**
 * THE CONTAINER LAW, for every meme verb at this door: at most one of `args.recipe` (a wiki, read or written AS
 * that wiki) or `args.bag` (that one bag) stands, and naming neither reads the worn face's daemon wiki,
 * `recipe: "default"` (comms-ux-enacts fork 5, the default the shared `#/takes/container` row carries). Both
 * refuse as `no-container` before any cap ask, read or write.
 */
export function readContainer(args: Readonly<Record<string, unknown>>, verb: string): Omit<MemeArgs, "uri"> {
  const recipe = unmarked(optionalStringArg(args, "recipe"));
  const bag = unmarked(optionalStringArg(args, "bag"));
  const realm = optionalStringArg(args, "realm")?.trim().toLowerCase() || null;
  if (realm && recipe) throw new VerbRefusal("no-container", `no-container: ${verb} realm= names a bag's realm; it cannot accompany args.recipe.`);
  if (recipe && bag) throw new VerbRefusal("no-container", `no-container: ${verb} names both args.recipe and args.bag; name one of them, never both.`);
  if (!recipe && !bag) {
    if (realm) throw new VerbRefusal("no-container", `no-container: ${verb} realm= names a bag's realm; name args.bag beside it.`);
    return { recipe: "default", bag: null, realm: null };
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
 * THE FORK REMEMBERS ITS BASE AT A BAG'S DOOR, by the composite's own rule (`override-base.ts`,
 * `CompositeStore._withOverrideBasesNow`). A put into a wiki's WORKING layer reaches the layer's own store and never
 * `CompositeStore.put`, so the door names the base itself. A title the layer already holds live keeps the base it named (a
 * store that replaces records whole would drop it). Any other title names the carrier identity of the first record the
 * wiki's stack holds beneath the layer, live; a tombstone names none. Like the composite's fork, it asks no read cap: the
 * base names a hash on the writer's own copy, and the fresher read that weighs it reads canon with none either. An
 * instrument, never a gate: where a layer beneath stands unreached here (no mount, no reach, no floor), the walk stops and
 * the copy lands unstamped, as the composite leaves a layer it cannot read now. The walk runs at landing, past the gates.
 */
function forkBaseOf(opts: MemeVerbOptions, slug: string, workingBag: string, working: LarTiddlerStore): (title: string) => Promise<string | null> {
  let beneath: Promise<readonly string[]> | null = null;
  const stackBeneath = (): Promise<readonly string[]> => (beneath ??= (async () => {
    const rec = await opts.recipeOf?.(slug);
    const stack: readonly string[] = rec ? expandRecipe(recipeFromRecord(rec, slug)) : [];
    const at = stack.indexOf(workingBag);
    return at < 0 ? [] : stack.slice(at + 1);
  })());
  const stores = new Map<string, Promise<LarTiddlerStore | null>>();
  const storeOf = (bag: string): Promise<LarTiddlerStore | null> => {
    let hit = stores.get(bag);
    if (!hit) {
      hit = storeOfBag(opts, slug, bag, "get").catch(() => null).then((s) => s ?? floorStoreOf(opts, bag));
      stores.set(bag, hit);
    }
    return hit;
  };
  return async (title) => {
    const held = await working.get(title);
    if (held && held.meta?.deleted !== true) return overrideBaseOf(held);
    for (const bag of await stackBeneath()) {
      const store = await storeOf(bag);
      if (!store) return null;
      const lower = await store.get(title);
      if (!lower) continue;
      return lower.meta?.deleted === true ? null : carrierHashOf(lower.tiddler);
    }
    return null;
  };
}

/** The sink for one bag's own store; a put into a wiki's working layer forks its override base (`forkBaseOf`). */
function bagSink(opts: MemeVerbOptions, slug: string, bag: string, store: LarTiddlerStore, origin: ChangeOrigin, mode: "put" | "get"): MemeSink {
  return storeMemeSink(store, bag, origin, mode === "put" && isWorkingLayerBag(bag) ? forkBaseOf(opts, slug, bag, store) : undefined);
}

/**
 * Resolve a named wiki's bag + store for a READ: the whole cascade top-down, the first bag holding a record under the root,
 * live or tombstoned; when none does, the designated bag's store (the read answers null there, never a refusal for an
 * absent meme). A wiki's WRITE never comes here: it lands in the wiki's own engine through the tiddler door.
 */
async function reachRecipeBag(
  opts: MemeVerbOptions, slug: string, uri?: string,
): Promise<{ bag: string; store: LarTiddlerStore }> {
  const rec = await opts.recipeOf?.(slug);
  if (!rec) throw new Error(`meme: recipe "${slug}" not found in any registry plane — run \`lares wiki init ${slug}\` first`);
  const designated = designatedBagOf(rec, slug);
  // The first layer of the stack that reaches a store at all: where the designated bag stands unreached for this face (no seat
  // in the wiki's workbench), an absent meme still reads absent there, never a refusal.
  let reachable: { bag: string; store: LarTiddlerStore } | null = null;
  if (uri) {
    for (const bag of expandRecipe(recipeFromRecord(rec, slug))) {
      const store = await storeOfBag(opts, slug, bag, "get");
      if (!store) continue;
      reachable ??= { bag, store };
      // THE FIRST BAG THAT HOLDS A RECORD ANSWERS, A TOMBSTONE INCLUDED. A tombstone shadows every bag
      // beneath it, as the wiki's own composite reads it (`CompositeStore.get`): the read stops there and
      // that bag's store answers the meme absent. A bag that holds no record at all lets the walk go on.
      if (await store.get(uri)) return { bag, store };
    }
  }
  const store = await storeOfBag(opts, slug, designated, "get");
  if (store) return { bag: designated, store };
  if (reachable) return reachable;
  throw new Error(`meme: recipe "${slug}" designates bag "${designated}", which this island neither mounts nor reaches by access`);
}

interface Resolved {
  /** The bag the cap gate checks against. */
  readonly bag: string;
  readonly sink: MemeSink;
  /** True on the anchor — the daemon's own live wiki, where the in-VM face renders. */
  readonly anchor: boolean;
  /** True where the realm's grant answers: a named realm's counted registration, or a steward's write on the realm
   *  doc. A realm-carried bag stands in no registry of this vessel's own, so its cap reads the realm. */
  readonly realmGrant?: boolean;
}

/** The cap a resolved container answers to: the realm's grant where it reached the bag, this vessel's own otherwise. */
function capOf(realmGrant: boolean | undefined, cap: VerbContext["cap"]): VerbContext["cap"] {
  return realmGrant ? async () => ({ ok: true }) : cap;
}

/** A wiki's instance slot addressed as a bag — `lar:///ha.ka.ba/wikis/<slug>/<draft|working|personal|temp>`. */
const WIKI_SLOT_BAG_RE = /^lar:\/\/\/ha\.ka\.ba\/wikis\/([^/]+)\/(temp|draft|working|personal)$/;

/** The cascade's config tiddler naming where a `lar:` save lands in this wiki (island-adaptor reads it). */
const CURRENT_WIKI_BAG = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";

/**
 * The bag the anchor's cap gate checks: the one the in-wiki cascade routes a `lar:` title to — the same
 * bag a write through the live wiki lands in: the daemon's mounted working layer.
 */
export function anchorBagOf(opts: Pick<MemeVerbOptions, "tw5">): string {
  const wiki = opts.tw5.$tw.wiki as { getTiddlerText?: (t: string, d?: string) => string };
  const configured = wiki.getTiddlerText?.(CURRENT_WIKI_BAG, "") ?? "";
  if (!configured) throw new NoWorkingLayerRefusal("The write into the daemon's own wiki", "Wait until the daemon working layer attaches, or name another container (recipe=<slug> or bag=<slug>).");
  return configured;
}

async function resolveSink(opts: MemeVerbOptions, target: Omit<MemeArgs, "uri"> & { readonly uri?: string }, origin: ChangeOrigin, mode: "put" | "get"): Promise<Resolved> {
  if (opts.faceLane) return laneResolved(opts.faceLane, target, origin);
  if (target.bag) {
    const bag = bagUriOf(target.bag);
    if (target.realm) {
      if (WIKI_SLOT_BAG_RE.test(bag)) throw new VerbRefusal("no-container", "no-container: realm= names a bag's realm; a wiki slot lives in no realm.");
      if (mode === "put") {
        const steward = await opts.realmWritable?.(bag, target.realm);
        if (!steward) throw new Error(`meme: bag "${bag}" holds no steward's write in realm ${target.realm}`);
        return { bag, sink: storeMemeSink(steward, bag, origin), anchor: false, realmGrant: true };
      }
      const store = await opts.reach?.(bag, bag, target.realm);
      if (!store) throw new Error(`meme: bag "${bag}" holds no layer in this island and nothing reaches it by access in realm ${target.realm}`);
      return { bag, sink: storeMemeSink(store, bag, origin), anchor: false, realmGrant: true };
    }
    // A NAMED WIKI'S INSTANCE SLOT, addressed as a bag. `bag=lar:///ha.ka.ba/wikis/<slug>/working` names the
    // doc THE ONE slot-doc resolver mints — the same doc `recipe=<slug>` walks and a `LOAD to=` that bag
    // lands in. The three reaches answer it (`storeOfBag`), and `temp` refuses there: it lives in the wiki
    // island alone and no door reaches it.
    const slot = WIKI_SLOT_BAG_RE.exec(bag);
    if (slot) {
      const store = await storeOfBag(opts, slot[1]!, bag, mode);
      if (!store) throw new Error(`meme: bag "${bag}" holds no layer in this island and nothing reaches it by access`);
      return { bag, sink: bagSink(opts, slot[1]!, bag, store, origin, mode), anchor: false };
    }
    if (mode === "put") {
      // THE REALM FIRST, as the read walks it first. A bag the relation carries is ONE book: a steward's
      // placement lands on the realm doc the registration names, never in this vessel's own layer of the
      // same name (that is the two-chests drift the ruling forbids). A hand outside `keptBy` reads null
      // here and draws exactly the refusal it drew before.
      const steward = await opts.realmWritable?.(bag);
      if (steward) return { bag, sink: storeMemeSink(steward, bag, origin), anchor: false, realmGrant: true };
      return { bag, sink: compositeMemeSink(opts.composite, bag, origin), anchor: false };
    }
    const store = opts.composite.storeForBag(bag) ?? (await opts.reach?.(bag, bag)) ?? null;
    if (!store) throw new Error(`meme: bag "${bag}" holds no layer in this island and nothing reaches it by access`);
    return { bag, sink: storeMemeSink(store, bag, origin), anchor: false };
  }
  if (target.recipe && target.recipe !== "default") {
    const { bag, store } = await reachRecipeBag(opts, target.recipe, target.uri);
    return { bag, sink: storeMemeSink(store, bag, origin), anchor: false };
  }
  // The anchor: the daemon's own wiki, its cascade routing the records to the top bag.
  return { bag: anchorBagOf(opts), sink: wornWikiSink(wikiMemeSink(opts.tw5.$tw.wiki), opts.tw5, origin), anchor: true };
}

/** A house canon bag's floor snapshot, where the floor this island mounted carries one. */
function floorStoreOf(opts: MemeVerbOptions, bag: string): LarTiddlerStore | null {
  return isHouseCanonBag(bag) ? (opts.floorCanon?.(bag) ?? null) : null;
}

/**
 * THE READ GATE, for every door that reads one container. The read cap gates the bag that answers; and A HOUSE CANON READ WITH
 * NO CAP ON THE LIVE DOCUMENT READS THE FLOOR: a face outside the Kahu cabal registers no house canon bag (the live documents
 * rest in the Kahu realm), so where its cap names none, or the island reaches no live document at all, the bag's floor snapshot
 * answers, read-only and with no cap asked, since the floor's blobs rest public by CID. The answer says so (`floor: true`). A
 * house canon bag the floor carries no snapshot of (a tier under `public`) keeps its refusal, and a WRITE never comes here: it
 * asks the Kahu predicate at its own door (`requireKahuReach`).
 */
async function resolveRead(
  opts: MemeVerbOptions, target: Omit<MemeArgs, "uri"> & { readonly uri?: string }, origin: ChangeOrigin, cap: VerbContext["cap"],
): Promise<Resolved & { readonly floor?: true }> {
  const fromFloor = (bag: string): (Resolved & { readonly floor: true }) | null => {
    const store = floorStoreOf(opts, bag);
    return store ? { bag, sink: storeMemeSink(store, bag, origin), anchor: false, floor: true } : null;
  };
  let resolved: Resolved;
  if (opts.faceLane) {
    // A lane reads its own document alone: no floor snapshot stands in for it.
    resolved = laneResolved(opts.faceLane, target, origin);
    const proof = await cap("read", resolved.bag);
    if (!proof.ok) throw new Error(`cap-denied: read on ${resolved.bag} required (${proof.reason ?? "no reason"})`);
    return resolved;
  }
  try { resolved = await resolveSink(opts, target, origin, "get"); }
  catch (err) {
    // No live layer and nothing reaches the bag by access: a house canon bag named outright still reads its floor.
    const floor = target.bag && !target.realm ? fromFloor(bagUriOf(target.bag)) : null;
    if (!floor) throw err;
    return floor;
  }
  const proof = await capOf(resolved.realmGrant, cap)("read", resolved.bag);
  if (proof.ok) return resolved;
  const floor = resolved.anchor ? null : fromFloor(resolved.bag);
  if (!floor) throw new Error(`cap-denied: read on ${resolved.bag} required (${proof.reason ?? "no reason"})`);
  return floor;
}

/**
 * A TITLE THAT STAYS HOME answers no read at any door (the tiddler door's own law, `staysHome`): the temp and state namespaces,
 * the control and secret homes, `cap/**`, the volatile VM plane. The internal reads refuse it by the same name.
 */
function refuseStayHome(title: string, verb: string): void {
  if (staysHome(title)) {
    throw new VerbRefusal("tiddler-withheld", `tiddler-withheld: "${title}" stays home (a temp, state, volatile-VM, control, secret or cap/** title); ${verb} reads none of it.`);
  }
}

export function makeMemeGetReactor(opts: MemeVerbOptions): VerbReactor {
  return async (args, ctx) => {
    const target = readTarget(args, "meme-get");
    refuseStayHome(target.uri, "meme-get");
    const origin: ChangeOrigin = { kind: "lares-verb", requestId: ctx.invocation.requestId, ...wornOrigin(ctx.worn) };
    const { sink, floor } = await resolveRead(opts, target, origin, ctx.cap);
    // The read hands a person the meme's TEXT: a pointer whose body rests in the content tier refuses by name.
    if (await holdsUnreadPointer(target.uri, sink)) {
      throw new VerbRefusal(POINTER_BODY_CODE, `${POINTER_BODY_CODE}: ${target.uri} holds a pointer whose body rests in the content tier; meme-get reads no pointer body.`);
    }
    const meme = await readMeme(target.uri, sink);
    if (meme === null) return { uri: target.uri, meme: null, ...(floor ? { floor: true } : {}) };
    // ON A GRADIENT BY GRAIN (read-gradient): whole within a page, the has-stack past it, the whole paged on slot boundaries.
    const requestedSlot = optionalStringArg(args, "slot");
    const slot = requestedSlot && !requestedSlot.startsWith("#/") ? `#/${requestedSlot}` : requestedSlot;
    const read = memeGradient(meme, { grain: grainOf(args["grain"]), after: optionalStringArg(args, "after"), slot });
    return {
      uri: target.uri,
      meme: {
        ...(read.text !== undefined ? { text: read.text } : {}),
        canonicalHash: memeBase(meme.canonicalHash, read, slot), bytes: read.bytes, grain: read.grain, slots: read.slots,
        ...(read.page ? { page: read.page } : {}), next: read.next,
      },
      ...(floor ? { floor: true } : {}),
    };
  };
}

/**
 * THE ONE-BAG READ, for the doors that read a record of one bag: the one bag reach and its read gate (`resolveRead`: a mounted
 * layer, an instance slot, a registered bag by access, the floor snapshot where the face holds no read on a live house canon
 * document), handed back as the bag's sink beside the bag it answered from.
 */
export async function readBagStore(
  opts: MemeVerbOptions, bag: string, realm: string | null, origin: ChangeOrigin, cap: VerbContext["cap"],
): Promise<{ readonly bag: string; readonly sink: MemeSink; readonly floor?: true }> {
  const { bag: answered, sink, floor } = await resolveRead(opts, { recipe: null, bag, realm }, origin, cap);
  return { bag: answered, sink, ...(floor ? { floor } : {}) };
}

/**
 * THE ONE-BAG WRITE, for the doors that land or remove a record of one bag: the bag's own store by the reach every bag
 * placement walks (`resolveSink`: a lit sibling's lane, a realm steward's write, a wiki's instance slot addressed as a bag,
 * a layer the island mounts writable), then THE WRITE GATE in its one order: the Kahu predicate, then the admin cap on the
 * bag (the realm's grant where the realm reached it). A bag the island cannot write refuses by name, and nothing shadows
 * up. `layer` names the slot where the bag addresses a wiki's instance slot.
 */
export async function writeBagStore(
  opts: MemeVerbOptions, target: { readonly bag: string; readonly realm: string | null }, origin: ChangeOrigin,
  cap: VerbContext["cap"], verb: string, asker?: VerbContext["asker"],
): Promise<{ readonly bag: string; readonly sink: MemeSink; readonly layer?: WikiSlotKind }> {
  const { bag, sink, realmGrant } = await resolveSink(opts, { recipe: null, bag: target.bag, realm: target.realm }, origin, "put");
  await requireKahuReach(bag, opts.kahuReach, verb, asker);
  const proof = await capOf(realmGrant, cap)("admin", bag);
  if (!proof.ok) throw new Error(`cap-denied: admin on ${bag} required (${proof.reason ?? "no reason"})`);
  const slot = WIKI_SLOT_BAG_RE.exec(bag);
  return { bag, sink, ...(slot ? { layer: slot[2] as WikiSlotKind } : {}) };
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
type StackListing = MemeListing & { readonly bag: string; readonly floor?: true };

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
    const titles = await store.listVisible();
    const base = storeMemeSink(store, bag, origin);
    layers.push({ bag, store, sink: { titles: () => titles, read: (title) => base.read(title) } });
    // A root's title carries no `#`; a title at or before the cursor rode an earlier page.
    for (const title of titles) if (!title.includes("#") && (page.after === null || title > page.after)) candidates.add(title);
  }
  // THE READ CAP GATES THE BAG THAT ANSWERS, as the read's own gate does (`meme-get` asks for the one bag
  // its walk stopped at). A slot the wiki composes and nobody registered holds no root and answers none, so
  // it asks for no cap; a bag that answers a root the caller may not read refuses the listing by name.
  // A HOUSE CANON LAYER THE CALLER HOLDS NO READ ON ANSWERS FROM ITS FLOOR SNAPSHOT (`resolveRead`'s law, per layer): the
  // root lists under the floor's render and its row says so; a root the floor does not carry yet lists nowhere.
  const allowed = new Map<string, Pick<MemeSink, "titles" | "read"> | null>();
  const mayRead = async (bag: string): Promise<Pick<MemeSink, "titles" | "read"> | null> => {
    if (allowed.has(bag)) return allowed.get(bag)!;
    const proof = await cap("read", bag);
    const floor = proof.ok ? null : floorStoreOf(opts, bag);
    if (!proof.ok && !floor) throw new Error(`cap-denied: read on ${bag} required (${proof.reason ?? "no reason"})`);
    allowed.set(bag, floor ? storeMemeSink(floor, bag, origin) : null);
    return allowed.get(bag)!;
  };
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
    const floorSink = await mayRead(answered.bag);
    const listed = await listOneMeme(uri, floorSink ?? answered.sink, page.tree);
    if (listed) roots.push({ ...listed, bag: answered.bag, ...(floorSink ? { floor: true as const } : {}) });
  }
  return { recipe: slug, bags: layers.map((l) => l.bag), ...(unreached.length > 0 ? { unreached } : {}), roots, next };
}

export function makeMemeListReactor(opts: MemeVerbOptions): VerbReactor {
  return async (args, ctx) => {
    const target = readContainer(args, "meme-list");
    const tree = args["tree"] === true || args["tree"] === "1" || args["tree"] === "true";
    const page = { tree, after: optionalStringArg(args, "after") ?? null, limit: pageLimitOf(args["limit"]) };
    const origin: ChangeOrigin = { kind: "lares-verb", requestId: ctx.invocation.requestId, ...wornOrigin(ctx.worn) };
    if (target.recipe && target.recipe !== "default" && !opts.faceLane) {
      const answer = await listRecipeStack(opts, target.recipe, page, origin, ctx.cap);
      return { has: familyHas(target.recipe, answer, "family-list"), ...answer };
    }
    const { bag, sink, floor } = await resolveRead(opts, target, origin, ctx.cap);
    const answer = { bag, ...(floor ? { floor: true } : {}), ...(await listMemePage(sink, page)) };
    return { has: familyHas(bag, answer, "family-list"), ...answer };
  };
}

/** The targets `meme-project` renders: every projection but the carrier itself, which reads through `tiddler-get`. */
const PROJECT_VERB_TARGETS = ["md", "html", "tid", "json"] as const;

export function makeMemeProjectReactor(opts: MemeVerbOptions): VerbReactor {
  return async (args, ctx) => {
    const target = readTarget(args, "meme-project");
    refuseStayHome(target.uri, "meme-project");
    const to = stringArg(args, "to");
    if (!to) throw new Error("meme-project: args.to is required (md · html · tid · json)");
    // THE CARRIER ITSELF READS THROUGH THE ONE DOOR: `mem` left this verb's targets for `tiddler-get` with `meme: true` and
    // `grain: "whole"` (`lares get title=<uri> aperture=arc`), which pages the composed carrier on slot boundaries.
    if (!(PROJECT_VERB_TARGETS as readonly string[]).includes(to)) {
      throw new Error(`meme-project: unknown target "${to}"; it renders md · html · tid · json, and the carrier itself reads through tiddler-get (meme: true, grain: "whole")`);
    }
    const projectTarget = projectTargetOf(to);
    const dialect = optionalStringArg(args, "dialect") ?? undefined;
    const tongue = optionalStringArg(args, "tongue") ?? undefined;
    if (projectTarget !== "md" && (dialect || tongue)) {
      throw new Error(`meme-project: dialect=/tongue= weave the "md" target alone; got "${projectTarget}"`);
    }
    const origin: ChangeOrigin = { kind: "lares-verb", requestId: ctx.invocation.requestId, ...wornOrigin(ctx.worn) };
    const { bag, sink, anchor } = await resolveRead(opts, target, origin, ctx.cap);
    // A projection renders the meme's TEXT: the same pointer refusal the read gives, at every seat.
    if (await holdsUnreadPointer(target.uri, sink)) {
      throw new VerbRefusal(POINTER_BODY_CODE, `${POINTER_BODY_CODE}: ${target.uri} holds a pointer whose body rests in the content tier; meme-project renders no pointer body.`);
    }
    if (anchor) {
      const face = (opts.tw5.$tw as LaresTw5Extension).lares?.meme;
      if (!face) throw new Error("meme-project: the anchor wiki publishes no $tw.lares.meme (the meme-face startup module is absent)");
      return { ...face.project(target.uri, projectTarget, { ...(dialect ? { dialect } : {}), ...(tongue ? { tongue } : {}) }) };
    }
    if (projectTarget !== "md") {
      throw new Error(`meme-project: "${projectTarget}" renders through a wiki and projects from the anchor only; a recipe or bag target projects md`);
    }
    const meme = await readMeme(target.uri, sink);
    if (!meme) throw new Error(`meme-project: no meme stands under ${target.uri} in ${bag}`);

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
