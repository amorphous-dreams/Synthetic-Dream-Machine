/**
 * shared-face-docs — a face's circles and identities are the FACE's documents: minted once at founding, named by a signed
 * `plane` act, carried in the admit bundle and adopted by every device the face admits; sessions stay per vessel (motion,
 * never a decision that crosses devices). Reds: a second device admitted into the group adopts the founder's circles and
 * identities (same urls), proves them from the bundle, and a document named by no act, or by a stranger's act, refuses.
 * Control: a vessel with no PersonaGroup holds only the floor, with no face documents.
 */
import { describe, expect, test } from "vitest";
import {
  groupSecretOpenerFromSeed, makeIslandRepo, materializeSharedLarDoc, personaKelBoardDocUrl, personaKelChainForPrefix, personaActRecordsOfGroup,
  mintFaceAnchor, proveFaceFromLog, seedDaemonDoc, signPersonaAct, writePersonaAct, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, actCid,
  type LarDoc,
} from "@lararium/mesh";
import { foundTheFace, foundThePlace, runApplyAdmitPayload, runDeviceAdmitEdge } from "../src/index.js";
import { founderAndJoineeActs, frontierFromFoundingSeed } from "./admit-acts.js";

const key = (seed: Uint8Array) => groupSecretOpenerFromSeed(seed).deviceKey;
const repo = () => makeIslandRepo({ syncPort: new MessageChannel().port1 });

async function founderAndJoinee() {
  const founderRepo = repo();
  const founderSeed = new Uint8Array(32).fill(81), signerSeed = new Uint8Array(32).fill(82);
  const atomSeed = new Uint8Array(32).fill(83), joineeAtom = new Uint8Array(32).fill(84);
  const founder = await foundThePlace({ repo: founderRepo, vesselSeed: founderSeed, hearthTrueName: "hearth" });
  const face = await foundTheFace({
    repo: founderRepo, daemonHandle: founder.daemonHandle, vesselVerifyingKey: key(founderSeed), vesselDisplayName: "founder",
    binding: { mode: "self-stood", signerSeed }, hearthTrueName: "hearth", nexusPubkey: key(founderSeed), atomSeed,
  });
  const board = await materializeSharedLarDoc(founderRepo, personaKelBoardDocUrl(key(founderSeed)), "board:persona-kel");
  const chain = personaKelChainForPrefix(board.doc(), face.personaKelPrefix)!;
  const personaActs = await founderAndJoineeActs({ face, signerSeed, founderAtomSeed: atomSeed, joineeKey: key(joineeAtom), chain });
  const payload = await runDeviceAdmitEdge({
    signerSeed, joineeVerifyingKey: key(joineeAtom), personaKelPrefix: face.personaKelPrefix, personaKelChain: chain, personaActs,
    edgeFrontier: await frontierFromFoundingSeed(signerSeed), hearthTrueName: "hearth", personaGroupId: face.personaGroupId,
    meshCabalDocIdHex: face.meshCabalDocIdHex, syncUrl: null, hearthDaemonUrl: founder.daemonUrl, personaUrl: face.personaUrl,
  });
  const joineeRepo = repo();
  const applied = await runApplyAdmitPayload({ repo: joineeRepo, daemonHandle: seedDaemonDoc(joineeRepo), atomSeed: joineeAtom, vesselDisplayName: "joinee", payload, nexusPubkey: key(founderSeed) });
  return { face, chain, applied, payload, signerSeed, joineeKey: key(joineeAtom), personaActs };
}

