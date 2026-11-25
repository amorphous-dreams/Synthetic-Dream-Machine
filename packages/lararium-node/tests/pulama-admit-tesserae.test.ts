/**
 * pulama-admit-tesserae — an admission names every lent face's tessera: a rite admits on each face's own rite tessera (its
 * guest and host halves), and the admission's own tessera names that set; a hand admits every face under its one tessera. A
 * signed row whose tesserae miss a face, add one, or name another set refuses `admission-tesserae-mismatch` by name.
 */
import { describe, expect, test } from "vitest";
import { canonicalJsonBytes, sha256HexBytesSync } from "@lararium/mesh/crypto";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "@lararium/mesh/ed25519-door";
import { type SwarmWikiPort } from "@lararium/mesh/swarm-tiddlers";
import { pulamaAdmissions, pulamaAdmittedTitle, type SignedPulamaAdmit } from "../src/pulama-admit.js";

const T0 = "0a".repeat(32), T2 = "2b".repeat(32);

async function stand() {
  const rows = new Map<string, string>();
  const records: SwarmWikiPort = {
    read: async (k) => rows.get(k) ?? null, write: async (k, v) => { rows.set(k, v); },
    writeNew: async (k, v) => { if (rows.has(k)) return false; rows.set(k, v); return true; }, list: async (p) => [...rows.keys()].filter((k) => k.startsWith(p)),
  };
  const seed = new Uint8Array(32).fill(11);
  const by = { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
  /** Re-sign the image's row with `body` changed, under the pūlama's own key, so only the shape decides. */
  const resign = async (image: string, change: (body: Record<string, unknown>) => Record<string, unknown>): Promise<void> => {
    const row = JSON.parse(rows.get(pulamaAdmittedTitle(image))!) as SignedPulamaAdmit;
    const body = change({ ...row.body });
    rows.set(pulamaAdmittedTitle(image), JSON.stringify({ body, signer: by.key.toLowerCase(), sig: await by.sign(canonicalJsonBytes(body)) }));
  };
  return { admissions: pulamaAdmissions(records), by, resign };
}

describe("RED pulama-admission-names-every-tessera", () => {
  test("a rite admits on each lent face's own tessera, sorted by ordinal; the admission's tessera names that set", async () => {
    const s = await stand();
    await s.admissions.admitByRite("image", [{ fcid: "two", ordinal: 2, tessera: T2 }, { fcid: "zero", ordinal: 0, tessera: T0 }], s.by);
    const admitted = await s.admissions.admitted("image", s.by);
    expect(admitted).toMatchObject({ by: "rite", faces: [{ fcid: "zero", ordinal: 0 }, { fcid: "two", ordinal: 2 }], tesserae: [{ ordinal: 0, tessera: T0 }, { ordinal: 2, tessera: T2 }] });
    expect(admitted !== null && "tessera" in admitted ? admitted.tessera : null).toBe(sha256HexBytesSync(canonicalJsonBytes([{ ordinal: 0, tessera: T0 }, { ordinal: 2, tessera: T2 }])));
    expect((await s.admissions.list(s.by))[0]).toMatchObject({ tesserae: [{ ordinal: 0, tessera: T0 }, { ordinal: 2, tessera: T2 }] });
  });

  test("a hand admits every face under its one tessera", async () => {
    const s = await stand();
    const { tessera } = await s.admissions.admitByHand("image", [{ fcid: "zero", ordinal: 0 }, { fcid: "two", ordinal: 2 }], s.by);
    expect(await s.admissions.admitted("image", s.by)).toMatchObject({ by: "hand", tessera, tesserae: [{ ordinal: 0, tessera }, { ordinal: 2, tessera }] });
  });

  test("CONTROL: a signed rite row whose tesserae miss a face, add one, repeat one, name another set or name none refuses `admission-tesserae-mismatch`; a rite naming no tessera refuses", async () => {
    const s = await stand();
    const rites = [{ fcid: "zero", ordinal: 0, tessera: T0 }, { fcid: "two", ordinal: 2, tessera: T2 }];
    for (const change of [
      (b: Record<string, unknown>) => ({ ...b, tesserae: [{ ordinal: 0, tessera: T0 }] }),
      (b: Record<string, unknown>) => ({ ...b, tesserae: [{ ordinal: 0, tessera: T0 }, { ordinal: 1, tessera: T2 }, { ordinal: 2, tessera: T2 }] }),
      (b: Record<string, unknown>) => ({ ...b, tesserae: [{ ordinal: 0, tessera: T0 }, { ordinal: 0, tessera: T2 }] }),
      (b: Record<string, unknown>) => ({ ...b, tessera: T0 }),
      (b: Record<string, unknown>) => { const { tesserae: _drop, ...rest } = b; return rest; },
    ]) {
      await s.admissions.admitByRite("image", rites, s.by);
      expect(await s.admissions.admitted("image", s.by)).toMatchObject({ by: "rite" });
      await s.resign("image", change);
      expect(await s.admissions.admitted("image", s.by)).toMatchObject({ refusal: "admission-tesserae-mismatch" });
      expect(await s.admissions.list(s.by)).toEqual([]);
    }
    await expect(s.admissions.admitByRite("image", [{ fcid: "zero", ordinal: 0, tessera: "" }], s.by)).rejects.toThrow("admission-tessera-malformed");
  });
});
