/**
 * THE FAMILY DOOR — what `lares tiddler put|get|delete --meme` runs: a meme family lands, patches a slot, lists its roots or
 * leaves, through the daemon's family verbs. Its plans read the tiddler row's flags alone.
 */
import { readFileSync } from "node:fs";
import { stdin } from "node:process";
import { vesselDid } from "../env.js";
import { containerArgs } from "../container-target.js";
import { verbFailure } from "../verb-call.js";
import { targetOnWriteRefusal } from "../target-option.js";
import { LocalWaitExpired } from "../local-connector.js";
import { readVerbOutcome } from "../verb-result.js";
import { emit, exitFor } from "../render.js";
import { UsageError, faceNamed, targetNamed, dispatch, refusalCodeOf, landedFace } from "./meme-shared.js";
import type { ParsedArgs } from "../parse-args.js";

export interface MemePlan {
  readonly verb: "meme-put" | "meme-list" | "meme-delete";
  /** The verb args as the daemon receives them — `text` joins on put once the body is read. */
  readonly args: Record<string, string>;
  /** The face `--face N` names: the verb acts as that face, on a session of it. Absent: the worn face (the one-shot). */
  readonly face?: number;
}


/** The verb and its args for a sub-verb — the argument law, with no daemon in reach. */
export function memePlan(sub: "put" | "delete", args: ParsedArgs): MemePlan {
  const face = faceNamed(args);
  const uri = args.positional[1];
  if (!uri) throw new UsageError(`a uri is required (e.g. \`lares meme ${sub} lar:///ha.ka.ba/... --recipe <slug>\`)`);
  // A LIT FACE RECEIVES VISITS through the one read door (`lares tiddler get --target`); a write naming one refuses here by name.
  const target = targetNamed(args);
  if (target.target !== undefined) throw new UsageError(targetOnWriteRefusal(`meme ${sub}`));
  const out: Record<string, string> = { uri, ...containerArgs(args, `meme ${sub}`, "write") };
  if (sub === "put") {
    const base = typeof args.options["base"] === "string" ? args.options["base"].trim() : "";
    if (base) out["base"] = base;
    return { verb: "meme-put", args: out, ...face };
  }
  // The route spells the base as `If-Match`; the verb reads it as `base` — one hash, two spellings.
  const held = args.options["if-match"] ?? args.options["base"];
  const base = typeof held === "string" ? held.trim() : "";
  if (base) out["base"] = base;
  return { verb: "meme-delete", args: out, ...face };
}

/** The listing addresses the SEAT, never one meme: the container alone, `tree` on request. */
export function listPlan(args: ParsedArgs): { readonly verb: "meme-list"; readonly args: Record<string, string | boolean>; readonly face?: number } {
  const face = faceNamed(args);
  const out: Record<string, string | boolean> = { ...containerArgs(args, "meme list"), ...targetNamed(args) };
  if (args.flags["tree"]) out["tree"] = true;
  return { verb: "meme-list", args: out, ...face };
}

/** The meme body: `--file`, else the whole of stdin. */
async function readBody(args: ParsedArgs): Promise<string> {
  if (typeof args.options["text"] === "string") return args.options["text"];
  const file = args.options["file"];
  if (typeof file === "string" && file && file !== "-") {
    try { return readFileSync(file, "utf8"); } catch { throw new UsageError(`cannot read --file ${file}`); }
  }
  if (stdin.isTTY) throw new UsageError("no meme text: pass --file <path> or pipe the meme on stdin");
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function memePut(args: ParsedArgs): Promise<number> {
  const plan = memePlan("put", args);
  const text = await readBody(args);
  const result = await dispatch(plan, { ...plan.args, text }, await vesselDid());
  const outcome = readVerbOutcome(result);
  if (!outcome.ok) {
    const code = refusalCodeOf(outcome.error);
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
      if (typeof receipt["has"] === "string") console.log(receipt["has"]);
      console.log(`${decision}: ${plan.args["uri"]}`);
      if (decision === "ingest") console.log(`  landed ${landed.length} · tombstoned ${tombstoned.length}`);
      // THE ANSWER NAMES THE LAYER: a face that holds no writer's seat in the wiki's workbench lands in its own personal layer.
      if (typeof receipt["bag"] === "string") console.log(receipt["layer"] === "personal"
        ? `  in ${receipt["bag"]}${landedFace(receipt)} (your personal layer: this face holds no writer's seat in the wiki's workbench; \`lares meme offer\` carries a record from here)`
        : `  in ${receipt["bag"]}${landedFace(receipt)}`);
      if (decision === "noop" && receipt["reason"]) console.log(`  ${receipt["reason"]}`);
      for (const w of warnings) console.log(`  ! ${w}`);
      if (receipt["canonicalHash"]) console.log(`  base: ${receipt["canonicalHash"]}`);
    },
  });
  return exitFor(code);
}

