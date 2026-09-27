/**
 * edge-kapae — the kāpae raised over a RELATIONSHIP rather than over a thing.
 *
 * Kāpae (Hawaiian): to set aside, to hold aside. Deliberate placement, never loss — the record beneath
 * survives whole, and another hand may take the marker back down (`lar:///ha.ka.ba/lares/api/pono/kapae`).
 *
 * ── WHY THE EDGE, AND WHAT THAT DISSOLVES ────────────────────────────────────────────────────────────────
 * Every comparable system raises its marker on a THING — Matrix on a user, the fediverse on an instance, a
 * CRL on a certificate, KERI on an identifier. A thing holds ONE global standing, so a tombstone over it must
 * be globally agreed: hence delivery, hence consensus, hence the write-race that produced Matrix's state
 * resets and the CRL family's undelivered negatives.
 *
 * A marker raised over one EDGE needs none of that. The shadow scopes to a single relationship, no third
 * party needs the news, the blast radius equals that relation, and two edges tombstone CONCURRENTLY without
 * racing — because they name different objects.
 *
 * It also settles the case the literature leaves open. Mutual revocation, at this grain: A shadows the edge
 * (B → group) while B shadows (A → group). BOTH shadows hold, so BOTH stand aside, and remove-wins needs no
 * winner. The group lands in a LEGIBLE state — no authority stands — which surfaces a fork rather than
 * diverging in silence. Surfacing the split reads as this module's job; deciding it belongs to the humans.
 *
 * ── THE LAW THIS ENACTS (kapae#law) ──────────────────────────────────────────────────────────────────────
 * A raised kāpae shadows every layer beneath. Lowering it takes a deliberate gesture and writes its own record;
 * nothing un-shadows silently. Entries only accrete. A causal descendant lower can withdraw a shadow, while
 * concurrent opposite heads remain unsettled and project no shadow; the fold adjudicates, never the write.
 *
 * ── KĀPAE ⊥ ABSENT, and the cut MUST stay sharp ─────────────────────────────────────────────────────────
 * A kāpae shadows; an absent edge falls through. An edge that never existed, or one that expired, reads
 * ABSENT — the relationship simply does not stand, and a fresh edge may establish it. A SHADOWED edge reads
 * differently: it stood, a hand set it aside, and a re-add cannot resurrect it while the marker holds.
 * Collapsing the two re-introduces the resurrection bug the residency model names as anti-pattern #3.
 *
 * Platform-blind: rides ./crypto + ./base-doc only. NO node: imports.
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae
 */

import { EDGE_KAPAE_DOMAIN } from "./domains.js";
import type { LarDoc } from "./base-doc.js";
import { mutableLarRecord, tiddlerText } from "./base-doc.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";

export { EDGE_KAPAE_DOMAIN } from "./domains.js";
/** The tiddler-key prefix every kāpae act rides under. */
export const EDGE_KAPAE_PREFIX = "lar:///ha.ka.ba/dreamnet/edge-kapae/" as const;

/**
 * One act on one relationship — a hand raising the marker, or a hand taking it back down.
 *
 * `raised` carries the gesture rather than a state, because the board holds ACTS and the fold holds state.
 * Two hands acting from one causal frontier both land, and the fold decides between them.
 */
export interface EdgeKapae {
  readonly kind:    typeof EDGE_KAPAE_DOMAIN;
  /** The relationship this act concerns — a dyad id, a vouch id, any content-addressed edge. */
  readonly edgeId:  string;
  /** true → raise the shadow (set aside); false → lower it (a deliberate re-admission). */
  readonly raised:  boolean;
  /** Content identity of the semantic act (signatures are deliberately outside this identity). */
  readonly actCid: string;
  /** Causal parents in this edge's local relation family. An empty set is a founded act. */
  readonly parents: readonly string[];
  /** The epochCid this act roots on. An ORDER, never an instant — a causal island holds no global now. */
  readonly epochCid:   string;
  /** ed25519 by the authority that holds this edge, over `edgeKapaeBytes`. */
  readonly sig:     string;
}

