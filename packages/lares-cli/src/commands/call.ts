/**
 * `lares get · put · delete · rename · msg name=value…`, `lares lar:///<address> name=value…`, `lares act lar:///<address> …` and
 * `lares -` — THE CLI SPEAKS THE CALL SHAPE (lar:///ha.ka.ba/kahua/memory/course/comms-ux-enacts landing 8).
 *
 * ONE SPLIT, AND EVERYTHING ELSE IN THE VM. The line splits by one token rule (`splitCall`: a token matching
 * `^[a-z][a-z0-9-]*=` names a param; the leading run of other tokens names the verb, a skin spelling or an address), and the
 * door sends `{verb, params, surface: "cli"}` to the vessel's daemon verb `call`. The route, the `#/takes` binding (needs,
 * defaults, the container default `recipe=default`), the string conversion a terminal's values need (a `takes/json` param
 * parsed, a `takes/count` counted, a `takes/names` split, a bare flag read as true or false) and the `mu` depth all run there.
 * `lares -` reads ONE bracketed call sigil from stdin and sends it whole as `sigil`, parsed by TiddlyWiki's own macro-call
 * parser in the VM; params beside the `-` fill what the sigil leaves out.
 *
 * WHAT CROSSES ON THIS SIDE, AND NOTHING ELSE: the bytes a terminal holds. `file=<path|->` names a host file (or stdin) whose
 * words become the put's `text`, a pointer kind staging its bytes into the content tier first (the blob law); `append=-` reads
 * the words to append from stdin (`append=<words>` rides as written); `face=N` names the session the call rides. The answer
 * prints by the carrier that shaped it: a record on its gradient, a page of rows, a receipt; any other answer prints its has
 * line and its data.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/affordance
 */

import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { stdin, stdout } from "node:process";
import { emit, exitFor, proseFirst } from "../render.js";
import { DoorUsage, guardDoor, runDoor, type DoorPlan } from "./door-call.js";
import { readCarrierShape } from "@lararium/tw5";
import { mediaTypeFromExt, ridesAsPointer } from "@lararium/mesh/content-handle";
import { niUriSha256FromHex } from "@lararium/mesh/crypto";
import { stageBodyToCas } from "../cas-stage.js";
import { landedFace } from "./meme-shared.js";
import { summonedStream } from "../summoned-stream.js";
import { ArgsError, splitCall, type CallLine, type ParsedArgs } from "../parse-args.js";

/** The heads that name the msg door: its verb word and its address. */
const MSG_HEADS: ReadonlySet<string> = new Set(["msg", "lar:///engine.msg.lands"]);

/** The verb words the CLI answers as commands of their own; an address (`lar:///…`) and `-` answer beside them. */
export const CALL_VERBS = ["get", "put", "delete", "rename", "msg"] as const;

/** True where a command line's head names the call door: a verb word, an address, the stdin sigil, or `act <address>`. */
export function isCallHead(command: string | null, positional: readonly string[] = []): boolean {
  if (command === null) return false;
  return (CALL_VERBS as readonly string[]).includes(command) || command === "-" || command.startsWith("lar:///")
    || (command === "act" && (positional[0] ?? "").startsWith("lar:///"));
}

/** The line a parsed command names as a call: `act` drops, since `lares act lar:///x` and `lares lar:///x` read the same. */
export function callLineOf(args: ParsedArgs): CallLine {
  const tokens = args.command === "act" ? [...args.positional] : [args.command ?? "", ...args.positional];
  try { return splitCall(tokens); }
  catch (error) { if (error instanceof ArgsError) throw new DoorUsage(error.message); throw error; }
}

/** The host's crossings: a file's bytes and stdin. A test seats its own. */
export interface CallSources {
  readonly read: (path: string) => Buffer;
  readonly stdin: () => Promise<Buffer>;
  /** The stream a summons started this process under (`LARES_SUMMONED`); absent or null: none. A test seats its own. */
  readonly summoned?: () => string | null;
}

const LIVE_SOURCES: CallSources = {
  summoned: () => summonedStream(process.env),
  read: (path) => readFileSync(path),
  stdin: async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of stdin) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    return Buffer.concat(chunks);
  },
};

