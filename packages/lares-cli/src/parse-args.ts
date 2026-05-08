/**
 * parse-args — minimal arg parser for `lares <command> [args...] [--flag] [--key value]`.
 *
 * Stays dep-free on purpose. The CLI's whole grammar lives in this file plus
 * the per-command handlers; no external parser hides dispatch behavior.
 *
 * Conventions:
 *   bare tokens → positional[]
 *   --key       → flag (boolean true)
 *   --key value → option (string)
 *   --no-key    → flag (boolean false)
 *   --          → end-of-options marker; remaining tokens land in positional[]
 */

export interface ParsedArgs {
  /** Subcommand name, or null when the user invoked `lares` with no command. */
  readonly command:    string | null;
  /** Positional args after the command. */
  readonly positional: readonly string[];
  /** --key value pairs (string-valued). */
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
      if (body.startsWith("no-")) { flags[body.slice(3)] = false; continue; }
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
