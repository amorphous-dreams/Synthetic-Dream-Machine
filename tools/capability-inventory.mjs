#!/usr/bin/env node
// capability-inventory — which vessel doors each composed island REACHES, measured, held against one committed table.
//
// An island reaches the vessel through four doors: FETCH (`cas:want`, the blobs its tiddlers name), REST (`doc:rest`,
// the vessel's store saves a document it minted), CUSTODY WRITE (`custody:write`, the main thread seals bytes under
// the vessel key) and DYAD (`dyad:ask`, what a device's edge reads on the fleet board). Which doors an island
// reaches decides what code running inside it can make the vessel do.
//
// THE TABLE MEASURES REACH, NEVER A DOOR'S POLICY. A cell reads `grants` when the ask reached a door (on node the
// door itself counts the call) or drew a reply in a granting shape, `refused` when only a refusal answered, and
// `silent` when nothing answered and no door ran. On node every door stands as a stand-in that grants every ask and
// counts each call against the row open at the call, so a cell says whether an ask from that class arrives at a door
// at all; what the real door would
// answer a real ask (a miss, a refusal, `aside`) stays outside this table. Every reply on a request id counts, the
// first and the last alike.
//
// Each row drives the real code that builds that class's handle:
//
//   node daemon         `nodeSpawnDaemonWorker`, the one spawn function the daemon VM's seam calls (the seam reading
//                       below holds that the seam still calls it), around a worker_threads probe.
//   node wiki/session   `VesselIslandPool`'s OWN host spawn, called exactly as the pool core calls it (no argument
//                       for a wiki, `{ session: true }` for a session), around the same probe.
//   web wiki/session    `BrowserVesselIslandPool`'s OWN host spawn, called the same way, over a stand-in Web Worker:
//                       Node runs no Web Worker, so the stand-in takes the `Worker` constructor's place and posts the
//                       asks as the island would; `browserSpawnWorker`, `browserWorkerHandle` and every listener the
//                       pool attaches run whole. The browser holds no door module to stand in for, so these rows read
//                       replies, and they also count the message listeners the spawn attached: a new responder on the
//                       handle moves that count even where its answer would arrive late.
//   web daemon          UNMEASURED. Its spawn seam (the dedicated worker or the shared holder's port, then the dyad
//                       door) stands as a closure inside `openBrowserVessel`, which Node cannot open. A row this
//                       tool cannot drive reads `unmeasured` in every cell, never `silent`.
//
// OUTSIDE EVERY ROW: the pool core's own listener on each island (VesselIslandPoolCore `_wireWorkerListeners`), which
// answers a session island's view asks (`view:catalog`, `view:content`) behind that session's view gate. On node the
// content reader behind `view:content` ends at the fetch door, so a session island reaches fetched bytes through its
// view, as the view's gate decides. The source readings below hold that route's spelling; no row drives it.
//
// A node probe learns "no reply" by HANDSHAKE, never by a clock: it posts `probe:done` after its asks, the vessel side
// answers `probe:end` one event-loop turn later, and the port delivers in order. A stand-in door counts its call when
// a handler calls it: a door called before its reply still reads `grants` however late the reply, and a door called
// after its row closed reads red as `node late` one turn on. A handler that waits longer than that before it calls a
// door reads `silent`: the turn bounds what a row sees, and the source readings carry the rest. Each row closes one
// turn before the next opens, so a late call never counts under the next row. The stand-in Web
// Worker reads replies one event-loop turn after its last ask, through `addEventListener` and `onmessage` alike; a
// browser responder that answers later reads `silent` there, and its listener count and the source readings carry it.
// A reply sent down another port (a sync channel) never reaches a row.
//
// TWO SOURCE READINGS hold what no row drives, each as a MULTISET per file (a second call in one file reads as a
// change; a move between two places in ONE file does not):
//   seams     every reference under packages/*/src to a function that spawns or wraps an island, attaches it a
//             door, or answers a door's ask, called or passed by reference (`spawnWorker ?? browserSpawnWorker`),
//             every reference to `Worker` or `SharedWorker`, and every rename of one of those functions (an import
//             `as`, a `const x = name`, a destructured `name: x`) with each later use of the new name; import and
//             re-export clauses, comments and the defined name itself aside (a scanner tracks strings, so a `/*`
//             inside a string or a `//` comment hides nothing);
//   asks      every quoted ask or answer type of the island protocol's doors and view: a new responder anywhere (the
//             mesh core, a vessel's spawn closure, the shared holder) adds one.
// A LIMIT OF THE SOURCE READINGS: they count names, not values. A local that already holds a seam (a lifted closure, a
// `let` assigned later, an object property) passed on to a second consumer moves no count; a row that drives the
// consumer reads it, and a row this tool cannot drive does not.
// A door a class reaches where the table says it did not, a new or extra seam, a seam that left, or a new ask
// mention reads RED, naming the row. A deliberate change re-writes the table (`--write`) in the commit that makes it.
//
//   node tools/capability-inventory.mjs           measure, print the table, and hold it against the committed one
//   node tools/capability-inventory.mjs --write   measure and write tools/capability-inventory.json
//
// Exit: 0 the measured inventory equals the committed one · 1 a row moved, a seam or ask moved, or a call stands
// unnamed · 2 the built tree stands absent (build first: the inventory measures dist, as a household runs it).
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TABLE = join(ROOT, "tools/capability-inventory.json");
export const DOORS = ["fetch", "rest", "custody", "dyad"];
export const UNMEASURED = Object.freeze(Object.fromEntries(DOORS.map((d) => [d, "unmeasured"])));

