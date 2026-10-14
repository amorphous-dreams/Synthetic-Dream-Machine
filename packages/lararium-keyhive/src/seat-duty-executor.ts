/**
 * seat-duty-executor — run the key acts a counted raise owes, on the keyhive shore (kapae#/keys).
 *
 * The plan arrives pure (`planSeatDuties`, mesh). This module answers each row through a key shore and reports
 * what it did, so the vessel marks the raises it answered in its own ledger.
 *
 * NO COORDINATOR. Every vessel that counted the raise runs its own plan. A vessel that holds a hand over the
 * seat revokes it; one that holds none says so and leaves the seat to the hand that seated it. Two hands of one
 * lineage that revoke at once land one outcome, and a second act that finds the party gone reads as done.
 *
 * ORDER, AND WHY. For one row: the key act, then the roll's subscribers, then the fresh seat. The subscribers
 * hear the roll BEFORE any fresh seat lands, so a content-key roll never keys to a seat that returned. A raise
 * counts as answered only once the subscribers took the roll: a subscriber that rejects leaves the raise
 * unmarked, no fresh seat follows, and the next run brings the roll again.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/keys
 */
import type { SeatDuty, SeatRef, SeatRoll, SeatRollSink } from "@lararium/mesh";

/** What the executor asks of a key group. `keyhiveSeatShore` answers it over a `KeyhiveProvider`. */
export interface SeatKeyShore {
  revokeSeat(seat: SeatRef): Promise<"revoked" | "gone" | "no-authority">;
  /** Seat a party at a fresh key epoch. `unknown-party` where this shore cannot name the member. */
  seatAfresh(seat: SeatRef): Promise<"seated" | "unknown-party">;
}

/** The slice of a provider a seat shore rides: the face's key group stands as a Keyhive group. */
export interface SeatShoreProvider {
  revokeGroupSeat(memberIdentifierHex: string, groupId: string): Promise<{ how: "revoked" | "gone" | "no-authority" }>;
  knowsAgent(agentIdentifierHex: string): Promise<boolean>;
  addGroupMember(memberIdentifierHex: string, groupId: string): Promise<void>;
}

export function keyhiveSeatShore(provider: SeatShoreProvider): SeatKeyShore {
  return {
    revokeSeat: async (seat) => (await provider.revokeGroupSeat(seat.member, seat.group)).how,
    seatAfresh: async (seat) => {
      if (!(await provider.knowsAgent(seat.member))) return "unknown-party";
      await provider.addGroupMember(seat.member, seat.group);
      return "seated";
    },
  };
}

/**
 *   · `revoked` · `gone` · `no-authority` — how the key group answered a `revoke` row;
 *   · `settled`     — raises answered with no seat left to revoke;
 *   · `seated`      — a fresh seat landed;
 *   · `unseated`    — standing holds and no seat could land here: the party waits on a fresh crossing;
 *   · `forked`      — this vessel stands under its own shadow in the scope and performed no key act;
 *   · `undelivered` — a subscriber rejected the roll: nothing got marked, and no fresh seat followed.
 */
export type SeatDutyDid = "revoked" | "gone" | "no-authority" | "settled" | "seated" | "unseated" | "forked" | "undelivered";

export interface SeatDutyOutcome {
  readonly duty:   SeatDuty;
  readonly did:    SeatDutyDid;
  /** The raises this vessel now counts as answered: what it marks in its own ledger. */
  readonly marks:  readonly string[];
  /** Whether a fresh seat followed a revocation in the same row. */
  readonly fresh?: "seated" | "unseated";
  /** A subscriber's own words, where it rejected the roll. */
  readonly said?:  string;
}

/** Run a plan. The rows run in order, one at a time: a key group takes one writer at a time on one vessel. */
export async function runSeatDuties(
  shore:  SeatKeyShore,
  duties: readonly SeatDuty[],
  sink:   SeatRollSink,
): Promise<SeatDutyOutcome[]> {
  const out: SeatDutyOutcome[] = [];
  const deliver = async (roll: SeatRoll): Promise<string | null> => {
    try { await sink(roll); return null; } catch (err) { return err instanceof Error ? err.message : String(err); }
  };
  for (const duty of duties) {
    if (duty.kind === "forked") { out.push({ duty, did: "forked", marks: [] }); continue; }
    if (duty.kind === "seat-afresh") {
      const fresh = await shore.seatAfresh(duty.seat);
      out.push({ duty, did: fresh === "seated" ? "seated" : "unseated", marks: [] });
      continue;
    }
    if (duty.kind === "settled") {
      const failed = await deliver({ kind: "seat-roll", scope: duty.scope, edgeId: duty.edgeId, ...(duty.seat ? { seat: duty.seat } : {}), raiseCids: duty.raiseCids, how: "gone" });
      out.push(failed === null ? { duty, did: "settled", marks: duty.raiseCids } : { duty, did: "undelivered", marks: [], said: failed });
      continue;
    }
    const how = await shore.revokeSeat(duty.seat);
    if (duty.raiseCids.length > 0) {
      const failed = await deliver({ kind: "seat-roll", scope: duty.scope, edgeId: duty.edgeId, seat: duty.seat, raiseCids: duty.raiseCids, how });
      if (failed !== null) { out.push({ duty, did: "undelivered", marks: [], said: failed }); continue; }
    }
    // A fresh seat follows only a seat that truly left: one that still stands under another hand keeps its
    // earlier epoch, and a second seat beside it would roll nothing.
    if (duty.then === "seat-afresh" && how !== "no-authority") {
      const fresh = await shore.seatAfresh(duty.seat);
      out.push({ duty, did: how, marks: duty.raiseCids, fresh: fresh === "seated" ? "seated" : "unseated" });
      continue;
    }
    out.push({ duty, did: how, marks: duty.raiseCids });
  }
  return out;
}

// ── the roll's subscribers ───────────────────────────────────────────────────────────────────────────────

const subscribers = new Set<SeatRollSink>();

/**
 * Subscribe to this vessel's seat rolls. THE CONTENT-KEY SEAM: a bag's content-key roll subscribes here and
 * nowhere else (kapae#/keys). Returns the hand that unsubscribes.
 */
export function subscribeSeatRolls(sink: SeatRollSink): () => void {
  subscribers.add(sink);
  return () => { subscribers.delete(sink); };
}

/** Hand one roll to every subscriber, in turn. The first rejection ends the delivery and rides out. */
export const announceSeatRoll: SeatRollSink = async (roll) => {
  for (const sink of [...subscribers]) await sink(roll);
};
