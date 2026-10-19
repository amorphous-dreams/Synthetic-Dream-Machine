/**
 * surface-recipe — the one function that resolves a session's effective recipe when a surface mounts.
 *
 * A grant decides what a face CAN read; a recipe decides what a session DOES mount. This function joins the
 * two at one moment, the surface mount, and returns absolute ids and a revision. Node and browser share it;
 * neither platform resolves a recipe of its own. The owner then opens the session's scoped document view over
 * exactly the documents this function names, and the island pool keys the island by its revision.
 *
 * The invariants:
 *   · ABSOLUTE IDS LEAVE, NAMES STAY. Every slot leaves with the document it resolved to. A mounted island
 *     lays those documents and resolves nothing afterwards, so it never hot-swaps: a recipe write reaches
 *     the NEXT mount, through this function, and never a live one.
 *   · A RECIPE NARROWS A VIEW AND NEVER WIDENS A GRANT. A recipe that names a bag the face may not read
 *     refuses the mount by that bag's name. Nothing mounts a bag by leaving the grant unasked.
 *   · THE REVISION NAMES THE RESOLVED RECIPE. It digests the slots with their documents, the engine core and
 *     the plugin selection. Two mounts share a revision exactly when they would lay the same island.
 *   · ONE DOCUMENT STANDS IN ONE LAYER. A recipe whose slots, or whose face planes, name one document under
 *     two layers refuses: the looser layer's write bound would answer for the stricter one.
 *   · A REFUSAL NAMES ITS CAUSE. An unknown wiki, a torn record, an unreadable bag, an unresolved floor, a
 *     refused plugin selection and an unknown profile each answer by name, and none reads as an empty or
 *     narrower recipe.
 *   · THE WORKING LAYER'S ADDRESS ARRIVES AS AN INPUT. This function asks the face for each live slot's
 *     document and derives none (lar:///ha.ka.ba/lares/api/pono/session-contract#/the-working-layer).
 *
 * Pure but for the plugin inputs' byte reads: no Repo, no key, no signer, no timer, no clock.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/session-contract#/the-effective-recipe
 */
import { interpretAsDocumentId, type AutomergeUrl } from "@automerge/automerge-repo";
import { tiddlerText } from "./base-doc.js";
import { plainRecordOrNull, type StoredLarRecord } from "./stored-value.js";
import type { LarTiddlerRecord } from "./tiddler-store.js";
import { bootSetIds, bootSetPluginCids, verifyCasBytesAsync, type CasBlobLike } from "./cas.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { GENESIS_FLOOR_TIDDLER, readFloorManifest } from "./floor-manifest.js";
import { wikiUri } from "./lar-uris.js";
import { selectPluginBlobs, selectedPluginCids, type OfferingLookup } from "./plugin-offering-selector.js";
import { effectiveRecipe, type RecipePlane } from "./recipe-planes.js";
import { isCapabilityProfile, type CapabilityProfile } from "./session-contract.js";
import type { DocumentFacet, FacetLayer, SessionDocumentFacets } from "./session-document-view.js";
import {
  ORACLE_BAG, expandRecipe, recipeFromRecord, wikiBagUri, wikiSlotKindOf,
  type SlotUri, type WikiRecipe, type WikiSlotKind,
} from "./wiki-recipe.js";

/** The live slots that hold a document. `temp` holds none: it stays in the island's memory. */
export type LiveSlotKind = Exclude<WikiSlotKind, "temp">;

/** The vessel's recipe records, read off its own replicas of the two registry planes. */
export interface VesselRecipePlanes {
  /** One plane's record at a title, straight off the plane's document, or nothing. */
  read(plane: RecipePlane, title: string): StoredLarRecord | null | undefined;
  /** The oracle floor's own document. */
  readonly oracleDocument: string;
}

/** The session's verified face, as the resolver reads it. */
export interface SurfaceFace {
  /** The absolute id of the plane the face stands in. The island pool keys on it. */
  readonly facePlaneId: string;
  /** The face's own planes, each under its absolute name. */
  readonly planes: readonly { readonly name: string; readonly document: string }[];
  /** The document of one live slot of one wiki under this face, or null when the face holds none. */
  slotDocument(wikiId: string, kind: LiveSlotKind): string | null;
}

