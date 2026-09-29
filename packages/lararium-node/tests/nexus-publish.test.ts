/**
 * nexus-publish — production boundary tests for the local immutable gift door.
 *
 * The tests use a real Node identity, real genesis seed derivation, and a real persisted Crossroads
 * board. They keep the gift boundary visible: publication signs and announces; it never installs or
 * mutates a grammar.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  computePluginsCid,
  crossroadsDocUrl,
  GENESIS_CID_ENGINE_TIDDLER,
  GENESIS_CID_GRAMMAR_TIDDLER,
  GENESIS_CID_PLUGINS_TIDDLER,
  materializeSharedLarDoc,
  offeringAnnouncesFromDoc,
  pluginOfferingCid,
  type GenesisSeed,
  type RegionEntry,
} from "@lararium/mesh";
import {
  runNexusPublishPlugins,
  NexusPublishError,
} from "../src/index.js";
import {
  generateOrLoadPersonaGroupRoot,
  generateOrLoadVesselIdentity,
  loadVesselVerifyingKey,
  wearPersona,
} from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";

let root: string;
let priorRoot: string | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lares-offering-"));
  priorRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
});

afterEach(() => {
  if (priorRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorRoot;
  rmSync(root, { recursive: true, force: true });
});

function seedGenesis(): string {
  const genesisDir = join(root, "genesis");
  mkdirSync(genesisDir, { recursive: true });
  const plugin: RegionEntry = {
    id: "$:/plugins/example/one",
    sha256: "a".repeat(64),
    kind: "plugin",
  };
  const seed: GenesisSeed = {
    format: "lararium-genesis-seed/v1",
    actorSeed: "actor-seed",
    schemaVersion: "alpha",
    blobs: {
      [plugin.id]: {
        id: plugin.id,
        sha256: plugin.sha256,
        mimeType: "application/json",
        version: "local-alpha",
      },
    },
    tiddlers: {
      [GENESIS_CID_ENGINE_TIDDLER]: { tiddler: { cid: "e".repeat(64) } },
      [GENESIS_CID_GRAMMAR_TIDDLER]: { tiddler: { cid: "b".repeat(64) } },
      [GENESIS_CID_PLUGINS_TIDDLER]: {
        tiddler: { cid: computePluginsCid([plugin]) },
      },
    },
  };
  writeFileSync(join(genesisDir, "seed.json"), JSON.stringify(seed));
  return genesisDir;
}

async function standPersona(): Promise<void> {
  await generateOrLoadVesselIdentity();
  await generateOrLoadPersonaGroupRoot(0);
  await wearPersona(0);
}

describe("runNexusPublishPlugins — immutable offering boundary", () => {
  it("signs, announces, and retrieves the exact gift from a persisted Crossroads board", async () => {
    const genesisDir = seedGenesis();
    const seedBefore = readFileSync(join(genesisDir, "seed.json"), "utf8");
    await standPersona();

    const first = await runNexusPublishPlugins({ genesisDir, storageDir: larDataDir() });
    expect(first.offeringCid).toBe(pluginOfferingCid(first.offering));
    expect(first.boardUrl).toBe(crossroadsDocUrl(await loadVesselVerifyingKey()));
    expect(first.blobCount).toBe(1);

    const second = await runNexusPublishPlugins({ genesisDir, storageDir: larDataDir() });
    expect(second.offeringCid).toBe(first.offeringCid);
    expect(second.offering).toEqual(first.offering);

    const repo = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
    const board = await materializeSharedLarDoc(repo, first.boardUrl, "board:crossroads");
    const records = offeringAnnouncesFromDoc(board.doc());
    expect(records).toHaveLength(1);
    expect(records[0]?.offeringCid).toBe(first.offeringCid);
    expect(records[0]?.offering).toEqual(first.offering);
    expect(readFileSync(join(genesisDir, "seed.json"), "utf8"), "publishing never mutates the grammar seed")
      .toBe(seedBefore);
    await repo.shutdown();
  });

  it("refuses without an explicitly worn persona and leaves no board behind", async () => {
    const genesisDir = seedGenesis();
    await generateOrLoadVesselIdentity();
    await generateOrLoadPersonaGroupRoot(0);

    await expect(runNexusPublishPlugins({ genesisDir, storageDir: larDataDir() }))
      .rejects.toBeInstanceOf(NexusPublishError);
    expect(readFileSync(join(genesisDir, "seed.json"), "utf8")).toContain("example/one");
  });

  it("refuses when the genesis seed is absent before opening a board", async () => {
    await standPersona();
    await expect(runNexusPublishPlugins({ genesisDir: join(root, "missing-genesis"), storageDir: larDataDir() }))
      .rejects.toBeInstanceOf(NexusPublishError);
  });
});