// ── the outcome of one ask ────────────────────────────────────────────────────────────────────────
/** Whether one reply carries the granting shape of its door's answer. */
export function grantingReply(door, reply) {
  switch (door) {
    case "fetch":   return reply?.type === "cas:block" && reply.bytes != null;
    case "rest":    return reply?.type === "doc:rested" && reply.rested === true;
    case "custody": return reply?.type === "custody:written" && reply.written === true;
    case "dyad":    return reply?.type === "dyad:read" && reply.standing === "clear";
    default:        throw new Error(`unknown door ${door}`);
  }
}

/**
 * Read one ask: `grants` when the door ran for it or any reply carries the granting shape, `refused` when replies
 * came and none grants, `silent` when nothing answered and no door ran. `replies` holds EVERY reply on the request id.
 */
export function outcomeOf(door, replies, doorRan = false) {
  const all = replies === undefined ? [] : Array.isArray(replies) ? replies : [replies];
  if (doorRan || all.some((r) => grantingReply(door, r))) return "grants";
  return all.length ? "refused" : "silent";
}

/** The four asks an island posts, one per door, each on its own request id. */
export function asksOf() {
  return [
    { door: "fetch",   msg: { type: "cas:want", requestId: "probe-fetch", cid: "bafkprobe" } },
    { door: "rest",    msg: { type: "doc:rest", requestId: "probe-rest", documentIds: ["probe-document"] } },
    { door: "custody", msg: { type: "custody:write", requestId: "probe-custody", carrier: "veil", bytes: new Uint8Array([1]) } },
    { door: "dyad",    msg: { type: "dyad:ask", requestId: "probe-dyad", fleetRoot: "probe-fleet", deviceKey: "probe-device" } },
  ];
}

