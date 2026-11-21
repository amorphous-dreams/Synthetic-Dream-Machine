import { describe, expect, test } from "vitest";
import { FCK_SEAL_MAGIC, FCK_SEAL_MIN_LENGTH, readFckCarrier } from "../src/fck-envelope.js";
import { S_SEAL_MAGIC, readSCarrier } from "../src/s-envelope.js";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("face frame readings", () => {
  test("CONTROL: a complete face frame and absence retain their readings", () => {
    expect(readFckCarrier(null)).toBe("absent");
    expect(readFckCarrier(Uint8Array.from([...FCK_SEAL_MAGIC, ...new Uint8Array(FCK_SEAL_MIN_LENGTH - FCK_SEAL_MAGIC.length)]))).toBe("sealed");
  });
  test("RED: a tree key frame cannot masquerade as a face frame or cleartext", () => {
    const treeKey = Uint8Array.from([...S_SEAL_MAGIC, ...new Uint8Array(40)]);
    expect(readFckCarrier(treeKey)).toBe("unopenable");
    const face = Uint8Array.from([...FCK_SEAL_MAGIC, ...new Uint8Array(40)]);
    expect(readSCarrier(face)).toBe("unopenable");
  });
  test("RED: torn, damaged and bare bytes stay distinct", () => {
    expect(readFckCarrier(FCK_SEAL_MAGIC.subarray(0, 4))).toBe("torn");
    expect(readFckCarrier(FCK_SEAL_MAGIC)).toBe("torn");
    const damaged = Uint8Array.from([...FCK_SEAL_MAGIC, ...new Uint8Array(40)]);
    damaged[2] ^= 1;
    expect(readFckCarrier(damaged)).toBe("unopenable");
    expect(readFckCarrier(bytes("plain"))).toBe("bare");
    expect(readFckCarrier(Uint8Array.from([0x4c, 0x41, 0x52, 0x4b, 0, 0, 0, 0]))).toBe("bare");   // LARK-led bytes carry no reading of their own
  });
});
