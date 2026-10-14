// vault-backup-door — one face's backup CUT, driven live against the BUILT tree: a marked scratch root the built
// `lares` founded, the built daemon standing on it, the cut sent through the harness door for scratch roots.
//
//   B1  an unlocked vessel wearing the face cuts its bundle: the file opens under the bundle's route, its body names
//       the face's own root and key history, and it carries no veil key, no vessel key and no seat.
//   B2  the vessel's own route gets asked again: a wrong one refuses `no-slot-opens`, spends an attempt and writes
//       no file.                                                control: the right one cuts
//   B3  a locked vessel refuses `custody-locked` and writes no file.
//   B4  a face the vessel holds no root for refuses `face-not-held`.
//   B5  the root's seed rests in NO document, outcome or log line of the standing vessel after a cut.
//                                                               control: the opened body does carry it
//   B6  the harness door refuses an unmarked root (rc 2) before any socket opens.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { TEST_PASSPHRASE } from "./test-custody-route.mjs";
import { custodyBreaches, custodyReading } from "./custody-census.mjs";
import { backupTestCustody } from "./backup-test-custody.mjs";
import { unlockTestCustody } from "./unlock-test-custody.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = join(repo, "packages/lares-cli/dist/src/bin/lares.js");
const nodeMain = join(repo, "packages/lararium-node/dist/src/main.js");
const door = join(repo, "tools/backup-test-custody.mjs");

const freePort = () => new Promise((resolve) => {
  const s = createServer();
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

function stageFounded(tag) {
  const root = mkdtempSync(join(tmpdir(), `lares-backup-door-${tag}-`));
  for (const script of ["test-scratch-marker.mjs", "seed-test-custody.mjs"]) {
    const r = spawnSync(process.execPath, [join(repo, "tools", script), root], { encoding: "utf8", env: { ...process.env, LAR_ROOT: root } });
    assert.equal(r.status, 0, `${script}: ${r.stderr}`);
  }
  cpSync(join(repo, "genesis"), join(root, "genesis"), { recursive: true });
  for (const args of [["vessel", "found", "--root", root, "--skip-build"], ["persona", "new", "0", "--name", "the gardener"]]) {
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
      if (/phase → live/.test(log)) { clearInterval(poll); resolve(); }
      else if (child.exitCode !== null) { clearInterval(poll); reject(new Error(`daemon exited ${child.exitCode} before live:\n${log.slice(-3000)}`)); }
    }, 200);
  });
  const stop = () => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
  });
  /** Resolve once the log carries `pattern`; the daemon's exit before then rejects. */
  const said = (pattern) => new Promise((resolve, reject) => {
    const poll = setInterval(() => {
      if (pattern.test(log)) { clearInterval(poll); resolve(); }
      else if (child.exitCode !== null) { clearInterval(poll); reject(new Error(`daemon exited before saying ${pattern}:\n${log.slice(-2000)}`)); }
    }, 100);
  });
  return { log: () => log, stop, said, env };
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

