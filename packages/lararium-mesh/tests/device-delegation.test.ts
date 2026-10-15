import { describe, it, expect } from "vitest";
import * as ed25519 from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import {
  buildDeviceDelegation,
  verifyDeviceDelegation,
  evaluateDeviceDelegation,
  type DeviceDelegationTiddler,
} from "../src/device-delegation.js";

const opSeed  = new Uint8Array(32).fill(7);
const devSeed = new Uint8Array(32).fill(9);
const PLACE   = "bafkreic7r3jrao44srh5bp47uryotaqp62bnmovzpqccbfy2kclf447bra";

const vkOf = async (s: Uint8Array): Promise<string> => hex(await ed25519.getPublicKeyAsync(s));
const opDidP = vkOf(opSeed).then((vk) => `0x${vk}`);

async function mint(boundEpoch = 5): Promise<DeviceDelegationTiddler> {
  return buildDeviceDelegation({
    personaRootSeed: opSeed,
    deviceVerifyingKey: await vkOf(devSeed),
    hearthTrueName: PLACE,
    boundEpoch,
  });
}

describe("device-delegation — the signed capability edge (v2, post-verification)", () => {
  it("returns relation-scoped evidence for checked, unavailable, stale, malformed, and rejected edges", async () => {
    const edge = await mint(5);
    const root = await opDidP;
    expect(await evaluateDeviceDelegation(edge, root, { expectedEpoch: 5 })).toMatchObject({
      relation: "device-face-delegation", state: "checked-valid", cryptographicallyValid: true,
    });
    expect(await evaluateDeviceDelegation(edge, root)).toMatchObject({
      relation: "device-face-delegation", state: "unavailable", cryptographicallyValid: true,
    });
    expect(await evaluateDeviceDelegation(edge, root, { expectedEpoch: 6 })).toMatchObject({
      relation: "device-face-delegation", state: "stale", cryptographicallyValid: false,
    });
    expect(await evaluateDeviceDelegation({ ...edge, signature: "deadbeef" }, root)).toMatchObject({
      relation: "device-face-delegation", state: "malformed", cryptographicallyValid: false,
    });
    expect(await evaluateDeviceDelegation(edge, `0x${"ff".repeat(32)}`)).toMatchObject({
      relation: "device-face-delegation", state: "rejected", cryptographicallyValid: false,
    });
  });

  it("builds + verifies against the pinned root", async () => {
    const edge = await mint();
    expect(edge.kind).toBe("device-delegation");
    expect((await verifyDeviceDelegation(edge, await opDidP)).ok).toBe(true);
  });

  it("enforces the operator-root PIN — a self-consistent attacker edge is rejected", async () => {
    // attacker mints their OWN edge under their OWN root: internally valid, but not the pin.
    const attackerSeed = new Uint8Array(32).fill(13);
    const attackerEdge = await buildDeviceDelegation({
      personaRootSeed: attackerSeed, deviceVerifyingKey: await vkOf(devSeed), hearthTrueName: PLACE, boundEpoch: 5,
    });
    const res = await verifyDeviceDelegation(attackerEdge, await opDidP); // pin = the REAL operator
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/pinned root/);
  });

  it("rejects a tampered deviceVerifyingKey", async () => {
    const edge = await mint();
    const otherVk = await vkOf(new Uint8Array(32).fill(11));
    expect((await verifyDeviceDelegation({ ...edge, deviceVerifyingKey: otherVk, deviceDid: `0x${otherVk}` }, await opDidP)).ok).toBe(false);
  });

  it("rejects a tampered hearthTrueName (signature mismatch)", async () => {
    const edge = await mint();
    expect((await verifyDeviceDelegation({ ...edge, hearthTrueName: "bafotherplace" }, await opDidP)).ok).toBe(false);
  });

  it("rejects a deviceDid not bound to its verifying key", async () => {
    const edge = await mint();
    const res = await verifyDeviceDelegation({ ...edge, deviceDid: `0x${"ff".repeat(32)}` }, await opDidP);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/deviceDid/);
  });

  it("NEVER throws on malformed/undefined fields (untrusted CRDT input)", async () => {
    const edge = await mint();
    // personaRootDid undefined would have thrown in v1 (startsWith on non-string) — must now fail loud.
    await expect(verifyDeviceDelegation({ ...edge, personaRootDid: undefined as unknown as string }, await opDidP)).resolves.toMatchObject({ ok: false });
    await expect(verifyDeviceDelegation({ ...edge, signature: "deadbeef" }, await opDidP)).resolves.toMatchObject({ ok: false });
    await expect(verifyDeviceDelegation({ ...edge, boundEpoch: 12345 as unknown as string }, await opDidP)).resolves.toMatchObject({ ok: false });
  });

  it("rejects non-canonical personaRootDid (no 0x / uppercase)", async () => {
    const edge = await mint();
    const vkUpper = (await vkOf(opSeed)).toUpperCase();
    expect((await verifyDeviceDelegation({ ...edge, personaRootDid: vkUpper }, await opDidP)).ok).toBe(false); // missing 0x
    expect((await verifyDeviceDelegation({ ...edge, personaRootDid: `0x${vkUpper}` }, await opDidP)).ok).toBe(false); // uppercase
  });

  it("rejects an edge with an illegal-character hearthTrueName at mint", async () => {
    await expect(buildDeviceDelegation({
      personaRootSeed: opSeed, deviceVerifyingKey: await vkOf(devSeed), hearthTrueName: "evil|injection", boundEpoch: 5,
    })).rejects.toThrow(/hearthTrueName/);
  });

  it("enforces the LEASE epoch when `expectedEpoch` is supplied (non-renewal)", async () => {
    const edge = await mint(5);  // grant binds to lease epoch 5
    // fresh — the resource's epoch has not rolled past 5
    expect((await verifyDeviceDelegation(edge, await opDidP, { expectedEpoch: 5 })).ok).toBe(true);
    expect((await verifyDeviceDelegation(edge, await opDidP, { expectedEpoch: 3 })).ok).toBe(true);
    // stale — the resource rolled to 6; the grant must re-mint or expire
    const stale = await verifyDeviceDelegation(edge, await opDidP, { expectedEpoch: 6 });
    expect(stale.ok).toBe(false);
    expect(stale.reason).toMatch(/lease stale/);
    // omitting expectedEpoch leaves the lease unenforced (signature + pin only) — single-vessel/pure-crypto path
    expect((await verifyDeviceDelegation(edge, await opDidP)).ok).toBe(true);
  });

  it("rejects a forged boundEpoch (signature mismatch — can't outlive a roll by editing the field)", async () => {
    const edge = await mint(5);
    expect((await verifyDeviceDelegation({ ...edge, boundEpoch: "999" }, await opDidP)).ok).toBe(false);
  });

  // ── NO GLOBAL NOW ON THE EDGE ──────────────────────────────────────────────────────────────────────────
  // The edge decays by its lease (`boundEpoch` against the resource's max-register) and is revoked by the
  // membership graph; no wall-clock rides in its fields or its signed bytes.
  const CLOCK_KEY = /^(issuedAt|expiresAt|timestamp|createdAt|notBefore|notAfter|exp|iat|nbf)$/i;
  const clockKeys = (v: unknown, path = ""): string[] =>
    v === null || typeof v !== "object" ? [] : Object.entries(v as Record<string, unknown>).flatMap(([k, x]) =>
      [...(CLOCK_KEY.test(k) ? [`${path}${k}`] : []), ...clockKeys(x, `${path}${k}.`)]);

  it("★ the edge carries no clock field — the lease is its only decay ★", async () => {
    const edge = await mint(5);
    expect(clockKeys(edge)).toEqual([]);
    expect(Object.keys(edge).sort()).toEqual(
      ["boundEpoch", "deviceDid", "deviceVerifyingKey", "hearthTrueName", "kind", "personaRootDid", "signature"]);
  });

  it("CONTROL: the clock scan finds a planted stamp, and the lease still fences a rolled epoch", async () => {
    const edge = await mint(5);
    expect(clockKeys({ ...edge, nested: { issuedAt: "x" } })).toContain("nested.issuedAt");
    expect((await verifyDeviceDelegation(edge, await opDidP, { expectedEpoch: 6 })).ok).toBe(false);
    expect((await verifyDeviceDelegation(edge, await opDidP, { expectedEpoch: 5 })).ok).toBe(true);
  });

  it("two mints of one binding at one lease agree byte-for-byte — nothing instant-bound rides the edge", async () => {
    expect(await mint(5)).toEqual(await mint(5));
  });

  it("rejects a non-numeric boundEpoch at mint", async () => {
    await expect(buildDeviceDelegation({
      personaRootSeed: opSeed, deviceVerifyingKey: await vkOf(devSeed), hearthTrueName: PLACE, boundEpoch: -1,
    })).rejects.toThrow(/boundEpoch/);
  });
});
