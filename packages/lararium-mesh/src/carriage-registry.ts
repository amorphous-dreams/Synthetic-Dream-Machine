/**
 * carriage-registry — the operator CARRIAGE-registry: the Kapae-antigen's ALLOW-twin. Where the antigen
 * folds a quorum-signed DENY set (who stands banned), this folds a quorum-signed ALLOW set (which vessels
 * CARRY for this Nexus).
 *
 * IT RECORDS A CONTRACT, NEVER A BELONGING. An entry here answers "does this vessel carry for us?" — the
 * infrastructure relation a human's PersonaGroup contracts with a kahu Cabal. It says NOTHING about whether
 * that human JOINED any Cabal; joining is a mutual hold on the realm's authority graph (cabal-realm), an
 * orthogonal axis. A human may contract without joining, join without contracting, hold both, or neither.
 * Reading a carriage entry as belonging reads it exactly backwards. Same additive evidence shape (entries accrete,
 * causal heads determine the local relation, contradictory heads fail closed), same quorum authority
 * (≥ k founding-kahu signatures rooted on the charter epoch), and it
 * FAILS CLOSED at every shore. `blocked{}` ⊥ `carriage{}`: a nym may sit in either, neither,
 * or — pathologically — both (the antigen still draws Mu; a ban outranks a membership at enforcement).
 *
 * TRACK CONTRACTS, NEVER IDENTITIES (membership-doctrine). A CarriageEntry carries the operator-contract
 * FLOOR and nothing above it: the operator's PUBKEY (the nym), the CHARTER-EPOCH it roots on, and — for an
 * admit — proof the operator SIGNED "I accept carriage" (the `contractSig`). NO name, NO email, NO device
 * list, NO behavior. A user NEVER lands here — this registry names contracting OPERATORS only; a user
 * soft-attaches and leaves no roster trace (membership-doctrine #the-two-stacks).
 *
 * WAX-SEALS ONLY, NEVER A REGISTRAR GRANT. An admit is not a central registrar writing a row — it is a
 * quorum of stewards counter-signing an act the operator itself consented to. Two seals ride every admit:
 *   · the OPERATOR's own signature over an act-independent "accepts carriage" token (`contractSig`) — the
 *     contract-in; without it, an admit does NOT count (a Nexus cannot conscript an operator into carriage).
 *   · ≥ k founding-kahu quorum signatures over the entry — the steward act (identical to the antigen's).
 * A REVOKE needs the steward quorum only (an uncooperative member cannot veto its own removal), mirroring
 * the antigen's `un_kapae`.
 *
 * FAIL CLOSED, every shore: an entry whose kahu quorum does not verify is IGNORED; an admit missing / carrying
 * a bad `contractSig` is IGNORED (never a member); an entry rooting on an unknown charter epoch is IGNORED; a
 * concurrent admit/revoke heads stay UNSETTLED (a contradiction never grants membership). An unbound
 * (empty-key) roster meets no threshold → nobody reads
 * member.
 *
 * Platform-blind: rides ./crypto + @noble/ed25519 + ./kapae-antigen types only. NO node: imports.
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-operator-contract
 */

import { CARRIAGE_CARRIER_DOMAIN, CARRIAGE_CONTRACT_DOMAIN, CARRIAGE_ENTRY_DOMAIN, CARRIAGE_ROLL_ANCHOR_DOMAIN } from "./domains.js";
import * as ed25519 from "@noble/ed25519";
import { canonicalJsonBytes, hexToBytes, sha256HexBytesSync } from "./crypto.js";
import type { QuorumSignature, KahuQuorumSeats } from "./kapae-antigen.js";
import { foldAntigenVerdicts, type KapaeAntigenEntry, type QuorumVerifier } from "./kapae-antigen.js";
import { sealKeySetHash, verifySealLineage, type SealEpoch } from "./wax-stamp.js";

/** The domain a CarriageEntry's quorum signs over — a signature is meaningless without its domain. */
export { CARRIAGE_ENTRY_DOMAIN } from "./domains.js";
/** The domain the operator's OWN "accepts carriage" contract-token signs over — DISTINCT from the entry
 *  domain, and act-INDEPENDENT: the operator consents to carriage-under-this-epoch ONCE, and a kahu
 *  quorum may then admit / re-admit it by citing that one standing consent. */
export { CARRIAGE_CONTRACT_DOMAIN } from "./domains.js";
/** The domain a PLACE's own "I carry for this Nexus" seal signs over — its OWN name, so a carrier seal can
 *  never present as a member's accepts-carriage token and no token crosses the two folds. */
export { CARRIAGE_CARRIER_DOMAIN } from "./domains.js";
/**
 * A steward act on this board. FOUR acts, TWO relations, and the relations never fold into one another:
 *
 *   · ADMIT / REVOKE name an OPERATOR — a person, whose own PERSONA ROOT signs the accepts-carriage token.
 *     They fold through `foldCarriageSet` into the member set the carry-split gates on.
 *   · CARRY / UNCARRY name a PLACE — a Herm or an unlit hearth, faceless by class
 *     (`personaSlotCeiling("herm") === 0`), whose own device-minted VESSEL key signs a CARRIER seal. They
 *     fold through `foldCarrierSet` and NEVER enter the member set: a place is not an operator, and the
 *     members board holds "the maximum the system ever holds about a contracting operator"
 *     (membership-doctrine#the-operator-contract).
 *
 * One board, one monotone CRDT, two folds. Canon: heraldry#/the-herm-card.
 */
export type CarriageAction = "admit" | "revoke" | "carry" | "uncarry";

/**
 * One entry in the members set — a quorum-signed admit or revoke of ONE operator nym. Monotone/additive
 * CRDT (entries only accrete; the fold reads causal heads per nym). The signatures
 * ride OUTSIDE the signed content, so re-carrying an entry never re-signs it (the antigen's discipline).
 *
 * THE PAYLOAD FLOOR (membership-doctrine): pubkey (`nym`) + charter-epoch + the accepts-carriage proof
 * (`contractSig`), and NOTHING else the antigen entry does not also carry. No identity of the human behind
 * the key ever rides here.
 */
export interface CarriageEntry {
  readonly kind:            typeof CARRIAGE_ENTRY_DOMAIN;
  /** The contracting operator's ed25519 verifying-key hex — the member nym (an operator pubkey, never a doc). */
  readonly nym:             string;
  /** ADMIT the operator into carriage, or REVOKE it. */
  readonly action:          CarriageAction;
  /** Content-addressed causal parents. Empty means the relation's genesis act. */
  readonly parents:         readonly string[];
  /** The nexus-charter epoch this quorum act roots on (the wax-stamp epoch-chain — SealEpoch.epochCid). */
  readonly sealEpochCid: string;
  /** ≥ threshold distinct founding-kahu signatures over `carriageEntryBytes` — the steward quorum. */
  readonly signatures:      readonly QuorumSignature[];
  /**
   * The subject's OWN wax-seal, and WHICH seal depends on the act:
   *   · an `admit` carries the OPERATOR's signature over `carriageContractBytes` — the accepts-carriage
   *     contract-in, signed by that operator's PERSONA ROOT. REQUIRED, `signer` MUST equal `nym`.
   *   · a `carry` carries the PLACE's signature over `carrierContractBytes` — signed by its own
   *     device-minted VESSEL key, and by no persona anywhere. REQUIRED, `signer` MUST equal `nym`.
   *   · a `revoke` / `uncarry` carries none (an uncooperative subject cannot veto its own removal).
   * The two seals sign DIFFERENT DOMAINS, so neither ever counts on the other's fold — without that a
   * Nexus could conscript an operator by re-presenting a place's seal, or the reverse.
   */
  readonly contractSig?:    QuorumSignature;
}

