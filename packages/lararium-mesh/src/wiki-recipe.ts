/**
 * wiki-recipe — one-model recipe spec for every wiki.
 *
 * Slot order = cascade order. Top of stack wins (TW5 cascade law). The live
 * "above the fold" layers are PER-WIKI (each rooted at the wiki's own identity),
 * never global singletons — the address names the wiki (see wikiSlotUri):
 *
 *   wikis/{slug}/temp     — volatile, in-memory, $:/temp/* lives here
 *   wikis/{slug}/draft    — "Draft of …" tiddlers, CRDT, high-churn (unsaved)
 *   wikis/{slug}/personal — operator cross-device viewing state ($:/StoryList,
 *                            $:/state/folded/*, $:/state/tab-*), CRDT. The doc a
 *                            slot binds to is keyed per (PersonaGroup × recipe-
 *                            fingerprint) by the vessel resolver; the slot URI carries
 *                            the address, the resolver hands over the per-fingerprint doc.
 *   wikis/{slug}/working  — the SAVED live write layer, CRDT; normal edits route here
 *   bags/{slug}           — the wiki's CANON bag (read-only from the wiki), published
 *                            to only by a promotion MOVE (shore-law)
 *   libraryBags[]          — optional content libraries, CRDT; each lays its flags from
 *                            `slotLayerFlags`, which writes every slot but the floor
 *                            (the lares wiki-recipe carries the live lararium bag here)
 *   oracle                 — the floor's read-face, READ-ONLY, under every recipe: the pinned
 *                            history-free lares and lararium snapshots a manifest CID names
 *                            (`floor-manifest.ts`), over the live seed rows (engine core,
 *                            plugins, grammar, bag-oracle)
 *
 * Every wiki reads the lares and lararium carriers through the floor, and an edit aimed there copies
 * up into the wiki's working layer. The system wikis themselves still compose their live documents:
 * the lares wiki-recipe = oracle floor + live lararium + its own live lares canon.
 * The memetic-wikitext plugin rides the oracle island (CID-frozen), so it is universal.
 *
 * Above-stack projections defer (separate concern). When they land they will
 * subscribe to nalu events, not participate in the cascade.
 *
 * Schema: lar:///ha.ka.ba/lares/api/lararium/wiki-recipe
 */

import type { Heads } from "@automerge/automerge";
import type { LarTiddlerRecord } from "./tiddler-store.js";
import { ORACLE_DOC_URI, LARARIUM_DOC_URI, LARES_DOC_URI, CROSSROADS_DOC_URI, bagUri, wikiUri } from "./lar-uris.js";
import { bagStackFromRec } from "./bag-stack-from-rec.js";
import { requireLarDid, type LarDid } from "./lar-did.js";

/** A slot URI in the lar:///ha.ka.ba/{bags,wikis}/@<name> namespace. */
export type SlotUri = string;

/**
 * The live "above the fold" layers a wiki #has — each rooted at the wiki's
 * IDENTITY (`wikis/{slug}`), never its canon bag. The binding is per-wiki
 * (PersonaGroup × recipe-fingerprint); the URI now names the wiki too, so which
 * wiki a layer belongs to reads from its address.
 *
 *   wikis/{slug}/temp     — volatile, in-memory, $:/temp/* lives here
 *   wikis/{slug}/draft    — "Draft of …" tiddlers, CRDT, high-churn (unsaved)
 *   wikis/{slug}/working  — the SAVED live write layer, CRDT; normal edits route
 *                            here, canon publishes on a promotion MOVE (shore-law)
 *   wikis/{slug}/personal — operator cross-device viewing state ($:/StoryList,
 *                            $:/state/folded/*), CRDT
 */
export type WikiSlotKind = "temp" | "draft" | "working" | "personal";

/** Mint a per-wiki live slot URI (`wikis/{slug}/{kind}`). The one source both
 *  `expandRecipe` (island cascade) and `recipeHostFacets` (host projection) walk,
 *  so host and island name identical layers. */
