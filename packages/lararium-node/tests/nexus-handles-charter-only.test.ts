/**
 * THE CHARTER-ONLY MIRROR GUARD — a per-Nexus WHO-face pointer (`bags/nexus/<pubkey>/handles`)
 * must never disk-mirror to the crossroads bag unless the RESOLVED `nexusIdentity().kind` is
 * `"charter"`. A private-nexus-of-one (`kind:"own"`) or a dialed anchor (`kind:"anchor"`) still
 * mints this pointer into the crossroads CRDT doc on first boot (who-face.ts `resolveOracleDoc`)
 * — that write is fine, it is a real fact about that boot's private board — but the DISK MIRROR
 * of it into `bags/crossroads/` is the leak: four such pointers from throwaway dev vessels landed
 * untracked in the tracked, public-cap-tier crossroads bag (2026-09-20).
 *
 * The guard rides the mirror GRANT (baked from the resolved kind at boot, main-thread side),
 * not the tiddler title: `namedBagMirror(bagId, scope, mirrorRoot, guardNexusHandles)` →
 * `BagMirrorConfig.guardNexusHandles` → `LarDiskProjector.flush` tests the URI's SHAPE
 * (`isNexusHandlesUri`) against that flag. Curated crossroads library content carries no such
 * shape and always projects, charter or not.
 */
import { describe, expect, test, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nexusHandlesUri } from "@lararium/mesh";
import { namedBagMirror } from "../src/bag-paths.js";
import { LarDiskProjector } from "../src/disk-projector.js";

const OWN_NEXUS     = "abc123def456abc123def456abc123def456abc123def456abc123def456ab";
const CHARTER_NEXUS = "epoch0-" + "1".repeat(64);

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

function flushOn(projector: LarDiskProjector) {
  return (bagId: string, uri: string): Promise<void> =>
    (projector as unknown as { flush: (b: string, u: string) => Promise<void> }).flush.bind(projector)(bagId, uri);
}

describe("the charter-only crossroads mirror guard", () => {
  test("RED-FIRST: a private-nexus-of-one's WHO-handles pointer does NOT project to disk", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-nexus-guard-own-"));
    const mirror = namedBagMirror("crossroads", "crossroads", join(root, "bags", "crossroads"), true);
    const projector = new LarDiskProjector({
      mirrors: [mirror],
      carrierFileFn: async () => ({ ext: ".tid", body: "title: x\n\nautomerge:fakehandle\n" }),
      debounceMs: 1,
    });
    const uri = nexusHandlesUri(OWN_NEXUS);
    await flushOn(projector)("crossroads", uri);
    expect(existsSync(join(root, "bags/crossroads", uri.replace("lar:///", "") + ".tid"))).toBe(false);
  });

  test("an anchor-scoped WHO-handles pointer ALSO does not project", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-nexus-guard-anchor-"));
    const mirror = namedBagMirror("crossroads", "crossroads", join(root, "bags", "crossroads"), true);
    const projector = new LarDiskProjector({
      mirrors: [mirror],
      carrierFileFn: async () => ({ ext: ".tid", body: "title: x\n\nautomerge:fakehandle\n" }),
      debounceMs: 1,
    });
    const uri = nexusHandlesUri("deadbeef00112233");
    await flushOn(projector)("crossroads", uri);
    expect(existsSync(join(root, "bags/crossroads", uri.replace("lar:///", "") + ".tid"))).toBe(false);
  });

  test("CONTROL — a charter-backed nexus's WHO-handles pointer DOES project", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-nexus-guard-charter-"));
    // guardNexusHandles = false — a charter boot builds its grant with the flag OFF.
    const mirror = namedBagMirror("crossroads", "crossroads", join(root, "bags", "crossroads"), false);
    const projector = new LarDiskProjector({
      mirrors: [mirror],
      carrierFileFn: async () => ({ ext: ".tid", body: "title: x\n\nautomerge:fakehandle\n" }),
      debounceMs: 1,
    });
    const uri = nexusHandlesUri(CHARTER_NEXUS);
    await flushOn(projector)("crossroads", uri);
    expect(existsSync(join(root, "bags/crossroads", uri.replace("lar:///", "") + ".tid"))).toBe(true);
  });

  test("CONTROL — ordinary curated crossroads library content still projects under the guard", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-nexus-guard-library-"));
    const mirror = namedBagMirror("crossroads", "crossroads", join(root, "bags", "crossroads"), true);
    const projector = new LarDiskProjector({
      mirrors: [mirror],
      carrierFileFn: async () => ({ ext: ".mem", body: "a curated library carrier\n" }),
      debounceMs: 1,
    });
    await flushOn(projector)("crossroads", "lar:///ha.ka.ba/lares/library/oracles/doa/index");
    expect(existsSync(join(root, "bags/crossroads/ha.ka.ba/lares/library/oracles/doa/index.mem"))).toBe(true);
  });
});
