import { existsSync } from "node:fs";
import { join } from "node:path";

/** The file a harness writes at a root it stages (`tools/test-scratch-marker.mjs`). */
export const TEST_SCRATCH_MARKER = ".lar-test-scratch";

/** Whether a harness staged this root: the one reading of the marker the node floor holds. */
export function isTestScratchRoot(rootDir: string): boolean {
  return existsSync(join(rootDir, TEST_SCRATCH_MARKER));
}

/** The marker only announces a harness root; it never opens custody. */
export function testScratchNotice(rootDir: string): string | null {
  if (!isTestScratchRoot(rootDir)) return null;
  return `[lararium] TEST SCRATCH ROOT — ${rootDir} carries ${TEST_SCRATCH_MARKER}: a harness staged this vessel and its custody opens under the PUBLISHED test route. Never a vessel anyone keeps.`;
}
