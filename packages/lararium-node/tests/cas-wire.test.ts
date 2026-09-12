/**
 * cas-wire.test.ts — WAVE 4: the cad wire consumer (E1b member-blind-transit) + the Kapae-Mu hop (E1a), over a
 * REAL request-response hop (the swappable MembershipChannel; the live-WS impl drops in behind the same interface).
 *
 * Proven:
 *   · E1b CARRY ⊥ READ over the hop — an admitted MEMBER carries the sealed ciphertext (verify-cap re-checked
 *     SECRET-FREE) and reads it with the per-body read-cap; a CARRY-ONLY peer (has the ciphertext, no read-cap)
 *     verifies but reads NOTHING; a NON-member draws Mu (no carry),
 *   · E1a KAPAE-MU byte-indistinguishability — a Kapae'd presenter and a NOTHING-TO-SERVE peer draw the IDENTICAL
 *     void bytes (denial ≡ satiety); an un_kapae restores the carry,
 *   · the antigen is QUORUM-consulted through the gate (a lone stub cannot fabricate a ban path here — the gate
 *     folds only what the AntigenRing surfaces, and the ring folds only quorum-verified bans in production).
 *
 * SURFACED (read-path, honest): the cad read-cap is MESSAGE-LOCKED (`readCap = BLAKE3(plaintext, secret)`) — a
 * confirmation-of-file convergent construction. So the keyring (per-Nexus secret) alone does NOT blind-read a
 * ciphertext-ONLY body; reading a body a member lacks the plaintext for needs the PER-BODY read-cap on the private
 * lane (the InstalledSealedBody.readCap here). The keyring re-derives the read-cap only WITH the plaintext (dedup /
 * confirmation, proven in keyring-delivery.test). The CARRY + Mu below hold regardless; the read uses the per-body cap.
 */
import { describe, test, expect } from "vitest";
import {
  DeterministicFederationGate, InMemoryMembershipChannel, openBodyOnCas, utf8Bytes,
} from "@lararium/mesh";
import { makeSealedPlaneRegistry } from "../src/plane-seal.js";
import { serveCasWire, decideAndServeWantBlock, fetchSealedCidOverWire, muWireBytes, type CasWireServerDeps } from "../src/cas-wire.js";
import { membershipOf, antigenOf, sealABody } from "./cas-test-setup.js";

const NEXUS_PUBKEY = "a1b2c3d4e5f6a7b8";
const HOLDER = "holder-vessel";
const BODY = utf8Bytes("the sealed carrier body a member blind-transits over the wire");

function serverDepsFor(reg: ReturnType<typeof makeSealedPlaneRegistry>, cadDir: string, members: string[], kapaed: string[]): CasWireServerDeps {
  return {
    cadDir,
    seal: reg.seal,
    membership: membershipOf(members),
    antigen: antigenOf(kapaed),
    fedGate: new DeterministicFederationGate(NEXUS_PUBKEY),   // the sealed docId falls outside → the member lane decides
  };
}

