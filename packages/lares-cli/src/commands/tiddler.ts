/**
 * `lares tiddler <get | put | delete>` — THE TIDDLER DOOR's record verbs, the CLI skin of the daemon's `tiddler-get` ·
 * `tiddler-put` · `tiddler-delete` (the wiki-engine half rides `lares wiki filter | render | status`).
 *
 * ONE VERB, ONE SHAPE, EVERY DOOR. Each sub-verb plans the daemon verb's own args from the command line and prints
 * the daemon's own answer: `--json` carries the verb's output verbatim as `data`, the same body the MCP seat's
 * `tiddler_get` · `tiddler_put` · `tiddler_delete` hand back, so a script and an AI session read one answer.
 *
 * A tiddler verb acts on ONE record with its fields, whatever its type: a plain note, a data tiddler, a meme's root or
 * one of its slots. A meme family reads as tiddlers: a text put on a root or a slot lands through the Confluence gate
 * inside the put (split, recompose, the block check), and a field or tag patch lands beside it. A whole carrier rides as
 * the root's text (`--file <path|->`, `--text <words>`); `--slot '#/x'` folds into the title (`<root>#/x`), so a slot's
 * text put and `--append` land on that slot, a slot's text put naming no base, a partial base (`partial:#/x:…`) patching
 * within its span. ABSENCE NEVER DELETES: a slot the new text omits stays standing by reference (`kept`), and
 * `--cut-slot '#/slot'` names each slot that leaves. A delete reads the one family law: a plain tiddler leaves; a meme root
 * answers the consequence the delete would land and refuses (`tiddler-delete-in-a-family`) unless the line names the
 * family act (`--family`), which lands it as one change; a slot title (`<root>#/x`) lands as the cut on its parent.
 * A delete deletes plainly: the record leaves its layer and no tombstone rises. Only a lower layer makes it a choice: where
 * one holds the title too, no mode refuses `delete-mode-needed`, and the line names one: `--mode kapae` shadows the title
 * from a writable layer and the layers beneath keep their records; `--mode reveal` retracts the topmost record and the
 * one beneath surfaces. A title the wiki reads absent answers too: a plain delete retracts a kāpae that hides nothing.
 *
 * The container law holds: `get`, `put` and `delete` name `--recipe <slug>` or `--bag <slug>` (`--realm <id>` beside a bag);
 * `rename` names `--recipe <slug>` alone. `--recipe default` answers the worn face's daemon wiki, and `--recipe <slug>` any
 * wiki that face reaches, in that wiki's own engine; a wiki it reaches none of refuses `wiki-unreached`. `--bag <slug>` reads
 * or writes that one bag through its store, under the gates the bag's own writes keep (no engine runs). `--face N` rides a
 * session of face N on every sub-verb.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout
 */

import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { stdin, stdout } from "node:process";
import { containerArgs, engineContainerArgs } from "../container-target.js";
import { emit, exitFor, proseFirst } from "../render.js";
import { DoorUsage, countOf, guardDoor, namesOf, runDoor, wordOf, type DoorPlan } from "./door-call.js";
import { targetOf, targetOnWriteRefusal } from "../target-option.js";
import { helpLines } from "../command-help.js";
import { readCarrierShape } from "@lararium/tw5";
import { mediaTypeFromExt, ridesAsPointer } from "@lararium/mesh/content-handle";
import { niUriSha256FromHex } from "@lararium/mesh/crypto";
import { stageBodyToCas } from "../cas-stage.js";
import { cmdFamily } from "./family.js";
import { landedFace } from "./meme-shared.js";
import type { ParsedArgs } from "../parse-args.js";

/** Every verb the tiddler door answers. */
export const TIDDLER_VERBS = ["get", "put", "delete", "rename"] as const;
const SUBS = TIDDLER_VERBS;
type Sub = typeof SUBS[number];

