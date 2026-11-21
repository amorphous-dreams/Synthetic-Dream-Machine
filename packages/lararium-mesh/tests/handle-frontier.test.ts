/**
 * handle-frontier — the worldline HANDLE branch-frontier. A same-session FORK (a transcript turn
 * with two children in the parentUuid turn-DAG) makes both branches derive the same `run`
 * handle → worldlineClockFor folds two timelines into one (the collision). A branch-frontier
 * component keyed into the run-handle keeps the two forks DISTINCT; a normal spawn is
 * UNAFFECTED (no frontier ⇒ the handle stays exactly `run`).
 *
 * Meme: lar:///ha.ka.ba/lararium/api/agent-worldline#name (the rhizome fork-cut)
 */

import { describe, test, expect } from "vitest";
import { deriveBranchFrontier, deriveHandle, deriveRootHandle, type BranchContext } from "../src/index.js";

const MAIN = "claude__sessXYZ.jsonl"; // a main-agent transcript: <surface>__<run>.jsonl
const SPIRIT = "Mapper__agent-abc123__run-sessXYZ.jsonl"; // a spirit: <name>__agent-<id>__run-<run>.jsonl

const root = (src: string, b?: BranchContext) => deriveRootHandle(src, deriveBranchFrontier(b));
const spirit = (src: string, b?: BranchContext) => deriveHandle(src, deriveBranchFrontier(b));
const runOf = (handle: string | null) => (handle ?? "").split(".")[0];

describe("deriveBranchFrontier — stable, order-independent, dependency-free token", () => {
  test("a single divergence uuid yields an 8-hex token", () => {
    const t = deriveBranchFrontier({ frontier: "turn-uuid-1" });
    expect(t).toMatch(/^[0-9a-f]{8}$/);
  });

  test("a head SET is order-independent (sorted before folding)", () => {
    const a = deriveBranchFrontier({ frontier: ["u1", "u2", "u3"] });
    const b = deriveBranchFrontier({ frontier: ["u3", "u1", "u2"] });
    expect(a).toBe(b);
  });

  test("distinct frontiers yield distinct tokens; absent/empty yields null", () => {
    expect(deriveBranchFrontier({ frontier: "u1" })).not.toBe(deriveBranchFrontier({ frontier: "u2" }));
    expect(deriveBranchFrontier(undefined)).toBeNull();
    expect(deriveBranchFrontier({})).toBeNull();
    expect(deriveBranchFrontier({ frontier: [] })).toBeNull();
    expect(deriveBranchFrontier({ frontier: "" })).toBeNull();
  });
});

describe("main-agent root handle — two same-session forks stop colliding", () => {
  test("no frontier ⇒ the root handle is exactly the run (unaffected); a spirit names no root", () => {
    expect(root(MAIN)).toBe("sessXYZ");
    expect(root(SPIRIT)).toBeNull();
  });

  test("two forks of ONE session derive DISTINCT root handles", () => {
    const forkA = root(MAIN, { frontier: "turnA" });
    const forkB = root(MAIN, { frontier: "turnB" });
    expect(forkA).not.toBe(forkB);
    // both still carry the run prefix (the branch-specific run `run~frontier`)
    expect(forkA).toMatch(/^sessXYZ~[0-9a-f]{8}$/);
  });
});

describe("spirit handle — the frontier rides the RUN component, its run follows", () => {
  test("no frontier ⇒ handle = run.agentId, run = the session (unaffected spawn)", () => {
    expect(spirit(SPIRIT)).toBe("sessXYZ.abc123");
    expect(runOf(spirit(SPIRIT))).toBe("sessXYZ");
    expect(spirit(MAIN)).toBeNull();
  });

  test("a forked session: the spirit handle and its run both branch-key", () => {
    const front = deriveBranchFrontier({ frontier: "turnA" });
    expect(spirit(SPIRIT, { frontier: "turnA" })).toBe(`sessXYZ~${front}.abc123`);
    // the run component (split on ".") carries the frontier, so the spirit attributes to the
    // branch-specific root — the same handle the main agent's root derives on that branch
    expect(runOf(spirit(SPIRIT, { frontier: "turnA" }))).toBe(root(MAIN, { frontier: "turnA" }));
  });

  test("two same-session spirit forks derive DISTINCT handles and DISTINCT runs", () => {
    const a = spirit(SPIRIT, { frontier: "turnA" });
    const b = spirit(SPIRIT, { frontier: "turnB" });
    expect(a).not.toBe(b);
    expect(runOf(a)).not.toBe(runOf(b));
  });
});
