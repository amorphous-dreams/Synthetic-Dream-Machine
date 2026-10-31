/**
 * face-boot-proof — the boot's proof from the signed log. Reds: a plane the log never named, a log founded under
 * another prefix, a device no admission seated, a missing log and a fork each refuse by name. Control: the honest
 * founded face proves.
 */
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { emptyLarDoc } from "../src/base-doc.js";
import { didFromVerifyingKey } from "../src/lar-did.js";
import { mintFaceAnchor, faceRootCommitment, edgeBodyDigest, raiseFaceFrontier } from "../src/face-anchor.js";
import { proveFaceFromLog } from "../src/face-boot-proof.js";
import { personaActRecordsOfGroup, signFoundingLog, signPersonaAct, writePersonaAct } from "../src/persona-act-board.js";
import { writePersonaKelEvent, personaKelChainForPrefix } from "../src/persona-kel-board.js";
import { provisionThresholdRecoveryAtFounding } from "../src/recovery-keel-core.js";
import { recoveryContactRegistrationCard } from "../src/recovery-registration.js";
import { actCid, signAct } from "../src/signed-act.js";

const G = "g-mine";
const pub = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);

async function founded(prefixOverride?: string) {
  const rootSeed = new Uint8Array(32).fill(11);
  const rootKey = await pub(rootSeed);
  const gk = await Promise.all([1, 2, 3].map((n) => pub(new Uint8Array(32).fill(n))));
  const prov = provisionThresholdRecoveryAtFounding({
    foundingOpKeyDid: `0x${rootKey}`,
    recoveryContacts: gk.map((k, i) => recoveryContactRegistrationCard((["mine", "contact-a", "contact-b"] as const)[i]!, k, null)),
    recoveryThreshold: 2,
  });
  const kelDoc = emptyLarDoc(); writePersonaKelEvent(kelDoc, prov.inception);
  const chain = personaKelChainForPrefix(kelDoc, prov.inception.prefix)!;
  const root = { key: rootKey, sign: async (b: Uint8Array) => hex(await ed.signAsync(b, rootSeed)) };
  const edge = { personaRootDid: didFromVerifyingKey(rootKey), deviceVerifyingKey: "dev1", hearthTrueName: "hearth", boundEpoch: 0 };
  const planes = { persona: "automerge:p", identities: "automerge:i", circles: "automerge:c", sessions: "automerge:s", intents: "automerge:t" };
  const log = await signFoundingLog({
    group: G, personaKelPrefix: prefixOverride ?? prov.inception.prefix, rootCommitment: faceRootCommitment(didFromVerifyingKey(rootKey)),
    epoch: 0, planes, deviceKey: "dev1", edgeDigest: edgeBodyDigest(edge),
  }, root);
  const anchor = mintFaceAnchor({ personaGroup: G, personaKelPrefix: prov.inception.prefix, personaRootDid: didFromVerifyingKey(rootKey), edge, leaseEpoch: 0 });
  return { chain, root, log, planes, anchor, edge };
}
const docRecords = (acts: unknown[]) => { const d = emptyLarDoc(); for (const a of acts) writePersonaAct(d, a as never); return personaActRecordsOfGroup(d, G); };

