/**
 * auth-proof-domain — the V3 proof of possession signs inside a NAMED domain.
 *
 * A signature means nothing without the purpose it was made for. A version digit separates nothing from
 * a second protocol that happens to spell the same canonical JSON, so the proof commits to a NAME —
 * `AUTH_PROOF_DOMAIN` — and bytes signed for any other purpose, or for none, never clear `verifyAuthProof`.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/auth-wire
 */
import { describe, expect, test } from "vitest";
import * as ed25519 from "@noble/ed25519";
import {
  authProofBytes, verifyAuthProof, buildAuthResponse,
  mkLarChallenge, mkLarAuth, mkLarAuthOk,
} from "../src/auth-wire.js";
import { AUTH_PROOF_DOMAIN, ALL_DOMAINS, DOMAIN_ROOT } from "../src/domains.js";
import { canonicalJsonBytes, hex } from "../src/crypto.js";

const seed = new Uint8Array(32).fill(9);
const parts = {
  nonce:      "ab12cd",
  gatePubKey: "11".repeat(32),
  aud:        "lar:///ha.ka.ba/bags/daemon",
  ts:         "2026-06-07T00:00:00Z",
};

async function keyed() {
  const peerPubKey = hex(await ed25519.getPublicKeyAsync(seed));
  return { ...parts, peerPubKey };
}

describe("the auth proof signs inside its own domain", () => {
  test("the domain is registered, under the root, and carries no version suffix", () => {
    expect(ALL_DOMAINS).toContain(AUTH_PROOF_DOMAIN);
    expect(AUTH_PROOF_DOMAIN).toBe(`${DOMAIN_ROOT}/auth-proof`);
    expect(AUTH_PROOF_DOMAIN).not.toMatch(/\/v\d+$/);
  });

  test("the signed bytes commit to the domain and to no version", () => {
    const decoded = JSON.parse(new TextDecoder().decode(authProofBytes({ ...parts, peerPubKey: "pk" }))) as Record<string, unknown>;
    expect(decoded["domain"]).toBe(AUTH_PROOF_DOMAIN);
    expect("v" in decoded).toBe(false);
  });

  test("CONTROL: a well-formed proof verifies", async () => {
    const p = await keyed();
    const sig = hex(await ed25519.signAsync(authProofBytes(p), seed));
    expect(await verifyAuthProof({ ...p, sig })).toEqual({ ok: true });
  });

  test("RED: a proof signed WITHOUT the domain fails to verify", async () => {
    const p = await keyed();
    // The same fields, the same key, the same canonical encoding — every byte but the domain.
    const bare = canonicalJsonBytes({ nonce: p.nonce, gatePubKey: p.gatePubKey, peerPubKey: p.peerPubKey, aud: p.aud, ts: p.ts });
    const sig = hex(await ed25519.signAsync(bare, seed));
    expect((await verifyAuthProof({ ...p, sig })).ok).toBe(false);
  });

  test("RED: a proof signed under the retired version separator fails to verify", async () => {
    const p = await keyed();
    const legacy = canonicalJsonBytes({ v: "1", nonce: p.nonce, gatePubKey: p.gatePubKey, peerPubKey: p.peerPubKey, aud: p.aud, ts: p.ts });
    const sig = hex(await ed25519.signAsync(legacy, seed));
    expect((await verifyAuthProof({ ...p, sig })).ok).toBe(false);
  });

  test("RED: a proof signed under ANOTHER registered domain fails to verify", async () => {
    const p = await keyed();
    const foreign = ALL_DOMAINS.find((dm) => dm !== AUTH_PROOF_DOMAIN)!;
    const other = canonicalJsonBytes({ domain: foreign, nonce: p.nonce, gatePubKey: p.gatePubKey, peerPubKey: p.peerPubKey, aud: p.aud, ts: p.ts });
    const sig = hex(await ed25519.signAsync(other, seed));
    expect((await verifyAuthProof({ ...p, sig })).ok).toBe(false);
  });
});

describe("the auth wire messages carry no version", () => {
  test("no constructor stamps a version field", async () => {
    const msgs: object[] = [
      mkLarChallenge("n"), mkLarAuth("card", "n", "s", "ab".repeat(32)), mkLarAuthOk("s"),
      await buildAuthResponse({ ...(await keyed()), contactCard: "card", leafNonce: "ab".repeat(32), sign: () => "x" }),
    ];
    for (const m of msgs) expect("version" in m, JSON.stringify(m)).toBe(false);
  });
});
