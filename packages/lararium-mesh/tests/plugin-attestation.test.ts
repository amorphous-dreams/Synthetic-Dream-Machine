/**
 * plugin-attestation — the builder's signature over a plugin build, and what a reader may conclude without it.
 *
 * An attestation's hashes bind BYTES excellently and PROVENANCE not at all: anyone who writes the file writes
 * the digests to match whatever they shipped. The signature names who stood behind the build — the one thing a
 * reader could not have recomputed alone. These pin that, and pin the refusals beside it: no clock, no
 * reachable builder, and UNSIGNED reported as its own answer rather than folded into "invalid".
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/genesis-doc
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  PLUGIN_ATTESTATION_DOMAIN, pluginAttestationBytes, signPluginAttestation, verifyPluginAttestation,
  type PluginBuildAttestation,
} from "../src/genesis-doc.js";
import { hex, hexToBytes } from "../src/crypto.js";

const seedOf = (n: number) => new Uint8Array(32).fill(n);
const signer = (s: Uint8Array) => (b: Uint8Array) => ed.signAsync(b, s).then(hex);
const pubOf  = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const verify = (b: Uint8Array, sig: string, signerHex: string) =>
  ed.verifyAsync(hexToBytes(sig), b, hexToBytes(signerHex)).catch(() => false);

/** A build the pipeline would emit — every digest present, nobody standing behind it yet. */
const BUILD: Omit<PluginBuildAttestation, "builder"> = {
  format:               "lararium-tw5-plugin-build/v1",
  canonicalTitle:       "$:/plugins/lares/memetic-wikitext",
  moduleManifestPath:   "dist-plugin/module-manifest.json",
  moduleManifestSha256: "a".repeat(64),
  packTranscriptPath:   "dist-plugin/pack-transcript.json",
  packTranscriptSha256: "b".repeat(64),
  moduleCount:          23,
  packedTiddlerCount:   115,
  pluginJsonSha256:     "c".repeat(64),
};

describe("the signature names who stood behind the build", () => {
  test("★ a signed attestation reads back its signer, OFFLINE — no reachable builder, no clock ★", async () => {
    const key = await pubOf(seedOf(7));
    const signed = await signPluginAttestation(BUILD, key, signer(seedOf(7)));
    expect(await verifyPluginAttestation(signed, verify)).toEqual({ signer: key });
  });

  test("★ UNSIGNED reads as its own answer, never as invalid ★", async () => {
    // An unsigned build still carries usable diff handles. Folding it into "forged" would make the
    // reader's policy unstatable — they could no longer tell "nobody signed" from "someone lied".
    expect(await verifyPluginAttestation(BUILD as PluginBuildAttestation, verify)).toBe("unsigned");
  });

  test("a FORGED signature reads forged — and the read still returns rather than throwing", async () => {
    const key = await pubOf(seedOf(7));
    const forged: PluginBuildAttestation = { ...BUILD, builder: { signer: key, sig: "00".repeat(64) } };
    expect(await verifyPluginAttestation(forged, verify)).toBe("forged");
  });

  test("★ a TAMPERED digest breaks the signature — the hashes ride INSIDE the signed bytes ★", async () => {
    // The whole point: a builder who swaps the shipped blob must also swap a digest, and that moves the
    // preimage. A signature beside the digests rather than over them would certify nothing.
    const signed = await signPluginAttestation(BUILD, await pubOf(seedOf(7)), signer(seedOf(7)));
    const tampered: PluginBuildAttestation = { ...signed, pluginJsonSha256: "d".repeat(64) };
    expect(await verifyPluginAttestation(tampered, verify)).toBe("forged");
  });

  test("a signature by ANOTHER key reads forged — the signer field never speaks for itself", async () => {
    const signed = await signPluginAttestation(BUILD, await pubOf(seedOf(7)), signer(seedOf(7)));
    const swapped: PluginBuildAttestation = {
      ...signed, builder: { signer: await pubOf(seedOf(9)), sig: signed.builder!.sig },
    };
    expect(await verifyPluginAttestation(swapped, verify)).toBe("forged");
  });
});

