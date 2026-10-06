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
 * THE ONE EXCEPTION, NAMED AND OWED: the kahu quorum signs with the persona-ROOTS seated in the charter,
 * because the charter seats roots and a quorum signature counts only against seated keys. The charter
 * therefore still publishes those roots; moving its seats onto leaves re-founds the charter epoch, which is
 * a founding act rather than a wiring one.
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

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  carriageEntriesFromBoard, writeCarriageEntry, signCarriageQuorum, carriageEntryActCid, signCarriageContract, verifyCarriageConsent,
  signCarrierContract, verifyCarrierContract, carriageEntryCounts, foldCarriageDetails, foldCarriageSet, foldCarrierSet,
  holdsCarriage, holdsCarrier, foundingRoster,
  carriageDocUrl, materializeSharedLarDoc, ed25519SignerFromSeed, realmIdOfCharter,
  type CarriageAction, type CarriageEntry, type KahuRoster, type QuorumSignature,
} from "@lararium/mesh";
import { larDataDir } from "../vessel-paths.js";
import { readNexusDoc } from "../nexus-doc.js";

import {
  listPersonaRoots, generateOrLoadPersonaGroupRoot, loadPersonaGroupRootSeed, personaRootExists,
  loadVesselVerifyingKey, loadVesselSigningSeed,
} from "../node-vessel-identity.js";
import { nodeNexusIsland } from "../nexus-standing.js";
import { heldNexusLeaves, nexusLeafFor } from "../nexus-leaf.js";

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
}

/** Read the seated roster off disk, FAILING CLOSED when no live quorum stands to root an admit on. */
function seatedRosterOrRefuse(sealHome: string): KahuRoster {
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
  const aid = realmIdOfCharter(readNexusDoc(sealHome));
  if (!aid) {
    throw new NexusContractError("no seated charter to name the Nexus by — a per-Nexus leaf derives from the charter's genesis epoch.");
  }
  return aid;
}

/**
 * Resolve the ≥ threshold HELD persona-roots that sit IN the seated roster — the kahu signers the operator can
 * bring to this quorum. FAIL CLOSED: fewer than `threshold` matching held roots REFUSES (no sub-quorum admit is
 * ever minted). Mirrors nexus-kapae `selectHeldQuorumSigners`.
 */
