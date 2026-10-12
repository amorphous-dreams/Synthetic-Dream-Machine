// The harness image law keeps each compose service on the product image and its own scratch mounts.
// Playwright alone reads the repository, because Chromium must run from its browser image.
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
  ["browser-a", "Playwright supplies Chromium and needs the repository read-only"],
  ["browser-b", "Playwright supplies Chromium and needs the repository read-only"],
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
    const images = [...body.matchAll(/^\s*image:\s*(.+)$/gm)].map((m) => m[1].trim());
    if (exception) {
      assert.match(EXCEPTIONS.get(service.name), /Playwright.*Chromium.*read-only/);
      if (!/mcr\.microsoft\.com\/playwright/.test(images.join(" "))) errors.push(`${service.name}: exception does not use Playwright image`);
      if (!/(?:\.|\.\/):\/app:ro["']?|read_only:\s*true/.test(body)) errors.push(`${service.name}: exception repository mount is not read-only`);
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
    for (const mount of volumeMounts) {
      const [source = "", rawTarget = ""] = mount.split(":");
      const target = rawTarget.replace(/:.*$/, "");
      if (source === "." || source === "./" || resolve(ROOT, source) === ROOT) {
        if (!exception || !/:ro["']?/.test(mount)) errors.push(`${service.name}: repository bind is forbidden`);
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
  return errors;
}

test("CONTROL: every scanner sees its planted compose fault", () => {
  const planted = `services:\n  vessel:\n    image: node:24-slim\n    build: .\n    volumes:\n      - .:/app\n      - s:/state\n      - ./tools:/app/tools\n    command: node_modules/.bin/tsx probe.ts\n  swallowed:\n    image: "\${LARES_HARNESS_IMAGE:?digest}"\n    command: ["node", "packages/lararium-node/dist/probes/x.js"]\n  browser-a:\n    image: mcr.microsoft.com/playwright:v1.64.0-noble\n    volumes: [".:/app"]\n    command: ["node", "probe.ts"]\n`;
  const hits = inspect("planted.yml", planted);
  for (const expected of ["image does not require", "build key", "repository bind", "one character", "TypeScript entrypoint", "exception repository mount", "host bind ./tools", "rides entrypoint"])
    assert.ok(hits.some((hit) => hit.includes(expected)), `scanner missed ${expected}: ${hits.join("; ")}`);
});

test("each harness service runs the digest image with image-owned code and declared mounts", () => {
  const violations = fileList().flatMap((file) => inspect(file, readFileSync(file, "utf8")).map((hit) => `${file.startsWith(`${ROOT}/`) ? relative(ROOT, file) : basename(file)}: ${hit}`));
  assert.deepEqual(violations, [], violations.join("\n"));
});
