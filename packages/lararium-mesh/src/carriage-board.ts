/**
 * carriage-board — the DOC face of the operator CARRIAGE-registry: extract `CarriageEntry`s out of the
 * always-carried carriage BOARD (a `LarDoc` under `carriageDocUrl`, deterministic-doc). The pure fold/verify
 * (carriage-registry `foldCarriageSet`) reads the entries this extractor surfaces; the
 * DeterministicFederationGate federates the board so every honest carrier holds the same entries — the
 * ALLOW-twin of the antigen board, sibling to it under the same nexus-pubkey (carriage{} ⊥ blocked{}).
 *
 * STORAGE CONVENTION (mirrors antigen-board): each carriage entry rides ONE tiddler whose `text` carries the
 * entry's JSON (`CarriageEntry`). The extractor walks every tiddler, parses its text, and keeps only the
 * ones that structurally coerce to an entry — a foreign / torn / non-carriage tiddler is SKIPPED, never
 * guessed. A seal roll's ANCHOR rides the same board under its own sub-namespace (`rollAnchorKey`) and reads
 * back through `rollAnchorsFromBoard` alone; the entry extractor skips it. Extraction is permissive on purpose: it never adjudicates trust (an entry it surfaces still faces
 * the kahu quorum + contract-in verify in `foldCarriageSet`, which IGNORES anything that does not count). So
 * a malformed or forged entry that slips through extraction costs nothing — it dies at the fold. FAIL CLOSED
 * end-to-end: an absent / empty board surfaces NO entries, the fold yields the empty carrier set, and NOBODY
 * reads carrier (the conservative floor: no registry → the seated-kahu union is all that remains).
 *
 * TRACK CONTRACTS, NEVER IDENTITIES: the tiddler carries the entry's operator-pubkey nym + charter epoch +
 * signatures ONLY. No human-identity field is read or written — the coercer would drop any it found, because
 * it copies the FLOOR fields alone.
 *
 * Platform-blind: rides ./base-doc (LarDoc) + ./carriage-registry types only. NO node: imports — the DISK /
 * repo resolution of the board handle lives in the node holder (nexus-carriage), which hands a read `LarDoc`.
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-operator-contract
 */

import type { LarDoc } from "./base-doc.js";
import { mutableLarRecord, tiddlerText } from "./base-doc.js";
import {
  CARRIAGE_ENTRY_DOMAIN,
  carriageEntryActCid,
  isRollAnchor,
  rollAnchorCid,
  readBoardPresentation,
  type BoardPresentation,
  type CarriageEntry,
  type CarriageAction,
  type RollAnchor,
} from "./carriage-registry.js";
import type { KahuQuorumSeats, QuorumSignature } from "./kapae-antigen.js";

/**
 * The tiddler-key prefix every carriage entry rides under — namespaced apart from the board's other content.
 * On the DreamNet plane (the always-carried members registry), not one lararium's `lares` API. Sibling to the
 * antigen's `ANTIGEN_ENTRY_PREFIX` — allow-twin to the deny-twin.
 */
export const CARRIAGE_ENTRY_PREFIX = "lar:///ha.ka.ba/dreamnet/carriage-registry/" as const;

/**
 * The tiddler key one carriage entry rides under — keyed by the semantic act CID, so every distinct
 * signed entry ACCRETES and NOTHING overwrites a standing entry. Concurrent branches therefore survive
 * storage and the causal fold, never the write, adjudicates.
 */
export function carriageEntryKey(entry: Pick<CarriageEntry, "kind" | "nym" | "action" | "parents" | "sealEpochCid">): string {
  return `${CARRIAGE_ENTRY_PREFIX}${carriageEntryActCid(entry)}`;
}

/**
 * Land a signed carriage entry onto a board draft — write it as a namespaced tiddler whose `text` carries the
 * entry JSON (the EXACT shape `carriageEntriesFromBoard` reads back). Call INSIDE a `handle.change()` callback.
 * The signatures + contract-sig ride inside the JSON, so re-carrying the tiddler never re-signs it; the fold's
 * quorum + contract-in verify decide trust, never this write. The stamp carries the entry's charter epoch —
 * provenance only, never the quorum authority.
 */
export function writeCarriageEntry(draft: LarDoc, entry: CarriageEntry): void {
  const key = carriageEntryKey(entry);
  draft.tiddlers[key] = mutableLarRecord(key, { text: JSON.stringify(entry) }, entry.sealEpochCid);
}

/** Coerce one signature-record, or null when a required field is missing / mis-typed (the whole sig drops). */
function coerceSignature(raw: unknown): QuorumSignature | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Record<string, unknown>;
  if (typeof s["signer"] !== "string" || typeof s["sig"] !== "string") return null;
  return { signer: s["signer"], sig: s["sig"] };
}

