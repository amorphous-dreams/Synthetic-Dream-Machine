/**
 * lares shore — a person's answers at the disk shore.
 *
 *   lares shore [list]                                    what stands for a hand
 *   lares shore take-records <uri> --key <key> [--bag <bagUri>] [--yes]
 *   lares shore take-disk    <uri> --key <key> [--bag <bagUri>] [--yes]
 *   lares shore restore (<uri>… | --all --count <n>) [--bag <bagUri>] [--yes]
 *   lares shore remove  (<uri>… | --all --count <n>) [--bag <bagUri>] [--yes]
 *   lares shore settle  --bag <bagUri|slug> --pending
 *   lares shore lift-kahua --count <n>
 *   lares shore flush
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
 * THE SHORE NAMES WHAT IT LETS GO. Where a commit took a pending removal's file from its checkout, `list`, the `remove`
 * answer and the lay's closing lines name that commit beside the row: short sha, subject, PR, and the ashes git keeps
 * (`<sha>^:<path>`); `remove` adds where the commit says the substance went. JSON carries it as `retiredBy`. A receipt,
 * never a gate: no checkout, no git, or a spent bound leaves every line as it stands (`shore-retirement.ts`).
 *
 * `list` looks at the disk first, so what it shows stands true to the bytes at that instant, and it reads
 * every page the island answers, so a list of any length names every row. An answer
 * names the state its giver read: a standoff's key, and for more than one pending removal the count. Where
 * that state moved, the island refuses by name and nothing changes.
 *
 * The verb rides two lines over the daemon's sock: into the active wiki's island (`wiki-act`) and into the
 * daemon island (the `shore` verb itself), each answering for the mirrors it holds (`askShore`). The list
 * reads both as one shore and names each row's island; an answer goes to the island that holds its state.
 *
 * `settle --pending` resumes a settle word that stalled: `lares ingest --apply` leaves the carriers still
 * waiting as the bag's record under the house's run dir (`settlePendingPath`), and this act asks the word
 * again over them alone, then clears the record (settled whole) or rewrites it (still waiting).
 *
 * `lift-kahua --count <n>` lifts the kahua items a lay previewed and left pending (`seed-mirrors.ts`): it runs the lay's
 * mirror leg again, and lifts only where n equals the count the preview reads now; a wrong count refuses and lifts nothing.
 * `list` names each pending item (face, title, body digest) beside the shore's own rows.
 *
 * `flush` asks the active wiki's island and the daemon island to write what each holds in memory to its mirrors now, and
 * names what each wrote, what it could not and why (`askShoreFlush`). Other resident wiki islands stand outside its reach (the
 * vessel's teardown flush reaches them), and the reading says so. It takes nothing and asks no confirmation. Exit: 0 every
 * asked island wrote what it owed · 4 a carrier stayed unwritten · 3 an asked island could not answer.
 */

import { createInterface } from "readline/promises";
import { stdin, stdout } from "process";
import type { ParsedArgs } from "../parse-args.js";
import { emit, exitFor, wantsJson } from "../render.js";
import { verbFailure } from "../verb-call.js";
import { vesselDid } from "../env.js";
import { askShore, askSettle, askShoreFlush, readShoreList, readSettlePending, shoreFlushExit, type ShoreAnswer, type ShoreFlushReading } from "../shore-core.js";
import { takeDisk } from "../shore-take-disk.js";
import { openSyncedTree } from "../ingest-core.js";
import { larRoot } from "../env.js";
import { readKahuaPending, LIVE_MIRROR_DOORS } from "../seed-mirrors.js";
import { runMirrors } from "../seed-mirror-leg.js";
import { otakiageLine, pendingReceipts, retirementLine, withRetiredBy, type Retirement } from "../shore-retirement.js";

/** The acts this door carries. */
export const SHORE_ACTS = ["list", "take-records", "take-disk", "restore", "remove", "settle", "lift-kahua", "flush"] as const;
export type ShoreAct = (typeof SHORE_ACTS)[number];

