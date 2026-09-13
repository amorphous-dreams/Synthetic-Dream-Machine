/**
 * `lares meme` — ONE FAMILY FOR EVERY LAW OVER MEME TEXT.
 *
 *   put <uri> [--recipe <slug> | --bag <slug>] [--base <hash>] [--file <path>]
 *   get <uri> [--recipe <slug> | --bag <slug>]
 *   list [--recipe <slug> | --bag <slug>] [--tree]
 *   delete <uri> [--recipe <slug> | --bag <slug>] [--if-match <hash>]
 *   normalize <file.mem ...>
 *   check <file.mem ...> [--gradient | --edges]
 *   project <file.mem | lar:uri> --to <mem|md|html|tid|json> [--out <path>] [--recipe <slug> | --bag <slug>]
 *   promote <docs/…/x.mem> [--dest-bag <lar:uri>] [--corpus <glob>]
 *
 * A VERB DECLARES ITS SEAT. `normalize` · `check` · `project --to md` over a file run LOCAL — they open a
 * path, read its bytes, and (normalize, project) write bytes back: no daemon, no store, no cap gate, no
 * effect record. The offline re-stamp of a stale block check keeps working with no socket. `put` · `get`
 * · `list` · `delete` · `project` over a `lar:` uri or to any rendered target ride the daemon verb
 * (`meme-put` · `meme-get` · `meme-list` · `meme-delete` · `meme-project`) — the one placement function,
 * the one removal, the one listing and the island's own renderers, reached from a terminal.
 *
 * THE CONTAINER LAW (every daemon seat):
 *   · no target        — the ANCHOR: the daemon's own wiki (`recipes/default`), its cascade routing
 *                        the records to the top bag as an in-wiki edit would.
 *   · --recipe <slug>  — an edit AS that wiki: its designated writable bag, write-then-sync.
 *   · --bag <slug>     — a residency placement into that bag; a bag the island cannot write refuses.
 *   · --base <hash>    — (put) the canonical hash the writer read (`meme get` reports it); records that
 *                        moved past it read as a CONFLICT and nothing lands.
 *   · --if-match <hash>— (delete) the same base, spelled as the route's header: stale → CONFLICT, nothing moves.
 *   · --tree           — (list) nest each root's slot tree beneath it; roots + canonical hash alone otherwise.
 *
 * Slugs ride bare (`sdm`, `lares`). Exit classes: a conflict exits `conflict`; a refusal `verb-error`;
 * an absent meme on `get` exits `not-found`; drift under `check` exits 1 for a CI gate.
 *
 * ── THE LOCAL LAWS ──────────────────────────────────────────────────────────────────────────────
 * `normalize` canonicalizes a carrier's framing so the round-trip lens laws hold (meme-corpus-roundtrip:
 * single-closer · content-whole · idempotent). Corpus files stand "non-canonical at rest until a
 * deliberate normalization commit" (wiki-layer-ontology): author freely, run this before committing. A
 * carrier's meta-declared `namespace` homes into its SOH opener as literal glyphs; a declaration naming the
 * grammar's address and not its name takes the current one. The transform stays pure + idempotent
 * (`@lararium/tw5/meme-normalize`), and the block check re-stamps over the body it follows.
 *
 * `check` reads the same law and writes nothing: drift exits 1 (CI / pre-commit). Its two other readings
 * share the seat — read alone, write nothing — so they ride it as flags:
 *   --gradient  how far down the ingest gradient each file sits: the KIND a file declares itself to be,
 *               and the marks that kind requires and lacks. Graceful parsing hides files — a carrier
 *               missing its address, declaration or body frame still parses, renders and round-trips,
 *               as something smaller than a meme, and every `if (!uri) continue` gate skips it. This
 *               reading fails on a fault, never on a kind.
 *   --edges     the addresses these carriers point AT, and which of them answer. A `lar:` uri names and
 *               does not fetch, so a carrier whose target moved keeps passing every other gate. Run it
 *               before a move and after: equal counts prove the weld held.
 *
 * `project --to md` over a file renders the submission pair — `<name>.md` + `<name>.md.meta`, beside the
 * source or under `--out <dir>` — through `projectSubmission` (`@lararium/tw5/meme-markdown`), the one
 * mouth the in-VM face (`$tw.lares.meme.project`) and the `meme-project` verb also call, so a pair
 * projected from any door carries identical bytes. No clock rides the meta: currency proves by re-projecting, never by a stamp.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/handoff
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { stdin, stdout } from "node:process";
import { basename, dirname, isAbsolute, join } from "node:path";
import { normalizeMemeSource } from "@lararium/tw5/meme-normalize";
import { projectSubmission } from "@lararium/tw5/meme-markdown";
import {
  readCarrierShape, readCarrierEdges, bccOf, verifyBcc, checkSpan,
  readCarrierLifecycle, checkCarrierLifecycle,
} from "@lararium/tw5";
import { vesselDid } from "../env.js";
import { runVerb } from "../verb-call.js";
import { readVerbOutcome } from "../verb-result.js";
import { emit, exitFor } from "../render.js";
import { helpLines } from "../command-help.js";
import { promoteCarrier, type PromotionSeat } from "./meme-promote.js";
import type { ParsedArgs } from "../parse-args.js";

class UsageError extends Error {}

export interface MemePlan {
  readonly verb: "meme-put" | "meme-get" | "meme-list" | "meme-delete";
  /** The verb args as the daemon receives them — `text` joins on put once the body is read. */
  readonly args: Record<string, string>;
}

