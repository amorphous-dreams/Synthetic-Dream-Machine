/**
 * watch-core-hosted — THE VESSEL HOSTS THE WATCH over the worn face's pool (face-pools W1, W2), read off the composition's
 * own source (the composition stands only with a full house, so the weld reads where it arms and where it stands down):
 *
 *   H1 the composition arms `armFacePoolWatch` in its after-live step, unawaited (boot never waits), over the worn face's
 *      root, and its teardown (a lock, a wear that moves the mount) runs the host's down as a lock
 *   H2 the vessel's result hands `facePoolStandDown`, and the hearth's graceful shutdown runs it (the final wave and the
 *      commit seam, as a down) before the sessions flush and the islands go
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";

const vessel = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");

describe("the vessel hosts the watch over the worn face's pool", () => {
  test("H1 — after-live arms the host unawaited over the worn face's root; teardown downs it as a lock", () => {
    const afterLive = vessel.slice(vessel.indexOf("const afterLive:"), vessel.indexOf("const orchestration:"));
    expect(afterLive).toMatch(/armFacePoolWatch\(/);
    expect(afterLive).not.toMatch(/await\s+armFacePoolWatch/);
    expect(afterLive).toMatch(/faceRoot\(\s*larProjectionsHome\(\),\s*wornFaceSegment\s*\)/);
    expect(afterLive).toMatch(/stood\.push\(\{\s*what:\s*"the face pool's watch"/);
    expect(afterLive).toMatch(/\.down\("lock"\)/);
  });

  test("H2 — the hearth's shutdown downs the host before the sessions flush", () => {
    expect(vessel).toMatch(/facePoolStandDown:\s*\(\)\s*=>\s*Promise<void>/);
    const shut = main.slice(main.indexOf("const shutdown = async"), main.indexOf("main-reflush"));
    const pool = shut.indexOf('step("face-pool", () => result.facePoolStandDown())');
    expect(pool).toBeGreaterThan(-1);
    expect(pool).toBeLessThan(shut.indexOf('step("sessions-flush"'));
  });
});
