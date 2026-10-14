/**
 * lares shore — a person's answers at the disk shore.
 *
 *   lares shore [list]                                    what stands for a hand
 *   lares shore take-records <uri> --key <key> [--bag <bagUri>] [--yes]
 *   lares shore take-disk    <uri> --key <key> [--bag <bagUri>] [--yes]
 *   lares shore restore (<uri>… | --all --count <n>) [--bag <bagUri>] [--yes]
 *   lares shore remove  (<uri>… | --all --count <n>) [--bag <bagUri>] [--yes]
 *
 * The disk projector decides nothing a person owns.
 *
 *   · A STANDOFF: the disk and the records say different things and no rule picks. Nothing writes. A
 *     person settles it under the key the alert showed, toward either side: `take-disk` lands the file's
 *     words in the records, `take-records` writes the records' render over the file. Saving in the wiki
 *     until both sides say the same thing settles it too. Where no base stands, `lares ingest` of the file
 *     names the same adoption `take-disk` does.
 *   · A PENDING REMOVAL: a file vanished from the path its base names. Nothing writes it back and nothing
 *     tombstones its records. `restore` writes the file back from the records; `remove` deletes the
 *     carrier in the wiki, where the wiki shore lands the tombstone.
 *
 * `list` looks at the disk first, so what it shows stands true to the bytes at that instant, and it reads
 * every page the island answers, so a list of any length names every row. An answer
 * names the state its giver read: a standoff's key, and for more than one pending removal the count. Where
 * that state moved, the island refuses by name and nothing changes.
 *
 * The verb rides two lines over the daemon's sock: into the active wiki's island (`wiki-act`) and into the
 * daemon island (the `shore` verb itself), each answering for the mirrors it holds (`askShore`). The list
 * reads both as one shore and names each row's island; an answer goes to the island that holds its state.
 */

import { createInterface } from "readline/promises";
import { stdin, stdout } from "process";
import type { ParsedArgs } from "../parse-args.js";
import { emit, exitFor, wantsJson } from "../render.js";
import { verbFailure } from "../verb-call.js";
import { vesselDid } from "../env.js";
import { askShore, readShoreList, type ShoreAnswer } from "../shore-core.js";
import { takeDisk } from "../shore-take-disk.js";
import { openSyncedTree } from "../ingest-core.js";
import { larRoot } from "../env.js";

/** The acts this door carries. */
export const SHORE_ACTS = ["list", "take-records", "take-disk", "restore", "remove"] as const;
export type ShoreAct = (typeof SHORE_ACTS)[number];

function printUsage(): void {
  console.log("usage: lares shore [list]");
  console.log("       lares shore take-records <uri> --key <key> [--bag <bagUri>] [--yes]");
  console.log("       lares shore take-disk    <uri> --key <key> [--bag <bagUri>] [--yes]");
  console.log("       lares shore restore (<uri>… | --all --count <n>) [--bag <bagUri>] [--yes]");
  console.log("       lares shore remove  (<uri>… | --all --count <n>) [--bag <bagUri>] [--yes]");
  console.log("  list          look at the disk, then name each standoff with its key and each pending removal;");
  console.log("  take-records  write the records' render over the file of one standoff, named by its key;");
  console.log("  take-disk     land the file's words in the records for one standoff, named by its key;");
  console.log("  restore       write a vanished file back from the records;");
  console.log("  remove        delete the vanished carrier in the wiki (its tombstone lands in the working layer);");
  console.log("  an answer over more than one carrier names the count that stands pending (--count).");
}