export function wikiSlotUri(slug: string, kind: WikiSlotKind): SlotUri {
  return `${wikiUri(slug)}/${kind}`;
}

export const LARES_BAG    = LARES_DOC_URI;
export const LARARIUM_BAG = LARARIUM_DOC_URI;
/** oracle — the runtime system island; the universal floor of every recipe. */
export const ORACLE_BAG   = ORACLE_DOC_URI;
/** crossroads — the public oracle plane; a recipe library bag whose pointer the oracle plane serves (public infra). */
export const CROSSROADS_BAG = CROSSROADS_DOC_URI;

/** The SYSTEM bags — their doc pointers ride the oracle plane's well-known tiddlers, never the catalog
 *  registry. Every other bag resolves from the catalog. The one spelling the island kernel, recipe-watch
 *  and the slot-doc resolver read. */
export const SYSTEM_BAGS: ReadonlySet<string> = new Set([ORACLE_BAG, LARARIUM_BAG, LARES_BAG]);

/** Build a wiki's CANON BAG URI from a slug (`bags/{slug}`) — the published,
 *  promotion-target content plane, read-only from the wiki. MUST agree with the
 *  doc consts (DAEMON_BAG_ID etc), which the daemon's composite mount and its
 *  event-store put both key on. */
export function wikiBagUri(slug: string): SlotUri {
  return bagUri(slug) as SlotUri;
}

/** The per-wiki draft layer (`wikis/{slug}/draft`) — above the fold, the live
 *  edit plane, never the canon bag. */
export function wikiDraftBagUri(slug: string): SlotUri {
  return wikiSlotUri(slug, "draft");
}

/** The catalog registry key of a wiki's draft FLOOR doc (`wikis/{slug}/drafts/{did}`) — the doc the
 *  draft slot binds to while this vessel holds no seat in a PersonaGroup ("a private device so far",
 *  `resolveSlotDoc`). ONE spelling for the resolver and every reader. The DID carries the one
 *  spelling (`didFromVerifyingKey`); any other refuses loud, so no host keys a floor under a name the
 *  others cannot find. */
export function wikiDraftDocKey(slug: string, vesselDid: LarDid): SlotUri {
  return `${wikiUri(slug)}/drafts/${encodeURIComponent(requireLarDid(vesselDid, "wikiDraftDocKey"))}`;
}

/** Who reaches a slot's doc — the `face-reach` field every binding record carries: `face` when the
 *  doc delegates to the PersonaGroup (fleet-synced), `vessel-only` when it rides the vessel's own
 *  key alone (the floor — a private device so far). */
export type SlotReach = "face" | "vessel-only";

/** The ports the ONE slot-doc law resolves through. Each site supplies what it holds; the law stays. */
export interface SlotDocPorts {
  /** Whether the face this vessel pins holds a SEAT the vessel can delegate to. */
  readonly seated: () => Promise<boolean>;
  /** The PersonaGroup × recipe-fingerprint binding — minted and delegated on absent. */
  readonly faceDoc: () => Promise<string>;
  /** The device floor — the doc keyed by this vessel's DID; minted on absent, delegated to nobody. */
  readonly floorDoc: () => Promise<string>;
}

/**
 * THE ONE SLOT-DOC LAW. One doc reaches the fleet WHEN the vessel holds a seated PersonaGroup cap;
 * ELSE the slot falls to the device floor — and says so. It never refuses for want of a group: the
 * cap-stack falls to the floor, never reds. A seat that lands later resolves the face doc from then
 * on; the floor stays what it was, a private device's own.
 */
export async function resolveSlotDoc(ports: SlotDocPorts): Promise<{ url: string; reach: SlotReach }> {
  const seated = await ports.seated().catch(() => false);
  if (seated) return { url: await ports.faceDoc(), reach: "face" };
  return { url: await ports.floorDoc(), reach: "vessel-only" };
}

