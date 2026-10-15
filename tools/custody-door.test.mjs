// custody-door — the standing vessel's custody door, driven live against the BUILT tree: a marked scratch root the
// built `lares` founded, the built daemon standing on it, the unlock frame sent through the harness door.
//
//   K1  an unlock leaves the credential in NO receipt fact, outcome, document or log line: not its bytes, and not
//       the digest a verb carrying it would have left.       control (the known positive): an ordinary verb's own
//       request id and caller ARE found by the same search of the same documents and log
//   K2  a wrong credential answers `no-slot-opens`, holds nothing, and moves no private row.
//                                                            control: the right one opens
//   K3  unlock, lock, unlock: each unlock stands a fresh composition and the vessel answers a verb after each.
//   K4  three wrong credentials spend the boot's attempts: the right one then reads `attempts-spent`, and only a
//       restart opens the door again.                        control: a fresh boot opens on the first right try
//   K6  the door reads an unlock whose composition refused (`reading: "opens"`, `held: false`) as a refusal.
//                                                            control: the same answer with `held: true` lands
//   K5  the harness door refuses an unmarked root (rc 2) before any socket opens.
//                                                            control: a marked root with no daemon reads rc 3
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { TEST_PASSPHRASE } from "./test-custody-route.mjs";
import { custodyActLanded, sendCustodyFrame, unlockTestCustody } from "./unlock-test-custody.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = join(repo, "packages/lares-cli/dist/src/bin/lares.js");
const nodeMain = join(repo, "packages/lararium-node/dist/src/main.js");
const door = join(repo, "tools/unlock-test-custody.mjs");

