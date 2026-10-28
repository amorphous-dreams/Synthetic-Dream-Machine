/**
 * runEdgeRollAnchors — a seal roll's anchors on the realm edge boards this vessel reads.
 *
 * A SEAL ROLL CARRIES EVERY SHADOW (kapae#/rolls). Beside the carriage board's own anchor, the rotate lands
 * one anchor on each realm edge board this vessel keeps quorum acts for: the quorum of the epoch the roll
 * OPENS signs the closed epoch's id, its seated key-set, and the causal heads of the quorum acts that counted
 * at the closed epoch, together with the anchor that opened it. An act in those heads' past counts at every
 * later head; an act the closed keys mint afterwards sits in no anchor's past, and counts nowhere. Each anchor
 * cites the one before it, so a reader walks every roll from its charter head down.
 *
 * WHICH BOARDS. The acting face's own ledger names them: every board it has kept a quorum act for, of a realm that
 * stands under the Nexus whose charter rolls (kapae#/edge-hands); another Nexus's roll anchors nothing there. A board this
 * face never read takes no anchor from it; a vessel that counted a raise there before the roll keeps
 * counting it by its own ledger's word (`seenAtHead`), and a lift there waits on a hand that reads the board.
 *
 * WHICH FACE. The roll acts as the face the caller named, else the one face standing open; with several open and none
 * named it refuses `FaceNotNamed` before any write. It writes only that face's ledger. A realm another open face's ledger
 * names, and the acting face's does not, answers `unanchored` by name with that face; a face resting locked answers
 * `unanchored` with no realm, since its ledger stays sealed. Nothing drops silently.
 *
 * FAIL CLOSED, before any write: fewer than `opened.threshold` held roots seated in `opened` refuses, and an
 * anchor that does not count under `opened` refuses. The closing keys never sign.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/rolls
 */
import type { Repo } from "@automerge/automerge-repo";
import {
  edgeRollAnchorParents, signEdgeRollAnchor, edgeRollAnchorCounts, edgeRollAnchorCid, writeEdgeRollAnchor,
  charterHandLineage, prepareRealmFrontier, registerRealmFrontierInto, realmRaiseCids, type SealEpoch,
  keptFromLedger, ledgerScopes, ledgerRealms, keepInLedger, edgeLedgerDocUrl, realmEdgeBoardDocUrl, materializeSharedLarDoc,
  type KahuQuorumSeats, type LarDoc,
} from "@lararium/mesh";
import { readNexusDoc } from "../nexus-doc.js";
import { loadFaceAtomKey } from "../face-atom-store.js";
import { unlockedFaceOrdinals } from "../custody-seat.js";
import { CustodyLocked } from "../custody-holder.js";
import { resolveFace } from "../face-selector.js";
import { listFaceOrdinals } from "../identity-anchors.js";
import { selectHeldQuorumSigners } from "../held-quorum.js";
import { readVesselEdgeBoard, realmNexusIn } from "../edge-board.js";
import { primaryNexusAid } from "../carried-set.js";

export class EdgeRollAnchorError extends Error {}

/** One anchor a roll landed on one realm's edge board. */
export interface EdgeRollAnchorLanded {
  readonly state:     "landed";
  readonly realm:     string;
  readonly anchorCid: string;
  readonly parents:   readonly string[];
  readonly boardUrl:  string;
}

/**
 * A realm the roll left unanchored because the acting face does not name it: another open face's ledger names it
 * (`realm` set), or a face rests locked and its ledger cannot be read (`realm` absent).
 */
export interface EdgeRollAnchorUnanchored {
  readonly state:  "unanchored";
  readonly face:   number;
  readonly why:    "another-face" | "face-locked";
  readonly realm?: string;
}

export type EdgeRollAnchorOutcome = EdgeRollAnchorLanded | EdgeRollAnchorUnanchored;

/**
 * The face a roll acts as, read BEFORE the roll writes anything (the carriage anchor included): the face named, which must
 * open (a named face resting locked refuses `CustodyLocked` by its own name), else the one face standing open, else none
 * where no face stands open. Several open with none named refuse `FaceNotNamed` here, so nothing lands and then refuses.
 */
export async function rollAnchorFace(named?: number): Promise<number | undefined> {
  if (named !== undefined) {
    await loadFaceAtomKey(named).catch((e: unknown) => { if (e instanceof CustodyLocked) throw e; return ""; });
    return named;
  }
  const open = await unlockedFaceOrdinals().catch((e: unknown) => { if (e instanceof CustodyLocked) return [] as number[]; throw e; });
  return open.length === 0 ? undefined : resolveFace(undefined);
}

/**
 * The realm boards a roll of the Nexus `rolling` anchors: each realm that stands under that Nexus at this vessel,
 * whether its ledger kept a quorum act there or only noted the realm. The roll signs the realm's head under the new
 * epoch for every one, so no realm reads stale-lineage after a roll. Sorted. Another Nexus's roll anchors nothing there.
 */