describe("cas-wire — E1b member-blind-transit (carry ⊥ read over the hop)", () => {
  test("an admitted MEMBER carries + reads; a carry-only peer verifies but reads nothing; a non-member draws Mu", async () => {
    const { registry, cadDir, installed, cleanup } = sealABody(BODY);
    try {
      const channel = new InMemoryMembershipChannel();
      const deps = serverDepsFor(registry, cadDir, ["member-peer"], []);

      // ── MEMBER: carries the ciphertext over the hop, verify-cap re-checked secret-free. ──
      const memberFetch = await fetchSealedCidOverWire({ channel, requester: "member-peer", serverAddr: HOLDER, cid: installed.cid, serverDeps: deps });
      expect(memberFetch.drewMu).toBe(false);
      expect(memberFetch.ciphertext).not.toBeNull();
      // …and READS it with the PER-BODY read-cap (the private-lane cap; the keyring alone is confirmation-only).
      expect([...openBodyOnCas(memberFetch.ciphertext!, installed.readCap)]).toEqual([...BODY]);

      // ── CARRY-ONLY: the same carried ciphertext, but NO read-cap → reads NOTHING (carry ⊥ read). ──
      const wrongCap = new Uint8Array(32).fill(9);
      expect([...openBodyOnCas(memberFetch.ciphertext!, wrongCap)]).not.toEqual([...BODY]);

      // ── NON-MEMBER: draws Mu — no carry (the member lane denies; the void ≡ satiety). ──
      const strangerFetch = await fetchSealedCidOverWire({ channel, requester: "stranger-peer", serverAddr: HOLDER, cid: installed.cid, serverDeps: deps });
      expect(strangerFetch.drewMu).toBe(true);
      expect(strangerFetch.ciphertext).toBeNull();
    } finally { cleanup(); }
  });

  test("a member carrying the ciphertext without the read-cap holds only ciphertext (verify-cap ⊥ read-cap)", async () => {
    const { registry, cadDir, installed, cleanup } = sealABody(BODY);
    try {
      const channel = new InMemoryMembershipChannel();
      const deps = serverDepsFor(registry, cadDir, ["member-peer"], []);
      const fetch = await fetchSealedCidOverWire({ channel, requester: "member-peer", serverAddr: HOLDER, cid: installed.cid, serverDeps: deps });
      // The carried bytes are CIPHERTEXT — not the plaintext. Carry never leaks read.
      expect(fetch.ciphertext).not.toBeNull();
      expect([...fetch.ciphertext!]).not.toEqual([...BODY]);
    } finally { cleanup(); }
  });
});

describe("cas-wire — E1a Kapae-Mu (denial ≡ satiety, byte-identical)", () => {
  test("a Kapae'd presenter and a nothing-to-serve peer draw IDENTICAL void bytes; un_kapae restores the carry", async () => {
    const { registry, cadDir, installed, cleanup } = sealABody(BODY);
    try {
      // "member-peer" is a MEMBER but Kapae'd; "member-2" is a clean member.
      const kapaedDeps = serverDepsFor(registry, cadDir, ["member-peer", "member-2"], ["member-peer"]);

      // A Kapae'd presenter asking for the held cid → Mu.
      const kapaedResp = await decideAndServeWantBlock(kapaedDeps, "member-peer", installed.cid);
      expect(kapaedResp.kind).toBe("cas-mu");
      // A clean member asking for an ABSENT cid (nothing to serve) → Mu.
      const nothingResp = await decideAndServeWantBlock(kapaedDeps, "member-2", "blake3:" + "00".repeat(32));
      expect(nothingResp.kind).toBe("cas-mu");
      // BYTE-IDENTICAL: denial ≡ satiety — the wire cannot tell "banned" from "nothing here".
      expect([...kapaedResp.bytes]).toEqual([...nothingResp.bytes]);
      expect([...kapaedResp.bytes]).toEqual([...muWireBytes()]);

      // A served body is naturally DIFFERENT bytes (indistinguishability is deny≡satiety, never deny≡success).
      const servedResp = await decideAndServeWantBlock(kapaedDeps, "member-2", installed.cid);
      expect(servedResp.kind).toBe("cas-block");

      // un_kapae: the presenter is no longer banned → it carries.
      const restoredDeps = serverDepsFor(registry, cadDir, ["member-peer", "member-2"], []);   // kapaed set now empty
      const restored = await decideAndServeWantBlock(restoredDeps, "member-peer", installed.cid);
      expect(restored.kind).toBe("cas-block");
    } finally { cleanup(); }
  });

  test("serveCasWire answers pending want-blocks over the channel (the real hop, deliver-once)", async () => {
    const { registry, cadDir, installed, cleanup } = sealABody(BODY);
    try {
      const channel = new InMemoryMembershipChannel();
      const deps = serverDepsFor(registry, cadDir, ["member-peer"], []);
      await channel.offer({ kind: "cas-want-block", from: "member-peer", to: HOLDER, payload: { cid: installed.cid } });
      const answered = await serveCasWire(channel, HOLDER, deps);
      expect(answered).toBe(1);
      const responses = await channel.poll("member-peer");
      expect(responses.some((e) => e.kind === "cas-block")).toBe(true);
    } finally { cleanup(); }
  });
});

