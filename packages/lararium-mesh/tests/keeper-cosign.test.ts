/**
 * keeper-cosign — the keeper vest's co-sign, read offline (keeper-tessera#/vesting). The vessel runs `ward-keeper-vest` through the
 * real gate over (D′, the chain head, the commit's nonce); the proof it hands the commit verifies with no plane at hand, and every
 * proof that does not answer THIS commit from ANOTHER device of the face refuses by name. A spent co-sign never re-spends: a second
 * reach reads the same spend back.
 */
import { describe, expect, test } from "vitest";
import { keeperCosignGate, keeperCosignRefusal, type KeeperCosign } from "../src/keeper-cosign.js";
import { awaitingAsk, cosignedCommit, keeperFace, selfCosigned } from "./keeper-cosign-fixture.js";

const D2 = "sha256:" + "94".repeat(32), NONCE = "ab".repeat(32), TIP = "cd".repeat(32);
const terms = { next: D2, prev: TIP, nonce: NONCE };

describe("RED the keeper vest's co-sign answers one commit, from another device of the face", () => {
  test("a second device's approve spends the gate and the proof verifies offline; CONTROL: an unanswered ask waits and carries nothing", async () => {
    const f = await keeperFace(2);
    const ask = await awaitingAsk(f.port, { ...terms, ordinal: 0 });
    expect(ask).toMatch(/^[0-9a-f]{64}$/);
    await f.answer(f.b, ask, terms);
    const cosign = await keeperCosignGate(f.port, { ...terms, ordinal: 0 });
    expect(cosign.devices).toHaveLength(2);
    expect(cosign.proof).not.toBeNull();
    expect(keeperCosignRefusal(cosign, terms)).toBeNull();
    // A SPENT CO-SIGN NEVER RE-SPENDS: the second reach reads the same spend back, and lands no second outcome.
    const outcomes = () => f.port.view()!.intents.flatMap((s) => s.outcomes).length;
    const before = outcomes();
    expect(await keeperCosignGate(f.port, { ...terms, ordinal: 0 })).toEqual(cosign);
    expect(outcomes()).toBe(before);
  });

  test("a proof for another commit refuses `digest-mismatch`: another nonce, another chain head, another successor closure", async () => {
    const cosign = await cosignedCommit(terms);
    expect(keeperCosignRefusal(cosign, { ...terms, nonce: "ef".repeat(32) })).toBe("digest-mismatch");
    expect(keeperCosignRefusal(cosign, { ...terms, prev: null })).toBe("digest-mismatch");
    expect(keeperCosignRefusal(cosign, { ...terms, next: "sha256:" + "33".repeat(32) })).toBe("digest-mismatch");
    expect(keeperCosignRefusal(cosign, terms)).toBeNull();
  });

  test("an approve from the SAME device refuses `same-device`; CONTROL: the gate itself never counts it", async () => {
    const self = await selfCosigned(terms);
    expect(keeperCosignRefusal(self, terms)).toBe("same-device");
  });

  test("a roster the devices did not sign refuses; a forged ward key refuses; a tampered entry refuses; a one-device face carries no proof", async () => {
    const cosign = await cosignedCommit(terms);
    const issuer = cosign.proof!.ask.signer;
    // THE ROSTER RIDES THE DIGEST: a roster the two devices did not sign (another device, one more, one fewer) names another act.
    expect(keeperCosignRefusal({ ...cosign, devices: [issuer, "77".repeat(32)].sort() }, terms)).toBe("digest-mismatch");
    expect(keeperCosignRefusal({ ...cosign, devices: [...cosign.devices, "77".repeat(32)].sort() }, terms)).toBe("digest-mismatch");
    expect(keeperCosignRefusal({ ...cosign, proof: { ...cosign.proof!, wardKey: "11".repeat(32) } }, terms)).toBe("unwarded");
    const tampered = { ...cosign.proof!, answer: { ...cosign.proof!.answer, body: { ...cosign.proof!.answer.body, frontier: "22".repeat(32) } } };
    expect(keeperCosignRefusal({ ...cosign, proof: tampered }, terms)).toBe("entry-unsigned");
    expect(keeperCosignRefusal({ ...cosign, proof: null }, terms)).toBe("proof-absent");
    const one = await keeperFace(1);
    const alone: KeeperCosign = await keeperCosignGate(one.port, { ...terms, ordinal: 0 });
    expect(alone).toMatchObject({ devices: [one.a.key], proof: null });
    expect(keeperCosignRefusal(alone, terms)).toBeNull();
    expect(keeperCosignRefusal({ ...alone, proof: cosign.proof }, terms)).toBe("proof-unowed");
  });
});
