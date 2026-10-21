/**
 * persona-act — the face's `@persona` log read as a verified projection. Reds: a plane URL with no signed act
 * never registers; a second founding, an unauthorized signer and a lowered lease epoch move nothing; two signed
 * acts at one sequence surface as a fork. Controls: the honest log projects whole.
 */
import { describe, expect, test } from "vitest";
import { PERSONA_ACT_DOMAIN } from "../src/domains.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { projectPersonaLog, registerablePlanes, type PersonaActBody } from "../src/persona-act.js";
import { actCid, signAct } from "../src/signed-act.js";

const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(seed(n)), sign: ed25519SignerFromSeed(seed(n)) });
const G = "g1";
const act = (seq: number, prior: string | null, act: PersonaActBody["act"], extra: Record<string, unknown> = {}) =>
  ({ kind: PERSONA_ACT_DOMAIN, group: G, seq, prior, act, ...extra }) as PersonaActBody;

async function honest() {
  const root = await who(1);
  const f = await signAct(act(0, null, "founding", { personaKelPrefix: "kel1", rootCommitment: "rc" }), root);
  const p = await signAct(act(1, actCid(f.body), "plane", { plane: "@persona", url: "automerge:p" }), root);
  const a = await signAct(act(2, actCid(p.body), "admission", { deviceKey: "dev1" }), root);
  const l = await signAct(act(3, actCid(a.body), "lease-advance", { epoch: 4 }), root);
  return { root, log: [f, p, a, l] };
}

describe("persona-act", () => {
  test("CONTROL: the honest log projects whole", async () => {
    const { root, log } = await honest();
    const pr = projectPersonaLog(log, { group: G, authorize: (s) => s === root.key });
    expect(pr).toMatchObject({ founded: true, personaKelPrefix: "kel1", rootCommitment: "rc", devices: ["dev1"], leaseEpoch: 4, fork: null });
    expect(pr.planes).toEqual({ "@persona": "automerge:p" });
    expect(pr.head?.seq).toBe(3);
  });

  test("RED: a plane URL with no signed founding or admission act behind it never registers", async () => {
    const { root, log } = await honest();
    const pr = projectPersonaLog(log, { group: G, authorize: (s) => s === root.key });
    expect(registerablePlanes({ "@persona": "automerge:p", "@circles": "automerge:forged" }, pr)).toEqual({ "@persona": "automerge:p" });
    const none = projectPersonaLog([], { group: G, authorize: () => true });
    expect(registerablePlanes({ "@persona": "automerge:p" }, none)).toEqual({});
  });

  test("RED: a second founding, an unauthorized signer and a lowered epoch move nothing", async () => {
    const { root, log } = await honest();
    const mallory = await who(2);
    const refound = await signAct(act(4, actCid(log[3]!.body), "founding", { personaKelPrefix: "evil", rootCommitment: "x" }), root);
    const forged = await signAct(act(4, actCid(log[3]!.body), "plane", { plane: "@persona", url: "automerge:evil" }), mallory);
    const lower = await signAct(act(4, actCid(log[3]!.body), "lease-advance", { epoch: 1 }), root);
    const pr = projectPersonaLog([...log, refound, forged, lower], { group: G, authorize: (s) => s === root.key });
    expect(pr.personaKelPrefix).toBe("kel1");
    expect(pr.planes["@persona"]).toBe("automerge:p");
    expect(pr.leaseEpoch).toBe(4);
  });

  test("RED: two signed acts at one sequence surface as a fork, with the log stopped before them", async () => {
    const { root, log } = await honest();
    const x = await signAct(act(4, actCid(log[3]!.body), "admission", { deviceKey: "devA" }), root);
    const y = await signAct(act(4, actCid(log[3]!.body), "admission", { deviceKey: "devB" }), root);
    const pr = projectPersonaLog([...log, x, y], { group: G, authorize: (s) => s === root.key });
    expect(pr.fork?.seq).toBe(4);
    expect(pr.devices).toEqual(["dev1"]);
  });
});
