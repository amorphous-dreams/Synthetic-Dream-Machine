/**
 * runEdgeRollAnchors — a seal roll's anchors on the realm edge boards this vessel reads.
 *
 * A SEAL ROLL CARRIES EVERY SHADOW (kapae#/rolls). Beside the carriage board's own anchor, the rotate lands
 * one anchor on each realm edge board this vessel keeps quorum acts for: the quorum of the epoch the roll
 * OPENS signs the closed epoch's id, its seated key-set, and the causal heads of the quorum acts that counted
 * at the closed epoch, together with the anchor that opened it. An act in those heads' past counts at every
 * later head; an act the closed keys mint afterwards sits in no anchor's past, and counts nowhere. Each anchor
 * cites the one before it, so a reader walks every roll from its charter head down.
 * After a seal roll the realm frontier reads stale-lineage until a quorum act, seated vouch, or cosign signs a new head.
 *
 * WHICH BOARDS. The vessel's own ledger names them: every board it has kept a quorum act for, of a realm that
 * stands under the Nexus whose charter rolls (kapae#/edge-hands); another Nexus's roll anchors nothing there. A board this
 * vessel never read takes no anchor from it; a vessel that counted a raise there before the roll keeps
 * counting it by its own ledger's word (`seenAtHead`), and a lift there waits on a hand that reads the board.
 *
 * FAIL CLOSED, before any write: fewer than `opened.threshold` held roots seated in `opened` refuses, and an
 * anchor that does not count under `opened` refuses. The closing keys never sign.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/rolls
 */
import type { Repo } from "@automerge/automerge-repo";
import {
  edgeRollAnchorParents, signEdgeRollAnchor, edgeRollAnchorCounts, edgeRollAnchorCid, writeEdgeRollAnchor,
  keptFromLedger, ledgerScopes, keepInLedger, edgeLedgerDocUrl, realmEdgeBoardDocUrl, materializeSharedLarDoc,
  type KahuQuorumSeats, type LarDoc,
} from "@lararium/mesh";
import { readNexusDoc } from "../nexus-doc.js";
import { loadWornFaceAtomKey } from "../face-atom-store.js";
import { selectHeldQuorumSigners } from "../held-quorum.js";
import { readVesselEdgeBoard, realmNexusIn } from "../edge-board.js";
import { primaryNexusAid } from "../carried-set.js";

export class EdgeRollAnchorError extends Error {}

/** One anchor a roll landed on one realm's edge board. */
export interface EdgeRollAnchorLanded {
  readonly realm:     string;
  readonly anchorCid: string;
  readonly parents:   readonly string[];
  readonly boardUrl:  string;
}

/**
 * The realm boards a roll of the Nexus `rolling` anchors: each realm that stands under that Nexus at this vessel
 * and holds a quorum act the vessel's ledger kept. Sorted. Another Nexus's roll anchors nothing there.
 */
export function edgeRollAnchorRealms(ledger: LarDoc | undefined | null, rolling: string): string[] {
  return ledgerScopes(ledger).filter((scope) =>
    realmNexusIn(ledger, scope) === rolling && keptFromLedger(ledger, scope).acts.some((a) => a.hand === "quorum"));
}

export async function runEdgeRollAnchors(opts: {
  readonly sealHome: string;
  /** The roster at the head the roll closes. */
  readonly closing:  KahuQuorumSeats;
  /** The roster the roll seats, rooted on the new head's epoch cid. */
  readonly opened:   KahuQuorumSeats;
  readonly repo:     Repo;
}): Promise<readonly EdgeRollAnchorLanded[]> {
  const vesselKey = await loadWornFaceAtomKey().catch(() => "");
  if (!vesselKey) return [];                                     // a face with no atom keeps no ledger: nothing to anchor
  const repo = opts.repo;
  const ledger = await materializeSharedLarDoc(repo, edgeLedgerDocUrl(vesselKey), "ledger:edge");
  // A board with no quorum act in this vessel's ledger carries nothing a roll could strand (a fleet's board
  // holds holder acts alone).
  // The roll belongs to the charter at `sealHome`: a realm standing under any other Nexus takes no anchor from it.
  const rolling = primaryNexusAid(opts.sealHome);
  if (rolling === null) return [];
  const realms = edgeRollAnchorRealms(ledger.doc(), rolling);
  if (realms.length === 0) return [];

  const selected = await selectHeldQuorumSigners(opts.opened, (held, k) => new EdgeRollAnchorError(
    `edge roll anchor REFUSED (fail-closed): the vessel holds ${held} seat key(s) the new roster seats, but the anchor ` +
    `carries ${k} distinct signatures of the NEW quorum — the closing keys never sign it.`,
  ));
  const signers = selected.map((s) => ({ signer: s.verifyingKey, sign: s.sign }));
  const sealLineage = readNexusDoc(opts.sealHome)?.sealLineage ?? [];
  const landed: EdgeRollAnchorLanded[] = [];
  try {
    for (const realm of realms) {
      const boardUrl = realmEdgeBoardDocUrl(realm);
      // Count under the CLOSING charter: the roll has yet to write its new head, so the lineage still ends there.
      const read = await readVesselEdgeBoard({
        repo, scope: realm, kind: "realm", boardUrl, label: "board:edge-kapae", vesselKey,
        authorityFor: () => ({ quorum: true }),
        charter: { scope: realm, head: opts.closing, sealLineage },
      });
      const parents = edgeRollAnchorParents(read.counted, opts.closing.sealEpochCid);
      const anchor = await signEdgeRollAnchor({
        scope: realm, prevEpochCid: opts.closing.sealEpochCid, sealEpochCid: opts.opened.sealEpochCid,
        prevKeys: opts.closing.keys, prevThreshold: opts.closing.threshold, parents,
      }, signers);
      if (!(await edgeRollAnchorCounts(anchor, opts.opened))) {
        throw new EdgeRollAnchorError("refusing to write: the edge roll anchor does not count under the new roster (fail-closed).");
      }
      read.handle.change((d) => writeEdgeRollAnchor(d, anchor));
      ledger.change((d) => { keepInLedger(d, realm, { acts: [], anchors: [anchor] }); });
      landed.push({ realm, anchorCid: edgeRollAnchorCid(anchor), parents, boardUrl });
    }
    await repo.flush();
    return landed;
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}
