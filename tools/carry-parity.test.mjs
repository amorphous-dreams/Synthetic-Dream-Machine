// carry-parity — the instrument that reads two houses and answers `par`, or names every difference (missing, changed,
// extra) per class. It must be able to fail, so this test plants the reds it owes:
//
//   P1  the comparison over census readings: equal readings read par; a missing, a changed and an extra row each name their
//       class and key; the classes the carry re-mints by design (face relations, kahua cids, CRDT heads, the Nexus AID, the
//       floor pin) never decide the verdict; a new-base reading takes the new house's own founding rows out of `extra`.
//   P2  TWO REAL HOUSES: found a scratch house, write memory into its steward's daemon wiki and share a wiki, `lares export`,
//       found a brand-new scratch house under the same pet-names, `lares import --apply`, and the witness reads par over the
//       real read doors. Then on the new house delete one meme, change another and drop one share: the witness reads red,
//       exits non-zero, and names all three.
//
// Each house stands under its own marked scratch LAR_ROOT through the test custody doors; no LAR_BAGS, no docker.
import "./test-ward-env.mjs";   // the CLI processes this test spawns take the harness's explicit routes
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compareCensus, MAY_DIFFER } from "./carry-parity.mjs";
import { unlockTestCustody } from "./unlock-test-custody.mjs";
import { daemonStood } from "./daemon-stood.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = join(repo, "packages/lares-cli/dist/src/bin/lares.js");
const nodeMain = join(repo, "packages/lararium-node/dist/src/main.js");
const tool = join(repo, "tools/carry-parity.mjs");

// ── P1: the comparison ────────────────────────────────────────────────────────────────────────────────────────

/** A census reading as the instrument writes one: per face by pet-name, then the house-wide classes. */
const reading = (over = {}) => ({
  schema: "lar-carry-census/1",
  label: "fixture",
  faces: [{ petname: "steward", handleIndex: 0, worn: true, relation: "11111111-1111-4111-8111-111111111111" }],
  face: {
    steward: {
      memes: { "default lar:///ha.ka.ba/kahua/memory/state/heron": "sha256:aa", "default lar:///ha.ka.ba/kahua/memory/reference/pond": "sha256:bb" },
      index: { "lar:///ha.ka.ba/kahua/memory/state/heron": "the heron" },
      plain: { "default plain note": "sha256-cc" },
      kahua: {},
      kapae: {},
      ...over.steward,
    },
  },
  house: { shares: { "wiki notes": "owner=steward read=engineer write=" }, ...over.house },
  allowed: { relations: { steward: "11111111-1111-4111-8111-111111111111" }, kahuaCids: {}, ...over.allowed },
});

test("P1 equal readings read par, and what the carry re-mints by design never decides it", () => {
  const old = reading();
  const fresh = reading({ allowed: { relations: { steward: "22222222-2222-4222-8222-222222222222" }, kahuaCids: { "t": "bafy-new" } } });
  fresh.faces = [{ ...fresh.faces[0], relation: "22222222-2222-4222-8222-222222222222" }];
  const r = compareCensus([old], [fresh]);
  assert.equal(r.verdict, "par", JSON.stringify(r.differences));
  assert.deepEqual(r.differences, []);
  for (const name of ["face relations", "CRDT heads", "kahua cids", "Nexus AID", "floor pin"]) {
    assert.ok(MAY_DIFFER.some((m) => m.name === name), `the may-differ list names ${name}`);
  }
});