/**
 * The canonical bytes the KAHU QUORUM signs over — everything but the signatures + the contract sig.
 * Parents are sorted into the semantic act image, so the act's CID is stable across gossip order and
 * quorum-signature ordering. The operator's accepts-carriage token signs SEPARATE bytes and stays a
 * distinct, board-local gate.
 */
export function carriageEntryBytes(
  entry: Omit<CarriageEntry, "signatures" | "contractSig">,
): Uint8Array {
  return canonicalJsonBytes({
    kind: entry.kind,
    nym: entry.nym,
    action: entry.action,
    parents: [...new Set(entry.parents)].sort(),
    sealEpochCid: entry.sealEpochCid,
  });
}

/** The semantic act CID. Signatures are evidence around this act, not part of its identity. */
export function carriageEntryActCid(
  entry: Omit<CarriageEntry, "signatures" | "contractSig"> | CarriageEntry,
): string {
  return sha256HexBytesSync(carriageEntryBytes(entry));
}

/**
 * The canonical bytes the OPERATOR signs over to accept carriage — act-INDEPENDENT (only the nym + the
 * charter epoch). The operator signs this ONCE; a kahu quorum may cite the resulting `contractSig` on any
 * later admit act. The token IS the acceptance — its verified presence proves "accepts carriage".
 */
export function carriageContractBytes(parts: { nym: string; sealEpochCid: string }): Uint8Array {
  return canonicalJsonBytes({
    kind:            CARRIAGE_CONTRACT_DOMAIN,
    nym:             parts.nym,
    sealEpochCid: parts.sealEpochCid,
  });
}

/**
 * The canonical bytes a PLACE signs over to carry for a Nexus — act-INDEPENDENT, exactly as the
 * operator's accepts-carriage token is, and DOMAIN-SEPARATED from it. The place signs this ONCE with its
 * own vessel key; a kahu quorum may cite the resulting seal on any later `carry` act.
 *
 * NO PERSONA IS READ ANYWHERE ON THIS PATH. That is the whole point: a Herm holds no persona root by law
 * (`vessel-standing.ts` — `personaSlotCeiling("herm") === 0`, argument-ignoring), so a relation that asked
 * for one asked a crossroads to seat the one thing its class exists to prevent.
 */
export function carrierContractBytes(parts: { nym: string; sealEpochCid: string }): Uint8Array {
  return canonicalJsonBytes({
    kind:         CARRIAGE_CARRIER_DOMAIN,
    nym:          parts.nym,
    sealEpochCid: parts.sealEpochCid,
  });
}

/**
 * Mint a place's carrier seal. The caller supplies the vessel signer; the module holds no key. The returned
 * `QuorumSignature` rides a `carry` entry's `contractSig`.
 */
export async function signCarrierContract(
  nym: string,
  sealEpochCid: string,
  sign: (bytes: Uint8Array) => Promise<string>,
): Promise<QuorumSignature> {
  const sig = await sign(carrierContractBytes({ nym, sealEpochCid }));
  return { signer: nym, sig };
}

/**
 * Does a carrier seal prove itself? FAIL CLOSED: a malformed nym or signature hex, a signature over any
 * other domain's bytes, or one raised by a hand other than the named place — each reads false. Exported so
 * a writer self-verifies before landing an entry the fold would ignore.
 */
export async function verifyCarrierContract(
  seal: { nym: string; sealEpochCid: string; sig: string },
): Promise<boolean> {
  const nym = seal.nym.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(nym)) return false;
  if (!/^[0-9a-f]+$/.test(seal.sig) || seal.sig.length === 0) return false;
  const bytes = carrierContractBytes({ nym, sealEpochCid: seal.sealEpochCid });
  try { return await ed25519.verifyAsync(hexToBytes(seal.sig), bytes, hexToBytes(nym)); }
  catch { return false; }
}

/**
 * Verify a k-of-n founding-kahu quorum over a CarriageEntry — the SAME k-of-n multi-signature the antigen's
 * `makeMultiSigQuorumVerifier` runs, re-applied at the membership domain (that antigen verifier stays
 * UNCHANGED for the antigen). Guards, each fail-closed: a non-roster signer never counts; a signer counted
 * twice counts once; a signature that does not verify over the entry bytes does not count; the entry MUST root
 * on the roster's charter epoch. An unbound / short roster meets no threshold → false.
 */
async function verifyMembershipQuorum(entry: CarriageEntry, roster: KahuQuorumSeats): Promise<boolean> {
  if (entry.kind !== CARRIAGE_ENTRY_DOMAIN)             return false;
  if (roster.threshold < 1)                              return false;
  if (roster.keys.length < roster.threshold)             return false;   // unbound / short roster → deny
  if (entry.sealEpochCid !== roster.sealEpochCid)  return false;   // roots on an unknown epoch → deny
  return quorumSignaturesCount(carriageEntryBytes(entry), entry.signatures, roster);
}

/** ≥ threshold distinct roster keys whose signature verifies over `bytes`. A non-roster signer, a repeat
 *  signer and a malformed signature each count as no signature; a short roster meets no threshold. */
async function quorumSignaturesCount(
  bytes: Uint8Array, signatures: readonly QuorumSignature[], roster: KahuQuorumSeats,
): Promise<boolean> {
  if (roster.threshold < 1 || roster.keys.length < roster.threshold) return false;
  const rosterKeys = new Set(roster.keys.map((k) => k.toLowerCase()));
  const counted    = new Set<string>();
  for (const s of signatures) {
    const signer = s.signer.toLowerCase();
    if (counted.has(signer))     continue;   // a signer pads the quorum at most once
    if (!rosterKeys.has(signer)) continue;   // a non-roster signer never counts
    let ok = false;
    try { ok = await ed25519.verifyAsync(hexToBytes(s.sig), bytes, hexToBytes(s.signer)); }
    catch { ok = false; }                    // a malformed sig / key counts as no signature
    if (ok) counted.add(signer);
    if (counted.size >= roster.threshold) return true;
  }
  return false;
}

/**
 * Verify the operator's own "accepts carriage" contract-sig on an ADMIT entry. FAIL CLOSED: no contractSig,
 * a contractSig whose `signer` is not the entry's own nym, or a signature that does not verify over the
 * act-independent carriage-token bytes — each reads false (the admit then does NOT count). A Nexus can
 * never manufacture this seal: only the operator holding the nym's seed can produce it.
 */
async function verifyContractIn(entry: CarriageEntry): Promise<boolean> {
  const cs = entry.contractSig;
  if (!cs) return false;
  if (cs.signer.toLowerCase() !== entry.nym.toLowerCase()) return false;   // the seal MUST be the operator's own
  return verifyCarriageConsent({ nym: entry.nym, sealEpochCid: entry.sealEpochCid, contractSig: cs.sig });
}

/** Verify a PLACE's own carrier seal on a `carry` entry — the vessel-key twin of `verifyContractIn`, over
 *  its own domain. FAIL CLOSED at every shore, exactly as the member seal is. */
