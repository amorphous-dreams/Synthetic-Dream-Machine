/**
 * nexus-release.test.ts — W26 slice 4's door: a one-seat hearth publishes its floor release. The seat opens a
 * promotion approval over the manifest file's EXACT bytes (`nexus promote open`), the door seals the release body as the
 * steward and lands it on the Nexus's publication board, and a reader folds the chain from that board.
 *
 * Proven: a release lands and reads back as the chain's head; a second release links to the first by `prior`;
 * CONTROLS: an approval over other bytes, an approval of another surface, a vessel that holds no seat, a manifest
 * already at the head and a chain left `unsettled` each refuse BEFORE a row lands.
 *
 * The same steward seat retires a promoted canon offer (offering#/the-canon-offer), across the REAL store door
 * (`storeDoorReactors`, the `offer-retire` row) over a real Repo: a retire that follows a promotion waits on the heads
 * the promotion answered, never on a clock's verdict; a replica that trails past the bound PENDS by name; a retire
 * that names no promotion decides on one read; a vessel that holds no seat seals none.
 */
import { seatSuiteWard } from "./support/scratch-custody-setup.js";
// This suite stands as the person at the terminal: its root acts carry no ward route, and the suite's person answers (seat-harness#/the-ward).
seatSuiteWard();
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as A from "@automerge/automerge";
import type { Repo } from "@automerge/automerge-repo";
import {
  AutomergeDocStore, BAG_IDS, REALM_BAG_DOMAIN, REALM_ID_TIDDLER, bagUri, canonOfferDocUrl, emptyLarDoc, faceAtomKeyFromSeed, foldCanonOffers, nexusAidOf,
  offerCanonRecords, promoteCanonOffer, realmDocPointer, realmDocUrl, realmStandingPointer, storedLarRecord, type LarDoc, type LarTiddlerRecord,
} from "@lararium/mesh";
import { storeDoorReactors } from "../src/store-door-verbs.js";
import { runOfferRetire } from "../src/commands/offer-retire.js";
import { larBootstrapPath } from "../src/vessel-paths.js";
import {
  crossroadsDocUrl, publicationDocUrl, floorReleaseRowsFromBoard, materializeSharedLarDoc, sha256HexBytesSync, verifyFloorRelease, writeFloorRelease,
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
  process.env["LAR_ROOT"] = roots[0]!; await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } }); await generateOrLoadPersonaGroupRoot(0);
  const chair = (await seatChairs([0])).keys[0]!;
  const charter = heldCharter({ keys: [chair], threshold: 1, successors: { keys: [await chairKey(0, 1)], threshold: 1 } });
  writeNexusDoc(larSealHome(), charter.doc());
  // Root B holds the SAME charter and NO seat key: a vessel that cannot seal.
  process.env["LAR_ROOT"] = roots[1]!; await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
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
    const manifestBytes = floorManifestBytes({ format: "lararium-floor", engine: "e".repeat(64), grammar: "a".repeat(64), plugins: "b".repeat(64), snapshots: { lares: lares.cid, lararium: lararium.cid } });
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
    const one = manifestFile("m1.json", '{"format":"lararium-floor","n":1}');
    const two = manifestFile("m2.json", '{"format":"lararium-floor","n":2}');
    const known = new Map([[one.cid, one.bytes], [two.cid, two.bytes]]);

    const first = await release(0, one.file, await approve(one.file));
    expect(first).toMatchObject({ counted: 1, threshold: 1 });
    expect(first.release.body).toMatchObject({ prior: null, manifest: one.cid, kind: expect.stringContaining("floor-release") });
    expect(await standing(0, known)).toMatchObject({ standing: "released", head: { cid: first.release.cid } });

    const second = await release(0, two.file, await approve(two.file));
    expect(second.release.body.prior).toBe(first.release.cid);
    const head = await standing(0, known);
    expect(head).toMatchObject({ standing: "released", head: { cid: second.release.cid } });
    // The row rests on the publication board under the release's own CID, and never in the mirrored crossroads document.
    await withRoot(0, async (repo) => {
      const island = nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: larSealHome() });
      const board = await materializeSharedLarDoc(repo, publicationDocUrl(island), "board:publication");
      expect(floorReleaseRowsFromBoard(board.doc()).map((r) => r.keyCid).sort()).toEqual([first.release.cid, second.release.cid].sort());
      const crossroads = await materializeSharedLarDoc(repo, crossroadsDocUrl(island), "board:crossroads");
      expect(floorReleaseRowsFromBoard(crossroads.doc()), "the crossroads mirror would write it to disk").toEqual([]);
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
      const board = await materializeSharedLarDoc(repo, publicationDocUrl(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: larSealHome() })), "board:publication");
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

