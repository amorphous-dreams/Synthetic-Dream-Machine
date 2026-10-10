/**
 * R3 — "plugins load by recipe" (node): TWO WIKIS IN ONE VESSEL, plus a third carrying an
 * explicit empty list — proving the whole line end to end through the EXPORTED building blocks a
 * real node vessel composes (`VesselIslandPoolCore.resolvePluginCids` → `selectPluginBlobs` →
 * `verifyCasBytes`), never a half-trusted CID read straight off the recipe.
 *
 * One recipe names the signed highlight-style offering; one names none at all; one names an
 * EXPLICIT empty list. The CAS holds the offering's bytes throughout. The three islands' manifest
 * `pluginCids` come out DISJOINT in their optional portion, with the FIXED boot-set floor
 * (grammar + boot shadows) present in all three.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { VesselIslandPoolCore } from "../src/vessel-island-pool-core.js";
import { mkEa, mkTeardownAck, type IslandMsg_Manifest } from "../src/island-protocol.js";
import type { VesselIslandHost, VesselWorkerHandle } from "../src/vessel-host.js";
import type { WikiMountSpec, WikiRecipe } from "../src/wiki-recipe.js";
import { bootSetIds, bootSetPluginCids, verifyCasBytes, type CasBlobLike } from "../src/cas.js";
import { selectPluginBlobs, selectedPluginCids, type OfferingLookup } from "../src/plugin-offering-selector.js";
import { signPluginOffering, pluginOfferingCid, type OfferedBlob, type PluginOffering } from "../src/plugin-offering.js";
import { computePluginsCid } from "../src/genesis-doc.js";
import { ENGINE_CORE_ID } from "../src/base-doc.js";

const GRAMMAR_ID  = "lar:///ha.ka.ba/lararium/plugins/lares/memetic-wikitext";
const SHADOWS_ID  = "lararium-boot-shadows";
const GRAMMAR_CID = "11".repeat(32);
const SHADOWS_CID = "22".repeat(32);
const CORE_CID    = "33".repeat(32);

/** The island/oracle doc's own blobs — the fixed floor every island gets regardless of recipe. */
const ISLAND_BLOBS: Record<string, CasBlobLike> = {
  core:    { id: ENGINE_CORE_ID, sha256: CORE_CID,    mimeType: "application/javascript" },
  grammar: { id: GRAMMAR_ID,     sha256: GRAMMAR_CID, mimeType: "application/json" },
  shadows: { id: SHADOWS_ID,     sha256: SHADOWS_CID, mimeType: "application/json" },
};

const SEED = new Uint8Array(32).fill(13);
const sign = async (bytes: Uint8Array) => hex(await ed.signAsync(bytes, SEED));
const offerorKey = async () => hex(await ed.getPublicKeyAsync(SEED));

const HIGHLIGHT_SHA = "aa".repeat(32);
const HIGHLIGHT_BYTES = new TextEncoder().encode("the highlight plugin's tiddler bytes");

async function buildHighlightOffering(): Promise<{ offering: PluginOffering; cid: string }> {
  const blob: OfferedBlob = {
    id: "$:/plugins/tiddlywiki/highlight", version: "0.9.0", sha256: HIGHLIGHT_SHA,
    provenance: {
      source: "https://github.com/tiddlywiki/tiddlywiki5", commit: "23859c84a",
      path: "plugins/tiddlywiki/highlight", licence: "BSD-3-Clause", author: "Jeremy Ruston and contributors",
    },
  };
  const offering = await signPluginOffering(
    { offeror: await offerorKey(), pluginsCid: computePluginsCid([blob]), blobs: [blob] }, sign);
  return { offering, cid: pluginOfferingCid(offering) };
}

/** The local CAS: everything the boot set plus the highlight offering need, by cid → bytes. */
function fakeCas(entries: Record<string, Uint8Array>): (cid: string) => Uint8Array | null {
  return (cid) => entries[cid] ?? null;
}

const identityHashOf = (b: Uint8Array) => Buffer.from(b).toString("hex").padStart(64, "0").slice(0, 64);

/**
 * The SAME combinator open-node-vessel.ts wires as `resolveNodeIslandPluginCids` — reproduced
 * here over the EXPORTED building blocks alone, so this test proves the public mesh contract a
 * node vessel actually composes, not an internal helper this package cannot see.
 */
