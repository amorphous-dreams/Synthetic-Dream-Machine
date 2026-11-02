/**
 * THE HOUSE PROJECTS UNDER ITS STATE, NEVER THE CHECKOUT (operator ruling, 2026-11-01: "projections under ~/.lares/state").
 *
 * The daemon's disk mirrors (`wikis/daemon`, `bags/{lares,lararium,crossroads}`, the self bags) resolve `--root` first
 * (`lararium-node` `main.ts` `parseArgs`, then `open-node-vessel` `workerRootDir`), and they read neither `LAR_BAGS` nor
 * `LAR_WIKIS`. So a compose service that stands the daemon with `--root /workspace` writes its projection into the
 * bind-mounted checkout: the tracked tree. This pins the wiring of `docker-compose.surface.yml`:
 *
 *   · every service command that names `--root` names `/state`, the per-vessel state mount, which equals its `LAR_ROOT`;
 *   · no service command names `/workspace` (or a path under it) as its root;
 *   · the canon SOURCE reads the checkout through `LAR_BAGS=/workspace/bags`, and genesis rides the image
 *     (`LAR_GENESIS=/app/genesis`);
 *   · the mirrors split by origin (operator ruling, 2026-11-01): a bag whose source stands under `LAR_BAGS` projects back
 *     there, and the wiki it composes to `/workspace/wikis` (the tree `LAR_WIKIS` names for the CLI's ingest and cas
 *     reads); the house's private planes (the daemon, the kahua) and every bag with no source project under `/state`
 *     (`lararium-node` `projectionRoots`).
 *
 * A text scan over the compose file (no YAML parser stands in the workspace); the control below plants the /workspace wiring
 * and reads it red, so the scan cannot pass by finding nothing.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const COMPOSE = join(ROOT, "docker-compose.surface.yml");

/** Each `command: [ ... ]` flow array in the file, as its argv, with the line it stands on. */
export function composeCommands(text) {
  const out = [];
  text.split("\n").forEach((line, i) => {
    const m = /^\s*command:\s*(\[.*\])\s*$/.exec(line);
    if (!m) return;
    out.push({ line: i + 1, argv: JSON.parse(m[1]) });
  });
  return out;
}

/** The roots a compose text stands its daemons on, and every refusal the house law reads in it. */
export function readComposeRoots(text) {
  const refusals = [];
  const roots = [];
  for (const { line, argv } of composeCommands(text)) {
    const i = argv.indexOf("--root");
    if (i === -1) continue;
    const root = argv[i + 1];
    roots.push({ line, root });
    if (root !== "/state") refusals.push(`line ${line}: --root ${root} (the projection must land under /state)`);
    if (root === "/workspace" || String(root).startsWith("/workspace/")) refusals.push(`line ${line}: --root ${root} writes the projection into the checkout`);
  }
  if (!/^\s*LAR_ROOT:\s*\/state\s*$/m.test(text)) refusals.push("LAR_ROOT does not read /state");
  if (!/^\s*LAR_BAGS:\s*\/workspace\/bags\s*$/m.test(text)) refusals.push("LAR_BAGS does not read /workspace/bags (the canon source)");
  if (!/^\s*LAR_WIKIS:\s*\/workspace\/wikis\s*$/m.test(text)) refusals.push("LAR_WIKIS does not read /workspace/wikis (the canon-composed wikis' projection)");
  if (!/^\s*LAR_GENESIS:\s*\/app\/genesis\s*$/m.test(text)) refusals.push("LAR_GENESIS does not read /app/genesis");
  return { roots, refusals };
}

test("every daemon the surface compose stands roots at /state, never the checkout", () => {
  const { roots, refusals } = readComposeRoots(readFileSync(COMPOSE, "utf8"));
  assert.ok(roots.length >= 2, `expected the lares and herm services to name --root; read ${JSON.stringify(roots)}`);
  assert.deepEqual(refusals, []);
});

test("CONTROL: a --root /workspace wiring reads red", () => {
  const planted = readFileSync(COMPOSE, "utf8").replace(/"--root", "\/state"/g, '"--root", "/workspace"');
  const { refusals } = readComposeRoots(planted);
  assert.ok(refusals.some((r) => /writes the projection into the checkout/.test(r)), JSON.stringify(refusals));
});
