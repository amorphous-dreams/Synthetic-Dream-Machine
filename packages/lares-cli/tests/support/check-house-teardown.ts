import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

/** Exercise the importing suite's real beforeEach and afterEach inside a controlled outer environment. */
export function checkHouseTeardown(): void {
  describe.each(["named", "absent"] as const)("house teardown with %s outer paths", (state) => {
    let outerRoot: string | undefined;
    let outerHome: string | undefined;
    beforeAll(() => {
      if (state === "named") {
        outerRoot = mkdtempSync(join(tmpdir(), "lar-outer-"));
        outerHome = join(outerRoot, "home");
        mkdirSync(outerHome);
      }
      vi.stubEnv("LAR_ROOT", outerRoot);
      vi.stubEnv("HOME", outerHome);
    });
    afterAll(() => {
      vi.unstubAllEnvs();
      if (outerRoot) rmSync(outerRoot, { recursive: true, force: true });
    });

    test("returns the enclosing root and home after the suite closes", ({ onTestFinished }) => {
      const innerRoot = process.env["LAR_ROOT"]!;
      expect(innerRoot).not.toBe(outerRoot);
      expect(existsSync(innerRoot)).toBe(true);
      onTestFinished(() => {
        expect(process.env["LAR_ROOT"]).toBe(outerRoot);
        expect(process.env["HOME"]).toBe(outerHome);
        expect(existsSync(innerRoot)).toBe(false);
        if (outerHome) expect(existsSync(outerHome)).toBe(true);
      });
    });
  });
}
