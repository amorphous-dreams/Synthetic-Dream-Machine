// @heleuma:exempt — internal helper with no semantic boundary worth
// anchoring. The CLI's command grammar lives in bin/lares.ts (which IS
// anchored); this file is a dep-free token-walker beneath it.

/**
 * parse-args — minimal arg parser for `lares <command> [args...] [--flag] [--key value] [--key=value]`, and the call shape's
 * one token rule (`splitCall`: `lares get title=… aperture=measure`).
 *
 * Stays dep-free on purpose. The CLI's whole grammar lives in this file plus
 * the per-command handlers; no external parser hides dispatch behavior.
 *
 * Conventions:
 *   bare tokens   → positional[]
 *   --key         → flag (boolean true)
 *   --key value   → option (string); a VALUE_FLAGS name takes the next token whatever it starts with
 *   --key=value   → option (string); splits at the FIRST `=`, so the value may carry more `=`.
 *                   An empty value (`--key=`) stays an option holding "".
 *   --no-key      → flag (boolean false)
 *   --no-key=…    → refused: a negation takes no value (`ArgsError`)
 *   --            → end-of-options marker; remaining tokens land in positional[]
 *
 * A name in `BOOLEAN_FLAGS` takes NO value, in every position: `--rotate <id>` leaves `<id>` positional,
 * `--rotate=x` refuses by name. A flag nobody reads is refused BY NAME before the handler runs (bin/lares.ts,
 * each command's `accepts` row).
 */

/**
 * THE BOOLEAN FLAGS: every name some handler reads through `args.flags[...]` and none reads through
 * `args.options[...]`. A name outside this set parses greedily (`--k v` binds `v`), so a boolean flag left out
 * would swallow the positional after it. `tests/parse-args.test.ts` walks the handlers' source: a name in this
 * set that any handler reads as an option reds, and so does a flag-read name missing from the set unless it is
 * one of `VALUE_OR_FLAG`.
 */
export const BOOLEAN_FLAGS: ReadonlySet<string> = new Set([
  "abandon", "accept-omissions", "added", "all", "all-strata", "apply", "approve", "brief", "bulk", "cancel", "canon", "cards", "commit", "cosign", "confirm", "cut", "drain",
  "deny", "docs", "draft", "drop", "dry-run", "edge", "ephemeral", "every", "executable", "force", "fresh", "foreground", "from-persona", "held", "help", "help-mempalace", "history",
  "hearth", "hold", "if-due", "in-wiki", "init", "join", "json", "keep", "keep-hooks", "keyhive-trace", "lag", "launch", "list", "meme", "memory", "new", "offer", "orphans", "over-fresher",
  "page", "pair", "palaces", "paper", "partial", "passphrase", "pending", "probe", "quorum", "overwrite", "remove", "repour", "restart", "revert", "rotate", "seat", "sessions", "shadow", "skip-build", "spectral", "split-root",
  "staged", "streams", "sweep", "tag-blobs", "terms", "tree", "verbose", "wait", "watch", "with-web", "witness", "writeback", "yes",
]);

/**
 * Names a command reads as a flag in one spelling and as a valued option in another (`meme project --check`
 * alone or `--check <x>`; `--grammar`; `rite kukulu --rollback` alone or `--rollback <rev>`). The parser cannot tell which spelling comes, so these
 * stay greedy. `--face` takes a value (`fleet join offer --face 1`), and so does `--target` (`wiki render T --target h1`) and `--land`
 * (`kahua lift <uri> --land <answer>`); each flag read only refuses the bare spelling. `--observe` stands alone on `vessel stand`
 * (read the standing, act on nothing) and takes the arm's pointers on `oracle cast --observe <pointers>`.
 */
export const VALUE_OR_FLAG: ReadonlySet<string> = new Set(["check", "face", "grammar", "land", "observe", "rollback", "target", "recipe", "realm"]);


/**
 * THE VALUE FLAGS: names that carry free text (a note, a reason, a field list, a spirit's words) and ALWAYS take the next
 * token as their value, whatever it starts with: `--text "---\nfront: matter\n---"` binds the front matter, never reads
 * as a flag. Every other non-boolean name keeps the peek (`--key --other` leaves `--key` bare). `tests/parse-args.test.ts`
 * reds a name here that a handler reads as a flag, or that sits in `BOOLEAN_FLAGS` / `VALUE_OR_FLAG`.
 */
export const VALUE_FLAGS: ReadonlySet<string> = new Set(["fields", "note", "reason", "text"]);

/** A command line the grammar itself refuses (`--no-key=…`, `--=v`, a word after a param); the dispatcher turns it into exit 2. */
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
  /** Positional args after the command. */
  readonly positional: readonly string[];
  /** --key value / --key=value pairs (string-valued). */
  readonly options:    Readonly<Record<string, string>>;
  /** --flag (true) and --no-flag (false). */
  readonly flags:      Readonly<Record<string, boolean>>;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const tokens     = argv.slice();
  const command    = tokens.shift() ?? null;
  const positional: string[]                 = [];
  const options:    Record<string, string>   = {};
  const flags:      Record<string, boolean>  = {};

  let endOfOptions = false;
  while (tokens.length > 0) {
    const tok = tokens.shift() as string;
    if (endOfOptions) { positional.push(tok); continue; }
    if (tok === "--") { endOfOptions = true; continue; }
    if (tok.startsWith("--")) {
      const body = tok.slice(2);
      const eq = body.indexOf("=");
      if (body.startsWith("no-")) {
        if (eq !== -1) throw new ArgsError(`${tok}: a --no-<name> negation takes no value`);
        flags[body.slice(3)] = false;
        continue;
      }
      if (eq !== -1) {
        const key = body.slice(0, eq);
        if (key === "") throw new ArgsError(`${tok}: a flag needs a name before "="`);
        if (BOOLEAN_FLAGS.has(key)) throw new ArgsError(`${tok}: --${key} is a flag and takes no value`);
        options[key] = body.slice(eq + 1);
        continue;
      }
      if (BOOLEAN_FLAGS.has(body)) { flags[body] = true; continue; }
      const next = tokens[0];
      // --key value form: peek; consume next token if it does not look like an option (a VALUE_FLAGS name consumes it whatever it starts with).
      if (next !== undefined && (VALUE_FLAGS.has(body) || !next.startsWith("--"))) {
        options[body] = next;
        tokens.shift();
      } else {
        flags[body] = true;
      }
      continue;
    }
    positional.push(tok);
  }

  return { command, positional, options, flags };
}
