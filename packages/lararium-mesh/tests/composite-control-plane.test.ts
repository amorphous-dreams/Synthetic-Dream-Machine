/** Selected store placement determines control residency; URI spelling remains content. */
import { describe, expect, test } from "vitest";
import { CONTROL_HOME_ID, SECRET_HOME_ID, DAEMON_BAG_ID } from "../src/lar-uris.js";
import { projectionWithheld } from "../src/projection-filter.js";

describe("control and secret homes", () => {
  test("private home coordinates stay distinct from the daemon wiki bag", () => {
    expect(new Set([CONTROL_HOME_ID, SECRET_HOME_ID, DAEMON_BAG_ID]).size).toBe(3);
  });

  test("control-shaped addresses remain eligible when a mirrored store holds them", () => {
    for (const title of [`${DAEMON_BAG_ID}/outcomes/r1`, `${DAEMON_BAG_ID}/summons/r1`, "$:/lares/swarm/house-cap"]) {
      expect(projectionWithheld(title)).toBe(false);
    }
  });
});
