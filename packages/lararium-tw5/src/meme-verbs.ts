/**
 * meme-verbs — `meme-put` / `meme-get` / `meme-list` / `meme-delete` / `meme-project`, the daemon
 * island's skins of the meme laws.
 *
 * The contract every skin (this, the HTTP route, the MCP tool) carries verbatim:
 *
 *   meme-put      { recipe?, bag?, uri, text, base? }   → PlaceMemeReceipt
 *   meme-get      { recipe?, bag?, uri }                → { uri, meme: { text, canonicalHash } | null }
 *   meme-patch    { recipe?, bag?, uri, slot, append | replace, base } → PlaceMemeReceipt & { slot } | { decision: absent }
 *   meme-list     { recipe?, bag?, tree?, after?, limit? } → { bag | recipe, roots: MemeListing[], next }
 *   meme-delete   { recipe?, bag?, uri, base? }         → { uri, decision: removed|absent|conflict, tombstoned, canonicalHash?, readFrom?, tombstonedIn?, unreached? }
 *   meme-project  { recipe?, bag?, uri, to, dialect?, tongue? } → { uri, to, text, contentType, meta? }
 *
 * `meme-list` answers every ROOT the seat holds with the canonical hash a writer hands back as its base,
 * a page at a time (`MEME_LIST_PAGE` roots, in title order): `next` names the cursor of the page behind,
 * a caller hands it back as `after`, and `next: null` ends the listing. A bag lists its own records; a
 * named recipe lists the roots its whole stack resolves, each row naming the bag that answered
 * (`listRecipeStack`). `tree` nests each root's slot tree. `meme-delete` removes the whole group through `removeMeme` — a
 * stale `base` answers `conflict` and moves nothing; an absent root answers `absent`. A named recipe's delete
 * reads the meme where the stack answers it and tombstones it where the tombstone shadows that bag
 * (`deleteThroughRecipe`); its receipt names the bag that answered the root (`readFrom`) and each bag a
 * tombstone landed in (`tombstonedIn`).
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

import { wearOf } from "@lararium/mesh";
import {
  AutomergeDocStore, NoWorkingLayerRefusal, VerbRefusal, floorReadFace, isHouseCanonBag, refuseRenderedWrite, admitSeatExecutable, requireKahuReach, resolveHouseCanon, bagUri, designatedBagOf, expandRecipe, recipeFromRecord, wikiSlotKindOf, wikiSlotUri,
  REALM_ID_TIDDLER, realmDocPointer, realmDocUrl, realmStewardPointer, realmStandingPointer, readRealmStanding, mayWriteRealmBag, tiddlerText,
  carrierHashOf, isWorkingLayerBag, overrideBaseOf,
  type ChangeOrigin, type CompositeStore, type KahuReachSource, type LarTiddlerRecord, type LarTiddlerStore, type WikiSlotKind,
} from "@lararium/mesh";
import { componentsBeneath } from "@lararium/mesh/family";
import { findOrThrow, makeCatalogAccessor } from "./catalog-accessor.js";
import { effectiveRecipeOf } from "./recipe-planes.js";
import type { IslandContext } from "./island-context.js";
import { familyViewOf, holdsUnreadPointer, isMemeRoot, listMemePage, listOneMeme, patchSlotCarrier, placeMeme, POINTER_BODY_CODE, readMeme, removeMeme, SLOT_MISSING_CODE, STALE_BASE_CODE, wikiMemeSink, type MemeListing, type MemeSink } from "./place-meme.js";
import { compositeMemeSink, storeMemeSink } from "./meme-sinks.js";
import { MEMETIC_SOURCE } from "./meme-ast/diagnostics.js";
import { projectCarrierText, projectTargetOf } from "./meme-project.js";
import { pinTargetsOf, profileOf } from "./weave/index.js";
import type { TW5Engine } from "./tw5-vm.js";
import { wornOrigin } from "./verb-dispatcher.js";
import { wikiWearsNext } from "./island-recipe.js";
import type { LaresTw5Extension } from "./types/lares-globals.js";
import type { VerbContext, VerbReactor } from "./verb-dispatcher.js";
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
  /**
   * THE LAYER THIS FACE'S SAVES OF A WIKI LAND IN (cabal-realm#/the-workbench): `working` where the face holds a writer's seat
   * in the wiki's workbench, `personal` where it holds none (seated `read`, or seated nowhere while another face of the vessel
   * stands the wiki), null where no layer takes a write. Absent, a put lands in the recipe's designated bag as written.
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
    throw new VerbRefusal("face-lane-holds-its-own", `face-lane-holds-its-own: a lit sibling face reaches its own lane alone (--bag ${lane.bag}); this container names another, and nothing moved.`);
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
    ...(ctx.floorCanon ? { floorCanon: (bag: string) => { const rows = ctx.floorCanon!(bag); return rows ? floorReadFace({ rows: [rows], bagId: bag }) : null; } } : {}),
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
  async function realmStanding(namedRealm?: string): Promise<{ realmId: string; bags: ReadonlyMap<string, import("@lararium/mesh").RealmBagRegistration> } | null> {
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
  if (origin.face === undefined) return sink;
  const face = origin.face;
  return {
    ...sink,
    land: (fields) => { wikiWearsNext(tw5, String((fields as { title?: unknown }).title ?? ""), face); return sink.land(fields); },
    tombstone: (title) => { wikiWearsNext(tw5, title, face); return sink.tombstone(title); },
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
 * THE CONTAINER LAW, for every meme verb at this door: a content verb names its container. Exactly one of
 * `args.recipe` (a wiki, read or written AS that wiki) or `args.bag` (that one bag) stands; neither, or
 * both, refuses as `no-container` before any cap ask, read or write. No default wiki exists: the daemon's
 * own wiki answers to its explicit name, `recipe: "default"`.
 */
