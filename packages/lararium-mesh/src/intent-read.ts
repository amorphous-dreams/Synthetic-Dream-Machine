import { readIntentAdmission } from "./intent-admission.js";
/** Pure read of a face's unordered intent entries. No arrival order decides an effect. */
import { sha256HexBytesSync, utf8Bytes } from "./crypto.js";
import { isCurrentEpoch, signsAtEpoch, type HandLineage } from "./hand-lineage.js";
import { intentId, readIntentEntry, type IntentAudience, type IntentBound, type SignedIntentEntry } from "./intent-entry.js";
import { argsWithinPolicy, verbInPrefix, type DelegationBound, type DelegationCite, type DelegationPolicy } from "./intent-delegation.js";
import { issueCheck, type IntentVerbClass, type IntentVerbRegistry } from "./intent-verbs.js";

type Standing = "stands" | "aside" | "unknown";
export interface IntentReadInput {
  readonly group: string;
  readonly records: readonly unknown[];
  readonly admissions?: readonly unknown[];
  readonly face: { readonly devices: readonly string[]; readonly rosterCids: readonly string[]; readonly admittedAt: ReadonlyMap<string, string>; readonly lineage: HandLineage };
  readonly standing: (atom: string) => Standing;
  readonly holdsCapability?: (atom: string, capability: string) => boolean;
  readonly verbs: IntentVerbRegistry;
  readonly heldFrontiers?: ReadonlySet<string>;
}
export interface IntentRecord { readonly cid: string; readonly entry: SignedIntentEntry }
export interface IntentSlot {
  readonly slot: string;
  readonly winner: IntentRecord | null;
  readonly duplicates: readonly IntentRecord[];
  readonly unknownFrontier: boolean;
}
export interface IntentState {
  readonly admissions: readonly { cid: string; relay: string }[];
  readonly id: string; readonly issuer: string; readonly verb: string; readonly class: IntentVerbClass;
  readonly fenced: boolean;
  readonly audience: IntentAudience; readonly bound: IntentBound | null;
  readonly status: "open" | "answered" | "void" | "unknown-frontier";
  readonly voidCause: "superseded" | "cancelled" | "issuer-aside" | "roster-passed" | "delegation-revoked" | "delegation-closed" | "delegation-lapsed" | null;
  readonly agent: null | { readonly delegation: string; readonly status: "live" | "revoked" | "closed" | "lapsed" | "awaiting" };
  readonly asks: readonly IntentRecord[];
  readonly answer: IntentRecord | "contested" | null;
  readonly claim: IntentRecord | null;
  readonly slots: readonly IntentSlot[];
  readonly voidAfterAct: readonly IntentRecord[];
  readonly outOfAudience: readonly IntentRecord[];
  readonly claims: readonly IntentRecord[];
}
export interface IntentView {
  readonly intents: readonly IntentState[];
  readonly delegations: readonly { readonly cid: string; readonly agent: string; readonly prefix: string; readonly status: "live" | "revoked" | "closed" | "lapsed" | "awaiting" | "pending-revoke-orphan"; readonly revokedBy: string | null }[];
  readonly refused: readonly { readonly refusal: string; readonly cid?: string }[];
  readonly refusedAdmissions: readonly { readonly refusal: string }[];
  readonly strayAnswers: readonly IntentRecord[];
  readonly standing: (atom: string) => Standing;
  readonly holdsCapability: (atom: string, capability: string) => boolean;
  readonly face: IntentReadInput["face"];
}

const field = (r: IntentRecord, key: string): unknown => r.entry.body[key];
const str = (r: IntentRecord, key: string): string => field(r, key) as string;
const rank = (atom: string, key: string): string => sha256HexBytesSync(utf8Bytes(atom + key));
const sorted = (a: IntentRecord, b: IntentRecord): number => a.cid.localeCompare(b.cid);
const root = (r: IntentRecord, lineage: HandLineage): boolean => {
  return signsAtEpoch(lineage, r.entry.body.epoch, r.entry.signer);
};
const effectiveAnswer = (answers: readonly IntentRecord[]): IntentRecord | "contested" | null => {
  const tips = answers.filter((a) => !answers.some((b) => b.cid !== a.cid && b.entry.body.refs.includes(a.cid)));
  return tips.length > 1 ? "contested" : tips[0] ?? null;
};