async function verifyCarrierIn(entry: CarriageEntry): Promise<boolean> {
  const cs = entry.contractSig;
  if (!cs) return false;
  if (cs.signer.toLowerCase() !== entry.nym.toLowerCase()) return false;   // the seal MUST be the place's own
  return verifyCarrierContract({ nym: entry.nym, sealEpochCid: entry.sealEpochCid, sig: cs.sig });
}

/**
 * Does this WHOLE entry count? Each act names the seals it needs, and no act ever borrows another's:
 *   · REVOKE / UNCARRY — the kahu quorum alone (an uncooperative subject cannot veto its own removal),
 *   · ADMIT — the kahu quorum AND the OPERATOR's persona-signed accepts-carriage token,
 *   · CARRY — the kahu quorum AND the PLACE's own VESSEL-key carrier seal.
 * An unreadable shape, a foreign charter epoch or an unsupported act never counts. Anything short is ignored,
 * never guessed into a relation. It reads the fold's own per-entry verdict, so the writer and the fold never
 * disagree. Exported so a WRITER self-verifies before landing
 * an entry (a written-but-dead act reads as enforced while granting nothing).
 */
export async function carriageEntryCounts(entry: CarriageEntry, roster: KahuQuorumSeats): Promise<boolean> {
  return (await countReason(entry, roster)).counted;   // the fold's own verdict — one decision, never a re-dispatch
}

export type CarriageFoldWinnerState = "accepted" | "revoked" | "unsettled" | "unavailable" | "ignored";

export interface CarriageFoldEntryDetail {
  readonly nym: string;
  readonly action: CarriageAction | string;
  readonly parents: readonly string[];
  readonly evidenceCid: string;
  readonly sealEpochCid: string;
  readonly counted: boolean;
  readonly state: CarriageFoldWinnerState;
  readonly reason: string;
}

export interface CarriageFoldDetails {
  /** The charter head the caller supplied to this fold; this is a CID lineage, never an integer epoch. */
  readonly charterEpochCid: string | null;
  /** The member set is intentionally identical to `foldCarriageSet`. */
  readonly members: ReadonlySet<string>;
  /** The place set is intentionally identical to `foldCarrierSet`. */
  readonly carriers: ReadonlySet<string>;
  /** Every supplied entry, including uncounted evidence, with a named local reason. */
  readonly entries: readonly CarriageFoldEntryDetail[];
}

function entryShapeIsReadable(entry: CarriageEntry): boolean {
  return typeof entry === "object" && entry !== null &&
    typeof entry.kind === "string" && typeof entry.nym === "string" &&
    typeof entry.action === "string" && Array.isArray(entry.parents) &&
    entry.parents.every((parent) => typeof parent === "string" && /^[0-9a-f]{64}$/.test(parent)) &&
    typeof entry.sealEpochCid === "string" && Array.isArray(entry.signatures);
}

async function countReason(entry: CarriageEntry, roster: KahuQuorumSeats): Promise<{ counted: boolean; reason: string }> {
  if (!entryShapeIsReadable(entry)) return { counted: false, reason: "malformed-entry" };
  if (entry.sealEpochCid !== roster.sealEpochCid) return { counted: false, reason: "wrong-charter-epoch" };
  if (entry.action !== "admit" && entry.action !== "revoke" && entry.action !== "carry" && entry.action !== "uncarry") {
    return { counted: false, reason: "unsupported-action" };
  }
  if (!(await verifyMembershipQuorum(entry, roster))) return { counted: false, reason: "quorum-not-counted" };
  if (entry.action === "revoke" || entry.action === "uncarry") return { counted: true, reason: "quorum-counted" };
  if (entry.action === "carry") {
    return (await verifyCarrierIn(entry))
      ? { counted: true, reason: "quorum-and-carrier-seal-counted" }
      : { counted: false, reason: "carrier-seal-not-counted" };
  }
  return (await verifyContractIn(entry))
    ? { counted: true, reason: "quorum-and-contract-in-counted" }
    : { counted: false, reason: "contract-in-not-counted" };
}

function relationFamily(action: CarriageAction | string): "member" | "carrier" | null {
  if (action === "admit" || action === "revoke") return "member";
  if (action === "carry" || action === "uncarry") return "carrier";
  return null;
}

/** Whether `candidate` is a causal descendant of `ancestor` in the supplied evidence set. */
export function isCarriageDescendant(
  candidate: string,
  ancestor: string,
  byCid: ReadonlyMap<string, { readonly parents: readonly string[] }>,
): boolean {
  const todo = [...(byCid.get(candidate)?.parents ?? [])];
  const seen = new Set<string>();
  while (todo.length) {
    const cid = todo.pop()!;
    if (cid === ancestor) return true;
    if (seen.has(cid)) continue;
    seen.add(cid);
    const node = byCid.get(cid);
    if (node) todo.push(...node.parents);
  }
  return false;
}

/**
 * Fold with evidence retained for a receiver-local relation verifier. The fold never picks a winner
 * between contradictory concurrent heads: both remain visible as `unsettled` and the member/carrier
 * projection fails closed.
 */
export async function foldCarriageDetails(
  entries: Iterable<CarriageEntry> | undefined,
  roster: KahuQuorumSeats | undefined,
): Promise<CarriageFoldDetails> {
  if (entries === undefined || roster === undefined) {
    return { charterEpochCid: roster?.sealEpochCid ?? null, members: new Set<string>(), carriers: new Set<string>(), entries: [] };
  }
  const source = [...entries];
  type MutableDetail = { nym: string; action: CarriageAction | string; parents: readonly string[]; evidenceCid: string; sealEpochCid: string; counted: boolean; state: CarriageFoldWinnerState; reason: string };
  const counted: Array<{ entry: CarriageEntry; detail: MutableDetail }> = [];
  const details: MutableDetail[] = [];
  for (const entry of source) {
    const result = await countReason(entry, roster);
    const readable = entryShapeIsReadable(entry);
    const parents = readable ? [...entry.parents].sort() : [];
    const evidenceCid = readable ? carriageEntryActCid(entry) : "";
    const detail: CarriageFoldEntryDetail = {
      nym: typeof entry?.nym === "string" ? entry.nym.toLowerCase() : "",
      action: typeof entry?.action === "string" ? entry.action : "malformed",
      parents,
      evidenceCid,
      sealEpochCid: typeof entry?.sealEpochCid === "string" ? entry.sealEpochCid : "",
      counted: result.counted,
      state: "ignored",
      reason: result.reason,
    };
    details.push(detail);
    if (result.counted) counted.push({ entry, detail });
  }
  const byCid = new Map<string, { entry: CarriageEntry; detail: MutableDetail }>();
  for (const candidate of counted) byCid.set(candidate.detail.evidenceCid, candidate);
  // A counted act whose causal parent is absent or belongs to another relation cannot become a head.
  // Re-run to a fixed point: a child of a parent invalidated by a missing grandparent is unavailable too.
  let invalidated = true;
  while (invalidated) {
    invalidated = false;
    for (const candidate of counted) {
      if (!candidate.detail.counted) continue;
      const family = relationFamily(candidate.entry.action);
      const missing = candidate.entry.parents.some((parent) => {
        const parentNode = byCid.get(parent);
        return !parentNode || relationFamily(parentNode.entry.action) !== family ||
          parentNode.entry.nym.toLowerCase() !== candidate.entry.nym.toLowerCase() ||
          parentNode.entry.sealEpochCid !== candidate.entry.sealEpochCid;
      });
      if (missing) {
        candidate.detail.counted = false;
        candidate.detail.state = "unavailable";
        candidate.detail.reason = "missing-parent";
        byCid.delete(candidate.detail.evidenceCid);
        invalidated = true;
      }
    }
  }

  const byRelation = new Map<string, Array<{ entry: CarriageEntry; detail: MutableDetail }>>();
  for (const candidate of counted) {
    if (!candidate.detail.counted) continue;
    const family = relationFamily(candidate.entry.action);
    if (!family) continue;
    const key = `${family}:${candidate.detail.nym}`;
    const list = byRelation.get(key);
    if (list) list.push(candidate); else byRelation.set(key, [candidate]);
  }
  const members = new Set<string>();
  const carriers = new Set<string>();
  for (const [key, candidates] of byRelation) {
    const family = key.slice(0, key.indexOf(":"));
    const heads = candidates.filter((candidate) => !candidates.some((other) =>
      other !== candidate && other.entry.parents.includes(candidate.detail.evidenceCid)));
    if (heads.length === 0) {
      for (const candidate of candidates) { candidate.detail.state = "unsettled"; candidate.detail.reason = "causal-cycle"; }
      continue;
    }
    const actions = new Set(heads.map((head) => head.entry.action));
    const contradictory = (family === "member" && actions.has("admit") && actions.has("revoke")) ||
      (family === "carrier" && actions.has("carry") && actions.has("uncarry"));
    if (contradictory) {
      for (const head of heads) { head.detail.state = "unsettled"; head.detail.reason = "concurrent-contradictory-heads"; }
      continue;
    }
    const headState: CarriageFoldWinnerState = heads[0]!.entry.action === "admit" || heads[0]!.entry.action === "carry" ? "accepted" : "revoked";
    for (const candidate of candidates) {
      if (heads.includes(candidate)) {
        candidate.detail.state = headState;
        candidate.detail.reason = headState === "accepted" ? "causal-head-accepted" : "causal-head-revoked";
      } else {
        candidate.detail.state = "ignored";
        candidate.detail.reason = "superseded-by-descendant";
      }
    }
    const nym = candidates[0]!.detail.nym;
    if (family === "member" && headState === "accepted") members.add(nym);
    if (family === "carrier" && headState === "accepted") carriers.add(nym);
  }
  return { charterEpochCid: roster.sealEpochCid, members, carriers, entries: details.map((detail) => ({ ...detail })) };
}