/**
 * THE PATCH'S ARGUMENT LAW, with no daemon in reach: a uri, a container, `--slot '#/name'`, exactly one of `--append <file>` or
 * `--file <path>` (its whole body), and `--base <hash>` (a patch edits bytes the writer read, so a blind one refuses before the wire).
 */
export function patchPlan(args: ParsedArgs): { readonly verb: "meme-patch"; readonly args: Record<string, string>; readonly file: string; readonly text?: string; readonly mode: "append" | "replace"; readonly face?: number } {
  const face = faceNamed(args);
  if (targetNamed(args).target !== undefined) throw new UsageError(targetOnWriteRefusal("meme patch"));
  const uri = args.positional[1];
  if (!uri) throw new UsageError("a uri is required (e.g. `lares meme patch lar:///ha.ka.ba/... --slot '#/x' --append note.txt --base <hash> --recipe <slug>`)");
  const out: Record<string, string> = { uri, ...containerArgs(args, "meme patch", "write") };
  // Each flag reads by its literal name, so the accepts row answers for it (no computed read).
  const trimmed = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
  const slot = trimmed(args.options["slot"]);
  if (!slot) throw new UsageError("--slot '#/name' names the slot whose body moves (`lares meme list --recipe <slug> --tree` names the slots a meme holds)");
  const append = trimmed(args.options["append"]);
  const slotFile = trimmed(args.options["file"]);
  const inline = typeof args.options["text"] === "string" ? args.options["text"] : undefined;
  if (Number(Boolean(append)) + Number(Boolean(slotFile)) + Number(inline !== undefined) !== 1) throw new UsageError("name exactly one of --append <file> (a paragraph at the end of the slot's body) or --text <words> | --file <path> (the slot's whole body)");
  const base = trimmed(args.options["base"]);
  if (!base) throw new UsageError("--base <hash> is required: the canonical hash `lares tiddler get <uri> --recipe <slug> --meme` prints on stderr (`base: sha256:…`)");
  out["slot"] = slot;
  out["base"] = base;
  return { verb: "meme-patch", args: out, file: append || slotFile, ...(inline !== undefined ? { text: inline } : {}), mode: append ? "append" : "replace", ...face };
}

async function memePatch(args: ParsedArgs): Promise<number> {
  const plan = patchPlan(args);
  let body: string;
  if (plan.text !== undefined) {
    body = plan.text;
  } else if (plan.file === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of stdin) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    body = Buffer.concat(chunks).toString("utf8");
  } else {
    try { body = readFileSync(plan.file, "utf8"); } catch { throw new UsageError(`cannot read --${plan.mode} ${plan.file}`); }
  }
  const result = await dispatch(plan, { ...plan.args, [plan.mode]: body }, await vesselDid());
  const outcome = readVerbOutcome(result);
  if (!outcome.ok) {
    const code = /cap-denied/.test(outcome.error ?? "") ? "cap-denied" : "verb-error";
    emit(args, { ok: false, requestId: result.requestId, error: { code, message: outcome.error ?? "the verb refused" }, human: () => console.error(`lares meme patch: ${outcome.error}`) });
    return exitFor(code);
  }
  const receipt = outcome.output;
  const decision = String(receipt["decision"] ?? "");
  const warnings = Array.isArray(receipt["warnings"]) ? (receipt["warnings"] as string[]) : [];
  const ok = decision === "ingest" || decision === "noop";
  const code = ok ? "ok" : decision === "conflict" ? "conflict" : decision === "absent" ? "not-found" : "verb-error";
  const where = `${plan.args["uri"]}${plan.args["slot"]}`;
  emit(args, {
    ok,
    requestId: result.requestId,
    data: receipt,
    ...(ok ? {} : { error: { code, message: decision === "absent" ? `no meme at ${plan.args["uri"]}` : `${decision}: ${warnings[0] ?? receipt["reason"] ?? where}` } }),
    human: () => {
      if (typeof receipt["has"] === "string") console.log(receipt["has"]);
      if (!ok) { console.error(`lares meme patch: ${decision === "absent" ? `no meme at ${plan.args["uri"]}` : warnings[0] ?? `${decision}: ${where}`}`); return; }
      console.log(`${decision}: ${where}`);
      if (typeof receipt["bag"] === "string") console.log(`  in ${receipt["bag"]}${receipt["layer"] === "personal" ? " (your personal layer)" : ""}`);
      for (const w of warnings) console.log(`  ! ${w}`);
      if (receipt["canonicalHash"]) console.log(`  base: ${receipt["canonicalHash"]}`);
    },
  });
  return exitFor(code);
}