// ── the source readings ───────────────────────────────────────────────────────────────────────────
/** The functions that spawn or wrap an island, attach it a door, or answer a door's ask. */
export const SEAM_NAMES = [
  "nodeSpawnDaemonWorker", "nodeSpawnWikiWorker", "nodeSpawnSessionWorker", "nodeWorkerHandle",
  "attachBrowserDyadDoor", "refuseBrowserDyadAsks", "browserSpawnWorker", "browserWorkerHandle", "holderWorkerHandle",
  "answerDocRest", "answerCustodyWrite", "answerDyadAsk", "answerBrowserDyadAsk", "fetchThroughCasDoor",
];
const SEAM_REF = new RegExp(`\\b(${SEAM_NAMES.join("|")})\\b`, "g");
const WORKER_REF = /\b(Worker|SharedWorker)\b/g;
const CODE_ALIAS = new RegExp(`(?:\\b(?:const|let|var)\\s+([\\w$]+)\\s*=\\s*(?:await\\s+)?(${SEAM_NAMES.join("|")})\\b(?!\\s*\\()|\\b(${SEAM_NAMES.join("|")})\\s*:\\s*([\\w$]+))`, "g");
const SEAM_ALIAS = new RegExp(`\\b(${SEAM_NAMES.join("|")})\\s+as\\s+([\\w$]+)`, "g");
/** The ask and answer types of the four doors and of a session's view, as source spells them. */
export const ASK_TYPES = [
  "cas:want", "cas:block", "doc:rest", "doc:rested", "custody:write", "custody:written", "dyad:ask", "dyad:read",
  "view:catalog", "view:catalog-result", "view:content", "view:content-result", "view:settle", "view:settled",
];
const ASK_REF = new RegExp(`["'\`](${ASK_TYPES.join("|")})["'\`]`, "g");

/** Every `.ts` source file under packages/<pkg>/src (tests and declarations aside), sorted. */
function sourceFiles(root, readDir) {
  const out = [];
  const pkgs = join(root, "packages");
  for (const pkg of readDir(pkgs).sort()) {
    const src = join(pkgs, pkg, "src");
    try { readDir(src); } catch { continue; }   // a package with no src/ holds no seam
    const walk = (dir) => {
      for (const name of readDir(dir).sort()) {
        const p = join(dir, name);
        if (!/\.ts$/.test(name)) { try { walk(p); } catch { /* a file, not a folder: no seam */ } continue; }
        if (/\.(test|d)\.ts$/.test(name)) continue;
        out.push(p);
      }
    };
    walk(src);
  }
  return out;
}

/**
 * Drop the comments from one file, keeping every string and regex literal as written: a scanner walks the characters
 * and tracks whether it stands inside a quoted or template string, a regex literal, a `//` comment or a block
 * comment, so a `/*` inside a string, a regex or after `//` opens nothing. A `/` opens a regex where an expression
 * may begin (after `( = , : [ ! & | ? { } ; + - * % < > ~ ^` or `return`, or at a line's start). Returns the lines,
 * comments blanked, and the mode the file ends in: anything but `code` or `line` reads red by name.
 */
export function stripComments(text) {
  let out = ""; let mode = "code"; let quote = ""; let inClass = false; let last = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i]; const n = text[i + 1];
    if (mode === "code") {
      if (c === "/" && n === "/") { mode = "line"; i++; continue; }
      if (c === "/" && n === "*") { mode = "block"; i++; continue; }
      if (c === "/" && (last === "" || /[(=,:[!&|?{};+\-*%<>~^]/.test(last) || /\breturn\s*$/.test(out.slice(-12)))) { mode = "regex"; inClass = false; out += c; continue; }
      if (c === "\"" || c === "'" || c === "`") { mode = "string"; quote = c; }
      out += c;
      if (c === "\n") last = ""; else if (!/\s/.test(c)) last = c;
    } else if (mode === "string" || mode === "regex") {
      out += c;
      if (c === "\\") { if (n !== undefined) out += n; i++; continue; }
      if (mode === "regex") {
        if (c === "[") inClass = true;
        else if (c === "]") inClass = false;
        else if (c === "/" && !inClass) { mode = "code"; last = "/"; }
        else if (c === "\n") { mode = "code"; last = ""; }   // a lone slash read as a regex ends with its line
        continue;
      }
      if (c === quote) { mode = "code"; last = c; }
      else if (c === "\n" && quote !== "`") { mode = "code"; last = ""; }   // an unclosed quote ends with its line
    } else if (mode === "line") {
      if (c === "\n") { mode = "code"; out += c; last = ""; }
    } else if (c === "*" && n === "/") { mode = "code"; i++; }
    else if (c === "\n") out += c;
  }
  const lines = out.split("\n");
  lines.endsIn = mode === "line" ? "code" : mode === "string" ? `string ${quote}` : mode;
  return lines;
}

