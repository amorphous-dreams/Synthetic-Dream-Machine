import { existsSync } from "node:fs";
import { join } from "node:path";

/** The marker only announces a harness root; it never opens custody. */
export function testScratchNotice(rootDir: string): string | null {
  const marker = ".lar-test-scratch";
  if (!existsSync(join(rootDir, marker))) return null;
  return `[lararium] TEST SCRATCH ROOT — ${rootDir} carries ${marker}: a harness staged this vessel and its custody opens under the PUBLISHED test route. Never a vessel anyone keeps.`;
}
