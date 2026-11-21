import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { readIntentEntry, signIntentEntry } from "../src/intent-entry.js";
import { intentId } from "../src/intent-entry.js";
import { makeHandLineage } from "../src/hand-lineage.js";
import { readIntentPlane } from "../src/intent-read.js";
import { buildAnswer, buildAsks, buildCancel, buildClaim, buildIntent, buildOutcome, buildRelease, buildSupersede, buildTakeover, IntentRefusal } from "../src/intent-issue.js";
import { faceIntentVerbs, fixtureIntentVerbs, WARD_COSIGN_VERBS } from "../src/intent-verbs.js";
import { cosignDigest } from "../src/ward-cosign.js";

const signer = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });

describe("intent issue", () => {
  test("RED: single effect refuses a broad audience; CONTROL: pinned issues; POSITIVE: receipt reads back", async () => {
    const atom = await signer(1), verbs = faceIntentVerbs();
    const base = { group: "face", signer: atom, verb: "face-join", args: { hand: 1 }, nonce: atom.key, verbs };
    await expect(buildIntent({ ...base, audience: { mode: "every" } })).rejects.toThrow(IntentRefusal);
    await expect(buildIntent({ ...base, verb: "missing", audience: { mode: "pinned", atom: atom.key } })).rejects.toThrow("unclassified-verb");
    await expect(buildIntent({ ...base, verb: "echo", audience: { mode: "asks" }, verbs: fixtureIntentVerbs({ echo: "per-device" }) })).rejects.toThrow("asks-requires-single-effect");
    const intent = await buildIntent({ ...base, audience: { mode: "pinned", atom: atom.key } });
    const outcome = await buildOutcome({ group: "face", signer: atom, cause: "intent-id", result: { status: "done" } });
    for (const entry of [intent, outcome]) expect(readIntentEntry(entry, { group: "face", authorize: () => true }).ok).toBe(true);
  });
  test("RED: each control word reads back; CONTROL: root and issuer sign; POSITIVE: all entry kinds carry a valid image", async () => {
    const atom = await signer(1), base = { group: "face", signer: atom };
    const entries = await Promise.all([
      buildAsks({ ...base, intent: "id", needs: "executor" }),
      buildAnswer({ ...base, ask: "ask", verdict: "approve", executor: atom.key }),
      buildClaim({ ...base, intent: "id" }), buildTakeover({ ...base, claim: "claim" }),
      buildRelease({ ...base, intent: "id", epoch: 0 }), buildSupersede({ ...base, intent: "id", epoch: 0 }),
      buildCancel({ ...base, intent: "id", epoch: 0 }),
    ]);
    expect(entries).toHaveLength(7);
    for (const entry of entries) expect(readIntentEntry(entry, { group: "face", authorize: () => true }).ok).toBe(true);
  });
  test("RED: a third atom's control words void nothing; CONTROL: issuer can cancel; POSITIVE: root can supersede", async () => {
    const issuer = await signer(1), stranger = await signer(2), root = await signer(3), verbs = faceIntentVerbs();
    const call = await buildIntent({ group: "face", signer: issuer, verb: "face-join", args: {}, nonce: issuer.key,
      audience: { mode: "pinned", atom: issuer.key }, verbs });
    const id = intentId(call.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string });
    const rogue = await Promise.all([buildRelease({ group: "face", signer: stranger, intent: id, epoch: 0 }),
      buildCancel({ group: "face", signer: stranger, intent: id, epoch: 0 }), buildSupersede({ group: "face", signer: stranger, intent: id, epoch: 0 })]);
    const own = await buildCancel({ group: "face", signer: issuer, intent: id, epoch: 0 });
    const operator = await buildSupersede({ group: "face", signer: root, intent: id, epoch: 0 });
    const lineage = makeHandLineage([{ epoch: 0, signers: [root.key], threshold: 1 }])!;
    const face = { devices: [issuer.key, stranger.key], rosterCids: [], admittedAt: new Map<string, string>(), lineage };
    const fold = (records: unknown[]) => readIntentPlane({ group: "face", records, face, standing: () => "stands", verbs });
    expect(fold([call, ...rogue]).intents[0]?.status).toBe("open");
    expect(fold([call, own]).intents[0]?.voidCause).toBe("cancelled");
    expect(fold([call, operator]).intents[0]?.voidCause).toBe("superseded");
  });
  test("RED: the three ward verbs classify and issue under the asks audience only; CONTROL: buildAsks carries the digest as its detail", async () => {
    const atom = await signer(1), verbs = faceIntentVerbs();
    expect(WARD_COSIGN_VERBS).toEqual(["ward-kapae-lower", "ward-house-cap", "ward-push-lei"]);
    for (const verb of WARD_COSIGN_VERBS) {
      expect(verbs.classOfVerb(verb)).toMatchObject({ class: "single-effect", cosign: true });
      const base = { group: "face", signer: atom, verb, args: {}, nonce: "n", verbs };
      await expect(buildIntent({ ...base, audience: { mode: "every" } })).rejects.toThrow("single-effect-unpinned");
      const call = await buildIntent({ ...base, audience: { mode: "asks" } });
      const detail = cosignDigest({ act: verb, face: "face", wiki: "daemon", head: "h1" });
      const ask = await buildAsks({ group: "face", signer: atom, intent: intentId(call.body as never), needs: "approval", detail });
      expect(ask.body["detail"]).toBe(detail);
      expect(readIntentEntry(ask, { group: "face", authorize: () => true }).ok).toBe(true);
    }
    expect(cosignDigest({ act: "a", face: "f", wiki: "w", head: "h" })).not.toBe(cosignDigest({ act: "a", face: "f", wiki: "w", head: "h2" }));
  });
  test("RED: a cast votum without its thrown coins refuses at the word and on read; CONTROL: the calendar and a thrown cast issue idempotent; POSITIVE: the hand-only class stays unclassified", async () => {
    const atom = await signer(1), verbs = faceIntentVerbs();
    expect(verbs.classOfVerb("ddate")).toEqual({ class: "idempotent" });
    expect(verbs.classOfVerb("oracle-cast")).toEqual({ class: "idempotent", fixes: ["at", "coins"] });
    for (const verb of ["promote", "retire", "unlock", "kui"]) expect(verbs.classOfVerb(verb)).toBeNull();
    const base = { group: "face", signer: atom, verb: "oracle-cast", nonce: "", audience: { mode: "pinned" as const, atom: atom.key }, verbs };
    await expect(buildIntent({ ...base, args: { at: "2026-11-21" } })).rejects.toThrow("args-unfixed");
    await expect(buildIntent({ ...base, args: { coins: "7,8,9,6,7,7" } })).rejects.toThrow("args-unfixed");
    const cast = await buildIntent({ ...base, args: { at: "2026-11-21", coins: "7,8,9,6,7,7" } });
    const calendar = await buildIntent({ ...base, verb: "ddate", args: { today: { year: 2026, month: 11, day: 21 } } });
    // The same word twice names one votum: the empty nonce keeps one id.
    const again = await buildIntent({ ...base, args: { at: "2026-11-21", coins: "7,8,9,6,7,7" } });
    expect(intentId(again.body as never)).toBe(intentId(cast.body as never));
    const unthrown = await signIntentEntry({ group: "face", entry: "intent", refs: [], issuer: atom.key, verb: "oracle-cast", args: { at: "2026-11-21" }, nonce: "",
      audience: { mode: "pinned", atom: atom.key } }, atom);
    const lineage = makeHandLineage([{ epoch: 0, signers: [atom.key], threshold: 1 }])!;
    const face = { devices: [atom.key], rosterCids: [], admittedAt: new Map<string, string>(), lineage };
    const view = readIntentPlane({ group: "face", records: [cast, calendar, unthrown], face, standing: () => "stands", verbs });
    expect(view.intents.map((i) => i.verb).sort()).toEqual(["ddate", "oracle-cast"]);
    expect(view.refused).toContainEqual({ refusal: "args-unfixed" });
  });
});
