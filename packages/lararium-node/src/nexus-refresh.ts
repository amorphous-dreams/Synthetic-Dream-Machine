/**
 * nexus-refresh — the LIVE-refold shore behind the `nexus-refresh` daemon verb.
 *
 * A running node reads its federation POSTURE off the disk charter, and judges every presented carriage admit
 * against the DENY boards and antigens of the Nexuses it carries. The posture settles at boot; the boards
 * re-fold live on a CHANGE that reaches the running Repo by sync. An OUT-OF-PROCESS edit reaches neither:
 * `lares nexus posture` rewrites a disk file the boot read once, and `lares nexus kapae` / `contract` write the
 * boards through their OWN throwaway Repo, and NodeFS carries no cross-process change bus. This refresh closes
 * that gap on demand.
 *
 * WHAT IT DOES, once, fail-closed:
 *   1. POSTURE — re-read the disk charter and hand the posture to the caller's setter. A torn / absent charter
 *      reads PRIVATE (`federationPostureFromDoc` fails closed), so a broken read only ever tightens the mesh.
 *   2. BOARDS — for this vessel's own island AND every Nexus in its carried set (each island resolved over
 *      that Nexus's charter home, exactly as the admit writer resolves it), materialize the carriage and
 *      antigen boards on a THROWAWAY Repo bound to the same storage dir (a cold read of the flushed bytes the
 *      CLI wrote) and MERGE each into the running Repo's handle for the same board. The running handle then
 *      holds both what sync brought and what the CLI wrote, so a later live refold cannot read a revoke away,
 *      and the running Repo gossips the merged bytes onward.
 *   3. REFOLD — the antigen ring refolds its own board; the membership holder re-reads every carried Nexus's
 *      deny board and antigen, re-verifies every standing presentation, and swaps its leaf map whole.
 *   4. REPORT — the counts per carried Nexus, plus this vessel's own board.
 *
 * NO-GLOBAL-NOW: every reading is this node's own storage and replica as of now. TRACK-CONTRACTS-NEVER-
 * IDENTITIES holds unchanged — the boards carry operator pubkey nyms and quorum seals only.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/nexus-refresh
 */

import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  materializeSharedLarDoc, kapaeAntigenDocUrl, carriageDocUrl,
  antigenEntriesFromBoard, carriageEntriesFromBoard,
  federationPostureFromDoc, type FederationPosture,
} from "@lararium/mesh";
import { readNexusDoc } from "./nexus-doc.js";
import { carriedSet, charterHomeFor } from "./carried-set.js";
import { nodeNexusIsland } from "./nexus-standing.js";
import type { AntigenRingHolder } from "./antigen-ring.js";
import type { NexusMembershipHolder } from "./nexus-carriage.js";

export interface NexusRefreshDeps {
  /** The Automerge storage dir the running node + the CLI writers both bind (the shared on-disk substrate). */
  readonly storageDir: string;
  /** The `bags/nexus` charter authority home (the CLI supplies the same dir the boot read). */
  readonly sealHome: string;
  /** The node's own island — its own boards' deterministic address seed. */
  readonly nexusPubkey: string;
  /** The node's own vessel verifying key — the term each carried Nexus's island resolves beside its charter. */
  readonly ownVesselKey: string;
  /** The RUNNING Repo — the merge target, and the replica every live refold reads. */
  readonly repo: Repo;
  /** The live antigen ring holder — its Kapae'd set re-folds off its own (now merged) board. */
  readonly antigen: AntigenRingHolder;
  /** The live membership holder — it re-reads the carried Nexuses and re-verifies every presentation. */
  readonly membership: NexusMembershipHolder;
  /** Reassign the sharePolicy's live `federationPosture` closure var. Called ONLY with a freshly-read posture. */
  readonly setPosture: (posture: FederationPosture) => void;
}

/** One carried Nexus's reading after the refresh. */
export interface NexusRefreshPerNexus {
  readonly aid:            string;
  readonly island:         string;
  /** Entries on N's carriage board; the gate reads its counted revokes. */
  readonly denyEntries:    number;
  /** Entries on N's antigen board. */
  readonly antigenEntries: number;
  /** Peers whose presented admit for N now reads held. */
  readonly held:           number;
}

