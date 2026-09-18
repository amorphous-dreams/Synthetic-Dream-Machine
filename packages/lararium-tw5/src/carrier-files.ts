/**
 * carrier-files — THE ONE PLACE THAT ANSWERS WHICH FILES ARE CARRIERS.
 *
 * ── READ THE DECLARATION, NEVER THE PATH ─────────────────────────────────────────────────────────
 * The house rules that a carrier declares itself, and twenty-two readers enumerated "the corpus" by
 * hardcoded glob instead — in THREE disagreeing answers: `bags/(star)(star)/(star).mem` alone, that
 * plus a `wikis/` tree holding ZERO carriers, and that plus one `.tid` glob.
 *
 * Measured the day this landed: 718 tracked files DECLARE, and 700 of them sit inside the narrow
 * glob. Two of the eighteen outside it tell the whole story —
 *
 *   · packages/lararium-tw5/tiddlers/memetic-wikitext.tid, the runtime kernel face the spec names,
 *     a REAL carrier that no gate had read for three rulings;
 *   · README.md, correctly NOT a carrier, whose doctype sits inside a code fence as a lesson.
 *
 * A path answers neither case. A declaration answers both.
 *
 * ── TRACKED, NEVER WALKED ────────────────────────────────────────────────────────────────────────
 * The enumeration runs `git ls-files`. Untracked scratch — a half-written draft, a generated
 * artifact, a stray editor backup — is not corpus, and a filesystem walk would enrol it and then
 * fail every per-carrier law on files nobody committed.
 *
 * ── A DECLARATION INSIDE A FENCE DECLARES NOTHING ────────────────────────────────────────────────
 * The spec memes teach the doctype by QUOTING it. Without the fence mask this finder enrols every
 * teaching doc and then fails it for lacking a frame the lesson never claimed. `fence-mask` already
 * holds that law for the framing and edge scanners; it holds it here too, from the same module, so
 * the corpus boundary and the sigil scans cannot drift apart.
 *
 * ── TWO WAYS TO DECLARE, ONE CORPUS ─────────────────────────────────────────────────────────────
 * A carrier declares with a doctype standing on its own line, or with its `type` — a `.tid` field
 * line or the meta block's key. A file carrying neither is undeclared, whatever else it holds, and
 * every per-carrier law reads the whole of what this finder returns.
 */

import { fencedSpans, maskedExec, type MaskSpan } from "./meme-ast/fence-mask.js";
import { META_OPEN_RE } from "./meta-fence.js";
/**
 * The media type comes from the ONE place that spells it. A hand-spelled constant drifts the moment
 * the real one moves, and a `type` that no longer matches simply stops projecting — no throw, no
 * diagnostic.
 */
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";

/**
 * Vendored trees that answer to their own house. Each holds its own corpus, its own gates, and its
 * own release cadence; enrolling one here would fail this repo's laws on another repo's files.
 */
export const SUBMODULES: readonly string[] = [
  "VSCode-TW5-Syntax",
  "TiddlyWiki5",
  "mempalace",
  "elyncia",
  "ftls",
];

/** How a file says it carries: a doctype line, or its `type`. */
export type CarrierDeclarationForm = "doctype" | "type-field";

export interface CarrierDeclaration {
  readonly form: CarrierDeclarationForm;
  /** Byte offset of the declaration in the file's text. */
  readonly at: number;
  /** The declaration line, trimmed — enough for a gate to report what it met. */
  readonly text: string;
}

/**
 * ── A QUOTED DECLARATION STANDS INSIDE SOMETHING ELSE'S LINE ─────────────────────────────────────
 * A carrier's declaration OWNS its line. Every one of the 18 files measured quoting the declaration
 * without carrying it embeds it in a line of another language — `const DECL = "<<!DOCTYPE …>>";`,
 * a python `_ENVELOPE_HEAD = """…`, a JSON `"text": "…"`, a `//` comment about the form. The fence
 * mask covers how a TEXT file quotes; this covers how a PROGRAM does, without asking what language
 * any file is written in.
 */
function standsAlone(form: CarrierDeclarationForm, line: string): boolean {
  if (form === "doctype") return /^<<!DOCTYPE\s+"?memetic-wikitext[^\n>]*>>$/.test(line);
  return ALONE_TYPE_RE.test(line);
}

/**
 * The doctype sigil a carrier opens with. It declares only standing alone on its line: inside a
 * comment it renders as nothing and reaches no reader, so it declares nothing.
 */
const DOCTYPE_RE = /<<!DOCTYPE\s+"?memetic-wikitext[^\n>]*>>/;

/** A `.tid` field line, where no sigil may precede the fields. */
const TID_TYPE_RE = new RegExp(String.raw`^\s*type\s*:\s*` + CARRIER_TYPE.replace("+", "\\+"), "m");
/** The same fact as a toml key, inside the meta block. */
const TOML_TYPE_RE = new RegExp(String.raw`^\s*type\s*=\s*"` + CARRIER_TYPE.replace("+", "\\+") + `"`, "m");
/** The meta block's opener — the ONE spelling, from `meta-fence.ts`. A LABELLED fence carries slot
 *  identity; a plain ```toml fence does not. The local spelling admitted `\s*` before the newline,
 *  which matches a newline itself: an opener followed by a blank line swallowed the blank into the
 *  match and every offset taken from it shifted by a line. `[ \t]*` cannot. */
