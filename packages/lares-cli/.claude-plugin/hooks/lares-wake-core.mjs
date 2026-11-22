/*
 * lares-wake-core — what the wake and the compaction hooks say, apart from how they reach the vessel.
 *
 * A hook hands in ONE runner, `run(name, argv)`, which starts a read and answers `{ done, kill }`: `done` resolves
 * `{ stdout, code, signal, error? }` and never rejects; `kill` stops the read. Three reads stand: `observe` and `index`
 * ride the checkout's container shim, `homes` rides the host CLI. Everything else here reads as text in, text out,
 * so a test drives it with no container and no child process.
 *
 * Four more reads stand behind ports, each optional: `git` names the checkout's head and branch; `lei` reads the lei a session
 * wears at that branch, one read per rite, through the lei door; `halves` reads the tessera receipts the rite writes
 * (`rite-begun`, `rite-landed`); `keep` reads the keep lei at the workspace the house config names (`keepWorkspace`), and a red
 * keep tessera in conferre's reading names its cure. A runner that answers none of them leaves the wake as it stood.
 *
 * THE LAW BEFORE THE ACT. Two more reads ride the shim beside the memory: the law index (`lawArgv`) and the pins that head it
 * (`lawPinsArgv`), both the tiddler door's `wiki filter` over the worn face's daemon wiki, so the session reads the house's
 * law the way it reads its working memory. The filters (`@lararium/tw5`'s `daemon-law-tiddlers`) read the pin set the wiki
 * holds (`$:/config/lares/law/pins`) and the law by address, and their canon guard keeps every row to a record a canon layer
 * answers. The block reads into every session's context, so it also prints each title only as one `lar:` address within a
 * byte cap, caps the pins it shows, and says that its rows read as data.
 *
 * WHO IS HOME. Beside the law rides the hearth roster (`rosterArgv`, the shim's `vessel roster --json`): the worn face and who
 * holds it, the seats here by presence and far by last signed act, the lanes and the open vota, framed by provenance and weight
 * (`ROSTER_WEIGHT_LINE`) and capped; a vessel that answers no "up" skips it with the other memory reads.
 *
 * ONE BUDGET. The harness bounds a hook (`hooks/hooks.json`, 15 seconds), and past that bound it discards the hook's
 * whole answer. So the three reads start together and share one budget that closes inside the harness's bound: a read
 * still open then stops and reports itself by name, and the wake carries what the other reads answered. The budget
 * decides nothing about the house; it only keeps the answers that arrived.
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Start one read as a child in its own process group. `kill` stops the whole group, so a compose child cannot hold
 * the hook's pipes open past the read.
 */
export function spawnRead(command, argv) {
  let child;
  let output = "";
  const done = new Promise((resolve) => {
    try {
      child = spawn(command, argv, { detached: true, stdio: ["ignore", "pipe", "ignore"] });
    } catch (err) {
      resolve({ stdout: "", code: null, signal: null, error: err?.code ?? err?.message ?? "spawn error" });
      return;
    }
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.on("error", (err) => resolve({ stdout: output, code: null, signal: null, error: err?.code ?? err?.message ?? "spawn error" }));
    child.on("close", (code, signal) => resolve({ stdout: output, code, signal }));
  });
  const kill = () => {
    if (!child?.pid) return;
    try { process.kill(-child.pid, "SIGKILL"); } catch { /* The process already left. */ }
    child.stdout?.destroy();
    child.unref();
  };
  return { done, kill };
}

/** The hooks' own runner: `observe` and `index` ride the checkout's container shim, `homes` rides the host CLI. */
export function shimRunner(hookUrl) {
  const hookDir = dirname(fileURLToPath(hookUrl));
  const laresBin = join(hookDir, "..", "..", "bin", "lares.mjs");
  const shim = join(hookDir, "..", "..", "..", "..", "tools", "lares-container.sh");
  return (name, argv) => (name === "menu" ? spawnRead(process.execPath, [join(hookDir, "lares-menu-read.mjs"), laresBin]) : name === "homes" ? spawnRead(process.execPath, [laresBin, ...argv]) : name === "git" ? spawnRead("git", argv) : spawnRead(shim, argv));
}

/** One page of the view: the filter door's own row ceiling, and the byte cap both the door and the render keep. */
export const INDEX_ROWS = 32;
export const INDEX_BYTES = 4096;
/** The reads' shared budget; the harness's own timeout stays the only bound above it. */
export const WAKE_BUDGET_MS = 12_000;
/**
 * The rows in play: the state rows, derived by their address prefix and never listed here; a slot title (`…#/entry`)
 * stays out, its meme already stands in the block. A cold session reads them before the index, the handoff (where one
 * stands) first and the rest in the door's title order: the stage memes carry no `modified` field, so no sort by it
 * stands.
 */
export const STATE_PREFIX = "lar:///ha.ka.ba/kahua/memory/state/";
export const STATE_FILTER = "[lares.stage[state]!regexp[#]]";
export const STATE_HANDOFF = `${STATE_PREFIX}handoff`;
/**
 * The tag of the one cold-boot view (first-three-wave-map#/the-handoff-walk; road `L43`). The index lists the rest: the
 * state rows lead in their own block, so the view leaves their prefix out.
 */