/** Split one file into the code a reading counts and the module clauses (import and re-export statements). */
function readSource(text) {
  const code = []; const clauses = [];
  let inClause = false;
  const lines = stripComments(text);
  for (const line of lines) {
    if (!line.trim()) continue;
    if (inClause) { clauses.push(line); if (line.includes("}")) inClause = false; continue; }
    if (/^\s*import\b/.test(line) || /^\s*export\s*(type\s*)?\{/.test(line) || /^\s*export\s*\*/.test(line)) {
      clauses.push(line);
      if (line.includes("{") && !line.includes("}")) inClause = true;
      continue;
    }
    code.push(line);
  }
  return { code, clauses, endsIn: lines.endsIn };
}

/** Each seam reference under packages/<pkg>/src, called or passed by reference, as `file: name` (one per occurrence). */
export function seamCallSites(root, readDir = readdirSync, readFile = (p) => readFileSync(p, "utf8")) {
  const sites = [];
  for (const p of sourceFiles(root, readDir)) {
    const file = relative(root, p);
    const { code, clauses, endsIn } = readSource(readFile(p));
    // A file the scanner leaves inside a comment, a string or a regex hid code from both readings: that reads red.
    if (endsIn !== "code") sites.push(`${file}: the scanner ends inside a ${endsIn}`);
    const aliases = [];
    for (const clause of clauses) for (const m of clause.matchAll(SEAM_ALIAS)) { sites.push(`${file}: ${m[1]} as ${m[2]}`); aliases.push(m[2]); }
    for (const line of code) for (const m of line.matchAll(CODE_ALIAS)) {
      const [name, alias] = m[1] ? [m[2], m[1]] : [m[3], m[4]];
      if (name !== alias) { sites.push(`${file}: ${name} as ${alias}`); aliases.push(alias); }
    }
    const aliasRef = aliases.length ? new RegExp(`\\b(${aliases.join("|")})\\b`, "g") : null;
    for (const raw of code) {
      const line = raw.replace(/^(\s*export\s+(?:async\s+)?function\s*\*?\s*)[\w$]+/, "$1");   // the defined name names no seam
      for (const m of line.matchAll(SEAM_REF)) sites.push(`${file}: ${m[1]}`);
      for (const m of line.matchAll(WORKER_REF)) sites.push(`${file}: ${m[1]}`);
      // A use of a renamed seam counts; the line that makes the rename counted it already, as `name as alias`.
      if (aliasRef && ![...line.matchAll(CODE_ALIAS)].length) for (const m of line.matchAll(aliasRef)) sites.push(`${file}: ${m[1]}`);
    }
  }
  return sites;
}

/** Each quoted ask or answer type under packages/<pkg>/src, as `file: "type"` (one per occurrence). */
export function askMentions(root, readDir = readdirSync, readFile = (p) => readFileSync(p, "utf8")) {
  const sites = [];
  for (const p of sourceFiles(root, readDir)) {
    for (const line of readSource(readFile(p)).code) for (const m of line.matchAll(ASK_REF)) sites.push(`${relative(root, p)}: "${m[1]}"`);
  }
  return sites;
}

// ── the measurements ──────────────────────────────────────────────────────────────────────────────
/** The probe module: it posts the four asks, keeps EVERY reply, and hands them back once the vessel side says end. */
export function probeSource(asks) {
  const wire = asks.map((a) => ({ ...a.msg, ...(a.msg.bytes ? { bytes: [...a.msg.bytes] } : {}) }));
  return `import { parentPort } from "node:worker_threads";
const asks = ${JSON.stringify(wire)}.map((a) => (a.bytes ? { ...a, bytes: new Uint8Array(a.bytes) } : a));
const replies = {};
parentPort.on("message", (m) => {
  if (m && m.type === "probe:end") { parentPort.postMessage({ type: "probe:result", replies }); return; }
  if (m && typeof m.requestId === "string") (replies[m.requestId] ??= []).push(m);
});
for (const a of asks) parentPort.postMessage(a);
parentPort.postMessage({ type: "probe:done" });
`;
}

/** How the pool core calls its host's spawn for each class (VesselIslandPoolCore: `plan.surface ? { session: true } : undefined`). */
export const POOL_SPAWN_ARGS = [["wiki", undefined], ["session", { session: true }]];

/** A pool's own host spawn, read off a constructed pool; a pool whose host stands unreachable throws by name. */
export function poolSpawnOf(pool, label) {
  const host = pool && pool._host;
  if (!host || typeof host.spawnWorker !== "function") throw new Error(`${label}: the pool's host spawn stands unreachable; the inventory cannot measure through it`);
  return (args) => host.spawnWorker(args);
}

const resolveNoPlugins = async () => ({ ok: true, pluginCids: [] });

/** Each node row and the spawn that builds its handle: the daemon's spawn function, then the pool's OWN host spawn per class. */
export function nodeSpawnPlan(handleMod, VesselIslandPool, probe) {
  const spawn = poolSpawnOf(new VesselIslandPool({ workerScriptUrl: probe, resolvePluginCids: resolveNoPlugins }), "VesselIslandPool");
  return [
    ["node daemon", () => handleMod.nodeSpawnDaemonWorker(probe)],
    ...POOL_SPAWN_ARGS.map(([cls, args]) => [`node ${cls}`, () => spawn(args)]),
  ];
}

/** Each web row the tool drives and the spawn that builds its handle: the browser pool's OWN host spawn per class. */
export function webSpawnPlan(BrowserVesselIslandPool) {
  const pool = new BrowserVesselIslandPool({ workerScriptUrl: new URL("file:///capability-probe/island.js"), resolvePluginCids: resolveNoPlugins });
  const spawn = poolSpawnOf(pool, "BrowserVesselIslandPool");
  return POOL_SPAWN_ARGS.map(([cls, args]) => [`web ${cls}`, () => spawn(args)]);
}

/**
 * Stand-in doors that grant every ask and count each call against the row open at the call. `ran` names the doors
 * called since the last `open`; a call that lands while no row stands open joins `late`, by door, and reads red.
 */
export function countingDoors() {
  const ran = new Set(); const late = [];
  let row = null;
  const hit = (door) => { if (row === null) late.push(door); else ran.add(door); };
  return {
    ran, late,
    open: (name) => { ran.clear(); row = name; },
    close: () => { row = null; },
    cas: async () => { hit("fetch"); return new Uint8Array([7]); },
    rest: async () => { hit("rest"); },
    custody: async () => { hit("custody"); },
    dyad: () => { hit("dyad"); return "clear"; },
  };
}

async function measureNode(dist) {
  const handleMod = await import(pathToFileURL(join(dist.node, "worker-handle.js")).href);
  const { VesselIslandPool } = await import(pathToFileURL(join(dist.node, "vessel-island-pool.js")).href);
  const asks = asksOf();
  const doors = countingDoors();
  handleMod.setCasDoor(doors.cas);
  handleMod.setRestDoor(doors.rest);
  handleMod.setCustodyWriteDoor(doors.custody);
  handleMod.setDyadDoor(doors.dyad);
  const dir = mkdtempSync(join(tmpdir(), "capability-probe-"));
  const probe = pathToFileURL(join(dir, "probe.mjs"));
  writeFileSync(probe, probeSource(asks));
  const spawnOne = (spawn) => new Promise((resolve, reject) => {
    const handle = spawn();
    handle.onError(reject);
    handle.listen((m) => {
      // One event-loop turn after the probe's last ask: every door answer the vessel side owed stands posted.
      if (m && m.type === "probe:done") setImmediate(() => handle.post({ type: "probe:end" }));
      else if (m && m.type === "probe:result") { handle.terminate(); resolve(m.replies); }
    });
  });
  const rows = {};
  try {
    for (const [row, spawn] of nodeSpawnPlan(handleMod, VesselIslandPool, probe)) {
      doors.open(row);
      const replies = await spawnOne(spawn);
      doors.close();
      // One turn with no row open: a door a handler calls this late lands in `late`, never under the next row.
      await new Promise((r) => setImmediate(r));
      rows[row] = Object.fromEntries(asks.map((a) => [a.door, outcomeOf(a.door, replies[a.msg.requestId], doors.ran.has(a.door))]));
    }
    // One more turn: a door a handler called after its row closed lands here and reads red, never as another row's.
    await new Promise((r) => setImmediate(r));
    if (doors.late.length) rows["node late"] = Object.fromEntries(DOORS.map((d) => [d, doors.late.includes(d) ? "grants" : "silent"]));
  } finally {
    handleMod.setCasDoor(null); handleMod.setRestDoor(null); handleMod.setCustodyWriteDoor(null); handleMod.setDyadDoor(null);
    rmSync(dir, { recursive: true, force: true });
  }
  return rows;
}

/**
 * A stand-in for the Web Worker constructor. Each instance records what the vessel side posts to it and lets the
 * measurement post into the vessel side as the island would (`emit`), through whatever listeners the handle added.
 */
export function standInWorkerClass() {
  const spawned = [];
  class StandInWorker {
    constructor(url, opts) { this.url = url; this.opts = opts; this.listeners = new Map(); this.posted = []; spawned.push(this); }
    addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(fn); }
    removeEventListener(type, fn) { const l = this.listeners.get(type); const i = l ? l.indexOf(fn) : -1; if (i >= 0) l.splice(i, 1); }
    postMessage(msg) { this.posted.push(msg); }
    terminate() {}
    emit(data) {
      for (const fn of [...(this.listeners.get("message") ?? [])]) fn({ data });
      if (typeof this.onmessage === "function") this.onmessage({ data });
    }
  }
  return { StandInWorker, spawned };
}

