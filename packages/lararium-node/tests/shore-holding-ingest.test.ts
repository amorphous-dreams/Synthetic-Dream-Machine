/**
 * AN INGEST FROM A HOLDING DIRECTORY LEAVES THE MIRROR'S BASE STANDING.
 *
 * A person keeps a copy of a mirrored carrier in a holding directory beside the mirror, changes a line there
 * and ingests that file. The gesture pins a base at the holding file; the projector's base at the mirror
 * file stands beside it, since a carrier holds one row per path. The mirror file stood unmoved since its
 * own base and only the records moved, so the projector writes the records' render there and nothing
 * stands off. The holding file keeps its bytes and its own row, so its next scan reads `unchanged`.
 *
 * The gesture and the projector each hold their own tree instance over one directory, as a CLI process
 * and an island do.
 *
 * Control: where a hand ALSO edited the mirror file, both sides moved past the mirror's base, and the
 * carrier stands off as `both-moved`; the hand's bytes stay.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ShoreRig, RIG_BAG, coreBlobSkip } from "./shore-rig.js";
import { SyncedTree, syncedTreeKey } from "../src/synced-tree.js";
import { scanSource } from "../../lares-cli/src/ingest-core.js";

const HOLDING_LINE = "A LINE ADDED IN THE HOLDING COPY.";
const HAND_LINE = "A HAND WROTE THIS LINE IN THE MIRROR FILE.";
const addLine = (text: string, line: string): string => text.replace(/\n! ([^\n]*)\n/, (m) => `${m}\n${line}\n`);

describe.skipIf(coreBlobSkip)("an ingest from a holding directory beside the mirror", () => {
  let rig: ShoreRig;
  let projectorTree: SyncedTree;
  const holdingOf = (uri: string): string => path.join(rig.scratch, "wikis", "inbox", `${uri.slice("lar:///".length)}.mem`);
  /** The ingest gesture as its own process runs it: a tree instance opened fresh over the vessel's directory. */
  const gesture = async (source: string): Promise<Awaited<ReturnType<ShoreRig["ingest"]>>> => {
    rig.tree = new SyncedTree(path.join(rig.scratch, "state", "synced-tree-1.json"), 0);
    try { return await rig.ingest(source); } finally { rig.tree = projectorTree; }
  };

  beforeAll(async () => {
    rig = await ShoreRig.stand(3);
    await rig.ingest();
    await rig.boot();
    projectorTree = rig.tree;
  }, 300_000);
  afterAll(async () => { await rig?.close(); });

  test("CONTROL: the seed pinned a base at each mirror file and raised nothing", () => {
    expect(rig.conflicts).toEqual([]);
    for (const uri of rig.uris) expect(projectorTree.baseAt(syncedTreeKey(RIG_BAG, uri), rig.fileOf(uri))).not.toBeNull();
  });

  test("the mirror takes the change, nothing stands off, and the holding file keeps its bytes and its own row", async () => {
    const [uri] = rig.uris;
    const key = syncedTreeKey(RIG_BAG, uri!);
    const holding = holdingOf(uri!);
    const held = addLine(rig.read(uri!), HOLDING_LINE);
    expect(held).toContain(HOLDING_LINE);
    mkdirSync(path.dirname(holding), { recursive: true });
    writeFileSync(holding, held, "utf8");

    const settled = await gesture(holding);
    expect(settled.scanned.map((r) => [r.uri, r.status])).toEqual([[uri, "new"]]);

    expect(rig.conflicts).toEqual([]);
    expect(rig.read(uri!)).toContain(HOLDING_LINE);              // the projector wrote the records' render
    expect(readFileSync(holding, "utf8")).toBe(held);            // the source stays as the hand left it
    const fresh = new SyncedTree(path.join(rig.scratch, "state", "synced-tree-1.json"), 0);
    expect(fresh.baseAt(key, holding)).not.toBeNull();
    expect(fresh.baseAt(key, rig.fileOf(uri!))).not.toBeNull();
    expect(fresh.bases(key)).toHaveLength(2);
    // The holding file's next scan reads its own row; the mirror's next scan reads the mirror's.
    expect(scanSource(rig.scratch, holding, RIG_BAG, fresh)!.rows.map((r) => r.status)).toEqual(["unchanged"]);
    expect(scanSource(rig.scratch, rig.fileOf(uri!), RIG_BAG, fresh)!.rows.map((r) => r.status)).toEqual(["unchanged"]);
    expect(rig.conflicts).toEqual([]);
  });

  test("CONTROL: a hand's edit in the mirror plus a holding ingest stands off as both-moved, and the hand's bytes stay", async () => {
    const uri = rig.uris[1]!;
    const holding = holdingOf(uri);
    const before = rig.read(uri);
    const hand = addLine(before, HAND_LINE);
    rig.write(uri, hand);
    mkdirSync(path.dirname(holding), { recursive: true });
    writeFileSync(holding, addLine(before, HOLDING_LINE), "utf8");

    await gesture(holding);

    expect(rig.read(uri)).toBe(hand);
    expect(rig.conflicts.map((c) => c.uri)).toEqual([uri]);
    expect(rig.conflicts[0]!.reason).toMatch(/both-moved/);
  });
});
