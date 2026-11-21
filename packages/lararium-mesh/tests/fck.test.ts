import { describe, expect, test } from "vitest";
import { faceCarrierContext, mintFck, openUnderFck, sealUnderFck, type FaceCarrier } from "../src/fck.js";
import { FCK_SEAL_MAGIC, readFckCarrier } from "../src/fck-envelope.js";
import { mintTreeKey, sealUnderS } from "../src/tree-key.js";
import { bytesEqual } from "../src/crypto.js";

const text = (s: string) => new TextEncoder().encode(s);
const a: FaceCarrier = { name: "root", path: "/a/root", kind: "cold", ref: "persona/root/a", owner: "group-a", store: "vessel-1" };

describe("face custody context", () => {
  test("CONTROL: a fresh 32-byte key opens its own frame and context", () => {
    const key = mintFck();
    expect(key.length).toBe(32);
    const sealed = sealUnderFck(key, a, text("secret"));
    expect(readFckCarrier(sealed)).toBe("sealed");
    expect(bytesEqual(sealed.subarray(0, FCK_SEAL_MAGIC.length), FCK_SEAL_MAGIC)).toBe(true);
    expect(openUnderFck(key, a, sealed)).toMatchObject({ reading: "opens", plaintext: text("secret") });
    expect(bytesEqual(sealed, sealUnderFck(key, a, text("secret")))).toBe(false);
  });
  test("RED: owner, row name, kind, reference and store each bind the seal", () => {
    const key = mintFck();
    const sealed = sealUnderFck(key, a, text("secret"));
    for (const changed of [
      { owner: "group-b" }, { name: "archive" }, { kind: "hot" }, { ref: "persona/root/b" }, { store: "vessel-2" },
    ]) expect(openUnderFck(key, { ...a, ...changed }, sealed).reading).toBe("key-fails");
    expect(openUnderFck(mintFck(), a, sealed).reading).toBe("key-fails");
    const tampered = Uint8Array.from(sealed);
    tampered[tampered.length - 1] ^= 1;
    expect(openUnderFck(key, a, tampered).reading).toBe("key-fails");
    expect(bytesEqual(faceCarrierContext(a), faceCarrierContext({ ...a, path: "/elsewhere" }))).toBe(true);
  });
  test("RED: a tree key seal remains unopenable to a face key", () => {
    expect(openUnderFck(mintFck(), a, sealUnderS(mintTreeKey(), a.name, text("v"))).reading).toBe("unopenable");
  });
});
