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
 * THE ONE EXCEPTION, NAMED: the kahu quorum signs with the persona-ROOTS seated in the charter, because
 * the charter seats roots and a quorum signature counts only against seated keys. The charter therefore
 * publishes those roots; moving its seats onto leaves re-founds the charter epoch, which is a founding act
 * rather than a wiring one.
 *   · ≥ threshold founding-kahu quorum signatures (the steward act — identical to the antigen's).
 * A REVOKE needs the kahu quorum ONLY (an uncooperative member cannot veto its own removal).
 *
 * TRACK CONTRACTS, NEVER IDENTITIES: the writer takes an operator PUBKEY nym + (for admit) a carriage contract-sig.
 * No name / email / device / behavior is read, asked, or written — the FLOOR alone lands on the board.
 *
 * FAIL CLOSED, at every shore (mirrors nexus-kapae):
 *   · an unseated / quorum-short charter → REFUSE (nothing to root a quorum on); no board write.
 *   · fewer than `threshold` HELD persona-roots that sit IN the seated roster → REFUSE; no sub-quorum entry.
 *   · an admit with no valid contract-in → REFUSE; never write a conscripted member.
 *   · an entry that does not COUNT against the seated roster → REFUSE; never write a dead admit.
 *   · a malformed nym → REFUSE.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-operator-contract
 */

import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  carriageEntriesFromBoard, writeCarriageEntry, signCarriageQuorum, carriageEntryActCid, signCarriageContract,
  signCarrierContract, verifyCarrierContract, carriageEntryCounts, foldCarriageDetails, foldCarriageSet,
  holdsCarriage, holdsCarrier, foundingRoster, presentationFromBoardDoc,
  carriageDocUrl, materializeSharedLarDoc, ed25519SignerFromSeed, realmIdOfCharter,
  rollAnchorsFromBoard, rollAnchorParents, signRollAnchor, rollAnchorCounts, rollAnchorCid, writeRollAnchor,
  type CarriageAction, type CarriageEntry, type KahuQuorumSeats, type QuorumSignature, type RollAnchor,
} from "@lararium/mesh";
import { larDataDir } from "../vessel-paths.js";
import { readNexusDoc } from "../nexus-doc.js";

import {
  loadPersonaGroupRootSeed, personaRootExists, loadVesselVerifyingKey, loadVesselSigningSeed,
} from "../node-vessel-identity.js";
import { selectHeldQuorumSigners } from "../held-quorum.js";
import { nodeNexusIsland } from "../nexus-standing.js";
import { heldNexusLeaves, nexusLeafFor } from "../nexus-leaf.js";
import { charterHomeFor, primaryNexusAid, writeConsent, type CarriageConsent } from "../carried-set.js";
import type { AdmitBundle } from "../admit-bundle.js";

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
  readonly storageDir?: string;
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
  `sub-quorum REFUSED (fail-closed): the vessel holds ${held} seated persona-root(s), but a valid membership act carries ${k} distinct founding-kahu signatures. ` +
  `A real cabal collects the missing signature(s) from the other founding kahu (a collect-signatures ceremony, unbuilt).`,
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
    return { contractSig: { signer: nym, sig: opts.contractSig.trim().toLowerCase() }, how: "supplied" };
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

/**
 * ADMIT (`admit`) or REVOKE (`revoke`) an operator nym — sign a causal membership act with ≥ threshold held
 * founding persona-roots (plus, for admit, the operator's contract-in) and LAND it on the always-carried members
 * board. FAILS CLOSED before any write. The act names every locally observed causal head for this relation family;
 * it never derives authority from a scalar counter.
 */
