/**
 * floor-door — the node binds the vessel's floor pin to the store door (w26-floor-lane#/the-vessel-pin).
 *
 *   · both rows stand on the door, as rows of the PLACE: the pin keys on (vessel, Nexus), so no face row carries it and a
 *     face switch reaches no pin;
 *   · the accept rides a person's hand alone (`floor-needs-hand`): a seat session reads the status and never moves the floor;
 *   · the node's binding answers the mesh's own decision: its module calls `acceptFloorRelease` and `readFloorStatus`, and
 *     declares no live floor swap (the remount raises the reboot-pending alert);
 *   · THE DOORS CROSS A REAL FOUNDING: on a hearth `runFoundHearth` stood (its bootstrap the founding's own, an address book of
 *     the social planes that names no catalog and no oracle), the status answers the genesis pin and the cut answers a
 *     manifest, each reading the oracle island at its deterministic address and the catalog its pointer file names, the two
 *     sources the standing vessel's own composition reads. CONTROLS: a bare place in no charter, and a founded store that
 *     holds no oracle island, each refuse by their own name (the row carries the refusal's own name, never the verb's);
 *   · THE STATUS NAMES BOTH TRUTHS CHARTER-FREE (D1, shore recommendation 8): the founding record beside the seed (offered)
 *     and the floor pin, ratchet by ratchet. A place in no Nexus charter whose store holds the island answers that part and
 *     refuses only the Nexus part, by name.
 *   · THE STATUS NAMES THE FLOOR'S DRIFT (`floorDrift`): on a founded hearth, a carrier live lararium canon holds and the floor
 *     lacks reads missing, by carrier, its slots counting once; each floor carrier the empty live lares canon no longer holds
 *     reads older. CONTROL: a place whose store names no catalog reads the drift null, never a silent zero.
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test, vi } from "vitest";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import {
  AutomergeDocStore, BAG_IDS, DAEMON_BAG_ID, bagUri, realmStandingDocUrl, REALM_ID_TIDDLER, emptyLarDoc, foldRealmBags, genesisFloorCidOf, materializeSharedLarDoc, realmDocPointer, realmDocUrl, resolveFloor,
  sha256HexBytesSync, storedLarRecord, writeRealmStanding, type FloorDrift, type LarDoc,
} from "@lararium/mesh";
import { STORE_DOOR_FACE_VERBS, STORE_DOOR_HAND_CODES, STORE_DOOR_HAND_ONLY_ACTS, STORE_DOOR_VERBS, storeDoorDirect } from "../src/store-door-verbs.js";
import { genesisCasDir, loadOrMaterializeOracle, readGenesisCasManifest } from "../src/genesis-artifact.js";
import { casDirForStorage, mirrorGenesisCasFs, readVerifiedCasBlobFromFs } from "../src/node-cas.js";
import { readNexusDoc } from "../src/nexus-doc.js";
import { ownedStore } from "../src/owned-store.js";
import { readBootTiddlers } from "../src/vessel-private.js";
import { larBootstrapPath, larDataDir, larSealHome } from "../src/vessel-paths.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { foundHearthDirect } from "./found-route.js";

describe("the floor rows on the node's store door", () => {
  test("both rows stand, as rows of the place: no face row carries the pin", () => {
    expect(STORE_DOOR_VERBS).toEqual(expect.arrayContaining(["floor-status", "floor-accept"]));
    expect(STORE_DOOR_FACE_VERBS.has("floor-status")).toBe(false);
    expect(STORE_DOOR_FACE_VERBS.has("floor-accept")).toBe(false);
  });

  test("RED: the accept rides a person's hand alone; the status stays open to a seat", () => {
    expect(STORE_DOOR_HAND_CODES.get("floor-accept")).toBe("floor-needs-hand");
    expect(STORE_DOOR_HAND_ONLY_ACTS.has("floor-accept")).toBe(true);
    expect(STORE_DOOR_HAND_ONLY_ACTS.has("floor-status")).toBe(false);
  });

  test("the node's binding answers the mesh's one decision and declares no live swap", () => {
    const source = readFileSync(new URL("../src/commands/floor.ts", import.meta.url), "utf8");
    expect(source).toMatch(/acceptFloorRelease\(ports, opts\.target\)/);
    expect(source).toMatch(/readFloorStatus\(await nodeFloorPorts\(opts\)\)/);
    expect(source).toMatch(/floorSwap: false/);
    expect(source).not.toMatch(/floorPathFromPin|decideFloorAccept/);          // no second copy of the decision
  });
});

describe("the floor doors cross a founded hearth's own bootstrap", () => {
  vi.setConfig({ testTimeout: 240_000, hookTimeout: 240_000 });
  const GENESIS = join(import.meta.dirname, "..", "..", "..", "genesis");
  const roots: string[] = [];
  afterAll(() => { for (const r of roots) rmSync(r, { recursive: true, force: true }); });
  const freshRoot = (tag: string): string => {
    const r = mkdtempSync(join(tmpdir(), `lar-floor-door-${tag}-`));
    cpSync(GENESIS, join(r, "genesis"), { recursive: true, filter: (s) => !s.endsWith("social-bootstrap.json") });
    roots.push(r);
    return r;
  };
  const r = freshRoot("founded");

  /**
   * What the vessel's first boot stands beside a founding, each by its own producer: the oracle island under its deterministic
   * address (`loadOrMaterializeOracle`), the genesis CAS mirrored into the runtime CAS, and the catalog the pointer file names,
   * carrying the realm's pointer rows and the standing verdict its plane folds off the founding's registrations.
   */
  async function standTheBootsDocuments(root: string): Promise<{ readonly genesisFloor: string }> {
    const genesisDir = join(root, "genesis");
    mirrorGenesisCasFs(readGenesisCasManifest(genesisDir)!, genesisCasDir(genesisDir), casDirForStorage(larDataDir()));
    return ownedStore(larDataDir(), async (repo) => {
      const oracle = await loadOrMaterializeOracle(repo, genesisDir);
      const aid = readNexusDoc(larSealHome())!.sealLineage![0]!.epochCid;
      const folded = await foldRealmBags((await materializeSharedLarDoc(repo, realmDocUrl(aid), "realm")).doc(), aid);
      const catalog = repo.create<LarDoc>(emptyLarDoc());
      catalog.change((d) => {
        d.tiddlers[REALM_ID_TIDDLER] = storedLarRecord(REALM_ID_TIDDLER, { text: aid }, "vessel-boot");
        d.tiddlers[realmDocPointer(aid)] = storedLarRecord(realmDocPointer(aid), { text: realmDocUrl(aid) }, "vessel-boot");
        writeRealmStanding(d, aid, folded);
      });
      await repo.flush();
      writeFileSync(join(larDataDir(), "catalog-url"), catalog.url, "utf8");   // the boot's own pointer file
      return { genesisFloor: genesisFloorCidOf(oracle.doc())! };
    });
  }

  test("RED: on a founded hearth the status answers the genesis pin and the cut answers a manifest, though the bootstrap names no catalog and no oracle", async () => {
    await withLarRoot(r, () => foundHearthDirect({ storageDir: join(r, "hearth", "vessel"), genesisDir: join(r, "genesis") }));
    await withLarRoot(r, async () => {
      const { genesisFloor } = await standTheBootsDocuments(r);
      // The founding's own bootstrap: an address book of the social planes. It names the daemon; it names no catalog, no oracle.
      const named = Object.keys(readBootTiddlers(larBootstrapPath())!);
      expect(named).toContain(DAEMON_BAG_ID);
      expect(named).not.toContain(BAG_IDS.catalog);
      expect(named).not.toContain(BAG_IDS.oracle);

      const status = await storeDoorDirect("floor-status", {}, { sealHome: larSealHome() });
      expect(status["refused"]).toEqual([]);                                      // the status's own list of releases it set aside: a refusal reads as a string
      expect(status).toMatchObject({ verb: "floor-status", pinSource: "genesis", pinned: { manifest: genesisFloor, release: null }, board: "absent" });
      // Both truths beside the Nexus part: the founding record against the seed (offered) and against the floor pin it reads.
      const truths = status["genesis"] as { line?: string } | undefined;
      expect(truths?.line).toContain("seed (offered) ");
      expect(truths?.line).toContain(": same on every ratchet");
      expect(truths?.line).toContain(`floor pin ${genesisFloor}: engine same · grammar same · plugins same · floor same`);

      // The cut reads the founding's own realm documents through the catalog the pointer file names. They hold no row yet (no
      // seed ran), so the steward names both thin; every other slug the genesis floor names holds no document here and keeps its snapshot.
      const out = join(r, "floor.json");
      const thin = await storeDoorDirect("floor-cut", { out }, { sealHome: larSealHome() });
      expect(thin).toMatchObject({ verb: "floor-cut", refusal: "floor-cut-thin" });
      expect(String(thin["refused"])).toMatch(/lares/);
      expect(existsSync(out)).toBe(false);
      const cut = await storeDoorDirect("floor-cut", { out, thin: ["lares", "lararium"] }, { sealHome: larSealHome() });
      expect(cut["refused"]).toBeUndefined();
      expect(cut).toMatchObject({ verb: "floor-cut", prior: genesisFloor, cut: ["lararium", "lares"], out });
      expect(sha256HexBytesSync(new Uint8Array(readFileSync(out)))).toBe(cut["manifestCid"]);
      const floor = await resolveFloor(String(cut["manifestCid"]), async (cid) => readVerifiedCasBlobFromFs(cid, casDirForStorage(larDataDir())));
      expect("refusal" in floor ? floor.refusal : null).toBeNull();
    });
  });

  test("RED: the status names the floor's drift behind live canon: a carrier laid after the cut reads missing, counted once with its slots", async () => {
    const drifted = freshRoot("drift");
    await withLarRoot(drifted, () => foundHearthDirect({ storageDir: join(drifted, "hearth", "vessel"), genesisDir: join(drifted, "genesis") }));
    await withLarRoot(drifted, async () => {
      const { genesisFloor } = await standTheBootsDocuments(drifted);
      const CREST = "lar:///ha.ka.ba/lararium/mesh/crest-behind-the-floor";
      await ownedStore(larDataDir(), async (repo) => {
        const catalog = (await repo.find<LarDoc>(readFileSync(join(larDataDir(), "catalog-url"), "utf8").trim() as AutomergeUrl)).doc();
        const url = realmStandingDocUrl(catalog, bagUri("lararium"));
        expect(url).not.toBeNull();
        const live = new AutomergeDocStore(await repo.find<LarDoc>(url as AutomergeUrl), bagUri("lararium"));
        for (const title of [CREST, `${CREST}#/purpose`, `${CREST}#/source`]) {
          await live.put({ tiddler: { title, text: "laid after the cut" } }, { kind: "lares-verb", requestId: `seed-${title}` });
        }
        await repo.flush();
      });
      const status = await storeDoorDirect("floor-status", {}, { sealHome: larSealHome() });
      const drift = status["floorDrift"] as FloorDrift | null;
      expect(drift).not.toBeNull();
      expect(drift!.manifest).toBe(genesisFloor);
      const lararium = drift!.slugs.find((s) => s.slug === "lararium")!;
      expect(lararium.missing).toEqual([CREST]);
      expect(drift!.carriers).toContain(CREST);
      expect(drift!.carriers.some((c) => c.includes("#"))).toBe(false);          // carriers, never slots
      // The live lares canon holds no row here, so every carrier the floor serves for it reads older: canon no longer holds those bytes.
      expect(drift!.slugs.find((s) => s.slug === "lares")!.older.length).toBeGreaterThan(0);
      expect(drift!.count).toBe(drift!.carriers.length);
      // The canon floor drift reads as its own row: the carriers by name, the floor head it read, the runnable next line.
      const canon = (status["drifts"] as Array<{ word: string; state: string; count: number; carriers: string[]; heads: string[]; next: string }>).find((x) => x.word === "canon floor drift")!;
      expect(canon).toMatchObject({ state: "drifts", count: drift!.count, heads: [`floor ${genesisFloor}`], next: "lares nexus release floor-release.json --cut", act: "cure" });
      expect(canon.carriers).toContain(CREST);
      // A shadow tally with a mismatch reads as its own row, apart from the canon drift.
      writeFileSync(join(larDataDir(), "floor-shadow.json"), JSON.stringify({ current: { floor: genesisFloor, cleanBoots: 1, mismatchBoots: 2, unreadBoots: 0, firstMismatch: { manifest: genesisFloor, moved: [{ field: "engine", floor: "a", island: "b" }] } }, prior: [] }));
      const shadowed = await storeDoorDirect("floor-status", {}, { sealHome: larSealHome() });
      writeFileSync(join(larDataDir(), "floor-shadow.json"), "{ not json");
      const corrupt = await storeDoorDirect("floor-status", {}, { sealHome: larSealHome() });
      expect(corrupt["floorShadowWhy"]).toMatch(/floor-shadow\.json will not read/);
      expect((corrupt["drifts"] as Array<{ word: string; detail: string }>).find((x) => x.word === "shadow tally")!.detail).toContain("corrupt");
      expect((shadowed["drifts"] as Array<{ word: string; state: string; carriers: string[] }>).find((x) => x.word === "shadow tally")).toMatchObject({ state: "drifts", carriers: ["engine"] });
      // A public bag the floor names whose live document this founding holds none of reads unread by name; the system canon reads.
      expect(drift!.unread).not.toContain("lares");
      expect(drift!.unread).not.toContain("lararium");
    });
  });

  test("RED: a place in no charter whose store holds the island answers the founding record beside the seed (offered), refusing only the Nexus part by name", async () => {
    const lone = freshRoot("charterless");
    await withLarRoot(lone, async () => {
      await ownedStore(larDataDir(), async (repo) => { await loadOrMaterializeOracle(repo, join(lone, "genesis")); await repo.flush(); });
      const out = await storeDoorDirect("floor-status", {}, { sealHome: larSealHome() });
      expect(out["refusal"]).toBeUndefined();
      expect(out["nexusRefused"]).toMatchObject({ refusal: "floor-no-charter" });
      const line = String((out["genesis"] as { line?: string } | undefined)?.line);
      expect(line).toMatch(/^\[genesis\] founding record: engine \S+ · grammar \S+ · plugins \S+ · floor \S+/);
      expect(line).toContain(": same on every ratchet");
      expect(line).toContain("floor pin: none — this vessel stands in no Nexus charter");
      // CONTROL: no catalog names live canon here, so the drift reads null, never a silent zero.
      expect(out).toHaveProperty("floorDrift", null);
      expect(out["floorDriftWhy"]).toMatch(/no catalog names live canon/);
      // THE FIVE DRIFTS, each by its own word: the seed offer reads level and names its next line, the unread ones say so, never a zero.
      const rows = out["drifts"] as Array<{ word: string; state: string; next: string; detail: string }>;
      expect(rows.map((x) => x.word)).toEqual(["disk lag", "working ahead", "canon floor drift", "seed offer", "shadow tally"]);
      expect(rows.find((x) => x.word === "seed offer")).toMatchObject({ state: "level", next: "lares vessel floor seed" });
      expect(rows.find((x) => x.word === "canon floor drift")).toMatchObject({ state: "unread" });
      expect(rows.find((x) => x.word === "shadow tally")).toMatchObject({ state: "unread" });
      expect(rows.some((x) => /floor moved/.test(x.detail))).toBe(false);
    });
  });

  test("CONTROLS: a bare place that stands in no charter refuses floor-no-charter, and a founded store that holds no oracle island refuses floor-no-genesis", async () => {
    const bare = freshRoot("bare");
    await withLarRoot(bare, async () => {
      const out = await storeDoorDirect("floor-status", {}, { sealHome: larSealHome() });
      expect(out).toMatchObject({ verb: "floor-status", refusal: "floor-no-charter" });
    });
    const dry = freshRoot("dry");
    await withLarRoot(dry, () => foundHearthDirect({ storageDir: join(dry, "hearth", "vessel"), genesisDir: join(dry, "genesis") }));
    await withLarRoot(dry, async () => {
      // No boot ran: the founding stood the social planes and the realm, and the store holds no oracle island yet.
      const out = await storeDoorDirect("floor-status", {}, { sealHome: larSealHome() });
      expect(out).toMatchObject({ verb: "floor-status", refusal: "floor-no-genesis" });
      expect(String(out["refused"])).toMatch(/oracle island/);
    });
  });
});
