/**
 * daemon-working-mirror — the daemon wiki projects to `wikis/daemon/`, and its private bag to nowhere.
 *
 * The daemon reads as a wiki (operator ruling: "working layers for all wikis"), and a wiki's working
 * slot projects to `wikis/{slug}/` through the `wikiSlot: "working"` grant `resolveDiskMirrors` fills
 * from the slug at mount. The daemon island mounts outside the pool, so nothing fills that grant for
 * it — the mirror it owes wears the SAME shape, minted once by `daemonWorkingMirror`. The daemon bag
 * beneath (verbs, outcomes, bindings — the control plane) stays off disk by design.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/outbound-bridge
 */

import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LarDiskProjector } from "../src/disk-projector.js";
import { daemonWorkingMirror } from "../src/bag-paths.js";
import { wikiSlotUri, DAEMON_BAG_ID } from "@lararium/mesh";
import type { CarrierFile } from "@lararium/tw5";

const URI = "lar:///ha.ka.ba/t/daemon/note";
const REL = "ha.ka.ba/t/daemon/note.mem";
const DAEMON_WORKING = wikiSlotUri("daemon", "working");
type Flushable = { flush: (b: string, u: string) => Promise<void>; _scheduleUnlinkByTitle: (t: string) => Promise<void> };

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

function rig(bagsHolding?: (uri: string) => Promise<string[]>): { projector: Flushable; root: string } {
  root = mkdtempSync(join(tmpdir(), "lar-daemon-mirror-"));
  const file: CarrierFile = { ext: ".mem", body: "<<^ code=\"&#x0001;\">>\n" };
  const projector = new LarDiskProjector({
    mirrors: [daemonWorkingMirror(root)],
    carrierFileFn: async () => file,
    debounceMs: 1,
    ...(bagsHolding ? { bagsHolding } : {}),
  }) as unknown as Flushable;
  return { projector, root };
}

describe("the daemon wiki projects to wikis/daemon/", () => {
  test("★ the daemon working mirror wears the grant shape every wiki's working slot gets ★", () => {
    const rootDir = "/vessel/root";
    // The shape `resolveDiskMirrors` (mesh `vessel-island-pool-core.ts`) fills for a `wikiSlot: "working"`
    // grant from the slug at mount: bag `wikis/{slug}/working`, root `<wikis-root>/{slug}`.
    const viaPool = { bagId: wikiSlotUri("daemon", "working"), mirrorRoot: `${join(rootDir, "wikis")}/daemon` };
    const minted = daemonWorkingMirror(rootDir);
    expect(minted.bagId).toBe(DAEMON_WORKING);
    expect({ bagId: minted.bagId, mirrorRoot: minted.mirrorRoot }).toEqual(viaPool);
  });

  test("★ a record landing in wikis/daemon/working projects to <root>/wikis/daemon/<uri-path>.mem ★", async () => {
    const { projector, root } = rig();
    await projector.flush(DAEMON_WORKING, URI);
    const at = join(root, "wikis", "daemon", REL);
    expect(existsSync(at), `nothing projected at ${at}`).toBe(true);
    expect(readFileSync(at, "utf8")).toContain("<<^ code=");
  });

  test("CONTROL: a record in the daemon's private bag (bags/daemon) projects NOWHERE", async () => {
    const { projector, root } = rig();
    await projector.flush(DAEMON_BAG_ID, URI);
    expect(existsSync(join(root, "wikis")), "the daemon bag reached the wiki mirror").toBe(false);
    expect(readdirSync(root), "the daemon bag reached disk").toEqual([]);
  });

  /**
   * The residency MOVE's unlink leg. A MOVE retracts the carrier from `wikis/daemon/working`; the
   * projector's `sited` memory carries the unlink for the mirror whose bag no longer holds it, and
   * keeps the file where a bag still does (the shadow-aware gate).
   */
  test("★ a carrier that LEFT wikis/daemon/working unlinks from wikis/daemon/; one still held there stays ★", async () => {
    let holding: string[] = [DAEMON_WORKING];
    const { projector, root } = rig(async () => holding);
    await projector.flush(DAEMON_WORKING, URI);
    const at = join(root, "wikis", "daemon", REL);
    expect(existsSync(at)).toBe(true);
    await projector._scheduleUnlinkByTitle(URI);
    expect(existsSync(at), "the file left while the working layer still holds the carrier").toBe(true);
    holding = [DAEMON_BAG_ID];
    await projector._scheduleUnlinkByTitle(URI);
    expect(existsSync(at), "the carrier left wikis/daemon/working and its file stayed").toBe(false);
  });
});
