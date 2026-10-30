/**
 * action-handler — Residency Model ACTION verb handler family.
 *
 * Dispatches the ACTION verbs (ADD / COPY / MOVE / CLEAR / DROP / LOAD / INGEST / CREATE)
 * against a CompositeStore, wrapped in `withEffectRecord` so every bag
 * mutation lands together with its archival audit tiddler. The verb-tiddler
 * dispatch pipeline routes operator-submitted verb-tiddlers through a
 * VerbTable; this module fills the table with the residency-action handlers.
 *
 * Per-verb mechanics:
 *
 *   ADD     read fromBag's record for title; write into toBag preserving change-id;
 *           fromBag retains its copy.
 *   COPY    read fromBag's record; overwrite toBag's version preserving change-id.
 *   MOVE    ADD into toBag + tombstone the title in fromBag (transfer pair audited
 *           by withEffectRecord via the paired accession+deaccession effects).
 *   CLEAR   enumerate live titles in bag, tombstone each. Effect-log entries
 *           themselves stay intact (the bag's history must persist).
 *   DROP    tombstone every live title in bag (same enumeration as CLEAR) + the
 *           bag-level disposition record marks the bag removed. True bag-removal
 *           from the recipe is a separate operator gesture (recipe edit).
 *   LOAD    land operator-supplied carriers into toBag. The island never fetches:
 *           the operator gesture sends the content with the verb, each carrier
 *           decomposes through `opts.tw5` by its TW5 filetype, and a verb that
 *           carries no carriers refuses loudly.
 *   INGEST  disk -> records through the ingest gate, replace-by-group apply.
 *   CREATE  mint a bag's doc, register its cap, then designate it in the plane registry.
 *
 * Cap-verify discipline:
 *   - destination-bag admin required for every verb
 *   - MOVE additionally requires source-bag admin (deaccession authority)
 *
 * Meme:    lar:///ha.ka.ba/lararium/api/residency-model
 */

import type {
  CompositeStore,
  LarTiddlerRecord,
  LarTiddlerStore,
  ChangeOrigin,
  Verb,
  Repo,
  ResidencyAction, AddAction, CopyAction, MoveAction, ClearAction, DropAction, LoadAction, IngestAction, CreateAction,
  WikiSlotKind,
} from "@lararium/mesh";
import { canonicalJson, isSystemCanonBag, plainRecordOrNull, requireKahuReach } from "@lararium/mesh";
import type { KahuReachSource } from "@lararium/mesh";
import {
  ACTION_VERBS, type ActionVerb, AutomergeDocStore,
  parseResidencyAction, withEffectRecord, sha256HexBytesSync, carrierHash, digestsEqual,
  emptyLarDoc, storedLarRecord, CATALOG_DOC_URI, ORACLE_DOC_URI,
  ORIGINAL_TIDDLER_PATHS, parseProvenance, serializeProvenance, recordPack, membersOfPack,
  ORIGINAL_TIDDLER_HASHES, parseHashes, serializeHashes, recordPackHashes, hashOfMember,
  skinnyHandleTiddler, isOversizedBody, ridesAsPointer,
  crossingDirection, type CapTier,
  isEffectRecordUri, effectRecordUri, RETIRED_EVENT_ID, isRetirementMarker, storeIsRetired,
  writesBag, VerbRefusal,
  neverProjects, NeverProjectedPathRefusal,
  yieldToHost,
} from "@lararium/mesh";
import type { HostTaskYield } from "@lararium/mesh";
import type { VerbReactor, VerbTable } from "./verb-dispatcher.js";
import type { TW5Instance } from "./types/tiddlywiki.js";
import { findOrThrow, makeCatalogAccessor } from "./catalog-accessor.js";
import { memeticWikitextDeserializer, QUOTEBLOCKED_FIELD, TORN_FIELD } from "./deserializer.js";
import type { TiddlerFields } from "./deserializer.js";
import { frameAlt, maskedExec } from "@lararium/memetic-frame";
import { isCarrierType } from "@lararium/mesh/carrier-type";
import { SESSION_FORM_TITLE_CODE, assertStorableTitle, storableTitleFault } from "@lararium/mesh/lar-uris";
import { makeTw5FileInfo } from "./tw5-file-info.js";
import { conflictWhy, decideIngest } from "./ingest-gate.js";
import { placeMeme } from "./place-meme.js";
import type { MemeSink } from "./place-meme.js";
import type { IngestOps } from "./ingest-gate.js";
import { pairRenames } from "./delete-gate.js";


/**
 * The render-leg digest the Confluence gate keys on — a native record's canonical
 * carrier text hashed and ALGORITHM-TAGGED (`sha256:hex`), so it sits in the SAME
 * digest-space as `carrierHash` (the disk `diskHash` + the projector's synced-tree
 * `obsHash`). The gate's candidate-render leg (`hash`) and its current-render leg
 * (`currentRenderHash`) both ride this producer, so the intra-gate `candidateHash
 * === currentRenderHash` stays tag-consistent, and the gate's echo checks against the
 * STORED `syncedHash` compare through `digestsEqual`.
 */
const renderHash = (text: string): string => carrierHash(text);

// ── Options + registration ─────────────────────────────────────────────────

/**
 * Native-filetype deserialization, injected from the island's live `$tw`. LOAD
 * routes a non-memetic carrier through TW5's OWN deserializer registry by
 * content-type — so an engine bump or a hand-rolled deserializer just works, no
 * hardcoded filetype list. Absent → LOAD treats every carrier as memetic
 * (for hosts without a booted $tw, e.g. unit fakes).
 */
export interface Tw5Deserializer {
  /** Run TW5's registered deserializer over `text`. `typeOrExt` may be a content-type
   *  ("application/json") OR a file extension (".tid") — TW5 resolves an extension
   *  through its own fileExtensionInfo → contentTypeInfo chain, falling back to
   *  text/plain. Passing the raw extension defers wholly to TW5's registry. */
  deserialize(typeOrExt: string, text: string, baseFields: Record<string, unknown>): Array<Record<string, unknown>>;
  /** Parse a raw `.meta` sidecar into a fields object using TW5's OWN field
   *  parser — the reciprocal of the projection sidecar. The parsed fields seed
   *  the deserialize so a content carrier keeps its type/tags/custom fields
   *  across a body-only edit. */
  parseFields(metaText: string): Record<string, unknown>;
  /** Render a native record to its carrier BODY + `.meta` sidecar (the file-info
   *  the projector + the ingest echo gate share). The INGEST gate reads this join as
   *  the native congruence's `render` — its tagged digest equals `carrierHash(body, meta)` — so
   *  a native filetype runs the SAME `decideIngest` Confluence gate a memetic carrier does
   *  (echo · canonical-equivalent · conflict · ingest), never a silent last-write-wins
   *  overwrite. Native declares ∅ structure and never grades error, so the gate's
   *  ahu-fidelity + refuse legs ride dormant for it — one shape, two families. The `.meta`
   *  folds into the hash, so a FIELD-only edit surfaces too. */
  renderCarrier(uri: string, fields: Record<string, unknown>): { body: string; metaBody?: string };
  /** Re-serialize a set of member records back into ONE multi-tiddler file (the
   *  REPACK reciprocal of a bundle deserialize), via TW5's own field serializer.
   *  `.json` emits the tiddler-array form (byte-shaped like TW5's getTiddlersAsJson);
   *  an unsupported filetype throws. The members ride byte-clean (no injected fields). */
  serializeBundle(records: ReadonlyArray<Record<string, unknown>>, ext: string): string;
  /** Resolve a file extension (".png") to its TW5-NATIVE media-type via `$tw`'s own
   *  `fileExtensionInfo` registry — the same chain `deserialize` defers to. A skinny handle
   *  stamps the result in its `type` field so a rehydrated body renders native (the operator
   *  correction: TW5's `type`, never a `_lar_type` shadow). Undefined for an unknown extension. */
  contentTypeFromExt(ext: string): string | undefined;
}

/**
 * The standard `Tw5Deserializer`, closing over an island's live engine. Both the
 * wiki island and the daemon island wire LOAD's native-filetype path through this —
 * one source of truth, deferring wholly to TW5's own deserializer registry. The
 * `$tw` is read lazily (at action time, post-boot).
 */
export function makeTw5Deserializer(engine: { readonly $tw: TW5Instance }): Tw5Deserializer {
  return {
    deserialize: (typeOrExt, text, fields) =>
      (engine.$tw.wiki.deserializeTiddlers(typeOrExt, text, fields) ?? []) as Array<Record<string, unknown>>,
    parseFields: (metaText) => {
      const utils = engine.$tw.utils as { parseFields?: (t: string, f?: Record<string, unknown>) => Record<string, unknown> };
      return typeof utils.parseFields === "function" ? (utils.parseFields(metaText) ?? {}) : {};
    },
    renderCarrier: (uri, fields) => {
      const info = makeTw5FileInfo(engine.$tw, uri, fields);
      return { body: info.body, ...(info.hasMetaFile && info.metaBody !== undefined ? { metaBody: info.metaBody } : {}) };
    },
    serializeBundle: (records, ext) => {
      const $tw = engine.$tw as unknown as { Tiddler: new (f: Record<string, unknown>) => { getFieldStrings(o?: { exclude?: string[] }): Record<string, string> }; config: { preferences?: { jsonSpaces?: number } } };
      // Every member as its properly-formatted field STRINGS (tags in TW5's
      // `[[a]] [[b]]` form, dates as strings), the runtime `bag` stamp excluded —
      // the members re-emit byte-clean for an upstream PR diff.
      const strung = records.map((f) => new $tw.Tiddler(f).getFieldStrings({ exclude: ["bag"] }));
      if (ext === ".json") {
        // application/json — the tiddler-array form (byte-shaped like getTiddlersAsJson).
        return JSON.stringify(strung, null, $tw.config.preferences?.jsonSpaces ?? 4);
      }
      if (ext === ".multids") {
        // application/x-tiddlers — a shared-fields block, a blank line, then
        // `title: text` lines (boot.js:1706). Faithful ONLY when every member's
        // non-title/text fields are SHARED (same value across all) and its text is
        // single-line; a member that breaks that can't ride .multids and surfaces
        // loudly (never a silent lossy write — repack it as .json).
        const fieldNames = new Set<string>();
        for (const t of strung) for (const k of Object.keys(t)) if (k !== "title" && k !== "text") fieldNames.add(k);
        const shared: Record<string, string> = {};
        for (const name of fieldNames) {
          const vals = strung.map((t) => t[name]);
          if (vals.every((v) => v !== undefined && v === vals[0])) {
            if (vals[0]!.includes("\n")) throw new Error(`REPACK .multids: shared field "${name}" has a multi-line value — .multids holds single-line values only; repack as .json`);
            shared[name] = vals[0]!;
          }
        }
        for (const t of strung) {
          for (const k of Object.keys(t)) {
            if (k === "title" || k === "text") continue;
            if (!(k in shared)) throw new Error(`REPACK .multids: member "${t["title"]}" carries a per-member field "${k}" that .multids cannot hold — repack as .json`);
          }
          if ((t["text"] ?? "").includes("\n")) throw new Error(`REPACK .multids: member "${t["title"]}" has multi-line text — .multids holds single-line values only; repack as .json`);
        }
        const sharedBlock = Object.keys(shared).sort().map((k) => `${k}: ${shared[k]}`).join("\n");
        const memberLines = strung.map((t) => `${t["title"]}: ${t["text"] ?? ""}`).join("\n");
        return `${sharedBlock}\n\n${memberLines}`;
      }
      throw new Error(`REPACK: no serializer for "${ext}" — native bundle types are .json and .multids`);
    },
    contentTypeFromExt: (ext) => {
      if (!ext) return undefined;
      const cfg = engine.$tw.config as unknown as { fileExtensionInfo?: Record<string, { type?: string }> };
      const info = cfg.fileExtensionInfo?.[ext.charAt(0) === "." ? ext : "." + ext];
      return info?.type;
    },
  };
}

/**
 * How many records a LOAD slice gathers before it closes at the next carrier boundary. A slice lands as
 * ONE store change and LOAD hands the thread back to the host between slices. A count, never a duration:
 * it bounds how long a vessel message or an operator's invocation waits behind a bulk LOAD to one slice
 * of landings, whatever one landing costs.
 */
export const LOAD_YIELD_QUANTUM = 25;

