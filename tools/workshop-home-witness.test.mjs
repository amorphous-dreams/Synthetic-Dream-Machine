/**
 * workshop-home-witness can fail — every red it owes, planted in a scratch corpus, and the control that keeps a green honest.
 *
 * Each case writes a scratch tree (`wikis/workshop/…`, a manifest, and any `bags/` neighbour) and sweeps it with `REPO`
 * pointed at it; the shore (`tools/carrier-head.mjs` and the memetic-frame dist) loads from this checkout.
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const WITNESS = join(ROOT, "tools/workshop-home-witness.sh");
// The declaration is the writer's own constant, never a second literal (type-parity reads a spelled one as a fork).
const { CARRIER_DECLARATION } = await import(join(ROOT, "packages/lararium-memetic-frame/dist/index.js"));

const SHELF = "ha.ka.ba/lares/docs/history/workshop";
const HOME = `wikis/workshop/${SHELF}`;
const MANIFEST = "tools/workshop-home.manifest";

/** A carrier whose head sigil names `address` and whose meta carries `title`. */
function carrier(address, title = address) {
  return `${CARRIER_DECLARATION}\n\n<<^ code=\`&#x0001;\` from=\`?\` to=\`${address}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\ntitle = "${title}"\n\`\`\`\n\nbody\n`;
}

function sweep(files) {
  const repo = mkdtempSync(join(tmpdir(), "workshop-home-"));
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(repo, path)), { recursive: true });
      writeFileSync(join(repo, path), text);
    }
    return spawnSync("bash", [WITNESS], { cwd: ROOT, encoding: "utf8", env: { ...process.env, REPO: repo } });
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

const A = `lar:///${SHELF}/a`;
const B = `lar:///${SHELF}/sub/b`;
const good = () => ({
  [`${HOME}/a.mem`]: carrier(A),
  [`${HOME}/sub/b.mem`]: carrier(B),
  [MANIFEST]: "# comment lines and blanks never count\n\na\nsub/b\n",
});

await test("CONTROL: two carriers at their own addresses, both in the manifest, read green with the count", () => {
  const run = sweep(good());
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /2 carrier\(s\) · manifest 2 · 0 red/);
});

await test("a carrier whose head names another address reads red, by file", () => {
  const run = sweep({ ...good(), [`${HOME}/a.mem`]: carrier(`lar:///${SHELF}/elsewhere`) });
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stdout, /ADDRESS  wikis\/workshop\/.*\/a\.mem/);
});

await test("a carrier whose meta title drifts from its address reads red", () => {
  const run = sweep({ ...good(), [`${HOME}/a.mem`]: carrier(A, `lar:///${SHELF}/other`) });
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stdout, /TITLE    wikis\/workshop\/.*\/a\.mem/);
});

await test("a carrier on disk the manifest never names, and a manifest row with no carrier, each read red", () => {
  const extra = sweep({ ...good(), [`${HOME}/c.mem`]: carrier(`lar:///${SHELF}/c`) });
  assert.equal(extra.status, 1, extra.stdout + extra.stderr);
  assert.match(extra.stdout, /UNLISTED .*c\.mem/);
  const missing = sweep({ ...good(), [MANIFEST]: "a\nsub/b\ngone\n" });
  assert.equal(missing.status, 1, missing.stdout + missing.stderr);
  assert.match(missing.stdout, /MISSING  gone/);
});

await test("a workshop address that also stands in another home reads red, naming both", () => {
  const run = sweep({ ...good(), [`bags/lares/${SHELF}/a.mem`]: carrier(A) });
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stdout, /TWO-HOME .*a\.mem.*bags\/lares\//);
});

await test("a tree with no manifest refuses rather than reading green", () => {
  const files = good();
  delete files[MANIFEST];
  const run = sweep(files);
  assert.equal(run.status, 2, run.stdout + run.stderr);
  assert.match(run.stderr, /no manifest/);
});