/** The args one act sends, or the usage fault that stops it. */
export function shoreArgs(act: ShoreAct, args: ParsedArgs): { readonly args: Record<string, unknown> } | { readonly usage: string } {
  const bag = args.options["bag"];
  const withBag = bag ? { bag } : {};
  if (act === "list") return { args: { op: "list", ...withBag } };
  if (act === "take-records" || act === "take-disk") {
    const uri = args.positional[1];
    const key = args.options["key"];
    if (!uri || !key) return { usage: `${act} names a carrier and the standoff's key: lares shore ${act} <uri> --key <key>` };
    return { args: { op: act, uri, key, ...withBag } };
  }
  const uris = args.positional.slice(1);
  const all = Boolean(args.flags["all"]);
  const countText = args.options["count"];
  const count = countText !== undefined ? Number(countText) : undefined;
  if (count !== undefined && (!Number.isInteger(count) || count < 0)) return { usage: `--count names a whole number of carriers; "${countText}" names none` };
  if (all && uris.length > 0) return { usage: `${act} names carriers or --all, never both` };
  if (!all && uris.length === 0) return { usage: `${act} names a carrier, or --all with --count: lares shore ${act} <uri>` };
  if ((all || uris.length > 1) && count === undefined) return { usage: `${act} over more than one carrier names the count that stands pending: --count <n> (read it from \`lares shore\`)` };
  return { args: { op: act, ...(all ? { all: true } : { uris }), ...(count !== undefined ? { count } : {}), ...withBag } };
}