describe("a face's circles and identities follow the face", () => {
  test("a second device admitted into the group adopts the founder's circles and identities, and proves them from the bundle", async () => {
    const f = await founderAndJoinee();
    expect(f.applied.identitiesUrl, "the founder's identities document, same url").toBe(f.face.identitiesUrl);
    expect(f.applied.circlesUrl, "the founder's circles document, same url").toBe(f.face.circlesUrl);
    expect(f.applied.sessionsUrl, "sessions stay per vessel").not.toBe(f.face.sessionsUrl);
    const anchor = mintFaceAnchor({ personaGroup: f.face.personaGroupId, personaKelPrefix: f.face.personaKelPrefix, personaRootDid: f.face.founderEdge.personaRootDid, edge: f.applied.deviceEdge, leaseEpoch: 0 });
    const proof = (planes: Record<string, string>, records = f.personaActs) => proveFaceFromLog({ records, chain: f.chain, group: f.face.personaGroupId, anchor, deviceKey: f.joineeKey, planes });
    const shared = { persona: f.applied.personaUrl, identities: f.applied.identitiesUrl, circles: f.applied.circlesUrl };
    expect(proof(shared).ok).toBe(true);
    // RED: a document named by no act refuses
    expect(proof({ ...shared, circles: "automerge:forged" })).toEqual({ ok: false, refusal: { why: "plane", plane: "circles" } });
    expect(proof({ ...shared, identities: "automerge:forged" })).toEqual({ ok: false, refusal: { why: "plane", plane: "identities" } });
  });

  test("RED: a document named only by a stranger's act refuses", async () => {
    const f = await founderAndJoinee();
    const stranger = { key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(99)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(99)) };
    // the founder's whole log, and a stranger's plane act after it naming a forged circles url
    const head = (f.personaActs as Array<{ body: { seq: number } }>).reduce((m, a) => Math.max(m, a.body.seq), 0);
    expect(head).toBeGreaterThan(0);
    const forgedAct = await signPersonaAct({ seq: head, cid: actCid((f.personaActs as Array<{ body: never }>).find((a) => (a.body as { seq: number }).seq === head)!.body) },
      { group: f.face.personaGroupId, act: "plane", epoch: 0, fields: { plane: "circles", url: "automerge:forged" } }, stranger);
    const anchor = mintFaceAnchor({ personaGroup: f.face.personaGroupId, personaKelPrefix: f.face.personaKelPrefix, personaRootDid: f.face.founderEdge.personaRootDid, edge: f.applied.deviceEdge, leaseEpoch: 0 });
    const r = proveFaceFromLog({ records: [...f.personaActs, forgedAct], chain: f.chain, group: f.face.personaGroupId, anchor, deviceKey: f.joineeKey,
      planes: { persona: f.applied.personaUrl, circles: "automerge:forged" } });
    expect(r).toEqual({ ok: false, refusal: { why: "plane", plane: "circles" } });
    // CONTROL: the founder's own circles url, with the stranger's act present, still proves
    expect(proveFaceFromLog({ records: [...f.personaActs, forgedAct], chain: f.chain, group: f.face.personaGroupId, anchor, deviceKey: f.joineeKey, planes: { persona: f.applied.personaUrl, circles: f.applied.circlesUrl } }).ok).toBe(true);
  });

  test("RED: a forged unsigned plane act ahead of the founder's never picks the adopted urls, and a malformed act refuses the bundle before any side effect", async () => {
    const f = await founderAndJoinee();
    const forged = { body: { act: "plane", plane: "circles", url: "automerge:forged", group: f.face.personaGroupId, seq: 99 }, sig: "00", signer: "00" };
    const joineeAtom = new Uint8Array(32).fill(84);
    const adopt = (personaActs: unknown[]) => {
      const r = repo();
      return { r, run: runApplyAdmitPayload({ repo: r, daemonHandle: seedDaemonDoc(r), atomSeed: joineeAtom, vesselDisplayName: "joinee",
        payload: { ...f.payload, personaActs: personaActs as never }, nexusPubkey: key(new Uint8Array(32).fill(81)) }) };
    };
    const forgedFirst = await adopt([forged, ...(f.personaActs as unknown[])]).run;
    expect(forgedFirst.circlesUrl, "the verified projection names the url, not the first raw record").toBe(f.face.circlesUrl);
    const malformed = adopt([null, ...(f.personaActs as unknown[])]);
    await expect(malformed.run).rejects.toThrow(/malformed persona act/);
  });

  test("CONTROL: a vessel with no PersonaGroup reads only the floor, with no face documents", async () => {
    const placeRepo = repo();
    const place = await foundThePlace({ repo: placeRepo, vesselSeed: new Uint8Array(32).fill(91), hearthTrueName: "hearth" });
    const doc = place.daemonHandle.doc() as LarDoc;
    expect(personaActRecordsOfGroup(doc, "any")).toEqual([]);
    expect(Object.keys(place).filter((k) => /identities|circles|sessions|persona/i.test(k))).toEqual([]);
    void writePersonaAct;
  });
});
