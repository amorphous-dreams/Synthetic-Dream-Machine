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
  const records = serviceBlock(text, "records");
  const issuer = serviceBlock(text, "issuer");
  const slot = text.slice(text.search(/^  terminator:\s*$/m));
  const problems = [];
  if (!terminator) problems.push("terminator service missing");
  if (!resolver) problems.push("resolver service missing");
  if (!records) problems.push("records service missing");
  if (!issuer) problems.push("issuer service missing");
  for (const [name, block] of [["terminator", terminator], ["resolver", resolver], ["records", records]]) {
    if (block && !/profiles:\s*\[https\]/.test(block)) problems.push(`${name} lacks https profile`);
    if (block && !/cap_drop:\s*\[ALL\]/.test(block)) problems.push(`${name} does not drop all capabilities`);
    if (block && !/no-new-privileges:true/.test(block)) problems.push(`${name} permits new privileges`);
    if (block && /docker\.sock|\/state(?:\/|\b)/.test(block)) problems.push(`${name} mounts protected host state`);
  }
  if (/\$\{[^}]+:\?/.test(slot)) problems.push("profile interpolation requires a value at compose parse time");
  // A credential rides under many names; any of these words inside an identifier counts.
  const slotWithoutIssuer = slot.replace(serviceBlock(slot, "issuer"), "");
  if (/(?:TOKEN|SECRET|API_?KEY|PASSWORD|PASSWD|CREDENTIAL|ACME)/i.test(nonComment(slotWithoutIssuer))) problems.push("slot names a credential variable");
  if (issuer) {
    const issuerIds = [...nonComment(issuer).matchAll(/\b[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|API_?KEY|PASSWORD|PASSWD|CREDENTIAL|ACME)[A-Z0-9_]*\b/g)].map((m) => m[0]);
    for (const id of new Set(issuerIds)) {
      if (!["PORKBUN_API_KEY_FILE", "PORKBUN_SECRET_API_KEY_FILE", "LARES_DNS_CREDENTIAL_DIR", "LARES_ACME_ACCEPT_TOS", "LARES_ACME_SERVER"].includes(id)) problems.push(`issuer names credential variable ${id}`);
    }
    for (const [id, path] of [["PORKBUN_API_KEY_FILE", "/run/dns/porkbun-api-key"], ["PORKBUN_SECRET_API_KEY_FILE", "/run/dns/porkbun-secret-api-key"]]) {
      const line = issuer.split("\n").find((row) => new RegExp(`^\\s+${id}:`).test(row))?.trim() ?? "";
      if (line !== `${id}: ${path}`) problems.push(`issuer ${id} is not a literal container path`);
    }
    if (!/profiles:\s*\[issuer\]/.test(issuer)) problems.push("issuer lacks issuer profile");
    if (!/cap_drop:\s*\[ALL\]/.test(issuer)) problems.push("issuer does not drop all capabilities");
    if (!/no-new-privileges:true/.test(issuer)) problems.push("issuer permits new privileges");
    if (/docker\.sock|\/state(?:\/|\b)|\/workspace(?:\/|\b)/.test(issuer)) problems.push("issuer mounts protected host paths");
    if (!/source: \$\{LARES_DNS_CREDENTIAL_DIR:-\/dev\/null\}\n\s*target: \/run\/dns\n\s*read_only: true/.test(issuer)) problems.push("issuer credential bind is not read-only");
    const binds = [...issuer.matchAll(/- type: bind\n([\s\S]*?)(?=\n\s{6}- type: bind|\n\s{4}[a-z_]+:|$)/g)].map((m) => m[1]);
    const writableBinds = binds.filter((bind) => !/read_only: true/.test(bind));
    if (writableBinds.length !== 1 || !/target: \/certs\s*$/.test(writableBinds[0] ?? "")) problems.push("issuer writable bind does not target only /certs");
    // The ONE request line: every domain flag the ACME client receives sits on it.
    const requests = nonComment(issuer).split("\n").filter((line) => /\/lego\s+run\b/.test(line));
    if (requests.length !== 1) problems.push("issuer does not make exactly one certificate request");
    const domains = [...requests.join("\n").matchAll(/(?:\s-d|--domains)[\s=]+([^\s]+)/g)].map((m) => m[1]);
    if (domains.length !== 1 || domains[0] !== '"*.$$LARES_TLS_ZONE"') problems.push("issuer does not issue exactly one zone wildcard");
    for (const required of ["LARES_TLS_ZONE", "LARES_TLS_DIR", "LARES_DNS_CREDENTIAL_DIR", "LARES_ACME_ACCEPT_TOS", "LARES_TLS_CERT_NAME"]) {
      if (!issuer.includes(`'${required} stands unset`)) problems.push(`issuer has no named ${required} refusal`);
    }
    for (const mount of ["LARES_STATE", "LARES_WORKSPACE", "LARES_TLS_DIR"]) {
      if (!issuer.includes(`'LARES_DNS_CREDENTIAL_DIR lies inside ${mount}`)) problems.push(`issuer lacks the inside-${mount} refusal`);
    }
    // The prefix checks compare plain absolute paths: a relative or dotted path refuses before any comparison.
    if (!/stands relative/.test(issuer) || !/dot segment or a doubled slash/.test(issuer)) problems.push("issuer compares unnormalized paths");
    // Owner-read only: each credential file reads mode 0400 under the issuer's own uid, in a directory closed to others.
    if (!/\[ "\$\$mode" = 400 \] \|\| refuse/.test(issuer)) problems.push("issuer admits a credential file wider than 0400");
    if (!/stat -c %u "\$\$file"\)" = "\$\$\(id -u\)"/.test(issuer)) problems.push("issuer does not check who owns a credential file");
    if (!/case "\$\$mode" in 700\|500\) ;; \*\) refuse "LARES_DNS_CREDENTIAL_DIR mode/.test(issuer)) problems.push("issuer admits a credential directory others can enter");
  }
  // The EFFECT, not the labels: the terminator proxies to the vessel on the compose network and passes the
  // upgrade through; the resolver answers the zone from a template and forwards the rest; both publish on
  // loopback by default; a request for an undeclared name gets no certificate.
  if (!/proxy_pass http:\/\/lares:4321;/.test(slot)) problems.push("terminator does not proxy to lares:4321");
  if (!/proxy_set_header Upgrade \$\$http_upgrade;/.test(slot)) problems.push("terminator does not pass the WebSocket upgrade");
  if (!/ssl_reject_handshake on;/.test(slot)) problems.push("terminator serves undeclared names");
  if (!/file \/zone\/db\.household \$\{LARES_TLS_ZONE/.test(slot) || !/forward \. \$\{LARES_DNS_UPSTREAM/.test(slot)) problems.push("resolver serves no rendered zone and upstream forward");
  for (const bind of ["LARES_TLS_BIND", "LARES_DNS_BIND"]) {
    if (!new RegExp(`\\$\\{${bind}:-127\\.0\\.0\\.1\\}`).test(slot)) problems.push(`${bind} does not default to loopback`);
  }
  if (/docker\.sock|\/state(?:\/|\b)/.test(slot)) problems.push("slot mounts protected host state");
  for (const required of ["LARES_TLS_NAME", "LARES_TLS_CERT", "LARES_TLS_KEY", "LARES_TLS_ZONE"]) {
    if (!/echo "household-https: /.test(terminator) || !terminator.includes(`'${required} stands unset`)) problems.push(`terminator has no named ${required} refusal`);
  }
  // The resolver's image holds no shell: it stands only behind a records check that passed every named check.
  if (resolver && !/depends_on:\s*\n\s*records:\s*\n\s*condition: service_completed_successfully/.test(resolver)) problems.push("resolver does not wait on a passed records check");
  // ONE RECORD PER NAME: the check reads the household's file read-only, holds no network, refuses by name, and its
  // one write is the zone volume the resolver reads read-only.
  if (records) {
    if (!/network_mode: none/.test(records)) problems.push("records check holds a network");
    for (const required of ["LARES_TLS_ZONE", "LARES_DNS_RECORDS"]) {
      if (!/echo "household-records: /.test(records) || !records.includes(`'${required} stands unset`)) problems.push(`records check has no named ${required} refusal`);
    }
    if (!/source: \$\{LARES_DNS_RECORDS:-\/dev\/null\}\n\s*target: \/run\/records\/household\.records\n\s*read_only: true/.test(records)) problems.push("records file bind is not read-only");
    const writable = [...records.matchAll(/- type: (bind|volume)\n([\s\S]*?)(?=\n\s{6}- type: |\n\s{4}[a-z_]+:|$)/g)].filter((m) => !/read_only: true/.test(m[2]));
    if (writable.length !== 1 || writable[0][1] !== "volume" || !/source: household-zone\n\s*target: \/zone\s*$/.test(writable[0][2])) problems.push("records check writes somewhere other than the zone volume");
  }
  if (resolver && !/source: household-zone\n\s*target: \/zone\n\s*read_only: true/.test(resolver)) problems.push("resolver reads the zone volume writable");
  // The terminator mounts its certificate and its key as two read-only files and nothing else of the issuer's directory.
  for (const [label, file] of [["certificate", "tls.crt"], ["key", "tls.key"]]) {
    const mount = new RegExp(`source: \\$\\{LARES_TLS_${label === "certificate" ? "CERT" : "KEY"}[^\\n]*\\n\\s*target: /run/tls/${file.replace(".", "\\.")}\\n\\s*read_only: true`);
    if (!mount.test(terminator)) problems.push(`${label} bind is not read-only`);
  }
  if (/LARES_TLS_DIR|LARES_DNS_CREDENTIAL|PORKBUN|\/run\/dns/.test(nonComment(terminator) + nonComment(resolver) + nonComment(records))) problems.push("the edge names issuer material");
  for (const name of ["lares", "offline", "herm"]) {
    if (profileOf(text, name).includes("https")) problems.push(`${name} carries https profile`);
    if (/depends_on:\s*[\s\S]{0,160}\b(?:terminator|resolver|records)\b/.test(serviceBlock(text, name))) problems.push(`${name} depends on the slot`);
  }
  const nonCommentSlot = slot.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");
  const domains = [...nonCommentSlot.matchAll(/\b[a-z0-9-]+(?:\.[a-z0-9-]+){2,}\b/gi)].map((m) => m[0]).filter((d) => !/^\d+(?:\.\d+)+$/.test(d) && d !== "acme-v02.api.letsencrypt.org");
  if (domains.some((d) => !/\.(?:test|example|invalid)$/i.test(d) && !/^v?\d+(?:\.\d+){1,2}$/i.test(d))) problems.push(`slot contains a literal domain: ${domains.join(", ")}`);
  for (const name of ["lares", "offline", "herm"]) {
    const block = serviceBlock(text, name);
    if (/LARES_DNS_|PORKBUN|\/run\/dns|LARES_TLS_DIR/.test(block)) problems.push(`${name} names issuer material`);
    if (profileOf(text, name).includes("issuer")) problems.push(`${name} carries issuer profile`);
  }
  if (/LARES_DNS_|PORKBUN|\/run\/dns|LARES_TLS_DIR/.test(text.slice(text.indexOf("x-vessel:"), text.indexOf("services:")))) problems.push("x-vessel names issuer material");
  // The first gate message rides one header, 8192 bytes from a measured tablet, and the vessel echoes it in its
  // answer: the request buffers and the response-head buffer both hold more than nginx's 8k defaults.
  const kilobytes = (pattern) => Number(pattern.exec(nonComment(text))?.[1] ?? 0);
  if (kilobytes(/large_client_header_buffers\s+\d+\s+(\d+)k;/) <= 8) problems.push("nginx main config lacks large client header buffers");
  if (kilobytes(/proxy_buffer_size\s+(\d+)k;/) <= 8) problems.push("terminator reads the vessel's answer head into a default buffer");
  if (kilobytes(/proxy_buffer_size\s+(\d+)k;/) < kilobytes(/large_client_header_buffers\s+\d+\s+(\d+)k;/)) problems.push("the response-head buffer holds less than a request header line may");
  return problems;
}

test("CONTROL: the slot scanner reads planted violations and accepts a planted lawful slot", () => {
  const planted = `x-vessel: &vessel
  image: local
services:
  terminator:\n    profiles: [https]\n    cap_drop: [ALL]\n    security_opt: ["no-new-privileges:true"]\n    command: echo \"household-https: \" 'LARES_TLS_NAME stands unset 'LARES_TLS_CERT stands unset 'LARES_TLS_KEY stands unset 'LARES_TLS_ZONE stands unset\n    volumes:\n      - type: bind\n        source: \${LARES_TLS_CERT:-/tmp/cert}\n        target: /run/tls/tls.crt\n        read_only: true\n      - type: bind\n        source: \${LARES_TLS_KEY:-/tmp/key}\n        target: /run/tls/tls.key\n        read_only: true\n  records:\n    profiles: [https]\n    network_mode: none\n    cap_drop: [ALL]\n    security_opt: ["no-new-privileges:true"]\n    command: echo \"household-records: \" 'LARES_TLS_ZONE stands unset 'LARES_DNS_RECORDS stands unset\n    volumes:\n      - type: bind\n        source: \${LARES_DNS_RECORDS:-/dev/null}\n        target: /run/records/household.records\n        read_only: true\n      - type: volume\n        source: household-zone\n        target: /zone\n  resolver:\n    profiles: [https]\n    cap_drop: [ALL]\n    security_opt: ["no-new-privileges:true"]\n    volumes:\n      - type: volume\n        source: household-zone\n        target: /zone\n        read_only: true\n    depends_on:\n      records:\n        condition: service_completed_successfully\n  lares:\n    profiles: [surface]\n  offline:\n    profiles: [offline]\n  herm:\n    profiles: [herm]\n`;
  const lawful = planted + `  issuer:
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    profiles: [issuer]
    entrypoint: ["/bin/sh", "-ec"]
    command: |
      refuse 'LARES_TLS_ZONE stands unset — supply zone'
      refuse 'LARES_TLS_DIR stands unset — supply directory'
      refuse 'LARES_DNS_CREDENTIAL_DIR stands unset — supply directory'
      refuse 'LARES_ACME_ACCEPT_TOS stands unset — accept terms'
      refuse 'LARES_TLS_CERT_NAME stands unset — supply name'
      refuse 'LARES_DNS_CREDENTIAL_DIR lies inside LARES_STATE — move it'
      refuse 'LARES_DNS_CREDENTIAL_DIR lies inside LARES_WORKSPACE — move it'
      refuse 'LARES_DNS_CREDENTIAL_DIR lies inside LARES_TLS_DIR — move it'
      refuse "$$1 ($$2) stands relative — give an absolute host path"
      refuse "$$1 ($$2) holds a dot segment or a doubled slash — give the plain absolute path"
      case "$$mode" in 700|500) ;; *) refuse "LARES_DNS_CREDENTIAL_DIR mode ($$mode) lets group or other in" ;; esac
      [ "$$(stat -c %u "$$file")" = "$$(id -u)" ] || refuse "another user"
      [ "$$mode" = 400 ] || refuse "wider than its owner"
      exec /lego run --account-id household -d "*.$$LARES_TLS_ZONE"
    environment:
      PORKBUN_API_KEY_FILE: /run/dns/porkbun-api-key
      PORKBUN_SECRET_API_KEY_FILE: /run/dns/porkbun-secret-api-key
      LARES_ACME_SERVER: https://acme-v02.api.letsencrypt.org/directory
    volumes:
      - type: bind
        source: \${LARES_DNS_CREDENTIAL_DIR:-/dev/null}
        target: /run/dns
        read_only: true
      - type: bind
        source: \${LARES_TLS_DIR:-/dev/null}
        target: /certs
  configs:\n  nginx:\n    content: |\n      large_client_header_buffers 4 16k;\n      proxy_buffer_size 16k;\n      ssl_reject_handshake on;\n      proxy_pass http://lares:4321;\n      proxy_set_header Upgrade $$http_upgrade;\n  corefile:\n    content: |\n      file /zone/db.household \${LARES_TLS_ZONE:-unset.invalid} {\n      forward . \${LARES_DNS_UPSTREAM:-1.1.1.1}\n  ports: "\${LARES_TLS_BIND:-127.0.0.1}:443" "\${LARES_DNS_BIND:-127.0.0.1}:53"\n`;
  assert.deepEqual(scan(lawful), []);
  const red = (text, needle) => assert.ok(scan(text).some((p) => p.includes(needle)), `scanner missed: ${needle}`);
  red(lawful.replace("profiles: [https]", "profiles: [other]"), "https profile");
  red(lawful.replace("read_only: true", "read_only: false"), "read-only");
  // A slot that keeps every label and proxies nowhere.
  red(lawful.replace("proxy_pass http://lares:4321;", "return 200;"), "does not proxy to lares:4321");
  red(lawful.replace("proxy_set_header Upgrade $$http_upgrade;", ""), "WebSocket upgrade");
  red(lawful.replace("ssl_reject_handshake on;", ""), "undeclared names");
  red(lawful.replace("forward . ", "forward-nothing "), "rendered zone and upstream forward");
  // ONE RECORD PER NAME: each fault turns its own scanner.
  red(lawful.replace("file /zone/db.household", "template IN A"), "rendered zone and upstream forward");
  red(lawful.replace("      records:\n        condition: service_completed_successfully", "      records:\n        condition: service_started"), "passed records check");
  red(lawful.replace("    network_mode: none\n", ""), "records check holds a network");
  red(lawful.replace("'LARES_DNS_RECORDS stands unset", "'LARES_DNS_RECORDS check removed"), "named LARES_DNS_RECORDS refusal");
  red(lawful.replace("target: /run/records/household.records\n        read_only: true", "target: /run/records/household.records\n        read_only: false"), "records file bind is not read-only");
  red(lawful.replace("        target: /zone\n  resolver:", "        target: /zone\n      - type: bind\n        source: /srv/elsewhere\n        target: /elsewhere\n  resolver:"), "writes somewhere other than the zone volume");
  red(lawful.replace("        target: /zone\n        read_only: true", "        target: /zone"), "zone volume writable");
  red(lawful.replace("LARES_DNS_BIND:-127.0.0.1", "LARES_DNS_BIND:-0.0.0.0"), "LARES_DNS_BIND does not default to loopback");
  // A credential under a name the plain word list would miss.
  red(lawful.replace("target: /run/dns\n        read_only: true", "target: /run/dns\n        read_only: false"), "credential bind is not read-only");
  red(lawful.replace("PORKBUN_API_KEY_FILE: /run/dns/porkbun-api-key", "PORKBUN_API_KEY_FILE: ${PORKBUN_API_KEY_FILE:-}"), "not a literal container path");
  red(lawful.replace("PORKBUN_SECRET_API_KEY_FILE: /run/dns/porkbun-secret-api-key", "PORKBUN_SECRET_API_KEY_FILE: ${PORKBUN_SECRET_API_KEY_FILE:-}"), "not a literal container path");
  red(lawful.replace("cap_drop: [ALL]\n    security_opt: [\"no-new-privileges:true\"]\n    profiles: [issuer]", "cap_drop: [NET_ADMIN]\n    security_opt: [\"no-new-privileges:true\"]\n    profiles: [issuer]"), "issuer does not drop all capabilities");
  red(lawful.replace("security_opt: [\"no-new-privileges:true\"]\n    profiles: [issuer]", "security_opt: []\n    profiles: [issuer]"), "issuer permits new privileges");
  red(lawful.replace("LARES_ACME_SERVER: https://acme-v02.api.letsencrypt.org/directory", "LARES_ACME_SERVER: https://acme.example.net/directory"), "literal domain");
  // Each fault turns ONE scanner: a second read-only bind onto the workspace, and a writable bind beside /certs.
  const oneScanner = (text, needle, others) => { const hits = scan(text); assert.ok(hits.some((p) => p.includes(needle)), `scanner missed: ${needle}`); for (const other of others) assert.ok(!hits.some((p) => p.includes(other)), `${needle} fault also tripped: ${other}`); };
  oneScanner(lawful.replace("        target: /certs\n", "        target: /certs\n      - type: bind\n        source: /srv/corpus\n        target: /workspace\n        read_only: true\n"), "issuer mounts protected host paths", ["writable bind"]);
  oneScanner(lawful.replace("        target: /certs\n", "        target: /certs\n      - type: bind\n        source: /srv/elsewhere\n        target: /elsewhere\n"), "writable bind does not target only /certs", ["protected host paths"]);
  red(lawful.replace("x-vessel: &vessel\n  image: local", "x-vessel: &vessel\n  environment:\n    LARES_TLS_DIR: /certs\n  image: local"), "x-vessel names issuer material");
  red(lawful.replace("-d \"*.$$LARES_TLS_ZONE\"", "-d hearth.home.example.test"), "exactly one zone wildcard");
  red(lawful.replace("-d \"*.$$LARES_TLS_ZONE\"", "-d \"*.$$LARES_TLS_ZONE\" --domains=hearth.home.example.test"), "exactly one zone wildcard");
  red(lawful.replace("      exec /lego run", "      /lego run -d other.example.test\n      exec /lego run"), "exactly one certificate request");
  for (const required of ["LARES_TLS_ZONE", "LARES_TLS_DIR", "LARES_DNS_CREDENTIAL_DIR", "LARES_ACME_ACCEPT_TOS", "LARES_TLS_CERT_NAME"]) {
    red(lawful.replace(`${required} stands unset`, `${required} check removed`), `named ${required} refusal`);
  }
  red(lawful.replace("profiles: [issuer]", "profiles: [other]"), "issuer profile");
  red(lawful.replace("/run/dns/porkbun-secret-api-key", "${PORKBUN_SECRET_API_KEY_FILE:-}"), "not a literal container path");
  for (const mount of ["LARES_STATE", "LARES_WORKSPACE", "LARES_TLS_DIR"]) {
    red(lawful.replace(`lies inside ${mount}`, "check removed"), `inside-${mount} refusal`);
  }
  red(lawful.replace("stands relative", "check removed"), "unnormalized paths");
  red(lawful.replace('[ "$$mode" = 400 ] || refuse', 'case "$$mode" in 400|600|644) ;; *) refuse'), "wider than 0400");
  red(lawful.replace('[ "$$(stat -c %u "$$file")" = "$$(id -u)" ] || refuse "another user"', ""), "who owns a credential file");
  red(lawful.replace("in 700|500) ;;", "in 700|500|755) ;;"), "credential directory others can enter");
  red(lawful.replace("profiles: [surface]", "profiles: [issuer]"), "lares carries issuer profile");
  red(lawful.replace("  lares:\n    profiles: [surface]", "  lares:\n    environment:\n      PORKBUN_API_KEY_FILE: /run/dns/key\n    profiles: [surface]"), "lares names issuer material");
  red(lawful.replace("    cap_drop: [ALL]", "    environment:\n      DNS_CREDENTIAL: \${DNS_CREDENTIAL:-}\n    cap_drop: [ALL]"), "credential variable");
  red(lawful.replace("large_client_header_buffers 4 16k;", "large_client_header_buffers 4 8k;"), "large client header buffers");
  red(lawful.replace("proxy_buffer_size 16k;", ""), "answer head into a default buffer");
  red(lawful.replace("large_client_header_buffers 4 16k;", "large_client_header_buffers 4 32k;"), "response-head buffer holds less");
  red(lawful.replace("target: /run/tls/tls.key\n        read_only: true", "target: /run/tls/tls.key\n        read_only: false"), "key bind is not read-only");
  // A terminator handed the issuer's whole directory would read the account key and every machine's key.
  red(lawful.replace("source: \${LARES_TLS_CERT:-/tmp/cert}", "source: \${LARES_TLS_DIR:-/tmp/cert}"), "the edge names issuer material");
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
