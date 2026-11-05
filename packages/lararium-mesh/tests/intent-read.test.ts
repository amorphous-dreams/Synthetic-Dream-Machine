import { describe, expect, test, vi } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { makeHandLineage } from "../src/hand-lineage.js";
import { intentEntryCid, intentId, signIntentEntry, type IntentAudience, type SignedIntentEntry } from "../src/intent-entry.js";
import { mayAct, readIntentPlane } from "../src/intent-read.js";
import { intentPaneModel } from "../src/intent-view.js";
import { faceIntentVerbs, fixtureIntentVerbs, issueCheck, WARD_COSIGN_VERBS } from "../src/intent-verbs.js";
import { cosignDigest, judgeCosign } from "../src/ward-cosign.js";

const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const entry = (signer: Awaited<ReturnType<typeof who>>, fields: Record<string, unknown>) => signIntentEntry({ group: "face", refs: [], ...fields } as Parameters<typeof signIntentEntry>[0], signer);
const fixture = async () => {
  const a = await who(1), b = await who(2), root = await who(3);
  const lineage = makeHandLineage([{ epoch: 0, signers: [root.key], threshold: 1 }])!;
  const face = { devices: [a.key, b.key], rosterCids: ["admit-a", "admit-b", "void"], admittedAt: new Map([[a.key, "admit-a"], [b.key, "admit-b"]]), lineage };
  const verbs = fixtureIntentVerbs({ echo: "idempotent", per: "per-device", once: "single-effect" });
  const fold = (records: SignedIntentEntry[], standing: (atom: string) => "stands" | "aside" | "unknown" = () => "stands") => readIntentPlane({ group: "face", records, face, standing, verbs, holdsCapability: () => true });
  const intent = async (audience: IntentAudience, verb = "echo", nonce = "", bound?: Record<string, string>) => entry(a, { entry: "intent", issuer: a.key, verb, args: { x: 1 }, nonce, audience, ...(bound ? { bound } : {}) });
  const id = (verb = "echo", nonce = "") => intentId({ issuer: a.key, verb, args: { x: 1 }, nonce });
  return { a, b, root, fold, intent, id, face, verbs };
};

