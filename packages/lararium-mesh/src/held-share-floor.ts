/** Live, local readings for the one tier boundary. No fetch, timer, or cached permission joins these islands. */
import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { bagManifestFromMeta } from "./bag-manifest.js";
import { casCidOfRecord } from "./cas.js";
import { makeTierFloorSource, type CapTier } from "./cap-tier.js";
import { documentIdOfUrl } from "./sealed-rest.js";
import { isBagId } from "./lar-uris.js";
import { faceScopedSecrets, makeFaceSecretsRegistry, type FaceSecretsCatalog } from "./secrets-registry.js";
import { plainField, plainRecord, ownEntry } from "./stored-value.js";
import { DeclaredTierRefusal, makeManifestTierSource, makeShareBoundary } from "./share-tighten.js";
import { FACE_CATALOG_BAG_ID } from "./register-bags.js";
import { isFaceScopedBag } from "./persona-scope.js";
import type { PluginProof } from "./surface-recipe.js";

/**
 * The tier a face's own planes declare by construction. Each of the five face-scoped families (persona · circles ·
 * identities · sessions · intents) derives its id from the PersonaGroup, so its readership is that group's fleet: a
 * plane that rests no manifest carrier reads this declaration, and a carrier it rests tightens or agrees.
 */
export const FACE_PLANE_TIER: CapTier = "personagroup";
/** The face's own catalog binds as no bag: it follows the face to its fleet, never further. */
export const FACE_CATALOG_TIER: CapTier = "personagroup";
/** A promoted plugin reads at its promote ledger's tier: the face's own PersonaGroup custody row names it. */
export const PROMOTED_PLUGIN_TIER: CapTier = "personagroup";

/** One wiki's proven plugin references: the board carrying its offerings (null where it named none) and the resolution's proof. */
export interface HeldPluginProof extends PluginProof {
  readonly board: string | null;
}

export interface HeldShareFloorReaders {
  handles(): Readonly<Record<string, { isReady(): boolean; doc(): unknown } | undefined>>;
  catalog(): LarDoc | undefined;
  /** Mounted and slot layers, including documents named before a catalog row lands. */
  bindings(): Iterable<readonly [bag: string, documentId: string]>;
  /** Only the immutable, build-derived seed inventory declares these bytes public (genesis-doc / bulb-read-face).
   * Never derive this set from the mutable oracle or the contents of a CAS directory. */
  genesisCids(): ReadonlySet<string>;
  publicPlane(documentId: string): boolean;
  sealedPlane(documentId: string): boolean;
  /**
   * A plane the vessel binds EXPLICITLY as no bag, with the tier it declares (a hearth's hosting docs CONTRACT, the
   * fleet's edge boards PERSONAGROUP); null for every other doc. Never a default: a doc no reader names stays unresolved.
   */
  nonBagTier(documentId: string): CapTier | null;
  /** The worn face's sealed map names this doc (its sealed bags and catalog). The secrets registry gates these alone. */
  faceOwns(documentId: string): boolean;
  secretsCatalog: FaceSecretsCatalog;
  onRefusal(refusal: Error): void;
}