describe("a charter seat retires a promoted canon offer across the store door", () => {
  const T = "lar:///ha.ka.ba/lares/docs/pono/offered";
  const LARES = bagUri("lares");
  const REALM = "ab".repeat(32);
  const origin = { kind: "lares-verb", requestId: "test" } as const;
  const row = (title: string, text: string): LarTiddlerRecord => ({ tiddler: { title, text } });

  /**
   * One vessel's side of a promotion, on its own Repo: the Kahu realm's standing document for `bags/lares` (named by the vessel's
   * catalog, which the bootstrap names), an open offer on the Nexus's offer table, and THE DAEMON ISLAND'S REPLICA of canon, a
   * clone the promotion writes into. `deliver` merges that replica's write into the store door's own, as sync would.
   */
  async function rig(repo: Repo) {
    const canonHandle = repo.create<LarDoc>(emptyLarDoc());
    await new AutomergeDocStore(canonHandle, LARES).put(row(T, "canon says"), origin);
    const catalog = repo.create<LarDoc>(emptyLarDoc());
    const standing = [{ kind: REALM_BAG_DOMAIN, realmId: REALM, bagUri: LARES, docUrl: canonHandle.url, keptBy: ["cd".repeat(32)], readTier: "contract", signatures: [{ signer: "cd".repeat(32), sig: "00".repeat(64) }] }];
    catalog.change((d) => {
      for (const [k, text] of [[REALM_ID_TIDDLER, REALM], [realmDocPointer(REALM), realmDocUrl(REALM)], [realmStandingPointer(REALM), JSON.stringify(standing)]] as const) d.tiddlers[k] = storedLarRecord(k, { text }, "test");
    });
    writeFileSync(larBootstrapPath(), JSON.stringify({ text: JSON.stringify({ tiddlers: { [BAG_IDS.catalog]: { text: catalog.url } } }) }));
    const charter = readNexusDoc(larSealHome())!;
    const nexus = nexusAidOf(charter)!;
    const boardHandle = await materializeSharedLarDoc(repo, canonOfferDocUrl(nexus), "board:canon-offer");
    const board = { doc: () => boardHandle.doc(), change: (fn: Parameters<typeof boardHandle.change>[0]) => { boardHandle.change(fn); } };
    const atom = faceAtomKeyFromSeed(new Uint8Array(32).fill(41), "aa".repeat(32));
    const working = { get: async (title: string) => (title === T ? row(T, "the engineer says") : null), listVisible: async () => [T] };
    const island = repo.clone(canonHandle);
    const islandStore = new AutomergeDocStore(island, LARES);
    const ports = { nexus, board, canon: async () => islandStore };
    const { offer } = await offerCanonRecords({ ...ports, source: working, signer: { key: atom.key, sign: atom.sign }, face: "aa".repeat(32) }, { bag: "lares", titles: [T] });
    const seat = { key: (await seatChairs([0])).keys[0]!, epoch: foundingRoster(charter).sealEpochCid, lineage: charter.sealLineage! };
    const promote = () => promoteCanonOffer({ ...ports, requireReach: async () => {}, seat: async () => seat,
      canonWrite: async () => ({ put: (r) => islandStore.put(r, origin), heads: () => islandStore.headsNow() }) }, { cid: offer.cid, overFresher: true });
    const deliver = (): void => { canonHandle.update((doc) => A.merge(doc, A.clone(island.doc()!))); };
    const door = storeDoorReactors({ storageDir: larDataDir(), sealHome: larSealHome(), repo });
    const retired = () => foldCanonOffers(boardHandle.doc(), nexus).offers.find((o) => o.offer.cid === offer.cid)?.retired ?? null;
    return { offer, promote, deliver, door, retired, canonHandle };
  }

  it("a retire that follows a promotion waits on the heads the promotion answered, and lands when its replica takes the write", async () => {
    await withRoot(0, async (repo) => {
      const r = await rig(repo);
      const promoted = await r.promote();
      if (!promoted.moved) throw new Error("the promotion held");
      expect(promoted.canonHeads).not.toBeNull();
      expect(A.hasHeads(r.canonHandle.doc()!, [...promoted.canonHeads!])).toBe(false);   // the door's replica trails
      setTimeout(r.deliver, 300);
      const out = await r.door["offer-retire"]({ cid: r.offer.cid, over: promoted.over, after: promoted.canonHeads }, {} as never);
      expect(out).toMatchObject({ verb: "offer-retire", retired: true, cid: r.offer.cid });
      expect(r.retired()?.cid).toBe(out["retire"]);
    });
  });

  it("a replica that trails past the bound PENDS by name, lands no retire, and the re-run retires once the write arrives", async () => {
    await withRoot(0, async (repo) => {
      const r = await rig(repo);
      const promoted = await r.promote();
      if (!promoted.moved) throw new Error("the promotion held");
      const pending = await runOfferRetire({ repo, sealHome: larSealHome(), cid: r.offer.cid, after: promoted.canonHeads!, waitMs: 60 });
      expect(pending).toMatchObject({ retired: false, cid: r.offer.cid, why: "canon-trails" });
      expect((pending as { pending: string }).pending).toMatch(/the canon write stands.*lares meme offer promote/s);
      expect(r.retired()).toBeNull();
      r.deliver();
      expect(await r.door["offer-retire"]({ cid: r.offer.cid, after: promoted.canonHeads }, {} as never)).toMatchObject({ retired: true });
      expect(r.retired()).not.toBeNull();
    });
  });

  it("CONTROLS: a retire that names no promotion decides on one read (offer-not-landed), and a vessel that holds no seat seals none", async () => {
    await withRoot(0, async (repo) => {
      const r = await rig(repo);
      const out = await r.door["offer-retire"]({ cid: r.offer.cid }, {} as never);
      expect(out).toMatchObject({ verb: "offer-retire", refusal: "offer-retire-refused" });
      expect(String(out["refused"])).toMatch(/^offer-not-landed/);
      expect(r.retired()).toBeNull();
      // Malformed heads refuse before any wait.
      expect(String((await r.door["offer-retire"]({ cid: r.offer.cid, after: ["nope"] }, {} as never))["refused"])).toMatch(/after/);
    });
    await withRoot(1, async (repo) => {
      const door = storeDoorReactors({ storageDir: larDataDir(), sealHome: larSealHome(), repo });
      expect(String((await door["offer-retire"]({ cid: "f".repeat(64) }, {} as never))["refused"])).toMatch(/holds no seat of the charter/);
    });
  });
});
