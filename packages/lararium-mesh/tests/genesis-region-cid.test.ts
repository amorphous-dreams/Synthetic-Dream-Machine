/**
 * genesis-region-cid — the engine/plugins content-CID split, and the false-schism cure.
 *
 * The engine CID reads as the hearth's TRUE-NAME and a pure function of the core BLOB's bytes; a plugin
 * change must never perturb it. The plugins CID tracks the composition and stays order-blind.
 *
 * THE LOAD-BEARING PROPERTY HERE READS AS A REFUSAL. Neither preimage carries a VERSION LABEL, because a
 * label makes a pure re-tag — identical bytes, renamed — mint a fresh identity, and any system that
 * identifies peers by these digests would then manufacture a schism out of an editorial act. The sha256
 * already binds every byte a label could describe. These tests assert the label cannot move anything.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/genesis-doc
 */

import { describe, it, expect } from "vitest";
import { computeEngineCid, computePluginsCid, buildGenesisDoc, type GenesisPluginEntry, type GenesisInputs } from "../src/genesis-doc.js";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "../src/lar-uris.js";

describe("genesis region content-CIDs — bytes name the region, labels never do", () => {
  const plugins = [
    { id: "lar:///plugins/b", version: "1.0", sha256: "bb" },
    { id: "lar:///plugins/a", version: "2.1", sha256: "aa" },
  ];

  it("engineCid runs deterministic and moves with the core BYTES", () => {
    expect(computeEngineCid("5.3.0", "abcd")).toBe(computeEngineCid("5.3.0", "abcd"));
    expect(computeEngineCid("5.3.0", "abcd")).not.toBe(computeEngineCid("5.3.0", "ef01"));
  });

  it("★ a pure RE-TAG never moves the engineCid — the false-schism cure ★", () => {
    // Identical bytes, a new label. A digest that moved here would excommunicate every peer over an
    // editorial act, and no reader could tell that apart from a real change.
    expect(computeEngineCid("5.5.0-prerelease", "abcd")).toBe(computeEngineCid("5.5.0", "abcd"));
    expect(computeEngineCid("", "abcd")).toBe(computeEngineCid("whatever-a-packager-called-it", "abcd"));
  });

  it("pluginsCid stays order-independent (sorted by id) and deterministic", () => {
    const reversed = [...plugins].reverse();
    expect(computePluginsCid(plugins)).toBe(computePluginsCid(reversed));   // write-order never perturbs it
  });

  it("★ a plugin RE-TAG never moves the pluginsCid, and a plugin's BYTES always do ★", () => {
    const reTagged = plugins.map((p) => (p.id === "lar:///plugins/a" ? { ...p, version: "2.2" } : p));
    expect(computePluginsCid(reTagged)).toBe(computePluginsCid(plugins));

    const rebuilt = plugins.map((p) => (p.id === "lar:///plugins/a" ? { ...p, sha256: "zz" } : p));
    expect(computePluginsCid(rebuilt)).not.toBe(computePluginsCid(plugins));
  });

  it("a plugin change NEVER perturbs the engineCid — the true-name holds through composition", () => {
    const engineBefore = computeEngineCid("5.3.0", "abcd");
    const rebuilt = plugins.map((p) => (p.id === "lar:///plugins/a" ? { ...p, sha256: "zz" } : p));
    expect(computePluginsCid(rebuilt)).not.toBe(computePluginsCid(plugins));
    expect(computeEngineCid("5.3.0", "abcd")).toBe(engineBefore);
  });

  it("an ADDED plugin moves the composition — the pair names WHAT composed, never WHO belongs", () => {
    const grown = [...plugins, { id: "lar:///plugins/c", version: "0.1", sha256: "cc" }];
    expect(computePluginsCid(grown)).not.toBe(computePluginsCid(plugins));
  });
});

