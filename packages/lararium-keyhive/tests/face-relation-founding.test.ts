/**
 * face-relation-founding — the founding act signs the face's relation id F into the log, once, and a joinee reads it from
 * the verified admit bundle.
 *
 * SECURITY CLASS (signed founding acts; authority input on admit). Reds: the founded log pins a random UUID under `FACE_PLANE`
 * exactly once; two fresh foundings mint two ids; a founding that carries an id (a recovery onto a new group) pins that id;
 * a joinee's admit names the founder's F. Controls: a re-entered founding pins nothing twice and keeps the id; a stranger's
 * face-plane act names nothing; a bundle with no face act names none.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import {
  groupSecretOpenerFromSeed, makeIslandRepo, materializeSharedLarDoc, personaKelBoardDocUrl, personaKelChainForPrefix,
  personaLineageFromKel, personaActRecordsOfGroup, projectPersonaLog, seedDaemonDoc, signPersonaAct, ed25519SignerFromSeed,
  ed25519VerifyingKeyFromSeed, actCid, FACE_PLANE, faceRelationOf, writePersonaAct, type LarDoc,
} from "@lararium/mesh";
import { foundTheFace, foundThePlace, runApplyAdmitPayload, runDeviceAdmitEdge } from "../src/index.js";
import { founderAndJoineeActs, frontierFromFoundingSeed } from "./admit-acts.js";

const key = (seed: Uint8Array) => groupSecretOpenerFromSeed(seed).deviceKey;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RECOVERED = "5d2c9e70-1b3a-4f68-8a47-c0e91d3b7a25";

async function founded(n: number, relation?: string) {
  const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const vesselSeed = new Uint8Array(32).fill(80 + n), signerSeed = new Uint8Array(32).fill(90 + n), atomSeed = new Uint8Array(32).fill(100 + n);
  const place = await foundThePlace({ repo, vesselSeed, hearthTrueName: "hearth" });
  const input = {
    repo, daemonHandle: place.daemonHandle, placeVerifyingKey: key(vesselSeed), vesselDisplayName: "founder",
    binding: { mode: "self-stood" as const, signerSeed }, hearthTrueName: "hearth", nexusPubkey: key(vesselSeed), atomSeed,
    ...(relation ? { faceRelation: relation } : {}),
  };
  const face = await foundTheFace(input);
  const board = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(key(vesselSeed)), "board:persona-kel");
  const lineage = personaLineageFromKel(personaKelChainForPrefix(board.doc(), face.personaKelPrefix)!)!;
  const persona = await repo.find<LarDoc>(face.personaUrl as never);
  const records = () => personaActRecordsOfGroup(persona.doc(), face.personaGroupId);
  const project = () => projectPersonaLog(records(), { group: face.personaGroupId, lineage, authorize: () => true });
  const faceActs = () => records().filter((r) => (r as { body: Record<string, unknown> }).body["act"] === "plane" && (r as { body: Record<string, unknown> }).body["plane"] === FACE_PLANE);
  return { face, input, project, faceActs, persona, signerSeed, lineage };
}

describe("the founding pins the face's relation id", () => {
  test("RED: the founded log pins a random UUID once, and the founding result names it", async () => {
    const f = await founded(1);
    const id = faceRelationOf(f.project());
    expect(id).toMatch(UUID);
    expect(f.faceActs()).toHaveLength(1);
    expect((f.face as unknown as { faceRelation?: string }).faceRelation).toBe(id);
  });

  test("RED: two fresh foundings mint two ids; CONTROL: a re-entered founding keeps its id and pins nothing twice", async () => {
    const a = await founded(2), b = await founded(3);
    expect(faceRelationOf(a.project())).not.toBe(faceRelationOf(b.project()));
    const keep = faceRelationOf(a.project()), pins = a.faceActs().length;
    await foundTheFace(a.input);
    expect(a.faceActs()).toHaveLength(pins);
    expect(faceRelationOf(a.project())).toBe(keep);
  });

  test("RED: a recovery onto a new group pins the id it carries, so the folder survives; CONTROL: its group differs from the first face's", async () => {
    const first = await founded(4, RECOVERED), second = await founded(5, RECOVERED);
    expect(faceRelationOf(first.project())).toBe(RECOVERED);
    expect(faceRelationOf(second.project())).toBe(RECOVERED);
    expect(first.face.personaGroupId).not.toBe(second.face.personaGroupId);
  });
});

type Act = { body: { seq: number } };
async function admitWith(extra: (head: { seq: number; cid: string }, group: string, epoch: number, signerSeed: Uint8Array) => Promise<unknown[]>) {
  const founderRepo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const founderSeed = new Uint8Array(32).fill(61), signerSeed = new Uint8Array(32).fill(62);
  const atomSeed = new Uint8Array(32).fill(63), joineeAtom = new Uint8Array(32).fill(64);
  const founder = await foundThePlace({ repo: founderRepo, vesselSeed: founderSeed, hearthTrueName: "hearth" });
  const face = await foundTheFace({
    repo: founderRepo, daemonHandle: founder.daemonHandle, placeVerifyingKey: key(founderSeed), vesselDisplayName: "founder",
    binding: { mode: "self-stood", signerSeed }, hearthTrueName: "hearth", nexusPubkey: key(founderSeed), atomSeed,
  });
  const board = await materializeSharedLarDoc(founderRepo, personaKelBoardDocUrl(key(founderSeed)), "board:persona-kel");
  const chain = personaKelChainForPrefix(board.doc(), face.personaKelPrefix)!;
  const base = await founderAndJoineeActs({ face, signerSeed, founderAtomSeed: atomSeed, joineeKey: key(joineeAtom), chain, extraPlanes: { [FACE_PLANE]: (face as unknown as { faceRelation: string }).faceRelation } }) as Act[];
  const last = base.reduce((m, a) => (a.body.seq > m.body.seq ? a : m));
  const personaActs = [...base, ...await extra({ seq: last.body.seq, cid: actCid(last.body as never) }, face.personaGroupId, chain[chain.length - 1]!.seq, signerSeed)];
  const payload = await runDeviceAdmitEdge({
    signerSeed, joineeVerifyingKey: key(joineeAtom), personaKelPrefix: face.personaKelPrefix, personaKelChain: chain, personaActs,
    edgeFrontier: await frontierFromFoundingSeed(signerSeed), hearthTrueName: "hearth", personaGroupId: face.personaGroupId,
    meshCabalDocIdHex: face.meshCabalDocIdHex, syncUrl: null, hearthDaemonUrl: founder.daemonUrl, personaUrl: face.personaUrl,
  });
  const joineeRepo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const applied = await runApplyAdmitPayload({ repo: joineeRepo, daemonHandle: seedDaemonDoc(joineeRepo), atomSeed: joineeAtom, vesselDisplayName: "joinee", payload, nexusPubkey: key(founderSeed) });
  return { ...applied, founderRelation: (face as unknown as { faceRelation: string }).faceRelation };
}
const faceAct = async (head: { seq: number; cid: string }, group: string, epoch: number, seed: Uint8Array) =>
  signPersonaAct(head, { group, act: "plane", epoch, fields: { plane: FACE_PLANE, url: RECOVERED } },
    { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) });

describe("a joinee reads F from the verified admit bundle", () => {
  test("RED: the admit names the founder's F, the one the founding act pinned", async () => {
    const applied = await admitWith(async () => []);
    expect(applied.founderRelation).toMatch(UUID);
    expect((applied as unknown as { faceRelation: string | null }).faceRelation).toBe(applied.founderRelation);
  });
  test("RED: a later root-signed face-plane act rides the bundle and the admit still names the FOUNDING F (first pin per plane)", async () => {
    const applied = await admitWith(async (head, group, epoch, seed) => [await faceAct(head, group, epoch, seed)]);
    expect((applied as unknown as { faceRelation: string | null }).faceRelation).toBe(applied.founderRelation);
    expect((applied as unknown as { faceRelation: string | null }).faceRelation).not.toBe(RECOVERED);
  });
  test("CONTROL: a stranger's face-plane act names none of its own", async () => {
    const applied = await admitWith(async (head, group, epoch) => [await faceAct(head, group, epoch, new Uint8Array(32).fill(99))]);
    expect((applied as unknown as { faceRelation: string | null }).faceRelation).not.toBe(RECOVERED);
  });
});

describe("the pin is founding-only: a later plane act never rewrites F", () => {
  test("RED: a later root-signed plane act naming another id reads as no act, so the projection keeps the founding F; CONTROL: the founding F stands before the act", async () => {
    const f = await founded(6);
    const first = faceRelationOf(f.project());
    expect(first).toMatch(UUID);
    const head = f.project().head!;
    const epoch = 0;
    const act = await signPersonaAct({ seq: head.seq, cid: head.cid }, { group: f.face.personaGroupId, act: "plane", epoch, fields: { plane: FACE_PLANE, url: RECOVERED } },
      { key: await ed25519VerifyingKeyFromSeed(f.signerSeed), sign: ed25519SignerFromSeed(f.signerSeed) });
    f.persona.change((draft) => { writePersonaAct(draft, act); });
    expect(faceRelationOf(f.project())).toBe(first);
    expect(faceRelationOf(f.project())).not.toBe(RECOVERED);
  });
});