export interface ActionHandlerOptions {
  readonly composite: CompositeStore;
  /** The host-task yield a LOAD takes between landing slices; `yieldToHost` when absent. */
  readonly yieldHostTask?: HostTaskYield;
  /** Native TW5 filetype deserialization (LOAD), closing over the island's $tw. */
  readonly tw5?: Tw5Deserializer;
  /**
   * Registry reach for **access-based** writes (the edit/action split,
   * `wiki-layer-ontology#write-law`): a residency action whose
   * target/source bag is not a mounted layer resolves it by ACCESS across both
   * oracle planes — mounted ephemerally for the action, released after. The
   * daemon holds no standing system-bag mount: deep-bag writes stay
   * explicit, audited, access-scoped events, never a floor re-seated. Absent =
   * composite-only (the wiki island, which holds its own write layer).
   */
  readonly reach?: {
    repo: Repo; catalogUrl: string | null; oracleUrl: string | null;
    /** A registered wiki's INSTANCE slot doc (draft · working · personal) by THE ONE slot-doc
     *  resolver — the door a promotion MOVE out of `wikis/<slug>/working` rides. Absent = the
     *  registry planes alone. */
    slotDocUrl?: (slug: string, kind: WikiSlotKind, opts: { mint: boolean }) => Promise<string | null>;
    /** A system canon bag's LIVE document, which rests in the Kahu realm (no registry plane names it). Reading it asks
     *  nothing; every write already cleared `requireKahuReach` before access resolves. */
    systemCanonUrl?: (bag: string) => Promise<string | null>;
  };
  /**
   * Register a freshly-minted bag's Keyhive Document + delegate admin to the
   * operator — called by CREATE in the SAME act as the mint, so a new bag is
   * born WITH its cap (designation + authority together, never split). Opaque:
   * the keyhive-holding daemon supplies it; tw5 stays keyhive-free. Absent (a
   * no-reach wiki island, tests) → the mint writes the catalog entry alone.
   * The arg is the lar: BAG URL (the cap-gate's verify key), never the doc url.
   */
  readonly registerBag?: (bagUrl: string) => Promise<void>;
  /**
   * Resolve a bag URL to its cap-tier — the declared manifest tier already met against the
   * structural floor (`bagManifestFromMeta` parses `cap-tier`; `resolveTier` does the meet) — or
   * null where the bag declares nothing. Fail-closed at the gate: an absent reader and a null
   * answer both read VEIL, and veil meets veil as LATERAL, so an unthreaded vessel prices every
   * transfer at read on the source. The crossing gate is the only consumer.
   */
  readonly bagTier?: (bagUrl: string) => CapTier | null;
  /**
   * Resolve a carrier body by content-address (hex sha256) from the corpus CAS —
   * the fs-less worker's shore onto the process-shared byte plane. A verb NEVER
   * inlines a body: LOAD/INGEST carriers ride a `textCid`, and the handler resolves
   * it HERE, re-verifying `cid == hash(bytes)` (content-addressed trust, not host
   * trust — sovereignty-safe). Exposed from the kernel's `resolveByCid` host callback
   * via IslandContext. Absent (a no-CAS island / tests) → only inline-`text` carriers
   * land; a `textCid` carrier faults loud.
   */
  readonly resolveByCid?: (cid: string) => Promise<Uint8Array | null>;
  /**
   * The vessel's source of the facts the Kahu predicate reads (`kahuCabalCanonAccess`). Every verb that lands a
   * byte in a system canon bag asks it BEFORE any other check, a MOVE out of canon included (it tombstones the
   * source). Absent → a stranger: a system bag refuses (fail closed). A copy OUT of canon asks nothing.
   */
  readonly kahuReach?: KahuReachSource;
  /**
   * True where the keyholder island's verify-then-delegate gate has ALREADY asked the Kahu predicate for every system
   * bag this verb names (`wiki-act` into a wiki island: `routedInnerBags`). The wiki island holds no board and no
   * sentinel, so it trusts that gate and asks nothing; any other composition leaves this unset and asks itself.
   */
  readonly kahuReachClearedAtGate?: boolean;
}

/**
 * Read/write access to a bag's OWN store, resolved per action — never a mount.
 *
 * The reach path (the `daemon` wiki VM) reaches a deep bag's doc by ACCESS across
 * the two registry planes (system → `oracle`, user → `catalog`) and writes-then-
 * syncs; it mounts nothing into a composite (access≠load; `wiki-layer-ontology#write-law`,
 * `residency-model` sovereign-worker MUST). The no-reach wiki island resolves its
 * OWN recipe-mounted layers: a source bag MAY be a read-only library layer (read),
 * a target MUST be a writable layer (write). Authority rides the cap-gate upstream.
 */
interface BagAccess {
  read(bag: string): Promise<LarTiddlerStore | null>;
  write(bag: string): Promise<LarTiddlerStore | null>;
  /** Why each registry plane answered no store for `bag`, in plane order; empty when no plane threw. */
  causesOf(bag: string): readonly string[];
}

