/**
 * seat-duties — what a counted raise owes on the KEY side, planned as a pure reading (kapae#/keys).
 *
 * KEYS NEVER OUTRUN STANDING. A gate closes the moment a shadow stands; a key leaves when a vessel ANSWERS the
 * raise. This module names what one vessel owes, from what that vessel itself reads: the fold of an edge board,
 * the marks in its own ledger, and whether each seat still stands in the key group. It holds no key, calls no
 * provider, and reads no clock. The keyhive shore runs the plan (`runSeatDuties`).
 *
 * ── THE RULES ────────────────────────────────────────────────────────────────────────────────────────────
 *   · A SEAT WITHOUT STANDING GETS REVOKED, once a raise counts. A reading that closes the gates with no
 *     counted raise behind it (`unavailable`, `rejected`) moves no key.
 *   · EVERY COUNTED RAISE OWES ONE ROLL OF THE SEAT IT NAMES, whatever acts follow it. A vessel that reads a
 *     raise and its lift together still revokes the earlier seat, and then seats the party afresh. Raises read
 *     together share one revocation; a raise read after a fresh seat takes its own.
 *   · A REVOCATION THAT FINDS THE PARTY GONE READS AS DONE. The raise still gets answered: the vessel marks
 *     it and hands the roll to whoever subscribes (`SeatRoll`).
 *   · STANDING WITH NO SEAT STAYS SAFE, AND EVERY DOOR SHOWS IT. A party whose shadow lifted and whose seat
 *     left reads `unseated` until a fresh seat lands.
 *   · A VESSEL UNDER ITS OWN SHADOW MINTS NO KEY EPOCH. Where this vessel reads a shadow over its own edge in
 *     a scope, the plan holds one `forked` row for that scope and no key act.
 *
 * ── THE ROLL EVENT (the content-key seam) ────────────────────────────────────────────────────────────────
 * `SeatRoll` names the ONE event a bag's content-key roll subscribes to: this vessel answered a counted raise.
 * It fires once for each batch of raises a vessel answers, BEFORE any fresh seat, whether the vessel revoked
 * the seat, found it gone, or held no authority to revoke it. A subscriber keys its own work on
 * (`scope`, each `raiseCid`): delivery repeats when a subscriber fails, so the work must tolerate a repeat.
 *
 * Platform-blind: rides ./crypto + ./ed25519-door. NO node: imports.
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/keys
 */
import { SEAT_ROLL_DOMAIN } from "./domains.js";
import { canonicalJsonBytes } from "./crypto.js";
import { verifyEd25519 } from "./ed25519-door.js";

/** One seat in one key group: the group's own id and the member's agent id, both as the key shore names them. */
export interface SeatRef {
  readonly group:  string;
  readonly member: string;
}

/** What one vessel reads about one seat's relation: off its edge board, and off its own key group replica. */
export interface SeatStanding {
  /** The board the relation's acts ride: a fleet root, or a realm id. It keys the ledger's marks. */
  readonly scope:      string;
  /** The edge whose shadow sets this seat's party aside (a device edge, a member edge). */
  readonly edgeId:     string;
  readonly seat:       SeatRef;
  /** True while the party holds NO standing: a shadow stands over its edge, or no vouch path reaches a root. */
  readonly aside:      boolean;
  /**
   * Every counted raise that names this seat's relation, sorted: the raises over its own edge, and for a joiner
   * whose last vouch path fell, the raises over the vouch edges that named it.
   */
  readonly raiseCids:  readonly string[];
  /** Does the party hold a seat in the key group, as THIS replica reads it? */
  readonly seatStands: boolean;
}

/** An edge that carries counted raises and matches no seat this replica can name. */
export interface SeatlessRaises {
  readonly scope:     string;
  readonly edgeId:    string;
  readonly raiseCids: readonly string[];
}

export interface SeatDutyInput {
  readonly seats:     readonly SeatStanding[];
  /** Counted raises over edges no standing seat matches: the party left, or never sat here. */
  readonly seatless?: readonly SeatlessRaises[];
  /** The raises this vessel already answered on the key side, per scope (`rolledRaises`). */
  readonly rolled:    (scope: string) => ReadonlySet<string>;
  /** Does this vessel read a shadow over its OWN edge in that scope? */
  readonly selfAside: (scope: string) => boolean;
}

/**
 *   · `revoke`      — the seat stands and must leave. `raiseCids` names the raises this act answers (none when a
 *                     seat reappeared under a raise already answered). `then` says what follows: the party
 *                     stays out, or standing holds and the vessel seats it afresh.
 *   · `settled`     — raises owed, and no seat left to revoke: mark them and hand the roll on.
 *   · `seat-afresh` — standing holds, every raise got answered, and no seat stands: seat the party at a fresh
 *                     key epoch, where this vessel can.
 *   · `forked`      — this vessel reads a shadow over its own edge in `scope`: it performs no key act there.
 */
export type SeatDuty =
  | { readonly kind: "revoke"; readonly scope: string; readonly edgeId: string; readonly seat: SeatRef; readonly raiseCids: readonly string[]; readonly then: "leave-out" | "seat-afresh" }
  | { readonly kind: "settled"; readonly scope: string; readonly edgeId: string; readonly seat?: SeatRef; readonly raiseCids: readonly string[] }
  | { readonly kind: "seat-afresh"; readonly scope: string; readonly edgeId: string; readonly seat: SeatRef }
  | { readonly kind: "forked"; readonly scope: string };

