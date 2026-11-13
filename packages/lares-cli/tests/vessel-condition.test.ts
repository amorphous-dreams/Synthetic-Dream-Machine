/**
 * THE READINESS CONTRACT — the shape a vessel's standing reports in, everywhere it reports.
 *
 * ── WHY THIS FILE DECLARES A SHAPE THAT DID NOT EXIST ────────────────────────────────────────────────────
 * A boolean `up` carried the whole reading, and a boolean holds two states where a booting process passes
 * through four. So the honest detail went somewhere a boolean could not contradict it — a free-text note —
 * and the two disagreed in the operator's terminal: `up: false` beside "attested vessel-ready". A caller
 * reading the flag saw a broken boot; a human reading the note saw a healthy one. Both were reading the
 * same vessel.
 *
 * The art settles this the same way from three directions, and the agreement is the point:
 *
 *   · systemd `Type=notify` — READY fires LAST, from the process that bound the socket. A service manager
 *     that reports on `exec` alone "will report success even if the service's binary cannot be invoked".
 *     Readiness is a claim only the binder may make, and only after binding.
 *   · Kubernetes conditions — `True | False | Unknown` plus a machine `reason` and a human `message`, with
 *     `Ready` and `Progressing` held as SEPARATE conditions so "coming up healthily" never collapses into
 *     "up". `Unknown` is the state a boolean cannot spell.
 *   · Health Check RFC (draft-inadarei-api-health-check) — `pass | warn | fail`, where `warn` returns a
 *     SUCCESS status and carries additional information. Serving-but-impaired is its own verdict.
 *
 * ── THE FOUR STATES, AND WHY EACH EARNS ITS NAME ─────────────────────────────────────────────────────────
 * `standing`  — the socket accepts. The only state that may claim ready.
 * `rising`    — started, no fault, not yet accepting. Kubernetes' `Unknown`; systemd's window before READY.
 * `degraded`  — serving, but impaired in a named way. The RFC's `warn`: a vessel whose verb socket refused
 *               to bind still carries, routes, and serves the public shelf. Reporting it `down` would tell
 *               an operator to restart a vessel that is doing most of its job.
 * `down`      — not serving.
 *
 * ── THE LAW THIS FILE ENFORCES ───────────────────────────────────────────────────────────────────────────
 * `ok` is DERIVED, never written. The bug was possible only because two hands wrote two fields; a reading
 * that computes `ok` from `state` cannot contradict itself, whatever the message says.
 */

import { describe, test, expect } from "vitest";
import {
  vesselCondition, conditionOk, conditionExit,
  type VesselCondition, type VesselState,
} from "../src/vessel-condition.js";

describe("the readiness contract — four states, one derived verdict", () => {

  test("a caller CANNOT write `ok` — the field the bug needed does not exist", () => {
    const c = vesselCondition({ state: "rising", reason: "socket-silent", message: "still binding" });
    expect((c as unknown as Record<string, unknown>)["ok"]).toBeUndefined();
    expect(Object.isFrozen(c)).toBe(true);
  });

  test("RISING reads apart from DOWN — the state a boolean could not spell", () => {
    const rising = vesselCondition({ state: "rising",   reason: "socket-silent",  message: "attested, not yet accepting" });
    const down   = vesselCondition({ state: "down",     reason: "never-started",  message: "nothing answered" });
    expect(conditionOk(rising)).toBe(false);
    expect(conditionOk(down)).toBe(false);
    // ...and a caller can still tell them apart, which is the whole reason the state exists.
    expect(rising.state).not.toBe(down.state);
    expect(conditionExit(rising)).not.toBe(conditionExit(down));
  });

  test("DEGRADED serves — a refused verb socket must not read as a dead vessel", () => {
    const c = vesselCondition({
      state: "degraded", reason: "uds-refused",
      message: "listen EINVAL — the socket path exceeds the platform budget",
    });
    expect(conditionOk(c)).toBe(false);        // not ready for a verb
    expect(c.state).toBe("degraded");          // ...but distinctly not `down`
    expect(conditionExit(c)).toBe(EXIT_PARTIAL);
  });

  test("every condition carries a MACHINE reason and a HUMAN message, kept apart", () => {
    const c = vesselCondition({ state: "degraded", reason: "uds-refused", message: "listen EINVAL: path too long" });
    // The reason is what a caller BRANCHES on: stable, lowercase, hyphenated, no prose, no punctuation.
    expect(c.reason).toMatch(/^[a-z][a-z0-9-]*$/);
    // The message is what a human READS: free text, and never the thing code keys on.
    expect(c.message.length).toBeGreaterThan(0);
    expect(c.reason).not.toBe(c.message);
  });

  test("a reason that would be read as prose REFUSES — the branch surface stays stable", () => {
    for (const bad of ["UDS Refused", "uds refused", "uds_refused", "listen EINVAL: nope", ""]) {
      expect(() => vesselCondition({ state: "down", reason: bad, message: "m" })).toThrow(/reason/i);
    }
  });
});


describe("readiness is the BINDER's claim, made after the bind", () => {


  test("a NAMED refusal outranks patience — it reads DEGRADED at once, carrying the cause", () => {
    // The 120s poll spent its whole deadline against a bind that had already refused. A refusal is a
    // verdict, never a slow success, so it must never wait.
    const c = readVesselStanding({
      attested: true, accepting: false, started: true,
      refusal: "listen EINVAL: invalid argument /very/deep/path/lares.sock",
    });
    expect(c.state).toBe("degraded");
    expect(c.reason).toBe("uds-refused");
    expect(c.message).toContain("EINVAL");
  });

});


describe("the machine envelope carries its shape and no counter", () => {
  test("a condition holds exactly state, reason and message", () => {
    // A version field claims an ordering of shapes that no two readers share, and nothing ever read this
    // one. A reader keys on the fields it knows and ignores the rest; a new shape adds a field, never a
    // number. The `ok` reading stays derived, so it never rides the envelope either.
    const c = vesselCondition({ state: "standing", reason: "accepting", message: "m" });
    expect(Object.keys(c).sort()).toEqual(["message", "reason", "state"]);
  });

  test("CONTROL: the envelope still carries what a caller branches on", () => {
    const c = vesselCondition({ state: "rising", reason: "socket-silent", message: "m" });
    expect([c.state, c.reason, c.message]).toEqual(["rising", "socket-silent", "m"]);
  });
});

// Imported below the suites that describe them, so a reader meets the CONTRACT before the machinery.
import { readVesselStanding, EXIT_PARTIAL } from "../src/vessel-condition.js";
export type { VesselCondition };