/**
 * Drive one browser spawn over the stand-in Worker: the island posts the four asks; read every reply the vessel side
 * posted back, and how many message listeners the spawn attached before the first ask.
 */
export async function measureBrowserSpawn(spawn, asks, label) {
  const { StandInWorker, spawned } = standInWorkerClass();
  const had = Object.prototype.hasOwnProperty.call(globalThis, "Worker");
  const prior = globalThis.Worker;
  globalThis.Worker = StandInWorker;
  try {
    spawn();
    if (spawned.length !== 1) throw new Error(`${label}: the spawn made ${spawned.length} Web Worker(s); the inventory reads exactly one`);
    const w = spawned[0];
    const listeners = (w.listeners.get("message") ?? []).length + (typeof w.onmessage === "function" ? 1 : 0);
    for (const a of asks) w.emit(a.msg);
    // The door code answers through promises: one event-loop turn lets every one of them settle.
    await new Promise((r) => setImmediate(r));
    const replies = {};
    for (const m of w.posted) if (m && typeof m.requestId === "string") (replies[m.requestId] ??= []).push(m);
    return { doors: Object.fromEntries(asks.map((a) => [a.door, outcomeOf(a.door, replies[a.msg.requestId])])), listeners };
  } finally {
    if (had) globalThis.Worker = prior; else delete globalThis.Worker;
  }
}

