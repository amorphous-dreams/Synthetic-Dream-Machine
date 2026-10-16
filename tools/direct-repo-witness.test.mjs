/**
 * direct-repo-witness.test.mjs — proves the INSTRUMENT, over a fixture tree the real repo's own churn never
 * touches (never the live source, so this witness's self-test reads a fixed fixture).
 *
 * Proven:
 *   · CONTROL: a fixture with exactly the two lawful sites (named like the real files, comments stripped of
 *     a docblock that NAMES `new Repo(` to explain why a third one would be wrong) reads green;
 *   · RED: a THIRD site (a planted `new Repo(` in a new command file) reads red, naming the drift and never
 *     mistaking it for one of the two lawful ones;
 *   · RED: a lawful file carrying a SECOND site of its own (two Repos where one is owed) reads red;
 *   · RED: a lawful file missing its site entirely reads red, naming which one.
 */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const SCRIPT = join(ROOT, "tools", "direct-repo-witness.sh");

const VESSEL_BODY = `
/** The standing vessel's own Repo — opened once at boot, held for the vessel's whole life. */
export function openVessel() {
  const repo = new Repo({ storage: new NodeFSStorageAdapter("x") });
  return repo;
}
`;

const OWNED_STORE_BODY = `
/** The direct holder's Repo (\`ownedStore\`) — one act, no vessel standing. A docblock may NAME the shape
 *  \`new Repo(\` elsewhere to explain why a THIRD site would be wrong; stripped comments never count it here. */
export async function ownedStore(storageDir, act) {
  const repo = new Repo({ storage });
  return act(repo);
}
`;

async function withFixture(extraFiles, check) {
  const dir = await mkdtemp(join(tmpdir(), "direct-repo-witness-"));
  const src = join(dir, "packages", "lararium-node", "src");
  await mkdir(src, { recursive: true });
  try {
    await writeFile(join(src, "open-node-vessel.ts"), VESSEL_BODY);
    await writeFile(join(src, "owned-store.ts"), OWNED_STORE_BODY);
    for (const [name, body] of Object.entries(extraFiles)) {
      const dest = join(src, name);
      await mkdir(resolve(dest, ".."), { recursive: true });
      await writeFile(dest, body);
    }
    const run = spawnSync("bash", [SCRIPT], {
      cwd: ROOT, encoding: "utf8",
      env: { ...process.env, DIRECT_REPO_ROOT: dir },
    });
    await check(run);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

await test("CONTROL: exactly the two lawful sites reads green", async () => {
  await withFixture({}, (run) => {
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /ok\s+lararium-node\/src\/open-node-vessel\.ts/);
    assert.match(run.stdout, /ok\s+lararium-node\/src\/owned-store\.ts/);
    assert.match(run.stdout, /^\[direct-repo\] 2 `new Repo\(` site\(s\)/m);
  });
});

await test("RED: a third site (a new command opening its own Repo) reads red, naming the drift", async () => {
  await withFixture({
    "commands/some-new-door.ts": `
export async function runSomeNewDoor() {
  const repo = new Repo({ storage: new NodeFSStorageAdapter("y") });
  return repo;
}
`,
  }, (run) => {
    assert.notEqual(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /DRIFT\s+lararium-node\/src\/commands\/some-new-door\.ts/);
    assert.match(run.stdout, /ok\s+lararium-node\/src\/open-node-vessel\.ts/);   // the two lawful sites still read clean
    assert.match(run.stdout, /ok\s+lararium-node\/src\/owned-store\.ts/);
  });
});

await test("RED: a lawful file carrying a SECOND Repo of its own reads red", async () => {
  const dir = await mkdtemp(join(tmpdir(), "direct-repo-witness-"));
  const src = join(dir, "packages", "lararium-node", "src");
  await mkdir(src, { recursive: true });
  try {
    await writeFile(join(src, "open-node-vessel.ts"), VESSEL_BODY + "\nconst again = new Repo({ storage: s });\n");
    await writeFile(join(src, "owned-store.ts"), OWNED_STORE_BODY);
    const run = spawnSync("bash", [SCRIPT], { cwd: ROOT, encoding: "utf8", env: { ...process.env, DIRECT_REPO_ROOT: dir } });
    assert.notEqual(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /DRIFT\s+lararium-node\/src\/open-node-vessel\.ts carries 2 sites/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

await test("RED: a lawful site missing entirely is named, not silently averaged away", async () => {
  const dir = await mkdtemp(join(tmpdir(), "direct-repo-witness-"));
  const src = join(dir, "packages", "lararium-node", "src");
  await mkdir(src, { recursive: true });
  try {
    await writeFile(join(src, "owned-store.ts"), OWNED_STORE_BODY);   // open-node-vessel.ts absent entirely
    const run = spawnSync("bash", [SCRIPT], { cwd: ROOT, encoding: "utf8", env: { ...process.env, DIRECT_REPO_ROOT: dir } });
    assert.notEqual(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /MISSING\s+lararium-node\/src\/open-node-vessel\.ts/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

await test("a commented-out `new Repo(` (a docblock explaining the law) never counts as a site", async () => {
  await withFixture({
    "commands/docs-only.ts": `
/**
 * This door used to write \`const repo = new Repo({ storage })\` directly — retired; it now takes the
 * held Repo as a dependency instead, per the one-holder law.
 */
export function runDocsOnly() { return null; }
`,
  }, (run) => {
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.doesNotMatch(run.stdout, /docs-only/);
  });
});

await test("RED (L3): an aliased `Repo` import still counts as a site — `import { Repo as R }` then `new R(`", async () => {
  await withFixture({
    "commands/aliased-door.ts": `
import { Repo as R } from "@automerge/automerge-repo";
export async function runAliasedDoor() {
  const repo = new R({ storage: new NodeFSStorageAdapter("z") });
  return repo;
}
`,
  }, (run) => {
    assert.notEqual(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /DRIFT\s+lararium-node\/src\/commands\/aliased-door\.ts/);
  });
});

await test("RED (L3): a `new Repo(` planted in packages/lares-cli/src is no longer a blind spot", async () => {
  const dir = await mkdtemp(join(tmpdir(), "direct-repo-witness-"));
  const nodeSrc = join(dir, "packages", "lararium-node", "src");
  const cliSrc = join(dir, "packages", "lares-cli", "src");
  await mkdir(nodeSrc, { recursive: true });
  await mkdir(join(cliSrc, "commands"), { recursive: true });
  try {
    await writeFile(join(nodeSrc, "open-node-vessel.ts"), VESSEL_BODY);
    await writeFile(join(nodeSrc, "owned-store.ts"), OWNED_STORE_BODY);
    await writeFile(join(cliSrc, "commands", "some-cli-door.ts"), `
export async function runSomeCliDoor() {
  const repo = new Repo({ storage: new NodeFSStorageAdapter("w") });
  return repo;
}
`);
    const run = spawnSync("bash", [SCRIPT], { cwd: ROOT, encoding: "utf8", env: { ...process.env, DIRECT_REPO_ROOT: dir } });
    assert.notEqual(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /DRIFT\s+lares-cli\/src\/commands\/some-cli-door\.ts/);
    assert.match(run.stdout, /ok\s+lararium-node\/src\/open-node-vessel\.ts/);
    assert.match(run.stdout, /ok\s+lararium-node\/src\/owned-store\.ts/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
