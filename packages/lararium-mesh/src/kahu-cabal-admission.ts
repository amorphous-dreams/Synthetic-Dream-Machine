/**
 * kahu-cabal-admission — the seat quorum's admission of a PersonaGroup into a Nexus's Kahu cabal, as an
 * authority act of its own, and the access path to shared canon that reads it.
 *
 * The ruling (`lar:///ha.ka.ba/lares/docs/stable-founding-road`, "Planes ~ cabal, realm, Nexus"): //Admission
 * of a Kahu or a Lamplighter always takes the seat quorum, and no ordinary single-seat class covers it.//
 * And `lar:///ha.ka.ba/lararium/mesh/kahu#/seed-and-nexus`: ADMISSION TAKES THE SEAT QUORUM. So an admission
 * here counts only at the high-impact threshold the charter's own seats set (`./chartered-classes`), and a
 * removal takes the threshold of the admission it revokes.
 *
 * A VOUCH ADMITS NOBODY. A vouch stakes one hand's own standing (`cabal-invite`), and a Keyhive add on the
 * cabal sentinel grants a capability; neither carries the collective's authority. So this module reads only
 * its own domain: a record wearing any other kind counts nothing, whatever it says, and the access path
 * refuses a sentinel membership that no counted admission stands behind.
 *
 * GATE C'S ACCESS PATH (`kahu#/ea-notes`): a PersonaGroup's membership in the cabal reads at ACCESS to the
 * cabal's shared canon, never at boot. `kahuCabalCanonAccess` answers that read from two facts kept apart:
 * the counted admission (authority, folded here) and the sentinel membership (capability, read by the caller
 * off Keyhive and handed in). Access holds only where both stand.
 *
 * WHAT IT NEVER DECIDES. It holds no key, reads no clock and keeps no store. It names no roster of members:
 * the fold answers for the group a caller names, as the carriage fold does, and two concurrent heads that
 * contradict stay `unsettled`, which never grants.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/kahu#/cabal-admission
 */
import { KAHU_CABAL_ADMIT_DOMAIN } from "./domains.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import type { KahuQuorumSeats, QuorumSignature } from "./kapae-antigen.js";
import { charteredClassTable, classThreshold, countSeatedSignatures } from "./chartered-classes.js";
import { tiddlerText, type LarDoc } from "./base-doc.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { storedLarRecord } from "./stored-record.js";

export { KAHU_CABAL_ADMIT_DOMAIN };

/** Admit seats a PersonaGroup in the cabal; remove takes it back out at the admission's own threshold. */
export type KahuCabalAction = "admit" | "remove";

/** One admission act. The signatures ride OUTSIDE the signed bytes, so re-carrying an act never re-signs it. */
export interface KahuCabalAct {
  readonly kind:         typeof KAHU_CABAL_ADMIT_DOMAIN;
  /** The Nexus AID whose cabal this act seats in. */
  readonly nexus:        string;
  /** The PersonaGroup the act admits or removes: 64 lower-case hex. Never a persona root, never a leaf. */
  readonly group:        string;
  readonly action:       KahuCabalAction;
  /** Causal parents: earlier acts on the same group in the same Nexus. Empty opens the relation. */
  readonly parents:      readonly string[];
  /** The charter epoch whose seats signed. */
  readonly sealEpochCid: string;
  readonly signatures:   readonly QuorumSignature[];
}

const HEX64 = /^[0-9a-f]{64}$/;

/** The canonical bytes the seats sign: every field but the signatures, parents sorted and de-duplicated. */
export function kahuCabalActBytes(act: Omit<KahuCabalAct, "signatures"> | KahuCabalAct): Uint8Array {
  return canonicalJsonBytes({
    kind:         act.kind,
    nexus:        act.nexus,
    group:        act.group,
    action:       act.action,
    parents:      [...new Set(act.parents)].sort(),
    sealEpochCid: act.sealEpochCid,
  });
}

/** The act's CID: 64 hex over its signed bytes, citable as a parent. Signatures stand as evidence, never identity. */
export function kahuCabalActCid(act: Omit<KahuCabalAct, "signatures"> | KahuCabalAct): string {
  return sha256HexBytesSync(kahuCabalActBytes(act));
}