/**
 * Sign a CarriageEntry's KAHU QUORUM — collect ≥ threshold of these into an entry's `signatures`. The
 * module holds no key; each kahu supplies its own signer (mirrors the antigen's `signAntigenEntry`).
 */
export async function signCarriageQuorum(
  parts: Omit<CarriageEntry, "kind" | "signatures" | "contractSig">,
  signers: ReadonlyArray<{ readonly signer: string; readonly sign: (bytes: Uint8Array) => Promise<string> }>,
  contractSig?: QuorumSignature,
): Promise<CarriageEntry> {
  const unsigned = {
    ...parts,
    parents: [...new Set(parts.parents)].sort(),
    kind: CARRIAGE_ENTRY_DOMAIN,
  } as Omit<CarriageEntry, "signatures" | "contractSig">;
  const bytes = carriageEntryBytes(unsigned);
  const signatures: QuorumSignature[] = [];
  for (const s of signers) signatures.push({ signer: s.signer, sig: await s.sign(bytes) });
  const entry: CarriageEntry = { ...unsigned, signatures };
  return contractSig ? { ...entry, contractSig } : entry;
}

/**
 * Does a KEPT contract-in prove itself?
 *
 * A joining operator keeps the consent she signed so her vessel can read the relation it stands in
 * without holding a partner's document. That record sits on disk, and disk is not a trust boundary —
 * `LAR_ROOT` names the whole seal home, so anything running as its owner may write there. Reading it
 * by LOCATION would report a Nexus a vessel never joined.
 *
 * So the kept copy earns its reading the way the admit path earns its own: the seal binds the nym and
 * the epoch TOGETHER, and only the operator holding that nym's seed can produce it. Moving either
 * field breaks it, so a consent cannot be lifted onto a later charter to carry a relation across terms
 * it never read.
 *
 * NOT THE WHOLE GATE. A consent signed by ANOTHER operator verifies here, correctly — it is genuine
 * evidence that somebody joined. A caller asking "did I join?" must also establish that the nym is a
 * root IT holds; this answers only whether the seal is real.
 */
export async function verifyCarriageConsent(
  consent: { nym: string; sealEpochCid: string; contractSig: string },
): Promise<boolean> {
  const nym = consent.nym.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(nym)) return false;
  if (!/^[0-9a-f]+$/.test(consent.contractSig) || consent.contractSig.length === 0) return false;
  const bytes = carriageContractBytes({ nym, sealEpochCid: consent.sealEpochCid });
  try { return await ed25519.verifyAsync(hexToBytes(consent.contractSig), bytes, hexToBytes(nym)); }
  catch { return false; }
}

/**
 * Mint the operator's "accepts carriage" contract-sig — the contract-in the operator signs ONCE for a charter
 * epoch. The caller supplies the operator's own signer (the module holds no key). The returned `QuorumSignature`
 * rides an admit entry's `contractSig`.
 */
export async function signCarriageContract(
  nym: string,
  sealEpochCid: string,
  sign: (bytes: Uint8Array) => Promise<string>,
): Promise<QuorumSignature> {
  const sig = await sign(carriageContractBytes({ nym, sealEpochCid }));
  return { signer: nym, sig };
}

/**
 * Fold the membership entries into the locally observed operator-nym set. Only entries that fully COUNT
 * (kahu quorum, plus the contract-in for an admit) participate. Causal heads determine the relation; concurrent
 * contradictory heads remain unsettled and fail closed.
 *
 * The result is a plain nym set: what the board's RECORD says (`nexus members --list`). No enforcement shore
 * reads it as an allow set — the membership consult seats a peer only on an admit that peer PRESENTS
 * (`verifyPresentedAdmit`), with this board read as a deny board.
 */
export async function foldCarriageSet(
  entries: Iterable<CarriageEntry>,
  roster: KahuQuorumSeats,
): Promise<ReadonlySet<string>> {
  return (await foldCarriageDetails(entries, roster)).members;
}

/** Does this operator nym stand a contracted member in the folded members set? */
export function holdsCarriage(nym: string, memberSet: ReadonlySet<string>): boolean {
  return memberSet.has(nym.toLowerCase());
}

/**
 * Fold the SAME board into the currently-contracted CARRIER set — the places, held apart from the members.
 *
 * ONE BOARD, TWO FOLDS, AND THEY NEVER MEET. `foldCarriageSet` above counts an `admit` winner; this counts a
 * `carry` winner. A place therefore never appears in the member set however the board is written, and
 * `holdsCarriagePeer` stays false for it at the enforcement shore — which is the structural half of the class
 * law: a crossroads runs infrastructure and holds no civic standing (identity-classes#the-four-classes).
 *
 * Same discipline as the member fold: only entries that fully COUNT participate, causal heads decide, and
 * contradictory concurrent heads leave the place unsettled.
 */
export async function foldCarrierSet(
  entries: Iterable<CarriageEntry>,
  roster: KahuQuorumSeats,
): Promise<ReadonlySet<string>> {
  return (await foldCarriageDetails(entries, roster)).carriers;
}

/** Does this PLACE's vessel key stand a contracted carrier in the folded carrier set? */
export function holdsCarrier(nym: string, carrierSet: ReadonlySet<string>): boolean {
  return carrierSet.has(nym.toLowerCase());
}

