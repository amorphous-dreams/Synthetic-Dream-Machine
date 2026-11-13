/**
 * lane-state — the lane's state file and the fresh-per-step lead's brief (seat-harness#/the-lead).
 *
 * `<lane-root>/state.json` holds what the next lead step needs and nothing else: head, owed rows, live seats, the
 * worktree map, the next step, the step counter and the commit trailers the controller sets once for the lane. A lead reads it, does ONE step, writes it back and stops; the next
 * launch is a fresh lead over the new state. A missing, torn or misshapen file refuses by name, never reads as empty.
 */
import { renameSync } from "node:fs";
import { openHeldSync, readHeld, writeHeld } from "./held-dir.mjs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

const KEYS = ["head", "owed", "seats", "worktrees", "next", "step", "trailers"];
/** One trailer line: a git trailer key, a colon, a value, no line break. */
const TRAILER = /^[A-Za-z][A-Za-z0-9-]*: \S[^\r\n]*$/;
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
  if (!Array.isArray(s.trailers) || s.trailers.length === 0 || !s.trailers.every((t) => typeof t === "string" && TRAILER.test(t))) throw new Error("lane state trailers must be a nonempty array of one-line \"Key: value\" commit trailers");
  return s;
}

/** The lane root as a held directory: a path opens (and later closes) one here; a held handle passes through. Every read and write of the state goes through it. */
function viaHeld(root, fn) {
  if (typeof root !== "string") return fn(root, root);
  const held = openHeldSync(root, root);
  try { return fn(held, root); } finally { held.close(); }
}

export function readState(root) {
  return viaHeld(root, (held, label) => {
    let text;
    try { text = readHeld(held, "state.json"); } catch { throw new Error(`no state.json at ${typeof label === "string" ? label : "the lane root"}`); }
    let s;
    try { s = JSON.parse(text); } catch (e) { throw new Error(`state.json fails to parse (JSON): ${e.message}`); }
    return validateState(s);
  });
}

/** Validates, then writes a temp file INSIDE the held lane root and renames it there, so a reader never sees a torn file and no pathname re-resolves. */
export function writeState(root, state) {
  validateState(state);
  viaHeld(root, (held) => {
    const tmp = `state.json.tmp-${process.pid}-${randomUUID()}`;
    writeHeld(held, tmp, `${JSON.stringify(state, null, 2)}\n`, "x");
    renameSync(held.at(tmp), held.at("state.json"));
  });
}

export const stepDirName = (n) => `steps/step-${String(n).padStart(3, "0")}`;

/** The state and the name of the NEXT step, spending nothing; `stepDir` joins the label when the root came as a path. */
export function peekStep(root, label = root) {
  const state = readState(root);
  const n = state.step + 1;
  return { state, n, stepName: stepDirName(n), stepDir: typeof label === "string" ? join(label, stepDirName(n)) : undefined };
}

/** Spends the step: bumps the counter on disk and returns the new state and the step dir. */
export function beginStep(root) {
  const { state, n, stepDir } = peekStep(root);
  const next = { ...state, step: n };
  writeState(root, next);
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

## COMMIT TRAILERS (end every lane commit message with exactly these lines)
${state.trailers.join("\n")}

## STEP LAW
* ONE step per launch: do the next step above, then stop. A step stays under about 10 to 15 minutes or 40 tool calls.
* Before you stop, rewrite ${join(laneRoot, "state.json")} (same keys; keep the step counter as it stands) with the new head, the owed rows, the live seats, the worktree map and the next step (the trailers stay as they stand), and write your hand-back to ${join(stepDir, "out.md")}.
* A seat you start runs outside your context: record it in the state and stop; never poll for it. The next step reads its result path.
* Stop at a wall, at a design question that needs an operator ruling (name it with its options and your lean), or at the push go.
`;
}
