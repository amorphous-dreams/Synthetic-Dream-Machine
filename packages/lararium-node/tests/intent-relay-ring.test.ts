import { describe, expect, test } from "vitest";
import { readCustodyRow, writeCustodyRow } from "../src/custody-seat.js";
import { enabledIntentRelayFaces, enableIntentRelayFace, disableIntentRelayFace, intentRelayRing, IntentRelayRingMalformed, INTENT_RELAY_FACES_FILE } from "../src/intent-relay-ring.js";
import { seatScratchCustody } from "./custody-seat-fixture.js";

const a = "a".repeat(64), b = "b".repeat(64);
describe("the per-face relay ring", () => {
  test("RED: absent and disabled faces stay off; CONTROL: explicit enable persists and sorts", async () => {
    const seat = await seatScratchCustody("intent-ring");
    try {
      expect(await enabledIntentRelayFaces()).toEqual([]);
      expect(await intentRelayRing().admits(a)).toBe(false);
      await enableIntentRelayFace(b); await enableIntentRelayFace(a); await enableIntentRelayFace(a);
      expect(await enabledIntentRelayFaces()).toEqual([a, b]);
      expect(await intentRelayRing().admits(a)).toBe(true);
      await disableIntentRelayFace(a); await disableIntentRelayFace(a);
      expect(await enabledIntentRelayFaces()).toEqual([b]);
      expect(await intentRelayRing().admits(a)).toBe(false);
      expect((await readCustodyRow("identity", INTENT_RELAY_FACES_FILE))?.length).toBeGreaterThan(0);
    } finally { await seat.drop(); }
  });

  test("RED: noncanonical stored bytes close the ring with a named fault; CONTROL: canonical bytes admit", async () => {
    const seat = await seatScratchCustody("intent-ring-shape");
    try {
      await enableIntentRelayFace(a);
      expect(await intentRelayRing().admits(a)).toBe(true);
      await writeCustodyRow("identity", INTENT_RELAY_FACES_FILE, new TextEncoder().encode('{ "faces": ["' + a + '"] }'));
      await expect(enabledIntentRelayFaces()).rejects.toBeInstanceOf(IntentRelayRingMalformed);
      expect(await intentRelayRing().admits(a)).toBe(false);
    } finally { await seat.drop(); }
  });
});