/** One roll of one seat, as the vessel that answered the raise reports it. See the header. */
export interface SeatRoll {
  readonly kind:      "seat-roll";
  readonly scope:     string;
  readonly edgeId:    string;
  /** The seat the raise names, where this vessel could name one. */
  readonly seat?:     SeatRef;
  /** The raises this roll answers, sorted. Never empty. */
  readonly raiseCids: readonly string[];
  /**
   * How the key group answered: `revoked` by this vessel; `gone` before it acted; or `no-authority`, where the
   * seat still stands under a hand this vessel cannot revoke. A content-key roll proceeds on every one of them.
   */
  readonly how:       "revoked" | "gone" | "no-authority";
}

/** Whoever subscribes to seat rolls. A rejection leaves the raises unmarked, and the roll comes again. */
export type SeatRollSink = (roll: SeatRoll) => Promise<void> | void;

/**
 * A roll with the answering vessel's own RECEIPT: its daemon island, where the group's keys live, signs the roll
 * with the vessel key. The vessel's ledger keeps a roll only under a receipt that verifies under its own key, so
 * no caller of the marks door types a roll the key shore never gave and silences a raise with it.
 */
export interface SignedSeatRoll extends SeatRoll {
  /** Hex Ed25519 signature under the vessel's own key over `seatRollBytes(roll)`. */
  readonly receipt: string;
}

/** The bytes a roll's receipt covers: every field of the roll, canonical, under the roll's own domain. */
export function seatRollBytes(roll: SeatRoll): Uint8Array {
  return canonicalJsonBytes({
    kind: SEAT_ROLL_DOMAIN, scope: roll.scope.trim().toLowerCase(), edgeId: roll.edgeId.toLowerCase(),
    seat: roll.seat ? { group: roll.seat.group.toLowerCase(), member: roll.seat.member.toLowerCase() } : null,
    raiseCids: sorted(roll.raiseCids.map((c) => c.toLowerCase())), how: roll.how,
  });
}

export async function signSeatRoll(roll: SeatRoll, sign: (bytes: Uint8Array) => Promise<string>): Promise<SignedSeatRoll> {
  return { ...roll, receipt: await sign(seatRollBytes(roll)) };
}

/** Read a roll a verb carried as plain data, and verify its receipt under one vessel key. Null where either fails. */
export function verifiedSeatRoll(raw: unknown, vesselKey: string): SeatRoll | null {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const how = r["how"] === "revoked" || r["how"] === "gone" || r["how"] === "no-authority" ? r["how"] : null;
  if (how === null || typeof r["scope"] !== "string" || typeof r["edgeId"] !== "string" || typeof r["receipt"] !== "string") return null;
  if (!Array.isArray(r["raiseCids"]) || r["raiseCids"].length === 0 || r["raiseCids"].some((c) => typeof c !== "string")) return null;
  const seatRaw = r["seat"] as Record<string, unknown> | undefined;
  const seat = seatRaw && typeof seatRaw["group"] === "string" && typeof seatRaw["member"] === "string"
    ? { group: seatRaw["group"], member: seatRaw["member"] } : undefined;
  if (r["seat"] !== undefined && seat === undefined) return null;
  const roll: SeatRoll = { kind: "seat-roll", scope: r["scope"], edgeId: r["edgeId"], ...(seat ? { seat } : {}), raiseCids: r["raiseCids"] as string[], how };
  let ok = false;
  try { ok = verifyEd25519(r["receipt"], seatRollBytes(roll), vesselKey.trim().toLowerCase().replace(/^0x/, "")); } catch { ok = false; }
  return ok ? roll : null;
}

const sorted = (cids: Iterable<string>): string[] => [...new Set(cids)].sort();

/**
 * Plan the key acts one vessel owes. Pure, and stable in its order: by scope, then by edge.
 *
 * The plan reads THIS replica alone. Another vessel may plan the same revocation at the same moment; the key
 * shore's removal converges, and a second act that finds the party gone reads as done.
 */
export function planSeatDuties(input: SeatDutyInput): SeatDuty[] {
  const duties: SeatDuty[] = [];
  const scopes = sorted([...input.seats.map((s) => s.scope), ...(input.seatless ?? []).map((s) => s.scope)]);
  for (const scope of scopes) {
    // A vessel that reads a shadow over its own edge mints nothing further in that scope: one row says so.
    if (input.selfAside(scope)) { duties.push({ kind: "forked", scope }); continue; }
    const rolled = input.rolled(scope);
    const rows = input.seats.filter((s) => s.scope === scope).sort((a, b) => a.edgeId.localeCompare(b.edgeId) || a.seat.member.localeCompare(b.seat.member));
    for (const s of rows) {
      const raises = sorted(s.raiseCids);
      const owed = raises.filter((cid) => !rolled.has(cid));
      if (s.seatStands) {
        // A key moves only once a raise counts: a shadow with no counted raise behind it closes gates alone.
        if (owed.length > 0 || (s.aside && raises.length > 0)) {
          duties.push({ kind: "revoke", scope, edgeId: s.edgeId, seat: s.seat, raiseCids: owed, then: s.aside ? "leave-out" : "seat-afresh" });
        }
        continue;
      }
      if (owed.length > 0) duties.push({ kind: "settled", scope, edgeId: s.edgeId, seat: s.seat, raiseCids: owed });
      if (!s.aside && raises.length > 0) duties.push({ kind: "seat-afresh", scope, edgeId: s.edgeId, seat: s.seat });
    }
    const loose = (input.seatless ?? []).filter((s) => s.scope === scope).sort((a, b) => a.edgeId.localeCompare(b.edgeId));
    for (const s of loose) {
      const owed = sorted(s.raiseCids).filter((cid) => !rolled.has(cid));
      if (owed.length > 0) duties.push({ kind: "settled", scope, edgeId: s.edgeId, raiseCids: owed });
    }
  }
  return duties;
}
