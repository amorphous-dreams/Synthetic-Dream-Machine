/**
 * worldline-edge — the pure prov-triple builders (spawn → Delegation, message → Communication,
 * handback → a round-closing Communication, retire → close). Descriptors only; the node shore (lararium-mempalace/worldline-kg) writes them.
 */
import { describe, test, expect } from "vitest";
import {
  delegationEdge,
  communicationEdge,
  handbackEdge,
  retireClose,
  PRED_DELEGATION,
  PRED_COMMUNICATION,
  ROUND_CLOSE,
} from "../src/index.js";

describe("delegationEdge — the SPAWN prov:Delegation triple (parent → child)", () => {
  test("carries handles, predicate, valid_from, turnKey", () => {
    const e = delegationEdge("run", "run.child", { validFrom: "2026-06-29T00:00:00Z", turnKey: "t1" });
    expect(e).toEqual({
      subject: "run",
      predicate: PRED_DELEGATION,
      object: "run.child",
      valid_from: "2026-06-29T00:00:00Z",
      turnKey: "t1",
    });
  });

  test("omits optional fields when absent (no fabricated timestamp)", () => {
    const e = delegationEdge("run", "run.child");
    expect(e).toEqual({ subject: "run", predicate: PRED_DELEGATION, object: "run.child" });
    expect("valid_from" in e).toBe(false);
  });

  test("rejects empty handles", () => {
    expect(() => delegationEdge("", "x")).toThrow();
    expect(() => delegationEdge("x", "")).toThrow();
  });

  test("carries the parent turn when a spawn follows a known event", () => {
    expect(delegationEdge("run.a", "run.a.b", { turnKey: "b0", parentKey: "a1" }).parentKey).toBe("a1");
  });
});

describe("communicationEdge — the MESSAGE prov:Communication triple (sender → recipient)", () => {
  test("the rhizome leg carries its own predicate", () => {
    const e = communicationEdge("operator", "run.grandchild", { validFrom: "2026-06-29T01:00:00Z", turnKey: "t2" });
    expect(e.predicate).toBe(PRED_COMMUNICATION);
    expect(e.subject).toBe("operator");
    expect(e.object).toBe("run.grandchild");
    expect(e.turnKey).toBe("t2");
    expect(communicationEdge("operator", "run.grandchild", { parentKey: "spawn" }).parentKey).toBe("spawn");
  });
});

describe("handbackEdge — the round-closing Communication (child → parent)", () => {
  test("rides the Communication predicate with the round mark, child as sender", () => {
    expect(handbackEdge("run.child", "run", { turnKey: "h1", parentKey: "s0" })).toEqual({
      subject: "run.child", predicate: PRED_COMMUNICATION, object: "run", turnKey: "h1", parentKey: "s0", round: ROUND_CLOSE,
    });
  });

  test("rejects empty handles", () => {
    expect(() => handbackEdge("", "run")).toThrow();
  });
});

describe("retireClose — the continuing spirit's explicit end (the spawn edge's interval close)", () => {
  test("closes the SAME parent→child Delegation edge, optional ended", () => {
    const c = retireClose("run", "run.child", "2026-06-29T02:00:00Z");
    expect(c).toEqual({ subject: "run", predicate: PRED_DELEGATION, object: "run.child", ended: "2026-06-29T02:00:00Z" });
  });

  test("ended omitted ⇒ the KG defaults it (today); not fabricated here", () => {
    const c = retireClose("run", "run.child");
    expect("ended" in c).toBe(false);
  });

  test("carries the event that precedes a retirement", () => {
    expect(retireClose("run", "run.child", undefined, "inject").parentKey).toBe("inject");
  });
});
