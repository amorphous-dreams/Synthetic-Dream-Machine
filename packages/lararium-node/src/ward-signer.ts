/**
 * ward-signer — THE FACE ROOT AS A SIGNER FOR ONE WARD ACT.
 *
 * The key a ward-signed act names is the root's PUBLIC key, read off the face's roster line (no ward opens for it). Each signature
 * opens the root seed fresh under the act's ward token, signs, and zeroes the seed; nothing caches the seed or the token past the
 * act. A call with no token refuses `ward-needs-fresh-unlock` before it reads the roster.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-ward
 */
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, WardRefused } from "@lararium/mesh";
import { loadPersonaGroupRootSeed, loadPersonaGroupRootVerifyingKey } from "./node-vessel-identity.js";
import { wardCredentialsOf, wardOrGather, type WardCredential } from "./ward-credential.js";

export interface WardRootSigner { readonly key: string; sign(bytes: Uint8Array): Promise<string> }

export async function wardRootSigner(handleIndex: number, ward: WardCredential | undefined, what = `the face root at h${handleIndex}`): Promise<WardRootSigner> {
  // The act's token, or one the process's seated gatherer asks a person for, ONCE for this signer's act.
  const held = await wardOrGather(ward, what);
  wardCredentialsOf(held, what);
  const key = await loadPersonaGroupRootVerifyingKey(handleIndex);
  if (!key) throw new Error(`[ward-signer] this vessel holds no root at h${handleIndex}: a joinee signs as its device, never as the root`);
  // ONE SIGNATURE: a second sign refuses by name, so a signer handed on never signs an act the hand did not make.
  let spent = false;
  return {
    key,
    async sign(bytes) {
      if (spent) throw new WardRefused("ward-signer-spent", `${what} signed once already; a ward signer signs one act`);
      spent = true;
      const seed = await loadPersonaGroupRootSeed(handleIndex, held);
      try {
        // The seed signs only as the key this signer named: a seed that derives another key signs nothing.
        if ((await ed25519VerifyingKeyFromSeed(seed)).toLowerCase() !== key.toLowerCase()) throw new WardRefused("ward-root-mismatch", `${what}: the opened seed derives another key than the face root's`);
        return await ed25519SignerFromSeed(seed)(bytes);
      } finally { seed.fill(0); }
    },
  };
}

/**
 * The face root for ONE act that signs more than once (a holder's edge kāpae signs its act and the fleet frontier it counts): the
 * seed opens under the act's ward at the first signature, serves the act's signatures, and zeroes at `close`, which the act calls
 * when it settles. Nothing reopens it after `close`.
 */
export async function wardRootSession(handleIndex: number, ward: WardCredential | undefined, what: string): Promise<WardRootSigner & { close(): void }> {
  const held = await wardOrGather(ward, what);
  wardCredentialsOf(held, what);
  const key = await loadPersonaGroupRootVerifyingKey(handleIndex);
  if (!key) throw new Error(`[ward-signer] this vessel holds no root at h${handleIndex}: a joinee signs as its device, never as the root`);
  let seed: Uint8Array | null = null, closed = false;
  return {
    key,
    async sign(bytes) {
      if (closed) throw new WardRefused("ward-signer-spent", `${what} settled; its root signs nothing more`);
      if (seed === null) {
        const opened = await loadPersonaGroupRootSeed(handleIndex, held);
        if ((await ed25519VerifyingKeyFromSeed(opened)).toLowerCase() !== key.toLowerCase()) { opened.fill(0); throw new WardRefused("ward-root-mismatch", `${what}: the opened seed derives another key than the face root's`); }
        seed = opened;
      }
      return ed25519SignerFromSeed(seed)(bytes);
    },
    close() { closed = true; seed?.fill(0); seed = null; },
  };
}
