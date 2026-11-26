/**
 * hand-admits — `custody.hand.admits` owns ONE hand-code table, keyed by verb: every act a person's hand alone runs, the code
 * it refuses any other asker by, and the wing it rides. Each wing's table reads as a view of that one table, so a code changes
 * in one row and every door that refuses by it reads the change.
 *
 * Research: lar:///ha.ka.ba/kahua/memory/research/affordance-map (custody body 3, collision 1: nine refusal codes for one gate)
 */
import { describe, expect, test } from "vitest";
import { HAND_ADMITS, handCodeOf, handCodesOf, askerRefusal } from "../src/hand-refusal.js";
import { SWARM_VERB_HAND_CODES } from "../src/swarm-door.js";
import { PROMOTE_PANEL_HAND_CODES, PROMOTE_PANEL_VERBS } from "../src/promote-main-verbs.js";
import { SENSE_HAND_CODES } from "../src/sensorium-lifecycle.js";

describe("one table holds every hand code", () => {
  test("each of the ten wings answers its own code, stable as every caller reads it", () => {
    const codes = new Map<string, Set<string>>();
    for (const row of Object.values(HAND_ADMITS)) codes.set(row.wing, (codes.get(row.wing) ?? new Set()).add(row.code));
    expect(Object.fromEntries([...codes].map(([wing, set]) => [wing, [...set]]))).toEqual({
      promote: ["promote-needs-hand"], kapae: ["kapae-needs-hand"], swarm: ["swarm-needs-hand"], sense: ["sense-needs-hand"],
      shore: ["hand-act-only"], retire: ["retire-needs-hand"], "accept-loss": ["accept-loss-needs-hand"],
      share: ["share-needs-hand"], floor: ["floor-needs-hand"], "render-output": ["render-output-needs-hand"],
    });
  });

  test("a verb reads its code; a verb outside the table reads none", () => {
    expect(handCodeOf("swarm-lei-kui")).toBe("swarm-needs-hand");
    expect(handCodeOf("wiki-render-out")).toBe("render-output-needs-hand");
    expect(handCodeOf("shore take-records")).toBe("hand-act-only");
    expect(handCodeOf("wear accept-loss")).toBe("accept-loss-needs-hand");
    for (const open of ["swarm-show", "promote-prepare", "kapae-flag", "floor-status", "rite-begin", "toString", "constructor"]) expect(handCodeOf(open), open).toBeUndefined();
  });

  test("the mesh wings read as views of the one table", () => {
    expect(SWARM_VERB_HAND_CODES).toEqual(Object.fromEntries(handCodesOf("swarm")));
    expect(SENSE_HAND_CODES).toEqual(Object.fromEntries(handCodesOf("sense")));
    expect(PROMOTE_PANEL_HAND_CODES).toEqual(Object.fromEntries(PROMOTE_PANEL_VERBS.map((v) => [v, handCodeOf(v)])));
  });

  test("an arg-turned act names its verb and its turn, so no bare op word reaches a verb table", () => {
    for (const [act, row] of Object.entries(HAND_ADMITS)) {
      if (row.wing === "shore" || row.wing === "accept-loss") expect(act, act).toMatch(/^(shore|wear) [a-z-]+$/);
      else expect(act, act).toMatch(/^[a-z-]+$/);
    }
  });
});

describe("a terminal-only act reads the booked asker through the gate", () => {
  test("a hand act admits cli and tab; a terminal-only act admits cli alone", () => {
    expect(askerRefusal("cli")).toBeNull();
    expect(askerRefusal("tab")).toBeNull();
    expect(askerRefusal("cli", { terminal: true })).toBeNull();
    expect(askerRefusal("tab", { terminal: true })).toBe("hand-act-only");
    expect(askerRefusal("seat", { terminal: true })).toBe("hand-act-only");
    expect(askerRefusal("watcher", { terminal: true })).toBe("hand-unattested");
    expect(askerRefusal(undefined, { terminal: true })).toBe("hand-unattested");
  });
});
