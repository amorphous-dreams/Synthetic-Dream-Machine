// vitest-scratch-house — a vitest setup file: a suite worker that inherits no house root names a fresh scratch one.
//
// Every house-state resolver reads LAR_ROOT alone and refuses an unnamed root (`HouseRootUnnamed`); none falls back.
// A suite that drives those resolvers without naming its own root would refuse, so each worker that starts with no
// LAR_ROOT names one here: a fresh `mkdtemp` directory under the OS temp dir, carrying the harness's scratch marker
// (`.lar-test-scratch`, the file `tools/test-scratch-marker.mjs` writes), so the ephemeral verdict and the custody test
// door both read it as scratch. A worker that inherits a LAR_ROOT keeps it; a suite that sets its own keeps that.
// The directory leaves when the worker exits.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MARKER_NAME = ".lar-test-scratch";

if (!process.env.LAR_ROOT?.trim()) {
  const root = mkdtempSync(join(tmpdir(), "lar-suite-house-"));
  writeFileSync(join(root, MARKER_NAME), `staged by a vitest worker (pid ${process.pid}); the custody test door acts only where this stands\n`);
  process.env.LAR_ROOT = root;
  process.once("exit", () => { try { rmSync(root, { recursive: true, force: true }); } catch { /* the OS temp dir sweeps it */ } });
}
