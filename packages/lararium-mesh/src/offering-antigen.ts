/**
 * offering-antigen — the Lamplighters' half of the offering, and the quorum's.
 *
 * ── THE IMMUNE ARCHITECTURE, ENACTED ────────────────────────────────────────────────────────────
 * `lar:///ha.ka.ba/lararium/mesh/lamplighters` states it in three layers, and this holds all three:
 *   · INNATE — tenders patrol, notice, repair. "They hold no read-cap, no persona, and no verdict."
 *   · ADAPTIVE — a kahu quorum, "the only condemning body".
 *   · MEMORY — the antigen: a monotone, quorum-signed fold.
 *
 * PRESENTATION ⊥ CONDEMNATION, and the split is STRUCTURAL rather than a matter of care. A presentation
 * lands in its own record, under its own domain, and the fold that decides standing NEVER READS ONE.
 * "The quorum needs its full k, always. N tenders converging lowers nothing" — so a thousand honest
 * tenders move a verdict exactly as far as none, because the arithmetic has no term for them.
 *
 * That asymmetry buys the property the Union's resilience rests on: a captured Union holds no blocking
 * power, and the quorum retains the ability to SELF-PRESENT and condemn with no tender at all. Nothing
 * here makes a presentation necessary, and nothing should.
 *
 * ── A DIFFERENT BOARD FROM `kapae-antigen`, DELIBERATELY ────────────────────────────────────────
 * That board shadows a PRESENTER — an identity, a nym. This one shadows an OFFERING — a collection, a
 * region cid. The domains hold apart so a signature minted over one can never verify as the other, and
 * a hand that condemns a collection has said nothing whatever about the operator who offered it.
 *
 * ── READY, AND NOT YET CONSULTED ────────────────────────────────────────────────────────────────
 * Nothing calls this fold. The CLI reads the region and the daemon serves it; NO CALLER asks whether an
 * offering stands aside, so the law here stands READY rather than enforced. A Nexus opts in by consulting
 * it — that is the shape, and until one does, an auditor reading the offering path must not take a ready
 * function for a live one. `offering-antigen.test.ts` fails the moment a production caller appears and
 * names the cure: re-word this section as live enforcement and delete that test.
 *
 * ── ONE SCOPE, ITS OWN LINEAGE (the Offering Antigen scope ruling) ─────────────────────────────────
 * A quorum act names its SCOPE, the Nexus AID its charter's signed inception mints, beside `sealEpochCid`, the
 * epoch that authorized it; both enter the signed bytes. A receiver folds an act only after it reads that scope as
 * its own charter's, finds that epoch inside the lineage it holds, and counts the quorum of THAT epoch's seats. An
 * act under another scope stays foreign evidence outside the fold (the audit names it), so a neighbour's
 * condemnation copied onto this board reads as testimony, never as this Nexus's verdict. An epoch the receiver's
 * lineage lacks reads `unavailable`: the receiver cannot count a quorum it cannot see.
 *
 * ── NO ROSTER OF TENDERS ────────────────────────────────────────────────────────────────────────
 * A presentation names the DARK STRETCH (the offering) and its own presenter, and accrues nowhere. The
 * Union keeps "no central register of who tends what", so this module builds none: there is no list to
 * seize, and a reader that wanted one would have to construct it from records that were never gathered.
 */

import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { OFFERING_PRESENTATION_DOMAIN, OFFERING_KAPAE_DOMAIN } from "./domains.js";
import type { KahuQuorumSeats, QuorumSignature } from "./kapae-antigen.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { NEXUS_AID_PATTERN, epochSeats, verifySealLineage, type SealEpoch } from "./wax-stamp.js";

// ── THE INNATE LAYER: a tender presents ─────────────────────────────────────────────────────────

