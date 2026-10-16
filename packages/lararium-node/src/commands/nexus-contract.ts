/**
 * runNexusContract / runNexusAcceptCarriage / runNexusMembersList — the RAISE side of the operator MEMBERS-registry
 * (the Kapae-antigen's ALLOW-twin). The founding kahu WRITE a quorum-signed `admit` / `revoke` onto the
 * always-carried members BOARD; the READER (`members-board`) + the consult (`nexus-membership`,
 * `carrierShareDecision`) fold it. This is the writer they were missing — the mirror of `runNexusKapae`.
 *
 * TWO WAX-SEALS ride an ADMIT (membership-doctrine):
 *   · the OPERATOR's own "accepts carriage" contract-sig (the contract-in). Either the joining operator produced
 *     it out-of-band (`lares nexus accept-carriage` → a token supplied via `contractSig`), OR — the a-multitude-
 *     of-one ceremony — the vessel HOLDS a persona whose per-Nexus leaf IS the admitted nym and self-signs with
 *     that leaf. FAIL CLOSED: no valid contract-in → REFUSE. A Nexus cannot conscript an operator into
 *     carriage; the operator consents first.
 *
 * THE SUBJECT IS A PER-NEXUS LEAF, never a PersonaGroup root (`nexus-leaf`). The members board travels, so
 * the nym it carries is published; a leaf presents a different key to each Nexus and the same key to one
 * Nexus across a seal rotation, where a root would name the human's device-group on every island at once.
 *
 * THE QUORUM SIGNS WITH THE SEATS' OWN KEYS (`held-quorum`, `seat-key-store`): a seat's key stands apart from
 * every persona root and every leaf, so the charter publishes no root and no dialing key signs a quorum's act.
 *   · ≥ threshold founding-kahu quorum signatures (the steward act — identical to the antigen's).
 * A REVOKE needs the kahu quorum ONLY (an uncooperative member cannot veto its own removal).
 *
 * TWO VAULTS, ONE ACT (kapae#/edge-hands). A Nexus whose seats rest in two vaults (a two-founder Nexus) signs no
 * admit or revoke whole in either. `runNexusContractOpen` signs with every seat this vessel holds and hands back a
 * PARTIAL (`nexus-partial`) that carries the whole act and writes no board; the other vault's
 * `runNexusContractPartial` judges it against its own charter head and board, cosigns with the seats it holds
 * only where the judge reads `ready`, and lands the act once it reads `complete`. The first vault lands the
 * completed partial the same way. A stale head, a moved line, a replay or a foreign Nexus writes no signature and
 * no board act. `aid` names a charter this vessel carries (a joint Nexus files under its own AID beside the seed).
 *
 * TRACK CONTRACTS, NEVER IDENTITIES: the writer takes an operator PUBKEY nym + (for admit) a carriage contract-sig.
 * No name / email / device / behavior is read, asked, or written — the FLOOR alone lands on the board.
 *
 * FAIL CLOSED, at every shore (mirrors nexus-kapae):
 *   · an unseated / quorum-short charter → REFUSE (nothing to root a quorum on); no board write.
 *   · fewer than `threshold` HELD seat keys that sit IN the seated roster → REFUSE; no sub-quorum entry.
 *   · an admit with no valid contract-in → REFUSE; never write a conscripted member.
 *   · an entry that does not COUNT against the seated roster → REFUSE; never write a dead admit.
 *   · a malformed nym → REFUSE.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-operator-contract
 */

import type { Repo } from "@automerge/automerge-repo";
import {
  judgeNexusActPartial, cosignNexusActPartial, nexusActPartial, readNexusActPartial, NexusPartialRefusal,
  type NexusActPartial, type NexusPartialReader, type PartialVerdict,
  carriageEntriesFromBoard, writeCarriageEntry, signCarriageQuorum, carriageEntryActCid, signCarriageContract,
  signCarrierContract, verifyCarrierContract, verifyCarriageConsent, carriageEntryCounts, foldCarriageDetails, foldCarriageSet,
  holdsCarriage, holdsCarrier, foundingRoster, presentationFromBoardDoc,
  carriageDocUrl, materializeSharedLarDoc, ed25519SignerFromSeed, nexusAidOf,
  rollAnchorsFromBoard, rollAnchorParents, signRollAnchor, rollAnchorCounts, rollAnchorCid, writeRollAnchor, epochSeats,
  kahuCabalActsFromBoard, kahuCabalActCounts, kahuCabalActCid,
  admitCarriageCommit, openAdmitCarriage,
  realmEdgeBoardDocUrl, edgeLedgerDocUrl, readEdgeBoard, keptFromLedger, keepInLedger, ledgerRealms, ledgerScopes, edgeRollAnchorsFromBoard, edgeKapaeActsFromBoard,
  edgeRollAnchorParents, edgeRollAnchorCounts, edgeRollAnchorCid, signEdgeRollAnchor, writeEdgeRollAnchor, mergeEdgeRollAnchors,
  type CountedEdgeBoard, type EdgeRollAnchor,
  type AdmitOpening, type CarriageAction, type CarriageEntry, type KahuQuorumSeats, type QuorumSignature, type RollAnchor, type LarDoc,
  type PresentationFinding,
} from "@lararium/mesh";
import { readNexusDoc } from "../nexus-doc.js";

import { personaRootExists, loadVesselVerifyingKey, loadVesselSigningSeed } from "../node-vessel-identity.js";
import { selectHeldQuorumSigners } from "../held-quorum.js";
import { nodeNexusIsland } from "../nexus-standing.js";
import { heldNexusLeaves, mintNexusLeaf } from "../nexus-leaf.js";
import { charterHomeFor, primaryNexusAid, writeConsent, type CarriageConsent } from "../carried-set.js";
import { heldSeatSigners } from "../held-quorum.js";
import { judgeStillBeforeWrite } from "../partial-landing.js";
import { realmNexusIn } from "../edge-board.js";
import { edgeRollAnchorRealms } from "./edge-roll-anchor.js";
import type { AdmitBundle } from "../admit-bundle.js";
import { admitCanonDocs } from "./device-admit.js";

/** An operator nym reads clean only at the exact ed25519 verifying-key length — a stray value never admits. */
const NYM_RE = /^[0-9a-f]{64}$/;

/** A REFUSAL the CLI renders as a clean fail-closed message (never a stack, never a partial write). */
export class NexusContractError extends Error {}

export interface NexusContractOptions {
  readonly action:     CarriageAction;
  readonly nym:        string;
  /** The joining operator's "accepts carriage" contract-sig hex (from `nexus accept-carriage`). Admit only;
   *  optional when the nym is a per-Nexus leaf of a persona this vessel holds (multitude-of-one self-sign). */
  readonly contractSig?: string;
  /** The joining PLACE's carrier seal hex, signed by its own device-minted VESSEL key (`nexus carry-for` on
   *  that place). `carry` only, and REQUIRED there: this path reads NO persona seed and mints NO root, so
   *  there is no self-sign arm and a Nexus never conscripts a crossroads either. */
  readonly carrierSig?:  string;
  /** The charter DOC's authority home (the CLI supplies `larSealHome()`). */
  readonly sealHome:    string;
  /** The store's one holder: the standing vessel's own Repo, or the direct holder's (`ownedStore`). */
  readonly repo:        Repo;
  /** The Nexus the act lands under, where this vessel carries its charter beside the primary; absent names the primary. */
  readonly aid?:        string;
}

export interface NexusContractResult {
  readonly action:          CarriageAction;
  readonly nym:             string;
  /** Causal evidence this act explicitly extends; empty means a local genesis observation. */
  readonly parents:          readonly string[];
  /** Semantic act CID, excluding signatures and contract evidence. */
  readonly evidenceCid:      string;
  readonly sealEpochCid: string;
  readonly threshold:       number;
  readonly signers:         readonly string[];
  /** How the subject's consent arrived: "supplied" (out-of-band token), "self" (held seed — operators only),
   *  or "n/a" (a revoke / uncarry, which needs none). */
  readonly contractIn:      "supplied" | "self" | "n/a";
  readonly boardUrl:        string;
  /** Whether the nym stands a MEMBER after this write folds against the seated roster. A `carry` NEVER
   *  moves this: a place is not an operator and never enters the member set (heraldry#/the-herm-card). */
  /** Whether this receiver locally observes the nym as a held member after the write folds. */
  readonly memberHeld:      boolean;
  /** Whether this receiver locally observes the nym as a held carrier after the write folds. */
  readonly carrierHeld:      boolean;
  /**
   * The CARRIED admit (an `admit` only; null for every other act): the entry just signed, its closed, tight
   * lineage off the board just written (`presentationFromBoardDoc` for the nym), the Nexus AID, and THIS
   * vessel's gate key — the hearth the joinee dials to present it. Public bytes only. The joinee takes it by
   * hand (`lares nexus admit-take`), so it reaches her under a PRIVATE posture, where no board crosses.
   */
  readonly bundle:          AdmitBundle | null;
  /** What the presenter noticed deriving the bundle's lineage (an `admit` only). Informational: it never
   *  refuses the act and never changes the bundle. */
  readonly findings:        readonly PresentationFinding[];
}

