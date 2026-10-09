/**
 * vk-envelope.test — a sealed carrier names its scheme by its magic, carries no version byte, and every reading a
 * writer must keep apart stays apart: absent · sealed · torn · old-shape · unopenable · bare.
 *
 * The shredder this closes: a reader that folds "sealed, but not in a frame I decode" into "not sealed" lets a
 * writer replace ciphertext it never opened. A flipped magic byte, a `LARK` carrier from the passphrase envelope,
 * and a future scheme in the house family all read as something a write must not replace.
 */
import { describe, test, expect } from "vitest";
import { readVkCarrier, VK_SEAL_MAGIC, VK_SEAL_MIN_LENGTH } from "../src/vk-envelope.js";
import { mintVk, sealUnderVk, openUnderVk } from "../src/vk.js";
import { encodeEnvelope } from "../src/archive-envelope.js";
import { VESSEL_KEL_DOMAIN, VK_SLOT_WRAP_INFO } from "../src/custody-domain-names.js";
import { ALL_DOMAINS, DOMAIN_ROOT } from "../src/domains.js";

const text = (s: string): Uint8Array => new TextEncoder().encode(s);

describe("the frame", () => {
  test("the magic names the scheme and the frame carries no version byte: magic ‖ nonce ‖ ciphertext", () => {
    expect(new TextDecoder().decode(VK_SEAL_MAGIC)).toBe("lares-vk-seal");
    const vk = mintVk();
    const sealed = sealUnderVk(vk, "keyring", text("{}"));
    expect(Array.from(sealed.subarray(0, VK_SEAL_MAGIC.length))).toEqual(Array.from(VK_SEAL_MAGIC));
    expect(sealed.length).toBe(VK_SEAL_MAGIC.length + 24 + 2 + 16);
    expect(VK_SEAL_MIN_LENGTH).toBe(VK_SEAL_MAGIC.length + 24 + 16);
  });

  test("CONTROL: a fresh seal reads sealed, and opens under its VK for its carrier", () => {
    const vk = mintVk();
    const sealed = sealUnderVk(vk, "keyring", text("secret"));
    expect(readVkCarrier(sealed)).toBe("sealed");
    const o = openUnderVk(vk, "keyring", sealed);
    expect(o.reading).toBe("opens");
    expect(o.reading === "opens" && new TextDecoder().decode(o.plaintext)).toBe("secret");
  });

  test("two seals of one plaintext differ (a fresh nonce every seal)", () => {
    const vk = mintVk();
    expect(Buffer.from(sealUnderVk(vk, "c", text("x"))).equals(Buffer.from(sealUnderVk(vk, "c", text("x"))))).toBe(false);
  });
});

describe("the readings stay apart", () => {
  test("nothing standing reads absent", () => {
    expect(readVkCarrier(null)).toBe("absent");
    expect(openUnderVk(mintVk(), "c", null).reading).toBe("absent");
  });

  test("RED: a magic with one flipped name byte reads unopenable, never bare", () => {
    const sealed = sealUnderVk(mintVk(), "c", text("secret"));
    const flipped = Uint8Array.from(sealed);
    flipped[3] ^= 0x01;
    expect(readVkCarrier(flipped)).toBe("unopenable");
  });

  test("RED: a scheme in the house family this build does not know reads unopenable", () => {
    const sealed = sealUnderVk(mintVk(), "c", text("secret"));
    const future = Uint8Array.from(sealed);
    future.set(text("lares-xy-seal"), 0);
    expect(readVkCarrier(future)).toBe("unopenable");
  });

  test("RED: a LARK carrier (the passphrase envelope) reads old-shape, whatever its version byte", () => {
    const lark = encodeEnvelope({ mode: "passphrase", salt: new Uint8Array(16), iv: new Uint8Array(12), tag: new Uint8Array(16), ciphertext: text("ct") });
    expect(readVkCarrier(lark)).toBe("old-shape");
    const v2 = Uint8Array.from(lark);
    v2[4] = 0x02;
    expect(readVkCarrier(v2)).toBe("old-shape");
  });

  test("the house magic over a frame too short to hold a nonce and a tag reads torn, never a wrong key", () => {
    const sealed = sealUnderVk(mintVk(), "c", text("secret"));
    const torn = sealed.subarray(0, VK_SEAL_MIN_LENGTH - 1);
    expect(readVkCarrier(torn)).toBe("torn");
    expect(openUnderVk(mintVk(), "c", torn).reading).toBe("torn");
  });

  test("cleartext JSON reads bare", () => {
    expect(readVkCarrier(text(JSON.stringify({ signingKey: "00".repeat(32) })))).toBe("bare");
    expect(readVkCarrier(new Uint8Array(0))).toBe("bare");
  });

  test("a VK that did not seal the bytes reads key-fails", () => {
    const sealed = sealUnderVk(mintVk(), "c", text("secret"));
    expect(openUnderVk(mintVk(), "c", sealed).reading).toBe("key-fails");
  });

  test("the carrier name rides the AEAD: one carrier's bytes moved under another name do not open", () => {
    const vk = mintVk();
    const sealed = sealUnderVk(vk, "keyring", text("secret"));
    expect(openUnderVk(vk, "walk", sealed).reading).toBe("key-fails");
  });

  test("a sealer refuses an empty carrier name", () => {
    expect(() => sealUnderVk(mintVk(), "", text("x"))).toThrow(/carrier/);
  });
});

describe("the custody domain names", () => {
  test("each reads the bare registry address its name mints, and fuses with no registered domain", () => {
    expect(VESSEL_KEL_DOMAIN).toBe(`${DOMAIN_ROOT}/vessel-kel`);
    expect(VK_SLOT_WRAP_INFO).toBe(`${DOMAIN_ROOT}/vk-slot-wrap`);
    expect(ALL_DOMAINS).not.toContain(VESSEL_KEL_DOMAIN);
    expect(ALL_DOMAINS).not.toContain(VK_SLOT_WRAP_INFO);
  });
});
