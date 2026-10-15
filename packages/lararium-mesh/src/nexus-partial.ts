/**
 * nexus-partial — a Nexus quorum act that crosses between vaults before its threshold meets: admit, revoke,
 * kapae and the roll anchor (kapae#/edge-hands, kahu#/nexus-scale).
 *
 * A two-seat Nexus holds its seats in two vaults, so no vault signs a quorum act whole. One seat signs, the act
 * crosses as a PARTIAL file, and the other seat cosigns. Each act keeps its OWN canonical image and its own
 * signing domain: an admit and a revoke ride the carriage entry, a kapae rides the antigen entry, and a roll
 * anchor rides the anchor. None casts into another, and none casts into an edge act. The verdicts come from the
 * edge door (`PartialVerdict`), so one vocabulary reads every partial in the house.
 *
 * ── A PARTIAL CARRIES THE WHOLE ACT, AND A SUBJECT A PERSON CAN READ ──────────────────────────────────
 * The act entire, with every signature gathered so far, the Nexus AID it lands under, and the subject in plain
 * keys: the nym an admit, a revoke or a kapae names, or the two epochs a roll anchor joins. The reader refuses
 * a partial whose subject and act disagree.
 *
 * ── WHAT A COSIGNER JUDGES, WITH NO CLOCK ───────────────────────────────────────────────────────────────
 *   · `invalid`     — a torn shape; another Nexus; an admit whose operator never consented; an anchor whose
 *                     closed seats differ from the closed roster; no signature from a seat of the head roster.
 *   · `replay`      — the act already counts on this vessel's board (an uncounted copy of its id blocks nothing).
 *   · `stale`       — the act names an epoch other than the head's, or cites parents other than the heads its
 *                     line holds on this vessel's board (for an anchor, other than the closing epoch's heads).
 *   · `unavailable` — the act cites a parent this vessel cannot count, or an anchor arrives where this vessel
 *                     holds no closed roster to read it against.
 *   · `ready` / `complete` — short of the threshold, or at it.
 * Causal position decides each one: the head epoch, the line's own heads, the board's own count.
 *
 * ── A JUDGE RUNS BEFORE EVERY SIGNATURE ─────────────────────────────────────────────────────────────────
 * `cosignNexusActPartial` judges first and calls no signer unless the partial reads `ready`, and only seats of
 * the head roster that have not signed may add. A stale head, a missing parent, a replay or a wrong subject
 * writes no second signature.
 *
 * CALLERS. Each family rides a two-vault door that passes the file across vaults, judges before every signature
 * and judges again right before the write: admit and revoke ride `runNexusContractOpen` / `runNexusContractPartial`,
 * the roll anchor rides `runNexusRollAnchorOpen` / `runNexusRollAnchorPartial` (all in
 * `packages/lararium-node/src/commands/nexus-contract.ts`), and kapae rides `runNexusKapaeOpen` /
 * `runNexusKapaePartial` (`packages/lararium-node/src/commands/nexus-kapae.ts`).
 *
 * Pure: no I/O, no clock. Platform-blind.
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/edge-hands
 */
import {
  CARRIAGE_ENTRY_DOMAIN, CARRIAGE_ROLL_ANCHOR_DOMAIN, carriageEntryActCid, carriageEntryBytes, carriageEntryCounts,
  admitCarriageCommit, readAdmitOpening, rollAnchorBytes, rollAnchorCid, rollAnchorCounts, rollAnchorParents, verifyCarriageConsent,
  type AdmitOpening, type CarriageEntry, type RollAnchor,
} from "./carriage-registry.js";
import {
  KAPAE_ANTIGEN_DOMAIN, antigenActCid, antigenEntryBytes, makeMultiSigQuorumVerifier,
  type KahuQuorumSeats, type KapaeAntigenEntry, type QuorumSignature,
} from "./kapae-antigen.js";
import type { PartialVerdict } from "./edge-partial.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { NEXUS_AID_PATTERN } from "./wax-stamp.js";

