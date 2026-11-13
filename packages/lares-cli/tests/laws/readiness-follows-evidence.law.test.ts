/**
 * L10 · Readiness follows evidence, never reassuring prose. A vessel, door or holder reads ready,
 * standing or accepting only from evidence (a live socket, an attestation, a recorded state), and every
 * combination of evidence maps to exactly one verdict. The verdict derives from the evidence alone; a
 * message, a reading line or a wording never moves it.
 *
 * Each reader runs over its WHOLE evidence space (finite, so enumerated exhaustively) against an oracle
 * written from the law, never from the reader's own branches. The literal cases earlier bugs left stay
 * as seeds; a CONTROL reader that trusts prose must read red, so a law that cannot fail never passes.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import { describe, expect, test } from "vitest";
import {
  readVesselStanding, vesselCondition, conditionOk, conditionExit, EXIT_PARTIAL,
  type VesselCondition, type VesselState,
} from "../../src/vessel-condition.js";
import { rosterStanding } from "../../src/roster-standing.js";
import { nexusPhase } from "../../src/nexus-phase.js";
import { repaveVerdict } from "../../src/commands/capture/harvest.js";

const STATES: readonly VesselState[] = ["standing", "rising", "degraded", "down"];

// ── the vessel's evidence space: started x attested x accepting x refusal (absent | empty | named) ──
interface Obs { started: boolean; attested: boolean; accepting: boolean; refusal: string | null }
const BOOL = [false, true] as const;
const REFUSALS: ReadonlyArray<string | null> = [null, "", "listen EINVAL: invalid argument /deep/lares.sock", "bind refused"];
function* vesselSpace(): Generator<Obs> {
  for (const started of BOOL) for (const attested of BOOL) for (const accepting of BOOL)
    for (const refusal of REFUSALS) yield { started, attested, accepting, refusal };
}

/** The law's oracle: absence outranks all; a named refusal outranks patience; ready needs BOTH witnesses. */
function oracle(o: Obs): VesselState {
  if (!o.started) return "down";
  if (o.refusal) return "degraded";
  if (o.attested && o.accepting) return "standing";
  return "rising";
}

/** A reader that trusts reassuring prose: a stale note decides. It exists only to be caught. */
function proseTrustingReader(o: Obs & { note: string }): VesselState {
  if (/ready/i.test(o.note)) return "standing";
  return oracle(o);
}