// ── the roll anchor ──────────────────────────────────────────────────────────────────────────────────────────
// A seal roll changes the roster every carriage act counts under. An admit minted at the closed epoch still
// counts there, and the anchor is how it carries across: the NEW epoch's quorum signs the closed epoch's cid,
// that epoch's public key-set, and the board's causal heads at the roll. An admit standing in those heads was
// minted BEFORE the roll; one minted under the closed keys afterwards sits in no anchor's past.

/**
 * RollAnchor — one seal roll, recorded on the carriage board.
 *
 *   · `prevEpochCid` / `sealEpochCid` — the epoch the roll closes and the epoch it opens.
 *   · `prevKeys` / `prevThreshold`    — the CLOSED epoch's seated key-set: public charter material that the
 *                                       charter lineage already binds (`sealKeySetHash` = that epoch's
 *                                       `keySetHash`), carried so a verifier can count the closed epoch's acts.
 *   · `parents`                       — the board's causal heads at the roll (`rollAnchorParents`).
 *   · `signatures`                    — the OPENED epoch's quorum. The closed keys never sign the anchor: they
 *                                       may be the reason for the roll.
 *
 * Its act CID sits in the same 64-hex space as a carriage act's, so a later anchor cites it as a parent.
 */
export interface RollAnchor {
  readonly kind:          typeof CARRIAGE_ROLL_ANCHOR_DOMAIN;
  readonly prevEpochCid:  string;
  readonly sealEpochCid:  string;
  readonly prevKeys:      readonly string[];
  readonly prevThreshold: number;
  readonly parents:       readonly string[];
  readonly signatures:    readonly QuorumSignature[];
}

/** The domain a roll anchor's quorum signs over — its own name, apart from every carriage act. */
export { CARRIAGE_ROLL_ANCHOR_DOMAIN } from "./domains.js";

/** The canonical bytes the opened epoch's quorum signs: everything but the signatures, keys and parents
 *  sorted and de-duplicated so the CID is stable across gossip order. */
export function rollAnchorBytes(anchor: Omit<RollAnchor, "signatures">): Uint8Array {
  return canonicalJsonBytes({
    kind:          anchor.kind,
    prevEpochCid:  anchor.prevEpochCid,
    sealEpochCid:  anchor.sealEpochCid,
    prevKeys:      [...new Set(anchor.prevKeys.map((k) => k.toLowerCase()))].sort(),
    prevThreshold: anchor.prevThreshold,
    parents:       [...new Set(anchor.parents)].sort(),
  });
}

/** The anchor's act CID — 64-hex, citable as a causal parent. Signatures are evidence, not identity. */
export function rollAnchorCid(anchor: Omit<RollAnchor, "signatures"> | RollAnchor): string {
  return sha256HexBytesSync(rollAnchorBytes(anchor));
}

/** Shape only: the anchor domain, two epoch cids, a key-set, 64-hex parents and signature records. */
export function isRollAnchor(v: unknown): v is RollAnchor {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const x = v as Record<string, unknown>;
  return x["kind"] === CARRIAGE_ROLL_ANCHOR_DOMAIN &&
    typeof x["prevEpochCid"] === "string" && x["prevEpochCid"].length > 0 &&
    typeof x["sealEpochCid"] === "string" && x["sealEpochCid"].length > 0 &&
    Array.isArray(x["prevKeys"]) && x["prevKeys"].every((k) => typeof k === "string" && /^[0-9a-fA-F]{64}$/.test(k)) &&
    typeof x["prevThreshold"] === "number" && Number.isInteger(x["prevThreshold"]) && x["prevThreshold"] >= 1 &&
    Array.isArray(x["parents"]) && x["parents"].every((p) => typeof p === "string" && /^[0-9a-f]{64}$/.test(p)) &&
    Array.isArray(x["signatures"]) && x["signatures"].every((s) =>
      typeof s === "object" && s !== null &&
      typeof (s as Record<string, unknown>)["signer"] === "string" &&
      typeof (s as Record<string, unknown>)["sig"] === "string");
}

/** Sign a roll anchor with the OPENED epoch's quorum. The module holds no key; each kahu supplies a signer. */
export async function signRollAnchor(
  parts: Omit<RollAnchor, "kind" | "signatures">,
  signers: ReadonlyArray<{ readonly signer: string; readonly sign: (bytes: Uint8Array) => Promise<string> }>,
): Promise<RollAnchor> {
  const unsigned: Omit<RollAnchor, "signatures"> = {
    kind:          CARRIAGE_ROLL_ANCHOR_DOMAIN,
    prevEpochCid:  parts.prevEpochCid,
    sealEpochCid:  parts.sealEpochCid,
    prevKeys:      [...new Set(parts.prevKeys.map((k) => k.toLowerCase()))].sort(),
    prevThreshold: parts.prevThreshold,
    parents:       [...new Set(parts.parents)].sort(),
  };
  const bytes = rollAnchorBytes(unsigned);
  const signatures: QuorumSignature[] = [];
  for (const s of signers) signatures.push({ signer: s.signer, sig: await s.sign(bytes) });
  return { ...unsigned, signatures };
}

/**
 * Does the anchor count under `opened` — the roster of the epoch it OPENS? It must name that epoch and carry a
 * quorum of that roster's keys over its bytes. Exported so the writer self-verifies before landing an anchor.
 */
export async function rollAnchorCounts(anchor: RollAnchor, opened: KahuQuorumSeats): Promise<boolean> {
  if (!isRollAnchor(anchor)) return false;
  if (anchor.sealEpochCid !== opened.sealEpochCid) return false;
  return quorumSignaturesCount(rollAnchorBytes(anchor), anchor.signatures, opened);
}

/**
 * The board's causal heads at a roll that CLOSES `closing`'s epoch: every act that counts under `closing`, and
 * every anchor that opened `closing`'s epoch and counts there, that no other of them cites. Acts at any other
 * epoch are left out, so an act a stale key minted at an older epoch never enters the roll's past. Sorted.
 */
export async function rollAnchorParents(
  entries: Iterable<CarriageEntry>,
  anchors: Iterable<RollAnchor>,
  closing: KahuQuorumSeats,
): Promise<string[]> {
  const nodes = new Map<string, readonly string[]>();
  for (const entry of entries) {
    if (!entryShapeIsReadable(entry) || entry.sealEpochCid !== closing.sealEpochCid) continue;
    if (!(await countReason(entry, closing)).counted) continue;
    nodes.set(carriageEntryActCid(entry), entry.parents);
  }
  for (const anchor of anchors) {
    if (!(await rollAnchorCounts(anchor, closing))) continue;
    nodes.set(rollAnchorCid(anchor), anchor.parents);
  }
  const cited = new Set<string>();
  for (const parents of nodes.values()) for (const p of parents) cited.add(p);
  return [...nodes.keys()].filter((cid) => !cited.has(cid)).sort();
}

// ── presented-admit verifier ─────────────────────────────────────────────────────────────────────────────
// The subject PRESENTS its own quorum-signed admit and that admit's causal lineage; the gate checks the
// presentation against a DENY-only board and the Kapae antigen. Nothing here folds an allow roster.

/** One act a presentation's lineage carries: a carriage act on the admit's relation, or a roll anchor. */
export type PresentedLineageAct = CarriageEntry | RollAnchor;

/** The act CID of a lineage act, whichever kind it is. */
export function presentedActCid(act: PresentedLineageAct): string {
  return isRollAnchor(act) ? rollAnchorCid(act) : carriageEntryActCid(act as CarriageEntry);
}

