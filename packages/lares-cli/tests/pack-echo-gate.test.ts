/**
 * pack-echo-gate — the gesture records a landed PACK's synced observation, so an
 * unchanged bundle noops on the next scan instead of re-landing every settle.
 *
 * A pack file never projects back (its foreign-titled members don't map to the
 * carrier URI), so the projector never sets its synced hash — the gesture must.
 */

import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SyncedTree, syncedTreeKey, bagsFileToUri } from "@lararium/node";
import { scanFiles, candidatesOf, recordLandedCarriers, listCarriers } from "../src/ingest-core.js";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const BAG = "lar:///ha.ka.ba/bags/x";

function seedBundle(): { root: string; treePath: string } {
  root = mkdtempSync(join(tmpdir(), "pack-echo-"));
  const dir = join(root, "bags", "@x", "ha.ka.ba", "lares", "api");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "bundle.json"), JSON.stringify([{ title: "Alpha", text: "a" }, { title: "Beta", text: "b" }]));
  return { root, treePath: join(root, "synced.json") };
}

describe("pack echo-gate — a landed bundle's synced hash rides the gesture", () => {
  test("recordLandedCarriers stamps the pack's synced hash → next scan reads unchanged", () => {
    const { root: r, treePath } = seedBundle();
    const tree = new SyncedTree(treePath);
    const files = listCarriers(join(r, "bags", "@x"))!;
    const { rows } = scanFiles(r, files, BAG, tree, bagsFileToUri);
    const candidates = candidatesOf(rows);
    const uri = candidates[0]!.uri;                              // lar:///ha.ka.ba/lares/api/bundle
    expect(candidates[0]!.status).toBe("new");                  // never seen → a candidate

    // simulate the island's result: the bundle landed as a PACK
    const resultCarriers = [{ uri, decision: "ingest", pack: "ha.ka.ba/lares/api/bundle.json" }];
    const recorded = recordLandedCarriers(tree, BAG, candidates, resultCarriers);
    expect(recorded).toBe(1);
    // the synced hash now equals the pack's disk hash
    expect(tree.get(syncedTreeKey(BAG, uri))).toBe(candidates[0]!.diskHash);

    // a fresh scan (same tree) now reads the UNCHANGED pack → NOT a candidate
    const { rows: rows2 } = scanFiles(r, files, BAG, tree, bagsFileToUri);
    expect(rows2[0]!.status).toBe("unchanged");
    expect(candidatesOf(rows2)).toEqual([]);
  });

  test("a single-meme ingest result records its observation → next scan reads unchanged", () => {
    const { root: r, treePath } = seedBundle();
    const tree = new SyncedTree(treePath);
    const files = listCarriers(join(r, "bags", "@x"))!;
    const { rows } = scanFiles(r, files, BAG, tree, bagsFileToUri);
    const candidates = candidatesOf(rows);
    const uri = candidates[0]!.uri;
    // a single carrier (no `pack` field) landed: the gesture records it
    const resultCarriers = [{ uri, decision: "ingest" }];
    expect(recordLandedCarriers(tree, BAG, candidates, resultCarriers)).toBe(1);
    expect(tree.get(syncedTreeKey(BAG, uri))).toBe(candidates[0]!.diskHash);
    const { rows: rows2 } = scanFiles(r, files, BAG, tree, bagsFileToUri);
    expect(rows2[0]!.status).toBe("unchanged");
  });
});
