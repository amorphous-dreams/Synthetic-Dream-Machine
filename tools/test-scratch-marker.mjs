#!/usr/bin/env node
// test-scratch-marker — the STAGING half of the custody test door. `tools/seed-test-custody.mjs` founds a root's
// custody under a published test passphrase, so it must act only on a root a HARNESS staged on purpose. What the
// caller's environment says (TMPDIR, LAR_STAGE_DIR, a path substring) never makes a root scratch; a MARKER FILE does:
//
//   <root>/.lar-test-scratch      written here, at stage time, by the harness that mints the root
//
// The door refuses a root without the marker, by name (TestDoorRefusal). This stager refuses to mark a root that
// already holds a standing custody tree: a tree that predates the marker belongs to a vessel, never to a harness.
// The marker carries no secret and grants no capability beyond this one test door.
//
// Usage: node tools/test-scratch-marker.mjs <ROOT>       (idempotent; creates ROOT)
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

export const MARKER_NAME = ".lar-test-scratch";

export function hasMarker(root) {
  return existsSync(join(resolve(root), MARKER_NAME));
}

/** Mark `root` scratch. Throws when an unmarked root already holds a custody tree. */
export async function stageScratchMarker(root) {
  const dir = resolve(root);
  if (hasMarker(dir)) return dir;
  const prior = process.env.LAR_ROOT;
  process.env.LAR_ROOT = dir;
  try {
    const here = fileURLToPath(new URL(".", import.meta.url));
    const node = await import(pathToFileURL(resolve(here, "../packages/lararium-node/dist/src/index.js")).href);
    const homes = { identity: node.larIdentityDir(), storage: node.larDataDir(), seal: node.larSealHome() };
    if (existsSync(dir) && (await node.custodyTreeStands(new node.FsCustodyIo(homes), homes))) {
      throw new Error(`test-scratch-marker: refusing ${dir} — a custody tree already stands there, so no harness staged it`);
    }
  } finally {
    if (prior === undefined) delete process.env.LAR_ROOT; else process.env.LAR_ROOT = prior;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, MARKER_NAME), `staged by a test harness (pid ${process.pid}); the custody test door acts only where this stands\n`);
  return dir;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = process.argv[2];
  if (!root) { console.error("usage: test-scratch-marker.mjs <ROOT>"); process.exit(2); }
  try { await stageScratchMarker(root); } catch (e) { console.error(e.message); process.exit(2); }
}
