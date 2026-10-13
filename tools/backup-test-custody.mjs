#!/usr/bin/env node
// backup-test-custody — a TEST HARNESS door: cut one face's backup bundle from a STAGED vessel that stands, under
// the published test route. The product has no such door: `lares vault backup` reads the vessel's route and the
// bundle's new route on a TTY alone, and no flag, env var or pipe carries either.
//
// THE MARKER. The root must carry `.lar-test-scratch` (`tools/test-scratch-marker.mjs`). A root without it refuses
// by name (TestDoorRefusal), rc 2, and NOTHING is sent: no socket opens, no file gets written.
//
// The door runs the command's own cut (`cutBundleToFile`, the built CLI's `vault-backup`) and hands it the test
// passphrase twice: once as the vessel's own route, once as the bundle's route. The bundle it writes therefore
// opens under the published test route, and holds only what a harness itself founded.
//
// Usage: node tools/backup-test-custody.mjs <LAR_ROOT> --face <N> --out <file>
//   rc 0  the bundle landed (the answer prints as JSON on stdout)
//   rc 1  the vessel refused, or no file was written (the refusal prints as JSON on stdout)
//   rc 2  the root carries no marker · bad usage
//   rc 3  no daemon answers at the root's rendezvous name
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hasMarker, MARKER_NAME } from "./test-scratch-marker.mjs";
import { TEST_PASSPHRASE } from "./test-custody-route.mjs";
import { sendCustodyFrame } from "./unlock-test-custody.mjs";

const here = new URL(".", import.meta.url).pathname;

/** The door's whole act, exported so a harness drives it in-process: refuses an unmarked root before any socket opens. */
export async function backupTestCustody(root, { face, out, vesselPassphrase = TEST_PASSPHRASE }) {
  const dir = resolve(root);
  if (!hasMarker(dir)) {
    const err = new Error(`TestDoorRefusal: ${dir} carries no ${MARKER_NAME} marker — the test door acts only on a root a harness staged (node tools/test-scratch-marker.mjs <root>)`);
    err.name = "TestDoorRefusal";
    throw err;
  }
  const { cutBundleToFile } = await import(pathToFileURL(resolve(here, "../packages/lares-cli/dist/src/vault-backup.js")).href);
  return await cutBundleToFile({
    face, out: resolve(out),
    vesselCredentials: [{ kind: "passphrase", passphrase: vesselPassphrase }],
    bundleRoutes: [{ t: 1, pins: [{ kind: "passphrase", passphrase: TEST_PASSPHRASE }] }],
    send: (frame) => sendCustodyFrame(dir, frame),
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const argv = process.argv.slice(2);
  const root = argv[0] && !argv[0].startsWith("--") ? argv[0] : "";
  const valueOf = (name) => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : undefined; };
  const face = valueOf("--face");
  const out = valueOf("--out");
  if (!root || face === undefined || !/^(0|[1-9]\d*)$/.test(face) || !out) {
    console.error("usage: backup-test-custody.mjs <LAR_ROOT> --face <N> --out <file>");
    process.exit(2);
  }
  let answer;
  try { answer = await backupTestCustody(root, { face: Number(face), out }); }
  catch (e) {
    if (e?.name === "TestDoorRefusal") { console.error(e.message); process.exit(2); }
    throw e;
  }
  console.log(JSON.stringify(answer));
  process.exit(answer.ok ? 0 : answer.reason === "daemon-unreachable" ? 3 : 1);
}