describe("L10 vessel: every combination of evidence maps to one verdict", () => {
  test("VACUITY: the space holds every evidence combination and reaches all four verdicts", () => {
    const all = [...vesselSpace()];
    expect(all.length).toBe(2 * 2 * 2 * REFUSALS.length);
    expect(new Set(all.map(oracle))).toEqual(new Set(STATES));
  });

  test("the verdict equals the oracle on the whole space", () => {
    for (const o of vesselSpace()) {
      expect(readVesselStanding(o).state, JSON.stringify(o)).toBe(oracle(o));
    }
  });

  test("ready (ok, exit 0) arises only when started, attested, accepting and unrefused", () => {
    for (const o of vesselSpace()) {
      const c = readVesselStanding(o);
      const witnessed = o.started && o.attested && o.accepting && !o.refusal;
      expect(conditionOk(c), JSON.stringify(o)).toBe(witnessed);
      expect(conditionExit(c) === 0, JSON.stringify(o)).toBe(witnessed);
    }
  });

  test("a reading is a function of the evidence: a second read of the same evidence returns the same verdict", () => {
    for (const o of vesselSpace()) {
      const a = readVesselStanding({ ...o }), b = readVesselStanding({ ...o });
      expect(a).toEqual(b);
    }
  });

  test("the refusal's wording never moves the verdict", () => {
    for (const o of vesselSpace()) {
      if (!o.refusal) continue;
      for (const wording of ["x", "all is well", "bind refused"]) {
        expect(readVesselStanding({ ...o, refusal: wording }).state).toBe(oracle({ ...o, refusal: wording }));
      }
    }
  });

  test("a refusal's own wording never moves the verdict, even wording that names ready", () => {
    for (const o of vesselSpace()) {
      if (!o.started) continue;
      for (const wording of ["attested vessel-ready", "socket not ready", "ready"]) {
        expect(readVesselStanding({ ...o, refusal: wording }).state).toBe("degraded");
      }
    }
  });

  test("every verdict keeps a machine reason, a message, and its own exit class", () => {
    const exits = new Map<VesselState, number>();
    for (const o of vesselSpace()) {
      const c = readVesselStanding(o);
      expect(c.reason).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(c.message.length).toBeGreaterThan(0);
      const e = conditionExit(c);
      if (exits.has(c.state)) expect(e).toBe(exits.get(c.state));
      exits.set(c.state, e);
    }
    expect(exits.get("standing")).toBe(0);
    expect(exits.get("down")).toBe(1);
    expect(exits.get("rising")).toBe(EXIT_PARTIAL);
    expect(exits.get("degraded")).toBe(EXIT_PARTIAL);
  });

  test("a ready-claiming message mints only on standing: the whole state x wording grid", () => {
    for (const state of STATES) {
      for (const message of ["attested vessel-ready", "Ready", "all is well", "m"]) {
        const claims = /\bready\b/i.test(message);
        const mint = () => vesselCondition({ state, reason: "probe", message });
        if (claims && state !== "standing") expect(mint).toThrow(/ready/i); else expect(mint).not.toThrow();
      }
    }
  });

  test("ok derives from state alone for every state and every reason/message pair", () => {
    for (const state of STATES) for (const reason of ["a", "accepting", "never-started"]) for (const message of ["m", "n"]) {
      const c: VesselCondition = vesselCondition({ state, reason, message });
      expect(conditionOk(c)).toBe(state === "standing");
      expect(Object.keys(c).sort()).toEqual(["message", "reason", "state"]);
    }
  });

  // SEEDS: the literal cases earlier bugs left.
  test("SEED: attested but not accepting reads rising; a bind refusal reads degraded at once; never started reads down", () => {
    expect(readVesselStanding({ attested: true, accepting: false, refusal: null, started: true }).state).toBe("rising");
    expect(readVesselStanding({ attested: true, accepting: false, refusal: "listen EINVAL", started: true }).state).toBe("degraded");
    expect(readVesselStanding({ attested: false, accepting: false, refusal: null, started: false })).toMatchObject({ state: "down", reason: "never-started" });
    expect(readVesselStanding({ attested: false, accepting: true, refusal: null, started: true }).state).toBe("rising");
  });

  test("CONTROL: a prose-trusting reader violates the oracle, so the law can fail", () => {
    const caught: Obs[] = [];
    for (const o of vesselSpace()) {
      if (proseTrustingReader({ ...o, note: "attested vessel-ready" }) !== oracle(o)) caught.push(o);
    }
    expect(caught.length).toBeGreaterThan(0);
    // ...and the specific lie the original bug told: a started, unattested vessel reading standing off a note.
    expect(caught.some((o) => o.started && !o.attested && !o.accepting)).toBe(true);
    // The real reader stays clear of every one of them.
    for (const o of caught) expect(readVesselStanding(o).state).toBe(oracle(o));
  });
});

// ── the roster: seated x threshold grid ──────────────────────────────────────────────────────────
describe("L10 roster: standing derives from seated chairs and threshold alone", () => {
  const grid: Array<{ seated: number; threshold: number }> = [];
  for (let seated = 0; seated <= 7; seated++) for (let threshold = 1; threshold <= 7; threshold++) grid.push({ seated, threshold });
  grid.push({ seated: 0, threshold: Number.MAX_SAFE_INTEGER });

  test("VACUITY: the grid reaches unseated, fragile and tolerant", () => {
    const kinds = new Set(grid.map((g) => (g.seated <= 0 ? "unseated" : g.seated - g.threshold > 0 ? "tolerant" : "fragile")));
    expect(kinds).toEqual(new Set(["unseated", "tolerant", "fragile"]));
  });

  test("every pair maps to the one verdict the arithmetic gives", () => {
    for (const g of grid) {
      const r = rosterStanding(g);
      const seated = g.seated > 0;
      const tolerance = seated ? Math.max(0, g.seated - g.threshold) : 0;
      expect(r.seated, JSON.stringify(g)).toBe(seated);
      expect(r.tolerance, JSON.stringify(g)).toBe(tolerance);
      expect(r.fragile, JSON.stringify(g)).toBe(seated && tolerance === 0);
    }
  });

  test("every reading names its arithmetic: threshold of seated, the cure when fragile, and an unseated roster as unseated", () => {
    for (const g of grid) {
      const r = rosterStanding(g);
      if (!r.seated) { expect(r.reading, JSON.stringify(g)).toMatch(/no kahu|nobody|unseated/i); continue; }
      expect(r.reading, JSON.stringify(g)).toContain(`${g.threshold} of ${g.seated}`);
      if (r.fragile) expect(r.reading, JSON.stringify(g)).toMatch(/one more seat|another seat/i);
    }
  });

  test("an unseated roster reads unseated and never fragile, whatever the threshold", () => {
    for (const g of grid.filter((x) => x.seated <= 0)) {
      const r = rosterStanding(g);
      expect(r.fragile).toBe(false);
      expect(r.seated).toBe(false);
    }
  });

  test("SEED: two over two survive none; three over two survive one; lone chair fragile", () => {
    expect(rosterStanding({ seated: 2, threshold: 2 })).toMatchObject({ tolerance: 0, fragile: true });
    expect(rosterStanding({ seated: 3, threshold: 2 })).toMatchObject({ tolerance: 1, fragile: false });
    expect(rosterStanding({ seated: 1, threshold: 1 })).toMatchObject({ tolerance: 0, fragile: true });
    expect(rosterStanding({ seated: 5, threshold: 3 }).tolerance).toBe(2);
  });

  test("CONTROL: a reader that counts the fail-closed threshold as fragile reads wrong on the unseated seed", () => {
    const naive = (r: { seated: number; threshold: number }) => r.seated - r.threshold <= 0;
    const unseated = { seated: 0, threshold: Number.MAX_SAFE_INTEGER };
    expect(naive(unseated)).toBe(true);
    expect(rosterStanding(unseated).fragile).toBe(false);
  });
});

