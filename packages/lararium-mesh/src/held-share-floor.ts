/** Live, local readings for the one tier boundary. No fetch, timer, or cached permission joins these islands. */
import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { bagManifestFromMeta } from "./bag-manifest.js";
import { casCidOfRecord } from "./cas.js";
import { makeTierFloorSource } from "./cap-tier.js";
import { documentIdOfUrl } from "./sealed-rest.js";
import { isBagId } from "./lar-uris.js";
import { makeFaceSecretsRegistry, type FaceSecretsCatalog } from "./secrets-registry.js";
import { plainField, plainRecord, ownEntry } from "./stored-value.js";
import { makeManifestTierSource, makeShareBoundary } from "./share-tighten.js";

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
  const declared = makeManifestTierSource({
    bagOfDoc(id) {
      const bags = [...bindings()].filter(([, ids]) => ids.includes(id)).map(([bag]) => bag);
      if (bags.length === 1) return { kind: "bag", bag: bags[0]! };
      // Only a known non-bag public board opts out of a manifest. An unknown doc never does.
      if (bags.length === 0 && readers.publicPlane(id)) return { kind: "non-bag" };
      return null;
    },
    manifestOf(bag) {
      const manifests = docsOf(bag).flatMap((held) => {
        const record = ownEntry(held?.tiddlers, bag);
        return record ? [plainRecord(record).tiddler] : [];
      });
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
  const tiers = makeShareBoundary({
    declared: { declaredTierForDoc: (id) => genesis(id) ? "public" : declared.declaredTierForDoc(id) },
    floor: makeTierFloorSource({
      federatable: (id) => genesis(id) || readers.publicPlane(id),
      sealed: (id) => !genesis(id) && readers.sealedPlane(id),
      secrets: (id) => !genesis(id) && registry.plane.isContractSecretsPlane(id),
    }),
  }, readers.onRefusal);
  return {
    tiers, registry,
    documentForBag: (bag: string): string | undefined => bindings().get(bag)?.[0],
    documentsForCid(cid: string): readonly string[] {
      // The seed's explicit publication survives a later private reference to the same immutable bytes.
      if (readers.genesisCids().has(cid)) return [`${genesisPrefix}${cid}`];
      const ids: string[] = [];
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
