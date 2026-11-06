/**
 * floor-user-wiki-refuses — A FLOOR NODE ASKED TO BOOT A USER WIKI REFUSES BY NAME, AT ONCE.
 *
 * Before a face lights, every wiki content store rests sealed and the floor catalog names public bags alone (the sealing
 * scope, stable-founding-road#/rulings, 2026-11-06): a user wiki's bag rests on a face's half, so a floor composition can
 * neither load nor rest its documents. Booting one at the floor must refuse by name before the composition stands any
 * island: waiting out the island's mount silence lets a budget decide what a reading already names.
 *
 *   W1  RED: a floor node (no face founded) asked for a user wiki (`--wiki floor-user`, no floor row) refuses
 *       `wiki-awaits-face`, naming the wiki, before any island mounts it.
 *   W0  CONTROL: a floor node asked for a floor row's wiki (`lares`) boots at the floor.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices (slice 5b)
 */
import { afterEach, describe, expect, test } from "vitest";
import { EventEmitter } from "node:events";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withLarRoot } from "../../../../tests/harness/with-lar-root.js";
import { direct } from "../direct-store.js";
import { TEST_CUSTODY } from "../found-route.js";
import { runInit, openNodeVessel } from "../../dist/src/index.js";
import type { NodeOpenPhase, NodeVesselResult } from "../../dist/src/open-node-vessel.js";

const leaving: Array<() => Promise<void>> = [];
afterEach(async () => { while (leaving.length) await leaving.pop()!(); });

/** A floor node's root (no face founded) and a vessel composed on it for `wikiId`, with every phase it named. */
async function floorBoot(wikiId: string): Promise<{ phases: NodeOpenPhase[]; vessel: Promise<NodeVesselResult> }> {
  const root = mkdtempSync(join(tmpdir(), "floor-user-wiki-"));
  const genesisDir = join(root, "genesis");
  const storageDir = join(root, "data", "lares", "vessel");
  cpSync(join(import.meta.dirname, "..", "..", "..", "..", "genesis"), genesisDir, { recursive: true });
  await withLarRoot(root, () => direct(runInit)({ storageDir, genesisDir, custody: TEST_CUSTODY, placeFoundingCard: { readBack: async () => {} } }));
  const phases: NodeOpenPhase[] = [];
  const vessel = withLarRoot(root, () => openNodeVessel({ hostId: "floor-user-wiki", wikiId, storageDir, genesisDir, wss: new EventEmitter() as never, onPhase: (p) => { phases.push(p); } }));
  leaving.push(async () => {
    const v = await vessel.catch(() => null);
    if (v) await withLarRoot(root, () => v.teardown());
    rmSync(root, { recursive: true, force: true });
  });
  return { phases, vessel };
}

describe("a floor node asked for a user wiki refuses by name", () => {
  test("W1 RED: a user wiki at the floor refuses `wiki-awaits-face` before any island mounts it", async () => {
    const { phases, vessel } = await floorBoot("floor-user");
    const refused = await vessel.then(() => null, (e: unknown) => e as { name?: string; reason?: string; wikiId?: string; message?: string });
    expect(refused, "the floor composition refuses").not.toBeNull();
    expect({ name: refused?.name, reason: refused?.reason, wikiId: refused?.wikiId }).toEqual({ name: "FloorWikiRefusal", reason: "wiki-awaits-face", wikiId: "floor-user" });
    expect(refused?.message ?? "", "the refusal names itself and the wiki").toMatch(/wiki-awaits-face.*floor-user/);
    expect(phases, "no island stood for it").not.toContain("island-ready");
  }, 300_000);

  test("W0 CONTROL: a floor row's wiki boots at the floor", async () => {
    const { phases, vessel } = await floorBoot("lares");
    const v = await vessel;
    expect(v.activeWikiId).toBe("lares");
    expect(phases).toContain("wiki-ready");
  }, 300_000);
});
