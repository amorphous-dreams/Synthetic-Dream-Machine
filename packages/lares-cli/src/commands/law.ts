/**
 * `lares law index | pin <uri> | unpin <uri>` — the law index, offered where an agent wakes, and the verb that orders it.
 *
 * THE INDEX DERIVES FROM CANON. `@lararium/tw5`'s `daemon-law-tiddlers` names the law (every root meme under a bag's `api/`
 * tree) and seeds the pin set into the worn face's daemon wiki (a filter whose titles head the index: the boot seed, then
 * the Mu family). `index` runs `LAW_INDEX_FILTER` through the tiddler door's `wiki-filter`, so the wiki's own engine answers
 * and no list stands here; its canon guard keeps every row to a record a canon layer answers, so nothing a face writes
 * prints as law. Each row reads its title and one line: the meme's `description`, else its `role`.
 *
 * A PIN IS A WIKI CONFIG WRITE in the face's own working layer: `pin` and `unpin` read the pin set (`tiddler-get`), edit
 * its text by one run (`[[uri]]` to pin, `-[[uri]]` to drop a title a broader run names), let the engine say whether the
 * title stands selected before and after, and land the text with `tiddler-put` against the base it read. House canon takes
 * no byte: the pin set lives apart from every law meme, so the AI seat may pin as the operator may.
 *
 * The index prints plainly on a terminal and through a pipe; `--json` carries `{ filter, pins, rows, total, next }`, the body
 * the MCP seat's `act(address="lar:///engine.law.indexes")` answers.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/daemon-law-tiddlers
 */

import { LAW_INDEX_FILTER, LAW_PINS_FILTER, LAW_PINS_TITLE, lawStandsFilter } from "@lararium/tw5";
import { emit, exitFor, proseFirst } from "../render.js";
import { helpLines } from "../command-help.js";
import { DoorUsage, countOf, guardDoor, runDoor, wordOf } from "./door-call.js";
import type { ParsedArgs } from "../parse-args.js";
import { tableCovers } from "../verb-table.js";

/** The daemon wiki: the pin set and the law config live in the worn face's own. */
const RECIPE = "default";
/** The fields a row reads its one line from, in preference order. */
export const LAW_ROW_FIELDS = ["description", "role"] as const;

/** One row of the index: a law meme's title, its one line, and whether a pin placed it. */
export interface LawRow { title: string; description: string; pinned: boolean }

/** A lar: title a run can quote: no whitespace and none of the filter's brackets or the list bar. */
export function lawUriOf(raw: string | undefined): string {
  const uri = wordOf(raw);
  if (uri === null) throw new DoorUsage("name the law meme by its lar: address (e.g. `lares law pin lar:///ha.ka.ba/lares/api/pono/lar-uri`)");
  if (!/^[^\s[\]{}|]+$/.test(uri)) throw new DoorUsage(`a pin names one title with no whitespace, brackets, braces or bar (got "${uri}")`);
  return uri;
}

/**
 * The text with every whitespace-delimited run equal to `run` taken out, each with the whitespace before it (the whitespace
 * after it, where it leads the text); every other byte of the operator's layout stands.
 */
export function withoutRun(text: string, run: string): string {
  const parts = text.split(/(\s+)/);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] as string;
    if (i % 2 === 1 || part !== run) { out.push(part); continue; }
    if (out.length > 0) out.pop();
    else if (i + 1 < parts.length) i++;
  }
  return out.join("");
}

/** The text with `run` appended after its last run, ahead of any trailing whitespace (a closing newline stands). */
export function withRun(text: string, run: string): string {
  const tail = /\s*$/.exec(text)?.[0] ?? "";
  const body = text.slice(0, text.length - tail.length);
  return body === "" ? `${run}${tail}` : `${body} ${run}${tail}`;
}

/**
 * The pin set's next text, given whether the engine selects the title from a candidate. `null` where the title already
 * stands as asked (pinned for `pin`, unpinned for `unpin`): nothing moves.
 */
