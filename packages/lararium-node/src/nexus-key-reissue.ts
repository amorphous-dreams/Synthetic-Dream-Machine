/**
 * nexus-key-reissue — THE FACE'S LINEAGE RE-ISSUES ITS KEY AT ONE NEXUS, by a signed hand-over.
 *
 * A face holds one key at each Nexus, minted at random (`face-key-custody`, row `face-proof-key`). The Nexus admitted
 * that key as the face's `nym`. A re-issue hands the face's standing on to a fresh key: the standing key and its
 * successor both sign one hand-over (`nexus-key-line`), the record lands on the Nexus's carriage board, where every
 * gate of that Nexus reads it beside the admit, and this vessel keeps a copy beside its consent (`carried-set`). The
 * admit, the consent and every relation keep naming the admitted nym; the gate stands a presenter only under the
 * HEAD of that nym's line, and a kapae on any key of the line holds the whole line.
 *
 * ── THE ORDER, AND WHAT A CRASH LEAVES ──────────────────────────────────────────────────────────
 *   1. The row takes the standing key AND a successor minted at random, in one sealed write.
 *   2. Both keys sign the hand-over; this vessel keeps it, then lands it on the board.
 *   3. The row keeps the successor alone: the standing key leaves this vessel.
 * A crash before step 3 leaves the row holding both keys; the standing key still signs (`readNexusKey`), and the
 * next run of this door resumes with the SAME successor, so the hand-over it lands repeats byte for byte. A refusal
 * after step 1 drops the successor again, so a refused re-issue leaves the row as it stood.
 *
 * ── WHAT A RE-ISSUE ANSWERS, AND WHAT IT DOES NOT ───────────────────────────────────────────────
 * A re-issue moves a key the face still holds. A COMPROMISE of that key takes the face-key roll (a revoke and a
 * fresh admit on the Nexus's board): a thief holding the old key could sign a hand-over of its own, and the gate
 * then reads two hand-overs from one key, a fork, which refuses the line whole.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-key-hierarchy
 */
import type { Repo } from "@automerge/automerge-repo";
import {
  admittedKeyOf, carriageDocUrl, ed25519SignerFromSeed, foundingRoster, materializeSharedLarDoc, signNexusKeyHandOver,
  writeNexusKeyHandOver, nexusKeyHandOverId,
} from "@lararium/mesh";
import { abandonNexusKeyReissue, beginNexusKeyReissue, finishNexusKeyReissue, nexusKeyPublicOf, readNexusKey } from "./face-key-custody.js";
import { charterHomeFor, keepKeyLine, primaryNexusAid } from "./carried-set.js";
import { keyLineAt } from "./nexus-carriage.js";
import { readNexusDoc } from "./nexus-doc.js";
import { nodeNexusIsland } from "./nexus-standing.js";
import { loadVesselVerifyingKey, makeNodeFsPersonaVault } from "./node-vessel-identity.js";
import { refuseWhileProvisional } from "./face-provisional.js";

export class NexusKeyReissueRefused extends Error {}

export interface NexusKeyReissued {
  readonly nexusAid:   string;
  readonly handleIndex: number;
  /** The key that handed its standing on, and the key that holds it now. */
  readonly from:       string;
  readonly to:         string;
  /** The hand-over's own content id. */
  readonly handOver:   string;
  /** The key the Nexus admitted, which the line leads from. */
  readonly admitted:   string;
}

/**
 * Re-issue the WORN face's key at the Nexus named by `nexusAid` (absent: this vessel's own charter). Refuses where the
 * vessel wears no face, keeps no charter for that Nexus, holds no key there, or holds a key the line already handed
 * on. `repo` names the store's one holder the hand-over lands on.
 */
export async function runNexusKeyReissue(opts: {
  readonly sealHome: string; readonly nexusAid?: string; readonly repo: Repo;
}): Promise<NexusKeyReissued> {
  const aid = (opts.nexusAid ?? primaryNexusAid(opts.sealHome) ?? "").trim().toLowerCase();
  if (!aid) throw new NexusKeyReissueRefused("this vessel holds no charter — name the Nexus (--nexus <aid>)");
  const home = charterHomeFor(opts.sealHome, aid);
  if (!home || foundingRoster(readNexusDoc(home)).sealEpochCid.length === 0) {
    throw new NexusKeyReissueRefused(`this vessel keeps no seated charter for ${aid.slice(0, 18)}… — its gates read no line here`);
  }
  const vault = await makeNodeFsPersonaVault();
  const worn = await vault.selector.load();
  if (worn === undefined || !(await vault.hasRoot(worn))) {
    throw new NexusKeyReissueRefused("this vessel wears no face — a face re-issues its own key: `lares persona wear <N>` first");
  }
  // A re-issue hands the face's standing at a Nexus to a new key: a restored face waits on a party's view first.
  await refuseWhileProvisional(worn, "a key re-issue at a Nexus");
  const standing = await readNexusKey(worn, aid);
  if (standing === null) throw new NexusKeyReissueRefused(`the face at h${worn} holds no key in ${aid.slice(0, 18)}… — nothing to re-issue`);
  standing.fill(0);

  const island = nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: home });
  const board = await materializeSharedLarDoc(opts.repo, carriageDocUrl(island), "board:carriage-contracts");
  const keys = await beginNexusKeyReissue(worn, aid);
  try {
    const from = nexusKeyPublicOf(keys.from);
    const to = nexusKeyPublicOf(keys.to);
    // THE STANDING KEY HEADS ITS LINE. A key the line already handed on hands nothing on again: a second hand-over
    // from it would read as a fork at every gate.
    const line = keyLineAt(opts.sealHome, aid, board.doc());
    // A RESUMED re-issue whose hand-over already landed: the line leads through this very pair.
    const landed = line.some((r) => r.from === from && r.to === to);
    const admitted = admittedKeyOf({ nexus: aid, key: landed ? to : from, carried: line });
    if (admitted === null) {
      await abandonNexusKeyReissue(worn, aid, keys.to);
      throw new NexusKeyReissueRefused("the key this face holds there already handed its standing on, or its line forks — a re-issue starts from the line's head; nothing moved");
    }
    const record = await signNexusKeyHandOver({ nexus: aid, from, to }, ed25519SignerFromSeed(keys.from), ed25519SignerFromSeed(keys.to));
    keepKeyLine(opts.sealHome, aid, record);
    board.change((d) => writeNexusKeyHandOver(d, record));
    await opts.repo.flush();
    await finishNexusKeyReissue(worn, aid, keys.to);
    return { nexusAid: aid, handleIndex: worn, from, to, handOver: nexusKeyHandOverId(record), admitted };
  } finally {
    keys.from.fill(0);
    keys.to.fill(0);
  }
}
