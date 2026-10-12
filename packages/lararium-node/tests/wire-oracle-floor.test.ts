/**
 * The oracle read-face wire (WEAK FORM, labelled). `main.ts` runs its daemon at module load and exports nothing,
 * so the mount cannot run in a unit test. The behaviour half runs the floor snapshot the mount calls: the
 * genesis-named pointer rides it and a live-only row stays out. The wire half is a source-shape assertion over
 * the mount's `exportSnapshot` call site, which fails when the mount reads the raw document instead.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { load } from "@automerge/automerge";
import { snapshotPublicOracle, type GenesisSeed, type LarDoc } from "@lararium/mesh";
import { LARES_DOC_URI, mutableLarRecord } from "@lararium/mesh";

const source = readFileSync(join(__dirname, "..", "src", "main.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "");

describe("the node oracle read-face wire", () => {
  test("CONTROL: the genesis floor snapshot includes its named pointer and excludes a live-only row", async () => {
    const liveOnlyTitle = "lar:///wire/live-only";
    const floor = { schemaVersion: "1", blobs: {}, tiddlers: {
      [LARES_DOC_URI]: mutableLarRecord(LARES_DOC_URI, { text: "automerge:lares" }, "seed"),
      [liveOnlyTitle]: mutableLarRecord(liveOnlyTitle, { text: "automerge:live-only" }, "live"),
    } } as unknown as LarDoc;
    const seed = { format: "lararium-genesis-seed/v1", actorSeed: "wire", schemaVersion: "1", blobs: {}, tiddlers: { [LARES_DOC_URI]: {} } } as GenesisSeed;
    const snapshot = await snapshotPublicOracle(floor, seed, "seed-cid");
    expect(snapshot.seedCid).toBe("seed-cid");
    const exported = load<Record<string, unknown>>(snapshot.bytes);
    expect(exported.tiddlers).toHaveProperty(LARES_DOC_URI);
    expect(exported.tiddlers).not.toHaveProperty(liveOnlyTitle);
  });

  test("the mounted read-face exports the seed-named floor projection", () => {
    expect(source).toMatch(/exportSnapshot:\s*\(doc\)\s*=>\s*snapshotPublicOracle\(doc\s+as\s+LarDoc,\s*floorSeed,\s*floorSeedCid\)/);
    expect(source).not.toMatch(/exportSnapshot:\s*\(doc\)\s*=>\s*\(await\s+import\(["']@lararium\/mesh["']\)\)\.exportOracleSnapshot/);
  });
});
