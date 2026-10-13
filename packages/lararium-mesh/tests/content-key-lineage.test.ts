/**
 * content-key-lineage — key versions as a causal lineage: siblings with no winner, spans with a declaration
 * fixed at their opening, a roll that reads the lineage alone, and the roller a removal event feeds.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/epochs · #/siblings
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readKeyVersionId, type KeyVersionId } from "../src/sealed-chunk.js";
import type { SeatRoll } from "../src/seat-duties.js";
import {
  contentKeyRollSink, factOfPlan, KeyLineage, LINEAGE_REFUSALS, owesRoll, planAdmissionFromNow, planFounding, planJoin,
  planRemovalRoll, planRemovalRolls, ScriptedSeatRolls, versionsToHandOver, writeHead,
  type HistoryDeclaration, type KeyVersionFact, type RollOutcome, type TransitionEvidence,
} from "../src/content-key-lineage.js";

const id = (c: string): KeyVersionId => readKeyVersionId(c.repeat(64))!;
const aa = id("a"), bb = id("b"), cc = id("c"), dd = id("d"), ee = id("e");
const yes: TransitionEvidence = { raiseCounts: () => true, admissionVerifies: () => true, joinProven: () => true };
const founding = (keyVersion = aa, history: HistoryDeclaration = "shareable"): KeyVersionFact =>
  ({ keyVersion, parents: [], span: keyVersion, history, cause: { kind: "founding" } });
const removal = (keyVersion: KeyVersionId, parents: KeyVersionId[], act = "raise-1", span = aa, history: HistoryDeclaration = "shareable"): KeyVersionFact =>
  ({ keyVersion, parents, span, history, cause: { kind: "removal", acts: [act] } });
const admission = (keyVersion: KeyVersionId, parents: KeyVersionId[], history: HistoryDeclaration = "closed"): KeyVersionFact =>
  ({ keyVersion, parents, span: keyVersion, history, cause: { kind: "admission", act: "admit-1" } });
const joinOf = (keyVersion: KeyVersionId, parents: KeyVersionId[], span: KeyVersionId, history: HistoryDeclaration): KeyVersionFact =>
  ({ keyVersion, parents, span, history, cause: { kind: "join" } });
function count(lineage: KeyLineage, fact: KeyVersionFact, evidence = yes): KeyLineage {
  const r = lineage.count(fact, evidence);
  if (!("lineage" in r)) throw new Error(`setup: ${r.refusal}`);
  return r.lineage;
}
const refusalOf = (lineage: KeyLineage, fact: unknown, evidence = yes): string => { const r = lineage.count(fact, evidence); return "refusal" in r ? r.refusal : "COUNTED"; };
const founded = (): KeyLineage => count(KeyLineage.empty(), founding());
/** One raise, counted by two vessels from one head: two siblings. */
const siblings = (): KeyLineage => count(count(founded(), removal(bb, [aa])), removal(cc, [aa]));
/** A removal branch that continues span aa beside a from-now admission that opens span cc. */
const unlikeSpans = (): KeyLineage => count(count(founded(), removal(bb, [aa])), admission(cc, [aa]));
const held = (...ids: KeyVersionId[]): ReadonlySet<KeyVersionId> => new Set(ids);

