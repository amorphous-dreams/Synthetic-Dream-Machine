import { describe, expect, test } from "vitest";
import { resolveIntentFaceIndex, intentAudience, askShown, answerRefusal } from "../src/commands/intent.js";
import {
  buildAnswer, buildAsks, buildCancel, buildIntent, buildOutcome, cosignDigest, faceIntentVerbs, ed25519SignerFromSeed,
  ed25519VerifyingKeyFromSeed, fixtureIntentVerbs, intentEntryCid, intentId, intentPaneModel,
  makeHandLineage, readIntentPlane, type SignedIntentEntry,
} from "@lararium/mesh";

const who = async (n: number) => {
  const seed = new Uint8Array(32).fill(n);
  return { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
};
const fixture = async () => {
  const atom = await who(1), root = await who(2), stranger = await who(3);
  const lineage = makeHandLineage([{ epoch: 0, signers: [root.key], threshold: 1 }])!;
  const verbs = fixtureIntentVerbs({ once: "single-effect", echo: "idempotent" });
  const fold = (records: SignedIntentEntry[], standing: () => "stands" | "unknown" = () => "stands") =>
    readIntentPlane({ group: "scratch-face", records, face: { devices: [atom.key], rosterCids: ["admitted"], admittedAt: new Map([[atom.key, "admitted"]]), lineage }, standing, verbs });
  const issue = (verb = "once") => buildIntent({ group: "scratch-face", signer: atom, verb, args: {}, nonce: verb === "once" ? "nonce" : "", audience: { mode: "pinned", atom: atom.key }, verbs });
  const id = (verb = "once") => intentId({ issuer: atom.key, verb, args: {}, nonce: verb === "once" ? "nonce" : "" });
  return { atom, root, stranger, verbs, fold, issue, id };
};

describe("intent command guards", () => {
  test("two faces demand a named face; control names h1; a sole face resolves", () => {
    expect(() => resolveIntentFaceIndex(undefined, [0, 1], [0, 1])).toThrow(/FaceNotNamed/);
    expect(resolveIntentFaceIndex(1, [0, 1], [0, 1])).toBe(1);
    expect(resolveIntentFaceIndex(undefined, [0], [0])).toBe(0);
  });

  test("RED: two faces open and one anchored, none named, refuses FaceNotNamed; control: the one open face unanchored refuses face-not-held", () => {
    expect(() => resolveIntentFaceIndex(undefined, [0], [0, 1])).toThrow(/FaceNotNamed/);
    expect(resolveIntentFaceIndex(0, [0], [0, 1])).toBe(0);
    expect(() => resolveIntentFaceIndex(undefined, [], [1])).toThrow(/face-not-held: h1/);
  });

  test("one audience lands pinned; multiple selectors refuse before issue", () => {
    const atom = "a".repeat(64);
    expect(intentAudience({ to: atom })).toEqual({ mode: "pinned", atom });
    expect(() => intentAudience({ to: atom, every: true })).toThrow(/audience/);
  });

  test("single-effect spread refuses by name before a write; pinned control issues", async () => {
    const f = await fixture();
    for (const audience of [{ mode: "every" }, { mode: "class", capability: "work" }, { mode: "prefer", atoms: [f.atom.key] }] as const) {
      await expect(buildIntent({ group: "scratch-face", signer: f.atom, verb: "once", args: {}, nonce: "nonce", audience, verbs: f.verbs })).rejects.toThrow(/single-effect-unpinned/);
    }
    const pinned = await f.issue();
    expect(f.fold([pinned]).intents).toHaveLength(1);
  });

  test("root cancel voids; foreign root and wrong epoch refuse", async () => {
    const f = await fixture(), issued = await f.issue(), id = f.id();
    const rootCancel = await buildCancel({ group: "scratch-face", signer: f.root, intent: id, epoch: 0 });
    expect(f.fold([issued, rootCancel]).intents[0]!.status).toBe("void");
    const foreign = await buildCancel({ group: "scratch-face", signer: f.stranger, intent: id, epoch: 0 });
    const wrongEpoch = await buildCancel({ group: "scratch-face", signer: f.root, intent: id, epoch: 1 });
    expect(f.fold([issued, foreign, wrongEpoch]).refused).toContainEqual({ refusal: "unauthorized" });
  });

  test("stray answer grants nothing; matching ask answers", async () => {
    const f = await fixture(), issued = await f.issue(), id = f.id();
    const stray = await buildAnswer({ group: "scratch-face", signer: f.atom, ask: "missing", executor: f.atom.key, verdict: "approve" });
    expect(f.fold([issued, stray]).strayAnswers).toHaveLength(1);
    expect(f.fold([issued, stray]).intents[0]!.answer).toBeNull();
    const ask = await buildAsks({ group: "scratch-face", signer: f.atom, intent: id, needs: "executor" });
    const answer = await buildAnswer({ group: "scratch-face", signer: f.atom, ask: intentEntryCid(ask), executor: f.atom.key, verdict: "approve" });
    expect(f.fold([issued, ask, answer]).intents[0]!.answer).not.toBeNull();
  });

  test("duplicate outcome remains visible; unknown frontier never reports zero", async () => {
    const f = await fixture(), issued = await f.issue("echo"), id = f.id("echo");
    const first = await buildOutcome({ group: "scratch-face", signer: f.atom, cause: id, result: 1 });
    const second = await buildOutcome({ group: "scratch-face", signer: f.atom, cause: id, result: 2 });
    const known = intentPaneModel(f.fold([issued, first, second]));
    expect(known.rows[0]!.duplicates).toHaveLength(1);
    expect(known.rows[0]!.outcomeCount).toBe(1);
    expect(intentPaneModel(f.fold([issued, first], () => "unknown")).rows[0]!.outcomeCount).toBe("unknown");
  });

  test("RED: an ask carries no detail on the old door; CONTROL: --detail round trips from ask to the answerer's reading, and a plain verb shows no cosign", async () => {
    const f = await fixture(), other = await who(4);
    const lineage = makeHandLineage([{ epoch: 0, signers: [f.root.key], threshold: 1 }])!;
    const verbs = faceIntentVerbs();
    const fold = (records: SignedIntentEntry[]) => readIntentPlane({ group: "scratch-face", records, verbs, standing: () => "stands",
      face: { devices: [f.atom.key, other.key], rosterCids: ["r"], admittedAt: new Map([[f.atom.key, "r"], [other.key, "r"]]), lineage } });
    const call = await buildIntent({ group: "scratch-face", signer: f.atom, verb: "ward-push-go", args: { head: "h1" }, nonce: "n", audience: { mode: "asks" }, verbs });
    const id = intentId(call.body as never), detail = cosignDigest({ act: "ward-push-go", face: "scratch-face", wiki: "daemon", head: "h1" });
    const bare = await buildAsks({ group: "scratch-face", signer: f.atom, intent: id, needs: "approval" });
    expect(askShown(fold([call, bare]), intentEntryCid(bare))?.detail).toBeNull();
    const ask = await buildAsks({ group: "scratch-face", signer: f.atom, intent: id, needs: "approval", detail });
    expect(askShown(fold([call, ask]), intentEntryCid(ask))).toEqual({ intent: id, verb: "ward-push-go", issuer: f.atom.key, askedBy: f.atom.key, detail, cosign: true, spent: false });
    expect(askShown(fold([call, ask]), "missing")).toBeNull();
    const plain = await buildIntent({ group: "scratch-face", signer: f.atom, verb: "face-join", args: {}, nonce: "p", audience: { mode: "asks" }, verbs });
    const plainAsk = await buildAsks({ group: "scratch-face", signer: f.atom, intent: intentId(plain.body as never), needs: "approval", detail: "x" });
    expect(askShown(fold([plain, plainAsk]), intentEntryCid(plainAsk))?.cosign).toBe(false);
  });

  test("RED: the answer door signs an answer the plane never counts for a ward verb (another device's ask, an executor other than the issuer); CONTROL: the issuer's ask and its executor pass, and a plain verb takes any ask", async () => {
    const f = await fixture(), other = await who(4);
    const lineage = makeHandLineage([{ epoch: 0, signers: [f.root.key], threshold: 1 }])!;
    const verbs = faceIntentVerbs();
    const fold = (records: SignedIntentEntry[]) => readIntentPlane({ group: "scratch-face", records, verbs, standing: () => "stands",
      face: { devices: [f.atom.key, other.key], rosterCids: ["r"], admittedAt: new Map([[f.atom.key, "r"], [other.key, "r"]]), lineage } });
    const call = await buildIntent({ group: "scratch-face", signer: f.atom, verb: "ward-push-go", args: { head: "h1" }, nonce: "n", audience: { mode: "asks" }, verbs });
    const id = intentId(call.body as never);
    const own = await buildAsks({ group: "scratch-face", signer: f.atom, intent: id, needs: "approval", detail: "d" });
    const foreign = await buildAsks({ group: "scratch-face", signer: other, intent: id, needs: "approval", detail: "d" });
    const view = fold([call, own, foreign]);
    const shown = (ask: SignedIntentEntry) => askShown(view, intentEntryCid(ask));
    expect(answerRefusal(shown(foreign), other.key, f.atom.key, false)).toMatch(/^ask-signer/);
    expect(answerRefusal(shown(own), other.key, other.key, false)).toMatch(/^executor-mismatch/);
    expect(answerRefusal(shown(own), f.atom.key, f.atom.key, false)).toMatch(/^self-answer/);
    expect(answerRefusal(shown(own), other.key, f.atom.key, false)).toBeNull();
    expect(answerRefusal(shown(own), other.key, other.key, true)).toBeNull();
    const plain = await buildIntent({ group: "scratch-face", signer: f.atom, verb: "face-join", args: {}, nonce: "p", audience: { mode: "asks" }, verbs });
    const plainAsk = await buildAsks({ group: "scratch-face", signer: other, intent: intentId(plain.body as never), needs: "approval" });
    expect(answerRefusal(askShown(fold([plain, plainAsk]), intentEntryCid(plainAsk)), other.key, other.key, false)).toBeNull();
  });

  test("RED: the answer door signs an answer to an ask it cannot see, and to an ask whose ward act an outcome already spent; CONTROL: a visible, unspent ask passes", async () => {
    const f = await fixture(), other = await who(4);
    const lineage = makeHandLineage([{ epoch: 0, signers: [f.root.key], threshold: 1 }])!;
    const verbs = faceIntentVerbs();
    const fold = (records: SignedIntentEntry[]) => readIntentPlane({ group: "scratch-face", records, verbs, standing: () => "stands",
      face: { devices: [f.atom.key, other.key], rosterCids: ["r"], admittedAt: new Map([[f.atom.key, "r"], [other.key, "r"]]), lineage } });
    const call = await buildIntent({ group: "scratch-face", signer: f.atom, verb: "ward-house-cap", args: { head: "h1" }, nonce: "n", audience: { mode: "asks" }, verbs });
    const id = intentId(call.body as never);
    const own = await buildAsks({ group: "scratch-face", signer: f.atom, intent: id, needs: "approval", detail: "d" });
    const approve = await buildAnswer({ group: "scratch-face", signer: other, ask: intentEntryCid(own), verdict: "approve", executor: f.atom.key });
    const outcome = await buildOutcome({ group: "scratch-face", signer: f.atom, cause: id, result: { status: "done" } });
    for (const deny of [false, true]) {
      expect(answerRefusal(null, other.key, f.atom.key, deny)).toMatch(/^ward-ask-unseen/);
      expect(answerRefusal(askShown(fold([call, own, approve, outcome]), intentEntryCid(own)), other.key, f.atom.key, deny)).toMatch(/^ward-ask-spent/);
      expect(answerRefusal(askShown(fold([call, own, approve]), intentEntryCid(own)), other.key, f.atom.key, deny)).toBeNull();
    }
  });
});