/**
 * THE GRAMMAR REGION — kāhuli's fast ratchet, and what it deliberately EXCLUDES.
 *
 * Ruled: kāhuli overturns exactly two tiers, ENGINE and GRAMMAR. Every other plugin is CONTENT — offered
 * peer-to-peer as an `@cad` cap by any operator — so it ships in the island's blobs but stands OUTSIDE the
 * ratchet's identity. Folding it into the grammar epoch would make one operator's extra plugin overturn
 * everybody's grammar, which is precisely the schism the region CIDs exist to prevent.
 *
 * `computePluginsCid` keeps its general contract (fold whatever entries you hand it); the SELECTION is the
 * ruling, and it lives at one site so the mint and the verify can never disagree about what the region is.
 */
describe("the GRAMMAR region — the ratchet folds the grammar alone", () => {
  const blobOf = (s: string): Uint8Array => new TextEncoder().encode(s);
  const entry = (id: string, sha: string): GenesisPluginEntry =>
    ({ id, version: "1.0", sha256: sha, mimeType: "application/json", blob: blobOf(id) });
  const inputsWith = (plugins: readonly GenesisPluginEntry[]): GenesisInputs => ({
    actorSeed: "00".repeat(32), coreBlob: blobOf("tw5-core"), coreVersion: "5.5.0", coreSha256: "ab".repeat(32), plugins,
  });
  const GRAMMAR = LARES_MEMETIC_WIKITEXT_PLUGIN_URI;

  it("★ BASE SEED moves NEITHER region — it ships, and it ratchets nothing ★", () => {
    // `lararium-boot-shadows` is not a plugin at all: it is an array of API/shadow tiddlers, the base seed
    // that rides beside the lares/lararium bags. The old glob read every .json in the plugins dir as a
    // plugin and swept it into the composition, so base-seed material overturned an operator's plugin
    // epoch. Class is DECLARED now (read the declaration, never the path), and base belongs to neither
    // ratchet: its bytes are attested by the manifest blob sha, and a change moves the island, not an epoch.
    const grammar = entry(GRAMMAR, "11".repeat(32));
    const operatorPlugin = entry("$:/plugins/sq/streams", "22".repeat(32));
    const base: GenesisPluginEntry = { ...entry("lararium-boot-shadows", "44".repeat(32)), kind: "base" };

    const without = buildGenesisDoc(inputsWith([grammar, operatorPlugin]));
    const withBase = buildGenesisDoc(inputsWith([grammar, operatorPlugin, base]));
    expect(withBase.grammarCid, "base seed is not grammar").toBe(without.grammarCid);
    expect(withBase.pluginsCid, "base seed is not an operator plugin").toBe(without.pluginsCid);
    expect(withBase.engineCid,  "base seed is not the engine").toBe(without.engineCid);
    // …and it SHIPS regardless: a required blob, carried and attested, naming no epoch.
    expect(withBase.casEntries.length).toBeGreaterThan(without.casEntries.length);
  });

  it("★ the two regions are INDEPENDENT — an operator's collection never overturns the grammar ★", () => {
    const grammar = entry(GRAMMAR, "11".repeat(32));
    const alone = buildGenesisDoc(inputsWith([grammar]));
    const withPlugin = buildGenesisDoc(inputsWith([grammar, entry("$:/plugins/sq/streams", "22".repeat(32))]));
    // The operator's collection moved; the grammar epoch did not. This is the whole point of the split:
    // any operator offers their own plugins ON TOP of the required base without overturning anyone's grammar.
    expect(withPlugin.pluginsCid, "the operator's own region moves with their collection").not.toBe(alone.pluginsCid);
    expect(withPlugin.grammarCid, "the grammar epoch is theirs to keep").toBe(alone.grammarCid);
    expect(withPlugin.engineCid).toBe(alone.engineCid);
  });

  it("CONTROL — the GRAMMAR's own bytes DO overturn it, and the engine true-name holds throughout", () => {
    const alone = buildGenesisDoc(inputsWith([entry(GRAMMAR, "11".repeat(32))]));
    const moved = buildGenesisDoc(inputsWith([entry(GRAMMAR, "33".repeat(32))]));
    expect(moved.grammarCid, "the grammar's bytes are its ratchet").not.toBe(alone.grammarCid);
    expect(moved.engineCid, "the true-name never moves with the grammar").toBe(alone.engineCid);
  });
});