describe("the key lineage", () => {
  it("CONTROL: a founding and two removals count, and heads, spans and history read back", () => {
    let l = founded();
    expect(l.heads()).toEqual([aa]);
    l = count(l, removal(bb, [aa]));
    l = count(l, removal(cc, [bb], "raise-2"));
    expect(l.heads()).toEqual([cc]);
    expect(l.forked()).toBe(false);
    expect(l.versionsOfSpan(aa)).toEqual([aa, bb, cc]);
    expect(l.historyOfSpan(aa)).toBe("shareable");
    expect(l.descends(cc, aa)).toBe(true);
    expect(l.descends(aa, cc)).toBe(false);
  });

  it("two successors of one parent stand as siblings, in either count order", () => {
    const one = siblings();
    const two = count(count(founded(), removal(cc, [aa])), removal(bb, [aa]));
    expect(one.heads()).toEqual([bb, cc]);
    expect(two.heads()).toEqual([bb, cc]);
    expect(one.forked()).toBe(true);
  });

  it("no id picks a winner: a writer seals under the head it holds", () => {
    const l = siblings();
    expect(writeHead(l, held(cc))).toEqual({ head: cc });
    expect(writeHead(l, held(bb))).toEqual({ head: bb });
    expect(writeHead(l, held(bb, cc))).toEqual({ joinOwed: [bb, cc] });
    expect(writeHead(l, held(aa))).toEqual({ refusal: "no-head-held" });
    expect(writeHead(KeyLineage.empty(), held(aa))).toEqual({ refusal: "bag-unfounded" });
    // Three heads, two held: the head last written under, else the choice reads ambiguous.
    const three = count(l, removal(dd, [aa], "raise-9"));
    expect(writeHead(three, held(cc, dd), dd)).toEqual({ head: dd });
    expect(writeHead(three, held(cc, dd), cc)).toEqual({ head: cc });
    expect(writeHead(three, held(cc, dd))).toEqual({ ambiguous: [cc, dd] });
    expect(writeHead(three, held(cc, dd), bb)).toEqual({ ambiguous: [cc, dd] });
  });

  it("a join of one span continues it; a join of unlike spans opens its own", () => {
    const same = count(siblings(), joinOf(dd, [bb, cc], aa, "shareable"));
    expect(same.heads()).toEqual([dd]);
    expect(same.fact(dd)?.span).toBe(aa);
    expect(refusalOf(siblings(), joinOf(dd, [bb, cc], dd, "shareable"))).toBe("span-rule-broken");
    expect(refusalOf(siblings(), joinOf(dd, [bb, cc], aa, "closed"))).toBe("span-rule-broken");
    const unlike = unlikeSpans();
    expect(refusalOf(unlike, joinOf(dd, [bb, cc], aa, "shareable"))).toBe("span-rule-broken");
    expect(refusalOf(unlike, joinOf(dd, [bb, cc], cc, "closed"))).toBe("span-rule-broken");
    const joined = count(unlike, joinOf(dd, [bb, cc], dd, "closed"));
    expect(joined.heads()).toEqual([dd]);
    expect(joined.historyOfSpan(dd)).toBe("closed");
  });

  it("a removal continues its span under the span's own declaration", () => {
    expect(refusalOf(founded(), removal(bb, [aa], "raise-1", aa, "closed"))).toBe("span-rule-broken");
    expect(refusalOf(founded(), removal(bb, [aa], "raise-1", bb))).toBe("span-rule-broken");
    // Parents of unlike spans never feed one removal: the vessel joins first.
    expect(refusalOf(unlikeSpans(), removal(dd, [bb, cc]))).toBe("span-rule-broken");
    expect(refusalOf(unlikeSpans(), removal(dd, [bb, cc], "raise-1", cc, "closed"))).toBe("span-rule-broken");
    expect(refusalOf(founded(), removal(bb, [aa]))).toBe("COUNTED");
  });

  it("an admission opens a new span and declares its own history", () => {
    expect(count(founded(), admission(bb, [aa], "shareable")).historyOfSpan(bb)).toBe("shareable");
    expect(count(founded(), admission(bb, [aa], "closed")).historyOfSpan(bb)).toBe("closed");
    expect(refusalOf(founded(), { ...admission(bb, [aa]), span: aa })).toBe("span-rule-broken");
    // A removal inside the new span carries the new span's declaration, never the earlier span's.
    const l = count(founded(), admission(bb, [aa], "closed"));
    expect(refusalOf(l, removal(cc, [bb], "raise-2", bb, "shareable"))).toBe("span-rule-broken");
    expect(refusalOf(l, removal(cc, [bb], "raise-2", bb, "closed"))).toBe("COUNTED");
  });

  it("every refusal answers by its own vector", () => {
    const vectors: Record<(typeof LINEAGE_REFUSALS)[number], () => string> = {
      "version-malformed": () => refusalOf(founded(), { ...removal(bb, [aa]), keyVersion: "bb" }),
      "version-conflict":  () => refusalOf(count(founded(), removal(bb, [aa])), removal(bb, [aa], "raise-other")),
      "parent-unknown":    () => refusalOf(founded(), removal(bb, [cc])),
      "second-founding":   () => refusalOf(founded(), founding(bb)),
      "founding-shape":    () => refusalOf(KeyLineage.empty(), { ...founding(), span: bb }),
      "span-rule-broken":  () => refusalOf(founded(), removal(bb, [aa], "raise-1", bb)),
      "cause-unverified":  () => refusalOf(founded(), removal(bb, [aa]), { ...yes, raiseCounts: () => false }),
      "join-too-few":      () => refusalOf(founded(), joinOf(bb, [aa], aa, "shareable")),
      "join-unproven":     () => refusalOf(siblings(), joinOf(dd, [bb, cc], aa, "shareable"), { ...yes, joinProven: () => false }),
    };
    for (const name of LINEAGE_REFUSALS) expect(vectors[name](), name).toBe(name);
  });

  it("a malformed fact refuses: unsorted or repeated parents, a self parent, an empty act, an unknown history", () => {
    const l = siblings();
    expect(refusalOf(l, joinOf(dd, [cc, bb], aa, "shareable"))).toBe("version-malformed");
    expect(refusalOf(l, joinOf(dd, [bb, bb], aa, "shareable"))).toBe("version-malformed");
    expect(refusalOf(l, removal(bb, [bb]))).toBe("version-malformed");
    expect(refusalOf(l, removal(dd, [bb], ""))).toBe("version-malformed");
    // An act id of ill-formed text reads as no act: two unlike ids must never share one encoding.
    expect(refusalOf(l, removal(dd, [bb], "raise-\ud800"))).toBe("version-malformed");
    expect(refusalOf(l, removal(dd, [bb], "raise-\ufffd"))).toBe("COUNTED");
    expect(refusalOf(l, { ...removal(dd, [bb]), cause: { kind: "removal", acts: [] } })).toBe("version-malformed");
    expect(refusalOf(l, { ...removal(dd, [bb]), cause: { kind: "removal", acts: ["raise-2", "raise-1"] } })).toBe("version-malformed");
    expect(refusalOf(l, { ...removal(dd, [bb]), cause: { kind: "removal", acts: ["raise-2", "raise-2"] } })).toBe("version-malformed");
    expect(refusalOf(l, { ...removal(dd, [bb]), cause: { kind: "removal", act: "raise-2" } })).toBe("version-malformed");
    expect(refusalOf(l, { ...removal(dd, [bb]), history: "open" })).toBe("version-malformed");
    expect(refusalOf(l, { ...removal(dd, [bb]), cause: { kind: "decree" } })).toBe("version-malformed");
    expect(refusalOf(l, null)).toBe("version-malformed");
  });

  it("two unlike facts under one id refuse both, and the lineage stays immutable", () => {
    const before = count(count(founded(), removal(bb, [aa])), removal(cc, [bb], "raise-2"));
    const r = before.count(removal(bb, [aa], "raise-other"), yes);
    if (!("refusal" in r) || r.refusal !== "version-conflict") throw new Error("the unlike fact counted");
    const after = r.conflicted;
    // The lineage a caller held before the conflict reads as it did.
    expect(before.has(bb)).toBe(true);
    expect(before.conflicted(bb)).toBe(false);
    // The conflicted lineage refuses both facts from then on, and a version already counted above stays counted.
    expect(after.conflicted(bb)).toBe(true);
    expect(after.has(bb)).toBe(false);
    expect(after.fact(bb)).toBeNull();
    expect(refusalOf(after, removal(bb, [aa]))).toBe("version-conflict");
    expect(refusalOf(after, removal(bb, [aa], "raise-other"))).toBe("version-conflict");
    // Every version that descends from the conflicted id leaves the readings with it: no reader offers a head
    // whose own past no longer stands, whatever order the facts arrived in.
    expect(after.has(cc)).toBe(false);
    expect(after.fact(cc)).toBeNull();
    expect(refusalOf(after, removal(dd, [bb], "raise-3"))).toBe("parent-unknown");
    expect(refusalOf(after, removal(dd, [cc], "raise-3"))).toBe("parent-unknown");
    expect(after.heads()).toEqual([aa]);
    expect(after.versionsOfSpan(aa)).toEqual([aa]);
    expect(writeHead(after, held(cc))).toEqual({ refusal: "no-head-held" });
    expect(owesRoll(after, "raise-2", held(cc))).toBe(true);
    // ORDER-FREE: a reader that met both unlike facts before the descendant ends at the same readings.
    const early = (() => { const r = count(founded(), removal(bb, [aa])).count(removal(bb, [aa], "raise-other"), yes); if (!("conflicted" in r)) throw new Error("no conflict"); return r.conflicted; })();
    expect(refusalOf(early, removal(cc, [bb], "raise-2"))).toBe("parent-unknown");
    expect(early.heads()).toEqual(after.heads());
    // A sibling that descends from neither stays, and the bag continues from it.
    const withSibling = (() => { const r = count(before, removal(dd, [aa], "raise-4")).count(removal(bb, [aa], "raise-other"), yes); if (!("conflicted" in r)) throw new Error("no conflict"); return r.conflicted; })();
    expect(withSibling.heads()).toEqual([dd]);
    // The same fact counted twice changes nothing.
    expect(before.count(removal(bb, [aa]), yes)).toEqual({ lineage: before });
  });

  it("a conflicted founding leaves the bag with no standing version, and no second founding takes its place", () => {
    const r = count(founded(), removal(bb, [aa])).count(founding(aa, "closed"), yes);
    if (!("conflicted" in r)) throw new Error("no conflict");
    expect(r.conflicted.heads()).toEqual([]);
    expect(r.conflicted.unfounded).toBe(false);
    expect(refusalOf(r.conflicted, founding(cc))).toBe("second-founding");
    expect(planRemovalRoll(r.conflicted, { acts: ["raise-1"], held: held(aa, bb), ownEdgeShadowed: false })).toEqual({ refusal: "no-head-held" });
  });

  it("a successor counts only where its transition verifies", () => {
    expect(refusalOf(founded(), removal(bb, [aa]), { ...yes, raiseCounts: () => false })).toBe("cause-unverified");
    expect(refusalOf(founded(), removal(bb, [aa]), { ...yes, raiseCounts: (act) => act === "raise-1" })).toBe("COUNTED");
    expect(refusalOf(founded(), admission(bb, [aa]), { ...yes, admissionVerifies: () => false })).toBe("cause-unverified");
    expect(refusalOf(founded(), admission(bb, [aa]), { ...yes, admissionVerifies: (act) => act === "admit-1" })).toBe("COUNTED");
    expect(refusalOf(siblings(), joinOf(dd, [bb, cc], aa, "shareable"), { ...yes, joinProven: () => false })).toBe("join-unproven");
    expect(refusalOf(siblings(), joinOf(dd, [bb, cc], aa, "shareable"), { ...yes, joinProven: (fact) => fact.keyVersion === dd })).toBe("COUNTED");
    // Evidence that throws proves nothing.
    expect(refusalOf(founded(), removal(bb, [aa]), { ...yes, raiseCounts: () => { throw new Error("ledger torn"); } })).toBe("cause-unverified");
  });
});

