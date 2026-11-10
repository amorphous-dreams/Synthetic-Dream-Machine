/** A WHO-handle title follows the selected crossroads mirror like any other record. */
import { describe, expect, test, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nexusHandlesUri } from "@lararium/mesh";
import { namedBagMirror } from "../src/bag-paths.js";
import { LarDiskProjector } from "../src/disk-projector.js";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

describe("placement of WHO-handle records", () => {
  test("charter-shaped and private-shaped titles both project from the selected mirror", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-nexus-placement-"));
    const projector = new LarDiskProjector({
      mirrors: [namedBagMirror("crossroads", "crossroads", join(root, "bags", "crossroads"))],
      carrierFileFn: async () => ({ ext: ".tid", body: "title: handle\n\nautomerge:handle\n" }),
    });
    const flush = (uri: string) => (projector as unknown as { flush: (b: string, u: string) => Promise<void> }).flush("crossroads", uri);
    for (const uri of [nexusHandlesUri("deadbeef00112233"), nexusHandlesUri(`nexus-${"1".repeat(64)}`)]) {
      await flush(uri);
      expect(existsSync(join(root, "bags/crossroads", uri.replace("lar:///", "") + ".tid"))).toBe(true);
    }
  });
});
