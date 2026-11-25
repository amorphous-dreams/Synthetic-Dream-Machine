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

/**
 * The `environment:` map one top-level service lists itself (its own keys, never the anchor's merge), as name -> raw value.
 * A text scan, as above: the service block runs from its two-space key to the next key at that indent.
 */
export function serviceEnvironment(text, service) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l === `  ${service}:`);
  if (start < 0) return null;
  const out = {};
  let inEnv = false, envIndent = -1;
  for (let j = start + 1; j < lines.length; j++) {
    const line = lines[j];
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const indent = /^\s*/.exec(line)[0].length;
    if (indent <= 2) break;
    if (/^\s*environment:\s*$/.test(line)) { inEnv = true; envIndent = indent; continue; }
    if (inEnv && indent <= envIndent) inEnv = false;
    if (!inEnv) continue;
    const m = /^\s*([A-Z_][A-Z0-9_]*):\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

/** The names the CLI's keep rule reads (`keepWorkspaceName` in packages/lares-cli/src/keep-config.ts), from its source. */
function keepRuleNames() {
  const src = readFileSync(join(ROOT, "packages", "lares-cli", "src", "keep-config.ts"), "utf8");
  const body = /export function keepWorkspaceName[\s\S]*?\n}\n/.exec(src)?.[0] ?? "";
  const consts = Object.fromEntries([...src.matchAll(/export const ([A-Z_]+) = "([A-Z_]+)";/g)].map((m) => [m[1], m[2]]));
  return [...body.matchAll(/envValue\(\s*("([A-Z_]+)"|([A-Z_]+))/g)].map((m) => m[2] ?? consts[m[3]]).filter(Boolean);
}

test("the keep lei offer reaches the vessel: the standing vessel carries every name the keep rule reads, interpolated from the shim's environment and its --env-file", () => {
  // `vault unlock` runs inside the vessel (HOME=/lar/cache, no surface env file there) and offers the keep lei only where
  // `configuredKeepWorkspace()` names a workspace; the shim's `-e` set crosses display names alone, so the compose carries them.
  const names = keepRuleNames();
  assert.deepEqual([...names].sort(), ["LARES_KEEP_WORKSPACE", "LARES_WORKSPACES"], "the keep rule reads the names this test expects");
  const env = serviceEnvironment(readFileSync(COMPOSE, "utf8"), "lares");
  assert.ok(env, "the compose names a lares service");
  for (const name of names) assert.equal(env[name], `\${${name}:-}`, `the lares service carries ${name} from the operator's config`);
});

test("CONTROL: a lares service that carries no keep name reads red", () => {
  const env = serviceEnvironment("services:\n  lares:\n    environment:\n      <<: *roots\n      LAR_PEERS: ${LAR_PEERS:-}\n  offline:\n    environment:\n      LARES_KEEP_WORKSPACE: ${LARES_KEEP_WORKSPACE:-}\n", "lares");
  assert.deepEqual(env, { LAR_PEERS: "${LAR_PEERS:-}" });
});

/**
 * THE PŪLAMA'S SOCKET REACHES NO HOST PATH. The vessel and the pūlama meet at `/pulama/socket`, and that directory rides one
 * named Docker volume the two services share, never a bind of the host house: a host process running as the operator's uid
 * (an AI session among them) that holds no Docker reaches no socket file there. The image pre-creates the mount point owned
 * by the runtime user, so the volume's first mount copies that owner and mode in.
 *
 * Each volume entry one top-level service lists itself, as `{ type, source, target }`.
 */
export function serviceVolumes(text, service) {
  const lines = text.split("\n");
  // A service may open an anchor (`  pulama: &pulama-keeper`) or stand as an alias of one (`  pulama-b: *pulama-keeper`):
  // an alias reads the volumes of the stanza its anchor opens.
  const head = lines.find((l) => new RegExp(`^  ${service}:(\\s+[&*][\\w-]+)?\\s*$`).test(l));
  if (head === undefined) return null;
  const alias = /^\s+\S+:\s+\*([\w-]+)\s*$/.exec(head)?.[1];
  const start = alias === undefined ? lines.indexOf(head) : lines.findIndex((l) => new RegExp(`^  [\\w.-]+:\\s+&${alias}\\s*$`).test(l));
  if (start < 0) return null;
  const out = [];
  let inVolumes = false, volIndent = -1, entry = null;
  for (let j = start + 1; j < lines.length; j++) {
    const line = lines[j];
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const indent = /^\s*/.exec(line)[0].length;
    if (indent <= 2) break;
    if (/^\s*volumes:\s*$/.test(line)) { inVolumes = true; volIndent = indent; continue; }
    if (inVolumes && indent <= volIndent && !/^\s*-/.test(line)) inVolumes = false;
    if (!inVolumes) continue;
    const item = /^\s*-\s*(.*)$/.exec(line);
    if (item) { entry = {}; out.push(entry); }
    const m = /^\s*(?:-\s*)?(type|source|target):\s*(.*)$/.exec(line);
    if (m && entry) entry[m[1]] = m[2].trim();
  }
  return out;
}

/** The top-level named volumes the compose declares. */
export function topLevelVolumes(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l === "volumes:");
  if (start < 0) return [];
  const out = [];
  for (let j = start + 1; j < lines.length; j++) {
    const line = lines[j];
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) break;
    const m = /^  ([A-Za-z0-9_.-]+):/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

export const PULAMA_SOCKET_VOLUME = "lares-pulama-socket";

/** Every refusal the socket law reads in a compose text and the Dockerfile beside it. */
export function readPulamaSocketMount(text, dockerfile) {
  const refusals = [];
  if (/source:[^\n]*\/pulama\/socket\s*\n\s*target: \/pulama\/socket/.test(text)) refusals.push("a host path binds at /pulama/socket");
  // `pulama-b`, the keeper's successor, stands over the same socket volume where the compose names it.
  const services = ["lares", "pulama", ...(serviceVolumes(text, "pulama-b") ? ["pulama-b"] : [])];
  for (const service of services) {
    const vols = serviceVolumes(text, service);
    if (!vols) { refusals.push(`no ${service} service stands`); continue; }
    const at = vols.filter((v) => v.target === "/pulama/socket");
    if (at.length !== 1) { refusals.push(`${service} mounts /pulama/socket ${at.length} times`); continue; }
    if (at[0].type !== "volume") refusals.push(`${service} mounts /pulama/socket as ${at[0].type}, not the named volume`);
    if (at[0].source !== PULAMA_SOCKET_VOLUME) refusals.push(`${service} mounts ${at[0].source} at /pulama/socket, not ${PULAMA_SOCKET_VOLUME}`);
  }
  if (!topLevelVolumes(text).includes(PULAMA_SOCKET_VOLUME)) refusals.push(`the compose declares no top-level ${PULAMA_SOCKET_VOLUME}`);
  for (const service of ["offline", "herm"]) {
    if ((serviceVolumes(text, service) ?? []).some((v) => v.target === "/pulama/socket")) refusals.push(`${service} mounts the pūlama's socket`);
  }
  const made = /^RUN mkdir -p [^\n]*\\?[\s\S]*?(?=\n[A-Z]+ |\n#|\n\n)/m.exec(dockerfile)?.[0] ?? "";
  if (!/mkdir -p[^\n]*\s\/pulama\/socket(\s|$)/.test(made)) refusals.push("the image does not pre-create /pulama/socket");
  if (!/chown node:node[^\n]*\s\/pulama\/socket(\s|$)/.test(made)) refusals.push("the image does not hand /pulama/socket to the runtime user");
  if (!/chmod 1777[^\n]*\s\/pulama\/socket(\s|$)/.test(made)) refusals.push("the image does not open /pulama/socket to whatever uid compose names (sticky, 1777)");
  return refusals;
}

const DOCKERFILE = join(ROOT, "Dockerfile");

test("the pūlama's socket rides one named volume the vessel and the pūlama share, binds no host path, and the image pre-creates its mount point for the runtime user", () => {
  assert.deepEqual(readPulamaSocketMount(readFileSync(COMPOSE, "utf8"), readFileSync(DOCKERFILE, "utf8")), []);
});

test("CONTROL: a successor keeper that leaves the shared stanza and binds a host path at /pulama/socket reads red", () => {
  const planted = readFileSync(COMPOSE, "utf8").replace(
    "  pulama-b: *pulama-keeper",
    "  pulama-b:\n    image: x\n    volumes:\n      - type: bind\n        source: /srv/pulama/socket\n        target: /pulama/socket");
  assert.notEqual(planted, readFileSync(COMPOSE, "utf8"), "the plant found the successor's alias line");
  assert.ok(readPulamaSocketMount(planted, readFileSync(DOCKERFILE, "utf8")).some((r) => r.startsWith("pulama-b mounts")), "the successor's bind reads red");
});

test("CONTROL: a host bind of /pulama/socket reads red", () => {
  const planted = readFileSync(COMPOSE, "utf8").replace(
    /- type: volume\n(\s*)source: lares-pulama-socket\n(\s*)target: \/pulama\/socket/,
    "- type: bind\n$1source: ${LARES_HOUSE:?set LARES_HOUSE}/pulama/socket\n$2target: /pulama/socket");
  const refusals = readPulamaSocketMount(planted, readFileSync(DOCKERFILE, "utf8"));
  assert.ok(refusals.some((r) => /host path binds/.test(r)), JSON.stringify(refusals));
  assert.ok(refusals.some((r) => /as bind, not the named volume/.test(r)), JSON.stringify(refusals));
});

test("CONTROL: an image that leaves the mount point to the engine reads red", () => {
  const planted = readFileSync(DOCKERFILE, "utf8").replaceAll(" /pulama/socket", "");
  const refusals = readPulamaSocketMount(readFileSync(COMPOSE, "utf8"), planted);
  assert.ok(refusals.some((r) => /does not pre-create/.test(r)), JSON.stringify(refusals));
});
