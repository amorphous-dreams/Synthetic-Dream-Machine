import { describe, expect, test } from "vitest";
import {
  delegationEdge, communicationEdge, handbackClose, deriveInjectionEdges,
  replayWorldlineEdges, worldlineCausalFromEdges, worldlineCausalSeed, worldlineSpawn, worldlineInject,
  worldlineHandback, mulberry32,
} from "../src/index.js";

const root = "run";
const a = "run.a";
const b = "run.a.b";

function fixture(spawnTime = "3000-01-01T00:00:00Z", injectTime = "1970-01-01T00:00:00Z") {
  const opens = [
    delegationEdge(root, a, { turnKey: "a0", validFrom: spawnTime }),
    communicationEdge(root, a, { turnKey: "a1", parentKey: "a0", validFrom: injectTime }),
    delegationEdge(a, b, { turnKey: "b0", parentKey: "a1", validFrom: injectTime }),
  ];
  const closes = [
    handbackClose(a, b, spawnTime, "b0"),
    handbackClose(root, a, injectTime, "a1"),
  ];
  return { opens, closes };
}

function expectedRegistry() {
  let causal = worldlineCausalSeed(root);
  causal = worldlineSpawn(causal, root, a);
  causal = worldlineInject(causal, a);
  causal = worldlineSpawn(causal, a, b);
  causal = worldlineHandback(causal, a, b);
  return worldlineHandback(causal, root, a);
}

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

describe("causal worldline replay", () => {
  test("parent links order spawn, inject, nested spawn, and handbacks across contradictory display times", () => {
    const { opens, closes } = fixture();
    const replay = replayWorldlineEdges(root, opens, closes);
    expect(replay.causal).toEqual(expectedRegistry());
    expect(replay.skipped).toEqual([]);
  });

  test("worldlineCausalFromEdges applies the inject a contradictory display time once sorted before its spawn", () => {
    const { opens, closes } = fixture();
    expect(worldlineCausalFromEdges(root, opens, closes)).toEqual(expectedRegistry());
    const swapped = fixture("1970-01-01T00:00:00Z", "3000-01-01T00:00:00Z");
    expect(worldlineCausalFromEdges(root, swapped.opens, swapped.closes)).toEqual(expectedRegistry());
  });

  test("a wide fan of spirits replays in one pass", () => {
    const opens = [], closes = [];
    for (let i = 0; i < 200; i++) {
      const child = `run.s${String(i).padStart(4, "0")}`;
      opens.push(delegationEdge(root, child, { turnKey: `s${i}` }), communicationEdge(root, child, { turnKey: `i${i}`, parentKey: `s${i}` }));
      closes.push(handbackClose(root, child, undefined, `i${i}`));
    }
    const replay = replayWorldlineEdges(root, opens, closes);
    expect(replay.skipped).toEqual([]);
  });

  test("all input permutations yield one registry", () => {
    const { opens, closes } = fixture();
    const rng = mulberry32(37);
    for (let i = 0; i < 50; i++) {
      const replay = replayWorldlineEdges(root, shuffled(opens, rng), shuffled(closes, rng));
      expect(replay.causal).toEqual(expectedRegistry());
      expect(replay.skipped).toEqual([]);
    }
  });

  test("swapping display years leaves the registry unchanged", () => {
    const first = fixture();
    const second = fixture("1970-01-01T00:00:00Z", "3000-01-01T00:00:00Z");
    expect(replayWorldlineEdges(root, first.opens, first.closes)).toEqual(replayWorldlineEdges(root, second.opens, second.closes));
  });

  test("unspawned targets and unknown parent keys announce skips", () => {
    const unknownTarget = replayWorldlineEdges(root, [communicationEdge(root, "ghost", { turnKey: "g1" })]);
    expect(unknownTarget.skipped).toMatchObject([{ op: "inject", reason: "target-unspawned" }]);
    const unknownParent = replayWorldlineEdges(root, [delegationEdge(root, a, { turnKey: "a0", parentKey: "missing" })]);
    expect(unknownParent.skipped).toMatchObject([{ op: "spawn", reason: "parent-key-unknown" }]);
  });

  test("a second distinct spawn of one child announces its collision", () => {
    const replay = replayWorldlineEdges(root, [
      delegationEdge(root, a, { turnKey: "a0" }),
      delegationEdge(root, a, { turnKey: "a2" }),
    ]);
    expect(replay.skipped).toMatchObject([{ op: "spawn", reason: "child-already-spawned" }]);
  });

  test("concurrent sibling spawns fork in content order", () => {
    const left = delegationEdge(root, a, { turnKey: "a0", validFrom: "3000" });
    const right = delegationEdge(root, "run.z", { turnKey: "z0", validFrom: "1970" });
    let expected = worldlineCausalSeed(root);
    expected = worldlineSpawn(expected, root, a);
    expected = worldlineSpawn(expected, root, "run.z");
    expect(replayWorldlineEdges(root, [right, left]).causal).toEqual(expected);
    expect(replayWorldlineEdges(root, [left, right]).causal).toEqual(expected);
  });

  test("a parent-link cycle announces every blocked event", () => {
    const replay = replayWorldlineEdges(root, [
      delegationEdge(root, a, { turnKey: "a0", parentKey: "a1" }),
      communicationEdge(root, a, { turnKey: "a1", parentKey: "a0" }),
    ]);
    expect(replay.skipped.map((s) => s.reason)).toEqual(["cycle", "cycle"]);
  });

  test("injection edges name the first user prompt as their spawn parent", () => {
    const turns = [
      { role: "user", uuid: "spawn-uuid", ts: "3000", isToolResult: false },
      { role: "assistant", uuid: "reply", ts: "3000", isToolResult: false },
      { role: "user", uuid: "inject-uuid", ts: "1970", isToolResult: false },
    ];
    expect(deriveInjectionEdges(root, a, turns)).toMatchObject([{ turnKey: "inject-uuid", parentKey: "spawn-uuid" }]);
  });
});
