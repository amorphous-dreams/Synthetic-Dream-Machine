/**
 * pack-highlight-offering.test.ts — re-running `scripts/pack-highlight-offering.ts` reproduces the
 * committed `highlight-plugin.json` and `offering.json` byte-for-byte: a PUBLISHER offering is a
 * claim anyone can re-derive from the pinned commit, never a one-time hand-authored artifact that
 * drifts quietly from what the script would produce today.
 *
 * Runs the real script, from the real package (so the TW5 submodule and `node_modules` resolve
 * normally), redirected to a SCRATCH output dir via `HIGHLIGHT_OFFERING_OUT_DIR` — never clobbering
 * the committed artifacts mid-run. Shells out to the real TW5 CLI, so this is slower than the
 * unit-shaped verification test beside it; run under `flock /tmp/lar-e2e.lock` alongside the other
 * build/pack runs, per house law.
 */
import { describe, test, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OFFERING_DIR = HERE;                                  // offerings/highlight/
const PKG_ROOT = path.resolve(HERE, "..", "..");             // packages/lararium-tw5/

describe("the highlight offering pack is reproducible", () => {
  test("re-packing from the pinned TW5 commit reproduces the committed artifacts byte-for-byte", () => {
    const scratchOut = mkdtempSync(path.join(tmpdir(), "pack-highlight-offering-repro-"));
    try {
      execFileSync("npx", ["tsx", "scripts/pack-highlight-offering.ts"], {
        cwd: PKG_ROOT,
        env: { ...process.env, HIGHLIGHT_OFFERING_OUT_DIR: scratchOut },
        stdio: "pipe",
      });
      const committed = {
        plugin: readFileSync(path.join(OFFERING_DIR, "highlight-plugin.json"), "utf8"),
        offering: readFileSync(path.join(OFFERING_DIR, "offering.json"), "utf8"),
      };
      const rebuilt = {
        plugin: readFileSync(path.join(scratchOut, "highlight-plugin.json"), "utf8"),
        offering: readFileSync(path.join(scratchOut, "offering.json"), "utf8"),
      };
      expect(rebuilt.plugin).toBe(committed.plugin);
      expect(rebuilt.offering).toBe(committed.offering);
    } finally {
      rmSync(scratchOut, { recursive: true, force: true });
    }
  }, 60_000);
});