describe("intent fold", () => {
  test("RED: concurrent class answers retain a duplicate; merged outcome stops an effect; CONTROL: an open intent can act", async () => {
    const f = await fixture(), call = await f.intent({ mode: "class", capability: "test" }), id = f.id();
    expect(mayAct(f.fold([call]), id, f.b.key)).toEqual({ act: true });
    const first = await entry(f.a, { entry: "outcome", cause: id, result: "done" });
    const second = await entry(f.b, { entry: "outcome", cause: id, result: "done" });
    const view = f.fold([call, first, second]);
    expect(view.intents[0]!.slots[0]!.winner).not.toBeNull();
    expect(view.intents[0]!.slots[0]!.duplicates).toHaveLength(1);
    expect(intentPaneModel(view).rows[0]!.outcomeCount).toBe(1);
    const effect = vi.fn(); if (mayAct(view, id, f.b.key).act) effect();
    expect(effect).not.toHaveBeenCalled();
  });

  test("RED: pinned, single-effect and asks gates reject stray answer; CONTROL: a matching answer names one executor", async () => {
    const f = await fixture();
    expect(issueCheck(f.verbs, "once", { mode: "class", capability: "x" })).toEqual({ ok: false, refusal: "single-effect-unpinned" });
    expect(issueCheck(f.verbs, "once", { mode: "every" })).toMatchObject({ ok: false });
    expect(issueCheck(f.verbs, "once", { mode: "prefer", atoms: [f.a.key] })).toMatchObject({ ok: false });
    expect(issueCheck(faceIntentVerbs(), "unknown", { mode: "every" })).toEqual({ ok: false, refusal: "unclassified-verb" });
    const pin = await f.intent({ mode: "pinned", atom: f.a.key }, "once", "pin");
    expect(mayAct(f.fold([pin]), f.id("once", "pin"), f.b.key)).toEqual({ act: false, reason: "pinned-elsewhere" });
    const call = await f.intent({ mode: "asks" }, "once", "ask"), id = f.id("once", "ask");
    const stray = await entry(f.a, { entry: "answer", ask: "missing", verdict: "approve", executor: f.b.key });
    expect(mayAct(f.fold([call, stray]), id, f.b.key)).toEqual({ act: false, reason: "awaiting-answer" });
    expect(f.fold([call, stray]).strayAnswers).toHaveLength(1);
    const ask = await entry(f.a, { entry: "asks", intent: id, needs: "executor" });
    const answer = await entry(f.a, { entry: "answer", ask: intentEntryCid(ask), verdict: "approve", executor: f.b.key });
    expect(mayAct(f.fold([call, ask, answer]), id, f.b.key)).toEqual({ act: true });
    const competing = await entry(f.b, { entry: "answer", ask: intentEntryCid(ask), verdict: "approve", executor: f.a.key });
    expect(f.fold([call, ask, answer, competing]).intents[0]!.answer).toBe("contested");
    const repin = await signIntentEntry({ group: "face", entry: "answer", refs: [intentEntryCid(answer), intentEntryCid(competing)], ask: intentEntryCid(ask), verdict: "approve", executor: f.b.key }, f.a);
    expect(mayAct(f.fold([call, ask, answer, competing, repin]), id, f.b.key)).toEqual({ act: true });
  });

  test("RED: every has separate slots, void stalls sleepers, unknown frontier counts no winner; CONTROL: unbounded stands", async () => {
    const f = await fixture(), every = await f.intent({ mode: "every" }), id = f.id();
    const x = await entry(f.a, { entry: "outcome", cause: id, result: "x" }), y = await entry(f.b, { entry: "outcome", cause: id, result: "y" });
    expect(f.fold([every, x, y]).intents[0]!.slots).toHaveLength(2);
    expect(mayAct(f.fold([every]), id, f.b.key)).toEqual({ act: true });
    const bounded = await f.intent({ mode: "every" }, "per", "fresh", { void: "void" });
    expect(mayAct(f.fold([bounded]), f.id("per", "fresh"), f.b.key)).toEqual({ act: false, reason: "void" });
    const unknown = f.fold([every, x], (atom) => atom === f.a.key ? "unknown" : "stands");
    expect(unknown.intents[0]!.slots[0]!.winner).toBeNull();
    expect(intentPaneModel(unknown).rows[0]!.outcomeCount).toBe("unknown");
  });

  test("RED: root release clears a claim, foreign release refuses; CONTROL: claimant fences a single effect without reading a clock", async () => {
    const f = await fixture(), call = await f.intent({ mode: "pinned", atom: f.a.key }, "once", "claim"), id = f.id("once", "claim");
    const claim = await entry(f.b, { entry: "claim", intent: id });
    const now = vi.spyOn(Date, "now").mockImplementation(() => { throw Error("clock"); });
    try {
      expect(mayAct(f.fold([call, claim]), id, f.a.key)).toEqual({ act: false, reason: "fenced-by-claim" });
      const foreign = await entry(f.a, { entry: "release", intent: id, claim: intentEntryCid(claim) });
      expect(f.fold([call, claim, foreign]).refused).toContainEqual({ refusal: "not-issuer-or-root" });
      const release = await entry(f.root, { entry: "release", intent: id, epoch: 0 });
      expect(f.fold([call, claim, release]).intents[0]!.claim).toBeNull();
    } finally { now.mockRestore(); }
  });

  test("RED: replay folds once; takeover fences a zombie while an idempotent claimant still converges", async () => {
    const f = await fixture();
    const once = await f.intent({ mode: "pinned", atom: f.a.key }, "once", "take"), id = f.id("once", "take");
    const claim = await entry(f.b, { entry: "claim", intent: id });
    const takeover = await entry(f.a, { entry: "takeover", claim: intentEntryCid(claim) });
    const view = f.fold([once, once, claim, takeover]);
    expect(view.intents).toHaveLength(1);
    expect(view.intents[0]!.claim?.entry.signer).toBe(f.a.key);
    expect(mayAct(view, id, f.a.key)).toEqual({ act: true });
    const echo = await f.intent({ mode: "class", capability: "x" });
    const echoClaim = await entry(f.b, { entry: "claim", intent: f.id() });
    expect(mayAct(f.fold([echo, echoClaim]), f.id(), f.a.key)).toEqual({ act: true });
    const fresh = await f.intent({ mode: "class", capability: "x" }, "per", "fresh");
    expect(f.fold([echo, fresh]).intents).toHaveLength(2);
  });

  test("RED: a roster void leaves an outcome visible after acting; CONTROL: an unbounded call stays open", async () => {
    const f = await fixture();
    const bounded = await f.intent({ mode: "every" }, "per", "voided", { void: "void" });
    const id = f.id("per", "voided");
    const outcome = await entry(f.a, { entry: "outcome", cause: id, result: "done" });
    const view = f.fold([bounded, outcome]);
    expect(view.intents[0]!.voidCause).toBe("roster-passed");
    expect(view.intents[0]!.voidAfterAct).toHaveLength(1);
    expect(mayAct(view, id, f.b.key)).toEqual({ act: false, reason: "void" });
    const unbounded = await f.intent({ mode: "every" });
    expect(mayAct(f.fold([unbounded]), f.id(), f.b.key)).toEqual({ act: true });
  });

  test("RED: a finite every whose head the reader does not hold waits; CONTROL: a held head seats only the members admitted through it", async () => {
    const f = await fixture();
    const unknown = await f.intent({ mode: "every" }, "per", "far", { through: "not-held" });
    expect(mayAct(f.fold([unknown]), f.id("per", "far"), f.a.key)).toEqual({ act: false, reason: "not-audience" });
    const finite = await f.intent({ mode: "every" }, "per", "near", { through: "admit-a" });
    const view = f.fold([finite]);
    expect(mayAct(view, f.id("per", "near"), f.a.key)).toEqual({ act: true });
    expect(mayAct(view, f.id("per", "near"), f.b.key)).toEqual({ act: false, reason: "not-audience" });
  });

  test("RED: a claimant a takeover displaced releases nothing; CONTROL: the holder's own release ends the claim", async () => {
    const f = await fixture();
    const once = await f.intent({ mode: "pinned", atom: f.a.key }, "once", "hold"), id = f.id("once", "hold");
    const claim = await entry(f.b, { entry: "claim", intent: id });
    const takeover = await entry(f.a, { entry: "takeover", claim: intentEntryCid(claim) });
    const zombieRelease = await entry(f.b, { entry: "release", intent: id, claim: intentEntryCid(claim) });
    expect(f.fold([once, claim, takeover, zombieRelease]).intents[0]!.claim?.entry.signer).toBe(f.a.key);
    const ownRelease = await entry(f.a, { entry: "release", intent: id, claim: intentEntryCid(takeover) });
    expect(f.fold([once, claim, takeover, ownRelease]).intents[0]!.claim).toBeNull();
  });
});