test("P1 a missing, a changed and an extra row each read red under their class and key", () => {
  const old = reading();
  const fresh = reading({
    steward: {
      memes: { "default lar:///ha.ka.ba/kahua/memory/state/heron": "sha256:a2", "default lar:///ha.ka.ba/kahua/memory/feedback/kite": "sha256:dd" },
    },
    house: { shares: {} },
  });
  const r = compareCensus([old], [fresh]);
  assert.equal(r.verdict, "red");
  const said = r.differences.map((d) => `${d.scope} ${d.class} ${d.kind} ${d.key}`).sort();
  assert.deepEqual(said, [
    "face:steward memes changed default lar:///ha.ka.ba/kahua/memory/state/heron",
    "face:steward memes extra default lar:///ha.ka.ba/kahua/memory/feedback/kite",
    "face:steward memes missing default lar:///ha.ka.ba/kahua/memory/reference/pond",
    "house shares missing wiki notes",
  ]);
  const changed = r.differences.find((d) => d.kind === "changed");
  assert.equal(changed.old, "sha256:aa");
  assert.equal(changed.new, "sha256:a2");
});

test("P1 a face the old house wore and the new census never read reads red by name, never as par", () => {
  const fresh = reading();
  fresh.face = {};
  const r = compareCensus([reading()], [fresh]);
  assert.equal(r.verdict, "red");
  assert.ok(r.differences.some((d) => d.scope === "face:steward" && d.kind === "missing" && d.class === "face"), JSON.stringify(r.differences));
});

test("P1 a new-base reading takes the new house's own founding rows out of extra, and only those", () => {
  const genesisRow = "default lar:///ha.ka.ba/kahua/memory/state/founding";
  const base = reading({ steward: { memes: { [genesisRow]: "sha256:ff" }, index: {}, plain: {} }, house: { shares: {} } });
  const fresh = reading({ steward: { memes: { ...reading().face.steward.memes, [genesisRow]: "sha256:ff", "default lar:///ha.ka.ba/x/stray": "sha256:ee" } } });
  const r = compareCensus([reading()], [fresh], [base]);
  assert.deepEqual(r.differences.map((d) => `${d.kind} ${d.key}`), ["extra default lar:///ha.ka.ba/x/stray"]);
});

// ── P2: two real houses ───────────────────────────────────────────────────────────────────────────────────────

const freePort = () => new Promise((resolve) => {
  const s = createServer();
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

/** One scratch house: a marked root, the test custody seeded, founded under `name`, standing and unlocked. */
async function standHouse(tag, name) {
  const root = mkdtempSync(join(tmpdir(), `lares-carry-parity-${tag}-`));
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
  const unlock = async () => {
    const a = await unlockTestCustody(root, "unlock", 0);
    assert.ok(a?.held === true || a?.reading === "opens", `${tag} unlock: ${JSON.stringify(a)}`);
  };
  await unlock();
  const stop = () => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
  });
  /** Run `lares` here and insist it lands. */
  const must = (args) => { const r = lares(args); assert.equal(r.status, 0, `${tag}: lares ${args.join(" ")}\n${r.stdout}\n${r.stderr}`); return r; };
  return { root, port, lares, must, unlock, stop, log: () => log };
}