export interface NexusRefreshResult {
  /** The posture the disk charter now names (PRIVATE when the charter is absent / torn — fail-closed). */
  readonly posture: FederationPosture;
  /** This vessel's own antigen board entry count (0 when the board is absent / unsynced). */
  readonly antigenEntries: number;
  /** This vessel's own carriage board entry count (0 when the board is absent / unsynced). */
  readonly memberEntries: number;
  /** This vessel's own island — the address its own boards key on. */
  readonly boardRoot: string;
  /** Every carried Nexus, with its deny board, antigen and held presentations counted. */
  readonly nexuses: readonly NexusRefreshPerNexus[];
}

/** The islands whose boards this refresh merges: this vessel's own, then each carried Nexus's. */
async function refreshIslands(deps: NexusRefreshDeps): Promise<readonly string[]> {
  const out = new Set<string>([deps.nexusPubkey]);
  let aids: ReadonlySet<string>;
  try { aids = await carriedSet(deps.sealHome); } catch { aids = new Set(); }
  for (const aid of aids) {
    const home = charterHomeFor(deps.sealHome, aid);
    if (!home) continue;
    try { out.add(nodeNexusIsland({ ownVesselKey: deps.ownVesselKey, sealHome: home })); } catch { /* no island, no board */ }
  }
  return [...out];
}

/**
 * Re-read the disk charter posture, merge the flushed carriage + antigen boards of this vessel's own island
 * and every carried Nexus into the running Repo, then refold the live holders. One idempotent pass. The
 * throwaway Repo is disposed on return.
 */
export async function runNexusRefresh(deps: NexusRefreshDeps): Promise<NexusRefreshResult> {
  // 1. POSTURE — fresh disk read; PRIVATE on absent / torn (fail-closed: a broken read only ever tightens).
  const posture = federationPostureFromDoc(readNexusDoc(deps.sealHome));
  deps.setPosture(posture);

  // 2. BOARDS — a throwaway Repo on the SAME storage dir reads the flushed bytes cold; each is merged into the
  //    running Repo's handle for the same board, which every live refold reads.
  const throwaway = new Repo({ storage: new NodeFSStorageAdapter(deps.storageDir) });
  const counts = new Map<string, { carriage: number; antigen: number }>();
  try {
    for (const island of await refreshIslands(deps)) {
      const boards: Array<[AutomergeUrl, string]> = [
        [carriageDocUrl(island), "board:carriage-contracts"],
        [kapaeAntigenDocUrl(island), "board:kapae-antigen"],
      ];
      for (const [url, label] of boards) {
        const fresh = await materializeSharedLarDoc(throwaway, url, label);
        const live  = await materializeSharedLarDoc(deps.repo, url, label);
        live.merge(fresh);
      }
      const carriageDoc = (await materializeSharedLarDoc(deps.repo, carriageDocUrl(island), "board:carriage-contracts")).doc();
      const antigenDoc  = (await materializeSharedLarDoc(deps.repo, kapaeAntigenDocUrl(island), "board:kapae-antigen")).doc();
      counts.set(island, {
        carriage: carriageEntriesFromBoard(carriageDoc).length,
        antigen:  antigenEntriesFromBoard(antigenDoc).length,
      });
    }
  } finally {
    // Dispose the throwaway Repo whole — flush its docs AND disconnect its subsystems, so no Repo, no network
    // shore and no storage-throttle timer outlives the call.
    await throwaway.shutdown().catch(() => { /* best-effort — a read-only throwaway repo has nothing to persist */ });
  }

  // 3. REFOLD — each holder swaps its set whole; a fold fault leaves the prior set standing.
  await deps.antigen.refold();
  await deps.membership.refold();

  // 4. REPORT — per carried Nexus, off the readings the membership holder just judged against.
  const held = deps.membership.heldCounts();
  const nexuses: NexusRefreshPerNexus[] = deps.membership.readings().map((r) => ({
    aid: r.aid, island: r.island, denyEntries: r.denyBoard.length, antigenEntries: r.antigen.length,
    held: held.get(r.aid) ?? 0,
  }));
  const own = counts.get(deps.nexusPubkey) ?? { carriage: 0, antigen: 0 };
  return {
    posture,
    antigenEntries: own.antigen,
    memberEntries:  own.carriage,
    boardRoot:      deps.nexusPubkey.toLowerCase(),
    nexuses,
  };
}
