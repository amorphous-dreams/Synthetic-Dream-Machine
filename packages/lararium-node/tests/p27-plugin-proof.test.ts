/**
 * P27 · plugin CIDs the resolution proved count as references. A promoted digest rests in a custody row and an offered
 * blob's address rides as JSON inside an offering's `text`, so no held LarDoc field names either; without a proof the
 * island floor refused them even to the house's own island, and the kernel's sequential plugin fetch failed the whole
 * mount. Here the node's own resolver (`resolveNodeIslandPluginCids`, the daemon's `promoted("daemon")` path) feeds the real
 * `makeHeldShareFloor`, and the kernel's fetch loop runs over the real island floor door.
 */
import { expect, test, vi } from "vitest";
import { composeVessel, islandFloorStack, larVesselOf, makeHeldShareFloor, sha256HexBytesSync, utf8Bytes, type ShareAudience } from "@lararium/mesh";
import { resolveNodeIslandPluginCids } from "../src/node-plugin-resolution.js";

const plugin = utf8Bytes(JSON.stringify([{ title: "$:/plugins/p27/promoted", text: "{}" }]));
const PLUGIN = sha256HexBytesSync(plugin);
const STRAY = "34".repeat(32);

async function rig() {
  const floor = makeHeldShareFloor({
    genesisCids: () => new Set(), handles: () => ({}), catalog: () => undefined, bindings: () => [],
    publicPlane: (id) => id === "crossroads-board", sealedPlane: () => false, nonBagTier: () => null, faceOwns: () => false,
    secrets: { catalog: { face: () => null, sealed: () => false, failure: () => null, flush: async () => {} } },
    onRefusal: () => {},
  });
  const cas = vi.fn(async (cid: string) => (cid === PLUGIN ? plugin : new Uint8Array([1])));
  const island = await composeVessel(islandFloorStack({ cas, tiers: floor.tiers, documentsForCid: floor.documentsForCid }));
  const door = larVesselOf(island).record.cas!;
  // The kernel's plugin loop (sovereign-kernel): each CID in turn, and the first refusal faults the island.
  const mount = async (pluginCids: readonly string[], audience: ShareAudience): Promise<"stands" | string> => {
    try { for (const cid of pluginCids) await door(cid, audience); return "stands"; }
    catch (e) { return (e as { reason?: string }).reason ?? String(e); }
  };
  return { floor, island, mount };
}

test("P27 plugin proof: the daemon island stands on a single promoted plugin; CONTROL: an unproven CID still refuses", async () => {
  const { floor, island, mount } = await rig();
  try {
    const verdict = await resolveNodeIslandPluginCids({
      islandBlobs: undefined, recipe: { wikiSlug: "daemon" }, lookup: () => undefined,
      readBytes: (cid) => (cid === PLUGIN ? plugin : null), promoted: async (slug) => (slug === "daemon" ? [PLUGIN] : []),
    });
    expect(verdict).toMatchObject({ ok: true, pluginCids: [PLUGIN] });
    if (!verdict.ok) throw new Error(verdict.error);
    // THE FAULT: no held document names the promoted digest, so the kernel's loop refuses and the island never stands.
    expect(await mount(verdict.pluginCids, "in-process")).toBe("declared-tier-unresolved");
    floor.provePlugins("daemon", { board: null, ...verdict.proved });
    expect(await mount(verdict.pluginCids, "in-process")).toBe("stands");
    expect(await mount([STRAY], "in-process")).toBe("declared-tier-unresolved");
  } finally { await island.dispose(); }
});

test("P27 plugin proof: a promoted plugin reads at its ledger's tier (PERSONAGROUP): the world withheld, the proof per wiki", async () => {
  const { floor, island, mount } = await rig();
  try {
    floor.provePlugins("notes", { board: null, offered: [], promoted: [PLUGIN] });
    expect(await mount([PLUGIN], "fleet")).toBe("stands");
    expect(await mount([PLUGIN], "world")).toBe("declared-tier-audience");
    // A later resolution of the same wiki that no longer promotes it withdraws the reference.
    floor.provePlugins("notes", { board: null, offered: [], promoted: [] });
    expect(await mount([PLUGIN], "in-process")).toBe("declared-tier-unresolved");
  } finally { await island.dispose(); }
});

test("P27 plugin proof: an offered plugin the selection verified reads at its board's tier", async () => {
  const { floor, island, mount } = await rig();
  // The board must itself resolve: a board this floor cannot name refuses, never reads public by the proof alone.
  try {
    floor.provePlugins("notes", { board: "crossroads-board", offered: [PLUGIN], promoted: [] });
    expect(await mount([PLUGIN], "world")).toBe("stands");
    floor.provePlugins("notes", { board: "unnamed-board", offered: [PLUGIN], promoted: [] });
    expect(await mount([PLUGIN], "world")).toBe("declared-tier-unresolved");
  } finally { await island.dispose(); }
});