export async function nextPins(text: string, uri: string, mode: "pin" | "unpin", selects: (filter: string) => Promise<boolean>): Promise<string | null> {
  const before = text.trim() !== "" && (await selects(text));
  if (before === (mode === "pin")) return null;
  if (mode === "pin") {
    const candidate = withoutRun(text, `-[[${uri}]]`);
    return candidate.trim() !== "" && (await selects(candidate)) ? candidate : withRun(candidate, `[[${uri}]]`);
  }
  const candidate = withoutRun(text, `[[${uri}]]`);
  return candidate.trim() !== "" && (await selects(candidate)) ? withRun(candidate, `-[[${uri}]]`) : candidate;
}

/** A row's one line: its description, else its role, on one line. */
export function lawLineOf(fields: Record<string, string> | undefined): string {
  for (const name of LAW_ROW_FIELDS) {
    const value = String(fields?.[name] ?? "").replace(/\s+/g, " ").trim();
    if (value !== "") return value;
  }
  return "";
}

type Ran = { ok: true; output: Record<string, unknown>; requestId: string } | { ok: false; exit: number };

/** Every title a filter answers in the daemon wiki, page after page. */
async function filterAll(args: ParsedArgs, label: string, filter: string): Promise<{ ok: true; titles: string[] } | { ok: false; exit: number }> {
  const titles: string[] = [];
  for (let after: string | null = null; ;) {
    const ran: Ran = await runDoor(args, label, { verb: "wiki-filter", args: { recipe: RECIPE, filter, ...(after ? { after } : {}) } });
    if (!ran.ok) return ran;
    titles.push(...((ran.output["titles"] as string[] | undefined) ?? []));
    const next = ran.output["next"];
    if (typeof next !== "string" || next === "" || next === after) return { ok: true, titles };
    after = next;
  }
}

async function lawIndex(args: ParsedArgs): Promise<number> {
  const limit = countOf(args.options["limit"], "limit");
  const pins = await filterAll(args, "law index", LAW_PINS_FILTER);
  if (!pins.ok) return pins.exit;
  const pinned = new Set(pins.titles);
  const rows: LawRow[] = [];
  let last: Record<string, unknown> = {};
  let requestId = "";
  for (let after = wordOf(args.options["after"]); ;) {
    const page: Ran = await runDoor(args, "law index", {
      verb: "wiki-filter",
      args: { recipe: RECIPE, filter: LAW_INDEX_FILTER, fields: [...LAW_ROW_FIELDS], ...(limit !== null ? { limit } : {}), ...(after ? { after } : {}) },
    });
    if (!page.ok) return page.exit;
    last = page.output;
    requestId = page.requestId;
    for (const row of (last["rows"] as Array<{ title: string; fields?: Record<string, string> }> | undefined) ?? []) {
      rows.push({ title: row.title, description: lawLineOf(row.fields), pinned: pinned.has(row.title) });
    }
    const next = last["next"];
    if (args.flags["all"] !== true || typeof next !== "string" || next === "" || next === after) break;
    after = next;
  }
  const total = typeof last["total"] === "number" ? last["total"] : rows.length;
  const next = typeof last["next"] === "string" && last["next"] !== "" ? last["next"] : null;
  const data = { filter: LAW_INDEX_FILTER, pinsTitle: LAW_PINS_TITLE, pins: pins.titles, rows, total, next };
  emit(proseFirst(args), {
    ok: true, requestId, data,
    human: () => {
      console.log(`Lares law (pinned first): ${pins.titles.length} pinned · ${total} rows${rows.length < total ? ` (${rows.length} shown)` : ""}`);
      for (const row of rows) console.log(`${row.pinned ? "📌" : "  "} ${row.title}${row.description ? ` — ${row.description}` : ""}`);
      if (next) console.log(`read further: lares law index after=${next}  (or all=true)`);
      console.log(`the filter: lares get filter='${LAW_INDEX_FILTER}'`);
      console.log(`pin or unpin: lares law pin <uri> · lares law unpin <uri> (the pin set: ${LAW_PINS_TITLE})`);
    },
  });
  return 0;
}

