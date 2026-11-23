/**
 * ONE NAME FOR THE SCRATCH MARKER: `isTestScratchRoot` answers for the boot's reach notice and the scratch notice alike, so
 * the marker's file name stands in one place in the node floor.
 */
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isTestScratchRoot, TEST_SCRATCH_MARKER } from "../src/test-scratch-notice.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

test("a marked root reads as test scratch; an unmarked one does not", () => {
  const root = mkdtempSync(join(tmpdir(), "test-scratch-root-")); roots.push(root);
  expect(isTestScratchRoot(root)).toBe(false);
  writeFileSync(join(root, TEST_SCRATCH_MARKER), "\n");
  expect(isTestScratchRoot(root)).toBe(true);
});

test("main reads the marker through the one door, never its own literal", () => {
  const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
  expect(main).not.toContain(".lar-test-scratch");
  expect(main).toMatch(/isTestScratchRoot\(rootDir\)/);
});
