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
  foldCarriageDetails,
  isCarriageDescendant,
  presentedActCid,
  relationFamily,
  rollAnchorCounts,
  type AdmitPresentation,
  type BoardPresentation,
  type PresentationFinding,
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
 * PRESENTER reads these to carry its admit across a roll (`presentationFromBoardDoc`), and the verifier counts
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

/**
 * The walk under the one presenter. Derive the presentation a subject carries to the wire from a carriage board it holds: the counted `admit`
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
async function readBoardPresentation(
  entries: Iterable<CarriageEntry>,
  nym: string,
  roster: KahuQuorumSeats,
  anchors: readonly RollAnchor[],
): Promise<BoardPresentation> {
  const want = nym.toLowerCase();
  const source = [...entries];
  const anchorList = anchors;
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