export const INDEX_TAG = "stage/index";
export const INDEX_FILTER = `[tag[${INDEX_TAG}]] -[lares.stage[state]]`;
/** The rows in play stay short: a row ceiling, a byte cap on the block, and one on each row's line. */
export const STATE_ROWS = 8;
export const STATE_BYTES = 2048;
export const STATE_LINE_BYTES = 320;
/**
 * The law index (lar:///ha.ka.ba/lararium/tw5/daemon-law-tiddlers): the canon pins first, then the canon law they leave
 * out, read as calls to the canon functions (lar:///ha.ka.ba/lares/api/filters). The same strings `@lararium/tw5` exports,
 * welded by a test. No floor copy of the long forms stands here: where the vessel stands down the wake runs no filter, it
 * only names the call in its stand-down line, and the vessel's canon answers the call once it stands.
 */
export const LAW_PINS_TITLE = "$:/config/lares/law/pins";
export const LAW_PINS_FILTER = "[lares.law.pins[]]";
export const LAW_INDEX_FILTER = "[lares.law[]]";
/** The law block: at most this many pins (the rest counted), then this many law rows; byte caps on the block, a line, a title. */
export const LAW_PIN_ROWS = 16;
export const LAW_ROWS = 8;
export const LAW_TITLE_BYTES = 200;
export const LAW_BYTES = 4096;
export const LAW_LINE_BYTES = 240;
/** The page the law read asks: the door's row ceiling, and room for that many rows of `role` lines. */
const LAW_PAGE_BYTES = 16384;

const CURE = "stand it with tools/lares-container.sh up";
const viewOf = (filter) => `wiki_filter(filter="${filter}", recipe="default", fields=["title","description"]`;
const VIEW = viewOf(INDEX_FILTER);
const bytes = (text) => Buffer.byteLength(text, "utf8");

/** The rites a lei carries, and the shim's argv for the checkout's head then branch. */
export const LEI_RITES = ["push", "kukulu"];
export const gitArgv = () => ["rev-parse", "HEAD", "--abbrev-ref", "HEAD"];
/** The shim's argv for one rite's lei at a branch and head: the lei door's `show`. */
export const leiArgv = (rite, branch, head) => ["lei", "show", "--rite", rite, "--branch", branch, "--head", head, "--json"];
/** The shim's argv for the tessera receipts the rite writes. */
export const halvesArgv = () => ["rite", "receipts", "--json"];
/** The shim's argv for the keep line at one workspace: a keep lei names its workspace as its branch, and no head. */
export const keepArgv = (workspace) => ["lei", "show", "--rite", "keep", "--branch", workspace, "--json"];
/** The shim's argv for the vessel observation. */
export const observeArgv = () => ["vessel", "stand", "--observe", "--json"];
/** The shim's argv for one page of the memory index, read in the worn face's daemon wiki. */
export const indexArgv = (after) => [
  "wiki", "filter", INDEX_FILTER, "--recipe", "default", "--fields", "title,description",
  "--limit", String(INDEX_ROWS), "--max-bytes", String(INDEX_BYTES), "--json", ...(after ? ["--after", after] : []),
];
export const attractorsArgv = () => ["wiki", "filter", "[lares.attractors[]]", "--recipe", "default", "--limit", "32", "--json"];
/** The shim's argv for the rows in play, read in the worn face's daemon wiki. */
export const stateArgv = () => [
  "wiki", "filter", STATE_FILTER, "--recipe", "default", "--fields", "title,description",
  "--limit", String(STATE_ROWS), "--max-bytes", String(INDEX_BYTES), "--json",
];
/** The shim's argv for one page of the law index, read in the worn face's daemon wiki: title, description and role. */
export const lawArgv = () => [
  "wiki", "filter", LAW_INDEX_FILTER, "--recipe", "default", "--fields", "title,description,role",
  "--limit", String(INDEX_ROWS), "--max-bytes", String(LAW_PAGE_BYTES), "--json",
];
/** The shim's argv for the pins that stand, titles alone. */
export const lawPinsArgv = () => ["wiki", "filter", LAW_PINS_FILTER, "--recipe", "default", "--limit", String(INDEX_ROWS), "--json"];
/** The host CLI's argv for the homes line. */
export const homesArgv = () => ["home", "read", "--brief"];

/** The JSON answer a door printed: the whole output, else its last line that opens an object; null where none parses. */
function parseAnswer(stdout) {
  const text = String(stdout ?? "").trim();
  if (!text) return null;
  for (const candidate of [text, ...text.split("\n").filter((line) => line.startsWith("{")).reverse()]) {
    try { const value = JSON.parse(candidate); if (value && typeof value === "object") return value; } catch { /* the next candidate */ }
  }
  return null;
}

const BUDGET = Symbol("budget");
const CLOSED = "no answer inside the wake's budget";

/** How a read ended, in the read's own words; null where it answered. */
function readFault(result, noun) {
  if (result === BUDGET) return CLOSED;
  if (result.error) return `the ${noun} did not start (${result.error})`;
  if (!String(result.stdout ?? "").trim()) return `the ${noun} exited ${result.code ?? result.signal} with no answer`;
  return null;
}

/**
 * Checks the vessel door once made and this checkout's CLI no longer makes, each beside the commit that dropped it: an
 * older vessel image still reports them. `recall-plugin` read the retired memory palace's Claude plugin (road `L48`).
 */
const CHECKS_DROPPED = { "recall-plugin": "57de8002a" };

/**
 * The memory library's line, or null where it stands or stays absent. The library (mempalace) stands as an optional
 * organ the vessel door reads (vessel-door#what-a-stand's-ok-answers; lararium-memory): an upstream comparator, never the
 * house memory, which the daemon wiki holds. A red reading names its failing checks, and a check the CLI dropped says so.
 */