function printUsage(): void {
  console.log("usage: lares shore [list]");
  console.log("       lares shore take-records <uri> --key <key> [--bag <bagUri>] [--yes]");
  console.log("       lares shore take-disk    <uri> --key <key> [--bag <bagUri>] [--yes]");
  console.log("       lares shore restore (<uri>… | --all --count <n>) [--bag <bagUri>] [--yes]");
  console.log("       lares shore remove  (<uri>… | --all --count <n>) [--bag <bagUri>] [--yes]");
  console.log("       lares shore settle  --bag <bagUri|slug> --pending");
  console.log("       lares shore lift-kahua --count <n>");
  console.log("       lares shore flush");
  console.log("  list          look at the disk, then name each standoff with its key and each pending removal;");
  console.log("  take-records  write the records' render over the file of one standoff, named by its key;");
  console.log("  take-disk     land the file's words in the records for one standoff, named by its key;");
  console.log("  restore       write a vanished file back from the records;");
  console.log("  remove        delete the vanished carrier in the wiki (its tombstone lands in the working layer);");
  console.log("  settle        resume a settle word that stalled, over the carriers its record names (--pending);");
  console.log("  lift-kahua    lift the kahua items a lay left pending, each under its face's grant (--count names the preview's count);");
  console.log("  flush         write what the active wiki's and the daemon's islands hold in memory to their mirrors now (other resident wikis stand outside its reach);");
  console.log("  an answer over more than one carrier names the count that stands pending (--count).");
}