/** Read the seated roster off disk, FAILING CLOSED when no live quorum stands to root an admit on. */
function seatedRosterOrRefuse(sealHome: string): KahuQuorumSeats {
  const roster = foundingRoster(readNexusDoc(sealHome));
  if (roster.sealEpochCid.length === 0 || roster.keys.length < roster.threshold) {
    throw new NexusContractError(
      "no seated founding-kahu quorum to root an admit on — run `lares nexus seal seat` first (the carriage-contracts board stays inert until a quorum stands).",
    );
  }
  return roster;
}

/** The Nexus AID a subject's leaf derives under — the charter's genesis epoch, fixed across rotation. */
function nexusAidOrRefuse(sealHome: string): string {
  const aid = primaryNexusAid(sealHome);
  if (aid) return aid;
  throw new NexusContractError("no seated charter to name the Nexus by — a per-Nexus leaf derives from the charter's genesis epoch.");
}

/** The membership door's sub-quorum refusal — it names the act a short quorum would have minted. */
const subQuorum = (held: number, k: number): NexusContractError => new NexusContractError(
  `sub-quorum REFUSED (fail-closed): the vessel holds ${held} seat key(s) of the seated roster, but a valid membership act carries ${k} distinct founding-kahu signatures. ` +
  `Where the other seats rest in another vault, the act crosses as a partial: \`lares nexus contract <nym> --nexus <aid> --out <file>\` here, then \`--from <file>\` there.`,
);

/**
 * Obtain the operator's "accepts carriage" contract-sig for an ADMIT. Two paths, fail-closed:
 *   · a `--contract <hex>` token supplied out-of-band → wrap it { signer: nym, sig } (the fold verifies it).
 *   · else, if the nym is the per-Nexus leaf of a persona this vessel HOLDS (multitude-of-one) → self-sign the
 *     carriage token with that leaf. A root nym matches no leaf, so it never self-signs.
 * Neither → REFUSE (never admit an operator that has not consented to carriage).
 */
async function resolveContractIn(
  opts: NexusContractOptions, nym: string, sealEpochCid: string,
): Promise<{ contractSig: QuorumSignature; how: "supplied" | "self" }> {
  if (opts.contractSig) {
    // Prove the operator's consent BEFORE any seat signs: no seat signs an admit its operator never consented to.
    const sig = opts.contractSig.trim().toLowerCase();
    if (!(await verifyCarriageConsent({ nym, sealEpochCid, contractSig: sig }))) {
      throw new NexusContractError(
        "admit REFUSED (fail-closed): the supplied contract-in does not verify as this operator's 'accepts carriage' " +
        "for the head epoch, so no seat signs.",
      );
    }
    return { contractSig: { signer: nym, sig }, how: "supplied" };
  }
  // multitude-of-one: is the admitted nym one of this vessel's leaves for this Nexus? Then self-sign with it.
  for (const leaf of await heldNexusLeaves(nexusAidOrRefuse(opts.sealHome))) {
    if (leaf.verifyingKey !== nym) continue;
    const contractSig = await signCarriageContract(nym, sealEpochCid, ed25519SignerFromSeed(leaf.seed));
    return { contractSig, how: "self" };
  }
  throw new NexusContractError(
    "admit REFUSED (fail-closed): no operator contract-in. The joining operator must sign 'accepts carriage' " +
    "(`lares nexus accept-carriage` on their vessel) and supply the token via --contract, OR the nym must be the " +
    "per-Nexus leaf of a persona this vessel holds. A Nexus never conscripts an operator into carriage.",
  );
}

/**
 * Obtain a PLACE's carrier seal for a `carry`. ONE path, and deliberately only one: the token the place
 * signed with its own vessel key, handed over out of band.
 *
 * NO SELF-SIGN ARM, AND THAT IS THE POINT. The admit path above may self-sign because the vessel may hold
 * the admitted operator's persona seed (the multitude-of-one). A place's seed is its VESSEL identity, which
 * lives on the place's own device and nowhere else — there is nothing here to reach for, and a path that
 * reached would be a founder minting a crossroads' identity for it. So: supplied, or REFUSE.
 */
async function resolveCarrierIn(
  opts: NexusContractOptions, nym: string, sealEpochCid: string,
): Promise<QuorumSignature> {
  const sig = opts.carrierSig?.trim().toLowerCase() ?? "";
  if (!sig) {
    throw new NexusContractError(
      "carry REFUSED (fail-closed): no carrier seal. The place must sign 'I carry for this Nexus' with its OWN " +
      "vessel key (`lares nexus carry-for` on that vessel) and supply the token via --carrier. A Nexus never " +
      "conscripts a crossroads, and it never mints one's identity for it.",
    );
  }
  // Never write an entry the fold would ignore — prove the seal against the epoch BEFORE any board write.
  if (!(await verifyCarrierContract({ nym, sealEpochCid, sig }))) {
    throw new NexusContractError(
      "carry REFUSED (fail-closed): the carrier seal does not verify over this charter epoch under the named " +
      "vessel key. A seal minted for another epoch, or by another hand, grants nothing.",
    );
  }
  return { signer: nym, sig };
}

/**
 * Mint THIS vessel's own carrier seal — run by the joining PLACE, on itself. Reads the vessel verifying key
 * and signs the act-independent carrier token for the charter epoch standing in its seal home; the
 * founding kahu supply the token to `runNexusContract({ action: "carry", carrierSig })`.
 *
 * IT TOUCHES NO PERSONA. A Herm holds none by law, and this is the whole door that fact required.
 */
export async function runNexusCarryFor(opts: {
  sealHome: string;
}): Promise<{ nym: string; sealEpochCid: string; carrierSig: string }> {
  const roster = foundingRoster(readNexusDoc(opts.sealHome));
  if (roster.sealEpochCid.length === 0) {
    throw new NexusContractError("no seated charter epoch to bind carriage to — import the charter (`lares nexus seal import`) first.");
  }
  const nym  = (await loadVesselVerifyingKey()).toLowerCase();
  const seed = await loadVesselSigningSeed();
  const sig  = await signCarrierContract(nym, roster.sealEpochCid, ed25519SignerFromSeed(seed));
  return { nym, sealEpochCid: roster.sealEpochCid, carrierSig: sig.sig };
}

/** The charter home an act reads: the carried charter `aid` names, else the primary. Refuses an AID this vessel never carried. */
function charterHomeOrRefuse(sealHome: string, aid: string | undefined): string {
  if (aid === undefined) return sealHome;
  const home = charterHomeFor(sealHome, aid.trim().toLowerCase());
  if (home === null) throw new NexusContractError(`this vessel holds no charter for ${aid.slice(0, 18)}… — import or found it first.`);
  return home;
}

/** Everything an act needs before its seats sign: the subject, the charter home and roster, the subject's own seal,
 *  the board it lands on and the causal heads it cites there. */
interface ContractCore {
  readonly nym:      string;
  readonly home:     string;
  readonly roster:   KahuQuorumSeats;
  readonly contract: { contractSig: QuorumSignature; how: "supplied" | "self" } | null;
  readonly gateKey:  string;
  readonly boardUrl: string;
  readonly handle:   Awaited<ReturnType<typeof materializeSharedLarDoc>>;
  readonly parents:  readonly string[];
  /** An admit's carriage opening: this hearth's gate key as the pin and the canon documents it names, under a fresh
   *  salt. The quorum signs its commitment; the board never holds the opening. Null for every other act. */
  readonly opening:  AdmitOpening | null;
}

