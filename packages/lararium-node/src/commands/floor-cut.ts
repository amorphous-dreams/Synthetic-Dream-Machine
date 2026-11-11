/**
 * floor-cut — `lares nexus release <manifest-file> --cut`: the node vessel's binding of the release wiring (`@lararium/mesh`
 * `cutReleaseFloor`). It cuts the floor the next release names from LIVE house canon, so a release after a promotion carries the
 * promoted rows (offering#/the-canon-offer). It seals nothing and lands nothing on any board: it writes the manifest file the
 * seats then approve (`lares nexus promote open <manifest-file> --purpose floor-release --surface floor-release`) and stages the
 * floor's blobs in this hearth's CAS, where `nexus release` and the porch read them.
 *
 * The ports, by capability:
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
  type LarDoc, type LarTiddlerRecord,
} from "@lararium/mesh";
import { readVerifiedCasBlobFromFs, writeCasEntriesFs } from "../node-cas.js";
import { loadVesselVerifyingKey } from "../node-vessel-identity.js";
import { nodeNexusIsland } from "../nexus-standing.js";
import { larBootstrapPath } from "../vessel-paths.js";
import { FloorRefused, nodeFloorPorts } from "./floor.js";
import { charterHomeFor } from "../carried-set.js";

export interface FloorCutResult {
  readonly nexus:       string;
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

/** Cut the floor from live canon, stage it, and write its manifest to `out`. */
export async function runFloorCut(opts: {
  readonly repo: Repo; readonly sealHome: string; readonly casDir: string; readonly out: string; readonly aid?: string;
}): Promise<FloorCutResult> {
  const pinPorts = await nodeFloorPorts({ repo: opts.repo, sealHome: opts.sealHome, casDir: opts.casDir, ...(opts.aid !== undefined ? { aid: opts.aid } : {}) });
  const home = opts.aid !== undefined ? (charterHomeFor(opts.sealHome, opts.aid.trim().toLowerCase()) ?? opts.sealHome) : opts.sealHome;
  const board = await materializeSharedLarDoc(opts.repo, publicationDocUrl(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: home })), "board:publication");
  const casRead = async (cid: string) => readVerifiedCasBlobFromFs(cid, opts.casDir);
  const catalogUrl = bootstrapEntry(BAG_IDS.catalog);
  const catalog = catalogUrl ? (await opts.repo.find<LarDoc>(catalogUrl as AutomergeUrl)).doc() : null;
  const out = await cutReleaseFloor({
    prior: async () => {
      const standing = await foldFloorReleases({ rows: floorReleaseRowsFromBoard(board.doc()), nexus: pinPorts.nexus, manifestBytesOf: casRead });
      const cid = standing.standing === "released" ? standing.head.body.manifest : floorPinOf(pinPorts.home.doc(), pinPorts.nexus, pinPorts.genesisManifest).pin.manifest;
      const bytes = await casRead(cid);
      return bytes ? { manifestCid: cid, bytes } : null;
    },
    canonRows: async (slug) => {
      const url = catalog ? realmStandingDocUrl(catalog, bagUri(slug)) : null;
      if (!url) return null;
      const store = new AutomergeDocStore(await opts.repo.find<LarDoc>(url as AutomergeUrl), bagUri(slug));
      const rows: Record<string, LarTiddlerRecord> = {};
      for (const title of await store.listVisible()) { const r = await store.get(title); if (r) rows[title] = r; }
      return rows;
    },
    stage: async (blobs) => { writeCasEntriesFs(blobs.map((b) => ({ cid: b.cid, bytes: b.bytes })), opts.casDir); },
  }).catch((e: unknown) => { throw new FloorRefused("floor-cut-refused", e instanceof Error ? e.message : String(e)); });
  if (sha256HexBytesSync(out.manifestBytes) !== out.manifestCid) throw new FloorRefused("floor-cut-refused", "the cut manifest's bytes differ from its CID");
  writeFileSync(opts.out, out.manifestBytes);
  return { nexus: pinPorts.nexus, manifestCid: out.manifestCid, prior: out.prior, cut: out.cut, kept: out.kept, moved: out.moved, out: opts.out };
}