/** What the plugin selection reads: the fixed floor's blobs, the offering board, and the local content store. */
export interface SurfacePluginInputs {
  readonly coreHash:    string | null;
  readonly islandBlobs: Record<string, CasBlobLike> | undefined;
  readonly lookup:      OfferingLookup;
  readBytes(cid: string): Uint8Array | null | Promise<Uint8Array | null>;
}

export interface SurfaceRecipeInput {
  readonly wikiSlug: string;
  readonly planes:   VesselRecipePlanes;
  readonly face:     SurfaceFace;
  /** May this face read the bag? The grant's answer; the recipe never widens it. */
  mayRead(bag: SlotUri): boolean;
  readonly plugins:  SurfacePluginInputs;
  readonly profile:  CapabilityProfile;
}

/** One slot of the cascade with the document it resolved to. `temp` and an unregistered library carry null. */
export interface SurfaceSlot {
  readonly slot:     SlotUri;
  readonly layer:    FacetLayer | "temp";
  readonly document: string | null;
}

/** A session's effective recipe: what one surface mount lays. */
export interface SurfaceRecipe {
  readonly wikiId:      string;
  readonly wikiSlug:    string;
  readonly facePlaneId: string;
  readonly profile:     CapabilityProfile;
  /** The slot structure the island lays. */
  readonly recipe:      WikiRecipe;
  /** The cascade, top first, each slot with its absolute id. */
  readonly slots:       readonly SurfaceSlot[];
  /** The face's own planes. */
  readonly planes:      readonly DocumentFacet[];
  /** Library bags the recipe names that no plane resolves yet. They join the revision, so the mount after
   *  one resolves reads as a new recipe. */
  readonly unresolved:  readonly SlotUri[];
  readonly coreHash:    string | null;
  readonly pluginCids:  readonly string[];
  readonly floorCids:   readonly string[];
  readonly revision:    string;
}

export const SURFACE_RECIPE_REFUSALS = [
  "profile-unknown", "face-malformed", "wiki-unknown", "recipe-malformed", "bag-unreadable", "floor-unresolved", "document-malformed",
  "document-in-two-layers", "plugins-refused",
] as const;
export type SurfaceRecipeRefusal = (typeof SURFACE_RECIPE_REFUSALS)[number];

export type SurfaceRecipeVerdict =
  | { readonly ok: true;  readonly recipe: SurfaceRecipe }
  | { readonly ok: false; readonly refusal: SurfaceRecipeRefusal; readonly detail: string };

const refused = (refusal: SurfaceRecipeRefusal, detail: string): SurfaceRecipeVerdict => Object.freeze({ ok: false, refusal, detail });

export type WikiRecipeDerivation =
  | { readonly ok: true; readonly recipe: WikiRecipe; readonly source: "record" | "floor" }
  | { readonly ok: false; readonly cause: "no-such-bag" | "record-unparsable"; readonly detail: string };

/** Derive one standing record or the floor; every wiki names a resolving canon bag. */
export function deriveWikiRecipe(input: { slug: string; record: LarTiddlerRecord | null | undefined; canonUrl: string | null }): WikiRecipeDerivation {
  if (!input.canonUrl) return { ok: false, cause: "no-such-bag", detail: wikiBagUri(input.slug) };
  if (!input.record || input.record.meta?.deleted === true) return { ok: true, recipe: { wikiSlug: input.slug }, source: "floor" };
  if (typeof input.record.tiddler["bag-stack"] !== "string") {
    return { ok: false, cause: "record-unparsable", detail: `torn bag-stack: ${input.slug}` };
  }
  try {
    const recipe = recipeFromRecord(input.record, input.slug);
    return { ok: true, recipe, source: "record" };
  } catch (error) {
    return { ok: false, cause: "record-unparsable", detail: String(error) };
  }
}

/** Name the wiki that owns a slot or canon bag URI. */
export function wikiSlugOfBag(bagUri: string): string | null {
  const match = /^lar:\/\/\/ha\.ka\.ba\/(?:wikis\/([^/]+)\/(?:temp|draft|personal|working)|bags\/([^/]+))$/.exec(bagUri);
  return match?.[1] ?? match?.[2] ?? null;
}

function documentIdOf(document: string): string | null {
  try { return interpretAsDocumentId(document as AutomergeUrl); } catch { return null; }
}