/** A put's pointer: the fields that name staged bytes by their hash, and the `text` the record sheds for them. */
interface FilePointer { readonly fields: Record<string, string>; readonly unset: readonly string[] }

/**
 * A FILE WHOSE KIND RIDES AS A POINTER LANDS AS ONE (THE BLOB LAW). Two readings elect it, and nothing else: the call declares a
 * pointer-kind `type` in `fields` (an image, audio, video, a font, a PDF), or the bytes fail the utf8 round-trip (a binary read
 * as words would land mangled), where the type reads from the extension through TiddlyWiki's own registry and a kind the
 * registry lacks rides `application/octet-stream`. The raw bytes stage into the content tier under their SHA-256, and the put
 * carries `_canonical_uri` and `_integrity` naming that digest; the door seats the pointer and verifies the staged bytes.
 */
function filePointer(raw: Buffer, source: string, declared: string | null): FilePointer | null {
  const binary = !Buffer.from(raw.toString("utf8"), "utf8").equals(raw);
  const type = declared ?? (binary ? mediaTypeFromExt(source === "-" ? "" : extname(source), true) : null);
  if (type === null || !(ridesAsPointer(type) || binary)) return null;
  // The stager decodes a `binary` carrier from base64 before it hashes, so the CID names the file's own bytes.
  const staged = stageBodyToCas(raw.toString("base64"), { type: ridesAsPointer(type) ? type : "application/octet-stream", binary: true });
  const address = niUriSha256FromHex(staged.cid);
  return { fields: { type, _canonical_uri: address, _integrity: address, size: String(staged.size) }, unset: ["text"] };
}

/** The `type` a call's `fields` JSON declares, where it parses; the VM refuses a malformed one by name. */
function declaredType(fields: string | undefined): string | null {
  if (fields === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(fields);
    const type = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>)["type"] : undefined;
    return typeof type === "string" ? type : null;
  } catch { return null; }
}

/** A call's host crossings read and folded into its params: `file=` into `text` (or a pointer's fields), `append=-` from stdin. */
export async function crossHost(params: Readonly<Record<string, string>>, sources: CallSources = LIVE_SOURCES): Promise<Record<string, string>> {
  const { file, ...rest } = params;
  const out: Record<string, string> = { ...rest };
  if (out["append"] === "-" && file === "-") throw new DoorUsage("stdin carries one source: name file=- or append=-, never both");
  if (out["append"] === "-")out["append"] = (await sources.stdin()).toString("utf8");
  if (file === undefined) return out;
  if (file === "") throw new DoorUsage("file= names no host file (an empty value); name a path, or - for stdin");
  if (out["text"] !== undefined) throw new DoorUsage("name one text source: text=<words> or file=<path>, never both");
  let raw: Buffer;
  try { raw = file === "-" ? await sources.stdin() : sources.read(file); }
  catch { throw new DoorUsage(`cannot read file=${file}`); }
  const pointer = filePointer(raw, file, declaredType(out["fields"]));
  if (pointer === null) return { ...out, text: raw.toString("utf8") };
  let declared: Record<string, unknown> = {};
  try { declared = out["fields"] === undefined ? {} : JSON.parse(out["fields"]) as Record<string, unknown>; } catch { declared = {}; }
  const unset = [...(out["unset"] ?? "").split(",").map((s) => s.trim()).filter(Boolean), ...pointer.unset];
  return { ...out, fields: JSON.stringify({ ...declared, ...pointer.fields }), unset: unset.join(",") };
}

