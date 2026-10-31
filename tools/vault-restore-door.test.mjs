// vault-restore-door — one face's RESTORE, driven live against the BUILT tree, end to end: a scratch vessel the
// built `lares` founded lights a face and cuts its bundle; its whole root gets destroyed; a second scratch vessel,
// founded fresh, restores through its standing custody door, stands again, and opens the face at a NEW seat.
//
//   R1  the restore lands through the standing vessel's `act` frame: the face stands under the SAME root and fixed
//       prefix, and the vessel that stands again opens it lit (it cuts that face's bundle from its own seat).
//   R2  the root's seed and the bundle's key rest in no clear file under the restored vessel's root.
//                                                              control: the opened body does carry the seed
//   R3  a second restore over the face refuses `face-already-held`; a locked vessel refuses `custody-locked`; a
//       route that opens no slot of the bundle refuses `no-slot-opens` before any act leaves.
//   R4  `--memory` on a production vessel refuses `signer-unavailable`: no session signer stands yet, so a
//       production import stands SPECIFIED.   `--memory` with another face's bundle refuses `another-face`.
//   R5  the harness door refuses an unmarked root (rc 2) before any socket opens.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { TEST_PASSPHRASE } from "./test-custody-route.mjs";
import { custodyBreaches, custodyReading } from "./custody-census.mjs";
import { backupTestCustody } from "./backup-test-custody.mjs";
import { restoreTestCustody } from "./restore-test-custody.mjs";
import { unlockTestCustody } from "./unlock-test-custody.mjs";
import { daemonStood } from "./daemon-stood.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = join(repo, "packages/lares-cli/dist/src/bin/lares.js");
const nodeMain = join(repo, "packages/lararium-node/dist/src/main.js");
const door = join(repo, "tools/restore-test-custody.mjs");

const freePort = () => new Promise((resolve) => {
  const s = createServer();
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

/** Stage a marked scratch root and found a PLACE on it; with `face`, the Stable founding act founds a HEARTH there. */
function stageFounded(tag, face) {
  const root = mkdtempSync(join(tmpdir(), `lares-restore-door-${tag}-`));
  for (const script of ["test-scratch-marker.mjs", "seed-test-custody.mjs"]) {
    const r = spawnSync(process.execPath, [join(repo, "tools", script), root], { encoding: "utf8", env: { ...process.env, LAR_ROOT: root } });
    assert.equal(r.status, 0, `${script}: ${r.stderr}`);
  }
  cpSync(join(repo, "genesis"), join(root, "genesis"), { recursive: true });
  const acts = [face ? ["vessel", "found", "--hearth", "--name", face, "--root", root, "--skip-build"] : ["vessel", "found", "--root", root, "--skip-build"]];
  for (const args of acts) {
    const r = spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: "utf8", env: { ...process.env, LAR_ROOT: root } });
    assert.equal(r.status, 0, `lares ${args.join(" ")}: ${r.stderr}`);
  }
  return root;
}

/** Stand the built daemon on `root`; resolves once it reads live. */
async function stand(root) {
  const port = await freePort();
  const env = { ...process.env, LAR_ROOT: root, LAR_PORT: String(port), LAR_SAME_ORIGIN: "true" };
  const child = spawn(process.execPath, [nodeMain, "--root", root, "--port", String(port)], { cwd: join(repo, "packages/lararium-node"), env });
  let log = "";
  child.stdout.on("data", (d) => { log += String(d); });
  child.stderr.on("data", (d) => { log += String(d); });
  await new Promise((resolve, reject) => {
    const poll = setInterval(() => {
      if (daemonStood(log)) { clearInterval(poll); resolve(); }
      else if (child.exitCode !== null) { clearInterval(poll); reject(new Error(`daemon exited ${child.exitCode} before live:\n${log.slice(-3000)}`)); }
    }, 200);
  });
  const stop = () => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
  });
  return { log: () => log, stop, env };
}
async function standUnlocked(root, face = undefined) {
  const vessel = await stand(root);
  const unlocked = await unlockTestCustody(root, "unlock", face);
  if (unlocked?.reading !== "opens" || unlocked?.held !== true) { await vessel.stop(); throw new Error(`the vessel did not unlock: ${JSON.stringify(unlocked)}\n${vessel.log().slice(-2000)}`); }
  return vessel;
}

