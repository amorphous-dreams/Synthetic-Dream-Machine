/**
 * rename-survival (R2) — a carrier that MOVES with byte-identical content keeps its
 * Synced observation, so the Confluence echo gate reads the move as a NOOP, never a
 * fresh re-land (which would duplicate records + reset the change-id) and never a
 * phantom conflict. The observation is content-addressed (the rename-invariant handle
 * is `carrierHash`, agile-tagged post-#46), so a full scan recovers the moved
 * observation by CONTENT and the CLI moves it on the island's confirmed rename.
 *
 * The ruling under proof (parent GO, R2):
 *   - a renamed carrier echo-NOOPs — recognized as `renamed`, its gone source rides
 *     as a rename-deletion, the observation survives; the NEXT scan reads `unchanged`
 *     and never re-lands (the concrete one-shot G0 bug).
 *   - an in-place EDIT still re-lands (`changed`) — never swallowed as a rename.
 *   - a COPY (source stays live) never mis-reads as a rename — it lands as new.
 */

import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanSource, candidatesOf, applyConfirmedRenames } from "../src/ingest-core.js";
import { SyncedTree, syncedTreeKey } from "@lararium/node";

const TO_BAG = "lar:///ha.ka.ba/bags/x/notes";
const uriOf = (stem: string) => `lar:///ha.ka.ba/lares/api/${stem}`;

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

/** A bags/ source dir + its Synced tree, seeded with one landed carrier. */
function seed(name: string, body: string): { src: string; bagDir: string; tree: SyncedTree; landedHash: string } {
  root = mkdtempSync(join(tmpdir(), "rename-"));
  const bagDir = join(root, "bags", "@x", "ha.ka.ba", "lares", "api");
  mkdirSync(bagDir, { recursive: true });
  writeFileSync(join(bagDir, name), body);
  const tree = new SyncedTree(join(root, "synced.json"));
  const src = join(root, "bags", "@x");
  // first scan → the carrier is new; record the landed observation as the projector would
  const scan = scanSource(root, src, TO_BAG, tree)!;
  const stem = name.replace(/\.[^.]+$/, "");
  const row = scan.rows.find((r) => r.uri === uriOf(stem))!;
  expect(row.status).toBe("new");
  tree.set(syncedTreeKey(TO_BAG, uriOf(stem)), row.file, row.diskHash);
  return { src, bagDir, tree, landedHash: row.diskHash };
}

