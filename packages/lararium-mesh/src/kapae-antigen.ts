/**
 * kapae-antigen — the Nexus immune system's ANTIGEN: a quorum-signed, monotone/additive set of
 * Kapae (ban) / un_kapae (lift) entries that rides the always-carried public planes. A Kapae'd
 * presenter draws Mu (never a denial — see ./mu-void); this module DECIDES who currently stands
 * Kapae'd, and it FAILS CLOSED at every shore.
 *
 * THE ANTIGEN IS QUORUM-SIGNED — or it becomes a censorship weapon. A lone node MUST NOT Kapae a
 * peer (an adversary would then ban a Nexus' legit users). A ban/lift is a THRESHOLD steward act:
 * ≥ k distinct founding-kahu signatures over the entry, rooted on the nexus-charter's epoch. The
 * verification rides an INJECTED shore (`QuorumVerifier`) so the real threshold-sign drops in via
 * dependency inversion; a MISSING verifier denies (`denyingQuorumVerifier`), never trusts.
 *
 * FAIL CLOSED, three ways: an entry whose quorum-signature does not verify is IGNORED (never
 * trusted); an entry rooting on an unknown charter head is IGNORED; a malformed semantic CID
 * is REJECTED; concurrent opposite causal heads remain UNSETTLED. A verified `un_kapae`
 * withdraws a ban only when it explicitly continues that ban's causal evidence.
 *
 * Platform-blind: rides ./crypto + @noble/ed25519 only. NO node: imports.
 * Meme: lar:///ha.ka.ba/lararium/mesh/carry-contract#/kapae-the-antigen
 */

import { KAPAE_ANTIGEN_DOMAIN } from "./domains.js";
import * as ed25519 from "@noble/ed25519";
import { hexToBytes, sha256HexBytesSync, canonicalJsonBytes } from "./crypto.js";

/** The domain a Kapae-antigen entry signs over — a signature is meaningless without its domain. */
export { KAPAE_ANTIGEN_DOMAIN } from "./domains.js";
/** A steward act on the antigen: raise a ban, or lift one. Acts advance by causal parents. */
export type KapaeAction = "kapae" | "un_kapae";

/** One founding-kahu signature over an antigen entry's canonical bytes. */
export interface QuorumSignature {
  /** The signing kahu's ed25519 verifying-key hex — MUST sit in the charter roster to count. */
  readonly signer: string;
  /** ed25519 signature over `antigenEntryBytes(entry)`, by the key in `signer`. */
  readonly sig:    string;
}

/**
 * One entry in the antigen set — a quorum-signed ban or lift of ONE presenter nym. The set is a
 * additive CRDT: entries only accrete, and the fold reads their locally held causal frontier.
 * The signatures ride OUTSIDE the semantic identity, so re-carrying an entry never re-signs it.
 */
export interface KapaeAntigenEntry {
  readonly kind:            typeof KAPAE_ANTIGEN_DOMAIN;
  /** The Kapae'd presenter's ed25519 verifying-key hex — the antigen target (an identity, never a doc). */
  readonly nym:             string;
  /** Raise (`kapae`) or lift (`un_kapae`) the ban on `nym`. */
  readonly action:          KapaeAction;
  /** Semantic content identity; signatures are outside this identity. */
  readonly actCid:          string;
  /** Causal parents in this nym + charter relation family. */
  readonly parents:         readonly string[];
  /** The nexus-charter epoch this quorum act roots on (the wax-stamp epoch-chain — SealEpoch.epochCid). */
  readonly sealEpochCid: string;
  /** ≥ threshold distinct-signer signatures — the quorum authority. */
  readonly signatures:      readonly QuorumSignature[];
}

/**
 * The founding-kahu roster the antigen signs against — the concrete keys + threshold for ONE charter
 * epoch. An UNBOUND roster (empty `keys`) can never meet a threshold ≥ 1, so it FAILS CLOSED: every
 * entry stays ignored until the operator seats the real founding keys (see ./nexus-seal-seed).
 */
