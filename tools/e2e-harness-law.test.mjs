// e2e-harness-law — every e2e file and every witness script can run beside any other, because none of them
// holds a resource that a second copy of itself would also reach for.
//
// THREE SHARED RESOURCES, EACH READ HERE AGAINST ITS KNOWN POSITIVE:
//
//   1. A LITERAL PORT. Two copies of one file that binds `:8299` refuse each other, and the second reads as a
//      boot fault. A port comes from the OS (`freePort()`, or a `listen(0)` in a witness). A literal below 1024
//      stays lawful: an unprivileged run can never bind it, so it names an address that never answers (the
//      `:9` discard peer) and never a seat the run holds.
//   2. A GATED VESSEL DOOR WITHOUT `--skip-build`. Every `vessel` sub-door outside the gate's stated exceptions
//      rebuilds the whole workspace when source moved since the last stamp, rewriting the `dist/` every other
//      run executes. A test or witness measures the dist that stands, and builds nothing. The gated set is
//      DERIVED from the CLI's own table (`SUBS` less `NEVER_STALE`), so a sub-door added later is gated here
//      the day it lands.
//   3. A SCRATCH PROBE COLLECTED BY EVERYONE. A `zz-*` or `__probe-*` file dropped into `tests/e2e` joins every
//      other run's whole set while it exists. The e2e config excludes them; a live `vitest list` proves it.
//
// Each scanner runs first over a planted positive, so a scanner that matches nothing reads red rather than
// reading the tree as clean.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const rel = (p) => relative(ROOT, p);

/** Every file under `dir` whose name passes `keep`, walked in a stable order. */
function walk(dir, keep) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, keep));
    else if (keep(e.name)) out.push(p);
  }
  return out;
}

/** The surfaces this law reads: the e2e set, its harness, and every witness script. */
function surfaces() {
  const ts = [...walk(join(ROOT, "tests", "e2e"), (n) => n.endsWith(".ts")), ...walk(join(ROOT, "tests", "harness"), (n) => n.endsWith(".ts"))];
  const sh = readdirSync(join(ROOT, "tools")).filter((n) => /witness.*\.sh$/.test(n)).sort().map((n) => join(ROOT, "tools", n));
  return { ts, sh };
}

// ── 1. LITERAL PORTS ────────────────────────────────────────────────────────────────────────────────────────

