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
  const genesis: FloorManifest = { format: "lararium-floor", engine: "e".repeat(64), plugins: "b".repeat(64), snapshots: { lares: lares.cid, lararium: lararium.cid } };
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
      const cut = await runFloorCutOver({ repo: r.repo, casDir: r.casDir, out, prior: async () => r.gCid, canonDocUrl: r.canonDocUrl, genesisEngine: () => "e".repeat(64), bagTier: () => null });
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
      const cut = await runFloorCutOver({ repo: r.repo, casDir: r.casDir, out: join(r.dir, "same.json"), prior: async () => r.gCid, canonDocUrl: r.canonDocUrl, genesisEngine: () => "e".repeat(64), bagTier: () => null });
      expect(cut).toMatchObject({ manifestCid: r.gCid, moved: [] });
    } finally { await r.repo.shutdown(); }
  });

  test("RED: a prior this CAS cannot answer refuses floor-cut-refused and writes no file", async () => {
    const r = await rig();
    try {
      const out = join(r.dir, "none.json");
      await expect(runFloorCutOver({ repo: r.repo, casDir: r.casDir, out, prior: async () => "0".repeat(64), canonDocUrl: r.canonDocUrl, genesisEngine: () => "e".repeat(64), bagTier: () => null }))
        .rejects.toMatchObject({ refusal: "floor-cut-refused" });
      expect(existsSync(out)).toBe(false);
    } finally { await r.repo.shutdown(); }
  });

  test("RED: a bag that declares a tier under public leaves the cut; CONTROL: a public bag and a bag with no declaration here keep their snapshots", async () => {
    const r = await rig();
    try {
      const snap = (slug: string) => cutFloorSnapshot({ [`lar:///ha.ka.ba/${slug}/x`]: row(`lar:///ha.ka.ba/${slug}/x`, slug) });
      const elyncia = snap("elyncia"), referee = snap("elyncia-referee"), sdm = snap("sdm");
      const prior = (await resolveFloor(r.gCid, async (cid) => readVerifiedCasBlobFromFs(cid, r.casDir)) as { manifest: FloorManifest }).manifest;
      const wide: FloorManifest = { ...prior, snapshots: { ...prior.snapshots, elyncia: elyncia.cid, "elyncia-referee": referee.cid, sdm: sdm.cid } };
      const wBytes = floorManifestBytes(wide), wCid = sha256HexBytesSync(wBytes);
      writeCasEntriesFs([elyncia, referee, sdm, { cid: wCid, bytes: wBytes }].map((b) => ({ cid: b.cid, bytes: b.bytes })), r.casDir);
      const tiers: Record<string, "public" | "contract"> = { elyncia: "public", "elyncia-referee": "contract" };
      const cut = await runFloorCutOver({ repo: r.repo, casDir: r.casDir, out: join(r.dir, "tier.json"), prior: async () => wCid, canonDocUrl: r.canonDocUrl, genesisEngine: () => "e".repeat(64), bagTier: (slug) => tiers[slug] ?? null });
      expect(cut.dropped).toEqual(["elyncia-referee"]);
      const floor = await resolveFloor(cut.manifestCid, async (cid) => readVerifiedCasBlobFromFs(cid, r.casDir));
      if ("refusal" in floor) throw new Error(floor.refusal);
      expect(Object.keys(floor.manifest.snapshots).sort()).toEqual(["elyncia", "lararium", "lares", "sdm"]);
      expect(floor.manifest.snapshots["elyncia"]).toBe(elyncia.cid);
      expect(floor.manifest.snapshots["sdm"]).toBe(sdm.cid);     // no declaration on this vessel: its standing holds
    } finally { await r.repo.shutdown(); }
  });

  /**
   * A RELEASE CUT REFUSES A THIN SNAPSHOT. A canon document that holds far fewer rows than the snapshot the prior floor names
   * (a realm document seeded while another document answered its doors) would publish a near-empty bag to every reader. The cut
   * refuses that slug BY NAME (`floor-cut-thin`) and writes nothing, unless the steward names the slug as thin on purpose.
   */
  async function wideRig(liveRows: number) {
    const r = await rig();
    const title = (i: number) => `lar:///ha.ka.ba/lares/docs/pono/page-${String(i).padStart(2, "0")}`;
    const priorRows: Record<string, LarTiddlerRecord> = {};
    for (let i = 0; i < 20; i++) priorRows[title(i)] = row(title(i), `page ${i}`);
    const lares = cutFloorSnapshot(priorRows);
    const prior = (await resolveFloor(r.gCid, async (cid) => readVerifiedCasBlobFromFs(cid, r.casDir)) as { manifest: FloorManifest }).manifest;
    const wide: FloorManifest = { ...prior, snapshots: { ...prior.snapshots, lares: lares.cid } };
    const wBytes = floorManifestBytes(wide), wCid = sha256HexBytesSync(wBytes);
    writeCasEntriesFs([{ cid: lares.cid, bytes: lares.bytes }, { cid: wCid, bytes: wBytes }], r.casDir);
    const handle = r.repo.create<LarDoc>(emptyLarDoc());
    const live = new AutomergeDocStore(handle, bagUri("lares"));
    for (let i = 0; i < liveRows; i++) await live.put(row(title(i), `page ${i}`), { kind: "lares-verb", requestId: `seed-${i}` });
    return { ...r, wCid, canonDocUrl: (bag: string): string | null => (bag === bagUri("lares") ? handle.url : null) };
  }

  test("RED: a slug whose live rows fall under half the prior snapshot's refuses floor-cut-thin by name and writes no file", async () => {
    const r = await wideRig(3);
    try {
      const out = join(r.dir, "thin.json");
      await expect(runFloorCutOver({ repo: r.repo, casDir: r.casDir, out, prior: async () => r.wCid, canonDocUrl: r.canonDocUrl, genesisEngine: () => "e".repeat(64), bagTier: () => null }))
        .rejects.toMatchObject({ refusal: "floor-cut-thin", message: expect.stringMatching(/lares \(3 live rows? under 20\).*--thin lares/s) });
      expect(existsSync(out)).toBe(false);
      // CONTROL: the steward names the slug thin on purpose, and the cut lands.
      const named = await runFloorCutOver({ repo: r.repo, casDir: r.casDir, out, prior: async () => r.wCid, canonDocUrl: r.canonDocUrl, genesisEngine: () => "e".repeat(64), bagTier: () => null, thin: ["lares"] });
      expect(named).toMatchObject({ cut: ["lares"], moved: ["lares"] });
      expect(existsSync(out)).toBe(true);
    } finally { await r.repo.shutdown(); }
  });

  test("CONTROL: a slug that sheds some rows (12 of 20) cuts with no flag", async () => {
    const r = await wideRig(12);
    try {
      const cut = await runFloorCutOver({ repo: r.repo, casDir: r.casDir, out: join(r.dir, "shed.json"), prior: async () => r.wCid, canonDocUrl: r.canonDocUrl, genesisEngine: () => "e".repeat(64), bagTier: () => null });
      expect(cut).toMatchObject({ cut: ["lares"], moved: ["lares"] });
    } finally { await r.repo.shutdown(); }
  });

  test("runFloorCut binds through runFloorCutOver alone", () => {
    const source = readFileSync(new URL("../src/commands/floor-cut.ts", import.meta.url), "utf8");
    const body = source.slice(source.indexOf("export async function runFloorCut("));
    expect(body).toMatch(/runFloorCutOver\(\{/);
    expect(body).not.toMatch(/cutReleaseFloor\(/);
  });
});