/** The instance-slot kind a URI names for `slug`, or null when it names none (a canon or library bag). */
export function wikiSlotKindOf(slug: string, uri: string): WikiSlotKind | null {
  for (const kind of WIKI_SLOT_KINDS) if (uri === wikiSlotUri(slug, kind)) return kind;
  return null;
}

/**
 * The host-side facets of a wiki, projected from its slug — the SAME minters
 * `expandRecipe` walks, so the VM-free host composite and the island cascade name
 * identical bags. This REPLACES the bespoke `planActiveWikiSlot`: one slug, one
 * set of slot minters, every context (node vessel, browser vessel, future) flows
 * through it (the isomorphic core — a wiki recipe is a nameless-entity #has-cap-stack).
 * The draft slot's DOC is no facet of the slug: the daemon's slot-doc resolver names it
 * (`resolveSlotDoc`), and the host mount reads through that resolver.
 */
export interface WikiHostFacets {
  readonly wikiSlug: string;
  /** IDENTITY — `wikis/{slug}`, the catalog registry key for the wiki itself. */
  readonly wikiKey: string;
  /** CANON — `bags/{slug}`, the write/canon content doc the host resolves + registers. */
  readonly wikiBagId: string;
  /** The per-wiki draft layer bagId (`wikis/{slug}/draft`). */
  readonly draftBagId: string;
  /** The per-wiki working layer bagId (`wikis/{slug}/working`) — the default writable. */
  readonly workingBagId: string;
}

/** Project a wiki's host-side facets from its slug. */
export function recipeHostFacets(wikiSlug: string): WikiHostFacets {
  return {
    wikiSlug,
    wikiKey:      wikiUri(wikiSlug),
    wikiBagId:    wikiBagUri(wikiSlug),
    draftBagId:   wikiSlotUri(wikiSlug, "draft"),
    workingBagId: wikiSlotUri(wikiSlug, "working"),
  };
}

/**
 * Extract the slug from a lar URI of the form `lar:///ha.ka.ba/bags/<slug>`.
 * Falls back to the input string for malformed inputs (callers can detect
 * by comparing input === slugFromUri(input) — true means malformed).
 */
export function slugFromUri(uri: string): string {
  // IT READS WHAT `wikiUri` AND `bagUri` MINT. Both spell the kind-plane segment — `wikis/slug`,
  // `bags/slug` — so a pattern demanding a bare `@` at the root matches nothing either one produces, and
  // every real address falls through to the malformed arm below and returns whole where a caller expects a
  // bare slug. The segment is optional here because a wiki id also travels as the bare slug itself.
  const match = /^lar:\/\/\/ha\.ka\.ba\/(?:bags\/|wikis\/)?@([^/]+)/.exec(uri);
  return match ? match[1]! : uri;
}

/**
 * WikiRecipe — the one shape that fits every wiki under the sun.
 *
 *   daemonRecipe: { wikiSlug: "daemon" }
 *   sdmRecipe:   { wikiSlug: "synthetic-dream-machine",
 *                  libraryBags: ["lar:///ha.ka.ba/bags/sdm", "lar:///ha.ka.ba/bags/ftls"] }
 */
export interface WikiRecipe {
  /** Identity slug; expands to lar:///ha.ka.ba/bags/<wikiSlug>. */
  readonly wikiSlug: string;
  /**
   * Canon content bag URIs, ordered top→bottom within the canon slot —
   * libraryBags[0] wins ties over libraryBags[1]. Read-only from this wiki.
   */
  readonly libraryBags?: readonly SlotUri[];
  /**
   * Canon bag URIs this wiki DESIGNATES for local disk projection (write-back).
   * A synced, platform-neutral *wish* (the shape half of disk-mirroring). The
   * island materializes a mirror for a designated bag IFF it also holds the
   * disk-write capability — a node pool's construction grant (`diskMirrorGrant`);
   * a browser leaf holds none and silently ignores the designation. The list
   * alone grants nothing: the unforgeable authority lives in the held grant,
   * never in this recipe (a plaintext flag any peer could write must not confer
   * authority — OCAP "don't separate designation from authority").
   */
  readonly mirrorBags?: readonly SlotUri[];
  /**
   * Optional bag PINS — Anti-pattern #5 defense (recipe-drift poisoning).
   * Each pinned slot carries an Automerge Heads array naming the expected state.
   * When a slot carries a pin, `CompositeStore.auditPins(recipe)` reports
   * the drift state per bag; `resolveAllRespectingPins(recipe, title)` skips
   * drifted bags from the read path. Default reads (`resolveAll` / `get` /
   * `resolveTopmost`) stay unaffected — opt-in by call site.
   * Default null/absent = unpinned.
   */
  readonly bagPins?: ReadonlyMap<SlotUri, Heads>;