/**
 * The plugin CIDs one recipe selects: the fixed floor's own, then the recipe's verified offerings whose bytes
 * the local content store holds whole. The one selection both platforms run.
 */
export async function resolveRecipePluginCids(
  recipe: Pick<WikiRecipe, "wikiSlug" | "pluginOfferings" | "pluginOfferingsFault">,
  inputs: Pick<SurfacePluginInputs, "islandBlobs" | "lookup" | "readBytes">,
): Promise<{ readonly ok: true; readonly pluginCids: readonly string[] } | { readonly ok: false; readonly error: string }> {
  if (recipe.pluginOfferingsFault) {
    return { ok: false, error: `${recipe.wikiSlug}: malformed-offerings-field: ${recipe.pluginOfferingsFault}` };
  }
  const floorCids = bootSetPluginCids(inputs.islandBlobs);
  const selection = await selectPluginBlobs(recipe.pluginOfferings ?? [], inputs.lookup, bootSetIds(inputs.islandBlobs));
  if (!selection.ok) return { ok: false, error: `${recipe.wikiSlug}: offering selection ${JSON.stringify(selection.failure)}` };
  const selectedCids = selectedPluginCids(selection.blobs);
  const bytes = await verifyCasBytesAsync(selectedCids, async (cid) => inputs.readBytes(cid), (b) => sha256HexBytesSync(b));
  if (!bytes.ok) return { ok: false, error: `${recipe.wikiSlug}: ${JSON.stringify(bytes.failure)}` };
  return { ok: true, pluginCids: [...new Set([...floorCids, ...selectedCids])] };
}