/** The verb and its args for a tiddler sub-verb: the argument law, with no daemon in reach. */
export function tiddlerPlan(sub: Sub, args: ParsedArgs): DoorPlan {
  const title = args.positional[1];
  if (sub === "get" && !title && args.flags["meme"] === true) {
    const target = targetOf(args);
    const out: Record<string, unknown> = { ...containerArgs(args, "tiddler get", "read"), ...target };
    if (args.flags["tree"] === true) out["tree"] = true;
    return { verb: "meme-list", args: out };
  }
  if (!title) throw new DoorUsage(`a title is required (e.g. \`lares tiddler ${sub} "My Note" --recipe default\`)`);
  // A LIT FACE RECEIVES VISITS: `--target` names another lit face; a get reads its daemon wiki while the command keeps the
  // face it wears, and a put or delete naming it refuses here by name, before any door opens.
  const target = targetOf(args);
  if (sub !== "get" && target.target !== undefined) throw new DoorUsage(targetOnWriteRefusal(`tiddler ${sub}`));
  // A BAG TAKES THE PLAIN PUT AND DELETE through its store; a rename relinks inside one wiki's engine and names a recipe alone.
  const container = sub === "rename" ? engineContainerArgs(args, "tiddler rename", "write") : containerArgs(args, `tiddler ${sub}`, sub === "get" ? "read" : "write");
  const out: Record<string, unknown> = { ...container, title: sub === "put" ? slotTitle(title, args.options["slot"]) : title, ...target };
  if (sub === "get") {
    const slot = wordOf(args.options["slot"]);
    if (slot) out["slot"] = slot;
    const fields = namesOf(args.options["fields"]);
    if (fields) out["fields"] = fields;
    // THE GRADIENT: the lens (`--meme` recomposes the carrier) and the grain ride apart, and the line spells the grain with the
    // flags it already held: `--skinny` (the card), `--all` (the whole at the lens's grain: a record fat, a pointer resolved from
    // the local CAS, a meme's carrier paged on slot boundaries), `--slot` (one slot). None: the door picks by size.
    if (args.flags["meme"] === true) out["meme"] = true;
    if (args.flags["skinny"] === true && args.flags["all"] === true) throw new DoorUsage("name one grain: --skinny (the card) or --all (the whole), never both");
    if (args.flags["skinny"] === true) out["grain"] = "skinny";
    if (args.flags["all"] === true) out["grain"] = "whole";
    const after = wordOf(args.options["after"]);
    if (after) out["after"] = after;
    const maxBytes = countOf(args.options["max-bytes"], "max-bytes");
    if (maxBytes !== null) out["maxBytes"] = maxBytes;
    // TEXT ALONE (`--text`, a bare flag on get; on put it carries the words written): the text rides stdout and nothing else, so
    // the read asks for the whole text at the lens's grain. The record lens reads `whole` (a record fat, a pointer resolved from
    // the local CAS); the meme lens reads the whole carrier (its pages followed and joined), a slot its span, a cursor its page.
    if (args.flags["text"] === true) {
      const where = whereOf(out);
      if (args.flags["skinny"] === true) throw new DoorUsage(`text-unread: --skinny reads the card, which leaves the text home; drop --skinny (\`lares tiddler get ${title} ${where} --text\`)`);
      if (fields) throw new DoorUsage(`text-unread: --text answers the text alone and no field list; drop --fields for the text (\`lares tiddler get ${title} ${where} --text\`), or drop --text for the named fields`);
      if (maxBytes !== null) throw new DoorUsage(`text-unread: --text answers the whole text, which no byte cap narrows; drop --max-bytes (\`lares tiddler get ${title} ${where} --text\`)`);
      const slotted = slot !== null || (title.includes("#/") && args.flags["meme"] === true);
      if (out["grain"] === undefined && !after && !(args.flags["meme"] === true && slotted)) out["grain"] = "whole";
    }
    return { verb: "tiddler-get", args: out };
  }
  if (sub === "rename") {
    // `lares tiddler rename <old> <new>`: the verb reads the new title as `to`, the base as the hash last read.
    const to = args.positional[2];
    if (!to) throw new DoorUsage(`the new title is required (e.g. \`lares tiddler rename "${title}" "New Title" --recipe default\`)`);
    out["to"] = to;
    const base = wordOf(args.options["if-match"]) ?? wordOf(args.options["base"]);
    if (base) out["base"] = base;
    return { verb: "tiddler-rename", args: out };
  }
  if (sub === "delete") {
    // The route spells the base as `If-Match`; the verb reads it as `base`: one hash, two spellings.
    const base = wordOf(args.options["if-match"]) ?? wordOf(args.options["base"]);
    if (base) out["base"] = base;
    if (args.flags["family"] === true) out["family"] = true;
    const mode = wordOf(args.options["mode"]);
    if (mode !== null) {
      if (mode !== "kapae" && mode !== "reveal") throw new DoorUsage(`--mode takes kapae (a tombstone keeps the layers beneath hidden) or reveal (retract the top record, the one beneath surfaces); name none for a plain delete; got "${mode}"`);
      out["mode"] = mode;
    }
    return { verb: "tiddler-delete", args: out };
  }
  const raw = wordOf(args.options["fields"]);
  if (raw !== null) {
    let patch: unknown;
    try { patch = JSON.parse(raw); } catch { throw new DoorUsage("--fields takes a JSON object of field names to string values, e.g. --fields '{\"status\":\"done\"}'"); }
    if (typeof patch !== "object" || patch === null || Array.isArray(patch)) throw new DoorUsage("--fields takes a JSON object of field names to string values");
    out["fields"] = patch;
  }
  const unset = namesOf(args.options["unset"]);
  if (unset) out["unset"] = unset;
  const tagsAdd = wordOf(args.options["tag-add"]);
  if (tagsAdd) out["tagsAdd"] = tagsAdd;
  const tagsRemove = wordOf(args.options["tag-remove"]);
  if (tagsRemove) out["tagsRemove"] = tagsRemove;
  // THE SLOTS THAT LEAVE, by name: absence never cuts, so a put names each slot it removes (`--cut-slot '#/a'`, repeatable).
  const cut = wordOf(args.options["cut-slot"]);
  if (cut) out["cut"] = cut;
  // A REPLACE IN PLACE: the span and its new words ride exactly as written, never trimmed (a span's edge spaces count), and
  // `--with ''` removes the span. The door counts the span and refuses unless it occurs exactly once.
  const span = args.options["replace"];
  if (typeof span === "string") out["replace"] = span;
  const turned = args.options["with"];
  if (typeof turned === "string") out["with"] = turned;
  const base = wordOf(args.options["base"]);
  if (base) out["base"] = base;
  if (args.flags["create"] === true) out["create"] = true;
  return { verb: "tiddler-put", args: out };
}

