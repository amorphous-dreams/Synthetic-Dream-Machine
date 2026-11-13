/**
 * THE HOUSE PROJECTS UNDER ITS OWN ROOT, NEVER THE CHECKOUT.
 *
 * The daemon's house-minted and private mirrors project under `<LAR_ROOT>/projections` (`lararium-node`
 * `larProjectionsHome`), and canon-sourced bags write back to `LAR_BAGS`. This pins the wiring of
 * `docker-compose.surface.yml`:
 *
 *   · `LAR_ROOT` reads `/lar`, the house root, and every service command that names `--root` names `/lar` too;
 *   · no service command names `/workspace` (or a path under it) as its root;
 *   · the house's five bound classes bind from one host root, LARES_HOUSE: hearth, sensoriums, projections, library and config;
 *   · the canon SOURCE reads the checkout through `LAR_BAGS=/workspace/bags`, and genesis rides the image
 *     (`LAR_GENESIS=/app/genesis`);
 *   · the mirrors split by origin (operator ruling, 2026-11-01): a bag whose source stands under `LAR_BAGS` projects back
 *     there, and the wiki it composes to `/workspace/wikis` (the tree `LAR_WIKIS` names for the CLI's ingest and cas
 *     reads); the house's private planes and every bag with no source project under `/lar/projections`.
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
    if (root !== "/lar") refusals.push(`line ${line}: --root ${root} (the house root reads /lar)`);
    if (root === "/workspace" || String(root).startsWith("/workspace/")) refusals.push(`line ${line}: --root ${root} writes the projection into the checkout`);
  }
  if (!/^\s*LAR_ROOT:\s*\/lar\s*$/m.test(text)) refusals.push("LAR_ROOT does not read /lar");
  for (const cls of ["hearth", "sensoriums", "projections", "library", "config"]) {
    const bind = new RegExp(`source: \\$\\{LARES_HOUSE:\\?[^}]*\\}/${cls}\\s*\\n\\s*target: /lar/${cls}\\s*$`, "m");
    if (!bind.test(text)) refusals.push(`the ${cls} class does not bind LARES_HOUSE/${cls} at /lar/${cls}`);
  }
  if (/LARES_STATE/.test(text)) refusals.push("LARES_STATE still names a mount");
  if (!/^\s*LAR_BAGS:\s*\/workspace\/bags\s*$/m.test(text)) refusals.push("LAR_BAGS does not read /workspace/bags (the canon source)");
  if (!/^\s*LAR_WIKIS:\s*\/workspace\/wikis\s*$/m.test(text)) refusals.push("LAR_WIKIS does not read /workspace/wikis (the canon-composed wikis' projection)");
  if (!/^\s*LAR_GENESIS:\s*\/app\/genesis\s*$/m.test(text)) refusals.push("LAR_GENESIS does not read /app/genesis");
  return { roots, refusals };
}

test("every daemon the surface compose stands roots at the house root /lar, never the checkout", () => {
  const { roots, refusals } = readComposeRoots(readFileSync(COMPOSE, "utf8"));
  assert.ok(roots.length >= 2, `expected the lares and herm services to name --root; read ${JSON.stringify(roots)}`);
  assert.deepEqual(refusals, []);
});

test("CONTROL: a --root /workspace wiring reads red", () => {
  const planted = readFileSync(COMPOSE, "utf8").replace(/"--root", "\/lar"/g, '"--root", "/workspace"');
  const { refusals } = readComposeRoots(planted);
  assert.ok(refusals.some((r) => /writes the projection into the checkout/.test(r)), JSON.stringify(refusals));
});

test("CONTROL: a compose that binds one state mount in place of the house's four classes reads red", () => {
  const planted = readFileSync(COMPOSE, "utf8").replace(/\/projections\n(\s*)target: \/lar\/projections/, "/elsewhere\n$1target: /lar/projections");
  const { refusals } = readComposeRoots(planted);
  assert.ok(refusals.some((r) => /projections class/.test(r)), JSON.stringify(refusals));
});
