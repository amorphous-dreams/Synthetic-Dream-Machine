/**
 * Authority primitive tests — Ed25519 identity, did:key, UCAN v0.10.
 *
 * Machine-checks the crypto and protocol primitives that gate Automerge
 * peer authorization. These run in Node (no browser IDB needed).
 */

import { describe, test, expect } from "@jest/globals";
import {
  generateOperatorIdentity,
  encodeDidKey,
  decodeDidKey,
  serializeIdentity,
  deserializeIdentity,
  issueUcan,
  verifyUcan,
  UcanPeerRegistry,
} from "../src/authority.js";

// ---------------------------------------------------------------------------
// Identity — keypair generation and did:key round-trip
// ---------------------------------------------------------------------------

describe("generateOperatorIdentity", () => {
  test("generates a valid did:key starting with did:key:z", async () => {
    const id = await generateOperatorIdentity();
    expect(id.did).toMatch(/^did:key:z/);
  });

  test("public key is 32 bytes (Ed25519)", async () => {
    const id = await generateOperatorIdentity();
    expect(id.publicKeyBytes).toHaveLength(32);
  });

  test("private key is 32 bytes", async () => {
    const id = await generateOperatorIdentity();
    expect(id.privateKeyBytes).toHaveLength(32);
  });

  test("two generated identities have distinct DIDs", async () => {
    const a = await generateOperatorIdentity();
    const b = await generateOperatorIdentity();
    expect(a.did).not.toBe(b.did);
  });
});

describe("did:key encoding round-trip", () => {
  test("encodeDidKey / decodeDidKey are inverse", async () => {
    const id = await generateOperatorIdentity();
    const decoded = decodeDidKey(id.did);
    expect(decoded).toEqual(id.publicKeyBytes);
  });

  test("decodeDidKey throws on non-did:key input", () => {
    expect(() => decodeDidKey("did:web:example.com")).toThrow();
  });
});

describe("serializeIdentity / deserializeIdentity", () => {
  test("round-trips all fields via JSON-safe hex encoding", async () => {
    const id = await generateOperatorIdentity();
    const json = serializeIdentity(id);
    const restored = deserializeIdentity(json);
    expect(restored.did).toBe(id.did);
    expect(restored.publicKeyBytes).toEqual(id.publicKeyBytes);
    expect(restored.privateKeyBytes).toEqual(id.privateKeyBytes);
  });

  test("serialized form has no Uint8Array (JSON-safe)", async () => {
    const id = await generateOperatorIdentity();
    const json = serializeIdentity(id);
    const str = JSON.stringify(json);
    expect(str).not.toContain("Uint8Array");
  });
});

// ---------------------------------------------------------------------------
// UCAN — issuance and verification
// ---------------------------------------------------------------------------

