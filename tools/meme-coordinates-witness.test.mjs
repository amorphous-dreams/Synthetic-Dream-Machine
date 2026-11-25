/**
 * meme-coordinates-witness can fail — planted reds over both disk homes a carrier rests in.
 *
 * Each case plants a scratch corpus (`bags/` and `wikis/`) and sweeps it through the witness with `REPO` pointed at it; the
 * shore (`tools/carrier-head.mjs` and the memetic-frame dist) loads from this checkout, as the real run loads it.
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const WITNESS = join(ROOT, "tools/meme-coordinates-witness.sh");
// The declaration is the writer's own constant, never a second literal (type-parity reads a spelled one as a fork).
const { CARRIER_DECLARATION } = await import(join(ROOT, "packages/lararium-memetic-frame/dist/index.js"));

/** A carrier whose head sigil names `address` and whose meta declares `uriPath`. */
function carrier(address, uriPath) {
  return `${CARRIER_DECLARATION}\n\n<<^ code=\`&#x0001;\` from=\`?\` to=\`lar:///${address}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "${uriPath}"\n\`\`\`\n\nbody\n`;
}

/** Sweep a scratch corpus holding `files` ({ path: text }). */
function sweep(files) {
  const repo = mkdtempSync(join(tmpdir(), "meme-coordinates-"));
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

const BAG = "bags/sample/ha.ka.ba/sample/a.mem";
const WIKI = "wikis/workshop/ha.ka.ba/lares/docs/history/workshop/b.mem";

await test("CONTROL: agreeing coordinates in a bag and a wiki read green, counting both", () => {
  const run = sweep({ [BAG]: carrier("ha.ka.ba/sample/a", "ha.ka.ba/sample/a"), [WIKI]: carrier("ha.ka.ba/lares/docs/history/workshop/b", "ha.ka.ba/lares/docs/history/workshop/b") });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /2 carriers · 2 declare uri-path/);
});

await test("a wiki home's carrier enters the walk: a drifted uri-path under wikis/ reads red, by file", () => {
  const run = sweep({ [BAG]: carrier("ha.ka.ba/sample/a", "ha.ka.ba/sample/a"), [WIKI]: carrier("ha.ka.ba/lares/docs/history/workshop/b", "ha.ka.ba/lares/docs/history/elsewhere") });
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stdout, new RegExp(WIKI.replace(/\./g, "\\.")));
});

await test("a drifted uri-path under bags/ still reads red", () => {
  const run = sweep({ [BAG]: carrier("ha.ka.ba/sample/a", "ha.ka.ba/sample/z") });
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stdout, new RegExp(BAG.replace(/\./g, "\\.")));
});
