/**
 * edge-cosign — the door that carries a quorum edge act between seats on separate vessels (kapae#/edge-hands).
 *
 * TWO ACTS, ONE ON EACH VESSEL.
 *   · `runEdgePartial` — a vessel that holds fewer seats than the act takes signs with the seats it holds and
 *     hands back a PARTIAL: the whole act image and the subject in plain keys. It writes nothing to any board,
 *     since an act short of its threshold counts for nothing.
 *   · `runEdgeCosign`  — a second seat's vessel reads the partial, judges it against its OWN charter and its OWN
 *     read of the realm's edge board, adds the seats it holds, and lands the act once the threshold meets. Short
 *     of the threshold it hands the grown partial on. The vessel that signed first lands the finished act
 *     through this same door.
 *
 * A PERSON CARRIES THE PARTIAL. It crosses as text, by any road; no relay reads it and no clock bounds it. A
 * stale partial and a replay refuse by causal position alone (`judgeEdgeActPartial`): the charter's head epoch,
 * the line's own heads, the board's own count.
 *
 * A PERSON SIGNS. Each seat's signature comes from a persona root this vessel holds, by this door, on a
 * person's own command; no seat signs for another, and no session signs at all.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/edge-hands
 */
import type { Repo } from "@automerge/automerge-repo";
import {
  signEdgeKapae, writeEdgeKapae, edgeLineHeads, realmEdgeBoardDocUrl, realmEdgeAuthority, readLedgeredVouches,
  ed25519SignerFromSeed, edgeActPartial, readEdgeActPartial, judgeEdgeActPartial, cosignEdgeActPartial, edgeIdOfSubject,
  type EdgeActPartial, type EdgeKapaeVerdict, type EdgePartialSubject, type EdgeSigner, type KahuQuorumSeats, type PartialVerdict,
} from "@lararium/mesh";
import { listPersonaRoots, loadPersonaGroupRootSeed, loadPersonaGroupRootVerifyingKey, loadVesselVerifyingKey } from "../node-vessel-identity.js";
import { readVesselEdgeBoard, vesselEdgeCharter } from "../edge-board.js";

export class EdgeCosignError extends Error {
  constructor(message: string, readonly verdict?: PartialVerdict) { super(message); }
}

const HEX64 = /^[0-9a-f]{64}$/;
const bare = (key: string): string => key.trim().toLowerCase().replace(/^0x/, "");

/** The persona roots this vessel holds that sit in a roster, each as a signer. No threshold: a partial takes any. */
async function heldSeatSigners(roster: KahuQuorumSeats, except: ReadonlySet<string> = new Set()): Promise<EdgeSigner[]> {
  const seats = new Set(roster.keys.map(bare));
  const out: EdgeSigner[] = [];
  const seen = new Set<string>();
  for (const handleIndex of await listPersonaRoots()) {
    const key = bare((await loadPersonaGroupRootVerifyingKey(handleIndex)) ?? "");
    if (!seats.has(key) || seen.has(key) || except.has(key)) continue;
    seen.add(key);
    out.push({ signer: key, sign: ed25519SignerFromSeed(await loadPersonaGroupRootSeed(handleIndex)) });
  }
  return out;
}

async function readRealm(repo: Repo, realm: string, sealHome: string) {
  const vesselKey = await loadVesselVerifyingKey();
  if (!vesselKey) throw new EdgeCosignError("this vessel surfaces no verifying key — it keeps no ledger to read a board against.");
  const charter = vesselEdgeCharter(realm, sealHome);
  if (!charter) throw new EdgeCosignError("no seated charter stands on this vessel — the quorum hand has no seats to sign with.");
  const vouches = await readLedgeredVouches({ repo, realm, vesselKey });
  const read = () => readVesselEdgeBoard({
    repo, scope: realm, kind: "realm", boardUrl: realmEdgeBoardDocUrl(realm), label: "board:edge-kapae", vesselKey,
    authorityFor: realmEdgeAuthority(vouches.invites), charter,
  });
  return { charter, read };
}

export interface EdgePartialOptions {
  readonly realm:    string;
  /** The member whose whole relation to the realm the act concerns. */
  readonly member?:  string;
  /** Or one vouch: its voucher and its joiner. */
  readonly voucher?: string;
  readonly joiner?:  string;
  readonly raised:   boolean;
  readonly sealHome: string;
  readonly repo:     Repo;
}

export interface EdgePartialResult {
  readonly partial:   EdgeActPartial;
  readonly edgeId:    string;
  readonly actCid:    string;
  /** The seats that signed, and the threshold the act takes. */
  readonly signed:    readonly string[];
  readonly threshold: number;
}

