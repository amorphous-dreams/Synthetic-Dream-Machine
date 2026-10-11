#!/usr/bin/env node
// seed-test-custody — a TEST HARNESS door: found the custody of a SCRATCH root with a fixed test passphrase, so a
// scripted `lares vessel found` / `vessel clear` (which has no TTY to gather a route from) finds the slot tree
// already standing. The product has no such door: a production founding gathers its route from a TTY alone and
// no flag or env var carries a credential. This script names the route explicitly and refuses a root that is not
// scratch (it must sit under the OS temp dir, a LAR_STAGE_DIR, or carry the `.mesh-test` marker the mesh tools use).
//
// Usage: node tools/seed-test-custody.mjs <LAR_ROOT>      (idempotent: a standing tree is left alone)
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const TEST_PASSPHRASE = "test-founding-passphrase";

const here = new URL(".", import.meta.url).pathname;
const root = process.argv[2] ? resolve(process.argv[2]) : "";
if (!root) { console.error("usage: seed-test-custody.mjs <LAR_ROOT>"); process.exit(2); }
const scratch = [tmpdir(), process.env.LAR_STAGE_DIR ?? ""].filter(Boolean).map((d) => resolve(d) + sep);
if (!scratch.some((d) => root.startsWith(d)) && !root.includes(`${sep}.mesh-test${sep}`)) {
  console.error(`seed-test-custody: refusing ${root} — not a scratch root`);
  process.exit(2);
}
process.env.LAR_ROOT = root;
mkdirSync(root, { recursive: true });
const node = await import(pathToFileURL(resolve(here, "../packages/lararium-node/dist/src/index.js")).href);
const homes = { identity: node.larIdentityDir(), storage: node.larDataDir(), seal: node.larSealHome() };
const io = new node.FsCustodyIo(homes);
if (!(await node.custodyTreeStands(io, homes))) {
  await node.foundCustody({ io, homes, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: TEST_PASSPHRASE }] }] });
}