function makeBagAccess(opts: ActionHandlerOptions): BagAccess {
  if (opts.reach) {
    const reach = opts.reach;
    const planes = ([["catalog", reach.catalogUrl], ["oracle", reach.oracleUrl]] as const)
      .filter((p): p is readonly ["catalog" | "oracle", string] => !!p[1])
      .map(([name, u]) => ({ name, accessor: makeCatalogAccessor(reach.repo, u) }));
    const cache = new Map<string, LarTiddlerStore | null>();
    // A plane that throws (a document that never arrived, or one reported unavailable) keeps its reason
    // beside the bag, so a refusal names it instead of reading as an unregistered bag.
    const causes = new Map<string, string[]>();
    // Reach a bag's store: prefer one the daemon already mounts writable (its own
    // daemon bag — no find latency), else resolve the bag's doc by access across
    // the two planes. Cached per action (find() is bounded-async). Read and write
    // share the store: the doc carries no read-only flag — the cap-gate is the authority.
    const resolve = async (bag: string): Promise<LarTiddlerStore | null> => {
      const hit = cache.get(bag);
      if (hit !== undefined) return hit;
      let store: LarTiddlerStore | null = opts.composite.writableStoreForBag(bag);
      if (!store) {
        const held: string[] = [];
        for (const { name, accessor } of planes) {
          try {
            store = await accessor.storeOf(bag);
            if (store) break;
          } catch (err) {
            held.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        if (!store && held.length > 0) causes.set(bag, held);
      }
      // A system canon bag (`lares`, `lararium`): its live document rests in the Kahu realm, named by the realm's bag row.
      if (!store && reach.systemCanonUrl && isSystemCanonBag(bag)) {
        const url = await reach.systemCanonUrl(bag).catch(() => null);
        const handle = url ? await findOrThrow(reach.repo, url, bag).catch((err: unknown) => {
          causes.set(bag, [...(causes.get(bag) ?? []), `realm: ${err instanceof Error ? err.message : String(err)}`]);
          return null;
        }) : null;
        store = handle ? new AutomergeDocStore(handle, bag) : null;
      }
      // A wiki's instance slot (`wikis/<slug>/<kind>`) — the doc THE ONE resolver names, the same
      // doc its island mounts; reached by access, never mounted here.
      if (!store && reach.slotDocUrl) {
        const m = /^lar:\/\/\/ha\.ka\.ba\/wikis\/([^/]+)\/(draft|working|personal)$/.exec(bag);
        if (m) {
          const reason = (err: unknown): null => {
            causes.set(bag, [...(causes.get(bag) ?? []), `slot: ${err instanceof Error ? err.message : String(err)}`]);
            return null;
          };
          const url = await reach.slotDocUrl(m[1]!, m[2] as WikiSlotKind, { mint: false }).catch(reason);
          const handle = url ? await findOrThrow(reach.repo, url, bag).catch(reason) : null;
          store = handle ? new AutomergeDocStore(handle, bag) : null;
        }
      }
      cache.set(bag, store);
      return store;
    };
    return { read: resolve, write: resolve, causesOf: (bag) => causes.get(bag) ?? [] };
  }
  // No reach: the wiki island operates on its own mounted layers only.
  return {
    read:  async (bag) => opts.composite.storeForBag(bag),
    write: async (bag) => opts.composite.writableStoreForBag(bag),
    causesOf: () => [],
  };
}

/** What a dry-run captured — the records a verb WOULD land / tombstone / remove,
 *  per bag. The store is never touched; this is the projected effect. */
export interface CapturedEffect {
  readonly puts: ReadonlyArray<{ readonly bag: string; readonly title: string }>;
  readonly tombstones: ReadonlyArray<{ readonly bag: string; readonly title: string }>;
  readonly removes: ReadonlyArray<{ readonly bag: string; readonly title: string }>;
}

/**
 * A read-through, write-capture `BagAccess` for `--dry-run` / preview. Reads
 * delegate to the real store (so an executor sees real source/dest state);
 * writes (`put`/`tombstone`/`remove`) RECORD the would-land effect and COMMIT
 * NOTHING. Because every residency write — content AND the effect-record ledger —
 * rides `access.write(bag).{put,tombstone,remove}`, passing this captures the
 * whole projected effect while the executor runs UNCHANGED. (CREATE's mint +
 * registry write live OUTSIDE access — its executor guards on `dryRun` itself.)
 */
function makeCapturingBagAccess(real: BagAccess): { access: BagAccess; captured: CapturedEffect } {
  const puts: Array<{ bag: string; title: string }> = [];
  const tombstones: Array<{ bag: string; title: string }> = [];
  const removes: Array<{ bag: string; title: string }> = [];
  const access: BagAccess = {
    read: (bag) => real.read(bag),
    write: async (bag) => {
      const realStore = await real.write(bag).catch(() => null);
      const capturing: LarTiddlerStore = {
        listVisible: () => (realStore ? realStore.listVisible() : Promise.resolve([])),
        get: (title) => (realStore ? realStore.get(title) : Promise.resolve(null)),
        put: async (record) => { puts.push({ bag, title: String(record.tiddler.title) }); },
        tombstone: async (title) => { tombstones.push({ bag, title }); },
        remove: async (title) => { removes.push({ bag, title }); },
        subscribe: () => () => {},
      };
      return capturing;
    },
    causesOf: (bag) => real.causesOf(bag),
  };
  return { access, captured: { puts, tombstones, removes } };
}

/** Shape a CapturedEffect into the dry-run result payload (the titles a verb WOULD land/tombstone/remove). */
function projectedEffect(c: CapturedEffect): Record<string, unknown> {
  return {
    wouldLand: c.puts.map((p) => p.title),
    wouldTombstone: c.tombstones.map((t) => t.title),
    ...(c.removes.length ? { wouldRemove: c.removes.map((r) => r.title) } : {}),
  };
}

/**
 * Register every ACTION verb (ADD / COPY / MOVE / CLEAR / DROP / LOAD) on a
 * VerbTable. Called from island-behaviors.ts during `onEa`.
 */
export function registerActionReactors(table: VerbTable, opts: ActionHandlerOptions): void {
  for (const verb of ACTION_VERBS) {
    table.register(verb, makeActionReactorFor(verb, opts));
  }
  // REPACK — a QUERY verb (read + serialize, NO residency mutation, no
  // effect-record): collect a pack's members via the aside provenance
  // (`$:/config/OriginalTiddlerPaths`) and re-render the bundle file via TW5's own
  // serializer (the reciprocal of a multi-tiddler deserialize). Returns the bytes;
  // the gesture writes them to disk (for the operator's upstream PR). Read cap only.
  table.register("REPACK", async (args, ctx) => {
    const bag = String(args["bag"] ?? "");
    const packPath = String(args["pack-path"] ?? "");
    if (!bag || !packPath) throw new Error("REPACK: `bag` and `pack-path` required");
    const proof = await ctx.cap("read", bag);
    if (!proof.ok) throw new Error(`cap-denied: read on ${bag} required to REPACK (${proof.reason ?? "no reason"})`);
    return executeRepack(makeBagAccess(opts), bag, packPath, opts.tw5);
  });
}

/**
 * REPACK — collect a pack's members from the aside provenance and re-render the
 * multi-tiddler bundle. The members ride byte-clean (no injected fields); a
 * missing member (tombstoned since its record vanished) surfaces in `missing`,
 * never silently dropped.
 */
async function executeRepack(access: BagAccess, bag: string, packPath: string, tw5?: Tw5Deserializer): Promise<Record<string, unknown>> {
  if (!tw5) throw new Error("REPACK: no native serializer (no booted $tw)");
  const provRec = await readFromBag(access, bag, ORIGINAL_TIDDLER_PATHS);
  const prov    = parseProvenance(typeof provRec?.tiddler["text"] === "string" ? (provRec.tiddler["text"] as string) : undefined);
  const members = membersOfPack(prov, packPath);
  if (members.length === 0) throw new Error(`REPACK: no pack membership recorded for "${packPath}" in ${bag}`);
  const records: Array<Record<string, unknown>> = [];
  const missing: string[] = [];
  for (const title of members) {
    const rec = await readFromBag(access, bag, title);
    if (rec) records.push(rec.tiddler as unknown as Record<string, unknown>);
    else missing.push(title);
  }
  const dot = packPath.lastIndexOf(".");
  const ext = dot >= 0 ? packPath.slice(dot) : "";
  const text = tw5.serializeBundle(records, ext);
  return { verb: "REPACK", path: packPath, text, count: records.length, ...(missing.length > 0 ? { missing } : {}) };
}

/** Per-ACTION-verb reactor factory. */
export function makeActionReactorFor(verb: ActionVerb, opts: ActionHandlerOptions): VerbReactor {
  return async (args, ctx) => {
    const action = residencyFromContext(verb, args, ctx.invocation);
    if (!action) throw new Error(`action-handler/${verb}: malformed args — required fields missing or wrong type`);

    // THE ONE PREDICATE, before any other check: a hand outside the Kahu cabal lands nothing in system canon.
    if (opts.kahuReachClearedAtGate !== true) {
      await requireKahuReach(destinationBag(action), opts.kahuReach, action.verb);
      if (action.verb === "MOVE") await requireKahuReach(action.fromBag, opts.kahuReach, "MOVE out of canon");
    }

    // W27: a write lands on a working layer, and canon takes it by promotion. No door passes a LOAD into canon;
    // the seed walks this road too. The refusal names the road: a title-less MOVE promotes the whole working layer.
    if (action.verb === "LOAD" && /^lar:\/\/\/ha\.ka\.ba\/bags\/[^/]+$/.test(action.toBag)) {
      const slug = action.toBag.slice(action.toBag.lastIndexOf("/") + 1);
      throw new VerbRefusal("load-into-canon", `load-into-canon: LOAD --to lar:///ha.ka.ba/wikis/${slug}/working, then MOVE --from lar:///ha.ka.ba/wikis/${slug}/working --to lar:///ha.ka.ba/bags/${slug}`);
    }
    // INGEST returns disk edits through the shore's own hash gate; this LOAD door does not govern it.

    // `--dry-run` / preview: the cap-gate STILL runs (a preview you're not
    // authorized for fails loud the same); only the WRITES are captured + nothing
    // commits. The flag rides the raw args, ignored by the validator.
    const dryRun = args["dry-run"] === true;

    // CREATE — mint a NEW bag; the destination doesn't exist yet, so it bypasses
    // the generic destBag cap + writable-store check. The cap is PLANE-AWARE
    // the catalog plane (household) -> read; the oracle plane (temple) -> admin.
    // This is the existing-primitive expression of the user<admin ladder. The Keyhive-native surface
    // it defers to now STANDS — `KeyhiveProvider.verifySentinelMembership` answers per-candidate and
    // `sentinelCgkaMembers` enumerates — so switching is a design choice rather than a wait.
    if (action.verb === "CREATE") {
      const grade: "read" | "admin" = action.plane === "oracle" ? "admin" : "read";
      const root  = action.plane === "oracle" ? ORACLE_DOC_URI : CATALOG_DOC_URI;
      const proof = await ctx.cap(grade, root);
      if (!proof.ok) {
        throw new VerbRefusal("cap-denied", `cap-denied: ${grade} on ${root} required to CREATE in @${action.plane} plane (${proof.reason ?? "no reason"})`);
      }
      if (dryRun) {
        const cap = makeCapturingBagAccess(makeBagAccess(opts));
        const summary = await executeCREATE(action, cap.access, opts, true);
        return { verb, dryRun: true, ...summary, ...projectedEffect(cap.captured) };
      }
      return { verb, ...(await executeCREATE(action, makeBagAccess(opts), opts)) };
    }

    // Cap-verify destination bag (every verb)
    const destBag = destinationBag(action);
    const destProof = await ctx.cap("admin", destBag);
    if (!destProof.ok) throw new VerbRefusal("cap-denied", `cap-denied: admin on ${destBag} required (${destProof.reason ?? "no reason"})`);

    // THE SOURCE CARRIES A CAP TOO, and every transfer verb reaches across it. The caller names the
    // source, and this handler reads it with its own reach across both planes — so an unchecked source
    // lets a holder of the destination pull titles out of a bag they hold nothing on. The store offers
    // no second line: read and write share it, and the cap-gate stands as the authority. The routing
    // layer names the destination as well (`bagUrl ?? toBag ?? dest ?? bag ?? targetBag`), so nothing
    // upstream covers it either.
    //
    // AND THE SOURCE SIDE CARRIES THE HEAVIER HALF, which reads backwards until the direction is
    // named. A household bag holds the MORE confidential material and a public plane the less, so a
    // grant outward RELAXES a policy rather than raising one — the act information-flow work calls
    // declassification, and the authority for it belongs to the principal who owns the source policy,
    // never to whoever holds the destination. Robust declassification adds the second half: the
    // DECISION to relax must itself carry integrity, which the destination's own cap supplies.
    //
    // AND THE PRICE FOLLOWS THE DIRECTION. A copy INWARD — a public tiddler shadowed into a more
    // private bag — raises confinement and reaches fewer readers than the original: the recipe stack
    // runs on that shape and it stays cheap at read. A copy OUTWARD relaxes confinement with no
    // return crossing, and belongs to the kahu quorum's signers — no quorum signature surface stands yet,
    // so an outward crossing refuses outright, fail-closed until the quorum can answer for it.
    // MOVE keeps ADMIN whichever way the copy runs, because it tombstones the title where it stood,
    // which mutates the source.
    //
    // The tiers ride `opts.bagTier`, threaded by the vessel over its declared bag manifests.
    // Fail-closed: an absent reader (and a null answer) reads VEIL, and veil meets veil as LATERAL —
    // a vessel that threads no reader keeps exactly the pricing it had before the reader existed.
    if (action.verb === "MOVE" || action.verb === "ADD" || action.verb === "COPY") {
      const tierOf = (bag: string): CapTier => opts.bagTier?.(bag) ?? "veil";
      const cost = crossingDirection({ from: tierOf(action.fromBag), to: tierOf(destBag) });
      if (cost.needsQuorum) {
        throw new VerbRefusal("crossing-outward",
          `crossing-outward: ${action.verb} ${action.fromBag} -> ${destBag} carries ` +
          `${tierOf(action.fromBag)} material into ${tierOf(destBag)} and relaxes confinement — ` +
          `an outward crossing wants the kahu quorum, and no quorum signature rides this invocation`,
        );
      }
      const grade: "read" | "admin" = action.verb === "MOVE" ? "admin" : cost.sourceGrade;
      const srcProof = await ctx.cap(grade, action.fromBag);
      if (!srcProof.ok) throw new VerbRefusal("cap-denied", `cap-denied: ${grade} on ${action.fromBag} required (${srcProof.reason ?? "no reason"})`);
    }

    // Resolve each bag's store by ACCESS — the daemon mounts nothing, it reaches
    // the bag's own doc and writes-then-syncs; the wiki island resolves its own
    // layers. Content writes AND the effect-record ledger both ride these per-bag
    // stores, so each record lands in its affected bag (residency-model#effect-record-surface).
    const access = makeBagAccess(opts);

    // Defense in depth: the destination MUST resolve to a writable store. If
    // access resolved nothing, fail loud — a residency write never falls through
    // to the default writable (wiki-layer-ontology#write-law; the confused-deputy guard).
    if (!(await access.write(destBag))) {
      const causes = access.causesOf(destBag);
      const causeLines = causes.length > 0 ? ` The planes answered: ${causes.map((c) => c.replace(/\.+$/, "")).join("; ")}.` : "";
      throw new Error(
        `action-handler/${verb}: destination bag "${destBag}" unreachable — ` +
        `not registered, or access resolved nothing. No silent fall-through.${causeLines}`,
      );
    }

    // A RETIRED bag takes no landing. DROP wrote the retirement marker into the bag's own doc;
    // every verb the residency table marks as writing into a bag refuses BY NAME and points at
    // CREATE, which mints a fresh doc and re-points the registry row. Without the refusal a write
    // answers success into a doc CREATE then abandons (M13). Preview refuses the same.
    if (writesBag(verb)) {
      const destStore = await access.write(destBag);
      if (destStore && await storeIsRetired(destStore, destBag)) {
        throw new VerbRefusal("bag-retired",
          `bag-retired: ${verb} ${verb === "CLEAR" ? "of" : "into"} ${destBag} refused — the bag was DROPped and takes no writes. ` +
          `CREATE ${destBag} to stand a fresh bag, then write again.`,
        );
      }
    }

    // `--dry-run`: run the executor through the capturing access — content writes
    // AND the effect-record ledger are captured, nothing commits.
    if (dryRun) {
      const cap = makeCapturingBagAccess(access);
      const summary = await withEffectRecord(action, (bag) => cap.access.write(bag), () => executeAction(action, cap.access, opts.tw5, opts.resolveByCid, opts.yieldHostTask),
        action.verb === "DROP" ? { newId: () => RETIRED_EVENT_ID } : undefined);
      return { verb, dryRun: true, ...summary, ...projectedEffect(cap.captured) };
    }

    // DROP's `bag-retired` record rides the fixed marker id, so a re-DROP keeps the FIRST
    // retirement record (its actor and request) instead of overwriting it.
    if (action.verb === "DROP") {
      const dropStore = await access.write(action.bag);
      const marked = !!dropStore && await storeIsRetired(dropStore, action.bag);
      if (marked) return { verb, ...(await executeAction(action, access, opts.tw5, opts.resolveByCid, opts.yieldHostTask)) };
    }
    const summary = await withEffectRecord(action, (bag) => access.write(bag), () => executeAction(action, access, opts.tw5, opts.resolveByCid, opts.yieldHostTask),
      action.verb === "DROP" ? { newId: () => RETIRED_EVENT_ID } : undefined);
    return { verb, ...summary };
  };
}

// ── ResidencyAction reconstruction from VerbContext ────────────────────────

/**
 * Re-shape the dispatched Verb + raw args into a typed ResidencyAction.
 * Uses parseResidencyAction (the shared validator). The args field on the
 * Verb may have already been deserialized; we trust whatever shape
 * the dispatcher hands us as long as parseResidencyAction accepts it.
 */
function residencyFromContext(
  verb: ActionVerb,
  args: Readonly<Record<string, unknown>>,
  invocation: Verb,
): ResidencyAction | null {
  const synth: Verb = {
    ...invocation,
    action: verb,
    args,
  };
  return parseResidencyAction(synth);
}

/** Destination bag URI for the cap-verify step + audit. */
function destinationBag(action: ResidencyAction): string {
  switch (action.verb) {
    case "ADD":
    case "COPY":
    case "MOVE":
    case "LOAD":
    case "INGEST":
      return action.toBag;
    case "CLEAR":
    case "DROP":
    case "CREATE":
      return action.bag;
  }
}

// ── Per-verb executors ─────────────────────────────────────────────────────

async function executeAction(action: ResidencyAction, access: BagAccess, tw5?: Tw5Deserializer, resolveByCid?: CarrierResolver, yieldHostTask: HostTaskYield = yieldToHost): Promise<Record<string, unknown>> {
  switch (action.verb) {
    case "ADD":   return executeAdd(action, access);
    case "COPY":  return executeCopy(action, access);
    case "MOVE":  return executeMove(action, access);
    case "CLEAR": return executeClear(action, access);
    case "DROP":  return executeDrop(action, access);
    case "LOAD":  return executeLoad(action, access, tw5, resolveByCid, yieldHostTask);
    case "INGEST": return executeIngest(action, access, tw5, resolveByCid);
    case "CREATE": throw new Error("action-handler: CREATE is handled in the reactor (plane-aware gate + mint), not executeAction");
  }
}

/** Resolve a carrier body by content-address from the corpus CAS (the fs-less worker's
 *  shore). Verbs ride references, never bodies. */
export type CarrierResolver = (cid: string) => Promise<Uint8Array | null>;

/**
 * Resolve a carrier's body to its `text` string. An inline `text` rides straight through
 * A `textCid` resolves from the corpus CAS via `resolveByCid`, then
 * re-verifies `cid == hash(bytes)` — the worker trusts CONTENT, never the host (Island
 * Sovereignty). Only a NON-pointer carrier reaches here (a pointer lands by reference, never
 * resolved), and such a carrier staged its `text` string as utf8 — so utf8-decoding the
 * resolved bytes reproduces the same string. Faults loud on an absent resolver, an absent
 * blob, or a hash mismatch.
 */
async function resolveCarrierText(
  carrier: { readonly uri?: string; readonly title?: string; readonly text?: string; readonly textCid?: string },
  resolveByCid?: CarrierResolver,
): Promise<string> {
  if (typeof carrier.text === "string") return carrier.text;
  const cid = carrier.textCid;
  const label = carrier.uri ?? carrier.title ?? "(carrier)";
  if (!cid) throw new Error(`carrier ${label} carries neither text nor textCid — a verb rides one body reference`);
  if (!resolveByCid) throw new Error(`carrier ${label} rides textCid ${cid} but this island exposes no resolveByCid (no corpus CAS shore)`);
  const bytes = await resolveByCid(cid);
  if (!bytes) throw new Error(`carrier ${label}: CAS blob ${cid} absent — stage the body before submitting the verb`);
  const got = sha256HexBytesSync(bytes);
  if (got !== cid) throw new Error(`carrier ${label}: CAS integrity fault — textCid ${cid} != hash(bytes) ${got}`);
  return new TextDecoder().decode(bytes);
}

/**
 * True when the doc a registry row currently names carries the retirement marker — H8's absent-read
 * for CREATE. ONE keyed read of the named doc (no mount, no composite, no scan). An unreachable doc
 * (never arrives) reads not-retired — the already-stood answer still carries SOME doc rather than
 * CREATE faulting on a sync hiccup.
 */
async function bagRetiredDisposition(repo: Repo, bagUri: string, docUrl: string): Promise<boolean> {
  const handle = await findOrThrow(repo, docUrl, `bag ${bagUri} (retirement check)`).catch(() => null);
  const raw = plainRecordOrNull(handle?.doc()?.tiddlers?.[effectRecordUri(bagUri, RETIRED_EVENT_ID)]);
  return isRetirementMarker(raw?.tiddler as Record<string, unknown> | undefined, bagUri);
}

/**
 * CREATE — declarative: "this bag stands". Mints a NEW empty bag at `action.bag`
 * and registers it in the plane's registry (catalog for the household plane,
 * oracle for the system plane) the FIRST time the bag stands. Writes a
 * `creation` effect-record into the new bag on that first mint only. Requires
 * the daemon `reach` (repo + plane registry).
 *
 * Idempotency follows the BAG'S STATE, never a request key: a bag already
 * registered — and NOT RETIRED — answers success with its existing doc
 * (`alreadyStood: true`) — never a second mint, never a second `creation`
 * record. A bag made absent again (CREATE → DROP → CREATE) mints fresh: a
 * registered doc whose own ledger carries a `bag-retired` disposition (DROP's
 * effect record) reads as ABSENT to CREATE — the row RE-POINTS to the fresh
 * mint (an update to the same registry entry; never a second row), and the
 * old doc keeps its own history under its own URL. No clock and no ordering is
 * needed: a re-stood bag is always a NEW doc, so a retirement always belongs
 * to the doc the row currently names.
 */
async function executeCREATE(action: CreateAction, access: BagAccess, opts: ActionHandlerOptions, dryRun = false): Promise<Record<string, unknown>> {
  const reach = opts.reach;
  if (!reach) {
    throw new Error("action-handler/CREATE: no reach — minting + registering a bag requires the daemon reach (repo + plane registry)");
  }
  const registryUrl = action.plane === "oracle" ? reach.oracleUrl : reach.catalogUrl;
  if (!registryUrl) {
    throw new Error(`action-handler/CREATE: the reach carries no ${action.plane} registry url`);
  }
  // The title law, ahead of any mint: a bag's address stands as a registry title, and a refusal after the
  // mint would leave a fresh document and its cap behind a row that never lands.
  assertStorableTitle(action.bag);
  const registry = makeCatalogAccessor(reach.repo, registryUrl);
  // Already-stood check FIRST — a registered bag whose own doc carries no
  // retirement answers success with its existing doc, never a double-mint and
  // never a second `creation` record. A RETIRED doc falls through to the mint
  // below, which re-points this same registry row.
  const existing = await registry.urlOf(action.bag).catch(() => null);
  if (existing && !(await bagRetiredDisposition(reach.repo, action.bag, existing))) {
    // `count` reads the standing bag's CONTENT titles (the ledger is audit, not content).
    const standing = await registry.storeOf(action.bag).catch(() => null);
    const count = standing ? (await standing.listVisible()).filter((t) => !isEffectRecordUri(t)).length : 0;
    return { bag: action.bag, plane: action.plane, docUrl: existing, alreadyStood: true, count };
  }
  // Mint + register inside withEffectRecord so the `creation` ledger record lands
  // after the new bag is reachable (the effect-record rides the new bag's own doc).
  return withEffectRecord(action, (bag) => access.write(bag), async () => {
    if (dryRun) {
      // Preview: skip the mint + registry write; report the would-mint. The
      // `creation` effect-record (written via access.write) is captured by the
      // dry-run access, so it surfaces in wouldLand — nothing commits.
      return { bag: action.bag, plane: action.plane, docUrl: "(dry-run: would mint)", wouldRegister: true, count: 0 };
    }
    const handle = reach.repo.create(emptyLarDoc());
    await handle.whenReady();
    const docUrl = String(handle.url);
    // Born-with-its-cap: register the new bag's Keyhive Document + delegate admin
    // in the SAME act as the mint, BEFORE the registry row designates it. A cap that
    // refuses leaves the fresh doc unnamed and unreachable and the registry as it
    // stood, so a re-run mints again. Without the cap a bag would hold a catalog
    // entry (designation) but no authority — a follow-up write cap-denies. Key on the
    // lar: bag URL (`action.bag`) — the same string the cap-gate's verify() and
    // boot-registration key on; the automerge docUrl names the CONTENT doc, a
    // different object.
    await opts.registerBag?.(action.bag);
    const regHandle = await registry.handle();
    regHandle.change((doc) => {
      doc.tiddlers[action.bag] = storedLarRecord(action.bag, { text: docUrl, kind: "oracle" }, "lares-verb:CREATE");
    });
    return { bag: action.bag, plane: action.plane, docUrl, count: 0 };
  });
}

/**
 * LOAD — land operator-supplied carriers into toBag. The island never fetches:
 * the operator gesture (which holds the disk grant) sends content WITH the
 * verb; `sourceUri` rides as audit provenance only. Each carrier decomposes at
 * the memetic-wikitext shore (FFZ: parent + ahu-slot children), and every
 * resulting record lands under the action's fresh changeId.
 */
/**
 * A memetic-wikitext carrier opens with the SOH classifier (&#x0001; / &#x0011;).
 * NOTE: TW5 filetype registration does NOT reproduce the direct memetic decomposition
 * in this integration (routing a memetic carrier through the filetype registry
 * drops the heading-titled records) — so SOH carriers MUST take the direct
 * memetic path, never the registry. A de-dup toward the import path is un-pono here.
 */
// THE CARRIER FRAME RIDES THE CONTROL HEAD. When the sigil sets split into capability domains, the frame
// took `<<^` and the speaking head `<<~` kept every word sigil — so the head now CARRIES the distinction
// rather than merely decorating it, and a frame on the speaking head names a malformed carrier, never an
// older one. Matching both heads would re-fuse the domains the split exists to hold apart.
// THE CODE SET COMES FROM THE DECLARATION (@lararium/memetic-frame marks.ts); the prefix STOPS AT `&` so a namespace
// written as entities ahead of the code is never read AS the code.
const CARRIER_SOH = new RegExp(`<<\\^[^&\\n]*${frameAlt("SOH")}`);

/**
 * A CARRIER'S DECLARATION DECIDES ITS FAMILY, and so its siting. Two declarations speak, in order:
 *
 *   · the `.meta` sidecar's `type`: the same word TW5's folder loader lets win over the extension. A
 *     sidecar naming a type no carrier reader admits sends the body to TW5's own registry, whatever
 *     the body shows; a sidecar naming the carrier type sends it to the memetic shore.
 *   · a LIVE head: a SOH sigil standing outside every fence. A head SHOWN inside a fence opens
 *     nothing, so a document that teaches the frame keeps its own filetype and its sidecar's fields.
 *
 * A host with no native bridge reads every carrier as memetic. The routing never reads the path.
 */
function readsAsMemetic(text: string, meta: string | undefined, tw5: Tw5Deserializer | undefined): boolean {
  if (!tw5) return true;
  const declared = meta ? tw5.parseFields(meta)["type"] : undefined;
  if (typeof declared === "string" && declared) return isCarrierType(declared);
  return maskedExec(text, CARRIER_SOH) !== null;
}

/**
 * THE BLOB LAW's island-side wall: a standalone content carrier whose declared type (the `.meta`
 * sidecar first, else TW5's registry by extension) rides as a POINTER never lands INLINE — its
 * bytes belong in the cid/ tier and the gesture stages them. An island holds no CAS write, so an
 * inline base64 body for a base64 family faults loud rather than materialize in the CRDT.
 */
function refuseInlinePointerKind(label: string, ext: string | undefined, meta: string | undefined, tw5: Tw5Deserializer): void {
  const declared = meta ? tw5.parseFields(meta)["type"] : undefined;
  const type = typeof declared === "string" && declared ? declared : tw5.contentTypeFromExt(ext ?? "");
  if (type && ridesAsPointer(type)) {
    throw new Error(`carrier ${label}: a ${type} body rides a POINTER, never inline — stage it to the cid/ tier (the gesture's cas-stage) and ride textCid + skinny`);
  }
}

/**
 * Land a POINTER — the whole-carrier skinny handle. The body stays in the cid/ tier; the CRDT
 * keeps only the reference (cid + integrity + metadata, NEVER the body). This is what keeps a
 * body from materializing as a CRDT scalar-string and OOMing automerge on sync-apply. Never
 * resolves the bytes (the handle points; the read-side resolver rehydrates on render).
 *
 * The `.meta` sidecar's fields ride UNDER the pointer's own — TW5's folder-loader law (the
 * sidecar merges over the deserialized record) read for a pointer: `type` from the sidecar wins
 * over the extension's (a `.svg` declared `text/xml`, a `.bin` declared `image/png`), tags and
 * custom fields survive, and the computed `textCid` · `_integrity` · `size` · `_is_skinny` win
 * over any stale copy the sidecar carries (a projected `.meta` carries them as ordinary fields).
 * THE BLOB LAW, content-handle.ts.
 */
function skinnyHandleRecord(
  toBag: string, title: string, cid: string, size: number,
  ext: string | undefined, changeId: string, tw5?: Tw5Deserializer, meta?: string,
): LarTiddlerRecord {
  const metaFields: Record<string, unknown> = meta && tw5 ? { ...tw5.parseFields(meta) } : {};
  delete metaFields["title"];
  delete metaFields["text"];
  const declared = typeof metaFields["type"] === "string" && metaFields["type"] ? (metaFields["type"] as string) : undefined;
  const mediaType = declared ?? tw5?.contentTypeFromExt(ext ?? "");
  const handle = skinnyHandleTiddler(title, cid, size, ext, mediaType);
  // A sidecar's `_canonical_uri` never survives onto a base64-family pointer (the handle omits it by law).
  if (!("_canonical_uri" in handle)) delete metaFields["_canonical_uri"];
  const tiddler = { ...metaFields, ...handle, bag: toBag } as unknown as LarTiddlerRecord["tiddler"];
  return { tiddler, meta: { changeId } };
}

async function landSkinnyHandle(
  access: BagAccess, toBag: string, title: string, cid: string, size: number,
  ext: string | undefined, changeId: string, o: ChangeOrigin, tw5?: Tw5Deserializer, meta?: string,
): Promise<void> {
  await writeIn(access, toBag, skinnyHandleRecord(toBag, title, cid, size, ext, changeId, tw5, meta), o);
}

/**
 * What the shore said about the records it handed a bag door — the quoteblock floor's account of a
 * fence it laid (`ahu.mem#/quoteblock-floor`). A bag holds no alert rail, so the door's receipt carries
 * it: a fence nobody sees reads as a drop.
 */
function shoreWarnings(records: ReadonlyArray<Record<string, unknown>>): string[] {
  const out: string[] = [];
  for (const r of records) {
    const v = r[QUOTEBLOCKED_FIELD];
    if (typeof v === "string" && v !== "") out.push(v);
  }
  return out;
}

/**
 * The tear a deserialized carrier names, or null when its frame reads sound. TW5's deserializer contract
 * holds a torn frame verbatim as one `$torn` record because it has no way to refuse. A bag door has one,
 * so it refuses: the verbatim hold would land at the carrier's root title and replace a family standing
 * there with bytes no reader can divide.
 */
function tearOf(records: ReadonlyArray<Record<string, unknown>>): string | null {
  const tears = records
    .map((r) => r[TORN_FIELD])
    .filter((v): v is string => typeof v === "string" && v !== "");
  return tears.length === 0 ? null : tears.join("; ");
}

/** The warnings key, present only where the shore spoke — a clean receipt keeps its shape. */
function withWarnings(receipt: Record<string, unknown>, warnings: readonly string[]): Record<string, unknown> {
  return warnings.length === 0 ? receipt : { ...receipt, warnings: [...warnings] };
}

async function executeLoad(action: LoadAction, access: BagAccess, tw5?: Tw5Deserializer, resolveByCid?: CarrierResolver, yieldHostTask: HostTaskYield = yieldToHost): Promise<Record<string, unknown>> {
  const carriers = action.carriers ?? [];
  if (carriers.length === 0) {
    throw new Error(
      "LOAD: no carriers — the operator gesture supplies content with the verb " +
      "(islands hold no fetch capability; source-uri carries provenance, not an address to dereference)",
    );
  }
  const titles: string[] = [];
  const warnings: string[] = [];
  // REFUSE BEFORE ANY WRITE. Every carrier reads and every refusal fires first; only a LOAD whose every
  // carrier stands sound lands, so a refused carrier never leaves its siblings half-landed.
  // ONE FAMILY PER CARRIER: the records a carrier decomposes into, in order. A family never splits.
  const families: LarTiddlerRecord[][] = [];
  for (const carrier of carriers) {
    // Scenario B: an OVERSIZED RAW shard rides a skinny handle — the body stays in the cid/
    // tier, never entering the CRDT (nor RAM here — the gesture flags it, so we honor the flag
    // WITHOUT resolving the bytes).
    if (carrier.skinny && carrier.textCid) {
      const title = carrier.title;
      if (!title) throw new Error("LOAD: a skinny carrier needs a title (its `lar:` URI) — the handle names the body");
      if (neverProjects(title) || declaresNoProjection(carrier.meta)) throw new NeverProjectedPathRefusal(title, title);
      families.push([skinnyHandleRecord(action.toBag, title, carrier.textCid, carrier.size ?? 0, carrier.ext, action.changeId, tw5, carrier.meta)]);
      continue;
    }
    // The verb rode a reference, never a body: resolve the carrier body from the
    // corpus CAS (or take an inline `text`) BEFORE routing.
    const carrierText = await resolveCarrierText(carrier, resolveByCid);
    // Defense in depth: an un-flagged body that STILL resolves oversized leaves the CRDT
    // (never OOM the doc), provided it names a cid to point at and carries no memetic wrapper.
    if (carrier.textCid && !CARRIER_SOH.test(carrierText) && isOversizedBody(carrier.size ?? carrierText.length) && carrier.title) {
      const title = carrier.title, cid = carrier.textCid;
      if (neverProjects(title) || declaresNoProjection(carrier.meta)) throw new NeverProjectedPathRefusal(title, title);
      families.push([skinnyHandleRecord(action.toBag, title, cid, carrier.size ?? carrierText.length, carrier.ext, action.changeId, tw5, carrier.meta)]);
      continue;
    }
    // The ungated-large-inline wall (the second wall — the TARGET bag doc, not the daemon bag): past
    // the skinny paths, an oversized body that reached the inline routes WOULD materialize a
    // CRDT scalar-string past the automerge capacity. It never may. A memetic carrier decomposes
    // (Scenario A intra-ahu extraction rides a later leg), so the wall reads NON-memetic only.
    if (!CARRIER_SOH.test(carrierText) && isOversizedBody(carrier.size ?? carrierText.length)) {
      throw new Error(`carrier ${carrier.title ?? "(carrier)"}: body ${carrier.size ?? carrierText.length}B would inline oversized — a verb rides a reference, never a body (flag _lar_cas or stage the body to CAS)`);
    }
    // Route by content: a memetic-wikitext carrier (SOH heading) decomposes at the
    // shore via the direct memetic deserializer; any other legal TW5 filetype
    // lands through TW5's OWN deserializer registry, resolved from its extension.
    // Absent a native resolver (no booted $tw), every carrier falls back to memetic.
    let fieldsList: Array<Record<string, unknown>>;
    if (!tw5 || readsAsMemetic(carrierText, carrier.meta, tw5)) {
      fieldsList = memeticWikitextDeserializer(carrierText, { title: carrier.title ?? "" });
    } else {
      // The extension routes to TW5's registry — it resolves the content-type + the right
      // deserializer, or falls back to text/plain; the carrier title (when named) holds authority.
      // The `.meta` sidecar merges OVER the first record AFTER the deserialize — TW5's own
      // folder-loader law (`loadTiddlersFromFile`) — so the sidecar's `type` wins over the
      // extension's and a content carrier keeps its type/tags/custom fields.
      refuseInlinePointerKind(carrier.title ?? "(carrier)", carrier.ext, carrier.meta, tw5);
      const baseFields: Record<string, unknown> = carrier.title ? { title: carrier.title } : {};
      fieldsList = tw5.deserialize(carrier.ext || "text/plain", carrierText, baseFields);
      if (carrier.meta && fieldsList.length > 0) {
        const metaFields = { ...tw5.parseFields(carrier.meta) };
        if (carrier.title) delete metaFields["title"];
        fieldsList[0] = { ...fieldsList[0], ...metaFields };
      }
    }
    const tear = tearOf(fieldsList);
    if (tear !== null) {
      throw new Error(`LOAD: carrier ${carrier.title ?? "(carrier)"} REFUSED — its frame is torn (${tear}); nothing landed, and any family under that title stands as it stood`);
    }
    const refusedField = fieldsList.find((fields) => {
      const title = typeof fields["title"] === "string" ? fields["title"] as string : carrier.title ?? "";
      return neverProjects(title) || fields["disk-projection"] === "no";
    });
    if (refusedField) {
      const title = typeof refusedField["title"] === "string" ? refusedField["title"] as string : carrier.title ?? "(carrier)";
      throw new NeverProjectedPathRefusal(carrier.title ?? title, title);
    }
    // The title law, ahead of any slice: a LOAD lands in slices, so the refusal rides before the first one
    // and no family of the wave lands beside it.
    for (const fields of fieldsList) {
      const title = typeof fields["title"] === "string" && fields["title"] ? fields["title"] as string : carrier.title ?? "";
      assertStorableTitle(title);
    }
    warnings.push(...shoreWarnings(fieldsList));
    const family: LarTiddlerRecord[] = [];
    for (const fields of fieldsList) {
      const own = typeof fields["title"] === "string" ? (fields["title"] as string) : "";
      const title = own || (carrier.title ?? "");
      if (!title) {
        throw new Error("LOAD: carrier produced a record without a title — supply carrier.title or an meta uri-path");
      }
      family.push({ tiddler: { ...fields, title } as LarTiddlerRecord["tiddler"], meta: { changeId: action.changeId } });
    }
    if (family.length > 0) families.push(family);
  }
  // A SLICE LANDS AS ONE STORE CHANGE, AND LOAD YIELDS TO THE HOST BETWEEN SLICES. A slice gathers whole
  // families and closes at the first family boundary at or past the quantum, so a carrier's root and its
  // children ride one change and a peer receives them together. A chain of promises never lets a host task
  // in, so a bulk LOAD would hold the island's thread until its last record landed. LOAD decides nothing
  // between its slices (it reads no standing record and removes none), so a hand edit or another verb that
  // takes the turn in between cannot be overwritten by a decision made before the yield. The executors
  // that DO decide before they write (INGEST's Confluence gate, MOVE's read-then-retract) take no yield.
  const o = origin(action);
  let slice: LarTiddlerRecord[] = [];
  let landedSlices = 0;
  const landSlice = async (): Promise<void> => {
    if (slice.length === 0) return;
    if (landedSlices > 0) await yieldHostTask();
    await writeFamilyIn(access, action.toBag, slice, o);
    for (const record of slice) titles.push(record.tiddler.title);
    landedSlices++;
    slice = [];
  };
  for (const family of families) {
    slice.push(...family);
    if (slice.length >= LOAD_YIELD_QUANTUM) await landSlice();
  }
  await landSlice();
  return withWarnings({ sourceUri: action.sourceUri, toBag: action.toBag, changeId: action.changeId, count: titles.length, titles }, warnings);
}


/**
 * INGEST — disk -> records through the Confluence gate, replace-by-group apply.
 * The gesture supplies diskHash + syncedHash with each carrier (it holds the
 * disk grant and the Synced tree); the island computes only the
 * currentRenderHash from its own merge seat. On an ingest decision the fresh
 * records land under the action's changeId and group members that vanished
 * from the re-parsed carrier tombstone (LOAD never removes; INGEST must).
 * noop/refuse/conflict apply NOTHING — the decision rides the outcome. Memetic and
 * native carriers alike run the ONE `decideIngest` gate (native passes its own congruence
 * `IngestOps`); the refuse leg fires only where a family grades error (memetic), riding
 * dormant for native (a native deserialize throws rather than grading).
 */
/**
 * THE TITLE LAW, read ahead of the write. The store's door refuses a session-form title by throwing, and a
 * throw inside a wave would end the wave with its earlier carriers landed. So a reactor that answers per
 * carrier asks the same law first (`storableTitleFault`, `@lararium/mesh` `title-law.ts`) and names the
 * refusal in that carrier's row; the door still stands behind it.
 */
function sessionFormRow(uri: string, titles: readonly string[]): Record<string, unknown> | null {
  for (const title of [uri, ...titles]) {
    const fault = storableTitleFault(title);
    if (fault !== null) return { uri, decision: "refuse", code: SESSION_FORM_TITLE_CODE, reason: fault, warnings: [fault] };
  }
  return null;
}

/** The row field naming the render the records hold after a decision (the base's records side). */
function recordsSide(canonicalHash: string | undefined): { canonicalHash?: string } {
  return canonicalHash ? { canonicalHash } : {};
}

/**
 * The causal heads of the target bag's document NOW, named on an `ingest` row after its records landed. The
 * settle word follows them through the wiki's view: the row names the changes that carried THIS carrier's
 * records, so a view that holds them has the records or a later state. A store with no causal history names
 * none, and the word then follows the render hash alone.
 */
async function landedHeads(access: BagAccess, bag: string): Promise<{ heads?: string[] }> {
  const store = await access.write(bag);
  const heads = typeof store?.getHeads === "function" ? await store.getHeads() : null;
  return heads !== null && heads !== undefined && heads.length > 0 ? { heads: [...heads] } : {};
}

/** True when a carrier's `.meta` sidecar text declares the per-record disk opt-out (`disk-projection: no`). */
function declaresNoProjection(meta: string | undefined): boolean {
  return meta !== undefined && /^disk-projection:[ \t]*no[ \t]*$/m.test(meta);
}

/** The per-carrier answer for a file whose ingest would write a record that never projects to disk. */
function neverProjectedRow(uri: string, file: string | undefined, title: string): Record<string, unknown> {
  const refusal = new NeverProjectedPathRefusal(file ?? uri, title);
  return { uri, decision: "refuse", code: refusal.code, reason: refusal.message, warnings: [refusal.message] };
}

async function executeIngest(action: IngestAction, access: BagAccess, tw5?: Tw5Deserializer, resolveByCid?: CarrierResolver): Promise<Record<string, unknown>> {
  const o = origin(action);
  const deletions = action.deletions ?? [];

  // ── the vanished addresses a wave names (whole-carrier files gone from disk) ──
  // A WAVE TOMBSTONES NO CARRIER. A vanished file stands pending at the vessel's shore until a person
  // answers; the one thing a wave carries for a vanished address is its RE-LINK to the arrived file that
  // holds its bytes. Split BEFORE the carrier loop: a rename's target carrier must skip normal ingest so
  // the re-homed (change-id-preserving) records survive.
  let deletionSummary: Record<string, unknown> | undefined;
  const renameTargets = new Set<string>();
  let renames: readonly { readonly fromUri: string; readonly toUri: string }[] = [];

  if (deletions.length > 0) {
    const paired = pairRenames({
      deletes: deletions.map((d) => ({ uri: d.uri, syncedHash: d.syncedHash })),
      adds:    action.carriers.map((c) => ({ uri: c.uri, diskHash: c.diskHash })),
    });
    // A re-link never re-homes a record onto an address whose records never project, nor onto a
    // session-form address (`title-law.ts`): that carrier falls to the gate below and refuses by name,
    // and its vanished source stands as it stood.
    const lawful = paired.renames.filter((r) => !neverProjects(r.toUri) && storableTitleFault(r.toUri) === null);
    // A RE-LINK RE-HOMES RECORDS THAT STAND. A vanished source that holds no live record leaves nothing
    // to re-home: answered as a rename, the target would skip its own ingest, land no record, and the
    // gesture would still pin a base for it. So such a pair reads as no rename, the target carrier falls
    // to the gate below and lands as itself, and the summary names the source `absent`: the records hold
    // nothing under it, so nothing stays owed for it.
    const sources = (await listLiveTitlesInBag(access, action.toBag)).filter((t) => !isEffectRecordUri(t) && !neverProjects(t));
    const absent = lawful.filter((r) => groupOf(sources, r.fromUri).length === 0).map((r) => r.fromUri);
    // A RE-LINK NEVER LANDS OVER RECORDS THAT STAND AT ITS TARGET. A re-link skips the target's own gate,
    // so over a target that already holds records it would replace them unweighed. Such a pair reads as
    // no rename: the source stands declined, and the target falls to the gate below, where a person's
    // gesture adopts the file and a wave no person stands behind stands off.
    renames = lawful.filter((r) => !absent.includes(r.fromUri) && groupOf(sources, r.toUri).length === 0);
    for (const r of renames) renameTargets.add(r.toUri);
    const settled = new Set([...renames.map((r) => r.fromUri), ...absent]);
    deletionSummary = {
      renames: renames.map((r) => ({ ...r })),
      absent,
      // Every other vanished address the wave named: nothing moved and nothing tombstoned.
      declined: deletions.map((d) => d.uri).filter((uri) => !settled.has(uri)),
    };
  }

  const results: Array<Record<string, unknown>> = [];
  const unattended = action.unattended === true;

  for (const carrier of action.carriers) {
    // A rename's target re-homes from the vanished carrier's records (identity
    // preserved); skip its normal fresh ingest so the re-link is not overwritten.
    if (renameTargets.has(carrier.uri)) {
      results.push({ uri: carrier.uri, decision: "rename-target", note: "re-linked from a vanished carrier" });
      continue;
    }
    const uri = carrier.uri;
    if (neverProjects(uri) || declaresNoProjection(carrier.meta)) {
      results.push(neverProjectedRow(uri, carrier.file, uri));
      continue;
    }
    // The carrier's own address, ahead of every write path below (a skinny handle lands before any parse).
    const sessionFormCarrier = sessionFormRow(uri, []);
    if (sessionFormCarrier) { results.push(sessionFormCarrier); continue; }
    // Scenario B: an OVERSIZED RAW shard rides a skinny handle — the body stays in the cid/
    // tier, never materializing as a CRDT scalar-string (the automerge OOM wall). The gate
    // runs at content-address grain: the handle's cid IS its render, so an unchanged cid
    // noops and a changed cid replaces the handle. Honored WITHOUT resolving the bytes.
    if (carrier.skinny && carrier.textCid) {
      const current = await readFromBag(access, action.toBag, uri);
      const currentCid = current && typeof current.tiddler["textCid"] === "string" ? (current.tiddler["textCid"] as string) : undefined;
      if (currentCid === carrier.textCid) {
        results.push({ uri, decision: "noop", reason: "cid-matches-current" });
        continue;
      }
      // RULE 4½ AT THIS GRAIN: a wave no person stands behind never replaces a record that stands where
      // the file holds no base. The handle's cid differs, so the records say something else.
      if (unattended && carrier.syncedHash === null && current !== null && !current.meta?.deleted) {
        results.push({ uri, decision: "conflict", reason: "no-base", grade: "clean", skinny: true, warnings: [conflictWhy(uri, "no-base")] });
        continue;
      }
      await landSkinnyHandle(access, action.toBag, uri, carrier.textCid, carrier.size ?? 0, carrier.ext, action.changeId, origin(action), tw5, carrier.meta);
      results.push({ uri, decision: "ingest", grade: "clean", skinny: true });
      continue;
    }
    // The verb rode a reference, never a body: resolve the carrier body from the
    // corpus CAS (or take an inline `text`) BEFORE the Confluence gate reads it. This
    // keeps a 16MB body out of the daemon command doc; it lands here, per-carrier, in
    // the TARGET bag doc (each scalar-string field under the automerge capacity wall).
    const carrierText = await resolveCarrierText(carrier, resolveByCid);
    // Defense in depth: an un-flagged body that STILL resolves oversized leaves the CRDT
    // (never OOM the doc) rather than land as a giant text field.
    if (carrier.textCid && !CARRIER_SOH.test(carrierText) && isOversizedBody(carrier.size ?? carrierText.length)) {
      const current = await readFromBag(access, action.toBag, uri);
      const currentCid = current && typeof current.tiddler["textCid"] === "string" ? (current.tiddler["textCid"] as string) : undefined;
      if (currentCid === carrier.textCid) {
        results.push({ uri, decision: "noop", reason: "cid-matches-current" });
        continue;
      }
      if (unattended && carrier.syncedHash === null && current !== null && !current.meta?.deleted) {
        results.push({ uri, decision: "conflict", reason: "no-base", grade: "clean", skinny: true, warnings: [conflictWhy(uri, "no-base")] });
        continue;
      }
      await landSkinnyHandle(access, action.toBag, uri, carrier.textCid, carrier.size ?? carrierText.length, carrier.ext, action.changeId, origin(action), tw5, carrier.meta);
      results.push({ uri, decision: "ingest", grade: "clean", skinny: true });
      continue;
    }
    // The ungated-large-inline wall (item 5): past the skinny paths, an oversized NON-memetic
    // body would materialize a CRDT scalar-string past the automerge capacity in the TARGET bag.
    // It never may — a verb rides a reference, never a body. A memetic meme decomposes (Scenario A
    // intra-ahu extraction rides a later leg), so the wall reads non-memetic only.
    if (!CARRIER_SOH.test(carrierText) && isOversizedBody(carrier.size ?? carrierText.length)) {
      throw new Error(`carrier ${uri}: body ${carrier.size ?? carrierText.length}B would inline oversized — a verb rides a reference, never a body (flag _lar_cas or stage the body to CAS)`);
    }
    const all = await listLiveTitlesInBag(access, action.toBag);
    // The carrier group: the root + its fragment children (FFZ decomposition
    // emits `uri#slot` titles) + any path children (`uri/wires/...` era).
    const groupTitles = all.filter((t) => t === uri || t.startsWith(`${uri}#`) || t.startsWith(`${uri}/`));

    // Route by content, mirroring LOAD: a memetic carrier (SOH heading / no
    // native bridge) decomposes at the shore through the Confluence gate; ANY other
    // legal TW5 filetype rides TW5's OWN deserializer registry, keyed by its
    // extension. The registry — not a CLI-side reimplementation — owns the
    // filetype routing; the island hands the bytes to it.
    const memetic = readsAsMemetic(carrierText, carrier.meta, tw5);

    // Records to land + the receipt this carrier rides. The memetic path grades
    // the recover; the native path leans on the registry + the echo gate.
    let freshRecords: Array<Record<string, unknown>>;
    let receipt: Record<string, unknown>;
    // A PACK: a native carrier whose file yields FOREIGN-titled tiddlers (a `.json`
    // array · `.multids` · a `.tid` whose inner title ≠ its path). Its membership
    // rides ASIDE in `$:/config/OriginalTiddlerPaths`, never on the tiddlers.
    let packInfo: { packPath: string; members: string[] } | null = null;
    if (memetic) {
      const parsedFields = memeticWikitextDeserializer(carrierText, { title: uri });
      const refusedField = parsedFields.find((fields) => neverProjects(String(fields["title"] ?? uri)) || fields["disk-projection"] === "no");
      if (refusedField) {
        const title = String(refusedField["title"] ?? uri);
        results.push(neverProjectedRow(uri, carrier.file, title));
        continue;
      }
      const sessionForm = sessionFormRow(uri, parsedFields.map((fields) => String(fields["title"] ?? uri)));
      if (sessionForm) { results.push(sessionForm); continue; }
      // The ONE placement law (place-meme.ts): group · gate · land · tombstone, over a bag sink.
      // The gesture's Synced-tree hash rides as the base the gate merges against.
      const placed = await placeMeme(
        { uri, text: carrierText, baseHash: carrier.syncedHash, baseRecordsHash: carrier.syncedRecordsHash ?? null, hash: renderHash, ...(unattended ? { unattended } : {}) },
        bagMemeSink(access, action.toBag, action.changeId, o),
      );
      // An `ingest` receipt carries the placement's warnings — the quoteblock floor's account of a fence
      // it laid, which a bag sink has no rail to raise. An `ingest` and a `noop` row each carry the hash
      // of the render the records hold after the decision: the records side of the base the gesture pins.
      results.push(
        placed.decision === "ingest"  ? withWarnings({ uri, decision: "ingest", grade: placed.grade, landed: placed.landed.length, tombstoned: placed.tombstoned, ...recordsSide(placed.canonicalHash), ...(await landedHeads(access, action.toBag)) }, placed.warnings) :
        placed.decision === "noop"    ? { uri, decision: "noop", reason: placed.reason, ...recordsSide(placed.canonicalHash) } :
        placed.decision === "refuse"  ? { uri, decision: "refuse", grade: placed.grade, warnings: [...placed.warnings] } :
                                        { uri, decision: "conflict", reason: placed.reason, grade: placed.grade, warnings: [...placed.warnings] },
      );
      continue;
    } else {
      // Native filetype: the echo gate (disk == last-projected) short-circuits
      // an unchanged carrier BEFORE any deserialize (the "zero deserialize" echo),
      // so it stays ahead of the gate call. The projector records the native body
      // hash in the Synced tree, so a re-ingest of an unprojected-back carrier reads
      // this echo. (`decideIngest` re-checks the echo cheaply; keeping it here spares
      // the deserialize.)
      // `digestsEqual` reads tagged digests only; a bare `carrier.syncedHash` never
      // short-circuits here and meets the gate.
      if (carrier.syncedHash !== null && digestsEqual(carrier.diskHash, carrier.syncedHash)) {
        results.push({ uri, decision: "noop", reason: "disk-matches-synced" });
        continue;
      }
      // The `.meta` sidecar merges OVER the deserialized record AFTER the deserialize — TW5's own
      // folder-loader law (`loadTiddlersFromFile`: `extend({}, tiddlers[0], metadata)`), so the
      // sidecar's `type` wins over the extension's registered type and a content carrier keeps its
      // type/tags/custom fields across a body-only edit. No base `title` is ever passed to the
      // deserialize: a DICTIONARY bundle (`.multids`) takes the base title as a member-title PREFIX
      // (boot.js:1719), which would corrupt every member. Titles come from the content; a title-less
      // SINGLE carrier falls back to the `lar:` URI below.
      refuseInlinePointerKind(uri, carrier.ext, carrier.meta, tw5!);
      const metaFields: Record<string, unknown> = carrier.meta ? { ...tw5!.parseFields(carrier.meta) } : {};
      delete metaFields["title"];
      const fieldsList = tw5!.deserialize(carrier.ext || "text/plain", carrierText, {});
      // A torn frame the registry held verbatim REFUSES here, before any record lands or tombstones: this door
      // has a refuse channel, and the hold would replace the family standing at the carrier's root.
      const tear = tearOf(fieldsList);
      if (tear !== null) {
        results.push({ uri, decision: "refuse", grade: "error", warnings: [`${uri}: torn frame refused — ${tear}`] });
        continue;
      }
      if (carrier.meta && fieldsList.length > 0) fieldsList[0] = { ...fieldsList[0], ...metaFields };
      freshRecords = fieldsList.map((fields) => {
        const own = typeof fields["title"] === "string" ? (fields["title"] as string) : "";
        return { ...fields, title: own || uri };
      });
      const refusedRecord = freshRecords.find((record) => neverProjects(String(record["title"] ?? "")) || record["disk-projection"] === "no");
      if (refusedRecord) {
        const title = String(refusedRecord["title"] ?? uri);
        results.push(neverProjectedRow(uri, carrier.file, title));
        continue;
      }
      const sessionForm = sessionFormRow(uri, freshRecords.map((record) => String(record["title"] ?? uri)));
      if (sessionForm) { results.push(sessionForm); continue; }
      // Pack detection: any member whose title is NOT the carrier's own `lar:` URI
      // came from a bundle (the file's tiddlers self-title). Record the WHOLE
      // membership → the pack file path, so REPACK can re-collect it and the
      // projector suppresses per-member explosion. The path mirrors the disk
      // mirror-relative form (`<uri-path><ext>`), TW5-legible for the PR workflow.
      if (freshRecords.some((r) => r["title"] !== uri)) {
        const packPath = (uri.startsWith("lar:///") ? uri.slice("lar:///".length) : uri) + (carrier.ext || "");
        packInfo = { packPath, members: freshRecords.map((r) => String(r["title"])) };
      }

      // The native render congruence — records → the carrier text whose sha256 equals
      // `carrierHash(body, meta)` (the file-info BODY + `.meta`, the digest surface the
      // projector + echo gate share; `bag` excluded, `changeId` rides in meta, so a landed
      // record renders byte-identical to its disk twin). Shared by the single-carrier gate
      // AND the per-member pack gate — each member renders as its OWN single-carrier. `u`
      // selects the record to render (the carrier root, or a lone member); it steers only
      // the file-path, never the hashed body/meta.
      const nativeRender = (u: string, records: readonly Record<string, unknown>[]): string => {
        const c = tw5!.renderCarrier(u, records.find((r) => r["title"] === u) ?? records[0]!);
        return c.metaBody === undefined ? c.body : `${c.metaBody}\n\n${c.body}`;
      };

      if (packInfo) {
        // A PACK reconciles PER MEMBER through the ONE Confluence gate. Each member
        // runs the single-carrier triangle (echo · canonical-equivalent ·
        // conflict) at member grain, its content-hash the leg, REUSING `decideIngest` (no
        // new comparison logic). The aside hash map (`$:/config/OriginalTiddlerHashes`) holds
        // each member's last-synced content — the per-member merge base — SIBLING to the path
        // map, never fused in. A concurrent wiki-edit + disk-change on one member names WHICH
        // member conflicts; the rest flow. A `.multids` SHARED-field change reshapes every
        // member's render → flags all (broad, but right — a shared field touches each member's
        // carrier form).
        const provRec    = await readFromBag(access, action.toBag, ORIGINAL_TIDDLER_PATHS);
        const prevPaths  = parseProvenance(typeof provRec?.tiddler["text"] === "string" ? (provRec.tiddler["text"] as string) : undefined);
        const hashRec    = await readFromBag(access, action.toBag, ORIGINAL_TIDDLER_HASHES);
        const prevHashes = parseHashes(typeof hashRec?.tiddler["text"] === "string" ? (hashRec.tiddler["text"] as string) : undefined);

        const memberResults: Array<Record<string, unknown>> = [];
        const nextMemberHashes: Record<string, string> = {};
        const currentMemberTitles = new Set<string>(freshRecords.map((r) => String(r["title"])));
        let anyConflict = false;
        let landedCount = 0;

        for (const member of freshRecords) {
          const title = String(member["title"]);
          // The member's OWN single-carrier congruence: it deserializes to itself, renders
          // through the shared native render, declares ∅ structure, never grades.
          const memberOps: IngestOps<Record<string, unknown>> = {
            deserialize: () => ({ records: [member], diagnostics: [], declared: new Set<string>() }),
            render: nativeRender,
            declaredStructure: () => new Set<string>(),
            grade: () => "clean",
          };
          const memberDiskText = nativeRender(title, [member]);
          const memberDiskHash = renderHash(memberDiskText);
          const memberSynced   = hashOfMember(prevHashes, title) ?? null;   // the per-member merge base
          const currentRec     = await readFromBag(access, action.toBag, title);
          const memberCurrentHash = currentRec
            ? renderHash(nativeRender(title, [currentRec.tiddler as unknown as Record<string, unknown>]))
            : (memberSynced ?? "");   // no record → unmoved from base (fresh adoption / re-land, never phantom conflict)
          const decision = decideIngest<Record<string, unknown>>({
            uri:               title,
            diskText:          memberDiskText,
            diskHash:          memberDiskHash,
            syncedHash:        memberSynced,
            currentRenderHash: memberCurrentHash,
            hash:              renderHash,
            ...(unattended ? { unattended } : {}),
            recordsAbsent:     currentRec === null,
          }, memberOps);
          if (decision.kind === "noop") {
            memberResults.push({ title, decision: "noop", reason: decision.reason });
            nextMemberHashes[title] = memberDiskHash;      // content settled — the base tracks disk
            continue;
          }
          if (decision.kind === "conflict") {
            // Surface, never overwrite: leave the record untouched and HOLD the old base so
            // the conflict re-surfaces next scan (never a silent last-write-wins on this member).
            anyConflict = true;
            memberResults.push({ title, decision: "conflict", reason: decision.reason });
            // A `both-moved` conflict holds its base; a `no-base` one holds none, and none gets minted.
            if (memberSynced !== null) nextMemberHashes[title] = memberSynced;
            continue;
          }
          if (decision.kind === "refuse") {
            // Dormant for native (a native deserialize throws rather than grading); handled so
            // the shared shape stays total should a future native family grade its own faults.
            memberResults.push({ title, decision: "refuse", warnings: [...decision.warnings] });
            nextMemberHashes[title] = memberSynced ?? memberDiskHash;
            continue;
          }
          // ingest — the member's disk edit applies cleanly; land it under the changeId.
          await landInBag(access, action.toBag, { tiddler: member as LarTiddlerRecord["tiddler"], meta: {} }, action.changeId, o);
          memberResults.push(withWarnings({ title, decision: "ingest" }, shoreWarnings([member])));
          nextMemberHashes[title] = memberDiskHash;
          landedCount++;
        }

        // Members the re-ingest DROPPED from the file (in the prior membership, absent now)
        // tombstone — the aside path map alone holds a pack's prior shape (a pack's foreign-
        // titled members never nest under the carrier URI). A conflicted member stays a
        // CURRENT member → never dropped.
        const dropped = membersOfPack(prevPaths, packInfo.packPath).filter((t) => !currentMemberTitles.has(t));
        for (const t of dropped) await tombstoneIn(access, action.toBag, t, o);

        // Re-stamp BOTH sibling aside maps: membership (path) + per-member content-hash.
        const nextPaths = recordPack(prevPaths, packInfo.packPath, packInfo.members);
        await landInBag(access, action.toBag, {
          tiddler: { title: ORIGINAL_TIDDLER_PATHS, type: "application/json", text: serializeProvenance(nextPaths) } as LarTiddlerRecord["tiddler"],
          meta: {},
        }, action.changeId, o);
        const nextHashes = recordPackHashes(prevHashes, prevPaths, packInfo.packPath, nextMemberHashes);
        await landInBag(access, action.toBag, {
          tiddler: { title: ORIGINAL_TIDDLER_HASHES, type: "application/json", text: serializeHashes(nextHashes) } as LarTiddlerRecord["tiddler"],
          meta: {},
        }, action.changeId, o);

        // The TOP-LEVEL decision gates the whole-file synced hash (recordLandedPacks advances
        // it only on `ingest`): a per-member conflict flips it to `conflict`, so the pack's
        // whole-file base stays stale and the still-conflicted member re-runs next scan while
        // landed members echo-noop at member grain (the two gates nest — outer whole-file,
        // inner per-member).
        results.push({
          uri,
          decision: anyConflict ? "conflict" : "ingest",
          filetype: carrier.ext || "text/plain",
          pack: packInfo.packPath,
          landed: landedCount,
          tombstoned: dropped,
          members: memberResults,
        });
        continue;
      }

      // A SINGLE native carrier runs the SAME `decideIngest` Confluence gate a memetic carrier
      // does, parameterized by the NATIVE congruence (the shared `nativeRender` above IS the
      // `≈`). Native declares ∅ structure (the ahu-fidelity guard no-ops) and never grades
      // error (a native deserialize throws), so the gate's refuse + ahu legs ride dormant —
      // but native GAINS the conflict leg that forbids a silent last-write-wins overwrite over
      // a wiki-side edit.
      const nativeOps: IngestOps<Record<string, unknown>> = {
        deserialize: () => ({ records: freshRecords as ReadonlyArray<Record<string, unknown>>, diagnostics: [], declared: new Set<string>() }),
        render: nativeRender,
        declaredStructure: () => new Set<string>(),
        grade: () => "clean",
      };
      // The current render hash the gate compares against: the records' present carrier hash when
      // they hold this carrier, else the hash of NOTHING, as the memetic path reads an empty group. A
      // base never stands in for records that left: with no base the file lands as a fresh adoption
      // (rule 4½), and with a base the gate reads "the records moved" (they left) and stands off, so a
      // record a hand deleted never returns under a stale base.
      // A tombstoned record holds nothing live, as the memetic sink reads it: the carrier left.
      const held = await readFromBag(access, action.toBag, uri);
      const currentRec = held !== null && !held.meta?.deleted ? held : null;
      const currentRenderHash = currentRec
        ? renderHash(nativeRender(uri, [currentRec.tiddler as unknown as Record<string, unknown>]))
        : renderHash("");
      const decision = decideIngest<Record<string, unknown>>({
        uri,
        diskText:          carrierText,
        diskHash:          carrier.diskHash,
        syncedHash:        carrier.syncedHash,
        syncedRecordsHash: carrier.syncedRecordsHash ?? null,
        currentRenderHash,
        hash:              renderHash,
        ...(unattended ? { unattended } : {}),
        recordsAbsent:     currentRec === null,
      }, nativeOps);
      if (decision.kind === "noop") {
        // The records already say what the disk says: their standing render names the base's records side.
        results.push({ uri, decision: "noop", reason: decision.reason, ...(currentRec ? recordsSide(currentRenderHash) : {}) });
        continue;
      }
      if (decision.kind === "refuse") {
        // Dormant for native today (deserialize throws rather than grading); handled so the
        // shared shape stays total should a future native family grade its own faults.
        results.push({ uri, decision: "refuse", warnings: [...decision.warnings] });
        continue;
      }
      if (decision.kind === "conflict") {
        results.push({ uri, decision: "conflict", reason: decision.reason, filetype: carrier.ext || "text/plain", warnings: [conflictWhy(uri, decision.reason)] });
        continue;
      }
      freshRecords = decision.records as Array<Record<string, unknown>>;
      receipt = withWarnings({ uri, decision: "ingest", filetype: carrier.ext || "text/plain", ...recordsSide(renderHash(decision.canonicalText)) }, shoreWarnings(freshRecords));
    }

    const freshTitles = new Set<string>();
    for (const fields of freshRecords) {
      const title = typeof fields["title"] === "string" ? (fields["title"] as string) : "";
      if (!title) throw new Error(`INGEST: carrier ${uri} produced a record without a title`);
      const record: LarTiddlerRecord = { tiddler: fields as LarTiddlerRecord["tiddler"], meta: {} };
      await landInBag(access, action.toBag, record, action.changeId, o);
      freshTitles.add(title);
    }
    const tombstoned: string[] = [];
    for (const t of groupTitles) {
      if (!freshTitles.has(t)) {
        await tombstoneIn(access, action.toBag, t, o);
        tombstoned.push(t);
      }
    }
    // A PACK never reaches this shared tail — it reconciles per-member and records BOTH
    // aside maps above, then `continue`s. Only memetic + single-native carriers land here.
    results.push({ ...receipt, landed: freshTitles.size, tombstoned, ...(await landedHeads(access, action.toBag)) });
  }

  // ── apply the re-links ───────────────────────────────────────────────────
  // A rename re-homes the vanished carrier's whole group to the new URI, PRESERVING each record's
  // change-id (the re-link, never a fresh create). Nothing here removes a carrier the wave only named gone.
  for (const { fromUri, toUri } of renames) {
    const live = await listLiveTitlesInBag(access, action.toBag);
    let relinked = 0;
    for (const t of groupOf(live, fromUri)) {
      if (neverProjects(t)) continue;
      const rec = await readFromBag(access, action.toBag, t);
      if (!rec) continue;
      const newTitle = toUri + t.slice(fromUri.length);
      // DETACH before re-writing: a rename re-homes within the SAME bag/doc, so
      // rec's nested values (e.g. a `tags` array) ride as frozen doc references —
      // Automerge 3.x refuses to re-link an existing document object. structuredClone
      // detaches a fresh, mutable value (native; preserves Dates/typed-arrays a JSON
      // round-trip would lose). Cross-bag ADD reads a foreign doc, which clones fine,
      // so only this same-doc path needs it.
      const movedTiddler = structuredClone(rec.tiddler) as Record<string, unknown>;
      movedTiddler["title"] = newTitle;
      const moved: LarTiddlerRecord = {
        tiddler: movedTiddler as LarTiddlerRecord["tiddler"],
        meta: structuredClone(rec.meta ?? {}), // change-id preserved — identity survives the move
      };
      await writeIn(access, action.toBag, moved, o);
      await tombstoneIn(access, action.toBag, t, o);
      relinked++;
    }
    results.push({ uri: toUri, decision: "rename", from: fromUri, relinked });
  }

  return {
    sourceUri: action.sourceUri, toBag: action.toBag, changeId: action.changeId,
    carriers: results,
    ...(deletionSummary ? { deletions: deletionSummary } : {}),
    // THE WAVE'S HEADS: the target bag's document after every carrier of this wave landed. Rows that stay behind
    // the audit cap name no heads of their own; the gesture follows these through the view for them.
    ...(await landedHeads(access, action.toBag)),
  };
}

function origin(action: ResidencyAction): ChangeOrigin {
  return { kind: "lares-verb", requestId: action.requestId };
}

/** Read a bag's OWN Manifestation of title (or null if absent / bag unreachable). */
async function readFromBag(access: BagAccess, fromBag: string, title: string): Promise<LarTiddlerRecord | null> {
  const store = await access.read(fromBag);
  return store ? store.get(title) : null;
}

/** Write a record directly into the target bag's store. Fails loud when the bag
 *  has no writable store (no silent fall-through to the default writable). */
async function writeIn(access: BagAccess, bag: string, record: LarTiddlerRecord, o: ChangeOrigin): Promise<void> {
  const store = await access.write(bag);
  if (!store) throw new Error(`action-handler: target bag "${bag}" unreachable — no writable store (no silent misroute).`);
  await store.put(record, o);
}

/** Write whole families into the target bag's store as ONE change where the store writes atomically
 *  (`writeFamily`); a store that holds no family write takes the records one by one, in order. Fails
 *  loud when the bag has no writable store. */
async function writeFamilyIn(access: BagAccess, bag: string, records: readonly LarTiddlerRecord[], o: ChangeOrigin): Promise<void> {
  const store = await access.write(bag);
  if (!store) throw new Error(`action-handler: target bag "${bag}" unreachable — no writable store (no silent misroute).`);
  if (typeof store.writeFamily === "function") { await store.writeFamily(records, [], o); return; }
  for (const record of records) await store.put(record, o);
}

/** Tombstone (KĀPAE hide — shadows lower bags) a title in the bag's own store.
 *  For deliberate deletes (DELETE/DROP/CLEAR). Fails loud when unreachable. */
async function tombstoneIn(access: BagAccess, bag: string, title: string, o: ChangeOrigin): Promise<void> {
  const store = await access.write(bag);
  if (!store) throw new Error(`action-handler: target bag "${bag}" unreachable — cannot tombstone (no silent misroute).`);
  await store.tombstone(title, o);
}

/** HARD-remove (ABSENT — falls through to a lower bag) a title in the bag's own
 *  store, NOT a kāpae tombstone. The retract a MOVE source uses so a canonical
 *  copy beneath surfaces (residency-model anti-pattern #3). Fails loud unreachable. */
async function removeIn(access: BagAccess, bag: string, title: string, o: ChangeOrigin): Promise<void> {
  const store = await access.write(bag);
  if (!store) throw new Error(`action-handler: target bag "${bag}" unreachable — cannot remove (no silent misroute).`);
  await store.remove(title, o);
}

/** Copy a record into the target bag preserving change-id (Anti-pattern #1 defense). */
/** The bag skin of `MemeSink` — `placeMeme` over one bag's store, stamping the change origin. `bag`
 *  is user space: a read hands the record's fields back whole. */
function bagMemeSink(access: BagAccess, bag: string, changeId: string, o: ChangeOrigin): MemeSink {
  return {
    titles:    () => listLiveTitlesInBag(access, bag),
    read:      async (title) => ((await readFromBag(access, bag, title))?.tiddler as unknown as TiddlerFields | undefined),
    land:      (fields) => landInBag(access, bag, { tiddler: fields as LarTiddlerRecord["tiddler"], meta: {} }, changeId, o),
    tombstone: (title) => tombstoneIn(access, bag, title, o),
  };
}

async function landInBag(
  access: BagAccess,
  toBag: string,
  source: LarTiddlerRecord,
  changeId: string,
  o: ChangeOrigin,
): Promise<void> {
  const record: LarTiddlerRecord = {
    // Residency rides the destination doc itself: the store fires every change with its own bag on
    // the ENVELOPE, and the nalu stamps `$origin-bag` on the wiki side for the projector. `bag` is the
    // author's field and travels whole. Cross-bag = cross-doc, so the spread clones into a foreign
    // doc cleanly (no same-doc aliasing).
    tiddler: { ...source.tiddler },
    meta: { ...(source.meta ?? {}), changeId },
  };
  await writeIn(access, toBag, record, o);
}

/**
 * THE CHANGE-ID NAMES A TITLE'S LINEAGE. A transfer (ADD, COPY, a live MOVE) carries the SOURCE record's
 * id onto the destination: "same change, different bag". The gesture's own id names the ACT and rides the
 * receipt and the effect record. A source that carries no id takes the gesture's as its first.
 */
function lineageOf(source: LarTiddlerRecord, gestureChangeId: string): string {
  const own = source.meta?.changeId;
  return typeof own === "string" && own !== "" ? own : gestureChangeId;
}

async function executeAdd(action: AddAction, access: BagAccess): Promise<Record<string, unknown>> {
  const source = await readFromBag(access, action.fromBag, action.title);
  if (!source) throw new Error(`ADD: source bag ${action.fromBag} does not hold ${action.title}`);
  await landInBag(access, action.toBag, source, lineageOf(source, action.changeId), origin(action));
  return { title: action.title, fromBag: action.fromBag, toBag: action.toBag, changeId: action.changeId };
}

async function executeCopy(action: CopyAction, access: BagAccess): Promise<Record<string, unknown>> {
  const source = await readFromBag(access, action.fromBag, action.title);
  if (!source) throw new Error(`COPY: source bag ${action.fromBag} does not hold ${action.title}`);
  await landInBag(access, action.toBag, source, lineageOf(source, action.changeId), origin(action));
  return { title: action.title, fromBag: action.fromBag, toBag: action.toBag, changeId: action.changeId, mode: "overwrite" };
}

/** A memetic-wikitext carrier is a tiddler-GROUP keyed by its root: the root
 *  title itself plus every `#fragment` child and `/path` segment. Residency ops
 *  that touch a carrier MUST carry the whole group so a fragment never orphans
 *  from its root (the shared law the deletion, rename, and MOVE paths enforce). */
function groupOf(titles: readonly string[], root: string): string[] {
  return titles.filter((t) => t === root || t.startsWith(`${root}#`) || t.startsWith(`${root}/`));
}

async function executeMove(action: MoveAction, access: BagAccess): Promise<Record<string, unknown>> {
  const o = origin(action);
  // A bag never moves a title onto itself: landing and then retracting in one bag would delete the title.
  if (action.fromBag === action.toBag) throw new MoveWithinOneBagRefusal(action.title ?? "(the whole layer)", action.fromBag);
  if (action.title === undefined) return executeLayerMove(action, access, o);
  const rootRecord = await readFromBag(access, action.fromBag, action.title);
  if (rootRecord?.meta?.deleted) {
    // THE TOMBSTONE ROAD. The source record stands as a tombstone, so the move carries the delete down.
    // Everything gets read and refused BEFORE the first write: both bags must take a write, and the
    // target must hold the title (or the hand must have asked for a shadow).
    const sourceStore = await access.write(action.fromBag);
    if (!sourceStore) throw new Error(`MOVE: source bag "${action.fromBag}" unreachable — cannot retract its tombstone (no silent misroute).`);
    const targetRecord = await readFromBag(access, action.toBag, action.title);
    const targetHoldsTitle = targetRecord !== null && targetRecord.meta?.deleted !== true;
    if (!targetHoldsTitle && action.shadow !== true) throw new TombstoneTargetHoldsNothingRefusal(action.title, action.toBag);
    // The family reads from the SOURCE: the title's own tombstone plus every tombstone of its group there
    // (a store that lists none answers the title alone plus each group member the target holds live).
    const lister = (await access.read(action.fromBag)) as (LarTiddlerStore & { listTombstoned?: () => string[] }) | null;
    const sourceTombstones = typeof lister?.listTombstoned === "function"
      ? groupOf(lister.listTombstoned().filter((t) => !isEffectRecordUri(t)), action.title)
      : [];
    const family = new Set<string>([action.title, ...sourceTombstones]);
    if (typeof lister?.listTombstoned !== "function") {
      for (const t of groupOf((await listLiveTitlesInBag(access, action.toBag)).filter((x) => !isEffectRecordUri(x)), action.title)) {
        if ((await readFromBag(access, action.fromBag, t))?.meta?.deleted) family.add(t);
      }
    }
    // A member's delete takes place where the target holds that member; under a shadow ask every member
    // lands. A member the target does not hold stays a tombstone in the source and the answer names it.
    const carried: string[] = [];
    const left: string[] = [];
    for (const t of family) {
      if (t === action.title || action.shadow === true) { carried.push(t); continue; }
      const held = await readFromBag(access, action.toBag, t);
      if (held !== null && held.meta?.deleted !== true) carried.push(t); else left.push(t);
    }
    for (const t of carried) await tombstoneIn(access, action.toBag, t, o);
    for (const t of carried) await removeIn(access, action.fromBag, t, o);
    return {
      title: action.title, fromBag: action.fromBag, toBag: action.toBag, changeId: action.changeId,
      moved: carried.length, carried: "tombstone", shadow: action.shadow === true && !targetHoldsTitle,
      ...(left.length > 0 ? { left, note: `the target holds no record for ${left.length} tombstoned member(s) of this title's group; each stays a tombstone in ${action.fromBag}` } : {}),
    };
  }
  if (action.shadow === true) throw new ShadowRequiresTombstoneRefusal(action.title);
  // Carrier-group MOVE: a MOVE of a carrier root
  // carries its WHOLE group — root + #fragment + /path — so promotion publishes
  // a meme entire and never orphans a fragment from its root (#shore-law). The
  // same group law the deletion/rename path uses; a single-title move of one
  // record of a carrier was the latent bug this closes.
  const live  = await listLiveTitlesInBag(access, action.fromBag);
  const group = groupOf(live, action.title);
  if (group.length === 0) throw new Error(`MOVE: source bag ${action.fromBag} does not hold ${action.title}`);
  // Order: land the whole group first, then tombstone the source group. If a
  // land fails, the source stays intact (no orphaned deaccession); a tombstone
  // failure after land surfaces the error (the atomicity gap stands: a landed
  // group is not rolled back).
  let moved = 0;
  for (const t of group) {
    const source = await readFromBag(access, action.fromBag, t);
    if (!source) continue;
    // change-id identity survives the move: the root and each child keep their own (the record's
    // lineage); the gesture's id names the act in the effect record.
    await landInBag(access, action.toBag, source, lineageOf(source, action.changeId), o);
  }
  for (const t of group) {
    // RETRACT (hard-remove → ABSENT), never a kāpae tombstone: a MOVE relocates,
    // so the source falls through to wherever the carrier now lives below —
    // promotion working → canon reveals the canon copy, not a hide
    // (residency-model anti-pattern #3; kāpae shadows, absent falls through).
    await removeIn(access, action.fromBag, t, o);
    moved++;
  }
  return { title: action.title, fromBag: action.fromBag, toBag: action.toBag, changeId: action.changeId, moved };
}

/**
 * THE LAYER MOVE: a MOVE naming the two bags and no title promotes the WHOLE source layer, every live title it holds,
 * into the target in one act (W27: a write lands on a working layer, and canon takes it by promotion). A seed that
 * LOADed a holding onto a wiki's working layer cannot name what landed (the answer rides bounded; a memetic record
 * takes its name from its head), so promotion names the layer, never a list. Order as the titled road keeps it: every
 * title lands first, then each retracts (hard-remove, never a tombstone, so canon shows through below). The answer
 * names the bags and the count; the titles ride the effect records and the dry run's projection, never a list here.
 */
async function executeLayerMove(action: MoveAction, access: BagAccess, o: ChangeOrigin): Promise<Record<string, unknown>> {
  const titles = (await listLiveTitlesInBag(access, action.fromBag)).filter((t) => !isEffectRecordUri(t));
  const landed = new Map<string, string>();
  const land = async (t: string): Promise<boolean> => {
    const source = await readFromBag(access, action.fromBag, t);
    if (!source || source.meta?.deleted) return false;
    await landInBag(access, action.toBag, source, lineageOf(source, action.changeId), o);
    landed.set(t, canonicalJson(source.tiddler));
    return true;
  };
  for (const t of titles) await land(t);
  let moved = 0;
  for (const t of titles) {
    if (!landed.has(t)) continue;
    // A WRITE THAT LANDED ON THE LAYER BETWEEN THE LANDING AND THE RETRACTION IS NEVER LOST: the record is read once more
    // right before it leaves, and a version the landing did not carry lands first (the newer wins; the layer then empties).
    const now = await readFromBag(access, action.fromBag, t);
    if (now && !now.meta?.deleted && canonicalJson(now.tiddler) !== landed.get(t)) await land(t);
    await removeIn(access, action.fromBag, t, o); moved++;
  }
  return { fromBag: action.fromBag, toBag: action.toBag, changeId: action.changeId, moved };
}

export class TombstoneTargetHoldsNothingRefusal extends Error {
  readonly code = "TOMBSTONE_TARGET_HOLDS_NOTHING";
  constructor(title: string, bag: string) {
    super(`MOVE: ${title} in ${bag}: this bag does not hold the title; to hide it for everyone who composes this bag above its holders, ask for a shadow (--shadow)`);
    this.name = "TombstoneTargetHoldsNothingRefusal";
  }
}

export class MoveWithinOneBagRefusal extends Error {
  readonly code = "MOVE_WITHIN_ONE_BAG";
  constructor(title: string, bag: string) {
    super(`MOVE: ${title}: --from and --to both name ${bag}; a move needs two bags. Name the bag the title moves into.`);
    this.name = "MoveWithinOneBagRefusal";
  }
}

export class ShadowRequiresTombstoneRefusal extends Error {
  readonly code = "SHADOW_REQUIRES_TOMBSTONE";
  constructor(title: string) {
    super(`MOVE: ${title}: --shadow rides a tombstone alone; source record is live. Choose a tombstone source or omit --shadow.`);
    this.name = "ShadowRequiresTombstoneRefusal";
  }
}

async function executeClear(action: ClearAction, access: BagAccess): Promise<Record<string, unknown>> {
  // M11: the audit log survives CLEAR. Enumerate CONTENT titles only — the
  // bag's own effect-record ledger (`isEffectRecordUri`) never tombstones, so
  // a second CLEAR on an already-cleared bag answers clearedCount:0 while the
  // first CLEAR's `bag-cleared` record still reads visible.
  const titles = (await listLiveTitlesInBag(access, action.bag)).filter((t) => !isEffectRecordUri(t));
  const o = origin(action);
  for (const title of titles) {
    await tombstoneIn(access, action.bag, title, o);
  }
  return { bag: action.bag, clearedCount: titles.length };
}

async function executeDrop(action: DropAction, access: BagAccess): Promise<Record<string, unknown>> {
  // DROP tombstones contents (same as CLEAR) and the `bag-retired` marker (written by the
  // reactor under the fixed RETIRED_EVENT_ID) retires the bag: write verbs refuse it by name, and
  // CREATE reads it as absent and re-points the registry row to a fresh doc. The registry row
  // STAYS: it is the name's only pointer to the retired doc, whose ledger "never leaves" (the
  // deaccession record persists with the bag), and it is what lets a write be refused BY NAME
  // rather than as a generic unreachable bag. Recipes are wiki-owned, and one bag can sit in many
  // recipes, so a recipe slot is the wiki's own edit (`lares wiki remove-bag`), never a bag verb's.
  //
  // M11: the audit log survives DROP too — the same content-only filter CLEAR
  // uses, so the bag's ledger (including the `bag-retired` disposition this
  // very DROP writes via withEffectRecord) never gets tombstoned.
  const titles = (await listLiveTitlesInBag(access, action.bag)).filter((t) => !isEffectRecordUri(t));
  const o = origin(action);
  for (const title of titles) {
    await tombstoneIn(access, action.bag, title, o);
  }
  return { bag: action.bag, retiredCount: titles.length, note: "bag retired; writes refuse until CREATE stands a fresh bag; recipe-edit removes a wiki's slot" };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Enumerate live tiddler titles residing in `bag` — read from the bag's OWN
 *  store (its Manifestations), independent of any cascade shadowing. Empty when
 *  the bag is unreachable. */
async function listLiveTitlesInBag(access: BagAccess, bag: string): Promise<string[]> {
  const store = await access.read(bag);
  return store ? store.listVisible() : [];
}
