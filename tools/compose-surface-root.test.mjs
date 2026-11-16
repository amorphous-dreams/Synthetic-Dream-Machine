/**
 * THE HOUSE PROJECTS UNDER ITS OWN ROOT, NEVER THE CHECKOUT.
 *
 * The daemon's house-minted and private mirrors project under `<LAR_ROOT>/projections` (`lararium-node`
 * `larProjectionsHome`), and canon-sourced bags write back to `LAR_BAGS`. This pins the wiring of
 * `docker-compose.surface.yml`:
 *
 *   · `LAR_ROOT` reads `/lar`, the house root, and every service command that names `--root` names `/lar` too;
 *   · no service command names `/workspace` (or a path under it) as its root;
 *   · every vessel volume list (each list that binds the checkout at /workspace: the anchor, and any service that lists its
 *     own and so replaces the anchor's whole) binds the house's five classes from one host root, LARES_HOUSE: hearth,
 *     sensoriums, projections, library and config;
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

/**
 * Each `volumes:` list in the file, as the text it holds, with the line its key stands on. A service that lists its own
 * volumes replaces the anchor's list whole (a YAML merge never concatenates a sequence), so every vessel list reads alone.
 */
export function composeVolumeLists(text) {
  const out = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    const m = /^(\s*)volumes:\s*$/.exec(line);
    if (!m) return;
    const indent = m[1].length;
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      if (next.trim() !== "" && !next.trim().startsWith("#") && /^\s*/.exec(next)[0].length <= indent) break;
      body.push(next);
    }
    out.push({ line: i + 1, body: body.join("\n") });
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
  const vessels = composeVolumeLists(text).filter(({ body }) => /^\s*target: \/workspace\s*$/m.test(body));
  if (vessels.length === 0) refusals.push("no volume list binds the checkout at /workspace (no vessel reads)");
  for (const { line, body } of vessels) {
    for (const cls of ["hearth", "sensoriums", "projections", "library", "config"]) {
      const bind = new RegExp(`source: \\$\\{LARES_HOUSE:\\?[^}]*\\}/${cls}\\s*\\n\\s*target: /lar/${cls}\\s*$`, "m");
      if (!bind.test(body)) refusals.push(`line ${line}: the ${cls} class does not bind LARES_HOUSE/${cls} at /lar/${cls}`);
    }
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

test("CONTROL: a service whose own volume list drops a class reads red, though the anchor still binds it", () => {
  const text = readFileSync(COMPOSE, "utf8");
  const at = text.indexOf("\n  lares:\n");
  assert.ok(at > 0, "the lares service stands in the compose file");
  const planted = text.slice(0, at) + text.slice(at).replace(/\/library\n(\s*)target: \/lar\/library/, "/elsewhere\n$1target: /lar/library");
  const { refusals } = readComposeRoots(planted);
  assert.ok(refusals.some((r) => /library class/.test(r)), JSON.stringify(refusals));
});