async function selectHeldQuorumSigners(
  roster: KahuRoster,
): Promise<Array<{ handleIndex: number; verifyingKey: string }>> {
  const rosterKeys = new Set(roster.keys.map((k) => k.toLowerCase()));
  const indices    = await listPersonaRoots();
  const candidates: Array<{ handleIndex: number; verifyingKey: string }> = [];
  const seen       = new Set<string>();
  for (const handleIndex of indices) {
    const root = await generateOrLoadPersonaGroupRoot(handleIndex);   // loads a HELD root; never mints here
    const vk   = root.verifyingKey.toLowerCase();
    if (!rosterKeys.has(vk) || seen.has(vk)) continue;
    seen.add(vk);
    candidates.push({ handleIndex, verifyingKey: vk });
    if (candidates.length >= roster.threshold) break;
  }
  if (candidates.length < roster.threshold) {
    throw new NexusContractError(
      `sub-quorum REFUSED (fail-closed): the vessel holds ${candidates.length} seated persona-root(s), but a valid membership act carries ${roster.threshold} distinct founding-kahu signatures. ` +
      `A real cabal collects the missing signature(s) from the other founding kahu (a collect-signatures ceremony, unbuilt).`,
    );
  }
  return candidates;
}

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
  sealHome: string; storageDir?: string;
}): Promise<{ nym: string; sealEpochCid: string; carrierSig: string }> {
  // `opts.storageDir` feeds no local read: identity resolves off LAR_ROOT/XDG alone. Kept on `opts` for
  // call-site shape compatibility only.
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
  const selected = await selectHeldQuorumSigners(roster);

  // The subject's own wax-seal — an ADMIT takes the operator's persona-signed contract-in, a CARRY takes the
  // place's vessel-signed carrier seal, and a REVOKE / UNCARRY takes none.
  let contract: { contractSig: QuorumSignature; how: "supplied" | "self" } | null = null;
  if (opts.action === "admit") {
    contract = await resolveContractIn(opts, nym, roster.sealEpochCid);
  } else if (opts.action === "carry") {
    contract = { contractSig: await resolveCarrierIn(opts, nym, roster.sealEpochCid), how: "supplied" };
  }

  const nexusPubkey = await loadVesselVerifyingKey();
  const boardIsland = nodeNexusIsland({ ownVesselKey: nexusPubkey });
  const boardUrl    = carriageDocUrl(boardIsland);
  const repo        = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  try {
    const handle = await materializeSharedLarDoc(repo, boardUrl, "board:carriage-contracts");

    const boardEntries = carriageEntriesFromBoard(handle.doc());
    const boardFold = await foldCarriageDetails(boardEntries, roster);
    const parents = causalHeadsForNym(boardFold.entries, nym, opts.action, roster.sealEpochCid);

    // The quorum signs with the seated persona-ROOTS: a quorum signature counts only against keys the charter
    // seats, and the charter seats roots until a re-found moves its seats onto leaves.
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

    const entries    = carriageEntriesFromBoard(handle.doc());
    const folded     = await foldCarriageSet(entries, roster);
    const memberHeld  = holdsCarriage(nym, folded);
    // THE TWO FOLDS STAY TWO. A `carry` moves the carrier observation and never `memberHeld` — the structural half of the
    // class law, reported so a caller reads which relation it actually landed.
    const carrierHeld = holdsCarrier(nym, await foldCarrierSet(entries, roster));

    return {
      action: opts.action, nym, parents, evidenceCid: carriageEntryActCid(entry),
      sealEpochCid: roster.sealEpochCid, threshold: roster.threshold,
      signers: selected.map((s) => s.verifyingKey),
      contractIn: contract ? contract.how : "n/a",
      boardUrl, memberHeld, carrierHeld,
    };
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}

/**
 * WHERE THIS VESSEL KEEPS ITS OWN CONSENT.
 *
 * A relation has two sides and each holds its own evidence. The founding operator's is the admit on
 * her members board — an immune surface, and hers alone. The joining operator's is the contract-in SHE
 * signed, so it is kept here: a vessel must be able to tell itself what it has joined without holding
 * any partner's document.
 *
 * BOUND TO AN EPOCH, so it cannot outlive what it consented to. Carriage was accepted under one
 * charter epoch; a rotation moves the frontier, and a consent rooted behind it names a Nexus whose
 * terms have changed. The reader compares before it counts, so a stale record grants nothing.
 */
export function carriageConsentPath(sealHome: string): string {
  return join(sealHome, "nexus", "carriage-consent.json");
}

export interface CarriageConsent {
  /** The per-Nexus leaf nym this vessel signed as. */
  readonly nym:          string;
  /** The charter epoch the consent binds to — a consent rooted elsewhere does not carry here. */
  readonly sealEpochCid: string;
  /** The signature handed to the founding kahu, kept so the act is reconstructible from this side. */
  readonly contractSig:  string;
}

/** Read this vessel's kept consent, or null when it has consented to nothing. */
export function readCarriageConsent(sealHome: string): CarriageConsent | null {
  try {
    const raw = JSON.parse(readFileSync(carriageConsentPath(sealHome), "utf8")) as Partial<CarriageConsent>;
    if (typeof raw.nym !== "string" || typeof raw.sealEpochCid !== "string" || typeof raw.contractSig !== "string") return null;
    if (raw.nym.length === 0 || raw.sealEpochCid.length === 0) return null;
    return { nym: raw.nym.toLowerCase(), sealEpochCid: raw.sealEpochCid, contractSig: raw.contractSig };
  } catch { return null; }
}

/**
 * Whether this vessel has CONTRACTED INTO the charter now standing in its seal home.
 *
 * THREE THINGS MUST HOLD, and the file satisfies none of them by sitting there. Disk is not a trust
 * boundary — `LAR_ROOT` names the whole seal home — so a reading that trusted the record's LOCATION
 * would report a Nexus this vessel never joined.
 *
 *   · THE EPOCH STANDS. A consent binds to the charter epoch it was given under; an unseated charter
 *     binds nothing, and a consent behind the current epoch consented to terms that have since moved.
 *   · THE SEAL IS REAL. The signature binds nym and epoch together and only the holder of that nym's
 *     seed can produce it, so a planted record fails rather than reads.
 *   · THE NYM IS OURS. Another operator's consent is GENUINE evidence that SHE joined; copied here it
 *     would let this vessel claim a relation somebody else entered. So the nym must be the leaf one of
 *     this vessel's held personas presents to this Nexus — a root nym names no stamp and reads false.
 *
 * Grants nothing either way — this answers a reading, never a capability. It is held to this standard
 * because a vessel that misreports the relation it stands in is lying to its own operator.
 */
export async function hasContractedInto(sealHome: string): Promise<boolean> {
  const consent = readCarriageConsent(sealHome);
  if (!consent) return false;

  const epoch = foundingRoster(readNexusDoc(sealHome)).sealEpochCid;
  if (epoch.length === 0 || epoch !== consent.sealEpochCid) return false;

  if (!(await verifyCarriageConsent(consent))) return false;

  const aid = realmIdOfCharter(readNexusDoc(sealHome));
  if (!aid) return false;
  return (await heldNexusLeaves(aid)).some((leaf) => leaf.verifyingKey === consent.nym);
}

/**
 * Mint the operator's "accepts carriage" contract-sig — run by the JOINING operator on its OWN vessel. Derives
 * the held persona's per-Nexus LEAF at `handleIndex` for the charter standing in the seal home, signs the
 * act-independent carriage token for the current charter epoch with that leaf, and returns the token hex the
 * kahu supply to `runNexusContract({ contractSig })`. The leaf IS the nym. FAIL CLOSED: an unseated charter has
 * no epoch to bind consent to, and a persona this vessel does not hold has no leaf → REFUSE.
 */
export async function runNexusAcceptCarriage(opts: {
  handleIndex: number; sealHome: string; storageDir?: string;
}): Promise<{ nym: string; sealEpochCid: string; contractSig: string }> {
  // `opts.storageDir` feeds no local read. Kept on `opts` for call-site shape compatibility only.
  const roster = foundingRoster(readNexusDoc(opts.sealHome));
  if (roster.sealEpochCid.length === 0) {
    throw new NexusContractError("no seated charter epoch to bind carriage consent to — the Nexus must seat its charter first.");
  }
  if (!(await personaRootExists(opts.handleIndex))) {
    throw new NexusContractError(`this vessel holds no persona at h${opts.handleIndex} — a contract-in signs with a held persona's leaf.`);
  }
  const leaf = await nexusLeafFor(opts.handleIndex, nexusAidOrRefuse(opts.sealHome));
  const nym  = leaf.verifyingKey;
  const sig  = await signCarriageContract(nym, roster.sealEpochCid, ed25519SignerFromSeed(leaf.seed));
  // KEEP IT. The signature travels to the founding kahu, and a copy stays here so this vessel can read
  // its own half of the relation without a partner's document.
  const consent: CarriageConsent = { nym, sealEpochCid: roster.sealEpochCid, contractSig: sig.sig };
  mkdirSync(dirname(carriageConsentPath(opts.sealHome)), { recursive: true });
  writeFileSync(carriageConsentPath(opts.sealHome), JSON.stringify(consent, null, 2), "utf8");

  return consent;
}

export interface NexusMembersListResult {
  /** The verifying key whose carriage doc this fold read — ALWAYS this vessel's own (the immune
   *  surface carries no partner's board). Reported so a caller never reads a local allow-set as a
   *  roster of the Nexus. */
  readonly boardRoot:       string;
  readonly sealEpochCid: string;
  readonly threshold:       number;
  readonly seatedKeys:      number;
  /** The member nyms locally held by this fold (quorum + contract-in verified against the seated roster). */
  readonly members:         readonly string[];
  readonly entries:         ReadonlyArray<{ nym: string; action: CarriageAction; parents: readonly string[]; evidenceCid: string; signers: number; contractIn: boolean }>;
}

/** Read the locally held member set + the raw board evidence (the `--list` fold). Read-only; FAILS CLOSED
 *  to the empty set on an unseated charter. */
export async function runNexusMembersList(opts: { sealHome: string; storageDir?: string }): Promise<NexusMembersListResult> {
  const storageDir = opts.storageDir ?? larDataDir();
  const roster     = foundingRoster(readNexusDoc(opts.sealHome));

  // THIS VESSEL'S OWN BOARD, AND ONLY EVER ITS OWN. The members registry is the Kapae-antigen's
  // ALLOW-twin: it governs the CARRY-SPLIT — whom THIS vessel blind-transits a sealed plane for. It is
  // an immune surface, and the immune plane carries no global roster by design, because there is no
  // global list of devices or users to approve against and behaviour is what the daemon can observe.
  //
  // Folding a PARTNER's board here would hand that partner's future admits authority over this
  // vessel's carriage: an operator consents to a Nexus at one epoch, never to every admit made
  // afterwards, and `nexus-contract` holds that "a Nexus cannot conscript an operator into carriage".
  // Whether two operators stand in a relation is a WHO-plane question and is answered elsewhere.
  const ownKey      = (await loadVesselVerifyingKey()).toLowerCase();
  const repo        = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  try {
    const handle  = await materializeSharedLarDoc(repo, carriageDocUrl(ownKey), "board:carriage-contracts");
    const entries = carriageEntriesFromBoard(handle.doc());
    const folded  = await foldCarriageSet(entries, roster);
    return {
      boardRoot:       ownKey,
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
