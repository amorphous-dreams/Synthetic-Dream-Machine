/**
 * ward-signer-zeroes — THE ROOT SEED ZEROES AFTER ITS ONE SIGNATURE (#576 cold read: seed zeroing rode no test). The face root opens
 * fresh under the act's ward for one signature, and the seed bytes fill with zero whether it signed or refused a mismatch; a
 * second signature refuses by name. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-ward
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { ed25519VerifyingKeyFromSeed } from "@lararium/mesh/ed25519-door";

const seeds: Uint8Array[] = [];
let rosterSeed = 3;
vi.mock("../src/node-vessel-identity.js", () => ({
  loadPersonaGroupRootVerifyingKey: async () => ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(rosterSeed)),
  loadPersonaGroupRootSeed: async () => { const s = new Uint8Array(32).fill(seeds.length === 0 ? 3 : 5); seeds.push(s); return s; },
}));
vi.mock("../src/ward-credential.js", () => ({ wardOrGather: async (w: unknown) => w, wardCredentialsOf: () => undefined }));

const { wardRootSigner } = await import("../src/ward-signer.js");

afterEach(() => { seeds.length = 0; rosterSeed = 3; });

describe("the ward root signer zeroes its seed", () => {
  test("RED: the opened seed reads all zero after the one signature, and a second signature refuses ward-signer-spent", async () => {
    const signer = await wardRootSigner(0, { token: "t" } as never);
    expect(await signer.sign(new Uint8Array([1, 2, 3]))).toMatch(/^[0-9a-f]{128}$/);
    expect(seeds).toHaveLength(1);
    expect([...seeds[0]!].every((b) => b === 0)).toBe(true);
    await expect(signer.sign(new Uint8Array([4]))).rejects.toThrow(/^ward-signer-spent:/);
  });
  test("CONTROL: a seed that derives another key than the roster's refuses ward-root-mismatch, and still zeroes", async () => {
    seeds.push(new Uint8Array(32)); // the next opening derives seed 5, not the roster's 3
    const signer = await wardRootSigner(0, { token: "t" } as never);
    await expect(signer.sign(new Uint8Array([1]))).rejects.toThrow(/^ward-root-mismatch:/);
    expect([...seeds[1]!].every((b) => b === 0)).toBe(true);
  });
});
