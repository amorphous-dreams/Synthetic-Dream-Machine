import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cmdNexus } from "../src/commands/nexus.js";
import { cmdVessel } from "../src/commands/vessel.js";
import type { ParsedArgs } from "../src/parse-args.js";
import {
  computePluginsCid, GENESIS_CID_ENGINE_TIDDLER, GENESIS_CID_GRAMMAR_TIDDLER,
  GENESIS_CID_PLUGINS_TIDDLER, sha256HexBytesSync, type GenesisSeed, type RegionEntry,
} from "@lararium/mesh";
import { generateOrLoadPersonaGroupRoot, wearPersona } from "@lararium/node";
import { runNexusPublishPlugins } from "@lararium/node";
import { larDataDir } from "@lararium/node";

const args = (positional: string[], flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ command: "nexus", positional, options: {}, flags } as unknown as ParsedArgs);

let root: string;
let priorRoot: string | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lares-cli-offering-inspect-"));
  priorRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
});
afterEach(() => {
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
  rmSync(root, { recursive: true, force: true });
});

function seedGenesis(): { dir: string; bytes: Uint8Array } {
  const dir = join(root, "genesis");
  mkdirSync(dir, { recursive: true });
  const bytes = new TextEncoder().encode("cli good plugin bytes");
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
  return { dir, bytes };
}

async function stand(): Promise<void> {
  await cmdVessel({ command: "vessel", positional: ["found"], options: {}, flags: { json: true } });
  await generateOrLoadPersonaGroupRoot(0);
  await wearPersona(0);
}

describe("lares nexus offering inspect — CLI boundary", () => {
  it("refuses --apply as an unsupported flag through structured JSON", async () => {
    const out: string[] = [];
    const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { out.push(String(chunk)); return true; });
    expect(await cmdNexus(args(["offering", "inspect", `sha256:${"a".repeat(64)}`], { json: true, apply: true }))).toBe(2);
    const payload = JSON.parse(out.join("")) as { ok: boolean; error?: { code: string; message: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe("usage");
    expect(payload.error?.message).toMatch(/unsupported option --apply/);
    write.mockRestore();
  });

  it("reports completed local transport separately from verified observation and adoption", async () => {
    const { dir, bytes } = seedGenesis();
    await stand();
    const offered = await runNexusPublishPlugins({ genesisDir: dir, storageDir: larDataDir() });
    expect(offered.offering.blobs[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
    mkdirSync(join(larDataDir(), "cas"), { recursive: true });
    writeFileSync(join(larDataDir(), "cas", offered.offering.blobs[0]!.sha256), bytes);
    const out: string[] = [];
    const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { out.push(String(chunk)); return true; });
    expect(await cmdNexus(args(["offering", "inspect", offered.offeringCid], { json: true }))).toBe(0);
    const payload = JSON.parse(out.join("")) as { ok: boolean; data: Record<string, any> };
    expect(payload.ok).toBe(true);
    expect(payload.data.transport).toEqual({ status: "complete", source: "local-crossroads", remoteFetch: false });
    expect(payload.data.inspection).toEqual({ status: "verified", byteStatus: "complete", adoption: "not-requested" });
    expect(payload.data.bytes.held).toEqual([offered.offering.blobs[0]!.sha256]);
    expect(payload.data.antigen).toEqual({ status: "unavailable", reason: "not-configured" });
    write.mockRestore();
  });
});