  /**
   * THE RECIPE'S PLUGIN LIST — an ORDERED list of whole signed plugin-offering CIDs
   * (`pluginOfferingCid`, from `./plugin-offering.js`). "A recipe selects ordered whole signed
   * offerings, never subsets" (the ki-handoff ruling): mount resolves each CID through the
   * Crossroads board, verifies it (signature + `pluginsCid` fold), and passes only the resulting
   * blob set to the island — through `selectPluginBlobs` (`./plugin-offering-selector.js`), never
   * by reading a half-trusted list straight off the record.
   *
   * ORDER IS MEANINGFUL: first offering's blobs win a plugin-id collision inside the selection
   * (the selector refuses a collision instead — see that module's docblock — so order names
   * precedence for everything EXCEPT the one case the selector already fails closed on).
   *
   * Absent or empty = no optional plugins load. This list never NAMES the Lararium boot set
   * (engine core, memetic-wikitext grammar, boot shadows) — a blob id inside the fixed floor
   * refuses the WHOLE selection as `boot-set-collision` (M3), so no recipe can shadow it. The
   * floor's OWN computation stays independent of any recipe (it travels through `coreHash` plus
   * a fixed-blob derivation off the island doc); a per-island resolver then folds that floor
   * together with THIS recipe's verified selection into the one `pluginCids` the manifest
   * carries (see `island-protocol.ts`'s `IslandMsg_Manifest.pluginCids` docblock) — the recipe
   * never SOURCES the floor, even though the wire field ends up carrying both.
   */
  readonly pluginOfferings?: readonly string[];
  /**
   * M2 — a `plugin-offerings` field this record cannot honestly parse (a bare number, an array
   * carrying a non-string entry, or any other shape `parsePluginOfferings` refuses) names its OWN
   * refusal here instead of THROWING `recipeFromRecord` itself. A throw there bricks every caller
   * equally — the vessel's primary mount at boot, the grain swap, and `meme get`'s bag-cascade
   * walk — even though a torn plugin field belongs to THIS wiki's plugin resolution alone, never
   * to its bag reads or to the vessel as a whole.
   *
   * Present → the resolver (`node-plugin-resolution.ts`'s `resolveNodeIslandPluginCids`) refuses
   * THIS wiki's mount by name (`malformed-offerings-field`), and nothing else in the cascade
   * notices: `expandRecipe` and `meme get`'s walk read the library bags exactly as they would with
   * no fault at all. Absent = this record's `plugin-offerings` field parsed cleanly (whether it
   * named offerings or none).
   */
  readonly pluginOfferingsFault?: string;
}

// ── Heads comparison helpers ────────────────────────────────────────────────

/**
 * Set-semantic equality for Automerge Heads.
 *
 * **Why set-semantics:** Automerge `Heads` is a
 * mathematical *set* of change hashes — the DAG frontier — but the API
 * returns it as a string[]. Order is not contractually deterministic across
 * save/load or across implementations. Prior Automerge bugs traced to
 * order-sensitive heads comparison causing sync loops. Always compare as
 * sorted arrays or sets. See:
 *   - https://github.com/automerge/automerge/releases (heads-arg correctness fix)
 *   - https://github.com/automerge/beelay/blob/main/docs/protocol.md (sorted-then-hashed)
 */
export function headsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  // Sort once then compare; cheap for typical frontier size (1–3 entries).
  const sa = [...a].sort();
  const sb = [...b].sort();
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}

