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
 *   --<name>      → refused (`ArgsError`, `dash-flag-burned`): params ride as name=value alone
 *   --            → end of params: every later token lands in positional[] whole, a `k=v` included
 *
 * A call head (`get`, `put`, `delete`, `rename`, `msg`, `watch`, `-`, a `lar:///` address) keeps its params in positional[]
 * as written: the call door splits them itself (`splitCall`). The terminal's own params (TERMINAL_PARAMS) lift out of a call
 * line into flags, since they shape this process and never the carrier.
 */

/**
 * THE GLOBAL PARAMS: the names every door line reads beside its carriers' own takes, each a flag (`json=true`). `json` picks
 * the render (render.ts; `json=false` forces prose); `yes` passes the confirmation gate; `skip-build` rides the fresh-build
 * gate's re-exec; `keyhive-trace` asks for Keyhive's own tracing. `lares help <door>` asks a door's help.
 */
export const GLOBAL_PARAMS: readonly string[] = ["json", "yes", "skip-build", "keyhive-trace"];

/** The global params that shape this process alone: a call line lifts them into flags, and its carrier never reads them. */
export const TERMINAL_PARAMS: readonly string[] = ["json", "skip-build", "keyhive-trace"];

/** The refusal every dash flag answers: params ride as name=value, and the door's help names the ones it takes. */
export const dashBurned = (command: string | null): string =>
  `dash-flag-burned: dash flags burned; params ride as name=value (lares help${command === null || command.startsWith("-") ? "" : ` ${command}`})`;

/** The verb words the call door answers as commands of their own; an address (`lar:///…`) and `-` answer beside them. */
export const CALL_VERBS = ["get", "put", "delete", "rename", "msg", "watch"] as const;

/** True where a command word heads a call line, whose params the call door splits itself. */
export const isCallWord = (command: string | null): boolean =>
  command !== null && ((CALL_VERBS as readonly string[]).includes(command) || command === "-" || command.startsWith("lar:///"));

/** A command line the grammar itself refuses (a dash flag, a word after a param); the dispatcher turns it into exit 2. */
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
  /** The params a door line names `true` or `false` (`dry-run=true`), and a call line's terminal params (`json=true`). */
  readonly flags:      Readonly<Record<string, boolean>>;
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
  if (command?.startsWith("--") === true || head.some((tok) => tok.startsWith("--"))) throw new ArgsError(dashBurned(command));

  for (const tok of head) {
    if (command !== null && PARAM_TOKEN.test(tok)) {
      const eq = tok.indexOf("=");
      const key = tok.slice(0, eq);
      const value = tok.slice(eq + 1);
      const switched = value === "true" || value === "false";
      if (call && !(switched && TERMINAL_PARAMS.includes(key))) { positional.push(tok); continue; }
      if (switched) { flags[key] = value === "true"; continue; }
      const held = options[key];
      options[key] = held === undefined || held === "" ? value : value === "" ? held : `${held} ${value}`;
      continue;
    }
    positional.push(tok);
  }
  if (end !== -1) positional.push(...tokens.slice(end + 1));

  return { command, positional, options, flags };
}
