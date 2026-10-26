/** Pure read of a face's unordered intent entries. No arrival order decides an effect. */
import { sha256HexBytesSync, utf8Bytes } from "./crypto.js";
import { signsAtEpoch, type HandLineage } from "./hand-lineage.js";
import { intentId, readIntentEntry, type IntentAudience, type IntentBound, type SignedIntentEntry } from "./intent-entry.js";
import { issueCheck, type IntentVerbClass, type IntentVerbRegistry } from "./intent-verbs.js";

type Standing = "stands" | "aside" | "unknown";
export interface IntentReadInput {
  readonly group: string;
  readonly records: readonly unknown[];
  readonly face: { readonly devices: readonly string[]; readonly rosterCids: readonly string[]; readonly admittedAt: ReadonlyMap<string, string>; readonly lineage: HandLineage };
  readonly standing: (atom: string) => Standing;
  readonly holdsCapability?: (atom: string, capability: string) => boolean;
  readonly verbs: IntentVerbRegistry;
}
export interface IntentRecord { readonly cid: string; readonly entry: SignedIntentEntry }
export interface IntentSlot {
  readonly slot: string;
  readonly winner: IntentRecord | null;
  readonly duplicates: readonly IntentRecord[];
  readonly unknownFrontier: boolean;
}
export interface IntentState {
  readonly id: string; readonly issuer: string; readonly verb: string; readonly class: IntentVerbClass;
  readonly fenced: boolean;
  readonly audience: IntentAudience; readonly bound: IntentBound | null;
  readonly status: "open" | "answered" | "void" | "unknown-frontier";
  readonly voidCause: "superseded" | "cancelled" | "issuer-aside" | "roster-passed" | null;
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
  readonly refused: readonly { readonly refusal: string }[];
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
  const devices = new Set(input.face.devices.map((a) => a.toLowerCase()));
  const refused: { refusal: string }[] = [], all = new Map<string, IntentRecord>();
  for (const raw of input.records) {
    const read = readIntentEntry(raw, { group: input.group, authorize: (signer, body) => devices.has(signer) ||
      (["release", "cancel", "supersede"].includes(body.entry) && signsAtEpoch(input.face.lineage, body.epoch, signer)) });
    if (!read.ok) { refused.push({ refusal: read.refusal }); continue; }
    all.set(read.cid, { cid: read.cid, entry: read.entry });
  }
  const entries = [...all.values()].sort(sorted);
  const intents = new Map<string, IntentRecord>();
  for (const r of entries.filter((e) => e.entry.body.entry === "intent")) {
    const b = r.entry.body;
    if (b.issuer !== r.entry.signer) { refused.push({ refusal: "not-issuer" }); continue; }
    const check = issueCheck(input.verbs, b.verb as string, b.audience as IntentAudience);
    if (!check.ok) { refused.push({ refusal: check.refusal }); continue; }
    if (check.classification.class === "idempotent" && b.nonce !== "") { refused.push({ refusal: "idempotent-nonce" }); continue; }
    const id = intentId(b as unknown as { issuer: string; verb: string; args: unknown; nonce: string });
    const prior = intents.get(id);
    if (!prior || r.cid < prior.cid) intents.set(id, r);
  }
  const byKind = (kind: string): IntentRecord[] => entries.filter((r) => r.entry.body.entry === kind);
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
    else if (input.standing(issuer) === "aside") voidCause = "issuer-aside";
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
    const unknown = input.standing(issuer) === "unknown" || slots.some((s) => s.unknownFrontier);
    const status = voidCause ? "void" : unknown ? "unknown-frontier" : slots.some((s) => s.winner) ? "answered" : "open";
    states.push({ id, issuer, verb: body.verb as string, class: classification.class, fenced: classification.class === "single-effect" || !!classification.fenced, audience, bound, status, voidCause, asks: ownAsks,
      answer, claim, claims: ownClaims, slots, voidAfterAct: voidCause ? ownOutcomes : [], outOfAudience });
  }
  return { intents: states, refused, strayAnswers, standing: input.standing, holdsCapability: input.holdsCapability ?? (() => false), face: input.face };
}

export type MayActReason = "answered" | "void" | "not-audience" | "pinned-elsewhere" | "fenced-by-claim" | "awaiting-answer" | "unknown-frontier" | "atom-aside";
export function mayAct(view: IntentView, intentId: string, atom: string): { readonly act: true } | { readonly act: false; readonly reason: MayActReason } {
  const state = view.intents.find((i) => i.id === intentId);
  if (!state) return { act: false, reason: "not-audience" };
  if (state.voidCause) return { act: false, reason: "void" };
  const standing = view.standing(atom);
  if (standing === "unknown" || state.status === "unknown-frontier") return { act: false, reason: "unknown-frontier" };
  if (standing === "aside") return { act: false, reason: "atom-aside" };
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
