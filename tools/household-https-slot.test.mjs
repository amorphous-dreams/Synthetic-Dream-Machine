// Household HTTPS is an optional edge slot: it carries no household credential or vessel state.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL("../docker-compose.surface.yml", import.meta.url));
const composeText = () => readFileSync(process.env.HOUSEHOLD_HTTPS_COMPOSE ?? here, "utf8");

function serviceBlock(text, name) {
  const start = text.search(new RegExp(`^  ${name}:\\s*$`, "m"));
  if (start < 0) return "";
  const rest = text.slice(start);
  const next = rest.slice(1).search(/^  [\w-]+:\s*$/m);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

function profileOf(text, name) {
  return /\bprofiles:\s*\[([^\]]*)\]/.exec(serviceBlock(text, name))?.[1]?.trim() ?? "";
}

const nonComment = (text) => text.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");

function scan(text) {
  const terminator = serviceBlock(text, "terminator");
  const resolver = serviceBlock(text, "resolver");
  const slot = text.slice(text.search(/^  terminator:\s*$/m));
  const problems = [];
  if (!terminator) problems.push("terminator service missing");
  if (!resolver) problems.push("resolver service missing");
  for (const [name, block] of [["terminator", terminator], ["resolver", resolver]]) {
    if (block && !/profiles:\s*\[https\]/.test(block)) problems.push(`${name} lacks https profile`);
    if (block && !/cap_drop:\s*\[ALL\]/.test(block)) problems.push(`${name} does not drop all capabilities`);
    if (block && !/no-new-privileges:true/.test(block)) problems.push(`${name} permits new privileges`);
    if (block && /docker\.sock|\/state(?:\/|\b)/.test(block)) problems.push(`${name} mounts protected host state`);
  }
  if (/\$\{[^}]+:\?/.test(slot)) problems.push("profile interpolation requires a value at compose parse time");
  // A credential rides under many names; any of these words inside an identifier counts.
  if (/(?:TOKEN|SECRET|API_?KEY|PASSWORD|PASSWD|CREDENTIAL|ACME)/i.test(nonComment(slot))) problems.push("slot names a credential variable");
  // The EFFECT, not the labels: the terminator proxies to the vessel on the compose network and passes the
  // upgrade through; the resolver answers the zone from a template and forwards the rest; both publish on
  // loopback by default; a request for an undeclared name gets no certificate.
  if (!/proxy_pass http:\/\/lares:4321;/.test(slot)) problems.push("terminator does not proxy to lares:4321");
  if (!/proxy_set_header Upgrade \$\$http_upgrade;/.test(slot)) problems.push("terminator does not pass the WebSocket upgrade");
  if (!/ssl_reject_handshake on;/.test(slot)) problems.push("terminator serves undeclared names");
  if (!/template IN A \$\{LARES_TLS_ZONE/.test(slot) || !/forward \. \$\{LARES_DNS_UPSTREAM/.test(slot)) problems.push("resolver holds no zone template and upstream forward");
  for (const bind of ["LARES_TLS_BIND", "LARES_DNS_BIND"]) {
    if (!new RegExp(`\\$\\{${bind}:-127\\.0\\.0\\.1\\}`).test(slot)) problems.push(`${bind} does not default to loopback`);
  }
  if (/docker\.sock|\/state(?:\/|\b)/.test(slot)) problems.push("slot mounts protected host state");
  for (const required of ["LARES_TLS_NAME", "LARES_TLS_CERT", "LARES_TLS_KEY", "LARES_TLS_ZONE", "LARES_LAN_ADDRESS"]) {
    if (!/echo "household-https: /.test(terminator) || !terminator.includes(`'${required} stands unset`)) problems.push(`terminator has no named ${required} refusal`);
  }
  // The resolver's image holds no shell: it stands only behind a terminator that passed every named check.
  if (resolver && !/depends_on:\s*\n\s*terminator:\s*\n\s*condition: service_healthy/.test(resolver)) problems.push("resolver does not wait on a healthy terminator");
  for (const [label, file] of [["certificate", "tls.crt"], ["key", "tls.key"]]) {
    const mount = new RegExp(`source: \\$\\{LARES_TLS_${label === "certificate" ? "CERT" : "KEY"}[^\\n]*\\n\\s*target: [^\\n]+\\n\\s*read_only: true`);
    if (!mount.test(slot)) problems.push(`${label} bind is not read-only`);
  }
  for (const name of ["lares", "offline", "herm"]) {
    if (profileOf(text, name).includes("https")) problems.push(`${name} carries https profile`);
    if (/depends_on:\s*[\s\S]{0,160}\b(?:terminator|resolver)\b/.test(serviceBlock(text, name))) problems.push(`${name} depends on the slot`);
  }
  const nonCommentSlot = slot.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");
  const domains = [...nonCommentSlot.matchAll(/\b[a-z0-9-]+(?:\.[a-z0-9-]+){2,}\b/gi)].map((m) => m[0]).filter((d) => !/^\d+(?:\.\d+)+$/.test(d));
  if (domains.some((d) => !/\.(?:test|example|invalid)$/i.test(d))) problems.push(`slot contains a literal domain: ${domains.join(", ")}`);
  return problems;
}

test("CONTROL: the slot scanner reads planted violations and accepts a planted lawful slot", () => {
  const planted = `  terminator:\n    profiles: [https]\n    cap_drop: [ALL]\n    security_opt: ["no-new-privileges:true"]\n    command: echo \"household-https: \" 'LARES_TLS_NAME stands unset 'LARES_TLS_CERT stands unset 'LARES_TLS_KEY stands unset 'LARES_TLS_ZONE stands unset 'LARES_LAN_ADDRESS stands unset\n    volumes:\n      - type: bind\n        source: \${LARES_TLS_CERT:-/tmp/cert}\n        target: /run/tls/tls.crt\n        read_only: true\n      - type: bind\n        source: \${LARES_TLS_KEY:-/tmp/key}\n        target: /run/tls/tls.key\n        read_only: true\n  resolver:\n    profiles: [https]\n    cap_drop: [ALL]\n    security_opt: ["no-new-privileges:true"]\n    depends_on:\n      terminator:\n        condition: service_healthy\n  lares:\n    profiles: [surface]\n  offline:\n    profiles: [offline]\n  herm:\n    profiles: [herm]\n`;
  const lawful = planted + `configs:\n  nginx:\n    content: |\n      ssl_reject_handshake on;\n      proxy_pass http://lares:4321;\n      proxy_set_header Upgrade $$http_upgrade;\n  corefile:\n    content: |\n      template IN A \${LARES_TLS_ZONE:-unset.invalid} {\n      forward . \${LARES_DNS_UPSTREAM:-1.1.1.1}\n  ports: "\${LARES_TLS_BIND:-127.0.0.1}:443" "\${LARES_DNS_BIND:-127.0.0.1}:53"\n`;
  assert.deepEqual(scan(lawful), []);
  const red = (text, needle) => assert.ok(scan(text).some((p) => p.includes(needle)), `scanner missed: ${needle}`);
  red(lawful.replace("profiles: [https]", "profiles: [other]"), "https profile");
  red(lawful.replace("read_only: true", "read_only: false"), "read-only");
  // A slot that keeps every label and proxies nowhere.
  red(lawful.replace("proxy_pass http://lares:4321;", "return 200;"), "does not proxy to lares:4321");
  red(lawful.replace("proxy_set_header Upgrade $$http_upgrade;", ""), "WebSocket upgrade");
  red(lawful.replace("ssl_reject_handshake on;", ""), "undeclared names");
  red(lawful.replace("forward . ", "forward-nothing "), "zone template and upstream forward");
  red(lawful.replace("LARES_DNS_BIND:-127.0.0.1", "LARES_DNS_BIND:-0.0.0.0"), "LARES_DNS_BIND does not default to loopback");
  // A credential under a name the plain word list would miss.
  red(lawful.replace("    cap_drop: [ALL]", "    environment:\n      DNS_CREDENTIAL: \${DNS_CREDENTIAL:-}\n    cap_drop: [ALL]"), "credential variable");
});

test("household HTTPS lives in one hardened, optional compose slot", () => {
  const text = composeText();
  const problems = scan(text);
  assert.deepEqual(problems, [], problems.join("\n"));
  assert.equal(profileOf(text, "terminator"), "https");
  assert.equal(profileOf(text, "resolver"), "https");
});

test("MUTATION CONTROL: removing the terminator profile makes the law scanner red", () => {
  const text = composeText();
  if (!/  terminator:\s*\n[\s\S]*?profiles:\s*\[https\]/.test(text)) return;
  const mutated = text.replace(/(  terminator:\s*\n[\s\S]*?)    profiles: \[https\]/, "$1    profiles: [disabled]");
  const dir = mkdtempSync(join(tmpdir(), "household-https-mutation-"));
  const path = join(dir, "compose.yml");
  const prior = process.env.HOUSEHOLD_HTTPS_COMPOSE;
  try {
    writeFileSync(path, mutated);
    process.env.HOUSEHOLD_HTTPS_COMPOSE = path;
    const plantedMutation = composeText();
    assert.equal(plantedMutation, mutated);
    assert.ok(scan(plantedMutation).some((problem) => problem === "terminator lacks https profile"));
  } finally {
    if (prior === undefined) delete process.env.HOUSEHOLD_HTTPS_COMPOSE;
    else process.env.HOUSEHOLD_HTTPS_COMPOSE = prior;
    rmSync(dir, { recursive: true, force: true });
  }
});