/** The carriage board one charter home's island names on this vessel, with the gate key that resolved the island. */
async function carriageBoardFor(repo: Repo, home: string): Promise<Pick<ContractCore, "gateKey" | "boardUrl" | "handle">> {
  const gateKey  = await loadVesselVerifyingKey();
  const boardUrl = carriageDocUrl(nodeNexusIsland({ ownVesselKey: gateKey, sealHome: home }));
  const handle   = await materializeSharedLarDoc(repo, boardUrl, "board:carriage-contracts");
  return { gateKey, boardUrl, handle };
}

async function contractCore(opts: NexusContractOptions): Promise<ContractCore> {
  const nym = opts.nym.trim().toLowerCase();
  if (!NYM_RE.test(nym)) {
    throw new NexusContractError(`"${opts.nym}" reads as no operator nym — expected a 64-hex ed25519 verifying key.`);
  }
  const home = charterHomeOrRefuse(opts.sealHome, opts.aid);
  const roster = seatedRosterOrRefuse(home);
  const homed = { ...opts, sealHome: home };
  // The subject's own wax-seal — an ADMIT takes the operator's persona-signed contract-in, a CARRY takes the
  // place's vessel-signed carrier seal, and a REVOKE / UNCARRY takes none.
  let contract: ContractCore["contract"] = null;
  if (opts.action === "admit") contract = await resolveContractIn(homed, nym, roster.sealEpochCid);
  else if (opts.action === "carry") contract = { contractSig: await resolveCarrierIn(homed, nym, roster.sealEpochCid), how: "supplied" };
  const { gateKey, boardUrl, handle } = await carriageBoardFor(opts.repo, home);
  const boardFold = await foldCarriageDetails(carriageEntriesFromBoard(handle.doc()), roster);
  const parents  = causalHeadsForNym(boardFold.entries, nym, opts.action, roster.sealEpochCid);
  // THE ADMIT SIGNS WHAT IT CARRIES (face-proof#/the-gate-exchange, step 5): the joinee takes this hearth's gate pin
  // and canon list off the admit's own signed bytes, never off a field beside them.
  const opening: AdmitOpening | null = opts.action === "admit"
    ? openAdmitCarriage({ gatePin: gateKey.toLowerCase(), canon: await admitCanonDocs(opts.repo) })
    : null;
  return { nym, home, roster, contract, gateKey, boardUrl, handle, parents, opening };
}

/**
 * Land one signed entry on the board: it must COUNT against the roster first (a dead admit would read as enforced
 * while granting nothing), then one fold of the written board answers both projections and, for an admit, the
 * carried bundle.
 */
async function landEntry(core: ContractCore, repo: Repo, action: CarriageAction, entry: CarriageEntry, signers: readonly string[],
  beforeWrite?: () => Promise<void>): Promise<NexusContractResult> {
  if (!(await carriageEntryCounts(entry, core.roster))) {
    throw new NexusContractError(
      action === "admit"
        ? "refusing to write: the signed admit does not COUNT (the kahu quorum or the operator contract-in failed to verify against the seated roster)."
        : action === "carry"
        ? "refusing to write: the signed carry does not COUNT (the kahu quorum or the place's own carrier seal failed to verify against the seated roster)."
        : "refusing to write: the signed removal does not verify against the seated roster (fail-closed).",
    );
  }
  const { handle, nym, roster } = core;
  // The last check reads the board as it stands at the write; the write follows it with no await between.
  if (beforeWrite) await beforeWrite();
  handle.change((d) => writeCarriageEntry(d, entry));
  await repo.flush();

  // ONE FOLD OF THE WRITTEN BOARD, TWO PROJECTIONS. THE TWO FOLDS STAY TWO: members and carriers read as
  // separate sets and never union. A `carry` moves the carrier observation and never `memberHeld` — the
  // structural half of the class law, reported so a caller reads which relation it actually landed.
  const after       = await foldCarriageDetails(carriageEntriesFromBoard(handle.doc()), roster);
  const memberHeld  = holdsCarriage(nym, after.members);
  const carrierHeld = holdsCarrier(nym, after.carriers);

  // THE BUNDLE. The admit just signed cites every causal head for the nym, so it stands as the board's one
  // admit head for that nym; its lineage comes off the board it landed on. A head that reads otherwise
  // (nothing presents, or another act heads the relation) emits no bundle rather than a different admit.
  let bundle: AdmitBundle | null = null;
  let findings: readonly PresentationFinding[] = [];
  if (action === "admit") {
    const read = await presentationFromBoardDoc(handle.doc(), nym, roster);
    findings = read.findings;
    const presented = read.presentation;
    // The bundle names the hearth the admit committed to as its pin (the vault that opened the act, wherever it
    // lands) and carries the opening to the subject's hands alone; an opening the act never committed to emits none.
    const opening = core.opening;
    if (presented && opening && admitCarriageCommit(opening) === presented.admit.carriageCommit &&
        carriageEntryActCid(presented.admit) === carriageEntryActCid(entry)) {
      bundle = { aid: nexusAidOrRefuse(core.home), gatePubKey: opening.carriage.gatePin, admit: presented.admit, lineage: presented.lineage, opening };
    }
  }
  return {
    action, nym, parents: entry.parents, evidenceCid: carriageEntryActCid(entry),
    sealEpochCid: roster.sealEpochCid, threshold: roster.threshold, signers,
    contractIn: entry.contractSig ? (core.contract?.how ?? "supplied") : "n/a",
    boardUrl: core.boardUrl, memberHeld, carrierHeld, bundle, findings,
  };
}

/**
 * ADMIT (`admit`) or REVOKE (`revoke`) an operator nym — sign a causal membership act with ≥ threshold held
 * founding seat keys (plus, for admit, the operator's contract-in) and LAND it on the always-carried members
 * board. FAILS CLOSED before any write. The act names every locally observed causal head for this relation family;
 * it never derives authority from a scalar counter.
 */
