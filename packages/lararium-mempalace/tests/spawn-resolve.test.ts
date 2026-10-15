import { afterEach, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mempalaceHolderPresent } from "../src/spawn-resolve.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

test("the holder probe accepts the upstream package entry and the older module entry", () => {
  const root = mkdtempSync(join(tmpdir(), "mempalace-entry-"));
  roots.push(root);
  const pkg = join(root, "mempalace");
  mkdirSync(pkg);
  expect(mempalaceHolderPresent(root)).toBe(false);

  const module = join(pkg, "mcp_server.py");
  writeFileSync(module, "");
  expect(mempalaceHolderPresent(root)).toBe(true);
  rmSync(module);

  const entry = join(pkg, "mcp_server");
  mkdirSync(entry);
  writeFileSync(join(entry, "__main__.py"), "");
  expect(mempalaceHolderPresent(root)).toBe(true);
});