/** The lowest port an unprivileged run can bind. Below it, a literal names an address and never a seat. */
const FIRST_BINDABLE = 1024;
const PORT_FORMS = [
  /(?:127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1?\]):(\d+)/g,                           // an address with its port
  /(?:127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1?\]):\$\{(\d+)\}/g,                     // a template-literal address: `…:${8098}`
  // Any case, bare (`port`) or underscore-compound (`LAR_PORT` · `lar_port`) — never a bare substring match
  // (an English word like "support" or "export" carries no standalone "port" token, so it never qualifies).
  /\b(?:[A-Za-z]+_)?port(?:_[A-Za-z]+)?\b\s*[:=]\s*["'`]?(\d+)\b/gi,                  // PORT=8097 · port: 8231 · lar_port: "7000"
  /\b(?:[A-Za-z]+_)?port(?:_[A-Za-z]+)?\b\s*[:=]\s*String\(\s*(\d+)\s*\)/gi,          // PORT: String(8080)
  /--port[\s=]+["'`]?(\d+)/g,                                                         // --port 8080
  /["'`]--port["'`]\s*,\s*["'`]?(\d+)/g,                                              // "--port", "8080"
  /\.listen\(\s*(\d+)/g,                                                              // server.listen(8080)
];

/** Each literal, bindable port in `text`, with its line. A line that is a comment carries no seat. */
export function literalPorts(text) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    if (/^\s*(#|\/\/|\*|\/\*)/.test(line)) return;
    for (const form of PORT_FORMS) {
      for (const m of line.matchAll(form)) {
        if (Number(m[1]) >= FIRST_BINDABLE) hits.push({ line: i + 1, port: Number(m[1]), text: line.trim() });
      }
    }
  });
  return hits;
}

// ── 2. GATED VESSEL DOORS ───────────────────────────────────────────────────────────────────────────────────

/** The vessel sub-doors the CLI's freshness gate rebuilds for — read off the CLI's own two tables. */
export function gatedVesselSubs() {
  const vessel = readFileSync(join(ROOT, "packages/lares-cli/src/commands/vessel.ts"), "utf8");
  const table = /const SUBS\b[^=]*=\s*\{([\s\S]*?)\n\};/.exec(vessel)?.[1] ?? "";
  const subs = [...table.matchAll(/^\s{2}(\w+):\s*\{\s*summary/gm)].map((m) => m[1]);
  const gate = readFileSync(join(ROOT, "packages/lares-cli/src/build-freshness.ts"), "utf8");
  const never = new Set([...(/NEVER_STALE[^=]*=\s*new Set\(\[([^\]]*)\]/.exec(gate)?.[1] ?? "").matchAll(/"(\w+)"/g)].map((m) => m[1]));
  return subs.filter((s) => !never.has(s));
}

/** The array literal enclosing `at` in `text` — from its `[` to the matching `]`. */
function enclosingArray(text, at) {
  let depth = 0, start = -1;
  for (let i = at; i >= 0; i--) {
    if (text[i] === "]") depth++;
    else if (text[i] === "[") { if (depth === 0) { start = i; break; } depth--; }
  }
  if (start < 0) return text.slice(at, at + 200);
  depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "[") depth++;
    else if (text[i] === "]" && --depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
}

/** Local TS vars bound to one literal gated-door name: `const sub = "found";` — so `[…, sub]` is a door too. */
function gatedTsVarBindings(text, gated) {
  const map = new Map();
  const bind = new RegExp(`\\b(?:const|let|var)\\s+(\\w+)\\s*=\\s*["'\`](${gated.join("|")})["'\`]`, "g");
  for (const m of text.matchAll(bind)) map.set(m[1], m[2]);
  return map;
}

/** Every gated vessel door a TypeScript file invokes as an argv array without `--skip-build`. */
export function ungatedTs(text, gated) {
  const hits = [];
  const push = (index, snippet) =>
    hits.push({ line: text.slice(0, index).split("\n").length, text: snippet.replace(/\s+/g, " ").slice(0, 160) });

  // a literal second element: ["vessel", "found"]
  const door = new RegExp(`["'\`]vessel["'\`]\\s*,\\s*["'\`](${gated.join("|")})["'\`]`, "g");
  for (const m of text.matchAll(door)) {
    const argv = enclosingArray(text, m.index);
    if (!/["'`]--skip-build["'`]/.test(argv)) push(m.index, argv);
  }

  // a var bound to a literal gated name, substituted for the literal: `const sub = "found"; […, sub]`
  const bindings = gatedTsVarBindings(text, gated);
  if (bindings.size) {
    const varDoor = /["'`]vessel["'`]\s*,\s*(\w+)\b/g;
    for (const m of text.matchAll(varDoor)) {
      if (!bindings.has(m[1])) continue;
      const argv = enclosingArray(text, m.index);
      if (!/["'`]--skip-build["'`]/.test(argv)) push(m.index, argv);
    }
  }

  // a one-string argv split apart at runtime: `"vessel found".split(" ")`
  const splitDoor = new RegExp(`["'\`]vessel\\s+(${gated.join("|")})["'\`]\\s*\\.split\\(`, "g");
  for (const m of text.matchAll(splitDoor)) {
    const lineStart = text.lastIndexOf("\n", m.index) + 1;
    const lineEndAt = text.indexOf("\n", m.index);
    const line = text.slice(lineStart, lineEndAt < 0 ? text.length : lineEndAt);
    if (!/--skip-build/.test(line)) push(m.index, line);
  }

  return hits;
}

/** Shell vars bound to one literal gated-door name: `SUB=found` or `export SUB="found"`. */
function gatedShVarBindings(text, gated) {
  const map = new Map();
  const bind = new RegExp(`^\\s*(?:export\\s+)?(\\w+)=["']?(${gated.join("|")})["']?\\s*$`, "gm");
  for (const m of text.matchAll(bind)) map.set(m[1], m[2]);
  return map;
}

/** The raw line up to (but not including) a `#` that stands outside any quote — a trailing comment
 *  carries no bytes a shell ever runs, so a `--skip-build` written only there satisfies nothing. */
function stripTrailingComment(line) {
  let inSingle = false, inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle && line[i - 1] !== "\\") inDouble = !inDouble;
    else if (c === "#" && !inSingle && !inDouble) return line.slice(0, i);
  }
  return line;
}

/** Every gated vessel door a shell line runs without `--skip-build`. Comments and quoted prose carry no
 *  door; a `-c "…"` / `eval "…"` command string, and a `$VAR` substituted for a bound literal, both do. */
export function ungatedSh(text, gated) {
  const hits = [];
  const door = new RegExp(`\\bvessel\\s+(${gated.join("|")})\\b`);
  const varNames = [...gatedShVarBindings(text, gated).keys()];
  const varDoor = varNames.length ? new RegExp(`\\bvessel\\s+["']?\\$\\{?(${varNames.join("|")})\\}?["']?`) : null;

  text.split("\n").forEach((line, i) => {
    if (/^\s*#/.test(line)) return;
    const rawNoComment = stripTrailingComment(line);

    // a `-c "…"` / `eval "…"` command string really runs — scan its own contents like a shell line.
    const quotedCmds = [...rawNoComment.matchAll(/(?:-c|eval)\s+"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);

    // blank quoted PROSE spans — a door named in an echoed sentence carries no seat.
    const bare = rawNoComment.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'[^']*'/g, "''");

    const matched =
      (door.test(bare) && !/--skip-build\b/.test(bare)) ||
      (varDoor !== null && varDoor.test(rawNoComment) && !/--skip-build\b/.test(rawNoComment)) ||
      quotedCmds.some((c) => door.test(c) && !/--skip-build\b/.test(c));
    if (matched) hits.push({ line: i + 1, text: line.trim() });
  });
  return hits;
}

// ── THE KNOWN POSITIVES ─────────────────────────────────────────────────────────────────────────────────────

test("CONTROL: the port scanner reads each planted literal port, and lets an unbindable one stand", () => {
  const planted = [
    `env: { LAR_PORT: "8299" },`,
    `const PORT = 8231;`,
    `as_a() { ( export LAR_ROOT="$A_ROOT" LAR_PORT=8097; node x ); }`,
    `fetch("http://127.0.0.1:8098/x")`,
    `spawn(node, [main, "--port", "8080"])`,
    `srv.listen(4000)`,
  ].join("\n");
  assert.deepEqual(literalPorts(planted).map((h) => h.port), [8299, 8231, 8097, 8098, 8080, 4000]);
  assert.deepEqual(literalPorts(`LAR_PEERS: \`http://127.0.0.1:9/never-stands\`\nsrv.listen(0, "127.0.0.1")\nLAR_PORT: String(port)`), []);
  assert.deepEqual(literalPorts(`// a comment naming :8299 holds no seat`), []);
});

test("CONTROL: the port scanner also reads the lowercase, compound, templated and String()-wrapped forms", () => {
  const planted = [
    `openStaged({ port: 8299 })`,                        // the harness's own API — a lowercase object key
    `const port = 8231;`,                                 // a lowercase local, no LAR_ prefix
    `port: String(8080)`,                                 // a String()-wrapped literal
    "fetch(`http://127.0.0.1:${8098}/x`)",                // a template-literal address
    `srv.listen({ port: 9090 })`,                          // an object form to .listen
    `env: { lar_port: "7000" }`,                           // a lowercase, underscore-compound env key
  ].join("\n");
  assert.deepEqual(literalPorts(planted).map((h) => h.port), [8299, 8231, 8080, 8098, 9090, 7000]);
  // CONTROL: an English word that merely contains the substring "port" names no seat.
  assert.deepEqual(literalPorts(`support: 8080\nexport const transport = 8080;`), []);
});

test("CONTROL: the gated set is derived from the CLI's own tables, and names the founding and booting doors", () => {
  const gated = gatedVesselSubs();
  for (const door of ["found", "stand", "clear"]) assert.ok(gated.includes(door), `${door} missing from ${gated}`);
  for (const free of ["read", "stop"]) assert.ok(!gated.includes(free), `${free} is the gate's own exception`);
});

test("CONTROL: the door scanners read each planted bare door, and pass a gated one", () => {
  const gated = gatedVesselSubs();
  const ts = [
    `lares(["vessel", "found"]);`,                                           // 1
    `await cliB(["vessel", "found", "--admit", admit]);`,                    // 2
    `spawn(process.execPath, [CLI, "vessel", "stand",\n  "--json"])`,        // 3-4
    `cli(["vessel", "clear", "--root", root, "--force", "--skip-build"]);`,  // 5
    `lares(["vessel", "stop"]);`,                                            // 6
    `const sub = "found";`,                                                  // 7
    `cli(["vessel", sub]);`,                                                 // 8 — a var standing in for the literal
    `"vessel found".split(" ").forEach((x) => x);`,                         // 9 — a one-string argv split apart
  ].join("\n");
  assert.deepEqual(ungatedTs(ts, gated).map((h) => h.line), [1, 2, 3, 8, 9]);
  const sh = [
    `run_a "A founds"   vessel stand --install`,                  // 1
    `if ! LAR_ROOT="$TB" node "$REPO/bin/lares.mjs" vessel found >"$TB/init.log" 2>&1; then`, // 2
    `run_b "B founds"   vessel stand --install --skip-build`,     // 3
    `# lares vessel found resolves the true-name`,                // 4
    `say "① vessel stand — the Nexus founds"`,                    // 5
    `as_a vessel stop`,                                           // 6
    `bash -c "vessel found"`,                                     // 7 — a door inside a quoted bash -c
    `eval "vessel stand --install"`,                              // 8 — a door inside a quoted eval
    `SUB=found`,                                                   // 9 — a binding, not itself a door
    `vessel "$SUB"`,                                               // 10 — the bound var standing in for the literal
    `lares vessel found # --skip-build`,                          // 11 — a --skip-build a comment alone carries
  ].join("\n");
  assert.deepEqual(ungatedSh(sh, gated).map((h) => h.line), [1, 2, 7, 8, 10, 11]);
});

// ── THE LAW, OVER THE TREE ──────────────────────────────────────────────────────────────────────────────────

test("no e2e file, harness module or witness script binds a literal port", () => {
  const { ts, sh } = surfaces();
  assert.ok(ts.length > 20 && sh.length > 20, `the walk found ${ts.length} ts and ${sh.length} sh files — a silent zero`);
  const found = [...ts, ...sh].flatMap((f) => literalPorts(readFileSync(f, "utf8")).map((h) => `${rel(f)}:${h.line} :${h.port}  ${h.text}`));
  assert.deepEqual(found, [], `a literal port refuses a second copy of its own run — ask the OS (freePort / listen(0)):\n${found.join("\n")}`);
});

test("no e2e file, harness module or witness script opens a gated vessel door without --skip-build", () => {
  const gated = gatedVesselSubs();
  const { ts, sh } = surfaces();
  const found = [
    ...ts.flatMap((f) => ungatedTs(readFileSync(f, "utf8"), gated).map((h) => `${rel(f)}:${h.line}  ${h.text}`)),
    ...sh.flatMap((f) => ungatedSh(readFileSync(f, "utf8"), gated).map((h) => `${rel(f)}:${h.line}  ${h.text}`)),
  ];
  assert.deepEqual(found, [], `a gated door rebuilds the shared dist mid-run — pass --skip-build:\n${found.join("\n")}`);
});

// ── 3. SCRATCH PROBES ───────────────────────────────────────────────────────────────────────────────────────

test("the e2e config never collects a zz-* or __probe-* scratch file, and still collects an ordinary one", () => {
  // A scratch base outside the config's own `e2e/**` include, so no concurrent run of the real set meets it.
  const base = join(ROOT, "tests", `.scratch-harness-law-${process.pid}`);
  const body = `import { test } from "vitest";\ntest("probe", () => {});\n`;
  try {
    mkdirSync(join(base, "e2e"), { recursive: true });
    for (const name of ["kept-probe.test.ts", "zz-probe.test.ts", "__probe-x.test.ts"]) writeFileSync(join(base, "e2e", name), body);
    const r = spawnSync(join(ROOT, "tests", "node_modules", ".bin", "vitest"), ["list", "--dir", base, "--filesOnly"], {
      cwd: join(ROOT, "tests"), encoding: "utf8", timeout: 60_000, env: { ...process.env, LAR_E2E_RUN_DIR: join(base, "run") },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /kept-probe\.test\.ts/, `the ordinary file was not collected — the list measures nothing:\n${r.stdout}`);
    assert.doesNotMatch(r.stdout, /zz-probe|__probe-x/, `a scratch probe joins every run's whole set:\n${r.stdout}`);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