/** The targets `project --to` renders. `md` over a file seats local; every other pairing rides the daemon. */
export const PROJECT_TARGETS = ["mem", "md", "html", "tid", "json"] as const;
export type ProjectTarget = typeof PROJECT_TARGETS[number];

export interface ProjectPlan {
  /** Where the verb runs: `local` reads a file and renders in-process; `daemon` rides `meme-project`. */
  readonly seat: "local" | "daemon";
  readonly to: ProjectTarget;
  /** The file source (local seat, or a daemon seat riding by its declared address). */
  readonly file?: string;
  /** The `lar:` uri the daemon renders — given, or read off the file's declared `uri-path`. */
  readonly uri?: string;
  readonly container: Record<string, string>;
}

const SUBS = ["put", "get", "list", "delete", "normalize", "check", "sitting", "project", "promote"] as const;
type Sub = typeof SUBS[number];

function usage(): void { for (const line of helpLines("meme")) console.error(line); }

/** The container args — at most one of `--recipe` / `--bag`; neither names the anchor. */
function container(args: ParsedArgs): Record<string, string> {
  const recipe = typeof args.options["recipe"] === "string" ? args.options["recipe"].trim() : "";
  const bag    = typeof args.options["bag"]    === "string" ? args.options["bag"].trim()    : "";
  if (recipe && bag) throw new UsageError("name one of --recipe <slug> / --bag <slug>, never both");
  const out: Record<string, string> = {};
  if (recipe) out["recipe"] = recipe;
  if (bag)    out["bag"]    = bag;
  return out;
}

/** The verb and its args for a sub-verb — the argument law, with no daemon in reach. */
export function memePlan(sub: "put" | "get" | "delete", args: ParsedArgs): MemePlan {
  const uri = args.positional[1];
  if (!uri) throw new UsageError(`a uri is required (e.g. \`lares meme ${sub} lar:///ha.ka.ba/...\`)`);
  const out: Record<string, string> = { uri, ...container(args) };
  if (sub === "put") {
    const base = typeof args.options["base"] === "string" ? args.options["base"].trim() : "";
    if (base) out["base"] = base;
    return { verb: "meme-put", args: out };
  }
  if (sub === "delete") {
    // The route spells the base as `If-Match`; the verb reads it as `base` — one hash, two spellings.
    const base = typeof args.options["if-match"] === "string" ? args.options["if-match"].trim() : "";
    if (base) out["base"] = base;
    return { verb: "meme-delete", args: out };
  }
  return { verb: "meme-get", args: out };
}

