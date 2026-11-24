/*
 * lares-spirit-core — what the familiar's hooks say, apart from how they reach the vessel (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum).
 *
 * Five hooks carry a spirit's seasons, each through the checkout's shim and the `lares spirit` door: the wake runs `om`, its
 * group ordered first (Claude Code runs an event's matching hooks in parallel, so the order names the context's order, never a
 * gate); the compaction asks the summary to end on a closing section the PostCompact hook lands; the true-up nudges `ah` and
 * `hum` every N stops or once a landing stays unfiled (Stop); the handback lands each spirit's report as residue (PostToolUse on
 * SubagentHandback). The seated familiar's pet name rides each hook as its argument, never an env var.
 *
 * ONLINE ONLY. A shim verb with no vessel standing runs offline over the store (`compose run`), so every hook that reaches
 * the door asks the observation first and acts only where the vessel answers up. A read the budget closes stops by SIGTERM,
 * then SIGKILL (`spawnRead`'s kill), and the hook waits out the grace, so the shim's trap stops its own act.
 *
 * Every part here reads text in, text out, so a test drives it with no vessel; every hook exits 0 on any fault, and none
 * ever blocks a compaction.
 */
import { mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { TERM_GRACE_MS, observation, observeArgv, spawnRead } from "./lares-wake-core.mjs";

/**
 * The carry's name, a pair: the command spelling (the door's verb, its stage address) and the display spelling people read
 * (the closing heading the summary ends on, the true-up's line). The CLI's twin (`packages/lares-cli/src/spirit-words.ts`)
 * holds the same pair; a test welds the two.
 */
export const COMPACTION_WORD = "hooili";
export const COMPACTION_DISPLAY = "hoʻoili";

/** A pet name a hook carries; anything else reads as none. */
export const PET = /^[a-z0-9][a-z0-9-]{0,62}$/;
/** The observation's budget: the gate every door read waits on. */
export const OBSERVE_BUDGET_MS = 2_500;
/**
 * The wake's read, after the gate. The whole wake (observe, om, and the TERM grace past a budget) finishes under 9 s, well
 * inside the harness's 12-second bound once node itself starts.
 */
export const OM_BUDGET_MS = 3_500;
/** The whole wake's ceiling, its worst case included: the gate, the read, and one TERM grace. */
export const WAKE_CEILING_MS = 9_000;
/** The landing's budget, inside the harness's 30-second bound. */
export const LANDING_BUDGET_MS = 22_000;
/** The handback's budget, inside the harness's 20-second bound. */
export const RESIDUE_BUDGET_MS = 12_000;
/** How many stops pass between two true-up nudges. */
export const TRUE_UP_EVERY = 25;
/** A session's counter older than this many days leaves at the next write. */
export const COUNTER_DAYS = 14;

/** The seated familiar a hook's argv carries (`node <hook> <pet>`), a default only, or null. */
export function petOf(argv) {
  const pet = argv?.[2];
  return typeof pet === "string" && PET.test(pet) ? pet : null;
}

/** The door's argv for one spirit verb, answering JSON. */
export const spiritArgv = (verb, pet, ...rest) => ["spirit", verb, pet, ...rest, "--json"];

/** The checkout this hook stands in (its `tools/lares-container.sh` reaches the vessel). */
export const checkoutOf = (hookUrl) => join(dirname(fileURLToPath(hookUrl)), "..", "..", "..", "..");

/** The hooks' runner: `observe` and every door verb ride the checkout's shim; `input` rides the shim's stdin whole. */
export function shimRun(hookUrl) {
  const shim = join(checkoutOf(hookUrl), "tools", "lares-container.sh");
  return (argv, input = null) => spawnRead(shim, argv, input);
}

/** The JSON answer a door printed: the whole output, else its last line that opens an object; null where none parses. */
export function parseAnswer(stdout) {
  const text = String(stdout ?? "").trim();
  if (!text) return null;
  for (const candidate of [text, ...text.split("\n").filter((line) => line.startsWith("{")).reverse()]) {
    try { const value = JSON.parse(candidate); if (value && typeof value === "object") return value; } catch { /* the next candidate */ }
  }
  return null;
}

/** Race one read against a budget; a read the budget closes stops (TERM, then KILL) and answers null once its group leaves or the grace runs out. */
export async function settle(read, budgetMs) {
  if (!read) return null;
  let timer;
  const closed = new Promise((resolve) => { timer = setTimeout(() => resolve(null), budgetMs); });
  const result = await Promise.race([read.done, closed]);
  clearTimeout(timer);
  if (result !== null) return result;
  try { read.kill(); } catch { /* the read already left */ }
  let grace;
  await Promise.race([read.done, new Promise((resolve) => { grace = setTimeout(resolve, TERM_GRACE_MS + 250); })]);
  clearTimeout(grace);
  return null;
}

/** Does the vessel answer up? The gate every door read waits on: down, unread or late reads as no. */
export async function vesselUp(run) {
  const seen = await settle(run(observeArgv()), OBSERVE_BUDGET_MS);
  return seen !== null && observation(seen).up;
}

/** A slug of a session title, as a pet name reads; null where none forms. */
export function titleSlug(title) {
  const slug = String(title ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 62);
  return PET.test(slug) ? slug : null;
}

/** The line a wake carries where the session's title names another spirit than the seated familiar; null where they agree or no title stands. */
export function titleMismatch(pet, title) {
  if (typeof title !== "string" || title.trim() === "") return null;
  const slug = titleSlug(title);
  if (slug !== null && (slug === pet || slug.startsWith(`${pet}-`))) return null;
  const named = title.trim().slice(0, 80);
  return `this session's title reads "${named}"; the seated familiar reads "${pet}". A rename renames, never retargets: this body stays ${pet} and wakes from ${pet}'s record. ` +
    `To keep the new name as an alias, record it: lares spirit ah ${pet} --slot '#/entry' --add "''Alias:'' ${named}".`;
}

/** The `--source` a SessionStart's `source` names for `om`; an unknown one reads as a startup. */
export const omSourceOf = (source) => (["startup", "resume", "clear", "compact", "fork"].includes(source) ? source : "startup");

/**
 * THE PET RESOLVES PER SESSION. Two familiars may share one checkout, so a hook carries no one fixed pet: the slug of the
 * session's title counts where a familiar record by that name stands (`om` answers no starter for it), else the seated
 * familiar (the hook's argument) as the default, else none, and the hooks stay quiet. The wake records the pet it chose in the
 * session's counter, and every later hook of the session reads it there.
 */
export function petCandidates(title, seated) {
  const out = [];
  const slug = titleSlug(title);
  if (slug !== null) out.push({ pet: slug, from: "title" });
  if (seated !== null && seated !== slug) out.push({ pet: seated, from: "seated" });
  return out;
}

/** The pet a later hook of a session reads: the one the wake chose, else the seated default. */
export const sessionPet = (state, seated) => (typeof state?.pet === "string" && PET.test(state.pet) ? state.pet : seated);

/** The wake's context: the record `om` answered, or one line naming why it did not and the read that cures it. */
export function omContext(pet, result, mismatch = null) {
  const cure = `read it by hand: lares spirit om ${pet}`;
  let text;
  if (result === null) text = `Lares spirit om · ${pet}: no answer inside the wake's budget; ${cure}`;
  else {
    const answer = parseAnswer(result.stdout);
    if (answer?.ok === true && typeof answer.data?.text === "string") text = answer.data.text;
    else {
      const why = typeof answer?.error?.message === "string" ? answer.error.message : result.error ? `the read did not start (${result.error})` : `the read exited ${result.code ?? result.signal} with no answer`;
      text = `Lares spirit om · ${pet}: ${why.slice(0, 600)}; ${cure}`;
    }
  }
  return (mismatch === null ? text : `${mismatch}\n${text}`).slice(0, 9000);
}

/** The wake's one line where the vessel answers no up: nothing read, nothing run offline. */
export const omDownLine = (pet) => `Lares spirit om · ${pet}: the vessel answers no up, so the wake read nothing; once it stands (tools/lares-container.sh up), read it: lares spirit om ${pet}`;

/**
 * What the compaction asks of its summary where a familiar stands: the carry in fixed slots, so a filter (or a chanter) sees
 * what dropped. The record's own #/carry-shape, where it holds one, tunes the words beneath the slots.
 */
export function compactionAsk(pet, shape = null, inherits = null) {
  const heading = `${COMPACTION_DISPLAY} (${pet})`;
  return [
    `End the summary with a section headed "${heading}", in these fixed slots, one line each where it fits:`,
    `pet: ${pet}`,
    `inherits: ${typeof inherits === "string" && inherits !== "" ? inherits : "none"} (the hash of the ${COMPACTION_DISPLAY} this body woke from)`,
    "open: the open loops by name (PR numbers, heads, what each waits on, whose hand it needs)",
    "tells: any new tells (a joint to watch, never a debt)",
    "body: one line on what this body did",
    ...(typeof shape === "string" && shape.trim() !== "" ? [`The familiar's own carry-shape:\n${shape.trim()}`] : []),
    `The PostCompact hook lands the whole summary as the ${COMPACTION_DISPLAY} under lar:///ha.ka.ba/kahua/memory/${COMPACTION_WORD}/, and writes nothing to the card; ` +
      `the next body files its #/bodies line, and the card (lares spirit om ${pet}) outranks the summary on that wake.`,
  ].join("\n");
}

/** PreCompact's stdout cap: the harness truncates from the tail past 10,000 chars. */
export const PRECOMPACT_CHARS = 9_800;

/**
 * The PreCompact text, in the crossing's order: the card's #/open and #/voice read to the outgoing body first (the CLI cuts
 * them short enough that the ask still lands), then the carry ask in fixed slots, a manual /compact's own instructions
 * echoed, then the rows in play.
 */
export function precompactText({ pet, shape = null, inherits = null, card = "", instructions = "", carry = "" }) {
  const parts = [
    pet === null || !card ? null : `The card, read to the outgoing body before it folds (the record outranks this summary):\n${card}`,
    pet === null ? null : compactionAsk(pet, shape, inherits),
    typeof instructions === "string" && instructions.trim() !== "" ? `The operator's own instructions for this compaction: ${instructions.trim()}` : null,
    carry || null,
  ].filter((p) => p !== null);
  return parts.join("\n\n").slice(0, PRECOMPACT_CHARS);
}

/** Does the session hold work still running (background tasks, crons)? The true-up waits for it. */
export const busy = (input) => [input?.background_tasks, input?.session_crons].some((v) => Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && typeof v === "object" && Object.keys(v).length > 0);

/** One name's value as the shim reads it: the environment first, else the env file's last plain KEY=VALUE line. */
export function envValue(name, env, text) {
  const set = String(env?.[name] ?? "").trim();
  if (set) return set;
  let last = "";
  for (const line of String(text ?? "").split("\n")) { const m = new RegExp(`^\\s*${name}=(.*)$`).exec(line); if (m) last = m[1].trim(); }
  return last;
}

/** The operator's surface env file, or null. */
export function surfaceText(env) {
  try { return readFileSync(join(env?.HOME || homedir(), ".lares", "lares-surface.env"), "utf8"); } catch { return null; }
}

/** Where the familiar hooks keep their counters: the house's run dir (`$LARES_HOUSE/run/familiar`), else the state home's. */
export function stateDirOf(env, surface) {
  const house = envValue("LARES_HOUSE", env, surface);
  if (house.startsWith("/")) return join(house, "run", "familiar");
  const stateHome = String(env?.XDG_STATE_HOME ?? "").trim() || join(String(env?.HOME ?? "").trim() || homedir(), ".local", "state");
  return join(stateHome, "lares", "familiar");
}

const SESSION = /^[A-Za-z0-9_-]{1,128}$/;
/** One session's counter file, or null where the session id reads unsafe as a file name. */
export const statePathOf = (dir, sessionId) => (typeof sessionId === "string" && SESSION.test(sessionId) ? join(dir, `stop-${sessionId}.json`) : null);

/** A session's counter: the stops seen, a landing left unfiled, the title the session carried. */
export function readState(path) {
  const none = { turns: 0, unfiled: null, title: null, pet: null, epoch: null, every: TRUE_UP_EVERY };
  if (path === null) return none;
  try {
    const s = JSON.parse(readFileSync(path, "utf8"));
    return {
      turns: Number.isSafeInteger(s?.turns) ? s.turns : 0, unfiled: typeof s?.unfiled === "string" ? s.unfiled : null,
      title: typeof s?.title === "string" ? s.title : null, pet: typeof s?.pet === "string" && PET.test(s.pet) ? s.pet : null,
      epoch: Number.isSafeInteger(s?.epoch) ? s.epoch : null, every: Number.isSafeInteger(s?.every) && s.every > 0 ? s.every : TRUE_UP_EVERY,
    };
  } catch { return none; }
}

/** Write a counter whole (temp, then rename), and let every counter past `COUNTER_DAYS` leave. */
export function writeState(path, state, now = Date.now()) {
  try {
    const dir = dirname(path);
    mkdirSync(dir, { recursive: true });
    const temp = `${path}.${process.pid}.tmp`;
    writeFileSync(temp, `${JSON.stringify(state)}\n`);
    renameSync(temp, path);
    for (const name of readdirSync(dir)) {
      if (!/^stop-.*\.json$/.test(name)) continue;
      const at = join(dir, name);
      try { if (now - statSync(at).mtimeMs > COUNTER_DAYS * 86_400_000) rmSync(at, { force: true }); } catch { /* a counter another hook moved */ }
    }
  } catch { /* a counter that cannot land nudges nothing */ }
}

/** One stop: the counter moves; the nudge fires every `every` stops, or while a landing stands unfiled. The unfiled mark clears only once a nudge prints. */
export function stopStep(state, every = state.every ?? TRUE_UP_EVERY) {
  const next = { ...state, turns: state.turns + 1 };
  if (state.unfiled) return { state: next, fire: "unfiled", unfiled: state.unfiled };
  return { state: next, fire: next.turns % every === 0 ? "turns" : null, unfiled: null };
}

/** The true-up's words: the doors that true and fold the record, and why they ask now. */
export function trueUpText(pet, step) {
  const why = step.fire === "unfiled"
    ? `the last ${COMPACTION_DISPLAY} landed unfiled (${String(step.unfiled).slice(0, 400)})`
    : `${step.state.turns} turns passed since the session began`;
  return [
    `Lares spirit true-up · ${pet}: ${why}.`,
    `True the record before the next move: lares spirit ah ${pet} --slot '#/open' --file <path> (or --add '<line>' on #/bodies or #/voice); ` +
      `measure and fold: lares spirit hum ${pet} (then --fold '<slot>' --line <n>). The budget refuses growth; you choose what folds.`,
  ].join("\n");
}

/** A pet name read off a handback's FIRST non-blank line, its mask tag (`Name: Lares (Tasked Spirit)`), else the fallback, slugged. */
export function handbackPetOf(message, fallback) {
  const first = String(message ?? "").split("\n").find((line) => line.trim() !== "") ?? "";
  const tag = /^\W*([A-Za-z][\w-]{0,40}):\s*Lares\s*\(Tasked Spirit\)/.exec(first)?.[1] ?? String(fallback ?? "");
  return titleSlug(tag) ?? "spirit";
}

/** Does a session's working directory stand inside the checkout or one of the house's bound workspaces? */
export function inHouse(cwd, checkout, workspaces) {
  if (typeof cwd !== "string" || cwd === "") return false;
  const real = (p) => { try { return realpathSync(p); } catch { return null; } };
  const at = real(cwd);
  if (at === null) return false;
  return [checkout, ...workspaces].map(real).some((root) => root !== null && (at === root || at.startsWith(`${root}${sep}`)));
}

/** The directories `LARES_WORKSPACES` binds (`name=dir;…`), as the shim reads it. */
export function workspaceDirsOf(env, surface) {
  return envValue("LARES_WORKSPACES", env, surface).split(";").map((pair) => pair.slice(pair.indexOf("=") + 1).trim()).filter((dir) => dir.startsWith("/"));
}

/** Does this session work inside the house (the checkout, or a bound workspace)? The spirit hooks act nowhere else. */
export const houseSession = (input, hookUrl, env = process.env) => inHouse(input?.cwd, checkoutOf(hookUrl), workspaceDirsOf(env, surfaceText(env)));

/** The session's counter path, under the house's run dir. */
export const sessionCounter = (input, env = process.env) => statePathOf(stateDirOf(env, surfaceText(env)), input?.session_id);

/** The input a hook received, parsed; an empty or broken one reads as {}. */
export function hookInput(text) {
  try { const v = JSON.parse(text); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