/** The args one act sends, or the usage fault that stops it. */
export function shoreArgs(act: ShoreAct, args: ParsedArgs): { readonly args: Record<string, unknown> } | { readonly usage: string } {
  const bag = args.options["bag"];
  const withBag = bag ? { bag } : {};
  if (act === "list") return { args: { op: "list", ...withBag } };
  if (act === "flush") return { args: { op: "flush" } };
  if (act === "lift-kahua") {
    const countText = args.options["count"];
    if (countText === undefined || !/^(?:0|[1-9][0-9]*)$/.test(countText)) return { usage: "lift-kahua names the count of pending kahua items `lares shore` lists: lares shore lift-kahua --count <n>" };
    return { args: { op: "lift-kahua", count: Number(countText) } };
  }
  if (act === "settle") {
    if (!bag || !args.flags["pending"]) return { usage: "settle resumes a stalled settle word from its record: lares shore settle --bag <bagUri|slug> --pending" };
    return { args: { op: "settle", bag, pending: true } };
  }
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

  // LIFT-KAHUA: the count IS the confirmation, so it asks nothing more; the mirror leg refuses a count that moved.
  if (act === "lift-kahua") {
    return runMirrors({ apply: true, liftKahua: String(shaped.args["count"]), json: wantsJson(args) }, LIVE_MIRROR_DOORS);
  }

  // An act that writes asks first (a person at a TTY), or carries `--yes` (an agent).
  if (act !== "list" && act !== "settle" && act !== "flush" && !args.flags["yes"]) {
    if (wantsJson(args)) {
      emit(args, { ok: false, error: { code: "usage", message: "confirmation required", hint: "pass --yes for non-interactive (agent) invocation" }, human: () => { /* unreachable */ } });
      return exitFor("usage");
    }
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl.question(confirmLine(act, shaped.args));
    rl.close();
    if (!/^y(es)?$/i.test(answer.trim())) { console.log("aborted"); return 1; }
  }

  // SETTLE --PENDING resumes the word a stalled settle left as the bag's record, over those carriers alone.
  if (act === "settle") return resumeSettle(args, String(shaped.args["bag"]));

  let did: string;
  try { did = await vesselDid(); } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(args, { ok: false, error: { code: "not-found", message: msg }, human: () => console.error(`lares shore: ${msg}`) });
    return exitFor("not-found");
  }

  // FLUSH asks every island that mounts a disk shore, and reads each answer as one (`askShoreFlush`).
  if (act === "flush") {
    let reading: ShoreFlushReading;
    try { reading = await askShoreFlush(did); } catch (err) {
      const f = verbFailure(err);
      emit(args, { ok: false, error: { code: f.code, message: f.message }, human: () => console.error(`lares shore flush: ${f.message}`) });
      return exitFor(f.code);
    }
    const code = shoreFlushExit(reading);
    emit(args, {
      ok: code === 0, data: { op: "flush", ...reading },
      human: () => {
        if (reading.islands.length === 0) console.log("neither the active wiki's island nor the daemon island mounts a disk shore: nothing to flush");
        for (const part of reading.islands) {
          if (!part.answered) { console.log(`${part.island}: did not answer: ${part.refusal}: ${part.why}`); continue; }
          console.log(`${part.island}: wrote ${part.writtenCount} owed carrier(s) (${part.fileWrites} file write(s)); ${part.unwrittenCount} unwritten`);
          for (const u of part.unwritten) console.log(`  ${String(u["state"])} ${String(u["uri"])}: ${String(u["why"])}`);
        }
        console.log(`not asked: ${reading.unasked}`);
      },
    });
    return code;
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
      data: { op: "take-disk", bag: done.bag, uri: done.uri, key: done.key, path: done.path, took: "disk", decision: done.decision, merge: done.merge },
      human: () => {
        console.log(done.merge.kind === "slots"
          ? `took the disk's side, merged with the records' slot by slot: ${done.uri} (${done.bag}); the merged words at ${done.path} stand in the records`
          : `took the disk's side: ${done.uri} (${done.bag}); the words at ${done.path} stand in the records`);
        if (done.merge.kind === "whole") console.log(`  landed whole, with no merge: ${done.merge.why}`);
      },
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
    // THE RECEIPT: each pending removal whose file a commit took from the checkout names that commit (`shore-retirement.ts`).
    const receipts = pendingReceipts(pending);
    const kahua = readKahuaPending();
    emit(args, {
      ok: true, ...(listed.requestId !== undefined ? { requestId: listed.requestId } : {}),
      data: { op: "list", standoffs, standoffCount: standoffs.length, pending: withRetiredBy(pending, receipts), pendingCount: pending.length, kahuaPending: kahua, kahuaPendingCount: kahua.length },
      human: () => {
        if (kahua.length > 0) {
          console.log(`${kahua.length} kahua item(s) wait for a hand: a lay previewed them and nothing lifted on --yes alone`);
          for (const k of kahua) console.log(`  h${k.handleIndex}${k.petname ? ` ("${k.petname}")` : ""}  ${k.title}  sha256:${k.digest.slice(0, 16)}  ${k.state === "differs" ? "differs from the standing head" : "new"}`);
          // A lift rides its own face's wear: the count names what the daemon MOUNT's items come to, face by face.
          for (const handleIndex of [...new Set(kahua.map((k) => k.handleIndex))].sort((a, b) => a - b)) {
            const n = kahua.filter((k) => k.handleIndex === handleIndex).length;
            console.log(`  lift h${handleIndex}'s under its own grant, wearing it (\`lares vault unlock --face ${handleIndex}\`): \`lares shore lift-kahua --count ${n}\``);
          }
        }
        if (standoffs.length === 0 && pending.length === 0) { if (kahua.length === 0) console.log("the disk shore holds nothing for a hand"); return; }
        if (standoffs.length > 0) {
          console.log(`${standoffs.length} standoff(s): the disk and the records say different things, and nothing writes`);
          for (const s of standoffs) console.log(`  ${String(s["uri"])}  bag ${String(s["bagId"])}${s["island"] === "daemon" ? " (daemon island)" : ""}  key ${String(s["standoff"])}${s["reason"] ? `\n      ${String(s["reason"])}` : ""}`);
          console.log("  settle one under its key: `lares shore take-disk <uri> --key <key>` lands the file's words · `lares shore take-records <uri> --key <key>` writes the records' render · or save in the wiki until both say the same");
        }
        if (pending.length > 0) for (const line of shorePendingLines(pending, receipts)) console.log(line);
      },
    });
    return 0;
  }

  // A REMOVE names what it lets go: the pending rows read first (a read alone, bounded; an unread shore names no receipt),
  // and each carrier the answer reached carries its retiring commit and where its substance went.
  let named: ReadonlyArray<Record<string, unknown>> = [];
  let receipts: ReadonlyMap<string, Retirement> = new Map();
  if (act === "remove") {
    try {
      const listed = await Promise.race([
        readShoreList((a) => askShore(a, did), typeof shaped.args["bag"] === "string" ? { bag: shaped.args["bag"] } : {}),
        new Promise<null>((resolve) => { const t = setTimeout(() => resolve(null), RECEIPT_LIST_BOUND_MS); t.unref(); }),
      ]);
      if (listed !== null && listed.ok) { named = listed.pending; receipts = pendingReceipts(named); }
    } catch { /* the receipt stays unread; the answer stands */ }
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

  const retiredBy = retiredByUri(answeredRows(answer.output).done, named, receipts);
  emit(args, {
    ok: true, ...(answer.requestId !== undefined ? { requestId: answer.requestId } : {}),
    data: Object.keys(retiredBy).length > 0 ? { ...answer.output, retiredBy } : answer.output,
    human: () => {
      if (act === "take-records") { console.log(`took the records' side: ${String(answer.output["uri"])} (${String(answer.output["bag"])})`); return; }
      const reached = answeredRows(answer.output);
      console.log(`${act === "restore" ? "restored" : "removed"} ${reached.doneCount} carrier(s) (${String(answer.output["bag"])})`);
      for (const line of removeReceiptLines(reached.done, named, receipts)) console.log(line);
      if (reached.done.length < reached.doneCount) console.log(`  (the answer named ${reached.done.length} of them)`);
      for (const uri of reached.left) console.error(`  ⚠ still pending: ${uri}`);
      // A removal that unshadowed a lower copy: this bag let it go, and the meme still stands from that bag.
      const standing = Array.isArray(answer.output["unshadowed"]) ? (answer.output["unshadowed"] as Array<{ uri: string; bag: string }>) : [];
      for (const u of standing) console.error(`  ⚠ still stands from ${u.bag}: ${u.uri}`);
      const standingCount = typeof answer.output["unshadowedCount"] === "number" ? (answer.output["unshadowedCount"] as number) : standing.length;
      if (standing.length < standingCount) console.error(`  ⚠ ${standingCount} carrier(s) still stand from a lower bag in all: \`lares shore\` names each`);
      if (reached.left.length < reached.leftCount) console.error(`  ⚠ ${reached.leftCount} carrier(s) still pending in all: \`lares shore\` names each`);
    },
  });
  // An answer that left a carrier pending did not take everything it named.
  return answeredRows(answer.output).leftCount > 0 ? exitFor("verb-error") : 0;
}