/**
 * BagPinState — per-bag pin status returned by `CompositeStore.auditPins`.
 *
 *   unpinned  — the recipe carries no pin for this bag
 *   matched   — current bag heads equal the pinned heads (set-semantically)
 *   drifted   — current heads differ from pinned (bag moved since pin)
 *   absent    — pinned bag has no layer registered on this composite
 *   opaque    — bag layer exists but cannot expose heads (e.g. MemoryTiddlerStore)
 *
 * Default policy: audit-only. Operators read the audit; downstream consumers
 * MAY refuse, time-travel via `view(pinnedHeads)`, or warn. Loud silent
 * refusal at the read path stays out of scope per the
 * residency-model deferred-enactment design (modal-view reader belongs to
 * a follow-up sprint with explicit "detached" operator UX).
 */
export type BagPinState =
  | { readonly state: "unpinned" }
  | { readonly state: "matched";  readonly heads:  readonly string[] }
  | { readonly state: "drifted";  readonly pinned: readonly string[]; readonly current: readonly string[] }
  | { readonly state: "absent" }
  | { readonly state: "opaque" };

/**
 * Full expanded slot order — top of array = highest priority (first wins).
 * Iterating bottom→top (reverse) gives the addLayer order for CompositeStore.
 */
export function expandRecipe(r: WikiRecipe): readonly SlotUri[] {
  const slug = r.wikiSlug;
  // Deduped: when the wiki's OWN canon bag coincides with a structural slot (the
  // lares-as-wiki quine — slug "lares" → wikiBagUri = LARES_BAG), the slot
  // lays ONCE, at its highest-priority position.
  return [...new Set<SlotUri>([
    wikiSlotUri(slug, "temp"),
    wikiSlotUri(slug, "draft"),
    wikiSlotUri(slug, "personal"),
    // working = the live write layer (normal edits route here via the
    // current-wiki-bag cascade); the wiki's own bags/{slug} canon rides BELOW as
    // the read-only library member, published to only by a promotion MOVE
    // (wiki-layer-ontology#shore-law). Working (live) and canon stay distinct layers.
    wikiSlotUri(slug, "working"),
    wikiBagUri(slug),
    ...(r.libraryBags ?? []),
    // oracle = the universal floor (engine + grammar + bag-oracle). The lares and
    // lararium bags never stand as the floor — they ride a wiki's libraryBags (the lares
    // wiki-recipe = oracle floor + lararium bag + lares bag).
    ORACLE_BAG,
  ])];
}

/** The working slot is the only default writable; an absent handle leaves no default writable. */
export function defaultWritableSlot(slug: string): SlotUri {
  return wikiSlotUri(slug, "working");
}

/**
 * The layer flags a slot registers with. Every slot is writable except the oracle floor: the floor is
 * the system island every vessel shares, so a wiki mounts it read-only and an edit aimed at it copies
 * UP into the wiki's default writable (Law 4) — the floor's one writer is the node home, by handle.
 * `defaultWritable` marks `defaultWritableSlot` alone; every other layer registers `false` so the
 * last-registered temp store never takes the office.
 */
export function slotLayerFlags(slot: SlotUri, slug: string): { writable: boolean; defaultWritable: boolean } {
  return { writable: slot !== ORACLE_BAG, defaultWritable: slot === defaultWritableSlot(slug) };
}

/** The four INSTANCE slots — minted per (PersonaGroup × fingerprint) by the resolver, threaded
 *  through the manifest as grants, never named in a recipe record. */
export const WIKI_SLOT_KINDS: readonly WikiSlotKind[] = ["temp", "draft", "personal", "working"];

/**
 * The slots the recipe model owns STRUCTURALLY for a wiki — the four instance slots, the wiki's own
 * canon bag, and the oracle floor. Everything else in a cascade counts as a LIBRARY bag: the set a
 * recipe record's `bag-stack` names and a live reconcile diffs. The one spelling `recipeFromRecord`,
 * `recipeRecordFields` and recipe-watch all read.
 */