export function makeHeldShareFloor(readers: HeldShareFloorReaders) {
  const registry = makeFaceSecretsRegistry(readers.secretsCatalog);
  const bindings = (): Map<string, string[]> => {
    const found = new Map<string, string[]>();
    const add = (bag: string, id: string) => { const ids = found.get(bag) ?? []; if (!ids.includes(id)) ids.push(id); found.set(bag, ids); };
    for (const [bag, id] of readers.bindings()) add(bag, id);
    for (const [bag, row] of Object.entries(readers.catalog()?.tiddlers ?? {})) {
      if (!isBagId(bag)) continue;
      const id = documentIdOfUrl(tiddlerText(row));
      if (id) add(bag, id);
    }
    return found;
  };
  const doc = (id: string): LarDoc | null => {
    const handle = ownEntry(readers.handles(), id);
    return handle?.isReady() ? handle.doc() as LarDoc : null;
  };
  const docsOf = (bag: string): (LarDoc | null)[] => (bindings().get(bag) ?? []).map(doc);
  const bagsOfDoc = (id: string): string[] => [...bindings()].filter(([, ids]) => ids.includes(id)).map(([bag]) => bag);
  const declared = makeManifestTierSource({
    bagOfDoc(id) {
      const bags = bagsOfDoc(id);
      // The face's catalog binds as no bag, under its own declared tier.
      if (bags.length === 1 && bags[0] === FACE_CATALOG_BAG_ID) return { kind: "non-bag", tier: FACE_CATALOG_TIER };
      if (bags.length === 1) return { kind: "bag", bag: bags[0]! };
      if (bags.length > 0) return null;
      // Only a plane a reader names opts out of a manifest: a public board PUBLIC, another non-bag plane its own tier.
      if (readers.publicPlane(id)) return { kind: "non-bag", tier: "public" };
      const tier = readers.nonBagTier(id);
      return tier === null ? null : { kind: "non-bag", tier };
    },
    manifestOf(bag) {
      const manifests = docsOf(bag).flatMap((held) => {
        const record = ownEntry(held?.tiddlers, bag);
        return record ? [plainRecord(record).tiddler] : [];
      });
      // A face plane declares by its family; a carrier it rests must still agree below.
      if (manifests.length === 0 && isFaceScopedBag(bag)) return { bag, tier: FACE_PLANE_TIER, home: "hearth" };
      // More than one carrier must agree; no arbitrary replica order decides a tier.
      if (manifests.length === 0) return null;
      const first = bagManifestFromMeta(bag, manifests[0]);
      if (manifests.some((fields) => bagManifestFromMeta(bag, fields).tier !== first.tier)) return null;
      if (manifests.some((fields) => typeof fields["bag"] !== "string" || bag !== `lar:///ha.ka.ba/bags/${fields["bag"]}`)) return null;
      return first;
    },
    tiddlerTiersOf(bag) {
      const held = docsOf(bag);
      if (held.length === 0 || held.some((d) => d === null)) return null;
      return held.flatMap((d) => Object.values(d!.tiddlers).map((record) => plainField(record, "capTier")));
    },
  });
  // An immutable byte declaration, outside the mutable document-id namespace. These build artifacts cannot
  // carry a face's secrets; all ordinary documents still consult the live secrets registry first.
  const genesisPrefix = "genesis-public:";
  const genesis = (id: string): boolean => id.startsWith(genesisPrefix) && readers.genesisCids().has(id.slice(genesisPrefix.length));
  // PLUGIN PROOFS (P27): each wiki's latest resolution names the plugin CIDs it proved. A promoted digest reads through its
  // own reference id (`promoted-plugin:<cid>`), declared at the promote ledger's tier and floored by the proof; an offered blob
  // reads through the board that carries its offering. A later resolution of the same wiki replaces its proof whole.
  const pluginProofs = new Map<string, HeldPluginProof>();
  const promotedPrefix = "promoted-plugin:";
  const promotedRef = (id: string): boolean => id.startsWith(promotedPrefix)
    && [...pluginProofs.values()].some((p) => p.promoted.includes(id.slice(promotedPrefix.length)));
  const proven = (id: string): boolean => genesis(id) || promotedRef(id);
  // WHO OWNS A DOC, PROVEN: the registry gates the worn face's own documents alone (operator clarification 2026-11-06). The
  // seed, a public board and an explicit non-bag plane hold no face's secrets; a doc the face's sealed map names, its
  // catalog, or a face-scoped plane asks the registry; a doc bound to another bag does not. A doc bound nowhere and named by
  // no reader stays unresolved, and the crossing refuses.
  const owns = (id: string): boolean => {
    if (proven(id) || readers.publicPlane(id)) return false;
    if (readers.faceOwns(id)) return true;
    const bags = bagsOfDoc(id);
    if (bags.some((bag) => bag === FACE_CATALOG_BAG_ID || isFaceScopedBag(bag))) return true;
    if (bags.length > 0 || readers.nonBagTier(id) !== null) return false;
    throw new DeclaredTierRefusal("declared-tier-unresolved", `${id}: no binding proves which face owns it`);
  };
  const secrets = faceScopedSecrets(registry.plane, owns);
  const declaredSource = { declaredTierForDoc: (id: string): CapTier | null => genesis(id) ? "public"
    : promotedRef(id) ? PROMOTED_PLUGIN_TIER : declared.declaredTierForDoc(id) };
  const floorOf = (federatable: (id: string) => boolean) => makeTierFloorSource({
    federatable,
    sealed: (id) => !proven(id) && readers.sealedPlane(id),
    secrets: (id) => !proven(id) && secrets.isContractSecretsPlane(id),
  });
  // Two rings, one declaration: the held floor (the public boards and the seed alone), and the floor a crossing reads when
  // a gate allowed it (that gate is the structure that carried the doc; the secrets ceiling still reads first).
  const tiers = makeShareBoundary(
    { declared: declaredSource, floor: floorOf((id) => proven(id) || readers.publicPlane(id)) },
    readers.onRefusal,
    { declared: declaredSource, floor: floorOf(() => true) },
  );
  return {
    tiers, registry,
    /** Seat one wiki's plugin proof from its latest resolution (`resolveRecipePluginCids().proved`), replacing the last. */
    provePlugins(wikiSlug: string, proof: HeldPluginProof): void {
      pluginProofs.set(wikiSlug, { board: proof.board, offered: [...proof.offered], promoted: [...proof.promoted] });
    },
    documentForBag: (bag: string): string | undefined => bindings().get(bag)?.[0],
    documentsForCid(cid: string): readonly string[] {
      // The seed's explicit publication survives a later private reference to the same immutable bytes.
      if (readers.genesisCids().has(cid)) return [`${genesisPrefix}${cid}`];
      const ids: string[] = [];
      for (const proof of pluginProofs.values()) {
        if (proof.board !== null && proof.offered.includes(cid) && !ids.includes(proof.board)) ids.push(proof.board);
        if (proof.promoted.includes(cid) && !ids.includes(`${promotedPrefix}${cid}`)) ids.push(`${promotedPrefix}${cid}`);
      }
      for (const [id, handle] of Object.entries(readers.handles())) {
        if (!handle?.isReady()) continue;
        const held = handle.doc() as LarDoc;
        if (Object.values(held.tiddlers ?? {}).some((r) => casCidOfRecord(plainRecord(r).tiddler) === cid)
          || Object.values(held.blobs ?? {}).some((blob) => blob.sha256 === cid)) ids.push(id);
      }
      return ids;
    },
  };
}