/** Resume a stalled settle word from the bag's record: counts out, the record cleared or rewritten. */
async function resumeSettle(args: ParsedArgs, bagNamed: string): Promise<number> {
  const record = readSettlePending(bagNamed);
  if (record === null) {
    emit(args, { ok: true, data: { op: "settle", bag: bagNamed, record: null }, human: () => console.log(`no settle record stands for ${bagNamed}: nothing waits to resume`) });
    return 0;
  }
  let did: string;
  try { did = await vesselDid(); } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(args, { ok: false, error: { code: "not-found", message: msg }, human: () => console.error(`lares shore: ${msg}`) });
    return exitFor("not-found");
  }
  let read;
  try {
    read = await askSettle((a) => askShore(a, did), record.bag, record.carriers, { record: true });
  } catch (err) {
    const f = verbFailure(err);
    emit(args, {
      ok: false, ...(f.requestId !== undefined ? { requestId: f.requestId } : {}),
      error: { code: f.code, message: f.message, ...(f.hint !== undefined ? { hint: f.hint } : {}) },
      human: () => { console.error(`lares shore settle: ${f.message}`); if (f.hint !== undefined) console.error(`  ${f.hint}`); },
    });
    return exitFor(f.code);
  }
  const counts = { op: "settle", bag: record.bag, asked: record.carriers.length, ...read };
  if (!read.settled && !read.stalled) {
    emit(args, { ok: false, data: counts, error: { code: read.refusal ?? "verb-error", message: read.why ?? "the island refused" }, human: () => console.error(`lares shore settle: ${read.refusal}: ${read.why}; the record still stands`) });
    return exitFor("verb-error");
  }
  emit(args, {
    ok: read.settled, data: counts,
    ...(read.stalled ? { error: { code: "outcome-unknown", message: read.why ?? "the settle stalled" } } : {}),
    human: () => {
      console.log(`settled ${read.settledCount} · ${read.pendingCount} pending · ${read.stalledCount} stalled (${record.bag}, ${record.carriers.length} asked)${read.elsewhereCount > 0 ? `; ${read.elsewhereCount} project from a higher bag` : ""}`);
      if (read.stalled) {
        for (const uri of read.pendingUris) console.error(`  pending: ${uri}`);
        console.error(`  ⚠ ${read.pendingCount} carrier(s) still wait; the record stands at ${read.recordPath ?? "(unwritten)"}: \`lares shore settle --bag ${record.bag} --pending\` asks again`);
      } else console.log("  the record clears: every carrier it named settled");
    },
  });
  return read.stalled ? exitFor("outcome-unknown") : 0;
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

