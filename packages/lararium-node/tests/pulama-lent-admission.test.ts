/**
 * pulama-lent-admission — an admission row names the set of faces an image serves: the set rests sorted by ordinal, a later
 * admission writes over it, an empty set refuses, and a row in the one-face shape reads as no admission.
 */
import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, canonicalJsonBytes, PULAMA_TESSERA_DOMAIN, type SwarmWikiPort } from "@lararium/mesh";
import { pulamaAdmissions, pulamaAdmittedTitle } from "../src/pulama-admit.js";

describe("RED pulama-admission-names-a-set", () => {
  test("sorts a set and replaces it on readmission; rejects empty and legacy rows", async () => {
    const rows = new Map<string, string>();
    const records = { read: async (k: string) => rows.get(k) ?? null, write: async (k: string, v: string) => { rows.set(k, v); }, writeNew: async (k: string, v: string) => { if (rows.has(k)) return false; rows.set(k, v); return true; }, list: async (p: string) => [...rows.keys()].filter(k => k.startsWith(p)) } as SwarmWikiPort;
    const seed = new Uint8Array(32).fill(9);
    const by = { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
    const admissions = pulamaAdmissions(records);
    const faces = [{ fcid: "two", ordinal: 2 }, { fcid: "zero", ordinal: 0 }];
    await admissions.admitByHand("image", faces, by);
    expect((await admissions.admitted("image", by))?.faces).toEqual([faces[1], faces[0]]);
    await admissions.admitByRite("image", [faces[0]!], "tessera", by);
    expect((await admissions.admitted("image", by))?.faces).toEqual([faces[0]]);
    await expect(admissions.admitByHand("image", [], by)).rejects.toThrow("lent-faces-empty");
    const body = { kind: PULAMA_TESSERA_DOMAIN, act: "image-admitted", image: "image", fcid: "zero", ordinal: 0, by: "hand", tessera: "old" };
    rows.set(pulamaAdmittedTitle("image"), JSON.stringify({ body, signer: by.key, sig: await by.sign(canonicalJsonBytes(body)) }));
    expect(await admissions.admitted("image", by)).toBeNull();
  });
});