/** The semantic bytes an act signs and hashes. Signature representations never enter the act identity. */
export function edgeKapaeBytes(a: Omit<EdgeKapae, "sig">): Uint8Array {
  return canonicalJsonBytes({
    kind: a.kind, edgeId: a.edgeId, raised: a.raised, parents: [...new Set(a.parents)].sort(), epochCid: a.epochCid,
  });
}

export function edgeKapaeActCid(a: Omit<EdgeKapae, "sig" | "actCid">): string {
  return `sha256:${sha256HexBytesSync(edgeKapaeBytes({ ...a, actCid: "" }))}`;
}

/** Mint an act. The caller supplies the signer holding authority over this edge; this module holds no key. */
export async function signEdgeKapae(
  parts: Omit<EdgeKapae, "kind" | "sig" | "actCid">,
  sign: (bytes: Uint8Array) => Promise<string>,
): Promise<EdgeKapae> {
  const base = { ...parts, kind: EDGE_KAPAE_DOMAIN, parents: [...new Set(parts.parents)].sort() } as Omit<EdgeKapae, "sig" | "actCid">;
  const unsigned = { ...base, actCid: edgeKapaeActCid(base) } as Omit<EdgeKapae, "sig">;
  return { ...unsigned, sig: await sign(edgeKapaeBytes(unsigned)) };
}

/**
 * The key one act rides under — edge, GESTURE and semantic act CID together.
 *
 * Keying by edge alone would let a concurrent lower win an in-place merge and silently resurrect a shadowed
 * relationship. Keyed this way a raise and a lower from one frontier land on DISTINCT keys and BOTH survive, so the fold's
 * remove-wins guard still runs. The fold adjudicates; the write never does.
 */
export function edgeKapaeKey(edgeId: string, raised: boolean, actCid: string): string {
  return `${EDGE_KAPAE_PREFIX}${edgeId}/${raised ? "raised" : "lowered"}/${actCid}`;
}

/** Land an act on a board draft. Call INSIDE a `handle.change()` callback. */
export function writeEdgeKapae(draft: LarDoc, act: EdgeKapae): void {
  const key = edgeKapaeKey(act.edgeId, act.raised, act.actCid);
  draft.tiddlers[key] = mutableLarRecord(key, { text: JSON.stringify(act) }, act.epochCid);
}

/** A parsed payload reads as an act only at the exact FLOOR shape — extra fields drop. */
function coerceAct(parsed: unknown): EdgeKapae | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (p["kind"] !== EDGE_KAPAE_DOMAIN) return null;
  if (typeof p["edgeId"] !== "string" || p["edgeId"].length === 0) return null;
  if (typeof p["raised"] !== "boolean") return null;
  if (typeof p["actCid"] !== "string" || p["actCid"].length === 0) return null;
  if (!Array.isArray(p["parents"]) || p["parents"].some((x) => typeof x !== "string")) return null;
  if (typeof p["epochCid"] !== "string" || p["epochCid"].length === 0) return null;
  if (typeof p["sig"] !== "string" || p["sig"].length === 0) return null;
  return {
    kind: EDGE_KAPAE_DOMAIN, edgeId: p["edgeId"], raised: p["raised"],
    actCid: p["actCid"], parents: [...new Set(p["parents"] as string[])].sort(), epochCid: p["epochCid"], sig: p["sig"],
  };
}

/** Every well-formed act a board carries. A torn or foreign tiddler drops in silence. */
export function edgeKapaeActsFromBoard(doc: LarDoc | undefined | null): EdgeKapae[] {
  const tiddlers = doc?.tiddlers;
  if (!tiddlers) return [];
  const out: EdgeKapae[] = [];
  for (const record of Object.values(tiddlers)) {
    const text = tiddlerText(record);
    if (text === null) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { continue; }
    const act = coerceAct(parsed);
    if (act !== null) out.push(act);
  }
  return out;
}

/**
 * The fold uses only the local causal acts it has received. An absent parent makes that branch unavailable;
 * contradictory admissible heads remain unsettled rather than being ranked by a scalar or arrival order.
 */
export type EdgeKapaeVerdict = "held" | "withdrawn" | "unsettled" | "unavailable" | "rejected";

/** Fold a causal frontier. A child is admissible only when every parent is present in the same
 * edge family; maximal heads are then projected. Concurrent opposing heads stay unsettled. */