export function libraryLine(frame) {
  const library = frame?.data?.mempalace;
  if (!library || typeof library !== "object" || library.ok !== false) return null;
  const failing = (Array.isArray(library.checks) ? library.checks : []).filter((c) => c?.ok === false);
  const named = failing.map((c) => `${c.name}${c.detail ? ` (${String(c.detail).replace(/\s+/g, " ").trim()})` : ""}`).join("; ");
  const dropped = failing.filter((c) => CHECKS_DROPPED[c.name]).map((c) =>
    `${c.name} names a check this checkout's CLI no longer makes (${CHECKS_DROPPED[c.name]}): the vessel runs an older image, and the check clears when it runs a newer one`);
  const frameOk = frame?.ok === false ? ["the frame's ok:false follows this reading"] : [];
  return [
    `Lares memory library (mempalace, the optional upstream library \`lares mempalace install\` keeps; the house memory reads from the daemon wiki below, never from it) reads ${library.standing ?? "red"}${named ? `: ${named}` : ""}`,
    ...dropped, ...frameOk,
  ].join(" · ");
}

/** The observation's line, and whether the vessel itself answered up. Each cause reads by its own name: only the vessel's own answer says "down". */
export function observation(result) {
  const unobserved = (why) => `vessel unobserved: ${why}; read it with tools/lares-container.sh vessel stand --observe --json, or ${CURE}`;
  if (result === BUDGET) return { up: false, line: `vessel observation timed out; ${CURE}` };
  const fault = readFault(result, "shim");
  if (fault) return { up: false, line: unobserved(fault) };
  const frame = parseAnswer(result.stdout);
  if (frame === null) return { up: false, line: unobserved(`the shim's answer did not parse (exit ${result.code ?? result.signal})`) };
  const up = frame?.data?.node?.up === true;
  return { up, library: up ? libraryLine(frame) : null, line: up ? JSON.stringify(frame) : `vessel down (the observation answered node.up ${JSON.stringify(frame?.data?.node?.up ?? null)}); ${CURE}` };
}

/** A row's line, its description cut where the line would outrun `lineCap` bytes; its address stays whole. */
function rowLine(row, lineCap) {
  const description = String(row?.fields?.description ?? "").replace(/\s+/g, " ").trim();
  const line = description ? `${row.title} — ${description}` : String(row.title);
  if (bytes(line) <= lineCap) return line;
  const room = Math.max(0, lineCap - bytes(`${row.title} — …`));
  return `${row.title} — ${Buffer.from(description, "utf8").subarray(0, room).toString("utf8").replace(/\uFFFD+$/, "")}…`;
}

/**
 * One block of rows for one page the filter door answered: a count line, one line per row, and one line naming the call
 * that reads further. The block keeps `cap` bytes of rows: a row past the cap leaves, by count, and a row whose own
 * line outruns the cap alone shows with its description cut.
 */
function renderRows(answer, { head: label, filter, cap, lineCap = cap, rows: order = (rows) => rows, empty }) {
  const data = answer?.data ?? {};
  const rows = order(Array.isArray(data.rows) ? data.rows : (Array.isArray(data.titles) ? data.titles.map((title) => ({ title, fields: {} })) : []));
  const total = typeof data.total === "number" ? data.total : rows.length;
  const view = viewOf(filter);
  if (total === 0 && rows.length === 0) return empty(view);
  const lines = [];
  let size = 0;
  for (const row of rows) {
    let line = rowLine(row, lineCap);
    if (size + bytes(line) + 1 > cap) {
      if (lines.length > 0) break;
      // The first row alone outruns the cap: its description gives way, its address stays whole.
      line = rowLine(row, cap - 1);
    }
    lines.push(line);
    size += bytes(line) + 1;
  }
  const head = `${label}: ${total} rows${lines.length < total ? ` (${lines.length} shown)` : ""}`;
  const cut = lines.length < rows.length;
  const next = typeof data.next === "string" && data.next !== "" ? data.next : null;
  // A cursor names the page behind the door's own page; a render cut drops rows inside that page, so it names the view whole.
  const further = cut
    ? `cut at the wake's byte cap after ${lines.length} of ${total} rows; read the whole view: ${view})`
    : next
      ? `read further: ${view}, after="${next}")`
      : `read a row: tiddler_get(title=<title>, recipe="default", meme=true); the same view: ${view})`;
  return [head, ...lines, further].join("\n");
}

/** The index block for one page the filter door answered. */
export function renderIndex(answer, cap = INDEX_BYTES) {
  return renderRows(answer, {
    head: "Lares memory index", filter: INDEX_FILTER, cap,
    empty: (view) => `Lares memory index: 0 rows\nno row carries the tag ${INDEX_TAG} in the worn face's daemon wiki; the view: ${view})`,
  });
}

/** The rows-in-play block: the handoff row first where one stands, the rest in the door's own order. */
export function renderState(answer, cap = STATE_BYTES) {
  return renderRows(answer, {
    head: "Lares working memories on the stage (start here)", filter: STATE_FILTER, cap, lineCap: STATE_LINE_BYTES,
    rows: (rows) => [...rows.filter((r) => r?.title === STATE_HANDOFF), ...rows.filter((r) => r?.title !== STATE_HANDOFF)],
    empty: (view) => `Lares working memories on the stage: no row stands under ${STATE_PREFIX} in the worn face's daemon wiki; the view: ${view})`,
  });
}