describe("rename-survival — the observation moves with the carrier (R2)", () => {
  test("a renamed carrier echo-noops — observation survives, next scan does NOT re-land", () => {
    const body = "# a stable note\n\nunchanged across the move\n";
    const { src, bagDir, tree, landedHash } = seed("old.md", body);

    // rename on disk — byte-identical content, new location
    rmSync(join(bagDir, "old.md"));
    writeFileSync(join(bagDir, "new.md"), body);

    // scan → RENAME recognized, never a fresh "new"
    const scan2 = scanSource(root, src, TO_BAG, tree)!;
    const row2 = scan2.rows.find((r) => r.uri === uriOf("new"))!;
    expect(row2.status).toBe("renamed");
    expect(row2.renameFrom).toBe(uriOf("old"));
    // the gone source rides the wave as a rename-deletion (so the island re-links records)
    expect(scan2.renameDeletions).toEqual([{ uri: uriOf("old"), syncedHash: landedHash }]);
    // and it rides as a candidate (an ADD) — the island returns `rename-target`, never a re-land
    expect(candidatesOf(scan2.rows).map((c) => c.uri)).toContain(uriOf("new"));

    // the island confirms the rename → the CLI moves the observation to the new location
    const moved = applyConfirmedRenames(tree, TO_BAG, candidatesOf(scan2.rows), {
      renames: [{ fromUri: uriOf("old"), toUri: uriOf("new") }],
    });
    expect(moved).toBe(1);

    // NEXT scan → the moved carrier reads UNCHANGED (echo-noop); nothing to submit
    const scan3 = scanSource(root, src, TO_BAG, tree)!;
    const row3 = scan3.rows.find((r) => r.uri === uriOf("new"))!;
    expect(row3.status).toBe("unchanged");
    expect(scan3.renameDeletions).toBeUndefined();
    expect(candidatesOf(scan3.rows)).toEqual([]);
    // the stale source observation is gone; the new one carries the (identical) hash
    expect(tree.get(syncedTreeKey(TO_BAG, uriOf("old")))).toBeNull();
    expect(tree.get(syncedTreeKey(TO_BAG, uriOf("new")))).toBe(landedHash);
  });

  test("a confirmed rename drops the source's base where its file left, and a holding copy keeps its own", () => {
    const body = "# a kept note\n\nthe same bytes in two places\n";
    const { src, bagDir, tree, landedHash } = seed("old.md", body);
    const oldKey = syncedTreeKey(TO_BAG, uriOf("old"));
    // A person keeps a copy of the carrier in a holding directory beside the mirror, and ingested it there.
    const holding = join(root, "holding", "old.md");
    mkdirSync(join(root, "holding"), { recursive: true });
    writeFileSync(holding, body);
    tree.set(oldKey, holding, landedHash);
    expect(tree.bases(oldKey)).toHaveLength(2);

    rmSync(join(bagDir, "old.md"));
    writeFileSync(join(bagDir, "new.md"), body);
    const scan2 = scanSource(root, src, TO_BAG, tree)!;
    expect(scan2.rows.find((r) => r.uri === uriOf("new"))!.status).toBe("renamed");
    expect(applyConfirmedRenames(tree, TO_BAG, candidatesOf(scan2.rows), { renames: [{ fromUri: uriOf("old"), toUri: uriOf("new") }] })).toBe(1);

    for (const t of [tree, new SyncedTree(join(root, "synced.json"))]) {
      expect(t.baseAt(oldKey, join(bagDir, "old.md"))).toBeNull();                 // the file left: its base left with it
      expect(t.baseAt(oldKey, holding)).toEqual({ path: holding, disk: landedHash, records: landedHash });
      expect(t.baseAt(syncedTreeKey(TO_BAG, uriOf("new")), join(bagDir, "new.md"))).not.toBeNull();
    }
    // CONTROL: where a holding copy went too, its base goes with it. The first carrier's own holding base
    // steps aside first, so `new` alone observes these bytes and the next move reads as a rename.
    tree.deleteAt(oldKey, holding);
    rmSync(join(bagDir, "new.md"));
    rmSync(holding);
    writeFileSync(join(bagDir, "newer.md"), body);
    tree.set(syncedTreeKey(TO_BAG, uriOf("new")), holding, landedHash);
    const scan3 = scanSource(root, src, TO_BAG, tree)!;
    expect(applyConfirmedRenames(tree, TO_BAG, candidatesOf(scan3.rows), { renames: [{ fromUri: uriOf("new"), toUri: uriOf("newer") }] })).toBe(1);
    expect(tree.bases(syncedTreeKey(TO_BAG, uriOf("new")))).toEqual([]);
  });

  test("a pair the island declined moves NO observation", () => {
    const body = "# a note\n\nbody\n";
    const { src, bagDir, tree } = seed("old.md", body);
    rmSync(join(bagDir, "old.md"));
    writeFileSync(join(bagDir, "new.md"), body);
    const scan2 = scanSource(root, src, TO_BAG, tree)!;
    // the island re-linked nothing → the observation must NOT move
    const moved = applyConfirmedRenames(tree, TO_BAG, candidatesOf(scan2.rows), { renames: [], absent: [], declined: [uriOf("old")] });
    expect(moved).toBe(0);
    expect(tree.get(syncedTreeKey(TO_BAG, uriOf("old")))).not.toBeNull();
  });

  test("★ a standing carrier a hand edited into the vanished one's bytes makes the pair ambiguous: the scan sends no deletion ★", () => {
    // `old` vanished; `new` arrived with its bytes; and `twin`, a carrier that stood all along, now holds
    // those bytes too. The island reads every carrier of the wave, finds two that hold the source's bytes
    // and re-links none, so a deletion sent for `old` could only read as declined. The scan sends none.
    const body = "# a note\n\nbody\n";
    const { src, bagDir, tree } = seed("old.md", body);
    writeFileSync(join(bagDir, "twin.md"), "# another\n\nits own body\n");
    const first = scanSource(root, src, TO_BAG, tree)!;
    const twin = first.rows.find((r) => r.uri === uriOf("twin"))!;
    tree.set(syncedTreeKey(TO_BAG, twin.uri), twin.file, twin.diskHash);
    rmSync(join(bagDir, "old.md"));
    writeFileSync(join(bagDir, "new.md"), body);
    writeFileSync(join(bagDir, "twin.md"), body);
    const scan = scanSource(root, src, TO_BAG, tree)!;
    expect(scan.rows.find((r) => r.uri === uriOf("twin"))!.status).toBe("changed");
    expect(scan.renameDeletions ?? []).toEqual([]);
    expect(scan.rows.find((r) => r.uri === uriOf("new"))!.status).toBe("new");
  });

  test("an in-place EDIT still re-lands (changed) — never swallowed as a rename", () => {
    const { src, bagDir, tree } = seed("note.md", "# v1\n\nfirst body\n");
    writeFileSync(join(bagDir, "note.md"), "# v2\n\nedited body\n");   // same location, new content
    const scan = scanSource(root, src, TO_BAG, tree)!;
    const row = scan.rows.find((r) => r.uri === uriOf("note"))!;
    expect(row.status).toBe("changed");
    expect(row.renameFrom).toBeUndefined();
    expect(scan.renameDeletions).toBeUndefined();
    expect(candidatesOf(scan.rows).map((c) => c.uri)).toContain(uriOf("note"));
  });

  test("a COPY (source stays live) is NOT a rename — it lands as new, source untouched", () => {
    const body = "# shared body\n\nidentical content\n";
    const { src, bagDir, tree, landedHash } = seed("orig.md", body);
    // a COPY: same content at a new name, the source STILL on disk
    writeFileSync(join(bagDir, "copy.md"), body);
    const scan = scanSource(root, src, TO_BAG, tree)!;
    const copyRow = scan.rows.find((r) => r.uri === uriOf("copy"))!;
    expect(copyRow.status).toBe("new");            // a fresh landing, never a rename
    expect(copyRow.renameFrom).toBeUndefined();
    expect(scan.renameDeletions).toBeUndefined();  // the live source is never a deletion
    // the source observation stays put
    expect(tree.get(syncedTreeKey(TO_BAG, uriOf("orig")))).toBe(landedHash);
  });

  test("two arrived files sharing the vanished carrier's content pair with neither: no deletion rides the wave", () => {
    const body = "# a note two files now hold\n\nthe same bytes twice\n";
    const { src, bagDir, tree } = seed("old.md", body);
    rmSync(join(bagDir, "old.md"));
    writeFileSync(join(bagDir, "new-a.md"), body);
    writeFileSync(join(bagDir, "new-b.md"), body);
    const scan2 = scanSource(root, src, TO_BAG, tree)!;
    // The island's delete gate reads an ambiguous pair as a tombstone; a scan tombstones nothing by itself.
    expect(scan2.renameDeletions).toBeUndefined();
    expect(scan2.rows.filter((r) => r.status === "renamed")).toEqual([]);
    expect(scan2.rows.filter((r) => r.status === "new").map((r) => r.uri).sort()).toEqual([uriOf("new-a"), uriOf("new-b")]);
  });
});
