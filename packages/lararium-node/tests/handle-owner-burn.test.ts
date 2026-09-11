/**
 * handle-owner-burn — the owner-burn hand resolves ONLY when the persona head is provably the root.
 *
 * The owning persona buries its face from above (Option C, path two) — a burn a thief-of-the-face cannot
 * forge. For a self-stood never-rotated persona the persona-KEL head op-key IS the root DID (ceremony seats
 * the founding op-key == root), so the root seed signs. A ROTATED persona's current op-key rides opt-in
 * self-custody this adapter does not reach, so the resolver FAILS CLOSED toward `--self` rather than guess.
 */
import { describe, test, expect } from "vitest";
import { resolveOwnerBurnHand } from "../src/commands/handle.js";
import * as ed from "@noble/ed25519";

const hexOf = (b: Uint8Array): string => Buffer.from(b).toString("hex");
const ROOT = new Uint8Array(32).fill(9);
const PREFIX = "persona-" + "ab".repeat(32);

describe("resolveOwnerBurnHand", () => {
  test("★ never-rotated (head == root DID) → the root seed signs the owner-burn ★", async () => {
    const rootDid = "0x" + hexOf(await ed.getPublicKeyAsync(ROOT));
    const r = await resolveOwnerBurnHand({ personaKelPrefix: PREFIX, headOpKeyDid: rootDid, rootSeed: ROOT });
    expect(r.ok, r.ok ? "" : r.reason).toBe(true);
    if (!r.ok) return;
    expect(r.ownerBurn.ownerAuthMemberPrefix).toBe(PREFIX);
    expect(r.ownerBurn.ownerAuthKeyDid.toLowerCase()).toBe(rootDid.toLowerCase());
    const msg = Uint8Array.from([1, 2, 3, 4]);
    const sig = await r.ownerBurn.sign(msg);
    expect(await ed.verifyAsync(Uint8Array.from(Buffer.from(sig, "hex")), msg, await ed.getPublicKeyAsync(ROOT)),
      "the resolved signer verifies as the persona root").toBe(true);
  });

  test("★ ROTATED (head != root) with NO custody → REFUSES, fail-closed toward --self ★", async () => {
    const otherDid = "0x" + hexOf(await ed.getPublicKeyAsync(new Uint8Array(32).fill(7)));
    const r = await resolveOwnerBurnHand({ personaKelPrefix: PREFIX, headOpKeyDid: otherDid, rootSeed: ROOT });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/rotated|--self/i);
  });

  test("★ ROTATED (head != root) with custody REACHABLE → the current op-key seed signs ★", async () => {
    // A persona rotated its op-key past the root; this replica HOLDS the current op-key seed.
    const CURRENT = new Uint8Array(32).fill(7);
    const currentDid = "0x" + hexOf(await ed.getPublicKeyAsync(CURRENT));
    // The custody resolver yields a signer for the head op-key it holds; null for anything it does not.
    const opKeyCustody = async (_prefix: string, headOpKeyDid: string) =>
      headOpKeyDid.toLowerCase() === currentDid.toLowerCase()
        ? async (b: Uint8Array) => hexOf(await ed.signAsync(b, CURRENT))
        : null;
    const r = await resolveOwnerBurnHand({ personaKelPrefix: PREFIX, headOpKeyDid: currentDid, rootSeed: ROOT, opKeyCustody });
    expect(r.ok, r.ok ? "" : r.reason).toBe(true);
    if (!r.ok) return;
    expect(r.ownerBurn.ownerAuthMemberPrefix).toBe(PREFIX);
    expect(r.ownerBurn.ownerAuthKeyDid.toLowerCase()).toBe(currentDid.toLowerCase());
    const msg = Uint8Array.from([5, 6, 7, 8]);
    const sig = await r.ownerBurn.sign(msg);
    expect(await ed.verifyAsync(Uint8Array.from(Buffer.from(sig, "hex")), msg, await ed.getPublicKeyAsync(CURRENT)),
      "the resolved signer verifies as the rotated CURRENT op-key, not the root").toBe(true);
  });

  test("★ ROTATED with custody that does NOT hold the head key → REFUSES (fail-closed) ★", async () => {
    const otherDid = "0x" + hexOf(await ed.getPublicKeyAsync(new Uint8Array(32).fill(7)));
    const opKeyCustody = async () => null;   // custody exists but holds nothing for this head
    const r = await resolveOwnerBurnHand({ personaKelPrefix: PREFIX, headOpKeyDid: otherDid, rootSeed: ROOT, opKeyCustody });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/rotated|--self|custody|unreachable/i);
  });

  test("★ unreachable head (null) → REFUSES, fail-closed ★", async () => {
    const r = await resolveOwnerBurnHand({ personaKelPrefix: PREFIX, headOpKeyDid: null, rootSeed: ROOT });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/unreachable|fail-closed|--self/i);
  });
});
