/**
 * `lares draft <uri> [--to <bag>] [--yes]`
 *
 * Pull-into-draft ceremony — copies a tiddler currently resolving from a
 * lower bag into a writable draft bag (default: the active wiki draft /
 * composite default writable). The source bag stays intact; the new copy
 * overlays via composite priority. Operator can then edit the draft and
 * land it into another bag through a residency ACTION verb (`lares act`).
 *
 * Flags:
 *   --to <bag>     target draft bag (default: active wiki draft)
 *   --yes          skip confirmation
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { vesselDid } from "../env.js";
import { summaryOutput } from "../verb-result.js";
import { OUTCOME_URI_PREFIX } from "@lararium/mesh";
import { runVerb, verbFailure } from "../verb-call.js";
import { emit, wantsJson, exitFor } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";


export async function cmdDraft(args: ParsedArgs): Promise<number> {
  const tiddler = args.positional[0];
  const toBag   = args.options["to"];

  if (!tiddler) {
    console.error("usage: lares draft <uri> [--to <bag>] [--yes]");
    return 2;
  }

  let did: string;
  try {
    did = await vesselDid();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(args, { ok: false, error: msg, human: () => console.error(`lares draft: ${msg}`) });
    return 3;
  }

  // UDS fast path, WS fallback (the lares↔lararium binding).
  let where;
  try {
    where = await runVerb("where", { tiddler }, did);
  } catch (err) {
    // M3′: a LOCAL WAIT ENDING is not an absent daemon — told apart by the error's own TYPE.
    const f = verbFailure(err);
    emit(args, {
      ok: false, ...(f.requestId !== undefined ? { requestId: f.requestId } : {}),
      error: { code: f.code, message: f.message, ...(f.hint !== undefined ? { hint: f.hint } : {}) },
      human: () => { console.error(`lares draft: ${f.message}`); if (f.hint !== undefined) console.error(`  ${f.hint}`); },
    });
    return exitFor(f.code);
  }
  if (where.status === "error") {
    const msg = where.errorMessage ?? "unknown";
    emit(args, { ok: false, error: msg, human: () => console.error(`recipe-presence query failed: ${msg}`) });
    return 4;
  }
  const whereSummary = summaryOutput(where) ?? {};
  const bags    = (whereSummary["bags"] ?? []) as string[];
  const primary = whereSummary["primaryBag"] as string | null;
  if (!primary) {
    emit(args, {
      ok: false, error: `tiddler not found in any bag: ${tiddler}`,
      data: { tiddler },
      human: () => console.error(`tiddler not found in any bag: ${tiddler}`),
    });
    return 5;
  }

  // The confirmation prompt belongs to the HUMAN/TTY path only — an agent
  // (JSON / off-TTY) MUST carry intent explicitly via --yes.
  if (!args.flags["yes"]) {
    if (wantsJson(args)) {
      emit(args, {
        ok: false, error: "confirmation required: pass --yes for non-interactive (agent) invocation",
        human: () => { /* unreachable on the JSON path */ },
      });
      return 1;
    }
    console.log("");
    console.log(`  tiddler:   ${tiddler}`);
    console.log(`  currently: ${bags.join(", ")}`);
    console.log(`  draft to:  ${toBag ?? "(active wiki draft)"}`);
    console.log("");
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl.question("Proceed? [y/N] ");
    rl.close();
    if (answer.trim().toLowerCase() !== "y") {
      console.log("aborted.");
      return 0;
    }
  }

  const draftArgs: Record<string, string> = { tiddler };
  if (toBag) draftArgs["toBag"] = toBag;

  let result;
  try {
    result = await runVerb("draft", draftArgs, did);
  } catch (err) {
    // M3′: this door's SECOND submit went uncaught entirely — an outcome-unknown read-back from
    // `where` just above surfaced it, but a wait expiring on the actual draft-land left the CLI to
    // crash on an unhandled rejection instead of telling the operator anything.
    const f = verbFailure(err);
    emit(args, {
      ok: false, ...(f.requestId !== undefined ? { requestId: f.requestId } : {}),
      error: { code: f.code, message: f.message, ...(f.hint !== undefined ? { hint: f.hint } : {}) },
      human: () => { console.error(`lares draft: ${f.message}`); if (f.hint !== undefined) console.error(`  ${f.hint}`); },
    });
    return exitFor(f.code);
  }
  if (result.status === "error") {
    const msg = result.errorMessage ?? "unknown";
    emit(args, {
      ok: false, requestId: result.requestId, error: msg,
      human: () => console.error(`draft failed: ${msg}`),
    });
    return 6;
  }

  const r = summaryOutput(result) ?? {};
  const receiptUri = `${OUTCOME_URI_PREFIX}${result.requestId}`;
  emit(args, {
    ok: true,
    requestId: result.requestId,
    data: { tiddler, fromBag: r["fromBag"] ?? null, toBag: r["toBag"], status: r["status"], receipt: receiptUri },
    human: () => {
      console.log(`drafted: ${tiddler}`);
      console.log(`  ${r["fromBag"] ?? "(none)"} → ${r["toBag"]}`);
      console.log(`  status: ${r["status"]}`);
      console.log(`  receipt: ${receiptUri}`);
    },
  });
  return 0;
}