describe("the roll", () => {
  it("a vessel owes a roll until it HOLDS a successor for that raise, or a descendant of one", () => {
    const rolled = count(founded(), removal(bb, [aa]));
    expect(owesRoll(founded(), "raise-1", held(aa))).toBe(true);
    expect(owesRoll(rolled, "raise-1", held(aa, bb))).toBe(false);
    // Another vessel rolled and wrapped no lockbox for this one: the successor stands counted and unheld.
    expect(owesRoll(rolled, "raise-1", held(aa))).toBe(true);
    expect(owesRoll(rolled, "raise-2", held(aa, bb))).toBe(true);
    const later = count(rolled, removal(cc, [bb], "raise-2"));
    expect(owesRoll(later, "raise-1", held(cc))).toBe(false);
  });

  it("a removal roll cites every head the vessel holds and continues their span", () => {
    expect(planRemovalRoll(founded(), { acts: ["raise-1"], held: held(aa), ownEdgeShadowed: false }))
      .toEqual({ plan: { parents: [aa], span: aa, history: "shareable", cause: { kind: "removal", acts: ["raise-1"] } } });
    // Two vessels that each hold one sibling extend their own branch; neither cites a head it cannot open.
    const l = siblings();
    expect(planRemovalRoll(l, { acts: ["raise-2"], held: held(aa, cc), ownEdgeShadowed: false }))
      .toMatchObject({ plan: { parents: [cc], span: aa } });
    expect(planRemovalRoll(l, { acts: ["raise-2"], held: held(bb, cc), ownEdgeShadowed: false }))
      .toMatchObject({ plan: { parents: [bb, cc], span: aa } });
    const plan = planRemovalRoll(founded(), { acts: ["raise-1"], held: held(aa), ownEdgeShadowed: false });
    if (!("plan" in plan)) throw new Error(plan.refusal);
    expect(refusalOf(founded(), factOfPlan(plan.plan, bb))).toBe("COUNTED");
  });

  it("raises answered together share one successor, and a raise already settled stays out of the next one", () => {
    const batch = planRemovalRoll(founded(), { acts: ["raise-2", "raise-1", "raise-2"], held: held(aa), ownEdgeShadowed: false });
    expect(batch).toEqual({ plan: { parents: [aa], span: aa, history: "shareable", cause: { kind: "removal", acts: ["raise-1", "raise-2"] } } });
    if (!("plan" in batch)) throw new Error(batch.refusal);
    const rolled = count(founded(), factOfPlan(batch.plan, bb));
    expect(owesRoll(rolled, "raise-1", held(bb))).toBe(false);
    expect(owesRoll(rolled, "raise-2", held(bb))).toBe(false);
    // A later batch that repeats a settled raise beside a new one cites the new one alone.
    expect(planRemovalRoll(rolled, { acts: ["raise-1", "raise-3"], held: held(bb), ownEdgeShadowed: false }))
      .toMatchObject({ plan: { parents: [bb], cause: { kind: "removal", acts: ["raise-3"] } } });
    expect(planRemovalRoll(rolled, { acts: ["raise-1", "raise-2"], held: held(bb), ownEdgeShadowed: false })).toEqual({ refusal: "already-rolled" });
    // Every raise a successor cites must count: one unverified raise refuses the whole fact.
    expect(refusalOf(founded(), factOfPlan(batch.plan, bb), { ...yes, raiseCounts: (act) => act === "raise-1" })).toBe("cause-unverified");
  });

  it("heads of unlike spans each take their own successor: a roll never waits on a join", () => {
    // The vessel holds a removal branch (span aa) and a from-now branch (span cc).
    const l = unlikeSpans();
    const r = planRemovalRolls(l, { acts: ["raise-2"], held: held(bb, cc), ownEdgeShadowed: false });
    expect(r).toEqual({ plans: [
      { parents: [bb], span: aa, history: "shareable", cause: { kind: "removal", acts: ["raise-2"] } },
      { parents: [cc], span: cc, history: "closed", cause: { kind: "removal", acts: ["raise-2"] } },
    ] });
    if (!("plans" in r)) throw new Error(r.refusal);
    let rolled = count(l, factOfPlan(r.plans[0]!, dd));
    // One branch rolled: the vessel still owes the roll on the other head it holds.
    expect(owesRoll(rolled, "raise-2", held(dd, cc))).toBe(true);
    expect(planRemovalRolls(rolled, { acts: ["raise-2"], held: held(dd, cc), ownEdgeShadowed: false }))
      .toEqual({ plans: [{ parents: [cc], span: cc, history: "closed", cause: { kind: "removal", acts: ["raise-2"] } }] });
    rolled = count(rolled, factOfPlan(r.plans[1]!, ee));
    expect(owesRoll(rolled, "raise-2", held(dd, ee))).toBe(false);
    expect(planRemovalRolls(rolled, { acts: ["raise-2"], held: held(dd, ee), ownEdgeShadowed: false })).toEqual({ refusal: "already-rolled" });
    expect(rolled.heads()).toEqual([dd, ee]);                                 // both branches stay: the fork still shows
  });

  it("a removal roll refuses by name", () => {
    const l = siblings();
    expect(planRemovalRoll(KeyLineage.empty(), { acts: ["raise-1"], held: held(), ownEdgeShadowed: false })).toEqual({ refusal: "bag-unfounded" });
    expect(planRemovalRoll(l, { acts: [""], held: held(bb), ownEdgeShadowed: false })).toEqual({ refusal: "act-malformed" });
    expect(planRemovalRoll(l, { acts: [], held: held(bb), ownEdgeShadowed: false })).toEqual({ refusal: "act-malformed" });
    expect(planRemovalRoll(l, { acts: ["raise-2"], held: held(bb), ownEdgeShadowed: true })).toEqual({ refusal: "own-edge-shadowed" });
    expect(planRemovalRoll(l, { acts: ["raise-1"], held: held(bb), ownEdgeShadowed: false })).toEqual({ refusal: "already-rolled" });
    expect(planRemovalRoll(l, { acts: ["raise-2"], held: held(aa), ownEdgeShadowed: false })).toEqual({ refusal: "no-head-held" });
    expect(planRemovalRoll(unlikeSpans(), { acts: ["raise-2"], held: held(bb, cc), ownEdgeShadowed: false })).toEqual({ refusal: "join-owed" });   // one plan asked, two owed
  });

  it("mutual removal: each shadowed vessel mints nothing, and both branches stay", () => {
    // Each party rolled the other out before it read the other's raise.
    const l = count(count(founded(), removal(bb, [aa], "raise-on-second")), removal(cc, [aa], "raise-on-first"));
    expect(planRemovalRoll(l, { acts: ["raise-3"], held: held(bb), ownEdgeShadowed: true })).toEqual({ refusal: "own-edge-shadowed" });
    expect(planJoin(l, { held: held(bb, cc), historyForNewSpan: "closed", ownEdgeShadowed: true })).toEqual({ refusal: "own-edge-shadowed" });
    expect(planAdmissionFromNow(l, { act: "admit-2", held: held(cc), history: "closed", ownEdgeShadowed: true })).toEqual({ refusal: "own-edge-shadowed" });
    expect(l.heads()).toEqual([bb, cc]);
    // A third member that holds both heads and stands under no shadow joins them.
    expect(planJoin(l, { held: held(bb, cc), historyForNewSpan: "closed", ownEdgeShadowed: false }))
      .toEqual({ plan: { parents: [bb, cc], span: aa, history: "shareable", cause: { kind: "join" } } });
  });

  it("a join needs every head; unlike spans open a new span under the declared history", () => {
    const l = siblings();
    expect(planJoin(founded(), { held: held(aa), historyForNewSpan: "closed", ownEdgeShadowed: false })).toEqual({ refusal: "nothing-to-join" });
    expect(planJoin(l, { held: held(aa), historyForNewSpan: "closed", ownEdgeShadowed: false })).toEqual({ refusal: "no-head-held" });
    expect(planJoin(l, { held: held(bb), historyForNewSpan: "closed", ownEdgeShadowed: false })).toEqual({ refusal: "heads-not-all-held" });
    expect(planJoin(KeyLineage.empty(), { held: held(), historyForNewSpan: "closed", ownEdgeShadowed: false })).toEqual({ refusal: "bag-unfounded" });
    expect(planJoin(unlikeSpans(), { held: held(bb, cc), historyForNewSpan: "closed", ownEdgeShadowed: false }))
      .toEqual({ plan: { parents: [bb, cc], span: "self", history: "closed", cause: { kind: "join" } } });
  });

  it("a from-now admission opens a span; a founding stands once", () => {
    expect(planAdmissionFromNow(founded(), { act: "admit-1", held: held(aa), history: "closed", ownEdgeShadowed: false }))
      .toEqual({ plan: { parents: [aa], span: "self", history: "closed", cause: { kind: "admission", act: "admit-1" } } });
    expect(planAdmissionFromNow(founded(), { act: "", held: held(aa), history: "closed", ownEdgeShadowed: false })).toEqual({ refusal: "act-malformed" });
    expect(planAdmissionFromNow(founded(), { act: "admit-1", held: held(), history: "closed", ownEdgeShadowed: false })).toEqual({ refusal: "no-head-held" });
    expect(planAdmissionFromNow(KeyLineage.empty(), { act: "admit-1", held: held(), history: "closed", ownEdgeShadowed: false })).toEqual({ refusal: "bag-unfounded" });
    expect(planAdmissionFromNow(founded(), { act: "admit-1", held: held(aa), history: "open" as never, ownEdgeShadowed: false })).toEqual({ refusal: "history-malformed" });
    expect(planFounding(KeyLineage.empty(), "closed")).toEqual({ plan: { parents: [], span: "self", history: "closed", cause: { kind: "founding" } } });
    expect(planFounding(founded(), "closed")).toEqual({ refusal: "bag-founded" });
    expect(factOfPlan({ parents: [], span: "self", history: "closed", cause: { kind: "founding" } }, ee)).toEqual(founding(ee, "closed"));
  });

  it("a with-past admission hands over one shareable span whole, and nothing of a closed one", () => {
    // Span aa (shareable): aa, bb. Then a from-now admission opens span cc (shareable), with a removal dd inside it.
    let l = count(founded(), removal(bb, [aa]));
    l = count(l, admission(cc, [bb], "shareable"));
    l = count(l, removal(dd, [cc], "raise-2", cc, "shareable"));
    expect(versionsToHandOver(l, { from: dd, held: held(dd) })).toEqual({ versions: [cc, dd] });   // none of the earlier span
    const closed = count(founded(), admission(bb, [aa], "closed"));
    expect(versionsToHandOver(closed, { from: bb, held: held(bb) })).toEqual({ refusal: "history-closed" });
    expect(versionsToHandOver(l, { from: cc, held: held(cc) })).toEqual({ refusal: "no-head-held" });    // not a head
    expect(versionsToHandOver(l, { from: dd, held: held(cc) })).toEqual({ refusal: "no-head-held" });    // a head it cannot open
  });
});

