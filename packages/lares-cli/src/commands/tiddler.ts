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
 * inside the put (split, recompose, the block check), and a field or tag patch lands beside it. ABSENCE NEVER DELETES: a
 * slot the new text omits stays standing by reference (`kept`), and `--cut '#/slot'` names each slot that leaves. A delete reads the one family
 * law: a plain tiddler leaves; a meme root or slot answers the consequence the delete would land and refuses
 * (`tiddler-delete-in-a-family`) unless the line names the family act (`--family`), which lands it as one change.
 * A delete deletes plainly: the record leaves its layer and no tombstone rises. Only a lower layer makes it a choice: where
 * one holds the title too, no mode refuses `delete-mode-needed`, and the line names one: `--mode kapae` shadows the title
 * from a writable layer and the layers beneath keep their records; `--mode reveal` retracts the topmost record and the
 * one beneath surfaces. A title the wiki reads absent answers too: a plain delete retracts a kāpae that hides nothing.
 *
 * The container law holds: `get` names `--recipe <slug>` or `--bag <slug>`; `put` and `delete` name `--recipe <slug>` alone.
 * `--recipe default` answers the worn face's daemon wiki, and `--recipe <slug>` any wiki that face reaches, in that wiki's own
 * engine; a wiki it reaches none of refuses `wiki-unreached`. `get --bag <slug>` reads that one bag's record (no engine runs);
 * `put` and `delete` refuse `--bag` as `wiki-not-anchored` and name `lares tiddler put | delete --meme --bag`.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout
 */

import { readFileSync } from "node:fs";
import { stdin, stdout } from "node:process";
import { containerArgs, engineContainerArgs } from "../container-target.js";
import { emit, exitFor, proseFirst } from "../render.js";
import { DoorUsage, countOf, guardDoor, namesOf, runDoor, wordOf, type DoorPlan } from "./door-call.js";
import { targetOf, targetOnWriteRefusal } from "../target-option.js";
import { helpLines } from "../command-help.js";
import { readCarrierShape } from "@lararium/tw5";
import { cmdFamily } from "./family.js";
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
  const out: Record<string, unknown> = { ...(sub === "get" ? containerArgs(args, "tiddler get", "read") : engineContainerArgs(args, `tiddler ${sub}`, "write")), title, ...target };
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
    // The meme door's own spelling of the base on a delete, kept: one hash, the verb reads it as `base`.
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
  // THE SLOTS THAT LEAVE, by name: absence never cuts, so a put names each slot it removes (`--cut '#/a'`, repeatable).
  const cut = wordOf(args.options["cut"]);
  if (cut) out["cut"] = cut;
  const base = wordOf(args.options["base"]);
  if (base) out["base"] = base;
  if (args.flags["create"] === true) out["create"] = true;
  return { verb: "tiddler-put", args: out };
}

