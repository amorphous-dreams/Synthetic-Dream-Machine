/**
 * watch-rides-the-seat — `lares ingest --watch` rides the ONE drain seat (`@lararium/node` watch-core, face-pools W1): the settle,
 * the one-wave-at-a-time rerun, the noise filter and the cookie proof stand there once, and the CLI fills only its wave.
 *
 *   L1 the package hands the seat, the noise filter, the cookie proof and the pool's host out of its barrel
 *   L2 watch.ts holds no settle seat, noise filter or cookie proof of its own
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("lares ingest --watch rides the one drain seat", () => {
  test("L1 — @lararium/node hands out drainSeat, isWatchNoise, cookieSelfTest and armFacePoolWatch", async () => {
    const node = await import("@lararium/node") as Record<string, unknown>;
    expect(typeof node["drainSeat"]).toBe("function");
    expect(typeof node["isWatchNoise"]).toBe("function");
    expect(typeof node["cookieSelfTest"]).toBe("function");
    expect(typeof node["armFacePoolWatch"]).toBe("function");
  });

  test("L2 — watch.ts keeps no seat of its own", () => {
    const src = readFileSync(new URL("../src/commands/watch.ts", import.meta.url), "utf8");
    expect(src).toMatch(/drainSeat\(/);
    expect(src).not.toMatch(/function isNoise\(/);
    expect(src).not.toMatch(/function cookieSelfTest\(/);
    expect(src).not.toMatch(/let busy\b/);
  });
});