/** The one plan a call line sends: `call` with the verb words joined, or the stdin sigil whole. */
export async function callPlan(args: ParsedArgs, sources: CallSources = LIVE_SOURCES): Promise<{ readonly plan: DoorPlan; readonly face: string | null }> {
  const line = callLineOf(args);
  const { face, ...given } = line.params;
  if (line.words[0] === "-") {
    if (line.words.length > 1) throw new DoorUsage("`lares -` reads one bracketed call sigil from stdin and takes no other word; params beside it fill what the sigil leaves out");
    const sigil = (await sources.stdin()).toString("utf8").trim();
    if (sigil === "") throw new DoorUsage("`lares -` read no call sigil on stdin (e.g. printf '<<~ get title=`Room 4`>>' | lares -)");
    const params = await crossHost(given, sources);
    return { plan: { verb: "call", args: { sigil, params, surface: "cli" } }, face: face ?? null };
  }
  const verb = line.words.join(" ").trim();
  if (verb === "") throw new DoorUsage("name a verb word, a skin spelling or an address before the params (e.g. `lares get title='Room 4'`)");
  // THE STREAM DEFAULTS FROM THE SUMMONS (comms-ux-enacts landing 17): a msg naming no stream, from a process a summons started,
  // writes as the summoned instance; a session no summons started meets the door's `stream-unnamed` with its cure.
  const summoned = MSG_HEADS.has(verb) && given["stream"] === undefined ? sources.summoned?.() ?? null : null;
  return { plan: { verb: "call", args: { verb, params: await crossHost(summoned === null ? given : { ...given, stream: summoned }, sources), surface: "cli" } }, face: face ?? null };
}

/** The params a plan sent, by name. */
const paramsOf = (plan: DoorPlan): Record<string, unknown> => (plan.args["params"] as Record<string, unknown> | undefined) ?? {};

