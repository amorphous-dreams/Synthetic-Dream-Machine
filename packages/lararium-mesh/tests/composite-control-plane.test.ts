/** Selected store placement determines state residency; URI spelling remains content. */
import { describe, expect, test } from "vitest";
import { VESSEL_STATE_ID, SECRET_HOME_ID, DAEMON_BAG_ID } from "../src/lar-uris.js";
import { projectionWithheld } from "../src/projection-filter.js";

describe("state and secret homes", () => {
  test("private home coordinates stay distinct from the daemon wiki bag", () => {
    expect(new Set([VESSEL_STATE_ID, SECRET_HOME_ID, DAEMON_BAG_ID]).size).toBe(3);
  });

  test("state-shaped addresses remain eligible when a mirrored store holds them", () => {
    for (const title of [`${DAEMON_BAG_ID}/outcomes/r1`, `${DAEMON_BAG_ID}/summons/r1`, "$:/lares/swarm/house-cap"]) {
      expect(projectionWithheld(title)).toBe(false);
    }
  });
});
