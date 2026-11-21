/**
 * ward-key-pop: an admission proves its device holds the ward key it names (seat-harness#/the-swarm-slices, S3b).
 *
 * The admission names a per-face ward key (`wardKey`) under the tag key's signature, and beside it carries `wardPop`: that ward
 * key's own signature over (group, device atom, ward key) under `ward-key-pop`. A device that copies another device's public ward
 * key cannot sign that image, so its admission seats nothing (`ward-key-unproven`), and the join request that names it refuses
 * `request-ward-key-unproven`; the honest admission, its pop signed by the key it names, seats.
 */
import { describe, expect, test } from "vitest";
import { PERSONA_ACT_DOMAIN } from "../src/domains.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { fleetJoinRequestImage, readFleetJoinOffer, readFleetJoinRequest, type FleetJoinOffer } from "../src/fleet-join.js";
import { makeHandLineage } from "../src/hand-lineage.js";
import { projectPersonaLog, type PersonaActBody } from "../src/persona-act.js";
import { actCid, signAct } from "../src/signed-act.js";
import { vesselFaceTagFields } from "../src/vessel-face-tag.js";

const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(seed(n)), sign: ed25519SignerFromSeed(seed(n)) });
const act = (group: string, seq: number, prior: string | null, kind: PersonaActBody["act"], extra: Record<string, unknown> = {}) =>
  ({ kind: PERSONA_ACT_DOMAIN, group, seq, prior, act: kind, epoch: 0, ...extra }) as PersonaActBody;
const hexOf = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

async function face(group: string, admissions: ReadonlyArray<Record<string, unknown>>) {
  const root = await who(1), lineage = makeHandLineage([{ epoch: 0, signers: [root.key], threshold: 1 }])!;
  let head = await signAct(act(group, 0, null, "founding", { personaKelPrefix: "k", rootCommitment: "r" }), root);
  const log = [head];
  for (const [i, fields] of admissions.entries()) {
    head = await signAct(act(group, i + 1, actCid(head.body), "admission", fields), root);
    log.push(head);
  }
  return projectPersonaLog(log, { group, lineage, authorize: () => true });
}

describe("an admission proves possession of the ward key it names", () => {
  test("RED: an admission naming another device's ward key (its public half copied, the pop its own key's or the victim's) seats nothing, `ward-key-unproven`; CONTROL: the device's own key, its pop signed by that key, seats", async () => {
    const victim = await who(41), thief = await who(42), atomV = (await who(21)).key, atomT = (await who(22)).key;
    const honest = await vesselFaceTagFields(seed(7), "faceA", atomV, victim.key, victim.sign);
    // The thief names the victim's key and signs the pop with its own ward key, or carries the victim's pop over the victim's atom.
    const ownPop = await vesselFaceTagFields(seed(8), "faceA", atomT, victim.key, thief.sign);
    const copiedPop = { ...(await vesselFaceTagFields(seed(8), "faceA", atomT, victim.key, thief.sign)), wardPop: (honest as { wardPop?: unknown }).wardPop };
    for (const fields of [ownPop, copiedPop]) {
      const read = await face("faceA", [{ deviceKey: atomT, ...fields }]);
      expect(read.devices).toEqual([]);
      expect(read.wardKeys).toEqual({});
      expect(read.admissionRefusals.map((r) => r.refusal)).toEqual(["ward-key-unproven"]);
    }
    // A pop absent refuses the same way: the admission proves nothing it names.
    const { wardPop: _p, ...unproven } = honest as typeof honest & { wardPop?: unknown };
    expect((await face("faceA", [{ deviceKey: atomV, ...unproven }])).admissionRefusals.map((r) => r.refusal)).toEqual(["ward-key-unproven"]);
    const seated = await face("faceA", [{ deviceKey: atomV, ...honest }]);
    expect(seated.devices).toEqual([atomV]);
    expect(seated.wardKeys).toEqual({ [atomV.toLowerCase()]: victim.key });
    expect(seated.admissionRefusals).toEqual([]);
  });

  test("RED: a join request naming another device's ward key refuses `request-ward-key-unproven`; CONTROL: the request whose pop its own ward key signed reads whole", async () => {
    const group = "c0ffee00d15ea5e5", nonce = "ab".repeat(32);
    const root = await who(1), joinee = await who(23), victim = await who(41), thief = await who(42);
    const offer = readFleetJoinOffer({ kind: "fleet-join-offer", personaGroup: group, rootKey: root.key, nonce, scopes: [] }) as FleetJoinOffer;
    if ("refusal" in offer) throw new Error("the offer did not read");
    const requestOf = async (tag: Record<string, unknown>) => {
      const body = { nonce, atomKey: joinee.key, sealKey: hexOf(seed(9)), ...tag, requests: [] };
      return { kind: "fleet-join-request", ...body, signature: await joinee.sign(fleetJoinRequestImage(body as never)) };
    };
    const stolen = await requestOf({ ...(await vesselFaceTagFields(seed(7), group, joinee.key, victim.key, thief.sign)) });
    expect(readFleetJoinRequest(stolen, offer)).toEqual({ refusal: "request-ward-key-unproven" });
    const honest = await requestOf({ ...(await vesselFaceTagFields(seed(7), group, joinee.key, thief.key, thief.sign)) });
    const read = readFleetJoinRequest(honest, offer);
    expect("refusal" in read).toBe(false);
    expect((read as { wardKey: string }).wardKey).toBe(thief.key);
  });
});