describe("intent plane under re-pin, re-target and id collision", () => {
  test("RED: an outcome spends a single-effect slot against a re-pinned answer; CONTROL: before the outcome the named executor acts, and a per-device outcome spends no other atom's slot", async () => {
    const f = await fixture();
    const call = await f.intent({ mode: "asks" }, "once", "repin"), id = f.id("once", "repin");
    const ask = await entry(f.a, { entry: "asks", intent: id, needs: "executor" });
    const first = await entry(f.a, { entry: "answer", ask: intentEntryCid(ask), verdict: "approve", executor: f.b.key });
    expect(mayAct(f.fold([call, ask, first]), id, f.b.key)).toEqual({ act: true });
    const ran = await entry(f.b, { entry: "outcome", cause: id, result: "done" });
    const repin = await signIntentEntry({ group: "face", entry: "answer", refs: [intentEntryCid(first)], ask: intentEntryCid(ask), verdict: "approve", executor: f.a.key }, f.a);
    const view = f.fold([call, ask, first, ran, repin]);
    expect(mayAct(view, id, f.a.key)).toEqual({ act: false, reason: "spent" });
    expect(mayAct(view, id, f.b.key)).toEqual({ act: false, reason: "spent" });
    const per = await f.intent({ mode: "every" }, "per", "own"), perId = f.id("per", "own");
    const mine = await entry(f.a, { entry: "outcome", cause: perId, result: "done" });
    expect(mayAct(f.fold([per, mine]), perId, f.b.key)).toEqual({ act: true });
  });

  test("RED: fold([pinA, outcomeA, pinB-lower-cid]) refuses B; CONTROL: a same-body duplicate stays a duplicate", async () => {
    const f = await fixture();
    const x = await f.intent({ mode: "pinned", atom: f.a.key }, "once", "retarget"), y = await f.intent({ mode: "pinned", atom: f.b.key }, "once", "retarget"), id = f.id("once", "retarget");
    const [pinB, pinA] = intentEntryCid(x) < intentEntryCid(y) ? [x, y] : [y, x];
    const atomA = pinA === x ? f.a : f.b, atomB = pinB === x ? f.a : f.b;
    const outcomeA = await entry(atomA, { entry: "outcome", cause: id, result: "done" });
    const view = f.fold([pinA, outcomeA, pinB]);
    expect(mayAct(view, id, atomB.key).act).toBe(false);
    expect(mayAct(view, id, atomA.key).act).toBe(false);
    const twice = f.fold([pinA, pinA]);
    expect(twice.refused).toEqual([]);
    expect(mayAct(twice, id, atomA.key)).toEqual({ act: true });
  });

  test("RED: two bodies under one id refuse id-collision with every copy void and its cid listed, never ordered by cid; CONTROL: one body stands", async () => {
    const f = await fixture();
    const x = await f.intent({ mode: "every" }), y = await f.intent({ mode: "class", capability: "x" }), id = f.id();
    for (const order of [[x, y], [y, x]]) {
      const view = f.fold(order);
      expect(view.intents.find((i) => i.id === id)?.status ?? "void").toBe("void");
      expect(mayAct(view, id, f.a.key).act).toBe(false);
      expect(mayAct(view, id, f.b.key).act).toBe(false);
      expect(view.refused).toEqual([{ refusal: "id-collision", cid: [intentEntryCid(x), intentEntryCid(y)].sort()[0] }, { refusal: "id-collision", cid: [intentEntryCid(x), intentEntryCid(y)].sort()[1] }]);
    }
    expect(mayAct(f.fold([x]), id, f.a.key)).toEqual({ act: true });
  });
});

