/**
 * A STRAY `.meta` READS UNCHANGED ON THE SECOND SCAN.
 *
 * `pinAgreement` leaves a `.meta` out of the disk's state where the carrier's render holds no metaBody (the projecting leg
 * never writes one), so the base names the body alone. The scan weighs the same way: where the body-only hash agrees with
 * the base, a hand-edited stray `.meta` re-lands nothing.
 */
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanFiles, type FileToUriFn } from "../src/ingest-scan.js";
import { carrierHash } from "@lararium/mesh/crypto";
import type { SyncedTree } from "../src/synced-tree.js";

let dir = "";
afterEach(() => { if (dir) { rmSync(dir, { recursive: true, force: true }); dir = ""; } });

const URI = "lar:///ha.ka.ba/probe/stray";
const siting: FileToUriFn = () => URI;

test("a base that names the body alone reads unchanged beside a hand-edited stray .meta; a body edit still reads changed", () => {
  dir = mkdtempSync(join(tmpdir(), "lar-scan-stray-meta-"));
  const file = join(dir, "stray.mem");
  writeFileSync(file, "the words\n");
  const bodyOnly = carrierHash("the words\n", undefined);
  const tree = { baseAt: () => ({ disk: bodyOnly, records: bodyOnly }) } as unknown as SyncedTree;
  writeFileSync(file + ".meta", "title: stray\n");
  const first = scanFiles(dir, [file], "lar:///ha.ka.ba/bags/probe", tree, siting);
  expect(first.rows.map((r) => r.status)).toEqual(["unchanged"]);
  writeFileSync(file + ".meta", "title: stray, edited by hand\n");
  const second = scanFiles(dir, [file], "lar:///ha.ka.ba/bags/probe", tree, siting);
  expect(second.rows.map((r) => r.status)).toEqual(["unchanged"]);
  writeFileSync(file, "other words\n");
  expect(scanFiles(dir, [file], "lar:///ha.ka.ba/bags/probe", tree, siting).rows.map((r) => r.status)).toEqual(["changed"]);
});
