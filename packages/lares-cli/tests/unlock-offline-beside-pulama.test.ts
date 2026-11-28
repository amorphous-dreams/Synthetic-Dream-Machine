/**
 * unlock-offline-beside-pulama — `lares vault unlock` with no vessel standing (the daemon down) in a house whose custody a
 * pūlama keeps refuses by name before any prompt: it never proves a route against the slot tree around the pūlama.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let prompts = 0;
vi.mock("../src/prompt-secret.js", () => {
  const asked = (): Promise<string> => { prompts += 1; return Promise.resolve(""); };
  return { canPromptSecret: () => true, promptLine: asked, promptSecret: asked, promptSecretConfirmed: asked };
});
const frames: unknown[] = [];
vi.mock("../src/custody-door.js", async (real) => ({
  ...(await real<typeof import("../src/custody-door.js")>()),
  sendCustodyFrame: async (frame: unknown) => { frames.push(frame); return null; },
}));
vi.mock("../src/local-connector.js", async (real) => ({ ...(await real<typeof import("../src/local-connector.js")>()), udsAlive: async () => false }));

import { parseArgs } from "../src/parse-args.js";

let cmdVault: typeof import("../src/commands/vault.js").cmdVault;
beforeAll(async () => { vi.resetModules(); ({ cmdVault } = await import("../src/commands/vault.js")); });

let out: string[];
let root: string;
const KEYS = ["HOME", "LARES_PULAMA", "LAR_PULAMA_SOCKET"] as const;
let prior: Record<string, string | undefined>;
beforeEach(() => {
  prompts = 0; frames.length = 0; out = [];
  root = mkdtempSync(join(tmpdir(), "unlock-offline-pulama-"));
  process.env["LAR_ROOT"] = root;
  prior = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  process.env["HOME"] = join(root, "operator");
  delete process.env["LARES_PULAMA"];
  delete process.env["LAR_PULAMA_SOCKET"];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.join(" ")); });
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { out.push(a.join(" ")); });
  vi.spyOn(process.stdout, "write").mockImplementation((c) => { out.push(String(c)); return true; });
});
afterEach(() => {
  vi.restoreAllMocks(); delete process.env["LAR_ROOT"];
  for (const k of KEYS) { if (prior[k] === undefined) delete process.env[k]; else process.env[k] = prior[k]; }
  rmSync(root, { recursive: true, force: true });
});

const run = (...argv: string[]): Promise<number> => cmdVault(parseArgs(["vault", "unlock", ...argv, "--json"]));
const answer = (): { ok: boolean; error?: { code: string; message: string } } => JSON.parse(out.join("").trim().split("\n").at(-1) ?? "{}");

describe("RED unlock-offline-beside-a-pulama-refuses-by-name", () => {
  it("the daemon down and a pūlama named: refuse `offline-beside-pulama`, ask nothing, open nothing around it", async () => {
    process.env["LARES_PULAMA"] = "1";
    expect(await run("passphrase=true")).toBe(1);
    expect(prompts).toBe(0);
    expect(frames).toEqual([]);
    expect(answer().error?.code).toBe("offline-beside-pulama");
    expect(answer().error?.message).toMatch(/pūlama/);
    expect(answer().error?.message).toMatch(/lares vessel stand|lares-container\.sh up/);
  });

  it("CONTROL: no pūlama named, the offline unlock still gathers its route and proves it against the slot tree", async () => {
    await run("passphrase=true");
    expect(prompts).toBeGreaterThan(0);
    expect(answer().error?.code).not.toBe("offline-beside-pulama");
  });
});