/** What a tender noticed about one offering. Carries no verdict and no weight. */
export interface OfferingPresentation {
  readonly kind:       typeof OFFERING_PRESENTATION_DOMAIN;
  /** The offering's declared region — the DARK STRETCH this names. */
  readonly pluginsCid: string;
  /** What the tender noticed, in its own words. Evidence for a reader, never an input to a threshold. */
  readonly noticed:    string;
  /** The presenting hand. Named so a reader may weigh it — never gathered into a roster. */
  readonly presenter:  string;
  readonly sig:        string;
}

export function offeringPresentationBytes(parts: Omit<OfferingPresentation, "kind" | "sig">): Uint8Array {
  return canonicalJsonBytes({
    kind: OFFERING_PRESENTATION_DOMAIN, pluginsCid: parts.pluginsCid, noticed: parts.noticed, presenter: parts.presenter,
  });
}

/** Mint a presentation. Any hand may present; presenting confers nothing. */
export async function presentOffering(
  parts: Omit<OfferingPresentation, "kind" | "sig">,
  sign:  (bytes: Uint8Array) => Promise<string>,
): Promise<OfferingPresentation> {
  const sig = await sign(offeringPresentationBytes(parts));
  return { kind: OFFERING_PRESENTATION_DOMAIN, ...parts, sig };
}

export type PresentationVerdict = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * Verify a presentation SPOKE — that this presenter wrote these words about this offering.
 *
 * It answers authorship and nothing else. A verified presentation still carries no weight; a reader may
 * follow it to the offering and check the hash themselves, which is the only thing that settles anything.
 */
export async function verifyOfferingPresentation(p: OfferingPresentation): Promise<PresentationVerdict> {
  if (p?.kind !== OFFERING_PRESENTATION_DOMAIN) return { ok: false, reason: "not an offering presentation" };
  try {
    const ok = verifyEd25519(p.sig, offeringPresentationBytes(p), p.presenter);
    return ok ? { ok: true } : { ok: false, reason: "the presenter's signature does not verify" };
  } catch { return { ok: false, reason: "a malformed signature or presenter key" }; }
}

// ── THE ADAPTIVE LAYER: only a quorum condemns ──────────────────────────────────────────────────

export type OfferingKapaeAction = "kapae" | "un_kapae";

/** A quorum act over ONE offering. Same shape the presenter-antigen carries, its own domain and subject. */
export interface OfferingKapaeEntry {
  readonly kind:         typeof OFFERING_KAPAE_DOMAIN;
  /** The Nexus whose quorum acts: the AID its charter's signed inception mints. */
  readonly scope:        string;
  /** The offering's region cid — a COLLECTION, never an identity. */
  readonly pluginsCid:   string;
  readonly action:       OfferingKapaeAction;
  /** Semantic act identity, derived from the unsigned causal content. */
  readonly actCid:       string;
  /** Canonical causal parents in this offering + charter relation family. */
  readonly parents:      readonly string[];
  /** The epoch whose seats authorized the act, inside the scope's lineage. */
  readonly sealEpochCid: string;
  readonly signatures:   readonly QuorumSignature[];
}

/**
 * What a receiver folds with: its own charter's scope, and the seats of each epoch of the lineage it holds. A
 * receiver builds it from its charter (`offeringReaderOfLineage`); an epoch it cannot read answers null.
 */
export interface OfferingReader {
  readonly scope:   string;
  readonly seatsAt: (sealEpochCid: string) => KahuQuorumSeats | null;
}

/**
 * The reader a VERIFIED charter lineage names: its genesis AID as the scope, and each epoch's own seats. A lineage
 * that fails the roll law reads every epoch as unseen, so nothing folds against it.
 */
export function offeringReaderOfLineage(lineage: readonly SealEpoch[]): OfferingReader {
  const scope = lineage[0]?.epochCid ?? "";
  if (lineage.length === 0 || !verifySealLineage(lineage)) return { scope, seatsAt: () => null };
  const byCid = new Map(lineage.map((e) => [e.epochCid, e] as const));
  return {
    scope,
    seatsAt: (cid) => {
      const epoch = byCid.get(cid);
      const seats = epoch ? epochSeats(epoch) : null;
      return seats ? { keys: [...seats.keys], threshold: seats.threshold, sealEpochCid: cid } : null;
    },
  };
}

