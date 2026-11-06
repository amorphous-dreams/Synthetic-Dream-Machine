/**
 * persona-act-board — a face's acts rest in the plane doc; the KEL gives the root's roster per epoch. Reds: a
 * plane act the root did not sign never projects; a rotated root verifies old acts under the old key. Controls: the
 * signed genesis log projects whole through the doc.
 */
import { describe, expect, test } from "vitest";
import { PERSONA_ACT_DOMAIN } from "../src/domains.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { personaActRecordsOfGroup, personaLineageFromKel, signFoundingLog, signPersonaAct, writePersonaAct } from "../src/persona-act-board.js";
import { projectPersonaLog, registerablePlanes } from "../src/persona-act.js";
import { actCid } from "../src/signed-act.js";
import { realKel, forgedRotation } from "./kel-fixture.js";
import type { LarDoc } from "../src/base-doc.js";
import type { PersonaKelEvent } from "../src/persona-kel.js";
import { taggedAdmission, testVesselTag } from "./vessel-tag-fixture.js";
import { vesselFaceTagHolds } from "../src/vessel-face-tag.js";

const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(seed(n)), sign: ed25519SignerFromSeed(seed(n)) });
const G = "g1";
const kel = async (...keys: string[]): Promise<PersonaKelEvent[]> => (await realKel(keys)).chain;
const docOf = (): LarDoc => ({ tiddlers: {} } as unknown as LarDoc);

