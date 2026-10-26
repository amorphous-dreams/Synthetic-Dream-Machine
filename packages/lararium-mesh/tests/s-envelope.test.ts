/**
 * s-envelope.test — a sealed carrier names its scheme by its magic, carries no version byte, and every reading a
 * writer must keep apart stays apart: absent · sealed · torn · old-shape · unopenable · bare.
 *
 * The shredder this closes: a reader that folds "sealed, but not in a frame I decode" into "not sealed" lets a
 * writer replace ciphertext it never opened. A flipped magic byte, a carrier that opens with `LARK`,
 * and a future scheme in the house family all read as something a write must not replace.
 */
import { describe, test, expect } from "vitest";
import { readSCarrier, S_SEAL_MAGIC, S_SEAL_MIN_LENGTH } from "../src/s-envelope.js";
import { mintTreeKey, sealUnderS, openUnderS } from "../src/tree-key.js";
import { LARK_MAGIC } from "../src/s-envelope.js";
import { ALL_DOMAINS, DOMAIN_ROOT, VESSEL_KEL_DOMAIN, PLACE_NEXT_KEY_DOMAIN, SLOT_WRAP_INFO } from "../src/domains.js";

const text = (s: string): Uint8Array => new TextEncoder().encode(s);

describe("the frame", () => {
  test("the magic names the scheme and the frame carries no version byte: magic ‖ nonce ‖ ciphertext", () => {
    expect(new TextDecoder().decode(S_SEAL_MAGIC)).toBe("lares-s-seal");
    const treeKey = mintTreeKey();
    const sealed = sealUnderS(treeKey, "keyring", text("{}"));
    expect(Array.from(sealed.subarray(0, S_SEAL_MAGIC.length))).toEqual(Array.from(S_SEAL_MAGIC));
    expect(sealed.length).toBe(S_SEAL_MAGIC.length + 24 + 2 + 16);
    expect(S_SEAL_MIN_LENGTH).toBe(S_SEAL_MAGIC.length + 24 + 16);
  });

  test("CONTROL: a fresh seal reads sealed, and opens under its tree key for its carrier", () => {
    const treeKey = mintTreeKey();
    const sealed = sealUnderS(treeKey, "keyring", text("secret"));
    expect(readSCarrier(sealed)).toBe("sealed");
    const o = openUnderS(treeKey, "keyring", sealed);
    expect(o.reading).toBe("opens");
    expect(o.reading === "opens" && new TextDecoder().decode(o.plaintext)).toBe("secret");
  });

  test("two seals of one plaintext differ (a fresh nonce every seal)", () => {
    const treeKey = mintTreeKey();
    expect(Buffer.from(sealUnderS(treeKey, "c", text("x"))).equals(Buffer.from(sealUnderS(treeKey, "c", text("x"))))).toBe(false);
  });
});

describe("the readings stay apart", () => {
  test("nothing standing reads absent", () => {
    expect(readSCarrier(null)).toBe("absent");
    expect(openUnderS(mintTreeKey(), "c", null).reading).toBe("absent");
  });

  test("RED: a magic with one flipped name byte reads unopenable, never bare", () => {
    const sealed = sealUnderS(mintTreeKey(), "c", text("secret"));
    const flipped = Uint8Array.from(sealed);
    flipped[3] ^= 0x01;
    expect(readSCarrier(flipped)).toBe("unopenable");
  });

  test("RED: a scheme in the house family this build does not know reads unopenable", () => {
    const sealed = sealUnderS(mintTreeKey(), "c", text("secret"));
    const future = Uint8Array.from(sealed);
    future.set(text("lares-xy-seal"), 0);
    expect(readSCarrier(future)).toBe("unopenable");
  });

  test("RED: a carrier that opens with LARK reads old-shape, whatever its version byte", () => {
    const lark = Uint8Array.from([...LARK_MAGIC, 0x01, 0x01, ...new Array(60).fill(7)]);
    expect(readSCarrier(lark)).toBe("old-shape");
    const v2 = Uint8Array.from(lark);
    v2[4] = 0x02;
    expect(readSCarrier(v2)).toBe("old-shape");
  });

  test("the house magic over a frame too short to hold a nonce and a tag reads torn, never a wrong key", () => {
    const sealed = sealUnderS(mintTreeKey(), "c", text("secret"));
    const torn = sealed.subarray(0, S_SEAL_MIN_LENGTH - 1);
    expect(readSCarrier(torn)).toBe("torn");
    expect(openUnderS(mintTreeKey(), "c", torn).reading).toBe("torn");
  });

  test("RED: a carrier cut inside its magic reads torn, never bare, at every cut", () => {
    const sealed = sealUnderS(mintTreeKey(), "c", text("secret"));
    for (let cut = 1; cut < S_SEAL_MAGIC.length; cut++) {
      const head = sealed.subarray(0, cut);
      expect(readSCarrier(head), `a cut after ${cut} bytes`).toBe("torn");
      expect(openUnderS(mintTreeKey(), "c", head).reading, `a cut after ${cut} bytes`).toBe("torn");
    }
  });

  test("RED: a short frame in the house family under another magic reads unopenable, never bare", () => {
    const short = text("lares-xy-seal\u0001\u0002");
    expect(short.length).toBeLessThan(S_SEAL_MIN_LENGTH);
    expect(readSCarrier(short)).toBe("unopenable");
  });

  test("CONTROL: short bytes that leave the magic before the family prefix, or never meet it, read bare", () => {
    expect(readSCarrier(text("lax"))).toBe("bare");
    expect(readSCarrier(text("{}"))).toBe("bare");
    expect(readSCarrier(text("x"))).toBe("bare");
  });

  test("cleartext JSON reads bare", () => {
    expect(readSCarrier(text(JSON.stringify({ signingKey: "00".repeat(32) })))).toBe("bare");
    expect(readSCarrier(new Uint8Array(0))).toBe("bare");
  });

  test("a tree key that did not seal the bytes reads key-fails", () => {
    const sealed = sealUnderS(mintTreeKey(), "c", text("secret"));
    expect(openUnderS(mintTreeKey(), "c", sealed).reading).toBe("key-fails");
  });

  test("the carrier name rides the AEAD: one carrier's bytes moved under another name do not open", () => {
    const treeKey = mintTreeKey();
    const sealed = sealUnderS(treeKey, "keyring", text("secret"));
    expect(openUnderS(treeKey, "walk", sealed).reading).toBe("key-fails");
  });

  test("a sealer refuses an empty carrier name", () => {
    expect(() => sealUnderS(mintTreeKey(), "", text("x"))).toThrow(/carrier/);
  });
});

describe("the custody domain names", () => {
  test("each reads the bare registry address its name mints, and the registry carries it", () => {
    expect(VESSEL_KEL_DOMAIN).toBe(`${DOMAIN_ROOT}/vessel-kel`);
    expect(SLOT_WRAP_INFO).toBe(`${DOMAIN_ROOT}/slot-wrap`);
    expect(ALL_DOMAINS).toContain(VESSEL_KEL_DOMAIN);
    expect(PLACE_NEXT_KEY_DOMAIN).toBe(`${DOMAIN_ROOT}/place-next-key`);
    expect(ALL_DOMAINS).toContain(PLACE_NEXT_KEY_DOMAIN);
    expect(ALL_DOMAINS).toContain(SLOT_WRAP_INFO);
  });
});