export function offeringKapaeBytes(parts: Omit<OfferingKapaeEntry, "kind" | "signatures">): Uint8Array {
  const parents = [...new Set(parts.parents)].sort();
  return canonicalJsonBytes({
    kind: OFFERING_KAPAE_DOMAIN, scope: parts.scope, pluginsCid: parts.pluginsCid, action: parts.action,
    actCid: parts.actCid, parents, sealEpochCid: parts.sealEpochCid,
  });
}

/** The act preimage leaves actCid blank; signatures sit outside semantic identity. */
export function offeringKapaeActCid(
  parts: Omit<OfferingKapaeEntry, "kind" | "signatures" | "actCid">,
): string {
  return `sha256:${sha256HexBytesSync(offeringKapaeBytes({ ...parts, actCid: "" }))}`;
}

function canonicalParents(parents: readonly string[]): string[] {
  return [...new Set(parents)].sort();
}

function isCanonicalParents(parents: readonly string[]): boolean {
  return parents.every((p, i) => typeof p === "string" && p.length > 0 && parents.indexOf(p) === i &&
    (i === 0 || parents[i - 1]! < p));
}

/** Gather k signatures over one act. Each hand signs the SAME bytes — a quorum, never a chain. */
export async function signOfferingKapae(
  parts: Omit<OfferingKapaeEntry, "kind" | "signatures" | "actCid"> & { readonly parents: readonly string[] },
  hands: readonly { readonly signer: string; readonly sign: (b: Uint8Array) => Promise<string> }[],
): Promise<OfferingKapaeEntry> {
  const parents = canonicalParents(parts.parents);
  const actCid = offeringKapaeActCid({ ...parts, parents });
  if (parents.includes(actCid)) throw new Error("offering-kapae: an act cannot parent itself");
  const semantic = { ...parts, parents, actCid };
  const bytes = offeringKapaeBytes(semantic);
  const signatures = await Promise.all(hands.map(async (h) => ({ signer: h.signer, sig: await h.sign(bytes) })));
  return { kind: OFFERING_KAPAE_DOMAIN, ...semantic, signatures };
}

export type OfferingAntigenVerdict = "held" | "withdrawn" | "unsettled" | "unavailable" | "rejected";

/** Audit-only record. Rejected wire candidates are observable here, but never become authority. */
export interface OfferingAntigenAudit {
  readonly verdict: OfferingAntigenVerdict | null;
  readonly rejectedActCids: readonly string[];
  /** Acts signed under another Nexus's scope: kept as evidence, never folded. */
  readonly foreignActCids?: readonly string[];
  readonly diagnostics?: readonly string[];
}

export interface OfferingKapaeDiagnostic {
  readonly pluginsCid?: string;
  readonly actCid?: string;
  readonly reason: string;
}

