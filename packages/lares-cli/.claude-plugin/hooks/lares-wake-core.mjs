/*
 * lares-wake-core — what the wake and the compaction hooks say, apart from how they reach the vessel.
 *
 * A hook hands in ONE runner, `run(name, argv)`, which starts a read and answers `{ done, kill }`: `done` resolves
 * `{ stdout, code, signal, error? }` and never rejects; `kill` stops the read. Three reads stand: `observe` and `index`
 * ride the checkout's container shim, `homes` rides the host CLI. Everything else here reads as text in, text out,
 * so a test drives it with no container and no child process.
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
  return (name, argv) => (name === "homes" ? spawnRead(process.execPath, [laresBin, ...argv]) : spawnRead(shim, argv));
}

/** The tag of the one cold-boot view (first-three-wave-map#/the-handoff-walk; road `L43`). */
export const INDEX_TAG = "stage/index";
export const INDEX_FILTER = `[tag[${INDEX_TAG}]]`;
/** One page of the view: the filter door's own row ceiling, and the byte cap both the door and the render keep. */
export const INDEX_ROWS = 32;
export const INDEX_BYTES = 4096;
/** The reads' shared budget; the harness's own timeout stays the only bound above it. */
export const WAKE_BUDGET_MS = 12_000;
/** The rows a context turn keeps by address across a compaction: the open ledger and the standing orders. */
export const ROWS_IN_PLAY = [
  "lar:///ha.ka.ba/kahua/memory/state/open-ledger",
  "lar:///ha.ka.ba/kahua/memory/state/standing-orders",
];

const CURE = "stand it with tools/lares-container.sh up";
const VIEW = `wiki_filter(filter="${INDEX_FILTER}", recipe="default", fields=["title","description"]`;
const bytes = (text) => Buffer.byteLength(text, "utf8");

/** The shim's argv for the vessel observation. */
export const observeArgv = () => ["vessel", "stand", "--observe", "--json"];
/** The shim's argv for one page of the memory index, read in the worn face's daemon wiki. */
export const indexArgv = (after) => [
  "wiki", "filter", INDEX_FILTER, "--recipe", "default", "--fields", "title,description",
  "--limit", String(INDEX_ROWS), "--max-bytes", String(INDEX_BYTES), "--json", ...(after ? ["--after", after] : []),
];
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

/** The observation's line, and whether the vessel itself answered up. Each cause reads by its own name: only the vessel's own answer says "down". */
export function observation(result) {
  const unobserved = (why) => `vessel unobserved: ${why}; read it with tools/lares-container.sh vessel stand --observe --json, or ${CURE}`;
  if (result === BUDGET) return { up: false, line: `vessel observation timed out; ${CURE}` };
  const fault = readFault(result, "shim");
  if (fault) return { up: false, line: unobserved(fault) };
  const frame = parseAnswer(result.stdout);
  if (frame === null) return { up: false, line: unobserved(`the shim's answer did not parse (exit ${result.code ?? result.signal})`) };
  const up = frame?.data?.node?.up === true;
  return { up, line: up ? JSON.stringify(frame) : `vessel down (the observation answered node.up ${JSON.stringify(frame?.data?.node?.up ?? null)}); ${CURE}` };
}

/**
 * The index block for one page the filter door answered: a count line, one line per row, and one line naming the call
 * that reads further. The block keeps `cap` bytes of rows: a row past the cap leaves, by count, and a row whose own
 * line outruns the cap alone shows with its description cut.
 */