/** A slot path the put folds into its title: `#/name`, nested `#/a/b`, no space, `#`, `$` or empty step. */
const SLOT_PATH = /^#\/[^\s#$/]+(?:\/[^\s#$/]+)*$/;

/**
 * THE SLOT FOLDS INTO THE TITLE: `--slot '#/x'` names the record `<root>#/x`, so a slot's text put and an append on a slot ride
 * the one plain put. A malformed path refuses by name, and so does a slot beside a title that already carries a fragment (the
 * title names the slot itself there).
 */
export function slotTitle(title: string, raw: string | undefined): string {
  const slot = wordOf(raw);
  if (slot === null) return title;
  if (!SLOT_PATH.test(slot)) throw new DoorUsage(`slot-malformed: --slot takes a slot path such as '#/notes' or '#/notes/today' (got "${slot}"); \`lares tiddler get --meme --recipe <slug> --tree\` names the slots a family holds`);
  if (title.includes("#")) throw new DoorUsage(`slot-beside-fragment: ${title} already names a slot; drop --slot (\`lares tiddler put '${title}' …\`) or name the root with --slot '${slot}'`);
  return `${title}${slot}`;
}

/** The raw bytes a named source holds: a host path, or `-` for stdin. */
async function sourceRaw(flag: string, source: string): Promise<Buffer> {
  if (source !== "-") {
    try { return readFileSync(source); } catch { throw new DoorUsage(`cannot read --${flag} ${source}`); }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

/** The words a named source holds, read as utf8. */
async function sourceBytes(flag: string, source: string): Promise<string> {
  return (await sourceRaw(flag, source)).toString("utf8");
}

/** A put's pointer: the fields that name staged bytes by their hash, and the `text` the record sheds for them. */
interface FilePointer { readonly fields: Record<string, string>; readonly unset: readonly string[] }

/**
 * A FILE WHOSE KIND RIDES AS A POINTER LANDS AS ONE (THE BLOB LAW). Two readings elect it, and nothing else: the line
 * declares a pointer-kind `type` in `--fields` (an image, audio, video, a font, a PDF), or the bytes fail the utf8
 * round-trip (a binary read as words would land mangled), where the type reads from the extension through TiddlyWiki's own
 * registry and a kind the registry lacks rides `application/octet-stream`. The raw bytes stage into the content tier under
 * their SHA-256, and the put carries `_canonical_uri` and `_integrity` naming that digest; the door seats the pointer and
 * verifies the staged bytes. A utf8 file with no pointer-kind type declared rides as words, typed by the caller alone.
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

/**
 * A put's words, only where the caller names a source: `--text <words>`, `--file <path>` (or `-` for stdin) for the whole text,
 * `--append <path>` (or `-`) for words that land at the end of the standing text. A field patch reads none, and neither does a
 * replace (`--replace <span> --with <words>`), whose span and words ride the plan itself.
 */
async function putText(args: ParsedArgs, declaredType: string | null = null): Promise<{ readonly text: string } | { readonly append: string } | { readonly pointer: FilePointer } | null> {
  const inline = args.options["text"];
  const file = wordOf(args.options["file"]);
  const append = wordOf(args.options["append"]);
  if (typeof inline === "string" && file) throw new DoorUsage("name one text source: --text <words> or --file <path>, never both");
  if (append) return { append: await sourceBytes("append", append) };
  if (typeof inline === "string") return { text: inline };
  if (!file) return null;
  const raw = await sourceRaw("file", file);
  const pointer = filePointer(raw, file, declaredType);
  return pointer ? { pointer } : { text: raw.toString("utf8") };
}

interface GotTiddler { fields: Record<string, string>; hash: string; textHash: string | null; bag: string | null; position: string; family?: string; omitted?: string[] }
interface GotMeme { uri: string; text?: string; slotText?: string; canonicalHash: string; bytes: number; slots: Array<{ slot: string; bytes: number; first: string | null }>; slot?: string; page?: { page: number; pages: number } }
interface GotGrain { asked: string | null; applied: string; why: string }
interface GotNext { grain: string; after?: string }

/**
 * `tiddler get` ANSWERS ON A GRADIENT. Every answer leads with its `<<~ has …>>` line (stderr, where stdout carries a body; stdout,
 * where the has-stack is the answer) and names the grain it applied and why. The record reaches stdout as a `.tid` reads (one
 * `name: value` line per field, a blank line, the text). `--meme` answers the carrier on stdout, a terminal or a pipe alike (the
 * carrier-first law `proseFirst` holds), so `lares tiddler get <uri> --recipe <slug> --meme --all > file` carries the whole meme:
 * within a page the carrier whole, past it the has-stack, and `--all` follows the pages (each cut on a slot boundary) to the end.
 * `--text` answers the TEXT ALONE on stdout, a terminal or a pipe alike, so a pipe into an editor or a diff takes no parse step:
 * a record's text whole (a pointer's body resolved), a meme's recomposed carrier whole (its pages followed), a slot's span; the
 * has line and base ride stderr, and an explicit `--json` keeps the envelope. An answer that carries no text refuses `text-unread`.
 */
async function tiddlerGet(given: ParsedArgs): Promise<number> {
  const lens = given.flags["meme"] === true;
  const alone = given.flags["text"] === true;
  // A carrier and the text alone answer a pipe in prose (the carrier-first law); only an explicit `--json` asks the envelope.
  const args = lens || alone ? proseFirst(given) : given;
  const plan = tiddlerPlan("get", args);
  // The meme lens follows the pages of the whole carrier where the plan asked the whole (`--all`, or `--text`).
  const paged = lens && plan.args["grain"] === "whole";
  const parts: string[] = [];
  let ran = await runDoor(args, "tiddler get", plan);
  if (!ran.ok) return ran.exit;
  const first = ran;
  // `--all` on the meme lens follows the pages of the whole carrier to the end; each page names the cursor of the one behind.
  for (;;) {
    const meme = ran.output["meme"] as GotMeme | undefined;
    if (typeof meme?.text === "string") parts.push(meme.text);
    else if (typeof meme?.slotText === "string") parts.push(meme.slotText);
    const after = (ran.output["next"] as GotNext | null | undefined)?.after ?? null;
    if (!paged || !after) break;
    const step = await runDoor(args, "tiddler get", { verb: plan.verb, args: { ...plan.args, grain: "whole", after } });
    if (!step.ok) return step.exit;
    if ((step.output["next"] as GotNext | null | undefined)?.after === after) {
      const message = `the carrier's cursor stood still at ${after}`;
      emit(args, { ok: false, requestId: step.requestId, error: { code: "verb-error", message }, human: () => console.error(`lares tiddler get: ${message}`) });
      return 4;
    }
    ran = step;
  }
  const output = ran.output;
  const title = String(output["title"] ?? plan.args["title"]);
  const tiddler = output["tiddler"] as GotTiddler | null | undefined;
  const meme = output["meme"] as GotMeme | undefined;
  if (!meme && !tiddler) {
    emit(args, { ok: false, requestId: ran.requestId, data: output, error: { code: "not-found", message: `no tiddler at ${title}` }, human: () => console.error(`lares tiddler get: no tiddler at ${title}`) });
    return exitFor("not-found");
  }
  const has = String(output["has"] ?? "");
  const grain = output["grain"] as GotGrain | undefined;
  const followed = paged && parts.length > 1;
  const note = typeof output["note"] === "string" ? output["note"] : null;
  // `--all` followed: the envelope carries the whole carrier the pages joined to, the first page's has line, and no next.
  // A JOINED READ ECHOES THE JOIN, never the first page's `page 1 of N`.
  const joinedGrain = followed && grain ? { ...grain, why: `the whole carrier, ${parts.length} pages joined on slot boundaries` } : grain;
  const data0 = followed && meme
    ? { ...first.output, has: output["has"], meme: (({ page: _page, ...whole }) => ({ ...whole, text: parts.join("") }))(meme), grain: joinedGrain, next: null }
    : output;
  // ── THE COMPOSITION READING, WHERE A HUMAN WAITS ON A CARRIER ─────────────────────────────────────────
  // The whole carrier the meme lens answers is the composed one: the join a root and its slot children make. That join is where
  // a whole class of fault comes into being and nowhere else (two legal carriers joined into one with two text frames, only the
  // first verifying: `child-grade-decision.mem` #/measured rows 11 and 13). So the read carries `readCarrierShape` over the
  // whole carrier: the faults ride the machine channel (`shape`) and stderr, never stdout (the operator's artifact), and the
  // exit carries the reading while `ok` carries the act. REPORT, NEVER REFUSE: write-open, read-certified; withholding the
  // bytes would arbitrate over a carrier its author wrote on purpose, and no byte of the read is wrong.
  // The door reads a carrier answered in one page (`shape`, where it faults); a carrier `--all` joined from pages reads here.
  const joined = followed ? readCarrierShape(parts.join("")) : null;
  const shape = joined ? { check: joined.marks.check, faults: joined.faults } : (output["shape"] as { check: string; faults: string[] } | undefined) ?? null;
  const faulted = shape !== null && shape.faults.length > 0;
  const data = joined && faulted ? { ...data0, shape } : data0;
  // TEXT ALONE NAMES WHAT LEFT IT HOME: a pointer whose body went unread or unverified, a card, a has-stack. The read refuses by
  // name with the read that cures it, and writes no byte to stdout (a pipe never takes a has-stack or a handle for the text).
  const recordText: string | undefined = tiddler?.fields["text"];
  const meant = meme && (typeof meme.text === "string" || typeof meme.slotText === "string") ? parts.join("")
    : !meme && typeof recordText === "string" ? recordText : null;
  if (alone && meant === null) {
    const pointer = output["pointer"] as { owes?: string; cure?: string } | undefined;
    const again = `\`lares tiddler get ${title} ${whereOf(plan.args)} --text\``;
    const why = pointer?.owes
      ? `the pointer's body rode no text (${pointer.owes}); ${pointer.cure ?? "`lares bag cas` surveys the content tier the body resolves from"}${lens ? `, or read the record lens, which resolves it: ${again}` : ""}`
      : meme
        ? `the carrier answered its has-stack; ${again.replace(" --text`", " --meme --text`")} reads the whole carrier, its pages joined`
        : lens
          ? `the meme lens answered the record (${grain?.why ?? "the text left home"}); the record lens reads it whole: ${again}`
          : `the answer left the text home (${grain?.why ?? "no text field"}); ${again} asks the whole`;
    const message = `text-unread: ${title} answered no text alone: ${why}`;
    emit(args, { ok: false, requestId: ran.requestId, data, error: { code: "text-unread", message }, human: () => console.error(`lares tiddler get: ${message}`) });
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
        if (typeof meme.text !== "string" && typeof meme.slotText !== "string") console.error("the carrier runs past one page: stdout carries its has-stack; --all reads the whole carrier, paged on slot boundaries");
        else if (meme.page && !followed) {
          const after = (output["next"] as GotNext | null | undefined)?.after;
          if (after) console.error(`page ${meme.page.page} of ${meme.page.pages}: read the next with --after ${after} (or --all for the whole carrier)`);
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
      // TEXT ALONE: the text's own bytes and nothing else (no field line, no added newline); the has line and base ride stderr.
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

/** The note a floor read carries: the bag's floor snapshot answered, since this face holds no read on the live house canon document. */
const FLOOR_NOTE = "read from the floor snapshot: this face holds no read on the live house canon document (the Kahu steward's face reads it live)";

/** The container a plan names, as a command line spells it: a cure names the same wiki or bag the act named. */
const whereOf = (planned: Record<string, unknown>): string =>
  typeof planned["bag"] === "string" ? `--bag ${planned["bag"]}${typeof planned["realm"] === "string" ? ` --realm ${planned["realm"]}` : ""}` : `--recipe ${String(planned["recipe"] ?? "<slug>")}`;

async function tiddlerPut(args: ParsedArgs): Promise<number> {
  const plan = tiddlerPlan("put", args);
  const planned = plan.args["fields"] as Record<string, unknown> | undefined;
  const words = await putText(args, typeof planned?.["type"] === "string" ? planned["type"] : null);
  // A pointer rides as fields: the address and the digest join the line's own patch, and the record sheds its `text`.
  const carried = words === null ? {}
    : "pointer" in words ? { fields: { ...(planned ?? {}), ...words.pointer.fields }, unset: [...((plan.args["unset"] as string[] | undefined) ?? []), ...words.pointer.unset] }
    : words;
  const ran = await runDoor(args, "tiddler put", words === null ? plan : { verb: plan.verb, args: { ...plan.args, ...carried } });
  if (!ran.ok) return ran.exit;
  const receipt = ran.output;
  const decision = String(receipt["decision"] ?? "");
  const changed = Array.isArray(receipt["changed"]) ? (receipt["changed"] as string[]) : [];
  const ok = decision === "put" || decision === "noop";
  const code = ok ? "ok" : decision === "conflict" || decision === "exists" ? "conflict" : "verb-error";
  const message = decision === "conflict" && words !== null && "append" in words ? `conflict: ${plan.args["title"]} kept moving under the append; it reads ${receipt["hash"] ?? "absent"} now and nothing landed. Send the append again`
                : decision === "conflict" ? `conflict: the record moved past ${plan.args["base"] ?? "the base"}; it reads ${receipt["hash"] ?? "absent"} now. Read again and hand back the live hash`
                : decision === "exists" ? `exists: a tiddler already stands at ${plan.args["title"]} (--create lands only where none does); drop --create and pass --base <hash> from \`lares tiddler get ${plan.args["title"]} ${whereOf(plan.args)} --skinny\` to replace it`
                : `${decision}: ${plan.args["title"]}`;
  emit(args, {
    ok, requestId: ran.requestId, data: receipt,
    ...(ok ? {} : { error: { code, message } }),
    human: () => {
      if (!ok) { console.error(`lares tiddler put: ${message}`); return; }
      if (typeof receipt["has"] === "string") console.log(receipt["has"]);
      console.log(`${decision}: ${plan.args["title"]}`);
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
      if (receipt["hash"]) console.log(`  base: ${receipt["hash"]} (record: hand it back on a put to ${plan.args["title"]})`);
      if (receipt["canonicalHash"]) console.log(`  base: ${receipt["canonicalHash"]} (carrier: hand it back on a whole-carrier put to the root)`);
    },
  });
  return exitFor(code);
}

async function tiddlerDelete(args: ParsedArgs): Promise<number> {
  const plan = tiddlerPlan("delete", args);
  const ran = await runDoor(args, "tiddler delete", plan);
  if (!ran.ok) return ran.exit;
  const receipt = ran.output;
  const decision = String(receipt["decision"] ?? "");
  const code = decision === "removed" ? "ok" : decision === "conflict" ? "conflict" : decision === "absent" ? "not-found" : "verb-error";
  // A refusal the family law answers rides the receipt with the consequence it read: the code leads the message.
  const refusal = decision === "refused" && typeof receipt["refusal"] === "string" ? receipt["refusal"] : null;
  const message = decision === "conflict" ? `conflict: the record moved past ${plan.args["base"] ?? "the base"}; it reads ${receipt["hash"] ?? "absent"} now`
                : decision === "absent" ? `no tiddler at ${plan.args["title"]}`
                : refusal ? String(receipt["why"] ?? `${refusal}: ${plan.args["title"]}`) : `${decision}: ${plan.args["title"]}`;
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
        console.error(`lares tiddler delete: ${message}`);
        if (refusal) for (const row of read?.acts ?? []) console.error(`  would ${actLine(row)}`);
        return;
      }
      console.log(`removed: ${plan.args["title"]}`);
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

async function tiddlerRename(args: ParsedArgs): Promise<number> {
  const plan = tiddlerPlan("rename", args);
  const ran = await runDoor(args, "tiddler rename", plan);
  if (!ran.ok) return ran.exit;
  const receipt = ran.output;
  const decision = String(receipt["decision"] ?? "");
  const code = decision === "renamed" ? "ok" : decision === "conflict" ? "conflict" : decision === "absent" ? "not-found" : "verb-error";
  const refusal = decision === "refused" && typeof receipt["refusal"] === "string" ? receipt["refusal"] : null;
  const message = decision === "conflict" ? `conflict: the record moved past ${plan.args["base"] ?? "the base"}; it reads ${receipt["hash"] ?? "absent"} now`
                : decision === "absent" ? `no tiddler at ${plan.args["title"]}`
                : refusal ? String(receipt["why"] ?? `${refusal}: ${plan.args["title"]}`) : `${decision}: ${plan.args["title"]}`;
  const relinked = Array.isArray(receipt["relinked"]) ? (receipt["relinked"] as string[]) : [];
  emit(args, {
    ok: code === "ok", requestId: ran.requestId, data: receipt,
    ...(code === "ok" ? {} : { error: { code, message, ...(refusal ? { hint: `refusal: ${refusal}` } : {}) } }),
    human: () => {
      if (code !== "ok") { console.error(`lares tiddler rename: ${message}`); return; }
      console.log(`renamed: ${plan.args["title"]} -> ${plan.args["to"]}`);
      console.log(`  forwarder stands at ${plan.args["title"]}`);
      for (const name of relinked) console.log(`  relinked ${name}`);
      if (typeof receipt["skipped"] === "number") console.log(`  skipped ${receipt["skipped"]} stay-home referrer(s): each keeps its fields`);
      if (typeof receipt["withheld"] === "number") console.log(`  withheld ${receipt["withheld"]} record(s) this face may not read: counted, never named`);
      if (receipt["hash"]) console.log(`  base: ${receipt["hash"]}`);
    },
  });
  return exitFor(code);
}

export async function cmdTiddler(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0];
  // THE LISTING: `tiddler get --meme` with no title reads the family roots a seat holds (step 3 folds it into filters).
  if (args.flags["meme"] === true && sub === "get" && !args.positional[1]) {
    return cmdFamily({ ...args, command: "meme", positional: ["list"] } as ParsedArgs);
  }
  if (!(SUBS as readonly string[]).includes(sub ?? "")) {
    if (sub) console.error(`lares tiddler: unknown sub-verb "${sub}"`);
    for (const line of helpLines("tiddler")) console.error(line);
    return 2;
  }
  return guardDoor(args, `tiddler ${sub}`, async () => {
    switch (sub as Sub) {
      case "get":    return await tiddlerGet(args);
      case "put":    return await tiddlerPut(args);
      case "delete": return await tiddlerDelete(args);
      case "rename": return await tiddlerRename(args);
    }
  });
}
