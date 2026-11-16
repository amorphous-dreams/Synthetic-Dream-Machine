/**
 * kukulu-gate — the pūlama serves a kūkulu only beside a lei bound to a vouch: an unvouched hello refuses, a lei that names
 * another vouch refuses, the host's image digest decides, and the lei's return lands before the session and only once.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { PULAMA_TESSERA_DOMAIN, canonicalJsonBytes, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, sha256HexBytesSync, signKukuluVouch, verifyEd25519, kukuluVouchDigest, type SignedKukuluVouch, type KukuluVouchParts } from "@lararium/mesh";
import type { CustodyHolder } from "../src/custody-holder.js";
import { KUKULU_COLD_READS, kukuluGate, pulamaSignerOf, vouchSignerOf, type KukuluLeiPort, type KukuluSigner, type SignedPulamaTessera } from "../src/kukulu-gate.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { fixtureRoute, fixtureSlots, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const GROUP = "group-kukulu";
const BRANCH = "feature/kukulu";
const IMAGE = "sha256:" + "ab".repeat(32);
const HOT = ".persona-admissions.json";

/** A lei as this suite's stand-in for the lei family carries it: a body the hand signs, named by its digest. */
interface TestLei { readonly body: { readonly rite: string; readonly group: string; readonly branch: string; readonly head: string }; readonly signer: string; readonly sig: string }
const leiCid = (lei: TestLei): string => sha256HexBytesSync(canonicalJsonBytes({ body: lei.body, signer: lei.signer }));

/** The lei family's stand-in: it verifies the hand's signature and the rite, and claims a return once. */
function leiFamily(): KukuluLeiPort & { readonly returned: Map<string, string>; readonly order: string[] } {
  const returned = new Map<string, string>(), order: string[] = [];
  return {
    returned, order,
    async readLei(offered, group, hand) {
      const lei = offered as TestLei | undefined;
      if (!lei || typeof lei !== "object" || !lei.body) return { ok: false, refusal: "absent" };
      if (lei.body.rite !== "kukulu") return { ok: false, refusal: "rite" };
      if (lei.body.group !== group) return { ok: false, refusal: "group" };
      if (!verifyEd25519(lei.sig, canonicalJsonBytes(lei.body), lei.signer)) return { ok: false, refusal: "signature" };
      if (!hand(lei.signer)) return { ok: false, refusal: "role" };
      const cid = leiCid(lei);
      if (returned.has(cid)) return { ok: false, refusal: "returned" };
      return { ok: true, cid, branch: lei.body.branch, head: lei.body.head };
    },
    async returnLei(cid, by) {
      if (returned.has(cid)) return false;
      returned.set(cid, by.key);
      order.push(`return:${cid}`);
      return true;
    },
  };
}

let fx: PulamaFixture | null = null;
afterEach(async () => { await fx?.drop(); fx = null; });

async function stand(opts: { image?: string | null } = {}) {
  const family = leiFamily();
  const halves = new Map<string, string>();
  let raised: string | null = opts.image === undefined ? IMAGE : opts.image;
  fx = await standPulama("kukulu-gate", (kept: CustodyHolder) => kukuluGate({
    holder: kept, lei: family, image: () => raised,
    tessera: { land: async (lei, text) => { if (halves.has(lei)) return false; halves.set(lei, text); family.order.push(`tessera:${lei}`); return true; } },
  }));
  const face = await fx.kept.foundFace({ group: personaGroupDigest(GROUP), ordinal: 0, slots: fixtureSlots });
  // THE HAND strings a lei under the face's ward key, opened fresh from the human route for that one act.
  const string = async (parts: Partial<TestLei["body"]> & { head: string }): Promise<TestLei> => {
    const body = { rite: "kukulu", group: GROUP, branch: BRANCH, ...parts };
    const signer = (await fx!.kept.wardPublicKey({ ordinal: 0 }))!;
    const sig = await fx!.kept.withWardKey({ ordinal: 0 }, fixtureRoute, (seat) => seat.wardSign(canonicalJsonBytes(body)));
    return { body, signer, sig };
  };
  // THE STANDING VESSEL vouches under the custody root's vouch child, which the in-process holder derives as the pūlama does.
  const vouch = async (parts: Partial<KukuluVouchParts> = {}): Promise<SignedKukuluVouch> =>
    signKukuluVouch({ group: GROUP, branch: BRANCH, tree: "tree-1", image: IMAGE, verdict: "pass", receipt: null, ...parts }, await vouchSignerOf(fx!.local));
  const hello = async (offer: unknown): Promise<string> => {
    const vessel = fx!.vessel(offer);
    try { return (await vessel.unlock([])).reading; }
    catch (err) { return (err as { reading?: string }).reading ?? String(err); }
  };
  return { fx, face, family, halves, string, vouch, hello, raise: (digest: string | null) => { raised = digest; } };
}

