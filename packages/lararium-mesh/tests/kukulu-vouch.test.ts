/**
 * vouch — a vouch reads only under the key its reader derived, and its digest moves with every field a kūkulu lei binds.
 */
import { describe, expect, test } from "vitest";
import { ALL_DOMAINS, PULAMA_TESSERA_DOMAIN, SWARM_ACT_DOMAIN, KUKULU_VOUCH_DOMAIN } from "../src/domains.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { signKukuluVouch, verifyKukuluVouch, kukuluVouchDigest, type KukuluVouchParts } from "../src/kukulu-vouch.js";

const PARTS: KukuluVouchParts = { group: "group-a", branch: "feature/x", head: "a".repeat(40), tree: "tree-1", image: "sha256:" + "ab".repeat(32) };
const keyed = async (n: number) => { const seed = new Uint8Array(32).fill(n); return { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) }; };

describe("a vouch", () => {
  test("verifies under its signer's key and names its domain; CONTROL: the two new domains stand registered and apart", async () => {
    const signer = await keyed(1), vouch = await signKukuluVouch(PARTS, signer);
    const read = verifyKukuluVouch(JSON.parse(JSON.stringify(vouch)), signer.key);
    expect(read).toEqual({ ok: true, vouch, digest: kukuluVouchDigest(vouch) });
    expect(vouch.body.kind).toBe(KUKULU_VOUCH_DOMAIN);
    expect(ALL_DOMAINS).toContain(KUKULU_VOUCH_DOMAIN);
    expect(ALL_DOMAINS).toContain(PULAMA_TESSERA_DOMAIN);
    expect(new Set([KUKULU_VOUCH_DOMAIN, PULAMA_TESSERA_DOMAIN, SWARM_ACT_DOMAIN]).size).toBe(3);
  });

  test("RED: another signer, a moved field, another domain, an extra field and a malformed body each refuse by name", async () => {
    const signer = await keyed(1), other = await keyed(2), vouch = await signKukuluVouch(PARTS, signer);
    expect(verifyKukuluVouch(vouch, other.key)).toEqual({ ok: false, refusal: "signer" });
    expect(verifyKukuluVouch(await signKukuluVouch(PARTS, other), signer.key)).toEqual({ ok: false, refusal: "signer" });
    expect(verifyKukuluVouch({ ...vouch, body: { ...vouch.body, image: "sha256:" + "cd".repeat(32) } }, signer.key)).toEqual({ ok: false, refusal: "signature" });
    expect(verifyKukuluVouch({ ...vouch, body: { ...vouch.body, head: "b".repeat(40) } }, signer.key)).toEqual({ ok: false, refusal: "signature" });
    const swarm = { ...vouch.body, kind: SWARM_ACT_DOMAIN };
    expect(verifyKukuluVouch({ body: swarm, signer: signer.key, sig: await signer.sign(new TextEncoder().encode(JSON.stringify(swarm))) }, signer.key)).toEqual({ ok: false, refusal: "domain" });
    for (const raw of [null, "vouch", { ...vouch, extra: 1 }, { ...vouch, body: { ...vouch.body, extra: 1 } }, { ...vouch, body: { ...vouch.body, verdict: "pass" } }, { ...vouch, signer: "zz" }]) {
      expect(verifyKukuluVouch(raw, signer.key), JSON.stringify(raw)).toEqual({ ok: false, refusal: "shape" });
    }
    await expect(signKukuluVouch({ ...PARTS, image: "" }, signer)).rejects.toBeInstanceOf(TypeError);
  });

  test("the digest moves with each field and with the signer, so a lei bound to one vouch names no other", async () => {
    const signer = await keyed(1), base = kukuluVouchDigest(await signKukuluVouch(PARTS, signer));
    const moved: KukuluVouchParts[] = [
      { ...PARTS, group: "group-b" }, { ...PARTS, branch: "main" }, { ...PARTS, tree: "tree-2" }, { ...PARTS, head: "b".repeat(40) },
      { ...PARTS, image: "sha256:" + "cd".repeat(32) },
    ];
    const digests = new Set([base]);
    for (const parts of moved) digests.add(kukuluVouchDigest(await signKukuluVouch(parts, signer)));
    digests.add(kukuluVouchDigest(await signKukuluVouch(PARTS, await keyed(2))));
    expect(digests.size).toBe(moved.length + 2);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
  });
});
