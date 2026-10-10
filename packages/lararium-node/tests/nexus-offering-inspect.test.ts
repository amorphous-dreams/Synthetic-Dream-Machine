/** Red-first receiver boundary: inspect one exact offering, with local bytes only. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  computePluginsCid, GENESIS_CID_ENGINE_TIDDLER, sha256HexBytesSync,
  GENESIS_CID_GRAMMAR_TIDDLER, GENESIS_CID_PLUGINS_TIDDLER,
  materializeSharedLarDoc, offeringAnnounceKey,
  type GenesisSeed, type RegionEntry,
} from "@lararium/mesh";
import { generateOrLoadPersonaGroupRoot, generateOrLoadVesselIdentity, wearPersona } from "../src/node-vessel-identity.js";
import { runNexusPublishPlugins } from "../src/commands/nexus-publish.js";
import { runNexusInspectOffering, NexusOfferingInspectError } from "../src/commands/nexus-offering-inspect.js";
import { larDataDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";

let root: string;
let priorRoot: string | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lares-offering-inspect-"));
  priorRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
});
afterEach(() => {
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
  rmSync(root, { recursive: true, force: true });
});

function seedGenesis(): { dir: string; cid: string; bytes: Uint8Array } {
  const dir = join(root, "genesis");
  mkdirSync(join(dir, "cas"), { recursive: true });
  const bytes = new TextEncoder().encode("good plugin bytes");
  const plugin: RegionEntry = { id: "$:/plugins/example/one", sha256: sha256HexBytesSync(bytes), kind: "plugin" };
  const seed: GenesisSeed = {
    format: "lararium-genesis-seed/v1", actorSeed: "actor-seed", schemaVersion: "alpha",
    blobs: { [plugin.id]: { id: plugin.id, sha256: plugin.sha256, mimeType: "application/json", version: "alpha" } },
    tiddlers: {
      [GENESIS_CID_ENGINE_TIDDLER]: { tiddler: { cid: "e".repeat(64) } },
      [GENESIS_CID_GRAMMAR_TIDDLER]: { tiddler: { cid: "b".repeat(64) } },
      [GENESIS_CID_PLUGINS_TIDDLER]: { tiddler: { cid: computePluginsCid([plugin]) } },
    },
  };
  writeFileSync(join(dir, "seed.json"), JSON.stringify(seed));
  return { dir, cid: plugin.sha256, bytes };
}

async function stand(): Promise<void> {
  await generateOrLoadVesselIdentity();
  await generateOrLoadPersonaGroupRoot(0);
  await wearPersona(0);
}

describe("runNexusInspectOffering — bounded local receiver", () => {
  it("verifies one board gift and reports held/missing local bytes without consulting Antigen", async () => {
    const { dir, cid, bytes } = seedGenesis();
    await stand();
    const offered = await direct(runNexusPublishPlugins)({ genesisDir: dir, storageDir: larDataDir() });
    expect(offered.offering.blobs[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
    mkdirSync(join(larDataDir(), "cas"), { recursive: true });
    writeFileSync(join(larDataDir(), "cas", cid), bytes);
    const seedBefore = readFileSync(join(dir, "seed.json"));
    const filesBefore = readdirSync(larDataDir(), { recursive: true }).sort();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await runNexusInspectOffering({ offeringCid: offered.offeringCid, storageDir: larDataDir(), casDir: join(larDataDir(), "cas") });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(result.verification.ok).toBe(true);
    expect(result.transport).toEqual({ status: "complete", source: "local-crossroads", remoteFetch: false });
    expect(result.inspection).toEqual({ status: "verified", byteStatus: "complete", adoption: "not-requested" });
    expect(result.bytes.held).toEqual([cid]);
    expect(result.bytes.missing).toEqual([]);
    expect(result.bytes.invalid).toEqual([]);
    expect(result.antigen).toEqual({ status: "unavailable", reason: "not-configured" });
    expect(readFileSync(join(dir, "seed.json"))).toEqual(seedBefore);
    expect(readdirSync(larDataDir(), { recursive: true }).sort()).toEqual(filesBefore);

    writeFileSync(join(larDataDir(), "cas", cid), Buffer.from("wrong bytes"));
    const corrupt = await runNexusInspectOffering({ offeringCid: offered.offeringCid, storageDir: larDataDir(), casDir: join(larDataDir(), "cas") });
    expect(corrupt.inspection.byteStatus).toBe("invalid");
    expect(corrupt.bytes.invalid).toEqual([cid]);

    rmSync(join(larDataDir(), "cas", cid));
    const missing = await runNexusInspectOffering({ offeringCid: offered.offeringCid, storageDir: larDataDir(), casDir: join(larDataDir(), "cas") });
    expect(missing.inspection.byteStatus).toBe("partial");
    expect(missing.bytes.missing).toEqual([cid]);
  });

  it("refuses unknown CID and does not mint a blank Crossroads board", async () => {
    await stand();
    const storage = larDataDir();
    await expect(runNexusInspectOffering({ offeringCid: `sha256:${"f".repeat(64)}`, storageDir: storage }))
      .rejects.toBeInstanceOf(NexusOfferingInspectError);
    const afterFirst = existsSync(storage) ? readdirSync(storage, { recursive: true }).sort() : [];
    await expect(runNexusInspectOffering({ offeringCid: `sha256:${"f".repeat(64)}`, storageDir: storage }))
      .rejects.toBeInstanceOf(NexusOfferingInspectError);
    expect(existsSync(storage) ? readdirSync(storage, { recursive: true }).sort() : []).toEqual(afterFirst);
  });

  it("refuses a malformed record at the exact board key", async () => {
    const { dir } = seedGenesis();
    await stand();
    const offered = await direct(runNexusPublishPlugins)({ genesisDir: dir, storageDir: larDataDir() });
    const repo = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
    const board = await materializeSharedLarDoc(repo, offered.boardUrl, "board:crossroads");
    board.change((doc) => { doc.tiddlers[offeringAnnounceKey(offered.offeringCid)] = { tiddler: { title: offeringAnnounceKey(offered.offeringCid), text: "not-json" }, meta: { authority: "test" } }; });
    await repo.flush();
    await repo.shutdown();
    await expect(runNexusInspectOffering({ offeringCid: offered.offeringCid, storageDir: larDataDir() }))
      .rejects.toThrow(/malformed/);
  });

  it("refuses a signed offering placed beneath the wrong Crossroads wrapper domain", async () => {
    const { dir } = seedGenesis();
    await stand();
    const offered = await direct(runNexusPublishPlugins)({ genesisDir: dir, storageDir: larDataDir() });
    const repo = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
    const board = await materializeSharedLarDoc(repo, offered.boardUrl, "board:crossroads");
    const key = offeringAnnounceKey(offered.offeringCid);
    const prior = board.doc()?.tiddlers[key]?.tiddler.text;
    expect(typeof prior).toBe("string");
    board.change((doc) => {
      doc.tiddlers[key] = {
        tiddler: {
          title: key,
          text: JSON.stringify({ ...JSON.parse(prior as string), kind: "lar:///wrong-offering-wrapper" }),
        },
        meta: { authority: "test" },
      };
    });
    await repo.flush();
    await repo.shutdown();
    await expect(runNexusInspectOffering({ offeringCid: offered.offeringCid, storageDir: larDataDir() }))
      .rejects.toThrow(/malformed/);
  });
});
