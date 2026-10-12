#!/usr/bin/env node
// unlock-test-custody — a TEST HARNESS door: unlock the custody of a STAGED vessel that stands, by sending its
// daemon the unlock frame with the published test route. The product has no such door: `lares vault unlock`
// gathers a credential on a TTY alone, and no flag, env var or pipe carries one.
//
// THE MARKER. The root must carry `.lar-test-scratch` (`tools/test-scratch-marker.mjs` writes it at stage time and
// refuses a root already holding custody). A root without it refuses by name (TestDoorRefusal), rc 2, and NOTHING
// is sent: no socket opens. So this door reaches only a vessel a harness staged and founded under the test route.
//
// The frame rides the vessel's owner-only verb socket as `{op:"unlock"}`, the custody door ahead of every verb: it
// never becomes an invocation, so no receipt, outcome or log line carries the credential.
//
// Usage: node tools/unlock-test-custody.mjs <LAR_ROOT> [--lock | --status]
//   rc 0  the vessel key opened (or already stood open) · the lock landed · the status printed
//   rc 1  the daemon answered anything else (the answer prints as JSON on stdout)
//   rc 2  the root carries no marker · bad usage
//   rc 3  no daemon answers at the root's rendezvous name
import { createConnection } from "node:net";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hasMarker, MARKER_NAME } from "./test-scratch-marker.mjs";
import { TEST_PASSPHRASE } from "./test-custody-route.mjs";

const here = new URL(".", import.meta.url).pathname;

function refuseUnmarked(dir) {
  if (hasMarker(dir)) return;
  const err = new Error(`TestDoorRefusal: ${dir} carries no ${MARKER_NAME} marker — the test door acts only on a root a harness staged (node tools/test-scratch-marker.mjs <root>)`);
  err.name = "TestDoorRefusal";
  throw err;
}

/**
 * Send one custody frame to the STAGED vessel standing at `root`; resolves its answer, or null when nothing
 * answers. Refuses an unmarked root before any socket opens, whatever the frame.
 */
export async function sendCustodyFrame(root, frame) {
  refuseUnmarked(resolve(root));
  const prior = process.env.LAR_ROOT;
  process.env.LAR_ROOT = root;
  let socketPath;
  try {
    const node = await import(pathToFileURL(resolve(here, "../packages/lararium-node/dist/src/index.js")).href);
    const mesh = await import(pathToFileURL(resolve(here, "../packages/lararium-mesh/dist/rendezvous-path.js")).href);
    socketPath = mesh.rendezvousPath({ root: node.larDataDir(), uid: process.getuid?.() ?? 0 });
  } finally {
    if (prior === undefined) delete process.env.LAR_ROOT; else process.env.LAR_ROOT = prior;
  }
  return await new Promise((settle) => {
    const sock = createConnection(socketPath);
    let buf = "";
    sock.setEncoding("utf8");
    sock.once("connect", () => sock.write(JSON.stringify(frame) + "\n"));
    sock.on("data", (chunk) => { buf += chunk; });
    sock.once("error", () => settle(null));
    sock.once("close", () => {
      const line = buf.split("\n")[0] ?? "";
      try { settle(line ? JSON.parse(line) : null); } catch { settle(null); }
    });
  });
}

/** The door's whole act, exported so a harness drives it in-process: refuses an unmarked root before any socket opens. */
export async function unlockTestCustody(root, act = "unlock") {
  const dir = resolve(root);
  refuseUnmarked(dir);
  const frame = act === "lock" ? { op: "lock" }
    : act === "status" ? { op: "custody" }
    : { op: "unlock", credentials: [{ kind: "passphrase", passphrase: TEST_PASSPHRASE }] };
  return await sendCustodyFrame(dir, frame);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const root = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "";
  const act = process.argv.includes("--lock") ? "lock" : process.argv.includes("--status") ? "status" : "unlock";
  if (!root) { console.error("usage: unlock-test-custody.mjs <LAR_ROOT> [--lock | --status]"); process.exit(2); }
  let answer;
  try { answer = await unlockTestCustody(root, act); }
  catch (e) {
    if (e?.name === "TestDoorRefusal") { console.error(e.message); process.exit(2); }
    throw e;
  }
  if (answer === null) { console.error(`unlock-test-custody: no daemon answers at ${resolve(root)}'s rendezvous name`); process.exit(3); }
  console.log(JSON.stringify(answer));
  const ok = act === "unlock" ? (answer.reading === "opens" || answer.reading === "already-unlocked")
    : act === "lock" ? answer.locked === true
    : typeof answer.unlocked === "boolean";
  process.exit(ok ? 0 : 1);
}
