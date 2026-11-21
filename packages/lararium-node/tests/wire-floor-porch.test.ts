/**
 * The floor's wire (WEAK FORM, labelled). `main.ts` runs its daemon at module load and `openNodeVessel` stands in no unit
 * test, so the mounts read off the sources. The behaviour half lives in `floor-porch.test` (the porch over a real server) and
 * `floor-answer.test` (the reader). This pin bites a weakening: a boot that serves the floor by a signed pointer again, or a
 * composition that forgets the porch.
 *
 *   · `main.ts` mounts no flow floor read-face: the floor of system canon answers by the Nexus's release, at the porch,
 *   · the hearth composition and the herm composition each mount the porch, the hearth with `/cas` and the herm without,
 *   · the herm lends the head's blobs to its bulb face through the released-floor lane.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const strip = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
const main = strip(readFileSync(join(__dirname, "..", "src", "main.ts"), "utf8"));
const boot = strip(readFileSync(join(__dirname, "..", "src", "open-node-vessel.ts"), "utf8"));

describe("the node's floor wire", () => {
  test("RED (floor-crossing CI cell): the hearth mounts the porch under a dispatcher alone, since main hands the hearth a dispatcher and no HTTP server", () => {
    // `main.ts` calls `openNodeVessel({ ..., dispatcher, ... })` for the hearth with no `httpServer`; a guard on the server alone
    // left every real hearth without a porch (the herm path hands both). CONTROL below: the herm still mounts it.
    expect(boot).toMatch(/if \(opts\.httpServer \|\| opts\.dispatcher\) \{\s*const porch = mountFloorPorch/);
  });
  test("main.ts serves no flow floor read-face and signs no pointer over the floor", () => {
    expect(main).not.toMatch(/snapshotPublicFlow|mountFlowReadFace|mountFlowReadFace|oracleReadFace/);
  });
  test("the hearth mounts the porch with /cas; the herm mounts it without, and lends the head's blobs to its bulb face", () => {
    const calls = [...boot.matchAll(/mountFloorPorch\(\{[\s\S]*?serveCas:\s*(true|false)/g)].map((m) => m[1]);
    expect(calls.sort()).toEqual(["false", "true"]);
    expect(boot).toMatch(/releasedFloor:\s*\(\)\s*=>\s*releasedFloorCids\(/);
  });
});
