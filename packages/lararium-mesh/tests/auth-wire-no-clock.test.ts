/**
 * auth-wire-no-clock — no wall clock rides the auth wire.
 *
 * The gate's single-use nonce carries a proof's freshness; nothing on the wire reads a timestamp. A `ts` the
 * peer signs and no verifier reads is a global now on the wire, so the proof bytes, the `lar:auth` message
 * and the proof the gate relays to its keyholder carry none, and the verifier takes no clock.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/auth-wire
 */
import { describe, expect, test } from "vitest";
import * as ed25519 from "@noble/ed25519";
import * as authWire from "../src/auth-wire.js";
import { authProofBytes, verifyAuthProof, buildAuthResponse, runPeerHandshake, mkLarChallenge } from "../src/auth-wire.js";
import { hex } from "../src/crypto.js";

const seed = new Uint8Array(32).fill(7);
const base = { nonce: "ab".repeat(32), gatePubKey: "11".repeat(32), aud: "lar:///ha.ka.ba/bags/daemon" };

describe("the auth wire carries no clock", () => {
  test("RED: the proof bytes name no timestamp, whatever a caller hands in", async () => {
    const peerPubKey = hex(await ed25519.getPublicKeyAsync(seed));
    const handed = { ...base, peerPubKey, ts: "2026-10-07T00:00:00Z" } as unknown as Parameters<typeof authProofBytes>[0];
    const decoded = JSON.parse(new TextDecoder().decode(authProofBytes(handed))) as Record<string, unknown>;
    expect(Object.keys(decoded).sort()).toEqual(["aud", "domain", "gatePubKey", "nonce", "peerPubKey"]);
  });

  test("RED: a built lar:auth carries no `ts`, and no freshness window is exported", async () => {
    const peerPubKey = hex(await ed25519.getPublicKeyAsync(seed));
    const msg = await buildAuthResponse({
      ...base, contactCard: "{}", peerPubKey, leafNonce: "cd".repeat(32),
      sign: async (b) => hex(await ed25519.signAsync(b, seed)),
    } as Parameters<typeof buildAuthResponse>[0]);
    expect("ts" in msg).toBe(false);
    expect("AUTH_PROOF_TTL_MS" in authWire).toBe(false);
  });

  test("RED: the handshake sends no timestamp", async () => {
    const peerPubKey = hex(await ed25519.getPublicKeyAsync(seed));
    const sent: unknown[] = [];
    const frames: unknown[] = [mkLarChallenge(base.nonce)];
    await runPeerHandshake({
      recv: async () => frames.shift(), send: (m) => { sent.push(m); },
      contactCard: "{}", peerPubKey, gatePubKey: base.gatePubKey, aud: base.aud,
      sign: async (b) => hex(await ed25519.signAsync(b, seed)),
    });
    expect(sent).toHaveLength(1);
    expect("ts" in (sent[0] as Record<string, unknown>)).toBe(false);
  });

  test("CONTROL: a proof over the clockless bytes verifies, and one over another nonce does not", async () => {
    const peerPubKey = hex(await ed25519.getPublicKeyAsync(seed));
    const parts = { ...base, peerPubKey } as Parameters<typeof authProofBytes>[0];
    const sig = hex(await ed25519.signAsync(authProofBytes(parts), seed));
    expect((await verifyAuthProof({ ...parts, sig } as Parameters<typeof verifyAuthProof>[0])).ok).toBe(true);
    expect((await verifyAuthProof({ ...parts, nonce: "ef".repeat(32), sig } as Parameters<typeof verifyAuthProof>[0])).ok).toBe(false);
  });
});