/** The bytes a named source holds: a host path, or `-` for stdin. */
async function sourceBytes(flag: string, source: string): Promise<string> {
  if (source !== "-") {
    try { return readFileSync(source, "utf8"); } catch { throw new DoorUsage(`cannot read --${flag} ${source}`); }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * A put's words, only where the caller names a source: `--text <words>`, `--file <path>` (or `-` for stdin) for the whole text,
 * `--append <path>` (or `-`) for words that land at the end of the standing text. A field patch reads none.
 */
async function putText(args: ParsedArgs): Promise<{ readonly text: string } | { readonly append: string } | null> {
  const inline = args.options["text"];
  const file = wordOf(args.options["file"]);
  const append = wordOf(args.options["append"]);
  if (typeof inline === "string" && file) throw new DoorUsage("name one text source: --text <words> or --file <path>, never both");
  if (append) return { append: await sourceBytes("append", append) };
  if (typeof inline === "string") return { text: inline };
  if (!file) return null;
  return { text: await sourceBytes("file", file) };
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
 */
async function tiddlerGet(given: ParsedArgs): Promise<number> {
  const lens = given.flags["meme"] === true;
  const args = lens ? proseFirst(given) : given;
  const plan = tiddlerPlan("get", args);
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
    if (!lens || args.flags["all"] !== true || !after) break;
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
  const followed = lens && args.flags["all"] === true && parts.length > 1;
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
      for (const [name, value] of Object.entries(rest)) stdout.write(`${name}: ${value}\n`);
      if (typeof text === "string") stdout.write(`\n${text}${text.endsWith("\n") ? "" : "\n"}`);
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

async function tiddlerPut(args: ParsedArgs): Promise<number> {
  const plan = tiddlerPlan("put", args);
  const words = await putText(args);
  const ran = await runDoor(args, "tiddler put", words === null ? plan : { verb: plan.verb, args: { ...plan.args, ...words } });
  if (!ran.ok) return ran.exit;
  const receipt = ran.output;
  const decision = String(receipt["decision"] ?? "");
  const changed = Array.isArray(receipt["changed"]) ? (receipt["changed"] as string[]) : [];
  const ok = decision === "put" || decision === "noop";
  const code = ok ? "ok" : decision === "conflict" || decision === "exists" ? "conflict" : "verb-error";
  const message = decision === "conflict" && words !== null && "append" in words ? `conflict: ${plan.args["title"]} kept moving under the append; it reads ${receipt["hash"] ?? "absent"} now and nothing landed. Send the append again`
                : decision === "conflict" ? `conflict: the record moved past ${plan.args["base"] ?? "the base"}; it reads ${receipt["hash"] ?? "absent"} now. Read again and hand back the live hash`
                : decision === "exists" ? `exists: a tiddler already stands at ${plan.args["title"]} (--create lands only where none does)`
                : `${decision}: ${plan.args["title"]}`;
  emit(args, {
    ok, requestId: ran.requestId, data: receipt,
    ...(ok ? {} : { error: { code, message } }),
    human: () => {
      if (!ok) { console.error(`lares tiddler put: ${message}`); return; }
      if (typeof receipt["has"] === "string") console.log(receipt["has"]);
      console.log(`${decision}: ${plan.args["title"]}`);
      if (decision === "put") console.log(`  ${receipt["created"] === true ? "created" : "changed"} ${changed.join(", ")}`);
      if (typeof receipt["bag"] === "string" && decision === "put") console.log(`  in ${receipt["bag"]}`);
      if (receipt["hash"]) console.log(`  base: ${receipt["hash"]}`);
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
      if (receipt["hash"]) console.log(`  base: ${receipt["hash"]}`);
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
  if (args.flags["meme"] === true && (sub === "get" && !args.positional[1] || sub === "put" || sub === "delete")) {
    const familySub = sub === "get" ? "list" : sub === "put" && (args.options["slot"] !== undefined || args.options["append"] !== undefined) ? "patch" : sub;
    // A slot write names one text source: --append <file>, --text <words> or --file <path> (the slot's whole body).
    const sources = [args.options["append"], args.options["text"], args.options["file"]].filter((value) => value !== undefined);
    const ambiguous = sub === "put" && (familySub === "patch" ? sources.length !== 1 : args.options["text"] !== undefined && args.options["file"] !== undefined);
    const incompatible = sub === "put" && [args.options["fields"], args.options["unset"], args.options["tag-add"], args.options["tag-remove"], args.options["cut"]].some((value) => value !== undefined)
      || familySub === "patch" && args.flags["create"] === true
      || sub === "delete" && (args.flags["family"] === true || args.options["mode"] !== undefined);
    if (ambiguous || incompatible) {
      const message = ambiguous ? "a family write names one text source: --file <path> or --text <words> (a slot write: exactly one of --append <file>, --text, --file)" : "--meme takes family text or removal, not record fields, tags, or modes (--create rides a whole-family put, never a slot patch: a slot patch needs the family to stand)";
      emit(args, { ok: false, error: { code: "usage", message }, human: () => console.error(`lares tiddler ${sub}: ${message}`) });
      return exitFor("usage");
    }
    const familyArgs = { ...args, command: "meme", positional: sub === "get" ? [familySub] : [familySub, ...args.positional.slice(1)] } as ParsedArgs;
    return cmdFamily(familyArgs);
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
