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
    crossings: [],
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

  test("accepts an explicitly emitted crossing while leaving local activities valid without one", () => {
    const local = appraiseScenarioActivity(defined(), "activity-1");
    const crossed = appraiseScenarioActivity(defined({
      crossings: [{
        id: "crossing-1",
        mandateId: "mandate-1",
        activityId: "activity-1",
        delegationId: "delegation-1",
        capabilityEvidence: { kind: "capability", ref: "cap-1" },
        signatureEvidence: { kind: "opaque-signature", ref: "sig-1" },
        rootPrincipal: "alice",
        immediateDelegator: "alice",
        actingProcess: "agent-a",
        sourceVessel: "alice-node",
        causalParents: [],
        resultId: "result-1",
        outcomeDigest: "result-digest-1",
      }],
    }), "activity-1");

    expect(local.verdict).toBe("accepted");
    expect(crossed.verdict).toBe("accepted");
  });

  test("defensively clones crossing evidence records", () => {
    const source = graph({
      crossings: [{
        id: "crossing-clone",
        mandateId: "mandate-1",
        activityId: "activity-1",
        delegationId: "delegation-1",
        capabilityEvidence: { kind: "capability", ref: "cap-1" },
        signatureEvidence: { kind: "opaque-signature", ref: "sig-1" },
        rootPrincipal: "alice",
        immediateDelegator: "alice",
        actingProcess: "agent-a",
        sourceVessel: "alice-node",
        causalParents: [],
      }],
    });
    const result = defineScenarioActionGraph(source);

    (source.crossings[0]!.capabilityEvidence as { ref: string }).ref = "mutated-capability";
    (source.crossings[0]!.signatureEvidence as { ref: string }).ref = "mutated-signature";

    expect(result.crossings[0]!.capabilityEvidence?.ref).toBe("cap-1");
    expect(result.crossings[0]!.signatureEvidence?.ref).toBe("sig-1");
  });

  test("absent crossing evidence stays absent in the copy, never a key holding undefined", () => {
    const result = defined({
      crossings: [{
        id: "crossing-no-evidence",
        mandateId: "mandate-1",
        activityId: "activity-1",
        delegationId: "delegation-1",
        rootPrincipal: "alice",
        immediateDelegator: "alice",
        actingProcess: "agent-a",
        sourceVessel: "alice-node",
        causalParents: [],
      }],
    });

    expect("capabilityEvidence" in result.crossings[0]!).toBe(false);
    expect("signatureEvidence" in result.crossings[0]!).toBe(false);
  });

  test("returns unavailable for missing crossing evidence or causal parents", () => {
    const missingEvidence = appraiseScenarioActivity(defined({
      crossings: [{
        id: "crossing-missing-evidence",
        mandateId: "mandate-1",
        activityId: "activity-1",
        delegationId: "delegation-1",
        rootPrincipal: "alice",
        immediateDelegator: "alice",
        actingProcess: "agent-a",
        sourceVessel: "alice-node",
        causalParents: [],
      }],
    }), "activity-1");
    const missingParent = appraiseScenarioActivity(defined({
      crossings: [{
        id: "crossing-missing-parent",
        mandateId: "mandate-1",
        activityId: "activity-1",
        delegationId: "delegation-1",
        capabilityEvidence: { kind: "capability", ref: "cap-1" },
        signatureEvidence: { kind: "opaque-signature", ref: "sig-1" },
        rootPrincipal: "alice",
        immediateDelegator: "alice",
        actingProcess: "agent-a",
        sourceVessel: "alice-node",
        causalParents: ["not-arrived"],
      }],
    }), "activity-1");

    expect(missingEvidence.verdict).toBe("unavailable");
    expect(missingEvidence.reason).toMatch(/evidence/);
    expect(missingParent.verdict).toBe("unavailable");
    expect(missingParent.reason).toMatch(/causal parent/);
  });

  test("returns unavailable when a present crossing parent has a missing ancestor", () => {
    const result = appraiseScenarioActivity(defined({
      crossings: [{
        id: "crossing-child",
        mandateId: "mandate-1",
        activityId: "activity-1",
        delegationId: "delegation-1",
        capabilityEvidence: { kind: "capability", ref: "cap-1" },
        signatureEvidence: { kind: "opaque-signature", ref: "sig-1" },
        rootPrincipal: "alice",
        immediateDelegator: "alice",
        actingProcess: "agent-a",
        sourceVessel: "alice-node",
        causalParents: ["crossing-parent"],
      }, {
        id: "crossing-parent",
        mandateId: "mandate-1",
        activityId: "activity-1",
        delegationId: "delegation-1",
        capabilityEvidence: { kind: "capability", ref: "cap-parent" },
        signatureEvidence: { kind: "opaque-signature", ref: "sig-parent" },
        rootPrincipal: "alice",
        immediateDelegator: "alice",
        actingProcess: "agent-a",
        sourceVessel: "alice-node",
        causalParents: ["missing-ancestor"],
      }],
    }), "activity-1");

    expect(result.verdict).toBe("unavailable");
    expect(result.reason).toMatch(/causal parent/);
  });

  test("does not treat a causal cycle as complete ancestry", () => {
    const result = appraiseScenarioActivity(defined({
      crossings: [{
        id: "crossing-a",
        mandateId: "mandate-1",
        activityId: "activity-1",
        delegationId: "delegation-1",
        capabilityEvidence: { kind: "capability", ref: "cap-a" },
        signatureEvidence: { kind: "opaque-signature", ref: "sig-a" },
        rootPrincipal: "alice",
        immediateDelegator: "alice",
        actingProcess: "agent-a",
        sourceVessel: "alice-node",
        causalParents: ["crossing-b"],
      }, {
        id: "crossing-b",
        mandateId: "mandate-1",
        activityId: "activity-1",
        delegationId: "delegation-1",
        capabilityEvidence: { kind: "capability", ref: "cap-b" },
        signatureEvidence: { kind: "opaque-signature", ref: "sig-b" },
        rootPrincipal: "alice",
        immediateDelegator: "alice",
        actingProcess: "agent-a",
        sourceVessel: "alice-node",
        causalParents: ["crossing-a"],
      }],
    }), "activity-1");

    expect(result.verdict).toBe("unavailable");
    expect(result.reason).toMatch(/causal parent/);
  });

  test("rejects a crossing whose principal, process, delegation, or result binding is wrong", () => {
    const wrongRoot = appraiseScenarioActivity(defined({
      crossings: [{
        id: "crossing-wrong-root",
        mandateId: "mandate-1",
        activityId: "activity-1",
        delegationId: "delegation-1",
        capabilityEvidence: { kind: "capability", ref: "cap-1" },
        signatureEvidence: { kind: "opaque-signature", ref: "sig-1" },
        rootPrincipal: "bob",
        immediateDelegator: "alice",
        actingProcess: "agent-a",
        sourceVessel: "alice-node",
        causalParents: [],
      }],
    }), "activity-1");
    const wrongProcess = appraiseScenarioActivity(defined({
      crossings: [{
        id: "crossing-wrong-process",
        mandateId: "mandate-1",
        activityId: "activity-1",
        delegationId: "delegation-1",
        capabilityEvidence: { kind: "capability", ref: "cap-1" },
        signatureEvidence: { kind: "opaque-signature", ref: "sig-1" },
        rootPrincipal: "alice",
        immediateDelegator: "alice",
        actingProcess: "agent-b",
        sourceVessel: "alice-node",
        causalParents: [],
      }],
    }), "activity-1");
    const wrongResult = appraiseScenarioActivity(defined({
      crossings: [{
        id: "crossing-wrong-result",
        mandateId: "mandate-1",
        activityId: "activity-1",
        delegationId: "delegation-1",
        capabilityEvidence: { kind: "capability", ref: "cap-1" },
        signatureEvidence: { kind: "opaque-signature", ref: "sig-1" },
        rootPrincipal: "alice",
        immediateDelegator: "alice",
        actingProcess: "agent-a",
        sourceVessel: "alice-node",
        causalParents: [],
        resultId: "result-1",
        outcomeDigest: "forged-result",
      }],
    }), "activity-1");

    expect(wrongRoot.verdict).toBe("rejected");
    expect(wrongProcess.verdict).toBe("rejected");
    expect(wrongResult.verdict).toBe("rejected");
  });

  test("keeps concurrent crossing outcomes unsettled regardless of arrival order", () => {
    const crossings = [
      {
        id: "crossing-a",
        mandateId: "mandate-1",
        activityId: "activity-1",
        delegationId: "delegation-1",
        capabilityEvidence: { kind: "capability", ref: "cap-a" },
        signatureEvidence: { kind: "opaque-signature", ref: "sig-a" },
        rootPrincipal: "alice",
        immediateDelegator: "alice",
        actingProcess: "agent-a",
        sourceVessel: "alice-node",
        causalParents: [],
        outcomeDigest: "outcome-a",
      },
      {
        id: "crossing-b",
        mandateId: "mandate-1",
        activityId: "activity-1",
        delegationId: "delegation-1",
        capabilityEvidence: { kind: "capability", ref: "cap-b" },
        signatureEvidence: { kind: "opaque-signature", ref: "sig-b" },
        rootPrincipal: "alice",
        immediateDelegator: "alice",
        actingProcess: "agent-a",
        sourceVessel: "alice-node",
        causalParents: [],
        outcomeDigest: "outcome-b",
      },
    ];
    const forward = appraiseScenarioActivity(defined({ crossings }), "activity-1");
    const reverse = appraiseScenarioActivity(defined({ crossings: [...crossings].reverse() }), "activity-1");

    expect(forward.verdict).toBe("unsettled");
    expect(reverse.verdict).toBe("unsettled");
  });

  test("ignores a malformed competing crossing when appraising a valid outcome", () => {
    const valid = {
      id: "crossing-valid",
      mandateId: "mandate-1",
      activityId: "activity-1",
      delegationId: "delegation-1",
      capabilityEvidence: { kind: "capability", ref: "cap-valid" },
      signatureEvidence: { kind: "opaque-signature", ref: "sig-valid" },
      rootPrincipal: "alice",
      immediateDelegator: "alice",
      actingProcess: "agent-a",
      sourceVessel: "alice-node",
      causalParents: [],
      outcomeDigest: "outcome-valid",
    };
    const malformed = {
      ...valid,
      id: "crossing-malformed",
      rootPrincipal: "impostor",
      outcomeDigest: "outcome-forged",
    };
    const result = appraiseScenarioActivity(defined({ crossings: [valid, malformed] }), "activity-1");

    expect(result.verdict).toBe("rejected");
    expect(result.reason).toMatch(/binding/);
    expect(appraiseScenarioActivity(defined({ crossings: [valid] }), "activity-1").verdict).toBe("accepted");
  });

  test("ignores a crossing for an invalid sibling activity", () => {
    const siblingActivity = {
      ...graph().activities[0]!,
      id: "activity-invalid-sibling",
      responsible: "impostor",
      resultId: "result-invalid-sibling",
    };
    const siblingResult = {
      ...graph().results[0]!,
      id: "result-invalid-sibling",
      activityId: "activity-invalid-sibling",
      digest: "outcome-sibling",
    };
    const siblingCrossing = {
      id: "crossing-invalid-sibling",
      mandateId: "mandate-1",
      activityId: "activity-invalid-sibling",
      delegationId: "delegation-1",
      capabilityEvidence: { kind: "capability", ref: "cap-sibling" },
      signatureEvidence: { kind: "opaque-signature", ref: "sig-sibling" },
      rootPrincipal: "alice",
      immediateDelegator: "alice",
      actingProcess: "agent-a",
      sourceVessel: "alice-node",
      causalParents: [],
      outcomeDigest: "outcome-sibling",
    };
    const validCrossing = {
      id: "crossing-valid-sibling-test",
      mandateId: "mandate-1",
      activityId: "activity-1",
      delegationId: "delegation-1",
      capabilityEvidence: { kind: "capability", ref: "cap-valid" },
      signatureEvidence: { kind: "opaque-signature", ref: "sig-valid" },
      rootPrincipal: "alice",
      immediateDelegator: "alice",
      actingProcess: "agent-a",
      sourceVessel: "alice-node",
      causalParents: [],
      outcomeDigest: "outcome-valid",
    };
    const combined = defined({
      activities: [graph().activities[0]!, siblingActivity],
      results: [graph().results[0]!, siblingResult],
      crossings: [validCrossing, siblingCrossing],
    });

    expect(appraiseScenarioActivity(combined, "activity-1").verdict).toBe("accepted");
    expect(appraiseScenarioActivity(combined, "activity-invalid-sibling").verdict).toBe("rejected");
  });

  test("ignores a sibling whose delegation widens its mandate", () => {
    const siblingMandate = {
      ...graph().mandates[0]!,
      id: "mandate-widened-sibling",
    };
    const siblingDelegation = {
      ...graph().delegations[0]!,
      id: "delegation-widened-sibling",
      parentMandateId: "mandate-widened-sibling",
      scope: { actionIds: ["summarize-doc", "publish-doc"], subjectDigests: ["subject-digest-1"] },
    };
    const siblingActivity = {
      ...graph().activities[0]!,
      id: "activity-widened-sibling",
      mandateId: "mandate-widened-sibling",
      delegationId: "delegation-widened-sibling",
      resultId: "result-widened-sibling",
    };
    const siblingResult = {
      ...graph().results[0]!,
      id: "result-widened-sibling",
      activityId: "activity-widened-sibling",
      digest: "outcome-widened-sibling",
    };
    const siblingCrossing = {
      id: "crossing-widened-sibling",
      mandateId: "mandate-widened-sibling",
      activityId: "activity-widened-sibling",
      delegationId: "delegation-widened-sibling",
      capabilityEvidence: { kind: "capability", ref: "cap-widened" },
      signatureEvidence: { kind: "opaque-signature", ref: "sig-widened" },
      rootPrincipal: "alice",
      immediateDelegator: "alice",
      actingProcess: "agent-a",
      sourceVessel: "alice-node",
      causalParents: [],
      resultId: "result-widened-sibling",
      outcomeDigest: "outcome-widened-sibling",
    };
    const validCrossing = {
      id: "crossing-valid-widened-test",
      mandateId: "mandate-1",
      activityId: "activity-1",
      delegationId: "delegation-1",
      capabilityEvidence: { kind: "capability", ref: "cap-valid" },
      signatureEvidence: { kind: "opaque-signature", ref: "sig-valid" },
      rootPrincipal: "alice",
      immediateDelegator: "alice",
      actingProcess: "agent-a",
      sourceVessel: "alice-node",
      causalParents: [],
      outcomeDigest: "outcome-valid",
    };
    const combined = defined({
      mandates: [graph().mandates[0]!, siblingMandate],
      delegations: [graph().delegations[0]!, siblingDelegation],
      activities: [graph().activities[0]!, siblingActivity],
      results: [graph().results[0]!, siblingResult],
      crossings: [validCrossing, siblingCrossing],
    });

    expect(appraiseScenarioActivity(combined, "activity-1").verdict).toBe("accepted");
    expect(appraiseScenarioActivity(combined, "activity-widened-sibling").verdict).toBe("rejected");
  });

  test("ignores a sibling crossing bound to a foreign result record", () => {
    const siblingActivity = {
      ...graph().activities[0]!,
      id: "activity-foreign-result-sibling",
      resultId: "result-sibling",
    };
    const siblingResult = {
      ...graph().results[0]!,
      id: "result-sibling",
      activityId: "activity-foreign-result-sibling",
      digest: "outcome-foreign",
    };
    const foreignResult = {
      ...graph().results[0]!,
      id: "result-foreign",
      activityId: "unrelated-activity",
      digest: "outcome-foreign",
    };
    const siblingCrossing = {
      id: "crossing-foreign-result-sibling",
      mandateId: "mandate-1",
      activityId: "activity-foreign-result-sibling",
      delegationId: "delegation-1",
      capabilityEvidence: { kind: "capability", ref: "cap-foreign" },
      signatureEvidence: { kind: "opaque-signature", ref: "sig-foreign" },
      rootPrincipal: "alice",
      immediateDelegator: "alice",
      actingProcess: "agent-a",
      sourceVessel: "alice-node",
      causalParents: [],
      resultId: "result-foreign",
      outcomeDigest: "outcome-foreign",
    };
    const validCrossing = {
      id: "crossing-valid-foreign-result-test",
      mandateId: "mandate-1",
      activityId: "activity-1",
      delegationId: "delegation-1",
      capabilityEvidence: { kind: "capability", ref: "cap-valid" },
      signatureEvidence: { kind: "opaque-signature", ref: "sig-valid" },
      rootPrincipal: "alice",
      immediateDelegator: "alice",
      actingProcess: "agent-a",
      sourceVessel: "alice-node",
      causalParents: [],
      outcomeDigest: "outcome-valid",
    };
    const combined = defined({
      activities: [graph().activities[0]!, siblingActivity],
      results: [graph().results[0]!, siblingResult, foreignResult],
      crossings: [validCrossing, siblingCrossing],
    });

    expect(appraiseScenarioActivity(combined, "activity-1").verdict).toBe("accepted");
    expect(appraiseScenarioActivity(combined, "activity-foreign-result-sibling").verdict).toBe("rejected");
  });

  test("ignores a sibling whose activity result is absent or disagrees with its crossing", () => {
    const siblingActivity = {
      ...graph().activities[0]!,
      id: "activity-missing-result-sibling",
    };
    delete siblingActivity.resultId;
    const siblingCrossing = {
      id: "crossing-valid-result-for-missing-activity",
      mandateId: "mandate-1",
      activityId: "activity-missing-result-sibling",
      delegationId: "delegation-1",
      capabilityEvidence: { kind: "capability", ref: "cap-missing-result" },
      signatureEvidence: { kind: "opaque-signature", ref: "sig-missing-result" },
      rootPrincipal: "alice",
      immediateDelegator: "alice",
      actingProcess: "agent-a",
      sourceVessel: "alice-node",
      causalParents: [],
      resultId: "result-1",
      outcomeDigest: "result-digest-1",
    };
    const validCrossing = {
      id: "crossing-valid-result-sibling-test",
      mandateId: "mandate-1",
      activityId: "activity-1",
      delegationId: "delegation-1",
      capabilityEvidence: { kind: "capability", ref: "cap-valid" },
      signatureEvidence: { kind: "opaque-signature", ref: "sig-valid" },
      rootPrincipal: "alice",
      immediateDelegator: "alice",
      actingProcess: "agent-a",
      sourceVessel: "alice-node",
      causalParents: [],
      outcomeDigest: "outcome-valid",
    };
    const combined = defined({
      activities: [graph().activities[0]!, siblingActivity],
      crossings: [validCrossing, siblingCrossing],
    });

    expect(appraiseScenarioActivity(combined, "activity-1").verdict).toBe("accepted");
    expect(appraiseScenarioActivity(combined, "activity-missing-result-sibling").verdict).toBe("unavailable");
  });

  test("ignores a sibling without its required matching attestation", () => {
    const siblingActivity = {
      ...graph().activities[0]!,
      id: "activity-unattested-sibling",
      mandateId: "mandate-attested-sibling",
      delegationId: "delegation-attested-sibling",
      resultId: "result-unattested-sibling",
    };
    const siblingMandate = {
      ...graph().mandates[0]!,
      id: "mandate-attested-sibling",
      attestationRequired: true,
    };
    const siblingDelegation = {
      ...graph().delegations[0]!,
      id: "delegation-attested-sibling",
      parentMandateId: "mandate-attested-sibling",
    };
    const siblingResult = {
      ...graph().results[0]!,
      id: "result-unattested-sibling",
      activityId: "activity-unattested-sibling",
      digest: "outcome-unattested",
    };
    const siblingCrossing = {
      id: "crossing-unattested-sibling",
      mandateId: "mandate-attested-sibling",
      activityId: "activity-unattested-sibling",
      delegationId: "delegation-attested-sibling",
      capabilityEvidence: { kind: "capability", ref: "cap-unattested" },
      signatureEvidence: { kind: "opaque-signature", ref: "sig-unattested" },
      rootPrincipal: "alice",
      immediateDelegator: "alice",
      actingProcess: "agent-a",
      sourceVessel: "alice-node",
      causalParents: [],
      resultId: "result-unattested-sibling",
      outcomeDigest: "outcome-unattested",
    };
    const validCrossing = {
      id: "crossing-valid-attestation-test",
      mandateId: "mandate-1",
      activityId: "activity-1",
      delegationId: "delegation-1",
      capabilityEvidence: { kind: "capability", ref: "cap-valid" },
      signatureEvidence: { kind: "opaque-signature", ref: "sig-valid" },
      rootPrincipal: "alice",
      immediateDelegator: "alice",
      actingProcess: "agent-a",
      sourceVessel: "alice-node",
      causalParents: [],
      outcomeDigest: "outcome-valid",
    };
    const combined = defined({
      mandates: [graph().mandates[0]!, siblingMandate],
      delegations: [graph().delegations[0]!, siblingDelegation],
      activities: [graph().activities[0]!, siblingActivity],
      results: [graph().results[0]!, siblingResult],
      crossings: [validCrossing, siblingCrossing],
    });

    expect(appraiseScenarioActivity(combined, "activity-1").verdict).toBe("accepted");
    expect(appraiseScenarioActivity(combined, "activity-unattested-sibling").verdict).toBe("unavailable");
  });

  test("ignores a sibling dispatch causally preceded by withdrawal", () => {
    const siblingActivity = {
      ...graph().activities[0]!,
      id: "activity-withdrawn-sibling",
      resultId: "result-withdrawn-sibling",
      causalParents: ["withdrawal-sibling"],
    };
    const siblingResult = {
      ...graph().results[0]!,
      id: "result-withdrawn-sibling",
      activityId: "activity-withdrawn-sibling",
      digest: "outcome-withdrawn",
    };
    const siblingCrossing = {
      id: "crossing-withdrawn-sibling",
      mandateId: "mandate-1",
      activityId: "activity-withdrawn-sibling",
      delegationId: "delegation-1",
      capabilityEvidence: { kind: "capability", ref: "cap-withdrawn" },
      signatureEvidence: { kind: "opaque-signature", ref: "sig-withdrawn" },
      rootPrincipal: "alice",
      immediateDelegator: "alice",
      actingProcess: "agent-a",
      sourceVessel: "alice-node",
      causalParents: [],
      resultId: "result-withdrawn-sibling",
      outcomeDigest: "outcome-withdrawn",
    };
    const validCrossing = {
      id: "crossing-valid-withdrawal-test",
      mandateId: "mandate-1",
      activityId: "activity-1",
      delegationId: "delegation-1",
      capabilityEvidence: { kind: "capability", ref: "cap-valid" },
      signatureEvidence: { kind: "opaque-signature", ref: "sig-valid" },
      rootPrincipal: "alice",
      immediateDelegator: "alice",
      actingProcess: "agent-a",
      sourceVessel: "alice-node",
      causalParents: [],
      outcomeDigest: "outcome-valid",
    };
    const combined = defined({
      withdrawals: [{ id: "withdrawal-sibling", delegationId: "delegation-1", issuer: "alice", causalParents: ["activity-1"] }],
      activities: [graph().activities[0]!, siblingActivity],
      results: [graph().results[0]!, siblingResult],
      crossings: [validCrossing, siblingCrossing],
    });

    expect(appraiseScenarioActivity(combined, "activity-1").verdict).toBe("accepted");
    expect(appraiseScenarioActivity(combined, "activity-withdrawn-sibling").verdict).toBe("rejected");
  });
});
