// The harness image law keeps each compose service on the product image and its own scratch mounts.
// A browser vessel runs Chromium from a browser image and reads its code from the product image, through a
// volume the image fills; no service binds the repository, and a harness run names its own compose project.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
  "docker-compose.mesh.yml", "docker-compose.kahu.yml", "docker-compose.kahu-recovery.yml",
  "docker-compose.crossing.yml", "docker-compose.swarm.yml", "docker-compose.swarm-ws.yml",
  "docker-compose.burn.yml",
];
const EXCEPTIONS = new Map([
  ["browser-a", "Playwright supplies Chromium; the image-filled code volume mounts read-only"],
  ["browser-b", "Playwright supplies Chromium; the image-filled code volume mounts read-only"],
]);

function fileList() {
  if (!process.env.HARNESS_LAW_FILE_LIST) return FILES.map((f) => join(ROOT, f));
  return JSON.parse(readFileSync(process.env.HARNESS_LAW_FILE_LIST, "utf8")).map((f) => resolve(ROOT, f));
}

function blocks(text, indent, section) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line === `${" ".repeat(indent)}${section}:`);
  if (start < 0) return [];
  const out = [];
  let current = null;
  for (const line of lines.slice(start + 1)) {
    const spaces = line.match(/^ */)?.[0].length ?? 0;
    if (line.trim() && spaces <= indent) break;
    if (spaces === indent + 2 && /^[\w-]+:\s*(?:&[\w-]+)?\s*$/.test(line.trim())) {
      if (current) out.push(current);
      current = { name: line.trim().replace(/:\s*$/, ""), text: "" };
    } else if (current) current.text += `${line}\n`;
  }
  if (current) out.push(current);
  return out;
}

