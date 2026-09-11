/**
 * `lares meme put <uri> [--recipe <slug> | --bag <slug>] [--base <hash>] [--file <path>]`
 * `lares meme get <uri> [--recipe <slug> | --bag <slug>]`
 *
 * THE CLI SKIN of the daemon's `meme-put` / `meme-get` verbs — the one placement function
 * (`placeMeme`) reached from a terminal. The command adds nothing to the verb contract: it names the
 * target, reads the meme text (`--file`, else stdin), carries the writer's base, and hands the receipt
 * back.
 *
 *   · no target        — the ANCHOR: the daemon's own wiki (`recipes/default`), its cascade routing
 *                        the records to the top bag as an in-wiki edit would.
 *   · --recipe <slug>  — an edit AS that wiki: its designated writable bag, write-then-sync.
 *   · --bag <slug>     — a residency placement into that bag; a bag the island cannot write refuses.
 *   · --base <hash>    — the canonical hash the writer read (`meme get` reports it); records that
 *                        moved past it read as a CONFLICT and nothing lands.
 *
 * Slugs ride bare (`sdm`, `lares`). Exit classes: a conflict exits `conflict`; a refusal `verb-error`;
 * an absent meme on `get` exits `not-found`.
 */

import { readFileSync } from "node:fs";
import { stdin, stdout } from "node:process";
import { vesselDid } from "../env.js";
import { runVerb } from "../verb-call.js";
import { readVerbOutcome } from "../verb-result.js";
import { emit, exitFor } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";

class UsageError extends Error {}

export interface MemePlan {
  readonly verb: "meme-put" | "meme-get";
  /** The verb args as the daemon receives them — `text` joins on put once the body is read. */
  readonly args: Record<string, string>;
}

const USAGE = [
  "usage: lares meme put <uri> [--recipe <slug> | --bag <slug>] [--base <hash>] [--file <path>]",
  "       lares meme get <uri> [--recipe <slug> | --bag <slug>]",
  "",
  "  no target       the anchor — the daemon's own wiki (recipes/default)",
  "  --recipe <slug> an edit AS that wiki: its designated writable bag, write-then-sync",
  "  --bag <slug>    a residency placement into that bag (refuses when this island cannot write it)",
  "  --base <hash>   the canonical hash last read; stale → conflict, nothing lands",
  "  --file <path>   the meme text (stdin when absent)",
].join("\n");

function usage(): void { console.error(USAGE); }

/** The verb and its args for a sub-verb — the argument law, with no daemon in reach. */
export function memePlan(sub: "put" | "get", args: ParsedArgs): MemePlan {
  const uri = args.positional[1];
  if (!uri) throw new UsageError(`a uri is required (e.g. \`lares meme ${sub} lar:///ha.ka.ba/...\`)`);
  const recipe = typeof args.options["recipe"] === "string" ? args.options["recipe"].trim() : "";
  const bag    = typeof args.options["bag"]    === "string" ? args.options["bag"].trim()    : "";
  if (recipe && bag) throw new UsageError("name one of --recipe <slug> / --bag <slug>, never both");
  const out: Record<string, string> = { uri };
  if (recipe) out["recipe"] = recipe;
  if (bag)    out["bag"]    = bag;
  if (sub === "put") {
    const base = typeof args.options["base"] === "string" ? args.options["base"].trim() : "";
    if (base) out["base"] = base;
    return { verb: "meme-put", args: out };
  }
  return { verb: "meme-get", args: out };
}

