/**
 * lan-address.test — the banner names what the socket answers on.
 *
 * The vessel binds `0.0.0.0`; a banner naming only `localhost` therefore under-reports it, and an
 * operator standing at a phone reads a name that resolves to the phone. These tests pin the derivation
 * against a FIXED interface table, so they say the same thing on a laptop, in CI, and inside a container.
 */
import { describe, test, expect } from "vitest";
import {
  lanIPv4Addresses, deriveReachFaces, wsUrlForOrigin, crossingUrl, webOriginForFace, oracleOriginForFace,
  originCompositionForFace,
  type InterfaceTable, type ReachFace,
} from "../src/lan-address.js";

/** A host holding loopback, a household LAN address, a docker bridge, and an IPv6 face. */
const TABLE: InterfaceTable = {
  lo:     [{ address: "127.0.0.1", family: "IPv4", internal: true }],
  eth0:   [
    { address: "192.168.1.42", family: "IPv4", internal: false },
    { address: "fe80::1",      family: "IPv6", internal: false },
  ],
  docker0: [{ address: "172.17.0.1", family: "IPv4", internal: false }],
};

describe("the reach-faces a vessel answers on", () => {
  test("loopback and IPv6 drop out; the LAN address stands", () => {
    expect(lanIPv4Addresses(TABLE)).toEqual(["192.168.1.42", "172.17.0.1"]);
  });

  test("an older table reporting family as the NUMBER 4 reads the same", () => {
    expect(lanIPv4Addresses({ eth0: [{ address: "10.0.0.7", family: 4, internal: false }] }))
      .toEqual(["10.0.0.7"]);
  });

  test("the household range outranks the larger private blocks — a phone types the first line", () => {
    const t: InterfaceTable = {
      a: [{ address: "172.20.0.3",   family: "IPv4", internal: false }],
      b: [{ address: "10.1.2.3",     family: "IPv4", internal: false }],
      c: [{ address: "192.168.0.11", family: "IPv4", internal: false }],
      d: [{ address: "169.254.9.9",  family: "IPv4", internal: false }],
    };
    expect(lanIPv4Addresses(t)).toEqual(["192.168.0.11", "10.1.2.3", "172.20.0.3", "169.254.9.9"]);
  });

  test("a host with no LAN face still names loopback — the banner never empties", () => {
    const faces = deriveReachFaces({ port: 8080, interfaces: { lo: [{ address: "127.0.0.1", family: "IPv4", internal: true }] } });
    expect(faces).toEqual([{ kind: "loopback", host: "localhost:8080", origin: "http://localhost:8080" }]);
  });

  test("every interface reaches the banner, loopback first, LAN behind it", () => {
    expect(deriveReachFaces({ port: 8080, interfaces: TABLE })).toEqual([
      { kind: "loopback", host: "localhost:8080",    origin: "http://localhost:8080" },
      { kind: "lan",      host: "192.168.1.42:8080", origin: "http://192.168.1.42:8080" },
      { kind: "lan",      host: "172.17.0.1:8080",   origin: "http://172.17.0.1:8080" },
    ]);
  });

  test("a DECLARED public url leads — the operator knows a reachability the interface table cannot see", () => {
    const faces = deriveReachFaces({ port: 8080, declaredUrl: "https://hearth.example/", interfaces: TABLE });
    expect(faces[0]).toEqual({ kind: "declared", host: "hearth.example", origin: "https://hearth.example" });
    expect(faces.map((f) => f.kind)).toEqual(["declared", "loopback", "lan", "lan"]);
  });

  test("a declared url that repeats an interface origin prints ONCE", () => {
    const faces = deriveReachFaces({ port: 8080, declaredUrl: "http://192.168.1.42:8080", interfaces: TABLE });
    expect(faces.filter((f) => f.origin === "http://192.168.1.42:8080")).toHaveLength(1);
  });

  test("the relay url follows the origin's scheme — a TLS face carries wss", () => {
    expect(wsUrlForOrigin("http://192.168.1.42:8080")).toBe("ws://192.168.1.42:8080/ws");
    expect(wsUrlForOrigin("https://hearth.example")).toBe("wss://hearth.example/ws");
  });

  test("the crossing url dials the SAME host the web surface came from — a phone cannot reach the node's localhost", () => {
    const face: ReachFace = { kind: "lan", host: "192.168.1.42:8080", origin: "http://192.168.1.42:8080" };
    const url = crossingUrl({
      webOrigin: webOriginForFace(face, 5173, {
        webOrigin: "http://192.168.1.42:5173",
        oracleOrigin: "http://192.168.1.42:8080",
      }),
      wsUrl: wsUrlForOrigin(face.origin), gateKey: "ab12",
    });
    expect(url).toBe("http://192.168.1.42:5173/?relay=ws://192.168.1.42:8080/ws&gate=ab12");
    expect(url).not.toContain("localhost");
  });

  // ── DNS-01: an explicit same-origin declaration binds Web + relay + oracle under ONE name ──

  test("a declared TLS face may explicitly declare one origin for Web + relay + oracle", () => {
    const declared: ReachFace = { kind: "declared", host: "enyalios.home.amorphousdreams.net", origin: "https://enyalios.home.amorphousdreams.net" };
    const composition = originCompositionForFace(declared, { sameOrigin: true });
    expect(composition).toEqual({
      webOrigin: "https://enyalios.home.amorphousdreams.net",
      relayOrigin: "https://enyalios.home.amorphousdreams.net",
      oracleOrigin: "https://enyalios.home.amorphousdreams.net",
    });
    expect(webOriginForFace(declared, 5173, { sameOrigin: true })).toBe("https://enyalios.home.amorphousdreams.net");
    expect(oracleOriginForFace(declared, { sameOrigin: true })).toBe("https://enyalios.home.amorphousdreams.net");
    // The relay under the SAME name carries wss (mixed-content-safe from an https page).
    expect(wsUrlForOrigin(declared.origin)).toBe("wss://enyalios.home.amorphousdreams.net/ws");
    // The whole crossing URL: web surface over https, relay over wss, one name.
    expect(crossingUrl({ webOrigin: webOriginForFace(declared, 5173, { sameOrigin: true }), wsUrl: wsUrlForOrigin(declared.origin), gateKey: "beef" }))
      .toBe("https://enyalios.home.amorphousdreams.net/?relay=wss://enyalios.home.amorphousdreams.net/ws&gate=beef");
  });

  test("split household composition names Web and oracle independently from the relay", () => {
    const face = deriveReachFaces({ port: 8080, interfaces: TABLE })[1]!;
    const composition = originCompositionForFace(face, {
      webOrigin: "http://192.168.1.42:5173",
      oracleOrigin: "http://waystone.local:8081",
    });
    expect(composition).toEqual({
      webOrigin: "http://192.168.1.42:5173",
      relayOrigin: "http://192.168.1.42:8080",
      oracleOrigin: "http://waystone.local:8081",
    });
    expect(oracleOriginForFace(face, { webOrigin: "http://web.local", oracleOrigin: "http://oracle.local" }))
      .toBe("http://oracle.local");
  });

  test("omitted Web/oracle declarations refuse instead of inferring equivalence from the relay", () => {
    const face: ReachFace = { kind: "declared", host: "hearth.example", origin: "https://hearth.example" };
    expect(() => webOriginForFace(face, 5173)).toThrow(/Web origin is undeclared/);
    expect(() => originCompositionForFace(face, { oracleOrigin: "https://oracle.example" })).toThrow(/Web origin/);
    expect(() => originCompositionForFace(face, { webOrigin: "https://web.example" })).toThrow(/oracle origin/);
    expect(() => oracleOriginForFace(face, { webOrigin: "https://web.example" })).toThrow(/oracle origin/);
    expect(() => originCompositionForFace(face, {})).toThrow(/Web origin/);
  });

  test("changing origins changes reachability strings only", () => {
    const declaredHttp: ReachFace = { kind: "declared", host: "192.168.1.42:8080", origin: "http://192.168.1.42:8080" };
    const held = { caps: ["relay", "public-library"], identity: "did:key:z6Mk", document: "lar:///family/book" };
    const before = JSON.stringify(held);
    const first = originCompositionForFace(declaredHttp, { webOrigin: "http://web-a.local", oracleOrigin: "http://oracle-a.local" });
    const second = originCompositionForFace(declaredHttp, { webOrigin: "http://web-b.local", oracleOrigin: "http://oracle-b.local" });
    expect(first.webOrigin).not.toBe(second.webOrigin);
    expect(first.oracleOrigin).not.toBe(second.oracleOrigin);
    expect(first.relayOrigin).toBe(second.relayOrigin);
    expect(JSON.stringify(held)).toBe(before);
    expect(wsUrlForOrigin(declaredHttp.origin)).toBe("ws://192.168.1.42:8080/ws");
  });
});