/** The envelope's own tag. It signs nothing: a partial's integrity rides its act's id and signatures. */
export const NEXUS_PARTIAL_KIND = "nexus-act-partial" as const;

/** Whom or what the act names, in keys a person can read. */
export type NexusPartialSubject =
  | { readonly kind: "nym"; readonly nym: string }
  | { readonly kind: "roll"; readonly closes: string; readonly opens: string };

/** The act itself, by family; each keeps its own image. */
export type NexusPartialAct =
  /** An admit may carry the OPENING of its carriage commitment beside it: the partial crosses between the founders'
   *  vaults by hand, so whichever vault lands the act can hand the subject its bundle. The board never holds it. */
  | { readonly family: "admit" | "revoke"; readonly entry: CarriageEntry; readonly opening?: AdmitOpening }
  | { readonly family: "kapae"; readonly entry: KapaeAntigenEntry }
  | { readonly family: "roll-anchor"; readonly anchor: RollAnchor };

export interface NexusActPartial {
  readonly kind:    typeof NEXUS_PARTIAL_KIND;
  readonly aid:     string;
  readonly subject: NexusPartialSubject;
  readonly act:     NexusPartialAct;
}

/** What one cosigning vessel holds: its charter's AID and head roster, the closed roster where its head rolled,
 *  and its own read of the Nexus's boards. */
export interface NexusPartialReader {
  readonly aid:      string;
  readonly head:     KahuQuorumSeats;
  /** The roster of the epoch the head's roll closed; absent at a genesis head. A roll anchor reads against it. */
  readonly closing?: KahuQuorumSeats;
  readonly board: {
    readonly carriage: readonly CarriageEntry[];
    readonly anchors:  readonly RollAnchor[];
    readonly antigen:  readonly KapaeAntigenEntry[];
  };
}

export interface NexusPartialJudgement {
  readonly verdict: PartialVerdict;
  readonly signed:  readonly string[];
  readonly why?:    string;
}

/** A refusal the cosign door names: the judge's verdict, or a hand that may not sign. Nothing signed. */
export class NexusPartialRefusal extends Error {
  override readonly name = "NexusPartialRefusal";
  constructor(readonly code: PartialVerdict | "hand-not-seated" | "hand-already-signed", message: string) { super(`${code}: ${message}`); }
}

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
const ANTIGEN_CID = /^sha256:[0-9a-f]{64}$/;

const record = (v: unknown): Record<string, unknown> | null => typeof v === "object" && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : null;
const exactKeys = (r: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(r).length === keys.length && keys.every((k) => Object.hasOwn(r, k));
/** One spelling: sorted, distinct, every member matching `re`. */
const sortedSet = (v: unknown, re: RegExp): v is string[] =>
  Array.isArray(v) && v.every((x, i) => typeof x === "string" && re.test(x) && (i === 0 || (v[i - 1] as string) < x));

function readSignatures(v: unknown): QuorumSignature[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > 256) return null;
  const out: QuorumSignature[] = [];
  for (const s of v) {
    const r = record(s);
    if (!r || !exactKeys(r, ["signer", "sig"]) || typeof r["signer"] !== "string" || !HEX64.test(r["signer"]) ||
        typeof r["sig"] !== "string" || !HEX128.test(r["sig"])) return null;
    out.push({ signer: r["signer"], sig: r["sig"] });
  }
  return out;
}

