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
 *     holds no oracle island, each refuse by their own name (the row carries the refusal's own name, never the verb's).
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test, vi } from "vitest";
import {
  BAG_IDS, DAEMON_BAG_ID, REALM_ID_TIDDLER, emptyLarDoc, foldRealmBags, genesisFloorCidOf, materializeSharedLarDoc, realmDocPointer, realmDocUrl, resolveFloor,
  sha256HexBytesSync, storedLarRecord, writeRealmStanding, type LarDoc,
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