/** The listing addresses the SEAT, never one meme: the container alone, `tree` on request. */
export function listPlan(args: ParsedArgs): { readonly verb: "meme-list"; readonly args: Record<string, string | boolean> } {
  const out: Record<string, string | boolean> = { ...container(args) };
  if (args.flags["tree"]) out["tree"] = true;
  return { verb: "meme-list", args: out };
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

/**
 * The seat law for `project` — decided from the argument shape alone, with no daemon in reach.
 *
 * A source spelled `lar:` names a record only the island holds, so it rides the daemon whatever the
 * target. A file with `--to md` renders in-process. A file with any other target rides the daemon by its
 * DECLARED address (`uri-path`), read here so the plan carries it; the island renders the record it holds
 * at that address, which a file still unsent may differ from.
 */
export function projectPlan(args: ParsedArgs): ProjectPlan {
  const source = args.positional[1];
  if (!source) throw new UsageError("a source is required: a file, or a lar: uri");
  const to = typeof args.options["to"] === "string" ? args.options["to"].trim() : "";
  if (!(PROJECT_TARGETS as readonly string[]).includes(to)) {
    throw new UsageError(`--to names the target, one of ${PROJECT_TARGETS.join(" · ")}${to ? ` (got "${to}")` : ""}`);
  }
  const target = to as ProjectTarget;
  const cont = container(args);
  if (source.startsWith("lar:")) return { seat: "daemon", to: target, uri: source, container: cont };
  if (target === "md") return { seat: "local", to: target, file: source, container: cont };
  return { seat: "daemon", to: target, file: source, container: cont };
}

export async function cmdMeme(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0];
  if (!(SUBS as readonly string[]).includes(sub ?? "")) {
    if (sub) console.error(`lares meme: unknown sub-verb "${sub}"`);
    usage();
    return 2;
  }
  try {
    switch (sub as Sub) {
      case "put":       return await memePut(args);
      case "get":       return await memeGet(args);
      case "list":      return await memeList(args);
      case "delete":    return await memeDelete(args);
      case "normalize": return normalizeFiles(args, true);
      case "check":     return checkFiles(args);
      case "sitting":   return surveySitting(namedFiles(args, "sitting"));
      case "project":   return await memeProject(args);
      case "promote":   return await memePromote(args);
    }
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

/** One listed root, as the verb answers it. */
interface ListedRoot { uri: string; canonicalHash: string; slots?: ListedSlot[] }
interface ListedSlot { slot: string; uri: string; slots: ListedSlot[] }

async function memeList(args: ParsedArgs): Promise<number> {
  const plan = listPlan(args);
  const result = await runVerb(plan.verb, plan.args, await vesselDid());
  const outcome = readVerbOutcome(result);
  if (!outcome.ok) {
    const code = /cap-denied/.test(outcome.error ?? "") ? "cap-denied" : "verb-error";
    emit(args, { ok: false, requestId: result.requestId, error: { code, message: outcome.error ?? "the verb refused" }, human: () => console.error(`lares meme list: ${outcome.error}`) });
    return exitFor(code);
  }
  const roots = Array.isArray(outcome.output["roots"]) ? (outcome.output["roots"] as ListedRoot[]) : [];
  const slotLines = (slots: ListedSlot[] | undefined, depth: number): void => {
    for (const s of slots ?? []) { console.log(`${"  ".repeat(depth)}${s.slot}`); slotLines(s.slots, depth + 1); }
  };
  emit(args, {
    ok: true,
    requestId: result.requestId,
    data: { bag: outcome.output["bag"], roots },
    // One root per line — the base first so a shell reads it, the uri after; slots indent beneath.
    human: () => { for (const r of roots) { console.log(`${r.canonicalHash}  ${r.uri}`); slotLines(r.slots, 1); } },
  });
  return 0;
}

async function memeDelete(args: ParsedArgs): Promise<number> {
  const plan = memePlan("delete", args);
  const result = await runVerb(plan.verb, plan.args, await vesselDid());
  const outcome = readVerbOutcome(result);
  if (!outcome.ok) {
    const code = /cap-denied/.test(outcome.error ?? "") ? "cap-denied" : "verb-error";
    emit(args, { ok: false, requestId: result.requestId, error: { code, message: outcome.error ?? "the verb refused" }, human: () => console.error(`lares meme delete: ${outcome.error}`) });
    return exitFor(code);
  }
  const receipt = outcome.output;
  const decision = String(receipt["decision"] ?? "");
  const tombstoned = Array.isArray(receipt["tombstoned"]) ? (receipt["tombstoned"] as string[]) : [];
  const code = decision === "removed" ? "ok" : decision === "conflict" ? "conflict" : decision === "absent" ? "not-found" : "verb-error";
  const message = decision === "conflict" ? `conflict: the records moved past ${plan.args["base"] ?? "the base"} — read again and hand back the live hash`
                : decision === "absent" ? `no meme at ${plan.args["uri"]}` : `${decision}: ${plan.args["uri"]}`;
  emit(args, {
    ok: code === "ok",
    requestId: result.requestId,
    data: receipt,
    ...(code === "ok" ? {} : { error: { code, message } }),
    human: () => {
      if (code !== "ok") { console.error(`lares meme delete: ${message}`); return; }
      console.log(`removed: ${plan.args["uri"]}`);
      console.log(`  tombstoned ${tombstoned.length}`);
      if (receipt["canonicalHash"]) console.log(`  base: ${receipt["canonicalHash"]}`);
    },
  });
  return exitFor(code);
}

// ── the local laws: normalize · check ──────────────────────────────────────────────────────────

/** The files a local sub-verb names — every positional past the sub-verb. */
function namedFiles(args: ParsedArgs, sub: Sub): string[] {
  const files = args.positional.slice(1);
  if (files.length === 0) throw new UsageError(`lares meme ${sub} <file.mem ...> — name the carriers to read`);
  return files;
}

function readNamed(f: string): string {
  const abs = isAbsolute(f) ? f : join(process.cwd(), f);
  try {
    return readFileSync(abs, "utf8");
  } catch {
    throw new UsageError(`cannot read ${f}`);
  }
}

/**
 * The carrier with its check matching the body it follows.
 *
 * A carrier holding NO check keeps holding none — minting one here would give an unchecked carrier a
 * check it never claimed, and `unchecked` and `mismatch` are different facts this door must not fuse.
 *
 * ANCHORED AT THE SPAN, never a whole-file replace: `ni:///…` reads as prose in a carrier that
 * discusses checks, and a global swap would rewrite the lesson along with the stamp.
 */
function restamp(text: string): string {
  if (verifyBcc(text) !== "mismatch") return text;
  const span = checkSpan(text);
  const want = bccOf(text);
  if (!span || !want) return text;
  return text.slice(0, span.end)
       + text.slice(span.end).replace(/^ni:\/\/\/[a-z0-9-]+;[A-Za-z0-9_-]+/, want);
}

/**
 * `check`: the normalize law read alone, or one of its two sibling readings.
 *
 * parse-args reads `--gradient` as a boolean only when the next token is another option or the end;
 * `--gradient <file>` binds the file as its value instead. Read each reading from both, and recover any
 * file it ate, so flag position stays free.
 */
function checkFiles(args: ParsedArgs): number {
  const reading = (name: "gradient" | "edges" | "sitting"): { on: boolean; ate?: string } => {
    const opt = args.options[name];
    return typeof opt === "string" ? { on: true, ate: opt } : { on: name in args.flags };
  };
  const gradient = reading("gradient");
  const edges = reading("edges");
  const sitting = reading("sitting");
  const ate = [gradient.ate, edges.ate, sitting.ate].filter((f): f is string => typeof f === "string");
  const files = [...(ate.length > 0 ? args.positional.slice(1) : namedFiles(args, "check")), ...ate];
  if (gradient.on) return surveyGradient(files);
  if (edges.on) return surveyEdges(files);
  if (sitting.on) return surveySitting(files);
  return normalizeFiles(args, false);
}

/**
 * The normalize law over the named files — `write` seals the result to disk; read-alone reports it.
 *
 * ── AND IT NAMES WHAT IT DID NOT STAMP ─────────────────────────────────────────────────────────
 * Stamping SEALS a carrier's bytes. Doing it while OTHER carriers sit dirty and unread is how one hand
 * seals another hand's half-finished work — the check goes over whatever stands, and afterwards nothing
 * distinguishes a body its author finished from a body someone else caught mid-edit. Refusing a glob
 * stops a blanket sweep; it says nothing about the carriers a NAMED run passes over. Measured live: two
 * carriers stamped through this door while a third stood dirty and unnamed, and the door reported
 * success. A dirty carrier nobody named reads two ways — yours and forgotten, or nobody's — and this
 * door cannot tell which. So it NAMES them and carries on: a warning a caller can weigh, never a
 * refusal that would block a legitimate partial sweep.
 */
function normalizeFiles(args: ParsedArgs, write: boolean): number {
  const files = namedFiles(args, write ? "normalize" : "check");
  let drifted = 0;
  let flagged = 0;
  let faulted = 0;

  // Named under BOTH seats: the read-alone run is the one a caller reads before deciding to stamp.
  let unnamed: string[] = [];
  try {
    const dirty = String(execFileSync("git", ["diff", "--name-only", "--", "*.mem"], { encoding: "utf8" }))
      .split("\n").filter(Boolean);
    unnamed = dirty.filter((d: string) => !files.some((p) => p.endsWith(d) || d.endsWith(p)));
  } catch { /* not a git tree, or git absent — the naming rule carries alone */ }

  for (const f of files) {
    const src = readNamed(f);
    const res = normalizeMemeSource(src);

    // Flags surface whether or not the carrier rewrote — advisory triage the law will NOT auto-fix
    // (e.g. a register value off the band ladder).
    if (res.flags.length > 0) {
      flagged++;
      console.log(`flagged: ${f}`);
      for (const fl of res.flags) console.log(`  ⚠ ${fl}`);
    }

    // THE STAGE LAW BINDS ONLY WHERE THE TAG STANDS. An untagged carrier — law, record, reference,
    // 669 of 726 of them — declines the ladder, and this reading answers nothing new for it. A fault
    // here is a REFUSAL rather than a drift: no gesture can auto-close an open lean or invent a fold
    // target, so the door names what the stage owes and hands it back to a hand.
    const stage = checkCarrierLifecycle(src);
    if (stage.length > 0) {
      faulted++;
      console.log(`stage: ${f}`);
      for (const fault of stage) console.log(`  ✗ ${fault}`);
    }

    // THE CHECK COVERS THE BODY, SO IT IS PART OF BEING CANONICAL. Framing rides inside the checked
    // span: canonicalizing a carrier and leaving its old check standing hands the next door a carrier
    // this gesture just made non-canonical. STAMPED AFTER FRAMING, never before: the bytes the check
    // covers are the ones normalize leaves.
    const stamped = restamp(res.text);
    const changed = res.changed || stamped !== res.text;
    if (!changed) continue;
    drifted++;

    if (write) {
      writeFileSync(isAbsolute(f) ? f : join(process.cwd(), f), stamped);
      console.log(`normalized: ${f}`);
    } else {
      console.log(`would normalize: ${f}`);
    }
    for (const n of res.notes) console.log(`  - ${n}`);
    if (stamped !== res.text) {
      console.log(write ? "  - block check re-stamped over the body it follows"
                        : "  - block check would re-stamp over the body it follows");
    }
  }

  if (unnamed.length > 0) {
    console.log("\n  ⚠ dirty and NOT named on this run — read each before stamping it:");
    for (const u of unnamed) console.log(`      ${u}`);
  }

  const tail = (flagged > 0 ? ` (${flagged} flagged for triage)` : "")
    + (faulted > 0 ? ` (${faulted} standing off its declared stage)` : "");
  if (drifted === 0) {
    console.log(`all ${files.length} carrier(s) canonical.${tail}`);
    // A STAGE FAULT FAILS THE READ-ALONE SEAT even where every byte reads canonical — the two say
    // different things, and a gate that passed a `folded` carrier still holding its argument would
    // let the fire take a carrier whose content lives nowhere else.
    return write || faulted === 0 ? 0 : 1;
  }
  console.log(`${drifted} of ${files.length} carrier(s) drifted.${tail}`);
  // Read alone, drift fails loud so a CI gate or pre-commit hook catches un-normalized carriers.
  // Flags stay advisory (needs-triage), never a gate failure.
  return write ? 0 : 1;
}

/**
 * The gradient reading: one line per file, the kind it declares and what that kind still owes.
 *
 * Prints a per-kind tally even when nothing faults, because a run that read nothing must never look
 * like a run that found nothing — the failure this whole reading exists to catch.
 */
function surveyGradient(files: string[]): number {
  const byKind = new Map<string, number>();
  let faulted = 0;

  // THE SIDECAR PAIR IS A CARRIER IN TWO FILES. A content file with a `.meta` beside it declares
  // itself in the sidecar, so its own bytes carry no frame and never should — reading it as unframed
  // would fault the one shape the projector mints for a non-memetic filetype. This is the one kind a
  // reader cannot name from bytes alone, so it is settled here, where the file list is known.
  const declared = new Set(files.filter((f) => f.endsWith(".meta")).map((f) => f.slice(0, -".meta".length)));

  for (const f of files) {
    if (declared.has(f) || f.endsWith(".meta")) {
      byKind.set("sidecar", (byKind.get("sidecar") ?? 0) + 1);
      continue;
    }
    const shape = readCarrierShape(readNamed(f));
    byKind.set(shape.kind, (byKind.get(shape.kind) ?? 0) + 1);
    if (shape.faults.length === 0) continue;
    faulted++;
    console.log(`${shape.kind}: ${f}`);
    for (const fault of shape.faults) console.log(`  ⚠ ${fault}`);
  }

  const tally = [...byKind].sort().map(([k, n]) => `${k} ${n}`).join(" · ");
  console.log(`gradient: ${files.length} read — ${tally}`);
  if (faulted === 0) {
    console.log("every file stands at its kind's floor.");
    return 0;
  }
  console.log(`${faulted} file(s) below their kind's floor.`);
  return 1;
}

/**
 * The graph reading: which addresses these carriers name, and which of those any of them holds.
 *
 * The corpus passed IS the universe — an edge answers only if one of the files read declares that
 * address. So a partial file list reads as a broken graph, and the summary always states how many
 * carriers were read so a narrow run cannot be mistaken for a corpus-wide one.
 */
function surveyEdges(files: string[]): number {
  const held = new Set<string>();
  const texts = new Map<string, string>();
  for (const f of files) {
    const src = readNamed(f);
    texts.set(f, src);
    const uri = /^uri-path\s*=\s*"([^"]+)"/m.exec(readCarrierShape(src).marks.meta ? src : "")?.[1];
    if (uri) held.add(uri);
  }

  const dangling = new Map<string, { form: string; from: string[] }>();
  let total = 0, unaddressed = 0;
  for (const [f, src] of texts) {
    for (const e of readCarrierEdges(src)) {
      total++;
      // AN EDGE WITH NO ADDRESS NAMES A FILE, not a carrier. It cannot dangle, because it never
      // pointed at an address to begin with — it is counted apart so a sweep can find the class
      // without a resolver guessing which carrier a file became.
      if (e.address === null) { unaddressed++; continue; }
      if (held.has(e.address)) continue;
      const seen = dangling.get(e.address) ?? { form: e.form, from: [] };
      seen.from.push(f);
      dangling.set(e.address, seen);
    }
  }

  const ranked = [...dangling].sort((a, b) => b[1].from.length - a[1].from.length);
  for (const [address, { form, from }] of ranked) {
    console.log(`${from.length}× ${form}  lar:///${address}`);
    for (const f of from.slice(0, 3)) console.log(`     from ${f}`);
    if (from.length > 3) console.log(`     … and ${from.length - 3} more`);
  }
  const n = [...dangling.values()].reduce((a, d) => a + d.from.length, 0);
  const tail = unaddressed > 0 ? ` · ${unaddressed} naming a FILE rather than an address` : "";
  console.log(`edges: ${files.length} carrier(s) read · ${held.size} address(es) held · ${total} edge(s) · ${n} naming nothing${tail}`);
  return n === 0 ? 0 : 1;
}

