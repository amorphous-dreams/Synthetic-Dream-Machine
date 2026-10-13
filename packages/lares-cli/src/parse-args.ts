// @heleuma:exempt — internal helper with no semantic boundary worth
// anchoring. The CLI's command grammar lives in bin/lares.ts (which IS
// anchored); this file is a 50-line dep-free token-walker beneath it.

/**
 * parse-args — minimal arg parser for `lares <command> [args...] [--flag] [--key value] [--key=value]`.
 *
 * Stays dep-free on purpose. The CLI's whole grammar lives in this file plus
 * the per-command handlers; no external parser hides dispatch behavior.
 *
 * Conventions:
 *   bare tokens   → positional[]
 *   --key         → flag (boolean true)
 *   --key value   → option (string)
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
  "all", "all-strata", "apply", "approve", "cosign", "confirm", "cut", "debug", "detach", "drain",
  "dry-run", "executable", "force", "foreground", "from-persona", "held", "help", "help-mempalace",
  "hold", "in-wiki", "init", "install", "join", "json", "keep", "keep-hooks", "list", "meme", "observe", "orphans",
  "pair", "palaces", "paper", "partial", "passphrase", "quorum", "repour", "restart", "rotate", "seat", "shadow", "skip-build", "spectral", "split-root",
  "sweep", "tag-blobs", "tree", "with-web", "writeback", "yes",
]);

/**
 * Names that one command reads as a flag and another reads as a valued option (`vault status --check` vs
 * `meme ... --check <x>`; `--grammar`; `--ephemeral`). The parser cannot tell which command is meant, so these
 * stay greedy.
 */
export const VALUE_OR_FLAG: ReadonlySet<string> = new Set(["check", "ephemeral", "grammar"]);


/** A command line the grammar itself refuses (`--no-key=…`, `--=v`); the dispatcher turns it into exit 2. */
export class ArgsError extends Error {
  constructor(message: string) { super(message); this.name = "ArgsError"; }
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
      // --key value form: peek; consume next token if it does not look like an option.
      if (next !== undefined && !next.startsWith("--")) {
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
