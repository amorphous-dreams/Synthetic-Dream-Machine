/**
 * sensorium-consistency-parity — the TS↔py fixture bridge for the H⁰ organ (the RUN arc pays the
 * owed-py-twin). Reads a committed fixture the py twin produced (scripts/sensorium_consistency.py
 * behind the causal island), recomputes the SAME cases through the TS `consistencyRadius` + the
 * native stalk pseudometrics, and asserts the two bodies agree. The crossing carries DATA, never a
 * live call (web3-only law). Regenerate with:
 *   ~/.venv/bin/python3 packages/lararium-sensorium/scripts/sensorium_consistency.py fixture
 */
import { describe, expect, test } from "vitest";
import { assertSheafPlanes, SHEAF_PLANES } from "../src/sensorium-consistency.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  consistencyRadius, cosineDistance, jaccardDistance, deckardDistance,
  type PlaneRestriction, type LabeledTree,
} from "../src/sensorium-consistency.js";

interface FixtureRestriction {
  readonly plane: string;
  readonly variance: "sheaf" | "cosheaf";
  readonly value: Record<string, number>;
}
interface RadiusCase {
  readonly note: string;
  readonly restrictions: FixtureRestriction[];
  readonly stalk: { units: string[] };
  readonly expected: {
    readonly radius: number;
    readonly glues: boolean;
    readonly vacuous: boolean;
    readonly obstructionLocus: string[];
    readonly pairs: Array<{ a: string; b: string; distance: number; locus: string[]; vacuous: boolean }>;
  };
}
interface Fixture {
  readonly radiusCases: RadiusCase[];
  readonly metricCases: {
    readonly cosine: Array<{ note: string; a: number[]; b: number[]; distance: number }>;
    readonly jaccard: Array<{ note: string; a: string[]; b: string[]; distance: number }>;
    readonly deckard: Array<{ note: string; a: LabeledTree; b: LabeledTree; q: number; distance: number }>;
  };
}

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(here, "fixtures", "sensorium-consistency-parity.json"), "utf8"),
) as Fixture;

const toRestriction = (r: FixtureRestriction): PlaneRestriction =>
  ({ plane: r.plane, variance: r.variance, value: new Map(Object.entries(r.value)) });

describe("sensorium-consistency-parity — TS consistencyRadius matches the py twin", () => {
  test(`the radius verdict agrees across ${String(fixture.radiusCases.length)} cases`, () => {
    for (const c of fixture.radiusCases) {
      const v = consistencyRadius(c.restrictions.map(toRestriction), { units: c.stalk.units });
      expect(v.radius, c.note).toBeCloseTo(c.expected.radius, 9);
      expect(v.glues, c.note).toBe(c.expected.glues);
      expect(v.vacuous, c.note).toBe(c.expected.vacuous);
      expect([...v.obstructionLocus].sort(), c.note).toEqual(c.expected.obstructionLocus);
      expect(v.pairs.length, c.note).toBe(c.expected.pairs.length);
      v.pairs.forEach((p, i) => {
        const e = c.expected.pairs[i]!;
        expect(p.a, c.note).toBe(e.a);
        expect(p.b, c.note).toBe(e.b);
        expect(p.distance, c.note).toBeCloseTo(e.distance, 9);
        expect(p.vacuous, c.note).toBe(e.vacuous);
        expect([...p.locus].sort(), c.note).toEqual(e.locus);
      });
    }
  });

  test("the native stalk pseudometrics agree (cosine · jaccard · DECKARD)", () => {
    for (const c of fixture.metricCases.cosine) {
      expect(cosineDistance(c.a, c.b), c.note).toBeCloseTo(c.distance, 9);
    }
    for (const c of fixture.metricCases.jaccard) {
      expect(jaccardDistance(new Set(c.a), new Set(c.b)), c.note).toBeCloseTo(c.distance, 9);
    }
    for (const c of fixture.metricCases.deckard) {
      expect(deckardDistance(c.a, c.b, c.q), c.note).toBeCloseTo(c.distance, 9);
    }
  });
});

/**
 * THE SHEAF GUARD, TESTED AND REACHED.
 *
 * `assertSheafPlanes` states the li/ki wall: a RESTRICTION rides a sheaf plane, and nothing cosheaf leaks
 * into a cover. Coupling EXTENDS (covariant, local→global) where content · structure · form RESTRICT
 * (contravariant), so a cosheaf plane inside a restriction set is not a bad value — it is a category error
 * that would make the fuse read a coupling fact as if it narrowed.
 *
 * A census of this tree found it reached by NOTHING: no production caller, and no test either — the only
 * fully orphaned guard in the sweep. A guard nobody calls and nobody exercises states a law it cannot
 * enforce and cannot even be shown to work.
 *
 * Both halves close here: the law gets exercised, and `sensorium-cohere` (which builds the restriction
 * lists) calls it. Wiring costs nothing today — both build sites already stamp `variance: "sheaf"` — and
 * earns its keep the day a cosheaf plane reaches that list.
 */
describe("the sheaf-plane guard", () => {
  test("★ a COSHEAF plane in a restriction set REFUSES — the li/ki wall holds ★", () => {
    expect(() => assertSheafPlanes([
      { plane: "content",  variance: "sheaf",   value: 1 },
      { plane: "coupling", variance: "cosheaf", value: 2 },
    ] as never)).toThrow(/coupling|cosheaf|not a sheaf/i);
  });

  test("CONTROL — every canonical sheaf plane passes, so the guard refuses variance and not names", () => {
    expect(() => assertSheafPlanes(
      SHEAF_PLANES.map((plane) => ({ plane, variance: "sheaf", value: 1 })) as never,
    )).not.toThrow();
  });

  test("CONTROL — an EMPTY set passes: the guard judges what it is handed, never absence", () => {
    expect(() => assertSheafPlanes([])).not.toThrow();
  });

  test("★ the restriction BUILDER reaches the guard — a law nobody calls enforces nothing ★", () => {
    const cohere = readFileSync(
      join(import.meta.dirname, "..", "..", "lararium-node", "src", "sensorium-cohere.ts"), "utf8");
    const code = cohere.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    expect(code, "the cohere path builds restrictions and guards none of them").toMatch(/assertSheafPlanes\(/);
  });
});
