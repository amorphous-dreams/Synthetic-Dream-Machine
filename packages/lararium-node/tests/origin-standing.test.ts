/**
 * origin-standing — the vessel's standing is an input to its origin composition.
 *
 * A lararium composes relay + read (oracle) + Web. A herm is a waystone: it composes relay + read, and its
 * Web origin is absent by law — typed absent, never a refused value the boot must route around. The read
 * origin stays explicit for both standings: declared, or covered by `sameOrigin`. `sameOrigin` reads "every
 * surface this standing has shares the relay face's origin", so it spans relay = read for a herm and all
 * three for a lararium.
 *
 * Origin custody stays with a present keeper: a herm handed a Web origin or any Pronaos input refuses with
 * the waystone message, and the crossing banner (Web origin + relay + gate key) speaks only for a lararium.
 */
import { describe, expect, test } from "vitest";
import {
  originCompositionForFace, oracleOriginForFace, crossingBannerLines, assertWaystoneCustody,
  OriginCustodyRefusal, type ReachFace,
} from "../src/lan-address.js";

const FACE: ReachFace = { kind: "lan", host: "192.168.1.42:8080", origin: "http://192.168.1.42:8080" };
const DECLARED: ReachFace = { kind: "declared", host: "waystone.example", origin: "https://waystone.example" };
const WAYSTONE = /a waystone serves no arrival page; light a Pronaos on a lararium/;

describe("herm (waystone) origin composition", () => {
  test("a herm with no Web declaration resolves to relay + read and no Web origin", () => {
    const composition = originCompositionForFace(FACE, { oracleOrigin: "http://oracle.local:8081" }, "herm");
    expect(composition).toEqual({ relayOrigin: "http://192.168.1.42:8080", oracleOrigin: "http://oracle.local:8081" });
    expect("webOrigin" in composition).toBe(false);
    expect(oracleOriginForFace(FACE, { oracleOrigin: "http://oracle.local:8081" }, "herm")).toBe("http://oracle.local:8081");
  });

  test("a herm with sameOrigin reads relay = read, and still no Web origin", () => {
    const composition = originCompositionForFace(DECLARED, { sameOrigin: true }, "herm");
    expect(composition).toEqual({ relayOrigin: "https://waystone.example", oracleOrigin: "https://waystone.example" });
    expect("webOrigin" in composition).toBe(false);
  });

  test("a herm's read origin stays explicit — neither the relay face nor a port stands in for it", () => {
    expect(() => originCompositionForFace(FACE, {}, "herm")).toThrow(/oracle origin must be declared/);
    expect(() => originCompositionForFace(FACE, { sameOrigin: false }, "herm")).toThrow(/oracle origin must be declared/);
  });

  test("a herm handed a Web origin refuses with the waystone message", () => {
    expect(() => originCompositionForFace(FACE, { webOrigin: "http://web.local", oracleOrigin: "http://oracle.local" }, "herm"))
      .toThrow(WAYSTONE);
    expect(() => originCompositionForFace(FACE, { webOrigin: "http://web.local", sameOrigin: true }, "herm")).toThrow(WAYSTONE);
    expect(() => assertWaystoneCustody("herm", { webOrigin: "http://web.local" }, {})).toThrow(OriginCustodyRefusal);
    expect(() => assertWaystoneCustody("herm", { webOrigin: "http://web.local" }, {})).toThrow(/LAR_WEB_ORIGIN \/ origins\.web/);
  });

  test("a herm handed any Pronaos input refuses with the waystone message", () => {
    expect(() => assertWaystoneCustody("herm", {}, { LAR_PRONAOS_WEB_ROOT: "/srv/web" })).toThrow(WAYSTONE);
    expect(() => assertWaystoneCustody("herm", {}, { LAR_PRONAOS_ARTIFACT_RECORD: "/srv/r.json" })).toThrow(/LAR_PRONAOS_ARTIFACT_RECORD/);
    expect(() => assertWaystoneCustody("herm", { sameOrigin: true }, { LAR_PRONAOS_ANYTHING: "x" })).toThrow(WAYSTONE);
  });

  test("a herm with only relay/read declarations, and no Pronaos input, passes custody", () => {
    expect(() => assertWaystoneCustody("herm", {}, {})).not.toThrow();
    expect(() => assertWaystoneCustody("herm", { sameOrigin: true, oracleOrigin: undefined }, { LAR_PUBLIC_URL: "https://w.example" })).not.toThrow();
    expect(() => assertWaystoneCustody("herm", { oracleOrigin: "http://oracle.local" }, { LAR_PRONAOS_WEB_ROOT: undefined })).not.toThrow();
  });
});

describe("lararium controls — the composition stays as it stood", () => {
  test("CONTROL: a lararium with no Web declaration still refuses", () => {
    expect(() => originCompositionForFace(FACE, { oracleOrigin: "http://oracle.local" }, "lararium")).toThrow(/Web origin must be declared/);
    expect(() => originCompositionForFace(FACE, {}, "lararium")).toThrow(/Web origin/);
  });

  test("CONTROL: a lararium with sameOrigin gets all three surfaces on the relay face", () => {
    expect(originCompositionForFace(DECLARED, { sameOrigin: true }, "lararium")).toEqual({
      webOrigin: "https://waystone.example", relayOrigin: "https://waystone.example", oracleOrigin: "https://waystone.example",
    });
  });

  test("CONTROL: a lararium passes custody with a Web origin and Pronaos inputs", () => {
    expect(() => assertWaystoneCustody("lararium", { webOrigin: "http://web.local" }, { LAR_PRONAOS_WEB_ROOT: "/srv/web" })).not.toThrow();
  });

  test("CONTROL: no value promotes across surfaces without a declaration", () => {
    const portOnly: ReachFace = { kind: "loopback", host: "localhost:5173", origin: "http://localhost:5173" };
    const env = { LAR_PUBLIC_URL: "https://public.example", LAR_PORT: "5173" };
    for (const standing of ["herm", "lararium"] as const) {
      // A declared Web value never leaks into the read origin, and the relay face never fills either.
      expect(() => originCompositionForFace(portOnly, { webOrigin: "http://web.local" }, standing)).toThrow();
      expect(() => originCompositionForFace(portOnly, {}, standing)).toThrow();
      expect(() => assertWaystoneCustody(standing, {}, env)).not.toThrow();
    }
    const herm = originCompositionForFace(portOnly, { oracleOrigin: "http://oracle.local" }, "herm");
    expect(Object.values(herm)).not.toContain("https://public.example");
    expect(herm.relayOrigin).toBe("http://localhost:5173");
    expect(herm.oracleOrigin).toBe("http://oracle.local");
  });
});

describe("the crossing banner (Web origin + relay + gate key) speaks only for a lararium", () => {
  test("a herm composition yields no crossing line", () => {
    const herm = originCompositionForFace(DECLARED, { sameOrigin: true }, "herm");
    expect(crossingBannerLines("herm", [{ face: DECLARED, composition: herm }], "beef")).toEqual([]);
  });

  test("CONTROL: a lararium composition yields one crossing line per face", () => {
    const lar = originCompositionForFace(DECLARED, { sameOrigin: true }, "lararium");
    expect(crossingBannerLines("lararium", [{ face: DECLARED, composition: lar }], "beef")).toEqual([
      "https://waystone.example/?relay=wss://waystone.example/ws&gate=beef   (declared)",
    ]);
  });
});
