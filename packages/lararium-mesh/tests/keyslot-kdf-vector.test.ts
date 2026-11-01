/**
 * keyslot-kdf-vector.test — CONTROL: noble's scrypt at the real cost answers a stored vector, so every port the
 * parity witness measures against noble measures against fixed bytes, and a noble upgrade that moved them reads here.
 */
import { test, expect, vi } from "vitest";
import { scrypt } from "@noble/hashes/scrypt.js";

vi.setConfig({ testTimeout: 60_000 });

test("CONTROL: noble alone, at N=2^17 r=8 p=1, derives the stored bytes", () => {
  const pw = new TextEncoder().encode("ʻŌlelo noʻeau 🌺".normalize("NFKC"));
  const out = scrypt(pw, new Uint8Array(16).fill(0xa5), { N: 1 << 17, r: 8, p: 1, dkLen: 32 });
  expect(Buffer.from(out).toString("hex")).toBe("ca5cb1ccdfaa69c48bbb06e6aca5b52db6f523750fc94eadd1b478ce4221184a");
});
