/**
 * admit-acts — the signed @persona records a bare ceremony fixture owes its admit payload: the founding log the root
 * signs, then the joinee's admission and device-edge acts, built from the same helpers the node's founding and admit
 * paths use. A fixture that founds through `foundTheFace` and admits through `runDeviceAdmitEdge` carries them here.
 */
import {
  signFoundingLog, signPersonaAct, projectPersonaLog, personaLineageFromKel, actCid, edgeBodyDigest, faceRootCommitment,
  faceAtomKeyFromSeed, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, emptyLarDoc, landFleetGenesis, makeHandLineage, edgeFrontierRecords, frontierSnapshots, FLEET_HAND, type PersonaKelEvent,
} from "@lararium/mesh";

export async function founderAndJoineeActs(input: {
  face: { personaGroupId: string; personaKelPrefix: string; personaUrl: string; identitiesUrl: string; circlesUrl: string; sessionsUrl: string; intentsUrl: string; founderEdge: { personaRootDid: string; hearthTrueName: string } };
  signerSeed: Uint8Array;
  founderAtomSeed: Uint8Array;
  joineeKey: string;
  chain: readonly PersonaKelEvent[];
}): Promise<unknown[]> {
  const { face } = input;
  const key = await ed25519VerifyingKeyFromSeed(input.signerSeed);
  const signer = { key, sign: ed25519SignerFromSeed(input.signerSeed) };
  const founding = await signFoundingLog({
    group: face.personaGroupId, personaKelPrefix: face.personaKelPrefix,
    rootCommitment: faceRootCommitment(face.founderEdge.personaRootDid), epoch: 0,
    planes: { persona: face.personaUrl, identities: face.identitiesUrl, circles: face.circlesUrl, sessions: face.sessionsUrl, intents: face.intentsUrl },
    deviceKey: faceAtomKeyFromSeed(input.founderAtomSeed, face.personaGroupId).key,
    edgeDigest: edgeBodyDigest({ ...face.founderEdge, deviceVerifyingKey: "founder", boundEpoch: 0 }),
  }, signer);
  const lineage = personaLineageFromKel(input.chain)!;
  const head = projectPersonaLog(founding, { group: face.personaGroupId, lineage, authorize: () => true }).head!;
  const epoch = input.chain[input.chain.length - 1]!.seq;
  const admission = await signPersonaAct(head, { group: face.personaGroupId, act: "admission", epoch, fields: { deviceKey: input.joineeKey } }, signer);
  const edge = await signPersonaAct({ seq: admission.body.seq, cid: actCid(admission.body) },
    { group: face.personaGroupId, act: "device-edge", epoch,
      fields: { deviceKey: input.joineeKey, edgeDigest: edgeBodyDigest({ personaRootDid: face.founderEdge.personaRootDid, deviceVerifyingKey: input.joineeKey, hearthTrueName: face.founderEdge.hearthTrueName, boundEpoch: 0 }) } }, signer);
  return [...founding, admission, edge];
}

/** Found the fleet board with the face's root signer, then carry its signed records as admit does. */
export async function frontierFromFoundingSeed(signerSeed: Uint8Array) {
  const root = await ed25519VerifyingKeyFromSeed(signerSeed);
  const board = emptyLarDoc();
  await landFleetGenesis(board, root, makeHandLineage([{ epoch: 0, signers: [root], threshold: 1 }])!,
    { key: root, sign: ed25519SignerFromSeed(signerSeed) });
  return { records: edgeFrontierRecords(board, root, FLEET_HAND),
    snapshots: [...frontierSnapshots(board)].map(([cid, raises]) => [cid, [...raises]] as [string, string[]]) };
}
