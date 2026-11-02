/**
 * A realm-bag ANNOUNCE never projects as a carrier.
 *
 * A registration mints one announce pointer per bag into the crossroads plane
 * (`lar:///ha.ka.ba/dreamnet/realm-bag-announce/<encoded bag uri>`), a record the HOUSE writes into the
 * live document, never a curated canon file. The crossroads bag projects back into the canon tree, so a
 * mirror that wrote the pointer left `realm-bag-announce/lar%3A%2F%2F%2F….tid` beside the tracked
 * library on every seeded boot. Like an effect record, an announce rests in the CRDT alone.
 */
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

describe("the projector never writes a realm-bag announce", () => {
  test("a flush of an announce pointer writes nothing", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-announce-"));
    let rendered = 0;
    const { flush } = projectorOver(root, () => { rendered += 1; return { ext: ".tid", body: "title: announce\n\n" }; });
    await flush("crossroads", realmBagAnnounceKey(bagUri("lares")));
    expect(existsSync(join(root, "bags/crossroads/ha.ka.ba"))).toBe(false);
    expect(rendered).toBe(0);
  });

  test("CONTROL — a carrier in the same bag still lands at its uri-path", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-announce-ctl-"));
    const { flush } = projectorOver(root, () => ({ ext: ".mem", body: "a carrier\n" }));
    await flush("crossroads", "lar:///ha.ka.ba/lares/library/oracles/doa/index");
    expect(existsSync(join(root, "bags/crossroads/ha.ka.ba/lares/library/oracles/doa/index.mem"))).toBe(true);
    expect(readdirSync(join(root, "bags/crossroads/ha.ka.ba"))).toEqual(["lares"]);
  });
});
