/**
 * bag-show-projected — a bag with no canon source rests under the house's projections (`<root>/projections/bags`), and the
 * bag doors find it there when no `--dir` names another survey; the canon source still reads first.
 */
import { afterEach, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdBagShow } from "../src/commands/bag-declare-cmd.js";

const saved = { LAR_ROOT: process.env["LAR_ROOT"], LAR_BAGS: process.env["LAR_BAGS"] };
let root = "";
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  if (root) rmSync(root, { recursive: true, force: true });
});

const show = (bag: string, options: Record<string, string> = {}) =>
  cmdBagShow({ command: "bag", positional: [bag], options, flags: { json: true } } as never);

test("a bag resting under projections/bags answers `bag show` with no --dir", async () => {
  root = mkdtempSync(join(tmpdir(), "bag-show-projected-"));
  process.env["LAR_ROOT"] = root;
  process.env["LAR_BAGS"] = join(root, "canon");
  mkdirSync(join(root, "canon"), { recursive: true });
  mkdirSync(join(root, "projections", "bags", "book"), { recursive: true });
  expect(await show("book")).toBe(0);
});

test("CONTROL: a named --dir reads that survey alone, and a bag absent from it refuses", async () => {
  root = mkdtempSync(join(tmpdir(), "bag-show-projected-"));
  process.env["LAR_ROOT"] = root;
  mkdirSync(join(root, "projections", "bags", "book"), { recursive: true });
  mkdirSync(join(root, "elsewhere"), { recursive: true });
  await expect(show("book", { dir: join(root, "elsewhere") })).rejects.toThrow(/no bag "book" stands under/);
});
