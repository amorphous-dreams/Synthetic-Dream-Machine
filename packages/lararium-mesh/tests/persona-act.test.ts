/**
 * persona-act — the face's `@persona` log read as a verified projection. Reds: a plane URL with no signed act
 * never registers; a second founding, an unauthorized signer and a lowered lease epoch move nothing; two signed
 * acts at one sequence surface as a fork. Controls: the honest log projects whole.
 */
import { describe, expect, test } from "vitest";
import { PERSONA_ACT_DOMAIN } from "../src/domains.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { makeHandLineage } from "../src/hand-lineage.js";
import { projectPersonaLog, registerablePlanes, type PersonaActBody } from "../src/persona-act.js";
import { actCid, signAct } from "../src/signed-act.js";

const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(seed(n)), sign: ed25519SignerFromSeed(seed(n)) });
const G = "g1";
const act = (seq: number, prior: string | null, act: PersonaActBody["act"], extra: Record<string, unknown> = {}) =>
  ({ kind: PERSONA_ACT_DOMAIN, group: G, seq, prior, act, epoch: 0, ...extra }) as PersonaActBody;
const lineageOf = (...keys: string[][]) => makeHandLineage(keys.map((signers, epoch) => ({ epoch, signers, threshold: 1 })))!;

async function honest() {
  const root = await who(1);
  const f = await signAct(act(0, null, "founding", { personaKelPrefix: "kel1", rootCommitment: "rc" }), root);
  const p = await signAct(act(1, actCid(f.body), "plane", { plane: "@persona", url: "automerge:p" }), root);
  const a = await signAct(act(2, actCid(p.body), "admission", { deviceKey: "dev1" }), root);
  const l = await signAct(act(3, actCid(a.body), "lease-advance", { leaseEpoch: 4 }), root);
  return { root, log: [f, p, a, l] };
}

describe("persona-act", () => {
  test("CONTROL: the honest log projects whole", async () => {
    const { root, log } = await honest();
    const pr = projectPersonaLog(log, { group: G, lineage: lineageOf([root.key]), authorize: () => true });
    expect(pr).toMatchObject({ founded: true, personaKelPrefix: "kel1", rootCommitment: "rc", devices: ["dev1"], leaseEpoch: 4, fork: null });
    expect(pr.planes).toEqual({ "@persona": "automerge:p" });
    expect(pr.head?.seq).toBe(3);
  });

  test("RED: a plane URL with no signed founding or admission act behind it never registers", async () => {
    const { root, log } = await honest();
    const pr = projectPersonaLog(log, { group: G, lineage: lineageOf([root.key]), authorize: () => true });
    expect(registerablePlanes({ "@persona": "automerge:p", "@circles": "automerge:forged" }, pr)).toEqual({ "@persona": "automerge:p" });
    const none = projectPersonaLog([], { group: G, lineage: lineageOf([root.key]), authorize: () => true });
    expect(registerablePlanes({ "@persona": "automerge:p" }, none)).toEqual({});
  });

  test("RED: a second founding, an unauthorized signer and a lowered epoch move nothing", async () => {
    const { root, log } = await honest();
    const mallory = await who(2);
    const refound = await signAct(act(4, actCid(log[3]!.body), "founding", { personaKelPrefix: "evil", rootCommitment: "x" }), root);
    const forged = await signAct(act(4, actCid(log[3]!.body), "plane", { plane: "@persona", url: "automerge:evil" }), mallory);
    const lower = await signAct(act(4, actCid(log[3]!.body), "lease-advance", { leaseEpoch: 1 }), root);
    const pr = projectPersonaLog([...log, refound, forged, lower], { group: G, lineage: lineageOf([root.key]), authorize: () => true });
    expect(pr.personaKelPrefix).toBe("kel1");
    expect(pr.planes["@persona"]).toBe("automerge:p");
    expect(pr.leaseEpoch).toBe(4);
  });

  test("RED: two signed acts at one sequence surface as a fork, with the log stopped before them", async () => {
    const { root, log } = await honest();
    const x = await signAct(act(4, actCid(log[3]!.body), "admission", { deviceKey: "devA" }), root);
    const y = await signAct(act(4, actCid(log[3]!.body), "admission", { deviceKey: "devB" }), root);
    const pr = projectPersonaLog([...log, x, y], { group: G, lineage: lineageOf([root.key]), authorize: () => true });
    expect(pr.fork?.seq).toBe(4);
    expect(pr.devices).toEqual(["dev1"]);
  });

  test("RED: a root rotation: old acts under the old key, new acts under the new key, project whole", async () => {
    const oldRoot = await who(1), newRoot = await who(2);
    const lineage = lineageOf([oldRoot.key], [newRoot.key]);
    const f = await signAct(act(0, null, "founding", { personaKelPrefix: "kel1", rootCommitment: "rc" }), oldRoot);
    const a = await signAct(act(1, actCid(f.body), "admission", { deviceKey: "dev1" }), oldRoot);
    const b = await signAct(act(2, actCid(a.body), "admission", { deviceKey: "dev2", epoch: 1 }), newRoot);
    const pr = projectPersonaLog([f, a, b], { group: G, lineage, authorize: () => true });
    expect(pr.devices).toEqual(["dev1", "dev2"]);
  });

  test("CONTROL: a key outside its own epoch's roster, and a retired key after its epoch, still refuse", async () => {
    const oldRoot = await who(1), newRoot = await who(2);
    const lineage = lineageOf([oldRoot.key], [newRoot.key]);
    const f = await signAct(act(0, null, "founding", { personaKelPrefix: "kel1", rootCommitment: "rc" }), oldRoot);
    const wrongEpoch = await signAct(act(1, actCid(f.body), "admission", { deviceKey: "devX", epoch: 1 }), oldRoot);   // old key claims the new epoch
    const good = await signAct(act(1, actCid(f.body), "admission", { deviceKey: "dev1", epoch: 1 }), newRoot);
    const retired = await signAct(act(2, actCid(good.body), "admission", { deviceKey: "devY", epoch: 0 }), oldRoot);    // old key after the roll
    const pr = projectPersonaLog([f, wrongEpoch, good, retired], { group: G, lineage, authorize: () => true });
    expect(pr.devices).toEqual(["dev1"]);
  });
});