async function measureWeb(dist) {
  const { BrowserVesselIslandPool } = await import(pathToFileURL(join(dist.browser, "browser-vessel-island-pool.js")).href);
  const asks = asksOf();
  const rows = {}; const listeners = {};
  const warn = console.warn; console.warn = () => {};
  try {
    for (const [row, spawn] of webSpawnPlan(BrowserVesselIslandPool)) {
      const read = await measureBrowserSpawn(spawn, asks, row);
      rows[row] = read.doors; listeners[row] = read.listeners;
    }
  } finally { console.warn = warn; }
  // The daemon island's seam stands inside openBrowserVessel, which Node cannot open: no reading, never `silent`.
  rows["web daemon"] = { ...UNMEASURED };
  listeners["web daemon"] = "unmeasured";
  return { rows, listeners };
}

export async function measure(root = ROOT) {
  const dist = {
    node: join(root, "packages/lararium-node/dist/src"),
    mesh: join(root, "packages/lararium-mesh/dist"),
    browser: join(root, "packages/lararium-browser/dist"),
  };
  const needed = {
    node: join(dist.node, "worker-handle.js"), "node pool": join(dist.node, "vessel-island-pool.js"),
    mesh: join(dist.mesh, "index.js"), "browser pool": join(dist.browser, "browser-vessel-island-pool.js"),
  };
  for (const [name, p] of Object.entries(needed)) {
    if (!existsSync(p)) { const e = new Error(`the built ${name} tree stands absent (${relative(root, p)}); build first`); e.code = "UNBUILT"; throw e; }
  }
  const node = await measureNode(dist);
  const web = await measureWeb(dist);
  return { islands: { ...node, ...web.rows }, webListeners: web.listeners, callSites: seamCallSites(root), askSites: askMentions(root) };
}