describe("the pane names the entry a refusal concerns", () => {
  test("RED: an id-collision row carries both cids in the pane; CONTROL: a lone body draws no refusal row", async () => {
    const f = await fixture();
    const x = await f.intent({ mode: "every" }), y = await f.intent({ mode: "class", capability: "x" });
    expect(intentPaneModel(f.fold([x, y])).refusals).toEqual([intentEntryCid(x), intentEntryCid(y)].sort().map((cid) => ({ refusal: "id-collision", cid })));
    expect(intentPaneModel(f.fold([x])).refusals).toEqual([]);
  });
});

describe("ward co-sign (S3a)", () => {
  const VERB = "ward-push-go";
  const digestOf = (head = "h1") => cosignDigest({ act: VERB, face: "face", wiki: "daemon", head });
  const rig = async () => {
    const a = await who(11), b = await who(12), c = await who(13), foreign = await who(14), root = await who(15);
    const lineage = makeHandLineage([{ epoch: 0, signers: [root.key], threshold: 1 }])!;
    const verbs = faceIntentVerbs();
    const face = (devices: string[]) => ({ devices, rosterCids: ["r"], admittedAt: new Map(devices.map((d) => [d, "r"])), lineage });
    const fold = (records: SignedIntentEntry[], devices = [a.key, b.key], standing: (atom: string) => "stands" | "aside" | "unknown" = () => "stands", v = verbs) =>
      readIntentPlane({ group: "face", records, face: face(devices), standing, verbs: v, holdsCapability: () => true });
    const call = await entry(a, { entry: "intent", issuer: a.key, verb: VERB, args: { head: "h1" }, nonce: "n", audience: { mode: "asks" } });
    const id = intentId({ issuer: a.key, verb: VERB, args: { head: "h1" }, nonce: "n" });
    const ask = await entry(a, { entry: "asks", intent: id, needs: "approval", detail: digestOf() });
    const answerBy = (who_: Awaited<ReturnType<typeof who>>, over: Record<string, unknown> = {}) =>
      entry(who_, { entry: "answer", ask: intentEntryCid(ask), verdict: "approve", executor: a.key, ...over });
    const judge = (view: ReturnType<typeof fold>, devices = [a.key, b.key], standing: (atom: string) => "stands" | "aside" | "unknown" = () => "stands", digest = digestOf()) =>
      judgeCosign({ view, intentId: id, requester: a.key, projection: { devices }, standing, digest });
    return { a, b, c, foreign, fold, call, id, ask, answerBy, judge, verbs };
  };

  test("RED: a self-answer approves a ward act on the old plane; CURE: the issuer's own answer counts nothing; CONTROL: a second device approves", async () => {
    const r = await rig();
    const old = fixtureIntentVerbs({ [VERB]: "single-effect" });   // the verb without the cosign flag keeps the old behaviour
    const selfAnswer = await r.answerBy(r.a);
    expect(mayAct(r.fold([r.call, r.ask, selfAnswer], [r.a.key, r.b.key], () => "stands", old), r.id, r.a.key)).toEqual({ act: true });
    const view = r.fold([r.call, r.ask, selfAnswer]);
    expect(mayAct(view, r.id, r.a.key)).toEqual({ act: false, reason: "awaiting-answer" });
    expect(r.judge(view)).toEqual({ need: "cosign", approved: false, reason: "self-answer" });
    const second = await r.answerBy(r.b), good = r.fold([r.call, r.ask, second]);
    expect(mayAct(good, r.id, r.a.key)).toEqual({ act: true });
    expect(r.judge(good)).toMatchObject({ need: "cosign", approved: true, cosigner: r.b.key });
  });

  test("RED: a digest mismatch refuses; CONTROL: the matching digest approves", async () => {
    const r = await rig(), second = await r.answerBy(r.b), view = r.fold([r.call, r.ask, second]);
    expect(r.judge(view, [r.a.key, r.b.key], () => "stands", digestOf("other-head"))).toEqual({ need: "cosign", approved: false, reason: "digest-mismatch" });
    expect(r.judge(view).need).toBe("cosign");
    expect(r.judge(view)).toMatchObject({ approved: true });
  });

  test("RED: an ask signed by another device refuses ask-signer; a request by another refuses wrong-requester", async () => {
    const r = await rig();
    const bAsk = await entry(r.b, { entry: "asks", intent: r.id, needs: "approval", detail: digestOf() });
    const ans = await entry(r.b, { entry: "answer", ask: intentEntryCid(bAsk), verdict: "approve", executor: r.a.key });
    expect(r.judge(r.fold([r.call, bAsk, ans]))).toEqual({ need: "cosign", approved: false, reason: "ask-signer" });
    const second = await r.answerBy(r.b), view = r.fold([r.call, r.ask, second]);
    expect(judgeCosign({ view, intentId: r.id, requester: r.b.key, projection: { devices: [r.a.key, r.b.key] }, standing: () => "stands", digest: digestOf() }))
      .toEqual({ need: "cosign", approved: false, reason: "wrong-requester" });
  });

  test("RED: an aside answerer never co-signs; it still counts toward the total; CONTROL: standing approves", async () => {
    const r = await rig(), second = await r.answerBy(r.b), view = r.fold([r.call, r.ask, second]);
    const aside = (atom: string) => (atom === r.b.key ? "aside" as const : "stands" as const);
    expect(r.judge(view, [r.a.key, r.b.key], aside)).toEqual({ need: "cosign", approved: false, reason: "answerer-aside" });
    expect(r.judge(view, [r.a.key, r.b.key], (atom) => (atom === r.b.key ? "unknown" : "stands"))).toEqual({ need: "cosign", approved: false, reason: "answerer-not-standing" });
    expect(r.judge(view)).toMatchObject({ approved: true });
  });

  test("RED: a contested pair refuses; CONTROL: a repin over both resolves", async () => {
    const r = await rig(), x = await r.answerBy(r.b), y = await r.answerBy(r.c, { verdict: "deny" });
    const view = r.fold([r.call, r.ask, x, y], [r.a.key, r.b.key, r.c.key]);
    expect(r.judge(view, [r.a.key, r.b.key, r.c.key])).toEqual({ need: "cosign", approved: false, reason: "contested" });
    const repin = await signIntentEntry({ group: "face", entry: "answer", refs: [intentEntryCid(x), intentEntryCid(y)], ask: intentEntryCid(r.ask), verdict: "approve", executor: r.a.key }, r.b);
    expect(r.judge(r.fold([r.call, r.ask, x, y, repin], [r.a.key, r.b.key, r.c.key]), [r.a.key, r.b.key, r.c.key])).toMatchObject({ approved: true });
  });

  test("RED: a replay after the outcome refuses spent; CONTROL: before it the co-sign stands", async () => {
    const r = await rig(), second = await r.answerBy(r.b);
    expect(r.judge(r.fold([r.call, r.ask, second]))).toMatchObject({ approved: true });
    const outcome = await entry(r.a, { entry: "outcome", cause: r.id, result: "pushed" });
    expect(r.judge(r.fold([r.call, r.ask, second, outcome]))).toEqual({ need: "cosign", approved: false, reason: "spent" });
  });

  test("RED: a signer outside the face's own atoms refuses; a vessel's other-face atom is no device here", async () => {
    const r = await rig();
    // Face A holds a and b; the same vessel's atom for face B (foreign) signs the answer.
    const viaB = await r.answerBy(r.foreign);
    const real = r.fold([r.call, r.ask, viaB]);
    expect(real.refused).toContainEqual({ refusal: "unauthorized" });   // the fold never admits a signer outside the face's devices
    expect(r.judge(real)).toEqual({ need: "cosign", approved: false, reason: "awaiting-answer" });
    // A view whose device set differs from the projection (the judge reads the projection) refuses by name.
    const wide = r.fold([r.call, r.ask, viaB], [r.a.key, r.b.key, r.foreign.key]);
    expect(r.judge(wide, [r.a.key, r.b.key])).toEqual({ need: "cosign", approved: false, reason: "signer-not-in-face" });
    // CONTROL: two distinct atoms of face A approve.
    expect(r.judge(r.fold([r.call, r.ask, await r.answerBy(r.b)]))).toMatchObject({ approved: true });
  });

  test("RED: a ward verb pinned to its issuer's own atom acts with no co-sign; CURE: issue refuses cosign-needs-asks, the plane refuses it and mayAct fails closed; CONTROL: a plain single-effect verb still pins", async () => {
    const r = await rig();
    for (const verb of WARD_COSIGN_VERBS) {
      expect(issueCheck(r.verbs, verb, { mode: "pinned", atom: r.a.key })).toEqual({ ok: false, refusal: "cosign-needs-asks" });
      expect(issueCheck(r.verbs, verb, { mode: "asks" })).toMatchObject({ ok: true });
    }
    expect(issueCheck(r.verbs, "face-join", { mode: "pinned", atom: r.a.key })).toMatchObject({ ok: true });
    const pinned = await entry(r.a, { entry: "intent", issuer: r.a.key, verb: VERB, args: { head: "h1" }, nonce: "p", audience: { mode: "pinned", atom: r.a.key } });
    const pid = intentId({ issuer: r.a.key, verb: VERB, args: { head: "h1" }, nonce: "p" });
    const view = r.fold([pinned]);
    expect(view.refused).toContainEqual({ refusal: "cosign-needs-asks" });
    expect(mayAct(view, pid, r.a.key).act).toBe(false);
    // A reader whose table lost the cosign flag (a peer that skipped the issue check) folds the pinned intent; mayAct still refuses it.
    const stale = r.fold([pinned], [r.a.key, r.b.key], () => "stands", fixtureIntentVerbs({ [VERB]: "single-effect" }));
    expect(stale.intents.map((i) => i.id)).toEqual([pid]);
    expect(mayAct(stale, pid, r.a.key)).toEqual({ act: false, reason: "cosign-needs-asks" });
    const flagged = { ...stale, intents: stale.intents.map((i) => ({ ...i, verb: "other", cosign: true })) };
    expect(mayAct(flagged, pid, r.a.key)).toEqual({ act: false, reason: "cosign-needs-asks" });
    // CONTROL: a plain pinned single-effect verb acts for its pinned atom.
    const plain = await entry(r.a, { entry: "intent", issuer: r.a.key, verb: "face-join", args: {}, nonce: "j", audience: { mode: "pinned", atom: r.a.key } });
    expect(mayAct(r.fold([plain]), intentId({ issuer: r.a.key, verb: "face-join", args: {}, nonce: "j" }), r.a.key)).toEqual({ act: true });
  });

  test("RED: another device asks on the issuer's ward intent and approves its own ask; CURE: the plane counts only answers to the issuer's ask, from a standing other device naming the issuer; CONTROL: a plain verb counts any device's ask", async () => {
    const r = await rig();
    const bAsk = await entry(r.b, { entry: "asks", intent: r.id, needs: "approval", detail: digestOf() });
    const bApproves = await entry(r.b, { entry: "answer", ask: intentEntryCid(bAsk), verdict: "approve", executor: r.a.key });
    const view = r.fold([r.call, bAsk, bApproves]);
    expect(view.intents[0]!.answer).toBeNull();
    expect(mayAct(view, r.id, r.a.key)).toEqual({ act: false, reason: "awaiting-answer" });
    expect(r.judge(view)).toEqual({ need: "cosign", approved: false, reason: "ask-signer" });
    // An approve naming another executor counts nothing for a ward verb.
    const elsewhere = r.fold([r.call, r.ask, await r.answerBy(r.b, { executor: r.b.key })]);
    expect(elsewhere.intents[0]!.answer).toBeNull();
    expect(mayAct(elsewhere, r.id, r.b.key)).toEqual({ act: false, reason: "awaiting-answer" });
    expect(r.judge(elsewhere)).toEqual({ need: "cosign", approved: false, reason: "executor-mismatch" });
    // An aside answerer counts nothing in the plane, and the judge names why.
    const aside = (atom: string) => (atom === r.b.key ? "aside" as const : "stands" as const);
    const asideView = r.fold([r.call, r.ask, await r.answerBy(r.b)], [r.a.key, r.b.key], aside);
    expect(asideView.intents[0]!.answer).toBeNull();
    expect(r.judge(asideView, [r.a.key, r.b.key], aside)).toEqual({ need: "cosign", approved: false, reason: "answerer-aside" });
    // CONTROL: the issuer's ask with a second device's approve acts; a plain single-effect verb keeps counting another device's ask.
    expect(mayAct(r.fold([r.call, r.ask, await r.answerBy(r.b)]), r.id, r.a.key)).toEqual({ act: true });
    const old = fixtureIntentVerbs({ [VERB]: "single-effect" });
    expect(mayAct(r.fold([r.call, bAsk, bApproves], [r.a.key, r.b.key], () => "stands", old), r.id, r.a.key)).toEqual({ act: true });
  });

  test("a face with 0 or 1 device needs no co-sign; aside devices count toward the total", async () => {
    const r = await rig(), view = r.fold([r.call, r.ask]);
    expect(r.judge(view, [])).toEqual({ need: "none" });
    expect(r.judge(view, [r.a.key])).toEqual({ need: "none" });
    expect(r.judge(view, [r.a.key, r.b.key], (atom) => (atom === r.b.key ? "aside" : "stands"))).toEqual({ need: "cosign", approved: false, reason: "awaiting-answer" });
  });

  test("the three ward verbs classify single-effect with the asks audience and a cosign flag; table over node and browser classes", async () => {
    const verbs = faceIntentVerbs();
    for (const verb of WARD_COSIGN_VERBS) {
      expect(verbs.classOfVerb(verb)).toEqual({ class: "single-effect", cosign: true });
      expect(issueCheck(verbs, verb, { mode: "asks" })).toMatchObject({ ok: true });
      expect(issueCheck(verbs, verb, { mode: "every" })).toEqual({ ok: false, refusal: "single-effect-unpinned" });
    }
    // Class-blind: the judge reads devices and reach; the same verdicts hold whatever class each device wears.
    for (const klass of ["node", "browser"] as const) {
      const r = await rig(), second = await r.answerBy(r.b), view = r.fold([r.call, r.ask, second]);
      const devices = [r.a.key, r.b.key], classOf: Record<string, string> = { [r.a.key]: klass, [r.b.key]: klass };
      expect(classOf[r.b.key]).toBe(klass);
      expect(r.judge(view, devices)).toMatchObject({ approved: true });
      expect(r.judge(r.fold([r.call, r.ask, await r.answerBy(r.a)]), devices)).toMatchObject({ approved: false, reason: "self-answer" });
    }
  });
});
