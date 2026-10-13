/**
 * lares shore — a person's answers at the disk shore.
 *
 *   lares shore                                       what stands for a hand: each standoff and its key
 *   lares shore take-records <uri> --key <key> [--bag <bagUri>] [--yes]
 *
 * The disk projector decides nothing a person owns. Where the disk and the records say different things
 * and no base names which moved last, it writes nothing and raises a keyed alert. A person settles a
 * standoff by ingesting the file (`lares ingest`), by saving in the wiki until both sides say the same
 * thing, or here: by taking the records' side under the key the alert showed.
 *
 * The verb rides one line over the daemon's sock into the active wiki's island (`wiki-act`), which
 * answers for the mirrors it holds. An answer names the state its giver read; where that state moved, the
 * island refuses by name and nothing writes.
 */

import { createInterface } from "readline/promises";
import { stdin, stdout } from "process";
import type { ParsedArgs } from "../parse-args.js";
import { emit, exitFor, wantsJson } from "../render.js";
import { summaryOutput, type SubmitResult } from "../verb-result.js";
import { runVerb, verbFailure } from "../verb-call.js";
import { vesselDid } from "../env.js";

/** The verb the island answers at its disk shore (`@lararium/node` `shore-verb.ts`, `SHORE_VERB`). */
export const SHORE_VERB = "shore";

/** The acts this door carries. */
export const SHORE_ACTS = ["list", "take-records"] as const;
export type ShoreAct = (typeof SHORE_ACTS)[number];

function printUsage(): void {
  console.log("usage: lares shore [list]");
  console.log("       lares shore take-records <uri> --key <key> [--bag <bagUri>] [--yes]");
  console.log("  list          what stands at the disk shore for a hand: each standoff with its key;");
  console.log("  take-records  write the records' render over the file of one standoff, named by its key.");
}

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

/** The args one act sends, or the usage fault that stops it. */
export function shoreArgs(act: ShoreAct, args: ParsedArgs): { readonly args: Record<string, unknown> } | { readonly usage: string } {
  const bag = args.options["bag"];
  if (act === "list") return { args: { op: "list" } };
  const uri = args.positional[1];
  const key = args.options["key"];
  if (!uri || !key) return { usage: "take-records names a carrier and the standoff's key: lares shore take-records <uri> --key <key>" };
  return { args: { op: "take-records", uri, key, ...(bag ? { bag } : {}) } };
}

export async function cmdShore(args: ParsedArgs): Promise<number> {
  const act = (args.positional[0] ?? "list") as ShoreAct;
  if (!(SHORE_ACTS as readonly string[]).includes(act)) { printUsage(); return 2; }
  const shaped = shoreArgs(act, args);
  if ("usage" in shaped) {
    emit(args, { ok: false, error: { code: "usage", message: shaped.usage }, human: () => { console.error(`lares shore: ${shaped.usage}`); printUsage(); } });
    return exitFor("usage");
  }

  // An act that writes asks first (a person at a TTY), or carries `--yes` (an agent).
  if (act !== "list" && !args.flags["yes"]) {
    if (wantsJson(args)) {
      emit(args, { ok: false, error: { code: "usage", message: "confirmation required", hint: "pass --yes for non-interactive (agent) invocation" }, human: () => { /* unreachable */ } });
      return exitFor("usage");
    }
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl.question(`${act} ${String(shaped.args["uri"] ?? "")}: the file's present bytes give way to the records' render. Proceed? [y/N] `);
    rl.close();
    if (!/^y(es)?$/i.test(answer.trim())) { console.log("aborted"); return 1; }
  }

  let did: string;
  try { did = await vesselDid(); } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(args, { ok: false, error: { code: "not-found", message: msg }, human: () => console.error(`lares shore: ${msg}`) });
    return exitFor("not-found");
  }

  let answer: ShoreAnswer;
  try {
    answer = readShoreAnswer(await runVerb("wiki-act", { verb: SHORE_VERB, args: shaped.args }, did, { timeoutMs: 30_000 }));
  } catch (err) {
    const f = verbFailure(err);
    emit(args, {
      ok: false, ...(f.requestId !== undefined ? { requestId: f.requestId } : {}),
      error: { code: f.code, message: f.message, ...(f.hint !== undefined ? { hint: f.hint } : {}) },
      human: () => { console.error(`lares shore: ${f.message}`); if (f.hint !== undefined) console.error(`  ${f.hint}`); },
    });
    return exitFor(f.code);
  }

  if (!answer.ok) {
    emit(args, {
      ok: false, ...(answer.requestId !== undefined ? { requestId: answer.requestId } : {}),
      error: { code: answer.refusal ?? "verb-error", message: answer.why ?? "the island refused" },
      data: answer.output,
      human: () => console.error(`lares shore ${act}: ${answer.refusal}: ${answer.why}`),
    });
    return exitFor("verb-error");
  }

  emit(args, {
    ok: true, ...(answer.requestId !== undefined ? { requestId: answer.requestId } : {}),
    data: answer.output,
    human: () => {
      if (act === "list") {
        const standoffs = Array.isArray(answer.output["standoffs"]) ? (answer.output["standoffs"] as Array<Record<string, unknown>>) : [];
        if (standoffs.length === 0) { console.log("the disk shore holds nothing for a hand"); return; }
        console.log(`${standoffs.length} standoff(s): the disk and the records say different things, and nothing writes`);
        for (const s of standoffs) console.log(`  ${String(s["uri"])}  bag ${String(s["bagId"])}  key ${String(s["standoff"])}`);
        console.log("  settle one: `lares ingest` the file · save in the wiki until both say the same · `lares shore take-records <uri> --key <key>`");
        return;
      }
      console.log(`took the records' side: ${String(answer.output["uri"])} (${String(answer.output["bag"])})`);
    },
  });
  return 0;
}
