/**
 * nexus-release — the door that publishes a Nexus's FLOOR RELEASE: the one porch body that names the floor manifest
 * the Kahu cabal released, sealed by the steward, with the cabal's promotion approval over the manifest's exact bytes
 * attached, landed on the Nexus's crossroads board (`@lararium/mesh` `floor-release`).
 *
 * THE STEWARD IS A SEAT HELD HERE. The first seat of the charter this vessel holds a key for seals the body under the
 * release domain; the AUTHORITY is the approval, which a person opened and carried between vaults beforehand
 * (`lares nexus promote open|sign <manifest-file> --purpose floor-release --surface floor-release --class high-impact`).
 * The door verifies the whole release exactly as a reader will, and lands it only where it counts: a short approval
 * lands nothing and the door says how many seats it still wants.
 *
 * THE CHAIN. The new release names the crossroads board's current head as its `prior`, and a chain already
 * `unsettled` (two heads) refuses: the cabal settles a fork before another release builds on it.
 *
 * WHAT IT NEVER DOES. It signs no approval, moves no pin and accepts nothing: a face accepts a release by a person's
 * act (road `W26`). A herm carries the answer and signs nothing.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-slices
 */
import { readFileSync } from "node:fs";
import type { Repo } from "@automerge/automerge-repo";
import {
  FLOOR_RELEASE_SURFACE, assembleFloorRelease, crossroadsDocUrl, floorReleaseRowsFromBoard, foldFloorReleases, materializeSharedLarDoc,
  openFloorReleaseBody, readPromotionApproval, resolveFloor, sha256HexBytesSync, verifyFloorRelease, writeFloorRelease,
  type FloorRelease, type FloorReleaseStanding, type FloorReleaseRefusal,
} from "@lararium/mesh";
import { readNexusDoc } from "../nexus-doc.js";
import { readVerifiedCasBlobFromFs, writeCasEntriesFs } from "../node-cas.js";
import { loadVesselVerifyingKey } from "../node-vessel-identity.js";
import { nodeNexusIsland } from "../nexus-standing.js";
import { heldSeatSigners } from "../held-quorum.js";
import { NexusCabalError, cabalCore, type CabalCore } from "./nexus-cabal.js";

/** The crossroads board this vessel's charter publishes on: the island the charter names, the same one the carriage board keys on. */
async function crossroadsBoard(repo: Repo, core: CabalCore, vesselKey: string | undefined) {
  const ownVesselKey = vesselKey ?? await loadVesselVerifyingKey();
  return materializeSharedLarDoc(repo, crossroadsDocUrl(nodeNexusIsland({ ownVesselKey, sealHome: core.home })), "board:crossroads");
}

export interface NexusReleaseResult {
  readonly nexus:     string;
  readonly release:   FloorRelease;
  readonly counted:   number;
  readonly threshold: number;
}

/** Where the Nexus's release chain stands on this vessel's replica of its crossroads board. */
export async function runFloorReleaseStanding(opts: {
  readonly repo: Repo; readonly sealHome: string; readonly aid?: string; readonly vesselKey?: string;
  /** The manifest's bytes by CID, from the caller's CAS; absent bytes count nothing. */
  readonly manifestBytesOf: (cid: string) => Promise<Uint8Array | null> | Uint8Array | null;
}): Promise<FloorReleaseStanding & { readonly nexus: string }> {
  const core = await cabalCore(opts.repo, opts.sealHome, opts.aid, opts.vesselKey);
  const board = await crossroadsBoard(opts.repo, core, opts.vesselKey);
  const standing = await foldFloorReleases({ rows: floorReleaseRowsFromBoard(board.doc()), nexus: core.nexus, manifestBytesOf: opts.manifestBytesOf });
  return { ...standing, nexus: core.nexus };
}

/**
 * Seal and land a release of the manifest in `manifestFile`, under the approval the seats carried. Refuses by name
 * where this vessel holds no seat, the approval is unreadable or does not count over these exact bytes, or the chain
 * stands unsettled. Nothing lands on a refusal.
 */