/**
 * The sitting: every carrier the fire COULD take, named — and nothing burned.
 *
 * ── THE FIRE IS CALLED, NEVER SCHEDULED ─────────────────────────────────────────────────────────
 * The rite this reads for refuses a calendar, and so does the field it borrows its name from: Sagichō
 * runs "usually held around the fifteenth of January" with "a fair amount of regional variation in the
 * date". A sweep that burned on its own reading would decide an ending on a ratio, and the house has
 * already ruled the other way everywhere it touches this — a realm DISSOLVES BY COOLING and no party
 * holds a dissolving act. So this reading names candidates and stops. The operator calls the sitting.
 *
 * ── THE WELD COMES FIRST AND THE FIRE SECOND, ALWAYS ────────────────────────────────────────────
 * A carrier any other carrier still names is HELD, however the stage reads. Measured on this tree:
 * moving three carriers without the weld left 66 references naming addresses that no longer answered;
 * folding 37 weld-first broke none. The corpus passed IS the universe here, exactly as it is for the
 * edges reading — so a narrow run reads as a graph with holes, and the summary states the count read.
 *
 * ── AND THE HARVEST ROOM'S EMPTINESS IS THE WITNESS ─────────────────────────────────────────────
 * A `lifecycle/harvest` carrier names the living bag its materials fold into. It stands in the list as
 * long as it stands at all; the rite completes when the room reports empty.
 */
