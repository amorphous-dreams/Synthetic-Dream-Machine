/**
 * shore-core — the one line every shore act rides: `wiki-act` carrying the `shore` verb into the active
 * wiki's island, and the island's answer read whole. `lares shore` sends a person's answers through it;
 * `lares watch` sends what it sensed on disk.
 */

import { summaryOutput, type SubmitResult } from "./verb-result.js";
import { runVerb } from "./verb-call.js";

/** The verb the island answers at its disk shore (`@lararium/node` `shore-verb.ts`, `SHORE_VERB`). */
export const SHORE_VERB = "shore";

/** The island's answer to one shore act, read whole. */
export interface ShoreAnswer {
  readonly ok:      boolean;
  readonly output:  Record<string, unknown>;
  readonly refusal: string | null;
  readonly why:     string | null;
  readonly requestId?: string;
}

/** Read a `wiki-act` outcome as the island's shore answer. A verb that failed outright answers as a refusal. */
export function readShoreAnswer(result: SubmitResult): ShoreAnswer {
  if (result.status === "error") {
    return { ok: false, output: {}, refusal: "verb-error", why: result.errorMessage ?? "the daemon refused and named no reason", requestId: result.requestId };
  }
  const output = summaryOutput(result) ?? {};
  const ok = output["ok"] === true;
  return {
    ok, output,
    refusal: ok ? null : typeof output["refusal"] === "string" ? output["refusal"] : "shore-answer-unread",
    why: ok ? null : typeof output["why"] === "string" ? output["why"] : "the island answered in a shape this door cannot read",
    requestId: result.requestId,
  };
}

/** Send one shore act to the active wiki's island and read its answer. Throws what `runVerb` throws. */
export async function askShore(
  shoreArgs: Readonly<Record<string, unknown>>, did: string,
  run: (name: string, args: Record<string, unknown>, did: string, opts: { timeoutMs: number }) => Promise<SubmitResult> = runVerb,
): Promise<ShoreAnswer> {
  // A sense or an answer over many carriers reconciles each one: the wait grows with the count.
  const many = Array.isArray(shoreArgs["uris"]) ? (shoreArgs["uris"] as unknown[]).length : 0;
  return readShoreAnswer(await run("wiki-act", { verb: SHORE_VERB, args: { ...shoreArgs } }, did, { timeoutMs: 30_000 + many * 200 }));
}