export async function runNexusContract(opts: NexusContractOptions): Promise<NexusContractResult> {
  const storageDir = opts.storageDir ?? larDataDir();
  const nym        = opts.nym.trim().toLowerCase();
  if (!NYM_RE.test(nym)) {
    throw new NexusContractError(`"${opts.nym}" is not a valid operator nym — expected a 64-hex ed25519 verifying key.`);
  }

  const roster   = seatedRosterOrRefuse(opts.sealHome);
  const selected = await selectHeldQuorumSigners(roster, subQuorum);

  // The subject's own wax-seal — an ADMIT takes the operator's persona-signed contract-in, a CARRY takes the
  // place's vessel-signed carrier seal, and a REVOKE / UNCARRY takes none.
  let contract: { contractSig: QuorumSignature; how: "supplied" | "self" } | null = null;
  if (opts.action === "admit") {
    contract = await resolveContractIn(opts, nym, roster.sealEpochCid);
  } else if (opts.action === "carry") {
    contract = { contractSig: await resolveCarrierIn(opts, nym, roster.sealEpochCid), how: "supplied" };
  }

  const nexusPubkey = await loadVesselVerifyingKey();
  const boardIsland = nodeNexusIsland({ ownVesselKey: nexusPubkey, sealHome: opts.sealHome });
  const boardUrl    = carriageDocUrl(boardIsland);
  const repo        = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  try {
    const handle = await materializeSharedLarDoc(repo, boardUrl, "board:carriage-contracts");

    const boardEntries = carriageEntriesFromBoard(handle.doc());
    const boardFold = await foldCarriageDetails(boardEntries, roster);
    const parents = causalHeadsForNym(boardFold.entries, nym, opts.action, roster.sealEpochCid);

    // The quorum signs with the seated persona-ROOTS: a quorum signature counts only against keys the charter
    // seats, and the charter seats roots; only a re-found moves its seats onto leaves.
    const signers = await Promise.all(selected.map(async (s) => ({
      signer: s.verifyingKey,
      sign:   ed25519SignerFromSeed(await loadPersonaGroupRootSeed(s.handleIndex)),
    })));
    const entry: CarriageEntry = await signCarriageQuorum(
      { nym, action: opts.action, parents, sealEpochCid: roster.sealEpochCid },
      signers,
      contract?.contractSig,
    );

    // NEVER write an entry the fold would ignore — self-verify it COUNTS against the live roster (a dead admit
    // would read as enforced while granting nothing). This catches a bad supplied contract-sig BEFORE the write.
    if (!(await carriageEntryCounts(entry, roster))) {
      throw new NexusContractError(
        opts.action === "admit"
          ? "refusing to write: the signed admit does not COUNT (the kahu quorum or the operator contract-in failed to verify against the seated roster)."
          : opts.action === "carry"
          ? "refusing to write: the signed carry does not COUNT (the kahu quorum or the place's own carrier seal failed to verify against the seated roster)."
          : "refusing to write: the signed removal does not verify against the seated roster (fail-closed).",
      );
    }

    handle.change((d) => writeCarriageEntry(d, entry));
    await repo.flush();

    // ONE FOLD OF THE WRITTEN BOARD, TWO PROJECTIONS. THE TWO FOLDS STAY TWO: members and carriers read as
    // separate sets and never union. A `carry` moves the carrier observation and never `memberHeld` — the
    // structural half of the class law, reported so a caller reads which relation it actually landed.
    const written     = carriageEntriesFromBoard(handle.doc());
    const after       = await foldCarriageDetails(written, roster);
    const memberHeld  = holdsCarriage(nym, after.members);
    const carrierHeld = holdsCarrier(nym, after.carriers);

    // THE BUNDLE. The admit just signed cites every causal head for the nym, so it stands as the board's one
    // admit head for that nym; its lineage is read off the board it landed on. A head that reads otherwise
    // (nothing presents, or another act heads the relation) emits no bundle rather than a different admit.
    let bundle: AdmitBundle | null = null;
    if (opts.action === "admit") {
      const { presentation: presented } = await presentationFromBoardDoc(handle.doc(), nym, roster);
      if (presented && carriageEntryActCid(presented.admit) === carriageEntryActCid(entry)) {
        bundle = {
          aid: nexusAidOrRefuse(opts.sealHome), gatePubKey: nexusPubkey.toLowerCase(),
          admit: presented.admit, lineage: presented.lineage,
        };
      }
    }

    return {
      action: opts.action, nym, parents, evidenceCid: carriageEntryActCid(entry),
      sealEpochCid: roster.sealEpochCid, threshold: roster.threshold,
      signers: selected.map((s) => s.verifyingKey),
      contractIn: contract ? contract.how : "n/a",
      boardUrl, memberHeld, carrierHeld, bundle,
    };
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

/**
 * Land a seal roll's ANCHOR on this Nexus's carriage board — called by the rotate BEFORE it writes the new
 * head, so a roll whose anchor cannot land writes nothing at all. The anchor names the epoch `closing` heads
 * and the epoch `opened` heads, carries `closing`'s public key-set, cites the board's causal heads at the roll
 * (`rollAnchorParents`: the acts and anchors that count at the closing epoch and nothing cites), and is signed
 * by `opened`'s quorum out of the held persona-roots it seats. The closing keys never sign it.
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
  readonly storageDir?: string;
}): Promise<NexusRollAnchorResult> {
  const selected = await selectHeldQuorumSigners(opts.opened, (held, k) => new NexusContractError(
    `roll anchor REFUSED (fail-closed): the vessel holds ${held} persona-root(s) the new roster seats, but the anchor ` +
    `carries ${k} distinct signatures of the NEW quorum — the closing keys never sign it.`,
  ));
  // The board keys on the charter's genesis island — a rotating vessel holds a charter, and a charter outranks
  // every lower rung of the gradient. The vessel key rides in only as that gradient's floor, so a seal home
  // whose vessel holds no key of its own still anchors on its charter's board.
  const ownVesselKey = await loadVesselVerifyingKey().catch(() => "");
  const boardIsland  = nodeNexusIsland({ ownVesselKey, sealHome: opts.sealHome });
  const boardUrl     = carriageDocUrl(boardIsland);
  const repo         = new Repo({ storage: new NodeFSStorageAdapter(opts.storageDir ?? larDataDir()) });
  try {
    const handle  = await materializeSharedLarDoc(repo, boardUrl, "board:carriage-contracts");
    const parents = await rollAnchorParents(
      carriageEntriesFromBoard(handle.doc()), rollAnchorsFromBoard(handle.doc()), opts.closing);
    const signers = await Promise.all(selected.map(async (s) => ({
      signer: s.verifyingKey,
      sign:   ed25519SignerFromSeed(await loadPersonaGroupRootSeed(s.handleIndex)),
    })));
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
  const leaf = await nexusLeafFor(opts.handleIndex, aid);
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
export async function runNexusMembersList(opts: { sealHome: string; aid?: string; storageDir?: string }): Promise<NexusMembersListResult> {
  const storageDir = opts.storageDir ?? larDataDir();
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
  const repo        = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  try {
    const handle  = await materializeSharedLarDoc(repo, carriageDocUrl(boardIsland), "board:carriage-contracts");
    const entries = carriageEntriesFromBoard(handle.doc());
    const folded  = await foldCarriageSet(entries, roster);
    return {
      aid:             realmIdOfCharter(doc),
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