function surveySitting(files: string[]): number {
  const texts = new Map<string, string>();
  const addressOf = new Map<string, string>();
  for (const f of files) {
    const src = readNamed(f);
    texts.set(f, src);
    const uri = /^uri-path\s*=\s*"([^"]+)"/m.exec(src)?.[1];
    if (uri) addressOf.set(f, uri);
  }

  // Who names whom — read over every carrier in the run, in every form the grammar spells a reference.
  const inbound = new Map<string, string[]>();
  for (const [f, src] of texts) {
    for (const e of readCarrierEdges(src)) {
      if (e.address === null) continue;
      // A carrier naming ITSELF is not a reader holding it.
      if (addressOf.get(f) === e.address) continue;
      (inbound.get(e.address) ?? inbound.set(e.address, []).get(e.address)!).push(f);
    }
  }

  let candidates = 0, held = 0, rooms = 0;
  for (const [f, src] of texts) {
    const life = readCarrierLifecycle(src);
    if (life.stage === "harvest") {
      rooms++;
      console.log(`harvest room: ${f}`);
      console.log(`     materials fold to ${life.harvestTo ?? "— NO harvest-to; name the living bag"}`);
      continue;
    }
    if (life.stage !== "folded" && life.stage !== "retiring") continue;
    const addr = addressOf.get(f);
    const namers = addr ? inbound.get(addr) ?? [] : [];
    if (namers.length > 0) {
      held++;
      console.log(`held — ${namers.length} carrier(s) still name lar:///${addr}: ${f}`);
      for (const n of namers.slice(0, 3)) console.log(`     from ${n}`);
      if (namers.length > 3) console.log(`     … and ${namers.length - 3} more`);
      continue;
    }
    candidates++;
    console.log(`candidate (${life.stage}) ${f}`);
    if (life.stage === "folded") console.log("     every slot points, nothing names it — the fold stands welded");
  }

  const room = rooms > 0 ? ` · ${rooms} harvest room(s) still standing` : " · the harvest room stands empty";
  console.log(`sitting: ${files.length} carrier(s) read · ${candidates} candidate(s) · ${held} held${room}`);
  // THE READING NEVER FAILS. It reports a state; the operator decides what the state means, and an
  // exit code that called a candidate an error would make the reading un-runnable from a hook.
  return 0;
}

