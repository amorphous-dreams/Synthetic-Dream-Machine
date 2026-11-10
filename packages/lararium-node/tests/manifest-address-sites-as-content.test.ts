/**
 * A record titled at a bag's own address (`lar:///ha.ka.ba/bags/<bag>`, the address a bag manifest's meta mints) sites and
 * projects as ordinary content: placement decides residency, never a title's shape (operator ruling 2026-11-09, placement
 * over patterns). The manifest file itself (`bags/<bag>/meta.mem`) belongs to the declare verb; a projector never reads a
 * title to decide whether a record may rest on disk, so a manifest-shaped record resting in a mirrored bag writes at its
 * uri-path like any carrier, and a carrier under a bag address sites whole.
 */
import { describe, expect, test, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { carrierBaseRelPath } from "../src/bag-paths.js";
import { LarDiskProjector } from "../src/disk-projector.js";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

describe("a manifest-shaped address sites by the carrier law, never by a title rule", () => {
  test("the address sites like any other stable carrier", () => {
    expect(carrierBaseRelPath("lar:///ha.ka.ba/bags/crossroads")).toBe("ha.ka.ba/bags/crossroads");
  });

  test("CONTROL — a foreign carrier under a bag address still sites whole", () => {
    expect(carrierBaseRelPath("lar:///ha.ka.ba/bags/other/v2/notes/thing")).toBe("ha.ka.ba/bags/other/v2/notes/thing");
  });
});

describe("a selected mirror projects its records by placement", () => {
  test("a manifest-shaped title in this mirrored bag writes as ordinary content", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-descriptor-"));
    let rendered = 0;
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: "crossroads", mirrorRoot: join(root, "bags", "crossroads") }],
      carrierFileFn: async () => { rendered += 1; return { ext: ".mem", body: "a manifest render\n" }; },
    });
    const flush = (projector as unknown as { flush: (b: string, u: string) => Promise<void> }).flush.bind(projector);
    await flush("crossroads", "lar:///ha.ka.ba/bags/crossroads");
    expect(existsSync(join(root, "bags/crossroads/ha.ka.ba/bags/crossroads.mem"))).toBe(true);
    expect(rendered).toBe(1);
  });

  test("CONTROL — a carrier in the same bag still lands at its uri-path", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-descriptor-ctl-"));
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: "crossroads", mirrorRoot: join(root, "bags", "crossroads") }],
      carrierFileFn: async () => ({ ext: ".mem", body: "a carrier\n" }),
    });
    const flush = (projector as unknown as { flush: (b: string, u: string) => Promise<void> }).flush.bind(projector);
    await flush("crossroads", "lar:///ha.ka.ba/lares/library/oracles/doa/index");
    expect(existsSync(join(root, "bags/crossroads/ha.ka.ba/lares/library/oracles/doa/index.mem"))).toBe(true);
    expect(readdirSync(join(root, "bags/crossroads/ha.ka.ba"))).toEqual(["lares"]);
  });
});