/**
 * The verdict on one presented admit:
 *   · `held`        — the admit counts, its lineage chains, and no counted denial closes it or stands concurrent.
 *   · `denied`      — a counted revoke descends from the admit, or the antigen holds a kapae on its nym.
 *   · `unsettled`   — a counted revoke stands concurrent with the admit (or its ancestry does not resolve
 *                     here), or the antigen's verdict on the nym is contradictory. Refuses: a contradiction
 *                     never grants.
 *   · `wrong-epoch` — the admit roots on an epoch that no counted chain of roll anchors carries to the
 *                     roster's head: an epoch off the charter lineage, a missing or uncounted anchor, or an
 *                     admit (or lineage act) outside an anchor's causal past — minted after its epoch rolled.
 *                     An admit at an ancestor epoch carries across the roll only when it stood in the board's
 *                     causal past at every roll since.
 *   · `rejected`    — no admit was presented, the presented act is not an admit, it does not count, or its
 *                     lineage does not chain.
 */
export type PresentedAdmitState = "held" | "denied" | "unsettled" | "wrong-epoch" | "rejected";

export interface PresentedAdmitVerdict {
  readonly state:  PresentedAdmitState;
  /** A named local reason; never a timestamp. */
  readonly reason: string;
  /** The presented admit's nym, lowercased; empty when no readable admit was presented. */
  readonly nym:    string;
}

export interface PresentedAdmitInput {
  /** The subject's own quorum-signed admit. REQUIRED: the verifier never looks an admit up anywhere. */
  readonly admit:           CarriageEntry;
  /**
   * The admit's causal lineage — every act the admit transitively cites, each a counted admit or revoke on
   * the same nym at the ADMIT's epoch, plus — when that epoch is an ancestor of the head — the roll anchors
   * that carry it there, one per roll. The acts must be CLOSED (every cited parent resolves inside them) and
   * TIGHT (every act is an ancestor of the admit). Order does not matter. A genesis admit at the head
   * presents an empty lineage.
   */
  readonly lineage:         readonly PresentedLineageAct[];
  /** The kahu quorum's seats at the charter head. */
  readonly roster:          KahuQuorumSeats;
  /**
   * The charter's epoch lineage, genesis first, its last epoch the roster's head. Read only for an admit at
   * an ancestor epoch: the anchors are walked against it by `prevEpochCid`. Absent → such an admit reads
   * `wrong-epoch`.
   */
  readonly sealLineage?:    readonly SealEpoch[];
  /** The shared deny board. Only counted `revoke` acts on the admit's nym are read; every other act is skipped. */
  readonly denyBoard:       Iterable<CarriageEntry>;
  /** The Kapae antigen entries. */
  readonly antigen:         Iterable<KapaeAntigenEntry>;
  /** The ANTIGEN quorum's roster — held apart from the membership roster. */
  readonly antigenRoster:   KahuQuorumSeats;
  /** The antigen quorum verifier — held apart from the membership quorum check. */
  readonly antigenVerifier: QuorumVerifier;
}

function presentedVerdict(state: PresentedAdmitState, reason: string, nym: string): PresentedAdmitVerdict {
  return { state, reason, nym };
}

/** The rosters a counted anchor chain resolves, keyed by epoch cid, and the anchors oldest-first. */
interface AnchoredChain {
  readonly rosters: ReadonlyMap<string, KahuQuorumSeats>;
  readonly anchors: readonly RollAnchor[];
}

/**
 * Walk the anchors from the head back to `admitEpoch` along the charter lineage. Each step: the anchor that
 * OPENS lineage[j] must name lineage[j-1] as the epoch it closes, count under lineage[j]'s roster, carry a
 * key-set that hashes to lineage[j-1]'s `keySetHash` (which becomes lineage[j-1]'s roster), and be cited by
 * the anchor that opens lineage[j+1]. Every presented anchor must sit on the walk. A string names the
 * wrong-epoch reason; a `{ rejected }` names a malformed presentation.
 */
async function resolveAnchoredChain(
  admitEpoch: string,
  head: KahuQuorumSeats,
  sealLineage: readonly SealEpoch[] | undefined,
  anchors: readonly RollAnchor[],
): Promise<AnchoredChain | string | { rejected: string }> {
  if (anchors.length === 0) return "admit-not-at-head-epoch";   // nothing presented carries it across a roll
  if (!sealLineage || sealLineage.length === 0 || !verifySealLineage(sealLineage)) return "no-charter-lineage";
  const last = sealLineage.length - 1;
  if (sealLineage[last]!.epochCid !== head.sealEpochCid) return "charter-lineage-not-at-roster-head";
  const at = sealLineage.findIndex((e) => e.epochCid === admitEpoch);
  if (at < 0) return "admit-epoch-not-an-ancestor";

  const opens = new Map<string, RollAnchor>();
  for (const anchor of anchors) {
    if (opens.has(anchor.sealEpochCid)) return { rejected: "lineage-duplicate-anchor" };
    opens.set(anchor.sealEpochCid, anchor);
  }

  const rosters = new Map<string, KahuQuorumSeats>([[head.sealEpochCid, head]]);
  const walked: RollAnchor[] = [];
  let opened = head;
  let later: RollAnchor | null = null;
  for (let j = last; j > at; j--) {
    const anchor = opens.get(sealLineage[j]!.epochCid);
    if (!anchor) return "anchor-missing";
    const closed = sealLineage[j - 1]!;
    if (anchor.prevEpochCid !== closed.epochCid) return "anchor-off-the-charter-lineage";
    if (!(await rollAnchorCounts(anchor, opened))) return "anchor-not-counted";
    if (sealKeySetHash(anchor.prevKeys, anchor.prevThreshold) !== closed.keySetHash) return "anchor-key-set-unbound";
    if (later && !later.parents.includes(rollAnchorCid(anchor))) return "anchor-chain-broken";
    opened = { keys: [...anchor.prevKeys], threshold: anchor.prevThreshold, sealEpochCid: closed.epochCid };
    rosters.set(closed.epochCid, opened);
    walked.unshift(anchor);
    later = anchor;
  }
  if (walked.length !== anchors.length) return { rejected: "lineage-unchained-anchor" };   // an anchor off the walk
  return { rosters, anchors: walked };
}