// ── project: the seat law decides local or daemon ──────────────────────────────────────────────

async function memeProject(args: ParsedArgs): Promise<number> {
  const plan = projectPlan(args);
  if (plan.seat === "local") return projectMdLocal(args, plan.file as string);

  let uri = plan.uri;
  if (!uri) {
    const declared = /^uri-path\s*=\s*"([^"]+)"/m.exec(readNamed(plan.file as string))?.[1];
    if (!declared) throw new UsageError(`${plan.file} declares no uri-path — a rendered target needs the address the island holds it at`);
    uri = `lar:///${declared}`;
  }
  const result = await runVerb("meme-project", { ...plan.container, uri, to: plan.to }, await vesselDid());
  const outcome = readVerbOutcome(result);
  if (!outcome.ok) {
    const code = /cap-denied/.test(outcome.error ?? "") ? "cap-denied" : "verb-error";
    emit(args, { ok: false, requestId: result.requestId, error: { code, message: outcome.error ?? "the verb refused" }, human: () => console.error(`lares meme project: ${outcome.error}`) });
    return exitFor(code);
  }
  const text = String(outcome.output["text"] ?? "");
  const out = typeof args.options["out"] === "string" ? args.options["out"] : "";
  if (out) writeFileSync(out, text, "utf8");
  // THE SIDECAR PAIR IS A CARRIER IN TWO FILES: an `md` projection rides its `.meta` in the reply, and it
  // lands beside the content file exactly as the local seat writes it.
  const meta = outcome.output["meta"];
  if (out && typeof meta === "string") writeFileSync(`${out}.meta`, meta, "utf8");
  emit(args, {
    ok: true,
    requestId: result.requestId,
    // The pair rides the reply whole: `text` (or the `out` path it landed at) AND the `.meta` sidecar when
    // the target carries one — a JSON consumer reads both halves without a disk beside it.
    data: {
      uri, to: plan.to, contentType: outcome.output["contentType"],
      ...(out ? { out, ...(typeof meta === "string" ? { outMeta: `${out}.meta` } : {}) } : { text }),
      ...(typeof meta === "string" ? { meta } : {}),
    },
    // The rendered text alone reaches stdout, so `lares meme project <uri> --to html > file` carries it.
    human: () => { if (out) console.log(`projected ${uri} -> ${out} (${plan.to})`); else stdout.write(text); },
  });
  return 0;
}

