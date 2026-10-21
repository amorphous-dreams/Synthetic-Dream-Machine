/**
 * nexus-release.test.ts — W26 slice 4's door: a one-seat hearth publishes its floor release. The seat opens a
 * promotion approval over the manifest file's EXACT bytes (`nexus promote open`), the door seals the release body as the
 * steward and lands it on the Nexus's crossroads board, and a reader folds the chain from that board.
 *
 * Proven: a release lands and reads back as the chain's head; a second release links to the first by `prior`;
 * CONTROLS: an approval over other bytes, an approval of another surface, a vessel that holds no seat, a manifest
 * already at the head and a chain left `unsettled` each refuse BEFORE a row lands.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Repo } from "@automerge/automerge-repo";
import {
  crossroadsDocUrl, floorReleaseRowsFromBoard, materializeSharedLarDoc, sha256HexBytesSync, verifyFloorRelease, writeFloorRelease,
  assembleFloorRelease, openFloorReleaseBody, foundingRoster, readPromotionApproval, FLOOR_RELEASE_SURFACE, cutFloorSnapshot, floorManifestBytes,
} from "@lararium/mesh";
import { readCasBlobFromFs, writeCasEntriesFs } from "../src/node-cas.js";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { larDataDir, larSealHome } from "../src/vessel-paths.js";
import { readNexusDoc, writeNexusDoc } from "../src/nexus-doc.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { ownedStore } from "../src/owned-store.js";
import { runFloorRelease, runFloorReleaseStanding } from "../src/commands/nexus-release.js";
import { runPromoteOpen } from "../src/commands/nexus-promote.js";
import { NexusCabalError } from "../src/commands/nexus-cabal.js";
import { chairKey, seatChairs } from "./seat-fixture.js";

let roots: string[];
let prior: string | undefined;
let work: string;

const withRoot = <T>(index: number, run: (repo: Repo) => Promise<T>): Promise<T> => {
  process.env["LAR_ROOT"] = roots[index]!;
  return ownedStore(larDataDir(), run);
};

beforeEach(async () => {
  prior = process.env["LAR_ROOT"];
  roots = [mkdtempSync(join(tmpdir(), "lares-release-a-")), mkdtempSync(join(tmpdir(), "lares-release-b-"))];
  work = mkdtempSync(join(tmpdir(), "lares-release-files-"));
  process.env["LAR_ROOT"] = roots[0]!; await generateOrLoadVesselIdentity(); await generateOrLoadPersonaGroupRoot(0);
  const chair = (await seatChairs([0])).keys[0]!;
  const charter = heldCharter({ keys: [chair], threshold: 1, successors: { keys: [await chairKey(0, 1)], threshold: 1 } });
  writeNexusDoc(larSealHome(), charter.doc());
  // Root B holds the SAME charter and NO seat key: a vessel that cannot seal.
  process.env["LAR_ROOT"] = roots[1]!; await generateOrLoadVesselIdentity();
  writeNexusDoc(larSealHome(), charter.doc());
});
afterEach(async () => {
  if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
  await new Promise((resolve) => setTimeout(resolve, 200));
  for (const root of [...roots, work]) rmSync(root, { recursive: true, force: true });
});

const manifestFile = (name: string, text: string): { file: string; bytes: Uint8Array; cid: string } => {
  const file = join(work, name); const bytes = new TextEncoder().encode(text);
  writeFileSync(file, bytes);
  return { file, bytes, cid: sha256HexBytesSync(bytes) };
};
const approve = (file: string, surface = FLOOR_RELEASE_SURFACE) =>
  runPromoteOpen({ file, purpose: "floor-release", surface, actClass: "high-impact", sealHome: larSealHome() }).then((r) => r.approval);
const release = (index: number, file: string, approval: unknown) =>
  withRoot(index, (repo) => runFloorRelease({ repo, sealHome: larSealHome(), manifestFile: file, approval }));
const standing = (index: number, known: Map<string, Uint8Array>) =>
  withRoot(index, (repo) => runFloorReleaseStanding({ repo, sealHome: larSealHome(), manifestBytesOf: (cid) => known.get(cid) ?? null }));

describe("a release names a floor this hearth holds whole", () => {
  it("with a CAS dir, the manifest stages there and a floor missing a snapshot refuses before any row lands; the whole floor lands (CONTROL)", async () => {
    process.env["LAR_ROOT"] = roots[0]!;
    const cas = join(work, "cas");
    const lares = cutFloorSnapshot({ "lar:///t/lares": { tiddler: { title: "lar:///t/lares", text: "l" } } });
    const lararium = cutFloorSnapshot({ "lar:///t/lararium": { tiddler: { title: "lar:///t/lararium", text: "r" } } });
    const manifestBytes = floorManifestBytes({ format: "lararium-floor/v1", engine: "e".repeat(64), grammar: "a".repeat(64), plugins: "b".repeat(64), lares: lares.cid, lararium: lararium.cid });
    const file = join(work, "floor-manifest.json"); writeFileSync(file, manifestBytes);
    const approval = await approve(file);
    const go = () => withRoot(0, (repo) => runFloorRelease({ repo, sealHome: larSealHome(), manifestFile: file, approval, casDir: cas }));
    writeCasEntriesFs([{ cid: lares.cid, bytes: lares.bytes }], cas);                                     // one snapshot alone
    await expect(go()).rejects.toThrow(/does not stand whole in this hearth's CAS/);
    expect(await standing(0, new Map([[sha256HexBytesSync(manifestBytes), manifestBytes]]))).toMatchObject({ standing: "absent" });
    writeCasEntriesFs([{ cid: lararium.cid, bytes: lararium.bytes }], cas);                               // the whole floor
    const landed = await go();
    expect(landed.release.body.manifest).toBe(sha256HexBytesSync(manifestBytes));
    expect(readCasBlobFromFs(landed.release.body.manifest, cas)).not.toBeNull();                          // the manifest stands in the CAS the porch serves
  });
});

describe("a one-seat hearth publishes its floor release", () => {
  it("lands a release a reader folds as the chain's head; a second links to the first by prior", async () => {
    process.env["LAR_ROOT"] = roots[0]!;
    const one = manifestFile("m1.json", '{"format":"lararium-floor/v1","n":1}');
    const two = manifestFile("m2.json", '{"format":"lararium-floor/v1","n":2}');
    const known = new Map([[one.cid, one.bytes], [two.cid, two.bytes]]);

    const first = await release(0, one.file, await approve(one.file));
    expect(first).toMatchObject({ counted: 1, threshold: 1 });
    expect(first.release.body).toMatchObject({ prior: null, manifest: one.cid, kind: expect.stringContaining("floor-release") });
    expect(await standing(0, known)).toMatchObject({ standing: "released", head: { cid: first.release.cid } });

    const second = await release(0, two.file, await approve(two.file));
    expect(second.release.body.prior).toBe(first.release.cid);
    const head = await standing(0, known);
    expect(head).toMatchObject({ standing: "released", head: { cid: second.release.cid } });
    // The row rests on the crossroads board under the release's own CID.
    await withRoot(0, async (repo) => {
      const board = await materializeSharedLarDoc(repo, crossroadsDocUrl(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: larSealHome() })), "board:crossroads");
      expect(floorReleaseRowsFromBoard(board.doc()).map((r) => r.keyCid).sort()).toEqual([first.release.cid, second.release.cid].sort());
    });
  });

  it("CONTROLS: other bytes, another surface, no seat and a repeated head each refuse, and no row lands", async () => {
    process.env["LAR_ROOT"] = roots[0]!;
    const one = manifestFile("c1.json", '{"n":"control-1"}');
    const other = manifestFile("c2.json", '{"n":"control-2"}');
    const known = new Map([[one.cid, one.bytes], [other.cid, other.bytes]]);
    await expect(release(0, one.file, await approve(other.file))).rejects.toThrow(/covers other bytes/);
    await expect(release(0, one.file, await approve(one.file, "promotion"))).rejects.toThrow(/takes an approval over the surface "floor-release"/);
    expect(await standing(0, known)).toMatchObject({ standing: "absent" });

    const approval = await approve(one.file);
    // root B holds the charter and no seat key: it seals nothing.
    await expect(release(1, one.file, approval)).rejects.toThrow(/holds no seat of the charter/);
    process.env["LAR_ROOT"] = roots[0]!;
    await release(0, one.file, approval);
    await expect(release(0, one.file, approval)).rejects.toThrow(/already stands as the chain's head/);
    await expect(release(0, "/no/such/manifest", approval)).rejects.toThrow(NexusCabalError);
    await expect(release(0, one.file, { kind: "nonsense" })).rejects.toThrow(/reads as no promotion approval/);
  });

  it("a fork leaves the chain unsettled and a third release refuses until the cabal settles it", async () => {
    process.env["LAR_ROOT"] = roots[0]!;
    const one = manifestFile("f1.json", '{"n":"fork-1"}');
    const left = manifestFile("f2.json", '{"n":"fork-2"}');
    const right = manifestFile("f3.json", '{"n":"fork-3"}');
    const next = manifestFile("f4.json", '{"n":"fork-4"}');
    const first = await release(0, one.file, await approve(one.file));
    // Two releases name the first as their prior: written by hand, as two cabals' replicas would merge them.
    await withRoot(0, async (repo) => {
      const board = await materializeSharedLarDoc(repo, crossroadsDocUrl(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: larSealHome() })), "board:crossroads");
      const roster = foundingRoster(readNexusDoc(larSealHome()));
      const lineage = readNexusDoc(larSealHome())!.sealLineage!;
      const chair = (await seatChairs([0])).hands[0]!;
      for (const m of [left, right]) {
        const approval = readPromotionApproval(await approve(m.file))!;
        const made = await assembleFloorRelease({
          body: openFloorReleaseBody({ nexus: first.nexus, epoch: roster.sealEpochCid, prior: first.release.cid, manifest: m.cid }), lineage, manifestBytes: m.bytes,
          steward: chair, approvers: [], approval,
        });
        expect(verifyFloorRelease({ record: made, nexus: first.nexus, manifestBytes: m.bytes }).ok).toBe(true);
        board.change((d) => writeFloorRelease(d, made));
      }
    });
    const known = new Map([[one.cid, one.bytes], [left.cid, left.bytes], [right.cid, right.bytes]]);
    expect(await standing(0, known)).toMatchObject({ standing: "unsettled" });
    await expect(release(0, next.file, await approve(next.file))).rejects.toThrow(/unsettled/);
  });
});
