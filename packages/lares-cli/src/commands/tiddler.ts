/**
 * `lares tiddler <get | put | delete>` — THE TIDDLER DOOR's record verbs, the CLI skin of the daemon's `tiddler-get` ·
 * `tiddler-put` · `tiddler-delete` (the wiki-engine half rides `lares wiki filter | render | status`).
 *
 * ONE VERB, ONE SHAPE, EVERY DOOR. Each sub-verb plans the daemon verb's own args from the command line and prints
 * the daemon's own answer: `--json` carries the verb's output verbatim as `data`, the same body the MCP seat's
 * `tiddler_get` · `tiddler_put` · `tiddler_delete` hand back, so a script and an AI session read one answer.
 *
 * A tiddler verb acts on ONE record with its fields, whatever its type: a plain note, a data tiddler, a meme's root or
 * one of its slots. The meme door (`lares meme`) stays the door for a FAMILY's text (split, recompose, the block
 * check); this door reads any record and patches fields and tags without touching text. A delete reads the one family
 * law: a plain tiddler leaves; a meme root or slot answers the consequence the delete would land and refuses
 * (`tiddler-delete-in-a-family`) unless the line names the family act (`--family`), which lands it as one change.
 * A delete deletes plainly: the record leaves its layer and no tombstone rises. Only a lower layer makes it a choice: where
 * one holds the title too, no mode refuses `delete-mode-needed`, and the line names one: `--mode kapae` shadows the title
 * from a writable layer and the layers beneath keep their records; `--mode reveal` retracts the topmost record and the
 * one beneath surfaces. A title the wiki reads absent answers too: a plain delete retracts a kāpae that hides nothing.
 *
 * The container law holds: name `--recipe <slug>` or `--bag <slug>`. `--recipe default` answers the worn face's daemon
 * wiki, and `--recipe <slug>` any wiki that face reaches, in that wiki's own engine; a wiki it reaches none of refuses
 * `wiki-unreached`, and a bag (one bag, no wiki) refuses `wiki-not-anchored`.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout
 */

import { readFileSync } from "node:fs";
import { stdin, stdout } from "node:process";
import { containerArgs } from "../container-target.js";
import { emit, exitFor } from "../render.js";
import { DoorUsage, countOf, guardDoor, namesOf, runDoor, wordOf, type DoorPlan } from "./door-call.js";
import { targetOf, targetOnWriteRefusal } from "../target-option.js";
import { helpLines } from "../command-help.js";
import type { ParsedArgs } from "../parse-args.js";

const SUBS = ["get", "put", "delete"] as const;
type Sub = typeof SUBS[number];

/** The verb and its args for a tiddler sub-verb: the argument law, with no daemon in reach. */
export function tiddlerPlan(sub: Sub, args: ParsedArgs): DoorPlan {
  const title = args.positional[1];
  if (!title) throw new DoorUsage(`a title is required (e.g. \`lares tiddler ${sub} "My Note" --recipe default\`)`);
  // A LIT FACE RECEIVES VISITS: `--target` names another lit face; a get reads its daemon wiki while the command keeps the
  // face it wears, and a put or delete naming it refuses here by name, before any door opens.
  const target = targetOf(args);
  if (sub !== "get" && target.target !== undefined) throw new DoorUsage(targetOnWriteRefusal(`tiddler ${sub}`));
  const out: Record<string, unknown> = { ...containerArgs(args, `tiddler ${sub}`, sub === "get" ? "read" : "write"), title, ...target };
  if (sub === "get") {
    const slot = wordOf(args.options["slot"]);
    if (slot) out["slot"] = slot;
    const fields = namesOf(args.options["fields"]);
    if (fields) out["fields"] = fields;
    if (args.flags["skinny"] === true) out["text"] = false;
    const maxBytes = countOf(args.options["max-bytes"], "max-bytes");
    if (maxBytes !== null) out["maxBytes"] = maxBytes;
    return { verb: "tiddler-get", args: out };
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
  const base = wordOf(args.options["base"]);
  if (base) out["base"] = base;
  if (args.flags["create"] === true) out["create"] = true;
  return { verb: "tiddler-put", args: out };
}

/** A put's text, only where the caller names a source: `--text <words>`, `--file <path>`, or `--file -` for stdin. A field patch reads none. */
async function putText(args: ParsedArgs): Promise<string | null> {
  const inline = args.options["text"];
  const file = wordOf(args.options["file"]);
  if (typeof inline === "string" && file) throw new DoorUsage("name one text source: --text <words> or --file <path>, never both");
  if (typeof inline === "string") return inline;
  if (!file) return null;
  if (file !== "-") return readFileSync(file, "utf8");
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

interface GotTiddler { fields: Record<string, string>; hash: string; textHash: string | null; bag: string | null; position: string; family?: string; omitted?: string[] }

async function tiddlerGet(args: ParsedArgs): Promise<number> {
  const plan = tiddlerPlan("get", args);
  const ran = await runDoor(args, "tiddler get", plan);
  if (!ran.ok) return ran.exit;
  const title = String(ran.output["title"] ?? plan.args["title"]);
  const tiddler = ran.output["tiddler"] as GotTiddler | null | undefined;
  if (!tiddler) {
    emit(args, { ok: false, requestId: ran.requestId, data: ran.output, error: { code: "not-found", message: `no tiddler at ${title}` }, human: () => console.error(`lares tiddler get: no tiddler at ${title}`) });
    return exitFor("not-found");
  }
  emit(args, {
    ok: true, requestId: ran.requestId, data: ran.output,
    // The record reaches stdout as a `.tid` reads: one `name: value` line per field, a blank line, the text. The base rides stderr.
    human: () => {
      const { text, ...rest } = tiddler.fields;
      for (const [name, value] of Object.entries(rest)) stdout.write(`${name}: ${value}\n`);
      if (typeof text === "string") stdout.write(`\n${text}`);
      console.error(`base: ${tiddler.hash}`);
      if (tiddler.bag) console.error(`bag: ${tiddler.bag}`);
      if (tiddler.position !== "plain") console.error(`position: ${tiddler.position} of ${tiddler.family ?? title}`);
      if (tiddler.omitted?.length) console.error(`omitted: ${tiddler.omitted.join(", ")}`);
    },
  });
  return 0;
}

async function tiddlerPut(args: ParsedArgs): Promise<number> {
  const plan = tiddlerPlan("put", args);
  const text = await putText(args);
  const ran = await runDoor(args, "tiddler put", text === null ? plan : { verb: plan.verb, args: { ...plan.args, text } });
  if (!ran.ok) return ran.exit;
  const receipt = ran.output;
  const decision = String(receipt["decision"] ?? "");
  const changed = Array.isArray(receipt["changed"]) ? (receipt["changed"] as string[]) : [];
  const ok = decision === "put" || decision === "noop";
  const code = ok ? "ok" : decision === "conflict" || decision === "exists" ? "conflict" : "verb-error";
  const message = decision === "conflict" ? `conflict: the record moved past ${plan.args["base"] ?? "the base"}; it reads ${receipt["hash"] ?? "absent"} now. Read again and hand back the live hash`
                : decision === "exists" ? `exists: a tiddler already stands at ${plan.args["title"]} (--create lands only where none does)`
                : `${decision}: ${plan.args["title"]}`;
  emit(args, {
    ok, requestId: ran.requestId, data: receipt,
    ...(ok ? {} : { error: { code, message } }),
    human: () => {
      if (!ok) { console.error(`lares tiddler put: ${message}`); return; }
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

export async function cmdTiddler(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0];
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
    }
  });
}