/**
 * Verify a PRESENTED admit against the deny board and the antigen. Pure and clockless: every ordering it
 * reads is causal lineage by CID, and every epoch it reads is a seal-epoch CID.
 *
 * Steps, each fail-closed:
 *   1. The presented act must be a readable `admit` (a `carry`, `revoke` or `uncarry` is `rejected`).
 *   2. The admit's epoch E resolves a roster. E = the head: the roster itself. E an ancestor: a chain of
 *      roll anchors E→…→head, each counted under the roster of the epoch it opens, walked against the
 *      charter lineage by `prevEpochCid`, each carrying the key-set its closed epoch's `keySetHash` binds,
 *      each cited by the next. No such chain → `wrong-epoch`.
 *   3. The admit must count under E's roster — the kahu quorum plus the operator's own accepts-carriage seal
 *      (else `rejected`).
 *   4. Every lineage act must name the same nym, sit in the member family, root on E (else `wrong-epoch`),
 *      and count; the acts must be closed and tight by CID (else `rejected`).
 *   5. Only counted `revoke` acts on the nym are read from the board, each counted under the roster of its
 *      own epoch on the chain (a revoke at any epoch E…head closes). Against the admit, each one is:
 *        · a DESCENDANT of the admit — it closes the admit → `denied`;
 *        · an ANCESTOR of the admit (the lineage covers it: re-admit after revoke) — superseded, no effect;
 *        · neither, or its ancestry does not resolve here — concurrent → `unsettled`.
 *   6. Every anchor on the chain must hold the admit in its causal past, read over the presented acts, the
 *      anchors and the counted revokes — an admit minted under E's keys after E rolled is in no anchor's
 *      past → `wrong-epoch`.
 *   7. The antigen folds through its OWN verifier and roster. A `held` kapae on the nym → `denied`; an
 *      `un_kapae` head lifts it; any contradictory or unresolvable antigen verdict → `unsettled`.
 *   `denied` outranks `unsettled`, which outranks `held`.
 *
 * The board stays deny-only: every anchor reaches this verifier inside the PRESENTATION, never read off a board.
 * The verifier checks the LEAF NYM only. A kapae closing carry may name either the admit's leaf nym or the
 * wire vessel key; matching the wire vessel key belongs to the gate, which holds that key.
 */
export async function verifyPresentedAdmit(input: PresentedAdmitInput): Promise<PresentedAdmitVerdict> {
  const { admit, roster } = input;
  if (admit === undefined || admit === null || typeof admit !== "object") {
    return presentedVerdict("rejected", "no-presented-admit", "");
  }
  if (!entryShapeIsReadable(admit)) return presentedVerdict("rejected", "malformed-admit", "");
  const nym = admit.nym.toLowerCase();
  if (admit.kind !== CARRIAGE_ENTRY_DOMAIN) return presentedVerdict("rejected", "wrong-entry-kind", nym);
  if (admit.action !== "admit") return presentedVerdict("rejected", `not-an-admit:${admit.action}`, nym);
  if (!Array.isArray(input.lineage)) return presentedVerdict("rejected", "malformed-lineage", nym);

  // Split the lineage: the relation's own acts, and the roll anchors that carry its epoch to the head.
  const acts: CarriageEntry[] = [];
  const anchors: RollAnchor[] = [];
  for (const act of input.lineage) {
    if (act !== null && typeof act === "object" && (act as { kind?: unknown }).kind === CARRIAGE_ROLL_ANCHOR_DOMAIN) {
      if (!isRollAnchor(act)) return presentedVerdict("rejected", "lineage-malformed-anchor", nym);
      anchors.push(act);
    } else {
      acts.push(act as CarriageEntry);
    }
  }

  // The admit's epoch resolves a roster: the head's own, or the one an anchor chain carries back to it.
  let rosters: ReadonlyMap<string, KahuQuorumSeats> = new Map([[roster.sealEpochCid, roster]]);
  let chain: readonly RollAnchor[] = [];
  if (admit.sealEpochCid !== roster.sealEpochCid) {
    const resolved = await resolveAnchoredChain(admit.sealEpochCid, roster, input.sealLineage, anchors);
    if (typeof resolved === "string") return presentedVerdict("wrong-epoch", resolved, nym);
    if ("rejected" in resolved) return presentedVerdict("rejected", resolved.rejected, nym);
    rosters = resolved.rosters;
    chain = resolved.anchors;
  } else if (anchors.length > 0) {
    return presentedVerdict("rejected", "lineage-unchained-anchor", nym);   // an admit at the head needs none
  }
  const admitRoster = rosters.get(admit.sealEpochCid)!;
  const admitCount = await countReason(admit, admitRoster);
  if (!admitCount.counted) return presentedVerdict("rejected", `admit-${admitCount.reason}`, nym);
  const admitCid = carriageEntryActCid(admit);

  // The lineage acts: every act counts on the same relation at the admit's epoch, and the set chains by CID.
  const graph = new Map<string, CarriageEntry>();
  for (const entry of acts) {
    if (entry === null || typeof entry !== "object" || !entryShapeIsReadable(entry)) {
      return presentedVerdict("rejected", "lineage-malformed-entry", nym);
    }
    if (entry.nym.toLowerCase() !== nym) return presentedVerdict("rejected", "lineage-foreign-nym", nym);
    if (relationFamily(entry.action) !== "member") return presentedVerdict("rejected", "lineage-foreign-family", nym);
    if (entry.sealEpochCid !== admit.sealEpochCid) return presentedVerdict("wrong-epoch", "lineage-not-at-admit-epoch", nym);
    const counted = await countReason(entry, admitRoster);
    if (!counted.counted) return presentedVerdict("rejected", `lineage-${counted.reason}`, nym);
    graph.set(carriageEntryActCid(entry), entry);
  }
  if (graph.has(admitCid)) return presentedVerdict("rejected", "lineage-contains-admit", nym);
  for (const node of [admit, ...graph.values()]) {
    if (node.parents.some((parent) => !graph.has(parent))) return presentedVerdict("rejected", "lineage-broken-chain", nym);
  }
  graph.set(admitCid, admit);
  for (const lineageCid of graph.keys()) {
    if (lineageCid !== admitCid && !isCarriageDescendant(admitCid, lineageCid, graph)) {
      return presentedVerdict("rejected", "lineage-unchained-entry", nym);
    }
  }

  // The deny board: counted revokes on this nym, each under the roster of its own epoch on the chain.
  const revokes: Array<{ cid: string; entry: CarriageEntry }> = [];
  for (const entry of input.denyBoard) {
    if (entry === null || typeof entry !== "object" || !entryShapeIsReadable(entry)) continue;
    if (entry.action !== "revoke" || entry.nym.toLowerCase() !== nym) continue;
    const at = rosters.get(entry.sealEpochCid);
    if (!at || !(await countReason(entry, at)).counted) continue;
    revokes.push({ cid: carriageEntryActCid(entry), entry });
  }
  const causal = new Map<string, { readonly parents: readonly string[] }>(graph);
  for (const r of revokes) if (!causal.has(r.cid)) causal.set(r.cid, r.entry);
  for (const anchor of chain) causal.set(rollAnchorCid(anchor), anchor);

  // Every anchor on the chain holds the admit in its causal past — so the lineage acts, its ancestors, too.
  for (const anchor of chain) {
    if (!isCarriageDescendant(rollAnchorCid(anchor), admitCid, causal)) {
      return presentedVerdict("wrong-epoch", "admit-not-in-anchor-past", nym);
    }
  }

  let closing = false;
  let concurrent = false;
  let covered = false;
  for (const r of revokes) {
    if (isCarriageDescendant(admitCid, r.cid, causal)) covered = true;
    else if (isCarriageDescendant(r.cid, admitCid, causal)) closing = true;
    else concurrent = true;
  }

  // The antigen: its own fold, its own verifier, its own roster.
  const antigenVerdicts = await foldAntigenVerdicts(input.antigen, input.antigenRoster, input.antigenVerifier);
  let kapaeHeld = false;
  let kapaeUnsettled = false;
  for (const [antigenNym, verdict] of antigenVerdicts) {
    if (antigenNym.toLowerCase() !== nym) continue;
    if (verdict === "held") kapaeHeld = true;
    else if (verdict !== "withdrawn") kapaeUnsettled = true;
  }

  if (kapaeHeld) return presentedVerdict("denied", "kapae-held", nym);
  if (closing) return presentedVerdict("denied", "revoke-descends-from-admit", nym);
  if (kapaeUnsettled) return presentedVerdict("unsettled", "kapae-unsettled", nym);
  if (concurrent) return presentedVerdict("unsettled", "revoke-concurrent-with-admit", nym);
  return presentedVerdict("held", covered ? "held-revoke-covered-by-lineage" : "held", nym);
}

