// carry-parity — the instrument that reads two houses and answers `par`, or names every difference (missing, changed,
// extra) per class. It must be able to fail, so this test plants the reds it owes:
//
//   P1  the comparison over census readings: equal readings read par; a missing, a changed and an extra row each name their
//       class and key; the classes the carry re-mints by design (face relations, kahua cids, CRDT heads, the Nexus AID, the
//       floor pin) never decide the verdict; a new-base reading takes the new house's own founding rows out of `extra`.
//   P2  TWO REAL HOUSES: found a scratch house, write memory into its steward's daemon wiki (a free-titled record among it),
//       found a second face after the stand, share one wiki with a page and one with none, `lares export`, take its census
//       into a file and take it down (the rite's order: the two houses never stand at once), found a brand-new scratch house
//       under the same pet-names, `lares import --apply`, and the witness reads par of the snapshot against the new house's
//       real read doors. Then on the new house delete one meme, change another and drop one share: the witness reads red,
//       exits non-zero, and names all three (beside the kāpae shadow the delete itself raises, and nothing else).
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
  house: { shares: { "wiki notes": "owner=steward read=engineer write=" }, wikis: { notes: "user", quiet: "user" }, ...over.house },
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
    house: { shares: {}, wikis: { notes: "user" } },
  });
  const r = compareCensus([old], [fresh]);
  assert.equal(r.verdict, "red");
  const said = r.differences.map((d) => `${d.scope} ${d.class} ${d.kind} ${d.key}`).sort();
  assert.deepEqual(said, [
    "face:steward memes changed default lar:///ha.ka.ba/kahua/memory/state/heron",
    "face:steward memes extra default lar:///ha.ka.ba/kahua/memory/feedback/kite",
    "face:steward memes missing default lar:///ha.ka.ba/kahua/memory/reference/pond",
    "house shares missing wiki notes",
    "house wikis missing quiet",
  ]);
  const changed = r.differences.find((d) => d.kind === "changed");
  assert.equal(changed.old, "sha256:aa");
  assert.equal(changed.new, "sha256:a2");
});

