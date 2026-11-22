/** What the meme door and the family door share: the usage refusal, the face and target a line names, the dispatch. */
import { runVerb, runVerbAsFace } from "../verb-call.js";
import { faceOption, FaceOptionMalformed } from "../face-option.js";
import { targetOption, TargetOptionMalformed } from "../target-option.js";
import type { ParsedArgs } from "../parse-args.js";

export class UsageError extends Error {}

/**
 * EACH HAT REACHED BY NAME (worn = the default reach · lit = reachable by name · shut = silent): `--face N` names the face a
 * store verb acts as, and the verb rides a session of that face (`runVerbAsFace`), sealed by that face's own chain; with no
 * `--face` the one-shot acts for the worn face. A malformed `--face` refuses `face-malformed` before any door opens.
 */
export function faceNamed(args: ParsedArgs): { face?: number } {
  try { return faceOption(args); }
  catch (error) { if (error instanceof FaceOptionMalformed) throw new UsageError(error.message); throw error; }
}

/** A read's `--target` (the lit face it visits, keeping the face worn), or nothing; a malformed one refuses as usage. */
export function targetNamed(args: ParsedArgs): { target?: string } {
  try { return targetOption(args); }
  catch (error) { if (error instanceof TargetOptionMalformed) throw new UsageError(error.message); throw error; }
}

/** Dispatch a plan: the worn face's one-shot, or a session of the face `--face` named. */
export function dispatch(plan: { readonly verb: string; readonly face?: number }, verbArgs: Record<string, unknown>, did: string): ReturnType<typeof runVerb> {
  return plan.face === undefined ? runVerb(plan.verb, verbArgs, did) : runVerbAsFace(plan.verb, verbArgs, plan.face);
}

/** A refusal's code: the shut face's by name, a cap's, else the verb's. */
export function refusalCodeOf(error: string | null | undefined): string {
  if (/^face-not-open:/.test(error ?? "")) return "face-not-open";
  return /cap-denied/.test(error ?? "") ? "cap-denied" : "verb-error";
}

/** Where a write landed, as its answer names it: the bag, and the face where `--face` named one. */
export function landedFace(receipt: Record<string, unknown>): string {
  return typeof receipt["face"] === "number" ? ` (face h${receipt["face"]})` : "";
}

