import { afterAll, describe, expect, test, vi } from "vitest";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyPlaceKel, mintPlaceInception, type RandomProvider } from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { foundDirect, foundHearthDirect } from "./found-route.js";
import { loadPlaceKelChain, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { larIdentityDir } from "../src/vessel-paths.js";

vi.setConfig({ testTimeout: 240_000 });
const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
function root() {
  const r = mkdtempSync(join(tmpdir(), "lar-place-founding-"));
  cpSync(join(import.meta.dirname, "../../../genesis"), join(r, "genesis"), { recursive: true, filter: (s) => !s.endsWith("social-bootstrap.json") });
  roots.push(r);
  return r;
}
function entropy(): RandomProvider {
  let n = 1;
  return { getRandomValues<T extends Uint8Array<ArrayBuffer>>(a: T): T { for (let i = 0; i < a.length; i++) a[i] = n++ & 255; return a; }, randomUUID: () => "deterministic" };
}
const opts = (r: string) => ({ storageDir: join(r, "data", "lares", "vessel"), genesisDir: join(r, "genesis") });

describe("place founding", () => {
  test("the real door arms a chain and leaves the cold seed on the card alone", async () => {
    const r = root(); let cold = "";
    await withLarRoot(r, async () => {
      await foundDirect({ ...opts(r), entropy: entropy(), placeFoundingCard: { readBack: async (card) => { cold = Buffer.from(card.seed).toString("hex"); } } });
      const chain = await loadPlaceKelChain();
      const reading = verifyPlaceKel(chain);
      expect(reading.ok).toBe(true);
      if (!reading.ok) return;
      expect(reading.seq).toBe(0);
      expect(reading.nextDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(reading.signerKey).toBe(await loadVesselVerifyingKey());
      const dir = larIdentityDir();
      const scan = () => readdirSync(dir).some((name) => readFileSync(join(dir, name)).includes(cold));
      expect(scan()).toBe(false);
      writeFileSync(join(dir, "known-positive"), cold);
      expect(scan()).toBe(true);
    });
  });

  test("a refused card writes no key or KEL; a confirming card lands both", async () => {
    const r = root();
    await withLarRoot(r, async () => {
      await expect(foundDirect({ ...opts(r), placeFoundingCard: { readBack: async () => { throw new Error("card refused"); } } })).rejects.toThrow();
      expect(readdirSync(larIdentityDir()).filter((n) => n.startsWith(".vessel-key") || n.startsWith(".vessel-kel"))).toEqual([]);
      await foundDirect({ ...opts(r), placeFoundingCard: { readBack: async () => {} } });
      expect((await loadPlaceKelChain()).length).toBe(1);
    });
  });

  test("the hearth reads the place card and the chair card", async () => {
    const r = root(); const cards: string[] = [];
    await withLarRoot(r, () => foundHearthDirect({ ...opts(r), readBack: async (rows) => { cards.push(...rows.map((c) => c.chair)); } }));
    expect(cards).toContain("place");
    expect(cards.length).toBe(2);
  });

  test("a one-key, unarmed, or other-key KEL refuses by name", async () => {
    const r = root();
    await withLarRoot(r, async () => {
      let coldKey = "";
      await foundDirect({ ...opts(r), placeFoundingCard: { readBack: async (card) => { coldKey = card.verifyingKey; } } });
      const dir = larIdentityDir(); const kel = readdirSync(dir).find((n) => n.startsWith(".vessel-kel"))!;
      const path = join(dir, kel); const good = readFileSync(path);
      for (const [bad, named] of [
        [[{ ...JSON.parse(good.toString())[0], next: undefined }], "unarmed"],
        [[mintPlaceInception({ signerSeed: new Uint8Array(32).fill(9), coldVerifyingKey: coldKey }).event], "names-another-key"],
      ] as const) {
        writeFileSync(path, JSON.stringify(bad));
        await expect(loadVesselVerifyingKey()).rejects.toMatchObject({ name: "VesselInceptionRefused", reading: named });
      }
      writeFileSync(path, good);
    });
  });
});