const memeText = (uri, body, meta = "") => {
  const path = uri.slice("lar:///".length);
  return `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "${path}"\n${meta}\`\`\`\n\n! ${path.split("/").pop()}\n\n${body}\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;
};
const HERON = "lar:///ha.ka.ba/kahua/memory/state/heron";
const POND = "lar:///ha.ka.ba/kahua/memory/reference/pond";
const KITE = "lar:///ha.ka.ba/kahua/memory/feedback/kite";

/** Run the instrument over two standing houses. */
const witness = (old, fresh) => spawnSync(process.execPath, [tool, "--old", old.root, "--old-port", String(old.port), "--new", fresh.root, "--new-port", String(fresh.port), "--json"], {
  cwd: repo, encoding: "utf8", env: process.env,
});

test("P2 two real houses: export, import, par; then a deleted meme, a changed meme and a dropped share each read red by name", { timeout: 900_000 }, async () => {
  const scratch = mkdtempSync(join(tmpdir(), "lares-carry-parity-files-"));
  const houses = [];
  try {
    // ── the old house: a steward and an engineer, memory in the steward's daemon wiki, one shared wiki ──────────
    const old = await standHouse("old", "steward");
    houses.push(old);
    old.must(["persona", "new", "1", "--name", "engineer"]);
    await old.unlock();
    for (const [uri, body, meta] of [[HERON, "remember the heron", `tags = "stage/index"\ndescription = "the heron"\n`], [POND, "the pond at dusk", ""], [KITE, "fly the kite low", ""]]) {
      const file = join(scratch, `${uri.split("/").pop()}.mem`);
      writeFileSync(file, memeText(uri, body, meta));
      old.must(["meme", "put", uri, "--recipe", "default", "--file", file, "--json"]);
    }
    old.must(["tiddler", "put", "plain note", "--recipe", "default", "--text", "a plain record", "--json"]);
    old.must(["wiki", "init", "notes", "--json"]);
    old.must(["wiki", "share", "notes", "--read", "engineer"]);
    const bundle = join(scratch, "bundle");
    old.must(["export", bundle, "--json"]);

    // ── the brand-new house: the same pet-names, its own keys, then the import ──────────────────────────────────
    const fresh = await standHouse("new", "steward");
    houses.push(fresh);
    fresh.must(["persona", "new", "1", "--name", "engineer"]);
    await fresh.unlock();
    const imported = fresh.lares(["import", bundle, "--apply", "--json"]);
    assert.equal(imported.status, 0, `import: ${imported.stdout}\n${imported.stderr}`);

    // ── PAR over the real read doors ────────────────────────────────────────────────────────────────────────────
    const par = witness(old, fresh);
    const parAnswer = JSON.parse(par.stdout);
    assert.equal(parAnswer.verdict, "par", `${par.stdout}\n${par.stderr}`);
    assert.equal(par.status, 0);
    assert.ok(parAnswer.counts.memes >= 3, `the reading saw the carried memes: ${JSON.stringify(parAnswer.counts)}`);
    assert.ok(parAnswer.counts.shares >= 1, `the reading saw the share: ${JSON.stringify(parAnswer.counts)}`);

    // ── THE INSTRUMENT FAILS: delete one meme, change another, drop one share ───────────────────────────────────
    fresh.must(["meme", "delete", POND, "--recipe", "default", "--json"]);
    const kite = JSON.parse(fresh.must(["meme", "get", KITE, "--recipe", "default", "--json"]).stdout).data;
    const kiteFile = join(scratch, "kite-changed.mem");
    writeFileSync(kiteFile, memeText(KITE, "fly the kite high", ""));
    fresh.must(["meme", "put", KITE, "--recipe", "default", "--file", kiteFile, "--base", kite.canonicalHash, "--json"]);
    // The share config's file is the person's own hand door (it wins at the next boot): drop the notes row from it.
    const mesh = await import(pathToFileURL(join(repo, "packages/lararium-mesh/dist/index.js")).href);
    const shareFile = join(fresh.root, "config", mesh.SHARE_CONFIG_FILE);
    const rows = mesh.parseShareFile(readFileSync(shareFile, "utf8"));
    assert.ok(rows.some((r) => r.slug === "notes"), "the import wrote the notes share row");
    writeFileSync(shareFile, mesh.serializeShareFile(rows.filter((r) => r.slug !== "notes")));

    const red = witness(old, fresh);
    const redAnswer = JSON.parse(red.stdout);
    assert.equal(redAnswer.verdict, "red", red.stdout);
    assert.notEqual(red.status, 0);
    const said = redAnswer.differences.map((d) => `${d.class} ${d.kind} ${d.key}`);
    assert.ok(said.includes(`memes missing default ${POND}`), said.join("\n"));
    assert.ok(said.includes(`memes changed default ${KITE}`), said.join("\n"));
    assert.ok(said.includes("shares missing wiki notes"), said.join("\n"));
    assert.equal(said.length, 3, `exactly the three planted faults read red:\n${said.join("\n")}`);
  } finally {
    for (const h of houses) await h.stop();
    for (const h of houses) rmSync(h.root, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    rmSync(scratch, { recursive: true, force: true });
  }
});
