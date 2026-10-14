#!/usr/bin/env node
// capability-inventory — what each composed vessel hands each island, MEASURED, held against one committed table.
//
// An island reaches the vessel through four doors: FETCH (`cas:want`, the blobs its tiddlers name), REST (`doc:rest`,
// the vessel's store saves a document it minted), CUSTODY WRITE (`custody:write`, the main thread seals bytes under
// the vessel key) and DYAD (`dyad:ask`, what a device's edge reads on the fleet board). Which doors an island
// reaches decides what code running inside it can make the vessel do. This tool reads that for both assemblies:
//
//   node  the real spawn functions (`nodeSpawnDaemonWorker` · `nodeSpawnWikiWorker` · `nodeSpawnSessionWorker`,
//         packages/lararium-node/dist/src/worker-handle.js) spawn a real worker_threads probe. The probe posts
//         each ask; the vessel's doors stand as stand-ins that GRANT every ask, so a reply that grants means the
//         class reaches that door, a reply that refuses means the class meets it refused by name, and no reply
//         means the class reaches nothing there. The probe learns "no reply" by HANDSHAKE, never by a clock: it
//         posts `probe:done` after its asks, the vessel side answers `probe:end` one event-loop turn later, and
//         the port delivers in order, so every reply the doors posted arrives first.
//   web   the browser assembly's door code (packages/lararium-browser/dist/browser-dyad-door.js) runs over a
//         stand-in worker handle, attached the way each spawn seam attaches it; Node runs no Web Worker, so the
//         handle stands in for the worker and the door code itself runs whole.
//
// WHICH SEAM HANDS WHICH CLASS reads from the source: every call that wraps or spawns an island, or attaches a
// door to one, anywhere under packages/*/src, stands in the committed table by file and function. A new call site,
// a seam that left, or a door that a class reaches where the table says it did not reads RED, naming the row. A deliberate change re-writes the table (`--write`) in the commit
// that makes it, so a capability never widens unnoticed.
//
//   node tools/capability-inventory.mjs           measure, print the table, and hold it against the committed one
//   node tools/capability-inventory.mjs --write   measure and write tools/capability-inventory.json
//
// Exit: 0 the measured inventory equals the committed one · 1 a row moved, a seam moved, or a call stands unnamed ·
// 2 the built tree stands absent (build first: the inventory measures dist, as a household runs it).
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TABLE = join(ROOT, "tools/capability-inventory.json");
export const DOORS = ["fetch", "rest", "custody", "dyad"];

// ── the outcome of one ask ────────────────────────────────────────────────────────────────────────
/** Read one reply against the stand-in door that grants everything: `grants`, `refused`, or `silent` (no reply). */
export function outcomeOf(door, reply) {
  if (reply === undefined) return "silent";
  switch (door) {
    case "fetch":   return reply.type === "cas:block" && reply.bytes != null ? "grants" : "refused";
    case "rest":    return reply.type === "doc:rested" && reply.rested === true ? "grants" : "refused";
    case "custody": return reply.type === "custody:written" && reply.written === true ? "grants" : "refused";
    case "dyad":    return reply.type === "dyad:read" && reply.standing === "clear" ? "grants" : "refused";
    default:        throw new Error(`unknown door ${door}`);
  }
}

/** The four asks an island posts, one per door, each on its own request id. */
export function asksOf(version) {
  return [
    { door: "fetch",   msg: { schema_version: version, type: "cas:want", requestId: "probe-fetch", cid: "bafkprobe" } },
    { door: "rest",    msg: { schema_version: version, type: "doc:rest", requestId: "probe-rest", documentIds: ["probe-document"] } },
    { door: "custody", msg: { schema_version: version, type: "custody:write", requestId: "probe-custody", carrier: "archive", bytes: new Uint8Array([1]) } },
    { door: "dyad",    msg: { schema_version: version, type: "dyad:ask", requestId: "probe-dyad", fleetRoot: "probe-fleet", deviceKey: "probe-device" } },
  ];
}

