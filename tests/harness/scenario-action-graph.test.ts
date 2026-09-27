import { describe, expect, test } from "vitest";
import {
  appraiseScenarioActivity,
  defineScenarioActionGraph,
  type ScenarioActionGraph,
} from "./scenario-action-graph.js";

function graph(overrides: Partial<ScenarioActionGraph> = {}): ScenarioActionGraph {
  return {
    mandates: [{
      id: "mandate-1",
      logicalActionId: "summarize-doc",
      author: "alice",
      delegate: "agent-a",
      subject: "doc-1",
      subjectDigest: "subject-digest-1",
      scope: { actionIds: ["summarize-doc"], subjectDigests: ["subject-digest-1"] },
    }],
    delegations: [{
      id: "delegation-1",
      grantor: "alice",
      delegate: "agent-a",
      parentMandateId: "mandate-1",
      scope: { actionIds: ["summarize-doc"], subjectDigests: ["subject-digest-1"] },
    }],
    withdrawals: [],
    activities: [{
      id: "activity-1",
      logicalActionId: "summarize-doc",
      mandateId: "mandate-1",
      delegationId: "delegation-1",
      responsible: "alice",
      workload: "agent-a",
      subject: "doc-1",
      subjectDigest: "subject-digest-1",
      causalParents: [],
      phase: "completed",
      resultId: "result-1",
    }],
    results: [{
      id: "result-1",
      activityId: "activity-1",
      subject: "doc-1",
      subjectDigest: "subject-digest-1",
      digest: "result-digest-1",
      kind: "value",
    }],
    attestations: [],
    ...overrides,
  };
}

function defined(overrides: Partial<ScenarioActionGraph> = {}): ScenarioActionGraph {
  return defineScenarioActionGraph(graph(overrides));
}

