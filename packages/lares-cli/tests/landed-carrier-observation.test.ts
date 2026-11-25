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
  const tree = new SyncedTree(join(root, "synced.json"));
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

  test("a base the projector already pinned at this agreement keeps the document and the heads it names", () => {
    // The projector pins the agreement first, with the document and heads its records side read; the gesture then
    // records the same agreement. A row the gesture rewrote would name neither, and the next boot could no longer tell
    // records that fell behind the agreement from records that moved on (`disk-projector.ts`, `pastRecords`).
    const { file, tree, candidates } = seed();
    const uri = candidates[0]!.uri;
    const key = syncedTreeKey(BAG, uri);
    tree.set(key, file, candidates[0]!.diskHash, candidates[0]!.diskHash, "automerge:working", ["h2"]);
    expect(recordLandedCarriers(tree, BAG, candidates, [{ uri, decision: "ingest" }])).toBe(1);
    expect(tree.baseAt(key, file)).toMatchObject({ disk: candidates[0]!.diskHash, doc: "automerge:working", heads: ["h2"] });
    // CONTROL: an agreement the row does not name yet moves the row, as before.
    tree.set(key, file, "sha256:an-older-disk", "sha256:an-older-render", "automerge:working", ["h1"]);
    expect(recordLandedCarriers(tree, BAG, candidates, [{ uri, decision: "ingest" }])).toBe(1);
    expect(tree.baseAt(key, file)?.disk).toBe(candidates[0]!.diskHash);
    expect("heads" in tree.baseAt(key, file)!).toBe(false);
  });

  test("a disk that moved after the scan records nothing", () => {
    const { file, tree, candidates } = seed();
    const uri = candidates[0]!.uri;
    writeFileSync(file, "! note\n\nbody rewritten by the projector\n");
    expect(recordLandedCarriers(tree, BAG, candidates, [{ uri, decision: "ingest" }])).toBe(0);
    expect(tree.get(syncedTreeKey(BAG, uri))).toBeNull();
  });
});