export interface KahuRoster {
  /** The founding kahu ed25519 verifying-key hexes authorized to sign under this charter epoch. */
  readonly keys:            readonly string[];
  /** k — the number of DISTINCT roster signatures a valid quorum act carries (2-of-3 at founding). */
  readonly threshold:       number;
  /** The charter epoch this roster authorizes; an entry rooting elsewhere does not verify here. */
  readonly sealEpochCid: string;
}

/**
 * The canonical bytes an antigen entry signs over — everything but the signatures. Sorted-key stable.
 * Composes the shared quorum-entry image at the ANTIGEN domain; that domain keeps an antigen signature
 * un-presentable on the members board (`quorum-entry.ts`).
 */
export function antigenEntryBytes(entry: Omit<KapaeAntigenEntry, "signatures">): Uint8Array {
  const { actCid: _cid, signatures: _signatures, ...semantic } = entry as KapaeAntigenEntry;
  return canonicalJsonBytes({ ...semantic, parents: [...new Set(semantic.parents)].sort() });
}

export function antigenActCid(entry: Omit<KapaeAntigenEntry, "signatures" | "actCid">): string {
  return `sha256:${sha256HexBytesSync(antigenEntryBytes({ ...entry, actCid: "" }))}`;
}

/**
 * The quorum-verify SHORE — the injected door the real threshold-sign drops into. `verifyQuorum`
 * answers "does this entry carry a valid ≥ k quorum for this roster?". FAIL CLOSED: a null/missing
 * verifier denies at the call site; a verifier that cannot decide returns false. Never allow-all.
 */
export interface QuorumVerifier {
  verifyQuorum(entry: KapaeAntigenEntry, roster: KahuRoster): Promise<boolean> | boolean;
}

/**
 * The FAIL-CLOSED default — verifies nothing, so every antigen entry it screens is IGNORED. This is
 * the correct verifier when no real quorum-verify is wired: a missing verifier MUST deny, never
 * trust. Compose the live verifier explicitly; never default to allow.
 */
export const denyingQuorumVerifier: QuorumVerifier = {
  verifyQuorum: () => false,
};

/**
 * The simplest-correct concrete verifier — a k-of-n MULTI-SIGNATURE: an entry verifies iff it carries
 * ≥ `roster.threshold` DISTINCT roster signers, each with a valid ed25519 signature over the entry's
 * canonical bytes, AND the entry roots on the roster's charter epoch. This is a genuine quorum check
 * (not a real threshold-sig — that is the surfaced fork), and it is DENY-BY-DEFAULT: an unbound roster
 * (empty keys) or an entry citing another epoch verifies to false.
 *
 * Guards, each fail-closed:
 *   · a signer absent from the roster does not count (a stranger cannot pad a quorum),
 *   · a signer counted TWICE counts once (a replayed signature cannot pad a quorum),
 *   · a signature that does not verify over the entry bytes does not count (tamper-evident),
 *   · the entry's `sealEpochCid` MUST equal the roster's (an entry roots on ONE known charter epoch).
 */
export function makeMultiSigQuorumVerifier(): QuorumVerifier {
  return {
    async verifyQuorum(entry: KapaeAntigenEntry, roster: KahuRoster): Promise<boolean> {
      if (entry.kind !== KAPAE_ANTIGEN_DOMAIN)                 return false;
      if (roster.threshold < 1)                               return false;
      if (roster.keys.length < roster.threshold)              return false;   // unbound/short roster → deny
      if (entry.sealEpochCid !== roster.sealEpochCid)   return false;   // roots on an unknown epoch → deny

      const rosterKeys = new Set(roster.keys);
      const bytes      = antigenEntryBytes(entry);
      const counted    = new Set<string>();
      for (const s of entry.signatures) {
        if (counted.has(s.signer))    continue;   // a signer pads the quorum at most once
        if (!rosterKeys.has(s.signer)) continue;  // a non-roster signer never counts
        let ok = false;
        try { ok = await ed25519.verifyAsync(hexToBytes(s.sig), bytes, hexToBytes(s.signer)); }
        catch { ok = false; }                     // a malformed sig/key counts as no signature
        if (ok) counted.add(s.signer);
        if (counted.size >= roster.threshold) return true;
      }
      return false;
    },
  };
}