describe("issueUcan", () => {
  test("returns a three-part JWT string", async () => {
    const issuer   = await generateOperatorIdentity();
    const audience = (await generateOperatorIdentity()).did;
    const { token } = await issueUcan({ issuer, audience, resource: "lararium:*", ability: "automerge/sync" });
    expect(token.split(".")).toHaveLength(3);
  });

  test("payload encodes correct iss and aud", async () => {
    const issuer   = await generateOperatorIdentity();
    const audience = (await generateOperatorIdentity()).did;
    const { payload } = await issueUcan({ issuer, audience, resource: "lararium:*", ability: "automerge/sync" });
    expect(payload.iss).toBe(issuer.did);
    expect(payload.aud).toBe(audience);
  });

  test("payload carries the requested capability", async () => {
    const issuer   = await generateOperatorIdentity();
    const audience = (await generateOperatorIdentity()).did;
    const { payload } = await issueUcan({
      issuer, audience,
      resource: "automerge:abc123",
      ability:  "automerge/sync",
    });
    expect(payload.att[0]).toEqual({ with: "automerge:abc123", can: "automerge/sync" });
  });

  test("default TTL is in the future", async () => {
    const issuer   = await generateOperatorIdentity();
    const audience = (await generateOperatorIdentity()).did;
    const { payload } = await issueUcan({ issuer, audience, resource: "lararium:*", ability: "automerge/sync" });
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  test("custom ttlSeconds is respected", async () => {
    const issuer   = await generateOperatorIdentity();
    const audience = (await generateOperatorIdentity()).did;
    const before = Math.floor(Date.now() / 1000);
    const { payload } = await issueUcan({
      issuer, audience, resource: "lararium:*", ability: "automerge/sync",
      ttlSeconds: 60,
    });
    expect(payload.exp).toBeGreaterThanOrEqual(before + 59);
    expect(payload.exp).toBeLessThanOrEqual(before + 61);
  });
});

describe("verifyUcan", () => {
  test("valid token issued to self passes verification", async () => {
    const issuer = await generateOperatorIdentity();
    const { token } = await issueUcan({
      issuer, audience: issuer.did,
      resource: "lararium:*", ability: "automerge/sync",
    });
    const result = await verifyUcan(token, { audience: issuer.did, ability: "automerge/sync" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.iss).toBe(issuer.did);
  });

  test("valid token for specific resource passes capability check", async () => {
    const issuer   = await generateOperatorIdentity();
    const audience = (await generateOperatorIdentity()).did;
    const { token } = await issueUcan({
      issuer, audience,
      resource: "automerge:roomXYZ",
      ability:  "automerge/sync",
    });
    const result = await verifyUcan(token, { audience, resource: "automerge:roomXYZ", ability: "automerge/sync" });
    expect(result.ok).toBe(true);
  });

  test("lararium:* resource satisfies any resource check", async () => {
    const issuer   = await generateOperatorIdentity();
    const audience = (await generateOperatorIdentity()).did;
    const { token } = await issueUcan({ issuer, audience, resource: "lararium:*", ability: "automerge/sync" });
    const result = await verifyUcan(token, { audience, resource: "automerge:specificDoc" });
    expect(result.ok).toBe(true);
  });

  test("wrong audience is rejected", async () => {
    const issuer   = await generateOperatorIdentity();
    const audience = (await generateOperatorIdentity()).did;
    const other    = (await generateOperatorIdentity()).did;
    const { token } = await issueUcan({ issuer, audience, resource: "lararium:*", ability: "automerge/sync" });
    const result = await verifyUcan(token, { audience: other });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/audience-mismatch/);
  });

  test("tampered payload is rejected", async () => {
    const issuer = await generateOperatorIdentity();
    const { token } = await issueUcan({ issuer, audience: issuer.did, resource: "lararium:*", ability: "automerge/sync" });
    const [h, p, s] = token.split(".");
    const padded = p!.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(padded + "=".repeat((4 - padded.length % 4) % 4))) as { exp: number };
    payload.exp = Math.floor(Date.now() / 1000) + 99999;
    const tamperedP64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const tampered = `${h}.${tamperedP64}.${s}`;
    const result = await verifyUcan(tampered, { audience: issuer.did });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/signature-invalid/);
  });

  test("malformed token (wrong number of parts) is rejected", async () => {
    const result = await verifyUcan("not.a.valid.ucan.string", { audience: "did:key:z123" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/malformed/);
  });

  test("expired token is rejected", async () => {
    const issuer = await generateOperatorIdentity();
    const { token } = await issueUcan({
      issuer, audience: issuer.did,
      resource: "lararium:*", ability: "automerge/sync",
      ttlSeconds: -10, // already expired
    });
    const result = await verifyUcan(token, { audience: issuer.did });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/expired/);
  });

  test("unsatisfied capability is rejected", async () => {
    const issuer   = await generateOperatorIdentity();
    const audience = (await generateOperatorIdentity()).did;
    const { token } = await issueUcan({
      issuer, audience,
      resource: "automerge:docA",
      ability:  "automerge/sync",
    });
    const result = await verifyUcan(token, { audience, resource: "automerge:docB" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/capability-not-satisfied/);
  });
});

// ---------------------------------------------------------------------------
// UcanPeerRegistry
// ---------------------------------------------------------------------------

describe("UcanPeerRegistry", () => {
  test("registered peer is authorized", () => {
    const reg = new UcanPeerRegistry();
    const exp = Math.floor(Date.now() / 1000) + 3600;
    reg.registerPeer("peer:abc", "did:key:z123", exp);
    expect(reg.isAuthorized("peer:abc")).toBe(true);
  });

  test("unknown peer is not authorized", () => {
    const reg = new UcanPeerRegistry();
    expect(reg.isAuthorized("peer:unknown")).toBe(false);
  });

  test("expired peer is evicted and rejected", () => {
    const reg = new UcanPeerRegistry();
    const exp = Math.floor(Date.now() / 1000) - 1; // already expired
    reg.registerPeer("peer:expired", "did:key:z456", exp);
    expect(reg.isAuthorized("peer:expired")).toBe(false);
  });

  test("evictExpired removes stale entries", () => {
    const reg = new UcanPeerRegistry();
    const past = Math.floor(Date.now() / 1000) - 1;
    const future = Math.floor(Date.now() / 1000) + 3600;
    reg.registerPeer("peer:old",  "did:key:z1", past);
    reg.registerPeer("peer:live", "did:key:z2", future);
    reg.evictExpired();
    expect(reg.isAuthorized("peer:old")).toBe(false);
    expect(reg.isAuthorized("peer:live")).toBe(true);
  });
});