/** Read an act at its exact shape, or null. A record of any other kind (a vouch among them) reads null. */
export function readKahuCabalAct(value: unknown): KahuCabalAct | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v["kind"] !== KAHU_CABAL_ADMIT_DOMAIN) return null;
  if (typeof v["nexus"] !== "string" || v["nexus"].length === 0) return null;
  if (typeof v["group"] !== "string" || !HEX64.test(v["group"])) return null;
  if (v["action"] !== "admit" && v["action"] !== "remove") return null;
  if (!Array.isArray(v["parents"]) || !v["parents"].every((p) => typeof p === "string" && HEX64.test(p))) return null;
  if (typeof v["sealEpochCid"] !== "string" || v["sealEpochCid"].length === 0) return null;
  if (!Array.isArray(v["signatures"])) return null;
  const signatures: QuorumSignature[] = [];
  for (const s of v["signatures"] as unknown[]) {
    if (typeof s !== "object" || s === null) return null;
    const r = s as Record<string, unknown>;
    if (typeof r["signer"] !== "string" || typeof r["sig"] !== "string") return null;
    signatures.push({ signer: r["signer"], sig: r["sig"] });
  }
  return {
    kind: KAHU_CABAL_ADMIT_DOMAIN, nexus: v["nexus"], group: v["group"], action: v["action"],
    parents: [...new Set(v["parents"] as string[])].sort(), sealEpochCid: v["sealEpochCid"], signatures,
  };
}

/**
 * Open an unsigned act, or THROW where the charter's seats set no class table (a torn roster grants nothing)
 * or the group reads malformed.
 */
export function openKahuCabalAct(parts: {
  readonly nexus: string; readonly group: string; readonly action: KahuCabalAction;
  readonly parents?: readonly string[]; readonly roster: KahuQuorumSeats;
}): KahuCabalAct {
  if (charteredClassTable(parts.roster) === null) throw new Error("kahu-cabal act refused: no-class-table");
  const group = parts.group.trim().toLowerCase();
  if (!HEX64.test(group)) throw new Error("kahu-cabal act refused: group-unreadable");
  if (parts.nexus.trim().length === 0) throw new Error("kahu-cabal act refused: no-nexus");
  return {
    kind: KAHU_CABAL_ADMIT_DOMAIN, nexus: parts.nexus.trim(), group, action: parts.action,
    parents: [...new Set(parts.parents ?? [])].sort(), sealEpochCid: parts.roster.sealEpochCid, signatures: [],
  };
}

/**
 * Add seat signatures to an act. THROWS `signer-not-seated` for a signer outside the roster (a persona root, a
 * leaf or a vouching face never signs an admission) and `wrong-charter-epoch` for a roster of another epoch.
 * A seat whose carried signature verifies signs once; a carried signature that fails drops.
 */
export async function signKahuCabalAct(
  act: KahuCabalAct,
  signers: ReadonlyArray<{ readonly signer: string; readonly sign: (bytes: Uint8Array) => Promise<string> }>,
  roster: KahuQuorumSeats,
): Promise<KahuCabalAct> {
  if (roster.sealEpochCid !== act.sealEpochCid) throw new Error("kahu-cabal act refused: wrong-charter-epoch");
  const seats = new Set(roster.keys);
  const bytes = kahuCabalActBytes(act);
  // Only a carried signature that verifies holds its seat's place, so no carrier wedges a seat out.
  const signatures = act.signatures.filter((s) => seats.has(s.signer) && verifyEd25519(s.sig, bytes, s.signer));
  const signed = new Set(signatures.map((s) => s.signer));
  for (const s of signers) {
    if (!seats.has(s.signer)) throw new Error("kahu-cabal act refused: signer-not-seated");
    if (signed.has(s.signer)) continue;
    signatures.push({ signer: s.signer, sig: await s.sign(bytes) });
    signed.add(s.signer);
  }
  return { ...act, signatures };
}

export type KahuCabalCount =
  | { readonly counted: true;  readonly reason: "seat-quorum-counted"; readonly seated: number; readonly threshold: number }
  | { readonly counted: false; readonly reason: string; readonly seated?: number; readonly threshold?: number };

/**
 * Does this act count under `roster`? An admission takes the high-impact threshold; a removal takes the
 * threshold of the admission it revokes (revocation at the original act's class). Never throws.
 */
export function kahuCabalActCounts(value: unknown, roster: KahuQuorumSeats, nexus?: string): KahuCabalCount {
  const act = readKahuCabalAct(value);
  if (act === null) return { counted: false, reason: "not-an-admission" };
  if (nexus !== undefined && act.nexus !== nexus) return { counted: false, reason: "foreign-nexus" };
  const table = charteredClassTable(roster);
  if (table === null) return { counted: false, reason: "no-class-table" };
  if (act.sealEpochCid !== roster.sealEpochCid) return { counted: false, reason: "wrong-charter-epoch" };
  const threshold = act.action === "admit"
    ? classThreshold(table, "high-impact")!
    : classThreshold(table, "revocation", "high-impact")!;
  const seated = countSeatedSignatures(kahuCabalActBytes(act), act.signatures, roster);
  return seated >= threshold
    ? { counted: true, reason: "seat-quorum-counted", seated, threshold }
    : { counted: false, reason: "below-seat-quorum", seated, threshold };
}

