/**
 * genesis-cold-start -- a founding on a fresh LAR_ROOT reaches the committed genesis/ with no hand copy, and the
 * CLI and the daemon resolve the same dir.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { daemonGenesisDir } from "@lararium/node";
import { repoRoot } from "@lararium/mesh/node";
import { larGenesisDir } from "../src/env.js";

const saved = { ...process.env };
const roots: string[] = [];
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});
const coldRoot = (): string => { const r = mkdtempSync("/tmp/lares-cold-root-"); roots.push(r); return r; };

describe("a cold root and the shipped seed", () => {
  test("a fresh root holding no genesis resolves the CLI and the daemon to the shipped dir", () => {
    process.env["LAR_ROOT"] = coldRoot(); process.env["HOME"] = coldRoot();
    delete process.env["LAR_GENESIS"];
    expect(larGenesisDir()).toBe(join(repoRoot, "genesis"));
    expect(daemonGenesisDir()).toBe(join(repoRoot, "genesis"));
  });

  test("CONTROL: an explicit LAR_GENESIS still wins in both", () => {
    process.env["LAR_ROOT"] = coldRoot(); process.env["HOME"] = coldRoot();
    process.env["LAR_GENESIS"] = "/explicit/genesis";
    expect(larGenesisDir()).toBe("/explicit/genesis");
    expect(daemonGenesisDir()).toBe("/explicit/genesis");
  });
});

describe("the CLI reads the configured genesis as the daemon does", () => {
  test("a configured resources.genesis wins on a cold root in both", async () => {
    const { laresConfigPath } = await import("@lararium/node");
    process.env["LAR_ROOT"] = coldRoot(); process.env["HOME"] = coldRoot();
    delete process.env["LAR_GENESIS"];
    mkdirSync(join(process.env["HOME"]!, ".lares"), { recursive: true });
    writeFileSync(laresConfigPath(), JSON.stringify({ resources: { genesis: "/configured/genesis" } }));
    expect(larGenesisDir()).toBe("/configured/genesis");
    expect(daemonGenesisDir()).toBe("/configured/genesis");
  });
});
