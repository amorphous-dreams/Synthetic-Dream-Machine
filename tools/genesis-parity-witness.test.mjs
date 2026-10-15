/**
 * genesis-parity-witness.test.mjs — proves the INSTRUMENT over a fixture tree, never over the live one.
 *
 * The live tree may lawfully read red (a plugin change waiting for its bake) or declared, so no vector
 * here leans on it. Each fixture stands the three things the witness reads: the sources a bake packs
 * (an engine blob and the top-level plugin files), a seed naming one blob per source, and a CAS holding
 * each blob under its own sha256.
 *
 * Proven:
 *   · CONTROL: a genesis that carries the tree's bytes reads green and lists every artifact it compared;
 *     a `.json` nested under `plugins/standalone/` never counts as a packed file;
 *   · RED (the known positive): a planted drift in the grammar bundle, the boot shadows or the engine
 *     reads red, names the artifact with both addresses, and prints the one command that closes it;
 *   · DECLARED: a declaration naming the drifted source at its exact sha256 reads green and prints the
 *     gap and its reason in full;
 *   · RED: a declaration that names an earlier sha, one standing over a clean tree, and one with no
 *     reason each read red;
 *   · RED: a torn genesis (a missing CAS member, a member that fails its name, a stray member, a seed
 *     blob no source builds, a packed file the seed lacks) reads red, and no declaration covers it;
 *   · RED: an absent engine blob reads red, never skipped;
 *   · RED: a genesis file git does not track reads red inside a git tree.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const SCRIPT = join(ROOT, "tools", "genesis-parity-witness.sh");

const sha = (text) => createHash("sha256").update(text).digest("hex");

const CORE_NAME = "tiddlywikicore-9.9.9.js";
const GRAMMAR_ID = "lar:///t/plugins/grammar";
const GRAMMAR_PATH = "packages/lararium-tw5/plugins/grammar.json";
const SHADOWS_PATH = "packages/lararium-tw5/plugins/boot-shadows.json";
const CORE_PATH = `packages/lararium-tw5/tw5-core/${CORE_NAME}`;

const ENGINE = "/* the engine */\n";
const GRAMMAR = JSON.stringify({ title: GRAMMAR_ID, version: "0.0.1", text: "{\"tiddlers\":{}}" });
const SHADOWS = JSON.stringify([{ title: "a shadow" }]);

/** A git environment that reads no inherited repository (a hook's `GIT_DIR` would win discovery). */
function cleanEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const k of Object.keys(env)) if (k.startsWith("GIT_")) delete env[k];
  return env;
}

/**
 * Stand a tree whose genesis carries its sources, apply `plant` (a map of path to bytes, `null` removes
 * nothing and simply never writes), run the witness over it, and hand the run to `check`.
 */
async function withTree(plant, check, { git = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "genesis-parity-witness-"));
  const files = {
    "packages/lararium-tw5/src/generated-tw5-version.ts": `export const TW5_CORE_SCRIPT_FILENAME = "${CORE_NAME}";\n`,
    [CORE_PATH]: ENGINE,
    [GRAMMAR_PATH]: GRAMMAR,
    [SHADOWS_PATH]: SHADOWS,
    "packages/lararium-tw5/plugins/standalone/nested.json": JSON.stringify({ title: "lar:///t/never-packed" }),
    "genesis/seed.json": JSON.stringify({
      format: "lararium-genesis-seed/v1",
      blobs: {
        tiddlywikicore: { id: "tiddlywikicore", sha256: sha(ENGINE) },
        "boot-shadows": { id: "boot-shadows", sha256: sha(SHADOWS) },
        [GRAMMAR_ID]: { id: GRAMMAR_ID, sha256: sha(GRAMMAR) },
      },
    }),
    [`genesis/cas/${sha(ENGINE)}`]: ENGINE,
    [`genesis/cas/${sha(SHADOWS)}`]: SHADOWS,
    [`genesis/cas/${sha(GRAMMAR)}`]: GRAMMAR,
    ...plant,
  };
  try {
    for (const [path, body] of Object.entries(files)) {
      if (body === null) continue;
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), body);
    }
    if (git) {
      execFileSync("git", ["init", "-q", dir], { env: cleanEnv() });
      execFileSync("git", ["-C", dir, "add", "--", ...git], { env: cleanEnv() });
    }
    const run = spawnSync("bash", [SCRIPT], { cwd: ROOT, encoding: "utf8", env: { ...process.env, GENESIS_PARITY_ROOT: dir } });
    await check(run, run.stdout + run.stderr);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const declaration = (rows) => JSON.stringify({ format: "lararium-genesis-unbaked/v1", unbaked: rows });
