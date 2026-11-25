/**
 * THE SCAN STRIPS A CARRIER THAT STANDS BESIDE ITS OWN SHADOW.
 *
 * The island executor's kāpae remove-wins check reads only the wave it runs, and the submit splits families across waves
 * under the budget (`familiesOf`), so a kāpae and a carrier for one title could ride apart and both land. That never
 * happens because the scan keeps no carrier whose title a shadow in the same export names: the kāpae rides, the carrier
 * does not. This pins the strip, so a change to the scan cannot break the executor's one-wave check unseen.
 */
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { scanFiles, type FileToUriFn } from "../src/ingest-scan.js";
import { kapaeShadowBody } from "../src/kapae-shadow.js";
import type { SyncedTree } from "../src/synced-tree.js";

let dir = "";
afterEach(() => { if (dir) { rmSync(dir, { recursive: true, force: true }); dir = ""; } });

const SHADOWED = "lar:///ha.ka.ba/probe/shadowed";
const STANDING = "lar:///ha.ka.ba/probe/standing";
const byStem: FileToUriFn = (_root, file) => `lar:///ha.ka.ba/probe/${basename(file).replace(/\.[^.]+$/, "")}`;
const noBases = { baseAt: () => null } as unknown as SyncedTree;

test("a carrier beside its own shadow drops out of the rows; the shadow names its title; a lone carrier stays", () => {
  dir = mkdtempSync(join(tmpdir(), "lar-scan-shadow-"));
  const files = [join(dir, "shadowed.tid"), join(dir, "shadowed.kapae"), join(dir, "standing.tid")];
  writeFileSync(files[0]!, `title: ${SHADOWED}\n\na record the kāpae set aside\n`);
  writeFileSync(files[1]!, kapaeShadowBody(SHADOWED));
  writeFileSync(files[2]!, `title: ${STANDING}\n\na record that stands\n`);

  const scan = scanFiles(dir, files, "lar:///ha.ka.ba/bags/probe", noBases, byStem);
  expect(scan.rows.map((r) => r.uri)).toEqual([STANDING]);
  expect(scan.shadows).toEqual([SHADOWED]);
});