function inspect(file, text) {
  const errors = [];
  const anchors = new Map();
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const anchor = /^x-[\w-]+:\s*&([\w-]+)\s*$/.exec(lines[i]);
    if (!anchor) continue;
    let body = "";
    for (i++; i < lines.length && (!lines[i].trim() || /^\s/.test(lines[i])); i++) body += `${lines[i]}\n`;
    i--;
    anchors.set(anchor[1], body);
  }
  const services = blocks(text, 0, "services");
  assert.ok(services.length, `${file}: services scanner found no services`);
  for (const service of services) {
    const inherited = [...service.text.matchAll(/<<:\s*\*(\w+)/g)].map((m) => anchors.get(m[1]) ?? "").join("\n");
    const body = `${inherited}\n${service.text}`;
    const exception = EXCEPTIONS.has(service.name);
    // The EFFECTIVE image: a service's own `image:` replaces the one its anchor carries, so the last one decides.
    const images = [...body.matchAll(/^\s*image:\s*(.+)$/gm)].map((m) => m[1].trim()).slice(-1);
    if (exception) {
      assert.match(EXCEPTIONS.get(service.name), /Playwright.*Chromium.*read-only/);
      if (!/mcr\.microsoft\.com\/playwright/.test(images.join(" "))) errors.push(`${service.name}: exception does not use Playwright image`);
      if (!/["'\s[]probe-code:\/app:ro["']/.test(body)) errors.push(`${service.name}: the code volume does not mount read-only at /app`);
      if (!/probe-code:\s*\n\s*condition: service_completed_successfully/.test(body)) errors.push(`${service.name}: starts before the image fills its code volume`);
    } else if (!images.some((image) => /\$\{LARES_HARNESS_IMAGE:\?/.test(image))) {
      errors.push(`${service.name}: image does not require LARES_HARNESS_IMAGE`);
    }
    if (/^\s*build:/m.test(body)) errors.push(`${service.name}: build key is forbidden`);
    const volumeMounts = [];
    const bodyLines = body.split("\n");
    for (let i = 0; i < bodyLines.length; i++) {
      if (!/^\s*volumes:\s*/.test(bodyLines[i])) continue;
      const inline = /\[([^\]]*)\]/.exec(bodyLines[i])?.[1];
      if (inline !== undefined) volumeMounts.push(...inline.split(",").map((v) => v.trim().replace(/^['"]|['"]$/g, "")));
      else {
        let j = i + 1;
        for (; j < bodyLines.length && /^\s+-\s+/.test(bodyLines[j]); j++) volumeMounts.push(bodyLines[j].replace(/^\s+-\s+/, "").trim().replace(/^['"]|['"]$/g, ""));
        i = j - 1;
      }
    }
    // Long-form mounts (`- type: bind` / `source:` / `target:` / `read_only:`) read as `source:target[:ro]`.
    for (const m of body.matchAll(/^\s+-\s+type:\s*bind\s*\n((?:\s+(?:source|target|read_only|bind|consistency):.*\n?)+)/gm)) {
      const field = (name) => new RegExp(`^\\s+${name}:\\s*["']?([^"'\\n]+?)["']?\\s*$`, "m").exec(m[1])?.[1] ?? "";
      volumeMounts.push(`${field("source")}:${field("target")}${field("read_only") === "true" ? ":ro" : ""}`);
    }
    for (const mount of volumeMounts) {
      const [source = "", rawTarget = ""] = mount.split(":");
      const target = rawTarget.replace(/:.*$/, "");
      if (source === "." || source === "./" || resolve(ROOT, source) === ROOT) {
        errors.push(`${service.name}: repository bind is forbidden`);
      } else if ((source.startsWith("./") || source.startsWith("../") || source.startsWith("/")) && !(source === "./tools" && target === "/app/tools" && /(?:\.\/tools:\/app\/tools:ro["']?|read_only:\s*true)/.test(mount + body))) {
        errors.push(`${service.name}: host bind ${source} is forbidden`);
      }
      if (/^[A-Za-z]:/.test(source) && !source.startsWith("./")) continue;
      if (source && !source.startsWith(".") && source.length === 1) errors.push(`${service.name}: volume name ${source} has one character`);
    }
    const launch = body.split("\n").filter((line) => /^\s*(?:command|entrypoint):/.test(line)).join("\n");
    if (/(?:tsx|\.ts(?:['"\s,\]]|$))/.test(launch)) errors.push(`${service.name}: source TypeScript entrypoint is forbidden`);
    // The product image's ENTRYPOINT runs the daemon, and compose appends a `command` to it as arguments. A probe
    // therefore replaces the entrypoint; a `command` naming one would boot the daemon instead.
    if (!exception && /^\s*command:.*dist\/probes\//m.test(body)) errors.push(`${service.name}: a probe rides entrypoint, never command`);
  }
  // A browser's code volume holds the image's bytes only when a product-image service mounts it, writable and
  // empty, over the image's own /app: that first mount copies the image's content in.
  if (services.some((service) => EXCEPTIONS.has(service.name))) {
    const filler = services.find((service) => service.name === "probe-code");
    if (!filler) errors.push("probe-code: no service fills the browser code volume");
    else {
      if (!/^\s*-\s*["']?probe-code:\/app["']?\s*$/m.test(filler.text)) errors.push("probe-code: the filler does not mount the code volume writable at /app");
      if (!/\$\{LARES_HARNESS_IMAGE:\?/.test(filler.text)) errors.push("probe-code: the filler does not run the digest image");
    }
  }
  return errors;
}

test("CONTROL: every scanner sees its planted compose fault", () => {
  const planted = `services:\n  vessel:\n    image: node:24-slim\n    build: .\n    volumes:\n      - .:/app\n      - s:/state\n      - ./tools:/app/tools\n    command: node_modules/.bin/tsx probe.ts\n  longform:\n    image: "\${LARES_HARNESS_IMAGE:?digest}"\n    volumes:\n      - type: bind\n        source: ./packages\n        target: /app/packages\n  swallowed:\n    image: "\${LARES_HARNESS_IMAGE:?digest}"\n    command: ["node", "packages/lararium-node/dist/probes/x.js"]\n  browser-a:\n    image: mcr.microsoft.com/playwright:v1.64.0-noble\n    volumes: [".:/app:ro"]\n    command: ["node", "probe.ts"]\n`;
  const hits = inspect("planted.yml", planted);
  for (const expected of ["image does not require", "build key", "repository bind", "one character", "TypeScript entrypoint", "browser-a: repository bind", "browser-a: the code volume", "browser-a: starts before", "probe-code: no service fills", "host bind ./tools", "rides entrypoint", "longform: host bind ./packages"])
    assert.ok(hits.some((hit) => hit.includes(expected)), `scanner missed ${expected}: ${hits.join("; ")}`);
});

test("CONTROL: a service that overrides its anchor's digest image with another image reads red", () => {
  const text = `x-herm: &herm\n  image: "\${LARES_HARNESS_IMAGE:?digest}"\n\nservices:\n  herm-source:\n    <<: *herm\n    image: node:24-slim\n  herm-relay:\n    <<: *herm\n`;
  const hits = inspect("override.yml", text);
  assert.ok(hits.some((hit) => hit.includes("herm-source: image does not require")), hits.join("; "));
  assert.ok(!hits.some((hit) => hit.startsWith("herm-relay:")), hits.join("; "));
});

test("CONTROL: a long-form repository bind reads red, and a long-form read-only tools bind passes", () => {
  const bad = `services:\n  a:\n    image: "\${LARES_HARNESS_IMAGE:?digest}"\n    volumes:\n      - type: bind\n        source: .\n        target: /app\n`;
  assert.ok(inspect("long.yml", bad).some((hit) => hit.includes("repository bind")));
  const good = `services:\n  a:\n    image: "\${LARES_HARNESS_IMAGE:?digest}"\n    volumes:\n      - type: bind\n        source: ./tools\n        target: /app/tools\n        read_only: true\n`;
  assert.deepEqual(inspect("long.yml", good), []);
});

test("each harness service runs the digest image with image-owned code and declared mounts", () => {
  const violations = fileList().flatMap((file) => inspect(file, readFileSync(file, "utf8")).map((hit) => `${file.startsWith(`${ROOT}/`) ? relative(ROOT, file) : basename(file)}: ${hit}`));
  assert.deepEqual(violations, [], violations.join("\n"));
});

test("CONTROL: a browser vessel on the image-filled code volume, waiting on its fill, passes", () => {
  const good = `services:\n  probe-code:\n    image: "\${LARES_HARNESS_IMAGE:?digest}"\n    volumes:\n      - "probe-code:/app"\n    entrypoint: ["true"]\n  browser-a:\n    image: mcr.microsoft.com/playwright:v1.64.0-noble\n    volumes: ["probe-code:/app:ro"]\n    depends_on:\n      probe-code:\n        condition: service_completed_successfully\n    command: ["node", "packages/lararium-node/dist/probes/browser-vessel.js"]\n`;
  assert.deepEqual(inspect("browser.yml", good), []);
  assert.ok(inspect("browser.yml", good.replace("probe-code:/app:ro", "probe-code:/app")).some((hit) => hit.includes("the code volume")));
  assert.ok(inspect("browser.yml", good.replace('- "probe-code:/app"', '- "probe-code:/elsewhere"')).some((hit) => hit.includes("the filler does not mount")));
  assert.ok(inspect("browser.yml", good.replace('image: "${LARES_HARNESS_IMAGE:?digest}"', "image: node:24-slim")).some((hit) => hit.includes("the filler does not run the digest image")));
});

// A run under another project name reads its own containers, network and volumes: the runner derives every
// such name from MESH_PROJECT and spells the default once.
function fixedProjectNames(text) {
  return text.split("\n").filter((line) => /dreamnet-mesh/.test(line) && !/^\s*#/.test(line) && !/MESH_PROJECT="\$\{MESH_PROJECT:-dreamnet-mesh\}"/.test(line));
}

test("the mesh runner names its compose project from the environment", () => {
  const text = readFileSync(join(ROOT, "tools/mesh-scenarios.sh"), "utf8");
  assert.match(text, /^MESH_PROJECT="\$\{MESH_PROJECT:-dreamnet-mesh\}"$/m);
  assert.match(text, /^export COMPOSE_PROJECT_NAME="\$MESH_PROJECT"$/m);
  assert.deepEqual(fixedProjectNames(text), []);
  // CONTROL: the scanner reads a planted fixed name and passes a commented one.
  assert.equal(fixedProjectNames('local name="dreamnet-mesh-${svc}-1"\n# the dreamnet-mesh default\n').length, 1);
});
