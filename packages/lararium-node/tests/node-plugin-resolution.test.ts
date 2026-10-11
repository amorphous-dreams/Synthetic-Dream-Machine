/**
 * node-plugin-resolution — M1: the ONE node resolver, driven over a REAL fs CAS (sha256-keyed,
 * exactly the bytes a node vessel reads via `readCasBlobFromFs`/`casDirForStorage`) and a REAL
 * Crossroads board doc holding the signed highlight offering — never the mesh package's own
 * reproduced combinator (`vessel-island-pool-plugin-resolution.test.ts`'s `makeResolver`, which
 * hashes with an identity stub). This module is the production contract BOTH node call sites
 * (`open-node-vessel.ts`'s daemon VM and its wiki island pool) import and call — the proof below
 * is the one proof neither call site can privately diverge from.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  hex, sha256HexBytesSync, ENGINE_CORE_ID,
  signPluginOffering, pluginOfferingCid, computePluginsCid,
  pluginOfferingAnnounceOf, type OfferedBlob, type PluginOffering, type LarDoc,
} from "@lararium/mesh";
import { casDirForStorage } from "../src/node-cas.js";
import { resolveNodeIslandPluginCids, nodeOfferingLookup } from "../src/node-plugin-resolution.js";

const GRAMMAR_ID  = "lar:///ha.ka.ba/lararium/plugins/lares/memetic-wikitext";
const SHADOWS_ID  = "lararium-boot-shadows";

const SEED = new Uint8Array(32).fill(44);
const sign = async (bytes: Uint8Array): Promise<string> => hex(await ed.signAsync(bytes, SEED));
const offerorKey = async (): Promise<string> => hex(await ed.getPublicKeyAsync(SEED));

/** Writes real bytes to `casDir/<sha256(bytes)>` and returns that cid — the real fs CAS a node
 *  vessel's own `readCasBlobFromFs` resolves, keyed by the SAME sha256 this module verifies with. */
function putRealBlob(casDir: string, bytes: Uint8Array): string {
  const cid = sha256HexBytesSync(bytes);
  mkdirSync(casDir, { recursive: true });
  writeFileSync(join(casDir, cid), bytes);
  return cid;
}

async function buildHighlightOffering(blobBytes: Uint8Array, blobSha: string): Promise<{ offering: PluginOffering; cid: string }> {
  const blob: OfferedBlob = {
    id: "$:/plugins/tiddlywiki/highlight", version: "0.9.0", sha256: blobSha,
    provenance: {
      source: "https://github.com/tiddlywiki/tiddlywiki5", commit: "23859c84a",
      path: "plugins/tiddlywiki/highlight", licence: "BSD-3-Clause", author: "Jeremy Ruston and contributors",
    },
  };
  const offering = await signPluginOffering(
    { offeror: await offerorKey(), pluginsCid: computePluginsCid([blob]), blobs: [blob] }, sign);
  return { offering, cid: pluginOfferingCid(offering) };
}

/** A REAL Crossroads board doc — `offeringAnnouncesFromDoc` reads this exact tiddler shape off a
 *  live LarDoc; this fixture builds one directly rather than going through an Automerge handle
 *  (the shape is what the function certifies, not the CRDT machinery around it). */
function crossroadsDocHolding(offerings: readonly PluginOffering[]): LarDoc {
  const tiddlers: Record<string, unknown> = {};
  for (const offering of offerings) {
    const announce = pluginOfferingAnnounceOf(offering);
    const key = `lar:///ha.ka.ba/dreamnet/plugin-offering-announces/${encodeURIComponent(announce.offeringCid)}`;
    tiddlers[key] = { tiddler: { text: JSON.stringify(announce) } };
  }
  return { tiddlers } as unknown as LarDoc;
}