function readCarriage(v: unknown, family: "admit" | "revoke"): CarriageEntry | null {
  const e = record(v);
  const keys = family === "admit"
    ? ["kind", "nym", "action", "parents", "sealEpochCid", "signatures", "contractSig", ...(e && "carriageCommit" in e ? ["carriageCommit"] : [])]
    : ["kind", "nym", "action", "parents", "sealEpochCid", "signatures"];
  if (!e || !exactKeys(e, keys) || e["kind"] !== CARRIAGE_ENTRY_DOMAIN || e["action"] !== family) return null;
  if (typeof e["nym"] !== "string" || !HEX64.test(e["nym"]) || !sortedSet(e["parents"], HEX64)) return null;
  if (typeof e["sealEpochCid"] !== "string" || e["sealEpochCid"].length === 0) return null;
  const signatures = readSignatures(e["signatures"]);
  if (!signatures) return null;
  const entry: CarriageEntry = { kind: CARRIAGE_ENTRY_DOMAIN, nym: e["nym"], action: family, parents: [...e["parents"]],
    sealEpochCid: e["sealEpochCid"], signatures };
  if (family === "revoke") return entry;
  const contract = readSignatures([e["contractSig"]]);
  if (!contract || contract[0]!.signer !== entry.nym) return null;
  if (!("carriageCommit" in e)) return { ...entry, contractSig: contract[0]! };
  const commit = e["carriageCommit"];
  return typeof commit === "string" && HEX64.test(commit) ? { ...entry, contractSig: contract[0]!, carriageCommit: commit } : null;
}

function readAntigen(v: unknown): KapaeAntigenEntry | null {
  const e = record(v);
  if (!e || !exactKeys(e, ["kind", "nym", "action", "actCid", "parents", "sealEpochCid", "signatures"])) return null;
  if (e["kind"] !== KAPAE_ANTIGEN_DOMAIN || (e["action"] !== "kapae" && e["action"] !== "un_kapae")) return null;
  if (typeof e["nym"] !== "string" || !HEX64.test(e["nym"]) || !sortedSet(e["parents"], ANTIGEN_CID)) return null;
  if (typeof e["sealEpochCid"] !== "string" || e["sealEpochCid"].length === 0 || typeof e["actCid"] !== "string") return null;
  const signatures = readSignatures(e["signatures"]);
  if (!signatures) return null;
  const entry: KapaeAntigenEntry = { kind: KAPAE_ANTIGEN_DOMAIN, nym: e["nym"], action: e["action"], actCid: e["actCid"],
    parents: [...e["parents"]], sealEpochCid: e["sealEpochCid"], signatures };
  return entry.actCid === antigenActCid(entry) ? entry : null;
}

function readAnchor(v: unknown): RollAnchor | null {
  const a = record(v);
  if (!a || !exactKeys(a, ["kind", "prevEpochCid", "sealEpochCid", "prevKeys", "prevThreshold", "parents", "signatures"])) return null;
  if (a["kind"] !== CARRIAGE_ROLL_ANCHOR_DOMAIN || !sortedSet(a["prevKeys"], HEX64) || !sortedSet(a["parents"], HEX64)) return null;
  const { prevEpochCid, sealEpochCid, prevThreshold } = a;
  if (typeof prevEpochCid !== "string" || prevEpochCid.length === 0 || typeof sealEpochCid !== "string" || sealEpochCid.length === 0) return null;
  if (typeof prevThreshold !== "number" || !Number.isInteger(prevThreshold) || prevThreshold < 1 || prevThreshold > (a["prevKeys"] as string[]).length) return null;
  const signatures = readSignatures(a["signatures"]);
  if (!signatures) return null;
  return { kind: CARRIAGE_ROLL_ANCHOR_DOMAIN, prevEpochCid, sealEpochCid, prevKeys: [...a["prevKeys"] as string[]],
    prevThreshold, parents: [...a["parents"] as string[]], signatures };
}

/**
 * Read a partial at its exact floor shape, from parsed JSON. Null for anything torn: a wrong tag, an AID of
 * another shape, an act that fails its own image, or a subject that names another nym or other epochs.
 * Signatures read as shapes here; the judge counts them against a roster.
 */
