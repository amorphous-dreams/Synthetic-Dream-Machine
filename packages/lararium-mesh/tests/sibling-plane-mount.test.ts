/**
 * sibling-plane-mount — the four limits on a lit sibling's plane mount (operator ruling 2026-11-21), as tests:
 *
 *   L1  intents and persona planes alone: any other slot kind (personal, draft, unknown) refuses at the mount
 *   L2  proven or nothing: no proof, or a pair its own log and KEL refuse, mounts nothing
 *   L3  the lit life bounds it: the documents file under the face only while it stands lit, and a close drops the mount whole
 *   L4  every intent write names its face: a sibling's outcome aimed at the worn face's plane, or the reverse, refuses
 */
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { emptyLarDoc } from "../src/base-doc.js";
import { didFromVerifyingKey } from "../src/lar-did.js";
import { mintFaceAnchor, faceRootCommitment, edgeBodyDigest } from "../src/face-anchor.js";
import { personaActRecordsOfGroup, signFoundingLog, writePersonaAct } from "../src/persona-act-board.js";
import { writePersonaKelEvent, personaKelChainForPrefix } from "../src/persona-kel-board.js";
import { provisionThresholdRecoveryAtFounding } from "../src/recovery-keel-core.js";
import { recoveryContactRegistrationCard } from "../src/recovery-registration.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { IntentPlaneMisfiled, intentEntryRecordsOfGroup, writeIntentEntry } from "../src/intent-entry.js";
import { buildOutcome } from "../src/intent-issue.js";
import { personaBagIdFor, personaSiblingBagIds } from "../src/persona-scope.js";
import { storedLarRecord } from "../src/stored-record.js";
import { readSiblingFacePlanes, recheckSiblingPlanes, siblingPlaneMounts } from "../src/sibling-plane-mount.js";
import { testVesselTag } from "./vessel-tag-fixture.js";

const G = "g-sibling";
const pub = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const PLANES = { persona: "automerge:p", identities: "automerge:i", circles: "automerge:c", sessions: "automerge:s", intents: "automerge:t" };

async function founded() {
  const rootSeed = new Uint8Array(32).fill(21);
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
  const log = await signFoundingLog({
    group: G, personaKelPrefix: prov.inception.prefix, rootCommitment: faceRootCommitment(didFromVerifyingKey(rootKey)),
    epoch: 0, planes: PLANES, deviceKey: "dev1", edgeDigest: edgeBodyDigest(edge), vesselTag: await testVesselTag(1, G, "dev1"),
  }, root);
  const doc = emptyLarDoc(); for (const act of log) writePersonaAct(doc, act as never);
  const anchor = mintFaceAnchor({ personaGroup: G, personaKelPrefix: prov.inception.prefix, personaRootDid: didFromVerifyingKey(rootKey), edge, leaseEpoch: 0 });
  return { chain, anchor, records: personaActRecordsOfGroup(doc, G) };
}

describe("L1: a lit sibling mounts its intents and persona planes alone", () => {
  test("RED: a personal, a draft or an unknown slot kind refuses at the read and at the mount; CONTROL: the bare pair reads", () => {
    for (const stray of ["personal", "draft", "working", "catalog"]) {
      const raw = { persona: PLANES.persona, intents: PLANES.intents, [stray]: "automerge:x" };
      expect(readSiblingFacePlanes(raw)).toMatchObject({ ok: false, refusal: "sibling-mount-slot-refused" });
      const mounts = siblingPlaneMounts();
      expect(mounts.mount(G, { ok: true, planes: raw as never })).toMatchObject({ ok: false, refusal: "sibling-mount-slot-refused" });
      expect(mounts.groups()).toEqual([]);
    }
    expect(readSiblingFacePlanes({ intents: PLANES.intents })).toMatchObject({ ok: false, refusal: "sibling-mount-shape" });
    expect(readSiblingFacePlanes({ persona: PLANES.persona, intents: PLANES.persona })).toMatchObject({ ok: false, refusal: "sibling-mount-shape" });
    expect(readSiblingFacePlanes({ persona: PLANES.persona, intents: PLANES.intents })).toEqual({ ok: true, planes: { persona: PLANES.persona, intents: PLANES.intents } });
  });
});

