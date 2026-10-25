// two-phase-boot — a node composition stands on a floor it does not own, reads its private rows through one seam,
// and tears down whole.
//
// The file runs the BUILT node package (`packages/lararium-node/dist`) in this process over a marked scratch root
// the built `lares vessel found` founded, so the daemon island is a real worker and the store claim a real socket.
//
//   T1  a composition tears down and a second one stands on the SAME floor with a fresh Repo and a fresh daemon
//       island, while the floor's rendezvous name answers a connect throughout.          control: one boot → live
//   T2  a composition handed `sovereign: null` (the floor) reaches no hot or cold carrier row in this process and
//       leaves every private row of the three custody homes byte-identical and mints none.
//                                                                 control: holding the vessel key and handed the
//                                                                 seated readers, the composition runs each boot
//                                                                 reader, reads the archive rows, lands the island's
//                                                                 archive exports through the custody write door, and
//                                                                 both archives rest sealed afterward
//   T3  a boot that refuses frees its store name, whether the refusal lands while the prep stands the Repo or
//       later while the caps compose.                             control: a standing composition holds the name
//                                                                 against a second claim
//   T4  a teardown leaves the caller's server with the faces, gate knocks and listeners it had before.
//                                                                 control: a standing composition holds a face
//   T5  every teardown completes on its daemon island's ack: the composition reaches the island's shutdown by two
//       roads, the handshake runs once, and no road waits out its bound on a worker already terminated.
//                                                                 control: the capture reads this process's warnings
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs, { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import { createServer } from "node:http";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = join(repo, "packages/lares-cli/dist/src/bin/lares.js");

/** Stage a marked scratch root with test custody and the tracked genesis; `found` also founds the place. */
function stage(tag, { found }) {
  const root = mkdtempSync(join(tmpdir(), `lares-two-phase-${tag}-`));
  for (const script of ["test-scratch-marker.mjs", "seed-test-custody.mjs"]) {
    const r = spawnSync(process.execPath, [join(repo, "tools", script), root], { encoding: "utf8", env: { ...process.env, LAR_ROOT: root } });
    assert.equal(r.status, 0, `${script}: ${r.stderr}`);
  }
  if (found) {
    cpSync(join(repo, "genesis"), join(root, "genesis"), { recursive: true });
    // A hearth, by the Stable founding act: its face makes the composition that holds the key stand a veil and read
    // that face's own rows.
    const r = spawnSync(process.execPath, [cli, "vessel", "found", "--hearth", "--name", "two-phase", "--root", root, "--skip-build"], {
      cwd: repo, encoding: "utf8", env: { ...process.env, LAR_ROOT: root },
    });
    assert.equal(r.status, 0, `vessel found --hearth: ${r.stderr}`);
  } else {
    // A genesis the boot can materialize, and no founding: the bootstrap names no daemon doc, so the boot refuses.
    const dir = join(root, "genesis");
    mkdirSync(dir, { recursive: true });
    cpSync(join(repo, "genesis", "seed.json"), join(dir, "seed.json"));
    symlinkSync(join(repo, "genesis", "cas"), join(dir, "cas"));
    // A vessel key, minted inside the staged custody (a key mints only inside a held custody, so a boot at the
    // floor mints none): the boot then reaches its caps and refuses there, over the bootstrap.
    const mint = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import { generateOrLoadVesselIdentity } from ${JSON.stringify(join(repo, "packages/lararium-node/dist/src/node-vessel-identity.js"))};
      import { FsCustodyIo, makeCustodyHolder, seatCustody, vesselCustodyHomes } from ${JSON.stringify(join(repo, "packages/lararium-node/dist/src/index.js"))};
      import { TEST_PASSPHRASE } from ${JSON.stringify(join(repo, "tools/test-custody-route.mjs"))};
      const homes = vesselCustodyHomes();
      const holder = makeCustodyHolder({ io: new FsCustodyIo(homes), homes });
      const opened = await holder.unlock([{ kind: "passphrase", passphrase: TEST_PASSPHRASE }]);
      if (opened.reading !== "opens") throw new Error("the staged custody reads " + opened.reading);
      seatCustody(holder);
      await generateOrLoadVesselIdentity();
      await holder.lock();
    `], { cwd: repo, encoding: "utf8", env: { ...process.env, LAR_ROOT: root } });
    assert.equal(mint.status, 0, `vessel key mint: ${mint.stderr}`);
  }
  return root;
}

/** Does a connect to the store's rendezvous name reach a listener? */
function nameAnswers(socketPath) {
  return new Promise((resolve) => {
    const sock = connect(socketPath);
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("error", () => resolve(false));
  });
}

/** Every file under the custody homes, by path, with a digest of its bytes. */
function homesDigest(homes) {
  const out = {};
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const at = join(dir, e.name);
      if (e.isDirectory()) walk(at);
      else if (e.isFile()) out[at] = createHash("sha256").update(readFileSync(at)).digest("hex");
    }
  };
  for (const dir of new Set(Object.values(homes))) walk(dir);
  return out;
}

/**
 * Record every path this process reads, probes or writes through `node:fs` while `run` runs. The built modules import their fs
 * functions by name, and `syncBuiltinESMExports` moves those live bindings, so a read anywhere in node-main lands
 * here. A worker holds its own `node:fs`; the homes digest reads what a worker wrote.
 */
async function recordingReads(run) {
  const names = ["readFileSync", "openSync", "readdirSync", "existsSync", "statSync", "writeFileSync", "renameSync"];
  const real = Object.fromEntries(names.map((n) => [n, fs[n]]));
  const seen = [];
  for (const n of names) fs[n] = (path, ...rest) => { seen.push(String(path)); return real[n](path, ...rest); };
  const realAsync = fs.promises.readFile;
  fs.promises.readFile = (path, ...rest) => { seen.push(String(path)); return realAsync(path, ...rest); };
  syncBuiltinESMExports();
  try { return { value: await run(), seen }; }
  finally {
    for (const n of names) fs[n] = real[n];
    fs.promises.readFile = realAsync;
    syncBuiltinESMExports();
  }
}

function counting(readers) {
  const calls = { wornMount: 0, personaRoots: 0, walkRecords: 0, archive: 0, veilArchive: 0, veil: 0, writeArchive: 0, writeVeilArchive: 0, outboxKey: 0 };
  const wrapped = {};
  for (const name of Object.keys(calls)) wrapped[name] = (...a) => { calls[name] += 1; return readers[name](...a); };
  return { calls, readers: wrapped };
}

test("a composition tears down off its floor and a fresh one stands on it", { timeout: 600_000 }, async (t) => {
  const prior = { root: process.env.LAR_ROOT, relay: process.env.LAR_HERM_RELAY_PORT };
  const root = stage("live", { found: true });
  const bare = stage("bare", { found: false });
  process.env.LAR_ROOT = root;
  delete process.env.LAR_HERM_RELAY_PORT;
  const node = await import(pathToFileURL(join(repo, "packages/lararium-node/dist/src/index.js")).href);
  const { WebSocketServer } = await import(pathToFileURL(join(repo, "packages/lararium-node/node_modules/ws/wrapper.mjs")).href);
  const httpServer = createServer();
  const wss = new WebSocketServer({ noServer: true });
  // THE CALLER'S SERVER, as the daemon stands it: one dispatcher over the HTTP server, every face and every knock
  // registered through it (`main.ts`). A composition's sockets open through its face gates, each on a knock the
  // dispatcher routes, and its Repo listens on the gate's own server (`gate-sync-server`), so what a composition holds
  // on the caller's server is the faces and knocks live there, plus the server's own listeners.
  const { mountHttpFaceDispatcher } = await import(pathToFileURL(join(repo, "packages/lararium-node/dist/src/http-face-dispatcher.js")).href);
  const mounted = mountHttpFaceDispatcher(httpServer);
  const live = { faces: new Set(), knocks: new Set() };
  const tracked = (set, off, face) => { set.add(face); return () => { set.delete(face); off(); }; };
  const dispatcher = {
    register: (face) => tracked(live.faces, mounted.register(face), face),
    registerUpgrade: (face) => tracked(live.knocks, mounted.registerUpgrade(face), face),
    dispose: () => mounted.dispose(),
  };
  /** What the caller's server holds: live faces and knocks, the server's own listeners, the handed wss's. */
  const held = () => ({
    faces: live.faces.size, knocks: live.knocks.size,
    request: httpServer.listenerCount("request"), upgrade: httpServer.listenerCount("upgrade"),
    connection: wss.listenerCount("connection"),
  });
  const storageDir = node.larDataDir();
  const genesisDir = join(root, "genesis");
  const phases = [];
  const open = (extra) => node.openNodeHerm({
    hostId: "two-phase", wikiId: "lares", storageDir, genesisDir, rootDir: root, wss, httpServer, dispatcher, catalogUrl: null,
    onPhase: (p) => phases.push(p), ...extra,
  });
  let floor = null;
  // T5 reads what this process WARNS: a teardown that asked a terminated island again says so there.
  const warned = [];
  const warn = console.warn;
  console.warn = (...a) => { warned.push(a.map(String).join(" ")); warn(...a); };
  const unackedTeardowns = () => warned.filter((line) => line.includes("graceful shutdown ack failed"));
  try {
    assert.equal(typeof node.standNodeFloor, "function", "the node package exports the floor");
    console.warn("two-phase-boot: capture probe");
    assert.equal(warned.at(-1), "two-phase-boot: capture probe", "T5 control: the capture reads this process's warnings");
    const baseline = held();
    floor = await node.standNodeFloor(storageDir);
    assert.equal(await nameAnswers(floor.storeClaim.socketPath), true, "the floor's name answers before any composition");

    // The carrier table names every private row: a path under a home that a serving, hot or cold row matches.
    const homes = { identity: node.larIdentityDir(), storage: node.larDataDir(), seal: node.larSealHome() };
    const privateRow = (path) => {
      for (const [home, dir] of Object.entries(homes)) {
        if (!path.startsWith(dir + "/")) continue;
        const file = path.slice(dir.length + 1);
        for (const row of node.carrierTable()) {
          if (row.home === home && (row.custody === "serving" || row.custody === "hot" || row.custody === "cold") && row.match.test(file)) return row.row;
        }
      }
      return null;
    };

    // ── T2: the floor composition reads no private row and moves no byte of the homes ─────────────────────────
    const privateRows = () => Object.fromEntries(Object.entries(homesDigest(homes)).filter(([path]) => privateRow(path) !== null));
    const before = privateRows();
    const atFloor = await recordingReads(() => open({ floor, sovereign: null }));
    const zero = atFloor.value;
    assert.equal(phases.at(-1), "live", "T1 control: one composition reaches live");
    await zero.daemon.workerEa;
    assert.ok(atFloor.seen.length > 0, "the read recorder saw this process read (a silent recorder proves nothing)");
    // The floor reaches NO private row. The carried-Nexus reading asks for the persona roster (`carried-set`), the
    // roster rests sealed behind the custody seat, and a floor holds no key: the seat refuses before any file opens.
    const reached = [...new Set(atFloor.seen.map(privateRow).filter(Boolean))];
    assert.deepEqual(reached, [], "T2: the floor reads, probes and writes no hot or cold row");
    await zero.teardown();
    assert.deepEqual(unackedTeardowns(), [], "T5: the floor composition's teardown completes on its island's ack");
    assert.deepEqual(privateRows(), before, "T2: the floor leaves every private row byte-identical and mints none");
    assert.deepEqual(held(), baseline);

    // ── T2 control + T1: handed readers, the composition runs each of them and reads the rows ─────────────────
    // The key opens first, by the staged root's published route: the seated holder then reads and writes the rows.
    const { TEST_PASSPHRASE } = await import(pathToFileURL(join(repo, "tools/test-custody-route.mjs")).href);
    const mesh = await import(pathToFileURL(join(repo, "packages/lararium-mesh/dist/index.js")).href);
    const holder = node.makeCustodyHolder({ io: new node.FsCustodyIo(homes), homes });
    node.seatCustody(holder);
    t.after(async () => { await holder.lock(); node.unseatCustody(holder); });
    assert.equal(node.custodyHeld(), false, "T2: a seated holder that never unlocked holds nothing");
    const route = [{ kind: "passphrase", passphrase: TEST_PASSPHRASE }];
    assert.equal((await holder.unlock(route)).reading, "opens");
    await holder.unlockFaces(route);
    const archiveAt = join(homes.identity, "place-archive.bin");
    const faceDirs = readdirSync(join(homes.identity, "faces"));
    const veilAt = faceDirs.map((d) => join(homes.identity, "faces", d)).flatMap((d) => readdirSync(d).map((name) => join(d, name)))
      .find((path) => /\/veil-archive-g[0-9a-f]{64}\.bin$/.test(path));
    assert.ok(veilAt, "T2 control: no veil-archive-g<64 lowercase hex>.bin row stands in a face's directory");
    const restBefore = { archive: readFileSync(archiveAt), veil: readFileSync(veilAt) };
    phases.length = 0;
    const first = counting(node.seatedSovereignReaders());
    const sovereignly = await recordingReads(() => open({ floor, sovereign: first.readers }));
    const one = sovereignly.value;
    assert.equal(phases.at(-1), "live", "T1: a composition reaches live on the floor a torn-down one stood on");
    await one.daemon.workerEa;
    for (const name of ["wornMount", "personaRoots", "walkRecords", "archive", "veilArchive", "writeArchive", "writeVeilArchive", "outboxKey"]) {
      assert.ok(first.calls[name] >= 1, `T2 control: the ${name} reader ran (${first.calls[name]})`);
    }
    // The island's exports landed through the custody write door: both rows moved, and both rest sealed.
    for (const [name, at] of [["archive", archiveAt], ["veil", veilAt]]) {
      const now = readFileSync(at);
      assert.equal(name === "veil" ? mesh.readFckCarrier(now) : mesh.readVkCarrier(now), "sealed", `T2 control: the ${name} archive rests sealed under its key`);
      assert.equal(now.equals(restBefore[name]), false, `T2 control: the island's ${name} export replaced the row`);
    }
    const rowsRead = new Set(sovereignly.seen.map(privateRow).filter(Boolean));
    assert.ok(rowsRead.has("place-archive"), `T2 control: the sovereign composition reaches the archive row (reached: ${[...rowsRead].join(", ") || "none"})`);
    assert.notEqual(one.repo, zero.repo, "T1: a fresh Repo");
    assert.notEqual(one.daemon, zero.daemon, "T1: a fresh daemon island");
    // A herm stands a gate knock only at a Nexus whose carriage board counts a carry for it (`gateNexuses`), and this
    // one is carried nowhere: what it holds on the server is its bulb read face.
    assert.ok(live.faces.size + live.knocks.size > baseline.faces + baseline.knocks,
      `T4 control: a standing composition holds a face on the server (${JSON.stringify(held())})`);
    await assert.rejects(node.standNodeFloor(storageDir), (e) => e?.constructor?.name === "StoreHeld",
      "T3 control: a standing composition holds the store against a second claim");

    // ── T1 / T4: tear down; the floor still answers; the server holds its listeners as before ─────────────────
    await one.teardown();
    assert.deepEqual(unackedTeardowns(), [], "T5: the sovereign composition's teardown completes on its island's ack");
    assert.deepEqual(held(), baseline, "T4: the teardown removes every listener it added");
    assert.equal(existsSync(floor.storeClaim.socketPath), true, "T1: the floor's name stands between compositions");
    assert.equal(await nameAnswers(floor.storeClaim.socketPath), true, "T1: the floor's name answers between compositions");

    // A third composition stands on the same floor: the teardown left nothing a later stand trips on.
    const three = await open({ floor, sovereign: null });
    await three.daemon.workerEa;
    await three.teardown();
    assert.deepEqual(unackedTeardowns(), [], "T5: a third composition's teardown completes on its island's ack");
    assert.deepEqual(held(), baseline);

    // ── T3: a refusal while the prep stands the Repo frees the store name ────────────────────────────────────
    await floor.release();
    floor = null;
    await assert.rejects(open({ catalogUrl: "automerge:not-a-document" }), /./, "a catalog address no Repo parses refuses the boot");
    const afterPrepRefusal = await node.standNodeFloor(storageDir);
    await afterPrepRefusal.release();
    assert.deepEqual(held(), baseline, "T3: a boot refused in its prep leaves no listener behind");

    // ── T3: a refusal while the caps compose frees the store name ─────────────────────────────────────────────
    process.env.LAR_ROOT = bare;
    const bareStorage = node.larDataDir();
    await assert.rejects(
      node.openNodeHerm({ hostId: "two-phase", wikiId: "lares", storageDir: bareStorage, genesisDir: join(bare, "genesis"), rootDir: bare, wss, httpServer, dispatcher, catalogUrl: null }),
      /names no daemon doc/,
    );
    const again = await node.standNodeFloor(bareStorage);
    await again.release();
    assert.deepEqual(held(), baseline, "T3: the refused boot leaves no listener behind");
  } catch (e) {
    // Said at once: a composition that leaks a handle keeps this process alive past the runner's own report.
    console.error(`TWO-PHASE-BOOT FAILED: ${e?.stack ?? e}`);
    throw e;
  } finally {
    console.warn = warn;
    await floor?.release();
    mounted.dispose();
    httpServer.close();
    if (prior.root === undefined) delete process.env.LAR_ROOT; else process.env.LAR_ROOT = prior.root;
    if (prior.relay !== undefined) process.env.LAR_HERM_RELAY_PORT = prior.relay;
    rmSync(root, { recursive: true, force: true });
    rmSync(bare, { recursive: true, force: true });
    t.diagnostic(`active resources after teardown: ${process.getActiveResourcesInfo().join(", ") || "none"}`);
    // The runner reports once this process ends; a handle some library keeps never holds the report hostage.
    setTimeout(() => process.exit(), 3_000).unref();
  }
});