/** The submission pair, in-process: `<name>.md` + `<name>.md.meta` beside the source or under `--out`. */
function projectMdLocal(args: ParsedArgs, file: string): number {
  const out = args.options["out"];
  const titleBase = args.options["title-base"];
  if (out) mkdirSync(out, { recursive: true });
  const text = readNamed(file);
  const base = basename(file).replace(/\.mem$/, "");
  const p = projectSubmission(text, titleBase ? { title: `${titleBase}/${base}` } : undefined);
  const dir = out ?? dirname(file);
  const mdPath = join(dir, `${base}.md`);
  writeFileSync(mdPath, p.markdown);
  writeFileSync(`${mdPath}.meta`, p.meta);
  console.log(`projected ${p.uri} -> ${mdPath} (+.meta, source-check ${p.check})`);
  return 0;
}


/**
 * `promote` — THE PRIESTHOOD ACT AT A TERMINAL. The crossing itself lives in `meme-promote.ts`, injectable
 * whole; this door supplies the SEAT and the corpus the weld reads.
 *
 * AND THE SEAT REFUSES BY DEFAULT. Measured: nothing in this package reads `cap("admin", <bag>)` — no door,
 * no helper, no verb — so the terminal has no admin oracle to hand the crossing. Inventing one here would
 * make a refusal look like a grant, which is exactly the failure a receipt exists to catch. The door names
 * what it lacks and exits `cap-denied`; the crossing stands built and tested behind it, and lights the day a
 * cap reading reaches this shore.
 */
