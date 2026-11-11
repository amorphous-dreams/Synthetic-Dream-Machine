/**
 * floor-cut — the node's binding of the release wiring (offering#/the-canon-offer): `lares nexus release <file> --cut` cuts the
 * next release's floor from LIVE house canon, so a promoted record rides the release a vessel accepts.
 *
 * REDS, each with its control:
 *   · the cut re-reads each house-canon document the prior floor names: a promoted row lands in the fresh snapshot, a slug with
 *     no live document keeps the prior snapshot, the floor stands WHOLE in this hearth's CAS, and the file holds the manifest's
 *     exact bytes;
 *   · a cut over unmoved canon answers the prior's own CID (a replayed cut lands nothing new);
 *   · a prior this CAS cannot answer refuses `floor-cut-refused`, writing no file;
 *   · `runFloorCut` binds through `runFloorCutOver` alone (one binding, no second cut).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import {
  AutomergeDocStore, bagUri, cutFloorSnapshot, emptyLarDoc, floorManifestBytes, resolveFloor, sha256HexBytesSync,
  type FloorManifest, type LarDoc, type LarTiddlerRecord,
} from "@lararium/mesh";
import { runFloorCutOver } from "../src/commands/floor-cut.js";
import { readVerifiedCasBlobFromFs, writeCasEntriesFs } from "../src/node-cas.js";

const T = "lar:///ha.ka.ba/lares/docs/pono/offered";
const row = (title: string, text: string): LarTiddlerRecord => ({ tiddler: { title, text } });
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

async function rig() {
  const dir = mkdtempSync(join(tmpdir(), "floor-cut-"));
  dirs.push(dir);
  const casDir = join(dir, "cas");
  const lares = cutFloorSnapshot({ [T]: row(T, "canon says") });
  const lararium = cutFloorSnapshot({ "lar:///ha.ka.ba/lararium/x": row("lar:///ha.ka.ba/lararium/x", "x") });
  const genesis: FloorManifest = { format: "lararium-floor", engine: "e".repeat(64), grammar: "a".repeat(64), plugins: "b".repeat(64), snapshots: { lares: lares.cid, lararium: lararium.cid } };
  const gBytes = floorManifestBytes(genesis);
  const gCid = sha256HexBytesSync(gBytes);
  writeCasEntriesFs([{ cid: lares.cid, bytes: lares.bytes }, { cid: lararium.cid, bytes: lararium.bytes }, { cid: gCid, bytes: gBytes }], casDir);
  const repo = new Repo({ network: [] });
  const handle = repo.create<LarDoc>(emptyLarDoc());
  const canon = new AutomergeDocStore(handle, bagUri("lares"));
  await canon.put(row(T, "canon says"), { kind: "lares-verb", requestId: "seed" });
  const canonDocUrl = (bag: string): string | null => (bag === bagUri("lares") ? handle.url : null);
  return { dir, casDir, repo, canon, canonDocUrl, gCid, lararium };
}

describe("the node's floor cut", () => {
  test("RED: a promoted row rides the cut; a slug with no live document keeps its snapshot; the floor stands whole", async () => {
    const r = await rig();
    try {
      await r.canon.put(row(T, "the promoted page"), { kind: "lares-verb", requestId: "promote" });
      const out = join(r.dir, "floor.json");
      const cut = await runFloorCutOver({ repo: r.repo, casDir: r.casDir, out, prior: async () => r.gCid, canonDocUrl: r.canonDocUrl });
      expect(cut).toMatchObject({ prior: r.gCid, cut: ["lares"], kept: ["lararium"], moved: ["lares"], out });
      expect(sha256HexBytesSync(new Uint8Array(readFileSync(out)))).toBe(cut.manifestCid);
      const floor = await resolveFloor(cut.manifestCid, async (cid) => readVerifiedCasBlobFromFs(cid, r.casDir));
      if ("refusal" in floor) throw new Error(floor.refusal);
      expect(floor.snapshots["lares"]![T]?.tiddler.text).toBe("the promoted page");
      expect(floor.manifest.snapshots["lararium"]).toBe(r.lararium.cid);
    } finally { await r.repo.shutdown(); }
  });

  test("RED: a cut over unmoved canon answers the prior's own CID", async () => {
    const r = await rig();
    try {
      const cut = await runFloorCutOver({ repo: r.repo, casDir: r.casDir, out: join(r.dir, "same.json"), prior: async () => r.gCid, canonDocUrl: r.canonDocUrl });
      expect(cut).toMatchObject({ manifestCid: r.gCid, moved: [] });
    } finally { await r.repo.shutdown(); }
  });

  test("RED: a prior this CAS cannot answer refuses floor-cut-refused and writes no file", async () => {
    const r = await rig();
    try {
      const out = join(r.dir, "none.json");
      await expect(runFloorCutOver({ repo: r.repo, casDir: r.casDir, out, prior: async () => "0".repeat(64), canonDocUrl: r.canonDocUrl }))
        .rejects.toMatchObject({ refusal: "floor-cut-refused" });
      expect(existsSync(out)).toBe(false);
    } finally { await r.repo.shutdown(); }
  });

  test("runFloorCut binds through runFloorCutOver alone", () => {
    const source = readFileSync(new URL("../src/commands/floor-cut.ts", import.meta.url), "utf8");
    const body = source.slice(source.indexOf("export async function runFloorCut("));
    expect(body).toMatch(/runFloorCutOver\(\{/);
    expect(body).not.toMatch(/cutReleaseFloor\(/);
  });
});
