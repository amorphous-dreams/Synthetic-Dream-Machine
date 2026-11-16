// house-keep — the keep rite over two real houses: what `lares rite keep` lays into a bound workspace, a brand-new house imports.
//
//   H1  a standing scratch house holds memory in its steward's daemon wiki, and a clone of a scratch git repo stands bound as
//       its workspace `backup`. With no keep lei the rite refuses by the lei's own name and the workspace holds nothing new.
//   H2  the hand strings a keep lei of two returns for that workspace; the vessel half (`rite keep-cut`) cuts a cleartext
//       bundle into `<workspace>/house`, one return spends, and the wake's conferre reads the tessera red (`landed-absent`):
//       cut, never pushed. A second cut over unchanged memory spends nothing.
//   H3  the host half (`rite keep`, git on the host): a workspace with no `* -text` guard refuses, and so does one with a change
//       outside `house/`; with the remote broken the rite commits, the push fails, the tessera stays `landed-absent` and the
//       answer names the cure; the remote mended, the rite run again pushes what waits and lands the tessera at the bundle id
//       the pushed manifest names, and conferre reads it par. A keep after that commits nothing and spends nothing.
//   H4  THE RESTORE DRILL: the exporting house goes down; a brand-new scratch house founds under the same pet-name, imports the
//       bundle out of a FRESH CLONE of the remote, and `carry-parity` reads par against the census taken before the down. A
//       clone with one byte flipped refuses first (`bundle-hash-mismatch`), and nothing of it lands.
//
// Each house stands under its own marked scratch LAR_ROOT through the test custody doors; no LAR_BAGS, no docker, and the
// only remote a bare repo under the scratch dir.
import "./test-ward-env.mjs";   // the CLI processes this test spawns take the harness's explicit routes
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { unlockTestCustody } from "./unlock-test-custody.mjs";
import { daemonStood } from "./daemon-stood.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = join(repo, "packages/lares-cli/dist/src/bin/lares.js");
const nodeMain = join(repo, "packages/lararium-node/dist/src/main.js");
const tool = join(repo, "tools/carry-parity.mjs");

const freePort = () => new Promise((resolve) => {
  const s = createServer();
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

/** One scratch house: a marked root, the test custody seeded, founded under `name`, standing and unlocked. */
async function standHouse(tag, name) {
  const root = mkdtempSync(join(tmpdir(), `lares-house-keep-${tag}-`));
  for (const script of ["test-scratch-marker.mjs", "seed-test-custody.mjs"]) {
    const r = spawnSync(process.execPath, [join(repo, "tools", script), root], { encoding: "utf8", env: { ...process.env, LAR_ROOT: root } });
    assert.equal(r.status, 0, `${script}: ${r.stderr}`);
  }
  cpSync(join(repo, "genesis"), join(root, "genesis"), { recursive: true });
  const port = await freePort();
  const env = { ...process.env, LAR_ROOT: root, LAR_PORT: String(port), LAR_SAME_ORIGIN: "true" };
  const lares = (args) => spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: "utf8", env });
  const found = lares(["vessel", "found", "--hearth", "--name", name, "--root", root, "--skip-build"]);
  assert.equal(found.status, 0, `found ${tag}: ${found.stdout}${found.stderr}`);
  const child = spawn(process.execPath, [nodeMain, "--root", root, "--port", String(port)], { cwd: join(repo, "packages/lararium-node"), env });
  let log = "";
  child.stdout.on("data", (d) => { log += String(d); });
  child.stderr.on("data", (d) => { log += String(d); });
  await new Promise((resolve, reject) => {
    const poll = setInterval(() => {
      if (daemonStood(log)) { clearInterval(poll); resolve(); }
      else if (child.exitCode !== null) { clearInterval(poll); reject(new Error(`${tag} daemon exited ${child.exitCode} before live:\n${log.slice(-3000)}`)); }
    }, 200);
  });
  const a = await unlockTestCustody(root, "unlock", 0);
  assert.ok(a?.held === true || a?.reading === "opens" || a?.reading === "already-unlocked", `${tag} unlock: ${JSON.stringify(a)}`);
  const stop = () => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
  });
  const must = (args) => { const r = lares(args); assert.equal(r.status, 0, `${tag}: lares ${args.join(" ")}\n${r.stdout}\n${r.stderr}`); return r; };
  /** The last JSON line a `--json` call printed. */
  const answer = (r) => { try { return JSON.parse(r.stdout.trim().split("\n").pop()); } catch { assert.fail(`no JSON answer:\n${r.stdout}\n${r.stderr}`); } };
  return { root, port, lares, must, answer, stop, log: () => log };
}