/** The type spelling as a WHOLE line, either separator — what `standsAlone` holds a declaration to. */
const ALONE_TYPE_RE = new RegExp(String.raw`^type\s*[:=]\s*"?` + CARRIER_TYPE.replace("+", "\\+") + `"?$`);

/** The line `at` falls on, trimmed. */
function lineAt(text: string, at: number): string {
  const from = text.lastIndexOf("\n", at) + 1;
  const to = text.indexOf("\n", at);
  return text.slice(from, to < 0 ? text.length : to).trim();
}

/**
 * The declaration a text carries, or `null` when it carries none.
 *
 * Path-free by construction — a caller holding bytes from a bag, a stream, or a tiddler gets the
 * same verdict as one holding a file. The verdict rests on the text alone, which is the whole point.
 */
export function declaresCarrier(text: string, spans?: readonly MaskSpan[]): CarrierDeclaration | null {
  const mask = spans ?? fencedSpans(text);
  let best: CarrierDeclaration | null = null;
  const offer = (form: CarrierDeclarationForm, at: number) => {
    const line = lineAt(text, at);
    if (!standsAlone(form, line)) return;
    if (best === null || at < best.at) best = { form, at, text: line };
  };

  const doctype = maskedExec(text, DOCTYPE_RE, mask);
  if (doctype) offer("doctype", doctype.index);

  const tid = maskedExec(text, TID_TYPE_RE, mask);
  if (tid) offer("type-field", tid.index);

  // THE META BLOCK IS STRUCTURE, NOT A QUOTATION. Every carrier writes its coordinates inside a
  // ```toml meta fence, so a mask applied flat would blind the finder to the very block that names
  // the type. The opener rides as a SPAN START — admitted — while a ````-quoted example of a meta
  // block sits in a span's INTERIOR and stays refused.
  const open = maskedExec(text, META_OPEN_RE, mask, true);
  if (open) {
    const span = mask.find((s) => s.start === open.index);
    const body = text.slice(open.index + open[0].length, span ? span.end : text.length);
    const key = TOML_TYPE_RE.exec(body);
    if (key) offer("type-field", open.index + open[0].length + key.index);
  }

  return best;
}

/** Whether a repo-relative path belongs to a vendored tree. */
export function inSubmodule(rel: string): boolean {
  return SUBMODULES.some((s) => rel === s || rel.startsWith(s + "/"));
}

/** A file that declares, with the declaration it carries. */
export interface CarrierFile extends CarrierDeclaration {
  /** Repo-relative, forward-slashed — the spelling `git ls-files` reports. */
  readonly path: string;
}

/**
 * Every tracked file in `repo` that DECLARES itself a carrier, with the declaration it carries.
 *
 * Ordered as `git ls-files` orders them, so two runs over one tree agree byte for byte and a gate's
 * report reads the same twice.
 */
/**
 * ONE WALK PER TREE PER PROCESS. The enumeration reads every tracked file's opening bytes; a witness
 * that asks three times pays for three walks, and two corpus laws timed out at five seconds the first
 * time they did. A git working tree does not move under a running gate, so the answer is cached by
 * resolved root. A caller that has changed the tree and needs a fresh read calls `forgetCarrierFiles`.
 */
const WALKED = new Map<string, CarrierFile[]>();

/** Drop the cached walk — for a caller that writes carriers and must re-read the tree it changed. */
export function forgetCarrierFiles(repo?: string): void {
  if (repo === undefined) WALKED.clear();
  else WALKED.delete(repo);
}

export function readCarrierFiles(repo: string): CarrierFile[] {
  const cached = WALKED.get(repo);
  if (cached) return cached;

  // THE MODULE STAYS IMPORTABLE WHERE IT CANNOT RUN. `declaresCarrier` reads bytes and holds in every
  // host; only the ENUMERATION needs a git working tree. A static `node:fs` import would pull the
  // filesystem into every browser bundle that reaches this package's index for the reader alone, so
  // the builtins resolve at CALL time and a browser meets the cost only if it asks the impossible.
  const builtin = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process?.getBuiltinModule;
  if (!builtin) throw new Error("carrier-files: the corpus enumeration reads a git working tree — Node only");
  const { execFileSync } = builtin("node:child_process") as typeof import("node:child_process");
  const { readFileSync } = builtin("node:fs") as typeof import("node:fs");
  const { join } = builtin("node:path") as typeof import("node:path");

  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: repo, encoding: "utf8", maxBuffer: 1 << 28 })
    .split("\0").filter(Boolean);

  const out: CarrierFile[] = [];
  for (const rel of tracked) {
    if (inSubmodule(rel)) continue;
    let text: string;
    // A file git tracks may still refuse to read as text — a symlink to nowhere, a binary blob.
    // Refusing to read is refusing to declare.
    try { text = readFileSync(join(repo, rel), "utf8"); } catch { continue; }
    // The declaration stands near the top of every carrier this corpus holds; the cheap prefilter
    // keeps the fence mask off the several thousand files that name neither the doctype nor the type.
    if (!text.includes("DOCTYPE") && !text.includes(CARRIER_TYPE)) continue;
    const d = declaresCarrier(text);
    if (d) out.push({ path: rel, ...d });
  }
  WALKED.set(repo, out);
  return out;
}

/**
 * Every carrier's repo-relative path — the shape twenty-two readers wanted from their globs.
 *
 * `repo` defaults to the process working directory so a tool run from the repo root needs no
 * argument; every gate in `tools/` passes its own resolved root.
 */
export function carrierFiles(repo?: string): string[] {
  return readCarrierFiles(repo ?? process.cwd()).map((c) => c.path);
}