export function readNexusActPartial(parsed: unknown): NexusActPartial | null {
  const p = record(parsed);
  if (!p || !exactKeys(p, ["kind", "aid", "subject", "act"]) || p["kind"] !== NEXUS_PARTIAL_KIND) return null;
  if (typeof p["aid"] !== "string" || !NEXUS_AID_PATTERN.test(p["aid"])) return null;
  const s = record(p["subject"]), a = record(p["act"]);
  if (!s || !a) return null;
  const family = a["family"];
  if (family === "admit" || family === "revoke" || family === "kapae") {
    const opened = family === "admit" && "opening" in a;
    if (!exactKeys(a, opened ? ["family", "entry", "opening"] : ["family", "entry"]) || !exactKeys(s, ["kind", "nym"]) || s["kind"] !== "nym") return null;
    const entry = family === "kapae" ? readAntigen(a["entry"]) : readCarriage(a["entry"], family);
    if (!entry || s["nym"] !== entry.nym) return null;
    // An opening reads only beside the commitment it opens.
    const opening = opened ? readAdmitOpening(a["opening"]) : null;
    if (opened && (opening === null || !("carriageCommit" in entry) || admitCarriageCommit(opening) !== entry.carriageCommit)) return null;
    const act = (opening ? { family, entry, opening } : { family, entry }) as NexusPartialAct;
    return { kind: NEXUS_PARTIAL_KIND, aid: p["aid"], subject: { kind: "nym", nym: entry.nym }, act };
  }
  if (family === "roll-anchor") {
    if (!exactKeys(a, ["family", "anchor"]) || !exactKeys(s, ["kind", "closes", "opens"]) || s["kind"] !== "roll") return null;
    const anchor = readAnchor(a["anchor"]);
    if (!anchor || s["closes"] !== anchor.prevEpochCid || s["opens"] !== anchor.sealEpochCid) return null;
    return { kind: NEXUS_PARTIAL_KIND, aid: p["aid"], subject: { kind: "roll", closes: anchor.prevEpochCid, opens: anchor.sealEpochCid },
      act: { family, anchor } };
  }
  return null;
}

/** Wrap an act as a partial under `aid`; refuses an act its own reader refuses. */
export function nexusActPartial(aid: string, act: NexusPartialAct): NexusActPartial {
  const subject: NexusPartialSubject = act.family === "roll-anchor"
    ? { kind: "roll", closes: act.anchor.prevEpochCid, opens: act.anchor.sealEpochCid }
    : { kind: "nym", nym: act.entry.nym };
  const partial = readNexusActPartial(JSON.parse(JSON.stringify({ kind: NEXUS_PARTIAL_KIND, aid, subject, act })));
  if (!partial) throw new Error("nexus-partial: the act, its Nexus and its subject do not read as one partial");
  return partial;
}

/** The bytes the act's own quorum signs. */
export function nexusPartialBytes(act: NexusPartialAct): Uint8Array {
  if (act.family === "roll-anchor") { const { signatures: _s, ...body } = act.anchor; return rollAnchorBytes(body); }
  if (act.family === "kapae") { const { signatures: _s, ...body } = act.entry; return antigenEntryBytes(body); }
  const { signatures: _s, contractSig: _c, ...body } = act.entry;   // a carriage commitment stays in the body the quorum signs
  return carriageEntryBytes(body);
}

const actSignatures = (act: NexusPartialAct): readonly QuorumSignature[] =>
  act.family === "roll-anchor" ? act.anchor.signatures : act.entry.signatures;
const actEpoch = (act: NexusPartialAct): string => act.family === "roll-anchor" ? act.anchor.sealEpochCid : act.entry.sealEpochCid;
const actParents = (act: NexusPartialAct): readonly string[] => act.family === "roll-anchor" ? act.anchor.parents : act.entry.parents;

/** The head roster's seats whose signature verifies over the act's bytes, one per seat, sorted. */
export function nexusPartialSeatsSigned(act: NexusPartialAct, roster: KahuQuorumSeats): string[] {
  const bytes = nexusPartialBytes(act);
  const seats = new Set(roster.keys.map((k) => k.toLowerCase()));
  const out = new Set<string>();
  for (const s of actSignatures(act)) {
    const signer = s.signer.toLowerCase();
    if (out.has(signer) || !seats.has(signer)) continue;
    if (verifyEd25519(s.sig, bytes, signer)) out.add(signer);
  }
  return [...out].sort();
}

