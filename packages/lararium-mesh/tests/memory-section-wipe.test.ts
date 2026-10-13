/**
 * memory-section-wipe — no copy of a memory section's plaintext outlives its reading, on any exit.
 *
 * A section's plaintext holds bare content keys. The reader zero-fills the decrypted buffer and every buffer it
 * cut out of it before it returns: after a section that reads whole, and after one that opens under its key and
 * then reads malformed. These vectors hold the decrypted buffer itself (the box's opener answers it, and a
 * module seam hands it to the test) and every slice the reader took.
 *
 * Synthetic keys. Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { describe, expect, it, vi } from "vitest";

const opened: Uint8Array[] = [];
vi.mock("../src/sealed-box.js", async (original) => {
  const actual = await original<typeof import("../src/sealed-box.js")>();
  return {
    ...actual,
    openFromSender: (args: Parameters<typeof actual.openFromSender>[0]) => {
      const out = actual.openFromSender(args);
      if (out !== null) opened.push(out);
      return out;
    },
  };
});

const { hex, utf8Bytes } = await import("../src/crypto.js");
const { SEALED_MEMORY_BOX_INFO, SEALED_MEMORY_SECTION_DOMAIN } = await import("../src/domains.js");
const { mintMemoryKeypair, openMemorySection, sealMemorySection } = await import("../src/memory-section.js");
const { sealToRecipient } = await import("../src/sealed-box.js");
const { sealedImage } = await import("../src/sealed-chunk.js");

const KEY = Uint8Array.from({ length: 32 }, (_, i) => 0xa0 ^ i);
const ENTRY = { bagId: "lar:///ha.ka.ba/@test/bags/garden-notes", locator: "11".repeat(32), keyVersion: "22".repeat(32), key: KEY };
const holdsKey = (bytes: Uint8Array): boolean => hex(bytes).includes(hex(KEY));

/** Run `read` while every `slice` a reader takes gets kept; answers what the reader returned and what it cut. */
function watched<T>(read: () => T): { out: T; cutOut: Uint8Array[]; decrypted: Uint8Array[] } {
  const cutOut: Uint8Array[] = [];
  opened.length = 0;
  const realSlice = Uint8Array.prototype.slice;
  Uint8Array.prototype.slice = function (...a: [number?, number?]) { const out = realSlice.apply(this, a); cutOut.push(out); return out; } as never;
  try { return { out: read(), cutOut, decrypted: [...opened] }; } finally { Uint8Array.prototype.slice = realSlice; }
}

/** Box an arbitrary plaintext as a section rides: sender's key, nonce, ciphertext. */
function boxed(plaintext: Uint8Array, to: Uint8Array): Uint8Array {
  const sealed = sealToRecipient({ recipientPub: to, plaintext, info: utf8Bytes(SEALED_MEMORY_BOX_INFO) });
  const out = new Uint8Array(32 + sealed.aeadNonce.length + sealed.ciphertext.length);
  out.set(sealed.senderEphemeralPub, 0);
  out.set(sealed.aeadNonce, 32);
  out.set(sealed.ciphertext, 32 + sealed.aeadNonce.length);
  return out;
}
const entryImage = (key: Uint8Array): Uint8Array =>
  sealedImage("", utf8Bytes(ENTRY.bagId), Uint8Array.from({ length: 32 }, () => 0x11), Uint8Array.from({ length: 32 }, () => 0x22), key);

describe("a section's decrypted plaintext leaves with its reading", () => {
  it("the decrypted buffer reads zero once a whole section returns its entries", () => {
    const pair = mintMemoryKeypair();
    const section = sealMemorySection([ENTRY], pair.public);
    const { out, decrypted, cutOut } = watched(() => openMemorySection(section, pair.secret));
    // CONTROL: the reader handed the key back, and the seam caught the one buffer the box opened.
    expect(out).not.toBeNull();
    expect(holdsKey(out![0]!.key)).toBe(true);
    expect(decrypted).toHaveLength(1);
    expect(decrypted[0]!.length).toBeGreaterThan(32);
    expect(decrypted[0]!.every((b) => b === 0)).toBe(true);
    expect(cutOut.filter(holdsKey)).toEqual([]);
  });

  it.each([
    ["a second entry whose key reads one byte short", () => sealedImage(SEALED_MEMORY_SECTION_DOMAIN, sealedImage("", entryImage(KEY), entryImage(KEY.subarray(0, 31))))],
    ["a list whose last member runs past the bytes", () => {
      const list = sealedImage("", entryImage(KEY));
      const torn = new Uint8Array(list.length + 4);
      torn.set(list, 0);
      torn.set([0, 0, 0, 9], list.length);
      return sealedImage(SEALED_MEMORY_SECTION_DOMAIN, torn);
    }],
    ["a list whose first member carries a name", () => sealedImage(SEALED_MEMORY_SECTION_DOMAIN, sealedImage("named", entryImage(KEY)))],
    ["a section image with a field too many", () => sealedImage(SEALED_MEMORY_SECTION_DOMAIN, sealedImage("", entryImage(KEY)), KEY)],
    ["an entry with a field too many", () => sealedImage(SEALED_MEMORY_SECTION_DOMAIN, sealedImage("", sealedImage("", utf8Bytes(ENTRY.bagId), new Uint8Array(32), new Uint8Array(32), KEY, KEY)))],
  ])("a section that opens and reads malformed (%s) answers null and leaves no key behind", (_name, build) => {
    const pair = mintMemoryKeypair();
    const plaintext = build();
    // CONTROL: the malformed plaintext does carry the key before it gets sealed.
    expect(holdsKey(plaintext)).toBe(true);
    const section = boxed(plaintext, pair.public);
    const { out, decrypted, cutOut } = watched(() => openMemorySection(section, pair.secret));
    expect(out).toBeNull();
    expect(decrypted).toHaveLength(1);
    expect(decrypted[0]!.every((b) => b === 0)).toBe(true);
    expect(cutOut.length).toBeGreaterThan(0);
    expect(cutOut.filter(holdsKey)).toEqual([]);
  });
});
