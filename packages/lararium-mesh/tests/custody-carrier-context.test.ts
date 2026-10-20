import { describe, expect, it } from "vitest";
import {
  CUSTODY_D_DOMAIN, CUSTODY_F_DOMAIN, CUSTODY_S_DOMAIN, encodeCarrierContext, type CarrierContextFields,
} from "../src/index.js";

const base: CarrierContextFields = {
  domain: CUSTODY_D_DOMAIN, store: "vessel-a", owner: "group-1", row: "persona-root", kind: "cold", ref: "persona-root-h1",
};
const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");

describe("encodeCarrierContext", () => {
  it("is deterministic for equal fields", () => {
    expect(hex(encodeCarrierContext(base))).toBe(hex(encodeCarrierContext({ ...base })));
  });

  it("changes its bytes when any one field changes", () => {
    const ref = hex(encodeCarrierContext(base));
    for (const [k, v] of [["store", "vessel-b"], ["owner", "group-2"], ["row", "face-proof-key"], ["kind", "hot"], ["ref", "persona-root-h2"]] as const) {
      expect(hex(encodeCarrierContext({ ...base, [k]: v }))).not.toBe(ref);
    }
    expect(hex(encodeCarrierContext({ ...base, domain: CUSTODY_S_DOMAIN }))).not.toBe(ref);
  });

  it("does not let a boundary shift between fields spell the same bytes", () => {
    const a = encodeCarrierContext({ ...base, owner: "ab", row: "c" });
    const b = encodeCarrierContext({ ...base, owner: "a", row: "bc" });
    expect(hex(a)).not.toBe(hex(b));
  });

  it("keeps D and S apart even on every other field equal", () => {
    expect(hex(encodeCarrierContext({ ...base, domain: CUSTODY_S_DOMAIN }))).not.toBe(hex(encodeCarrierContext(base)));
  });

  it("length-prefixes each field, big-endian, in the fixed order", () => {
    const out = encodeCarrierContext(base);
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    const seen: string[] = [];
    for (let at = 0; at < out.length;) {
      const n = view.getUint32(at, false);
      seen.push(new TextDecoder().decode(out.subarray(at + 4, at + 4 + n)));
      at += 4 + n;
    }
    expect(seen).toEqual([CUSTODY_D_DOMAIN, "vessel-a", "group-1", "persona-root", "cold", "persona-root-h1"]);
  });

  it("refuses an F context by name", () => {
    expect(() => encodeCarrierContext({ ...base, domain: CUSTODY_F_DOMAIN })).toThrow(/F row has no sealed-carrier writer/);
  });

  it("refuses an empty field on D and on S", () => {
    for (const domain of [CUSTODY_D_DOMAIN, CUSTODY_S_DOMAIN]) {
      for (const k of ["store", "owner", "row", "kind", "ref"] as const) {
        expect(() => encodeCarrierContext({ ...base, domain, [k]: "" })).toThrow(new RegExp(`non-empty ${k}`));
      }
    }
  });

  it("refuses a domain outside the three classes", () => {
    expect(() => encodeCarrierContext({ ...base, domain: "not-a-custody-domain" })).toThrow(/no custody class/);
  });

  it("carries no authored version in any class domain", () => {
    for (const d of [CUSTODY_D_DOMAIN, CUSTODY_F_DOMAIN, CUSTODY_S_DOMAIN]) expect(d).not.toMatch(/\/v\d+$/);
    expect(new Set([CUSTODY_D_DOMAIN, CUSTODY_F_DOMAIN, CUSTODY_S_DOMAIN]).size).toBe(3);
  });
});