/** One listed root, as the verb answers it. */
interface ListedRoot { uri: string; canonicalHash: string; bag?: string; floor?: boolean; slots?: ListedSlot[] }

/** The line a read prints on stderr where a house canon bag's floor snapshot answered it. */
const FLOOR_READ_NOTE = "read from the floor snapshot: this face holds no read on the live house canon document (the Kahu steward's face reads it live)";
interface ListedSlot { slot: string; uri: string; slots: ListedSlot[] }

/**
 * THE LISTING ARRIVES IN PAGES. One outcome carries a bounded number of rows, so the verb answers a page
 * and names the cursor of the next (`next`); this door hands each cursor back as `after` until none
 * remains, and a person reads every root. An answer whose `roots` holds no array (an outcome that carried
 * a count where the rows belong) refuses by name: an empty listing over a full seat would state a thing
 * nobody measured. A cursor that fails to advance refuses the same way.
 */
async function memeList(args: ParsedArgs): Promise<number> {
  const plan = listPlan(args);
  const did = await vesselDid();
  const roots: ListedRoot[] = [];
  let head: Record<string, unknown> = {};
  let requestId = "";
  const refuse = (code: "cap-denied" | "verb-error", message: string): number => {
    emit(args, { ok: false, requestId, error: { code, message }, human: () => console.error(`lares meme list: ${message}`) });
    return exitFor(code);
  };
  for (let after: string | null = null; ;) {
    const result = await dispatch(plan, after === null ? plan.args : { ...plan.args, after }, did);
    requestId = result.requestId;
    const outcome = readVerbOutcome(result);
    if (!outcome.ok) return refuse(/cap-denied/.test(outcome.error ?? "") ? "cap-denied" : "verb-error", outcome.error ?? "the verb refused");
    const page = outcome.output["roots"];
    if (!Array.isArray(page)) {
      const count = (page as { boundedArrayCount?: unknown } | null | undefined)?.boundedArrayCount;
      return refuse("verb-error", typeof count === "number"
        ? `the listing arrived as a count of ${count} roots and named none of them; this vessel answers an unpaged listing`
        : "the listing named no roots array");
    }
    roots.push(...(page as ListedRoot[]));
    if (after === null) head = outcome.output;
    const next = outcome.output["next"];
    if (typeof next !== "string" || next === "") break;
    if (after !== null && next <= after) return refuse("verb-error", `the listing's cursor stood still at ${next}`);
    after = next;
  }
  const slotLines = (slots: ListedSlot[] | undefined, depth: number): void => {
    for (const s of slots ?? []) { console.log(`${"  ".repeat(depth)}${s.slot}`); slotLines(s.slots, depth + 1); }
  };
  // The seat as the verb named it: one bag, or a recipe with the bags its stack read and any it could not reach.
  const seat: Record<string, unknown> = {};
  for (const key of ["has", "bag", "floor", "recipe", "bags", "unreached"]) if (head[key] !== undefined) seat[key] = head[key];
  const unreached = Array.isArray(head["unreached"]) ? (head["unreached"] as string[]) : [];
  emit(args, {
    ok: true,
    requestId,
    data: { ...seat, roots },
    // One root per line — the base first so a shell reads it, the uri after; slots indent beneath.
    human: () => {
      if (typeof head["has"] === "string") console.log(head["has"]);
      for (const r of roots) { console.log(`${r.canonicalHash}  ${r.uri}`); slotLines(r.slots, 1); }
      for (const bag of unreached) console.error(`lares meme list: ${bag} stands unreached; its roots stay unlisted`);
      if (head["floor"] === true || roots.some((r) => r.floor === true)) console.error(FLOOR_READ_NOTE);
    },
  });
  return 0;
}

