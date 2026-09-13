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
 * ── NO ROSTER OF TENDERS ────────────────────────────────────────────────────────────────────────
 * A presentation names the DARK STRETCH (the offering) and its own presenter, and accrues nowhere. The
 * Union keeps "no central register of who tends what", so this module builds none: there is no list to
 * seize, and a reader that wanted one would have to construct it from records that were never gathered.
 */

import * as ed25519 from "@noble/ed25519";
import { canonicalJsonBytes, hexToBytes } from "./crypto.js";
import { OFFERING_PRESENTATION_DOMAIN, OFFERING_KAPAE_DOMAIN } from "./domains.js";
import type { KahuRoster, QuorumSignature } from "./kapae-antigen.js";

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
    const ok = await ed25519.verifyAsync(hexToBytes(p.sig), offeringPresentationBytes(p), hexToBytes(p.presenter));
    return ok ? { ok: true } : { ok: false, reason: "the presenter's signature does not verify" };
  } catch { return { ok: false, reason: "a malformed signature or presenter key" }; }
}

// ── THE ADAPTIVE LAYER: only a quorum condemns ──────────────────────────────────────────────────

export type OfferingKapaeAction = "kapae" | "un_kapae";

/** A quorum act over ONE offering. Same shape the presenter-antigen carries, its own domain and subject. */
export interface OfferingKapaeEntry {
  readonly kind:         typeof OFFERING_KAPAE_DOMAIN;
  /** The offering's region cid — a COLLECTION, never an identity. */
  readonly pluginsCid:   string;
  readonly action:       OfferingKapaeAction;
  /** Monotone per offering: a later act supersedes an earlier one; a stale entry cannot roll it back. */
  readonly version:      number;
  readonly sealEpochCid: string;
  readonly signatures:   readonly QuorumSignature[];
}

export function offeringKapaeBytes(parts: Omit<OfferingKapaeEntry, "kind" | "signatures">): Uint8Array {
  return canonicalJsonBytes({
    kind: OFFERING_KAPAE_DOMAIN, pluginsCid: parts.pluginsCid, action: parts.action,
    version: parts.version, sealEpochCid: parts.sealEpochCid,
  });
}

/** Gather k signatures over one act. Each hand signs the SAME bytes — a quorum, never a chain. */
export async function signOfferingKapae(
  parts: Omit<OfferingKapaeEntry, "kind" | "signatures">,
  hands: readonly { readonly signer: string; readonly sign: (b: Uint8Array) => Promise<string> }[],
): Promise<OfferingKapaeEntry> {
  const bytes = offeringKapaeBytes(parts);
  const signatures = await Promise.all(hands.map(async (h) => ({ signer: h.signer, sig: await h.sign(bytes) })));
  return { kind: OFFERING_KAPAE_DOMAIN, ...parts, signatures };
}

/**
 * Fold the VERIFIED quorum acts into the set of offerings standing aside.
 *
 * The parameter list carries no presentations, and that absence IS the law — a fold that accepted them
 * could be argued into weighting them later, and the whole architecture rests on it never doing so.
 *
 * Highest version per offering wins. A TIE LEAVES IT ASIDE, mirroring the presenter board's remove-wins
 * guarantee: under partition two peers may disagree, and the safer reading holds.
 */
export async function foldOfferingAntigen(
  entries: readonly OfferingKapaeEntry[],
  roster:  KahuRoster,
): Promise<Set<string>> {
  const best = new Map<string, OfferingKapaeEntry>();
  for (const e of entries) {
    if (e?.kind !== OFFERING_KAPAE_DOMAIN) continue;
    if (!(await verifyOfferingQuorum(e, roster))) continue;
    const prior = best.get(e.pluginsCid);
    if (!prior || e.version > prior.version || (e.version === prior.version && e.action === "kapae")) {
      best.set(e.pluginsCid, e);
    }
  }
  const aside = new Set<string>();
  for (const [cid, e] of best) if (e.action === "kapae") aside.add(cid);
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
async function verifyOfferingQuorum(entry: OfferingKapaeEntry, roster: KahuRoster): Promise<boolean> {
  if (roster.threshold < 1)                        return false;
  if (roster.keys.length < roster.threshold)       return false;   // unbound/short roster → deny
  if (entry.sealEpochCid !== roster.sealEpochCid)  return false;   // roots on an unknown epoch → deny

  const rosterKeys = new Set(roster.keys);
  const bytes      = offeringKapaeBytes(entry);
  const counted    = new Set<string>();
  for (const s of entry.signatures) {
    if (counted.has(s.signer))     continue;   // a signer pads the quorum at most once
    if (!rosterKeys.has(s.signer)) continue;   // a stranger never counts
    let ok = false;
    try { ok = await ed25519.verifyAsync(hexToBytes(s.sig), bytes, hexToBytes(s.signer)); }
    catch { ok = false; }
    if (ok) counted.add(s.signer);
  }
  return counted.size >= roster.threshold;
}

/** Does this offering stand aside in the folded set? */
export async function offeringStandsAside(pluginsCid: string, aside: ReadonlySet<string>): Promise<boolean> {
  return aside.has(pluginsCid);
}
