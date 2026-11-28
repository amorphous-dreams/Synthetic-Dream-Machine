/**
 * console-verbs — one table of console verbs (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-console-door).
 *
 * The page's `lares(...)` door reads two of these: the page's own (the rows only a page can run) and the vessel worker's (the
 * rows the vessel answers over the page's port). A row names the CLI's own argv path (`vessel read`, `vault status`), carries
 * its help row, and may say why it cannot run now (`waits`). `help` reads the rows as they stand at the call, so a vessel at
 * its floor and a vessel wearing a face list differently with no second list anywhere.
 *
 * A row takes no argument: a word past its path refuses `usage`. So no secret reaches a row by this road; a verb that needs
 * one opens a ceremony ask or refuses by name. This module imports nothing.
 */

/** A refusal by name. The name crosses the port as the reply's `refusal` and reads as the result's `error.code`. */
export class ConsoleRefused extends Error {
  override readonly name = "ConsoleRefused";
  constructor(readonly refusal: string, reason: string) { super(`${refusal}: ${reason}`); }
}

/** The CLI's `json=true` shape: what `lares <verb> json=true` prints, as a value. */
export type ConsoleResult =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

export interface ConsoleVerbRow {
  /** The CLI's own argv path, one word per element. */
  readonly path: readonly string[];
  readonly summary: string;
  /** Why the row cannot run now (`[code, reason]`), or null where it can. Absent: it always can. */
  readonly waits?: () => (readonly [code: string, reason: string]) | null | Promise<(readonly [code: string, reason: string]) | null>;
  readonly run: () => Promise<unknown>;
}

export interface ConsoleHelp {
  /** The rows that answer now, sorted by verb. */
  readonly entries: readonly { readonly verb: string; readonly summary: string }[];
  /** The rows this table holds and cannot run now, each with the name and reason it would refuse under. */
  readonly waits: readonly { readonly verb: string; readonly summary: string; readonly code: string; readonly reason: string }[];
}

const verbOf = (path: readonly string[]): string => path.join(" ");

/** Stand a table over rows read fresh at each call. */
export function standConsoleVerbs(rows: () => readonly ConsoleVerbRow[]) {
  const sorted = (): ConsoleVerbRow[] => [...rows()].sort((a, b) => verbOf(a.path).localeCompare(verbOf(b.path)));
  const help = async (): Promise<ConsoleHelp> => {
    const entries: { verb: string; summary: string }[] = [];
    const waits: { verb: string; summary: string; code: string; reason: string }[] = [];
    for (const row of sorted()) {
      const why = await row.waits?.() ?? null;
      if (why) waits.push({ verb: verbOf(row.path), summary: row.summary, code: why[0], reason: why[1] });
      else entries.push({ verb: verbOf(row.path), summary: row.summary });
    }
    return { entries, waits };
  };
  return {
    help,
    /** Whether a row stands at exactly this path. */
    holds: (argv: readonly string[]): boolean => rows().some((row) => verbOf(row.path) === verbOf(argv)),
    /** Run one verb: `help`, or the row at exactly this path. A word past a row's path refuses `usage`; any other word refuses `verb-not-held`. */
    async run(argv: readonly string[]): Promise<unknown> {
      if (argv.length === 1 && argv[0] === "help") return help();
      const all = rows();
      const row = all.find((r) => verbOf(r.path) === verbOf(argv));
      if (!row) {
        const under = all.find((r) => r.path.length < argv.length && r.path.every((word, i) => argv[i] === word));
        if (under) throw new ConsoleRefused("usage", `\`${verbOf(under.path)}\` takes no argument`);
        throw new ConsoleRefused("verb-not-held", "this table holds no such verb");
      }
      const why = await row.waits?.() ?? null;
      if (why) throw new ConsoleRefused(why[0], why[1]);
      return row.run();
    },
  };
}

export type ConsoleVerbTable = ReturnType<typeof standConsoleVerbs>;
