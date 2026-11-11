/**
 * override-shore — the working overrides a canon change left standing off, read and answered at the shore.
 *
 * The island derives each standoff from its records (`override-bases.ts`, `@lararium/tw5`) and answers it through the
 * daemon's `override` verb, one canon bag at a time. `lares shore` lists them beside the disk standoffs, and answers one
 * by its key: `take-working` keeps the override (re-based on the canon text that stands), `take-canon` retracts it.
 */

import { bagUri } from "@lararium/mesh";
import { runVerb } from "./verb-call.js";
import { summaryOutput, type SubmitResult } from "./verb-result.js";

/** The verb the daemon answers for working overrides. */
export const OVERRIDE_VERB = "override";

type RunVerb = (name: string, args: Record<string, unknown>, did: string, opts: { timeoutMs: number }) => Promise<SubmitResult>;

/** A canon bag named by its uri or its slug. */
export function canonBagOf(named: string): string {
  return named.startsWith("lar:") ? named : bagUri(named);
}

const outputOf = (r: SubmitResult): Record<string, unknown> =>
  r.status === "error" ? { ok: false, refusal: "verb-error", why: r.errorMessage ?? "the daemon refused and named no reason" } : (summaryOutput(r) ?? {});

/** Every override standing off over each named canon bag, read across the verb's pages. A bag that refuses names why. */
export async function listOverrides(bags: readonly string[], did: string, run: RunVerb = runVerb): Promise<{
  readonly standoffs: Array<Record<string, unknown>>; readonly refused: Array<{ bag: string; why: string }>;
}> {
  const standoffs: Array<Record<string, unknown>> = [];
  const refused: Array<{ bag: string; why: string }> = [];
  for (const bag of bags) {
    for (let after: string | null = null; ;) {
      const o = outputOf(await run(OVERRIDE_VERB, { op: "list", bag, ...(after !== null ? { after } : {}) }, did, { timeoutMs: 30_000 }));
      if (o["ok"] !== true || !Array.isArray(o["standoffs"])) { refused.push({ bag, why: `${String(o["refusal"] ?? "override-list-unread")}: ${String(o["why"] ?? "the answer named no standoff rows")}` }); break; }
      standoffs.push(...(o["standoffs"] as Array<Record<string, unknown>>));
      const next = o["next"];
      if (typeof next !== "string" || next === "" || (after !== null && next <= after)) break;
      after = next;
    }
  }
  return { standoffs, refused };
}

/** Answer one override standoff by its key. */
export async function answerOverrideAt(op: "take-working" | "take-canon", bag: string, title: string, key: string, did: string, run: RunVerb = runVerb): Promise<Record<string, unknown>> {
  return outputOf(await run(OVERRIDE_VERB, { op, bag, title, key }, did, { timeoutMs: 30_000 }));
}