export function foldEdgeKapaeVerdicts(acts: readonly EdgeKapae[]): Map<string, EdgeKapaeVerdict> {
  const out = new Map<string, EdgeKapaeVerdict>();
  const byEdge = new Map<string, EdgeKapae[]>();
  for (const a of acts) (byEdge.get(a.edgeId) ?? (byEdge.set(a.edgeId, []), byEdge.get(a.edgeId)!)).push(a);
  for (const [edge, group] of byEdge) {
    const ids = new Set(group.map((a) => a.actCid));
    const byId = new Map(group.map((a) => [a.actCid, a]));
    if (group.some((a) => a.parents.some((p) => !ids.has(p) || byId.get(p)!.epochCid !== a.epochCid))) { out.set(edge, "unavailable"); continue; }
    const valid = group.filter((a) => a.actCid === edgeKapaeActCid(a) && a.parents.every((p) => ids.has(p)));
    if (valid.length !== group.length) { out.set(edge, "rejected"); continue; }
    const covered = new Set(valid.flatMap((a) => a.parents));
    const heads = valid.filter((a) => !covered.has(a.actCid));
    if (heads.length === 0) { out.set(edge, "unavailable"); continue; }
    if (heads.some((a) => a.raised) && heads.some((a) => !a.raised)) out.set(edge, "unsettled");
    else out.set(edge, heads[0]!.raised ? "held" : "withdrawn");
  }
  return out;
}

/**
 * Fold the acts into the set of SHADOWED edges — the projection the whole pattern rests on.
 *
 * The causal frontier determines standing. A contradictory pair of admissible heads remains unsettled and
 * therefore does not project a shadow; under partition no arrival order quietly reverses a relationship.
 *
 * Every act arrives VERIFIED — the caller checks signatures before folding, because this fold decides
 * standing and an unverified act would let anyone lower anyone's shadow.
 */
export function foldEdgeKapae(acts: readonly EdgeKapae[]): Set<string> {
  const verdicts = foldEdgeKapaeVerdicts(acts);
  const shadowed = new Set<string>();
  for (const [edgeId, verdict] of verdicts) if (verdict === "held") shadowed.add(edgeId);
  return shadowed;
}

/**
 * Verify then fold, in one pass — the shape a caller wants, and the one that cannot skip the check.
 *
 * An act that fails its signature DROPS rather than throwing: a forged lower must never take a shadow down,
 * and a forged raise must never set aside a relationship its author holds no authority over. `authorityFor`
 * names which key holds an edge, so a hand cannot act on a relationship that was never theirs.
 */
export async function verifiedShadowSet(
  acts: readonly EdgeKapae[],
  authorityFor: (edgeId: string) => string | undefined,
  verify: (bytes: Uint8Array, sigHex: string, signerDid: string) => Promise<boolean>,
): Promise<Set<string>> {
  const verdicts = await Promise.all(acts.map(async (a) => {
    const signer = authorityFor(a.edgeId);
    if (!signer) return false;                       // no known authority → the act carries none
    const { sig: _s, ...unsigned } = a;
    return verify(edgeKapaeBytes(unsigned), a.sig, signer).catch(() => false);
  }));
  return foldEdgeKapae(acts.filter((_, i) => verdicts[i] === true));
}

/**
 * Read a board and hand back the shadows that STAND — extract, verify, fold, in the one call a caller wants.
 *
 * Exposing only this shape keeps the unverified fold out of reach: `foldEdgeKapae` decides standing, so a
 * caller who reached it with raw board acts would let anyone lower anyone's shadow. Designation carries
 * authority here too — `authorityFor` names which key may act on an edge, so a hand cannot set aside a
 * relationship that was never theirs.
 *
 * An absent board yields NO shadows, which reads as the honest floor rather than a permissive one: nothing
 * set aside means nothing set aside, and the readers that consult this still verify every edge they admit.
 */
export async function shadowSetFromBoard(
  doc: LarDoc | undefined | null,
  authorityFor: (edgeId: string) => string | undefined,
  verify: (bytes: Uint8Array, sigHex: string, signerDid: string) => Promise<boolean>,
): Promise<Set<string>> {
  return verifiedShadowSet(edgeKapaeActsFromBoard(doc), authorityFor, verify);
}
