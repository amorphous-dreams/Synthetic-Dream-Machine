import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRONAOS_REFUSALS,
  isPronaosRouteInventory,
  validatePronaosArtifactRecord,
  validatePronaosRouteInventory,
  type PronaosRouteInventory,
} from "../src/pronaos.js";

const artifactRecord = () => ({
  schema: "lararium-pronaos-artifact/v1" as const,
  routes: [
    { path: "/", file: "index.html", contentType: "text/html; charset=utf-8", cache: "no-store" as const, sha256: "a".repeat(64) },
    { path: "/manifest.webmanifest", file: "manifest.webmanifest", contentType: "application/manifest+json", cache: "no-store" as const, sha256: "b".repeat(64) },
    { path: "/assets/worker.js", file: "assets/worker.js", contentType: "application/javascript", cache: "immutable" as const, sha256: "c".repeat(64) },
    { path: "/assets/style.css", file: "assets/style.css", contentType: "text/css", cache: "immutable" as const, sha256: "d".repeat(64) },
    { path: "/assets/engine.wasm", file: "assets/engine.wasm", contentType: "application/wasm", cache: "immutable" as const, sha256: "e".repeat(64) },
  ],
});

const inventory = (): PronaosRouteInventory => ({
  refusals: DEFAULT_PRONAOS_REFUSALS,
  routes: [
    { kind: "web-artifact", path: "/", artifactCid: "a".repeat(64), integrity: "ni:///sha-256;root", cache: "no-store", refusal: "integrity" },
    { kind: "web-artifact", path: "/assets/worker.js", artifactCid: "b".repeat(64), integrity: "ni:///sha-256;worker", cache: "immutable", refusal: "integrity" },
    { kind: "genesis-seed", path: "/genesis/seed.json", seedCid: "c".repeat(64), integrity: "ni:///sha-256;seed", cache: "no-store", refusal: "integrity" },
    { kind: "genesis-member", path: `/genesis/cas/${"d".repeat(64)}`, cid: "d".repeat(64), cache: "immutable", refusal: "integrity" },
    { kind: "public-projection", path: "/public/flow", projection: "flow", cache: "revalidate", refusal: "unavailable" },
    { kind: "live-transport", path: "/live/peer", target: "node-peer", cache: "no-store", refusal: "unavailable" },
  ],
});

describe("Pronaos route inventory", () => {
  it("accepts the exact artifact delivery facts", () => {
    expect(() => validatePronaosArtifactRecord(artifactRecord())).not.toThrow();
  });

  it("refuses artifact route collisions, traversal, unknown files, bad digests, and weakened delivery facts", () => {
    const value = artifactRecord();
    expect(() => validatePronaosArtifactRecord({ ...value, routes: [...value.routes, value.routes[0]!] })).toThrow(/duplicate/);
    expect(() => validatePronaosArtifactRecord({ ...value, routes: [{ ...value.routes[1]!, path: "/assets/../secret.js" }] })).toThrow(/canonical|outside|traversal/);
    expect(() => validatePronaosArtifactRecord({ ...value, routes: [{ ...value.routes[1]!, path: "/assets/logo.svg", file: "assets/logo.svg" }] })).toThrow(/outside/);
    expect(() => validatePronaosArtifactRecord({ ...value, routes: [{ ...value.routes[2]!, sha256: "A".repeat(64) }] })).toThrow(/lowercase/);
    expect(() => validatePronaosArtifactRecord({ ...value, routes: [{ ...value.routes[2]!, contentType: "text/plain" }] })).toThrow(/application\/javascript/);
    expect(() => validatePronaosArtifactRecord({ ...value, routes: [{ ...value.routes[3]!, cache: "no-store" }] })).toThrow(/immutable/);
  });

  it("accepts the finite startup and bounded transport inventory", () => {
    expect(() => validatePronaosRouteInventory(inventory())).not.toThrow();
    expect(isPronaosRouteInventory(inventory())).toBe(true);
  });

  it("keeps the exact integrity identifiers and CID path spelling", () => {
    const value = inventory();
    validatePronaosRouteInventory(value);
    expect(value.routes[0]).toMatchObject({ artifactCid: "a".repeat(64), integrity: "ni:///sha-256;root" });
    expect(value.routes[3]).toMatchObject({ cid: "d".repeat(64), path: `/genesis/cas/${"d".repeat(64)}` });
  });

  it("refuses duplicate ownership, traversal, wildcard, and dynamic CID paths", () => {
    const value = inventory();
    expect(() => validatePronaosRouteInventory({ ...value, routes: [...value.routes, value.routes[0]!] })).toThrow(/conflicting route ownership/);
    expect(() => validatePronaosRouteInventory({ ...value, routes: [...value.routes, { ...value.routes[1]!, path: "/assets/../secret.js" }] })).toThrow(/not canonical|traversal/);
    expect(() => validatePronaosRouteInventory({ ...value, routes: [...value.routes, { ...value.routes[1]!, path: "/assets/*" }] })).toThrow(/finite file/);
    expect(() => validatePronaosRouteInventory({ ...value, routes: [...value.routes, { kind: "genesis-member", path: "/genesis/cas/:cid", cid: ":cid", cache: "immutable", refusal: "integrity" }] })).toThrow(/canonical path segment|dynamic/);
  });

  it("accepts operator-selected cache classes for content-addressed bytes", () => {
    const value = inventory();
    expect(() => validatePronaosRouteInventory({
      ...value,
      routes: value.routes.map((route) => route.kind === "genesis-member" ? { ...route, cache: "revalidate" } : route),
    })).not.toThrow();
    expect(() => validatePronaosRouteInventory({
      ...value,
      routes: value.routes.map((route) => route.kind === "web-artifact" ? { ...route, cache: "bogus" as never } : route),
    })).toThrow(/unknown cache class/);
  });

  it("refuses weakened transport/refusal contracts and malformed refusal policy", () => {
    const value = inventory();
    expect(() => validatePronaosRouteInventory({ ...value, routes: value.routes.map((route) => route.kind === "live-transport" ? { ...route, cache: "immutable" } : route) })).toThrow(/live transport/);
    expect(() => validatePronaosRouteInventory({ ...value, refusals: { ...DEFAULT_PRONAOS_REFUSALS, private: "unavailable" } })).toThrow(/refusal policy/);
  });

  it("requires the startup face by default, with an explicit contract escape for isolated tests", () => {
    const value = inventory();
    const withoutSeed = { ...value, routes: value.routes.filter((route) => route.kind !== "genesis-seed") };
    expect(() => validatePronaosRouteInventory(withoutSeed)).toThrow(/startup requires \/genesis\/seed/);
    expect(() => validatePronaosRouteInventory(withoutSeed, { requireStartup: false })).not.toThrow();
    const withoutRoot = { ...value, routes: value.routes.filter((route) => route.path !== "/") };
    expect(() => validatePronaosRouteInventory(withoutRoot)).toThrow(/startup requires a web artifact/);
  });

  it("does not use wall-clock state or platform HTTP types", () => {
    expect(() => validatePronaosRouteInventory(inventory())).not.toThrow();
    expect(isPronaosRouteInventory({})).toBe(false);
  });
});
