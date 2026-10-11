#!/usr/bin/env node
// seed-test-custody — a TEST HARNESS door: found the custody of a STAGED root with a fixed test passphrase, so a
// scripted `lares vessel found` / `vessel clear` (which has no TTY to gather a route from) finds the slot tree
// already standing. The product has no such door: a production founding gathers its route from a TTY alone and
// no flag or env var carries a credential.
//
// THE MARKER. The root must carry `.lar-test-scratch`, which only `tools/test-scratch-marker.mjs` writes, at stage
// time, in the harness that mints the root. TMPDIR, LAR_STAGE_DIR and path shapes are the caller's own assertions
// and never make a root scratch. A root without the marker refuses by name (TestDoorRefusal), rc 2, and nothing is
// created. A standing custody tree is left alone, never overwritten.
//
// Usage: node tools/seed-test-custody.mjs <LAR_ROOT>      (idempotent: a standing tree is left alone)
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hasMarker, MARKER_NAME } from "./test-scratch-marker.mjs";

export const TEST_PASSPHRASE = "test-founding-passphrase";

const here = new URL(".", import.meta.url).pathname;
const root = process.argv[2] ? resolve(process.argv[2]) : "";
if (!root) { console.error("usage: seed-test-custody.mjs <LAR_ROOT>"); process.exit(2); }
if (!hasMarker(root)) {
  console.error(`TestDoorRefusal: ${root} carries no ${MARKER_NAME} marker — the test door acts only on a root a harness staged (node tools/test-scratch-marker.mjs <root>)`);
  process.exit(2);
}
process.env.LAR_ROOT = root;
const node = await import(pathToFileURL(resolve(here, "../packages/lararium-node/dist/src/index.js")).href);
const homes = { identity: node.larIdentityDir(), storage: node.larDataDir(), seal: node.larSealHome() };
const io = new node.FsCustodyIo(homes);
if (!(await node.custodyTreeStands(io, homes))) {
  try {
    await node.foundCustody({ io, homes, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: TEST_PASSPHRASE }] }] });
  } catch (e) {
    if (e?.name !== "OldShapeRefusal") throw e;
    console.error(`OldShapeRefusal: ${root} holds identity carriers and no custody tree — nothing was written (${e.standing.length + e.unlisted.length} carrier(s) stand)`);
    process.exit(2);
  }
}