/** The meme body: `--file`, else the whole of stdin. */
async function readBody(args: ParsedArgs): Promise<string> {
  const file = args.options["file"];
  if (typeof file === "string" && file) return readFileSync(file, "utf8");
  if (stdin.isTTY) throw new UsageError("no meme text: pass --file <path> or pipe the meme on stdin");
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export async function cmdMeme(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0];
  if (sub !== "put" && sub !== "get") {
    if (sub) console.error(`lares meme: unknown sub-verb "${sub}"`);
    usage();
    return 2;
  }
  try {
    return sub === "put" ? await memePut(args) : await memeGet(args);
  } catch (err) {
    const msg  = err instanceof Error ? err.message : String(err);
    const code = err instanceof UsageError ? "usage" : /no lares daemon/.test(msg) ? "daemon-unreachable" : "error";
    emit(args, { ok: false, error: { code, message: msg }, human: () => console.error(`lares meme ${sub}: ${msg}`) });
    return exitFor(code);
  }
}

async function memePut(args: ParsedArgs): Promise<number> {
  const plan = memePlan("put", args);
  const text = await readBody(args);
  const result = await runVerb(plan.verb, { ...plan.args, text }, await vesselDid());
  const outcome = readVerbOutcome(result);
  if (!outcome.ok) {
    const code = /cap-denied/.test(outcome.error ?? "") ? "cap-denied" : "verb-error";
    emit(args, { ok: false, requestId: result.requestId, error: { code, message: outcome.error ?? "the verb refused" }, human: () => console.error(`lares meme put: ${outcome.error}`) });
    return exitFor(code);
  }
  const receipt = outcome.output;
  const decision = String(receipt["decision"] ?? "");
  const landed = Array.isArray(receipt["landed"]) ? (receipt["landed"] as string[]) : [];
  const tombstoned = Array.isArray(receipt["tombstoned"]) ? (receipt["tombstoned"] as string[]) : [];
  const warnings = Array.isArray(receipt["warnings"]) ? (receipt["warnings"] as string[]) : [];
  const ok = decision === "ingest" || decision === "noop";
  const code = ok ? "ok" : decision === "conflict" ? "conflict" : "verb-error";
  emit(args, {
    ok,
    requestId: result.requestId,
    data: receipt,
    ...(ok ? {} : { error: { code, message: `${decision}: ${warnings[0] ?? receipt["reason"] ?? plan.args["uri"]}` } }),
    human: () => {
      console.log(`${decision}: ${plan.args["uri"]}`);
      if (decision === "ingest") console.log(`  landed ${landed.length} · tombstoned ${tombstoned.length}`);
      if (decision === "noop" && receipt["reason"]) console.log(`  ${receipt["reason"]}`);
      for (const w of warnings) console.log(`  ! ${w}`);
      if (receipt["canonicalHash"]) console.log(`  base: ${receipt["canonicalHash"]}`);
    },
  });
  return exitFor(code);
}

async function memeGet(args: ParsedArgs): Promise<number> {
  const plan = memePlan("get", args);
  const result = await runVerb(plan.verb, plan.args, await vesselDid());
  const outcome = readVerbOutcome(result);
  if (!outcome.ok) {
    const code = /cap-denied/.test(outcome.error ?? "") ? "cap-denied" : "verb-error";
    emit(args, { ok: false, requestId: result.requestId, error: { code, message: outcome.error ?? "the verb refused" }, human: () => console.error(`lares meme get: ${outcome.error}`) });
    return exitFor(code);
  }
  const meme = outcome.output["meme"] as { text: string; canonicalHash: string } | null | undefined;
  if (!meme) {
    emit(args, { ok: false, requestId: result.requestId, error: { code: "not-found", message: `no meme at ${plan.args["uri"]}` }, human: () => console.error(`lares meme get: no meme at ${plan.args["uri"]}`) });
    return exitFor("not-found");
  }
  emit(args, {
    ok: true,
    requestId: result.requestId,
    data: { uri: plan.args["uri"], text: meme.text, canonicalHash: meme.canonicalHash },
    // The text alone reaches stdout, so `lares meme get <uri> > file` carries the meme; the base rides stderr.
    human: () => { stdout.write(meme.text); console.error(`base: ${meme.canonicalHash}`); },
  });
  return 0;
}