describe("RED pulama-refuses-unvouched", () => {
  test("a hello with no vouch, a forged vouch, or a vouch another key signed opens no session and claims no return", async () => {
    const s = await stand();
    const v = await s.vouch();
    const lei = await s.string({ head: kukuluVouchDigest(v) });
    expect(await s.hello({})).toBe("kukulu-unvouched");
    expect(await s.hello({ lei })).toBe("kukulu-unvouched");
    expect(await s.hello({ lei, vouch: { ...v, body: { ...v.body, image: "sha256:" + "cd".repeat(32) } } })).toBe("kukulu-vouch-signature");
    // A key the custody root never yielded signs a well-formed vouch: the pūlama derives the vouch key itself and refuses it.
    const stranger = new Uint8Array(32).fill(7);
    const forged = await signKukuluVouch(v.body, { key: await ed25519VerifyingKeyFromSeed(stranger), sign: ed25519SignerFromSeed(stranger) });
    expect(await s.hello({ lei: await s.string({ head: kukuluVouchDigest(forged) }), vouch: forged })).toBe("kukulu-vouch-signer");
    expect(await s.hello({ lei, vouch: "not-a-vouch" })).toBe("kukulu-vouch-shape");
    // A vouched hello with no lei, or a lei a stranger strung, refuses too.
    expect(await s.hello({ vouch: v })).toBe("kukulu-lei-absent");
    const strangerLei = { body: lei.body, signer: await ed25519VerifyingKeyFromSeed(stranger), sig: await ed25519SignerFromSeed(stranger)(canonicalJsonBytes(lei.body)) };
    expect(await s.hello({ lei: strangerLei, vouch: v })).toBe("kukulu-lei-role");
    expect(s.family.returned.size).toBe(0);
    expect(s.halves.size).toBe(0);
    expect(s.fx.server.sessions()).toBe(0);
  });

  test("a red walk, a locked face and an unlit pūlama refuse before any return", async () => {
    const s = await stand();
    const red = await s.vouch({ verdict: "fail" });
    expect(await s.hello({ lei: await s.string({ head: kukuluVouchDigest(red) }), vouch: red })).toBe("kukulu-walk-red");
    const v = await s.vouch();
    const lei = await s.string({ head: kukuluVouchDigest(v) });
    await s.fx.kept.lockFace(s.face.fcid);
    expect(await s.hello({ lei, vouch: v })).toBe("kukulu-face-locked");
    await s.fx.server.lock();
    expect(await s.hello({ lei, vouch: v })).toBe("pulama-locked");
    expect(s.family.returned.size).toBe(0);
  });
});