/** Normalize hostile board-shaped input before any causal or quorum field is read. */
export function normalizeOfferingKapaeEntry(raw: unknown): {
  readonly entry: OfferingKapaeEntry | null;
  readonly diagnostic?: OfferingKapaeDiagnostic;
} {
  if (typeof raw !== "object" || raw === null) return { entry: null, diagnostic: { reason: "entry is not an object" } };
  const p = raw as Record<string, unknown>;
  const pluginsCid = typeof p["pluginsCid"] === "string" && p["pluginsCid"].length > 0 ? p["pluginsCid"] : undefined;
  const actCid = typeof p["actCid"] === "string" && p["actCid"].length > 0 ? p["actCid"] : undefined;
  const fail = (reason: string) => ({ entry: null, diagnostic: { ...(pluginsCid ? { pluginsCid } : {}), ...(actCid ? { actCid } : {}), reason } });
  if (p["kind"] !== OFFERING_KAPAE_DOMAIN) return fail("wrong offering-kapae domain");
  if (typeof p["scope"] !== "string" || !NEXUS_AID_PATTERN.test(p["scope"])) return fail("invalid scope");
  if (!pluginsCid) return fail("missing pluginsCid");
  if (p["action"] !== "kapae" && p["action"] !== "un_kapae") return fail("invalid action");
  if (!actCid) return fail("missing actCid");
  if (!Array.isArray(p["parents"]) || p["parents"].some((parent) => typeof parent !== "string" || parent.length === 0)) return fail("invalid parents");
  if (typeof p["sealEpochCid"] !== "string" || p["sealEpochCid"].length === 0) return fail("invalid sealEpochCid");
  if (!Array.isArray(p["signatures"])) return fail("invalid signatures");
  for (const signature of p["signatures"]) {
    if (typeof signature !== "object" || signature === null || typeof (signature as Record<string, unknown>)["signer"] !== "string" || typeof (signature as Record<string, unknown>)["sig"] !== "string") {
      return fail("invalid signature record");
    }
  }
  return { entry: p as unknown as OfferingKapaeEntry };
}

/**
 * Fold the VERIFIED quorum acts into the set of offerings standing aside.
 *
 * The parameter list carries no presentations, and that absence IS the law — a fold that accepted them
 * could be argued into weighting them later, and the whole architecture rests on it never doing so.
 *
 * The local causal fold admits one settled head, compatible concurrent heads, or no verdict. A missing
 * ancestor is unavailable, and contradictory admissible heads remain unsettled; arrival order never chooses.
 */
export async function foldOfferingAntigenVerdicts(
  entries: readonly OfferingKapaeEntry[],
  reader:  OfferingReader,
): Promise<ReadonlyMap<string, OfferingAntigenVerdict>> {
  const grouped = new Map<string, OfferingKapaeEntry[]>();
  const unseen = new Set<string>();
  for (const e of entries) {
    const normalized = normalizeOfferingKapaeEntry(e).entry;
    // Another Nexus's act stays foreign evidence: it never enters this scope's fold.
    if (!normalized || normalized.scope !== reader.scope) continue;
    // An epoch this lineage lacks: the receiver cannot count that quorum, so the offering reads unavailable.
    if (reader.seatsAt(normalized.sealEpochCid) === null) { unseen.add(normalized.pluginsCid); continue; }
    (grouped.get(normalized.pluginsCid) ?? (grouped.set(normalized.pluginsCid, []), grouped.get(normalized.pluginsCid)!)).push(normalized);
  }
  const validOwners = new Map<string, string>();
  const verifiedGroups = new Map<string, OfferingKapaeEntry[]>();
  for (const [pluginsCid, group] of grouped) {
    const verified: OfferingKapaeEntry[] = [];
    for (const entry of group) {
      const canonical = isCanonicalParents(entry.parents);
      const identity = canonical && entry.actCid === offeringKapaeActCid({
        scope: entry.scope, pluginsCid: entry.pluginsCid, action: entry.action, parents: entry.parents, sealEpochCid: entry.sealEpochCid,
      });
      if (identity && await verifyOfferingQuorum(entry, reader.seatsAt(entry.sealEpochCid))) {
        verified.push(entry);
        validOwners.set(entry.actCid, pluginsCid);
      }
    }
    if (verified.length > 0) verifiedGroups.set(pluginsCid, verified);
  }
  const verdicts = new Map<string, OfferingAntigenVerdict>();
  for (const [pluginsCid, verified] of verifiedGroups) {
    const scoped = verified.filter((e) => !e.parents.some((p) => validOwners.has(p) && validOwners.get(p) !== pluginsCid));
    if (scoped.length === 0) continue;
    const ids = new Set(scoped.map((e) => e.actCid));
    let admissible = [...scoped];
    let changed = true;
    while (changed) {
      changed = false;
      const next = admissible.filter((e) => e.parents.every((p) => ids.has(p)));
      if (next.length !== admissible.length) changed = true;
      admissible = next;
    }
    if (admissible.length !== scoped.length) { verdicts.set(pluginsCid, "unavailable"); continue; }
    const covered = new Set(admissible.flatMap((e) => e.parents));
    const heads = admissible.filter((e) => !covered.has(e.actCid));
    const actions = new Set(heads.map((e) => e.action));
    if (actions.has("kapae") && actions.has("un_kapae")) verdicts.set(pluginsCid, "unsettled");
    else if (heads.some((e) => e.action === "kapae")) verdicts.set(pluginsCid, "held");
    else if (heads.some((e) => e.action === "un_kapae")) verdicts.set(pluginsCid, "withdrawn");
    else verdicts.set(pluginsCid, "unavailable");
  }
  for (const pluginsCid of unseen) verdicts.set(pluginsCid, "unavailable");
  return verdicts;
}

