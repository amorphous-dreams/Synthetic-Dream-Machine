/**
 * R4 — "plugins load by recipe" (browser): TWO WIKIS IN ONE VESSEL, plus a third carrying an
 * explicit empty list — proving the whole line end to end through the EXPORTED building blocks
 * a real browser vessel composes (`resolveBrowserIslandPluginCids` → `selectPluginBlobs` →
 * `verifyCasBytesAsync` over REAL OPFS), wired into the SAME `VesselIslandPoolCore` activation
 * path `BrowserVesselIslandPool` runs — never a half-trusted CID read straight off the recipe.
 * This is the browser mirror of the mesh package's `vessel-island-pool-plugin-resolution.test.ts`
 * (node); the ONE substrate divergence this file exercises for real is the async OPFS byte read
 * (`readCasBlobFromOpfs`), which runs inside an actual Chromium instance here (playwright), not a
 * fake — this suite's whole point is that the resolver is NOT reproduced, only the pool's host
 * (worker spawn/sync-channel plumbing already proven elsewhere) is faked, exactly as the node
 * proof fakes only ITS host.
 *
 * One recipe names the signed highlight-style offering; one names none at all; one names an
 * EXPLICIT empty list. The OPFS CAS holds the offering's bytes throughout. The three islands'
 * manifest `pluginCids` come out DISJOINT in their optional portion, with the FIXED boot-set
 * floor (grammar + boot shadows) present in all three.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import {
  hex,
  ENGINE_CORE_ID,
  sha256HexBytesSync,
  signPluginOffering, pluginOfferingCid, computePluginsCid,
  type OfferedBlob, type PluginOffering, type CasBlobLike,
  type OfferingLookup,
  mkEa, mkTeardownAck, type IslandMsg_Manifest,
  type VesselIslandHost, type VesselWorkerHandle,
  VesselIslandPoolCore,
} from "@lararium/mesh";
import { writeBlobsToCasOpfs } from "../src/browser-genesis.js";
import { resolveBrowserIslandPluginCids } from "../src/open-browser-vessel.js";
import { BrowserVesselIslandPool } from "../src/browser-vessel-island-pool.js";

const GRAMMAR_ID  = "lar:///ha.ka.ba/lararium/plugins/lares/memetic-wikitext";
const SHADOWS_ID  = "lararium-boot-shadows";
const GRAMMAR_BYTES = new TextEncoder().encode("browser R4 fixture — the grammar region's bytes");
const SHADOWS_BYTES = new TextEncoder().encode("browser R4 fixture — the boot-shadows region's bytes");
const GRAMMAR_CID = sha256HexBytesSync(GRAMMAR_BYTES);
const SHADOWS_CID = sha256HexBytesSync(SHADOWS_BYTES);

/** The island/oracle doc's own blobs — the fixed floor every island gets regardless of recipe. */
const ISLAND_BLOBS: Record<string, CasBlobLike> = {
  core:    { id: ENGINE_CORE_ID, sha256: "33".repeat(32), mimeType: "application/javascript" },
  grammar: { id: GRAMMAR_ID,     sha256: GRAMMAR_CID,     mimeType: "application/json", blob: GRAMMAR_BYTES },
  shadows: { id: SHADOWS_ID,     sha256: SHADOWS_CID,     mimeType: "application/json", blob: SHADOWS_BYTES },
};

const SEED = new Uint8Array(32).fill(21);
const sign = async (bytes: Uint8Array) => hex(await ed.signAsync(bytes, SEED));
const offerorKey = async () => hex(await ed.getPublicKeyAsync(SEED));

const HIGHLIGHT_BYTES = new TextEncoder().encode("browser R4 fixture — the highlight plugin's tiddler bytes");
const HIGHLIGHT_SHA = sha256HexBytesSync(HIGHLIGHT_BYTES);

/** Builds a signed offering naming ONE blob at the given id/sha256 — parametrized so each test
 *  can mint a CID unique to itself. OPFS is a real, persistent store shared across this file's
 *  tests (no per-test reset), so a "missing bytes" proof must name a CID NO OTHER test in this
 *  file ever writes, never reuse HIGHLIGHT_SHA once an earlier test has written it. */