/** The bare address of the carrier that shaped an answer (`engine.record.reads`), or null. */
function answeredBy(output: Record<string, unknown>): string | null {
  const receipt = output["carrier"] as { carrier?: unknown } | undefined;
  const title = typeof receipt?.carrier === "string" ? receipt.carrier : "";
  const m = /\/afford\/([^/#]+)$/.exec(title) ?? /^lar:\/\/\/([^/#]+)$/.exec(title);
  return m?.[1] ?? null;
}

/** The container a call named, as a call spells it: a cure names the same wiki or bag the call named. */
const whereOf = (params: Record<string, unknown>): string =>
  typeof params["bag"] === "string" ? ` bag=${params["bag"]}${typeof params["realm"] === "string" ? ` realm=${params["realm"]}` : ""}`
  : typeof params["recipe"] === "string" && params["recipe"] !== "default" ? ` recipe=${params["recipe"]}` : "";

/** A title as a call writes it, quoted where it holds a space. */
const titleWord = (title: string): string => (/[\s'"]/.test(title) ? `title='${title.replace(/'/g, "'\\''")}'` : `title=${title}`);

export async function cmdCall(given: ParsedArgs, sources: CallSources = LIVE_SOURCES): Promise<number> {
  return guardDoor(given, "call", async () => {
    const { plan, face } = await callPlan(given, sources);
    // THE SESSION A CALL RIDES: `face=N` reaches the door's face reader as the session's face.
    const args: ParsedArgs = face === null ? given : { ...given, options: { ...given.options, face } };
    const params = paramsOf(plan);
    // A record's text and a carrier answer a pipe in prose (the carrier-first law); only an explicit `--json` asks the envelope.
    const prose = params["form"] === "text" || (typeof params["mu"] === "string" && /assert|!/.test(params["mu"])) ? proseFirst(args) : args;
    const ran = await runDoor(prose, typeof plan.args["verb"] === "string" ? plan.args["verb"] : "-", plan);
    if (!ran.ok) return ran.exit;
    switch (answeredBy(ran.output)) {
      case "engine.record.reads": return await printRead(prose, plan, ran);
      case "engine.filter.pages": return await printPage(prose, plan, ran);
      case "engine.record.puts": return printPut(prose, params, ran);
      case "engine.record.removes": return printDelete(prose, params, ran);
      case "engine.record.renames": return printRename(prose, params, ran);
      default: return printAnswer(prose, ran);
    }
  });
}

type Ran = { readonly requestId: string; readonly output: Record<string, unknown> };

/** Any other answer: its has line first, then its data, one key per line; `--json` carries it verbatim. */
function printAnswer(args: ParsedArgs, ran: Ran): number {
  emit(args, {
    ok: true, requestId: ran.requestId, data: ran.output,
    human: () => {
      const { has, ...rest } = ran.output;
      if (typeof has === "string") console.log(has);
      for (const [key, value] of Object.entries(rest)) console.log(`${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
    },
  });
  return 0;
}

interface GotTiddler { fields: Record<string, string>; hash: string; textHash: string | null; bag: string | null; position: string; family?: string; omitted?: string[] }
interface GotMeme { uri: string; text?: string; slotText?: string; canonicalHash: string; bytes: number; slots: Array<{ slot: string; bytes: number; first: string | null }>; slot?: string; page?: { page: number; pages: number } }
interface GotGrain { asked: string | null; applied: string; why: string }
interface GotNext { grain: string; after?: string }

/** The note a floor read carries: the bag's floor snapshot answered, since this face holds no read on the live house canon document. */
const FLOOR_NOTE = "read from the floor snapshot: this face holds no read on the live house canon document (the Kahu steward's face reads it live)";

/**
 * A GET BY TITLE ANSWERS ON A GRADIENT. Every answer leads with its `<<~ has …>>` line (stderr, where stdout carries a body;
 * stdout, where the has-stack is the answer) and names the grain it applied and why. The record reaches stdout as a `.tid` reads
 * (one `name: value` line per field, a blank line, the text). A meme read whole (`mu=assert`) follows the carrier's pages (each
 * cut on a slot boundary) to the end and joins them, so `lares get title=<uri> mu=assert > file` carries the whole meme.
 * `form=text` answers the TEXT ALONE on stdout, a terminal or a pipe alike; the has line and base ride stderr, and an answer
 * that carries no text refuses `text-unread`.
 */
async function printRead(args: ParsedArgs, plan: DoorPlan, first: Ran): Promise<number> {
  const params = paramsOf(plan);
  const alone = params["form"] === "text";
  const parts: string[] = [];
  let ran = first;
  const whole = (first.output["grain"] as GotGrain | undefined)?.applied === "whole";
  for (;;) {
    const meme = ran.output["meme"] as GotMeme | undefined;
    if (typeof meme?.text === "string") parts.push(meme.text);
    else if (typeof meme?.slotText === "string") parts.push(meme.slotText);
    const after = (ran.output["next"] as GotNext | null | undefined)?.after ?? null;
    if (!whole || !meme || !after) break;
    const step = await runDoor(args, "get", { verb: plan.verb, args: { ...plan.args, params: { ...params, after } } });
    if (!step.ok) return step.exit;
    if ((step.output["next"] as GotNext | null | undefined)?.after === after) {
      const message = `the carrier's cursor stood still at ${after}`;
      emit(args, { ok: false, requestId: step.requestId, error: { code: "verb-error", message }, human: () => console.error(`lares get: ${message}`) });
      return 4;
    }
    ran = step;
  }
  const output = ran.output;
  const title = String(output["title"] ?? params["title"] ?? "");
  const tiddler = output["tiddler"] as GotTiddler | null | undefined;
  const meme = output["meme"] as GotMeme | undefined;
  // The family listing (a get with meme and no title) answers its roots.
  if (!meme && !tiddler && Array.isArray(output["roots"])) return printAnswer(args, ran);
  if (!meme && !tiddler) {
    emit(args, { ok: false, requestId: ran.requestId, data: output, error: { code: "not-found", message: `no tiddler at ${title}` }, human: () => console.error(`lares get: no tiddler at ${title}`) });
    return exitFor("not-found");
  }
  const has = String(output["has"] ?? "");
  const grain = output["grain"] as GotGrain | undefined;
  const followed = whole && parts.length > 1;
  const note = typeof output["note"] === "string" ? output["note"] : null;
  // A JOINED READ ECHOES THE JOIN, never the first page's `page 1 of N`.
  const joinedGrain = followed && grain ? { ...grain, why: `the whole carrier, ${parts.length} pages joined on slot boundaries` } : grain;
  const data0 = followed && meme
    ? { ...first.output, has: output["has"], meme: (({ page: _page, ...rest }) => ({ ...rest, text: parts.join("") }))(meme), grain: joinedGrain, next: null }
    : output;
  // THE COMPOSITION READING: a carrier joined from pages reads its shape here (one page answers `shape` from the door). REPORT,
  // NEVER REFUSE: the faults ride the machine channel and stderr, never stdout, and the exit carries the reading.
  const joined = followed ? readCarrierShape(parts.join("")) : null;
  const shape = joined ? { check: joined.marks.check, faults: joined.faults } : (output["shape"] as { check: string; faults: string[] } | undefined) ?? null;
  const faulted = shape !== null && shape.faults.length > 0;
  const data = joined && faulted ? { ...data0, shape } : data0;
  const recordText: string | undefined = tiddler?.fields["text"];
  const meant = meme && (typeof meme.text === "string" || typeof meme.slotText === "string") ? parts.join("")
    : !meme && typeof recordText === "string" ? recordText : null;
  if (alone && meant === null) {
    const pointer = output["pointer"] as { owes?: string; cure?: string } | undefined;
    const again = `\`lares get ${titleWord(title)}${whereOf(params)} form=text\``;
    const why = pointer?.owes
      ? `the pointer's body rode no text (${pointer.owes}); ${pointer.cure ?? "`lares bag cas` surveys the content tier the body resolves from"}`
      : meme
        ? `the carrier answered its has-stack; \`lares get ${titleWord(title)}${whereOf(params)} mu=assert form=text\` reads the whole carrier, its pages joined`
        : `the answer left the text home (${grain?.why ?? "no text field"}); ${again} asks the whole`;
    const message = `text-unread: ${title} answered no text alone: ${why}`;
    emit(args, { ok: false, requestId: ran.requestId, data, error: { code: "text-unread", message }, human: () => console.error(`lares get: ${message}`) });
    return exitFor("text-unread");
  }
  emit(args, {
    ok: true, requestId: ran.requestId, data,
    human: () => {
      if (meme) {
        if (typeof meme.text === "string" || typeof meme.slotText === "string") {
          stdout.write(parts.join(""));
          console.error(has.split("\n")[0]);
        } else {
          stdout.write(`${has}\n`);
        }
        console.error(`base: ${meme.canonicalHash}`);
        console.error(`size: ${meme.bytes} bytes`);
        if (joinedGrain) console.error(`grain: ${joinedGrain.applied} (${joinedGrain.why})`);
        if (typeof meme.text !== "string" && typeof meme.slotText !== "string") console.error("the carrier runs past one page: stdout carries its has-stack; mu=assert reads the whole carrier, paged on slot boundaries");
        else if (meme.page && !followed) {
          const after = (output["next"] as GotNext | null | undefined)?.after;
          if (after) console.error(`page ${meme.page.page} of ${meme.page.pages}: read the next with after=${after} (or mu=assert for the whole carrier)`);
        }
        if (output["floor"] === true) console.error(FLOOR_NOTE);
        if (faulted) {
          console.error(`\n⚠ the composed carrier stands below its full floor (check ${shape!.check}):`);
          for (const fault of shape!.faults) console.error(`  ⚠ ${fault}`);
          console.error("  the bytes above are what the island composed — read the fault before you carry them anywhere.");
        }
        return;
      }
      const record = tiddler!;
      const { text, ...rest } = record.fields;
      if (alone) stdout.write(meant!);
      else {
        for (const [name, value] of Object.entries(rest)) stdout.write(`${name}: ${value}\n`);
        if (typeof text === "string") stdout.write(`\n${text}${text.endsWith("\n") ? "" : "\n"}`);
      }
      if (has) console.error(has);
      console.error(`base: ${record.hash}`);
      if (record.bag) console.error(`bag: ${record.bag}`);
      if (record.position !== "plain") console.error(`position: ${record.position} of ${record.family ?? title}`);
      if (record.omitted?.length) console.error(`omitted: ${record.omitted.join(", ")}`);
      if (grain && grain.applied !== "fat") console.error(`grain: ${grain.applied} (${grain.why})`);
      if (note) console.error(note);
      if (output["floor"] === true) console.error(FLOOR_NOTE);
    },
  });
  return faulted ? 1 : 0;
}

interface FilterRowOut { title: string; fields: Record<string, string>; has?: string; omitted?: string[]; bytes?: number; slots?: Array<{ slot: string; bytes: number; first: string | null }>; lines?: Array<{ n: number; text: string; cut?: true }>; matches?: number }

/**
 * A GET BY FILTER ANSWERS IN PAGES. One call prints one page and names the cursor of the next on stderr (`after=` continues it);
 * `all=true` follows the cursor to the end and prints every title. A cursor that fails to advance refuses by name, and a wiki
 * that moved mid-walk answers the verb's own `filter-cursor-stale`.
 */
async function printPage(args: ParsedArgs, plan: DoorPlan, first: Ran): Promise<number> {
  const params = paramsOf(plan);
  const follow = params["all"] === "true";
  const titles: string[] = [];
  const rows: FilterRowOut[] = [];
  let last: Record<string, unknown> = {};
  let requestId = "";
  let pages = 0;
  let ran: Ran = first;
  for (let after: string | null = null; ;) {
    requestId = ran.requestId;
    last = ran.output;
    pages++;
    if (Array.isArray(last["rows"])) rows.push(...(last["rows"] as FilterRowOut[]));
    else if (Array.isArray(last["titles"])) titles.push(...(last["titles"] as string[]));
    const next = last["next"];
    if (!follow || typeof next !== "string" || next === "") break;
    if (next === after) {
      const message = `the filter's cursor stood still at ${next}`;
      emit(args, { ok: false, requestId, error: { code: "verb-error", message }, human: () => console.error(`lares get: ${message}`) });
      return 4;
    }
    after = next;
    const step = await runDoor(args, "get", { verb: plan.verb, args: { ...plan.args, params: { ...params, after } } });
    if (!step.ok) return step.exit;
    ran = step;
  }
  // One page rides as the verb answered it; `all=true` rides the pages joined, `next` null and the page count beside them.
  const data = pages === 1 ? last : { ...last, ...(rows.length > 0 || Array.isArray(last["rows"]) ? { rows } : { titles }), next: last["next"] ?? null, pages };
  emit(args, {
    ok: true, requestId, data,
    human: () => {
      // One title per line; named fields follow their title, tab-joined, so a shell cuts them.
      for (const title of titles) console.log(title);
      for (const row of rows) {
        if (typeof row.has === "string") { console.log(row.has); continue; }
        console.log([row.title, ...(row.bytes === undefined ? [] : [`bytes=${row.bytes}`]), ...(row.matches === undefined ? [] : [`matches=${row.matches}`]), ...Object.entries(row.fields).map(([name, value]) => `${name}=${value}`)].join("\t"));
        for (const slot of row.slots ?? []) console.log(`  ${slot.slot}\tbytes=${slot.bytes}\t${slot.first ?? ""}`);
        // The lines lens, grep-shaped: the line number, then the line's own words (a cut line ends on `…`), under the full title.
        for (const line of row.lines ?? []) console.log(`  ${line.n}:\t${line.text}${line.cut ? "…" : ""}`);
      }
      const shown = titles.length + rows.length;
      if (typeof last["next"] === "string" && last["next"] !== "") console.error(`${shown} of ${last["total"]} · next: after=${last["next"]}`);
      else console.error(`${shown} of ${last["total"]}`);
      if (typeof last["withheld"] === "number") console.error(`${last["withheld"]} withheld (titles that stay home, or records this face holds no read on)`);
    },
  });
  return 0;
}

/** A dry answer (mu=dry and its depths) prints whole: nothing landed, and every key reads beside the real decision. */
function printDry(args: ParsedArgs, ran: Ran): number | null {
  if (ran.output["dry"] === undefined || ran.output["dry"] === false) return null;
  return printAnswer(args, ran);
}

function printPut(args: ParsedArgs, params: Record<string, unknown>, ran: Ran): number {
  const dry = printDry(args, ran);
  if (dry !== null) return dry;
  const receipt = ran.output;
  const title = String(receipt["title"] ?? params["title"] ?? "");
  const decision = String(receipt["decision"] ?? "");
  const changed = Array.isArray(receipt["changed"]) ? (receipt["changed"] as string[]) : [];
  const ok = decision === "put" || decision === "noop";
  const code = ok ? "ok" : decision === "conflict" || decision === "exists" ? "conflict" : "verb-error";
  const message = decision === "conflict" && params["append"] !== undefined ? `conflict: ${title} kept moving under the append; it reads ${receipt["hash"] ?? "absent"} now and nothing landed. Send the append again`
                : decision === "conflict" ? `conflict: the record moved past ${params["base"] ?? "the base"}; it reads ${receipt["hash"] ?? "absent"} now. Read again and hand back the live hash`
                : decision === "exists" ? `exists: a tiddler already stands at ${title} (create=true lands only where none does); drop create and pass base=<hash> from \`lares get ${titleWord(title)}${whereOf(params)} mu=relate\` to replace it`
                : `${decision}: ${title}`;
  emit(args, {
    ok, requestId: ran.requestId, data: receipt,
    ...(ok ? {} : { error: { code, message } }),
    human: () => {
      if (!ok) { console.error(`lares put: ${message}`); return; }
      if (typeof receipt["has"] === "string") console.log(receipt["has"]);
      console.log(`${decision}: ${title}`);
      if (decision === "put") console.log(`  ${receipt["created"] === true ? "created" : "changed"} ${changed.join(", ")}`);
      const replaced = receipt["replaced"] as { span?: number; with?: number } | undefined;
      if (decision === "put" && replaced) console.log(`  replaced one span (${replaced.span ?? 0} bytes) with ${replaced.with ?? 0} bytes`);
      // A FAMILY'S ANSWER COUNTS ITS MEMBERS: the records the recompose landed, the slots absence kept, the slots a cut tombstoned.
      const counted = (key: string): number | null => Array.isArray(receipt[key]) ? (receipt[key] as unknown[]).length : null;
      const landed = counted("landed"), kept = counted("kept"), tombstoned = counted("tombstoned");
      if (landed !== null || kept !== null || tombstoned !== null) console.log(`  landed ${landed ?? 0} · kept ${kept ?? 0} · tombstoned ${tombstoned ?? 0}`);
      // THE ANSWER NAMES THE LAYER: a face that holds no writer's seat in the wiki's workbench lands in its own personal layer.
      if (typeof receipt["bag"] === "string" && decision === "put") console.log(receipt["layer"] === "personal"
        ? `  in ${receipt["bag"]}${landedFace(receipt)} (your personal layer: this face holds no writer's seat in the wiki's workbench; \`lares meme offer\` carries a record from here)`
        : `  in ${receipt["bag"]}${landedFace(receipt)}`);
      if (decision === "noop" && typeof receipt["reason"] === "string") console.log(`  ${receipt["reason"]}`);
      for (const w of Array.isArray(receipt["warnings"]) ? (receipt["warnings"] as string[]) : []) console.log(`  ! ${w}`);
      // TWO BASES, EACH FOR ITS OWN WRITE: the record hash guards a put on this one record; the carrier hash guards a put of the
      // family's whole carrier on its root.
      if (receipt["hash"]) console.log(`  base: ${receipt["hash"]} (record: hand it back on a put to ${title})`);
      if (receipt["canonicalHash"]) console.log(`  base: ${receipt["canonicalHash"]} (carrier: hand it back on a whole-carrier put to the root)`);
    },
  });
  return exitFor(code);
}

function printDelete(args: ParsedArgs, params: Record<string, unknown>, ran: Ran): number {
  const dry = printDry(args, ran);
  if (dry !== null) return dry;
  const receipt = ran.output;
  const title = String(receipt["title"] ?? params["title"] ?? "");
  const decision = String(receipt["decision"] ?? "");
  const code = decision === "removed" ? "ok" : decision === "conflict" ? "conflict" : decision === "absent" ? "not-found" : "verb-error";
  // A refusal the family law answers rides the receipt with the consequence it read: the code leads the message.
  const refusal = decision === "refused" && typeof receipt["refusal"] === "string" ? receipt["refusal"] : null;
  const message = decision === "conflict" ? `conflict: the record moved past ${params["base"] ?? "the base"}; it reads ${receipt["hash"] ?? "absent"} now`
                : decision === "absent" ? `no tiddler at ${title}`
                : refusal ? String(receipt["why"] ?? `${refusal}: ${title}`) : `${decision}: ${title}`;
  const read = receipt["consequence"] as { acts?: Array<{ title: string; act: string; bag?: string | null; shadowed?: string[]; reveals?: string | null }>; leaves?: Array<{ title: string; why: string }> } | undefined;
  /** One act as a line: the layer it writes and what the wiki reads afterward. */
  const actLine = (row: NonNullable<NonNullable<typeof read>["acts"]>[number]): string =>
    row.act === "retract" ? `${row.reveals ? "retract" : "delete"} ${row.title} from ${row.bag ?? "?"} → ${row.reveals ? `reveals ${row.reveals}` : "reads absent"}`
    : row.act === "tombstone" ? `kapae ${row.title} in ${row.bag ?? "?"}${row.shadowed?.length ? ` (shadows ${row.shadowed.join(", ")})` : ""}`
    : `${row.act} ${row.title}`;
  emit(args, {
    ok: code === "ok", requestId: ran.requestId, data: receipt,
    ...(code === "ok" ? {} : { error: { code, message, ...(refusal ? { hint: `refusal: ${refusal}` } : {}) } }),
    human: () => {
      if (code !== "ok") {
        console.error(`lares delete: ${message}`);
        if (refusal) for (const row of read?.acts ?? []) console.error(`  would ${actLine(row)}`);
        return;
      }
      console.log(`removed: ${title}`);
      for (const row of read?.acts ?? []) console.log(`  ${actLine(row)}`);
      for (const row of read?.leaves ?? []) console.log(`  leaves ${row.title} (${row.why})`);
      // A family's removal counts what left: tombstoned where a lower layer would surface, retracted where none would.
      const tombstoned = Array.isArray(receipt["tombstoned"]) ? (receipt["tombstoned"] as unknown[]).length : null;
      const retracted = Array.isArray(receipt["retracted"]) ? (receipt["retracted"] as unknown[]).length : null;
      if (tombstoned !== null || retracted !== null) console.log(`  tombstoned ${tombstoned ?? 0}${retracted ? ` · retracted ${retracted}` : ""}`);
      if (typeof receipt["bag"] === "string") console.log(`  in ${receipt["bag"]}${landedFace(receipt)}`);
      if (receipt["hash"]) console.log(`  base: ${receipt["hash"]}`);
      if (receipt["canonicalHash"]) console.log(`  base: ${receipt["canonicalHash"]} (carrier)`);
    },
  });
  return exitFor(code);
}

function printRename(args: ParsedArgs, params: Record<string, unknown>, ran: Ran): number {
  const dry = printDry(args, ran);
  if (dry !== null) return dry;
  const receipt = ran.output;
  const title = String(receipt["title"] ?? params["title"] ?? "");
  const decision = String(receipt["decision"] ?? "");
  const code = decision === "renamed" ? "ok" : decision === "conflict" ? "conflict" : decision === "absent" ? "not-found" : "verb-error";
  const refusal = decision === "refused" && typeof receipt["refusal"] === "string" ? receipt["refusal"] : null;
  const message = decision === "conflict" ? `conflict: the record moved past ${params["base"] ?? "the base"}; it reads ${receipt["hash"] ?? "absent"} now`
                : decision === "absent" ? `no tiddler at ${title}`
                : refusal ? String(receipt["why"] ?? `${refusal}: ${title}`) : `${decision}: ${title}`;
  const relinked = Array.isArray(receipt["relinked"]) ? (receipt["relinked"] as string[]) : [];
  emit(args, {
    ok: code === "ok", requestId: ran.requestId, data: receipt,
    ...(code === "ok" ? {} : { error: { code, message, ...(refusal ? { hint: `refusal: ${refusal}` } : {}) } }),
    human: () => {
      if (code !== "ok") { console.error(`lares rename: ${message}`); return; }
      console.log(`renamed: ${title} -> ${String(receipt["to"] ?? params["to"] ?? "")}`);
      console.log(`  forwarder stands at ${title}`);
      for (const name of relinked) console.log(`  relinked ${name}`);
      if (typeof receipt["skipped"] === "number") console.log(`  skipped ${receipt["skipped"]} stay-home referrer(s): each keeps its fields`);
      if (typeof receipt["withheld"] === "number") console.log(`  withheld ${receipt["withheld"]} record(s) this face may not read: counted, never named`);
      if (receipt["hash"]) console.log(`  base: ${receipt["hash"]}`);
    },
  });
  return exitFor(code);
}