export type KahuCabalStanding = "admitted" | "removed" | "unsettled" | "absent";

/**
 * Fold the acts on ONE named group into its standing. Only counted acts on that group in that Nexus take
 * part; a counted act whose parent stands absent or uncounted here reads unavailable and drops. The causal
 * heads decide: one or more admits → admitted, removes alone → removed, an admit beside a remove → unsettled.
 */
export function kahuCabalStanding(
  acts: Iterable<unknown>, group: string, roster: KahuQuorumSeats, nexus: string,
): { readonly standing: KahuCabalStanding; readonly heads: readonly string[] } {
  const want = group.trim().toLowerCase();
  const byCid = new Map<string, KahuCabalAct>();
  for (const value of acts) {
    const act = readKahuCabalAct(value);
    if (act === null || act.group !== want) continue;
    if (!kahuCabalActCounts(act, roster, nexus).counted) continue;
    byCid.set(kahuCabalActCid(act), act);
  }
  let pruned = true;
  while (pruned) {
    pruned = false;
    for (const [cid, act] of byCid) {
      if (act.parents.some((p) => !byCid.has(p))) { byCid.delete(cid); pruned = true; }
    }
  }
  if (byCid.size === 0) return { standing: "absent", heads: [] };
  const cited = new Set<string>();
  for (const act of byCid.values()) for (const p of act.parents) cited.add(p);
  const heads = [...byCid.keys()].filter((cid) => !cited.has(cid)).sort();
  if (heads.length === 0) return { standing: "unsettled", heads };
  const actions = new Set(heads.map((cid) => byCid.get(cid)!.action));
  if (actions.has("admit") && actions.has("remove")) return { standing: "unsettled", heads };
  return { standing: actions.has("admit") ? "admitted" : "removed", heads };
}

export interface KahuCabalAccess {
  readonly held:     boolean;
  readonly standing: KahuCabalStanding;
  readonly reason:   "admitted-and-joined" | "admitted-not-joined" | "joined-without-admission" | "removed" | "unsettled" | "absent";
}

/**
 * The cabal's access path to shared canon. Access holds only where a counted admission stands as the group's
 * head AND the caller's own sentinel read finds the group a member. A sentinel membership with no counted
 * admission behind it reads `joined-without-admission` and never holds: a vouch or a lone Keyhive add admits
 * nobody.
 */
export function kahuCabalCanonAccess(input: {
  readonly group: string; readonly nexus: string; readonly roster: KahuQuorumSeats;
  readonly acts: Iterable<unknown>; readonly sentinelMember: boolean;
}): KahuCabalAccess {
  const { standing } = kahuCabalStanding(input.acts, input.group, input.roster, input.nexus);
  if (standing === "admitted") {
    return input.sentinelMember
      ? { held: true, standing, reason: "admitted-and-joined" }
      : { held: false, standing, reason: "admitted-not-joined" };
  }
  if (standing === "absent" && input.sentinelMember) return { held: false, standing, reason: "joined-without-admission" };
  return { held: false, standing, reason: standing };
}

// ── the board ─────────────────────────────────────────────────────────────────────────────────────────
// An admission rides the Nexus's carriage board, which every member already carries, under a prefix of its
// own. The carriage reader skips it by kind, so it never enters a carriage fold, and this reader skips every
// carriage entry the same way. The board holds acts; a fold answers for one named group, never a roster.

/** The tiddler prefix an admission act lands under on the carriage board. */
export const KAHU_CABAL_PREFIX = "$:/lar/kahu-cabal/";

/** Land an act on a board draft, keyed by its act CID. Call INSIDE a `handle.change()` callback. */
export function writeKahuCabalAct(draft: LarDoc, act: KahuCabalAct): void {
  const key = `${KAHU_CABAL_PREFIX}${kahuCabalActCid(act)}`;
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(act) }, act.sealEpochCid);
}

/** Every well-formed admission act a board carries. A torn or foreign tiddler drops in silence. */
export function kahuCabalActsFromBoard(doc: LarDoc | undefined | null): KahuCabalAct[] {
  const out: KahuCabalAct[] = [];
  for (const record of Object.values(doc?.tiddlers ?? {})) {
    const text = tiddlerText(record);
    if (text === null) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { continue; }
    const act = readKahuCabalAct(parsed);
    if (act !== null) out.push(act);
  }
  return out;
}