async function buildOffering(id: string, sha256: string): Promise<{ offering: PluginOffering; cid: string }> {
  const blob: OfferedBlob = {
    id, version: "0.9.0", sha256,
    provenance: {
      source: "https://github.com/tiddlywiki/tiddlywiki5", commit: "23859c84a",
      path: "plugins/tiddlywiki/highlight", licence: "BSD-3-Clause", author: "Jeremy Ruston and contributors",
    },
  };
  const offering = await signPluginOffering(
    { offeror: await offerorKey(), pluginsCid: computePluginsCid([blob]), blobs: [blob] }, sign);
  return { offering, cid: pluginOfferingCid(offering) };
}

const buildHighlightOffering = () => buildOffering("$:/plugins/tiddlywiki/highlight", HIGHLIGHT_SHA);

/** A fake pool HOST that records every manifest it's handed, keyed by wikiUri — the same kind of
 *  double the mesh package's own node proof uses for ITS host; the resolver under test (imported
 *  for real above) never rides a double. */
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

describe("★ R4 — TWO WIKIS IN ONE BROWSER VESSEL load plugins BY RECIPE, over REAL OPFS ★", () => {
  test("a wiki naming the offering, a wiki naming none, and a wiki naming an explicit empty list all mount in ONE pool — the OPFS CAS holds the offering throughout", async () => {
    await writeBlobsToCasOpfs(ISLAND_BLOBS);
    const { offering, cid: offeringCid } = await buildHighlightOffering();
    await writeBlobsToCasOpfs({
      highlight: { id: "$:/plugins/tiddlywiki/highlight", sha256: HIGHLIGHT_SHA, mimeType: "application/json", blob: HIGHLIGHT_BYTES },
    });
    const lookup: OfferingLookup = (c) => (c === offeringCid ? offering : undefined);

    const { host, manifests } = recordingHost();
    const pool = new VesselIslandPoolCore({
      host,
      resolvePluginCids: (recipe) => resolveBrowserIslandPluginCids({ islandBlobs: ISLAND_BLOBS, recipe, lookup }),
    });

    const WIKI_HIGHLIGHT = "lar:///ha.ka.ba/bags/browser-wiki-a";
    const WIKI_NONE       = "lar:///ha.ka.ba/bags/browser-wiki-b";
    const WIKI_EMPTY_LIST = "lar:///ha.ka.ba/bags/browser-wiki-c";

    await pool.mountWiki(WIKI_HIGHLIGHT, { coreHash: null, recipe: { wikiSlug: "wiki-a", pluginOfferings: [offeringCid] }, grants: { islandUrl: "automerge:fixture" } });
    await pool.mountWiki(WIKI_NONE,       { coreHash: null, recipe: { wikiSlug: "wiki-b" },                                 grants: { islandUrl: "automerge:fixture" } });
    await pool.mountWiki(WIKI_EMPTY_LIST, { coreHash: null, recipe: { wikiSlug: "wiki-c", pluginOfferings: [] },            grants: { islandUrl: "automerge:fixture" } });

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
    await writeBlobsToCasOpfs(ISLAND_BLOBS);
    const unknownCid = "sha256:" + "ff".repeat(32);
    const { host } = recordingHost();
    const pool = new VesselIslandPoolCore({
      host,
      resolvePluginCids: (recipe) => resolveBrowserIslandPluginCids({ islandBlobs: ISLAND_BLOBS, recipe, lookup: () => undefined }),
      mountSilenceMs: 200,
    });

    await expect(
      pool.mountWiki("lar:///ha.ka.ba/bags/browser-wiki-bad", { coreHash: null, recipe: { wikiSlug: "wiki-bad", pluginOfferings: [unknownCid] }, grants: { islandUrl: "automerge:fixture" } }),
    ).rejects.toThrow(/plugin resolution refused/);
    expect(pool.tier("lar:///ha.ka.ba/bags/browser-wiki-bad")).toBe(null);
  });

  test("★ MUTATION PROOF — a SELECTED offering's bytes, never written to OPFS, refuse the mount by name — missing-bytes ★", async () => {
    // The boot set's own bytes ARE present; only the SELECTED offering's bytes are absent from
    // OPFS — "missing or corrupt bytes fail closed by name" names the layer where a verified
    // DESCRIPTOR (the offering, signature-checked) meets the actual bytes a local CAS holds. A
    // CID unique to THIS test — OPFS is real and persists across this file's tests, so reusing
    // HIGHLIGHT_SHA once another test has written it would prove nothing.
    await writeBlobsToCasOpfs(ISLAND_BLOBS);
    const missingSha = sha256HexBytesSync(new TextEncoder().encode("browser R4 fixture — bytes that never reach OPFS"));
    const { offering, cid: offeringCid } = await buildOffering("$:/plugins/r4-missing-fixture", missingSha);
    // Deliberately NOT written to OPFS — the offering verifies, but its bytes never arrived.
    const lookup: OfferingLookup = (c) => (c === offeringCid ? offering : undefined);
    const { host } = recordingHost();
    const pool = new VesselIslandPoolCore({
      host,
      resolvePluginCids: (recipe) => resolveBrowserIslandPluginCids({ islandBlobs: ISLAND_BLOBS, recipe, lookup }),
      mountSilenceMs: 200,
    });

    await expect(
      pool.mountWiki("lar:///ha.ka.ba/bags/browser-wiki-missing", { coreHash: null, recipe: { wikiSlug: "wiki-missing", pluginOfferings: [offeringCid] }, grants: { islandUrl: "automerge:fixture" } }),
    ).rejects.toThrow(/missing-bytes/);
  });

  test("★ MUTATION PROOF — a SELECTED offering's bytes, present under its CID but not rehashing to it, refuse the mount by name — corrupt-bytes ★", async () => {
    await writeBlobsToCasOpfs(ISLAND_BLOBS);
    // A CID unique to THIS test (see the missing-bytes proof above for why).
    const corruptSha = sha256HexBytesSync(new TextEncoder().encode("browser R4 fixture — the bytes this test's cid actually names"));
    const { offering, cid: offeringCid } = await buildOffering("$:/plugins/r4-corrupt-fixture", corruptSha);
    // Wrong bytes written under THAT cid's own filename — rehashes to something else entirely.
    await writeBlobsToCasOpfs({
      corrupt: { id: "$:/plugins/r4-corrupt-fixture", sha256: corruptSha, mimeType: "application/json", blob: new TextEncoder().encode("not the bytes this cid names") },
    });
    const lookup: OfferingLookup = (c) => (c === offeringCid ? offering : undefined);
    const { host } = recordingHost();
    const pool = new VesselIslandPoolCore({
      host,
      resolvePluginCids: (recipe) => resolveBrowserIslandPluginCids({ islandBlobs: ISLAND_BLOBS, recipe, lookup }),
      mountSilenceMs: 200,
    });

    await expect(
      pool.mountWiki("lar:///ha.ka.ba/bags/browser-wiki-corrupt", { coreHash: null, recipe: { wikiSlug: "wiki-corrupt", pluginOfferings: [offeringCid] }, grants: { islandUrl: "automerge:fixture" } }),
    ).rejects.toThrow(/corrupt-bytes/);
  });

  test("★ M6 MUTATION PROOF — a browser pool built with no resolvePluginCids wired REFUSES to construct; no blanket floor survives ★", () => {
    // The TS type on BrowserVesselIslandPoolOptions already forbids this at compile time (hence
    // the cast): this proves the RUNTIME guard inherited from VesselIslandPoolCore fires through
    // the browser's own construction path too, never silently falling back to a flat list — and
    // it fires BEFORE any worker would spawn, so no `workerScriptUrl` is needed to prove it.
    expect(() => new BrowserVesselIslandPool({} as unknown as ConstructorParameters<typeof BrowserVesselIslandPool>[0]))
      .toThrow(/resolvePluginCids is required/);
  });

  test("CONTROL — the browser pool constructs and mounts normally once resolvePluginCids is wired", async () => {
    await writeBlobsToCasOpfs(ISLAND_BLOBS);
    const { host, manifests } = recordingHost();
    const pool = new VesselIslandPoolCore({
      host,
      resolvePluginCids: (recipe) => resolveBrowserIslandPluginCids({ islandBlobs: ISLAND_BLOBS, recipe, lookup: () => undefined }),
    });
    const WIKI = "lar:///ha.ka.ba/bags/browser-wiki-control";
    await pool.mountWiki(WIKI, { coreHash: null, recipe: { wikiSlug: "wiki-control" }, grants: { islandUrl: "automerge:fixture" } });
    expect(pool.tier(WIKI)).toBe("wela");
    expect(new Set(manifests.get(WIKI)!.pluginCids ?? [])).toEqual(new Set([GRAMMAR_CID, SHADOWS_CID]));
    await pool.disposeAll();
  });
});