describe("the signed bytes carry the domain and every field they claim to cover", () => {
  test("★ the preimage names its DOMAIN — a signature means nothing without the domain it was made in ★", async () => {
    const parsed = JSON.parse(new TextDecoder().decode(pluginAttestationBytes(BUILD)));
    expect(parsed.domain).toBe(PLUGIN_ATTESTATION_DOMAIN);
  });

  test("the preimage covers every attestation field, and carries no signature over itself", async () => {
    const parsed = JSON.parse(new TextDecoder().decode(pluginAttestationBytes(BUILD)));
    for (const k of Object.keys(BUILD)) expect(parsed).toHaveProperty(k);
    expect(parsed).not.toHaveProperty("builder");
  });

  test("the bytes stay canonical — key order at the call site never moves the signature", async () => {
    const reordered = { pluginJsonSha256: BUILD.pluginJsonSha256, ...BUILD };
    expect(pluginAttestationBytes(reordered)).toEqual(pluginAttestationBytes(BUILD));
  });

  test("★ NO clock rides the preimage — a build verifies in a mesh cut off for five hundred years ★", async () => {
    const wire = new TextDecoder().decode(pluginAttestationBytes(BUILD));
    expect(wire).not.toMatch(/\b(timestamp|issuedAt|expiresAt|notBefore|notAfter|builtAt)\b/);
  });
});

/**
 * THE BUILD MUST READ THE HALF THAT CANNOT BE FORGED BY WHOEVER WROTE THE FILE.
 *
 * `verifyPluginAttestation`'s own doc names the threat exactly: "The hashes here bind BYTES excellently
 * and bind PROVENANCE not at all — anyone who can write the file can write the digests to match whatever
 * they shipped. The signature names WHO stood behind the build, which is the only thing a reader could
 * not have recomputed for themselves."
 *
 * The genesis build read that attestation and checked ONE thing: `pluginJsonSha256 !== sha`. That is
 * precisely the half the doc says proves nothing — a tampered attestation whose sha was rewritten to match
 * a swapped plugin passes it, untouched signature or none at all. The verify that reads the other half sat
 * fully tested and reached by nobody.
 *
 * It REPORTS and never refuses, by design: "whether an unsigned or foreign-signed build may seed a hearth
 * stays the reader's policy, because a rule baked here would decide every operator's trust from one seat."
 * So the build SAYS what it found and leaves the ruling to the operator.
 */
describe("what the genesis build reads off an attestation", () => {
  const SCRIPT = () => readFileSync(
    join(import.meta.dirname, "..", "..", "lararium-node", "scripts", "build-genesis-island.ts"), "utf8");

  test("★ the build reads PROVENANCE, not only the hash it could have recomputed itself ★", () => {
    const code = SCRIPT().split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    expect(code, "the build still checks only the sha — the half anyone who writes the file can match")
      .toMatch(/verifyPluginAttestation\(/);
  });

  test("CONTROL — it still ABORTS on a sha mismatch, so the new read added a check and removed none", () => {
    const code = SCRIPT();
    expect(code).toMatch(/plugin attestation sha mismatch/);
  });

  test("CONTROL — the verify REPORTS and never refuses, so a build policy stays the operator's", async () => {
    const unsigned = { format: "lar-plugin-build/v1", pluginJsonSha256: "aa", moduleCount: 1, moduleManifestSha256: "bb" };
    await expect(verifyPluginAttestation(unsigned as never, async () => true)).resolves.toBe("unsigned");
    const signed = { ...unsigned, builder: { signer: "cc", sig: "dd" } };
    await expect(verifyPluginAttestation(signed as never, async () => false)).resolves.toBe("forged");
  });
});