/** What a person confirms before an act that writes. */
function confirmLine(act: ShoreAct, shaped: Record<string, unknown>): string {
  if (act === "take-records") return `take-records ${String(shaped["uri"])}: the file's present bytes give way to the records' render. Proceed? [y/N] `;
  if (act === "take-disk") return `take-disk ${String(shaped["uri"])}: the records give way to the file's present words. Proceed? [y/N] `;
  const what = shaped["all"] === true ? `all ${String(shaped["count"])} pending carrier(s)` : (shaped["uris"] as string[]).join(", ");
  return act === "restore"
    ? `restore ${what}: each file returns from the records. Proceed? [y/N] `
    : `remove ${what}: each carrier leaves the wiki, and its records rest under a tombstone. Proceed? [y/N] `;
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
    const answer = await rl.question(confirmLine(act, shaped.args));
    rl.close();
    if (!/^y(es)?$/i.test(answer.trim())) { console.log("aborted"); return 1; }
  }

  let did: string;
  try { did = await vesselDid(); } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(args, { ok: false, error: { code: "not-found", message: msg }, human: () => console.error(`lares shore: ${msg}`) });
    return exitFor("not-found");
  }

  // TAKE-DISK rides the ingest leg, under the key (`shore-take-disk.ts`): the island names the standoff's
  // states, and the file lands only where the disk and the records still stand as the person read them.
  if (act === "take-disk") {
    let taken;
    try {
      taken = await takeDisk(
        { uri: String(shaped.args["uri"]), key: String(shaped.args["key"]), ...(typeof shaped.args["bag"] === "string" ? { bag: shaped.args["bag"] } : {}) },
        { ask: (shoreArgs) => askShore(shoreArgs, did), tree: openSyncedTree(), root: larRoot(), did },
      );
    } catch (err) {
      const f = verbFailure(err);
      emit(args, {
        ok: false, ...(f.requestId !== undefined ? { requestId: f.requestId } : {}),
        error: { code: f.code, message: f.message, ...(f.hint !== undefined ? { hint: f.hint } : {}) },
        human: () => { console.error(`lares shore: ${f.message}`); if (f.hint !== undefined) console.error(`  ${f.hint}`); },
      });
      return exitFor(f.code);
    }
    if (!taken.ok) {
      const refused = taken;
      emit(args, {
        ok: false, ...(refused.requestId !== undefined ? { requestId: refused.requestId } : {}),
        error: { code: refused.refusal, message: refused.why },
        human: () => console.error(`lares shore take-disk: ${refused.refusal}: ${refused.why}`),
      });
      return exitFor(refused.refusal === "standoff-key-moved" ? "conflict" : "verb-error");
    }
    const done = taken;
    emit(args, {
      ok: true, ...(done.requestId !== undefined ? { requestId: done.requestId } : {}),
      data: { op: "take-disk", bag: done.bag, uri: done.uri, key: done.key, path: done.path, took: "disk", decision: done.decision },
      human: () => console.log(`took the disk's side: ${done.uri} (${done.bag}); the words at ${done.path} stand in the records`),
    });
    return 0;
  }

  // LIST reads every page the island answers (`readShoreList`), so a mass vanish of any size lists whole.
  if (act === "list") {
    let listed: Awaited<ReturnType<typeof readShoreList>>;
    try {
      listed = await readShoreList((a) => askShore(a, did), shaped.args);
    } catch (err) {
      const f = verbFailure(err);
      emit(args, {
        ok: false, ...(f.requestId !== undefined ? { requestId: f.requestId } : {}),
        error: { code: f.code, message: f.message, ...(f.hint !== undefined ? { hint: f.hint } : {}) },
        human: () => { console.error(`lares shore: ${f.message}`); if (f.hint !== undefined) console.error(`  ${f.hint}`); },
      });
      return exitFor(f.code);
    }
    if (!listed.ok) {
      const refused = listed;
      emit(args, {
        ok: false, ...(refused.requestId !== undefined ? { requestId: refused.requestId } : {}),
        error: { code: refused.refusal ?? "verb-error", message: refused.why ?? "the island refused" },
        human: () => console.error(`lares shore list: ${refused.refusal}: ${refused.why}`),
      });
      return exitFor("verb-error");
    }
    const { standoffs, pending } = listed;
    emit(args, {
      ok: true, ...(listed.requestId !== undefined ? { requestId: listed.requestId } : {}),
      data: { op: "list", standoffs, standoffCount: standoffs.length, pending, pendingCount: pending.length },
      human: () => {
        if (standoffs.length === 0 && pending.length === 0) { console.log("the disk shore holds nothing for a hand"); return; }
        if (standoffs.length > 0) {
          console.log(`${standoffs.length} standoff(s): the disk and the records say different things, and nothing writes`);
          for (const s of standoffs) console.log(`  ${String(s["uri"])}  bag ${String(s["bagId"])}${s["island"] === "daemon" ? " (daemon island)" : ""}  key ${String(s["standoff"])}${s["reason"] ? `\n      ${String(s["reason"])}` : ""}`);
          console.log("  settle one under its key: `lares shore take-disk <uri> --key <key>` lands the file's words · `lares shore take-records <uri> --key <key>` writes the records' render · or save in the wiki until both say the same");
        }
        if (pending.length > 0) {
          console.log(`${pending.length} pending removal(s): the file vanished where a base stands; nothing writes back and nothing tombstones`);
          for (const p of pending) console.log(`  ${String(p["uri"])}  bag ${String(p["bagId"])}${p["island"] === "daemon" ? " (daemon island)" : ""}  ${String(p["path"])}`);
          console.log(`  answer: \`lares shore restore <uri>\` · \`lares shore remove <uri>\` · over all: \`--all --count <n>\` with the count one bag holds (and --bag where more than one bag stands pending)`);
        }
      },
    });
    return 0;
  }

  let answer: ShoreAnswer;
  try {
    answer = await askShore(shaped.args, did);
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
      if (act === "take-records") { console.log(`took the records' side: ${String(answer.output["uri"])} (${String(answer.output["bag"])})`); return; }
      const reached = answeredRows(answer.output);
      console.log(`${act === "restore" ? "restored" : "removed"} ${reached.doneCount} carrier(s) (${String(answer.output["bag"])})`);
      for (const uri of reached.done) console.log(`  ${uri}`);
      if (reached.done.length < reached.doneCount) console.log(`  (the answer named ${reached.done.length} of them)`);
      for (const uri of reached.left) console.error(`  ⚠ still pending: ${uri}`);
      if (reached.left.length < reached.leftCount) console.error(`  ⚠ ${reached.leftCount} carrier(s) still pending in all: \`lares shore\` names each`);
    },
  });
  // An answer that left a carrier pending did not take everything it named.
  return answeredRows(answer.output).leftCount > 0 ? exitFor("verb-error") : 0;
}

/**
 * The carriers an answer over pending removals reached and left. Past the outcome's row cap the rows stay
 * behind, so the counts the island answered decide; a count that stays absent reads as the rows it holds.
 */
export function answeredRows(output: Readonly<Record<string, unknown>>): { done: string[]; doneCount: number; left: string[]; leftCount: number } {
  const rows = (name: string): string[] => (Array.isArray(output[name]) ? (output[name] as string[]) : []);
  const counted = (name: string, held: number): number => (typeof output[name] === "number" ? (output[name] as number) : held);
  const done = rows("done");
  const left = rows("left");
  return { done, doneCount: counted("doneCount", done.length), left, leftCount: counted("leftCount", left.length) };
}
