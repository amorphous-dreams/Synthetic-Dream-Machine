#!/usr/bin/env node
// restore-test-custody — a TEST HARNESS door: restore one face from a backup bundle onto a STAGED vessel, under the
// published test route. The product has no such door: `lares vault restore` reads the bundle's route on a TTY
// alone, and no flag, env var or pipe carries it.
//
// THE MARKER. The root must carry `.lar-test-scratch` (`tools/test-scratch-marker.mjs`). A root without it refuses
// by name (TestDoorRefusal), rc 2, and NOTHING is sent: no socket opens and no row moves.
//
// The door runs the command's own restore (`restoreFromBundle`, the built CLI's `vault-restore`) and hands it the
// test passphrase as the bundle's route, so it opens only a bundle `tools/backup-test-custody.mjs` cut. The act
// rides the STANDING vessel's custody door as one `act` frame; a vessel that stands locked refuses `custody-locked`.
//
// Usage: node tools/restore-test-custody.mjs <LAR_ROOT> <bundle-file> [--as <N>] [--memory]
//   rc 0  the restore (or the import) landed (the answer prints as JSON on stdout)
//   rc 1  it refused (the refusal prints as JSON on stdout)
//   rc 2  the root carries no marker · bad usage
//   rc 3  no daemon answers at the root's rendezvous name
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hasMarker, MARKER_NAME } from "./test-scratch-marker.mjs";
import { TEST_PASSPHRASE } from "./test-custody-route.mjs";
import { sendCustodyFrame } from "./unlock-test-custody.mjs";

const here = new URL(".", import.meta.url).pathname;

/** The door's whole act, exported so a harness drives it in-process: refuses an unmarked root before any socket opens. */
export async function restoreTestCustody(root, { file, as, memory = false, passphrase = TEST_PASSPHRASE }) {
  const dir = resolve(root);
  if (!hasMarker(dir)) {
    const err = new Error(`TestDoorRefusal: ${dir} carries no ${MARKER_NAME} marker — the test door acts only on a root a harness staged (node tools/test-scratch-marker.mjs <root>)`);
    err.name = "TestDoorRefusal";
    throw err;
  }
  const { restoreFromBundle } = await import(pathToFileURL(resolve(here, "../packages/lares-cli/dist/src/vault-restore.js")).href);
  let silent = false;
  const answer = await restoreFromBundle({
    file: resolve(file), credentials: [{ kind: "passphrase", passphrase }], memory, ...(as !== undefined ? { as } : {}),
    run: async (act, args) => {
      const a = await sendCustodyFrame(dir, { op: "act", act, args });
      if (a === null) { silent = true; return { result: { refused: "daemon-unreachable", message: "no vessel answers at this root's rendezvous name" }, via: "vessel" }; }
      if (a.status === "error") return { result: { refused: a.refusal?.reason ?? "refused", message: a.errorMessage ?? "the vessel refused the act" }, via: "vessel" };
      return { result: a.result ?? {}, via: "vessel" };
    },
  });
  return { answer, silent };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const argv = process.argv.slice(2);
  const positional = [];
  let as;
  let memory = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--as") as = argv[++i];
    else if (argv[i] === "--memory") memory = true;
    else positional.push(argv[i]);
  }
  const [root, file] = positional;
  if (!root || !file || (as !== undefined && !/^(0|[1-9]\d*)$/.test(as))) {
    console.error("usage: restore-test-custody.mjs <LAR_ROOT> <bundle-file> [--as <N>] [--memory]");
    process.exit(2);
  }
  let out;
  try { out = await restoreTestCustody(root, { file, memory, ...(as !== undefined ? { as: Number(as) } : {}) }); }
  catch (e) {
    if (e?.name === "TestDoorRefusal") { console.error(e.message); process.exit(2); }
    throw e;
  }
  console.log(JSON.stringify(out.answer));
  process.exit(out.answer.ok ? 0 : out.silent ? 3 : 1);
}
