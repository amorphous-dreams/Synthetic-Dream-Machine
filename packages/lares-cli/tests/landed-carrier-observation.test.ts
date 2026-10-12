/**
 * landed-carrier-observation — the gesture records the observation of every carrier
 * the island decided `ingest` or `noop`, pack or single meme, so a bag no mounted
 * wiki mirrors still keeps a Synced tree the next scan can read.
 */

import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SyncedTree, syncedTreeKey, bagsFileToUri } from "@lararium/node";
import { scanFiles, candidatesOf, recordLandedCarriers, listCarriers } from "../src/ingest-core.js";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const BAG = "lar:///ha.ka.ba/bags/x";

function seed() {
  root = mkdtempSync(join(tmpdir(), "landed-carrier-"));
  const dir = join(root, "bags", "@x", "ha.ka.ba", "lares", "api");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "note.mem");
  writeFileSync(file, "! note\n\nbody\n");
  const tree = new SyncedTree(join(root, "synced.json"), 0);
  const files = listCarriers(join(root, "bags", "@x"))!;
  const { rows } = scanFiles(root, files, BAG, tree, bagsFileToUri);
  return { file, tree, files, candidates: candidatesOf(rows) };
}

describe("a landed carrier records its observation", () => {
  test("a vanished recorded file reads deleted", () => {
    const { file, tree, files, candidates } = seed();
    const uri = candidates[0]!.uri;
    expect(recordLandedCarriers(tree, BAG, candidates, [{ uri, decision: "ingest" }])).toBe(1);
    unlinkSync(file);
    const { rows } = scanFiles(root, [file], BAG, tree, bagsFileToUri);
    expect(files.length).toBe(1);
    expect(rows[0]!.status).toBe("deleted");
  });

  test("noop records; conflict and refuse record nothing; an unmatched uri records nothing", () => {
    const { tree, candidates } = seed();
    const uri = candidates[0]!.uri;
    expect(recordLandedCarriers(tree, BAG, candidates, [{ uri, decision: "conflict" }])).toBe(0);
    expect(recordLandedCarriers(tree, BAG, candidates, [{ uri, decision: "refuse" }])).toBe(0);
    expect(recordLandedCarriers(tree, BAG, candidates, [{ uri: "lar:///elsewhere", decision: "ingest" }])).toBe(0);
    expect(tree.get(syncedTreeKey(BAG, uri))).toBeNull();
    expect(recordLandedCarriers(tree, BAG, candidates, [{ uri, decision: "noop" }])).toBe(1);
    expect(tree.get(syncedTreeKey(BAG, uri))).toBe(candidates[0]!.diskHash);
  });

  test("a disk that moved after the scan records nothing", () => {
    const { file, tree, candidates } = seed();
    const uri = candidates[0]!.uri;
    writeFileSync(file, "! note\n\nbody rewritten by the projector\n");
    expect(recordLandedCarriers(tree, BAG, candidates, [{ uri, decision: "ingest" }])).toBe(0);
    expect(tree.get(syncedTreeKey(BAG, uri))).toBeNull();
  });
});
