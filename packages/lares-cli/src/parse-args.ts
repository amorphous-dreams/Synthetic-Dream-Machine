// @heleuma:exempt — internal helper with no semantic boundary worth
// anchoring. The CLI's command grammar lives in bin/lares.ts (which IS
// anchored); this file is a dep-free token-walker beneath it.

/**
 * parse-args — the CLI's one token rule: `lares <door> [words...] [name=value...]`, and the call shape's split (`splitCall`:
 * `lares get title=… aperture=measure`).
 *
 * Stays dep-free on purpose. The CLI's whole grammar lives in this file plus the per-command handlers; no external parser
 * hides dispatch behavior.
 *
 * Conventions on a door line:
 *   bare tokens   → positional[]
 *   name=value    → a param, split at its FIRST `=` (the value may carry more `=`): `true` and `false` land in flags, every
 *                   other value (the empty one too) lands in options, so a handler reads `flags["dry-run"]` and
 *                   `options["face"]` where it always read them. A repeated name joins its values with a space.
 *   --<global>    → one of GLOBAL_FLAGS (`--help`, `--json`, `--no-json`, …): a flag, taking no value
 *   --<name>      → refused by name (`ArgsError`), naming the param spelling that cures it
 *   --            → end of params: every later token lands in positional[] whole, a `--x` or a `k=v` included
 *
 * A call head (`get`, `put`, `delete`, `rename`, `msg`, `watch`, `act`, `-`, a `lar:///` address) keeps its params in
 * positional[] as written: the call door splits them itself (`splitCall`), and a value spelled `--x` rides as a value.
 */

/**
 * THE GLOBAL FLAGS: the dash spellings every line still reads, each a flag that takes no value. `--json`/`--no-json` pick the
 * render (render.ts); `--help` and `--meme` ask the door's help; `--yes` passes the confirmation gate; `--skip-build` rides the
 * fresh-build gate's re-exec; `--keyhive-trace` asks for Keyhive's own tracing. Each reads as its param spelling too
 * (`json=true`).
 */
export const GLOBAL_FLAGS: readonly string[] = ["json", "help", "meme", "yes", "skip-build", "keyhive-trace"];

/** The verb words the call door answers as commands of their own; an address (`lar:///…`), `act` and `-` answer beside them. */
export const CALL_VERBS = ["get", "put", "delete", "rename", "msg", "watch"] as const;

/** True where a command word heads a call line, whose params the call door splits itself. */
export const isCallWord = (command: string | null): boolean =>
  command !== null && ((CALL_VERBS as readonly string[]).includes(command) || command === "-" || command === "act" || command.startsWith("lar:///"));

/** A command line the grammar itself refuses (a dash flag outside GLOBAL_FLAGS, a word after a param); the dispatcher turns it into exit 2. */
export class ArgsError extends Error {
  constructor(message: string) { super(message); this.name = "ArgsError"; }
}

/**
 * THE CALL SHAPE'S ONE TOKEN RULE (comms-ux-enacts fork 8): a token matching `^[a-z][a-z0-9-]*=` names a param, split at its
 * FIRST `=`, so a title or a filter holding `=` stays a value and `with=--x` rides whole. The leading run of every other token
 * names the verb, a skin spelling or an address (`get`, `oracle cast`, `lar:///engine.record.reads`). A word after the first
 * param refuses by name, since nothing past the split reads position. A repeated param joins its values with a space, in the
 * order written, as TiddlyWiki writes a list (`tag-add=a tag-add=b` reads `a b`). Everything past this split (routes, `#/takes`
 * binding, value conversion, the sigil parse) runs in the VM.
 */
export const PARAM_TOKEN = /^[a-z][a-z0-9-]*=/;

/** One call line split by the token rule: the verb words and the params by name. */
export interface CallLine {
  readonly words:  readonly string[];
  readonly params: Readonly<Record<string, string>>;
}

export function splitCall(tokens: readonly string[]): CallLine {
  const words: string[] = [];
  const params: Record<string, string> = {};
  for (const tok of tokens) {
    if (PARAM_TOKEN.test(tok)) {
      const eq = tok.indexOf("=");
      const key = tok.slice(0, eq);
      const value = tok.slice(eq + 1);
      const held = params[key];
      params[key] = held === undefined || held === "" ? value : value === "" ? held : `${held} ${value}`;
      continue;
    }
    if (Object.keys(params).length > 0) throw new ArgsError(`${JSON.stringify(tok)} stands after a param: the verb words lead the line, and every later token names a param as name=value`);
    words.push(tok);
  }
  return { words, params };
}

