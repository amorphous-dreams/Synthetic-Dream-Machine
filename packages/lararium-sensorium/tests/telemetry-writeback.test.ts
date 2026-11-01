/**
 * telemetry-writeback — the lar-telemetry projection held as a placeholder (operator ruling
 * 2026-10-31, Train Q, row Q6).
 *
 * The harvester burn retired the turn reader and the Python drawer writer behind this surface. Its
 * callers keep their shape and read an empty pass: this pin holds the placeholder until the
 * sensorium arc returns the real projection.
 */
import { describe, expect, test } from "vitest";

import { stampKapaeSalience, writebackWing } from "../src/telemetry-writeback.js";

describe("writebackWing — a placeholder that writes nothing and reports an empty pass", () => {
  test("any wing, any limit: zero drawers, zero applied; the kapae stamp lands on none", () => {
    for (const opts of [{}, { limit: 5 }]) {
      expect(writebackWing("wing_any", opts)).toEqual({
        drawers: 0, framed: 0, applied: 0, standings: { framed: 0, structured: 0, raw: 0 },
      });
    }
    expect(stampKapaeSalience(["a".repeat(64)], "2026-11-01T00:00:00Z")).toEqual({ stamped: 0 });
  });
});
