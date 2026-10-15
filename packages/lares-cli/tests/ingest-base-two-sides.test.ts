/**
 * ingest-base-two-sides — the gesture pins and reads a base that holds two sides.
 *
 * Disk and records co-project one carrier. The scan reads the base's DISK side, so a file whose bytes
 * stand where the last agreement left them reads `unchanged` whatever framing they wear. The island's
 * row names the render its records hold (`canonicalHash`), and the gesture pins that as the base's
 * RECORDS side, so a later hand edit to the file rides both sides to the island's gate.
 */

import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { carrierHash } from "@lararium/mesh";
import { SyncedTree, syncedTreeKey, bagsFileToUri } from "@lararium/node";
import { scanFiles, scanSource, candidatesOf, listCarriers, recordLandedCarriers, applyConfirmedRenames } from "../src/ingest-core.js";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const BAG = "lar:///ha.ka.ba/bags/x";
const URI = "lar:///ha.ka.ba/lares/api/note";
const DISK = "! a note in a hand's own framing\n\n\n\nbody\n";
const RENDER = carrierHash("the render the records hold for that note");

function stand(text = DISK): { tree: SyncedTree; file: string; dir: string } {
  root = mkdtempSync(join(tmpdir(), "base-two-sides-"));
  const dir = join(root, "bags", "@x", "ha.ka.ba", "lares", "api");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "note.mem");
  writeFileSync(file, text);
  return { tree: new SyncedTree(join(root, "synced.json")), file, dir };
}
/** The one file every vector here scans: a base stands at a path. */
const FILE = (): string => join(root, "bags", "@x", "ha.ka.ba", "lares", "api", "note.mem");
const scan = (tree: SyncedTree) => scanFiles(root, listCarriers(join(root, "bags", "@x"))!, BAG, tree, bagsFileToUri).rows;

describe("the gesture pins a two-sided base", () => {
  test("an ingest row's canonicalHash lands as the records side, the scanned bytes as the disk side", () => {
    const { tree } = stand();
    const candidates = candidatesOf(scan(tree));
    expect(candidates.map((c) => c.uri)).toEqual([URI]);
    expect(recordLandedCarriers(tree, BAG, candidates, [{ uri: URI, decision: "ingest", canonicalHash: RENDER }])).toBe(1);
    expect(tree.base(syncedTreeKey(BAG, URI))).toEqual({ path: FILE(), disk: carrierHash(DISK), records: RENDER });
  });

  test("a noop row pins the same way: the records already say what the disk says", () => {
    const { tree } = stand();
    recordLandedCarriers(tree, BAG, candidatesOf(scan(tree)), [{ uri: URI, decision: "noop", reason: "canonical-equivalent", canonicalHash: RENDER }]);
    expect(tree.base(syncedTreeKey(BAG, URI))).toEqual({ path: FILE(), disk: carrierHash(DISK), records: RENDER });
  });

  test("a row that names no render keeps the records side a standing base holds for the same bytes", () => {
    const { tree } = stand();
    tree.set(syncedTreeKey(BAG, URI), FILE(), carrierHash(DISK), RENDER);
    // The scan reads `unchanged`; a row for it (an echo noop) carries no render of its own.
    const rows = scan(tree);
    expect(rows[0]!.status).toBe("unchanged");
    recordLandedCarriers(tree, BAG, rows, [{ uri: URI, decision: "noop", reason: "disk-matches-synced" }]);
    expect(tree.base(syncedTreeKey(BAG, URI))).toEqual({ path: FILE(), disk: carrierHash(DISK), records: RENDER });
  });

  test("a row that names no render over bytes no base names pins one hash for both sides", () => {
    const { tree } = stand();
    recordLandedCarriers(tree, BAG, candidatesOf(scan(tree)), [{ uri: URI, decision: "ingest" }]);
    expect(tree.base(syncedTreeKey(BAG, URI))).toEqual({ path: FILE(), disk: carrierHash(DISK), records: carrierHash(DISK) });
  });

  test("CONTROL: a refuse row and a conflict row pin nothing", () => {
    const { tree } = stand();
    const candidates = candidatesOf(scan(tree));
    expect(recordLandedCarriers(tree, BAG, candidates, [{ uri: URI, decision: "refuse", canonicalHash: RENDER }])).toBe(0);
    expect(recordLandedCarriers(tree, BAG, candidates, [{ uri: URI, decision: "conflict", canonicalHash: RENDER }])).toBe(0);
    expect(tree.base(syncedTreeKey(BAG, URI))).toBeNull();
  });
});