/** A filter read's answer, or its fault in the read's own words. */
function filterAnswer(result) {
  const fault = readFault(result, "read");
  if (fault) return { fault };
  const answer = parseAnswer(result.stdout);
  if (answer === null) return { fault: `the read's answer did not parse (exit ${result.code ?? result.signal})` };
  if (answer.ok === false || !answer.data) {
    const error = answer.error ?? {};
    const message = String(error.message ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
    const code = String(error.code ?? "");
    return { fault: message.startsWith(`${code}:`) || !code ? (message || `the door refused (exit ${result.code ?? result.signal})`) : `${code}: ${message}` };
  }
  return { answer };
}

/** The rows-in-play read's lines: the block where the door answered a page, else `Lares rows in play unread: <cause>` with the view. */
export function stateLines(result) {
  const { fault, answer } = filterAnswer(result);
  return fault ? `Lares working memories on the stage unread: ${fault}; the view: ${viewOf(STATE_FILTER)})` : renderState(answer);
}

/** The index read's lines: the block where the door answered a page, else `memory index unread: <cause>`. */
export function indexLines(result) {
  const { fault, answer } = filterAnswer(result);
  return fault ? `memory index unread: ${fault}` : renderIndex(answer);
}

const LAW_VIEW = `${viewOf(LAW_INDEX_FILTER).replace('fields=["title","description"]', 'fields=["title","description","role"]')})`;
const LAW_FURTHER = `read the rest: law_index(after=<next>) or lares law list --all; the filter: ${LAW_VIEW}; pin or unpin: law_pin(uri=<title>) · law_unpin(uri=<title>) (lares law pin|unpin <uri>)`;

/** The line that frames the rows by provenance and weight: canon grounds each one, the five tools turn it, and both hands hold the frame. */
export const LAW_WEIGHT_LINE = "these rows come from canon, the house's settled ground (🜃); read one whole (tiddler_get(title=<title>, recipe=\"default\", meme=true, grain=\"whole\")) and turn it through the five tools beside the live work; operator and node hold the frame together";
/** A title prints only as one `lar:` address with no whitespace, within its byte cap. */
const printableTitle = (title) => typeof title === "string" && /^lar:\/\/\/\S+$/.test(title) && bytes(title) <= LAW_TITLE_BYTES;

/**
 * The law block: the standing pins (marked, at most `LAW_PIN_ROWS`, the rest counted), then the first `LAW_ROWS` law rows
 * the pins leave out, each with its description or role, and the calls that read the rest. `pinsAnswer` names the pins;
 * where it stands unread the block marks none and shows `LAW_ROWS` rows. A title that reads as no single `lar:` address,
 * or outruns its byte cap, never prints, whatever the door answered.
 */
export function renderLaw(answer, pinsAnswer = null, cap = LAW_BYTES) {
  const data = answer?.data ?? {};
  const rows = (Array.isArray(data.rows) ? data.rows : []).filter((row) => printableTitle(row?.title));
  const total = typeof data.total === "number" ? data.total : rows.length;
  const pinned = new Set(Array.isArray(pinsAnswer?.data?.titles) ? pinsAnswer.data.titles : []);
  if (total === 0 && rows.length === 0) {
    return `Lares law (pinned first): 0 rows; no canon law answers in the worn face's daemon wiki (its pin set: ${LAW_PINS_TITLE}); the view: ${LAW_VIEW}`;
  }
  let pins = 0;
  while (pins < rows.length && pinned.has(rows[pins]?.title)) pins++;
  const shownPins = Math.min(pins, LAW_PIN_ROWS);
  const lineOf = (row, mark) => {
    const fields = row?.fields ?? {};
    const one = { title: row.title, fields: { description: String(fields.description ?? "").trim() || String(fields.role ?? "") } };
    return `${mark} ${rowLine(one, LAW_LINE_BYTES)}`;
  };
  const lines = [];
  let size = 0;
  const push = (line) => {
    if (size + bytes(line) + 1 > cap && lines.length > 0) return false;
    lines.push(line);
    size += bytes(line) + 1;
    return true;
  };
  let printed = 0;
  for (const row of rows.slice(0, shownPins)) { if (!push(lineOf(row, "📌"))) break; printed++; }
  if (pins > printed) push(`📌 +${pins - printed} more pinned (lares law list, law_index)`);
  let shown = printed;
  for (const row of rows.slice(pins, pins + LAW_ROWS)) { if (!push(lineOf(row, "  "))) break; shown++; }
  return [`Lares law (pinned first): ${pins} pinned · ${total} rows${shown < total ? ` (${shown} shown)` : ""}`, LAW_WEIGHT_LINE, ...lines, LAW_FURTHER].join("\n");
}

/** The law reads' lines: the block where the door answered a page, else `Lares law unread: <cause>` with the view. */
export function lawLines(result, pinsResult = null) {
  const { fault, answer } = filterAnswer(result);
  if (fault) return `Lares law unread: ${fault}; the view: ${LAW_VIEW}`;
  const pins = pinsResult ? filterAnswer(pinsResult).answer ?? null : null;
  return renderLaw(answer, pins);
}

/**
 * THE HEARTH ROSTER (lar:///ha.ka.ba/lararium/mesh/hearth-roster): who is home, read through the shim's `vessel roster --json`,
 * which the vessel's verb channel answers itself. The block reads the rotation first (the operator reads it first), then the
 * seats in their two grains, the lanes and the open vota, within a byte cap; a vessel that answers no "up" skips it quietly.
 */
export const ROSTER_BYTES = 2048;
export const ROSTER_ROWS = 8;
export const rosterArgv = () => ["vessel", "roster", "--json"];
const ROSTER_FURTHER = "read it whole: vessel_roster() or lares vessel roster";
/** The line that frames the rows by provenance and weight: the vessel's own live reading, turned through the five tools. */
export const ROSTER_WEIGHT_LINE =
  "these rows come from this vessel's own live reading: a seat here stands by the kernel's hold on its socket, a far seat by its signature on the face intent plane; " +
  "turn them through the five tools (🜁 verify a claim before you lean on it, 🜄 weigh who stands with whom against the live work) and hold the operator's seat as an equal; operator and node hold the frame together";
const TOKEN = /^[a-z0-9][a-z0-9:._-]{0,63}$/;
const tok = (v) => (typeof v === "string" && TOKEN.test(v) ? v : "?");
const hexOf = (v, n = 12) => (typeof v === "string" && /^[0-9a-f]+$/.test(v) ? v.slice(0, n) : "?");
const seatId = (v) => (typeof v === "string" && /^(s-[0-9a-z]{1,8}|[0-9a-f]{1,12})$/.test(v) ? v : "?");
const face = (v) => (Number.isSafeInteger(v) && v >= 0 ? `h${v}` : "h?");
const kindOf = (s) => (s?.kind === "ai" ? `an AI seat (${tok(s.hand)})` : `a hand (${tok(s.hand)})`);
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** One roster row's line, either grain, in plain words. */
function rosterSeatLine(s) {
  if (s?.grain === "local") return `${seatId(s.seat)}  ${face(s.face)}  ${kindOf(s)}, here by presence`;
  const heard = (Array.isArray(s?.lastHeard) ? s.lastHeard : []).map((t) => `${tok(t?.entry)} ${hexOf(t?.cid)}`).join(", ") || "no act";
  return `${seatId(s?.seat)}  ${face(s?.face)}  ${s?.self ? "this vessel's own atom, " : ""}last heard at ${heard} (${tok(s?.standing)})`;
}

/** The roster block from the shim's JSON answer: count line, weight line, rotation, rows within the cap, the gap, and where to read on. */
export function renderRoster(answer, cap = ROSTER_BYTES) {
  const r = answer?.data ?? {};
  const counts = r.counts ?? {};
  const seats = Array.isArray(r.seats) ? r.seats : [];
  const rot = r.rotation ?? {};
  const byId = (id) => { const s = seats.find((x) => x?.seat === id); return s ? `${seatId(id)} (${kindOf(s)})` : seatId(id); };
  const worn = Number.isSafeInteger(rot.worn) ? `this vessel wears ${face(rot.worn)}` : "this vessel wears no face (it stands at its floor)";
  const holders = Array.isArray(rot.holders) ? rot.holders : [];
  const held = !Number.isSafeInteger(rot.worn) ? "" : holders.length > 0 ? `, held by ${holders.map(byId).join(" and ")}` : ", and no session holds it now";
  const other = (Array.isArray(rot.underOther) ? rot.underOther : []).map((o) => `; ${seatId(o?.seat)} acts under ${face(o?.face)}`).join("");
  const rows = [
    ...seats.map((s) => `${s?.grain === "local" ? "here" : "far "}  ${rosterSeatLine(s)}`),
    ...(Array.isArray(r.lanes) ? r.lanes : []).map((l) => `lane  ${face(l?.face)} ${tok(l?.verb)} (intent ${hexOf(l?.intent)}): claimed by ${hexOf(l?.claimant)}`),
    ...(Array.isArray(r.vota) ? r.vota : []).map((v) => `votum ${face(v?.face)} ${tok(v?.verb)} (intent ${hexOf(v?.intent)}): waits on ${v?.waitsOn === "answer" ? "an answer" : v?.waitsOn === "frontier" ? "a frontier this vessel does not hold" : `an outcome, ${v?.owedBy ? `owed by ${hexOf(v.owedBy)}` : "unclaimed"}`}`),
    ...(Array.isArray(r.unread) ? r.unread : []).map((u) => `unread ${face(u?.face)}'s intent plane (${tok(u?.reason)})`),
  ];
  const lines = [];
  let size = 0;
  for (const row of rows) {
    if (lines.length >= ROSTER_ROWS || size + bytes(row) + 1 > cap) break;
    lines.push(row);
    size += bytes(row) + 1;
  }
  const cut = lines.length < rows.length ? [`cut at the wake's cap after ${lines.length} of ${rows.length} rows`] : [];
  // The rows the vessel itself left out (each face keeps eight per list), counted in the body it answered.
  const left = ["local", "far", "lanes", "vota"].reduce((n, k) => n + (Number.isSafeInteger(r.more?.[k]) && r.more[k] > 0 ? r.more[k] : 0), 0);
  if (left > 0) cut.push(`+${left} more rows the vessel left out (each face keeps 8 per list)`);
  return [
    `Lares hearth (who is home): ${count(Number(counts.local ?? 0), "seat", "seats")} here · ${Number(counts.far ?? 0)} heard from afar · ${count(Number(counts.lanes ?? 0), "lane", "lanes")} · ${count(Number(counts.vota ?? 0), "open votum", "open vota")}`,
    ROSTER_WEIGHT_LINE,
    `rotation: ${worn}${held}${other}`,
    ...lines, ...cut,
    "seats here stand by presence; far seats read only by last signed act (no global now, so nobody far reads online); lanes read the intent plane's claims alone (no leap or road-meme claim store stands)",
    ROSTER_FURTHER,
  ].join("\n");
}

/** The roster read's lines: the block where the vessel answered, else one line naming the cause. */
export function rosterLines(result) {
  const { fault, answer } = filterAnswer(result);
  return fault ? `Lares hearth (who is home) unread: ${fault}; ${ROSTER_FURTHER}` : renderRoster(answer);
}

/** The refusal a locked vessel answers, in the words a session reads: it calls the operator at once. */
export const LOCKED_LINE = "vessel locked: tell the operator now (the harness's push notification) to run `lares vault unlock`; tool calls answer `vessel-locked` until it opens";

/** Whether a door's answer names the locked vessel, by its error code or the lead of its message. */
const refusesLocked = (answer) => {
  const error = answer?.error ?? {};
  return String(error.code ?? "") === "vessel-locked" || String(error.message ?? "").startsWith("vessel-locked");
};

/** The checkout's head and branch from the `git` read; null where it answered neither. */
export function checkoutOf(result) {
  if (!result || result === BUDGET || result.error) return null;
  const [head, branch] = String(result.stdout ?? "").trim().split("\n").map((x) => x.trim());
  return head && branch && branch !== "HEAD" ? { head, branch } : null;
}

/**
 * The lei line for one session: `results` holds one answer per rite (a rite whose read never started stays out). A standing lei names
 * its rite and the lei it follows; a fork names its tips; a refusal `absent` reads as no lei; a locked vessel gives the operator's call.
 */
export function leiLines(checkout, results) {
  const worn = [], forked = [], bare = [], faults = [];
  for (const [rite, result] of Object.entries(results)) {
    if (result === BUDGET) { faults.push(`${rite}: ${CLOSED}`); continue; }
    const answer = parseAnswer(result?.stdout);
    if (answer === null) { faults.push(`${rite}: ${readFault(result, "read") ?? "the answer did not parse"}`); continue; }
    if (refusesLocked(answer)) return [LOCKED_LINE];
    if (answer.ok === false) { faults.push(`${rite}: ${answer.error?.code ?? "refused"}`); continue; }
    // The lane renames the door's `go` to `lei`; the reader takes either.
    const lei = answer.data?.lei;
    if (lei?.standing === true) worn.push(lei.after ? `${rite} (follows ${String(lei.after).slice(0, 12)})` : `${rite} (the branch's first)`);
    else if (Array.isArray(lei?.forks) && lei.forks.length > 0) forked.push(`${rite} forked at ${lei.forks.map((c) => String(c).slice(0, 12)).join(" | ")}`);
    else bare.push(rite);
  }
  const at = `${checkout.branch}@${checkout.head.slice(0, 8)}`;
  const lines = [];
  if (worn.length > 0 || forked.length > 0) lines.push(`Lares lei: this session wears ${[...worn, ...forked].join(", ")} at ${at}`);
  else if (bare.length > 0 && faults.length === 0) lines.push(`Lares lei: none worn at ${at}`);
  if (faults.length > 0) lines.push(`Lares lei unread: ${faults.join("; ")}`);
  return lines;
}

/** One name's value as the shim reads it: the environment first, else the env file's last plain KEY=VALUE line. */
function envValue(name, env, text) {
  const set = String(env?.[name] ?? "").trim();
  if (set) return set;
  let last = "";
  for (const line of String(text ?? "").split("\n")) { const m = new RegExp(`^\\s*${name}=(.*)$`).exec(line); if (m) last = m[1].trim(); }
  return last;
}
const WORKSPACE_NAME = /^[a-z0-9._-]+$/;

/**
 * The keep workspace the house config names, as the CLI reads it (`packages/lares-cli/src/keep-config.ts`, the same rule):
 * LARES_KEEP_WORKSPACE, else the one pair LARES_WORKSPACES binds; several pairs and no name read none.
 */
export function keepWorkspaceOf(env, envFileText) {
  const ok = (n) => (WORKSPACE_NAME.test(n) && n !== "." && n !== ".." ? n : null);
  const set = envValue("LARES_KEEP_WORKSPACE", env, envFileText);
  if (set !== "") return ok(set);
  const pairs = envValue("LARES_WORKSPACES", env, envFileText).split(";").map((p) => p.trim()).filter((p) => p.indexOf("=") > 0);
  return pairs.length === 1 ? ok(pairs[0].slice(0, pairs[0].indexOf("=")).trim()) : null;
}

/**
 * The workspaces the house config binds, as the shim reads them: LARES_WORKSPACES (the environment, else the env file), `;`-separated
 * `<name>=<dir>` pairs; a pair whose name breaks the shim's rule or whose dir names no absolute path reads none.
 */
export function workspaceBindsOf(env, envFileText) {
  const out = [];
  for (const pair of envValue("LARES_WORKSPACES", env, envFileText).split(";")) {
    const at = pair.indexOf("=");
    if (at <= 0) continue;
    const name = pair.slice(0, at).trim(), dir = pair.slice(at + 1).trim();
    if (WORKSPACE_NAME.test(name) && name !== "." && name !== ".." && dir.startsWith("/")) out.push({ name, dir });
  }
  return out;
}

/** The offer lines: one per bound workspace whose directory sits in no work tree. A notice and an offer, never an act. */
export function workspaceOfferLines(workspaces, treeStands) {
  return (Array.isArray(workspaces) ? workspaces : [])
    .filter((w) => !treeStands(w.dir))
    .map((w) => `workspace ${w.name} holds no git tree; lares surface init --workspace ${w.name}`);
}

/** The keep line: the keep lei standing at the configured workspace, or none with how one strings; a locked vessel says nothing here. */
export function keepLines(workspace, result) {
  if (result === BUDGET) return `Lares keep unread: ${CLOSED}`;
  const answer = parseAnswer(result?.stdout);
  if (answer === null) return `Lares keep unread: ${readFault(result, "read") ?? "the answer did not parse"}`;
  if (refusesLocked(answer)) return null;
  if (answer.ok === false) return `Lares keep unread: ${answer.error?.code ?? "refused"}`;
  const lei = answer.data?.lei ?? {};
  if (lei.standing === true) return `Lares keep: a keep lei stands for workspace "${workspace}" with ${Number(lei.returnsLeft ?? 0)} returns left; \`lares rite keep --workspace ${workspace}\` spends one`;
  if (Array.isArray(lei.forks) && lei.forks.length > 0) return `Lares keep: the keep line for workspace "${workspace}" stands forked at ${lei.forks.map((c) => String(c).slice(0, 12)).join(" | ")}; settle it with lares lei show --rite keep --branch ${workspace}`;
  return `Lares keep: no keep lei stands for workspace "${workspace}" (${lei.refusal ?? "absent"}); \`lares vault unlock\` offers one, or by hand: lares lei kui --rite keep --branch ${workspace} --returns <n>`;
}

/** The cure for one red keep tessera in conferre's reading. */
function keepRedLine(t) {
  const at = `tessera ${String(t.tessera).slice(0, 12)} (workspace "${t.branch ?? "?"}", bundle ${String(t.head ?? "?").slice(0, 16)})`;
  return t.red === "landed-absent"
    ? `Lares keep red: ${at} reads landed-absent: cut and never landed; cure: lares rite keep --workspace ${t.branch ?? "<workspace>"} (it pushes what waits and lands it)`
    : `Lares keep red: ${at} reads ${t.red ?? "red"}; read it with lares rite receipts --json before any keep lands it`;
}

/**
 * The tessera halves with no match, from the receipts the rite writes. A record reads `{ act: "rite-begun" | "rite-landed", rite, tessera }`
 * and the `tessera` id pairs a begun with its landed.
 */
export function unmatchedHalves(records) {
  const begun = new Map(), landed = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    if (r?.act === "rite-begun") begun.set(String(r.tessera), String(r.rite ?? "?"));
    else if (r?.act === "rite-landed") landed.set(String(r.tessera), String(r.rite ?? "?"));
  }
  return [
    ...[...begun].filter(([id]) => !landed.has(id)).map(([id, rite]) => ({ half: "begun", rite, tessera: id })),
    ...[...landed].filter(([id]) => !begun.has(id)).map(([id, rite]) => ({ half: "landed", rite, tessera: id })),
  ];
}