/**
 * Audit the same local offering fold. Invalid or unverified wire candidates are reported by act CID, while
 * the authority verdict is computed from admissible acts only. A raw Crossroads record can therefore never
 * manufacture a denial by sharing a pluginsCid; a receiving take path consumes `verdict`, while tooling may
 * surface `rejectedActCids` to an operator.
 */
export async function auditOfferingAntigen(
  entries: readonly OfferingKapaeEntry[], reader: OfferingReader,
): Promise<ReadonlyMap<string, OfferingAntigenAudit>> {
  const verdicts = await foldOfferingAntigenVerdicts(entries, reader);
  const grouped = new Map<string, string[]>();
  const foreign = new Map<string, string[]>();
  const diagnostics = new Map<string, string[]>();
  const owners = new Map<string, string>();
  for (const entry of entries) {
    const normalized = normalizeOfferingKapaeEntry(entry);
    if (!normalized.entry) {
      const d = normalized.diagnostic;
      if (d?.pluginsCid) {
        const reasons = diagnostics.get(d.pluginsCid) ?? [];
        reasons.push(d.reason);
        diagnostics.set(d.pluginsCid, reasons);
        if (d.actCid) (grouped.get(d.pluginsCid) ?? (grouped.set(d.pluginsCid, []), grouped.get(d.pluginsCid)!)).push(d.actCid);
      }
      continue;
    }
    const entryValue = normalized.entry;
    if (entryValue.scope !== reader.scope) {
      (foreign.get(entryValue.pluginsCid) ?? (foreign.set(entryValue.pluginsCid, []), foreign.get(entryValue.pluginsCid)!)).push(entryValue.actCid);
      continue;
    }
    if (reader.seatsAt(entryValue.sealEpochCid) === null) continue;   // unseen: the verdict reads unavailable
    const identity = isCanonicalParents(entryValue.parents) && entryValue.actCid === offeringKapaeActCid({
      scope: entryValue.scope, pluginsCid: entryValue.pluginsCid, action: entryValue.action, parents: entryValue.parents, sealEpochCid: entryValue.sealEpochCid,
    });
    if (!identity || !(await verifyOfferingQuorum(entryValue, reader.seatsAt(entryValue.sealEpochCid)))) {
      (grouped.get(entryValue.pluginsCid) ?? (grouped.set(entryValue.pluginsCid, []), grouped.get(entryValue.pluginsCid)!)).push(entryValue.actCid);
    } else owners.set(entryValue.actCid, entryValue.pluginsCid);
  }
  for (const entry of entries) {
    const entryValue = normalizeOfferingKapaeEntry(entry).entry;
    if (!entryValue || !owners.has(entryValue.actCid)) continue;
    if (entryValue.parents.some((parent) => owners.has(parent) && owners.get(parent) !== entryValue.pluginsCid)) {
      const rejected = grouped.get(entryValue.pluginsCid) ?? [];
      if (!rejected.includes(entryValue.actCid)) rejected.push(entryValue.actCid);
      grouped.set(entryValue.pluginsCid, rejected);
    }
  }
  const out = new Map<string, OfferingAntigenAudit>();
  for (const [pluginsCid, rejectedActCids] of grouped) {
    out.set(pluginsCid, { verdict: verdicts.get(pluginsCid) ?? null, rejectedActCids, ...(diagnostics.has(pluginsCid) ? { diagnostics: diagnostics.get(pluginsCid)! } : {}) });
  }
  for (const [pluginsCid, reasons] of diagnostics) {
    if (!out.has(pluginsCid)) out.set(pluginsCid, { verdict: verdicts.get(pluginsCid) ?? null, rejectedActCids: [], diagnostics: reasons });
  }
  for (const [pluginsCid, verdict] of verdicts) {
    if (!out.has(pluginsCid)) out.set(pluginsCid, { verdict, rejectedActCids: [] });
  }
  for (const [pluginsCid, actCids] of foreign) {
    const standing = out.get(pluginsCid);
    out.set(pluginsCid, { ...(standing ?? { verdict: verdicts.get(pluginsCid) ?? null, rejectedActCids: [] }), foreignActCids: actCids });
  }
  return out;
}