describe("the scan reads a two-sided base", () => {
  test("a file standing in another framing reads unchanged against the base's disk side", () => {
    const { tree } = stand();
    tree.set(syncedTreeKey(BAG, URI), FILE(), carrierHash(DISK), RENDER);
    const rows = scan(tree);
    expect(rows[0]!.status).toBe("unchanged");
    expect(candidatesOf(rows)).toEqual([]);
  });

  test("a hand edit reads changed, and BOTH sides ride the row to the island", () => {
    const { tree, file } = stand();
    tree.set(syncedTreeKey(BAG, URI), FILE(), carrierHash(DISK), RENDER);
    writeFileSync(file, "! a note a hand edited\n");
    const row = scan(tree)[0]!;
    expect(row.status).toBe("changed");
    expect(row.syncedHash).toBe(carrierHash(DISK));
    expect(row.syncedRecordsHash).toBe(RENDER);
  });

  test("CONTROL: a base whose two sides read equal rides one hash, and the row carries no records side", () => {
    const { tree, file } = stand();
    tree.set(syncedTreeKey(BAG, URI), FILE(), carrierHash(DISK));
    writeFileSync(file, "! a note a hand edited\n");
    const row = scan(tree)[0]!;
    expect(row.syncedHash).toBe(carrierHash(DISK));
    expect("syncedRecordsHash" in row).toBe(false);
  });

  test("CONTROL: with no base the row reads new and carries neither side", () => {
    const { tree } = stand();
    const row = scan(tree)[0]!;
    expect(row.status).toBe("new");
    expect(row.syncedHash).toBeNull();
    expect("syncedRecordsHash" in row).toBe(false);
  });
});

describe("a confirmed rename moves the whole base", () => {
  test("the records side travels with the records: the moved file holds the bytes the source's base named", () => {
    const { tree, file, dir } = stand();
    tree.set(syncedTreeKey(BAG, URI), FILE(), carrierHash(DISK), RENDER);
    renameSync(file, join(dir, "moved.mem"));
    const moved = "lar:///ha.ka.ba/lares/api/moved";
    const full = scanSource(root, join(root, "bags", "@x"), BAG, tree, bagsFileToUri)!;
    const renamed = full.rows.find((r) => r.uri === moved)!;
    expect(renamed.status).toBe("renamed");
    expect(renamed.renameFrom).toBe(URI);
    expect(full.renameDeletions).toEqual([{ uri: URI, syncedHash: carrierHash(DISK) }]);
    const count = applyConfirmedRenames(tree, BAG, candidatesOf(full.rows), { renames: [{ fromUri: URI, toUri: moved }] });
    expect(count).toBe(1);
    expect(tree.base(syncedTreeKey(BAG, URI))).toBeNull();
    expect(tree.base(syncedTreeKey(BAG, moved))).toEqual({ path: join(dir, "moved.mem"), disk: carrierHash(DISK), records: RENDER });
  });
});

describe("a base stands at one path", () => {
  test("a file at another path than its carrier's base reads as new, and a gone path with no base there skips", () => {
    const { tree } = stand();
    // The agreement stood at a path a siting rule once named; the file the scan meets sits elsewhere.
    tree.set(syncedTreeKey(BAG, URI), join(root, "bags", "@x", "ruled", "note.mem"), carrierHash(DISK), RENDER);
    const [row] = scan(tree);
    expect(row!.status).toBe("new");
    expect(row!.syncedHash).toBeNull();
    // A vanished path reads as a deletion only where the base stands AT that path.
    const gone = join(root, "bags", "@x", "ha.ka.ba", "lares", "api", "gone.mem");
    const goneUri = "lar:///ha.ka.ba/lares/api/gone";
    tree.set(syncedTreeKey(BAG, goneUri), join(root, "bags", "@x", "ruled", "gone.mem"), carrierHash("gone"));
    expect(scanFiles(root, [gone], BAG, tree, bagsFileToUri)).toMatchObject({ rows: [], skipped: [gone] });
    tree.set(syncedTreeKey(BAG, goneUri), gone, carrierHash("gone"));
    expect(scanFiles(root, [gone], BAG, tree, bagsFileToUri).rows.map((r) => r.status)).toEqual(["deleted"]);
  });
});