const freePort = () => new Promise((resolve) => {
  const s = createServer();
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

function stageFounded(tag) {
  const root = mkdtempSync(join(tmpdir(), `lares-custody-door-${tag}-`));
  for (const script of ["test-scratch-marker.mjs", "seed-test-custody.mjs"]) {
    const r = spawnSync(process.execPath, [join(repo, "tools", script), root], { encoding: "utf8", env: { ...process.env, LAR_ROOT: root } });
    assert.equal(r.status, 0, `${script}: ${r.stderr}`);
  }
  cpSync(join(repo, "genesis"), join(root, "genesis"), { recursive: true });
  for (const args of [["vessel", "found", "--hearth", "--name", "door", "--root", root, "--skip-build"]]) {
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
  const lives = () => (log.match(/phase → live/g) ?? []).length;
  await new Promise((resolve, reject) => {
    const poll = setInterval(() => {
      if (lives() > 0) { clearInterval(poll); resolve(); }
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
  const verb = (args) => spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: "utf8", env });
  return { log: () => log, lives, stop, verb, said, env };
}

/** Every private row of the root's custody homes, by path, with a digest of its bytes. */
function privateRows(node, root) {
  const prior = process.env.LAR_ROOT;
  process.env.LAR_ROOT = root;
  try {
    const homes = { identity: node.larIdentityDir(), storage: node.larDataDir(), seal: node.larSealHome() };
    const out = {};
    for (const e of node.carrierCensus(homes)) {
      if (e.custody === "serving" || e.custody === "hot" || e.custody === "cold" || e.row === "vk-slots" || e.row === "sk-slots") out[e.path] = createHash("sha256").update(readFileSync(e.path)).digest("hex");
    }
    return out;
  } finally {
    if (prior === undefined) delete process.env.LAR_ROOT; else process.env.LAR_ROOT = prior;
  }
}

/** Every document the stopped vessel's store holds, as one JSON text, plus every file's raw bytes as latin1. */
async function everythingStored(node, root) {
  const prior = process.env.LAR_ROOT;
  process.env.LAR_ROOT = root;
  try {
    const storageDir = node.larDataDir();
    const { Repo } = await import(pathToFileURL(join(repo, "packages/lararium-node/node_modules/@automerge/automerge-repo/dist/index.js")).href);
    const { DurableNodeFSStorageAdapter } = await import(pathToFileURL(join(repo, "packages/lararium-node/dist/src/durable-storage-adapter.js")).href);
    const store = new Repo({ storage: new DurableNodeFSStorageAdapter(storageDir) });
    let text = "";
    let docs = 0;
    for (const id of node.enumerateStoreDocs(storageDir)) {
      try { const h = await store.find(`automerge:${id}`); text += JSON.stringify(h.doc()) + "\n"; docs += 1; } catch { /* a doc that will not load holds nothing readable */ }
    }
    await store.shutdown();
    const raw = [];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const at = join(dir, e.name);
        if (e.isDirectory()) walk(at); else if (e.isFile()) raw.push(readFileSync(at).toString("latin1"));
      }
    };
    walk(root);
    return { text, docs, raw: raw.join("\n") };
  } finally {
    if (prior === undefined) delete process.env.LAR_ROOT; else process.env.LAR_ROOT = prior;
  }
}

test("the custody door opens the vessel key and leaves no trace of the credential", { timeout: 900_000 }, async () => {
  const node = await import(pathToFileURL(join(repo, "packages/lararium-node/dist/src/index.js")).href);
  const mesh = await import(pathToFileURL(join(repo, "packages/lararium-mesh/dist/index.js")).href);
  const root = stageFounded("live");
  let vessel = null;
  try {
    vessel = await stand(root);
    assert.match(vessel.log(), /TEST SCRATCH ROOT/, "the boot says aloud that a harness staged this root");
    await vessel.said(/stands holding no vessel key — open it on a terminal: lares vault unlock/);

    // ── K2: a wrong credential holds nothing and moves no private row ─────────────────────────────────────────
    const WRONG = "a-wrong-guess-for-the-door-test";
    const before = privateRows(node, root);
    assert.ok(Object.keys(before).length > 0, "the census finds private rows to compare (a silent census proves nothing)");
    const miss = await sendCustodyFrame(root, { op: "unlock", credentials: [{ kind: "passphrase", passphrase: WRONG }] });
    assert.equal(miss.reading, "no-slot-opens");
    assert.equal(miss.attemptsLeft, 2);
    assert.equal((await unlockTestCustody(root, "status")).unlocked, false, "K2: a miss holds nothing");
    assert.deepEqual(privateRows(node, root), before, "K2: a miss moves no private row");
    const livesBefore = vessel.lives();

    // ── K2 control + K3: the right credential opens and stands a fresh composition ───────────────────────────
    const opened = await unlockTestCustody(root);
    assert.equal(opened.reading, "opens", JSON.stringify(opened));
    assert.equal(opened.held, true, "the key stays held over a composition that stood");
    assert.equal(typeof opened.slot, "string");
    assert.equal(vessel.lives(), livesBefore + 1, "K3: the unlock stood a fresh composition");
    const status = await unlockTestCustody(root, "status");
    assert.deepEqual({ unlocked: status.unlocked, testScratch: status.testScratch, slot: status.slot }, { unlocked: true, testScratch: true, slot: opened.slot });
    assert.equal((await unlockTestCustody(root)).reading, "already-unlocked");
    assert.equal(vessel.lives(), livesBefore + 1, "an unlock over a held key stands nothing new");

    // An ordinary verb after the unlock: the known positive for K1's search.
    const put = vessel.verb(["meme", "list", "--bag", "lar:///ha.ka.ba/bags/lares", "--json"]);
    assert.equal(put.status, 0, `a verb answers after the unlock: ${put.stderr}${put.stdout}`);
    const KNOWN = JSON.parse(put.stdout.trim().split("\n").pop()).requestId;
    assert.equal(typeof KNOWN, "string", "the verb's answer names its request id");

    // ── K3: lock, then unlock again ──────────────────────────────────────────────────────────────────────────
    const locked = await unlockTestCustody(root, "lock");
    assert.deepEqual({ locked: locked.locked, was: locked.was }, { locked: true, was: "unlocked" });
    assert.equal(vessel.lives(), livesBefore + 2, "K3: the lock stood the floor composition");
    assert.equal((await unlockTestCustody(root, "status")).unlocked, false);
    const again = await unlockTestCustody(root);
    assert.equal(again.reading, "opens");
    assert.equal(vessel.lives(), livesBefore + 3, "K3: the second unlock stood a fresh composition");
    const after = vessel.verb(["meme", "list", "--bag", "lar:///ha.ka.ba/bags/lares"]);
    assert.equal(after.status, 0, `a verb answers after lock and unlock: ${after.stderr}${after.stdout}`);

    // ── K1: nothing kept carries the credential ──────────────────────────────────────────────────────────────
    const log = vessel.log();
    await vessel.stop();
    const stored = await everythingStored(node, root);
    assert.ok(stored.docs > 0, "the store's documents loaded (a search over nothing proves nothing)");
    // CONTROL: the ordinary verb's own request id reads back from the same documents by the same search.
    assert.ok(stored.text.includes(KNOWN), "K1 control: an ordinary verb's request id rests in the daemon's documents");
    // The leak class itself, shown present for a verb: a receipt fact under the verb's id carries a digest of its
    // input. A credential riding a verb would rest in exactly such a record.
    const factAt = stored.text.indexOf(`receipts/${KNOWN}`) >= 0 ? stored.text.indexOf(`receipts/${KNOWN}`) : stored.text.indexOf(KNOWN);
    assert.match(stored.text.slice(factAt, factAt + 4000), /input-digest|inputDigest/, "K1 control: a verb's receipt keeps a digest of its input");
    // And no record of any kind names a custody act: the frames never became invocations.
    for (const word of ['"verb":"unlock"', '"verb":"lock"', '"verb":"custody"', '"credentials"', "vault-unlock"]) {
      assert.equal(stored.text.includes(word), false, `K1: no document records ${word}`);
    }
    const needles = [TEST_PASSPHRASE, WRONG];
    // The digests a verb carrying the credential would have left in a receipt fact, under every caller a CLI names.
    const callers = new Set(["", ...[...stored.text.matchAll(/did:key:[A-Za-z0-9]+/g)].map((m) => m[0])]);
    for (const secret of [TEST_PASSPHRASE, WRONG]) {
      for (const who of callers) {
        for (const [verb, args] of [["vault-unlock", { passphrase: secret }], ["unlock", { credentials: [{ kind: "passphrase", passphrase: secret }] }]]) {
          needles.push(await mesh.verbInputDigest({ verb, args, requestedBy: who }));
        }
      }
      needles.push(createHash("sha256").update(secret).digest("hex"));
    }
    for (const needle of needles) {
      assert.equal(stored.text.includes(needle), false, `K1: no document carries ${needle === TEST_PASSPHRASE || needle === WRONG ? "the credential" : "a digest of it"}`);
      assert.equal(log.includes(needle), false, "K1: no log line carries it");
      assert.equal(stored.raw.includes(needle), false, "K1: no file under the root carries it");
    }
    assert.match(log, /\[custody\] unlocked: slot \S+ opened the vessel key/, "K1 control: the door logged the slot that opened");
    assert.match(log, /\[custody\] unlock: no-slot-opens/, "the miss logged its reading and nothing of what was sent");

    // ── K4: three misses spend the boot's attempts; a restart opens the door again ───────────────────────────
    vessel = await stand(root);
    for (const left of [2, 1, 0]) {
      const m = await sendCustodyFrame(root, { op: "unlock", credentials: [{ kind: "passphrase", passphrase: `${WRONG}-${left}` }] });
      assert.deepEqual({ reading: m.reading, attemptsLeft: m.attemptsLeft }, { reading: "no-slot-opens", attemptsLeft: left });
    }
    assert.equal((await unlockTestCustody(root)).reading, "attempts-spent", "K4: the right credential meets a spent bound");
    assert.equal((await unlockTestCustody(root, "status")).unlocked, false);
    await vessel.stop();
    vessel = await stand(root);
    assert.equal((await unlockTestCustody(root)).reading, "opens", "K4 control: a fresh boot opens on the first right try");
  } finally {
    await vessel?.stop();
    rmSync(root, { recursive: true, force: true });
  }
});

test("the harness door refuses an unmarked root before any socket opens", () => {
  const bare = mkdtempSync(join(tmpdir(), "lares-custody-door-bare-"));
  const marked = mkdtempSync(join(tmpdir(), "lares-custody-door-marked-"));
  try {
    const refused = spawnSync(process.execPath, [door, bare], { encoding: "utf8" });
    assert.equal(refused.status, 2);
    assert.match(refused.stderr, /TestDoorRefusal: .* carries no \.lar-test-scratch marker/);
    assert.equal(refused.stdout, "");
    // CONTROL: the same root once marked passes the marker and reads "no daemon" — the refusal above came from
    // the marker, ahead of the socket.
    const staged = spawnSync(process.execPath, [join(repo, "tools/test-scratch-marker.mjs"), marked], { encoding: "utf8", env: { ...process.env, LAR_ROOT: marked } });
    assert.equal(staged.status, 0, staged.stderr);
    const noDaemon = spawnSync(process.execPath, [door, marked], { encoding: "utf8" });
    assert.equal(noDaemon.status, 3, noDaemon.stderr);
    assert.match(noDaemon.stderr, /no daemon answers/);
  } finally {
    rmSync(bare, { recursive: true, force: true });
    rmSync(marked, { recursive: true, force: true });
  }
});

test("the door reads a key that opened over a refused composition as a refusal", () => {
  const refused = { op: "unlock", reading: "opens", slot: "s", standing: "herm", refused: "the sovereign composition refused", held: false };
  assert.equal(custodyActLanded("unlock", refused), false, "K6: held false reads as a refusal");
  assert.equal(custodyActLanded("unlock", { ...refused, held: true, refused: undefined }), true, "K6 control: a held key lands");
  assert.equal(custodyActLanded("unlock", { op: "unlock", reading: "already-unlocked" }), true);
  assert.equal(custodyActLanded("unlock", { op: "unlock", reading: "no-slot-opens", attemptsLeft: 2 }), false);
  assert.equal(custodyActLanded("unlock", null), false);
  assert.equal(custodyActLanded("lock", { locked: true }), true);
  assert.equal(custodyActLanded("status", { unlocked: false }), true);
});