/** The acts that count on this vessel's board in the act's own line, and the heads of that line, sorted. */
async function lineOf(act: Exclude<NexusPartialAct, { family: "roll-anchor" }>, reader: NexusPartialReader): Promise<{ known: Set<string>; heads: string[] }> {
  const nodes = new Map<string, readonly string[]>();
  if (act.family === "kapae") {
    const verifier = makeMultiSigQuorumVerifier();
    for (const e of reader.board.antigen) {
      if (e.nym !== act.entry.nym || e.actCid !== antigenActCid(e) || !(await verifier.verifyQuorum(e, reader.head))) continue;
      nodes.set(e.actCid, e.parents);
    }
  } else {
    for (const e of reader.board.carriage) {
      if (e.nym !== act.entry.nym || (e.action !== "admit" && e.action !== "revoke") || !(await carriageEntryCounts(e, reader.head))) continue;
      nodes.set(carriageEntryActCid(e), e.parents);
    }
  }
  // Causal closure, as each live writer reads its line: an act whose ancestry this vessel cannot count never
  // stands as a head or a parent. Iterate: a present parent may itself cite an absent grandparent.
  for (;;) {
    const before = nodes.size;
    for (const [cid, parents] of [...nodes]) if (parents.some((p) => !nodes.has(p))) nodes.delete(cid);
    if (nodes.size === before) break;
  }
  const cited = new Set([...nodes.values()].flat());
  return { known: new Set(nodes.keys()), heads: [...nodes.keys()].filter((c) => !cited.has(c)).sort() };
}

const sameList = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** Judge a partial as one cosigning vessel reads it. See the header. */
export async function judgeNexusActPartial(parsed: unknown, reader: NexusPartialReader): Promise<NexusPartialJudgement> {
  const partial = readNexusActPartial(parsed);
  if (!partial) return { verdict: "invalid", signed: [], why: "the partial does not read at its exact shape, or its subject names another act" };
  const { act } = partial;
  if (partial.aid !== reader.aid) return { verdict: "invalid", signed: [], why: "the partial names another Nexus than the one this vessel reads" };

  if (act.family === "roll-anchor") {
    const cid = rollAnchorCid(act.anchor);
    let landed = false;
    for (const a of reader.board.anchors) if (rollAnchorCid(a) === cid && await rollAnchorCounts(a, reader.head)) landed = true;
    if (landed) return { verdict: "replay", signed: [], why: "that anchor already stands on this vessel's board" };
    if (act.anchor.sealEpochCid !== reader.head.sealEpochCid) return { verdict: "stale", signed: [], why: "the anchor opens an epoch other than this vessel's charter head" };
    const closing = reader.closing;
    if (!closing) return { verdict: "unavailable", signed: [], why: "this vessel holds no closed roster to read the anchor against" };
    if (act.anchor.prevEpochCid !== closing.sealEpochCid) return { verdict: "stale", signed: [], why: "the anchor closes an epoch other than the one this vessel's head rolled from" };
    const closed = [...new Set(closing.keys.map((k) => k.toLowerCase()))].sort();
    if (!sameList(act.anchor.prevKeys, closed) || act.anchor.prevThreshold !== closing.threshold) {
      return { verdict: "invalid", signed: [], why: "the anchor names other closed seats than the closed roster" };
    }
    const signed = nexusPartialSeatsSigned(act, reader.head);
    if (signed.length === 0) return { verdict: "invalid", signed, why: "no seat of the head roster signed these bytes" };
    const heads = await rollAnchorParents(reader.board.carriage, reader.board.anchors, closing);
    const counted = new Set<string>();
    for (const e of reader.board.carriage) if (await carriageEntryCounts(e, closing)) counted.add(carriageEntryActCid(e));
    for (const a of reader.board.anchors) if (await rollAnchorCounts(a, closing)) counted.add(rollAnchorCid(a));
    if (act.anchor.parents.some((p) => !counted.has(p))) return { verdict: "unavailable", signed, why: "the anchor cites a parent this vessel cannot count" };
    if (!sameList(act.anchor.parents, heads)) return { verdict: "stale", signed, why: "the board's heads moved after the first seat signed" };
    return { verdict: signed.length >= reader.head.threshold ? "complete" : "ready", signed };
  }

  const cid = act.family === "kapae" ? act.entry.actCid : carriageEntryActCid(act.entry);
  // A replay names a copy that COUNTS on this board: an uncounted copy of the same id blocks nothing.
  let onBoard = false;
  if (act.family === "kapae") {
    const verifier = makeMultiSigQuorumVerifier();
    for (const e of reader.board.antigen) if (e.actCid === cid && e.actCid === antigenActCid(e) && await verifier.verifyQuorum(e, reader.head)) onBoard = true;
  } else {
    for (const e of reader.board.carriage) if (carriageEntryActCid(e) === cid && await carriageEntryCounts(e, reader.head)) onBoard = true;
  }
  if (onBoard) return { verdict: "replay", signed: [], why: "that act already stands on this vessel's board" };
  if (actEpoch(act) !== reader.head.sealEpochCid) return { verdict: "stale", signed: [], why: "the act names an epoch other than this vessel's charter head" };
  if (act.family === "admit" && !(await verifyCarriageConsent({ nym: act.entry.nym, sealEpochCid: act.entry.sealEpochCid, contractSig: act.entry.contractSig!.sig }))) {
    return { verdict: "invalid", signed: [], why: "the admit carries no contract-in its operator signed for this epoch" };
  }
  const signed = nexusPartialSeatsSigned(act, reader.head);
  if (signed.length === 0) return { verdict: "invalid", signed, why: "no seat of the head roster signed these bytes" };
  const line = await lineOf(act, reader);
  if (actParents(act).some((p) => !line.known.has(p))) return { verdict: "unavailable", signed, why: "the act cites a parent this vessel cannot count" };
  if (!sameList(actParents(act), line.heads)) return { verdict: "stale", signed, why: "the act's line moved after the first seat signed" };
  return { verdict: signed.length >= reader.head.threshold ? "complete" : "ready", signed };
}