// ── the phase: own seats x foreign seats grid ────────────────────────────────────────────────────
describe("L10 phase: a Nexus reads only from a foreign seat in the charter", () => {
  const grid: Array<{ ownSeats: number; foreignSeats: number }> = [];
  for (let ownSeats = 0; ownSeats <= 4; ownSeats++) for (let foreignSeats = 0; foreignSeats <= 4; foreignSeats++) grid.push({ ownSeats, foreignSeats });

  test("VACUITY: the grid reaches both phases", () => {
    expect(new Set(grid.map((g) => (g.foreignSeats >= 1 ? "nexus" : "seed")))).toEqual(new Set(["nexus", "seed"]));
  });

  test("every pair maps to one phase, and isNexus follows the phase", () => {
    for (const g of grid) {
      const p = nexusPhase(g);
      const want = g.foreignSeats >= 1 ? "nexus" : "seed";
      expect(p.phase, JSON.stringify(g)).toBe(want);
      expect(p.isNexus, JSON.stringify(g)).toBe(want === "nexus");
    }
  });

  test("CONTROL: counting own seats alone would read a lone vessel as a Nexus", () => {
    const naive = (g: { ownSeats: number }) => g.ownSeats >= 2;
    expect(naive({ ownSeats: 3 })).toBe(true);
    expect(nexusPhase({ ownSeats: 3, foreignSeats: 0 }).isNexus).toBe(false);
  });
});

// ── the re-pave: sources x before x after grid ───────────────────────────────────────────────────
describe("L10 re-pave: the verdict reads off counts, never off a clean exit", () => {
  const nums = [0, 1, 7, 40299];
  const grid: Array<{ sources: number; before: number; after: number }> = [];
  for (const sources of [0, 1, 1030]) for (const before of nums) for (const after of nums) grid.push({ sources, before, after });

  function want(g: { sources: number; before: number; after: number }): { ok: boolean; state: string } {
    if (g.after < g.before) return { ok: false, state: "shrank" };
    if (g.sources === 0) return { ok: true, state: "empty" };
    if (g.after === 0) return { ok: false, state: "barren" };
    return { ok: true, state: "landed" };
  }

  test("VACUITY: the grid reaches all four states", () => {
    expect(new Set(grid.map((g) => want(g).state))).toEqual(new Set(["shrank", "empty", "barren", "landed"]));
  });

  test("every count triple maps to the one verdict the oracle gives", () => {
    for (const g of grid) {
      const v = repaveVerdict(g);
      expect({ ok: v.ok, state: v.state }, JSON.stringify(g)).toEqual(want(g));
      expect(v.why.length).toBeGreaterThan(0);
      // A refusal names the count a person checks at a glance: the sources that landed nothing, the corpus it shrank from.
      const named = (n: number) => new RegExp(`${n}|${n.toLocaleString("en-US")}`);
      if (v.state === "barren") expect(v.why, JSON.stringify(g)).toMatch(named(g.sources));
      if (v.state === "shrank") expect(v.why, JSON.stringify(g)).toMatch(named(g.before));
    }
  });

  test("SEED: sources with nothing landed read barren; no sources read honest empty; a shrink refuses", () => {
    expect(repaveVerdict({ sources: 1030, before: 0, after: 0 }).state).toBe("barren");
    expect(repaveVerdict({ sources: 0, before: 0, after: 0 })).toMatchObject({ ok: true, state: "empty" });
    expect(repaveVerdict({ sources: 1030, before: 40299, after: 12000 }).ok).toBe(false);
  });

  test("CONTROL: an exit-code reader (always clean) reads barren as ok, which the law rejects", () => {
    const exitReader = () => true;
    const g = { sources: 1030, before: 0, after: 0 };
    expect(exitReader()).not.toBe(repaveVerdict(g).ok);
  });
});
