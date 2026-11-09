import { describe, expect, test } from "vitest";
import { PROJECTION_FILTER_TEXT, projectionWithheld } from "../src/projection-filter.js";

describe("swarm title placement", () => {
  test("a swarm title follows its resting layer into the projection", () => {
    const title = "$:/lares/swarm/house-cap";
    expect(projectionWithheld(title)).toBe(false);
    expect(PROJECTION_FILTER_TEXT.base).not.toContain("swarm");
  });
});
