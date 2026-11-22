/**
 * bag-show-projected — a bag with no canon source rests under the house's projections (`<root>/projections/bags`, or a shared
 * wiki's canon bag under its realm, `<root>/projections/realms/<realm pet name>/bags/<slug>`), and the bag doors find it there
 * when no `--dir` names another survey; the canon source still reads first.
 */
import { afterEach, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readBagManifest } from "@lararium/node";
import { cmdBagDeclare, cmdBagShow } from "../src/commands/bag-declare-cmd.js";
import { cmdBag } from "../src/commands/bag.js";

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

test("bag show folds the local survey from empty to one projected bag, then drills into its adrift detail", async () => {
  root = mkdtempSync(join(tmpdir(), "bag-show-fold-"));
  process.env["LAR_ROOT"] = root;
  process.env["LAR_BAGS"] = join(root, "canon");
  mkdirSync(join(root, "canon"), { recursive: true });
  const chunks: string[] = [];
  const output = vi.spyOn(process.stdout, "write").mockImplementation(((x: unknown) => { chunks.push(String(x)); return true; }) as never);
  try {
    const read = async (...positional: string[]) => {
      chunks.length = 0;
      expect(await cmdBag({ command: "bag", positional: ["show", ...positional], options: {}, flags: { json: true } } as never)).toBe(0);
      return JSON.parse(chunks.join("")) as { data: Record<string, unknown> };
    };
    expect((await read()).data).toMatchObject({ count: 0, next: null, bags: [] });
    mkdirSync(join(root, "canon", "book"), { recursive: true });
    expect((await read()).data).toMatchObject({ count: 1, bags: [{ bag: "book", adrift: true }] });
    const detail = (await read("book")).data;
    expect(detail).toMatchObject({ bag: "book", adrift: true, source: "local-survey", grain: "item" });
    expect(String(detail.has)).toMatch(/^<<~ has /);
  } finally { output.mockRestore(); }
});

test("bag show pages a many bag survey and carries its continuation", async () => {
  root = mkdtempSync(join(tmpdir(), "bag-show-page-"));
  process.env["LAR_ROOT"] = root;
  process.env["LAR_BAGS"] = join(root, "canon");
  for (let i = 0; i < 33; i++) mkdirSync(join(root, "canon", `bag-${String(i).padStart(2, "0")}`), { recursive: true });
  const chunks: string[] = [];
  const output = vi.spyOn(process.stdout, "write").mockImplementation(((x: unknown) => { chunks.push(String(x)); return true; }) as never);
  try {
    const read = async (after?: string) => {
      chunks.length = 0;
      expect(await cmdBag({ command: "bag", positional: ["show"], options: after ? { after } : {}, flags: { json: true } } as never)).toBe(0);
      return (JSON.parse(chunks.join("")) as { data: { count: number; next: string | null; bags: unknown[] } }).data;
    };
    const first = await read();
    expect(first).toMatchObject({ count: 33 });
    expect(first.bags).toHaveLength(32);
    expect(first.next).toBeTruthy();
    expect((await read(first.next!)).bags).toHaveLength(1);
  } finally { output.mockRestore(); }
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

test("bag declare refuses the TW5 docs library's slug and bag uri as tw5-docs-reserved, and writes no declaration", async () => {
  root = mkdtempSync(join(tmpdir(), "bag-declare-reserved-"));
  process.env["LAR_ROOT"] = root;
  process.env["LAR_BAGS"] = join(root, "canon");
  mkdirSync(join(root, "canon", "tw5-docs"), { recursive: true });
  for (const name of ["tw5-docs", "lar:///ha.ka.ba/bags/tw5-docs"]) {
    await expect(cmdBagDeclare({ command: "bag", positional: [name], options: { tier: "public" }, flags: { json: true } } as never), name)
      .rejects.toMatchObject({ reason: "tw5-docs-reserved" });
  }
  expect(readBagManifest(join(root, "canon", "tw5-docs"), "tw5-docs").tier, "no declaration landed").toBe("veil");
});
