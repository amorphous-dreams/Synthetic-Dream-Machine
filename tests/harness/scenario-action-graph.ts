/**
 * Pure, test-only agency records.
 *
 * The graph deliberately does not import ScenarioPresence or any runtime. Its
 * string references are checked only for graph shape and causal consistency;
 * adapters may later join them to a cast and prove capabilities separately.
 */

export type ScenarioActivityPhase = "planned" | "dispatched" | "completed";
export type ScenarioAppraisalVerdict =
  | "accepted"
  | "deferred"
  | "unsettled"
  | "unavailable"
  | "rejected";

export interface ScenarioScope {
  readonly actionIds: readonly string[];
  readonly subjectDigests: readonly string[];
}

export interface ScenarioMandate {
  readonly id: string;
  readonly logicalActionId: string;
  readonly author: string;
  readonly delegate?: string;
  readonly subject: string;
  readonly subjectDigest: string;
  readonly scope: ScenarioScope;
  readonly attestationRequired?: boolean;
  /** Display-only fiction/persona text. It never participates in appraisal. */
  readonly label?: string;
}

export interface ScenarioDelegation {
  readonly id: string;
  readonly grantor: string;
  readonly delegate: string;
  readonly parentMandateId: string;
  readonly scope: ScenarioScope;
  readonly evidence?: ScenarioEvidence;
}

export interface ScenarioWithdrawal {
  readonly id: string;
  readonly delegationId: string;
  readonly issuer: string;
  readonly causalParents: readonly string[];
  readonly evidence?: ScenarioEvidence;
}

export interface ScenarioActivity {
  readonly id: string;
  /** Retries share this logical action while remaining distinct attempts by `id`. */
  readonly logicalActionId: string;
  readonly mandateId: string;
  readonly delegationId?: string;
  /** Responsible principal and executing workload are separate identities. */
  readonly responsible: string;
  readonly workload: string;
  readonly subject: string;
  readonly subjectDigest: string;
  readonly causalParents: readonly string[];
  readonly phase: ScenarioActivityPhase;
  readonly resultId?: string;
  readonly label?: string;
}

export interface ScenarioResult {
  readonly id: string;
  readonly activityId: string;
  readonly subject: string;
  readonly subjectDigest: string;
  readonly digest: string;
  readonly kind?: "value" | "receipt";
}

export interface ScenarioAttestation {
  readonly id: string;
  readonly issuer: string;
  readonly activityId: string;
  readonly subject: string;
  readonly subjectDigest: string;
  readonly evidence?: ScenarioEvidence;
}

export interface ScenarioEvidence {
  readonly kind: string;
  readonly ref?: string;
}

/**
 * An intentionally emitted record at a vessel, authority, or federation edge.
 * Evidence is opaque here; a runtime adapter may verify signatures later.
 * Internal helper work does not need a crossing record.
 */
export interface ScenarioBoundaryCrossing {
  readonly id: string;
  readonly mandateId: string;
  readonly activityId: string;
  readonly delegationId?: string;
  readonly capabilityEvidence?: ScenarioEvidence;
  readonly signatureEvidence?: ScenarioEvidence;
  readonly rootPrincipal: string;
  readonly immediateDelegator: string;
  readonly actingProcess: string;
  readonly sourceVessel: string;
  readonly causalParents: readonly string[];
  readonly resultId?: string;
  /** An optional projection of the externally observed outcome for concurrency checks. */
  readonly outcomeDigest?: string;
}

export type ScenarioCrossingReceipt = ScenarioBoundaryCrossing;

export interface ScenarioAppraisal {
  readonly id: string;
  readonly activityId: string;
  readonly verdict: ScenarioAppraisalVerdict;
  readonly reason: string;
}

export interface ScenarioActionGraph {
  readonly mandates: readonly ScenarioMandate[];
  readonly delegations: readonly ScenarioDelegation[];
  readonly withdrawals: readonly ScenarioWithdrawal[];
  readonly activities: readonly ScenarioActivity[];
  readonly results: readonly ScenarioResult[];
  readonly attestations: readonly ScenarioAttestation[];
  readonly crossings: readonly ScenarioBoundaryCrossing[];
}

function requireText(value: string, label: string): void {
  if (!value) throw new Error(`scenario action graph ${label} must be non-empty`);
}