export function readContainer(args: Readonly<Record<string, unknown>>, verb: string): Omit<MemeArgs, "uri"> {
  const recipe = unmarked(optionalStringArg(args, "recipe"));
  const bag = unmarked(optionalStringArg(args, "bag"));
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
 * THE FORK REMEMBERS ITS BASE AT THE MEME DOOR, by the composite's own rule (`override-base.ts`,
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
 * Resolve a named wiki's bag + store for a verb. PUT: the recipe record's designated bag, its own
 * store; where that bag names the wiki's working layer and the face holds no writer's seat in its workbench (`writeSlot`),
 * the put lands in the face's own `personal` layer of the wiki, so the save rests and the answer names the layer. GET: the whole cascade top-down, the first bag holding a record under the root, live or
 * tombstoned; when none does, the designated bag's store (the read answers null there, never a refusal
 * for an absent meme).
 */
async function reachRecipeBag(
  opts: MemeVerbOptions, slug: string, mode: "put" | "get", uri?: string,
): Promise<{ bag: string; store: LarTiddlerStore }> {
  const rec = await opts.recipeOf?.(slug);
  if (!rec) throw new Error(`meme: recipe "${slug}" not found in any registry plane — run \`lares wiki init ${slug}\` first`);
  const designated = designatedBagOf(rec, slug);
  // The first layer of the stack that reaches a store at all: where the designated bag stands unreached for this face (no seat
  // in the wiki's workbench), an absent meme still reads absent there, never a refusal.
  let reachable: { bag: string; store: LarTiddlerStore } | null = null;
  if (mode === "get" && uri) {
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
  if (mode === "put" && wikiSlotKindOf(slug, designated) === "working" && (await opts.writeSlot?.(slug)) === "personal") {
    const personal = wikiSlotUri(slug, "personal");
    const own = await storeOfBag(opts, slug, personal, "put");
    if (own) return { bag: personal, store: own };
    throw new Error(`meme: this face holds no writer's seat in the workbench of "${slug}", and its personal layer "${personal}" stands unreached`);
  }
  const store = await storeOfBag(opts, slug, designated, mode);
  if (store) return { bag: designated, store };
  if (mode === "get" && reachable) return reachable;
  throw new Error(`meme: recipe "${slug}" designates bag "${designated}", which this island neither mounts${mode === "put" ? " writable" : ""} nor reaches by access`);
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
 * bag the placement will land in through `wikiMemeSink`: the daemon's mounted working layer.
 */
export function anchorBagOf(opts: Pick<MemeVerbOptions, "tw5">): string {
  const wiki = opts.tw5.$tw.wiki as { getTiddlerText?: (t: string, d?: string) => string };
  const configured = wiki.getTiddlerText?.(CURRENT_WIKI_BAG, "") ?? "";
  if (!configured) throw new NoWorkingLayerRefusal("The meme write into the daemon's own wiki", "Wait until the daemon working layer attaches, or name another container (--recipe <slug> or --bag <slug>).");
  return configured;
}

async function resolveSink(opts: MemeVerbOptions, target: Omit<MemeArgs, "uri"> & { readonly uri?: string }, origin: ChangeOrigin, mode: "put" | "get"): Promise<Resolved> {
  if (opts.faceLane) return laneResolved(opts.faceLane, target, origin);
  if (target.bag) {
    const bag = bagUriOf(target.bag);
    if (target.realm) {
      if (WIKI_SLOT_BAG_RE.test(bag)) throw new VerbRefusal("no-container", `no-container: ${mode === "put" ? "meme-put" : "meme-get"} --realm names a bag's realm; a wiki slot lives in no realm.`);
      if (mode === "put") {
        const steward = await opts.realmWritable?.(bag, target.realm);
        if (!steward) throw new Error(`meme: bag "${bag}" holds no steward's write in realm ${target.realm}`);
        return { bag, sink: storeMemeSink(steward, bag, origin), anchor: false, realmGrant: true };
      }
      const store = await opts.reach?.(bag, bag, target.realm);
      if (!store) throw new Error(`meme: bag "${bag}" holds no layer in this island and nothing reaches it by access in realm ${target.realm}`);
      return { bag, sink: storeMemeSink(store, bag, origin), anchor: false, realmGrant: true };
    }
    // A NAMED WIKI'S INSTANCE SLOT, addressed as a bag. `--bag lar:///ha.ka.ba/wikis/<slug>/working` names the
    // doc THE ONE slot-doc resolver mints — the same doc `--recipe <slug>` walks and a `LOAD --to` that bag
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
    const { bag, store } = await reachRecipeBag(opts, target.recipe, mode, target.uri);
    return { bag, sink: bagSink(opts, target.recipe, bag, store, origin, mode), anchor: false };
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

export function makeMemePutReactor(opts: MemeVerbOptions): VerbReactor {
  return async (args, ctx) => {
    const target = readTarget(args, "meme-put");
    const text = stringArg(args, "text");
    if (!text) throw new Error("meme-put: args.text is required (the whole meme, framed)");
    const base = optionalStringArg(args, "base");
    const origin: ChangeOrigin = { kind: "lares-verb", requestId: ctx.invocation.requestId, ...wornOrigin(ctx.worn) };
    const { bag, sink, realmGrant } = await resolveSink(opts, target, origin, "put");
    await requireKahuReach(bag, opts.kahuReach, "meme put", ctx.asker);
    const proof = await capOf(realmGrant, ctx.cap)("admin", bag);
    if (!proof.ok) throw new Error(`cap-denied: admin on ${bag} required (${proof.reason ?? "no reason"})`);
    // THE BASE A WIKI'S WRITER READ MAY REST BELOW THE LAYER IT WRITES. `--recipe <slug>` reads through the wiki's stack and
    // writes its designated layer; where that layer holds no record of the title, the hash the writer named came from a
    // layer beneath (a house canon page off the floor, a library's). The gate compares like with like: the base stands
    // where the stack still answers that hash, and the put lands as a copy-up; where the stack answers another, the put
    // stands off and the receipt names the hash the wiki answers now.
    let baseHash = base;
    let shown: string | null = null;
    if (base && target.recipe && !opts.faceLane && (await sink.read(target.uri)) === undefined) {
      const below = await resolveRead(opts, target, origin, ctx.cap).catch(() => null);
      if (below && below.bag !== bag) {
        const standing = (await readMeme(target.uri, below.sink))?.canonicalHash ?? null;
        if (standing === base) baseHash = null;
        else shown = standing;
      }
    }
    // THE ONE WALL A SEAT KEEPS: a seat's executable record offers, whatever bag it names, or lands spending one return of a
    // standing exec lei for the wiki the put names. And ONLY THE RENDERER WRITES A RENDERED TIDDLER: a put over one, or a record
    // that would land carrying `rendered-from`, refuses.
    const standingRoot = await sink.read(target.uri);
    refuseRenderedWrite(target.uri, standingRoot, null, "meme put");
    const wiki = target.recipe ?? (typeof args["bag"] === "string" ? args["bag"] : bag);
    const vet = async (records: readonly Record<string, unknown>[]): Promise<void> => {
      for (const record of records) {
        const title = String(record["title"] ?? target.uri);
        refuseRenderedWrite(title, null, record, "meme put");
        await admitSeatExecutable(title, record, "meme put", ctx.asker, { wiki, port: ctx.execLei });
      }
    };
    const receipt = await placeMeme({ uri: target.uri, text, baseHash, vet }, sink);
    // THE ANSWER NAMES THE LAYER: the bag the put landed in, and for a named wiki the slot of it (`working`, or `personal`
    // where the face holds no writer's seat in the wiki's workbench).
    const layer = target.recipe && target.recipe !== "default" ? wikiSlotKindOf(target.recipe, bag) : null;
    const landedIn = { bag, ...(layer ? { layer } : {}) };
    return shown !== null && receipt.decision === "conflict" ? { ...receipt, ...landedIn, canonicalHash: shown } : { ...receipt, ...landedIn };
  };
}

export function makeMemeGetReactor(opts: MemeVerbOptions): VerbReactor {
  return async (args, ctx) => {
    const target = readTarget(args, "meme-get");
    const origin: ChangeOrigin = { kind: "lares-verb", requestId: ctx.invocation.requestId, ...wornOrigin(ctx.worn) };
    const { sink, floor } = await resolveRead(opts, target, origin, ctx.cap);
    // The read hands a person the meme's TEXT: a pointer whose body rests in the content tier refuses by name.
    if (await holdsUnreadPointer(target.uri, sink)) {
      throw new VerbRefusal(POINTER_BODY_CODE, `${POINTER_BODY_CODE}: ${target.uri} holds a pointer whose body rests in the content tier; meme-get reads no pointer body.`);
    }
    return { uri: target.uri, meme: await readMeme(target.uri, sink), ...(floor ? { floor: true } : {}) };
  };
}

/**
 * `meme-patch` — ONE SLOT'S BODY, THROUGH THE PUT'S OWN GATE. The read walks what `meme-get` walks (the same container, the
 * same read gate); `patchSlotCarrier` edits the slot's record in a copy of the family and recomposes the carrier, which mints
 * the block check; the put reactor lands that text under the writer's base, so the patch passes every law a put passes: the
 * Confluence gate, the Kahu predicate, the admin cap, a recipe's copy-up, the layer the answer names. A base is required (a
 * blind patch would land over bytes the writer never read); a stale one refuses `stale-base` and names the live hash; a slot
 * the meme does not hold refuses `slot-missing`. Its answer is the put's receipt with the slot named beside it.
 */
export function makeMemePatchReactor(opts: MemeVerbOptions): VerbReactor {
  const put = makeMemePutReactor(opts);
  return async (args, ctx) => {
    const target = readTarget(args, "meme-patch");
    const slot = stringArg(args, "slot").trim();
    if (!slot) throw new Error("meme-patch: args.slot is required (`#/name`, the slot whose body moves)");
    if (!/^#\/[^$\s]/.test(slot)) throw new VerbRefusal("patch-malformed", `patch-malformed: args.slot reads \`#/name\`, a slot under the root; got "${slot}".`);
    const append = typeof args["append"] === "string" ? args["append"] : null;
    const replace = typeof args["replace"] === "string" ? args["replace"] : null;
    if ((append === null) === (replace === null)) throw new VerbRefusal("patch-malformed", "patch-malformed: meme-patch names exactly one of args.append (a paragraph at the end of the slot's body) or args.replace (the slot's whole body).");
    const base = optionalStringArg(args, "base");
    if (!base) throw new VerbRefusal("base-required", `base-required: meme-patch edits bytes the writer read; pass args.base, the canonical hash \`meme get\` answers for ${target.uri}.`);
    const origin: ChangeOrigin = { kind: "lares-verb", requestId: ctx.invocation.requestId, ...wornOrigin(ctx.worn) };
    const { sink } = await resolveRead(opts, target, origin, ctx.cap);
    if (await holdsUnreadPointer(target.uri, sink)) {
      throw new VerbRefusal(POINTER_BODY_CODE, `${POINTER_BODY_CODE}: ${target.uri} holds a pointer whose body rests in the content tier; meme-patch reads no pointer body.`);
    }
    const read = await patchSlotCarrier({ uri: target.uri, slot, mode: append !== null ? "append" : "replace", text: append ?? replace!, baseHash: base }, sink);
    const none = { uri: target.uri, slot, landed: [], tombstoned: [], diagnostics: [] };
    if (read.kind === "absent") return { ...none, decision: "absent", warnings: [] };
    if (read.kind === "stale") {
      return { ...none, decision: "conflict", grade: "clean", reason: STALE_BASE_CODE, canonicalHash: read.canonicalHash,
        warnings: [`${STALE_BASE_CODE}: ${target.uri} moved past ${base}; it reads ${read.canonicalHash} now. Read it again (\`meme get\`) and patch against that base.`] };
    }
    if (read.kind === "slot-missing") {
      const message = `${SLOT_MISSING_CODE}: ${target.uri} holds no slot ${slot}; \`meme list --tree\` names the slots it holds.`;
      return { ...none, decision: "refuse", grade: "error", canonicalHash: read.canonicalHash, warnings: [message],
        diagnostics: [{ from: 0, to: 0, severity: "error", source: MEMETIC_SOURCE, code: SLOT_MISSING_CODE, message }] };
    }
    const container: Record<string, string> = {};
    for (const key of ["recipe", "bag", "realm"]) if (typeof args[key] === "string") container[key] = args[key] as string;
    return { ...(await put({ ...container, uri: target.uri, text: read.text, base }, ctx)), slot };
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
    if (target.recipe && target.recipe !== "default" && !opts.faceLane) return listRecipeStack(opts, target.recipe, page, origin, ctx.cap);
    const { bag, sink, floor } = await resolveRead(opts, target, origin, ctx.cap);
    return { bag, ...(floor ? { floor: true } : {}), ...(await listMemePage(sink, page)) };
  };
}

/**
 * A NAMED WIKI'S DELETE READS THE STACK, AS ITS READ DOES, AND LANDS EACH TOMBSTONE WHERE IT SHADOWS. The meme
 * reads from the first bag of the wiki's cascade that holds a record under its root (`reachRecipeBag`, mode
 * `get`), so the base a writer read through `get --recipe` names the same render here, and a base that moved
 * answers `conflict` with nothing tombstoned. Then every live title of the group the wiki reads (the root,
 * its `#slot` fragments, its `/path` children, in whichever bag of the stack answers each one) gets a
 * tombstone where it hides that bag's record from the wiki: in the designated bag where the record stands
 * beneath it (the wiki's own delete of a canon carrier lands exactly there), and in the record's own bag where
 * that bag stands above the designated one (an instance slot over the working layer). A meme no bag holds,
 * or one a tombstone already shadows, answers `absent`.
 *
 * A designated bag outside the wiki's own stack shadows nothing the wiki reads, so the delete refuses by name
 * (`recipe-unshadowed`). The caps ride the order the read and the put keep: the read cap on the bag that
 * answered the root, then the admin cap on each bag a tombstone lands in, before any store of those bags
 * gets reached to write. A bag of the stack the island cannot reach shows no titles; the receipt names it
 * (`unreached`), as the listing does, since a child that bag holds stays unseen by this delete. Where such a
 * bag stands above the one that answered the root, the meme may still read through it: the decision reads
 * `unconfirmed`. A tombstone write that throws leaves the rest to land and reads `partial`, naming each `failed`.
 * The read cap gates every bag that answers a title of the group, since the receipt names those titles.
 */
async function deleteThroughRecipe(
  opts: MemeVerbOptions, slug: string, uri: string, base: string | null | undefined, origin: ChangeOrigin,
  cap: Parameters<VerbReactor>[1]["cap"], asker?: Parameters<VerbReactor>[1]["asker"],
): Promise<Record<string, unknown>> {
  const rec = await opts.recipeOf?.(slug);
  if (!rec) throw new Error(`meme: recipe "${slug}" not found in any registry plane — run \`lares wiki init ${slug}\` first`);
  const designated = designatedBagOf(rec, slug);
  const stack = expandRecipe(recipeFromRecord(rec, slug));
  if (!stack.includes(designated)) {
    throw new VerbRefusal("recipe-unshadowed", `recipe-unshadowed: recipe "${slug}" designates bag "${designated}", which its own stack never reads; a tombstone there shadows nothing the wiki reads, so meme-delete removes nothing.`);
  }
  await requireKahuReach(designated, opts.kahuReach, "meme delete", asker);
  const answered = await reachRecipeBag(opts, slug, "get", uri);
  const readProof = await cap("read", answered.bag);
  if (!readProof.ok) throw new Error(`cap-denied: read on ${answered.bag} required (${readProof.reason ?? "no reason"})`);
  const meme = await readMeme(uri, storeMemeSink(answered.store, answered.bag, origin));
  if (meme === null) return { uri, decision: "absent", tombstoned: [], readFrom: answered.bag };
  if (base && base !== meme.canonicalHash) return { uri, decision: "conflict", tombstoned: [], canonicalHash: meme.canonicalHash, readFrom: answered.bag };

  // Every live title of the group, as the wiki reads it: the first bag of the stack that holds a record under
  // the title answers it, and a tombstone there shadows every bag beneath.
  const layers: Array<{ bag: string; store: LarTiddlerStore }> = [];
  const unreached: string[] = [];
  for (const bag of stack) {
    const store = await storeOfBag(opts, slug, bag, "get");
    // As the listing reads it: an instance slot with no store holds no record yet, and `temp` lives in the
    // wiki island alone; any other bag with no store stands unreached, by name.
    if (store) layers.push({ bag, store }); else if (!wikiSlotKindOf(slug, bag)) unreached.push(bag);
  }
  // THE FAMILY, BY THE ONE LAW, over the stack as the wiki composes it: the root and its component slots. A
  // `uri/path` title stands as its own meme and stays.
  const candidates = new Set<string>();
  for (const layer of layers) for (const t of await layer.store.listVisible()) if (t === uri || t.startsWith(`${uri}#`)) candidates.add(t);
  const composed = new Map<string, TiddlerFields>();
  for (const title of candidates) {
    for (const layer of layers) {
      const record = await layer.store.get(title);
      if (!record) continue;
      if (!record.meta?.deleted) composed.set(title, record.tiddler as unknown as TiddlerFields);
      break;
    }
  }
  const titles = new Set<string>(componentsBeneath(familyViewOf(() => candidates, (t) => composed.get(t)), uri));
  const shadowAt = new Map<string, string>();
  const answeredIn = new Set<string>();
  for (const title of titles) {
    for (const layer of layers) {
      const record = await layer.store.get(title);
      if (!record) continue;
      if (!record.meta?.deleted) {
        shadowAt.set(title, stack.indexOf(layer.bag) < stack.indexOf(designated) ? layer.bag : designated);
        answeredIn.add(layer.bag);
      }
      break;
    }
  }
  // THE READ CAP GATES EVERY BAG THAT ANSWERS A TITLE, before the receipt names one: a child a lower bag holds
  // reaches the caller's answer by name, so a bag the caller may not read refuses the delete before any write.
  for (const bag of answeredIn) {
    if (bag === answered.bag) continue;
    const proof = await cap("read", bag);
    if (!proof.ok) throw new Error(`cap-denied: read on ${bag} required (${proof.reason ?? "no reason"})`);
  }
  const writeBags = [...new Set(shadowAt.values())];
  for (const bag of writeBags) {
    const proof = await cap("admin", bag);
    if (!proof.ok) throw new Error(`cap-denied: admin on ${bag} required (${proof.reason ?? "no reason"})`);
  }
  const writers = new Map<string, LarTiddlerStore>();
  for (const bag of writeBags) {
    const store = await storeOfBag(opts, slug, bag, "put");
    if (!store) throw new Error(`meme: recipe "${slug}" tombstones ${uri} in bag "${bag}", which this island neither mounts writable nor reaches by access`);
    writers.set(bag, store);
  }
  // EACH TOMBSTONE LANDS OR NAMES WHY: a write that throws stops none of the others, and the receipt names both
  // halves (`partial`), so a caller never reads a delete that half-landed as one that did not move.
  // ONE CHANGE PER BAG: the members a bag takes leave together where its document writes atomically. Cross-bag
  // atomicity cannot exist, so a family split across layers lands as ordered writes, each named.
  const tombstoned: string[] = [];
  const failed: Array<{ title: string; bag: string; why: string }> = [];
  const perBag = new Map<string, string[]>();
  for (const [title, bag] of shadowAt) perBag.set(bag, [...(perBag.get(bag) ?? []), title]);
  for (const [bag, members] of perBag) {
    const writer = writers.get(bag)!;
    if (typeof writer.writeFamily === "function") {
      try { await writer.writeFamily([], members, origin, { bag }); tombstoned.push(...members); }
      catch (err) { for (const title of members) failed.push({ title, bag, why: err instanceof Error ? err.message : String(err) }); }
      continue;
    }
    for (const title of members) {
      try { await writer.tombstone(title, origin); tombstoned.push(title); }
      catch (err) { failed.push({ title, bag, why: err instanceof Error ? err.message : String(err) }); }
    }
  }
  // A BAG THE ISLAND CANNOT REACH, ABOVE THE ONE THAT ANSWERED, may still hold the meme the wiki reads: the
  // delete names that `unconfirmed`, never `removed`.
  const unreachedAbove = unreached.filter((bag) => stack.indexOf(bag) < stack.indexOf(answered.bag));
  const decision = failed.length > 0 ? "partial" : unreachedAbove.length > 0 ? "unconfirmed" : "removed";
  return {
    uri, decision, tombstoned, ...(failed.length > 0 ? { failed } : {}), canonicalHash: meme.canonicalHash, readFrom: answered.bag,
    tombstonedIn: writeBags, ...(unreached.length > 0 ? { unreached } : {}), ...(unreachedAbove.length > 0 ? { unreachedAbove } : {}),
  };
}

export function makeMemeDeleteReactor(opts: MemeVerbOptions): VerbReactor {
  return async (args, ctx) => {
    const target = readTarget(args, "meme-delete");
    const base = optionalStringArg(args, "base");
    const origin: ChangeOrigin = { kind: "lares-verb", requestId: ctx.invocation.requestId, ...wornOrigin(ctx.worn) };
    if (target.recipe && target.recipe !== "default" && !opts.faceLane) return deleteThroughRecipe(opts, target.recipe, target.uri, base, origin, ctx.cap, ctx.asker);
    const { bag, sink, realmGrant } = await resolveSink(opts, target, origin, "put");
    await requireKahuReach(bag, opts.kahuReach, "meme delete", ctx.asker);
    const proof = await capOf(realmGrant, ctx.cap)("admin", bag);
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
