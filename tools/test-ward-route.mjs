// test-ward-route — a TEST HARNESS'S explicit ward route for the `lares` processes it spawns (seat-harness#/the-ward).
//
// The product binary reads a ward act's route from its own terminal alone and never answers one from a file. A harness that drives
// the CLI with no terminal loads THIS module ahead of the binary (`node --import tools/test-ward-route.mjs lares.js …`), and it seats
// the published test route as that process's gatherer, only under a root the harness staged (`.lar-test-scratch`). The binary then
// keeps the gatherer it finds seated. Nothing in the product imports this file.
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.env.LAR_ROOT;
if (root && existsSync(join(root, ".lar-test-scratch"))) {
  const node = await import(new URL("../packages/lararium-node/dist/src/index.js", import.meta.url).href);
  node.seatWardGatherer(async () => [{ kind: "passphrase", passphrase: "test-founding-passphrase" }]);
}
