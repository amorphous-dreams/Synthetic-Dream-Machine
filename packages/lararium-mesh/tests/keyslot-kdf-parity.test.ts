/**
 * keyslot-kdf-parity.test — the host's native scrypt and noble's derive the SAME passphrase material at the real cost.
 *
 * A slot bound under one port opens under the other only when both derive identical bytes: the pin's KEK runs HKDF
 * over the material and the AEAD authenticates the wrap, so a single differing bit refuses. The table leans on what
 * NFKC moves (combining marks, the Hawaiian ʻokina and kahakō, Devanagari, emoji, compatibility ligatures) and on
 * the passphrase and salt edges. The salts come from a constant-fill rng, so the all-zero and all-0xff salts stand
 * beside random ones.
 */
import { describe, test, expect, vi } from "vitest";

// Every case derives twice at N=2^17 (once per port). The work stays fixed; the room names it, and no case waits on a clock.
vi.setConfig({ testTimeout: 120_000 });
import { bindSlot, openTreeKey, nobleKdf, type KdfPort } from "../src/keyslot.js";
import { nativeKdf } from "../src/node.js";
import { mintTreeKey, treeKeyEquals } from "../src/tree-key.js";
import { defaultCryptoProvider, type RandomProvider } from "../src/crypto.js";

const fill = (byte: number): RandomProvider => ({
  getRandomValues: <T extends Uint8Array<ArrayBuffer>>(a: T): T => { a.fill(byte); return a; },
  randomUUID: () => "00000000-0000-4000-8000-000000000000",
});

const PASSPHRASES: readonly (readonly [string, string])[] = [
  ["a single character", "x"],
  ["ascii words", "correct horse battery staple"],
  ["the ʻokina and kahakō, precomposed", "ʻŌlelo Hawaiʻi: kāne, wahine, ʻāina"],
  ["the kahakō as combining macrons", "Āina kāne"],
  ["a decomposed é beside a precomposed é", "café / café"],
  ["Devanagari with a virama and nukta", "नमस्ते क़िला"],
  ["emoji with ZWJ and a skin-tone modifier", "🌺👩🏽‍🚀🏳️‍🌈"],
  ["compatibility forms NFKC folds", "ﬁ ﬂ ① ｆｕｌｌｗｉｄｔｈ Ⅻ"],
  ["a long passphrase", "lararium ".repeat(1200)],
];

const SALTS: readonly (readonly [string, RandomProvider])[] = [
  ["all-zero salt", fill(0x00)],
  ["all-0xff salt", fill(0xff)],
  ["random salt", defaultCryptoProvider],
];

async function crossOpens(passphrase: string, rng: RandomProvider, bindWith: KdfPort, openWith: KdfPort): Promise<boolean> {
  const treeKey = mintTreeKey();
  const tree = await bindSlot(null, treeKey, { t: 1, pins: [{ kind: "passphrase", passphrase }] }, bindWith, rng);
  const opened = await openTreeKey(tree, [{ kind: "passphrase", passphrase }], openWith);
  return opened.reading === "opens" && treeKeyEquals(opened.treeKey, treeKey);
}

describe("native ≡ noble at the real cost", () => {
  // Without this, a build whose verbs ignored the port would pass every cross-open below on noble alone.
  test("both ports stand, and they differ", () => {
    expect(nobleKdf).toBeDefined();
    expect(nativeKdf).toBeDefined();
    expect(nativeKdf).not.toBe(nobleKdf);
  });
  for (const [what, passphrase] of PASSPHRASES) {
    test(`${what}: bound under noble, opens under native`, async () => {
      expect(await crossOpens(passphrase, defaultCryptoProvider, nobleKdf, nativeKdf)).toBe(true);
    });
  }
  for (const [what, rng] of SALTS) {
    test(`${what}: bound under native, opens under noble`, async () => {
      expect(await crossOpens("ʻŌlelo noʻeau 🌺", rng, nativeKdf, nobleKdf)).toBe(true);
    });
  }

  test("an NFKC-equal spelling opens across ports, and a near-miss refuses under both", async () => {
    const treeKey = mintTreeKey();
    const tree = await bindSlot(null, treeKey, { t: 1, pins: [{ kind: "passphrase", passphrase: "ﬁne ①" }] }, nativeKdf, defaultCryptoProvider);
    const folded = await openTreeKey(tree, [{ kind: "passphrase", passphrase: "fine 1" }], nobleKdf);
    expect(folded.reading === "opens" && treeKeyEquals(folded.treeKey, treeKey)).toBe(true);
    for (const kdf of [nobleKdf, nativeKdf]) {
      expect((await openTreeKey(tree, [{ kind: "passphrase", passphrase: "fine 2" }], kdf)).reading).toBe("no-slot-opens");
    }
  });
});
