/**
 * kahua-proposal-read — ONE reader finds a cited kahua proposal on a face's intents plane, for the node's lift door and a
 * browser reader alike: only an entry a device of the face's verified projection signed counts, and the body a lift
 * carries checks against the digest the proposal names (`kahuaBodyDigest`).
 *
 * SECURITY CLASS: the red pairs with a CONTROL through the same reader.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { intentId, writeIntentEntry } from "../src/intent-entry.js";
import { faceIntentVerbs } from "../src/intent-verbs.js";
import * as stage from "../src/kahua-stage.js";
import { buildKahuaProposal, kahuaBodyDigest } from "../src/kahua-stage.js";

const GROUP = "0x" + "e1".repeat(16);
const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
type Found = { batch: { session: string; proposals: { title: string; digest: string }[] }; issuer: string; cid: string } | null;
const findKahuaProposal = (doc: LarDoc, group: string, devices: readonly string[], id: string): Found =>
  (stage as unknown as { findKahuaProposal: (d: LarDoc, g: string, devs: readonly string[], i: string) => Found }).findKahuaProposal(doc, group, devices, id);

describe("one proposal reader", () => {
  test("RED: a stranger's well-formed proposal reads null, digest matching or not; CONTROL: an admitted device's proposal reads with its issuer and batch", async () => {
    const admitted = await who(51), stranger = await who(52);
    const doc = emptyLarDoc();
    const issue = async (signer: Awaited<ReturnType<typeof who>>, nonce: string) => {
      const entry = await buildKahuaProposal({ group: GROUP, signer, session: "s", nonce, verbs: faceIntentVerbs(),
        proposals: [{ title: "t", revision: "r1", digest: kahuaBodyDigest("body"), taint: [] }] });
      writeIntentEntry(doc, entry);
      return intentId(entry.body as never);
    };
    const foreign = await issue(stranger, "n1"), own = await issue(admitted, "n2");
    expect(findKahuaProposal(doc, GROUP, [admitted.key], foreign)).toBeNull();
    const found = findKahuaProposal(doc, GROUP, [admitted.key], own);
    expect(found).toMatchObject({ issuer: admitted.key, batch: { session: "s", proposals: [{ title: "t", digest: kahuaBodyDigest("body") }] } });
    expect(findKahuaProposal(doc, "0x" + "e2".repeat(16), [admitted.key], own)).toBeNull();
  });
});