function makeResolver(lookup: OfferingLookup, readBytes: (cid: string) => Uint8Array | null) {
  return async (recipe: WikiRecipe) => {
    const floorCids = bootSetPluginCids(ISLAND_BLOBS);
    const bootIds   = bootSetIds(ISLAND_BLOBS);
    const selection = await selectPluginBlobs(recipe.pluginOfferings ?? [], lookup, bootIds);
    if (!selection.ok) return { ok: false as const, error: JSON.stringify(selection.failure) };
    const selectedCids = selectedPluginCids(selection.blobs);
    const bytesVerdict = verifyCasBytes(selectedCids, readBytes, identityHashOf);
    if (!bytesVerdict.ok) return { ok: false as const, error: JSON.stringify(bytesVerdict.failure) };
    return { ok: true as const, pluginCids: [...new Set([...floorCids, ...selectedCids])] };
  };
}

/** A fake pool host that records every manifest it's handed, keyed by wikiUri. */
function recordingHost(): { host: VesselIslandHost; manifests: Map<string, IslandMsg_Manifest> } {
  const manifests = new Map<string, IslandMsg_Manifest>();
  const host: VesselIslandHost = {
    spawnWorker(): VesselWorkerHandle {
      let onMsg: ((raw: unknown) => void) | null = null;
      return {
        post: (msg: unknown) => {
          const m = msg as IslandMsg_Manifest & { type?: string };
          if (m?.type === "manifest") manifests.set(m.wikiUri, m);
          queueMicrotask(() => onMsg?.(m?.type === "teardown" ? mkTeardownAck() : mkEa((m as { wikiUri?: string })?.wikiUri ?? "")));
        },
        listen: (h) => { onMsg = h; return () => { onMsg = null; }; },
        onError: () => () => {},
        terminate: () => {},
      };
    },
    newSyncChannel: () => { const { port1, port2 } = new MessageChannel(); return { mainPort: port1, syncPort: port2 }; },
    storage: () => undefined,
  };
  return { host, manifests };
}

function spec(recipe: WikiRecipe): WikiMountSpec {
  return { coreHash: CORE_CID, recipe, grants: { islandUrl: "automerge:fixture", wikiUrl: null } };
}