/** Every file's raw bytes under `root`, as latin1. */
function everyByte(root) {
  const raw = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const at = join(dir, e.name);
      if (e.isDirectory()) walk(at); else if (e.isFile()) raw.push(readFileSync(at).toString("latin1"));
    }
  };
  walk(root);
  return raw.join("\n");
}

test("a face cut on one vessel restores onto a fresh one through its custody door, and stands there at a new seat", { timeout: 1_800_000 }, async () => {
  const mesh = await import(pathToFileURL(join(repo, "packages/lararium-mesh/dist/index.js")).href);
  const outDir = mkdtempSync(join(tmpdir(), "lares-restore-out-"));
  const roots = [];
  let vessel = null;
  const openBody = (file) => {
    const read = mesh.readFaceBundle(new Uint8Array(readFileSync(file)));
    const key = mesh.openBundleKey(read.tree, [{ kind: "passphrase", passphrase: TEST_PASSPHRASE }]);
    return { body: mesh.readFaceBundleBody(mesh.openFaceBundleBody(read.sealedBody, key.bundleKey)), bundleKey: Buffer.from(key.bundleKey).toString("hex") };
  };
  try {
    // ── VESSEL A: found, light a face, cut, and DESTROY the whole root ─────────────────────────────────────────
    const rootA = stageFounded("a", "the gardener");
    roots.push(rootA);
    vessel = await standUnlocked(rootA);
    const bundle = join(outDir, "gardener.bundle");
    const cut = await backupTestCustody(rootA, { face: 0, out: bundle });
    assert.equal(cut.ok, true, JSON.stringify(cut));
    await vessel.stop();
    vessel = null;
    const a = openBody(bundle);
    rmSync(rootA, { recursive: true, force: true });
    assert.equal(existsSync(rootA), false, "vessel A's whole home stands destroyed");

    // ── VESSEL B: a fresh hearth, persona zero its own; the restored face lands beside it at h1 ─────────────────
    const rootB = stageFounded("b", "the keeper");
    roots.push(rootB);
    vessel = await stand(rootB);
    // R3: a locked vessel refuses the act.
    const locked = await restoreTestCustody(rootB, { file: bundle, as: 1 });
    assert.deepEqual({ ok: locked.answer.ok, reason: locked.answer.reason }, { ok: false, reason: "custody-locked" });
    const unlocked = await unlockTestCustody(rootB);
    assert.equal(unlocked?.reading, "opens", JSON.stringify(unlocked));
    // R3: a route that opens no slot of the bundle refuses before any act leaves.
    const missed = await restoreTestCustody(rootB, { file: bundle, as: 1, passphrase: "a-wrong-route-for-the-bundle" });
    assert.equal(missed.answer.reason, "no-slot-opens");

    // ── R1: the restore, through the door's own CLI ────────────────────────────────────────────────────────────
    const ran = spawnSync(process.execPath, [door, rootB, bundle, "--as", "1"], { encoding: "utf8", env: vessel.env });
    assert.equal(ran.status, 0, `the door restores: ${ran.stdout}${ran.stderr}`);
    const restored = JSON.parse(ran.stdout.trim().split("\n").pop());
    assert.equal(restored.ok, true);
    assert.equal(restored.via, "vessel");
    assert.deepEqual(restored.face, { handleIndex: 1, verifyingKey: a.body.root.verifyingKey });
    assert.equal(restored.prefix, a.body.anchors.personaKelPrefix);
    assert.deepEqual(restored.checked, { seq: 0, from: "bundle" });
    // R3: a second restore over it refuses.
    const second = await restoreTestCustody(rootB, { file: bundle });
    assert.equal(second.answer.reason, "face-already-held", JSON.stringify(second.answer));

    // ── THE VESSEL STANDS AGAIN and opens the restored face at its own seat ────────────────────────────────────
    await vessel.stop();
    vessel = await standUnlocked(rootB, 1);   // the unlock NAMES the face it opens: nothing at rest remembers a choice
    const again = join(outDir, "gardener-from-b.bundle");
    const recut = await backupTestCustody(rootB, { face: 1, out: again });
    assert.equal(recut.ok, true, `the restored vessel holds the face lit, and cuts it from its own seat: ${JSON.stringify(recut)}`);
    const b = openBody(again);
    assert.equal(b.body.root.verifyingKey, a.body.root.verifyingKey, "the same root");
    assert.equal(b.body.root.signingKey, a.body.root.signingKey);
    assert.equal(b.body.anchors.personaKelPrefix, a.body.anchors.personaKelPrefix, "the same fixed prefix");
    assert.equal(b.body.names.petname, "the gardener", "the face's own pet-name came with it");
    assert.notEqual(b.bundleKey, a.bundleKey, "a fresh bundle key per cut");

    // ── R4: an import on a production vessel stands SPECIFIED: no session signer stands ────────────────────────
    const imported = await restoreTestCustody(rootB, { file: bundle, memory: true });
    assert.deepEqual({ ok: imported.answer.ok, reason: imported.answer.reason }, { ok: false, reason: "signer-unavailable" }, JSON.stringify(imported.answer));

    // ── R2: a NEW seat, and no clear secret under the restored root ────────────────────────────────────────────
    await vessel.stop();
    vessel = null;
    const everything = everyByte(rootB);
    assert.ok(JSON.stringify(a.body).includes(a.body.root.signingKey), "CONTROL: the opened body carries the seed");
    assert.equal(everything.includes(a.body.root.signingKey), false, "no file under the restored root holds the root's seed in the clear");
    assert.equal(everything.includes(a.bundleKey), false, "no file under the restored root holds the bundle key");

    // ── the restored vessel's rows answer to the carrier table: the restore's own rows among them ───────────────
    const custody = custodyReading(rootB);
    assert.deepEqual(custodyBreaches(custody), [], "the restored vessel holds no row at fault and no private file outside the carrier table");
    assert.ok(custody.rows.some((r) => r.row === "persona-root" && r.reading === "sealed"), "CONTROL: the reading names the restored root's own row");
    assert.equal(custody.rows.some((r) => r.row === "restore-pending"), false, "the restore's commit row left once the face stood lit");

    // ── R4: another face's bundle meets the vessel that holds this one ─────────────────────────────────────────
    const rootC = stageFounded("c", "the potter");
    roots.push(rootC);
    vessel = await standUnlocked(rootC);
    const stranger = await restoreTestCustody(rootC, { file: bundle, memory: true });
    assert.equal(stranger.answer.reason, "another-face", JSON.stringify(stranger.answer));
    // Its lineage, too: the founding index holds the potter, so the gardener's restore names the roster line there.
    const over = await restoreTestCustody(rootC, { file: bundle });
    assert.equal(over.answer.reason, "roster-names-another-key", JSON.stringify(over.answer));
  } finally {
    await vessel?.stop();
    for (const root of roots) rmSync(root, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  }
});

test("R5 — the restore's harness door refuses an unmarked root before any socket opens", () => {
  const bare = mkdtempSync(join(tmpdir(), "lares-restore-door-bare-"));
  try {
    const r = spawnSync(process.execPath, [door, bare, join(bare, "x.bundle")], { encoding: "utf8" });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /TestDoorRefusal/);
    assert.equal(spawnSync(process.execPath, [door, bare], { encoding: "utf8" }).status, 2);
  } finally { rmSync(bare, { recursive: true, force: true }); }
});
