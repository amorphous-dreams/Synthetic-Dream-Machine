/**
 * A bag's MANIFEST never projects as a carrier.
 *
 * The bag manifest (`bags/<bag>/meta.mem`) addresses `lar:///ha.ka.ba/bags/<bag>` — the bag's own name.
 * Ingest carries it into the store like any carrier, `[lar-kind[]]` reads it as `content` (no `$:/`, no
 * draft field), and the loci law then sited it at `<uri-path>.mem` INSIDE the bag it describes:
 * `bags/crossroads/ha.ka.ba/bags/crossroads.mem` — a second copy of the manifest, at an address the
 * manifest itself mints, written by a projector that never owned it. `bag-declare` owns `meta.mem`.
 *
 * The seat: a record whose address IS a bag's own address (the oracle's `<bag>/descriptor` record is
 * another thing — a label-and-policies record, addressed BENEATH the bag) reads as the bag's manifest, and the
 * siting function refuses it — the same way a fragment or an effect record refuses.
 */
import { describe, expect, test, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isBagManifestUri } from "@lararium/mesh";
import { carrierBaseRelPath } from "../src/bag-paths.js";
import { LarDiskProjector } from "../src/disk-projector.js";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

describe("the manifest address", () => {
  test("a bag's own address reads as its manifest", () => {
    expect(isBagManifestUri("lar:///ha.ka.ba/bags/crossroads")).toBe(true);
    expect(isBagManifestUri("lar:///ha.ka.ba/bags/lares")).toBe(true);
  });

  test("CONTROL — a carrier living UNDER a bag address stays a carrier", () => {
    expect(isBagManifestUri("lar:///ha.ka.ba/bags/other/v2/notes/thing")).toBe(false);
    expect(isBagManifestUri("lar:///ha.ka.ba/bags/oracle/blobs/tiddlywikicore")).toBe(false);
    expect(isBagManifestUri("lar:///ha.ka.ba/lares/api/pono/meme")).toBe(false);
  });
});

describe("the siting function refuses the manifest", () => {
  test("lar:///ha.ka.ba/bags/crossroads sites nowhere", () => {
    expect(carrierBaseRelPath("lar:///ha.ka.ba/bags/crossroads")).toBeNull();
  });

  test("CONTROL — a foreign carrier under a bag address still sites whole", () => {
    expect(carrierBaseRelPath("lar:///ha.ka.ba/bags/other/v2/notes/thing")).toBe("ha.ka.ba/bags/other/v2/notes/thing");
  });
});

describe("the projector never writes bags/<bag>/ha.ka.ba/bags/<bag>.mem", () => {
  test("a flush of the manifest record writes nothing", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-descriptor-"));
    let rendered = 0;
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: "crossroads", mirrorRoot: join(root, "bags", "crossroads") }],
      carrierFileFn: async () => { rendered += 1; return { ext: ".mem", body: "a manifest render\n" }; },
      debounceMs: 1,
    });
    const flush = (projector as unknown as { flush: (b: string, u: string) => Promise<void> }).flush.bind(projector);
    await flush("crossroads", "lar:///ha.ka.ba/bags/crossroads");
    expect(existsSync(join(root, "bags/crossroads/ha.ka.ba/bags/crossroads.mem"))).toBe(false);
    expect(existsSync(join(root, "bags/crossroads/ha.ka.ba"))).toBe(false);
    expect(rendered).toBe(0);
  });

  test("CONTROL — a carrier in the same bag still lands at its uri-path", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-descriptor-ctl-"));
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: "crossroads", mirrorRoot: join(root, "bags", "crossroads") }],
      carrierFileFn: async () => ({ ext: ".mem", body: "a carrier\n" }),
      debounceMs: 1,
    });
    const flush = (projector as unknown as { flush: (b: string, u: string) => Promise<void> }).flush.bind(projector);
    await flush("crossroads", "lar:///ha.ka.ba/lares/library/oracles/doa/index");
    expect(existsSync(join(root, "bags/crossroads/ha.ka.ba/lares/library/oracles/doa/index.mem"))).toBe(true);
    expect(readdirSync(join(root, "bags/crossroads/ha.ka.ba"))).toEqual(["lares"]);
  });
});
