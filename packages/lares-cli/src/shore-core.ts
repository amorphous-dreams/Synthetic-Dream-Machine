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

/** Every row one island's shore listed, read across its pages. */
export interface ShoreListing {
  readonly ok:        true;
  readonly standoffs: ReadonlyArray<Record<string, unknown>>;
  readonly pending:   ReadonlyArray<Record<string, unknown>>;
  readonly requestId?: string;
}

/**
 * READ EVERY PAGE OF ONE ISLAND'S LIST. The island answers a page at a time and names the cursor of the page
 * behind (`next`); this hands each cursor back as `after` until none remains. A page that carries a count
 * where its rows belong refuses by name (`shore-list-unpaged`): a list that printed nothing over a full shore
 * would state a thing nobody measured. A cursor that fails to move forward refuses the same way. Each page
 * names the mark of the shore it read (`mark`, folding every row that stands); a mark that moves between two
 * pages refuses as `shore-list-moved`, since the rows read would then name no one shore.
 */
export async function readShoreList(
  ask: (shoreArgs: Readonly<Record<string, unknown>>) => Promise<ShoreAnswer>,
  listArgs: Readonly<Record<string, unknown>>,
): Promise<ShoreListing | (ShoreAnswer & { readonly ok: false })> {
  const standoffs: Array<Record<string, unknown>> = [];
  const pending: Array<Record<string, unknown>> = [];
  let counts: string | null = null;
  let mark: string | null = null;
  let requestId: string | undefined;
  const refuse = (refusal: string, why: string): ShoreAnswer & { readonly ok: false } =>
    ({ ok: false, output: {}, refusal, why, ...(requestId !== undefined ? { requestId } : {}) });
  for (let after: string | null = null; ;) {
    const answer = await ask(after === null ? { ...listArgs, op: "list" } : { ...listArgs, op: "list", after });
    requestId = answer.requestId;
    if (!answer.ok) return answer as ShoreAnswer & { readonly ok: false };
    const o = answer.output;
    for (const name of ["standoffs", "pending"] as const) {
      if (!Array.isArray(o[name])) {
        const count = (o[name] as { boundedArrayCount?: unknown } | null | undefined)?.boundedArrayCount;
        return refuse("shore-list-unpaged", typeof count === "number"
          ? `the shore's ${name} arrived as a count of ${count} and named none of them; this vessel answers an unpaged list`
          : `the shore's answer named no ${name} array`);
      }
    }
    // The mark folds every row that stands; two pages under one mark read one shore.
    const told = `${String(o["standoffCount"])}/${String(o["pendingCount"])}`;
    const markNow = typeof o["mark"] === "string" ? o["mark"] : null;
    if (markNow === null) return refuse("shore-list-unpaged", "the shore's page named no mark of the shore it read; this vessel answers an unpaged list");
    if (mark !== null && markNow !== mark) return refuse("shore-list-moved", `the shore moved while its pages were read (${counts} standoffs/pending, then ${told}); read it again`);
    mark = markNow;
    counts = told;
    standoffs.push(...(o["standoffs"] as Array<Record<string, unknown>>));
    pending.push(...(o["pending"] as Array<Record<string, unknown>>));
    const next = o["next"];
    if (typeof next !== "string" || next === "") break;
    if (after !== null && next <= after) return refuse("shore-list-unpaged", "the shore's cursor stood still between two pages");
    after = next;
  }
  // The pages owe every row the counts name.
  if (counts !== `${standoffs.length}/${pending.length}`) return refuse("shore-list-unpaged", `the shore counted ${counts} standoffs/pending and its pages named ${standoffs.length}/${pending.length}`);
  return { ok: true, standoffs, pending, ...(requestId !== undefined ? { requestId } : {}) };
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
