/**
 * bag-show-projected — a bag with no canon source rests under the house's projections (`<root>/projections/bags`, or a shared
 * wiki's canon bag under its realm, `<root>/projections/realms/<realm pet name>/bags/<slug>`), and the bag doors find it there
 * when no `--dir` names another survey; the canon source still reads first.
 */
import { afterEach, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readBagManifest } from "@lararium/node";
import { cmdBagDeclare, cmdBagShow } from "../src/commands/bag-declare-cmd.js";

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

test("RED: a shared wiki's canon bag resting under its realm folder answers `bag show` and `bag declare` with no --dir", async () => {
  root = mkdtempSync(join(tmpdir(), "bag-show-projected-"));
  process.env["LAR_ROOT"] = root;
  process.env["LAR_BAGS"] = join(root, "canon");
  mkdirSync(join(root, "canon"), { recursive: true });
  const dir = join(root, "projections", "realms", "photos", "bags", "book");
  mkdirSync(dir, { recursive: true });
  expect(await show("book")).toBe(0);
  expect(await cmdBagDeclare({ command: "bag", positional: ["book"], options: { tier: "public" }, flags: { json: true } } as never)).toBe(0);
  expect(readBagManifest(dir, "book").tier).toBe("public");
});

test("CONTROL: a named --dir reads that survey alone, and a bag absent from it refuses", async () => {
  root = mkdtempSync(join(tmpdir(), "bag-show-projected-"));
  process.env["LAR_ROOT"] = root;
  mkdirSync(join(root, "projections", "bags", "book"), { recursive: true });
  mkdirSync(join(root, "elsewhere"), { recursive: true });
  await expect(show("book", { dir: join(root, "elsewhere") })).rejects.toThrow(/no bag "book" stands under/);
});

test("a bag door takes the bag by its slug or by its bag uri, and a uri outside the bags plane refuses by name", async () => {
  root = mkdtempSync(join(tmpdir(), "bag-show-projected-"));
  process.env["LAR_ROOT"] = root;
  process.env["LAR_BAGS"] = join(root, "canon");
  mkdirSync(join(root, "canon", "book"), { recursive: true });
  expect(await show("book")).toBe(0);                                        // CONTROL: the slug
  expect(await show("lar:///ha.ka.ba/bags/book")).toBe(0);
  await expect(show("lar:///ha.ka.ba/wikis/book")).rejects.toThrow(/names no bag: a bag door takes a slug \(book\) or its bag uri \(lar:\/\/\/ha\.ka\.ba\/bags\/book\)/);
});