describe("ScenarioActionGraph — separate agency records and local appraisal", () => {
  test("keeps source records distinct; appraisal is computed output", () => {
    const result = defined();

    expect(result.mandates[0]!.id).not.toBe(result.activities[0]!.id);
    expect(result.activities[0]!.resultId).not.toBe(result.activities[0]!.mandateId);
    expect(result.delegations[0]!.id).not.toBe(result.mandates[0]!.id);
    expect(result.attestations).toEqual([]);
    expect(appraiseScenarioActivity(result, "activity-1").verdict).toBe("accepted");
  });

  test("keeps source graph output-free; appraisal is computed without mutation", () => {
    const source = graph();
    const sourceSnapshot = JSON.stringify(source);
    const result = defineScenarioActionGraph(source);
    const appraisal = appraiseScenarioActivity(result, "activity-1");

    expect(appraisal.verdict).toBe("accepted");
    expect(JSON.stringify(source)).toBe(sourceSnapshot);
    expect("appraisals" in source).toBe(false);
    expect("appraisals" in result).toBe(false);
  });

  test("never merges responsible human and workload identities", () => {
    expect(() => defined({
      activities: [{ ...graph().activities[0]!, responsible: "agent-a" }],
    })).toThrow(/merges responsible and workload/);
  });

  test("requires a mandate-named delegate to travel through its matching delegation", () => {
    const omitted = { ...graph().activities[0]! };
    delete omitted.delegationId;
    const missing = appraiseScenarioActivity(defined({
      delegations: [],
      activities: [omitted],
    }), "activity-1");
    const substituted = appraiseScenarioActivity(defined({
      delegations: [{ ...graph().delegations[0]!, delegate: "agent-b" }],
    }), "activity-1");
    const wrongResponsible = appraiseScenarioActivity(defined({
      activities: [{ ...graph().activities[0]!, responsible: "bob" }],
    }), "activity-1");

    expect(missing.verdict).toBe("rejected");
    expect(missing.reason).toMatch(/requires a matching delegation/);
    expect(substituted.verdict).toBe("rejected");
    expect(substituted.reason).toMatch(/grantor and delegate/);
    expect(wrongResponsible.verdict).toBe("rejected");
    expect(wrongResponsible.reason).toMatch(/responsible principal/);
  });

  test("returns unavailable when a causal parent is missing", () => {
    const result = appraiseScenarioActivity(defined({
      activities: [{ ...graph().activities[0]!, causalParents: ["missing-parent"] }],
    }), "activity-1");

    expect(result.verdict).toBe("unavailable");
    expect(result.reason).toMatch(/causal parent/);
  });

  test("rejects a changed activity subject or digest", () => {
    const subjectChanged = appraiseScenarioActivity(defined({
      activities: [{ ...graph().activities[0]!, subject: "doc-2" }],
    }), "activity-1");
    const digestChanged = appraiseScenarioActivity(defined({
      activities: [{ ...graph().activities[0]!, subjectDigest: "subject-digest-2" }],
    }), "activity-1");

    expect(subjectChanged.verdict).toBe("rejected");
    expect(digestChanged.verdict).toBe("rejected");
  });

  test("rejects a result whose subject or digest changed from its activity", () => {
    const result = appraiseScenarioActivity(defined({
      results: [{ ...graph().results[0]!, subjectDigest: "subject-digest-2" }],
    }), "activity-1");

    expect(result.verdict).toBe("rejected");
    expect(result.reason).toMatch(/result subject or digest/);
  });

  test("rejects delegation scope widening", () => {
    const result = appraiseScenarioActivity(defined({
      delegations: [{
        ...graph().delegations[0]!,
        scope: { actionIds: ["publish-doc"], subjectDigests: ["subject-digest-1"] },
      }],
    }), "activity-1");

    expect(result.verdict).toBe("rejected");
    expect(result.reason).toMatch(/delegation scope widens/);
  });

  test("rejects an activity that exceeds a narrower delegation", () => {
    const result = appraiseScenarioActivity(defined({
      delegations: [{
        ...graph().delegations[0]!,
        scope: { actionIds: [], subjectDigests: [] },
      }],
    }), "activity-1");

    expect(result.verdict).toBe("rejected");
    expect(result.reason).toMatch(/exceeds delegation scope/);
  });

  test("keeps concurrent conflicting activities unsettled regardless of arrival order", () => {
    const activities = [
      graph().activities[0]!,
      {
        ...graph().activities[0]!,
        id: "activity-2",
        resultId: "result-2",
        causalParents: [],
      },
    ];
    const results = [
      graph().results[0]!,
      { ...graph().results[0]!, id: "result-2", activityId: "activity-2", digest: "result-digest-2" },
    ];
    const forward = defined({ activities, results });
    const reverse = defined({ activities: [...activities].reverse(), results: [...results].reverse() });

    expect(appraiseScenarioActivity(forward, "activity-1").verdict).toBe("unsettled");
    expect(appraiseScenarioActivity(forward, "activity-2").verdict).toBe("unsettled");
    expect(appraiseScenarioActivity(reverse, "activity-1").verdict).toBe("unsettled");
    expect(appraiseScenarioActivity(reverse, "activity-2").verdict).toBe("unsettled");
  });

  test("withdrawal blocks future dispatch while preserving completed activity", () => {
    const future = { ...graph().activities[0]!, id: "activity-future", phase: "planned" as const, causalParents: ["withdrawal-1"] };
    delete future.resultId;
    const withdrawn = defined({
      withdrawals: [{ id: "withdrawal-1", delegationId: "delegation-1", issuer: "alice", causalParents: ["activity-1"] }],
      activities: [graph().activities[0]!, future],
    });
    const withdrawnReverse = defined({
      withdrawals: [{ id: "withdrawal-1", delegationId: "delegation-1", issuer: "alice", causalParents: ["activity-1"] }],
      activities: [future, graph().activities[0]!],
    });

    expect(appraiseScenarioActivity(withdrawn, "activity-1").verdict).toBe("accepted");
    expect(appraiseScenarioActivity(withdrawn, "activity-future").verdict).toBe("rejected");
    expect(appraiseScenarioActivity(withdrawnReverse, "activity-1").verdict).toBe("accepted");
    expect(appraiseScenarioActivity(withdrawnReverse, "activity-future").verdict).toBe("rejected");
  });

  test("keeps concurrent withdrawal and dispatch unsettled in either arrival order", () => {
    const concurrent = { ...graph().activities[0]!, id: "activity-concurrent", phase: "dispatched" as const, causalParents: [] };
    const concurrentReverse = { ...concurrent, id: "activity-concurrent-reverse" };
    delete concurrent.resultId;
    delete concurrentReverse.resultId;
    const withdrawal = { id: "withdrawal-concurrent", delegationId: "delegation-1", issuer: "alice", causalParents: [] };
    const forward = defined({ activities: [concurrent, concurrentReverse], withdrawals: [withdrawal] });
    const reverse = defined({ activities: [concurrentReverse, concurrent], withdrawals: [withdrawal] });

    expect(appraiseScenarioActivity(forward, "activity-concurrent").verdict).toBe("unsettled");
    expect(appraiseScenarioActivity(forward, "activity-concurrent-reverse").verdict).toBe("unsettled");
    expect(appraiseScenarioActivity(reverse, "activity-concurrent").verdict).toBe("unsettled");
    expect(appraiseScenarioActivity(reverse, "activity-concurrent-reverse").verdict).toBe("unsettled");
  });

  test("returns unavailable when a withdrawal's causal evidence is missing", () => {
    const activity = { ...graph().activities[0]!, id: "activity-after-unknown-withdrawal", phase: "planned" as const, causalParents: ["withdrawal-1"] };
    delete activity.resultId;
    const result = appraiseScenarioActivity(defined({
      activities: [activity],
      withdrawals: [{ id: "withdrawal-1", delegationId: "delegation-1", issuer: "alice", causalParents: ["missing-withdrawal-parent"] }],
    }), "activity-after-unknown-withdrawal");

    expect(result.verdict).toBe("unavailable");
    expect(result.reason).toMatch(/withdrawal causal parent/);
  });

  test("rejects a withdrawal act issued by someone other than the delegation grantor", () => {
    const result = appraiseScenarioActivity(defined({
      withdrawals: [{ id: "withdrawal-1", delegationId: "delegation-1", issuer: "agent-a", causalParents: [] }],
    }), "activity-1");

    expect(result.verdict).toBe("rejected");
    expect(result.reason).toMatch(/withdrawal issuer/);
  });

  test("keeps retries as distinct attempts sharing one logical action, without versions or clocks", () => {
    const retry = {
      ...graph().activities[0]!,
      id: "activity-retry",
      resultId: "result-retry",
    };
    const retryResult = { ...graph().results[0]!, id: "result-retry", activityId: "activity-retry" };
    const result = defined({ activities: [graph().activities[0]!, retry], results: [graph().results[0]!, retryResult] });

    expect(result.activities.map((activity) => activity.id)).toEqual(["activity-1", "activity-retry"]);
    expect(result.activities[0]!.logicalActionId).toBe(result.activities[1]!.logicalActionId);
    expect("version" in result.activities[0]!).toBe(false);
    expect("timestamp" in result.activities[0]!).toBe(false);
  });

  test("requires an attestation when the mandate declares one, and rejects wrong subjects", () => {
    const missing = appraiseScenarioActivity(defined({
      mandates: [{ ...graph().mandates[0]!, attestationRequired: true }],
    }), "activity-1");
    const wrong = appraiseScenarioActivity(defined({
      mandates: [{ ...graph().mandates[0]!, attestationRequired: true }],
      attestations: [{ id: "attestation-1", issuer: "alice", activityId: "activity-1", subject: "doc-2", subjectDigest: "subject-digest-1" }],
    }), "activity-1");

    expect(missing.verdict).toBe("unavailable");
    expect(wrong.verdict).toBe("rejected");
  });

  test("fiction or persona labels do not authorize an out-of-scope activity", () => {
    const result = appraiseScenarioActivity(defined({
      mandates: [{ ...graph().mandates[0]!, label: "fiction: sovereign persona", scope: { actionIds: [], subjectDigests: [] } }],
      delegations: [{ ...graph().delegations[0]!, scope: { actionIds: [], subjectDigests: [] } }],
    }), "activity-1");

    expect(result.verdict).toBe("rejected");
    expect(result.reason).toMatch(/exceeds mandate scope/);
  });
});
