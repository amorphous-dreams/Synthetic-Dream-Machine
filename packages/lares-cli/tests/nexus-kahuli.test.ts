/**
 * nexus-kahuli — the tier-parameterized OVERTURN verb and its composed rite (the approved command surface).
 *
 *   lares nexus kahuli engine    the SLOW ratchet (engineCid = the hearth true-name) — HELD: advancing it
 *                                re-binds membership mesh-wide; the graceful forward-rebind span awaits rulings.
 *   lares nexus kahuli grammar   the FAST ratchet (pluginsCid = the memetic-wikitext composition) — reads the
 *                                current epoch; --apply composes the bake (held while the live re-bake settles).
 *   lares nexus rite kahuli      the composed overturn, diff-gated + idempotent, the deliberate build's home.
 *
 * These assertions pin the SURFACE and the tier semantics (engine held ≠ an unknown verb; grammar reads and
 * never builds; the rite is registered). The bake+push payload is wired next; here we prove the door.
 */
import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";

const args = (positional: string[], flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ command: "nexus", positional, options: {}, flags } as unknown as ParsedArgs);

describe("lares nexus kahuli — the tier-parameterized overturn", () => {
  let root: string;
  let errs: string[];
  let logs: string[];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-kahuli-"));
    saved["LAR_ROOT"] = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = root;                 // isolates the genesis-dir read to an empty tree
    errs = []; logs = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { errs.push(a.join(" ")); });
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { logs.push(a.join(" ")); });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (saved["LAR_ROOT"] === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = saved["LAR_ROOT"];
    rmSync(root, { recursive: true, force: true });
  });

  test("★ engine is HELD — a deliberate not-yet, distinct from an unknown verb ★", async () => {
    const code = await cmdNexus(args(["kahuli", "engine"]));
    expect(code).not.toBe(0);
    // The message names the HOLD and its reason, never "unknown verb" — the tier is real, its advance withheld.
    const said = [...errs, ...logs].join("\n");
    expect(said).toMatch(/held/i);
    expect(said).not.toMatch(/unknown verb/i);
  });

  test("grammar READS the current epoch and never builds — 0 even on a fresh tree with no island", async () => {
    const code = await cmdNexus(args(["kahuli", "grammar"]));
    expect(code).toBe(0);
    const said = [...errs, ...logs].join("\n");
    expect(said).toMatch(/grammar|plugins|epoch/i);
  });

  test("grammar --apply is HELD while the bake+push land next", async () => {
    const code = await cmdNexus(args(["kahuli", "grammar"], { apply: true }));
    expect(code).not.toBe(0);
    expect([...errs, ...logs].join("\n")).toMatch(/held|bake|push/i);
  });

  test("no tier / an unknown tier prints usage and refuses", async () => {
    expect(await cmdNexus(args(["kahuli"]))).toBe(2);
    expect(await cmdNexus(args(["kahuli", "corpus"]))).toBe(2);
    expect(errs.join("\n")).toMatch(/engine.*grammar|grammar.*engine/is);
  });

  test("★ the rite table lists `kahuli` — the composed front door is registered ★", async () => {
    const code = await cmdNexus(args(["rite"]));    // no petname → prints the table, returns 0
    expect(code).toBe(0);
    expect(errs.join("\n")).toMatch(/kahuli/);
  });
});
