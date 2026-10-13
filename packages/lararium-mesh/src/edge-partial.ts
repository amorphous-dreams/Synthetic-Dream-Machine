/**
 * edge-partial — a QUORUM edge act that crosses between vessels before its threshold meets (kapae#/edge-hands).
 *
 * A quorum act takes the seats of the charter a realm stands under. Where those seats rest on separate
 * vessels, no one vault signs the whole act: one seat signs, the act crosses as a PARTIAL, and a second seat
 * cosigns it. The act's id leaves its signatures out, so every seat signs the SAME bytes and the signatures
 * gather on one act (`mergeEdgeActs`).
 *
 * ── A PARTIAL CARRIES THE WHOLE ACT IMAGE ────────────────────────────────────────────────────────────────
 * The act itself, entire: edge, gesture, hand, parents, epoch, and the signatures gathered so far. Beside it,
 * the SUBJECT in plain keys: the realm, and the member or the vouch the edge names. An edge id hashes its
 * subject, so a bare id tells a person nothing about whom they set aside. The reader recomputes the id from
 * the subject and refuses a partial whose two halves disagree. A person signs what they can read.
 *
 * ── WHAT A COSIGNER REFUSES, WITH NO CLOCK ───────────────────────────────────────────────────────────────
 *   · `invalid`     — a torn shape; an id that fails its own bytes; a subject that names another edge; a hand
 *                     other than the quorum's; no signature from a seat of the epoch it names.
 *   · `stale`       — the act names an epoch other than the cosigner's charter head, or cites parents other
 *                     than the heads of that edge's quorum line as the cosigner counts them. The line moved, or
 *                     the roster rolled, after the first seat signed: a fresh act cites the fresh frontier.
 *   · `unavailable` — the act cites a parent this vessel cannot count. It proves no frontier here.
 *   · `replay`      — the act already counts on this vessel's board. Nothing new can land.
 * Causal position decides each one: the charter's head epoch, the line's own heads, the board's own count.
 *
 * ── WHAT A COSIGNER ACCEPTS ──────────────────────────────────────────────────────────────────────────────
 *   · `ready`    — the act stands short of its threshold and this vessel's seats can add to it.
 *   · `complete` — the act already carries a quorum this vessel verifies, and its board lacks it: it lands
 *                  as it stands. The seat that signed first lands the finished act this way.
 *
 * THE SMALL INTERFACE. `PartialVerdict` and the envelope's shape (`scope`, a readable `subject`, the whole act)
 * serve any quorum act that gathers signatures across vessels. The Nexus founding train's door for admit,
 * revoke, kapae and the roll anchor may adopt both as they stand.
 *
 * Platform-blind: rides ./edge-kapae + ./realm-edges + ./vouch-board. NO node: imports.
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/edge-hands
 */
import type { KahuQuorumSeats, QuorumSignature } from "./kapae-antigen.js";
import {
  EDGE_KAPAE_DOMAIN, edgeKapaeActCid, edgeKapaeBytes, edgeLineHeads, mergeEdgeActs,
  type CountedEdgeBoard, type EdgeCharter, type EdgeKapae, type EdgeSigner,
} from "./edge-kapae.js";
import { memberEdgeId } from "./realm-edges.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { vouchEdgeId } from "./vouch-board.js";

/** The envelope's own tag. It signs nothing: a partial's integrity rides the act's id and its signatures. */
export const EDGE_PARTIAL_KIND = "edge-act-partial" as const;

/** Whom the edge names, in keys a person can read. */
export type EdgePartialSubject =
  | { readonly kind: "member"; readonly member: string }
  | { readonly kind: "vouch"; readonly voucher: string; readonly joiner: string };

export interface EdgeActPartial {
  readonly kind:    typeof EDGE_PARTIAL_KIND;
  /** The realm whose edge board the act lands on. */
  readonly scope:   string;
  readonly subject: EdgePartialSubject;
  /** The whole act: its body, its id, and every signature gathered so far. */
  readonly act:     EdgeKapae;
}

/** What a cosigner reads off a partial. See the header. */
export type PartialVerdict = "ready" | "complete" | "replay" | "stale" | "unavailable" | "invalid";

const HEX64 = /^[0-9a-f]{64}$/;
const bare = (key: string): string => key.trim().toLowerCase().replace(/^0x/, "");

/** The edge id a subject names in one realm, or null where the subject cannot be read. */
export function edgeIdOfSubject(scope: string, subject: EdgePartialSubject): string | null {
  const realm = scope.trim().toLowerCase();
  try {
    if (subject.kind === "member") return memberEdgeId(realm, subject.member);
    if (!HEX64.test(bare(subject.voucher)) || !HEX64.test(bare(subject.joiner))) return null;
    return vouchEdgeId({ realmDocIdHex: realm, voucherDid: subject.voucher, joinerIdentityHex: subject.joiner });
  } catch { return null; }
}

/** Wrap an act as a partial. Refuses an act whose id fails its bytes, or a subject that names another edge. */
export function edgeActPartial(act: EdgeKapae, scope: string, subject: EdgePartialSubject): EdgeActPartial {
  const partial: EdgeActPartial = { kind: EDGE_PARTIAL_KIND, scope: scope.trim().toLowerCase(), subject, act };
  if (readEdgeActPartial(partial) === null) throw new Error("edge-partial: the act, its realm and its subject do not name one edge");
  return partial;
}

function coerceSubject(v: unknown): EdgePartialSubject | null {
  if (typeof v !== "object" || v === null) return null;
  const s = v as Record<string, unknown>;
  if (s["kind"] === "member" && typeof s["member"] === "string") return { kind: "member", member: s["member"] };
  if (s["kind"] === "vouch" && typeof s["voucher"] === "string" && typeof s["joiner"] === "string") {
    return { kind: "vouch", voucher: s["voucher"], joiner: s["joiner"] };
  }
  return null;
}

