import { describe, expect, test } from "vitest";
import { resolveIntentFaceIndex, intentAudience } from "../src/commands/intent.js";
import {
  buildAnswer, buildAsks, buildCancel, buildIntent, buildOutcome, ed25519SignerFromSeed,
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
    expect(() => resolveIntentFaceIndex(undefined, [0, 1])).toThrow(/FaceNotNamed/);
    expect(resolveIntentFaceIndex(1, [0, 1])).toBe(1);
    expect(resolveIntentFaceIndex(undefined, [0])).toBe(0);
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
});
