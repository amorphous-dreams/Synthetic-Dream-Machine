/**
 * lane-state — the lane's state file and the fresh-per-step lead's brief (seat-harness#/the-lead).
 *
 * `<lane-root>/state.json` holds what the next lead step needs and nothing else: head, owed rows, live seats, the
 * worktree map, the next step and the step counter. A lead reads it, does ONE step, writes it back and stops; the next
 * launch is a fresh lead over the new state. A missing, torn or misshapen file refuses by name, never reads as empty.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const KEYS = ["head", "owed", "seats", "worktrees", "next", "step"];
const isStr = (v) => typeof v === "string" && v.length > 0;
const SEAT_KEYS = ["name", "mode", "dir"];

/** Throws a named error unless `s` holds exactly the state shape. */
export function validateState(s) {
  if (!s || typeof s !== "object" || Array.isArray(s)) throw new Error("lane state must be an object");
  for (const k of Object.keys(s)) if (!KEYS.includes(k)) throw new Error(`lane state has unknown key "${k}"`);
  for (const k of KEYS) if (!(k in s)) throw new Error(`lane state is missing key "${k}"`);
  if (!isStr(s.head) || !/^[0-9a-f]{7,40}$/.test(s.head)) throw new Error("lane state head must be 7 to 40 hex characters");
  if (!Array.isArray(s.owed) || !s.owed.every(isStr)) throw new Error("lane state owed must be an array of strings");
  if (!Array.isArray(s.seats) || !s.seats.every((x) => x && typeof x === "object" && Object.keys(x).length === SEAT_KEYS.length && SEAT_KEYS.every((k) => isStr(x[k])))) throw new Error("lane state seats must be {name, mode, dir} strings (a seat)");
  if (!s.worktrees || typeof s.worktrees !== "object" || Array.isArray(s.worktrees) || !Object.values(s.worktrees).every(isStr)) throw new Error("lane state worktrees must map names to strings");
  if (typeof s.next !== "string" || s.next.length === 0) throw new Error("lane state next must be a string");
  if (!Number.isInteger(s.step) || s.step < 0) throw new Error("lane state step must be a non-negative integer");
  return s;
}

export function readState(laneRoot) {
  const p = join(laneRoot, "state.json");
  let text;
  try { text = readFileSync(p, "utf8"); } catch { throw new Error(`no state.json at ${p}`); }
  let s;
  try { s = JSON.parse(text); } catch (e) { throw new Error(`state.json at ${p} fails to parse (JSON): ${e.message}`); }
  return validateState(s);
}

/** Validates, then writes through a temp name and a rename, so a reader never sees a torn file. */
export function writeState(laneRoot, state) {
  validateState(state);
  const p = join(laneRoot, "state.json"), tmp = `${p}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(tmp, p);
}

export const stepDirName = (n) => `steps/step-${String(n).padStart(3, "0")}`;

/** The state and the dir of the NEXT step, spending nothing. */
export function peekStep(laneRoot) {
  const state = readState(laneRoot);
  const n = state.step + 1;
  return { state, n, stepDir: join(laneRoot, stepDirName(n)) };
}

/** Spends the step: bumps the counter on disk and returns the new state and the step dir. */
export function beginStep(laneRoot) {
  const { state, n, stepDir } = peekStep(laneRoot);
  const next = { ...state, step: n };
  writeState(laneRoot, next);
  return { state: next, stepDir };
}

/** The brief a fresh lead reads: the state, then the one-step law. */
export function leadStepBrief(state, { laneRoot, stepDir }) {
  const list = (xs) => (xs.length ? xs.map((x) => `* ${x}`).join("\n") : "* (none)");
  return `# Lead step ${state.step + 1} (fresh; read this brief whole, then do ONE step)

## Lane state (from ${join(laneRoot, "state.json")})
* head: ${state.head}
* next step: ${state.next}

### Owed rows
${list(state.owed)}

### Live seats
${list(state.seats.map((s) => `${s.name} (${s.mode}) at ${s.dir}`))}

### Worktrees
${list(Object.entries(state.worktrees).map(([k, v]) => `${k}: ${v}`))}

## STEP LAW
* ONE step per launch: do the next step above, then stop. A step stays under about 10 to 15 minutes or 40 tool calls.
* Before you stop, rewrite ${join(laneRoot, "state.json")} (same keys; keep the step counter as it stands) with the new head, the owed rows, the live seats, the worktree map and the next step, and write your hand-back to ${join(stepDir, "out.md")}.
* A seat you start runs outside your context: record it in the state and stop; never poll for it. The next step reads its result path.
* Stop at a wall, at a design question that needs an operator ruling (name it with its options and your lean), or at the push go.
`;
}