async function lawPin(args: ParsedArgs, mode: "pin" | "unpin"): Promise<number> {
  const label = `law ${mode}`;
  const uri = lawUriOf(args.positional[1]);
  if (mode === "pin") {
    const stands = await filterAll(args, label, lawStandsFilter(uri));
    if (!stands.ok) return stands.exit;
    if (stands.titles.length === 0) {
      const message = `law-pin-absent: no canon law stands at ${uri} in the worn face's daemon wiki (a pin orders canon law and adds none); nothing moved`;
      emit(args, { ok: false, error: { code: "not-found", message }, human: () => console.error(`lares ${label}: ${message}`) });
      return exitFor("not-found");
    }
  }
  // READ FAT: the pin set is a read-modify-write, and only an answer that carried the text hands a base a text put takes.
  const got: Ran = await runDoor(args, label, { verb: "tiddler-get", args: { recipe: RECIPE, title: LAW_PINS_TITLE, grain: "fat" } });
  if (!got.ok) return got.exit;
  const held = got.output["tiddler"] as { hash?: string; fields?: Record<string, string> } | null | undefined;
  const text = String(held?.fields?.["text"] ?? "");
  // A read the engine refused emits its own refusal; the first one's exit ends the verb before any write.
  const faults: number[] = [];
  const selects = async (filter: string): Promise<boolean> => {
    if (faults.length > 0) return false;
    const read = await filterAll(args, label, `${filter} +[match[${uri}]]`);
    if (!read.ok) { faults.push(read.exit); return false; }
    return read.titles.length > 0;
  };
  const candidate = await nextPins(text, uri, mode, selects);
  if (faults.length > 0) return faults[0] as number;
  if (candidate === null) {
    emit(args, {
      ok: true, requestId: got.requestId,
      data: { title: LAW_PINS_TITLE, uri, decision: "noop", pinned: mode === "pin", text, hash: held?.hash ?? null },
      human: () => console.log(`${uri} ${mode === "pin" ? "already stands pinned" : "stands unpinned"}; the pin set moved nothing`),
    });
    return 0;
  }
  const put: Ran = await runDoor(args, label, {
    verb: "tiddler-put", args: { recipe: RECIPE, title: LAW_PINS_TITLE, text: candidate, ...(held?.hash ? { base: held.hash } : {}) },
  });
  if (!put.ok) return put.exit;
  const decision = String(put.output["decision"] ?? "");
  if (decision !== "put" && decision !== "noop") {
    const message = `law-pins-moved: the pin set moved since this read it (${decision}); run \`lares law ${mode} ${uri}\` again`;
    emit(args, { ok: false, requestId: put.requestId, error: { code: "conflict", message }, human: () => console.error(`lares ${label}: ${message}`) });
    return exitFor("conflict");
  }
  emit(args, {
    ok: true, requestId: put.requestId,
    data: { title: LAW_PINS_TITLE, uri, decision, pinned: mode === "pin", text: candidate, hash: put.output["hash"] ?? null, bag: put.output["bag"] ?? null },
    human: () => console.log(`${mode === "pin" ? "pinned" : "unpinned"} ${uri} (the pin set ${LAW_PINS_TITLE} landed in ${String(put.output["bag"] ?? "the working layer")})`),
  });
  return 0;
}

/** Every verb the law door answers. */
export const LAW_VERBS = ["index", "pin", "unpin"] as const;
type LawVerb = (typeof LAW_VERBS)[number];

export async function cmdLaw(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0] as LawVerb | undefined;
  switch (sub) {
    case "index": return guardDoor(args, "law index", () => lawIndex(args));
    case "pin":   return guardDoor(args, "law pin", () => lawPin(args, "pin"));
    case "unpin": return guardDoor(args, "law unpin", () => lawPin(args, "unpin"));
    default:
      if (sub) console.error(`lares law: unknown sub-verb "${tableCovers(sub)}"`);
      for (const line of helpLines("law")) console.error(line);
      return 2;
  }
}