export function renderIndex(answer, cap = INDEX_BYTES) {
  const data = answer?.data ?? {};
  const rows = Array.isArray(data.rows) ? data.rows : (Array.isArray(data.titles) ? data.titles.map((title) => ({ title, fields: {} })) : []);
  const total = typeof data.total === "number" ? data.total : rows.length;
  const lines = [];
  let size = 0;
  for (const row of rows) {
    const description = String(row?.fields?.description ?? "").replace(/\s+/g, " ").trim();
    let line = description ? `${row.title} — ${description}` : String(row.title);
    if (size + bytes(line) + 1 > cap) {
      if (lines.length > 0) break;
      // The first row alone outruns the cap: its description gives way, its address stays whole.
      const room = Math.max(0, cap - bytes(`${row.title} — …`) - 1);
      line = `${row.title} — ${Buffer.from(description, "utf8").subarray(0, room).toString("utf8").replace(/�+$/, "")}…`;
    }
    lines.push(line);
    size += bytes(line) + 1;
  }
  const head = `Lares memory index: ${total} rows${lines.length < total ? ` (${lines.length} shown)` : ""}`;
  const cut = lines.length < rows.length;
  const next = typeof data.next === "string" && data.next !== "" ? data.next : null;
  // A cursor names the page behind the door's own page; a render cut drops rows inside that page, so it names the view whole.
  const further = cut
    ? `cut at the wake's byte cap after ${lines.length} of ${total} rows; read the whole view: ${VIEW})`
    : next
      ? `read further: ${VIEW}, after="${next}")`
      : total === 0
        ? `no row carries the tag ${INDEX_TAG} in the worn face's daemon wiki; the view: ${VIEW})`
        : `read a row: meme_get(uri=<title>, recipe="default"); the same view: ${VIEW})`;
  return [head, ...lines, further].join("\n");
}

/** The index read's lines: the block where the door answered a page, else `memory index unread: <cause>`. */
export function indexLines(result) {
  const unread = (cause) => `memory index unread: ${cause}`;
  const fault = readFault(result, "read");
  if (fault) return unread(fault);
  const answer = parseAnswer(result.stdout);
  if (answer === null) return unread(`the read's answer did not parse (exit ${result.code ?? result.signal})`);
  if (answer.ok === false || !answer.data) {
    const error = answer.error ?? {};
    const message = String(error.message ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
    const code = String(error.code ?? "");
    return unread(message.startsWith(`${code}:`) || !code ? (message || `the door refused (exit ${result.code ?? result.signal})`) : `${code}: ${message}`);
  }
  return renderIndex(answer);
}

/** The line that keeps the rows in play by address across a context turn. */
export const rowsInPlayLine = () =>
  `Lares rows in play: ${ROWS_IN_PLAY.join(" · ")} (read each again with meme_get(uri=…, recipe="default"))`;

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
 * The SessionStart context: the vessel's frame, the homes line, the memory index, and after a compaction the rows in
 * play. The three reads start together. A vessel that answers anything but up stops the index read, and the wake says
 * once that it skipped it.
 */
export async function wake({ run, budgetMs = WAKE_BUDGET_MS, source = "" }) {
  const reads = { observe: run("observe", observeArgv()), index: run("index", indexArgv()), homes: run("homes", homesArgv()) };
  const budget = underBudget(budgetMs);
  const homesRead = budget.settle(reads.homes);
  const seen = observation(await budget.settle(reads.observe));
  // The index read started beside the observation; a vessel that answers no "up" stops it, and nothing waits on it.
  if (!seen.up) { try { reads.index.kill(); } catch { /* the read already left */ } }
  const index = seen.up ? await budget.settle(reads.index) : null;
  const homes = await homesRead;
  budget.close();
  const homesLine = homes === BUDGET
    ? `lares home read gave ${CLOSED}`
    : (String(homes.stdout ?? "").trim() || "lares home read produced no output");
  const lines = [
    "Lares live wake (SessionStart) — what is true right now " +
      "(the canonical frame is already loaded from CLAUDE.md): " + seen.line,
    `Lares homes: ${homesLine}`,
    seen.up ? indexLines(index) : "memory index skipped: no vessel answers (the line above names the cause)",
  ];
  if (source === "compact") lines.push(rowsInPlayLine());
  return lines.join("\n");
}

/**
 * The PreCompact text: Claude Code appends a PreCompact hook's stdout to the compaction's instructions, so this hands
 * the summary the addresses to keep. The index read rides the same door and the same budget; a fault names its cause
 * and the rows in play ride on.
 */
export async function compactCarry({ run, budgetMs = WAKE_BUDGET_MS }) {
  const budget = underBudget(budgetMs);
  const index = await budget.settle(run("index", indexArgv()));
  budget.close();
  return [
    "Lares compaction carry: keep every `lar:` address below verbatim in the summary, each beside its description, " +
      "so the session reads its memory again by address once the context turns.",
    indexLines(index),
    rowsInPlayLine(),
  ].join("\n");
}