/**
 * Read a partial at its exact floor shape, from parsed JSON. Null for anything torn: a wrong tag, a realm that
 * reads as no id, an act whose id fails its own bytes, a hand other than the quorum's, or a subject whose edge
 * id differs from the act's. Signatures get judged later, against a roster.
 */
export function readEdgeActPartial(parsed: unknown): EdgeActPartial | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (p["kind"] !== EDGE_PARTIAL_KIND) return null;
  if (typeof p["scope"] !== "string" || !HEX64.test(p["scope"])) return null;
  const subject = coerceSubject(p["subject"]);
  if (subject === null) return null;
  const a = p["act"] as Record<string, unknown> | null;
  if (typeof a !== "object" || a === null) return null;
  if (a["kind"] !== EDGE_KAPAE_DOMAIN || a["hand"] !== "quorum" || typeof a["raised"] !== "boolean") return null;
  if (typeof a["edgeId"] !== "string" || typeof a["actCid"] !== "string" || typeof a["epochCid"] !== "string" || a["epochCid"].length === 0) return null;
  if (!Array.isArray(a["parents"]) || a["parents"].some((x) => typeof x !== "string" || !HEX64.test(x))) return null;
  if (!Array.isArray(a["signatures"]) || a["signatures"].length === 0 || a["signatures"].length > 256) return null;
  const signatures: QuorumSignature[] = [];
  for (const s of a["signatures"] as unknown[]) {
    if (typeof s !== "object" || s === null) return null;
    const r = s as Record<string, unknown>;
    if (typeof r["signer"] !== "string" || typeof r["sig"] !== "string" || r["signer"].length === 0 || r["sig"].length === 0) return null;
    signatures.push({ signer: r["signer"], sig: r["sig"] });
  }
  const act: EdgeKapae = {
    kind: EDGE_KAPAE_DOMAIN, edgeId: a["edgeId"], raised: a["raised"], hand: "quorum", actCid: a["actCid"],
    parents: [...new Set(a["parents"] as string[])].sort(), epochCid: a["epochCid"], signatures,
  };
  const { signatures: _s, actCid, ...body } = act;
  if (actCid !== edgeKapaeActCid(body)) return null;
  if (edgeIdOfSubject(p["scope"], subject) !== act.edgeId) return null;
  return { kind: EDGE_PARTIAL_KIND, scope: p["scope"], subject, act };
}

/** The roster's seats whose signature verifies over the act's bytes, one per seat, as bare keys. */
export function partialSeatsSigned(act: EdgeKapae, roster: KahuQuorumSeats): string[] {
  const { signatures, actCid: _c, ...body } = act;
  const bytes = edgeKapaeBytes(body);
  const seats = new Set(roster.keys.map(bare));
  const out = new Set<string>();
  for (const s of signatures) {
    const signer = bare(s.signer);
    if (out.has(signer) || !seats.has(signer)) continue;
    let ok = false;
    try { ok = verifyEd25519(s.sig, bytes, signer); } catch { ok = false; }
    if (ok) out.add(signer);
  }
  return [...out].sort();
}

/**
 * Judge a partial as one cosigning vessel reads it. `counted` holds this vessel's own read of the realm's edge
 * board (`readEdgeBoard`), and `charter` the charter it holds for that realm.
 */
export function judgeEdgeActPartial(
  partial: EdgeActPartial,
  reader:  { readonly charter: EdgeCharter; readonly counted: CountedEdgeBoard },
): { readonly verdict: PartialVerdict; readonly signed: readonly string[]; readonly why?: string } {
  const { act } = partial;
  const head = reader.charter.head;
  if (partial.scope !== reader.charter.scope.trim().toLowerCase()) return { verdict: "invalid", signed: [], why: "the partial names another realm than the one this vessel reads" };
  if (reader.counted.acts.some((a) => a.actCid === act.actCid)) return { verdict: "replay", signed: [], why: "that act already counts on this vessel's board" };
  if (act.epochCid !== head.sealEpochCid) return { verdict: "stale", signed: [], why: "the act names an epoch other than this vessel's charter head" };
  const signed = partialSeatsSigned(act, head);
  if (signed.length === 0) return { verdict: "invalid", signed, why: "no seat of the head roster signed these bytes" };
  const known = new Set(reader.counted.acts.filter((a) => a.edgeId === act.edgeId && a.hand === "quorum").map((a) => a.actCid));
  if (act.parents.some((p) => !known.has(p))) return { verdict: "unavailable", signed, why: "the act cites a parent this vessel cannot count" };
  const heads = edgeLineHeads(reader.counted.acts, act.edgeId, "quorum");
  if (heads.length !== act.parents.length || heads.some((h, i) => h !== act.parents[i])) {
    return { verdict: "stale", signed, why: "the edge's line moved after the first seat signed" };
  }
  return { verdict: signed.length >= head.threshold ? "complete" : "ready", signed };
}

/**
 * Add seats' signatures to a partial's act. The seats sign the act's own bytes, so its id stands unchanged and
 * the signatures gather. Returns the grown partial; the caller judges it again to learn whether it counts.
 */
export async function cosignEdgeActPartial(partial: EdgeActPartial, signers: readonly EdgeSigner[]): Promise<EdgeActPartial> {
  const { signatures: _s, actCid: _c, ...body } = partial.act;
  const bytes = edgeKapaeBytes(body);
  const added: QuorumSignature[] = [];
  for (const s of signers) added.push({ signer: s.signer, sig: await s.sign(bytes) });
  const [merged] = mergeEdgeActs([partial.act, { ...partial.act, signatures: added }]);
  return { ...partial, act: merged! };
}