const MOVED_GRAMMAR = JSON.stringify({ title: GRAMMAR_ID, version: "0.0.1", text: "{\"tiddlers\":{\"a cure\":{}}}" });

await test("CONTROL: a genesis that carries the tree's bytes reads green and lists what it compared", async () => {
  await withTree({}, (run, out) => {
    assert.equal(run.status, 0, out);
    assert.match(out, /3 source artifact\(s\) compared against 3 genesis blob\(s\)/);
    assert.match(out, new RegExp(`ok\\s+${GRAMMAR_ID}`));
    assert.match(out, /ok\s+boot-shadows/);
    assert.match(out, /ok\s+tiddlywikicore/);
    assert.match(out, /tracked-ness unread/);
    assert.doesNotMatch(out, /never-packed/);
  });
});

await test("RED: a planted drift in the grammar bundle names the artifact, both addresses and the closing command", async () => {
  await withTree({ [GRAMMAR_PATH]: MOVED_GRAMMAR }, (run, out) => {
    assert.equal(run.status, 1, out);
    assert.match(out, new RegExp(`DRIFT\\s+${GRAMMAR_ID}`));
    assert.ok(out.includes(sha(MOVED_GRAMMAR)), "the tree's address");
    assert.ok(out.includes(sha(GRAMMAR)), "the address genesis carries");
    assert.match(out, /pnpm --filter @lararium\/node build:genesis/);
    assert.match(out, /ok\s+tiddlywikicore/, "the artifacts that stand equal still read ok");
  });
});

await test("RED: a planted drift in the engine blob reads red by its own name", async () => {
  await withTree({ [CORE_PATH]: "/* another engine */\n" }, (run, out) => {
    assert.equal(run.status, 1, out);
    assert.match(out, /DRIFT\s+tiddlywikicore/);
    assert.doesNotMatch(out, new RegExp(`DRIFT\\s+${GRAMMAR_ID}`));
  });
});

await test("RED: a planted drift in the boot shadows reads red by its own name", async () => {
  await withTree({ [SHADOWS_PATH]: JSON.stringify([{ title: "another shadow" }]) }, (run, out) => {
    assert.equal(run.status, 1, out);
    assert.match(out, /DRIFT\s+boot-shadows/);
  });
});

await test("DECLARED: a row naming the drifted source at its exact sha reads green and prints the gap", async () => {
  const why = "the frameless-body cure; the next labelled bake carries it";
  await withTree({
    [GRAMMAR_PATH]: MOVED_GRAMMAR,
    "genesis/unbaked.json": declaration([{ source: GRAMMAR_PATH, sha256: sha(MOVED_GRAMMAR), why }]),
  }, (run, out) => {
    assert.equal(run.status, 0, out);
    assert.match(out, new RegExp(`DECLARED\\s+${GRAMMAR_ID}`));
    assert.ok(out.includes(why));
    assert.ok(out.includes(sha(MOVED_GRAMMAR)) && out.includes(sha(GRAMMAR)), "both addresses still print");
    assert.doesNotMatch(out, /\d RED:|DRIFT|STALE/);
  });
});

await test("RED: a row naming an earlier sha never covers a source that moved again", async () => {
  await withTree({
    [GRAMMAR_PATH]: MOVED_GRAMMAR,
    "genesis/unbaked.json": declaration([{ source: GRAMMAR_PATH, sha256: sha("an earlier bundle"), why: "an earlier gap" }]),
  }, (run, out) => {
    assert.equal(run.status, 1, out);
    assert.match(out, new RegExp(`DRIFT\\s+${GRAMMAR_ID}`));
    assert.match(out, /STALE DECLARATION/);
  });
});

