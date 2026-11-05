/**
 * vessel-face-tag: one vessel never takes two seats in one face, and its tags stay unlinkable across faces.
 * Reds run against the fold WITHOUT the tag law first (an untagged log seats the same vessel twice); controls admit two distinct vessels.
 */
import { describe, expect, test } from "vitest";
import { PERSONA_ACT_DOMAIN } from "../src/domains.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { makeHandLineage } from "../src/hand-lineage.js";
import { projectPersonaLog, type PersonaActBody } from "../src/persona-act.js";
import { actCid, signAct } from "../src/signed-act.js";
import { vesselFaceTagFields, vesselFaceTagHolds } from "../src/vessel-face-tag.js";

const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(seed(n)), sign: ed25519SignerFromSeed(seed(n)) });
const act = (group: string, seq: number, prior: string | null, kind: PersonaActBody["act"], extra: Record<string, unknown> = {}) =>
  ({ kind: PERSONA_ACT_DOMAIN, group, seq, prior, act: kind, epoch: 0, ...extra }) as PersonaActBody;

async function face(group: string, admissions: ReadonlyArray<Record<string, unknown>>) {
  const root = await who(1), lineage = makeHandLineage([{ epoch: 0, signers: [root.key], threshold: 1 }])!;
  let head = await signAct(act(group, 0, null, "founding", { personaKelPrefix: "k", rootCommitment: "r" }), root);
  const log = [head];
  for (const [i, fields] of admissions.entries()) {
    head = await signAct(act(group, i + 1, actCid(head.body), "admission", fields), root);
    log.push(head);
  }
  const project = (vesselTags?: "required") => projectPersonaLog(log, { group, lineage, authorize: () => true, ...(vesselTags ? { vesselTags } : {}) });
  return { project, log, root };
}

describe("vessel face tag", () => {
  test("RED: one vessel admitted twice into one face under two atoms refuses vessel-already-admitted; CONTROL: two distinct vessels both seat", async () => {
    const vessel = seed(7), other = seed(8), atomA = (await who(21)).key, atomB = (await who(22)).key;
    const twice = await face("faceA", [
      { deviceKey: atomA, ...(await vesselFaceTagFields(vessel, "faceA", atomA)) },
      { deviceKey: atomB, ...(await vesselFaceTagFields(vessel, "faceA", atomB)) },
    ]);
    const bare = await face("faceA", [{ deviceKey: atomA }, { deviceKey: atomB }]);
    expect(bare.project().devices).toEqual([atomA, atomB].sort());   // before the tag: the same metal takes two seats and nothing says so
    const read = twice.project();
    expect(read.devices).toEqual([atomA]);
    expect(read.admissionRefusals).toEqual([{ refusal: "vessel-already-admitted", cid: actCid(twice.log[2]!.body) }]);
    const distinct = await face("faceA", [
      { deviceKey: atomA, ...(await vesselFaceTagFields(vessel, "faceA", atomA)) },
      { deviceKey: atomB, ...(await vesselFaceTagFields(other, "faceA", atomB)) },
    ]);
    expect(distinct.project().devices).toEqual([atomA, atomB].sort());
    expect(distinct.project().admissionRefusals).toEqual([]);
  });

  test("RED: the same atom re-admitted with its own vessel refuses vessel-already-admitted (an admit replay seats nothing twice)", async () => {
    const vessel = seed(7), atom = (await who(21)).key, fields = await vesselFaceTagFields(vessel, "faceA", atom);
    const replay = await face("faceA", [{ deviceKey: atom, ...fields }, { deviceKey: atom, ...fields }]);
    const read = replay.project();
    expect(read.devices).toEqual([atom]);
    expect(read.admissions).toHaveLength(1);
    expect(read.admissionRefusals.map((r) => r.refusal)).toEqual(["vessel-already-admitted"]);
  });

  test("RED: a tagless admission refuses vessel-tag-absent under the required law; CONTROL: a tagged one seats", async () => {
    const atom = (await who(21)).key;
    const bare = await face("faceA", [{ deviceKey: atom }]);
    expect(bare.project("required").devices).toEqual([]);
    expect(bare.project("required").admissionRefusals).toEqual([{ refusal: "vessel-tag-absent", cid: actCid(bare.log[1]!.body) }]);
    const tagged = await face("faceA", [{ deviceKey: atom, ...(await vesselFaceTagFields(seed(7), "faceA", atom)) }]);
    expect(tagged.project("required").devices).toEqual([atom]);
  });

  test("RED: a tag that vouches for another atom or another face refuses vessel-tag-invalid", async () => {
    const atom = (await who(21)).key, atomB = (await who(22)).key, vessel = seed(7);
    const stolen = await face("faceA", [{ deviceKey: atomB, ...(await vesselFaceTagFields(vessel, "faceA", atom)) }]);
    expect(stolen.project().admissionRefusals.map((r) => r.refusal)).toEqual(["vessel-tag-invalid"]);
    const wrongFace = await face("faceA", [{ deviceKey: atom, ...(await vesselFaceTagFields(vessel, "faceB", atom)) }]);
    expect(wrongFace.project().devices).toEqual([]);
    const half = await face("faceA", [{ deviceKey: atom, vesselTag: "00".repeat(32) }]);
    expect(half.project().admissionRefusals.map((r) => r.refusal)).toEqual(["vessel-tag-invalid"]);
  });

  test("UNLINKABLE: one vessel's tags in faces A and B differ, repeat for the same face, and neither equals the vessel's public key", async () => {
    const vessel = seed(7), pub = await ed25519VerifyingKeyFromSeed(vessel), atom = (await who(21)).key;
    const a = await vesselFaceTagFields(vessel, "faceA", atom), b = await vesselFaceTagFields(vessel, "faceB", atom);
    expect(a.vesselTag).not.toBe(b.vesselTag);
    expect([a.vesselTag, b.vesselTag]).not.toContain(pub);
    expect((await vesselFaceTagFields(vessel, "faceA", atom)).vesselTag).toBe(a.vesselTag);
    expect(vesselFaceTagHolds("faceA", atom, a)).toBe(true);
    expect(vesselFaceTagHolds("faceB", atom, a)).toBe(false);
    // The B-scoped atom is no device of face A: A's fold seats only A's atoms, so a vessel's B atom never answers A's ask.
    const faceA = await face("faceA", [{ deviceKey: atom, ...a }]);
    expect(faceA.project().devices).not.toContain((await who(22)).key);
  });
});