/**
 * The line for the receipts read. A tessera holds two halves, a guest half (`begun`) and a host half (`landed`); conferre sets each against
 * its match, a match reads par, and a half with no match reads red by name.
 */
export function halvesLines(result) {
  if (result === BUDGET) return `Lares tessera conferre unread: ${CLOSED}`;
  const answer = parseAnswer(result?.stdout);
  if (answer === null) return `Lares tessera conferre unread: ${readFault(result, "read") ?? "the answer did not parse"}`;
  if (refusesLocked(answer)) return null;
  if (answer.ok === false) return `Lares tessera conferre unread: ${answer.error?.code ?? "refused"}${answer.error?.message ? `: ${answer.error.message}` : ""}`;
  const records = answer.data?.receipts;
  const red = unmatchedHalves(records);
  const par = new Set((Array.isArray(records) ? records : []).filter((r) => r?.act === "rite-begun").map((r) => String(r.tessera))).size - red.filter((h) => h.half === "begun").length;
  if (red.length === 0) return `Lares tessera conferre: ${par} par, every half has its match`;
  const word = (h) => (h.half === "begun" ? "guest half begun, no host half landed" : "host half landed, no guest half begun");
  const keepRed = (Array.isArray(answer.data?.conferre?.red) ? answer.data.conferre.red : []).filter((t) => t?.rite === "keep").map(keepRedLine);
  return [`Lares tessera conferre: ${par} par, ${red.length} red (no match): ${red.map((h) => `${h.rite} ${h.tessera.slice(0, 12)} ${word(h)}`).join("; ")}`, ...keepRed].join("\n");
}