export function structuralSlots(slug: string): ReadonlySet<SlotUri> {
  return new Set<SlotUri>([...WIKI_SLOT_KINDS.map((k) => wikiSlotUri(slug, k)), wikiBagUri(slug), ORACLE_BAG]);
}

/**
 * The mount struct a recipe RECORD describes: its `bag-stack` (bottom→top) minus the structural
 * slots, read top-first as `libraryBags`. `expandRecipe(recipeFromRecord(rec, slug))` lays exactly
 * the bags the record names, in the record's order, with the instance slots above.
 */
export function recipeFromRecord(rec: LarTiddlerRecord, slug: string): WikiRecipe {
  const structural = structuralSlots(slug);
  const libraryBags = bagStackFromRec(rec).filter((uri) => !structural.has(uri)).reverse();
  // M2 — a torn plugin-offerings field names ITS OWN fault rather than throwing out of this
  // function: the bag-stack walk above (and every other field this record carries) stays
  // unaffected by a plugin-offerings parse failure. `parsePluginOfferings` keeps throwing (its own
  // contract, unit-tested directly); this is the ONE catch boundary between that throw and every
  // caller who must never brick over a plugin fault alone.
  let pluginOfferings: readonly string[] = [];
  let pluginOfferingsFault: string | undefined;
  try {
    pluginOfferings = parsePluginOfferings(rec.tiddler["plugin-offerings"]);
  } catch (err) {
    pluginOfferingsFault = err instanceof Error ? err.message : String(err);
  }
  return {
    wikiSlug: slug,
    ...(libraryBags.length > 0 ? { libraryBags } : {}),
    ...(pluginOfferings.length > 0 ? { pluginOfferings } : {}),
    ...(pluginOfferingsFault !== undefined ? { pluginOfferingsFault } : {}),
  };
}

/**
 * Parse a `plugin-offerings` tiddler field — a TW5 list string (space-separated; no spaces
 * appear in a `sha256:`-prefixed CID so no `[[...]]` quoting) or a JS/JSON array, exactly the
 * `bag-stack` convention (`bag-stack-from-rec.ts`). ORDER IS PRESERVED (no reverse): unlike
 * `bag-stack`, this list carries no cascade-vs-storage inversion — the record's order IS the
 * recipe's order.
 *
 * FAIL-CLOSED (M4): returns [] ONLY for an absent field (null/undefined — "this record names no
 * offerings"). Any OTHER shape the field cannot honestly carry THROWS rather than silently
 * normalizing into an empty or trimmed list — a non-string array entry, or a field that is
 * neither a string nor an array, is a torn record, never an empty recipe. REFINEMENT 7:
 * "an absent offering never reads as an empty or successful recipe" extends here to the FIELD
 * itself — a malformed field must never read as an empty one either.
 */
export function parsePluginOfferings(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed.length ? trimmed.split(/\s+/) : [];
  }
  if (Array.isArray(raw)) {
    return raw.map((entry, i) => {
      if (typeof entry !== "string") {
        throw new Error(`plugin-offerings[${i}] is a ${typeof entry}, not a string — a malformed entry refuses rather than being silently dropped`);
      }
      return entry;
    });
  }
  throw new Error(`plugin-offerings field is a ${typeof raw}, neither a list string nor an array — a malformed field refuses rather than reading as an empty recipe`);
}

/**
 * The record fields a minter writes for a recipe — the inverse of `recipeFromRecord`. `bag-stack`
 * is the expanded cascade bottom-up minus the instance slots (the oracle floor, the libraries, the
 * wiki's own canon); `writable-bag` names the working slot, the ONE default writable the mount lays.
 * The catalog registry never rides a bag-stack: it is an ACCESS grant, never a layer. `plugin-offerings`
 * carries the ordered CID list verbatim — present only when the recipe names at least one offering, so
 * an unadorned recipe round-trips with no stray empty field.
 */
