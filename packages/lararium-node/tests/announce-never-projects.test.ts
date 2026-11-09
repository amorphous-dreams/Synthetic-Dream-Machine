/** A mirrored crossroads record projects by placement even when its title names a realm announcement. */
import { describe, expect, test, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { realmBagAnnounceKey, bagUri } from "@lararium/mesh";
import { LarDiskProjector } from "../src/disk-projector.js";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

function projectorOver(dir: string, bodyOf: () => { ext: string; body: string; metaBody?: string }): { flush: (b: string, u: string) => Promise<void> } {
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: "crossroads", mirrorRoot: join(dir, "bags", "crossroads") }],
    carrierFileFn: async () => bodyOf(),
  });
  return { flush: (projector as unknown as { flush: (b: string, u: string) => Promise<void> }).flush.bind(projector) };
}

describe("realm announcement titles follow the selected mirror", () => {
  test("a mirrored announce record writes as ordinary content", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-announce-"));
    let rendered = 0;
    const { flush } = projectorOver(root, () => { rendered += 1; return { ext: ".tid", body: "title: announce\n\n" }; });
    await flush("crossroads", realmBagAnnounceKey(bagUri("lares")));
    expect(existsSync(join(root, "bags/crossroads/ha.ka.ba/dreamnet/realm-bag-announce"))).toBe(true);
    expect(rendered).toBe(1);
  });

  test("CONTROL — a carrier in the same bag still lands at its uri-path", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-announce-ctl-"));
    const { flush } = projectorOver(root, () => ({ ext: ".mem", body: "a carrier\n" }));
    await flush("crossroads", "lar:///ha.ka.ba/lares/library/oracles/doa/index");
    expect(existsSync(join(root, "bags/crossroads/ha.ka.ba/lares/library/oracles/doa/index.mem"))).toBe(true);
    expect(readdirSync(join(root, "bags/crossroads/ha.ka.ba"))).toEqual(["lares"]);
  });
});