function unique(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`scenario action graph duplicate ${label} "${value}"`);
    seen.add(value);
  }
}

function validateScope(scope: ScenarioScope, label: string): void {
  unique(scope.actionIds, `${label} action id`);
  unique(scope.subjectDigests, `${label} subject digest`);
  for (const actionId of scope.actionIds) requireText(actionId, `${label} action id`);
  for (const digest of scope.subjectDigests) requireText(digest, `${label} subject digest`);
}

function subset(values: readonly string[], allowed: readonly string[]): boolean {
  const set = new Set(allowed);
  return values.every((value) => set.has(value));
}

function findById<T extends { readonly id: string }>(values: readonly T[], id: string): T | undefined {
  return values.find((value) => value.id === id);
}

function cloneEvidence(evidence: ScenarioEvidence | undefined): ScenarioEvidence | undefined {
  return evidence ? { ...evidence } : undefined;
}

/** Validate and copy pure graph data. Missing references remain representable for `unavailable`. */
export function defineScenarioActionGraph(input: ScenarioActionGraph): ScenarioActionGraph {
  validateScenarioActionGraph(input);
  return {
    mandates: input.mandates.map((record) => ({ ...record, scope: { ...record.scope, actionIds: [...record.scope.actionIds], subjectDigests: [...record.scope.subjectDigests] } })),
    delegations: input.delegations.map((record) => ({ ...record, scope: { ...record.scope, actionIds: [...record.scope.actionIds], subjectDigests: [...record.scope.subjectDigests] } })),
    withdrawals: input.withdrawals.map((record) => ({ ...record, causalParents: [...record.causalParents] })),
    activities: input.activities.map((record) => ({ ...record, causalParents: [...record.causalParents] })),
    results: input.results.map((record) => ({ ...record })),
    attestations: input.attestations.map((record) => ({ ...record })),
    crossings: input.crossings.map((record) => ({
      ...record,
      capabilityEvidence: cloneEvidence(record.capabilityEvidence),
      signatureEvidence: cloneEvidence(record.signatureEvidence),
      causalParents: [...record.causalParents],
    })),
  };
}

