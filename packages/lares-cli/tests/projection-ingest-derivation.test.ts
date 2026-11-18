import { describe, expect, test } from "vitest";
import { join } from "node:path";
import { fileToUriForSource } from "../src/ingest-core.js";

const P = "/house/projections";
const dirs = { bags: "/checkout/bags", wikis: "/checkout/wikis", projections: P };

describe("projection ingest derivation", () => {
  test("projection and checkout planes derive addresses", () => {
    expect(fileToUriForSource("/house", join(P, "wikis", "notes"), dirs)("/house", join(P, "wikis", "notes", "ha.ka.ba", "t", "x.mem"))).toBe("lar:///ha.ka.ba/t/x");
    expect(fileToUriForSource("/house", join(P, "bags", "mine"), dirs)("/house", join(P, "bags", "mine", "ha.ka.ba", "t", "y.mem"))).toBe("lar:///ha.ka.ba/t/y");
    expect(fileToUriForSource("/house", "/checkout/bags/lares", dirs)("/house", "/checkout/bags/lares/ha.ka.ba/t/z.mem")).toBe("lar:///ha.ka.ba/t/z");
  });
});