/** What a dialer presents for one nym on one board: the admit head and its closed, tight lineage. */
export interface AdmitPresentation {
  readonly admit:   CarriageEntry;
  readonly lineage: readonly PresentedLineageAct[];
}

/**
 * A note the presenter surfaces while deriving a presentation. INFORMATIONAL — it never refuses and never
 * changes which admit presents.
 *
 *   · `anchors-open-one-epoch` — two or more counted roll anchors open the same epoch. A rotate retried over
 *     one commitment lands a second anchor for the same new head; the earlier one is an orphan. Both stand
 *     on the board, and the presenter walks each in turn.
 */
export interface PresentationFinding {
  readonly kind:       "anchors-open-one-epoch";
  readonly epochCid:   string;
  readonly anchorCids: readonly string[];
}

/** A board's presentation for one nym, and what the presenter noticed deriving it. */
export interface BoardPresentation {
  readonly presentation: AdmitPresentation | null;
  readonly findings:     readonly PresentationFinding[];
}

/**
 * Derive the presentation a subject carries to the wire from a carriage board it holds: the counted `admit`
 * that stands as a causal HEAD of `nym`'s member relation, plus every counted act that admit transitively
 * cites. The acts are CLOSED (every cited parent resolves inside them) and TIGHT (every act is an ancestor of
 * the admit). Pure and clockless.
 *
 * THE EPOCH IT READS. The head epoch first. When `nym`'s relation holds no counted act there, the walk steps
 * back one roll at a time through `anchors` (the board's roll anchors): an anchor that opens the epoch in hand
 * and counts under its roster names the epoch it closed and that epoch's key-set, which counts the acts there.
 * The first epoch holding a counted act for `nym` decides; an admit head found below the head epoch presents
 * with the anchors that carry it, one per roll.
 *
 * EVERY OPENING ANCHOR IS TRIED. When several anchors open one epoch, the walk tries each in act-CID order and
 * presents through the first whose chain holds the admit in every anchor's causal past — the reading the
 * verifier makes. An orphan anchor (an earlier attempt at the same roll) therefore never turns a carried admit
 * into `wrong-epoch`; the fork itself surfaces as a `PresentationFinding`. The presenter trusts nothing it
 * carries: the verifier re-walks the chain against the charter lineage.
 *
 * `presentation` is null when no counted admit stands as a head at the deciding epoch (a revoke supersedes the
 * last admit, or nothing was ever admitted), when the admit's ancestry does not resolve on this board, or when
 * no anchor chain carries it. A revoke standing CONCURRENT with the admit head does not stop the derivation:
 * the presentation still travels, and the verifier on the other side reads it `unsettled` against its own deny
 * board. Two concurrent admit heads present the one whose act CID sorts first.
 */
export async function readBoardPresentation(
  entries: Iterable<CarriageEntry>,
  nym: string,
  roster: KahuQuorumSeats,
  anchors: Iterable<RollAnchor> = [],
): Promise<BoardPresentation> {
  const want = nym.toLowerCase();
  const source = [...entries];
  const anchorList = [...anchors];
  const findings: PresentationFinding[] = [];
  const forked = new Set<string>();

  const walk = async (at: KahuQuorumSeats, carried: readonly RollAnchor[], path: ReadonlySet<string>): Promise<AdmitPresentation | null> => {
    const fold = await foldCarriageDetails(source, at);
    // The fold's details run in source order, one per entry — zip them to recover each counted act.
    const byCid = new Map<string, CarriageEntry>();
    fold.entries.forEach((detail, i) => {
      if (!detail.counted || detail.nym !== want || relationFamily(detail.action) !== "member") return;
      if (detail.sealEpochCid !== at.sealEpochCid) return;
      if (!byCid.has(detail.evidenceCid)) byCid.set(detail.evidenceCid, source[i]!);
    });
    if (byCid.size > 0) {
      const found = presentationAt(byCid, carried);
      return found && anchorsHoldAdmit(found, carried) ? found : null;
    }
    // No act for this nym at this epoch: step back through each anchor that opened it.
    const opening: RollAnchor[] = [];
    for (const anchor of anchorList) if (await rollAnchorCounts(anchor, at)) opening.push(anchor);
    opening.sort((a, b) => rollAnchorCid(a).localeCompare(rollAnchorCid(b)));
    if (opening.length > 1 && !forked.has(at.sealEpochCid)) {
      forked.add(at.sealEpochCid);
      findings.push({ kind: "anchors-open-one-epoch", epochCid: at.sealEpochCid, anchorCids: opening.map(rollAnchorCid) });
    }
    for (const step of opening) {
      if (path.has(step.prevEpochCid)) continue;   // a cycle through the anchors carries nothing
      const prior: KahuQuorumSeats = { keys: [...step.prevKeys], threshold: step.prevThreshold, sealEpochCid: step.prevEpochCid };
      const found = await walk(prior, [step, ...carried], new Set([...path, step.prevEpochCid]));
      if (found) return found;
    }
    return null;
  };

  const presentation = await walk(roster, [], new Set([roster.sealEpochCid]));
  return { presentation, findings };
}

/**
 * Derive the presentation for `nym` off a board's entries and anchors — `readBoardPresentation`'s
 * presentation alone, for a caller that reads no finding.
 */
export async function presentedAdmitFromBoard(
  entries: Iterable<CarriageEntry>,
  nym: string,
  roster: KahuQuorumSeats,
  anchors: Iterable<RollAnchor> = [],
): Promise<AdmitPresentation | null> {
  return (await readBoardPresentation(entries, nym, roster, anchors)).presentation;
}

/** Does every carried anchor hold the admit in its causal past, read over the presentation's own acts? */
function anchorsHoldAdmit(found: AdmitPresentation, carried: readonly RollAnchor[]): boolean {
  if (carried.length === 0) return true;
  const admitCid = carriageEntryActCid(found.admit);
  const causal = new Map<string, { readonly parents: readonly string[] }>();
  for (const act of found.lineage) causal.set(presentedActCid(act), act);
  causal.set(admitCid, found.admit);
  return carried.every((anchor) => isCarriageDescendant(rollAnchorCid(anchor), admitCid, causal));
}

/** The admit head among one epoch's counted acts for a nym, its closed lineage, and the carrying anchors. */
function presentationAt(byCid: ReadonlyMap<string, CarriageEntry>, carried: readonly RollAnchor[]): AdmitPresentation | null {
  const cited = new Set<string>();
  for (const entry of byCid.values()) for (const parent of entry.parents) cited.add(parent);
  const heads = [...byCid.entries()]
    .filter(([cid, entry]) => entry.action === "admit" && !cited.has(cid))
    .sort(([a], [b]) => a.localeCompare(b));
  const head = heads[0];
  if (!head) return null;
  const [, admit] = head;
  const lineage = new Map<string, CarriageEntry>();
  const todo = [...admit.parents];
  while (todo.length) {
    const cid = todo.pop()!;
    if (lineage.has(cid)) continue;
    const entry = byCid.get(cid);
    if (!entry) return null;   // an ancestor this board does not hold — no closed lineage to present
    lineage.set(cid, entry);
    todo.push(...entry.parents);
  }
  return { admit, lineage: [...lineage.values(), ...carried] };
}
