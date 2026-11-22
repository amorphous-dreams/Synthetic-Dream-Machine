/**
 * floor-cut — `lares nexus release <manifest-file> --cut`: the node vessel's binding of the release wiring (`@lararium/mesh`
 * `cutReleaseFloor`). It cuts the floor the next release names from LIVE house canon, so a release after a promotion carries the
 * promoted rows (offering#/the-canon-offer). It seals nothing and lands nothing on any board: it writes the manifest file the
 * seats then approve (`lares nexus approve open <manifest-file> --purpose floor-release --surface floor-release`) and stages the
 * floor's blobs in this hearth's CAS, where `nexus release` and the porch read them.
 *
 * The ports, by capability (`runFloorCutOver` binds them; `runFloorCut` resolves the charter, the board and the catalog first):
 *   · `prior`     — the chain head's manifest where a release counts on the publication board, else this vessel's pinned floor;
 *   · `canonRows` — each house-canon slug's live document, named by the Kahu realm's bag row in this vessel's catalog (the
 *                   catalog the store door holds, `catalogUrl`; a read asks nothing); a slug with no document here keeps the prior snapshot, and the answer names it;
 *   · `tier`      — each bag's own declared tier, read off its `meta.mem` under this vessel's canon source (`daemonBagsDir`); a
 *                   bag declared under `public` leaves the cut, and one with no declaration here keeps its standing;
 *   · `blob`      — this hearth's CAS, read for each prior snapshot the thin read weighs (`floor-cut-thin`, lifted per slug by `thin`);
 *   · `stage`     — this hearth's CAS.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/offering#/the-canon-offer
 */
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import {
  AutomergeDocStore, BAG_MANIFEST_FILE, FloorCutThin, bagUri, cutReleaseFloor, floorPinOf, floorReleaseEntriesFromBoard, foldFloorReleases,
  FloorManifestRefusal, publicationDocUrl, materializeSharedLarDoc, readFloorManifest, realmStandingDocUrl, sha256HexBytesSync,
  type CapTier, type LarDoc, type LarTiddlerRecord, type OfferRecordReader,
} from "@lararium/mesh";
import { readBagManifest } from "../bag-declare.js";
import { daemonBagsDir } from "../lares-config.js";
import { readVerifiedCasBlobFromFs, writeCasEntriesFs } from "../node-cas.js";
import { loadVesselVerifyingKey } from "../node-vessel-identity.js";
import { nodeNexusIsland } from "../nexus-standing.js";
import { FloorRefused, nodeFloorPorts } from "./floor.js";
import { charterHomeFor } from "../carried-set.js";

export interface FloorCutResult {
  readonly nexus?:      string;
  readonly manifestCid: string;
  readonly prior:       string;
  readonly cut:         readonly string[];
  readonly kept:        readonly string[];
  readonly moved:       readonly string[];
  /** Slugs the prior floor named that this cut leaves off: each bag declares a tier the public floor never carries. */
  readonly dropped:     readonly string[];
  readonly out:         string;
}

/** A bag's own declared tier under a canon source dir (`<bags>/<slug>/meta.mem`), or null where no declaration stands there. */
export function declaredBagTier(bagsDir: string, slug: string): CapTier | null {
  const dir = join(bagsDir, slug);
  return existsSync(join(dir, BAG_MANIFEST_FILE)) ? readBagManifest(dir, slug).tier : null;
}

/**
 * The live house-canon document a bag names on this vessel: the Kahu realm's bag row in the vessel's own catalog. `catalogUrl`
 * names that catalog as the store door holds it (`StoreDoorDeps.catalogUrl`: the standing vessel's own catalog handle, or the
 * pointer file beside a store a direct act opened, `readCatalogPointer`). Null where the store names no catalog or no row stands
 * for the bag. A read; it asks nothing.
 */
export async function nodeCanonDocUrl(repo: Repo, catalogUrl: string | null | undefined): Promise<(bag: string) => string | null> {
  const catalog = catalogUrl ? (await repo.find<LarDoc>(catalogUrl as AutomergeUrl)).doc() : null;
  return (bag) => (catalog ? realmStandingDocUrl(catalog, bag) : null);
}

/** One canon bag's live store on this vessel, or null where no document stands for it. */
export async function nodeCanonStore(repo: Repo, docUrlOf: (bag: string) => string | null, bag: string): Promise<(OfferRecordReader & { listVisible(): Promise<string[]> }) | null> {
  const url = docUrlOf(bag);
  return url ? new AutomergeDocStore(await repo.find<LarDoc>(url as AutomergeUrl), bag) : null;
}

/**
 * THE NODE BINDING, over what the caller resolved: the prior floor's manifest CID, the canon documents by bag. It cuts, stages the
 * blobs in `casDir`, and writes the manifest's exact bytes to `out`. A prior this CAS cannot answer refuses `floor-cut-refused`.
 */
