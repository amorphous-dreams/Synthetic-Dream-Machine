import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cmdNexus } from "../src/commands/nexus.js";
import { cmdVessel } from "../src/commands/vessel.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { sha256HexBytesSync } from "@lararium/mesh";
import { generateOrLoadPersonaGroupRoot } from "@lararium/node";
import { runNexusPublishPlugins, ownedStore } from "@lararium/node";
import { larDataDir } from "@lararium/node";

// The room each test and hook takes, stated where the file loads: a case founds a vessel, lights a face and seals rows under a derived key, so it runs for seconds. A timeout stated inside a hook reaches no
// case the runner already collected.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

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

/** An UNSIGNED offering source directory (H3, F2-3) — `offering.json` plus the one blob's bytes
 *  beside it, never genesis. */
function seedOfferingSource(): { dir: string; bytes: Uint8Array } {
  const dir = join(root, "offering-source");
  mkdirSync(dir, { recursive: true });
  const bytes = new TextEncoder().encode("cli good plugin bytes");
  const descriptor = {
    blobs: [{
      id: "$:/plugins/example/one", version: "alpha", sha256: sha256HexBytesSync(bytes),
      provenance: { source: "https://example.test/example-one", commit: "a".repeat(40), path: "plugins/example/one", licence: "MIT" },
      file: "plugin.bin",
    }],
  };
  writeFileSync(join(dir, "offering.json"), JSON.stringify(descriptor));
  writeFileSync(join(dir, "plugin.bin"), bytes);
  return { dir, bytes };
}

async function stand(): Promise<void> {
  // Founding needs the genesis seed (the engine CID etc.) regardless of this door's own offering
  // source (H3: publish reads a local `--source`, never genesis) — something must still found the vessel.
  cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), join(root, "genesis"), { recursive: true });
  writeFileSync(join(root, ".lar-test-scratch"), "");   // a staged root: the place card's read-back stands in
  await cmdVessel({ command: "vessel", positional: ["found"], options: {}, flags: { json: true } });
  await generateOrLoadPersonaGroupRoot(0);
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
    const { dir, bytes } = seedOfferingSource();
    await stand();
    const offered = await ownedStore(larDataDir(), (repo) => runNexusPublishPlugins({ source: dir, storageDir: larDataDir(), repo }));
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