describe("RED kukulu-lei-binds-vouch", () => {
  test("a lei that names another vouch, another branch or another image than the host raises refuses; CONTROL: the bound lei serves once", async () => {
    const s = await stand();
    const v = await s.vouch();
    const other = await s.vouch({ tree: "tree-2" });
    // The hand strung the lei for ANOTHER vouch: the pair offered together does not bind.
    expect(await s.hello({ lei: await s.string({ head: kukuluVouchDigest(other) }), vouch: v })).toBe("kukulu-lei-unbound");
    expect(await s.hello({ lei: await s.string({ head: kukuluVouchDigest(v), branch: "main" }), vouch: v })).toBe("kukulu-lei-unbound");
    const lei = await s.string({ head: kukuluVouchDigest(v) });
    // THE HOST REPORTS THE IMAGE: none reported, or another than the vouch walked, refuses.
    s.raise(null);
    expect(await s.hello({ lei, vouch: v })).toBe("kukulu-image-unreported");
    s.raise("sha256:" + "ee".repeat(32));
    expect(await s.hello({ lei, vouch: v })).toBe("kukulu-image-mismatch");
    expect(s.family.returned.size).toBe(0);

    // CONTROL: the lei bound to the vouch, at the image the host raises, opens a session scoped to the lei's face.
    s.raise(IMAGE);
    const vessel = s.fx.vessel({ lei, vouch: v });
    expect((await vessel.unlock([])).reading).toBe("opens");
    expect(vessel.wears()).toBe(0);
    await vessel.writeRow("identity", HOT, Uint8Array.from([1]));
    expect(await vessel.readRow("identity", HOT)).toEqual({ reading: "opens", plaintext: Uint8Array.from([1]) });
    expect(KUKULU_COLD_READS).toEqual(["face-proof-key", "intent-relay-key"]);
    // The scope the gate answered refuses every other cold row, and every cold write.
    await expect(vessel.openColdRow("identity", "seat-key-h0-" + "0".repeat(32) + ".bin", () => undefined)).rejects.toMatchObject({ reading: "needs-the-human" });
    await expect(vessel.updateColdRow("identity", "intent-relay-key.bin", () => ({ plaintext: new Uint8Array(32), value: null }))).rejects.toMatchObject({ reading: "needs-the-human" });

    // THE RETURN CLAIMED BEFORE THE PŪLAMA SERVED, and its tessera half names the lei, the vouch and the image under the pūlama's key.
    const cid = leiCid(lei);
    expect(s.family.order).toEqual([`return:${cid}`, `tessera:${cid}`]);
    const pulamaKey = (await pulamaSignerOf(s.fx.kept)).key;
    expect(s.family.returned.get(cid)).toBe(pulamaKey);
    const half = JSON.parse(s.halves.get(cid)!) as SignedPulamaTessera;
    expect(half.body).toEqual({ kind: PULAMA_TESSERA_DOMAIN, act: "rite-begun", rite: "kukulu", group: GROUP, branch: BRANCH, lei: cid, vouch: kukuluVouchDigest(v), image: IMAGE });
    expect(half.signer).toBe(pulamaKey);
    expect(verifyEd25519(half.sig, canonicalJsonBytes(half.body), half.signer)).toBe(true);
    // The vouch key and the pūlama's key stay apart, so a vessel that vouches never signs as the pūlama.
    expect((await vouchSignerOf(s.fx.kept)).key).not.toBe(pulamaKey);

    // A second kūkulu wearing the same lei finds its return claimed.
    expect(await s.hello({ lei, vouch: v })).toBe("kukulu-lei-returned");
    expect(s.fx.server.sessions()).toBe(1);
  });

  test("a tessera half that does not land burns the return and serves nothing", async () => {
    const family = leiFamily();
    fx = await standPulama("kukulu-tessera", (kept) => kukuluGate({ holder: kept, lei: family, image: () => IMAGE, tessera: { land: async () => { throw new Error("the state volume refused the write"); } } }));
    await fx.kept.foundFace({ group: personaGroupDigest(GROUP), ordinal: 0, slots: fixtureSlots });
    const v = await signKukuluVouch({ group: GROUP, branch: BRANCH, tree: "t", image: IMAGE, verdict: "pass", receipt: null }, await vouchSignerOf(fx.local));
    const body = { rite: "kukulu", group: GROUP, branch: BRANCH, head: kukuluVouchDigest(v) };
    const lei: TestLei = { body, signer: (await fx.kept.wardPublicKey({ ordinal: 0 }))!, sig: await fx.kept.withWardKey({ ordinal: 0 }, fixtureRoute, (seat) => seat.wardSign(canonicalJsonBytes(body))) };
    const signer: KukuluSigner = await pulamaSignerOf(fx.kept);
    await expect(fx.vessel({ lei, vouch: v }).unlock([])).rejects.toMatchObject({ reading: "kukulu-tessera-unwritten" });
    expect(family.returned.get(leiCid(lei))).toBe(signer.key);
    expect(fx.server.sessions()).toBe(0);
  });
});