// ── the seams, read from source ───────────────────────────────────────────────────────────────────
/** Every call that wraps or spawns an island, by the function it calls. */
export const SEAM_CALLS = /\b(nodeSpawnDaemonWorker|nodeSpawnWikiWorker|nodeSpawnSessionWorker|nodeWorkerHandle|attachBrowserDyadDoor|refuseBrowserDyadAsks|browserSpawnWorker|browserWorkerHandle|holderWorkerHandle)\s*\(/g;

/** Each call site under packages/<pkg>/src (tests and declarations aside), as `file: line`. */
export function seamCallSites(root, readDir = readdirSync, readFile = (p) => readFileSync(p, "utf8")) {
  const sites = [];
  const pkgs = join(root, "packages");
  for (const pkg of readDir(pkgs).sort()) {
    const src = join(pkgs, pkg, "src");
    try { readDir(src); } catch { continue; }   // a package with no src/ holds no seam
    const walk = (dir) => {
      for (const name of readDir(dir).sort()) {
        const p = join(dir, name);
        if (!name.includes(".")) { try { walk(p); } catch { /* a file with no extension holds no seam */ } continue; }
        if (!/\.ts$/.test(name) || /\.(test|d)\.ts$/.test(name)) continue;
        const lines = readFile(p).split("\n");
        lines.forEach((line, i) => {
          if (/^\s*(\*|\/\/)/.test(line) || /^\s*export function\b/.test(line)) return;   // a comment or the definition names no seam
          for (const m of line.matchAll(SEAM_CALLS)) sites.push(`${relative(root, p)}: ${m[1]}(… line ${i + 1}`);
        });
      }
    };
    walk(src);
  }
  return sites.map((s) => s.replace(/ line \d+$/, ""));
}

// ── the measurements ──────────────────────────────────────────────────────────────────────────────
/** The probe module: it posts the four asks, keeps every reply, and hands them back once the vessel side says end. */
export function probeSource(asks) {
  const wire = asks.map((a) => ({ ...a.msg, ...(a.msg.bytes ? { bytes: [...a.msg.bytes] } : {}) }));
  return `import { parentPort } from "node:worker_threads";
const asks = ${JSON.stringify(wire)}.map((a) => (a.bytes ? { ...a, bytes: new Uint8Array(a.bytes) } : a));
const replies = {};
parentPort.on("message", (m) => {
  if (m && m.type === "probe:end") { parentPort.postMessage({ type: "probe:result", replies }); return; }
  if (m && typeof m.requestId === "string") replies[m.requestId] = m;
});
for (const a of asks) parentPort.postMessage(a);
parentPort.postMessage({ type: "probe:done" });
`;
}

/** The node spawn functions, each named by the class the vessel's seams call it for. */
export const NODE_SPAWNS = [["daemon", "nodeSpawnDaemonWorker"], ["wiki", "nodeSpawnWikiWorker"], ["session", "nodeSpawnSessionWorker"]];

async function measureNode(dist) {
  const handleMod = await import(pathToFileURL(join(dist.node, "worker-handle.js")).href);
  const { ISLAND_PROTOCOL_VERSION } = await import(pathToFileURL(join(dist.mesh, "index.js")).href);
  const asks = asksOf(ISLAND_PROTOCOL_VERSION);
  // Stand-in doors that grant every ask.
  handleMod.setCasDoor(async () => new Uint8Array([7]));
  handleMod.setRestDoor(async () => {});
  handleMod.setCustodyWriteDoor(async () => {});
  handleMod.setDyadDoor(() => "clear");
  const dir = mkdtempSync(join(tmpdir(), "capability-probe-"));
  const probe = pathToFileURL(join(dir, "probe.mjs"));
  writeFileSync(probe, probeSource(asks));
  // The real spawn function, exactly as the vessel calls it: a URL in, a handle out.
  const spawnOne = (spawn) => new Promise((resolve, reject) => {
    const handle = spawn(probe);
    handle.onError(reject);
    handle.listen((m) => {
      // One event-loop turn after the probe's last ask: every door answer the vessel side owed stands posted.
      if (m && m.type === "probe:done") setImmediate(() => handle.post({ type: "probe:end" }));
      else if (m && m.type === "probe:result") { handle.terminate(); resolve(m.replies); }
    });
  });
  const rows = {};
  try {
    for (const [cls, fn] of NODE_SPAWNS) {
      const replies = await spawnOne(handleMod[fn]);
      rows[`node ${cls}`] = Object.fromEntries(asks.map((a) => [a.door, outcomeOf(a.door, replies[a.msg.requestId])]));
    }
  } finally {
    handleMod.setCasDoor(null); handleMod.setRestDoor(null); handleMod.setCustodyWriteDoor(null); handleMod.setDyadDoor(null);
    rmSync(dir, { recursive: true, force: true });
  }
  return rows;
}

async function measureWeb(dist) {
  const door = await import(pathToFileURL(join(dist.browser, "browser-dyad-door.js")).href);
  const { ISLAND_PROTOCOL_VERSION } = await import(pathToFileURL(join(dist.mesh, "index.js")).href);
  const asks = asksOf(ISLAND_PROTOCOL_VERSION);
  const run = async (attach) => {
    const listeners = []; const replies = {};
    const handle = { listen: (cb) => { listeners.push(cb); return () => {}; }, post: (m) => { if (m && typeof m.requestId === "string") replies[m.requestId] = m; } };
    attach(handle);
    for (const a of asks) for (const cb of listeners) cb(a.msg);
    // The door code answers through promises: one event-loop turn lets every one of them settle.
    await new Promise((r) => setImmediate(r));
    return Object.fromEntries(asks.map((a) => [a.door, outcomeOf(a.door, replies[a.msg.requestId])]));
  };
  const warn = console.warn; console.warn = () => {};
  try {
    return {
      "web daemon": await run((h) => door.attachBrowserDyadDoor(h, () => () => "clear")),
      "web wiki":   await run((h) => door.refuseBrowserDyadAsks(h)),
    };
  } finally { console.warn = warn; }
}

export async function measure(root = ROOT) {
  const dist = {
    node: join(root, "packages/lararium-node/dist/src"),
    mesh: join(root, "packages/lararium-mesh/dist"),
    browser: join(root, "packages/lararium-browser/dist"),
  };
  for (const [name, p] of Object.entries({ node: join(dist.node, "worker-handle.js"), mesh: join(dist.mesh, "index.js"), browser: join(dist.browser, "browser-dyad-door.js") })) {
    if (!existsSync(p)) { const e = new Error(`the built ${name} tree stands absent (${relative(root, p)}); build first`); e.code = "UNBUILT"; throw e; }
  }
  const islands = { ...(await measureNode(dist)), ...(await measureWeb(dist)) };
  return { islands, callSites: seamCallSites(root) };
}

/** Every difference between the measured inventory and the committed table, one plain line each. */
export function differences(measured, committed) {
  const out = [];
  const rows = new Set([...Object.keys(measured.islands), ...Object.keys(committed.islands)]);
  for (const row of [...rows].sort()) {
    const m = measured.islands[row]; const c = committed.islands[row];
    if (!m) { out.push(`${row}: the table names it, and nothing measured it`); continue; }
    if (!c) { out.push(`${row}: measured, and the table never names it`); continue; }
    for (const d of DOORS) if (m[d] !== c[d]) out.push(`${row} ${d}: the table says ${c[d]}, the vessel ${m[d] === "grants" ? "GRANTS" : m[d]}`);
  }
  const named = new Set(committed.callSites);
  for (const site of measured.callSites) if (!named.has(site)) out.push(`${site}: a call that wraps or spawns an island stands where the table names no seam`);
  const found = new Set(measured.callSites);
  for (const site of committed.callSites) if (!found.has(site)) out.push(`${site}: the table names this seam, and the source no longer holds it`);
  return out;
}

function table(inv) {
  const lines = [`island            ${DOORS.map((d) => d.padEnd(9)).join("")}`];
  for (const [row, doors] of Object.entries(inv.islands)) lines.push(`${row.padEnd(18)}${DOORS.map((d) => doors[d].padEnd(9)).join("")}`);
  return lines.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let measured;
  try { measured = await measure(); }
  catch (e) { if (e.code === "UNBUILT") { console.error(`capability-inventory: ${e.message}`); process.exit(2); } throw e; }
  if (process.argv.includes("--write")) {
    writeFileSync(TABLE, JSON.stringify(measured, null, 2) + "\n");
    console.log(table(measured));
    console.log(`capability-inventory: wrote ${relative(ROOT, TABLE)}`);
    process.exit(0);
  }
  const committed = JSON.parse(readFileSync(TABLE, "utf8"));
  console.log(table(measured));
  const moved = differences(measured, committed);
  if (moved.length) {
    console.log(`RED capability-inventory: ${moved.length} row(s) moved since the committed table`);
    for (const m of moved) console.log(`  ${m}`);
    console.log("  A deliberate change re-writes the table in the commit that makes it: node tools/capability-inventory.mjs --write");
    process.exit(1);
  }
  console.log("PASS capability-inventory: every island holds exactly the doors the committed table names");
}