/** A parsed board payload reads a carriage entry only at the exact `CarriageEntry` FLOOR shape — else null. */
function coerceCarriageEntry(parsed: unknown): CarriageEntry | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (p["kind"] !== CARRIAGE_ENTRY_DOMAIN) return null;                    // not a carriage tiddler → skip
  if (typeof p["nym"] !== "string" || p["nym"].length === 0) return null;   // no member nym → skip
  const action = p["action"];
  if (action !== "admit" && action !== "revoke" && action !== "carry" && action !== "uncarry") return null; // unknown action → skip
  if (!Array.isArray(p["parents"]) || !p["parents"].every((parent) => typeof parent === "string" && /^[0-9a-f]{64}$/.test(parent))) return null;
  if (typeof p["sealEpochCid"] !== "string" || p["sealEpochCid"].length === 0) return null; // no epoch root → skip
  if (!Array.isArray(p["signatures"])) return null;                         // no quorum shape → skip
  const signatures: QuorumSignature[] = [];
  for (const raw of p["signatures"]) {
    const sig = coerceSignature(raw);
    if (sig === null) return null;   // a torn signature reads the whole entry closed (never a partial quorum)
    signatures.push(sig);
  }
  // The contract-in is OPTIONAL at the shape level (a revoke carries none); a torn contractSig reads the whole
  // entry closed rather than half-applied (an admit then simply fails the contract-in verify at the fold).
  let contractSig: QuorumSignature | undefined;
  if (p["contractSig"] !== undefined && p["contractSig"] !== null) {
    const cs = coerceSignature(p["contractSig"]);
    if (cs === null) return null;
    contractSig = cs;
  }
  // Copy the FLOOR fields ALONE — any extra field a forged tiddler smuggled in is dropped here, never carried
  // into the folded record (track contracts, never identities).
  const entry: CarriageEntry = {
    kind:            CARRIAGE_ENTRY_DOMAIN,
    nym:             p["nym"],
    action:          action as CarriageAction,
    parents:         p["parents"] as string[],
    sealEpochCid: p["sealEpochCid"],
    signatures,
  };
  return contractSig ? { ...entry, contractSig } : entry;
}

/**
 * Extract every well-formed carriage entry the board `LarDoc` carries. A torn / foreign / non-carriage
 * tiddler is skipped. An absent doc surfaces the empty list (fail-closed: no entries → no members). The caller
 * folds the result through `foldCarriageSet` (the kahu quorum + contract-in decide trust, not this reader).
 */
export function carriageEntriesFromBoard(doc: LarDoc | undefined | null): CarriageEntry[] {
  const tiddlers = doc?.tiddlers;
  if (!tiddlers) return [];
  const entries: CarriageEntry[] = [];
  for (const record of Object.values(tiddlers)) {
    const text = tiddlerText(record);
    if (text === null) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { continue; }   // a non-JSON tiddler is not a carriage entry
    const entry = coerceCarriageEntry(parsed);
    if (entry !== null) entries.push(entry);
  }
  return entries;
}

// ── roll anchors — the seal rolls the board records beside its acts ───────────────────────────────────

/** The tiddler key a roll anchor rides under — keyed by its act CID in its own sub-namespace, so an anchor
 *  accretes beside the carriage acts and never overwrites one. */
export function rollAnchorKey(anchor: RollAnchor): string {
  return `${CARRIAGE_ENTRY_PREFIX}roll/${rollAnchorCid(anchor)}`;
}

/**
 * Land a signed roll anchor onto a board draft, as a namespaced tiddler whose `text` carries the anchor JSON
 * (the shape `rollAnchorsFromBoard` reads back). Call INSIDE a `handle.change()` callback. The stamp carries
 * the epoch the anchor opens — provenance only.
 */
export function writeRollAnchor(draft: LarDoc, anchor: RollAnchor): void {
  const key = rollAnchorKey(anchor);
  draft.tiddlers[key] = mutableLarRecord(key, { text: JSON.stringify(anchor) }, anchor.sealEpochCid);
}

/**
 * Extract every well-formed roll anchor the board carries. Shape only, exactly as the entry extractor is: a
 * PRESENTER reads these to carry its admit across a roll (`presentedAdmitFromBoard`), and the verifier counts
 * the anchors a presentation carries. No gate reads an anchor off a board — the board stays deny-only.
 * Extra fields a forged tiddler smuggled in are dropped.
 */
export function rollAnchorsFromBoard(doc: LarDoc | undefined | null): RollAnchor[] {
  const tiddlers = doc?.tiddlers;
  if (!tiddlers) return [];
  const anchors: RollAnchor[] = [];
  for (const record of Object.values(tiddlers)) {
    const text = tiddlerText(record);
    if (text === null) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { continue; }
    if (!isRollAnchor(parsed)) continue;
    anchors.push({
      kind: parsed.kind, prevEpochCid: parsed.prevEpochCid, sealEpochCid: parsed.sealEpochCid,
      prevKeys: [...parsed.prevKeys], prevThreshold: parsed.prevThreshold, parents: [...parsed.parents],
      signatures: parsed.signatures.map((sig) => ({ signer: sig.signer, sig: sig.sig })),
    });
  }
  return anchors;
}

/**
 * THE ONE PRESENTER. Read a nym's presentation off ONE board doc: its carriage acts AND its roll anchors,
 * extracted together, so no caller can derive a presentation from the acts while forgetting the anchors that
 * carry an admit across a roll. Every door that presents — the dial, the bundle a contract writes, the raise a
 * recogniser signs — reads through here.
 */
export async function presentationFromBoardDoc(
  doc: LarDoc | undefined | null,
  nym: string,
  roster: KahuQuorumSeats,
): Promise<BoardPresentation> {
  return readBoardPresentation(carriageEntriesFromBoard(doc), nym, roster, rollAnchorsFromBoard(doc));
}
