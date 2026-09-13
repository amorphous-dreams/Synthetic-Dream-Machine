/**
 * THE OFFERING — one operator publishing their own collection, and why it needs no second hand.
 *
 * `pluginsCid` folds THIS operator's collection. Publishing it is a GIFT: a taker verifies the blobs BY
 * HASH against the declared region, so nothing stands for a co-signer to attest that the hash does not
 * already settle. One signature, one announce, no steward set (operator ruling).
 *
 * That reasoning only holds if the verify ACTUALLY RECOMPUTES the region. A verify that checked the
 * signature alone would let a signed offering declare one region and carry another's blobs — the offeror
 * attesting bytes nobody folded, which is exactly the second-hand problem the hash was supposed to retire.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { computePluginsCid } from "../src/genesis-doc.js";
import {
  pluginOfferingBytes, signPluginOffering, verifyPluginOffering, type OfferedBlob,
} from "../src/plugin-offering.js";
import { PLUGIN_OFFERING_DOMAIN } from "../src/domains.js";

const SEED = new Uint8Array(32).fill(21);
const signer = async (bytes: Uint8Array): Promise<string> => hex(await ed.signAsync(bytes, SEED));
const offerorKey = async (): Promise<string> => hex(await ed.getPublicKeyAsync(SEED));

const BLOBS: readonly OfferedBlob[] = [
  { id: "$:/plugins/sq/streams", version: "1.2.0", sha256: "aa".repeat(32) },
  { id: "$:/plugins/joe/notes",  version: "0.4.1", sha256: "bb".repeat(32) },
];

describe("a plugin offering", () => {
  test("★ a taker VERIFIES the blobs against the declared region — the hash is what a co-signer would have attested ★", async () => {
    const offering = await signPluginOffering(
      { offeror: await offerorKey(), pluginsCid: computePluginsCid(BLOBS), blobs: BLOBS }, signer);
    expect(offering.kind).toBe(PLUGIN_OFFERING_DOMAIN);
    await expect(verifyPluginOffering(offering)).resolves.toEqual({ ok: true });
  });

  test("★ a SIGNED offering whose blobs fold elsewhere REFUSES — the signature never stands in for the fold ★", async () => {
    const honest = await signPluginOffering(
      { offeror: await offerorKey(), pluginsCid: computePluginsCid(BLOBS), blobs: BLOBS }, signer);
    // The offeror swaps one blob AFTER declaring the region, then re-signs: a perfectly valid signature
    // over a body whose blobs no longer fold to what it declares.
    const swapped = [{ ...BLOBS[0]!, sha256: "cc".repeat(32) }, BLOBS[1]!];
    const forged = await signPluginOffering(
      { offeror: await offerorKey(), pluginsCid: honest.pluginsCid, blobs: swapped }, signer);
    const verdict = await verifyPluginOffering(forged);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toMatch(/region|fold|cid/i);
  });

  test("a TAMPERED signature refuses, and the bytes are what got signed", async () => {
    const offering = await signPluginOffering(
      { offeror: await offerorKey(), pluginsCid: computePluginsCid(BLOBS), blobs: BLOBS }, signer);
    const tampered = { ...offering, sig: "00".repeat(64) };
    expect((await verifyPluginOffering(tampered)).ok).toBe(false);
    // CONTROL — the preimage covers the region AND the blobs, so neither moves unnoticed.
    const a = pluginOfferingBytes({ offeror: offering.offeror, pluginsCid: offering.pluginsCid, blobs: BLOBS });
    const b = pluginOfferingBytes({ offeror: offering.offeror, pluginsCid: "bafyOTHER", blobs: BLOBS });
    expect(hex(a)).not.toBe(hex(b));
  });

  test("★ an offering names ONE offeror and carries ONE signature — a gift, never a quorum act ★", async () => {
    const offering = await signPluginOffering(
      { offeror: await offerorKey(), pluginsCid: computePluginsCid(BLOBS), blobs: BLOBS }, signer);
    // The shape itself refuses a steward set: there is no field for one, and adding a second hand would
    // make a gift into a collective act.
    expect(Object.keys(offering).sort()).toEqual(["blobs", "kind", "offeror", "pluginsCid", "sig"]);
  });

  test("CONTROL — an EMPTY collection still offers honestly (an operator may publish nothing)", async () => {
    const offering = await signPluginOffering(
      { offeror: await offerorKey(), pluginsCid: computePluginsCid([]), blobs: [] }, signer);
    await expect(verifyPluginOffering(offering)).resolves.toEqual({ ok: true });
  });
});