async function memePromote(args: ParsedArgs): Promise<number> {
  const file = args.positional[1];
  if (!file) throw new UsageError("lares meme promote <docs/…/x.mem> — name the carrier to cross");
  const root = process.cwd();
  const corpus = String(execFileSync("git", ["ls-files", "bags/*.mem"], { cwd: root, encoding: "utf8" }))
    .split("\n").filter(Boolean);
  const destBag = typeof args.options["dest-bag"] === "string" ? args.options["dest-bag"].trim() : undefined;

  const did = await vesselDid();
  const seat: PromotionSeat = {
    proposerNym: did, approverNym: did, approverKeyDid: did,
    // THE ABSENT ORACLE, named rather than faked. A reading that answered `true` here would certify every
    // crossing this door performs, and the receipt would read as an audit trail over an ungated act.
    holdsAdmin: async () => false,
    sign: async () => { throw new Error("unreachable — the cap refusal precedes the signature"); },
  };
  const outcome = await promoteCarrier({ root, file, corpus, ...(destBag ? { destBag } : {}) }, seat);
  if (!outcome.ok) {
    const code = /admin/.test(outcome.reason) ? "cap-denied" : "verb-error";
    emit(args, {
      ok: false, error: { code, message: outcome.reason },
      human: () => {
        console.error(`lares meme promote: ${outcome.reason}`);
        if (code === "cap-denied") console.error("  no cap(\"admin\") reading stands at this shore — the crossing is built and gated, and nothing moved");
      },
    });
    return exitFor(code);
  }
  emit(args, {
    ok: true, data: outcome,
    human: () => {
      console.log(`promoted: ${outcome.from} → ${outcome.to}`);
      console.log(`  ${outcome.sourceUri} → ${outcome.targetUri}`);
      console.log(`  welded ${outcome.welded} inbound edge(s) · dangling ${outcome.danglingBefore} → ${outcome.danglingAfter}`);
      console.log(`  receipt: ${outcome.receiptPath}`);
    },
  });
  return exitFor("ok");
}
