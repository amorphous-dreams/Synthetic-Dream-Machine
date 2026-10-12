/**
 * `lares receipt <requestId>` / `lares cancel <requestId>` — the two doors M14 names: a verb that
 * outcome-unknown (and now `request-abandoned`, M3′) tells an operator to "check a request" had no
 * door to walk through until these two existed.
 *
 *   receipt <requestId>   — a READ (`queryReceipt`, H1). Never dispatches anything; answers from the
 *                           vessel's own ledger + durable outcome doc exactly as a `runVerb` read-back
 *                           would, without running a second attempt.
 *   cancel  <requestId>   — the OPERATOR's own explicit withdrawal (`cancelRequest`, M8). Marks the
 *                           id abandoned on the vessel's ledger so a LATER line under the same id (a
 *                           stray retry, a re-run) refuses rather than running. Never sent on a bare
 *                           timeout by any automated path — council ruling 4: a caller's own local
 *                           wait ending is not a withdrawal, only this operator-typed command is.
 *
 * Both route through the ordinary `{dataDir}` resolution every other command uses; both carry M13's
 * bounded read patience, so a frozen/wedged vessel answers `unanswered` rather than hanging the CLI.
 */

import { queryReceipt, cancelRequest, UdsUnreachable, type ReceiptAnswer } from "../local-connector.js";
import { emit, exitFor } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";

function printReceiptUsage(verb: "receipt" | "cancel"): void {
  console.error(`usage: lares ${verb} <requestId>`);
}

/** Map a {@link ReceiptAnswer} state to this door's own exit-code vocabulary. */
function codeFor(state: ReceiptAnswer["state"]): string {
  switch (state) {
    case "abandoned":  return "request-abandoned";
    case "interrupted": return "request-interrupted";
    case "evicted":    return "retention-gap";
    case "error":      return "verb-error";
    case "unanswered": return "outcome-unknown";
    case "unknown":    return "not-found";
    default:           return "ok"; // "committed" | "done"
  }
}

async function runReadOnlyDoor(
  verb: "receipt" | "cancel",
  args: ParsedArgs,
  read: (requestId: string) => Promise<ReceiptAnswer>,
): Promise<number> {
  const requestId = args.positional[0];
  if (!requestId) { printReceiptUsage(verb); return 2; }

  let answer: ReceiptAnswer;
  try {
    answer = await read(requestId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = err instanceof UdsUnreachable ? "daemon-unreachable" : "verb-error";
    emit(args, {
      ok: false, requestId,
      error: { code, message: msg, ...(code === "daemon-unreachable" ? { hint: "Start the daemon with `lares vessel stand --foreground` and try again." } : {}) },
      human: () => {
        console.error(`lares ${verb}: ${msg}`);
        if (code === "daemon-unreachable") console.error("  Start the daemon with `lares vessel stand --foreground` and try again.");
      },
    });
    return exitFor(code);
  }

  const code = codeFor(answer.state);
  const ok   = code === "ok";
  emit(args, {
    ok, requestId,
    data: { state: answer.state, ...(answer.results !== undefined ? { results: answer.results } : {}) },
    ...(ok ? {} : { error: { code, message: answer.errorMessage ?? `request ${requestId} reads "${answer.state}"` } }),
    human: () => {
      console.log(`${verb} ${requestId}: ${answer.state}`);
      if (answer.errorMessage !== undefined) console.log(`  ${answer.errorMessage}`);
      if (answer.results !== undefined) console.log(`  results: ${JSON.stringify(answer.results)}`);
    },
  });
  return exitFor(code);
}

export async function cmdReceipt(args: ParsedArgs): Promise<number> {
  return await runReadOnlyDoor("receipt", args, (requestId) => queryReceipt(requestId));
}

export async function cmdCancel(args: ParsedArgs): Promise<number> {
  return await runReadOnlyDoor("cancel", args, (requestId) => cancelRequest(requestId));
}
