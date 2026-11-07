// test-ward-route — a TEST HARNESS'S explicit ward and face routes for the `lares` processes it spawns (seat-harness#/the-ward).
//
// The product binary reads a ward act's route from its own terminal alone and never answers one from a file. A harness that drives
// the CLI with no terminal loads THIS module ahead of the binary (`node --import tools/test-ward-route.mjs lares.js …`), and it seats
// the published test route as that process's ward gatherer and new-face route, only in a `lares` CLI process and only under a root
// the harness staged (`.lar-test-scratch`); the e2e configs hand it to their children through NODE_OPTIONS. The binary then
// keeps the gatherer it finds seated. Nothing in the product imports this file.
import { existsSync } from "node:fs";
import { join } from "node:path";

/** Seat the harness's published test route as a process's ward gatherer and new-face route, on the node package it hands in. */
export function seatHarnessRoutes(node) {
  node.seatReadBackStandIn(true);
  node.seatWardGatherer(async () => [{ kind: "passphrase", passphrase: "test-founding-passphrase" }]);
  // A face the staged CLI founds binds under the same published test route (its face tree and its ward); the binary keeps a
  // face route it finds seated, as it keeps the ward gatherer.
  node.seatFaceRoute(async () => [{ t: 1, pins: [{ kind: "passphrase", passphrase: "test-founding-passphrase" }] }]);
}

// A `lares` CLI process alone: a daemon a suite stands seats no route here, so its own refusals stay what the product's are.
// The CLI runs as its built entry or its committed shim (`bin/lares.mjs`, the image's own entrypoint).
const cli = /lares-cli[\\/](?:dist[\\/]src[\\/]bin[\\/]lares\.js|bin[\\/]lares\.mjs)$/.test(process.argv[1] ?? "");
// The root a CLI reads: its `--root` flag (`--root /x` or `--root=/x`, as the CLI reads it), else LAR_ROOT.
const rootFlag = (() => { const a = process.argv; const i = a.findIndex((x) => x === "--root" || x.startsWith("--root=")); return i < 0 ? undefined : a[i].startsWith("--root=") ? a[i].slice(7) : a[i + 1]; })();
const root = rootFlag ?? process.env.LAR_ROOT;
const storageOverride = process.argv.some((x) => x === "--storage" || x.startsWith("--storage="));
if (cli && !storageOverride && root && existsSync(join(root, ".lar-test-scratch"))) {
  seatHarnessRoutes(await import(new URL("../packages/lararium-node/dist/src/index.js", import.meta.url).href));
}