describe("the content-key roll a seat roll feeds", () => {
  const SCOPE = "fleet:test-scope";
  function vessel(start: KeyLineage, mints: (KeyVersionId | "fail" | "throw")[], over: { shadowed?: boolean; bags?: string[] } = {}) {
    const state = { lineage: start, held: new Set<KeyVersionId>(start.heads()), reports: [] as RollOutcome[], plans: [] as { parents: readonly KeyVersionId[]; acts: readonly string[] }[] };
    const rolls = new ScriptedSeatRolls();
    const stop = rolls.subscribe(contentKeyRollSink({
      bagsOf: (scope) => (scope === SCOPE ? (over.bags ?? ["bag-one"]) : []),
      lineageOf: (bagId) => (bagId === "bag-one" ? state.lineage : null),
      heldOf: () => state.held,
      ownEdgeShadowed: () => over.shadowed === true,
      mint: async (_bag, plan) => {
        await Promise.resolve();
        state.plans.push({ parents: plan.parents, acts: plan.cause.kind === "removal" ? plan.cause.acts : [] });
        const next = mints.shift();
        if (next === "throw") throw new Error("no key holder");
        if (next === undefined || next === "fail") return null;
        const fact = factOfPlan(plan, next);
        state.lineage = count(state.lineage, fact);
        state.held.add(next);
        return fact;
      },
      report: (outcome) => { state.reports.push(outcome); },
    }));
    return { state, rolls, stop };
  }
  const roll = (raiseCids: string[], how: SeatRoll["how"] = "revoked", scope = SCOPE): SeatRoll => ({ kind: "seat-roll", scope, edgeId: "edge-1", raiseCids, how });
  const results = (reports: RollOutcome[]): string[] => reports.map((r) => `${r.bagId}:${r.result}:${r.keyVersion ?? ""}`);

  it("one seat roll rolls each bag once; the same roll again owes nothing", async () => {
    const { state, rolls } = vessel(founded(), [bb]);
    await rolls.announce(roll(["raise-1"]));
    expect(state.reports).toEqual([{ scope: SCOPE, bagId: "bag-one", raises: ["raise-1"], result: "rolled", keyVersion: bb }]);
    expect(state.lineage.heads()).toEqual([bb]);
    await rolls.announce(roll(["raise-1"]));
    expect(results(state.reports)).toEqual([`bag-one:rolled:${bb}`, "bag-one:not-owed:"]);
    expect(state.plans.length).toBe(1);
  });

  it("a batch of raises mints one successor that cites them all", async () => {
    const { state, rolls } = vessel(founded(), [bb]);
    await rolls.announce(roll(["raise-1", "raise-2"]));
    expect(state.plans).toEqual([{ parents: [aa], acts: ["raise-1", "raise-2"] }]);
    expect(state.lineage.fact(bb)?.cause).toEqual({ kind: "removal", acts: ["raise-1", "raise-2"] });
  });

  it("the content key rolls on every answer the key group gave", async () => {
    for (const how of ["revoked", "gone", "no-authority"] as const) {
      const { state, rolls } = vessel(founded(), [bb]);
      await rolls.announce(roll(["raise-1"], how));
      expect(results(state.reports), how).toEqual([`bag-one:rolled:${bb}`]);
    }
  });

  it("two rolls announced together run in turn: the second cites the first's version", async () => {
    const { state, rolls } = vessel(founded(), [bb, cc]);
    await Promise.all([rolls.announce(roll(["raise-1"])), rolls.announce(roll(["raise-2"]))]);
    expect(results(state.reports)).toEqual([`bag-one:rolled:${bb}`, `bag-one:rolled:${cc}`]);
    expect(state.plans).toEqual([{ parents: [aa], acts: ["raise-1"] }, { parents: [bb], acts: ["raise-2"] }]);
  });

  it("a mint that fails or throws REJECTS the roll, so it comes again, and the repeat finishes it", async () => {
    const { state, rolls } = vessel(founded(), ["fail", "throw", bb]);
    await expect(rolls.announce(roll(["raise-1"]))).rejects.toThrow(/did not roll.*bag-one \(mint-failed\)/);
    await expect(rolls.announce(roll(["raise-1"]))).rejects.toThrow(/stays owed/);
    expect(owesRoll(state.lineage, "raise-1", state.held)).toBe(true);        // nothing settled yet
    await rolls.announce(roll(["raise-1"]));                                  // the same roll, handed over again
    expect(results(state.reports)).toEqual(["bag-one:mint-failed:", "bag-one:mint-failed:", `bag-one:rolled:${bb}`]);
  });

  it("a vessel that holds heads of unlike spans rolls each branch in one delivery", async () => {
    const both = vessel(unlikeSpans(), [dd, ee]);
    await both.rolls.announce(roll(["raise-2"]));
    expect(results(both.state.reports)).toEqual([`bag-one:rolled:${dd}`, `bag-one:rolled:${ee}`]);
    expect(both.state.plans).toEqual([{ parents: [bb], acts: ["raise-2"] }, { parents: [cc], acts: ["raise-2"] }]);
    expect(both.state.lineage.heads()).toEqual([dd, ee]);
    // One branch's mint fails: the roll rejects, and the repeat mints the missing branch alone.
    const half = vessel(unlikeSpans(), [dd, "fail", ee]);
    await expect(half.rolls.announce(roll(["raise-2"]))).rejects.toThrow(/mint-failed/);
    await half.rolls.announce(roll(["raise-2"]));
    expect(results(half.state.reports)).toEqual([`bag-one:rolled:${dd}`, "bag-one:mint-failed:", `bag-one:rolled:${ee}`]);
  });

  it("a bag that owes a roll and cannot take one keeps the raise owed; a shadowed vessel mints nothing and lets it settle", async () => {
    // No head key yet (a lockbox still on its way): the raise must not read answered.
    const keyless = vessel(founded(), [bb]);
    keyless.state.held.clear();
    await expect(keyless.rolls.announce(roll(["raise-1"]))).rejects.toThrow(/bag-one \(no-head-held\)/);
    keyless.state.held.add(aa);                                               // the key arrives
    await keyless.rolls.announce(roll(["raise-1"]));                          // the same roll, handed over again
    expect(results(keyless.state.reports)).toEqual(["bag-one:no-head-held:", `bag-one:rolled:${bb}`]);
    // A bag the scope names and this vessel cannot read yet.
    const stray = vessel(founded(), [bb], { bags: ["bag-one", "bag-two", "bag-one"] });
    await expect(stray.rolls.announce(roll(["raise-1"]))).rejects.toThrow(/bag-two \(unknown-bag\)/);
    expect(results(stray.state.reports)).toEqual([`bag-one:rolled:${bb}`, "bag-two:unknown-bag:"]);
    // A vessel under its own shadow performs no key act in that scope: nothing for a repeat to finish.
    const shadowed = vessel(founded(), [bb], { shadowed: true });
    await shadowed.rolls.announce(roll(["raise-1"]));
    expect(results(shadowed.state.reports)).toEqual(["bag-one:own-edge-shadowed:"]);
    expect(shadowed.state.plans).toEqual([]);
  });

  it("a roll for a scope that reaches no bag here settles with nothing to do; after the unsubscribe no roll arrives", async () => {
    const { state, rolls, stop } = vessel(founded(), [bb]);
    await rolls.announce(roll(["raise-1"], "revoked", "realm:elsewhere"));
    expect(state.reports).toEqual([]);
    expect(rolls.subscribers).toBe(1);
    stop();
    expect(rolls.subscribers).toBe(0);
    await rolls.announce(roll(["raise-1"]));
    expect(state.reports).toEqual([]);
    expect(state.plans).toEqual([]);
  });
});

describe("no clock decides", () => {
  it("the module reads no clock, timer or random source", () => {
    const raw = readFileSync(join(import.meta.dirname, "../src/content-key-lineage.ts"), "utf8");
    const code = raw.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    expect(code.length).toBeGreaterThan(2000);
    expect(code.length).toBeLessThan(raw.length);
    expect(code).not.toMatch(/\bDate\b|\bsetTimeout\b|\bsetInterval\b|\bperformance\b|Math\.random/);
    // CONTROL: the same pattern bites a line that does read a clock.
    expect("const now = Date.now();").toMatch(/\bDate\b/);
  });
});