export async function runFloorRelease(opts: {
  readonly repo: Repo; readonly sealHome: string; readonly manifestFile: string; readonly approval: unknown;
  readonly aid?: string; readonly vesselKey?: string;
  /** This hearth's CAS dir. Present: the manifest is staged there, and the floor it names must stand WHOLE in it (the
   *  manifest and both snapshots, each re-hashed) before a release names it, since the porch serves what this CAS holds. */
  readonly casDir?: string;
}): Promise<NexusReleaseResult> {
  let manifestBytes: Uint8Array;
  try { manifestBytes = new Uint8Array(readFileSync(opts.manifestFile)); }
  catch { throw new NexusCabalError(`cannot read ${opts.manifestFile} as a floor manifest file.`); }
  const approval = readPromotionApproval(opts.approval);
  if (approval === null) throw new NexusCabalError("the approval file reads as no promotion approval.");
  if (approval.surface !== FLOOR_RELEASE_SURFACE) {
    throw new NexusCabalError(`the approval names the surface "${approval.surface}"; a floor release takes an approval over the surface "${FLOOR_RELEASE_SURFACE}".`);
  }
  const core = await cabalCore(opts.repo, opts.sealHome, opts.aid, opts.vesselKey);
  const lineage = readNexusDoc(core.home)?.sealLineage;
  if (!lineage || lineage.length === 0) throw new NexusCabalError("this vessel's charter carries no epoch lineage, so a release has none to carry.");
  const [steward] = heldSeatSigners(core.roster);
  if (steward === undefined) throw new NexusCabalError("this vessel holds no seat of the charter, so it seals no release.");
  const board = await crossroadsBoard(opts.repo, core, opts.vesselKey);

  const manifest = sha256HexBytesSync(manifestBytes);
  if (opts.casDir !== undefined) {
    writeCasEntriesFs([{ cid: manifest, bytes: manifestBytes }], opts.casDir);
    const whole = await resolveFloor(manifest, async (cid) => readVerifiedCasBlobFromFs(cid, opts.casDir!));
    if ("refusal" in whole) throw new NexusCabalError(`the floor this manifest names does not stand whole in this hearth's CAS, so no release names it: ${whole.refusal} (${whole.reason}).`);
  }
  // THE PRIOR is the head of the chain the rows' own bodies spell: the release no other row names as its prior. This
  // door cannot verify an older release (it holds this manifest's bytes alone), so it reads the structure; every
  // reader re-verifies every row before it counts one.
  const parsed = floorReleaseRowsFromBoard(board.doc())
    .map((r) => r.record as { body?: { prior?: unknown; manifest?: unknown }; cid?: unknown })
    .filter((r) => typeof r.cid === "string" && typeof r.body === "object");
  const cited = new Set(parsed.map((r) => r.body?.prior).filter((p): p is string => typeof p === "string"));
  const heads = parsed.filter((r) => !cited.has(r.cid as string));
  if (heads.length > 1) throw new NexusCabalError(`the release chain stands unsettled (${heads.length} heads); the cabal settles the fork before another release builds on it.`);
  const head = heads[0];
  if (head !== undefined && head.body?.manifest === manifest) throw new NexusCabalError("this manifest already stands as the chain's head release.");
  const prior = (head?.cid as string | undefined) ?? null;

  const body = openFloorReleaseBody({ nexus: core.nexus, epoch: core.roster.sealEpochCid, prior, manifest });
  const release = await assembleFloorRelease({
    body, lineage, manifestBytes, approvers: [], approval,
    steward: { signer: steward.verifyingKey, sign: steward.sign },
  });
  const verdict = verifyFloorRelease({ record: release, nexus: core.nexus, manifestBytes });
  if (!verdict.ok) {
    throw new NexusCabalError(`the release counts nothing here: ${describe(verdict.reason)}`);
  }
  board.change((draft) => writeFloorRelease(draft, release));
  return { nexus: core.nexus, release, counted: verdict.counted, threshold: verdict.threshold };
}

function describe(reason: FloorReleaseRefusal): string {
  switch (reason) {
    case "approval-below-class-threshold": return "the approval is short of the seats the high-impact bar takes; carry it to the next vault (`lares nexus promote sign`).";
    case "approval-bytes-differ":          return "the approval covers other bytes than this manifest file.";
    case "approval-class-below-surface":   return "the approval stands below the high-impact bar a release takes (the chartered classes hold the surface there).";
    case "approval-wrong-charter-epoch":   return "the approval was signed at another charter epoch than this vessel's head; open a fresh one.";
    default:                               return reason;
  }
}
