/**
 * seat-duties — what a counted raise owes on the key side, as one vessel plans it from its own reading.
 *
 * Every vector carries a CONTROL beside it.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/kapae (#/keys · #/re-admission)
 */
import { describe, expect, test } from "vitest";
import { planSeatDuties, type SeatDuty, type SeatStanding } from "../src/index.js";

const SCOPE = "f1".repeat(32), OTHER_SCOPE = "f2".repeat(32);
const EDGE = "e1".repeat(32), EDGE_B = "e2".repeat(32);
const R1 = "a1".repeat(32), R2 = "a2".repeat(32);
const SEAT = { group: "0xgroup", member: "0xmember" };

const row = (over: Partial<SeatStanding> = {}): SeatStanding =>
  ({ scope: SCOPE, edgeId: EDGE, seat: SEAT, aside: true, raiseCids: [R1], seatStands: true, ...over });
const plan = (seats: SeatStanding[], opts: { rolled?: string[]; selfAside?: string[]; seatless?: { scope: string; edgeId: string; raiseCids: string[] }[] } = {}): SeatDuty[] =>
  planSeatDuties({
    seats, ...(opts.seatless ? { seatless: opts.seatless } : {}),
    rolled: () => new Set(opts.rolled ?? []),
    selfAside: (scope) => (opts.selfAside ?? []).includes(scope),
  });

describe("a seat without standing gets revoked", () => {
  test("a counted raise over a standing seat owes a revocation, and the party stays out while the shadow stands", () => {
    expect(plan([row()])).toEqual([{ kind: "revoke", scope: SCOPE, edgeId: EDGE, seat: SEAT, raiseCids: [R1], then: "leave-out" }]);
  });

  test("CONTROL: a seat no raise names owes nothing", () => {
    expect(plan([row({ aside: false, raiseCids: [] })])).toEqual([]);
  });

  test("a reading that closes the gates with no counted raise behind it moves no key", () => {
    // `unavailable` and `rejected` set the party aside at every gate; a key moves only once a raise counts.
    expect(plan([row({ aside: true, raiseCids: [] })])).toEqual([]);
  });

  test("a seat that reappears under a raise already answered leaves again", () => {
    expect(plan([row()], { rolled: [R1] })).toEqual([{ kind: "revoke", scope: SCOPE, edgeId: EDGE, seat: SEAT, raiseCids: [], then: "leave-out" }]);
  });
});

describe("every counted raise owes one roll, whatever acts follow it", () => {
  test("a raise and its lift read together still revoke the earlier seat, and a fresh seat follows", () => {
    expect(plan([row({ aside: false })])).toEqual([{ kind: "revoke", scope: SCOPE, edgeId: EDGE, seat: SEAT, raiseCids: [R1], then: "seat-afresh" }]);
  });

  test("CONTROL: a lifted raise this vessel already answered leaves a standing seat alone", () => {
    expect(plan([row({ aside: false })], { rolled: [R1] })).toEqual([]);
  });

  test("raises read together share one revocation, and only the unanswered ones ride it", () => {
    const [duty] = plan([row({ raiseCids: [R2, R1, R1] })], { rolled: [R1] });
    expect(duty).toEqual({ kind: "revoke", scope: SCOPE, edgeId: EDGE, seat: SEAT, raiseCids: [R2], then: "leave-out" });
  });
});

describe("a revocation that finds the party gone reads as done", () => {
  test("an unanswered raise over a seat already gone settles without a key act", () => {
    expect(plan([row({ seatStands: false })])).toEqual([{ kind: "settled", scope: SCOPE, edgeId: EDGE, seat: SEAT, raiseCids: [R1] }]);
  });

  test("a raise over an edge no seat matches settles too", () => {
    expect(plan([], { seatless: [{ scope: SCOPE, edgeId: EDGE_B, raiseCids: [R2] }] }))
      .toEqual([{ kind: "settled", scope: SCOPE, edgeId: EDGE_B, raiseCids: [R2] }]);
  });

  test("CONTROL: an answered raise over a gone seat owes nothing while the shadow stands", () => {
    expect(plan([row({ seatStands: false })], { rolled: [R1] })).toEqual([]);
    expect(plan([], { rolled: [R2], seatless: [{ scope: SCOPE, edgeId: EDGE_B, raiseCids: [R2] }] })).toEqual([]);
  });
});

describe("a lift restores standing, and the seat that follows stands fresh", () => {
  test("standing with no seat names a fresh seat once every raise got answered", () => {
    expect(plan([row({ aside: false, seatStands: false })], { rolled: [R1] })).toEqual([{ kind: "seat-afresh", scope: SCOPE, edgeId: EDGE, seat: SEAT }]);
  });

  test("a gone seat under an unanswered, lifted raise settles first and names the fresh seat beside it", () => {
    expect(plan([row({ aside: false, seatStands: false })]).map((d) => d.kind)).toEqual(["settled", "seat-afresh"]);
  });

  test("CONTROL: a party that never drew a raise and holds no seat gets no seat from this plan", () => {
    expect(plan([row({ aside: false, seatStands: false, raiseCids: [] })])).toEqual([]);
  });
});

describe("a vessel under its own shadow mints no key epoch", () => {
  test("a shadow over this vessel's own edge leaves one forked row for that scope and no key act", () => {
    expect(plan([row(), row({ edgeId: EDGE_B, seat: { group: "0xgroup", member: "0xother" } })], { selfAside: [SCOPE] })).toEqual([{ kind: "forked", scope: SCOPE }]);
  });

  test("CONTROL: the shadow scopes to its own board, and another scope's duties stand", () => {
    const duties = plan([row(), row({ scope: OTHER_SCOPE })], { selfAside: [SCOPE] });
    expect(duties).toEqual([
      { kind: "forked", scope: SCOPE },
      { kind: "revoke", scope: OTHER_SCOPE, edgeId: EDGE, seat: SEAT, raiseCids: [R1], then: "leave-out" },
    ]);
  });
});

test("the plan reads the same whatever order the rows arrive in", () => {
  const a = row(), b = row({ edgeId: EDGE_B, seat: { group: "0xgroup", member: "0xother" }, raiseCids: [R2] });
  expect(plan([a, b])).toEqual(plan([b, a]));
});
