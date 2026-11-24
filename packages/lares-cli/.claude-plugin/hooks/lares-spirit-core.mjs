/*
 * lares-spirit-core — what the familiar's hooks say, apart from how they reach the vessel (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum).
 *
 * Five hooks carry a spirit's seasons, each through the checkout's shim and the `lares spirit` door: the wake runs `om` first
 * and alone (SessionStart); the compaction asks the summary for a ROUND (PreCompact); the round lands it (PostCompact,
 * `spirit round`); the true-up nudges `ah` and `hum` every N turns or once a round lands unfiled (Stop); the handback lands each
 * spirit's report as residue (PostToolUse on SubagentHandback, `spirit residue`). The pet name rides each hook as its argument,
 * never an env var. Every part here reads text in, text out, so a test drives it with no vessel; every hook exits 0 on any
 * fault, and none ever blocks a compaction.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** A pet name a hook carries; anything else reads as none. */
export const PET = /^[a-z0-9][a-z0-9-]{0,62}$/;
/** The wake's own budget, inside the harness's 8-second bound. */
export const OM_BUDGET_MS = 6_500;
/** The round's budget, inside the harness's 30-second bound. */
export const ROUND_BUDGET_MS = 25_000;
/** The handback's budget, inside the harness's 20-second bound. */
export const RESIDUE_BUDGET_MS = 16_000;
/** The true-up's vessel read, inside the harness's 10-second bound. */
export const TRUE_UP_BUDGET_MS = 6_000;
/** How many stops pass between two true-up nudges. */
export const TRUE_UP_EVERY = 25;
/** The longest summary or handback a hook carries across argv; the door cuts at its own cap too. */
export const RESIDUE_CHARS = 60_000;

/** The pet name a hook's argv carries (`node <hook> <pet>`), or null. */
export function petOf(argv) {
  const pet = argv?.[2];
  return typeof pet === "string" && PET.test(pet) ? pet : null;
}

/** The door's argv for one spirit verb, answering JSON. */
export const spiritArgv = (verb, pet, ...rest) => ["spirit", verb, pet, ...rest, "--json"];

/** The JSON answer a door printed: the whole output, else its last line that opens an object; null where none parses. */
export function parseAnswer(stdout) {
  const text = String(stdout ?? "").trim();
  if (!text) return null;
  for (const candidate of [text, ...text.split("\n").filter((line) => line.startsWith("{")).reverse()]) {
    try { const value = JSON.parse(candidate); if (value && typeof value === "object") return value; } catch { /* the next candidate */ }
  }
  return null;
}

/** Race one read against a budget; a read the budget closes stops and answers null. */
export async function settle(read, budgetMs) {
  if (!read) return null;
  let timer;
  const closed = new Promise((resolve) => { timer = setTimeout(() => resolve(null), budgetMs); });
  const result = await Promise.race([read.done, closed]);
  clearTimeout(timer);
  if (result === null) { try { read.kill(); } catch { /* the read already left */ } }
  return result;
}

/** The wake's context: the record `om` answered, or one line naming why it did not and the read that cures it. */
export function omContext(pet, result) {
  const cure = `read it by hand: lares spirit om ${pet}`;
  if (result === null) return `Lares spirit om · ${pet}: no answer inside the wake's budget; ${cure}`;
  const answer = parseAnswer(result.stdout);
  if (answer?.ok === true && typeof answer.data?.text === "string") return answer.data.text.slice(0, 9000);
  const why = typeof answer?.error?.message === "string" ? answer.error.message : result.error ? `the read did not start (${result.error})` : `the read exited ${result.code ?? result.signal} with no answer`;
  return `Lares spirit om · ${pet}: ${why.slice(0, 600)}; ${cure}`;
}

