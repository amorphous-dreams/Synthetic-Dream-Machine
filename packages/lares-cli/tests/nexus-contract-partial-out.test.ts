/**
 * nexus-contract-partial-out — the two-vault door refuses an `--out` its write could not take BEFORE any act runs,
 * so a landed act never strands for want of its file (a retry on the landing vault reads replay).
 *
 *   O1  RED: `--out` naming a directory, a missing directory, or (for `--from`) the carried partial itself refuses by
 *       name, and the store door never runs (the scratch root holds no store, no vessel and no charter).
 *   O2  CONTROL: a writable `--out` passes the check and reaches the store door, which then refuses on its own
 *       ground (no charter), so the check alone never decides the act.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";

const NYM = "ab".repeat(32);
const run = (positional: string[], options: Record<string, string>): ParsedArgs =>
  ({ command: "nexus", positional, options, flags: { json: true } } as unknown as ParsedArgs);

describe("the two-vault door checks its --out before any act", () => {
  let root: string;
  let said: string[];
  const saved: Record<string, string | undefined> = {};
  const ENV = ["LAR_ROOT", "LAR_SEAL_HOME", "LAR_DATA_DIR"];
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-partial-out-"));
    for (const k of ENV) { saved[k] = process.env[k]; process.env[k] = root; }
    said = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { said.push(a.join(" ")); });
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { said.push(a.join(" ")); });
    vi.spyOn(process.stdout, "write").mockImplementation((c: unknown) => { said.push(String(c)); return true; });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]!; }
    rmSync(root, { recursive: true, force: true });
  });
  const answer = async (a: ParsedArgs): Promise<string> => { said = []; await cmdNexus(a); return said.join("\n"); };

  test("O1 — a directory, a missing directory, or the carried file refuses by name, before the store door", async () => {
    const dir = join(root, "a-dir");
    mkdirSync(dir);
    expect(await answer(run(["contract", NYM], { out: dir }))).toMatch(/names a directory; name a file/);
    expect(await answer(run(["contract", NYM], { out: join(root, "absent", "p.json") }))).toMatch(/its directory does not exist/);
    const carried = join(root, "p.json");
    writeFileSync(carried, "{}");
    expect(await answer(run(["contract"], { from: carried, out: carried }))).toMatch(/--out names the partial you carried/);
  });

  test("O2 — CONTROL: a writable --out reaches the store door, which refuses on its own ground", async () => {
    const out = await answer(run(["contract", NYM], { out: join(root, "p.json") }));
    expect(out).not.toMatch(/--out/);
    expect(out).not.toBe("");
  });
});