async function memeDelete(args: ParsedArgs): Promise<number> {
  const plan = memePlan("delete", args);
  const result = await dispatch(plan, plan.args, await vesselDid());
  const outcome = readVerbOutcome(result);
  if (!outcome.ok) {
    const code = refusalCodeOf(outcome.error);
    emit(args, { ok: false, requestId: result.requestId, error: { code, message: outcome.error ?? "the verb refused" }, human: () => console.error(`lares meme delete: ${outcome.error}`) });
    return exitFor(code);
  }
  const receipt = outcome.output;
  const decision = String(receipt["decision"] ?? "");
  const tombstoned = Array.isArray(receipt["tombstoned"]) ? (receipt["tombstoned"] as string[]) : [];
  const retracted = Array.isArray(receipt["retracted"]) ? (receipt["retracted"] as string[]) : [];
  const code = decision === "removed" ? "ok" : decision === "conflict" ? "conflict" : decision === "absent" ? "not-found" : "verb-error";
  const message = decision === "conflict" ? `conflict: the records moved past ${plan.args["base"] ?? "the base"} — read again and hand back the live hash`
                : decision === "absent" ? `no meme at ${plan.args["uri"]}` : `${decision}: ${plan.args["uri"]}`;
  emit(args, {
    ok: code === "ok",
    requestId: result.requestId,
    data: receipt,
    ...(code === "ok" ? {} : { error: { code, message } }),
    human: () => {
      if (typeof receipt["has"] === "string") console.log(receipt["has"]);
      if (code !== "ok") { console.error(`lares meme delete: ${message}`); return; }
      console.log(`removed: ${plan.args["uri"]}`);
      console.log(`  tombstoned ${tombstoned.length}${retracted.length > 0 ? ` · retracted ${retracted.length}` : ""}`);
      if (receipt["canonicalHash"]) console.log(`  base: ${receipt["canonicalHash"]}`);
    },
  });
  return exitFor(code);
}


const FAMILY_SUBS = ["put", "patch", "list", "delete"] as const;

/** Run one family operation: `positional[0]` names it (`put` · `patch` · `list` · `delete`), the rest rides as the tiddler door parsed it. */
export async function cmdFamily(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0] as typeof FAMILY_SUBS[number];
  try {
    switch (sub) {
      case "put":    return await memePut(args);
      case "patch":  return await memePatch(args);
      case "list":   return await memeList(args);
      case "delete": return await memeDelete(args);
    }
  } catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: unknown }).code === "no-container") {
      const msg = err instanceof Error ? err.message : String(err);
      emit(args, { ok: false, error: { code: "no-container", message: msg }, human: () => console.error(msg) });
      return 2;
    }
    if (err instanceof UsageError) {
      const msg = err.message;
      const code = msg.startsWith("face-malformed:") ? "face-malformed" : "usage";
      emit(args, { ok: false, error: { code, message: msg }, human: () => console.error(`lares tiddler --meme ${sub}: ${msg}`) });
      return exitFor("usage");
    }
    if (err instanceof LocalWaitExpired) {
      // A local wait ending tells itself apart from an absent daemon by type, never by message.
      const w = verbFailure(err);
      emit(args, {
        ok: false, ...(w.requestId !== undefined ? { requestId: w.requestId } : {}),
        error: { code: w.code, message: w.message, ...(w.hint !== undefined ? { hint: w.hint } : {}) },
        human: () => console.error(`lares tiddler --meme ${sub}: ${w.message}`),
      });
      return exitFor(w.code);
    }
    const f = verbFailure(err);
    emit(args, {
      ok: false, ...(f.requestId !== undefined ? { requestId: f.requestId } : {}),
      error: { code: f.code, message: f.message, ...(f.hint !== undefined ? { hint: f.hint } : {}) },
      human: () => console.error(`lares tiddler --meme ${sub}: ${f.message}`),
    });
    return exitFor(f.code);
  }
}