export interface ParsedArgs {
  /** Subcommand name, or null when the user invoked `lares` with no command. */
  readonly command:    string | null;
  /** Positional args after the command (a call line's params among them, as written). */
  readonly positional: readonly string[];
  /** The params a door line names whose value reads as words (`face=2`, `note=`). */
  readonly options:    Readonly<Record<string, string>>;
  /** The params a door line names `true` or `false` (`dry-run=true`), and each global flag (`--json` true, `--no-json` false). */
  readonly flags:      Readonly<Record<string, boolean>>;
}

/** The flags a call line names that burned into the dials, each to the param it reads as. */
export const BURNED_FLAGS: Readonly<Record<string, string>> = Object.freeze({
  "dry-run": "mu=_0", json: "mu=!0", quiet: "mu=!0", meme: "aperture=measure", skinny: "aperture=measure", all: "aperture=arc", grain: "aperture=arc",
});

/** A value as a shell word, quoted where it holds a space or a quote. */
const shellWord = (value: string): string => (/^[A-Za-z0-9_@%+=:,./#*?!<>~-]+$/.test(value) ? value : `'${value.replace(/'/g, "'\\''")}'`);

/** One dash token read: its name, the value it names after `=` (or null), and whether it negates (`--no-x`). */
function dashOf(token: string): { readonly name: string; readonly value: string | null; readonly negated: boolean } {
  const body = token.slice(2);
  const eq = body.indexOf("=");
  const name = eq === -1 ? body : body.slice(0, eq);
  const value = eq === -1 ? null : body.slice(eq + 1);
  return name.startsWith("no-") && value === null ? { name: name.slice(3), value: null, negated: true } : { name, value, negated: false };
}

/**
 * THE DASH SPELLINGS BURNED INTO PARAMS: the refusal a line carrying a `--name` outside GLOBAL_FLAGS answers, naming each
 * flag's param reading and the whole line spelled in params. A bare `--x` before a word reads as `x=<word>`, and before nothing,
 * another flag or a param as `x=true`; `--no-x` reads `x=false`. On a call line a flag that burned into the dials names its dial.
 */
function burnedDashes(command: string, tokens: readonly string[], call: boolean): ArgsError {
  const cure: string[] = ["lares", command];
  const readings: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    if (!tok.startsWith("--") || tok === "--") { cure.push(shellWord(tok)); continue; }
    const dash = dashOf(tok);
    if (GLOBAL_FLAGS.includes(dash.name) && dash.value === null) { cure.push(tok); continue; }
    let reading: string;
    if (call && BURNED_FLAGS[dash.name] !== undefined) reading = BURNED_FLAGS[dash.name]!;
    else if (dash.negated) reading = `${dash.name}=false`;
    else if (dash.value !== null) reading = `${dash.name}=${shellWord(dash.value)}`;
    else {
      const next = tokens[i + 1];
      if (next !== undefined && !next.startsWith("--") && !PARAM_TOKEN.test(next)) { reading = `${dash.name}=${shellWord(next)}`; i++; }
      else reading = `${dash.name}=true`;
    }
    readings.push(`${tok} reads as ${reading}`);
    cure.push(reading);
  }
  const kind = call ? "a call takes name=value params" : "a door takes name=value params";
  return new ArgsError(`dash-flag-burned: ${readings.join(" · ")} (${kind}; the dash spellings left are ${GLOBAL_FLAGS.map((g) => `--${g}`).join(" ")}); run: ${cure.join(" ")}`);
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const tokens     = argv.slice();
  const command    = tokens.shift() ?? null;
  const positional: string[]                 = [];
  const options:    Record<string, string>   = {};
  const flags:      Record<string, boolean>  = {};
  const call = isCallWord(command);

  const end = tokens.indexOf("--");
  const head = end === -1 ? tokens : tokens.slice(0, end);
  const burned = head.some((tok) => {
    if (!tok.startsWith("--") || tok === "--") return false;
    const dash = dashOf(tok);
    return !GLOBAL_FLAGS.includes(dash.name) || dash.value !== null;
  });
  if (burned) throw burnedDashes(command ?? "", head, call);

  for (const tok of head) {
    if (tok.startsWith("--")) {
      const dash = dashOf(tok);
      flags[dash.name] = !dash.negated;
      continue;
    }
    if (!call && command !== null && PARAM_TOKEN.test(tok)) {
      const eq = tok.indexOf("=");
      const key = tok.slice(0, eq);
      const value = tok.slice(eq + 1);
      if (value === "true" || value === "false") { flags[key] = value === "true"; continue; }
      const held = options[key];
      options[key] = held === undefined || held === "" ? value : value === "" ? held : `${held} ${value}`;
      continue;
    }
    positional.push(tok);
  }
  if (end !== -1) positional.push(...tokens.slice(end + 1));

  return { command, positional, options, flags };
}
