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
 * WHICH FACE. The board anchor is the charter's act: the new quorum's seat keys sign it, and it lands on every realm board
 * an open face's ledger names, so a roll strands no realm a face here can read. A face's LEDGER is that face's own: the
 * roll keeps its anchor in the ledger of the face it acts as (the face named, else the one face standing open) alone, and
 * reads every other face's ledger without a write (`keptFromLedger`, `readEdgeBoard`). With several faces open and none
 * named it keeps no ledger; each landed anchor names the face whose ledger named its realm, and `keptBy` the face whose
 * ledger kept it. A face resting locked answers `unanchored` by its ordinal, since its ledger stays sealed: nothing drops
 * silently.
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
  keptFromLedger, ledgerScopes, ledgerRealms, keepInLedger, readEdgeBoard, edgeLedgerDocUrl, realmEdgeBoardDocUrl, materializeSharedLarDoc,
  type KahuQuorumSeats, type LarDoc,
} from "@lararium/mesh";
import { readNexusDoc } from "../nexus-doc.js";
import { loadFaceAtomKey } from "../face-atom-store.js";
import { unlockedFaceOrdinals } from "../custody-seat.js";
import { CustodyLocked } from "../custody-holder.js";
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
  /** The face whose ledger named the realm. */
  readonly face:      number;
  /** The face whose ledger kept the anchor: the face the roll acts as, absent where it acts as none. */
  readonly keptBy?:   number;
}

/** A face resting locked: its ledger cannot be read, so a realm only it names takes no anchor from this roll. */
export interface EdgeRollAnchorUnanchored {
  readonly state:  "unanchored";
  readonly face:   number;
  readonly why:    "face-locked";
}

export type EdgeRollAnchorOutcome = EdgeRollAnchorLanded | EdgeRollAnchorUnanchored;

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
  // THE ACTING FACE keeps the anchor in its own ledger: the face named, else the one face standing open, else none.
  const acting = opts.face ?? (open.length === 1 ? open[0] : undefined);
  const ledgerOf = async (face: number) => {
    // A face with no atom keeps no ledger; a named face resting locked refuses by its own name, before any write.
    const key = await loadFaceAtomKey(face).catch((e: unknown) => { if (e instanceof CustodyLocked) throw e; return ""; });
    return key ? { key, ledger: await materializeSharedLarDoc(repo, edgeLedgerDocUrl(key), "ledger:edge") } : null;
  };
  // realm -> the face whose ledger names it (the acting face first) and that ledger.
  const named = new Map<string, { readonly face: number; readonly key: string; readonly ledger: Awaited<ReturnType<typeof materializeSharedLarDoc>> }>();
  const faces = acting === undefined ? open : [acting, ...open.filter((f) => f !== acting)];
  for (const face of faces) {
    const read = await ledgerOf(face);
    if (!read) continue;
    // A board with no quorum act in a ledger carries nothing a roll could strand (a fleet's board holds holder acts alone).
    for (const realm of edgeRollAnchorRealms(read.ledger.doc(), rolling)) if (!named.has(realm)) named.set(realm, { face, ...read });
  }
  const realms = [...named.keys()].sort();
  if (realms.length === 0) return locked;

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
      const at = named.get(realm)!;
      const charter = { scope: realm, head: opts.closing, sealLineage };
      const authorityFor = () => ({ quorum: true });
      // Count under the CLOSING charter: the roll has yet to write its new head, so the lineage still ends there. The
      // acting face's read keeps what counted in its own ledger; another face's ledger reads without a write.
      const read = at.face === acting
        ? await readVesselEdgeBoard({ repo, scope: realm, kind: "realm", boardUrl, label: "board:edge-kapae", vesselKey: at.key, authorityFor, charter })
        : await (async () => {
          const handle = await materializeSharedLarDoc(repo, boardUrl, "board:edge-kapae");
          const counted = (await readEdgeBoard({ board: handle.doc(), kept: keptFromLedger(at.ledger.doc(), realm), authorityFor, charter })).counted;
          return { handle, counted };
        })();
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
      if (at.face === acting) at.ledger.change((d) => { keepInLedger(d, realm, { acts: [], anchors: [anchor] }); });
      landed.push({ state: "landed", realm, anchorCid: edgeRollAnchorCid(anchor), parents, boardUrl, face: at.face,
        ...(at.face === acting ? { keptBy: acting } : {}) });
    }
    await repo.flush();
    return [...landed, ...locked];
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}
