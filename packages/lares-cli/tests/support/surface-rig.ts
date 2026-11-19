/**
 * surface-rig — the `lares surface` suites' one scratch house: a scratch LAR_ROOT (the shared fixture), its projections
 * and config homes, the doors the command reads (a named face, an in-memory or scratch Synced tree, a recorded launch),
 * a git runner under an empty global config, and a captured console. A workspace a share row names rests at
 * `<scratch root>/workspaces/<name>`, as the house binds it.
 */
import { mkdirSync, writeFileSync, chmodSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { vi } from "vitest";
import { SyncedTree, syncedTreeDir } from "@lararium/node";
import { closeScratch, openScratch, type Scratch } from "../../../lararium-node/tests/support/scratch-fixture.js";
import type { SurfaceDoors, SurfaceFace } from "../../src/commands/surface.js";
import type { ParsedArgs } from "../../src/parse-args.js";

export interface SurfaceRig {
  readonly scratch: Scratch;
  readonly projections: string;
  readonly config: string;
  readonly tree: SyncedTree;
  readonly launched: string[][];
  /** The doors, the worn face set by `wear`. */
  readonly doors: SurfaceDoors;
  wear(face: SurfaceFace): void;
  /** Where the command reads its working directory (`check` with no `--face`). */
  at(dir: string): void;
  said(): string;
  close(): void;
}

export function openSurfaceRig(): SurfaceRig {
  const scratch = openScratch({ prefix: "lares-surface-" });
  const projections = join(scratch.root, "projections");
  const config = join(scratch.root, "config");
  mkdirSync(projections, { recursive: true });
  mkdirSync(config, { recursive: true });
  const tree = new SyncedTree(syncedTreeDir(join(scratch.root, "hearth", "checkpoints", "projection")));
  const launched: string[][] = [];
  let face: SurfaceFace = { index: 0, petname: "Heron Lantern" };
  let cwd = scratch.root;
  const out: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.map(String).join(" ")); });
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { out.push(a.map(String).join(" ")); });
  vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => { out.push(a.map(String).join(" ")); });
  vi.spyOn(process.stdout, "write").mockImplementation(((s: string | Uint8Array) => { out.push(String(s)); return true; }) as typeof process.stdout.write);
  const doors: SurfaceDoors = {
    face: async (args: ParsedArgs) => {
      const named = args.options["face"];
      return named === undefined ? face : { index: Number(named), petname: face.petname };
    },
    projections: () => projections,
    config: () => config,
    tree: () => tree,
    cwd: () => cwd,
    launch: (argv) => { launched.push([...argv]); return 0; },
    basePath: (file) => resolve(file),
    workspace: (name) => { const dir = join(scratch.root, "workspaces", name); try { return statSync(dir).isDirectory() ? dir : null; } catch { return null; } },
  };
  return {
    scratch, projections, config, tree, launched, doors,
    wear: (f) => { face = f; },
    at: (dir) => { cwd = dir; },
    said: () => out.join("\n"),
    close: () => { vi.restoreAllMocks(); closeScratch(scratch); },
  };
}

/** git under the scratch's empty global config and no system config. */
export function git(cwd: string, ...args: string[]): { code: number; out: string; err: string } {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith("GIT_")) env[k] = v;
  env["GIT_CONFIG_GLOBAL"] = "/dev/null";
  env["GIT_CONFIG_NOSYSTEM"] = "1";
  const r = spawnSync("git", args, { cwd, env, encoding: "utf8" });
  return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? "" };
}

/** A command line for `cmdSurface`. */
export function surfaceArgs(positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}): ParsedArgs {
  return { command: "surface", positional, options, flags: { "no-json": false, json: false, ...flags } } as unknown as ParsedArgs;
}

/** Plant a file, making its folders. */
export function plant(path: string, text: string): string {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
  return path;
}

/**
 * A stub `lares` on PATH for the pre-commit hook, which runs `lares surface check`: it exits with `code` and writes
 * its argv to `seen`. Answers the restore.
 */
export function stubLaresOnPath(code: number): { readonly seen: string; restore(): void } {
  const dir = mkdtempSync(join(process.env["LAR_ROOT"] ?? "/tmp", "stub-bin-"));
  const seen = join(dir, "seen");
  const bin = join(dir, "lares");
  writeFileSync(bin, `#!/bin/sh\necho "$@" >> "${seen}"\nexit ${code}\n`);
  chmodSync(bin, 0o755);
  const prior = process.env["PATH"];
  process.env["PATH"] = `${dir}:${prior ?? ""}`;
  return { seen, restore: () => { process.env["PATH"] = prior; rmSync(dir, { recursive: true, force: true }); } };
}
