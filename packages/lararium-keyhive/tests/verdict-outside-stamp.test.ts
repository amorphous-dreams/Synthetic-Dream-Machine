/**
 * The probe's verdict lies outside the stamped package subtree, so a suite run leaves the package's
 * build digest where it was. CONTROL: a path inside the subtree reads as inside.
 */
import { describe, test, expect } from "vitest";
import { dirname, join, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { VERDICT_PATH } from "./verdict-path.js";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const inside = (p: string): boolean => { const r = relative(PKG, p); return r !== "" && !r.startsWith("..") && !isAbsolute(r); };

describe("the one-road-cost verdict stays out of the stamped subtree", () => {
  test("the verdict path lies outside the package", () => {
    expect(inside(VERDICT_PATH)).toBe(false);
  });
  test("CONTROL: the probe's old home beside the tests reads as inside", () => {
    expect(inside(join(PKG, "tests", "one-road-cost.verdict.json"))).toBe(true);
  });
});