/** Resolve a session's effective recipe for one surface mount. */
export async function resolveSurfaceRecipe(input: SurfaceRecipeInput): Promise<SurfaceRecipeVerdict> {
  if (!isCapabilityProfile(input.profile)) return refused("profile-unknown", String(input.profile));
  const slug = input.wikiSlug;
  const wikiId = wikiUri(slug);
  const { planes, face } = input;
  if (typeof face?.facePlaneId !== "string" || face.facePlaneId.length === 0 || !Array.isArray(face.planes)) {
    return refused("face-malformed", "facePlaneId");
  }

  // The record the wiki stands on: the vessel's own composition shadows a system wiki's default.
  const standing = effectiveRecipe(slug, (plane, title) => planes.read(plane, title));
  // A record that stands names its stack as a list string. A `bag-stack` torn away, or one that fails to read
  // as that string, would lay the recipe with its bags missing; it refuses, and never reads as a narrower recipe.

  // A name resolves on the plane that owns it: the oracle seed on its own plane, and each vessel document pointer in the catalog.
  const documentOf = (bag: SlotUri): string | null => {
    if (bag === ORACLE_BAG) return planes.oracleDocument;
    const plane: RecipePlane = "catalog";
    return tiddlerText(planes.read(plane, bag));
  };

  const canon = wikiBagUri(slug);
  const derived = deriveWikiRecipe({ slug, record: standing?.record, canonUrl: documentOf(canon) });
  if (!derived.ok) return refused(derived.cause === "no-such-bag" ? "wiki-unknown" : "recipe-malformed", derived.detail);
  const recipe = derived.recipe;

  const slots: SurfaceSlot[] = [];
  const unresolved: SlotUri[] = [];
  const layerOf = new Map<string, FacetLayer>();           // document id → the one layer it stands in
  const lay = (slot: SlotUri, layer: FacetLayer, document: string | null): SurfaceRecipeVerdict | null => {
    if (document === null) { slots.push({ slot, layer, document: null }); return null; }
    const documentId = documentIdOf(document);
    if (documentId === null) return refused("document-malformed", slot);
    const held = layerOf.get(documentId);
    if (held !== undefined && held !== layer) return refused("document-in-two-layers", slot);
    layerOf.set(documentId, layer);
    slots.push({ slot, layer, document: `automerge:${documentId}` });
    return null;
  };

  for (const slot of expandRecipe(recipe)) {
    const kind = wikiSlotKindOf(slug, slot);
    let fault: SurfaceRecipeVerdict | null;
    if (kind === "temp") { slots.push({ slot, layer: "temp", document: null }); continue; }
    if (kind !== null) {
      fault = lay(slot, kind, face.slotDocument(wikiId, kind));
    } else if (slot === ORACLE_BAG) {
      if (documentIdOf(planes.oracleDocument) === null) return refused("floor-unresolved", slot);
      fault = lay(slot, "oracle", planes.oracleDocument);
    } else {
      // A bag: the wiki's own canon, or a library the recipe composes. The grant answers before anything resolves.
      if (!input.mayRead(slot)) return refused("bag-unreadable", slot);
      const document = documentOf(slot);
      if (document === null && slot !== canon) unresolved.push(slot);
      fault = lay(slot, slot === canon ? "canon" : "library", document);
    }
    if (fault) return fault;
  }

  const facePlanes: DocumentFacet[] = [];
  for (const plane of face.planes) {
    const documentId = documentIdOf(plane.document);
    if (documentId === null || typeof plane.name !== "string" || plane.name.length === 0) return refused("document-malformed", String(plane.name));
    const held = layerOf.get(documentId);
    if (held !== undefined && held !== "plane") return refused("document-in-two-layers", plane.name);
    layerOf.set(documentId, "plane");
    facePlanes.push(Object.freeze({ name: plane.name, document: `automerge:${documentId}`, layer: "plane" as const }));
  }

  const plugins = await resolveRecipePluginCids(recipe, input.plugins);
  if (!plugins.ok) return refused("plugins-refused", plugins.error);

  // The seed's floor witness admits the manifest and both snapshots to the session's content view.
  const floorCid = plainRecordOrNull(planes.read("oracle", GENESIS_FLOOR_TIDDLER))?.tiddler.cid;
  const floorCids: string[] = [];
  if (typeof floorCid === "string" && floorCid.length > 0) {
    let bytes: Uint8Array | null;
    try { bytes = await input.plugins.readBytes(floorCid); }
    catch (error) { return refused("floor-unresolved", `${GENESIS_FLOOR_TIDDLER}: ${String(error)}`); }
    if (!bytes) return refused("floor-unresolved", `${GENESIS_FLOOR_TIDDLER}: manifest bytes absent: ${floorCid}`);
    if (sha256HexBytesSync(bytes) !== floorCid) {
      return refused("floor-unresolved", `${GENESIS_FLOOR_TIDDLER}: manifest bytes differ from CID: ${floorCid}`);
    }
    const opened = readFloorManifest(bytes);
    if ("refusal" in opened) return refused("floor-unresolved", `${GENESIS_FLOOR_TIDDLER}: ${opened.refusal}: ${opened.reason}`);
    floorCids.push(floorCid, opened.manifest.lares, opened.manifest.lararium);
  }

  const coreHash = input.plugins.coreHash;
  const revision = sha256HexBytesSync(canonicalJsonBytes({
    slots: slots.map((s) => [s.slot, s.layer, s.document]),
    planes: facePlanes.map((p) => [p.name, p.document]),
    unresolved, coreHash, pluginCids: plugins.pluginCids, floorCids,
  }));
  return Object.freeze({
    ok: true,
    recipe: Object.freeze({
      wikiId, wikiSlug: slug, facePlaneId: face.facePlaneId, profile: input.profile, recipe,
      slots: Object.freeze(slots.map((s) => Object.freeze(s))),
      planes: Object.freeze(facePlanes), unresolved: Object.freeze(unresolved),
      coreHash, pluginCids: Object.freeze([...plugins.pluginCids]), floorCids: Object.freeze(floorCids), revision,
    }),
  });
}

/** The documents and content a surface's scoped view opens: exactly what its recipe resolved. */
export function facetsOfSurfaceRecipe(recipe: SurfaceRecipe): SessionDocumentFacets {
  const documents: DocumentFacet[] = [];
  for (const slot of recipe.slots) {
    if (slot.document === null || slot.layer === "temp") continue;
    documents.push({ name: slot.slot, document: slot.document, layer: slot.layer });
  }
  documents.push(...recipe.planes);
  return { documents, content: [...(recipe.coreHash ? [recipe.coreHash] : []), ...recipe.pluginCids, ...recipe.floorCids] };
}

/** The absolute id of every slot that holds a document, by slot name: what an island's manifest carries. */
export function resolvedSlotsOf(recipe: SurfaceRecipe): Record<SlotUri, string> {
  const resolved: Record<SlotUri, string> = {};
  for (const slot of recipe.slots) if (slot.document !== null) resolved[slot.slot] = slot.document;
  return resolved;
}