export function validateScenarioActionGraph(input: ScenarioActionGraph): void {
  const recordIds: string[] = [];
  for (const mandate of input.mandates) {
    requireText(mandate.id, "mandate id");
    requireText(mandate.logicalActionId, `mandate "${mandate.id}" logical action id`);
    requireText(mandate.author, `mandate "${mandate.id}" author`);
    requireText(mandate.subject, `mandate "${mandate.id}" subject`);
    requireText(mandate.subjectDigest, `mandate "${mandate.id}" subject digest`);
    if (mandate.delegate === mandate.author) throw new Error(`scenario action graph mandate "${mandate.id}" merges author and delegate`);
    validateScope(mandate.scope, `mandate "${mandate.id}" scope`);
    recordIds.push(mandate.id);
  }
  for (const delegation of input.delegations) {
    requireText(delegation.id, "delegation id");
    requireText(delegation.grantor, `delegation "${delegation.id}" grantor`);
    requireText(delegation.delegate, `delegation "${delegation.id}" delegate`);
    requireText(delegation.parentMandateId, `delegation "${delegation.id}" parent mandate`);
    if (delegation.grantor === delegation.delegate) throw new Error(`scenario action graph delegation "${delegation.id}" merges grantor and delegate`);
    validateScope(delegation.scope, `delegation "${delegation.id}" scope`);
    recordIds.push(delegation.id);
  }
  for (const withdrawal of input.withdrawals) {
    requireText(withdrawal.id, "withdrawal id");
    requireText(withdrawal.delegationId, `withdrawal "${withdrawal.id}" delegation`);
    requireText(withdrawal.issuer, `withdrawal "${withdrawal.id}" issuer`);
    unique(withdrawal.causalParents, `withdrawal "${withdrawal.id}" causal parent`);
    recordIds.push(withdrawal.id);
  }
  for (const activity of input.activities) {
    requireText(activity.id, "activity id");
    requireText(activity.logicalActionId, `activity "${activity.id}" logical action id`);
    requireText(activity.mandateId, `activity "${activity.id}" mandate`);
    requireText(activity.responsible, `activity "${activity.id}" responsible principal`);
    requireText(activity.workload, `activity "${activity.id}" workload`);
    requireText(activity.subject, `activity "${activity.id}" subject`);
    requireText(activity.subjectDigest, `activity "${activity.id}" subject digest`);
    if (activity.responsible === activity.workload) throw new Error(`scenario action graph activity "${activity.id}" merges responsible and workload`);
    unique(activity.causalParents, `activity "${activity.id}" causal parent`);
    recordIds.push(activity.id);
  }
  for (const result of input.results) {
    requireText(result.id, "result id");
    requireText(result.activityId, `result "${result.id}" activity`);
    requireText(result.subject, `result "${result.id}" subject`);
    requireText(result.subjectDigest, `result "${result.id}" subject digest`);
    requireText(result.digest, `result "${result.id}" digest`);
    recordIds.push(result.id);
  }
  for (const attestation of input.attestations) {
    requireText(attestation.id, "attestation id");
    requireText(attestation.issuer, `attestation "${attestation.id}" issuer`);
    requireText(attestation.activityId, `attestation "${attestation.id}" activity`);
    requireText(attestation.subject, `attestation "${attestation.id}" subject`);
    requireText(attestation.subjectDigest, `attestation "${attestation.id}" subject digest`);
    recordIds.push(attestation.id);
  }
  for (const crossing of input.crossings) {
    requireText(crossing.id, "boundary crossing id");
    requireText(crossing.mandateId, `boundary crossing "${crossing.id}" mandate`);
    requireText(crossing.activityId, `boundary crossing "${crossing.id}" activity`);
    requireText(crossing.rootPrincipal, `boundary crossing "${crossing.id}" root principal`);
    requireText(crossing.immediateDelegator, `boundary crossing "${crossing.id}" immediate delegator`);
    requireText(crossing.actingProcess, `boundary crossing "${crossing.id}" acting process`);
    requireText(crossing.sourceVessel, `boundary crossing "${crossing.id}" source vessel`);
    unique(crossing.causalParents, `boundary crossing "${crossing.id}" causal parent`);
    recordIds.push(crossing.id);
  }
  unique(recordIds, "record id");
}

function causalParentsFor(graph: ScenarioActionGraph, id: string): readonly string[] | undefined {
  const activity = findById(graph.activities, id);
  if (activity) return activity.causalParents;
  const withdrawal = findById(graph.withdrawals, id);
  if (withdrawal) return withdrawal.causalParents;
  return findById(graph.crossings, id)?.causalParents;
}

function causallyPrecedes(graph: ScenarioActionGraph, ancestor: string, descendant: string): boolean {
  const seen = new Set<string>();
  const pending = [...(causalParentsFor(graph, descendant) ?? [])];
  while (pending.length > 0) {
    const parentId = pending.pop()!;
    if (parentId === ancestor) return true;
    if (seen.has(parentId)) continue;
    seen.add(parentId);
    pending.push(...(causalParentsFor(graph, parentId) ?? []));
  }
  return false;
}

function hasCompleteCausalAncestry(
  graph: ScenarioActionGraph,
  id: string,
  active = new Set<string>(),
  memo = new Map<string, boolean>(),
): boolean {
  const remembered = memo.get(id);
  if (remembered !== undefined) return remembered;
  if (active.has(id)) return false;
  const parents = causalParentsFor(graph, id);
  if (parents === undefined) {
    memo.set(id, false);
    return false;
  }
  const next = new Set(active).add(id);
  const complete = parents.every((parentId) => hasCompleteCausalAncestry(graph, parentId, next, memo));
  memo.set(id, complete);
  return complete;
}