export async function runNexusContract(opts: NexusContractOptions): Promise<NexusContractResult> {
  const nym = opts.nym.trim().toLowerCase();
  if (!NYM_RE.test(nym)) {
    throw new NexusContractError(`"${opts.nym}" is not a valid operator nym — expected a 64-hex ed25519 verifying key.`);
  }
  const selected = await selectHeldQuorumSigners(seatedRosterOrRefuse(charterHomeOrRefuse(opts.sealHome, opts.aid)), subQuorum);
  const repo = opts.repo;
  try {
    const core = await contractCore(opts);
    // The quorum signs with the seats' own keys: each hand opens its one cold row for its one signature.
    const entry: CarriageEntry = await signCarriageQuorum(
      { nym: core.nym, action: opts.action, parents: core.parents, sealEpochCid: core.roster.sealEpochCid, ...(core.opening ? { carriageCommit: admitCarriageCommit(core.opening) } : {}) },
      selected.map((s) => ({ signer: s.verifyingKey, sign: s.sign })),
      core.contract?.contractSig,
    );
    return await landEntry(core, repo, opts.action, entry, selected.map((s) => s.verifyingKey));
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}

/** What a partial step answers: the partial as it stands, the judge's verdict over it here, and the act it landed. */
export interface NexusContractPartialResult {
  readonly partial: NexusActPartial;
  readonly verdict: PartialVerdict;
  /** The seats of the head roster whose signature the partial carries, sorted. */
  readonly signed:  readonly string[];
  /** The landed act, once the partial read `complete` here and its entry counted; null short of the threshold. */
  readonly landed:  NexusContractResult | null;
}

/** The reader one vessel judges a partial with: its charter's AID and head roster, and its own board. */
function partialReader(aid: string, core: Pick<ContractCore, "roster" | "handle">): NexusPartialReader {
  const doc = core.handle.doc();
  return { aid, head: core.roster, board: { carriage: carriageEntriesFromBoard(doc), anchors: rollAnchorsFromBoard(doc), antigen: [] } };
}

const partialFamily = (action: CarriageAction): "admit" | "revoke" => {
  if (action === "admit" || action === "revoke") return action;
  throw new NexusContractError(`a ${action} crosses no vaults as a partial: only an admit and a revoke ride the two-vault door.`);
};

/**
 * OPEN a two-vault act: every seat of the head roster this vessel holds signs the admit or revoke (an admit with
 * its operator's contract-in), and the act leaves as a PARTIAL for the vault that holds the other seats. Nothing
 * lands on any board here. A vessel that holds the whole quorum lands the act through `runNexusContract` instead.
 */
export async function runNexusContractOpen(opts: NexusContractOptions): Promise<NexusContractPartialResult> {
  const family = partialFamily(opts.action);
  const home = charterHomeOrRefuse(opts.sealHome, opts.aid);
  const roster = seatedRosterOrRefuse(home);
  const held = heldSeatSigners(roster);
  if (held.length === 0) throw new NexusContractError("this vessel holds no seat of the head roster, so it opens no act for it.");
  if (held.length >= roster.threshold) {
    throw new NexusContractError("this vessel holds the whole quorum: the act lands here whole (`nexus contract`), and no partial crosses.");
  }
  const repo = opts.repo;
  try {
    const core = await contractCore(opts);
    const entry = await signCarriageQuorum(
      { nym: core.nym, action: family, parents: core.parents, sealEpochCid: core.roster.sealEpochCid, ...(core.opening ? { carriageCommit: admitCarriageCommit(core.opening) } : {}) },
      held.map((s) => ({ signer: s.verifyingKey, sign: s.sign })),
      core.contract?.contractSig,
    );
    const aid = nexusAidOrRefuse(core.home);
    // The opening crosses with the partial, so whichever vault lands the act hands the subject its bundle.
    const partial = nexusActPartial(aid, { family, entry, ...(core.opening ? { opening: core.opening } : {}) });
    const judged = await judgeNexusActPartial(partial, partialReader(aid, core));
    if (judged.verdict !== "ready") throw new NexusContractError(`the partial this vessel signed reads ${judged.verdict} here${judged.why ? `: ${judged.why}` : ""}; nothing crosses.`);
    return { partial, verdict: judged.verdict, signed: judged.signed, landed: null };
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}

/**
 * Take a partial another vault opened or cosigned. The judge runs against this vessel's own charter head and board
 * BEFORE any signature: a partial that reads `ready` takes the signature of every seat this vessel holds that has
 * not signed it; one that reads `complete` (here, or after those signatures) lands on this vessel's board. Any
 * other verdict refuses by name, and nothing signs or lands.
 */
export async function runNexusContractPartial(opts: { readonly partial: unknown; readonly sealHome: string; readonly repo: Repo }):
  Promise<NexusContractPartialResult> {
  const read = readNexusActPartial(opts.partial);
  if (!read || read.act.family === "kapae" || read.act.family === "roll-anchor" || read.act.family === "edge-roll-anchor") {
    throw new NexusContractError("the file reads as no admit or revoke partial");
  }
  const entry0 = read.act.entry;
  const home = charterHomeOrRefuse(opts.sealHome, read.aid);
  const roster = seatedRosterOrRefuse(home);
  const repo = opts.repo;
  try {
    const { gateKey, boardUrl, handle } = await carriageBoardFor(repo, home);
    const core: ContractCore = { nym: entry0.nym, home, roster, contract: null, gateKey, boardUrl, handle, parents: entry0.parents,
      opening: read.act.family === "admit" ? read.act.opening ?? null : null };
    const reader = partialReader(read.aid, core);
    let partial: NexusActPartial = read;
    let judged = await judgeNexusActPartial(partial, reader);
    if (judged.verdict === "ready") {
      const hands = heldSeatSigners(roster, new Set(judged.signed));
      if (hands.length === 0) throw new NexusContractError("the partial waits on a seat this vessel does not hold; carry it to the vault that holds one.");
      try { partial = await cosignNexusActPartial(partial, reader, hands.map((h) => ({ signer: h.verifyingKey, sign: h.sign }))); }
      catch (err) { if (err instanceof NexusPartialRefusal) throw new NexusContractError(`the partial refuses a cosign here: ${err.message}`); throw err; }
      judged = await judgeNexusActPartial(partial, reader);
    }
    if (judged.verdict === "ready") return { partial, verdict: judged.verdict, signed: judged.signed, landed: null };
    if (judged.verdict !== "complete") {
      throw new NexusContractError(`the partial reads ${judged.verdict} on this vessel${judged.why ? `: ${judged.why}` : ""}; nothing signs or lands.`);
    }
    const act = partial.act as Extract<NexusActPartial["act"], { family: "admit" | "revoke" }>;
    // A seat's signature awaits custody, and the board or the charter head may move meanwhile: the act lands only
    // where it still reads `complete` against the head and the board as they stand at the write.
    const fresh: ContractCore = { ...core, roster: seatedRosterOrRefuse(home) };
    // The judge itself awaits, so it runs again until the board AND the charter head hold still across one whole
    // judgement (`partial-landing`): the write follows the last judge with no await between, and a count bounds it.
    const mark = (): string =>
      `${seatedRosterOrRefuse(home).sealEpochCid}|${carriageEntriesFromBoard(fresh.handle.doc()).map(carriageEntryActCid).sort().join(",")}`;
    const landed = await landEntry(fresh, repo, act.family, act.entry, judged.signed, () => judgeStillBeforeWrite({
      mark,
      judge: () => judgeNexusActPartial(partial, partialReader(read.aid, { ...fresh, roster: seatedRosterOrRefuse(home) })),
      refuse: (message) => new NexusContractError(message),
    }));
    return { partial, verdict: judged.verdict, signed: judged.signed, landed };
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}

/** What a landed roll anchor reports: the anchor, its act CID, the heads it cites, and the board it rides. */
export interface NexusRollAnchorResult {
  readonly anchor:    RollAnchor;
  readonly anchorCid: string;
  readonly parents:   readonly string[];
  readonly boardUrl:  string;
}

/** The roll cites each counted cabal relation head beside the carriage and anchor heads. */
async function rollParentsWithCabal(board: LarDoc | undefined, closing: KahuQuorumSeats, nexus: string): Promise<string[]> {
  const carriage = await rollAnchorParents(carriageEntriesFromBoard(board), rollAnchorsFromBoard(board), closing);
  const acts = kahuCabalActsFromBoard(board).filter((act) => kahuCabalActCounts(act, closing, nexus).counted);
  const cited = new Set(acts.flatMap((act) => act.parents));
  const cabal = acts.map(kahuCabalActCid).filter((cid) => !cited.has(cid));
  return [...new Set([...carriage, ...cabal])].sort();
}

/**
 * Land a seal roll's ANCHOR on this Nexus's carriage board — called by the rotate BEFORE it writes the new
 * head, so a roll whose anchor cannot land writes nothing at all. That order holds where one vessel holds the whole
 * new quorum; where the seats rest in two vaults, the anchor follows the filed head as a partial instead
 * (`runNexusRollAnchorOpen` / `runNexusRollAnchorPartial`). The anchor names the epoch `closing` heads
 * and the epoch `opened` heads, carries `closing`'s public key-set, cites the board's causal heads at the roll
 * (the counted carriage, cabal, and anchor heads at the closing epoch), and is signed
 * by `opened`'s quorum out of the held seat keys it seats. The closing keys never sign it.
 *
 * FAIL CLOSED, before any write: fewer than `opened.threshold` held roots seated in `opened` → REFUSE; an
 * anchor that does not count under `opened` → REFUSE. An anchor that lands for a head the rotate then fails
 * to write names an epoch no charter lineage holds, and no verifier walks it.
 */
export async function runNexusRollAnchor(opts: {
  readonly sealHome:    string;
  /** The roster at the head the roll closes. */
  readonly closing:     KahuQuorumSeats;
  /** The roster the roll seats, rooted on the new head's epoch cid. */
  readonly opened:      KahuQuorumSeats;
  /** The store's one holder: the standing vessel's own Repo, or the direct holder's (`ownedStore`). */
  readonly repo:        Repo;
}): Promise<NexusRollAnchorResult> {
  const selected = await selectHeldQuorumSigners(opts.opened, (held, k) => new NexusContractError(
    `roll anchor REFUSED (fail-closed): the vessel holds ${held} seat key(s) the new roster seats, but the anchor ` +
    `carries ${k} distinct signatures of the NEW quorum — the closing keys never sign it.`,
  ));
  const repo         = opts.repo;
  try {
    const { boardUrl, handle } = await rollAnchorBoardFor(repo, opts.sealHome);
    const parents = await rollParentsWithCabal(handle.doc(), opts.closing, nexusAidOrRefuse(opts.sealHome));
    const signers = selected.map((s) => ({ signer: s.verifyingKey, sign: s.sign }));
    const anchor = await signRollAnchor({
      prevEpochCid:  opts.closing.sealEpochCid,
      sealEpochCid:  opts.opened.sealEpochCid,
      prevKeys:      opts.closing.keys,
      prevThreshold: opts.closing.threshold,
      parents,
    }, signers);
    if (!(await rollAnchorCounts(anchor, opts.opened))) {
      throw new NexusContractError("refusing to write: the roll anchor does not count under the new roster (fail-closed).");
    }
    handle.change((d) => writeRollAnchor(d, anchor));
    await repo.flush();
    return { anchor, anchorCid: rollAnchorCid(anchor), parents, boardUrl };
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}

/** What one step of a two-vault roll anchor answers: the partial as it stands, the judge's verdict over it here, and the anchor it landed. */
export interface NexusRollAnchorPartialResult {
  readonly partial: NexusActPartial;
  readonly verdict: PartialVerdict;
  /** The seats of the head (opened) roster whose signature the partial carries, sorted. */
  readonly signed:  readonly string[];
  /** The landed anchor, once the partial read `complete` here and counted; null short of the threshold. */
  readonly landed:  NexusRollAnchorResult | null;
}

/**
 * The two rosters a rolled head joins, read off this vessel's OWN verified lineage, never off a file: the head opens,
 * the epoch before it closes. FAIL CLOSED: an unseated head, or a head that rolled from nothing (a genesis), names
 * no anchor.
 */
function rolledRostersOrRefuse(home: string): { readonly opened: KahuQuorumSeats; readonly closing: KahuQuorumSeats } {
  const doc = readNexusDoc(home);
  const opened = foundingRoster(doc);
  if (opened.sealEpochCid.length === 0 || opened.keys.length < opened.threshold) {
    throw new NexusContractError("no seated head to anchor a roll under — the charter's lineage roots no roster here.");
  }
  const lineage = doc!.sealLineage!;
  const head = lineage[lineage.length - 1]!;
  // The head names what it closed: one predecessor, looked up by its address, never by its place in the array.
  if (head.predecessors.length === 0) throw new NexusContractError("the head closes no epoch (a genesis), so no roll anchor joins it to one.");
  if (head.predecessors.length !== 1) throw new NexusContractError("the head joins two branches (a reunion), and no two-vault anchor joins a reunion yet.");
  const prev = lineage.find((e) => e.epochCid === head.predecessors[0]) ?? null;
  const seats = prev ? epochSeats(prev) : null;
  if (!prev || !seats) throw new NexusContractError("the epoch the head closed reads no seats in this vessel's lineage, so no anchor joins it.");
  return { opened, closing: { keys: [...seats.keys], threshold: seats.threshold, sealEpochCid: prev.epochCid } };
}

/**
 * The carriage board a roll anchor rides. The board keys on the charter's genesis island — a rotating vessel holds a
 * charter, and a charter outranks every lower rung of the gradient. The vessel key rides in only as that gradient's
 * floor, so a seal home whose vessel holds no key of its own still anchors on its charter's board.
 */
async function rollAnchorBoardFor(repo: Repo, sealHome: string): Promise<Pick<ContractCore, "boardUrl" | "handle">> {
  const ownVesselKey = await loadVesselVerifyingKey().catch(() => "");
  const boardIsland  = nodeNexusIsland({ ownVesselKey, sealHome });
  const boardUrl     = carriageDocUrl(boardIsland);
  return { boardUrl, handle: await materializeSharedLarDoc(repo, boardUrl, "board:carriage-contracts") };
}

/** What the roll's open reads of the head's own roll: no prior roll (a genesis), no anchor owed, or the counted anchor that stands. */
export interface NexusRollPriorAnchor {
  readonly state:      "no-prior-roll" | "nothing-to-anchor" | "anchored";
  /** The counted anchor that joins the head to the epoch it closed, once one stands. */
  readonly anchorCid?: string;
}

/**
 * A ROLL WAITS ON ITS PRIOR ANCHOR (operator ruling 2026-10-15; roadmap `#/rulings`). A seal roll refuses by name
 * while the head's own roll stands with no counted anchor on this vessel's carriage board: an admit carries across a
 * roll only through its roll anchors, and a roll laid over an anchorless one strands every admit between them. The
 * roll's open (`lares nexus seal rotate`, `seal roll open`) asks here before any card reads or any seat signs, and the
 * custody door's two roll opens (`seat.arm-roll`, `roll-circle.open`) ask again against the store their door lends.
 *
 * A genesis closes no roll, so the first roll opens. A head that closed an epoch reading no seats, or a reunion
 * head joining two branches, carries no anchor this door can ask for, so neither waits. The single-vault rotate
 * anchors inside itself and so leaves a counted anchor for the next open to find.
 */
export async function runNexusRollPriorAnchorCheck(opts: { readonly sealHome: string; readonly repo: Repo; readonly aid?: string }):
  Promise<NexusRollPriorAnchor> {
  const home = charterHomeOrRefuse(opts.sealHome, opts.aid);
  const doc = readNexusDoc(home);
  const lineage = doc?.sealLineage ?? [];
  const head = lineage[lineage.length - 1];
  if (!head || head.predecessors.length === 0) return { state: "no-prior-roll" };
  const opened = foundingRoster(doc);
  const closed = head.predecessors.length === 1 ? lineage.find((e) => e.epochCid === head.predecessors[0]) : undefined;
  if (!closed || !epochSeats(closed) || opened.sealEpochCid.length === 0 || opened.keys.length < opened.threshold) return { state: "nothing-to-anchor" };
  try {
    const { handle } = await rollAnchorBoardFor(opts.repo, home);
    for (const a of rollAnchorsFromBoard(handle.doc())) {
      if (a.prevEpochCid === closed.epochCid && a.sealEpochCid === opened.sealEpochCid && await rollAnchorCounts(a, opened)) {
        return { state: "anchored", anchorCid: rollAnchorCid(a) };
      }
    }
  } finally {
    await opts.repo.flush().catch(() => { /* best-effort final flush */ });
  }
  throw new NexusContractError(
    "roll REFUSED (prior-roll-unanchored): the head's own roll stands with no counted anchor on this board, so a roll laid " +
    "over it would strand every admit between them. Land the head's anchor first (`lares nexus seal anchor`), then roll.");
}

/** The reader one vessel judges a roll-anchor partial with: the head it holds, the epoch that head closed, and its board. */
function anchorReader(home: string, handle: ContractCore["handle"]): NexusPartialReader {
  const aid = nexusAidOrRefuse(home);
  const { opened, closing } = rolledRostersOrRefuse(home);
  const doc = handle.doc();
  return { aid, head: opened, closing, board: { carriage: carriageEntriesFromBoard(doc), anchors: rollAnchorsFromBoard(doc),
    cabal: kahuCabalActsFromBoard(doc), antigen: [] } };
}

/**
 * OPEN a two-vault roll anchor (kapae#/rolls): the head this vessel holds has already rolled, and every seat of that
 * head's roster this vessel holds signs the anchor that joins it to the epoch it closed, citing the board's causal
 * heads there. The act leaves as a PARTIAL for the vault that holds the other new seats; nothing lands here. Where
 * the seats rest in two vaults no rotate signs its anchor whole, so the anchor follows the rolled head rather than
 * preceding it: an admit made at the closed epoch reads stranger at the new head until the anchor lands. The door
 * anchors the head to the ONE epoch it closed, so a second roll before this anchor lands would leave the first roll
 * unanchored for good: the next roll's open refuses by name until this anchor lands (`runNexusRollPriorAnchorCheck`).
 * It anchors the carriage board alone; the realm edge boards the single-vault rotate also anchors (`runEdgeRollAnchors`)
 * cross as their own partials, one for each realm (`runEdgeRollAnchorOpen` / `runEdgeRollAnchorPartial`). A vessel
 * that holds the whole new quorum anchors through `runNexusRollAnchor`, inside its rotate.
 */
export async function runNexusRollAnchorOpen(opts: { readonly sealHome: string; readonly repo: Repo; readonly aid?: string }):
  Promise<NexusRollAnchorPartialResult> {
  const home = charterHomeOrRefuse(opts.sealHome, opts.aid);
  const { opened, closing } = rolledRostersOrRefuse(home);
  const held = heldSeatSigners(opened);
  if (held.length === 0) throw new NexusContractError("this vessel holds no seat of the head roster, so it opens no anchor for it.");
  if (held.length >= opened.threshold) {
    throw new NexusContractError("this vessel holds the whole new quorum: the anchor lands here whole, inside the rotate, and no partial crosses.");
  }
  const repo = opts.repo;
  try {
    const { handle } = await carriageBoardFor(repo, home);
    // No seat signs an anchor this board already holds for the same roll: a counted anchor from the closed epoch
    // to the head refuses here, before any custody opens.
    for (const a of rollAnchorsFromBoard(handle.doc())) {
      if (a.prevEpochCid === closing.sealEpochCid && a.sealEpochCid === opened.sealEpochCid && await rollAnchorCounts(a, opened)) {
        throw new NexusContractError("this board already holds a counted anchor for this roll; nothing signs.");
      }
    }
    const parents = await rollParentsWithCabal(handle.doc(), closing, nexusAidOrRefuse(home));
    const anchor = await signRollAnchor({
      prevEpochCid: closing.sealEpochCid, sealEpochCid: opened.sealEpochCid, prevKeys: closing.keys, prevThreshold: closing.threshold, parents,
    }, held.map((s) => ({ signer: s.verifyingKey, sign: s.sign })));
    const aid = nexusAidOrRefuse(home);
    const partial = nexusActPartial(aid, { family: "roll-anchor", anchor });
    const judged = await judgeNexusActPartial(partial, anchorReader(home, handle));
    if (judged.verdict !== "ready") throw new NexusContractError(`the partial this vessel signed reads ${judged.verdict} here${judged.why ? `: ${judged.why}` : ""}; nothing crosses.`);
    return { partial, verdict: judged.verdict, signed: judged.signed, landed: null };
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}

/**
 * Take a roll-anchor partial another vault opened or cosigned. The judge reads it against this vessel's own rolled
 * head, the epoch that head closed and its own board BEFORE any signature: `ready` takes the signature of every seat
 * of the head this vessel holds that has not signed; `complete` lands the anchor once a fresh judgement against the
 * head and the board as they stand at the write still reads `complete`. Any other verdict refuses by name, and
 * nothing signs or lands.
 */
export async function runNexusRollAnchorPartial(opts: { readonly partial: unknown; readonly sealHome: string; readonly repo: Repo }):
  Promise<NexusRollAnchorPartialResult> {
  const read = readNexusActPartial(opts.partial);
  if (!read || read.act.family !== "roll-anchor") throw new NexusContractError("the file reads as no roll-anchor partial");
  const home = charterHomeOrRefuse(opts.sealHome, read.aid);
  const { opened } = rolledRostersOrRefuse(home);
  const repo = opts.repo;
  try {
    const { boardUrl, handle } = await carriageBoardFor(repo, home);
    let partial: NexusActPartial = read;
    let judged = await judgeNexusActPartial(partial, anchorReader(home, handle));
    if (judged.verdict === "ready") {
      const hands = heldSeatSigners(opened, new Set(judged.signed));
      if (hands.length === 0) throw new NexusContractError("the partial waits on a seat this vessel does not hold; carry it to the vault that holds one.");
      try { partial = await cosignNexusActPartial(partial, anchorReader(home, handle), hands.map((h) => ({ signer: h.verifyingKey, sign: h.sign }))); }
      catch (err) { if (err instanceof NexusPartialRefusal) throw new NexusContractError(`the partial refuses a cosign here: ${err.message}`); throw err; }
      judged = await judgeNexusActPartial(partial, anchorReader(home, handle));
    }
    if (judged.verdict === "ready") return { partial, verdict: judged.verdict, signed: judged.signed, landed: null };
    if (judged.verdict !== "complete") {
      throw new NexusContractError(`the partial reads ${judged.verdict} on this vessel${judged.why ? `: ${judged.why}` : ""}; nothing signs or lands.`);
    }
    const anchor = (partial.act as Extract<NexusActPartial["act"], { family: "roll-anchor" }>).anchor;
    if (!(await rollAnchorCounts(anchor, rolledRostersOrRefuse(home).opened))) {
      throw new NexusContractError("refusing to write: the roll anchor does not count under the head roster (fail-closed).");
    }
    await judgeStillBeforeWrite({
      mark: () => {
        const doc = handle.doc();
        return `${rolledRostersOrRefuse(home).opened.sealEpochCid}|${carriageEntriesFromBoard(doc).map(carriageEntryActCid).sort().join(",")}|${rollAnchorsFromBoard(doc).map(rollAnchorCid).sort().join(",")}`;
      },
      judge: () => judgeNexusActPartial(partial, anchorReader(home, handle)),
      refuse: (message) => new NexusContractError(message),
    });
    handle.change((d) => writeRollAnchor(d, anchor));
    await repo.flush();
    return { partial, verdict: judged.verdict, signed: judged.signed, landed: { anchor, anchorCid: rollAnchorCid(anchor), parents: anchor.parents, boardUrl } };
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}

// ── the realm edge anchors across two vaults (kapae#/rolls) ───────────────────────────────────────────────

/** What one realm's step of a two-vault edge roll anchor answers: the partial as it stands, the judge's verdict over it
 *  here, and the anchor it landed on the realm's edge board. */
export interface NexusEdgeRollAnchorPartialResult {
  readonly realm:   string;
  readonly partial: NexusActPartial;
  readonly verdict: PartialVerdict;
  /** The seats of the head (opened) roster whose signature the partial carries, sorted. */
  readonly signed:  readonly string[];
  readonly landed:  { readonly anchor: EdgeRollAnchor; readonly anchorCid: string; readonly parents: readonly string[]; readonly boardUrl: string } | null;
}

/** Where one realm's anchor stands on this vessel: landed on its edge board, or owed. */
export interface NexusEdgeRollAnchorStanding {
  readonly realm:      string;
  readonly state:      "anchored" | "owed";
  readonly anchorCid?: string;
}

/** One realm's edge board as a roll's reader holds it: the replica, the ledger, the board counted under the CLOSED charter. */
interface EdgeRollView {
  readonly handle:  Awaited<ReturnType<typeof materializeSharedLarDoc>>;
  readonly ledger:  Awaited<ReturnType<typeof materializeSharedLarDoc>>;
  readonly counted: CountedEdgeBoard;
  readonly anchors: readonly EdgeRollAnchor[];
}

/** The vessel key that names this vessel's own edge ledger (no board address); empty where the vessel holds none. */
const edgeLedgerKey = (): Promise<string> => loadVesselVerifyingKey().catch(() => "");

async function edgeVesselKeyOrRefuse(): Promise<string> {
  const key = await edgeLedgerKey();
  if (!key) throw new NexusContractError("this vessel surfaces no verifying key — it keeps no ledger to read an edge board against.");
  return key;
}

/**
 * Read one realm's edge board where the roll stands: the board counts under the charter as it stood BEFORE the head's
 * roll (the lineage less its head), so the quorum acts of the closed epoch stand as the anchor's parents. The read
 * writes nothing: a vessel that first meets an act after its epoch rolled earns no seen-at-head mark from it.
 */
async function edgeBoardAtClosing(repo: Repo, home: string, vesselKey: string, realm: string, closing: KahuQuorumSeats): Promise<EdgeRollView> {
  const handle = await materializeSharedLarDoc(repo, realmEdgeBoardDocUrl(realm), "board:edge-kapae");
  const ledger = await materializeSharedLarDoc(repo, edgeLedgerDocUrl(vesselKey), "ledger:edge");
  const kept = keptFromLedger(ledger.doc(), realm);
  const lineage = readNexusDoc(home)?.sealLineage ?? [];
  const read = await readEdgeBoard({
    board: handle.doc(), kept, authorityFor: () => ({ quorum: true }), charter: { scope: realm, head: closing, sealLineage: lineage.slice(0, -1) },
  });
  return { handle, ledger, counted: read.counted, anchors: mergeEdgeRollAnchors([...kept.anchors, ...edgeRollAnchorsFromBoard(handle.doc())]) };
}

const anchoredAtHead = async (anchors: readonly EdgeRollAnchor[], closing: KahuQuorumSeats, opened: KahuQuorumSeats): Promise<EdgeRollAnchor | null> => {
  for (const a of anchors) if (a.prevEpochCid === closing.sealEpochCid && a.sealEpochCid === opened.sealEpochCid && await edgeRollAnchorCounts(a, opened)) return a;
  return null;
};

/**
 * OPEN the realm edge anchors of a rolled head (kapae#/rolls), one PARTIAL for each realm board this vessel keeps a
 * quorum act for under this Nexus. The OPENER reads each board counted at the closed epoch, cites its causal heads, and
 * signs with every seat of the head roster it holds; nothing lands here. A realm whose edge board already carries a
 * counted anchor for this roll takes no second one. Where this vessel keeps no quorum act for any realm, the list stands
 * empty. A vessel that holds the whole new quorum anchors through `runEdgeRollAnchors`, inside its rotate.
 */
export async function runEdgeRollAnchorOpen(opts: { readonly sealHome: string; readonly repo: Repo; readonly aid?: string }):
  Promise<readonly NexusEdgeRollAnchorPartialResult[]> {
  const home = charterHomeOrRefuse(opts.sealHome, opts.aid);
  const { opened, closing } = rolledRostersOrRefuse(home);
  const aid = nexusAidOrRefuse(home);
  const vesselKey = await edgeVesselKeyOrRefuse();
  const repo = opts.repo;
  const ledger = await materializeSharedLarDoc(repo, edgeLedgerDocUrl(vesselKey), "ledger:edge");
  const realms = edgeRollAnchorRealms(ledger.doc(), aid);
  if (realms.length === 0) return [];
  const held = heldSeatSigners(opened);
  if (held.length === 0) throw new NexusContractError("this vessel holds no seat of the head roster, so it opens no edge anchor for it.");
  if (held.length >= opened.threshold) {
    throw new NexusContractError("this vessel holds the whole new quorum: the edge anchors land here whole, inside the rotate, and no partial crosses.");
  }
  const out: NexusEdgeRollAnchorPartialResult[] = [];
  try {
    for (const realm of realms) {
      const view = await edgeBoardAtClosing(repo, home, vesselKey, realm, closing);
      if (await anchoredAtHead(view.anchors, closing, opened)) continue;
      const anchor = await signEdgeRollAnchor({
        scope: realm, prevEpochCid: closing.sealEpochCid, sealEpochCid: opened.sealEpochCid, prevKeys: closing.keys, prevThreshold: closing.threshold,
        parents: edgeRollAnchorParents(view.counted, closing.sealEpochCid),
      }, held.map((s) => ({ signer: s.verifyingKey, sign: s.sign })));
      const partial = nexusActPartial(aid, { family: "edge-roll-anchor", anchor });
      const { reader } = await edgeAnchorReader(home, repo, vesselKey, partial);
      const judged = await judgeNexusActPartial(partial, reader);
      if (judged.verdict !== "ready") throw new NexusContractError(`the partial this vessel signed for realm ${realm.slice(0, 12)}… reads ${judged.verdict} here${judged.why ? `: ${judged.why}` : ""}; nothing crosses.`);
      out.push({ realm, partial, verdict: judged.verdict, signed: judged.signed, landed: null });
    }
    return out;
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}

/**
 * The reader one vessel judges an edge-roll-anchor partial with: the head it holds, the epoch that head closed, and the
 * partial's realm board counted at the closed epoch. A realm this vessel's ledger does not hold under this Nexus has
 * no board here, so the reader carries none and the judge reads `unavailable`.
 */
async function edgeAnchorReader(home: string, repo: Repo, vesselKey: string, partial: NexusActPartial):
  Promise<{ readonly reader: NexusPartialReader; readonly view: EdgeRollView | null }> {
  const aid = nexusAidOrRefuse(home);
  const { opened, closing } = rolledRostersOrRefuse(home);
  const base: NexusPartialReader = { aid, head: opened, closing, board: { carriage: [], anchors: [], antigen: [] } };
  if (partial.act.family !== "edge-roll-anchor") return { reader: base, view: null };
  const realm = partial.act.anchor.scope;
  const ledger = await materializeSharedLarDoc(repo, edgeLedgerDocUrl(vesselKey), "ledger:edge");
  const doc = ledger.doc();
  const holds = realmNexusIn(doc, realm) === aid && (ledgerRealms(doc).includes(realm) || ledgerScopes(doc).includes(realm));
  if (!holds) return { reader: base, view: null };
  const view = await edgeBoardAtClosing(repo, home, vesselKey, realm, closing);
  return { reader: { ...base, edge: new Map([[realm, { counted: view.counted, anchors: view.anchors }]]) }, view };
}

/**
 * Take an edge-roll-anchor partial another vault opened or cosigned. The judge reads it against this vessel's own
 * rolled head, the epoch that head closed and its own board for that realm BEFORE any signature: `ready` takes the
 * signature of every seat of the head this vessel holds that has not signed; `complete` lands the anchor on the realm's
 * edge board once a fresh judgement against the head and the board as they stand at the write still reads `complete`.
 * A realm whose board this vessel holds none of reads `unavailable`; moved heads read `stale`. Any other verdict
 * refuses by name, and nothing signs or lands.
 */
export async function runEdgeRollAnchorPartial(opts: { readonly partial: unknown; readonly sealHome: string; readonly repo: Repo }):
  Promise<NexusEdgeRollAnchorPartialResult> {
  const read = readNexusActPartial(opts.partial);
  if (!read || read.act.family !== "edge-roll-anchor") throw new NexusContractError("the file reads as no edge-roll-anchor partial");
  const home = charterHomeOrRefuse(opts.sealHome, read.aid);
  const { opened } = rolledRostersOrRefuse(home);
  const vesselKey = await edgeVesselKeyOrRefuse();
  const repo = opts.repo;
  const realm = read.act.anchor.scope;
  try {
    let partial: NexusActPartial = read;
    const { reader, view } = await edgeAnchorReader(home, repo, vesselKey, partial);
    let judged = await judgeNexusActPartial(partial, reader);
    if (judged.verdict === "ready") {
      const hands = heldSeatSigners(opened, new Set(judged.signed));
      if (hands.length === 0) throw new NexusContractError("the partial waits on a seat this vessel does not hold; carry it to the vault that holds one.");
      try { partial = await cosignNexusActPartial(partial, reader, hands.map((h) => ({ signer: h.verifyingKey, sign: h.sign }))); }
      catch (err) { if (err instanceof NexusPartialRefusal) throw new NexusContractError(`the partial refuses a cosign here: ${err.message}`); throw err; }
      judged = await judgeNexusActPartial(partial, reader);
    }
    if (judged.verdict === "ready") return { realm, partial, verdict: judged.verdict, signed: judged.signed, landed: null };
    if (judged.verdict !== "complete" || view === null) {
      throw new NexusContractError(`the partial reads ${judged.verdict} on this vessel${judged.why ? `: ${judged.why}` : ""}; nothing signs or lands.`);
    }
    const anchor = (partial.act as Extract<NexusActPartial["act"], { family: "edge-roll-anchor" }>).anchor;
    if (!(await edgeRollAnchorCounts(anchor, opened))) {
      throw new NexusContractError("refusing to write: the edge roll anchor does not count under the head roster (fail-closed).");
    }
    const marked = (): string => {
      const doc = view.handle.doc();
      return `${rolledRostersOrRefuse(home).opened.sealEpochCid}|${edgeKapaeActsFromBoard(doc).map((a) => a.actCid).sort().join(",")}|${edgeRollAnchorsFromBoard(doc).map(edgeRollAnchorCid).sort().join(",")}`;
    };
    await judgeStillBeforeWrite({
      mark: marked,
      judge: async () => judgeNexusActPartial(partial, (await edgeAnchorReader(home, repo, vesselKey, partial)).reader),
      refuse: (message) => new NexusContractError(message),
    });
    view.handle.change((d) => writeEdgeRollAnchor(d, anchor));
    view.ledger.change((d) => { keepInLedger(d, realm, { acts: [], anchors: [anchor] }); });
    await repo.flush();
    return {
      realm, partial, verdict: judged.verdict, signed: judged.signed,
      landed: { anchor, anchorCid: edgeRollAnchorCid(anchor), parents: anchor.parents, boardUrl: realmEdgeBoardDocUrl(realm) },
    };
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}

/**
 * Where each realm's edge anchor of the head's roll stands on this vessel: `anchored` once its edge board carries a
 * counted anchor for the roll, `owed` while it does not. Only realms this vessel keeps a quorum act for appear. A head
 * that rolled from nothing (a genesis) owes none.
 */
export async function runEdgeRollAnchorStanding(opts: { readonly sealHome: string; readonly repo: Repo; readonly aid?: string }):
  Promise<readonly NexusEdgeRollAnchorStanding[]> {
  const home = charterHomeOrRefuse(opts.sealHome, opts.aid);
  let rosters: ReturnType<typeof rolledRostersOrRefuse>;
  try { rosters = rolledRostersOrRefuse(home); }
  catch (err) { if (err instanceof NexusContractError) return []; throw err; }
  const { opened, closing } = rosters;
  const vesselKey = await edgeLedgerKey();
  if (!vesselKey) return [];
  const ledger = await materializeSharedLarDoc(opts.repo, edgeLedgerDocUrl(vesselKey), "ledger:edge");
  const out: NexusEdgeRollAnchorStanding[] = [];
  for (const realm of edgeRollAnchorRealms(ledger.doc(), nexusAidOrRefuse(home))) {
    const view = await edgeBoardAtClosing(opts.repo, home, vesselKey, realm, closing);
    const anchor = await anchoredAtHead(view.anchors, closing, opened);
    out.push(anchor ? { realm, state: "anchored", anchorCid: edgeRollAnchorCid(anchor) } : { realm, state: "owed" });
  }
  return out;
}

/**
 * WHERE THIS VESSEL KEEPS ITS OWN CONSENT, AND WHAT READS IT — `carried-set`.
 *
 * A relation has two sides and each holds its own evidence. The founding operator's is the admit on
 * her members board. The joining operator's is the contract-in SHE signed, kept per Nexus at
 * `<sealHome>/nexus/carriage-consent/<aid>.json`, so a vessel can tell itself which Nexuses it has
 * joined without holding any partner's board. `hasContractedInto(sealHome, aid)` reads one Nexus;
 * `carriedSet(sealHome)` reads them all.
 */
export { hasContractedInto, type CarriageConsent } from "../carried-set.js";

/**
 * Mint the operator's "accepts carriage" contract-sig for ONE Nexus — run by the JOINING operator on its OWN
 * vessel. `aid` names the Nexus and defaults to the primary charter's; the charter it reads is the one this
 * vessel holds for that AID, primary or carried. Derives the held persona's per-Nexus LEAF at `handleIndex`,
 * signs the act-independent carriage token for that charter's verified head with it, KEEPS the consent at
 * `<sealHome>/nexus/carriage-consent/<aid>.json` (replacing any earlier consent to the same Nexus), and returns
 * the token hex the kahu supply to `runNexusContract({ contractSig })`. The leaf IS the nym.
 *
 * FAIL CLOSED: no charter held for the AID, an unseated charter (no head to bind consent to), or a persona this
 * vessel does not hold → REFUSE, writing nothing.
 */
export async function runNexusAcceptCarriage(opts: {
  handleIndex: number; sealHome: string; aid?: string;
}): Promise<{ aid: string; nym: string; sealEpochCid: string; contractSig: string }> {
  const aid  = opts.aid ?? primaryNexusAid(opts.sealHome);
  if (!aid) {
    throw new NexusContractError("no charter stands to consent to — import the Nexus's charter (`lares nexus seal import --carry`) first.");
  }
  const home = charterHomeFor(opts.sealHome, aid);
  if (!home) {
    throw new NexusContractError(`this vessel holds no charter for ${aid.slice(0, 18)}… — import it (\`lares nexus seal import --carry\`) before consenting.`);
  }
  const roster = foundingRoster(readNexusDoc(home));
  if (roster.sealEpochCid.length === 0) {
    throw new NexusContractError("no seated charter epoch to bind carriage consent to — the Nexus must seat its charter first.");
  }
  if (!(await personaRootExists(opts.handleIndex))) {
    throw new NexusContractError(`this vessel holds no persona at h${opts.handleIndex} — a contract-in signs with a held persona's leaf.`);
  }
  const leaf = await mintNexusLeaf(opts.handleIndex, aid);
  const nym  = leaf.verifyingKey;
  const sig  = await signCarriageContract(nym, roster.sealEpochCid, ed25519SignerFromSeed(leaf.seed));
  // KEEP IT. The signature travels to the founding kahu, and a copy stays here so this vessel can read
  // its own half of the relation without a partner's board.
  const consent: CarriageConsent = { nym, sealEpochCid: roster.sealEpochCid, contractSig: sig.sig };
  writeConsent(opts.sealHome, aid, consent);

  return { aid, ...consent };
}

export interface NexusMembersListResult {
  /** The Nexus whose record this fold read — null for a vessel standing with no charter. */
  readonly aid:             string | null;
  /** The island the members board keys on — the SAME resolution the admit write uses for that charter. */
  readonly island:          string;
  readonly sealEpochCid: string;
  readonly threshold:       number;
  readonly seatedKeys:      number;
  /** The nyms whose admits this replica holds as counting (quorum + contract-in verified against the seated roster). */
  readonly members:         readonly string[];
  readonly entries:         ReadonlyArray<{ nym: string; action: CarriageAction; parents: readonly string[]; evidenceCid: string; signers: number; contractIn: boolean }>;
}

/**
 * Read one Nexus's members board: the admits this replica holds and the member set they fold to. `aid`
 * names the Nexus (primary or carried) and defaults to the primary charter's. Read-only; an unseated charter
 * folds to the empty set, and an AID this vessel holds no charter for REFUSES.
 *
 * A PUBLIC RECORD, NEVER AUTHORITY. The board holds the Nexus's shared record of the admits its kahu signed;
 * this fold reports what that record says as of this replica's last sync. It grants nothing and decides
 * nothing — a member here is a nym the record names, and this vessel's own carriage answers to its own
 * consent (`carried-set`), never to this list.
 *
 * THE SAME BOARD THE ADMIT WROTE. The island resolves through `nodeNexusIsland` over the home that holds N's
 * charter, exactly as `runNexusContract` resolves it over the seal home, so a write and its read never land
 * on two addresses.
 */
export async function runNexusMembersList(opts: {
  sealHome: string; aid?: string;
  /** The store's one holder: the standing vessel's own Repo, or the direct holder's (`ownedStore`). */
  repo: Repo;
}): Promise<NexusMembersListResult> {
  let home = opts.sealHome;
  if (opts.aid !== undefined) {
    const held = charterHomeFor(opts.sealHome, opts.aid);
    if (!held) throw new NexusContractError(`this vessel holds no charter for ${opts.aid.slice(0, 18)}… — there is no record to read.`);
    home = held;
  }
  const doc         = readNexusDoc(home);
  const roster      = foundingRoster(doc);
  const ownVesselKey = await loadVesselVerifyingKey();
  const boardIsland = nodeNexusIsland({ ownVesselKey, sealHome: home });
  const repo        = opts.repo;
  try {
    const handle  = await materializeSharedLarDoc(repo, carriageDocUrl(boardIsland), "board:carriage-contracts");
    const entries = carriageEntriesFromBoard(handle.doc());
    // An admit minted at a closed epoch reads as a member where a counted roll anchor carries it to the head.
    const folded  = await foldCarriageSet(entries, roster, { sealLineage: doc?.sealLineage ?? [], anchors: rollAnchorsFromBoard(handle.doc()) });
    return {
      aid:             nexusAidOf(doc),
      island:          boardIsland,
      sealEpochCid: roster.sealEpochCid,
      threshold:       roster.threshold,
      seatedKeys:      roster.keys.length,
      members:         [...folded].map((k) => k.toLowerCase()).sort(),
      entries:         entries
        .map((e) => ({ nym: e.nym, action: e.action, parents: [...e.parents], evidenceCid: carriageEntryActCid(e), signers: e.signatures.length, contractIn: Boolean(e.contractSig) }))
        .sort((a, b) => (a.nym === b.nym ? a.evidenceCid.localeCompare(b.evidenceCid) : a.nym.localeCompare(b.nym))),
    };
  } finally {
    await repo.flush().catch(() => { /* best-effort */ });
  }
}

/** Return all locally observed causal heads for one relation family and nym. */
function causalHeadsForNym(
  details: ReadonlyArray<{ readonly nym: string; readonly action: string; readonly parents: readonly string[]; readonly evidenceCid: string; readonly sealEpochCid: string; readonly counted: boolean; readonly state: string }>,
  nym: string,
  action: CarriageAction,
  sealEpochCid: string,
): string[] {
  const memberFamily = action === "admit" || action === "revoke";
  const candidates = details.filter((detail) =>
    detail.nym === nym && detail.sealEpochCid === sealEpochCid && detail.counted && detail.state !== "unavailable" &&
    (memberFamily ? detail.action === "admit" || detail.action === "revoke" : detail.action === "carry" || detail.action === "uncarry"));
  const referenced = new Set(candidates.flatMap((entry) => entry.parents));
  return candidates.map((entry) => entry.evidenceCid).filter((cid) => !referenced.has(cid)).sort();
}