describe("★ M1 — the node resolver, driven over a real fs CAS and a real Crossroads board ★", () => {
  let casDir: string;
  let cleanup: () => void;

  beforeEach(() => {
    const storageDir = mkdtempSync(join(tmpdir(), "lar-node-plugin-resolution-"));
    casDir = casDirForStorage(storageDir);
    cleanup = () => rmSync(storageDir, { recursive: true, force: true });
  });
  afterEach(() => cleanup());

  test("★ TWO WIKIS DISJOINT, plus an EMPTY recipe, all read the boot set — the CAS holds the offering throughout ★", async () => {
    const grammarCid = putRealBlob(casDir, new TextEncoder().encode("the grammar plugin's bytes"));
    const shadowsCid = putRealBlob(casDir, new TextEncoder().encode("the boot-shadows bytes"));
    const coreCid    = putRealBlob(casDir, new TextEncoder().encode("the engine core bytes"));
    const highlightBytes = new TextEncoder().encode("the highlight plugin's real tiddler bytes");
    const highlightSha = sha256HexBytesSync(highlightBytes);
    putRealBlob(casDir, highlightBytes);

    const { offering, cid: offeringCid } = await buildHighlightOffering(highlightBytes, highlightSha);
    const crossroadsDoc = crossroadsDocHolding([offering]);
    const lookup = nodeOfferingLookup(crossroadsDoc);

    const islandBlobs = {
      core:    { id: ENGINE_CORE_ID, sha256: coreCid,    mimeType: "application/javascript" },
      grammar: { id: GRAMMAR_ID,     sha256: grammarCid, mimeType: "application/json" },
      shadows: { id: SHADOWS_ID,     sha256: shadowsCid, mimeType: "application/json" },
    };
    const readBytes = (cid: string) => { try { return new Uint8Array(readFileSync(join(casDir, cid))); } catch { return null; } };

    const withOffering = await resolveNodeIslandPluginCids({
      islandBlobs, recipe: { wikiSlug: "wiki-a", pluginOfferings: [offeringCid] }, lookup, readBytes,
    });
    const withoutOffering = await resolveNodeIslandPluginCids({
      islandBlobs, recipe: { wikiSlug: "wiki-b" }, lookup, readBytes,
    });
    const explicitEmpty = await resolveNodeIslandPluginCids({
      islandBlobs, recipe: { wikiSlug: "wiki-c", pluginOfferings: [] }, lookup, readBytes,
    });

    expect(withOffering.ok).toBe(true);
    expect(withoutOffering.ok).toBe(true);
    expect(explicitEmpty.ok).toBe(true);
    if (!withOffering.ok || !withoutOffering.ok || !explicitEmpty.ok) return;

    const floor = [grammarCid, shadowsCid].sort();
    // The boot set stands in ALL THREE.
    for (const cids of [withOffering.pluginCids, withoutOffering.pluginCids, explicitEmpty.pluginCids]) {
      expect([...cids].sort().filter((c) => floor.includes(c))).toEqual(floor);
    }
    // DISJOINT in the optional portion: only wiki-a carries the highlight blob.
    expect(withOffering.pluginCids).toContain(highlightSha);
    expect(withoutOffering.pluginCids).not.toContain(highlightSha);
    expect(explicitEmpty.pluginCids).not.toContain(highlightSha);
    // The empty and absent recipes resolve to the SAME set — an explicit [] is no different from none.
    expect([...withoutOffering.pluginCids].sort()).toEqual([...explicitEmpty.pluginCids].sort());
  });

  test("★ missing-bytes refuses the mount BY NAME — the CAS lacks the selected blob's bytes ★", async () => {
    const highlightBytes = new TextEncoder().encode("bytes that never reach the CAS");
    const highlightSha = sha256HexBytesSync(highlightBytes);
    // Deliberately NOT written to casDir.
    const { offering, cid: offeringCid } = await buildHighlightOffering(highlightBytes, highlightSha);
    const lookup = nodeOfferingLookup(crossroadsDocHolding([offering]));
    const readBytes = (cid: string) => { try { return new Uint8Array(readFileSync(join(casDir, cid))); } catch { return null; } };

    const verdict = await resolveNodeIslandPluginCids({
      islandBlobs: undefined, recipe: { wikiSlug: "wiki-missing", pluginOfferings: [offeringCid] }, lookup, readBytes,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.error).toMatch(/missing-bytes/);
  });

  test("★ corrupt-bytes refuses the mount BY NAME — the CAS holds bytes that no longer hash to the claim ★", async () => {
    const highlightBytes = new TextEncoder().encode("the real bytes");
    const highlightSha = sha256HexBytesSync(highlightBytes);
    // Write DIFFERENT bytes under the claimed cid — a torn / tampered local CAS entry.
    mkdirSync(casDir, { recursive: true });
    writeFileSync(join(casDir, highlightSha), new TextEncoder().encode("tampered bytes, wrong digest"));
    const { offering, cid: offeringCid } = await buildHighlightOffering(highlightBytes, highlightSha);
    const lookup = nodeOfferingLookup(crossroadsDocHolding([offering]));
    const readBytes = (cid: string) => { try { return new Uint8Array(readFileSync(join(casDir, cid))); } catch { return null; } };

    const verdict = await resolveNodeIslandPluginCids({
      islandBlobs: undefined, recipe: { wikiSlug: "wiki-corrupt", pluginOfferings: [offeringCid] }, lookup, readBytes,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.error).toMatch(/corrupt-bytes/);
  });

  test("★ M2 — a recipe carrying pluginOfferingsFault refuses THIS wiki's resolution by name, malformed-offerings-field ★", async () => {
    const readBytes = () => null;
    const verdict = await resolveNodeIslandPluginCids({
      islandBlobs: undefined,
      recipe: { wikiSlug: "wiki-torn", pluginOfferingsFault: "plugin-offerings field is a number" },
      lookup: () => undefined,
      readBytes,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.error).toMatch(/malformed-offerings-field/);
  });

  test("CONTROL — an island with no offerings at all and no fault resolves to the boot set alone", async () => {
    const grammarCid = putRealBlob(casDir, new TextEncoder().encode("grammar bytes"));
    const shadowsCid = putRealBlob(casDir, new TextEncoder().encode("shadows bytes"));
    const readBytes = (cid: string) => { try { return new Uint8Array(readFileSync(join(casDir, cid))); } catch { return null; } };
    const verdict = await resolveNodeIslandPluginCids({
      islandBlobs: {
        grammar: { id: GRAMMAR_ID, sha256: grammarCid, mimeType: "application/json" },
        shadows: { id: SHADOWS_ID, sha256: shadowsCid, mimeType: "application/json" },
      },
      recipe: { wikiSlug: "solo" }, lookup: () => undefined, readBytes,
    });
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect([...verdict.pluginCids].sort()).toEqual([grammarCid, shadowsCid].sort());
  });

  test("★ MUTATION PROOF — both node call sites import and call THIS module's resolver, never a reproduced or inlined copy ★", () => {
    // M1's whole point: ONE module both node paths import, so a mutation that drops one
    // call site's recipe offerings (the R3 regression the episkopos measured) cannot hide behind
    // a second, independently-maintained copy of the combinator. Reading the real source proves
    // the wiring survives refactors that this unit alone cannot exercise (both paths need a live
    // worker pool / daemon VM to drive end to end).
    const src = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8");
    const importsFromModule = /from\s+["']\.\/node-plugin-resolution\.js["']/.test(src);
    const daemonCallSite = /resolveNodeIslandPluginCids\(\{[\s\S]{0,400}?\}\)/.exec(src);
    // The pool hook must pass the caller's RECIPE PARAMETER ITSELF, as the shorthand `recipe,`
    // property — never a reconstructed literal (`recipe: { wikiSlug: recipe.wikiSlug }`), which is
    // exactly the R3 mutation the episkopos measured staying green at the mesh-test level: a
    // rebuild that drops every field but wikiSlug (and so every wiki's offerings) still calls the
    // SAME function, so only reading what's handed to it — not merely that it was called — proves
    // the regression stays caught here.
    const poolHookBody = /resolvePluginCids:\s*\(recipe\)\s*=>\s*resolveNodeIslandPluginCids\(\{[\s\S]{0,400}?\}\)/.exec(src);
    expect(importsFromModule, "open-node-vessel.ts must import resolveNodeIslandPluginCids from node-plugin-resolution.js").toBe(true);
    expect(daemonCallSite, "the daemon VM boot must call resolveNodeIslandPluginCids").not.toBeNull();
    expect(poolHookBody, "the island pool's resolvePluginCids hook must call resolveNodeIslandPluginCids").not.toBeNull();
    expect(poolHookBody?.[0] ?? "", "the pool hook must hand the resolver the caller's own recipe, never a rebuilt one that can silently drop fields").toMatch(/\brecipe,/);
    // Exactly TWO call sites — a third would mean a NEW path grew its own resolution again.
    const callCount = (src.match(/resolveNodeIslandPluginCids\(/g) ?? []).length;
    expect(callCount).toBe(2);
  });
});