/** Count each entry of a list. */
function counts(list) {
  const m = new Map();
  for (const x of list ?? []) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}

/** Every difference between two multisets of source sites, one plain line each. */
function siteDifferences(measured, committed, what) {
  const out = [];
  const m = counts(measured); const c = counts(committed);
  for (const site of [...new Set([...m.keys(), ...c.keys()])].sort()) {
    const mn = m.get(site) ?? 0; const cn = c.get(site) ?? 0;
    if (mn === cn) continue;
    if (cn === 0) out.push(`${site}: ${what.added}`);
    else if (mn === 0) out.push(`${site}: ${what.gone}`);
    else out.push(`${site}: the source holds ${mn}, the table names ${cn}`);
  }
  return out;
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
  const ml = measured.webListeners ?? {}; const cl = committed.webListeners ?? {};
  for (const row of [...new Set([...Object.keys(ml), ...Object.keys(cl)])].sort()) {
    if (ml[row] !== cl[row]) out.push(`${row}: the spawn attaches ${ml[row] ?? "no reading of"} message listener(s), the table says ${cl[row] ?? "none named"}`);
  }
  out.push(...siteDifferences(measured.callSites, committed.callSites, {
    added: "a reference that wraps, spawns or answers an island stands where the table names no seam",
    gone: "the table names this seam, and the source no longer holds it",
  }));
  out.push(...siteDifferences(measured.askSites, committed.askSites, {
    added: "the source names this ask where the table names none: a new asker or responder",
    gone: "the table names this ask, and the source no longer holds it",
  }));
  return out;
}

function table(inv) {
  const lines = [`island            ${DOORS.map((d) => d.padEnd(11)).join("")}listeners`];
  for (const [row, doors] of Object.entries(inv.islands)) lines.push(`${row.padEnd(18)}${DOORS.map((d) => doors[d].padEnd(11)).join("")}${inv.webListeners?.[row] ?? ""}`);
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
  console.log("PASS capability-inventory: every island holds exactly the doors the committed table names (reach, not policy)");
}
