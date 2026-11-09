/**
 * kahua-admit-adopt — a joinee adopts the founder's kahua stage url from the VERIFIED admit bundle, the way it adopts
 * the intents plane: the url reads off the projection of the signed log the bundle carries, never a raw record.
 *
 * SECURITY CLASS (authority input: the bundle's acts). Red: the founder's root pins the stage with a `plane` act and the
 * joinee's admit names that url. Controls: a stranger's kahua plane act names nothing; a bundle with no kahua act
 * names none (the layer stands absent).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import {
  groupSecretOpenerFromSeed, makeIslandRepo, materializeSharedLarDoc, personaKelBoardDocUrl, personaKelChainForPrefix,
  seedDaemonDoc, signPersonaAct, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, actCid, KAHUA_PLANE, kahuaStageDocUrl,
} from "@lararium/mesh";
import { foundTheFace, foundThePlace, runApplyAdmitPayload, runDeviceAdmitEdge } from "../src/index.js";
import { founderAndJoineeActs, frontierFromFoundingSeed } from "./admit-acts.js";
import { testVesselTagDoor } from "../../lararium-mesh/tests/vessel-tag-fixture.js";

const key = (seed: Uint8Array) => groupSecretOpenerFromSeed(seed).deviceKey;
const repo = () => makeIslandRepo({ syncPort: new MessageChannel().port1 });

type Act = { body: { seq: number } };

async function admitWith(extra: (head: { seq: number; cid: string }, group: string, epoch: number, signerSeed: Uint8Array) => Promise<unknown[]>, pinned?: (group: string) => Record<string, string>) {
  const founderRepo = repo();
  const founderSeed = new Uint8Array(32).fill(61), signerSeed = new Uint8Array(32).fill(62);
  const atomSeed = new Uint8Array(32).fill(63), joineeAtom = new Uint8Array(32).fill(64);
  const founder = await foundThePlace({ repo: founderRepo, vesselSeed: founderSeed, hearthTrueName: "hearth" });
  const face = await foundTheFace({ vesselTag: testVesselTagDoor(1),
    repo: founderRepo, daemonHandle: founder.daemonHandle, secretHandle: founder.secretHandle, secretRest: { assertSealed: async () => true }, placeVerifyingKey: key(founderSeed), vesselDisplayName: "founder",
    binding: { mode: "self-stood", signerSeed }, hearthTrueName: "hearth", nexusPubkey: key(founderSeed), atomSeed,
  });
  const board = await materializeSharedLarDoc(founderRepo, personaKelBoardDocUrl(key(founderSeed)), "board:persona-kel");
  const chain = personaKelChainForPrefix(board.doc(), face.personaKelPrefix)!;
  const base = await founderAndJoineeActs({ face, signerSeed, founderAtomSeed: atomSeed, joineeKey: key(joineeAtom), chain, ...(pinned ? { extraPlanes: pinned(face.personaGroupId) } : {}) }) as Act[];
  const last = base.reduce((m, a) => (a.body.seq > m.body.seq ? a : m));
  const personaActs = [...base, ...await extra({ seq: last.body.seq, cid: actCid(last.body as never) }, face.personaGroupId, chain[chain.length - 1]!.seq, signerSeed)];
  const payload = await runDeviceAdmitEdge({
    signerSeed, joineeVerifyingKey: key(joineeAtom), personaKelPrefix: face.personaKelPrefix, personaKelChain: chain, personaActs,
    edgeFrontier: await frontierFromFoundingSeed(signerSeed), hearthTrueName: "hearth", personaGroupId: face.personaGroupId,
    meshCabalDocIdHex: face.meshCabalDocIdHex, syncUrl: null, hearthDaemonUrl: founder.daemonUrl, personaUrl: face.personaUrl,
  });
  const joineeRepo = repo();
  const applied = await runApplyAdmitPayload({ repo: joineeRepo, daemonHandle: seedDaemonDoc(joineeRepo), secretHandle: seedDaemonDoc(joineeRepo), secretRest: { assertSealed: async () => true }, atomSeed: joineeAtom, vesselDisplayName: "joinee", payload, nexusPubkey: key(founderSeed) });
  return { ...applied, group: face.personaGroupId };
}

const kahuaAct = async (head: { seq: number; cid: string }, group: string, epoch: number, seed: Uint8Array) =>
  signPersonaAct(head, { group, act: "plane", epoch, fields: { plane: KAHUA_PLANE, url: kahuaStageDocUrl(group) } },
    { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) });

describe("a joinee adopts the founder's kahua stage from the verified admit bundle", () => {
  test("RED: the root's kahua plane pinned inside the founding span rides the bundle and the admit names the founder's url", async () => {
    const applied = await admitWith(async () => [], (group) => ({ [KAHUA_PLANE]: kahuaStageDocUrl(group) }));
    expect(applied.kahuaUrl).toBe(kahuaStageDocUrl(applied.group));
  });

  test("CONTROL: the root's kahua plane act made AFTER the founding span (a late first pin) names nothing", async () => {
    const applied = await admitWith(async (head, group, epoch, signerSeed) => [await kahuaAct(head, group, epoch, signerSeed)]);
    expect(applied.kahuaUrl).toBeNull();
  });

  test("CONTROL: a stranger's kahua plane act names no stage", async () => {
    const applied = await admitWith(async (head, group, epoch) => [await kahuaAct(head, group, epoch, new Uint8Array(32).fill(99))]);
    expect(applied.kahuaUrl).toBeNull();
  });

  test("CONTROL: a bundle with no kahua act names none, and the admit stands", async () => {
    const applied = await admitWith(async () => []);
    expect(applied.kahuaUrl).toBeNull();
    expect(applied.intentsUrl).toBeTruthy();
  });
});
