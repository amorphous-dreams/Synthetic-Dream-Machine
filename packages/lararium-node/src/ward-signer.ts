/**
 * ward-signer — THE FACE ROOT AS A SIGNER FOR ONE WARD ACT.
 *
 * The key a ward-signed act names is the root's PUBLIC key, read off the face's roster line (no ward opens for it). Each signature
 * opens the root seed fresh under the act's ward token, signs, and zeroes the seed; nothing caches the seed or the token past the
 * act. A call with no token refuses `ward-needs-fresh-unlock` before it reads the roster.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-ward
 */
import { ed25519SignerFromSeed } from "@lararium/mesh";
import { loadPersonaGroupRootSeed, loadPersonaGroupRootVerifyingKey } from "./node-vessel-identity.js";
import { wardCredentialsOf, type WardCredential } from "./ward-credential.js";

export interface WardRootSigner { readonly key: string; sign(bytes: Uint8Array): Promise<string> }

export async function wardRootSigner(handleIndex: number, ward: WardCredential | undefined, what = `the face root at h${handleIndex}`): Promise<WardRootSigner> {
  wardCredentialsOf(ward, what);
  const key = await loadPersonaGroupRootVerifyingKey(handleIndex);
  if (!key) throw new Error(`[ward-signer] this vessel holds no root at h${handleIndex}: a joinee signs as its device, never as the root`);
  return {
    key,
    async sign(bytes) {
      const seed = await loadPersonaGroupRootSeed(handleIndex, ward!);
      try { return await ed25519SignerFromSeed(seed)(bytes); } finally { seed.fill(0); }
    },
  };
}
