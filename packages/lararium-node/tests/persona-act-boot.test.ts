import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import {
  emptyLarDoc, signFoundingLog, signPersonaAct, actCid, mintFaceAnchor, faceRootCommitment,
  didFromVerifyingKey, ed25519VerifyingKeyFromSeed, ed25519SignerFromSeed,
  provisionThresholdRecoveryAtFounding, guardianRecoveryRegistrationCard,
  writePersonaKelEvent, personaKelChainForPrefix, proveFaceFromLog,
} from "@lararium/mesh";
import { appendPersonaActs, readFacePersonaRecords } from "../src/persona-act-store.js";

const group = "ab".repeat(16);
const seed = new Uint8Array(32).fill(11);

async function fixture() {
  const repo = new Repo({ network: [] });
  const handle = repo.create(emptyLarDoc());
  const rootKey = await ed25519VerifyingKeyFromSeed(seed);
  const signer = { key: rootKey, sign: ed25519SignerFromSeed(seed) };
  const did = didFromVerifyingKey(rootKey);
  const guardians = await Promise.all([1, 2, 3].map(async (n, i) =>
    guardianRecoveryRegistrationCard((['mine', 'guardian-a', 'guardian-b'] as const)[i]!, await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), null)));
  const inception = provisionThresholdRecoveryAtFounding({ foundingOpKeyDid: did, guardians, recoveryThreshold: 2 }).inception;
  const board = emptyLarDoc();
  writePersonaKelEvent(board, inception);
  const chain = personaKelChainForPrefix(board, inception.prefix)!;
  const planes = { persona: handle.url as string, identities: "automerge:i", circles: "automerge:c", sessions: "automerge:s" };
  const log = await signFoundingLog({ group, personaKelPrefix: inception.prefix,
    rootCommitment: faceRootCommitment(did), epoch: 0, planes, deviceKey: rootKey, edgeDigest: "edge" }, signer);
  const anchor = mintFaceAnchor({ personaGroup: group, personaKelPrefix: inception.prefix,
    personaRootDid: did, edge: {}, leaseEpoch: 0 });
  appendPersonaActs(handle, log);
  const records = () => readFacePersonaRecords(repo, { personaUrl: planes.persona, group });
  const proof = async (deviceKey: string, named = planes, carried?: readonly unknown[]) =>
    proveFaceFromLog({ records: carried ?? await records(), chain, group, anchor, deviceKey, planes: named });
  return { repo, handle, rootKey, signer, planes, records, proof, log };
}

describe("node face act boot carriage", () => {
  test("a founded face boots; a forged circles URL refuses by name", async () => {
    const f = await fixture();
    expect((await f.proof(f.rootKey)).ok).toBe(true);
    expect(await f.proof(f.rootKey, { ...f.planes, circles: "automerge:forged" }))
      .toEqual({ ok: false, refusal: { why: "plane", plane: "circles" } });
    await f.repo.shutdown();
  });
  test("a coherent foreign persona document cannot found this group", async () => {
    const f = await fixture();
    const foreign = await signFoundingLog({ group: "other", personaKelPrefix: f.log[0]!.body["personaKelPrefix"] as string,
      rootCommitment: f.log[0]!.body["rootCommitment"] as string, epoch: 0, planes: f.planes,
      deviceKey: f.rootKey, edgeDigest: "edge" }, f.signer);
    expect((await f.proof(f.rootKey, f.planes, foreign)).ok).toBe(false);
    await f.repo.shutdown();
  });
  test("the joinee's signed admit bundle seats its atom; an omitted admission refuses", async () => {
    const f = await fixture();
    const head = f.log[f.log.length - 1]!;
    const joiner = "cd".repeat(32);
    const admission = await signPersonaAct({ seq: head.body.seq, cid: actCid(head.body) },
      { group, act: "admission", epoch: 0, fields: { deviceKey: joiner } }, f.signer);
    const bundle = [...await f.records(), admission];
    expect((await f.proof(joiner, f.planes, bundle)).ok).toBe(true);
    expect(await f.proof(joiner)).toEqual({ ok: false, refusal: { why: "device-unseated" } });
    await f.repo.shutdown();
  });
});