export function readIntentPlane(input: IntentReadInput): IntentView {
  const admissions = (input.admissions ?? []).map(raw => readIntentAdmission(raw, { group: input.group }));
  const refusedAdmissions = admissions.filter((r): r is Extract<typeof r, { ok: false }> => !r.ok).map(r => ({ refusal: r.refusal }));
  const devices = new Set(input.face.devices.map((a) => a.toLowerCase()));
  const refused: { refusal: string; cid?: string }[] = [], all = new Map<string, IntentRecord>();
  for (const raw of input.records) {
    const read = readIntentEntry(raw, { group: input.group, authorize: (signer, body) =>
      ["delegate", "delegate-revoke"].includes(body.entry) ? signsAtEpoch(input.face.lineage, body.epoch, signer) :
        devices.has(signer) || (body.entry === "intent" && body.delegation !== undefined) ||
        (["release", "cancel", "supersede"].includes(body.entry) && signsAtEpoch(input.face.lineage, body.epoch, signer)) });
    if (!read.ok) { refused.push({ refusal: read.refusal }); continue; }
    all.set(read.cid, { cid: read.cid, entry: read.entry });
  }
  const entries = [...all.values()].sort(sorted);
  const byKind = (kind: string): IntentRecord[] => entries.filter((r) => r.entry.body.entry === kind);
  const held = (cite: DelegationCite): boolean => "roster" in cite ? input.face.rosterCids.includes(cite.roster) :
    "frontier" in cite ? input.heldFrontiers?.has(cite.frontier) === true : all.has(cite.control);
  const delegates = byKind("delegate"), revokes = byKind("delegate-revoke");
  const delegationStates = new Map<string, { cid: string; agent: string; prefix: string; status: "live" | "revoked" | "closed" | "lapsed" | "awaiting"; revokedBy: string | null }>();
  for (const d of delegates) {
    const b = d.entry.body, bound = b.bound as DelegationBound;
    const revoker = revokes.find((r) => r.entry.body.delegation === d.cid && (r.entry.body.epoch as number) >= (b.epoch as number));
    if (revokes.some((r) => r.entry.body.delegation === d.cid && (r.entry.body.epoch as number) < (b.epoch as number))) refused.push({ refusal: "revoke-before-delegation-epoch" });
    const status = revoker ? "revoked" : !isCurrentEpoch(input.face.lineage, b.epoch) ? "lapsed" : bound.until && held(bound.until) ? "closed" : bound.asOf && !held(bound.asOf) ? "awaiting" : "live";
    delegationStates.set(d.cid, { cid: d.cid, agent: b.agent as string, prefix: b.prefix as string, status, revokedBy: revoker?.cid ?? null });
  }
  const orphans = new Map<string, IntentView["delegations"][number]>();
  for (const r of revokes) {
    const cid = r.entry.body.delegation as string;
    if (!delegationStates.has(cid) && !orphans.has(cid)) orphans.set(cid, { cid, agent: "", prefix: "", status: "pending-revoke-orphan", revokedBy: r.cid });
  }
  const delegations: IntentView["delegations"] = [...delegationStates.values(), ...orphans.values()].sort((a, b) => a.cid.localeCompare(b.cid));
  const bodies = new Map<string, IntentRecord[]>();
  for (const r of entries.filter((e) => e.entry.body.entry === "intent")) {
    const b = r.entry.body;
    if (b.delegation !== undefined) {
      const d = delegationStates.get(b.delegation as string), grant = d && all.get(d.cid)?.entry.body;
      if (!d || !grant) { refused.push({ refusal: "delegation-unknown" }); continue; }
      if (r.entry.signer !== d.agent || b.issuer !== r.entry.signer) { refused.push({ refusal: "agent-key" }); continue; }
      if (!verbInPrefix(d.prefix, b.verb as string)) { refused.push({ refusal: "verb-outside-prefix" }); continue; }
      if (!argsWithinPolicy(grant.policy as DelegationPolicy, b.args)) { refused.push({ refusal: "args-outside-policy" }); continue; }
      if (!b.refs.includes(d.cid)) { refused.push({ refusal: "delegation-ref" }); continue; }
    } else if (b.issuer !== r.entry.signer) { refused.push({ refusal: "not-issuer" }); continue; }
    const check = issueCheck(input.verbs, b.verb as string, b.audience as IntentAudience);
    if (!check.ok) { refused.push({ refusal: check.refusal }); continue; }
    if (check.classification.class === "idempotent" && b.nonce !== "") { refused.push({ refusal: "idempotent-nonce" }); continue; }
    const id = intentId(b as unknown as { issuer: string; verb: string; args: unknown; nonce: string });
    bodies.set(id, [...(bodies.get(id) ?? []), r]);
  }
  // One id names one body: the id hashes issuer, verb, args and nonce apart from the audience, so a second body
  // under it (a re-pin, a re-target) would let cid order pick a winner. Every copy refuses and none folds.
  const intents = new Map<string, IntentRecord>();
  for (const [id, copies] of bodies) {
    if (copies.length === 1) intents.set(id, copies[0]!);
    else for (const copy of copies) refused.push({ refusal: "id-collision", cid: copy.cid });
  }
  const asks = byKind("asks"), answers = byKind("answer"), claims = byKind("claim"), takeovers = byKind("takeover"), releases = byKind("release"), cancels = byKind("cancel"), supersedes = byKind("supersede"), outcomes = byKind("outcome");
  const authorized = (r: IntentRecord, issuer: string, claimant?: string): boolean => {
    if (root(r, input.face.lineage)) return true;
    if (r.entry.body.entry === "release") return r.entry.signer === claimant;
    return r.entry.signer === issuer;
  };
  for (const r of [...releases, ...cancels, ...supersedes]) {
    const id = str(r, "intent"), intent = intents.get(id);
    if (!intent) continue;
    const ownClaims = claims.filter((c) => str(c, "intent") === id);
    const named = ownClaims.find((c) => c.cid === field(r, "claim"));
    const claimant = named?.entry.signer;
    if (!authorized(r, intent.entry.signer, claimant)) refused.push({ refusal: "not-issuer-or-root" });
  }
  const allowedControl = (r: IntentRecord, _id: string, issuer: string, claimant?: string) => authorized(r, issuer, claimant);
  const strayAnswers = answers.filter((a) => !asks.some((q) => q.cid === field(a, "ask") && intents.has(str(q, "intent"))));
  const states: IntentState[] = [];
  for (const [id, source] of [...intents].sort(([a], [b]) => a.localeCompare(b))) {
    const body = source.entry.body, issuer = body.issuer as string, audience = body.audience as IntentAudience, bound = (body.bound as IntentBound | undefined) ?? null;
    const delegation = body.delegation === undefined ? null : delegationStates.get(body.delegation as string)!;
    const agent = delegation ? { delegation: delegation.cid, status: delegation.status } : null;
    const classification = input.verbs.classOfVerb(body.verb as string)!;
    const ownAsks = asks.filter((q) => str(q, "intent") === id);
    const ownAnswers = answers.filter((a) => ownAsks.some((q) => q.cid === field(a, "ask")));
    const ownOutcomes = outcomes.filter((o) => str(o, "cause") === id);
    const answer = effectiveAnswer(ownAnswers);
    const ownClaims = claims.filter((c) => str(c, "intent") === id);
    const ownReleases = releases.filter((r) => {
      if (str(r, "intent") !== id) return false;
      const target = [...ownClaims, ...takeovers].find((c) => c.cid === field(r, "claim"));
      return allowedControl(r, id, issuer, target?.entry.signer ?? (field(r, "claim") === undefined && ownClaims.some((c) => c.entry.signer === r.entry.signer) ? r.entry.signer : undefined));
    });
    const ownCancels = cancels.filter((r) => str(r, "intent") === id && allowedControl(r, id, issuer));
    const ownSupersedes = supersedes.filter((r) => str(r, "intent") === id && allowedControl(r, id, issuer));
    let claim: IntentRecord | null = null;
    if (!ownCancels.some((r) => root(r, input.face.lineage)) && !ownReleases.some((r) => root(r, input.face.lineage))) {
      const tips = ownClaims.map((c) => {
        let tip = c;
        const seen = new Set<string>();
        while (!seen.has(tip.cid)) {
          seen.add(tip.cid);
          const next = takeovers.filter((t) => field(t, "claim") === tip.cid).sort((a, b) => rank(a.entry.signer, tip.cid).localeCompare(rank(b.entry.signer, tip.cid)) || sorted(a, b))[0];
          if (!next) break;
          tip = next;
        }
        return tip;
      });
      // A release or an outcome ends the claim its signer HOLDS at the chain's tip; a claimant a takeover displaced releases nothing.
      const heads = [...new Map(tips.map((t) => [t.cid, t])).values()].filter((tip) =>
        !ownOutcomes.some((o) => o.entry.signer === tip.entry.signer) &&
        !ownReleases.some((r) => field(r, "claim") === tip.cid || (field(r, "claim") === undefined && r.entry.signer === tip.entry.signer)));
      claim = heads.sort(sorted)[0] ?? null;
    }
    let voidCause: IntentState["voidCause"] = null;
    if (ownCancels.length) voidCause = "cancelled";
    else if (ownSupersedes.length) voidCause = "superseded";
    else if (agent?.status === "revoked") voidCause = "delegation-revoked";
    else if (agent?.status === "closed") voidCause = "delegation-closed";
    else if (agent?.status === "lapsed") voidCause = "delegation-lapsed";
    else if (!agent && input.standing(issuer) === "aside") voidCause = "issuer-aside";
    else if (bound?.void && input.face.rosterCids.includes(bound.void)) voidCause = "roster-passed";
    const bySlot = new Map<string, IntentRecord[]>(), outOfAudience: IntentRecord[] = [];
    const executor = answer !== null && answer !== "contested" && field(answer, "verdict") === "approve" ? field(answer, "executor") : null;
    const eligible = (atom: string): boolean => {
      if (!devices.has(atom)) return false;
      if (audience.mode === "pinned") return atom === audience.atom;
      if (audience.mode === "asks") return executor === atom;
      if (audience.mode === "prefer") return audience.atoms.includes(atom);
      if (audience.mode === "class") return (input.holdsCapability ?? (() => false))(atom, audience.capability);
      if (bound?.through) {
        const admission = input.face.admittedAt.get(atom), edge = input.face.rosterCids.indexOf(bound.through);
        return edge >= 0 && (!!admission && input.face.rosterCids.indexOf(admission) <= edge && input.face.rosterCids.indexOf(admission) >= 0);
      }
      return true;
    };
    const slotOf = (atom: string) => audience.mode === "every" ? atom : audience.mode === "pinned" ? audience.atom : id;
    for (const o of ownOutcomes) {
      const atom = o.entry.signer;
      if (!eligible(atom) || (field(o, "slot") !== undefined && field(o, "slot") !== slotOf(atom))) { outOfAudience.push(o); continue; }
      const slot = slotOf(atom), list = bySlot.get(slot) ?? [];
      list.push(o); bySlot.set(slot, list);
    }
    const slots: IntentSlot[] = [];
    for (const [slot, list] of [...bySlot].sort(([a], [b]) => a.localeCompare(b))) {
      const unknownFrontier = list.some((o) => input.standing(o.entry.signer) === "unknown");
      list.sort((a, b) => {
        if (audience.mode === "prefer") {
          const difference = audience.atoms.indexOf(a.entry.signer) - audience.atoms.indexOf(b.entry.signer);
          if (difference) return difference;
        }
        return rank(a.entry.signer, id).localeCompare(rank(b.entry.signer, id)) || sorted(a, b);
      });
      slots.push({ slot, winner: unknownFrontier ? null : list[0] ?? null, duplicates: unknownFrontier ? list : list.slice(1), unknownFrontier });
    }
    const unknown = (agent ? agent.status === "awaiting" : input.standing(issuer) === "unknown") || slots.some((s) => s.unknownFrontier);
    const status = voidCause ? "void" : unknown ? "unknown-frontier" : slots.some((s) => s.winner) ? "answered" : "open";
    states.push({ admissions: admissions.flatMap(r => r.ok && r.admission.body.entry === source.cid ? [{ cid: r.cid, relay: r.admission.body.relay }] : []).sort((a, b) => a.cid.localeCompare(b.cid)), id, issuer, verb: body.verb as string, class: classification.class, fenced: classification.class === "single-effect" || !!classification.fenced, audience, bound, status, voidCause, agent, asks: ownAsks,
      answer, claim, claims: ownClaims, slots, voidAfterAct: voidCause ? ownOutcomes : [], outOfAudience });
  }
  refused.sort((a, b) => a.refusal.localeCompare(b.refusal) || (a.cid ?? "").localeCompare(b.cid ?? ""));
  return { intents: states, delegations, refused, refusedAdmissions, strayAnswers, standing: input.standing, holdsCapability: input.holdsCapability ?? (() => false), face: input.face };
}

