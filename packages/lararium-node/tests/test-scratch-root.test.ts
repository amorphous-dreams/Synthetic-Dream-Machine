/**
 * ONE NAME FOR THE SCRATCH MARKER: `isTestScratchRoot` answers for the boot's reach notice and the scratch notice alike, so
 * the marker's file name stands in one place in the node floor.
 */
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
