// retired-names-witness.test.mjs — the witness reads every burned name, in code and comment alike, across the trees
// it owns; it skips only the guard lists; and it lists a canon meme's line without failing on it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { RETIRED, SKIP, codeFiles, memeFiles, readTree, sitesInText } from "./retired-names-witness.mjs";

const TOOL = join(dirname(fileURLToPath(import.meta.url)), "retired-names-witness.mjs");

/** A sample line that speaks each burned name. */
const sample = (name) => name === "LAR_JOIN_*" ? "no `LAR_JOIN_*` rides" : name.startsWith("LAR_") ? `export ${name}=x` : name.startsWith("?") ? `location${name}ab` : `x(${name});`;

test("RED: every burned name reads as a site in code and in a comment", () => {
  for (const { name } of RETIRED) {
    assert.deepEqual(sitesInText(sample(name)).map((s) => s.name), [name], name);
    assert.deepEqual(sitesInText(`// ${name}\n/* ${name} */`).map((s) => s.line), [1, 2], name);
  }
  assert.deepEqual(sitesInText('env: { LAR_B_JOIN_GATE: "k", LAR_JOIN_DOC: "d" }').map((s) => s.name), ["LAR_JOIN_GATE", "LAR_JOIN_DOC"]);
  assert.deepEqual(sitesInText('send({ type: "lar:auth-ok" })').map((s) => s.name), ["auth-ok"]);
  assert.deepEqual(sitesInText("/?relay=ws://h/ws&gate=ab").map((s) => s.name), ["?gate="]);
});

test("CONTROL: a name that only contains a burned one reads clean", () => {
  for (const line of [
    "knockPathFor(x); myknockedUrl(); relayGatePubKeys", "presentationKeys(); representWalker()", "oauth-ok auth-okay sub-auth-proof-x",
    "LAR_JOIN_GATEWAY=1", "WSMembershipChannelish", "const gate = q.get(\"floor\");", "lar:session", "verifyPeers()",
  ]) assert.deepEqual(sitesInText(line), [], line);
});

function plant(files) {
  const root = mkdtempSync(join(tmpdir(), "retired-names-"));
  for (const [rel, text] of Object.entries(files)) { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); }
  return root;
}

test("the reading covers src, tests, tests/, tools/, .github/ and compose files, skips the guard lists, and lists memes outside api/pono", () => {
  const root = plant({
    "packages/a/src/m.ts": "export const ok = 1;\nimport { knockPath } from './k.js';\n",
    "packages/a/tests/.dot.test.ts": "// DaemonAuthGate\n",
    "packages/a/probes/p.ts": "knockPath();\n",
    "packages/a/node_modules/x/i.js": "knockPath();\n",
    "packages/a/dist/i.js": "knockPath();\n",
    "tests/harness/h.ts": "env.LAR_JOIN_DOC = u;\n",
    "tools/t.sh": "LAR_B_JOIN_SYNC=1 up\n",
    ".github/workflows/w.yml": "run: echo '?gate=ab'\n",
    "docker-compose.mesh.yml": "LAR_JOIN_GATE: k\n",
    "docs/d.md": "knockPath\n",
    [SKIP[0]]: "DaemonAuthGate\n",
    "bags/lararium/ha.ka.ba/lararium/node/x.mem": "a\nthe vessel reads LAR_JOIN_GATE\n",
    "bags/lares/ha.ka.ba/lares/api/pono/y.mem": "LAR_JOIN_GATE\n",
  });
  try {
    assert.ok(!codeFiles(root).includes(SKIP[0]));
    assert.deepEqual(memeFiles(root), ["bags/lararium/ha.ka.ba/lararium/node/x.mem"]);
    const r = readTree(root);
    assert.deepEqual(r.code.map((s) => `${s.file}:${s.line} ${s.name}`), [
      ".github/workflows/w.yml:1 ?gate=",
      "docker-compose.mesh.yml:1 LAR_JOIN_GATE",
      "packages/a/src/m.ts:2 knockPath",
      "packages/a/tests/.dot.test.ts:1 DaemonAuthGate",
      "tests/harness/h.ts:1 LAR_JOIN_DOC",
      "tools/t.sh:1 LAR_JOIN_SYNC",
    ]);
    assert.deepEqual(r.memes.map((s) => `${s.file}:${s.line} ${s.name}`), ["bags/lararium/ha.ka.ba/lararium/node/x.mem:2 LAR_JOIN_GATE"]);

    const red = spawnSync("node", [TOOL, "--root", root], { encoding: "utf8" });
    assert.equal(red.status, 1, red.stderr);
    assert.match(red.stdout, /^RETIRED packages\/a\/src\/m\.ts:2 knockPath$/m);
    assert.match(red.stdout, /^CANON-MEME bags\/lararium\/ha\.ka\.ba\/lararium\/node\/x\.mem:2 LAR_JOIN_GATE$/m);
    assert.match(red.stdout, /RETIRED-NAMES: ok=false files=\d+ sites=6 owners=6 canon-meme=1/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a tree whose only hits are memes reads green, and a root with nothing to read refuses", () => {
  const green = plant({ "packages/a/src/m.ts": "export const ok = 1;\n", "bags/l/x.mem": "LAR_JOIN_GATE\n" });
  const empty = mkdtempSync(join(tmpdir(), "retired-names-empty-"));
  try {
    const r = spawnSync("node", [TOOL, "--root", green], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /RETIRED-NAMES: ok=true files=1 sites=0 owners=0 canon-meme=1/);
    assert.equal(spawnSync("node", [TOOL, "--root", empty], { encoding: "utf8" }).status, 2);
  } finally { rmSync(green, { recursive: true, force: true }); rmSync(empty, { recursive: true, force: true }); }
});
