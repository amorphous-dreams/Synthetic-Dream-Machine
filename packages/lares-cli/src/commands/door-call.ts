/**
 * door-call — the flag-blind half the tiddler door's two CLI hosts share (`lares tiddler …`, `lares wiki filter |
 * render | status`): the planned call, the option readers that take a VALUE (each host reads its own flags by name, so
 * the accepts law walks them), the one runner that hands back the daemon verb's own answer, and the shared fault guard.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout
 */

import { vesselDid } from "../env.js";
import { runVerb, verbFailure } from "../verb-call.js";
import { readVerbOutcome } from "../verb-result.js";
import { emit, exitFor } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";

export class DoorUsage extends Error {}

/** One planned call: the daemon verb and the args it receives. */
export interface DoorPlan {
  readonly verb: string;
  readonly args: Record<string, unknown>;
}

/** An option's value, trimmed; null where the line named none. */
export const wordOf = (raw: string | undefined): string | null => (typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null);

/** A count option's value (`--limit`, `--max-bytes`): digits alone, at least one. */
export function countOf(raw: string | undefined, name: string): number | null {
  const word = wordOf(raw);
  if (word === null) return null;
  if (!/^[0-9]+$/.test(word) || Number(word) < 1) throw new DoorUsage(`--${name} takes a count of at least 1 (got "${word}")`);
  return Number(word);
}

/** A comma-joined list option's value (`--fields a,b`, `--unset a,b`) as names. */
export function namesOf(raw: string | undefined): string[] | null {
  const word = wordOf(raw);
  return word === null ? null : word.split(",").map((part) => part.trim()).filter((part) => part !== "");
}

/**
 * RUN ONE PLANNED CALL AND HAND BACK THE VERB'S OWN ANSWER, or emit the refusal and its exit. A refusal crosses with
 * the house's own code where the vessel named one (`filter-malformed`, `tiddler-delete-in-a-family`, `cap-denied`, …):
 * the code leads the message, so a script branches on it.
 */
export async function runDoor(args: ParsedArgs, label: string, plan: DoorPlan): Promise<{ ok: true; requestId: string; output: Record<string, unknown> } | { ok: false; exit: number }> {
  const result = await runVerb(plan.verb, plan.args, await vesselDid());
  const outcome = readVerbOutcome(result);
  if (outcome.ok) return { ok: true, requestId: result.requestId, output: outcome.output };
  const message = outcome.error ?? "the verb refused";
  const named = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)+):/.exec(message)?.[1];
  const code = named === "cap-denied" ? "cap-denied" : "verb-error";
  emit(args, {
    ok: false, requestId: result.requestId,
    error: { code, message, ...(named && named !== "cap-denied" ? { hint: `refusal: ${named}` } : {}) },
    human: () => console.error(`lares ${label}: ${message}`),
  });
  return { ok: false, exit: exitFor(code) };
}

/** A door's shared fault handling: usage and container refusals exit 2, a transport fault names itself. */
export async function guardDoor(args: ParsedArgs, label: string, run: () => Promise<number>): Promise<number> {
  try { return await run(); }
  catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: unknown }).code === "no-container") {
      const msg = err instanceof Error ? err.message : String(err);
      emit(args, { ok: false, error: { code: "no-container", message: msg }, human: () => console.error(msg) });
      return 2;
    }
    if (err instanceof DoorUsage) {
      const msg = err.message;
      emit(args, { ok: false, error: { code: "usage", message: msg }, human: () => console.error(`lares ${label}: ${msg}`) });
      return exitFor("usage");
    }
    const f = verbFailure(err);
    emit(args, {
      ok: false, ...(f.requestId !== undefined ? { requestId: f.requestId } : {}),
      error: { code: f.code, message: f.message, ...(f.hint !== undefined ? { hint: f.hint } : {}) },
      human: () => console.error(`lares ${label}: ${f.message}`),
    });
    return exitFor(f.code);
  }
}
