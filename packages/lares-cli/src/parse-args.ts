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
 * A flag nobody reads is refused BY NAME before the handler runs (bin/lares.ts, each command's `accepts`
 * row). `opt()` / `flag()` / `unread()` track which names a reader touched, for a handler that wants the
 * same check from the inside.
 */

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
  /** Read an option, marking its name read. Present on a line `parseArgs` produced. */
  readonly opt?:       (name: string) => string | undefined;
  /** Read a flag, marking its name read. Present on a line `parseArgs` produced. */
  readonly flag?:      (name: string) => boolean | undefined;
  /** Every option/flag name on the line that no `opt()` / `flag()` read has touched. */
  readonly unread?:    () => string[];
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
        options[key] = body.slice(eq + 1);
        continue;
      }
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

  const read = new Set<string>();
  return {
    command, positional, options, flags,
    opt:    (name) => { read.add(name); return options[name]; },
    flag:   (name) => { read.add(name); return flags[name]; },
    unread: () => [...new Set([...Object.keys(options), ...Object.keys(flags)])].filter((n) => !read.has(n)),
  };
}