/** Race each started read against the one budget; a read the budget closes stops and answers BUDGET. */
function underBudget(budgetMs) {
  let timer;
  const closed = new Promise((resolve) => { timer = setTimeout(() => resolve(BUDGET), budgetMs); });
  const settle = (read) => Promise.race([read.done, closed]).then((result) => {
    if (result === BUDGET) { try { read.kill(); } catch { /* the read already left */ } }
    return result;
  });
  return { settle, close: () => clearTimeout(timer) };
}

/**
 * The SessionStart context: the vessel's frame, the homes line, the rows in play (the state rows, handoff first), the
 * law (pinned first), then the memory index, on every wake. The reads start together. A vessel that answers anything but up stops the memory
 * reads, and the wake says once that it skipped them.
 */
// `source` (startup, resume, clear, compact) changes nothing the wake reads: every wake leads with the rows in play.
export async function wake({ run, budgetMs = WAKE_BUDGET_MS, source: _source = "", keepWorkspace = null, workspaces = [], treeStands = () => true }) {
  const reads = { observe: run("observe", observeArgv()), index: run("index", indexArgv()), homes: run("homes", homesArgv()) };
  // The optional reads: a runner that answers none leaves their lines out.
  const optional = (name, argv) => run(name, argv) ?? null;
  const attractorsRead = optional("attractors", attractorsArgv());
  const stateRead = optional("state", stateArgv());
  const lawRead = optional("law", lawArgv());
  const lawPinsRead = optional("lawPins", lawPinsArgv());
  const rosterRead = optional("roster", rosterArgv());
  const menuRead = optional("menu", []);
  const gitRead = optional("git", gitArgv());
  const halvesRead = optional("halves", halvesArgv());
  const keepRead = keepWorkspace ? optional("keep", keepArgv(keepWorkspace)) : null;
  const budget = underBudget(budgetMs);
  const homesRead = budget.settle(reads.homes);
  const seen = observation(await budget.settle(reads.observe));
  // The index read started beside the observation; a vessel that answers no "up" stops it, and nothing waits on it.
  if (!seen.up) for (const read of [reads.index, attractorsRead, stateRead, lawRead, lawPinsRead, rosterRead, menuRead, halvesRead, keepRead]) { try { read?.kill(); } catch { /* the read already left */ } }
  const attractors = attractorsRead && seen.up ? await budget.settle(attractorsRead) : null;
  const state = stateRead && seen.up ? await budget.settle(stateRead) : null;
  const law = lawRead && seen.up ? await budget.settle(lawRead) : null;
  const lawPins = lawPinsRead && seen.up ? await budget.settle(lawPinsRead) : null;
  const roster = rosterRead && seen.up ? await budget.settle(rosterRead) : null;
  const menu = menuRead && seen.up ? await budget.settle(menuRead) : null;
  const index = seen.up ? await budget.settle(reads.index) : null;
  const leiAnswers = {};
  const checkout = gitRead && seen.up ? checkoutOf(await budget.settle(gitRead)) : null;
  if (checkout) {
    const started = LEI_RITES.map((rite) => [rite, optional("lei", leiArgv(rite, checkout.branch, checkout.head))]).filter(([, read]) => read !== null);
    for (const [rite, read] of started) leiAnswers[rite] = await budget.settle(read);
  }
  const halves = halvesRead && seen.up ? await budget.settle(halvesRead) : null;
  const keep = keepRead && seen.up ? await budget.settle(keepRead) : null;
  const homes = await homesRead;
  budget.close();
  const homesLine = homes === BUDGET
    ? `lares home read gave ${CLOSED}`
    : (String(homes.stdout ?? "").trim() || "lares home read produced no output");
  const lines = [
    "Lares live wake (SessionStart) — what is true right now " +
      "(the canonical frame is already loaded from CLAUDE.md): " + seen.line,
    ...(seen.library ? [seen.library] : []),
    `Lares homes: ${homesLine}`,
  ];
  if (menu !== null) {
    let digest;
    if (menu !== BUDGET && menu.code === 0) {
      try { digest = JSON.parse(menu.stdout).digest; } catch { /* report the malformed answer below */ }
    }
    if (/^[0-9a-f]{12}$/.test(digest ?? "")) lines.push(`Lares tool menu: sha256:${digest}`);
    else {
      const cause = readFault(menu, "read") ?? (menu.code !== 0 ? `the read exited ${menu.code}` : "the read's answer did not parse (exit 0)");
      lines.push(`Lares tool menu: unread (${String(cause).replace(/\s+/g, " ")})`);
    }
  }
  if (!seen.up) lines.push("Attractor stores: unavailable (no vessel answers)");
  else if (attractors !== null) {
    const { fault, answer } = filterAnswer(attractors);
    const titles = answer?.data?.titles;
    if (fault) lines.push(`attractor stores: unread (${fault.replace(/\s+/g, " ").slice(0, 240)})`);
    else if (!Array.isArray(titles) || titles.some((title) => typeof title !== "string" || !/^lar:\/\/\/[^\s]{1,240}$/.test(title)) || answer.data.next) lines.push("attractor stores: unread (invalid or incomplete answer)");
    else lines.push(titles.length ? `Attractor stores: ${titles.join(" · ")}` : "Attractor stores: no attractor stores");
  }
  if (state !== null) lines.push(stateLines(state));
  if (law !== null) lines.push(lawLines(law, lawPins));
  if (roster !== null) lines.push(rosterLines(roster));
  lines.push(seen.up ? indexLines(index) : "memory index skipped: no vessel answers (the line above names the cause)");
  if (checkout && Object.keys(leiAnswers).length > 0) lines.push(...leiLines(checkout, leiAnswers));
  if (keep !== null) { const line = keepLines(keepWorkspace, keep); if (line) lines.push(line); }
  if (halves !== null) { const line = halvesLines(halves); if (line) lines.push(line); }
  lines.push(...workspaceOfferLines(workspaces, treeStands));
  return lines.join("\n");
}

/**
 * The PreCompact text: Claude Code appends a PreCompact hook's stdout to the compaction's instructions, so this hands
 * the summary the addresses to keep. The rows in play and the index ride the same door and the same budget; a fault
 * names its cause and the other read rides on.
 */
export async function compactCarry({ run, budgetMs = WAKE_BUDGET_MS }) {
  const budget = underBudget(budgetMs);
  const stateRead = run("state", stateArgv());
  const indexRead = run("index", indexArgv());
  const state = await budget.settle(stateRead);
  const index = await budget.settle(indexRead);
  budget.close();
  return [
    "Lares compaction carry: keep every `lar:` address below verbatim in the summary, each beside its description, " +
      "so the session reads its memory again by address once the context turns.",
    stateLines(state),
    indexLines(index),
  ].join("\n");
}