test("a standing vessel cuts one face's backup bundle through its custody door", { timeout: 900_000 }, async () => {
  const mesh = await import(pathToFileURL(join(repo, "packages/lararium-mesh/dist/index.js")).href);
  const root = stageFounded("live");
  const outDir = mkdtempSync(join(tmpdir(), "lares-backup-out-"));
  let vessel = null;
  try {
    vessel = await stand(root);

    // ── B3: a locked vessel cuts nothing ────────────────────────────────────────────────────────────────────
    const locked = await backupTestCustody(root, { face: 0, out: join(outDir, "locked.bundle") });
    assert.equal(locked.ok, false);
    assert.equal(locked.reason, "custody-locked");
    assert.equal(existsSync(join(outDir, "locked.bundle")), false, "a refused cut writes no file");

    const unlocked = await unlockTestCustody(root);
    assert.equal(unlocked?.reading, "opens", `the vessel unlocks: ${JSON.stringify(unlocked)}`);
    assert.equal(unlocked?.held, true);

    // ── B2: the vessel's own route gets asked again ─────────────────────────────────────────────────────────
    const missed = await backupTestCustody(root, { face: 0, out: join(outDir, "missed.bundle"), vesselPassphrase: "a-wrong-route-for-the-cut" });
    assert.deepEqual({ ok: missed.ok, reason: missed.reason, attemptsLeft: missed.attemptsLeft }, { ok: false, reason: "no-slot-opens", attemptsLeft: 2 });
    assert.equal(existsSync(join(outDir, "missed.bundle")), false);

    // ── B4: a face this vessel holds no root for ────────────────────────────────────────────────────────────
    const unheld = await backupTestCustody(root, { face: 5, out: join(outDir, "unheld.bundle") });
    assert.equal(unheld.reason, "face-not-held", JSON.stringify(unheld));
    assert.equal(existsSync(join(outDir, "unheld.bundle")), false);

    // ── B1: the cut, through the door's own CLI ─────────────────────────────────────────────────────────────
    const out = join(outDir, "face.bundle");
    const ran = spawnSync(process.execPath, [door, root, "--face", "0", "--out", out], { encoding: "utf8", env: vessel.env });
    assert.equal(ran.status, 0, `the door cuts: ${ran.stdout}${ran.stderr}`);
    const landed = JSON.parse(ran.stdout.trim().split("\n").pop());
    assert.equal(landed.ok, true);
    assert.equal(landed.face.handleIndex, 0);
    assert.equal(statSync(out).mode & 0o777, 0o600, "the bundle rests owner-only");
    const bytes = new Uint8Array(readFileSync(out));
    const read = mesh.readFaceBundle(bytes);
    assert.equal(read.reading, "readable");
    assert.deepEqual(mesh.faceBundleResidue(bytes), { length: bytes.length, slots: [{ t: 1, pins: ["passphrase"] }] });
    const key = mesh.openBundleKey(read.tree, [{ kind: "passphrase", passphrase: TEST_PASSPHRASE }]);
    assert.equal(key.reading, "opens");
    const plain = mesh.openFaceBundleBody(read.sealedBody, key.bundleKey);
    assert.ok(plain, "the body opens under the bundle's own key");
    const body = mesh.readFaceBundleBody(plain);
    assert.ok(body, "the opened bytes read as a bundle body");
    assert.equal(body.root.verifyingKey, landed.face.verifyingKey);
    assert.equal(body.rosterLine.verifyingKey, body.root.verifyingKey);
    assert.equal(body.names.petname, "the gardener");
    assert.ok(body.kel.length >= 1 && body.kel[0].prefix === body.anchors.personaKelPrefix, "the body carries the face's key history from its inception");
    assert.equal((await mesh.verifyPersonaKelFull(body.kel)).ok, true);
    assert.deepEqual(Object.keys(body).sort(), ["anchors", "faceProofKeys", "handleBook", "kel", "memory", "names", "root", "rosterLine"]);
    assert.deepEqual(Object.keys(body.anchors).sort(), ["personaKelPrefix", "signerDid"]);
    await vessel.said(/\[custody\] backup: done/);
    assert.match(vessel.log(), /\[custody\] backup: refused \(no-slot-opens\)/);
    assert.match(vessel.log(), /\[custody\] backup: refused \(face-not-held\)/);
    assert.match(vessel.log(), /\[custody\] backup: refused \(custody-locked\)/);

    // ── B5: the root's seed rests nowhere in the standing vessel's own files or log ──────────────────────────
    const seed = body.root.signingKey;
    assert.ok(Buffer.from(plain).toString("latin1").includes(seed), "CONTROL: the opened body carries the seed");
    await vessel.stop();
    vessel = null;
    assert.equal(everyByte(root).includes(seed), false, "no file under the root holds the root's seed in the clear");
    assert.equal(everyByte(root).includes(Buffer.from(key.bundleKey).toString("hex")), false, "no file under the root holds the bundle key");
    // The cut left no private file outside the carrier table, and no row at fault.
    assert.deepEqual(custodyBreaches(custodyReading(root)), [], "the vessel that cut holds no private file outside the carrier table");
  } finally {
    await vessel?.stop();
    rmSync(root, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  }
});

test("B6 — the cut's harness door refuses an unmarked root before any socket opens", () => {
  const bare = mkdtempSync(join(tmpdir(), "lares-backup-door-bare-"));
  try {
    const r = spawnSync(process.execPath, [door, bare, "--face", "0", "--out", join(bare, "x.bundle")], { encoding: "utf8" });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /TestDoorRefusal/);
    assert.equal(existsSync(join(bare, "x.bundle")), false);
    const usage = spawnSync(process.execPath, [door, bare], { encoding: "utf8" });
    assert.equal(usage.status, 2);
  } finally { rmSync(bare, { recursive: true, force: true }); }
});