function activityAuthorityIsValid(graph: ScenarioActionGraph, activity: ScenarioActivity): boolean {
  const mandate = findById(graph.mandates, activity.mandateId);
  if (!mandate || activity.responsible !== mandate.author ||
      activity.subject !== mandate.subject || activity.subjectDigest !== mandate.subjectDigest ||
      !mandate.scope.actionIds.includes(activity.logicalActionId) ||
      !mandate.scope.subjectDigests.includes(activity.subjectDigest)) return false;
  const delegation = activity.delegationId ? findById(graph.delegations, activity.delegationId) : undefined;
  if (activity.delegationId && !delegation) return false;
  if (mandate.delegate) {
    const parent = delegation ? findById(graph.mandates, delegation.parentMandateId) : undefined;
    return Boolean(delegation && parent && delegation.parentMandateId === mandate.id &&
      delegation.grantor === mandate.author && delegation.delegate === mandate.delegate &&
      activity.workload === delegation.delegate &&
      subset(delegation.scope.actionIds, parent.scope.actionIds) &&
      subset(delegation.scope.subjectDigests, parent.scope.subjectDigests) &&
      delegation.scope.actionIds.includes(activity.logicalActionId) &&
      delegation.scope.subjectDigests.includes(activity.subjectDigest));
  }
  return !delegation;
}

/** Complete local eligibility for a sibling result to influence conflict appraisal. */
function activityMayContributeCompetingOutcome(graph: ScenarioActionGraph, activity: ScenarioActivity): boolean {
  if (!activityAuthorityIsValid(graph, activity)) return false;
  if (!activity.causalParents.every((parentId) => hasCompleteCausalAncestry(graph, parentId))) return false;
  const mandate = findById(graph.mandates, activity.mandateId)!;
  const result = activity.resultId ? findById(graph.results, activity.resultId) : undefined;
  if (!result || result.activityId !== activity.id || result.subject !== activity.subject || result.subjectDigest !== activity.subjectDigest) return false;
  if (mandate.attestationRequired && !graph.attestations.some((attestation) =>
    attestation.activityId === activity.id &&
    attestation.subject === activity.subject &&
    attestation.subjectDigest === activity.subjectDigest)) return false;
  const delegation = activity.delegationId ? findById(graph.delegations, activity.delegationId) : undefined;
  if (!delegation) return true;
  for (const withdrawal of graph.withdrawals.filter((candidate) => candidate.delegationId === delegation.id)) {
    if (withdrawal.issuer !== delegation.grantor ||
        !withdrawal.causalParents.every((parentId) => hasCompleteCausalAncestry(graph, parentId))) return false;
    const withdrawalBeforeActivity = causallyPrecedes(graph, withdrawal.id, activity.id);
    const activityBeforeWithdrawal = causallyPrecedes(graph, activity.id, withdrawal.id);
    if (withdrawalBeforeActivity || !activityBeforeWithdrawal || activity.phase === "planned") return false;
  }
  return true;
}

function crossingIsAdmissible(graph: ScenarioActionGraph, crossing: ScenarioBoundaryCrossing): boolean {
  const activity = findById(graph.activities, crossing.activityId);
  const mandate = findById(graph.mandates, crossing.mandateId);
  if (!activity || !mandate || !activityMayContributeCompetingOutcome(graph, activity) ||
      crossing.mandateId !== activity.mandateId || crossing.rootPrincipal !== mandate.author ||
      crossing.actingProcess !== activity.workload || crossing.immediateDelegator === "" ||
      crossing.sourceVessel === "" || crossing.delegationId !== activity.delegationId ||
      !crossing.capabilityEvidence?.kind || !crossing.capabilityEvidence.ref ||
      !crossing.signatureEvidence?.kind || !crossing.signatureEvidence.ref ||
      !crossing.causalParents.every((parentId) => hasCompleteCausalAncestry(graph, parentId))) return false;
  const delegation = activity.delegationId ? findById(graph.delegations, activity.delegationId) : undefined;
  if (crossing.immediateDelegator !== (delegation?.grantor ?? mandate.author)) return false;
  const result = crossing.resultId ? findById(graph.results, crossing.resultId) : undefined;
  if (crossing.resultId && (!result || result.activityId !== activity.id || result.subject !== activity.subject ||
      result.subjectDigest !== activity.subjectDigest ||
      (crossing.outcomeDigest !== undefined && crossing.outcomeDigest !== result.digest))) return false;
  return true;
}

function appraisal(id: string, activityId: string, verdict: ScenarioAppraisalVerdict, reason: string): ScenarioAppraisal {
  return { id, activityId, verdict, reason };
}

