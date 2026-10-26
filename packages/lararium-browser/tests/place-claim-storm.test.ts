/**
 * THE STORM WITNESS, browser leg (W14 to W16): the page reads the same facts the node leg reads off a board (a place that rotates
 * through four heads, a claim at each) as floor cards carried by hand against one anchor, in every shuffled arrival order, with
 * restarts that drop the page's index. The same evidence yields the same head the node leg ends on; no arrival order wins.
 *
 * SILENT-ZERO: an empty page serves nothing and shows no fork, and the same filing reads the known-positive rotation.
 */
import { describe, expect, test } from "vitest";
import { hex } from "@lararium/mesh";
import { browserGatePins, fileFloorCard } from "../src/browser-gate-pins.js";
import { headOf, prng, shuffled, stormStages } from "../../lararium-mesh/tests/place-claim-fixture.js";

const NEXUS = "nexus-storm.synthetic";
const RELAY = "ws://node:8080/ws";
const KEY = { hearth: "ws://node:8080", nexus: hex(new TextEncoder().encode(NEXUS)), route: "/flow", tier: "floor" as const };

describe("the storm witness, browser leg", () => {
  test("every arrival order of the cards ends on the last head, with restarts between them", async () => {
    const stages = await stormStages(NEXUS, 4);
    const anchor = { aid: stages[0]!.place.aid, via: "genesis" as const };
    const cards = stages.map((s) => ({ claim: s.claim, kel: s.place.chain }));
    const finalHead = headOf(stages[3]!.place).headDigest;
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const next = prng(seed);
      let pins = browserGatePins();
      for (const card of shuffled(cards, next)) {
        if (next() > 0.7) pins = browserGatePins();                       // a restart: the page's index is gone
        const filing = fileFloorCard(pins, RELAY, card, anchor);
        // A card is filed, or refused as a rollback of a head already held; never refused any other way.
        expect(filing.filed || filing.refusal === "rollback", `seed ${String(seed)}: ${JSON.stringify(filing)}`).toBe(true);
        const at = pins.standingOf(KEY)?.seq ?? -1;
        expect(at).toBeGreaterThanOrEqual(0);
      }
      // The page reloads and reads the same cards in the order it met them: a fresh index converges the same.
      const reload = browserGatePins();
      for (const card of cards) fileFloorCard(reload, RELAY, card, anchor);
      for (const card of cards) fileFloorCard(pins, RELAY, card, anchor);
      expect(pins.standingOf(KEY)?.head, `seed ${String(seed)}`).toBe(finalHead);
      expect(reload.standingOf(KEY)?.head).toBe(finalHead);
      expect(pins.get(KEY)).toEqual(stages[3]!.pin);
      expect(pins.forks()).toEqual([]);
      outcomes.add(`${String(pins.standingOf(KEY)?.head)}|${JSON.stringify(pins.get(KEY))}`);
    }
    expect([...outcomes]).toHaveLength(1);
  }, 120_000);

  test("SILENT-ZERO: an empty page serves nothing and shows no fork; the known-positive rotation moves it", async () => {
    const stages = await stormStages(NEXUS, 2);
    const anchor = { aid: stages[0]!.place.aid, via: "transfer" as const };
    const pins = browserGatePins();
    expect(pins.get(KEY)).toBeNull();
    expect(pins.forks()).toEqual([]);
    fileFloorCard(pins, RELAY, { claim: stages[0]!.claim, kel: stages[0]!.place.chain }, anchor);
    expect(pins.standingOf(KEY)?.seq).toBe(0);
    fileFloorCard(pins, RELAY, { claim: stages[1]!.claim, kel: stages[1]!.place.chain }, anchor);
    expect(pins.standingOf(KEY)?.seq).toBe(1);
  });
});
