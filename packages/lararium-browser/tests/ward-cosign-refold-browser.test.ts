/**
 * ward-cosign-refold-browser — the browser's co-sign port folds the worn face's persona plane at each act, never once at boot
 * (row 7, S3b). A tab that boots with one device and then sees a second device's admission land on the same plane counts two at
 * the next lower, so the lower waits on the second device; a fold that no longer proves refuses by name.
 *
 * Reds: a second admission landed after the port stood holds the lower at `ward-awaiting-cosign`; a fold that stops proving
 * refuses `ward-cosign-fold-unread`. Control: the true one-device face lowers on the unlock alone, and the plane takes no entry.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-swarm-slices
 */
import { expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { faceRecordsOf, intentEntryRecordsOfGroup, readFace, wardCosignGate, type LarDoc } from "@lararium/mesh";
import { hex } from "../../lararium-mesh/src/crypto.js";
import { emptyLarDoc } from "../../lararium-mesh/src/base-doc.js";
import { didFromVerifyingKey } from "../../lararium-mesh/src/lar-did.js";
import { mintFaceAnchor, faceRootCommitment, edgeBodyDigest } from "../../lararium-mesh/src/face-anchor.js";
import { signFoundingLog, signPersonaAct, writePersonaAct } from "../../lararium-mesh/src/persona-act-board.js";
import { writePersonaKelEvent, personaKelChainForPrefix } from "../../lararium-mesh/src/persona-kel-board.js";
import { provisionThresholdRecoveryAtFounding } from "../../lararium-mesh/src/recovery-keel-core.js";
import { recoveryContactRegistrationCard } from "../../lararium-mesh/src/recovery-registration.js";
import { actCid } from "../../lararium-mesh/src/signed-act.js";
import { taggedAdmission, testVesselTag } from "../../lararium-mesh/tests/vessel-tag-fixture.js";
import { keyed } from "../../lararium-mesh/tests/ward-cosign-table.js";
import { browserFaceFold, browserWardCosignPort } from "../src/browser-ward-cosign.js";

const G = "g-refold";
const pub = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);

/** A face founded with one device (`deviceKey`), its KEL, its anchor and its plane urls. */
async function founded(deviceKey: string) {
  const rootSeed = new Uint8Array(32).fill(11), rootKey = await pub(rootSeed);
  const gk = await Promise.all([1, 2, 3].map((n) => pub(new Uint8Array(32).fill(n))));
  const prov = provisionThresholdRecoveryAtFounding({
    foundingOpKeyDid: `0x${rootKey}`,
    recoveryContacts: gk.map((k, i) => recoveryContactRegistrationCard((["mine", "contact-a", "contact-b"] as const)[i]!, k, null)),
    recoveryThreshold: 2,
  });
  const kelDoc = emptyLarDoc(); writePersonaKelEvent(kelDoc, prov.inception);
  const chain = personaKelChainForPrefix(kelDoc, prov.inception.prefix)!;
  const root = { key: rootKey, sign: async (b: Uint8Array) => hex(await ed.signAsync(b, rootSeed)) };
  const edge = { personaRootDid: didFromVerifyingKey(rootKey), deviceVerifyingKey: deviceKey, hearthTrueName: "hearth", boundEpoch: 0 };
  const planes = { persona: "automerge:p", identities: "automerge:i", circles: "automerge:c", sessions: "automerge:s", intents: "automerge:t" };
  const log = await signFoundingLog({
    group: G, personaKelPrefix: prov.inception.prefix, rootCommitment: faceRootCommitment(didFromVerifyingKey(rootKey)),
    epoch: 0, planes, deviceKey, edgeDigest: edgeBodyDigest(edge), vesselTag: await testVesselTag(1, G, deviceKey),
  }, root);
  const anchor = mintFaceAnchor({ personaGroup: G, personaKelPrefix: prov.inception.prefix, personaRootDid: didFromVerifyingKey(rootKey), edge, leaseEpoch: 0 });
  return { chain, root, log, planes, anchor };
}

async function standing() {
  const a = await keyed(41), b = await keyed(42);
  const f = await founded(a.key);
  const persona = emptyLarDoc();
  for (const act of f.log) writePersonaAct(persona, act);
  const fold = browserFaceFold({ records: () => faceRecordsOf([persona], G), chain: () => f.chain, group: G, anchor: f.anchor, deviceKey: a.key,
    planes: { persona: f.planes.persona, intents: f.planes.intents } });
  const intents = { tiddlers: {} } as LarDoc;
  const port = browserWardCosignPort({ group: G, atom: a, plane: { doc: () => intents, change: (fn) => fn(intents) }, fold,
    lineage: () => readFace(f.chain, f.anchor)!.lineage,
    fleet: () => ({ root: "fleet-root", readings: new Map(), frontier: { status: "known", asOf: { fleet: { seq: 0, cid: "0".repeat(64) } }, counted: {} }, links: new Map([["0".repeat(64), []]]) }) });
  /** Land a root-signed admission of `key` after the log's head, on the same persona plane the port folds. */
  const admit = async (n: number, key: string) => {
    const head = f.log.at(-1)!;
    const act = await signPersonaAct({ seq: head.body.seq, cid: actCid(head.body) }, { group: G, act: "admission", epoch: 0, fields: { ...(await taggedAdmission(n, G, key)) } }, f.root);
    writePersonaAct(persona, act);
    f.log.push(act);
  };
  return { a, b, f, persona, fold, port, admit, entries: () => intentEntryRecordsOfGroup(intents, G) };
}

const lower = (head: string) => ({ verb: "ward-kapae-lower" as const, wiki: "daemon", head });

test("CONTROL: the true one-device face lowers on the unlock alone, and the plane takes no entry", async () => {
  const s = await standing();
  let ran = 0;
  await wardCosignGate(s.port, lower("a".repeat(64)), async () => { ran += 1; });
  expect(ran).toBe(1);
  expect(s.entries()).toHaveLength(0);
});

test("RED: a tab that stood with one device and sees a second admitted on the same plane holds the next lower at `ward-awaiting-cosign`", async () => {
  const s = await standing();
  let ran = 0;
  await wardCosignGate(s.port, lower("a".repeat(64)), async () => { ran += 1; });
  expect(ran).toBe(1);
  await s.admit(2, s.b.key);
  expect(s.fold()?.devices).toContain(s.b.key.toLowerCase());   // the setup took: the fold reads the second device
  await expect(wardCosignGate(s.port, lower("b".repeat(64)), async () => { ran += 1; })).rejects.toMatchObject({ reading: "ward-awaiting-cosign" });
  expect(ran).toBe(1);
  expect(s.entries()).toHaveLength(2);   // the intent and its ask
});

test("RED: a fold that stops proving (two acts at one sequence) refuses `ward-cosign-fold-unread` and runs nothing", async () => {
  const s = await standing();
  const head = s.f.log.at(-1)!;
  for (const [n, key] of [[3, "c".repeat(64)], [4, "d".repeat(64)]] as const) {
    writePersonaAct(s.persona, await signPersonaAct({ seq: head.body.seq, cid: actCid(head.body) }, { group: G, act: "admission", epoch: 0, fields: { ...(await taggedAdmission(n, G, key)) } }, s.f.root));
  }
  expect(s.fold()).toBeNull();   // the setup took: the fork leaves no proof
  let ran = 0;
  await expect(wardCosignGate(s.port, lower("a".repeat(64)), async () => { ran += 1; })).rejects.toMatchObject({ reading: "ward-cosign-fold-unread" });
  expect(ran).toBe(0);
});