/** The pending removals as `lares shore list` names them: the count, each row, and the answer. */
export function shorePendingLines(pending: ReadonlyArray<Record<string, unknown>>, receipts: ReadonlyMap<string, Retirement>): string[] {
  return [
    `${pending.length} pending removal(s): the file vanished where a base stands; nothing writes back and nothing tombstones`,
    ...pending.flatMap((p) => {
      const row = `  ${String(p["uri"])}  bag ${String(p["bagId"])}${p["island"] === "daemon" ? " (daemon island)" : ""}  ${String(p["path"])}`;
      const r = receiptOf(p, receipts);
      return r === undefined ? [row] : [row, `      ${retirementLine(r)}`];
    }),
    "  answer: `lares shore restore <uri>` · `lares shore remove <uri>` · over all: `--all --count <n>` with the count one bag holds (and --bag where more than one bag stands pending)",
  ];
}

/** The carriers a remove answer reached, each named. */
export function removeReceiptLines(done: readonly string[], pending: ReadonlyArray<Record<string, unknown>>, receipts: ReadonlyMap<string, Retirement>): string[] {
  const byUri = retiredByUri(done, pending, receipts);
  return done.flatMap((uri) => {
    const r = byUri[uri];
    return r === undefined ? [`  ${uri}`] : [`  ${uri}`, `      ${retirementLine(r)}`, `      ${otakiageLine(r)}`];
  });
}

/** How long a remove waits on the pending read its receipt rides, before it answers with none. */
const RECEIPT_LIST_BOUND_MS = 2000;

/** One pending row's receipt, by the path the island named. */
function receiptOf(row: Readonly<Record<string, unknown>>, receipts: ReadonlyMap<string, Retirement>): Retirement | undefined {
  return typeof row["path"] === "string" ? receipts.get(row["path"]) : undefined;
}

/** The receipts of the carriers an answer reached, keyed by carrier (a URI many bags named reads its first row). */
function retiredByUri(done: readonly string[], pending: ReadonlyArray<Record<string, unknown>>, receipts: ReadonlyMap<string, Retirement>): Record<string, Retirement> {
  const reached = new Set(done);
  const out: Record<string, Retirement> = {};
  for (const row of pending) {
    const uri = String(row["uri"]);
    const r = receiptOf(row, receipts);
    if (reached.has(uri) && r !== undefined && out[uri] === undefined) out[uri] = r;
  }
  return out;
}