test("P1 a face the exporting house wore and the new census never read reads red by name, never as par", () => {
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

test("P1 the compare verb reads census files: par exits 0, red exits 1 and prints one line per difference", () => {
  const dir = mkdtempSync(join(tmpdir(), "lares-carry-parity-census-"));
  try {
    const a = join(dir, "census-old.json"), b = join(dir, "census-new.json"), out = join(dir, "receipt.json");
    writeFileSync(a, JSON.stringify(reading()));
    writeFileSync(b, JSON.stringify(reading()));
    const par = spawnSync(process.execPath, [tool, "compare", "--old", a, "--new", b], { encoding: "utf8" });
    assert.equal(par.status, 0, par.stderr);
    assert.match(par.stdout, /^carry-parity: par — 1 face\(s\): 2 memes/);
    writeFileSync(b, JSON.stringify(reading({ house: { shares: {} } })));
    const red = spawnSync(process.execPath, [tool, "compare", "--old", a, "--new", b, "--out", out], { encoding: "utf8" });
    assert.equal(red.status, 1, red.stderr);
    assert.match(red.stdout, /carry-parity: red — 1 difference\(s\)\n  house · shares: missing wiki notes/);
    assert.equal(JSON.parse(readFileSync(out, "utf8")).verdict, "red");
    const refused = spawnSync(process.execPath, [tool, "compare", "--old", dir, "--new", b], { encoding: "utf8" });
    assert.equal(refused.status, 2, "compare refuses a path that names no census file");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("P1 a row the import stood off reads under its own named set, never red; an unnamed difference stays red", () => {
  const pond = "lar:///ha.ka.ba/kahua/memory/reference/pond", heron = "lar:///ha.ka.ba/kahua/memory/state/heron";
  const fresh = reading({ steward: { memes: { [`default ${heron}`]: "sha256:a2" } } });
  // Named: heron (changed) stands off; pond (missing) was never named and stays red.
  const r = compareCensus([reading()], [fresh], [], { standOffs: [heron] });
  assert.equal(r.verdict, "red");
  assert.deepEqual(r.differences.map((d) => `${d.kind} ${d.key}`), [`missing default ${pond}`]);
  assert.deepEqual(r.standOffs.map((d) => `${d.kind} ${d.key}`), [`changed default ${heron}`]);
  // Both named: par, with each stand-off kept in the receipt by name.
  const both = compareCensus([reading()], [fresh], [], { standOffs: [heron, pond] });
  assert.equal(both.verdict, "par", JSON.stringify(both.differences));
  assert.equal(both.standOffs.length, 2);
  // A stand-off never excuses an extra row: the import wrote nothing over a row it stood off.
  const extra = reading({ steward: { memes: { ...reading().face.steward.memes, "default lar:///ha.ka.ba/x/new": "sha256:ee" } } });
  assert.equal(compareCensus([reading()], [extra], [], { standOffs: ["lar:///ha.ka.ba/x/new"] }).verdict, "red");
});

test("P1 --imports reads the stood-off uris from each import's --json answer, whatever the import's exit said", () => {
  const dir = mkdtempSync(join(tmpdir(), "lares-carry-parity-imports-"));
  try {
    const heron = "lar:///ha.ka.ba/kahua/memory/state/heron";
    const a = join(dir, "old.json"), b = join(dir, "new.json"), imp = join(dir, "import-0.json");
    writeFileSync(a, JSON.stringify(reading()));
    writeFileSync(b, JSON.stringify(reading({ steward: { memes: { ...reading().face.steward.memes, [`default ${heron}`]: "sha256:a2" } } })));
    // The import's own answer on a stand-off: ok false, exit 1, the row named in its class's stoodOff list.
    writeFileSync(imp, `${JSON.stringify({ ok: false, data: { tallies: { working: { landed: 3, stoodOff: [`${heron} (no-base)`], refused: [] } } }, error: { code: "conflict" } })}\n`);
    const red = spawnSync(process.execPath, [tool, "compare", "--old", a, "--new", b], { encoding: "utf8" });
    assert.equal(red.status, 1, "unnamed, the fork reads red");
    const par = spawnSync(process.execPath, [tool, "compare", "--old", a, "--new", b, "--imports", imp, "--json"], { encoding: "utf8" });
    assert.equal(par.status, 0, par.stdout + par.stderr);
    assert.deepEqual(JSON.parse(par.stdout).standOffs.map((d) => d.key), [`default ${heron}`]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
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
    // Every face wearing h0 (`lares vault unlock --all --face 0`). A face born after the stand already stands lit, so a second
    // unlock after a `persona new` answers `already-unlocked` and reads the new face open beside the first.
    const a = await unlockTestCustody(root, "unlock", 0);
    assert.ok(a?.held === true || a?.reading === "opens" || a?.reading === "already-unlocked", `${tag} unlock: ${JSON.stringify(a)}`);
    assert.ok((a?.faceReadings ?? []).every((f) => f.reading === "opened"), `${tag} every face opens: ${JSON.stringify(a)}`);
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
const PLAIN = "lar:///ha.ka.ba/notes/plain-record";
const PAGE = "lar:///ha.ka.ba/notes/shared-page";
const FREE = "plain note";

/** Run the instrument over the exporting house's snapshot and the standing new house; answers its exit and its receipt. */
const witness = (snapshot, fresh, importAnswer) => {
  const r = spawnSync(process.execPath, [tool, "--old", snapshot, "--new", fresh.root, "--new-port", String(fresh.port), "--imports", importAnswer, "--json"], {
    cwd: repo, encoding: "utf8", env: process.env, maxBuffer: 256 * 1024 * 1024,
  });
  let answer = null;
  try { answer = JSON.parse(r.stdout); } catch { assert.fail(`the witness answered no receipt (exit ${r.status}):\n${r.stdout.slice(0, 2000)}\n${r.stderr.slice(-3000)}`); }
  return { status: r.status, answer, stdout: r.stdout };
};

test("a-face-born-after-the-stand-exports: a face `persona new` founds on a standing vessel composes at its birth, so its stage reads and the export carries it", { timeout: 600_000 }, async () => {
  const scratch = mkdtempSync(join(tmpdir(), "lares-carry-parity-late-"));
  let house = null;
  try {
    house = await standHouse("late", "steward");
    house.must(["persona", "new", "1", "--name", "engineer"]);
    await house.unlock();
    const stage = house.lares(["kahua", "list", "--face", "1"]);
    assert.equal(stage.status, 0, `the late face's stage reads: ${stage.stdout}${stage.stderr}`);
    const exported = JSON.parse(house.must(["export", join(scratch, "bundle"), "--json"]).stdout.trim().split("\n").pop());
    assert.deepEqual(exported.data.faces, ["steward", "engineer"]);
    assert.ok(!exported.data.omissions.some((o) => o.kind === "face-unread"), JSON.stringify(exported.data.omissions));
  } finally {
    await house?.stop();
    if (house) rmSync(house.root, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("P2 two real houses: export, import, par; then a deleted meme, a changed meme and a dropped share each read red by name", { timeout: 900_000 }, async () => {
  const scratch = mkdtempSync(join(tmpdir(), "lares-carry-parity-files-"));
  const houses = [];
  try {
    // ── the exporting house: a steward and an engineer, memory in the steward's daemon wiki, one shared wiki ──────────
    const old = await standHouse("old", "steward");
    houses.push(old);
    old.must(["persona", "new", "1", "--name", "engineer"]);
    old.must(["wiki", "init", "notes", "--json"]);
    old.must(["wiki", "share", "notes", "--read", "engineer"]);
    // A wiki that holds no page carries by its catalog row, beside its share row.
    old.must(["wiki", "init", "quiet", "--json"]);
    old.must(["wiki", "share", "quiet", "--read", "engineer"]);
    await old.unlock();
    // The rite holds each workbench before the export (a cold wiki reads `document-unavailable`), and the wiki carries a page,
    // so its workbench travels and the import re-stands it (an empty wiki carries its share row alone).
    old.must(["wiki", "hold", "notes"]);
    old.must(["wiki", "hold", "quiet"]);
    const page = join(scratch, "page.mem");
    writeFileSync(page, memeText(PAGE, "a page on the shared wiki", ""));
    old.must(["meme", "put", PAGE, "--recipe", "notes", "--file", page, "--json"]);
    for (const [uri, body, meta] of [[HERON, "remember the heron", `tags = "stage/index"\ndescription = "the heron"\n`], [POND, "the pond at dusk", ""], [KITE, "fly the kite low", ""]]) {
      const file = join(scratch, `${uri.split("/").pop()}.mem`);
      writeFileSync(file, memeText(uri, body, meta));
      old.must(["meme", "put", uri, "--recipe", "default", "--file", file, "--json"]);
    }
    // Plain records (no uri-path): one under a stable name, and one under a free title, which the mirror sites at the flattened
    // default (`plain note.tid`) and the carry names by the title its own file states.
    old.must(["tiddler", "put", PLAIN, "--recipe", "default", "--text", "a plain record", "--json"]);
    old.must(["tiddler", "put", FREE, "--recipe", "default", "--text", "a free-titled note", "--json"]);
    const bundle = join(scratch, "bundle");
    old.must(["export", bundle, "--json"]);
    // THE SNAPSHOT BEFORE DOWN: the rite takes the exporting house down before the new one stands (one image tag, one port),
    // so its census rests in a file and every comparison below reads it with the exporting house stopped.
    const snapshot = join(scratch, "census-old.json");
    const taken = spawnSync(process.execPath, [tool, "census", "--root", old.root, "--port", String(old.port), "--label", "old", "--out", snapshot], { cwd: repo, encoding: "utf8", env: process.env });
    assert.equal(taken.status, 0, taken.stderr);
    await old.stop();

    // ── the brand-new house: the same pet-names, its own keys, then the import ──────────────────────────────────
    const fresh = await standHouse("new", "steward");
    houses.push(fresh);
    fresh.must(["persona", "new", "1", "--name", "engineer"]);
    await fresh.unlock();
    // The import's exit is no verdict here (it exits 1 on an expected stand-off); its --json answer rides to the witness,
    // which reads each stood-off row as a named may-differ.
    const imported = fresh.lares(["import", bundle, "--apply", "--json"]);
    const importAnswer = join(scratch, "import-0.json");
    writeFileSync(importAnswer, imported.stdout);
    assert.equal(JSON.parse(imported.stdout.trim().split("\n").pop()).data?.applied, true, `import: ${imported.stdout}\n${imported.stderr}`);
    fresh.must(["wiki", "hold", "notes"]);
    fresh.must(["wiki", "hold", "quiet"]);

    // ── PAR over the real read doors ────────────────────────────────────────────────────────────────────────────
    const par = witness(snapshot, fresh, importAnswer);
    const parAnswer = par.answer;
    assert.equal(parAnswer.verdict, "par", `${JSON.stringify(parAnswer.differences, null, 1)}\nimport: ${imported.stdout.slice(0, 4000)}`);
    assert.ok(parAnswer.counts.plain >= 2, `the reading saw both plain records: ${JSON.stringify(parAnswer.counts)}`);
    assert.ok(parAnswer.counts.wikis >= 2, `the reading saw both shared wikis: ${JSON.stringify(parAnswer.counts)}`);
    assert.equal(par.status, 0);
    assert.ok(parAnswer.counts.memes >= 3, `the reading saw the carried memes: ${JSON.stringify(parAnswer.counts)}`);
    assert.ok(parAnswer.counts.shares >= 2, `the reading saw both shares: ${JSON.stringify(parAnswer.counts)}`);

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

    const red = witness(snapshot, fresh, importAnswer);
    const redAnswer = red.answer;
    assert.equal(redAnswer.verdict, "red", red.stdout);
    assert.notEqual(red.status, 0);
    const said = redAnswer.differences.map((d) => `${d.class} ${d.kind} ${d.key}`);
    assert.ok(said.includes(`memes missing default ${POND}`), said.join("\n"));
    assert.ok(said.includes(`memes changed default ${KITE}`), said.join("\n"));
    assert.ok(said.includes("shares missing wiki notes"), said.join("\n"));
    // The delete raises a kāpae over the meme in the steward's working layer, and its shadow reads as the delete's own mark.
    assert.ok(said.includes(`kapae extra wikis/daemon-steward ${POND}`), said.join("\n"));
    assert.equal(said.length, 4, `the three planted faults and the delete's kāpae read red, and nothing else:\n${said.join("\n")}`);
  } finally {
    for (const h of houses) await h.stop();
    for (const h of houses) rmSync(h.root, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    rmSync(scratch, { recursive: true, force: true });
  }
});