export function recipeRecordFields(
  r: WikiRecipe,
): { label: string; "bag-stack": string; "writable-bag": string; "plugin-offerings"?: string } {
  const instance = new Set<SlotUri>(WIKI_SLOT_KINDS.map((k) => wikiSlotUri(r.wikiSlug, k)));
  const stack = [...expandRecipe(r)].reverse().filter((uri) => !instance.has(uri));
  return {
    label: r.wikiSlug,
    "bag-stack": stack.join(" "),
    "writable-bag": wikiSlotUri(r.wikiSlug, "working"),
    ...(r.pluginOfferings?.length ? { "plugin-offerings": r.pluginOfferings.join(" ") } : {}),
  };
}

// Write routing happens via the in-wiki `lar:///ha.ka.ba/lararium/config/bag-paths` cascade
// (IslandAdaptor._routeBag walks it). The cascade evaluates filter expressions
// against the saving tiddler — first non-empty result is the target slot URI.
// Operator-configurable at runtime; per-wiki overlays compose via the recipe
// cascade. See: lar:///ha.ka.ba/lares/api/lararium/bag-paths-cascade

// ── Recipe fingerprint ──────────────────────────────────────────────────────

import { sha256Hex, canonicalJsonBytes, defaultCryptoProvider, type DigestProvider } from "./crypto.js";

/**
 * Recipe-fingerprint input — the canonical bag-doc-id set that names "the
 * same recipe" for purposes of cross-device personal binding.
 *
 * Fingerprint algorithm (personal-slot): only the wiki bag
 * doc-id and the libraryBags doc-ids participate. The lares and lararium bag
 * doc-ids do NOT participate — switching personality or system bag does
 * not fork operator view state across devices.
 */
export interface RecipeFingerprintInput {
  /** The wiki canon bag's Automerge doc URL (grants.wikiUrl = bags/{slug}). */
  readonly wikiDocId: string;
  /** Library bag doc URLs in any order — sorted internally before hashing. */
  readonly libraryBagDocIds: readonly string[];
}

/**
 * Compute the recipe-fingerprint for `personal` / `draft` binding.
 *
 * SHA-256 hex over canonical JSON of `{ wikiDocId, libraryBagDocIds: sorted }`.
 * Two devices share an `personal` binding iff their `(PersonaGroup ×
 * fingerprint)` pairs match. The vessel stores `personal` doc URLs keyed by
 * this fingerprint.
 *
 * Sort-stability: the doc-ids get sorted before hashing so caller ordering
 * does not change the fingerprint. `canonicalJson` sorts object keys for
 * further stability.
 *
 * @see lar:///ha.ka.ba/lararium/api/personal-slot#/questions Q4
 */
export async function computeRecipeFingerprint(
  input: RecipeFingerprintInput,
  provider: DigestProvider = defaultCryptoProvider,
): Promise<string> {
  const canonical = {
    wikiDocId:        input.wikiDocId,
    libraryBagDocIds: [...input.libraryBagDocIds].sort(),
  };
  return sha256Hex(canonicalJsonBytes(canonical), provider);
}

// ── WikiMountSpec — the isomorphic wiki-island mount spec ──────────────────
//
// One shape both vessel pools take (node VesselIslandPool + browser
// BrowserVesselIslandPool). Divergence rides in the DATA (the recipe's
// `mirrorBags` designation) and in the island's held CAPABILITIES (a node
// pool's `diskMirrorGrant`), never in the method's shape. The caller hands
// typed structural grants; the island resolves library bags from the catalog registry
// itself and reads TW5 core + plugins from the lararium CRDT doc after sync.
export interface WikiMountSpec {
  /** SHA-256 hex of the TW5 core blob. null = pre-CAS; island resolves bytes from the mesh. */
  coreHash: string | null;
  /** WikiRecipe slot structure (wikiSlug + optional libraryBags + mirrorBags). */
  recipe: WikiRecipe;
  /** Typed structural capabilities (engine doc, own bag, personal/draft, catalog registry access). */
  grants: import("./island-protocol.js").IslandGrants;
}