/**
 * Sign an antigen entry with ONE kahu key — collect ≥ threshold of these into an entry's `signatures`.
 * The module holds no key; the caller supplies each kahu's own signer (mirrors handle-card / wax-stamp).
 */
export async function signAntigenEntry(
  parts: Omit<KapaeAntigenEntry, "kind" | "signatures" | "actCid">,
  signers: ReadonlyArray<{ readonly signer: string; readonly sign: (bytes: Uint8Array) => Promise<string> }>,
): Promise<KapaeAntigenEntry> {
  const base = { ...parts, kind: KAPAE_ANTIGEN_DOMAIN, parents: [...new Set(parts.parents)].sort() } as Omit<KapaeAntigenEntry, "signatures" | "actCid">;
  const unsigned = { ...base, actCid: antigenActCid(base) } as Omit<KapaeAntigenEntry, "signatures">;
  const bytes = antigenEntryBytes(unsigned);
  const signatures: QuorumSignature[] = [];
  for (const s of signers) signatures.push({ signer: s.signer, sig: await s.sign(bytes) });
  return { ...unsigned, signatures };
}

/**
 * Fold the antigen entries into the locally held Kapae frontier. Only quorum-VERIFIED entries count —
 * an unverified entry is IGNORED, never trusted. A signed entry whose carried semantic CID does not
 * recompute is REJECTED before it can name a parent or head. A nym stands Kapae'd only when its
 * complete causal frontier holds one or more compatible `kapae` heads. Opposite concurrent heads
 * remain unsettled rather than allowing an implicit winner. Different authorized kahu roots can therefore
 * produce concurrent heads; a reader holding both must surface `unsettled`, never choose by arrival order.
 *
 * The result is a plain nym set — the enforcement shore (./federation-gate carryContractShareDecision)
 * reads it to deny a Kapae'd presenter with Mu.
 */
export type AntigenVerdict = "held" | "withdrawn" | "unsettled" | "unavailable" | "rejected";

export async function foldAntigenVerdicts(
  entries: Iterable<KapaeAntigenEntry>,
  roster: KahuRoster,
  verifier: QuorumVerifier,
): Promise<ReadonlyMap<string, AntigenVerdict>> {
  const grouped = new Map<string, KapaeAntigenEntry[]>();
  for (const entry of entries) {
    if (!(await verifier.verifyQuorum(entry, roster))) continue;   // unverified → ignored, never trusted
    (grouped.get(entry.nym) ?? (grouped.set(entry.nym, []), grouped.get(entry.nym)!)).push(entry);
  }
  const verdicts = new Map<string, AntigenVerdict>();
  for (const [nym, group] of grouped) {
    // `actCid` deliberately sits outside the signed byte image so signatures survive different
    // carriage representations. Recompute it before it participates in causal topology: otherwise
    // a holder could relabel a valid signed act and manufacture parents or hide a real head.
    if (group.some((entry) => entry.actCid !== antigenActCid(entry))) {
      verdicts.set(nym, "rejected");
      continue;
    }
    const ids = new Set(group.map((e) => e.actCid));
    const missing = group.some((e) => e.parents.some((p) => !ids.has(p)));
    if (missing) { verdicts.set(nym, "unavailable"); continue; }
    const covered = new Set(group.flatMap((e) => e.parents));
    const heads = group.filter((e) => !covered.has(e.actCid));
    if (heads.some((e) => e.action === "kapae") && heads.some((e) => e.action === "un_kapae")) verdicts.set(nym, "unsettled");
    else verdicts.set(nym, heads[0]?.action === "kapae" ? "held" : "withdrawn");
  }
  return verdicts;
}

export async function foldAntigenSet(
  entries: Iterable<KapaeAntigenEntry>, roster: KahuRoster, verifier: QuorumVerifier,
): Promise<ReadonlySet<string>> {
  const kapaed = new Set<string>();
  for (const [nym, verdict] of await foldAntigenVerdicts(entries, roster, verifier)) if (verdict === "held") kapaed.add(nym);
  return kapaed;
}

/** Does this presenter nym stand Kapae'd in the folded antigen set? */
export function isKapaed(nym: string, antigenSet: ReadonlySet<string>): boolean {
  return antigenSet.has(nym);
}