describe("L2: proven or nothing", () => {
  test("RED: no proof, a refused proof, a pair the face's log never named, and a missing KEL each mount nothing; CONTROL: the pair its own log names proves and mounts", async () => {
    const f = await founded();
    const mounts = siblingPlaneMounts();
    expect(mounts.mount(G, null)).toMatchObject({ ok: false, refusal: "sibling-mount-unproved" });
    expect(mounts.mount(G, { ok: false })).toMatchObject({ ok: false, refusal: "sibling-mount-unproved" });
    expect(mounts.groups()).toEqual([]);
    const base = { records: f.records, chain: f.chain, anchor: f.anchor, group: G };
    expect(recheckSiblingPlanes({ ...base, planes: { persona: PLANES.persona, intents: "automerge:forged" } })).toMatchObject({ ok: false, refusal: "sibling-mount-unproved" });
    expect(recheckSiblingPlanes({ ...base, planes: { persona: "automerge:other", intents: PLANES.intents } })).toMatchObject({ ok: false, refusal: "sibling-mount-unproved" });
    expect(recheckSiblingPlanes({ ...base, chain: null, planes: { persona: PLANES.persona, intents: PLANES.intents } })).toMatchObject({ ok: false, refusal: "sibling-mount-unproved" });
    expect(recheckSiblingPlanes({ ...base, group: "g-other", planes: { persona: PLANES.persona, intents: PLANES.intents } })).toMatchObject({ ok: false, refusal: "sibling-mount-unproved" });
    const proved = recheckSiblingPlanes({ ...base, planes: { persona: PLANES.persona, intents: PLANES.intents } });
    expect(proved.ok).toBe(true);
    expect(mounts.mount(G, proved)).toMatchObject({ ok: true });
    expect(mounts.groups()).toEqual([G]);
  });
});

describe("L3: the lit life bounds the mount", () => {
  test("RED: a face no longer lit files its documents under no face, and its close drops the mount whole; CONTROL: lit, each plane files under the face", () => {
    const mounts = siblingPlaneMounts();
    mounts.mount(G, { ok: true, planes: { persona: PLANES.persona, intents: PLANES.intents } });
    const ids = personaSiblingBagIds(personaBagIdFor(G))!;
    const lit = [{ group: G, face: "subject-of-g" }];
    expect(mounts.bagOf("t", lit)).toEqual({ bagId: ids.intents, face: "subject-of-g" });
    expect(mounts.bagOf("p", lit)).toEqual({ bagId: personaBagIdFor(G), face: "subject-of-g" });
    expect(mounts.bagOf("t", [])).toEqual({ bagId: ids.intents, face: null });
    expect(mounts.bagOf("c", lit), "a plane kind the mount never took names nothing").toBeNull();
    // The close names both documents it unmounts, so the vessel and the island evict them from their caches; a second drop names none.
    expect([...mounts.drop(G)].sort()).toEqual(["p", "t"]);
    expect(mounts.drop(G)).toEqual([]);
    expect(mounts.bagOf("t", lit)).toBeNull();
    expect(mounts.bagOf("p", lit)).toBeNull();
    expect(mounts.groups()).toEqual([]);
  });
});

describe("L4: every intent write names its face", () => {
  test("RED: a sibling's outcome aimed at the worn face's plane refuses, and the reverse; CONTROL: each face's outcome lands on its own plane", async () => {
    const atom = { key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(5)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(5)) };
    const plane = (group: string) => {
      const doc = emptyLarDoc(), bag = personaSiblingBagIds(personaBagIdFor(group))!.intents;
      doc.tiddlers[bag] = storedLarRecord(bag, { text: "automerge:self" }, "lararium-seed");
      return doc;
    };
    const worn = "g-worn", sibling = G, wornPlane = plane(worn), siblingPlane = plane(sibling);
    const siblingOutcome = await buildOutcome({ group: sibling, signer: atom, cause: "votum", result: { status: "done" } });
    const wornOutcome = await buildOutcome({ group: worn, signer: atom, cause: "votum", result: { status: "done" } });
    expect(() => writeIntentEntry(wornPlane, siblingOutcome)).toThrow(IntentPlaneMisfiled);
    expect(() => writeIntentEntry(siblingPlane, wornOutcome)).toThrow(IntentPlaneMisfiled);
    expect(intentEntryRecordsOfGroup(wornPlane, sibling)).toHaveLength(0);
    expect(intentEntryRecordsOfGroup(siblingPlane, worn)).toHaveLength(0);
    writeIntentEntry(siblingPlane, siblingOutcome);
    writeIntentEntry(wornPlane, wornOutcome);
    expect(intentEntryRecordsOfGroup(siblingPlane, sibling)).toHaveLength(1);
    expect(intentEntryRecordsOfGroup(wornPlane, worn)).toHaveLength(1);
  });
});
