/**
 * nexus publish — THE OFFERING DOOR, held apart from the kāhuli ratchets.
 *
 * `pluginsCid` names THIS operator's own collection. It layers on the required blobs, overturns nobody
 * else's reading, and moves with no ratchet act at all — so it never stood as a kāhuli tier, and the
 * kāhuli door said so in its own header while reporting the region anyway. An operator who wanted to see
 * their own collection had to walk in through the door that governs the MESH's grammar.
 *
 * `publish` takes the region back. It reads tier-parameterized exactly as `kahuli` does — one case per
 * publishable thing — so a second cap arrives as a case rather than a door.
 *
 * STAGE 1 READS. The signed offering and its crossroads announce land next; `--apply` names that hold the
 * way `kahuli engine` names its own, because a deliberate not-yet must never read as an unknown verb.
 */
import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";

const args = (positional: string[], flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ command: "nexus", positional, options: {}, flags } as unknown as ParsedArgs);

describe("lares nexus publish — the operator's own collection, apart from the ratchets", () => {
  let root: string;
  let errs: string[];
  let logs: string[];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-publish-"));
    saved["LAR_ROOT"] = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = root;               // isolates the genesis read to an empty tree
    errs = []; logs = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { errs.push(a.join(" ")); });
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { logs.push(a.join(" ")); });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (saved["LAR_ROOT"] === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = saved["LAR_ROOT"];
    rmSync(root, { recursive: true, force: true });
  });

  test("★ `publish plugins` READS the operator's own collection and builds nothing ★", async () => {
    expect(await cmdNexus(args(["publish", "plugins"]))).toBe(0);
    const said = [...errs, ...logs].join("\n");
    expect(said).toMatch(/plugins/i);
    // The region names THIS operator's collection — the door says whose it is, so a reader never takes it
    // for a mesh-wide fact the way an epoch reads.
    expect(said).toMatch(/own collection/i);
  });

  test("★ the OFFERING is HELD — a deliberate not-yet, never an unknown verb ★", async () => {
    const code = await cmdNexus(args(["publish", "plugins"], { apply: true }));
    expect(code).not.toBe(0);
    const said = [...errs, ...logs].join("\n");
    expect(said).toMatch(/held/i);
    expect(said).not.toMatch(/unknown/i);
  });

  test("no tier / an unknown tier refuses THROUGH the emit choke point", async () => {
    // Off-TTY (every pipe, and every test runner) `emit` renders the machine payload, so the usage prose
    // reaches a human and the verdict reaches an agent.
    const out: string[] = [];
    const w = vi.spyOn(process.stdout, "write").mockImplementation((c: unknown) => { out.push(String(c)); return true; });
    expect(await cmdNexus(args(["publish"]))).toBe(2);
    expect(await cmdNexus(args(["publish", "engine"]))).toBe(2);
    const payloads = out.join("").trim().split("\n").map((l) => JSON.parse(l) as { ok: boolean; error?: { code?: string; message?: string } });
    expect(payloads.every((p) => p.ok === false && p.error?.code === "usage")).toBe(true);
    // `engine` names a real KĀHULI tier and no publishable thing — the refusal says which door holds it.
    expect(payloads[1]?.error?.message).toContain("engine");
    w.mockRestore();
  });

  test("★ the KĀHULI door stops reporting the plugins region — the ratchet names only what it ratchets ★", async () => {
    expect(await cmdNexus(args(["kahuli", "grammar"]))).toBe(0);
    const said = [...errs, ...logs].join("\n");
    expect(said).toMatch(/grammar/i);
    expect(said).toMatch(/engine/i);
    // The region moved out. The door MAY POINT at where it went — a reader who looked here deserves the
    // forwarding address — but it may not REPORT the region, which is the reading that made it look like
    // a third tier. So: no report line, and a pointer naming the door that holds it.
    expect(said, "the kahuli door still REPORTS the plugins region").not.toMatch(/plugins \(pluginsCid/);
    expect(said, "the kahuli door drops the region without saying where it went").toMatch(/nexus publish plugins/);
  });

  test("CONTROL — the kāhuli door still reads its OWN two regions, so the cut removed nothing else", async () => {
    expect(await cmdNexus(args(["kahuli", "grammar"]))).toBe(0);
    const said = [...errs, ...logs].join("\n");
    expect(said).toMatch(/grammarCid/);
    expect(said).toMatch(/engineCid/);
  });
});
