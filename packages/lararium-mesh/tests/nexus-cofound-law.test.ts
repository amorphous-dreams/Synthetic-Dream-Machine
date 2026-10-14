/** Red-first N contract. No test here mints a charter in a vessel. */
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { genesisCharterEpoch, verifySealLineage } from "../src/wax-stamp.js";

const red = process.env.LAR_UNBUILT_REDS === "1" ? test : test.skip;
const key = async (n: number) => hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(n)));

describe("N's joint genesis", () => {
  test("CONTROL: a seed and a separately composed joint genesis have distinct AIDs", async () => {
    const [a, b] = await Promise.all([key(71), key(72)]);
    const seed = genesisCharterEpoch([a], 1);
    const joint = genesisCharterEpoch([a, b], 2);
    expect(seed.epochCid).not.toBe(joint.epochCid);
    expect(verifySealLineage([seed])).toBe(true);
  });

  red("COFOUND_REQUIRES_TWO_INCEPTION_SIGNATURES: an unsigned two-seat genesis fails the charter lineage reader", async () => {
    const [a, b] = await Promise.all([key(71), key(72)]);
    const unsigned = genesisCharterEpoch([a, b], 2);
    // N must migrate seed fixtures and every charter reader in the same signed-inception commit.
    expect(verifySealLineage([unsigned])).toBe(false);
  });

  red("COFOUND_OFFER_IS_NOT_A_CHARTER: an A-only public offer cannot be imported as a joint genesis", async () => {
    const [a, b] = await Promise.all([key(71), key(72)]);
    const offer = genesisCharterEpoch([a], 1);
    const finalAid = genesisCharterEpoch([a, b], 2).epochCid;
    // The generic seed reader correctly accepts its own seed charter; the joint offer reader is owed.
    expect(offer.epochCid).not.toBe(finalAid);
    expect(verifySealLineage([offer])).toBe(true);
    expect(Object.keys(await import("../src/wax-stamp.js"))).toContain("readCofoundOffer");
  });
});