await test("RED: a declaration standing over a genesis that carries the source reads stale", async () => {
  await withTree({
    "genesis/unbaked.json": declaration([{ source: GRAMMAR_PATH, sha256: sha(GRAMMAR), why: "a note a bake forgot to delete" }]),
  }, (run, out) => {
    assert.equal(run.status, 1, out);
    assert.match(out, /STALE DECLARATION/);
    assert.doesNotMatch(out, /DRIFT/);
  });
});

await test("RED: a row with no reason reads as no declaration, and the drift stays red", async () => {
  await withTree({
    [GRAMMAR_PATH]: MOVED_GRAMMAR,
    "genesis/unbaked.json": JSON.stringify({ format: "lararium-genesis-unbaked/v1", unbaked: [{ source: GRAMMAR_PATH, sha256: sha(MOVED_GRAMMAR) }] }),
  }, (run, out) => {
    assert.equal(run.status, 1, out);
    assert.match(out, /does not read as a declaration/);
    assert.match(out, new RegExp(`DRIFT\\s+${GRAMMAR_ID}`));
  });
});

await test("RED: a CAS that lacks a blob the seed names reads red", async () => {
  await withTree({ [`genesis/cas/${sha(GRAMMAR)}`]: null }, (run, out) => {
    assert.equal(run.status, 1, out);
    assert.match(out, new RegExp(`CAS\\s+genesis/cas holds no member ${sha(GRAMMAR)}`));
  });
});

await test("RED: a CAS member that fails its own name reads red", async () => {
  await withTree({ [`genesis/cas/${sha(GRAMMAR)}`]: "other bytes" }, (run, out) => {
    assert.equal(run.status, 1, out);
    assert.match(out, /does not hash to its own name/);
  });
});

await test("RED: a superseded blob left in the CAS reads red, and a declaration never covers it", async () => {
  await withTree({
    [`genesis/cas/${sha("superseded")}`]: "superseded",
    "genesis/unbaked.json": declaration([{ source: `genesis/cas/${sha("superseded")}`, sha256: sha("superseded"), why: "kept on purpose" }]),
  }, (run, out) => {
    assert.equal(run.status, 1, out);
    assert.match(out, new RegExp(`CAS\\s+genesis/cas/${sha("superseded")} stands and the seed names no such blob`));
  });
});

await test("RED: a packed file the seed lacks, and a seed blob no source builds, each read red", async () => {
  await withTree({ "packages/lararium-tw5/plugins/extra.json": JSON.stringify({ title: "lar:///t/plugins/extra" }) }, (run, out) => {
    assert.equal(run.status, 1, out);
    assert.match(out, /DRIFT\s+lar:\/\/\/t\/plugins\/extra/);
    assert.match(out, /genesis names no such blob/);
  });
  await withTree({ [SHADOWS_PATH]: null }, (run, out) => {
    assert.equal(run.status, 1, out);
    assert.match(out, /NO SOURCE\s+genesis names blob "boot-shadows"/);
  });
});

await test("RED: an absent engine blob reads red, never skipped", async () => {
  await withTree({ [CORE_PATH]: null }, (run, out) => {
    assert.equal(run.status, 1, out);
    assert.match(out, /UNREAD\s+the engine blob/);
    assert.match(out, /build:tw5-vendor/);
  });
});

await test("RED: a genesis file git does not track reads red inside a git tree; CONTROL: all tracked reads green", async () => {
  const cas = [sha(ENGINE), sha(SHADOWS), sha(GRAMMAR)].map((s) => `genesis/cas/${s}`);
  await withTree({}, (run, out) => {
    assert.equal(run.status, 0, out);
    assert.match(out, /git tracks all 4 genesis file\(s\)/);
  }, { git: ["genesis/seed.json", ...cas] });
  await withTree({}, (run, out) => {
    assert.equal(run.status, 1, out);
    assert.match(out, new RegExp(`UNTRACKED\\s+genesis/cas/${sha(GRAMMAR)}`));
  }, { git: ["genesis/seed.json", cas[0], cas[1]] });
});
