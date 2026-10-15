/**
 * ed25519-door-node.test — the node package verifies through the mesh package's one strict Ed25519 door.
 *
 * `verifyNymSignature` reads a recogniser's grant at the live door, and the cabal and edge commands read
 * vouches and edge acts through the same door. The torsion hand (`lararium-mesh/tests/ed25519-torsion.ts`)
 * signs what both curve libraries read true and the door refuses; the identity key holds no secret at all.
 * The mesh census (`ed25519-door-census.test.ts`) reads this package's source, so a direct curve-library
 * verify in any command reads red there.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { hex, hexToBytes, verifyEd25519 } from "@lararium/mesh";
import { verifyNymSignature } from "../src/vessel-raise.js";
import { IDENTITY_KEY, NOBODYS_SIGNATURE, torsionHand } from "../../lararium-mesh/tests/ed25519-torsion.js";

const BYTES = new TextEncoder().encode("a raise challenge");
const SEED = new Uint8Array(32).fill(9);

describe("verifyNymSignature reads the strict door", () => {
  test("CONTROL: an honest nym's signature verifies, bare or 0x-prefixed", async () => {
    const nym = hex(await ed.getPublicKeyAsync(SEED)), sig = hex(await ed.signAsync(BYTES, SEED));
    expect(await verifyNymSignature(nym, BYTES, sig)).toBe(true);
    expect(await verifyNymSignature(`0x${nym}`, BYTES, sig)).toBe(true);
  });
  test("a signature only a lenient verifier reads verifies for nobody", async () => {
    const hand = torsionHand(9), sig = await hand.sign(BYTES);
    expect(await ed.verifyAsync(hexToBytes(sig), BYTES, hexToBytes(hand.key))).toBe(true);    // KNOWN POSITIVE: the library default
    expect(await verifyNymSignature(hand.key, BYTES, sig)).toBe(false);
  });
  test("nobody signs for a small-order nym", async () => {
    expect(await ed.verifyAsync(hexToBytes(NOBODYS_SIGNATURE), BYTES, hexToBytes(IDENTITY_KEY))).toBe(true);   // KNOWN POSITIVE
    expect(await verifyNymSignature(IDENTITY_KEY, BYTES, NOBODYS_SIGNATURE)).toBe(false);
  });
  test("a hostile value never throws", async () => {
    expect(await verifyNymSignature("zz", BYTES, "zz")).toBe(false);
    expect(await verifyNymSignature(undefined as unknown as string, BYTES, NOBODYS_SIGNATURE)).toBe(false);
  });
});

describe("the commands' verifiers hand the door their hex unread", () => {
  // Each command builds one verifier closure and injects it into the mesh fold. The closure passes the hex
  // strings straight to the door, which reads lower-case hex alone and never throws.
  const COMMANDS = ["cabal-join.ts", "cabal-vouch.ts"];
  test.each(COMMANDS)("%s", (file) => {
    const source = readFileSync(join(import.meta.dirname, "..", "src", "commands", file), "utf8");
    expect(source).toMatch(/Promise\.resolve\(verifyEd25519\(sigHex, bytes, \w+\)\)/);
    expect(source).toMatch(/import \{[^}]*\bverifyEd25519\b[^}]*\} from "@lararium\/mesh";/);   // the door, by name
    expect(source).not.toMatch(/@noble\//);                                                     // and no curve library at all
  });
  test("the edge doors hold no verifier of their own: the mesh fold reads each signature through the door", () => {
    for (const file of ["edge-kapae-cmd.ts", "edge-roll-anchor.ts"]) {
      const source = readFileSync(join(import.meta.dirname, "..", "src", "commands", file), "utf8");
      expect(source, file).not.toMatch(/@noble\//);
      expect(source, file).not.toMatch(/\bverify\w*\s*[:=]\s*\(/);     // no verifier closure built here
    }
    const fold = readFileSync(join(import.meta.dirname, "..", "..", "lararium-mesh", "src", "edge-kapae.ts"), "utf8");
    expect(fold).toMatch(/import \{ verifyEd25519 \} from "\.\/ed25519-door\.js";/);
  });
  test("the door they call refuses the torsion hand", async () => {
    const hand = torsionHand(3);
    expect(verifyEd25519(await hand.sign(BYTES), BYTES, hand.key)).toBe(false);
  });
});