const memeText = (uri, body, meta = "") => {
  const path = uri.slice("lar:///".length);
  return `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "${path}"\n${meta}\`\`\`\n\n! ${path.split("/").pop()}\n\n${body}\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;
};
const HERON = "lar:///ha.ka.ba/kahua/memory/state/heron";
const POND = "lar:///ha.ka.ba/kahua/memory/reference/pond";
const KITE = "lar:///ha.ka.ba/kahua/memory/feedback/kite";
const FREE = "plain note";

/** git in one directory, clear of any hook's own git env, under a scratch identity. */
const git = (dir, ...args) => {
  const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
  for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE"]) delete env[k];
  const r = spawnSync("git", ["-C", dir, "-c", "user.name=Keeper", "-c", "user.email=keeper@example.invalid", "-c", "init.defaultBranch=main", "-c", "commit.gpgsign=false", ...args], { encoding: "utf8", env });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};

test("the keep rite lays a bundle into a bound workspace under a lei, and a brand-new house imports it out of a fresh clone to par", { timeout: 900_000 }, async () => {
  const scratch = mkdtempSync(join(tmpdir(), "lares-house-keep-files-"));
  const houses = [];
  // The host half's git (in the CLI the test spawns) commits under a scratch identity, never the operator's own config.
  const gitConfig = join(scratch, "gitconfig");
  writeFileSync(gitConfig, "[user]\n\tname = Keeper\n\temail = keeper@example.invalid\n[init]\n\tdefaultBranch = main\n[commit]\n\tgpgsign = false\n");
  const priorGit = { global: process.env.GIT_CONFIG_GLOBAL, system: process.env.GIT_CONFIG_SYSTEM };
  process.env.GIT_CONFIG_GLOBAL = gitConfig;
  process.env.GIT_CONFIG_SYSTEM = "/dev/null";
  try {
    const old = await standHouse("old", "steward");
    houses.push(old);
    for (const [uri, body, meta] of [[HERON, "remember the heron", `tags = "stage/index"\ndescription = "the heron"\n`], [POND, "the pond at dusk", ""], [KITE, "fly the kite low", ""]]) {
      const file = join(scratch, `${uri.split("/").pop()}.mem`);
      writeFileSync(file, memeText(uri, body, meta));
      old.must(["meme", "put", uri, "--recipe", "default", "--file", file, "--json"]);
    }
    old.must(["tiddler", "put", FREE, "--recipe", "default", "--text", "a free-titled note", "--json"]);

    // ── THE WORKSPACE: a clone of the operator's repo (here a bare scratch remote), bound under the house's workspaces ──
    const remote = join(scratch, "remote.git");
    mkdirSync(remote);
    git(remote, "init", "-q", "--bare");
    const workspace = join(old.root, "workspaces", "backup");
    mkdirSync(join(old.root, "workspaces"), { recursive: true });
    git(scratch, "clone", "-q", remote, workspace);
    const held = () => readdirSync(workspace).sort();

    // ── H1: no lei, no keep ─────────────────────────────────────────────────────────────────────────────────────
    const bare = old.lares(["rite", "keep-cut", "--workspace", "backup", "--json"]);
    assert.notEqual(bare.status, 0, bare.stdout);
    assert.equal(old.answer(bare).error?.code, "swarm-lei-absent", bare.stdout);
    assert.deepEqual(held(), [".git"], "a refused keep leaves the workspace as it stood");
    const line = (rite) => old.answer(old.must(["lei", "show", "--rite", rite, "--branch", "backup", "--json"])).data.lei;

    // ── H2: the hand strings the lei; the keep spends one return ────────────────────────────────────────────────
    const strung = old.lares(["lei", "kui", "--rite", "keep", "--branch", "backup", "--returns", "2", "--json"]);
    assert.equal(strung.status, 0, `lei kui: ${strung.stdout}${strung.stderr}`);
    assert.deepEqual({ standing: line("keep").standing, returnsLeft: line("keep").returnsLeft }, { standing: true, returnsLeft: 2 });
    assert.equal(line("push").standing, false, "the keep lei stands for no push");
    const kept = old.answer(old.must(["rite", "keep-cut", "--workspace", "backup", "--json"])).data;
    assert.equal(kept.kept, true, JSON.stringify(kept));
    assert.equal(kept.dest, join(workspace, "house"));
    assert.deepEqual(kept.faces, ["steward"]);
    assert.deepEqual(held(), [".git", "house"]);
    const manifest = JSON.parse(readFileSync(join(workspace, "house", "manifest.json"), "utf8"));
    assert.equal(manifest.bundleId, kept.bundleId);
    assert.equal(manifest.schema, "lar-carry/1");
    assert.ok(manifest.files.some((f) => f.path.endsWith("heron.mem") || f.path.endsWith("heron.tid")), "the bundle carries the memory as a plain file a person reads");
    assert.equal(line("keep").returnsLeft, 1, "one return spent");
    const red = old.answer(old.must(["rite", "receipts", "--json"])).data.conferre;
    assert.deepEqual(red.red.map((t) => `${t.rite} ${t.tessera} ${t.red}`), [`keep ${kept.tessera} landed-absent`], "cut and not yet pushed reads red by name");
    // Unchanged memory: the standing bundle answers, and nothing spends.
    const again = old.answer(old.must(["rite", "keep-cut", "--workspace", "backup", "--json"])).data;
    assert.deepEqual({ kept: again.kept, standing: again.standing, bundleId: again.bundleId }, { kept: false, standing: true, bundleId: kept.bundleId });
    assert.equal(line("keep").returnsLeft, 1, "an unchanged keep spends nothing");

    // ── H3: the host half: guard, commit, push, land ────────────────────────────────────────────────────────────
    const keep = () => old.lares(["rite", "keep", "--workspace", "backup", "--json"]);
    const refusalOf = (r) => { assert.notEqual(r.status, 0, r.stdout); return old.answer(r).error?.code; };
    const redNow = () => old.answer(old.must(["rite", "receipts", "--json"])).data.conferre.red.map((t) => `${t.rite} ${t.tessera} ${t.red}`);
    assert.equal(refusalOf(keep()), "keep-text-guard-absent", "a workspace whose bundle could take a line-ending rewrite refuses");
    writeFileSync(join(workspace, ".gitattributes"), "* -text\n");
    git(workspace, "add", ".gitattributes");
    git(workspace, "commit", "-q", "-m", "guard");
    assert.equal(git(workspace, "symbolic-ref", "--short", "HEAD"), "main");
    writeFileSync(join(workspace, "stray.txt"), "the operator's own note\n");
    assert.equal(refusalOf(keep()), "keep-tree-unclean", "a change outside house/ refuses");
    rmSync(join(workspace, "stray.txt"));
    git(workspace, "remote", "set-url", "origin", join(scratch, "nowhere.git"));
    const broken = keep();
    assert.equal(refusalOf(broken), "keep-push-refused");
    assert.match(old.answer(broken).error.message, /lares rite keep --workspace backup/, "the failed push names the cure");
    assert.equal(git(workspace, "log", "-1", "--format=%s"), `keep ${kept.bundleId}`, "the commit waits in the workspace");
    assert.deepEqual(redNow(), [`keep ${kept.tessera} landed-absent`], "a failed push lands nothing");
    git(workspace, "remote", "set-url", "origin", remote);
    const cured = old.answer(old.must(["rite", "keep", "--workspace", "backup", "--json"])).data;
    assert.deepEqual({ kept: cured.kept, pushed: cured.pushed, par: cured.par, landed: cured.landed }, { kept: false, pushed: true, par: true, landed: [{ tessera: kept.tessera, par: true }] }, JSON.stringify(cured));
    assert.equal(JSON.parse(git(remote, "show", "main:house/manifest.json")).bundleId, kept.bundleId);
    const after = old.answer(old.must(["rite", "receipts", "--json"])).data.conferre;
    assert.deepEqual(after.red, []);
    assert.ok(after.par.some((t) => t.tessera === kept.tessera && t.rite === "keep"), JSON.stringify(after));
    const commits = git(workspace, "rev-list", "--count", "HEAD");
    const still = old.answer(old.must(["rite", "keep", "--workspace", "backup", "--json"])).data;
    assert.deepEqual({ committed: still.committed, pushed: still.pushed, landed: still.landed }, { committed: false, pushed: false, landed: [] });
    assert.equal(git(workspace, "rev-list", "--count", "HEAD"), commits, "an unchanged keep commits nothing");
    assert.equal(line("keep").returnsLeft, 1, "and spends nothing");

    // ── the census before the down ──────────────────────────────────────────────────────────────────────────────
    const snapshot = join(scratch, "census-old.json");
    const taken = spawnSync(process.execPath, [tool, "census", "--root", old.root, "--port", String(old.port), "--label", "old", "--out", snapshot], { cwd: repo, encoding: "utf8", env: process.env });
    assert.equal(taken.status, 0, taken.stderr);
    await old.stop();

    // ── H4: THE RESTORE DRILL: a brand-new house, a fresh clone, an import, par ─────────────────────────────────
    const fresh = await standHouse("new", "steward");
    houses.push(fresh);
    const restore = join(scratch, "restore");
    git(scratch, "clone", "-q", "--branch", "main", remote, restore);
    assert.ok(existsSync(join(restore, "house", "manifest.json")));
    // A damaged tree refuses before anything moves: one byte flipped in a second clone, and the import names the bundle unwhole.
    const damaged = join(scratch, "restore-damaged");
    git(scratch, "clone", "-q", "--branch", "main", remote, damaged);
    const victim = join(damaged, "house", manifest.files.find((f) => f.path.includes("heron")).path);
    writeFileSync(victim, readFileSync(victim, "utf8").replace("remember the heron", "remember the herons"));
    const refused = fresh.lares(["import", join(damaged, "house"), "--apply", "--json"]);
    assert.notEqual(refused.status, 0, refused.stdout);
    assert.equal(fresh.answer(refused).error?.code, "carry-bundle-refused", refused.stdout);
    assert.match(fresh.answer(refused).error?.message ?? "", /bundle-hash-mismatch/);
    const imported = fresh.lares(["import", join(restore, "house"), "--apply", "--json"]);
    const importAnswer = join(scratch, "import-0.json");
    writeFileSync(importAnswer, imported.stdout);
    assert.equal(fresh.answer(imported).data?.applied, true, `import: ${imported.stdout}\n${imported.stderr}`);
    assert.equal(fresh.answer(imported).data?.bundleId, kept.bundleId, "the clone holds the very bundle the keep cut");
    const r = spawnSync(process.execPath, [tool, "--old", snapshot, "--new", fresh.root, "--new-port", String(fresh.port), "--imports", importAnswer, "--json"], { cwd: repo, encoding: "utf8", env: process.env, maxBuffer: 256 * 1024 * 1024 });
    let receipt = null;
    try { receipt = JSON.parse(r.stdout); } catch { assert.fail(`the witness answered no receipt (exit ${r.status}):\n${r.stdout.slice(0, 2000)}\n${r.stderr.slice(-3000)}`); }
    assert.equal(receipt.verdict, "par", `${JSON.stringify(receipt.differences, null, 1)}\nimport: ${imported.stdout.slice(0, 4000)}`);
    assert.equal(r.status, 0);
    assert.ok(receipt.counts.memes >= 3, `the reading saw the carried memes: ${JSON.stringify(receipt.counts)}`);
    assert.ok(receipt.counts.plain >= 1, `the reading saw the free-titled record: ${JSON.stringify(receipt.counts)}`);
  } finally {
    for (const [k, v] of [["GIT_CONFIG_GLOBAL", priorGit.global], ["GIT_CONFIG_SYSTEM", priorGit.system]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    for (const h of houses) await h.stop();
    for (const h of houses) rmSync(h.root, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    rmSync(scratch, { recursive: true, force: true });
  }
});
