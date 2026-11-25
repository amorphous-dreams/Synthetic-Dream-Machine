/**
 * pack-relink-offering.test.ts — re-running `scripts/pack-relink-offering.ts` reproduces the
 * committed `relink-plugin.json`, `offering.json` and `NOTICES.txt` byte-for-byte: a PUBLISHER
 * offering is a claim anyone can re-derive from the pinned upstream commit.
 *
 * Runs the real script into a SCRATCH output dir via `RELINK_OFFERING_OUT_DIR`, so the committed
 * artifacts stay untouched mid-run. It fetches the public upstream at the pinned commit, so it
 * needs the network; run it under `flock /tmp/lar-e2e.lock` beside the other pack runs.
 */
import { describe, test, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PKG_ROOT = path.resolve(HERE, "..", "..");

describe("the relink offering pack is reproducible", () => {
  test("re-packing from the pinned upstream commit reproduces the committed artifacts byte-for-byte", () => {
    const scratchOut = mkdtempSync(path.join(tmpdir(), "pack-relink-offering-repro-"));
    try {
      execFileSync("npx", ["tsx", "scripts/pack-relink-offering.ts"], {
        cwd: PKG_ROOT,
        env: { ...process.env, RELINK_OFFERING_OUT_DIR: scratchOut },
        stdio: "pipe",
      });
      for (const file of ["relink-plugin.json", "offering.json", "NOTICES.txt"]) {
        expect(readFileSync(path.join(scratchOut, file), "utf8")).toBe(readFileSync(path.join(HERE, file), "utf8"));
      }
    } finally {
      rmSync(scratchOut, { recursive: true, force: true });
    }
  }, 120_000);
});