/** What the compaction asks of its summary where a familiar stands: a closing ROUND the PostCompact hook lands. */
export function roundAsk(pet) {
  return [
    `End the summary with a section headed "ROUND (${pet})", three short parts: the body's line (one sentence on what this body did), ` +
      "the open loops by name (PR numbers, heads, what each waits on), and any new tells (a joint to watch, never a debt).",
    `The PostCompact hook lands the whole summary as lar:///ha.ka.ba/kahua/memory/round/${pet}-<hash12> and files one #/bodies line; ` +
      `the familiar's record (lares spirit om ${pet}) outranks the summary on the next wake.`,
  ].join("\n");
}

/** One name's value as the shim reads it: the environment first, else the env file's last plain KEY=VALUE line. */
function envValue(name, env, text) {
  const set = String(env?.[name] ?? "").trim();
  if (set) return set;
  let last = "";
  for (const line of String(text ?? "").split("\n")) { const m = new RegExp(`^\\s*${name}=(.*)$`).exec(line); if (m) last = m[1].trim(); }
  return last;
}

/** Where the familiar hooks keep their counters: the house's run dir (`$LARES_HOUSE/run/familiar`), else the state home's. */
export function stateDirOf(env, surfaceText) {
  const house = envValue("LARES_HOUSE", env, surfaceText);
  if (house.startsWith("/")) return join(house, "run", "familiar");
  const stateHome = String(env?.XDG_STATE_HOME ?? "").trim() || join(String(env?.HOME ?? "").trim() || homedir(), ".local", "state");
  return join(stateHome, "lares", "familiar");
}

const SESSION = /^[A-Za-z0-9_-]{1,128}$/;
/** One session's counter file, or null where the session id reads unsafe as a file name. */
export const statePathOf = (dir, sessionId) => (typeof sessionId === "string" && SESSION.test(sessionId) ? join(dir, `stop-${sessionId}.json`) : null);

export function readState(path) {
  try { const s = JSON.parse(readFileSync(path, "utf8")); return { turns: Number.isSafeInteger(s?.turns) ? s.turns : 0, unfiled: typeof s?.unfiled === "string" ? s.unfiled : null }; }
  catch { return { turns: 0, unfiled: null }; }
}
export function writeState(path, state) {
  try { mkdirSync(join(path, ".."), { recursive: true }); writeFileSync(path, `${JSON.stringify(state)}\n`); } catch { /* a counter that cannot land nudges nothing */ }
}

/** One stop: the counter moves, and the nudge fires every `every` stops or once a round lands unfiled. */
export function stopStep(state, every = TRUE_UP_EVERY) {
  const turns = state.turns + 1;
  if (state.unfiled) return { state: { turns, unfiled: null }, fire: "unfiled", unfiled: state.unfiled };
  return { state: { turns, unfiled: null }, fire: turns % every === 0 ? "turns" : null, unfiled: null };
}

/** The true-up's words: the doors that true and fold the record, and why they ask now. */
export function trueUpText(pet, step) {
  const why = step.fire === "unfiled"
    ? `a round landed unfiled (${String(step.unfiled).slice(0, 400)})`
    : `${step.state.turns} turns passed since the session began`;
  return [
    `Lares spirit true-up · ${pet}: ${why}.`,
    `True the record before the next move: lares spirit ah ${pet} --slot '#/open' --file <path> (or --add '<line>' on #/bodies or #/voice); ` +
      `measure and fold: lares spirit hum ${pet} (then --fold '<slot>' --line <n>). The budget refuses growth; you choose what folds.`,
  ].join("\n");
}

/** A pet name read off a handback: its mask tag (`Name: Lares (Tasked Spirit)`), else the fallback, slugged; the door reads it the same way. */
export function handbackPetOf(message, fallback) {
  const tag = /^\W*([A-Za-z][\w-]{0,40}):\s*Lares\s*\(Tasked Spirit\)/m.exec(String(message ?? ""))?.[1] ?? String(fallback ?? "");
  const slug = tag.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 62);
  return PET.test(slug) ? slug : "spirit";
}

/** The input a hook received, parsed; an empty or broken one reads as {}. */
export function hookInput(text) {
  try { const v = JSON.parse(text); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