export async function runFloorCutOver(opts: {
  readonly repo:        Repo;
  readonly casDir:      string;
  readonly out:         string;
  readonly prior:       () => Promise<string | null>;
  readonly canonDocUrl: (bag: string) => string | null;
  readonly bagTier:     (slug: string) => CapTier | null;
  /** Slugs the steward names thin on purpose: each cuts though its live rows count under half the prior snapshot's. */
  readonly thin?:       readonly string[];
  /** The engine digest this vessel's genesis floor names; a prior whose engine differs refuses `floor-engine-unoffered`. Required. */
  readonly genesisEngine: () => Promise<string | null> | string | null;
}): Promise<FloorCutResult> {
  const out = await cutReleaseFloor({
    prior: async () => {
      const cid = await opts.prior();
      const bytes = cid ? readVerifiedCasBlobFromFs(cid, opts.casDir) : null;
      return cid && bytes ? { manifestCid: cid, bytes } : null;
    },
    canonRows: async (slug) => {
      const store = await nodeCanonStore(opts.repo, opts.canonDocUrl, bagUri(slug));
      if (!store) return null;
      const rows: Record<string, LarTiddlerRecord> = {};
      for (const title of await store.listVisible()) { const r = await store.get(title); if (r) rows[title] = r; }
      return rows;
    },
    tier: opts.bagTier,
    blob: async (cid) => readVerifiedCasBlobFromFs(cid, opts.casDir),
    stage: async (blobs) => { writeCasEntriesFs(blobs.map((b) => ({ cid: b.cid, bytes: b.bytes })), opts.casDir); },
    genesisEngine: opts.genesisEngine,
  }, { ...(opts.thin ? { thin: opts.thin } : {}) }).catch((e: unknown) => {
    if (e instanceof FloorCutThin) throw new FloorRefused(e.refusal, e.message);
    if (e instanceof FloorManifestRefusal && e.code === "floor-engine-unoffered") throw new FloorRefused(e.code, e.message);
    throw new FloorRefused("floor-cut-refused", e instanceof Error ? e.message : String(e));
  });
  if (sha256HexBytesSync(out.manifestBytes) !== out.manifestCid) throw new FloorRefused("floor-cut-refused", "the cut manifest's bytes differ from its CID");
  writeFileSync(opts.out, out.manifestBytes);
  return { manifestCid: out.manifestCid, prior: out.prior, cut: out.cut, kept: out.kept, moved: out.moved, dropped: out.dropped, out: opts.out };
}

/** Cut the floor from live canon, stage it, and write its manifest to `out`: the charter, the board and the catalog resolved here. */
export async function runFloorCut(opts: {
  readonly repo: Repo; readonly sealHome: string; readonly casDir: string; readonly out: string; readonly aid?: string; readonly thin?: readonly string[];
  /** The catalog the held store names (`StoreDoorDeps.catalogUrl`); absent, no canon document reads and every slug keeps its snapshot. */
  readonly catalogUrl?: string | undefined;
}): Promise<FloorCutResult> {
  const pinPorts = await nodeFloorPorts({ repo: opts.repo, sealHome: opts.sealHome, casDir: opts.casDir, ...(opts.aid !== undefined ? { aid: opts.aid } : {}) });
  const home = opts.aid !== undefined ? (charterHomeFor(opts.sealHome, opts.aid.trim().toLowerCase()) ?? opts.sealHome) : opts.sealHome;
  const board = await materializeSharedLarDoc(opts.repo, publicationDocUrl(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: home })), "board:publication");
  const casRead = async (cid: string) => readVerifiedCasBlobFromFs(cid, opts.casDir);
  const result = await runFloorCutOver({
    repo: opts.repo, casDir: opts.casDir, out: opts.out, canonDocUrl: await nodeCanonDocUrl(opts.repo, opts.catalogUrl),
    bagTier: (slug) => declaredBagTier(daemonBagsDir(), slug),
    ...(opts.thin ? { thin: opts.thin } : {}),
    // The engine the genesis floor names: a cut carries the engine it stands on and never offers one.
    genesisEngine: async () => {
      const bytes = pinPorts.genesisManifest ? await casRead(pinPorts.genesisManifest) : null;
      const read = bytes ? readFloorManifest(bytes) : null;
      return read && "manifest" in read ? read.manifest.engine : null;
    },
    prior: async () => {
      const standing = await foldFloorReleases({ rows: floorReleaseEntriesFromBoard(board.doc()), nexus: pinPorts.nexus, manifestBytesOf: casRead });
      return standing.standing === "released" ? standing.head.body.manifest : floorPinOf(pinPorts.home.doc(), pinPorts.nexus, pinPorts.genesisManifest).pin.manifest;
    },
  });
  return { ...result, nexus: pinPorts.nexus };
}
