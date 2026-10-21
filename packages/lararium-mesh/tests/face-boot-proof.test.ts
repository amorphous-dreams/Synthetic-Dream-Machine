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
import { mintFaceAnchor, faceRootCommitment } from "../src/face-anchor.js";
import { proveFaceFromLog } from "../src/face-boot-proof.js";
import { personaActRecordsOfGroup, signFoundingLog, signPersonaAct, writePersonaAct } from "../src/persona-act-board.js";
import { writePersonaKelEvent, personaKelChainForPrefix } from "../src/persona-kel-board.js";
import { provisionThresholdRecoveryAtFounding } from "../src/recovery-keel-core.js";
import { guardianRecoveryRegistrationCard } from "../src/recovery-registration.js";
import { actCid } from "../src/signed-act.js";

const G = "g-mine";
const pub = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);

async function founded(prefixOverride?: string) {
  const rootSeed = new Uint8Array(32).fill(11);
  const rootKey = await pub(rootSeed);
  const gk = await Promise.all([1, 2, 3].map((n) => pub(new Uint8Array(32).fill(n))));
  const prov = provisionThresholdRecoveryAtFounding({
    foundingOpKeyDid: `0x${rootKey}`,
    guardians: gk.map((k, i) => guardianRecoveryRegistrationCard((["mine", "guardian-a", "guardian-b"] as const)[i]!, k, null)),
    recoveryThreshold: 2,
  });
  const kelDoc = emptyLarDoc(); writePersonaKelEvent(kelDoc, prov.inception);
  const chain = personaKelChainForPrefix(kelDoc, prov.inception.prefix)!;
  const root = { key: rootKey, sign: async (b: Uint8Array) => hex(await ed.signAsync(b, rootSeed)) };
  const planes = { persona: "automerge:p", identities: "automerge:i", circles: "automerge:c", sessions: "automerge:s" };
  const log = await signFoundingLog({
    group: G, personaKelPrefix: prefixOverride ?? prov.inception.prefix, rootCommitment: faceRootCommitment(didFromVerifyingKey(rootKey)),
    epoch: 0, planes, deviceKey: "dev1", edgeDigest: "ed",
  }, root);
  const anchor = mintFaceAnchor({ personaGroup: G, personaKelPrefix: prov.inception.prefix, personaRootDid: didFromVerifyingKey(rootKey), edge: {}, leaseEpoch: 0 });
  return { chain, root, log, planes, anchor };
}
const docRecords = (acts: unknown[]) => { const d = emptyLarDoc(); for (const a of acts) writePersonaAct(d, a as never); return personaActRecordsOfGroup(d, G); };

describe("face-boot-proof", () => {
  test("CONTROL: the honest founded face proves", async () => {
    const f = await founded();
    const r = proveFaceFromLog({ records: docRecords(f.log), chain: f.chain, group: G, anchor: f.anchor, deviceKey: "dev1", planes: f.planes });
    expect(r.ok).toBe(true);
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
});