/** Return a local verdict without mutating or resolving any runtime authority. */
export function appraiseScenarioActivity(graph: ScenarioActionGraph, activityId: string): ScenarioAppraisal {
  const appraisalId = `appraisal:${activityId}`;
  const activity = findById(graph.activities, activityId);
  if (!activity) return appraisal(appraisalId, activityId, "unavailable", "activity is absent");

  const mandate = findById(graph.mandates, activity.mandateId);
  if (!mandate) return appraisal(appraisalId, activityId, "unavailable", "mandate parent is absent");
  for (const parentId of activity.causalParents) {
    if (!causalParentsFor(graph, parentId)) {
      return appraisal(appraisalId, activityId, "unavailable", `causal parent "${parentId}" is absent`);
    }
  }
  if (activity.responsible !== mandate.author) {
    return appraisal(appraisalId, activityId, "rejected", "activity responsible principal does not match mandate author");
  }
  if (activity.subject !== mandate.subject || activity.subjectDigest !== mandate.subjectDigest) {
    return appraisal(appraisalId, activityId, "rejected", "activity subject or digest changed from its mandate");
  }
  if (!mandate.scope.actionIds.includes(activity.logicalActionId) || !mandate.scope.subjectDigests.includes(activity.subjectDigest)) {
    return appraisal(appraisalId, activityId, "rejected", "activity exceeds mandate scope");
  }

  const delegation = activity.delegationId ? findById(graph.delegations, activity.delegationId) : undefined;
  if (activity.delegationId && !delegation) return appraisal(appraisalId, activityId, "unavailable", "delegation parent is absent");
  if (mandate.delegate && !delegation) {
    return appraisal(appraisalId, activityId, "rejected", "mandate delegate requires a matching delegation");
  }
  if (!mandate.delegate && delegation) {
    return appraisal(appraisalId, activityId, "rejected", "delegation is absent from the mandate envelope");
  }
  if (delegation) {
    const parent = findById(graph.mandates, delegation.parentMandateId);
    if (!parent) return appraisal(appraisalId, activityId, "unavailable", "delegation mandate parent is absent");
    if (delegation.parentMandateId !== mandate.id || delegation.grantor !== mandate.author || delegation.delegate !== mandate.delegate) {
      return appraisal(appraisalId, activityId, "rejected", "delegation grantor and delegate do not match the mandate");
    }
    if (!subset(delegation.scope.actionIds, parent.scope.actionIds) || !subset(delegation.scope.subjectDigests, parent.scope.subjectDigests)) {
      return appraisal(appraisalId, activityId, "rejected", "delegation scope widens its parent mandate");
    }
    if (!delegation.scope.actionIds.includes(activity.logicalActionId) || !delegation.scope.subjectDigests.includes(activity.subjectDigest)) {
      return appraisal(appraisalId, activityId, "rejected", "activity exceeds delegation scope");
    }
    if (activity.workload !== delegation.delegate) return appraisal(appraisalId, activityId, "rejected", "activity workload is outside delegation");
    const withdrawals = graph.withdrawals.filter((withdrawal) => withdrawal.delegationId === delegation.id);
    for (const withdrawal of withdrawals) {
      if (withdrawal.issuer !== delegation.grantor) {
        return appraisal(appraisalId, activityId, "rejected", "withdrawal issuer does not match delegation grantor");
      }
      for (const parentId of withdrawal.causalParents) {
        if (!causalParentsFor(graph, parentId)) {
          return appraisal(appraisalId, activityId, "unavailable", `withdrawal causal parent "${parentId}" is absent`);
        }
      }
      const withdrawalBeforeActivity = causallyPrecedes(graph, withdrawal.id, activity.id);
      const activityBeforeWithdrawal = causallyPrecedes(graph, activity.id, withdrawal.id);
      if (withdrawalBeforeActivity) {
        return appraisal(appraisalId, activityId, "rejected", "withdrawal causally precedes dispatch");
      }
      if (!activityBeforeWithdrawal || activity.phase === "planned") {
        return appraisal(appraisalId, activityId, "unsettled", "withdrawal and dispatch have no settled causal order");
      }
    }
  }

  const result = activity.resultId ? findById(graph.results, activity.resultId) : undefined;
  if (activity.resultId && !result) return appraisal(appraisalId, activityId, "unavailable", "result parent is absent");
  if (result && (result.activityId !== activity.id || result.subject !== activity.subject || result.subjectDigest !== activity.subjectDigest)) {
    return appraisal(appraisalId, activityId, "rejected", "result subject or digest changed from its activity");
  }
  if (mandate.attestationRequired) {
    const matching = graph.attestations.some((attestation) =>
      attestation.activityId === activity.id &&
      attestation.subject === activity.subject &&
      attestation.subjectDigest === activity.subjectDigest,
    );
    if (!matching) {
      const hasWrong = graph.attestations.some((attestation) => attestation.activityId === activity.id);
      return appraisal(appraisalId, activityId, hasWrong ? "rejected" : "unavailable", hasWrong ? "attestation subject or digest is wrong" : "required attestation is absent");
    }
  }

  const crossings = graph.crossings.filter((crossing) => crossing.activityId === activity.id);
  for (const crossing of crossings) {
    for (const parentId of crossing.causalParents) {
      if (!hasCompleteCausalAncestry(graph, parentId)) {
        return appraisal(appraisalId, activityId, "unavailable", `boundary crossing causal parent "${parentId}" is absent`);
      }
    }
    if (!crossing.capabilityEvidence?.kind || !crossing.capabilityEvidence.ref ||
        !crossing.signatureEvidence?.kind || !crossing.signatureEvidence.ref) {
      return appraisal(appraisalId, activityId, "unavailable", "boundary crossing evidence is absent");
    }
    if (crossing.mandateId !== mandate.id || crossing.rootPrincipal !== mandate.author ||
        crossing.activityId !== activity.id || crossing.actingProcess !== activity.workload ||
        crossing.sourceVessel === "") {
      return appraisal(appraisalId, activityId, "rejected", "boundary crossing binding does not match mandate or activity");
    }
    if (crossing.delegationId !== activity.delegationId) {
      return appraisal(appraisalId, activityId, "rejected", "boundary crossing delegation does not match activity");
    }
    if (crossing.immediateDelegator !== (delegation?.grantor ?? mandate.author)) {
      return appraisal(appraisalId, activityId, "rejected", "boundary crossing immediate delegator does not match authority");
    }
    if (crossing.resultId !== undefined) {
      if (!result || crossing.resultId !== result.id) {
        return appraisal(appraisalId, activityId, result ? "rejected" : "unavailable", "boundary crossing result binding is absent or wrong");
      }
      if (crossing.outcomeDigest !== undefined && crossing.outcomeDigest !== result.digest) {
        return appraisal(appraisalId, activityId, "rejected", "boundary crossing outcome does not match result");
      }
    }
  }

  for (const crossing of crossings) {
    if (crossing.outcomeDigest === undefined) continue;
    for (const other of graph.crossings) {
      if (other.id === crossing.id || other.outcomeDigest === undefined) continue;
      const otherActivity = findById(graph.activities, other.activityId);
      if (!otherActivity || otherActivity.logicalActionId !== activity.logicalActionId || crossing.outcomeDigest === other.outcomeDigest) continue;
      if (!crossingIsAdmissible(graph, other)) continue;
      if (!causallyPrecedes(graph, crossing.id, other.id) && !causallyPrecedes(graph, other.id, crossing.id)) {
        return appraisal(appraisalId, activityId, "unsettled", "concurrent boundary crossings have conflicting outcomes");
      }
    }
  }

  for (const other of graph.activities) {
    if (other.id === activity.id || other.logicalActionId !== activity.logicalActionId) continue;
    if (!activityMayContributeCompetingOutcome(graph, other)) continue;
    const otherCrossings = graph.crossings.filter((crossing) => crossing.activityId === other.id);
    if (otherCrossings.length > 0 && !otherCrossings.some((crossing) => crossingIsAdmissible(graph, crossing))) continue;
    const otherResult = other.resultId ? findById(graph.results, other.resultId) : undefined;
    if (!result || !otherResult || result.digest === otherResult.digest) continue;
    if (!causallyPrecedes(graph, activity.id, other.id) && !causallyPrecedes(graph, other.id, activity.id)) {
      return appraisal(appraisalId, activityId, "unsettled", "concurrent activities have conflicting results");
    }
  }

  if (!result) return appraisal(appraisalId, activityId, "deferred", "activity has no result yet");
  return appraisal(appraisalId, activityId, "accepted", "mandate, delegation, subject, result, and causal context agree");
}