describe("★ R3 — TWO WIKIS IN ONE VESSEL load plugins BY RECIPE, never a vessel-wide blanket list ★", () => {
  test("a wiki naming the offering, a wiki naming none, and a wiki naming an explicit empty list all mount in ONE pool — the CAS holds the offering throughout", async () => {
    const { offering, cid: offeringCid } = await buildHighlightOffering();
    const lookup: OfferingLookup = (c) => (c === offeringCid ? offering : undefined);
    const readBytes = fakeCas({
      [GRAMMAR_CID]: Buffer.from(GRAMMAR_CID, "hex"),
      [SHADOWS_CID]: Buffer.from(SHADOWS_CID, "hex"),
      [HIGHLIGHT_SHA]: Buffer.from(HIGHLIGHT_SHA, "hex"),
    });
    // identityHashOf hex-encodes the bytes it's handed; storing each cid's OWN hex-decoded bytes
    // means rehashing them returns the exact same cid — a deliberately simple, legible fixture.
    const resolvePluginCids = makeResolver(lookup, readBytes);

    const { host, manifests } = recordingHost();
    const pool = new VesselIslandPoolCore({ host, resolvePluginCids });

    const WIKI_HIGHLIGHT = "lar:///ha.ka.ba/bags/wiki-a";
    const WIKI_NONE       = "lar:///ha.ka.ba/bags/wiki-b";
    const WIKI_EMPTY_LIST = "lar:///ha.ka.ba/bags/wiki-c";

    await pool.mountWiki(WIKI_HIGHLIGHT, spec({ wikiSlug: "wiki-a", pluginOfferings: [offeringCid] }));
    await pool.mountWiki(WIKI_NONE,       spec({ wikiSlug: "wiki-b" }));
    await pool.mountWiki(WIKI_EMPTY_LIST, spec({ wikiSlug: "wiki-c", pluginOfferings: [] }));

    expect(pool.tier(WIKI_HIGHLIGHT)).toBe("wela");
    expect(pool.tier(WIKI_NONE)).toBe("wela");
    expect(pool.tier(WIKI_EMPTY_LIST)).toBe("wela");

    const setA = new Set(manifests.get(WIKI_HIGHLIGHT)!.pluginCids ?? []);
    const setB = new Set(manifests.get(WIKI_NONE)!.pluginCids ?? []);
    const setC = new Set(manifests.get(WIKI_EMPTY_LIST)!.pluginCids ?? []);

    // The BOOT SET floor stands in ALL THREE.
    for (const set of [setA, setB, setC]) {
      expect(set.has(GRAMMAR_CID)).toBe(true);
      expect(set.has(SHADOWS_CID)).toBe(true);
    }

    // wiki-a carries the offering's blob; wiki-b and wiki-c do not — DISJOINT in the optional portion.
    expect(setA.has(HIGHLIGHT_SHA)).toBe(true);
    expect(setB.has(HIGHLIGHT_SHA)).toBe(false);
    expect(setC.has(HIGHLIGHT_SHA)).toBe(false);

    // Absent vs explicit-empty read IDENTICALLY — "an empty recipe stays grammar-only" either way.
    expect(setB).toEqual(setC);
    expect(setA.size).toBe(setB.size + 1);

    await pool.disposeAll();
  });

  test("★ MUTATION PROOF — an unresolvable offering CID refuses the WHOLE mount, never a silent empty success ★", async () => {
    const unknownCid = "sha256:" + "ff".repeat(32);
    const resolvePluginCids = makeResolver(() => undefined, () => null);
    const { host } = recordingHost();
    const pool = new VesselIslandPoolCore({ host, resolvePluginCids, mountSilenceMs: 200 });

    await expect(
      pool.mountWiki("lar:///ha.ka.ba/bags/wiki-bad", spec({ wikiSlug: "wiki-bad", pluginOfferings: [unknownCid] })),
    ).rejects.toThrow(/plugin resolution refused/);
    expect(pool.tier("lar:///ha.ka.ba/bags/wiki-bad")).toBe(null);
  });

  test("★ MUTATION PROOF — bytes present but corrupt (do not rehash to their cid) refuse the mount, never a silent pass ★", async () => {
    const { offering, cid: offeringCid } = await buildHighlightOffering();
    const lookup: OfferingLookup = (c) => (c === offeringCid ? offering : undefined);
    // Wrong bytes under the highlight cid — rehashes to something else entirely.
    const corruptReadBytes = fakeCas({
      [GRAMMAR_CID]: Buffer.from(GRAMMAR_CID, "hex"),
      [SHADOWS_CID]: Buffer.from(SHADOWS_CID, "hex"),
      [HIGHLIGHT_SHA]: new TextEncoder().encode("not the bytes this cid names"),
    });
    const resolvePluginCids = makeResolver(lookup, corruptReadBytes);
    const { host } = recordingHost();
    const pool = new VesselIslandPoolCore({ host, resolvePluginCids, mountSilenceMs: 200 });

    await expect(
      pool.mountWiki("lar:///ha.ka.ba/bags/wiki-corrupt", spec({ wikiSlug: "wiki-corrupt", pluginOfferings: [offeringCid] })),
    ).rejects.toThrow(/corrupt-bytes/);
  });

  test("CONTROL — with no resolvePluginCids wired, every mount keeps reading the flat pre-R3 floor (the browser pool's unaffected shape)", async () => {
    const { host, manifests } = recordingHost();
    const pool = new VesselIslandPoolCore({ host, pluginCids: [GRAMMAR_CID, SHADOWS_CID] });
    const WIKI = "lar:///ha.ka.ba/bags/wiki-precr3";
    await pool.mountWiki(WIKI, spec({ wikiSlug: "wiki-precr3", pluginOfferings: ["sha256:" + "99".repeat(32)] }));
    // No resolver wired → the recipe's own pluginOfferings is NEVER consulted; the flat floor rides unchanged.
    expect(new Set(manifests.get(WIKI)!.pluginCids ?? [])).toEqual(new Set([GRAMMAR_CID, SHADOWS_CID]));
    await pool.disposeAll();
  });
});