export async function foldOfferingAntigen(
  entries: readonly OfferingKapaeEntry[], reader: OfferingReader,
): Promise<Set<string>> {
  const aside = new Set<string>();
  for (const [pluginsCid, verdict] of await foldOfferingAntigenVerdicts(entries, reader)) {
    if (verdict === "held") aside.add(pluginsCid);
  }
  return aside;
}

/**
 * The quorum check over an OFFERING act's own bytes.
 *
 * THE SHARED VERIFIER CANNOT BE CALLED HERE, and reaching for it would be theatre: it folds over the
 * presenter-antigen's preimage and refuses any other `kind` outright, so a call would return false on
 * every entry and the real work would happen in a fallback pretending to be a backstop. The domains
 * differ on purpose — that separation is the feature — so what travels is the GUARD SET, restated over
 * this subject: fail-closed on a short or unbound roster, a foreign epoch, a stranger's signature, or a
 * signer counted twice. Each of those has its own CONTROL in `offering-antigen.test.ts`.
 */
async function verifyOfferingQuorum(entry: OfferingKapaeEntry, roster: KahuQuorumSeats | null): Promise<boolean> {
  if (roster === null)                             return false;   // an epoch outside the lineage → deny
  if (roster.threshold < 1)                        return false;
  if (roster.keys.length < roster.threshold)       return false;   // unbound/short roster → deny
  if (entry.sealEpochCid !== roster.sealEpochCid)  return false;   // roots on an unknown epoch → deny
  if (!isCanonicalParents(entry.parents)) return false;
  if (entry.actCid !== offeringKapaeActCid({
    scope: entry.scope, pluginsCid: entry.pluginsCid, action: entry.action, parents: entry.parents, sealEpochCid: entry.sealEpochCid,
  })) return false;

  const rosterKeys = new Set(roster.keys);
  const bytes      = offeringKapaeBytes(entry);
  const counted    = new Set<string>();
  for (const s of entry.signatures) {
    if (counted.has(s.signer))     continue;   // a signer pads the quorum at most once
    if (!rosterKeys.has(s.signer)) continue;   // a stranger never counts
    let ok = false;
    try { ok = verifyEd25519(s.sig, bytes, s.signer); }
    catch { ok = false; }
    if (ok) counted.add(s.signer);
  }
  return counted.size >= roster.threshold;
}

/** Does this offering stand aside in the folded set? */
export async function offeringStandsAside(pluginsCid: string, aside: ReadonlySet<string>): Promise<boolean> {
  return aside.has(pluginsCid);
}