// ── THE FETCH DOOR — the gate reads the FLEET class for a CLEARTEXT cid (basket-one #/the-fetch-door) ───────
// Socket B carries two kinds of cid. A `blake3:` cid rides the member lane above (sealed, carry ⊥ read). A bare
// sha256 cid names a CLEARTEXT `cid/` blob; ONLY a fleet peer (same operator, the vessel that dialed in under a
// signed device edge) may fetch it. A CONTRACT member asking a cleartext cid draws the same Mu a stranger draws.
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sha256HexBytesSync } from "@lararium/mesh";

describe("cas-wire — the fetch door: a cleartext cid answers a FLEET peer and draws Mu for everyone else", () => {
  const CLEAR = utf8Bytes("a family likeness, shared in the clear");
  const CLEAR_CID = sha256HexBytesSync(CLEAR);

  function fleetDeps(reg: ReturnType<typeof makeSealedPlaneRegistry>, cadDir: string, cidDir: string, fleet: string[], members: string[]): CasWireServerDeps {
    return { ...serverDepsFor(reg, cadDir, members, []), cidDir, fleet: (peer) => fleet.includes(peer) };
  }

  test("a FLEET peer fetches a cleartext cid; the bytes verify by sha256", async () => {
    const { registry, cadDir, cleanup } = sealABody(BODY);
    const cidDir = mkdtempSync(join(tmpdir(), "cid-"));
    writeFileSync(join(cidDir, CLEAR_CID), CLEAR);
    try {
      const channel = new InMemoryMembershipChannel();
      const deps = fleetDeps(registry, cadDir, cidDir, ["fleet-B"], ["member-peer"]);
      const r = await decideAndServeWantBlock(deps, "fleet-B", CLEAR_CID);
      expect(r.kind).toBe("cas-block");
      expect([...r.bytes]).toEqual([...CLEAR]);
      const fetched = await fetchSealedCidOverWire({ channel, requester: "fleet-B", serverAddr: HOLDER, cid: CLEAR_CID, serverDeps: deps });
      expect(fetched.drewMu).toBe(false);
      expect([...(fetched.ciphertext ?? [])]).toEqual([...CLEAR]);
    } finally { cleanup(); rmSync(cidDir, { recursive: true, force: true }); }
  });

  test("CONTROL: a CONTRACT member asking a cleartext cid draws Mu — byte-identical to a stranger's", async () => {
    const { registry, cadDir, installed, cleanup } = sealABody(BODY);
    const cidDir = mkdtempSync(join(tmpdir(), "cid-"));
    writeFileSync(join(cidDir, CLEAR_CID), CLEAR);
    try {
      const deps = fleetDeps(registry, cadDir, cidDir, ["fleet-B"], ["member-peer"]);
      const member   = await decideAndServeWantBlock(deps, "member-peer",   CLEAR_CID);
      const stranger = await decideAndServeWantBlock(deps, "stranger-peer", CLEAR_CID);
      expect(member.kind).toBe("cas-mu");
      expect(stranger.kind).toBe("cas-mu");
      expect([...member.bytes]).toEqual([...stranger.bytes]);
      // …while the SAME member still carries the SEALED body over the member lane (the lanes stay two).
      const sealedAsk = await decideAndServeWantBlock(deps, "member-peer", installed.cid);
      expect(sealedAsk.kind).toBe("cas-block");
    } finally { cleanup(); rmSync(cidDir, { recursive: true, force: true }); }
  });

  test("CONTROL: no cidDir / no fleet predicate → a cleartext ask draws Mu (fail-closed, the door stays shut)", async () => {
    const { registry, cadDir, cleanup } = sealABody(BODY);
    try {
      const deps = serverDepsFor(registry, cadDir, ["fleet-B"], []);
      expect((await decideAndServeWantBlock(deps, "fleet-B", CLEAR_CID)).kind).toBe("cas-mu");
    } finally { cleanup(); }
  });
});