/**
 * Add seats' signatures to a partial. The judge runs FIRST: a partial that does not read `ready`, a hand outside
 * the head roster, or a hand that already signed refuses before any signer runs. Returns the grown partial; the
 * caller judges it again to learn whether it counts.
 */
export async function cosignNexusActPartial(parsed: unknown, reader: NexusPartialReader,
  hands: ReadonlyArray<{ readonly signer: string; readonly sign: (bytes: Uint8Array) => Promise<string> }>): Promise<NexusActPartial> {
  const judged = await judgeNexusActPartial(parsed, reader);
  if (judged.verdict !== "ready") throw new NexusPartialRefusal(judged.verdict, judged.why ?? "the partial does not stand ready to cosign");
  const partial = readNexusActPartial(parsed)!;
  const seats = new Set(reader.head.keys.map((k) => k.toLowerCase()));
  const signed = new Set(judged.signed);
  for (const h of hands) {
    const signer = typeof h?.signer === "string" ? h.signer.toLowerCase() : "";
    if (!seats.has(signer)) throw new NexusPartialRefusal("hand-not-seated", "a hand holds a key the head roster does not seat");
    if (signed.has(signer)) throw new NexusPartialRefusal("hand-already-signed", "a hand already signed this act");
    signed.add(signer);
  }
  const bytes = nexusPartialBytes(partial.act);
  const added: QuorumSignature[] = [];
  for (const h of hands) added.push({ signer: h.signer.toLowerCase(), sig: await h.sign(bytes) });
  const signatures = [...actSignatures(partial.act), ...added];
  const act: NexusPartialAct = partial.act.family === "roll-anchor"
    ? { family: "roll-anchor", anchor: { ...partial.act.anchor, signatures } }
    : partial.act.family === "kapae"
      ? { family: "kapae", entry: { ...partial.act.entry, signatures } }
      : { ...partial.act, entry: { ...partial.act.entry, signatures } };   // an admit keeps the opening it carried
  return { ...partial, act };
}
