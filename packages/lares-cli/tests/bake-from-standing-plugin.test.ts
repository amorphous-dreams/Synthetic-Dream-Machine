/**
 * bake-from-standing-plugin — `lares vessel bake` (and every rite that composes it: clear, rebuild,
 * rebirth, the staged harness) bakes the genesis island FROM THE PLUGIN THAT STANDS.
 *
 * Two laws under test:
 *   1. the bake runs the genesis script ALONE — it never rebuilds the packed plugin, so a staged boot
 *      writes nothing into `packages/lararium-tw5/` beside a parallel writer. Building the plugin is
 *      the build's act (`pnpm build`, `vessel rite refresh`), never a founding's.
 *   2. the genesis dir follows the ROOT — under `--root` a staged vessel bakes into its own
 *      `<root>/genesis`, never the shared tree's.
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bakePlan } from "../src/commands/scripted.js";

let root: string;
let savedRoot: string | undefined;

beforeEach(() => {
  savedRoot = process.env["LAR_ROOT"];
  root = mkdtempSync(join(tmpdir(), "lares-bake-plan-"));
  process.env["LAR_ROOT"] = root;
});

afterEach(() => {
  if (savedRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = savedRoot;
  rmSync(root, { recursive: true, force: true });
});

describe("bakePlan — the bake reads the plugin that stands", () => {
  test("names the genesis script alone; no plugin build rides in the plan", () => {
    const plan = bakePlan({ command: "vessel", positional: [], options: {}, flags: {} });
    expect(plan.script).toMatch(/build-genesis-island\.ts$/);
    expect(JSON.stringify(plan)).not.toMatch(/build:plugin|build:genesis/);
  });

  test("the genesis dir follows the root", () => {
    const plan = bakePlan({ command: "vessel", positional: [], options: {}, flags: {} });
    expect(plan.env["LAR_GENESIS"]).toBe(join(root, "genesis"));
  });

  test("`--genesis` names the dir outright", () => {
    const plan = bakePlan({ command: "vessel", positional: [], options: { genesis: "/tmp/elsewhere" }, flags: {} });
    expect(plan.env["LAR_GENESIS"]).toBe("/tmp/elsewhere");
  });
});
