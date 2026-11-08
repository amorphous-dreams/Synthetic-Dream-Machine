import { afterEach, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SyncedTree } from "@lararium/node";
import { scanSource } from "../src/ingest-core.js";

let root = "";
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });
function rig() {
  root = mkdtempSync(join(tmpdir(), "kapae-ingest-"));
  const source = join(root, "wikis", "garden");
  const dir = join(source, "ha.ka.ba", "t");
  mkdirSync(dir, { recursive: true });
  return { source, dir, tree: new SyncedTree(join(root, "synced")) };
}
const title = "lar:///ha.ka.ba/t/note";

test("a shadow wins over a stale live carrier in the same export", () => {
  const { source, dir, tree } = rig();
  writeFileSync(join(dir, "note.mem"), "old content");
  writeFileSync(join(dir, "note.kapae"), JSON.stringify({ title }));
  const scan = scanSource(root, source, "working", tree)! as ReturnType<typeof scanSource> & { shadows: string[] };
  expect(scan!.shadows).toEqual([title]);
  expect(scan!.rows.map((row) => row.uri)).not.toContain(title);
});

test("control: a live row without a shadow remains a carrier", () => {
  const { source, dir, tree } = rig();
  writeFileSync(join(dir, "note.mem"), "live content");
  const scan = scanSource(root, source, "working", tree)!;
  expect(scan.rows.map((row) => row.uri)).toEqual([title]);
});