describe("persona-act-board", () => {
  test("CONTROL: the signed genesis log rests in the doc and projects whole", async () => {
    const root = await who(1);
    const log = await signFoundingLog({ group: G, personaKelPrefix: "kel1", rootCommitment: "rc", epoch: 0, planes: { "persona": "automerge:p", "circles": "automerge:c" }, deviceKey: "dev1", edgeDigest: "ed1", vesselTag: await testVesselTag(1, G, "dev1") }, root);
    const doc = docOf();
    for (const a of log) writePersonaAct(doc, a);
    const lineage = personaLineageFromKel(await kel(root.key))!;
    const pr = projectPersonaLog(personaActRecordsOfGroup(doc, G), { group: G, lineage, authorize: () => true });
    expect(pr).toMatchObject({ founded: true, personaKelPrefix: "kel1", devices: ["dev1"], edges: { dev1: "ed1" } });
    expect(registerablePlanes({ "persona": "automerge:p", "circles": "automerge:c", "sessions": "automerge:forged" }, pr)).toEqual({ "persona": "automerge:p", "circles": "automerge:c" });
    expect(personaActRecordsOfGroup(doc, "other")).toEqual([]);
  });

  test("RED: the founding admission carries the founder vessel's tag, read back off the doc, and the fold seats it", async () => {
    const root = await who(1);
    const tag = await testVesselTag(3, G, "dev1");
    const log = await signFoundingLog({ group: G, personaKelPrefix: "kel1", rootCommitment: "rc", epoch: 0, planes: {}, deviceKey: "dev1", edgeDigest: "ed1", vesselTag: tag }, root);
    const doc = docOf();
    for (const a of log) writePersonaAct(doc, a);
    const admission = personaActRecordsOfGroup(doc, G).map((r) => (r as { body: Record<string, unknown> }).body).find((b) => b["act"] === "admission")!;
    expect(admission).toMatchObject({ deviceKey: "dev1", vesselTag: tag.vesselTag, vesselSig: tag.vesselSig });
    expect(vesselFaceTagHolds(G, "dev1", admission)).toBe(true);
    const pr = projectPersonaLog(personaActRecordsOfGroup(doc, G), { group: G, lineage: personaLineageFromKel(await kel(root.key))!, authorize: () => true });
    expect(pr.vesselTags).toEqual([tag.vesselTag]);
    expect(pr.admissionRefusals).toEqual([]);
  });

  test("RED: a plane act signed by a key outside the KEL never projects", async () => {
    const root = await who(1), thief = await who(9);
    const log = await signFoundingLog({ group: G, personaKelPrefix: "kel1", rootCommitment: "rc", epoch: 0, planes: { "persona": "automerge:p" }, deviceKey: "d", edgeDigest: "e", vesselTag: await testVesselTag(1, G, "d") }, root);
    const head = { seq: log[log.length - 1]!.body.seq, cid: actCid(log[log.length - 1]!.body) };
    const evil = await signPersonaAct(head, { group: G, act: "plane", epoch: 0, fields: { plane: "circles", url: "automerge:evil" } }, thief);
    const doc = docOf();
    for (const a of [...log, evil]) writePersonaAct(doc, a);
    const pr = projectPersonaLog(personaActRecordsOfGroup(doc, G), { group: G, lineage: personaLineageFromKel(await kel(root.key))!, authorize: () => true });
    expect(pr.planes).toEqual({ "persona": "automerge:p" });
  });

  test("RED: after a root rotation the old acts verify under the old key and the old key signs nothing new", async () => {
    const oldK = await who(1), newK = await who(2);
    const log = await signFoundingLog({ group: G, personaKelPrefix: "kel1", rootCommitment: "rc", epoch: 0, planes: {}, deviceKey: "d", edgeDigest: "e", vesselTag: await testVesselTag(1, G, "d") }, oldK);
    const head = { seq: log[log.length - 1]!.body.seq, cid: actCid(log[log.length - 1]!.body) };
    const byNew = await signPersonaAct(head, { group: G, act: "admission", epoch: 1, fields: await taggedAdmission(2, G, "d2") }, newK);
    const byOldLate = await signPersonaAct({ seq: byNew.body.seq, cid: actCid(byNew.body) }, { group: G, act: "admission", epoch: 0, fields: await taggedAdmission(3, G, "d3") }, oldK);
    const lineage = personaLineageFromKel(await kel(oldK.key, newK.key))!;
    const pr = projectPersonaLog([...log, byNew, byOldLate], { group: G, lineage, authorize: () => true });
    expect(pr.devices).toEqual(["d", "d2"]);
    void PERSONA_ACT_DOMAIN;
  });

  test("RED: a retired key's linked act right after the old head, with the KEL rotated and the frontier pinned, projects nothing; it bites only with the pin", async () => {
    const oldK = await who(1), newK = await who(2);
    const log = await signFoundingLog({ group: G, personaKelPrefix: "kel1", rootCommitment: "rc", epoch: 0, planes: {}, deviceKey: "d", edgeDigest: "e", vesselTag: await testVesselTag(1, G, "d") }, oldK);
    const headAct = log[log.length - 1]!;
    const head = { seq: headAct.body.seq, cid: actCid(headAct.body) };
    const stale = await signPersonaAct(head, { group: G, act: "admission", epoch: 0, fields: await taggedAdmission(4, G, "dEvil") }, oldK);
    const lineage = personaLineageFromKel(await kel(oldK.key, newK.key))!;
    const unpinned = projectPersonaLog([...log, stale], { group: G, lineage, authorize: () => true });
    expect(unpinned.devices, "without a pinned frontier every epoch keeps its own roster").toEqual(["d", "dEvil"]);
    const pinned = projectPersonaLog([...log, stale], { group: G, lineage, authorize: () => true, acceptedThrough: head.seq });
    expect(pinned.devices).toEqual(["d"]);
  });

  test("RED: a rejected rotation in the chain seats no key and authorizes no act; CONTROL: the verified lineage still reads", async () => {
    const root = await who(1), attacker = await who(9);
    const real = (await realKel([root.key])).chain;
    const lineage = personaLineageFromKel([...real, forgedRotation(real, attacker.key)])!;
    expect(lineage.length, "the forged seq-1 rotation is not an epoch").toBe(1);
    expect(personaLineageFromKel(real)!.length).toBe(1);
    const log = await signFoundingLog({ group: G, personaKelPrefix: "kel1", rootCommitment: "rc", epoch: 0, planes: {}, deviceKey: "d", edgeDigest: "e", vesselTag: await testVesselTag(1, G, "d") }, root);
    const head = { seq: log[log.length - 1]!.body.seq, cid: actCid(log[log.length - 1]!.body) };
    const evil = await signPersonaAct(head, { group: G, act: "admission", epoch: 1, fields: await taggedAdmission(4, G, "dEvil") }, attacker);
    expect(projectPersonaLog([...log, evil], { group: G, lineage, authorize: () => true }).devices).toEqual(["d"]);
  });
});