/** Sign a quorum edge act with the seats this vessel holds, and hand it back as a partial. Writes no board. */
export async function runEdgePartial(opts: EdgePartialOptions): Promise<EdgePartialResult> {
  const realm = bare(opts.realm);
  if (!HEX64.test(realm)) throw new EdgeCosignError(`--realm expects a 64-hex realm id, got "${opts.realm}".`);
  const subject: EdgePartialSubject | null =
    opts.member !== undefined && opts.voucher === undefined && opts.joiner === undefined ? { kind: "member", member: bare(opts.member) }
    : opts.member === undefined && opts.voucher !== undefined && opts.joiner !== undefined ? { kind: "vouch", voucher: bare(opts.voucher), joiner: bare(opts.joiner) }
    : null;
  if (subject === null) throw new EdgeCosignError("name ONE relationship in plain keys: --member <key>, or --voucher <key> with --joiner <key>.");
  const edgeId = edgeIdOfSubject(realm, subject);
  if (edgeId === null) throw new EdgeCosignError("the keys that name the relationship read as no 64-hex key.");
  const { charter, read } = await readRealm(opts.repo, realm, opts.sealHome);
  const signers = await heldSeatSigners(charter.head);
  if (signers.length === 0) throw new EdgeCosignError("REFUSED: this vessel holds no seat of the charter's quorum, so it signs no part of a quorum act.");
  if (signers.length >= charter.head.threshold) {
    throw new EdgeCosignError("this vessel holds a whole quorum — sign the act outright with `lares edge kapae … --quorum`; a partial serves seats on separate vessels.");
  }
  const before = await read();
  const parents = edgeLineHeads(before.counted.acts, edgeId, "quorum");
  const act = await signEdgeKapae({ edgeId, raised: opts.raised, hand: "quorum", parents, epochCid: charter.head.sealEpochCid }, signers);
  await opts.repo.flush();
  return { partial: edgeActPartial(act, realm, subject), edgeId, actCid: act.actCid, signed: signers.map((s) => s.signer), threshold: charter.head.threshold };
}

export interface EdgeCosignResult {
  readonly edgeId:    string;
  readonly actCid:    string;
  readonly raised:    boolean;
  readonly subject:   EdgePartialSubject;
  /** The seats this vessel added in this call. Empty when the act arrived whole. */
  readonly added:     readonly string[];
  /** Every seat whose signature verifies on the act as it stands. */
  readonly signed:    readonly string[];
  readonly threshold: number;
  /** True once the act landed on this vessel's board and counts there. */
  readonly landed:    boolean;
  /**
   * What a confirmed call would do, where this call only READ the partial: `cosign` adds this vessel's seats,
   * `land` writes an act that arrived whole. Absent once the call acted.
   */
  readonly would?:    "cosign" | "land";
  /** The act as it stands, for the next seat: grown, or whole. */
  readonly partial:   EdgeActPartial;
  readonly shadowStands?: boolean;
  readonly verdict?:  EdgeKapaeVerdict;
}

/**
 * Judge a partial; then, on a person's confirmation alone, add the seats this vessel holds and land the act once
 * its threshold meets.
 *
 * A PERSON READS BEFORE A SEAT SIGNS. Without a confirmation this door signs nothing and lands nothing: it answers
 * what the partial reads here (its subject, its gesture, the seats that signed) and what a confirmed call would
 * do. The reading comes from the partial's own verified bytes, never from any text that travelled beside it. Like
 * every read of a board, it keeps what it counted in the vessel's own ledger. THE CONFIRMATION NAMES THE ACT: it
 * carries the act id the read printed, and a partial that holds any other act refuses.
 */
export async function runEdgeCosign(opts: { readonly partial: unknown; readonly sealHome: string; readonly repo: Repo; readonly confirmActCid?: string }): Promise<EdgeCosignResult> {
  const partial = readEdgeActPartial(opts.partial);
  if (partial === null) {
    throw new EdgeCosignError("REFUSED (invalid): that text reads as no partial — its act, its realm and its subject must name one edge, and its id must derive from its own bytes.", "invalid");
  }
  const { charter, read } = await readRealm(opts.repo, partial.scope, opts.sealHome);
  const before = await read();
  const first = judgeEdgeActPartial(partial, { charter, counted: before.counted });
  if (first.verdict !== "ready" && first.verdict !== "complete") {
    throw new EdgeCosignError(`REFUSED (${first.verdict}): ${first.why ?? "the partial does not stand here"}.`, first.verdict);
  }
  if (opts.confirmActCid !== undefined && opts.confirmActCid.trim().toLowerCase() !== partial.act.actCid) {
    throw new EdgeCosignError("REFUSED: the act this partial carries differs from the act the confirmation names — read the partial again before any seat signs.");
  }
  if (opts.confirmActCid === undefined) {
    await opts.repo.flush();
    return {
      edgeId: partial.act.edgeId, actCid: partial.act.actCid, raised: partial.act.raised, subject: partial.subject,
      added: [], signed: first.signed, threshold: charter.head.threshold, partial, landed: false,
      would: first.verdict === "ready" ? "cosign" : "land",
    };
  }
  let standing = partial, added: string[] = [], judged = first;
  if (first.verdict === "ready") {
    const signers = await heldSeatSigners(charter.head, new Set(first.signed));
    if (signers.length === 0) {
      throw new EdgeCosignError("REFUSED: every seat this vessel holds already signed that act, or it holds none — another seat's vessel cosigns it.");
    }
    standing = await cosignEdgeActPartial(partial, signers);
    added = signers.map((s) => s.signer);
    judged = judgeEdgeActPartial(standing, { charter, counted: before.counted });
  }
  const base = {
    edgeId: standing.act.edgeId, actCid: standing.act.actCid, raised: standing.act.raised, subject: standing.subject,
    added, signed: judged.signed, threshold: charter.head.threshold, partial: standing,
  };
  if (judged.verdict !== "complete") return { ...base, landed: false };
  before.handle.change((d) => writeEdgeKapae(d, standing.act));
  await opts.repo.flush();
  // Read the act BACK through the counting fold: the door reports standing, never the gesture.
  const after = await read();
  await opts.repo.flush();
  const reading = after.readings.get(standing.act.edgeId);
  const counts = after.counted.acts.some((a) => a.actCid === standing.act.actCid);
  return { ...base, landed: counts, shadowStands: reading?.stands ?? false, ...(reading ? { verdict: reading.verdict } : {}) };
}