export function edgeRollAnchorRealms(ledger: LarDoc | undefined | null, rolling: string): string[] {
  return [...new Set([...ledgerScopes(ledger), ...ledgerRealms(ledger)])].filter((scope) =>
    realmNexusIn(ledger, scope) === rolling && (ledgerRealms(ledger).includes(scope) || keptFromLedger(ledger, scope).acts.some((a) => a.hand === "quorum"))).sort();
}

export async function runEdgeRollAnchors(opts: {
  readonly sealHome: string;
  /** The roster at the head the roll closes. */
  readonly closing:  KahuQuorumSeats;
  /** The roster the roll seats, rooted on the new head's epoch cid. */
  readonly opened:   KahuQuorumSeats;
  readonly openedEpoch: SealEpoch;
  readonly repo:     Repo;
  /** The face the roll acts as (`--face N`); absent, the one face standing open. */
  readonly face?:    number;
}): Promise<readonly EdgeRollAnchorOutcome[]> {
  const repo = opts.repo;
  // The roll belongs to the charter at `sealHome`: a realm standing under any other Nexus takes no anchor from it.
  const rolling = primaryNexusAid(opts.sealHome);
  if (rolling === null) return [];
  // A locked seat opens no face, so no ledger reads: the roll anchors nothing, as a faceless vessel does.
  const open = await unlockedFaceOrdinals().catch((e: unknown) => { if (e instanceof CustodyLocked) return [] as number[]; throw e; });
  const locked: EdgeRollAnchorUnanchored[] = listFaceOrdinals().filter((f) => !open.includes(f) && f !== opts.face)
    .map((face) => ({ state: "unanchored", face, why: "face-locked" }));
  if (open.length === 0 && opts.face === undefined) return locked;
  // THE ACTING FACE, resolved before any read or write: several open and none named refuses here.
  const acting = await resolveFace(opts.face);
  const ledgerOf = async (face: number) => {
    // A face with no atom keeps no ledger; a named face resting locked refuses by its own name.
    const key = await loadFaceAtomKey(face).catch((e: unknown) => { if (e instanceof CustodyLocked) throw e; return ""; });
    return key ? { key, ledger: await materializeSharedLarDoc(repo, edgeLedgerDocUrl(key), "ledger:edge") } : null;
  };
  const own = await ledgerOf(acting);
  // A board with no quorum act in a ledger carries nothing a roll could strand (a fleet's board holds holder acts alone).
  const realms = own ? edgeRollAnchorRealms(own.ledger.doc(), rolling) : [];
  const elsewhere: EdgeRollAnchorUnanchored[] = [];
  for (const face of open) {
    if (face === acting) continue;
    const theirs = await ledgerOf(face);
    if (!theirs) continue;
    for (const realm of edgeRollAnchorRealms(theirs.ledger.doc(), rolling)) {
      if (!realms.includes(realm) && !elsewhere.some((u) => u.realm === realm)) elsewhere.push({ state: "unanchored", face, why: "another-face", realm });
    }
  }
  const unanchored = [...elsewhere, ...locked];
  if (realms.length === 0 || own === null) return unanchored;

  const selected = await selectHeldQuorumSigners(opts.opened, (held, k) => new EdgeRollAnchorError(
    `edge roll anchor REFUSED (fail-closed): the vessel holds ${held} seat key(s) the new roster seats, but the anchor ` +
    `carries ${k} distinct signatures of the NEW quorum — the closing keys never sign it.`,
  ));
  const signers = selected.map((s) => ({ signer: s.verifyingKey, sign: s.sign }));
  const sealLineage = readNexusDoc(opts.sealHome)?.sealLineage ?? [];
  const openedLineage = charterHandLineage([...sealLineage, opts.openedEpoch]);
  if (!openedLineage || openedLineage.roster.sealEpochCid !== opts.opened.sealEpochCid) {
    throw new EdgeRollAnchorError("edge roll anchor REFUSED: the opened epoch does not extend the verified charter lineage");
  }
  const landed: EdgeRollAnchorOutcome[] = [];
  try {
    for (const realm of realms) {
      const boardUrl = realmEdgeBoardDocUrl(realm);
      // Count under the CLOSING charter: the roll has yet to write its new head, so the lineage still ends there.
      const read = await readVesselEdgeBoard({
        repo, scope: realm, kind: "realm", boardUrl, label: "board:edge-kapae", vesselKey: own.key,
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
      const head = await prepareRealmFrontier({ realm, board: read.handle.doc(), lineage: openedLineage.lineage,
        counted: realmRaiseCids(read.counted.acts),
        signers: selected.map((s) => ({ key: s.verifyingKey, sign: s.sign })) });
      read.handle.change((d) => { writeEdgeRollAnchor(d, anchor); registerRealmFrontierInto(d, head); });
      own.ledger.change((d) => { keepInLedger(d, realm, { acts: [], anchors: [anchor] }); });
      landed.push({ state: "landed", realm, anchorCid: edgeRollAnchorCid(anchor), parents, boardUrl });
    }
    await repo.flush();
    return [...landed, ...unanchored];
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}