describe("face-boot-proof", () => {
  test("CONTROL: the honest founded face proves", async () => {
    const f = await founded();
    const r = proveFaceFromLog({ records: docRecords(f.log), chain: f.chain, group: G, anchor: f.anchor, deviceKey: "dev1", edge: f.edge, planes: f.planes });
    expect(r.ok).toBe(true);
  });
  test("RED: the intents url needs this face's signed plane act; CONTROL: its signed url and sibling still prove", async () => {
    const f = await founded();
    const base = { records: docRecords(f.log), chain: f.chain, group: G, anchor: f.anchor };
    expect(proveFaceFromLog({ ...base, planes: { intents: "automerge:unsigned" } }))
      .toEqual({ ok: false, refusal: { why: "plane", plane: "intents" } });
    expect(proveFaceFromLog({ ...base, planes: { intents: f.planes.intents } }).ok).toBe(true);
    expect(proveFaceFromLog({ ...base, planes: { circles: f.planes.circles } }).ok).toBe(true);
  });
  test("RED: another face, a wrong domain, and a non-root signer cannot back an intents url", async () => {
    const f = await founded();
    const head = f.log[f.log.length - 1]!;
    const next = { seq: head.body.seq + 1, prior: actCid(head.body), group: G, act: "plane", epoch: 0, plane: "intents", url: "automerge:forged" };
    const strangerSeed = new Uint8Array(32).fill(71);
    const stranger = { key: await pub(strangerSeed), sign: async (b: Uint8Array) => hex(await ed.signAsync(b, strangerSeed)) };
    const wrongDomain = await signAct({ ...next, kind: "wrong-domain" }, f.root);
    const wrongSigner = await signPersonaAct({ seq: head.body.seq, cid: next.prior }, { group: G, act: "plane", epoch: 0, fields: { plane: "intents", url: next.url } }, stranger);
    const wrongFace = await signPersonaAct({ seq: head.body.seq, cid: next.prior }, { group: "g-other", act: "plane", epoch: 0, fields: { plane: "intents", url: next.url } }, f.root);
    const check = (extra: unknown) => proveFaceFromLog({ records: docRecords([...f.log, extra]), chain: f.chain, group: G, anchor: f.anchor, planes: { intents: next.url } });
    for (const act of [wrongDomain, wrongSigner, wrongFace]) expect(check(act)).toEqual({ ok: false, refusal: { why: "plane", plane: "intents" } });
    expect(proveFaceFromLog({ records: docRecords(f.log), chain: f.chain, group: G, anchor: f.anchor, planes: { intents: f.planes.intents } }).ok).toBe(true);
  });
  test("RED: a plane the log never named, a device no admission seated and a missing log each refuse by name", async () => {
    const f = await founded();
    const base = { chain: f.chain, group: G, anchor: f.anchor };
    expect(proveFaceFromLog({ ...base, records: docRecords(f.log), deviceKey: "dev1", planes: { ...f.planes, circles: "automerge:forged" } }))
      .toEqual({ ok: false, refusal: { why: "plane", plane: "circles" } });
    expect(proveFaceFromLog({ ...base, records: docRecords(f.log), deviceKey: "stranger", planes: f.planes }))
      .toEqual({ ok: false, refusal: { why: "device-unseated" } });
    expect(proveFaceFromLog({ ...base, records: [], deviceKey: "dev1", planes: f.planes })).toEqual({ ok: false, refusal: { why: "no-founding" } });
  });
  test("RED: a log founded under another prefix refuses, and two acts at one sequence refuse as a fork", async () => {
    const other = await founded("kel-other");
    expect(proveFaceFromLog({ records: docRecords(other.log), chain: other.chain, group: G, anchor: other.anchor, deviceKey: "dev1", planes: other.planes }))
      .toEqual({ ok: false, refusal: { why: "prefix" } });
    const f = await founded();
    const head = { seq: f.log[f.log.length - 1]!.body.seq, cid: actCid(f.log[f.log.length - 1]!.body) };
    const x = await signPersonaAct(head, { group: G, act: "admission", epoch: 0, fields: { deviceKey: "devA" } }, f.root);
    const y = await signPersonaAct(head, { group: G, act: "admission", epoch: 0, fields: { deviceKey: "devB" } }, f.root);
    const r = proveFaceFromLog({ records: docRecords([...f.log, x, y]), chain: f.chain, group: G, anchor: f.anchor, deviceKey: "dev1", planes: f.planes });
    expect(r).toEqual({ ok: false, refusal: { why: "fork", seq: head.seq + 1 } });
  });

  // A JOINEE PROVES FROM ITS ADMIT BUNDLE, AND A LATER REPLICA OF THE PLANE MAY DISAGREE: the same checks judge both, and
  // when the bundle's act and the replica's act contest one sequence the boot names the fork and refuses; it trusts neither.
  test("RED: a bundle's act and a later replica's act at one sequence refuse as a fork; CONTROL: a replica that extends the bundle proves", async () => {
    const f = await founded();
    const head = { seq: f.log[f.log.length - 1]!.body.seq, cid: actCid(f.log[f.log.length - 1]!.body) };
    const inBundle = await signPersonaAct(head, { group: G, act: "admission", epoch: 0, fields: { deviceKey: "devBundle" } }, f.root);
    const inReplica = await signPersonaAct(head, { group: G, act: "admission", epoch: 0, fields: { deviceKey: "devReplica" } }, f.root);
    const bundle = [...f.log, inBundle], replica = [...f.log, inReplica];
    const proof = (records: unknown[]) => proveFaceFromLog({ records, chain: f.chain, group: G, anchor: f.anchor, deviceKey: "dev1", edge: f.edge, planes: f.planes });
    expect(proof(docRecords([...bundle, ...replica]))).toEqual({ ok: false, refusal: { why: "fork", seq: head.seq + 1 } });
    const extension = await signPersonaAct({ seq: inBundle.body.seq, cid: actCid(inBundle.body) }, { group: G, act: "admission", epoch: 0, fields: { deviceKey: "devLater" } }, f.root);
    expect(proof(docRecords([...bundle, extension])).ok).toBe(true);
  });

  // THE LOG NEVER FALLS BEHIND WHAT THE DEVICE ACCEPTED, AND ITS EDGE ACT MUST COMMIT TO THIS DEVICE'S EDGE.
  test("RED: an older valid log replayed under a raised anchor names `frontier-falls`; a log whose edge act commits to another edge names `edge`", async () => {
    const f = await founded();
    const head = f.log[f.log.length - 1]!;
    const raised = raiseFaceFrontier(f.anchor, { actSeq: head.body.seq, actCid: actCid(head.body) });
    const base = { chain: f.chain, group: G, deviceKey: "dev1", edge: f.edge, planes: f.planes };
    expect(proveFaceFromLog({ ...base, records: docRecords(f.log), anchor: raised }).ok, "CONTROL: the whole log under the raised anchor proves").toBe(true);
    const older = f.log.slice(0, -1);   // the device-edge act deleted: an older valid log
    expect(proveFaceFromLog({ ...base, records: docRecords(older), anchor: raised })).toMatchObject({ ok: false });
    const wrongPin = raiseFaceFrontier(f.anchor, { actSeq: 2, actCid: "not-the-cid-at-that-seq" });
    expect(proveFaceFromLog({ ...base, records: docRecords(f.log), anchor: wrongPin })).toEqual({ ok: false, refusal: { why: "frontier-falls" } });
    expect(proveFaceFromLog({ ...base, records: docRecords(f.log), anchor: f.anchor, edge: { ...f.edge, boundEpoch: 9 } })).toEqual({ ok: false, refusal: { why: "edge" } });
  });

  test("RED: a registration proof (no device seat) of another face refuses a forged extra persona selector; CONTROL: its genuine plane url proves", async () => {
    const f = await founded();
    const records = docRecords(f.log);
    const forged = proveFaceFromLog({ records, chain: f.chain, group: G, anchor: f.anchor, planes: { persona: "automerge:forged" } });
    expect(forged).toMatchObject({ ok: false, refusal: { why: "plane", plane: "persona" } });
    expect(proveFaceFromLog({ records, chain: f.chain, group: G, anchor: f.anchor, planes: { persona: f.planes.persona } }).ok).toBe(true);
  });
});
