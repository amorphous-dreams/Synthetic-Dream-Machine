/**
 * floor-cut — `lares nexus release <manifest-file> --cut`: the node vessel's binding of the release wiring (`@lararium/mesh`
 * `cutReleaseFloor`). It cuts the floor the next release names from LIVE house canon, so a release after a promotion carries the
 * promoted rows (offering#/the-canon-offer). It seals nothing and lands nothing on any board: it writes the manifest file the
 * seats then approve (`lares nexus promote open <manifest-file> --purpose floor-release --surface floor-release`) and stages the
 * floor's blobs in this hearth's CAS, where `nexus release` and the porch read them.
 *
 * The ports, by capability (`runFloorCutOver` binds them; `runFloorCut` resolves the charter, the board and the catalog first):
 *   · `prior`     — the chain head's manifest where a release counts on the publication board, else this vessel's pinned floor;
 *   · `canonRows` — each house-canon slug's live document, named by the Kahu realm's bag row in this vessel's catalog (a read
 *                   asks nothing); a slug with no document here keeps the prior snapshot, and the answer names it;
 *   · `stage`     — this hearth's CAS.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/offering#/the-canon-offer
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import {
  AutomergeDocStore, BAG_IDS, bagUri, cutReleaseFloor, floorPinOf, floorReleaseRowsFromBoard, foldFloorReleases, ownEntry,
  publicationDocUrl, materializeSharedLarDoc, realmStandingDocUrl, sha256HexBytesSync,
  type LarDoc, type LarTiddlerRecord, type OfferRecordReader,
} from "@lararium/mesh";
import { readVerifiedCasBlobFromFs, writeCasEntriesFs } from "../node-cas.js";
import { loadVesselVerifyingKey } from "../node-vessel-identity.js";
import { nodeNexusIsland } from "../nexus-standing.js";
import { larBootstrapPath } from "../vessel-paths.js";
import { FloorRefused, nodeFloorPorts } from "./floor.js";
import { charterHomeFor } from "../carried-set.js";

export interface FloorCutResult {
  readonly nexus?:      string;
  readonly manifestCid: string;
  readonly prior:       string;
  readonly cut:         readonly string[];
  readonly kept:        readonly string[];
  readonly moved:       readonly string[];
  readonly out:         string;
}

function bootstrapEntry(id: string): string | null {
  try {
    const plugin = JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text?: string };
    const entries = (JSON.parse(plugin.text ?? "{}") as { tiddlers?: Record<string, { text?: string }> }).tiddlers ?? {};
    return ownEntry(entries, id)?.text ?? null;
  } catch { return null; }
}

/**
 * The live house-canon document a bag names on this vessel: the Kahu realm's bag row in the vessel's own catalog (the bootstrap
 * names the catalog). Null where the vessel holds no catalog or no row stands for the bag. A read; it asks nothing.
 */
export async function nodeCanonDocUrl(repo: Repo): Promise<(bag: string) => string | null> {
  const catalogUrl = bootstrapEntry(BAG_IDS.catalog);
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
    stage: async (blobs) => { writeCasEntriesFs(blobs.map((b) => ({ cid: b.cid, bytes: b.bytes })), opts.casDir); },
  }).catch((e: unknown) => { throw new FloorRefused("floor-cut-refused", e instanceof Error ? e.message : String(e)); });
  if (sha256HexBytesSync(out.manifestBytes) !== out.manifestCid) throw new FloorRefused("floor-cut-refused", "the cut manifest's bytes differ from its CID");
  writeFileSync(opts.out, out.manifestBytes);
  return { manifestCid: out.manifestCid, prior: out.prior, cut: out.cut, kept: out.kept, moved: out.moved, out: opts.out };
}

/** Cut the floor from live canon, stage it, and write its manifest to `out`: the charter, the board and the catalog resolved here. */
export async function runFloorCut(opts: {
  readonly repo: Repo; readonly sealHome: string; readonly casDir: string; readonly out: string; readonly aid?: string;
}): Promise<FloorCutResult> {
  const pinPorts = await nodeFloorPorts({ repo: opts.repo, sealHome: opts.sealHome, casDir: opts.casDir, ...(opts.aid !== undefined ? { aid: opts.aid } : {}) });
  const home = opts.aid !== undefined ? (charterHomeFor(opts.sealHome, opts.aid.trim().toLowerCase()) ?? opts.sealHome) : opts.sealHome;
  const board = await materializeSharedLarDoc(opts.repo, publicationDocUrl(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: home })), "board:publication");
  const casRead = async (cid: string) => readVerifiedCasBlobFromFs(cid, opts.casDir);
  const result = await runFloorCutOver({
    repo: opts.repo, casDir: opts.casDir, out: opts.out, canonDocUrl: await nodeCanonDocUrl(opts.repo),
    prior: async () => {
      const standing = await foldFloorReleases({ rows: floorReleaseRowsFromBoard(board.doc()), nexus: pinPorts.nexus, manifestBytesOf: casRead });
      return standing.standing === "released" ? standing.head.body.manifest : floorPinOf(pinPorts.home.doc(), pinPorts.nexus, pinPorts.genesisManifest).pin.manifest;
    },
  });
  return { ...result, nexus: pinPorts.nexus };
}