export type MayActReason = "spent" | "answered" | "void" | "not-audience" | "pinned-elsewhere" | "fenced-by-claim" | "awaiting-answer" | "unknown-frontier" | "atom-aside";
export function mayAct(view: IntentView, intentId: string, atom: string): { readonly act: true } | { readonly act: false; readonly reason: MayActReason } {
  const state = view.intents.find((i) => i.id === intentId);
  if (!state) return { act: false, reason: "not-audience" };
  if (state.voidCause) return { act: false, reason: "void" };
  const standing = view.standing(atom);
  if (standing === "unknown" || state.status === "unknown-frontier") return { act: false, reason: "unknown-frontier" };
  if (standing === "aside") return { act: false, reason: "atom-aside" };
  // An outcome spends a single-effect intent for every atom: a re-pin or a re-target never opens a second run, and an
  // outcome the audience now reads as foreign still counts (the effect already ran).
  if (state.class === "single-effect" && (state.slots.some((s) => s.winner) || state.outOfAudience.length)) return { act: false, reason: "spent" };
  if (state.audience.mode === "pinned" && state.audience.atom !== atom) return { act: false, reason: "pinned-elsewhere" };
  if (state.audience.mode === "asks") {
    if (!state.answer || state.answer === "contested" || field(state.answer, "verdict") !== "approve" || field(state.answer, "executor") !== atom) return { act: false, reason: "awaiting-answer" };
  }
  if (state.audience.mode === "prefer" && !state.audience.atoms.includes(atom)) return { act: false, reason: "not-audience" };
  if (state.audience.mode === "class" && !view.holdsCapability(atom, state.audience.capability)) return { act: false, reason: "not-audience" };
  if (!view.face.devices.includes(atom)) return { act: false, reason: "not-audience" };
  if (state.audience.mode === "every" && state.bound?.through) {
    const at = view.face.admittedAt.get(atom), edge = view.face.rosterCids.indexOf(state.bound.through);
    if (edge < 0 || !at || view.face.rosterCids.indexOf(at) < 0 || view.face.rosterCids.indexOf(at) > edge) return { act: false, reason: "not-audience" };
  }
  const slot = state.audience.mode === "every" ? atom : state.audience.mode === "pinned" ? state.audience.atom : state.id;
  if (state.slots.some((s) => s.slot === slot && s.winner)) return { act: false, reason: "answered" };
  if (state.fenced && state.claim && state.claim.entry.signer !== atom) return { act: false, reason: "fenced-by-claim" };
  return { act: true };
}
