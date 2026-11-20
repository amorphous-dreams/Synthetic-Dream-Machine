/**
 * watch-core-hosted — THE VESSEL HOSTS THE WATCH over the worn face's pool (face-pools W1, W2), read off the composition's
 * own source (the composition stands only with a full house, so the weld reads where it arms and where it stands down):
 *
 *   H1 the composition arms `armFacePoolWatch` in its after-live step, unawaited (boot never waits), over the worn face's
 *      root, and its teardown (a lock, a wear that moves the mount) runs the host's down as a lock
 *   H2 the hearth's graceful shutdown runs the one composition teardown, where the face pool's watch stands in the
 *      producers phase (its final wave and commit seam, as a down) ahead of the flush, the signers and the islands
 *   H3 every pool a tree: the re-stand heals each pool root on disk (`healPoolTrees`) after the realm folders settle, the worn
 *      face's arm names its owner (so it founds its pool), a lit face founds its pool before its tend, and the mount's realm
 *      placement founds the realm root's one tree where it lays a wiki or bag folder in it (`ensurePoolTree`)
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
    expect(shut).toMatch(/step\("composition", \(\) => result\.teardown\(/);
    expect(vessel).toMatch(/stood\.push\(\{ what: "the face pool's watch", phase: "producers"/);
    const order = readFileSync(new URL("../src/composition-shutdown.ts", import.meta.url), "utf8");
    expect(order).toMatch(/\["producers", "flush", "signers", "islands", "resources", "repo"\]/);
  });

  test("H3 — every pool a tree: the re-stand heals, the worn arm names its owner, a lit face and a realm lay found theirs", () => {
    const restand = vessel.slice(vessel.indexOf("settleRealmFolders();"), vessel.indexOf("const diskMirrorGrant"));
    expect(restand).toMatch(/healPoolTrees\(projectionRoot/);
    const afterLive = vessel.slice(vessel.indexOf("const afterLive:"), vessel.indexOf("const orchestration:"));
    expect(afterLive).toMatch(/armFacePoolWatch\(\{ pool, owner: wornFaceSegment,/);
    const lit = vessel.slice(vessel.indexOf("writeFaceLabel({ relation, petname"), vessel.indexOf("tendLitFacePool(faceRoot("));
    expect(lit).toMatch(/ensurePoolTree\(faceRoot\(projections, petname\), \{ face: petname \}/);
    const lay = vessel.slice(vessel.indexOf("const realmBaseOf ="), vessel.indexOf("const diskMirrorGrant"));
    expect(lay).toMatch(/ensurePoolTree\(realm, \{ realm: basename\(realm\) \}/);
  });
});
