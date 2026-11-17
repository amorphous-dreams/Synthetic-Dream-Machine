/**
 * pulama-lent-admission — an admission row names the set of faces an image serves: the set rests sorted by ordinal, a later
 * admission writes over it, an empty set refuses, and a signed row whose faces read no lent set refuses by the set's own
 * reading (`lent-faces-empty`, `lent-faces-malformed`), never read as no admission.
 */
import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, canonicalJsonBytes, PULAMA_TESSERA_DOMAIN, type SwarmWikiPort } from "@lararium/mesh";
import { pulamaAdmissions, pulamaAdmittedTitle } from "../src/pulama-admit.js";

describe("RED pulama-admission-names-a-set", () => {
  test("sorts a set and replaces it on readmission; an empty set refuses, and a row whose faces read no set refuses by its reading", async () => {
    const rows = new Map<string, string>();
    const records = { read: async (k: string) => rows.get(k) ?? null, write: async (k: string, v: string) => { rows.set(k, v); }, writeNew: async (k: string, v: string) => { if (rows.has(k)) return false; rows.set(k, v); return true; }, list: async (p: string) => [...rows.keys()].filter(k => k.startsWith(p)) } as SwarmWikiPort;
    const seed = new Uint8Array(32).fill(9);
    const by = { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
    const admissions = pulamaAdmissions(records);
    const facesOf = async () => { const a = await admissions.admitted("image", by); return a !== null && "faces" in a ? a.faces : a; };
    const faces = [{ fcid: "two", ordinal: 2 }, { fcid: "zero", ordinal: 0 }];
    await admissions.admitByHand("image", faces, by);
    expect(await facesOf()).toEqual([faces[1], faces[0]]);
    await admissions.admitByRite("image", [faces[0]!], "tessera", by);
    expect(await facesOf()).toEqual([faces[0]]);
    await expect(admissions.admitByHand("image", [], by)).rejects.toThrow("lent-faces-empty");
    const rest = async (fields: Record<string, unknown>): Promise<void> => {
      const body = { kind: PULAMA_TESSERA_DOMAIN, act: "image-admitted", image: "image", by: "hand", tessera: "t", ...fields };
      rows.set(pulamaAdmittedTitle("image"), JSON.stringify({ body, signer: by.key, sig: await by.sign(canonicalJsonBytes(body)) }));
    };
    await rest({ fcid: "zero", ordinal: 0 });
    expect(await admissions.admitted("image", by)).toMatchObject({ refusal: "lent-faces-empty" });
    await rest({ faces: "h0" });
    expect(await admissions.admitted("image", by)).toMatchObject({ refusal: "lent-faces-malformed" });
    await rest({ faces: [{ ordinal: 0 }] });
    expect(await admissions.admitted("image", by)).toMatchObject({ refusal: "lent-faces-malformed" });
    // The listing names the admissions that stand; a refusing row lists as none.
    expect(await admissions.list(by)).toEqual([]);
    // CONTROL: a row no key of this pūlama signed reads as no admission.
    rows.set(pulamaAdmittedTitle("image"), JSON.stringify({ body: { kind: PULAMA_TESSERA_DOMAIN, act: "image-admitted", image: "image", faces: [] }, signer: by.key, sig: "00" }));
    expect(await admissions.admitted("image", by)).toBeNull();
  });
});
