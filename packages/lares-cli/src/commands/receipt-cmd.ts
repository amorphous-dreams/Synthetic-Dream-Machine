/**
 * `lares receipt <requestId>` / `lares cancel <requestId>` — the two doors a verb's outcome names when it
 * tells an operator to check a request (outcome-unknown, `request-abandoned`).
 *
 *   receipt <requestId>   — a READ (`queryReceipt`). Never dispatches anything; answers from the
 *                           vessel's own ledger + durable outcome doc exactly as a `runVerb` read-back
 *                           would, without running a second attempt.
 *   cancel  <requestId>   — the OPERATOR's own explicit withdrawal (`cancelRequest`). Marks the id
 *                           abandoned on the vessel's ledger so a LATER line under the same id (a stray
 *                           retry, a re-run) refuses rather than running. No automated path sends it on
 *                           a bare timeout: a caller's own local wait ending withdraws nothing; only this
 *                           operator-typed command does.
 *                           The door reports TWO receipts and keeps them apart
 *                           (lar:///ha.ka.ba/lararium/mesh/receipt-ledger#/three-receipts): the
 *                           caller's abandonment (this command, sent) and the vessel's outcome (the
 *                           state its ledger holds once the cancel took its turn). `withdrawn` reads
 *                           true only where that state reads `abandoned`; a cancel that met a commit
 *                           reads `cancel-lost`, and the act it met runs on.
 *
 * Both route through the ordinary `{dataDir}` resolution every other command uses; both carry the
 * bounded read patience every read-back carries, so a frozen or wedged vessel answers `unanswered`
 * rather than hanging the CLI.
 */

import { queryReceipt, cancelRequest, UdsUnreachable, type ReceiptAnswer } from "../local-connector.js";
import { emit, exitFor } from "../render.js";
import { refusalCode, refusalHint } from "../verb-call.js";
import type { ParsedArgs } from "../parse-args.js";

function printReceiptUsage(verb: "receipt" | "cancel"): void {
  console.error(`usage: lares ${verb} <requestId>`);
}

/**
 * Map a {@link ReceiptAnswer} to this door's own exit-code vocabulary. A refusal the vessel named (a torn fact)
 * reads under its own code on both doors. On the cancel door a request the vessel already took reads
 * `cancel-lost`: the withdrawal reached the ledger after a fact stood, and changed nothing.
 */
function codeFor(verb: "receipt" | "cancel", answer: ReceiptAnswer): string {
  const state = answer.state;
  const named = answer.refusal?.reason;
  // A torn fact answers under the state `error` and holds no verdict: its own name leads on both doors.
  if (named === "receipt-fact-torn") return refusalCode(named);
  if (verb === "cancel") {
    if (state === "abandoned") return "ok";
    if (state === "committed" || state === "done" || state === "error") return "cancel-lost";
  }
  // On the receipt door a landed refusal reads under the name its outcome carries.
  if (named !== undefined) return refusalCode(named);
  switch (state) {
    case "abandoned":  return "request-abandoned";
    case "interrupted": return "request-interrupted";
    case "evicted":    return "retention-gap";
    case "error":      return "verb-error";
    case "unanswered": return "outcome-unknown";
    case "unknown":    return "not-found";
    case "committed":
    case "done":       return "ok";
    // A line that names no state this door knows (the vessel's own fault answer) never reads as ok.
    default:           return "verb-error";
  }
}

/**
 * The cure beside a refusal code, the same words `lares act` carries. The receipt door knows no
 * change id and no verb, so an `interrupted` id cannot claim a re-run is safe: it names the
 * effect index that answers what landed.
 */
function hintFor(code: string, requestId: string, state: ReceiptAnswer["state"]): string | undefined {
  if (code === "cancel-lost") {
    return state === "committed"
      ? `the vessel committed this request before the cancel reached its ledger, and the act runs on. Read its outcome with \`lares receipt ${requestId}\`.`
      : `a fact already stood for this request when the cancel reached the ledger. \`lares receipt ${requestId}\` reads the same outcome.`;
  }
  if (code === "outcome-unknown" && state === "unanswered") {
    return `the vessel gave no answer, so the cancel may or may not have reached its ledger. \`lares receipt ${requestId}\` reads which.`;
  }
  if (code === "request-interrupted") {
    return "the vessel stopped while this request ran, so its effect may have landed in part. If the original gesture carried a `--change-id`, re-run it with that same id: the effect index answers what landed without running it twice.";
  }
  return refusalHint(code, undefined);
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

  // THE VESSEL'S OWN FAULT LINE names no state (`{status:"error", errorMessage, refusal?}`): the ledger or the
  // outcome read failed under this door. It reads as a fault under its own name, never as a verdict on the id.
  if (typeof (answer as { state?: unknown }).state !== "string") {
    const faultCode = answer.refusal?.reason !== undefined ? refusalCode(answer.refusal.reason) : "verb-error";
    const msg = answer.errorMessage ?? "the vessel answered no state for this request";
    emit(args, { ok: false, requestId, error: { code: faultCode, message: msg }, human: () => console.error(`lares ${verb}: ${msg}`) });
    return exitFor(faultCode);
  }

  const code = codeFor(verb, answer);
  const ok   = code === "ok";
  const hint = ok ? undefined : hintFor(code, requestId, answer.state);
  // The cancel door says whether the withdrawal stands, beside the state the vessel holds: two receipts, kept apart.
  const withdrawn = verb === "cancel" ? { withdrawn: answer.state === "abandoned" } : {};
  const message = code === "cancel-lost"
    ? `the vessel holds request ${requestId} as "${answer.state}"; the cancel changed nothing`
    : answer.errorMessage ?? `request ${requestId} reads "${answer.state}"`;
  emit(args, {
    ok, requestId,
    data: { state: answer.state, ...withdrawn, ...(answer.results !== undefined ? { results: answer.results } : {}) },
    ...(ok ? {} : { error: { code, message, ...(hint !== undefined ? { hint } : {}) } }),
    human: () => {
      console.log(verb === "cancel"
        ? `cancel ${requestId}: ${answer.state === "abandoned" ? "withdrawn" : "not withdrawn"} (the vessel holds it ${answer.state})`
        : `${verb} ${requestId}: ${answer.state}`);
      if (code === "cancel-lost") console.log(`  ${message}`);
      if (answer.errorMessage !== undefined) console.log(`  ${answer.errorMessage}`);
      if (hint !== undefined) console.log(`  ${hint}`);
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
